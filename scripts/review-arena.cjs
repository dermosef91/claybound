// Park the live game in Mother Puff's clearing with the fight under way and
// screenshot the actual WebGL frame, so the arena's art is judged from the real
// render rather than from a headless scene graph.
const fs=require('fs'),path=require('path');
const {playwright,chromePath}=require('./support/review.cjs');
const {chromium}=playwright();
const root=path.resolve(__dirname,'..');
const out=path.resolve(root,process.env.OUT||'docs/forest/arena/frame.png');
const offset=+(process.env.PLAYER_OFFSET||12),settle=+(process.env.SETTLE||600);
(async()=>{
 fs.mkdirSync(path.dirname(out),{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:chromePath(),args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:+(process.env.W||2048),height:+(process.env.H||1160)},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/app.js*',async route=>{
   const body=fs.readFileSync(root+'/dist/app.js','utf8')+'\nwindow.playtest={get game(){return game},get world(){return world},get input(){return input},begin};';
   await route.fulfill({contentType:'text/javascript',body});
  });
  await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5177');
  await page.waitForFunction(()=>window.playtest,null,{timeout:60000});console.log('playtest ready; body classes:',await page.evaluate(()=>document.body.className),'errors so far',errors.slice(0,3));await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:90000});
  await page.mouse.click(720,500);
  await page.evaluate(async()=>{await playtest.begin(1,true,'original');});
  await page.waitForFunction(()=>playtest.game?.status==='playing',null,{timeout:120000});
  const info=await page.evaluate(async ({offset,settle})=>{
   const g=playtest.game,w=playtest.world,s=g.level.platforms.find(p=>p.motherArena),playerX=s.x+offset;
   Object.assign(g.player,{x:playerX,y:s.y,vx:0,vy:0,groundId:s.id,facing:1});
   w.syncVisible(g.level,playerX,true);
   // Let the encounter wake and the camera settle, then hold a frame.
   for(let i=0;i<settle;i++){g.tick(1/120,{});w.render(g,1/120);}
   await new Promise(r=>setTimeout(r,300));
   return {x:+g.player.x.toFixed(2),arena:[s.x,s.w],boss:g.level.boss.state,bossX:g.level.boss.x,cameraX:+w.cameraX.toFixed(2),cameraY:+w.cameraY.toFixed(2)};
  },{offset,settle});
  await page.screenshot({path:out});
  console.log(JSON.stringify(info),'errors',errors.slice(0,3));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
