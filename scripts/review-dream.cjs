// Park the live game at authored spots in a chapter — by default The Soft
// Dream — and screenshot the actual WebGL frame, with what the frame costs to
// submit, so a scenery or palette change can be judged against the concept
// boards in `new assets/level-5-surreal-psychadelic/`.
//
//   LEVEL=4 SPOTS=garden-start,knot-wake OUT=<dir> node scripts/review-dream.cjs
//   SPOTS='[{"name":"arch","x":22,"y":2.4,"ground":"garden-arch","ticks":120}]' node scripts/review-dream.cjs
//   SECTION=garden OUT=<dir> node scripts/review-dream.cjs
//
// SECTION=<key> captures three spots across that section of the live chapter
// — entry, middle and exit (4 units in from each end and the section's
// midpoint), the player parked on the nearest standable deck by x, read from
// the level's own dreamSections table — as <key>-entry.png, <key>-middle.png,
// <key>-exit.png. SPOTS, when given, wins over SECTION.
//
// Env: LEVEL (chapter index, default 4) · SECTION (a dream section key) ·
// SPOTS (comma list of names from the table below, or a JSON array of
// {name,x,y,ground?,cameraX?,cameraY?,ticks?})
// · OUT (default /Users/moritzgrassy/.claude/jobs/b6712500/tmp/shots) · PORT
// (default 5197) · ROOT (checkout holding dist/, default this script's
// checkout) · WIDTH/HEIGHT · CHROME_PATH (Chrome binary, default the
// /Applications install) · PLAYWRIGHT_MODULE (path to a playwright package;
// the default is the codex runtime's copy, playwright is not in this project's
// node_modules). The script serves ROOT/dist itself on PORT, so several copies
// can be judged side by side. Machinery is advanced a fixed number of ticks
// before the capture so two renders differ only by the change made.
const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),http=require('http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(process.env.ROOT||path.resolve(__dirname,'..'));
const out=path.resolve(process.env.OUT||'/Users/moritzgrassy/.claude/jobs/b6712500/tmp/shots');
const port=Number(process.env.PORT||5197);
const level=Number(process.env.LEVEL||4);
const WIDTH=Number(process.env.WIDTH||1664),HEIGHT=Number(process.env.HEIGHT||936);
// Section entry decks of The Soft Dream (dist/routes/dream.js DREAM_SECTIONS),
// four units in from each start, plus the garden's arch and the wake deck.
const SPOTS={
 'garden-start':{x:1.5,y:0,ground:'start',ticks:120},
 'garden-arch':{x:26,y:2.4,ground:'garden-arch',ticks:120},
 'folding':{x:66,y:0,ground:'folding-entry',ticks:120},
 'orchard':{x:136,y:0,ground:'orchard-entry',ticks:120},
 'corridor':{x:211,y:0,ground:'corridor-entry',ticks:120},
 'parade':{x:266,y:0,ground:'parade-entry',ticks:120},
 'river':{x:341,y:0,ground:'river-entry',ticks:120},
 'room':{x:416,y:0,ground:'room-entry',ticks:120},
 'knot':{x:536,y:0,ground:'knot-entry',ticks:120},
 'knot-climb':{x:571,y:5.6,ground:'knot-d',ticks:120},
 'knot-wake':{x:597,y:0,ground:'knot-wake',ticks:120}
};
const section=process.env.SPOTS?'':(process.env.SECTION||'');
const raw=process.env.SPOTS||'garden-start,knot-wake';
let spots=section?null:raw.trim().startsWith('[')?JSON.parse(raw).map((s,i)=>({name:s.name||'spot-'+i,...s})):raw.split(',').filter(Boolean).map(name=>{const spot=SPOTS[name];if(!spot)throw new Error('unknown spot '+name+' (known: '+Object.keys(SPOTS).join(', ')+')');return {name,...spot};});
// Entry, middle and exit of one section, from the live level: the player is
// parked on the standable deck under that x, or the nearest one by centre.
function sectionSpots(key){
  const L=playtest.game.level,table=L.dreamSections||[],sec=table.find(s=>s.key===key);
  if(!sec)throw new Error('unknown section '+key+' (known: '+table.map(s=>s.key).join(', ')+')');
  const decks=L.platforms.filter(p=>!['wall','switch'].includes(p.kind));
  const spot=(name,x)=>{
    const under=decks.filter(p=>x>=p.x&&x<=p.x+p.w).sort((a,b)=>a.y-b.y)[0];
    const deck=under||decks.reduce((best,p)=>Math.abs(p.x+p.w/2-x)<Math.abs(best.x+best.w/2-x)?p:best);
    const px=Math.max(deck.x+.5,Math.min(deck.x+deck.w-.5,x));
    return {name:key+'-'+name,x:px,y:deck.y,ground:deck.id,ticks:120};
  };
  return [spot('entry',sec.x+4),spot('middle',sec.x+sec.length/2),spot('exit',sec.x+sec.length-4)];
}
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
  // The served app.js is patched in flight: the frame loop yields to the
  // script, which then draws and ticks the game by hand.
  await page.route('**/app.js*',async route=>{
   let body=fs.readFileSync(path.join(root,'dist/app.js'),'utf8');
   body=body.replace('function frame(now){','function frame(now){ if(window.playtest?.manual){requestAnimationFrame(frame);return;}');
   body+='\nwindow.playtest={manual:false,get game(){return game},get world(){return world},get input(){return input},begin,home,draw(dt=0){world.render(game,dt);healthHUD.draw(game,dt);updateHUD(performance.now());},tick(n){for(let i=0;i<n;i++)game.tick(FIXED_DT,input);}};';
   await route.fulfill({contentType:'text/javascript',body});
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(()=>window.playtest&&document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
  await page.evaluate(()=>{playtest.manual=true;});
  await page.evaluate(async level=>{await playtest.begin(level,true,'original');},level);
  await page.waitForFunction(()=>playtest.game?.status==='playing'&&document.getElementById('loading').classList.contains('hidden'),null,{timeout:120000});
  // Overlays that belong to a live session, not to a judged frame.
  await page.addStyleTag({content:'#chapter-intro,#hint,#touch-controls,#desktop-controls,#fade,#timer,#dialog{display:none!important}'});
  if(section){spots=await page.evaluate(`(${sectionSpots.toString()})(${JSON.stringify(section)})`);console.log('SECTION',section,JSON.stringify(spots));}
  for(const spot of spots){
   const info=await page.evaluate(async spot=>{
    const g=playtest.game,w=playtest.world;
    const {cameraTarget}=await import('./camera.js');
    g.level.enemies.forEach(e=>{if(Math.abs(e.x-spot.x)<30){e.alive=false;}});
    Object.assign(g.player,{x:spot.x,y:spot.y,vx:0,vy:0,facing:1,groundId:spot.ground||null,invuln:0});
    g.sectionId=Math.max(0,g.level.sections.findLastIndex(s=>spot.x>=s.x));
    // Deterministic machinery: the same number of fixed steps from a fresh
    // chapter start puts every mover in the same place every run.
    g.time=0;g.level.platforms.forEach(p=>{if(p.kind==='orbit'||p.kind==='ferry'||p.kind==='lift'){p.x=p.baseX??p.x;p.y=p.baseY??p.y;}});
    playtest.tick(spot.ticks||120);
    Object.assign(g.player,{x:spot.x,y:spot.y,vx:0,vy:0,facing:1,groundId:spot.ground||null});
    w.syncVisible(g.level,spot.x,true);
    const target=cameraTarget(g.player,w.viewW,w.viewH,w.landscape);
    w.cameraAnchorY=g.player.y;w.cameraX=spot.cameraX??target.x;w.cameraY=spot.cameraY??target.y;w.lastPlayerX=spot.x;w.cameraLook=0;w.cameraFace=1;w.trauma=0;w.shake=0;
    // Settle streamed geometry, the palette cross-fade and light handoffs
    // without moving the camera.
    for(let i=0;i<90;i++)playtest.draw(0);
    const frames=[];
    for(let i=0;i<60;i++){const t0=performance.now();w.render(g,0);frames.push(performance.now()-t0);}
    frames.sort((a,b)=>a-b);
    const info=w.renderer.info,calls=info.render.calls,triangles=info.render.triangles;
    playtest.draw(0);
    let lights=0,transparent=0,meshes=0;
    w.scene.traverse(o=>{if(o.isLight&&o.visible&&o.intensity>0)lights++;if(o.isMesh&&o.visible&&o.material?.transparent)transparent++;if(o.isMesh)meshes++;});
    const palette=w.dreamPalette?Object.fromEntries(Object.entries(w.dreamPalette).map(([k,c])=>[k,'#'+c.getHexString()])):null;
    return {spot:spot.name,x:spot.x,cameraX:w.cameraX,cameraY:w.cameraY,viewW:w.viewW,viewH:w.viewH,roll:w.dreamRoll||0,palette,calls,triangles,geometries:info.memory.geometries,textures:info.memory.textures,programs:info.programs.length,frameMs:frames[30],frameMsP90:frames[54],lights,transparentMeshes:transparent,sceneMeshes:meshes};
   },spot);
   await page.screenshot({path:path.join(out,spot.name+'.png')});
   results.push(info);
   console.log('CAPTURE',spot.name,JSON.stringify(info));
  }
 }finally{await browser.close();server.kill();}
 fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({root,level,results,errors,badRequests},null,2));
 if(errors.length)console.log('PAGE ERRORS',errors.join('\n'));
 if(badRequests.length)console.log('BAD REQUESTS',badRequests.join('\n'));
})().catch(e=>{console.error(e);process.exit(1)});
