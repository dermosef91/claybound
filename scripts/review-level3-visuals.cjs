// Park the live game at authored spots in Ember Caverns and screenshot the
// actual WebGL frame, with what the frame costs to submit, so a scenery change
// can be judged against `new assets/level3-visual-improvements/target.png`.
//
//   ROOT=<checkout or copy holding dist/> PORT=5199 OUT=<dir> SPOTS=turning-heart node scripts/review-level3-visuals.cjs
//
// The script serves ROOT/dist itself on PORT, so several copies can be judged
// side by side without sharing a server. Machinery is advanced a fixed number
// of ticks before the capture, so the turning ring and its hanging deck sit in
// the same place every time and two renders differ only by the change made.
const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),http=require('http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(process.env.ROOT||path.resolve(__dirname,'..'));
const out=path.resolve(process.env.OUT||path.join(root,'docs/level3-visuals'));
const port=Number(process.env.PORT||5199);
const spots=(process.env.SPOTS||'turning-heart').split(',').filter(Boolean);
const WIDTH=Number(process.env.WIDTH||1664),HEIGHT=Number(process.env.HEIGHT||936);
// Camera framing matches the supplied current.png/target.png pair: the hero on
// the boarding ledge a third in from the left, the ring's hub at the top right.
const SPOTS={
 'turning-heart':{x:160.9,y:.75,ground:'heart-boarding',cameraX:163.2,cameraY:1.45,ticks:720},
 'heart-balcony':{x:153.5,y:10,ground:'heart-balcony',ticks:720},
 'start':{x:6,y:0,ground:'start',ticks:120},
 'kiln':{x:62,y:0,ticks:120},
 'furnace-ferry':{x:100,y:0,ticks:120},
 'sunken-relay':{x:205,y:0,ticks:120},
 'spitter-gallery':{x:262,y:0,ticks:120},
 'last-light':{x:292,y:0,ticks:120}
};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function serve(){
 const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',path.join(root,'dist')],{stdio:'ignore'});
 for(let i=0;i<100;i++){
  const ok=await new Promise(resolve=>{const req=http.get({host:'127.0.0.1',port,path:'/index.html'},res=>{res.resume();resolve(res.statusCode===200);});req.on('error',()=>resolve(false));});
  if(ok)return server;await wait(100);
 }
 server.kill();throw new Error('static server did not start on '+port);
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=await serve();
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--use-angle=metal','--enable-gpu-rasterization']});
 const errors=[],badRequests=[],results=[];
 try{
  const page=await browser.newPage({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)badRequests.push(r.url());});
  await page.route('**/app.js*',async route=>{
   let body=fs.readFileSync(path.join(root,'dist/app.js'),'utf8');
   body=body.replace('function frame(now){','function frame(now){ if(window.playtest?.manual){requestAnimationFrame(frame);return;}');
   body+='\nwindow.playtest={manual:false,get game(){return game},get world(){return world},get input(){return input},begin,home,draw(dt=0){world.render(game,dt);healthHUD.draw(game,dt);updateHUD(performance.now());},tick(n){for(let i=0;i<n;i++)game.tick(FIXED_DT,input);}};';
   await route.fulfill({contentType:'text/javascript',body});
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(()=>window.playtest&&document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
  await page.evaluate(()=>{playtest.manual=true;});
  await page.evaluate(async()=>{await playtest.begin(2,true,'original');});
  await page.waitForFunction(()=>playtest.game?.status==='playing'&&document.getElementById('loading').classList.contains('hidden'),null,{timeout:120000});
  // Overlays that belong to a live session, not to a judged frame.
  await page.addStyleTag({content:'#chapter-intro,#hint,#touch-controls,#desktop-controls,#fade,#timer,#dialog{display:none!important}'});
  for(const name of spots){
   const spot=SPOTS[name];if(!spot)throw new Error('unknown spot '+name);
   const info=await page.evaluate(async spot=>{
    const g=playtest.game,w=playtest.world;
    const {cameraTarget}=await import('./camera.js');
    g.level.enemies.forEach(e=>{if(Math.abs(e.x-spot.x)<30){e.alive=false;}});
    Object.assign(g.player,{x:spot.x,y:spot.y,vx:0,vy:0,facing:1,groundId:spot.ground||null,invuln:0});
    g.sectionId=Math.max(0,g.level.sections.findLastIndex(s=>spot.x>=s.x));
    // Deterministic machinery: the same number of fixed steps from a fresh
    // chapter start puts the ring and its deck in the same place every run.
    g.time=0;g.level.platforms.forEach(p=>{if(p.kind==='orbit'||p.kind==='ferry'||p.kind==='lift'){p.x=p.baseX??p.x;p.y=p.baseY??p.y;}});
    playtest.tick(spot.ticks||120);
    Object.assign(g.player,{x:spot.x,y:spot.y,vx:0,vy:0,facing:1,groundId:spot.ground||null});
    w.syncVisible(g.level,spot.x,true);
    const target=cameraTarget(g.player,w.viewW,w.viewH,w.landscape);
    w.cameraAnchorY=g.player.y;w.cameraX=spot.cameraX??target.x;w.cameraY=spot.cameraY??target.y;w.lastPlayerX=spot.x;w.cameraLook=0;w.cameraFace=1;w.trauma=0;w.shake=0;
    // Settle streamed geometry and light handoffs without moving the camera.
    for(let i=0;i<90;i++)playtest.draw(0);
    const frames=[];
    for(let i=0;i<60;i++){const t0=performance.now();w.render(g,0);frames.push(performance.now()-t0);}
    frames.sort((a,b)=>a-b);
    const info=w.renderer.info,calls=info.render.calls,triangles=info.render.triangles;
    playtest.draw(0);
    let lights=0,transparent=0,meshes=0;
    w.scene.traverse(o=>{if(o.isLight&&o.visible&&o.intensity>0)lights++;if(o.isMesh&&o.visible&&o.material?.transparent)transparent++;if(o.isMesh)meshes++;});
    return {spot:name=undefined,x:spot.x,cameraX:w.cameraX,cameraY:w.cameraY,viewW:w.viewW,viewH:w.viewH,calls,triangles,geometries:info.memory.geometries,textures:info.memory.textures,programs:info.programs.length,frameMs:frames[30],frameMsP90:frames[54],lights,transparentMeshes:transparent,sceneMeshes:meshes};
   },spot);
   info.spot=name;
   await page.screenshot({path:path.join(out,name+'.png')});
   results.push(info);
   console.log('CAPTURE',name,JSON.stringify(info));
  }
 }finally{await browser.close();server.kill();}
 fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({root,results,errors,badRequests},null,2));
 if(errors.length)console.log('PAGE ERRORS',errors.join('\n'));
 if(badRequests.length)console.log('BAD REQUESTS',badRequests.join('\n'));
})().catch(e=>{console.error(e);process.exit(1)});
