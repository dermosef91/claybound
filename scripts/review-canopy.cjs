// Park the live game at authored spots in the Wildwood and screenshot the
// actual WebGL frame, so backdrop composition is judged from the real render.
const fs=require('fs'),path=require('path');
const {chromium}=require('/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const out=path.resolve(root,process.env.OUT||'docs/forest/canopy');
// Platform ids to stand on, one screenshot each.
const spots=(process.env.SPOTS||'canopy-entry,canopy-rest,canopy-nest').split(',');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:576},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/app.js*',async route=>{
   const body=fs.readFileSync(root+'/dist/app.js','utf8')+'\nwindow.playtest={get game(){return game},get world(){return world},get input(){return input},begin};';
   await route.fulfill({contentType:'text/javascript',body});
  });
  await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5176');
  await page.waitForFunction(()=>window.playtest&&document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
  await page.mouse.click(720,500);
  await page.evaluate(async()=>{await playtest.begin(1,true,'original');});
  await page.waitForFunction(()=>playtest.game?.status==='playing',null,{timeout:120000});
  for(const id of spots){
   const info=await page.evaluate(spot=>{
    const g=playtest.game,w=playtest.world;
    const s=g.level.platforms.find(p=>p.id===spot);
    if(!s)throw new Error('no platform '+spot);
    const x=s.x+s.w*(spot.startsWith('crumb')?.5:.35);
    Object.assign(g.player,{x,y:s.y,vx:0,vy:0,groundId:s.id,facing:1});
    g.level.coins.forEach(c=>{if(Math.abs(c.x-x)<40)c.taken=false;});
    w.syncVisible(g.level,x,true);
    // Settle the easing camera onto the new stance before the frame is judged.
    w.cameraAnchorY=g.player.y;w.cameraX=x+w.viewW*.11;w.cameraY=g.player.y+w.viewH*.06;
    for(let i=0;i<90;i++)w.render(g,1/60);
    // Where a backdrop landmark actually lands in the frame, in fractions of
    // the view from its centre. A vista meant to read as ground rather than as
    // a floating slab has to leave the bottom edge below -0.5.
    const model=w.backRoot.getObjectByName('Forest waterfall');let frame=null;
    if(model){
      w.scene.updateMatrixWorld(true);
      const tilt=(w.theme.cameraElevation??3.05)/Math.hypot(26,w.theme.cameraElevation??3.05);
      let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
      model.traverse(o=>{
        if(!o.isMesh)return;
        o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,v=o.position.clone();
        for(const px of [b.min.x,b.max.x])for(const py of [b.min.y,b.max.y])for(const pz of [b.min.z,b.max.z]){
          v.set(px,py,pz).applyMatrix4(o.matrixWorld);
          const sx=(v.x-w.cameraX)/w.viewW,sy=(v.y-w.cameraY-tilt*v.z)/w.viewH;
          left=Math.min(left,sx);right=Math.max(right,sx);bottom=Math.min(bottom,sy);top=Math.max(top,sy);
        }
      });
      frame=Object.fromEntries(Object.entries({left,right,bottom,top}).map(([k,v])=>[k,+v.toFixed(3)]));
    }
    return {spot,x,y:s.y,cameraY:+w.cameraY.toFixed(2),viewW:+w.viewW.toFixed(2),falls:frame};
   },id);
   await page.screenshot({path:out+'/'+id+'.png'});
   console.log(JSON.stringify(info));
  }
  console.log('errors',errors);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
