// Regression: exercise the unmodified frame loop, including the first pickup.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=root+'/docs/flower-celebration/live-'+(process.env.LEVEL||0);
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/app.js*',async route=>{
   const body=fs.readFileSync(root+'/dist/app.js','utf8')+'\nwindow.playtest={get game(){return game},get world(){return world},begin};';
   await route.fulfill({contentType:'text/javascript',body});
  });
  await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5176');
  await page.waitForFunction(()=>window.playtest&&document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
  await page.mouse.click(720,500);
  await page.evaluate(async index=>{await playtest.begin(index,true,'original');},Number(process.env.LEVEL||0));
  await page.evaluate(()=>{
   const g=playtest.game,w=playtest.world,c=g.level.stamps[0];
   const floor=g.level.platforms.find(s=>s.active&&c.x>=s.x&&c.x<=s.x+s.w&&Math.abs(s.y+.8-c.y)<.85);
   Object.assign(g.player,{x:c.x-.3,y:floor?.y??c.y-.8,vx:0,vy:0,groundId:floor?.id??null});
   playtest.frames=[];playtest.seen=false;const render=w.render.bind(w);
   w.render=(g,dt)=>{render(g,dt);if(g.flowerCelebration){playtest.seen=true;const f=w.character.flower,position=f?.root.position;playtest.frames.push({time:g.flowerCelebration.time,pose:w.character.state,flower:!!f?.root.visible,position:position?.toArray(),scale:f?.root.scale.x,visible:w.character.root.visible,dt});}};
  });
  await page.keyboard.down('d');
  await page.waitForFunction(()=>playtest.game.flowerCelebration?.time>.15,null,{timeout:20000});
  await page.keyboard.up('d');await page.screenshot({path:out+'/hold.png'});
  await page.waitForFunction(()=>playtest.seen&&!playtest.game.flowerCelebration,null,{timeout:20000});
  const frames=await page.evaluate(()=>playtest.frames);
  fs.writeFileSync(out+'/frames.json',JSON.stringify({frames,errors},null,2));
  assert.deepEqual(errors,[]);assert(frames.length>10);assert(frames.filter(f=>f.time>.1&&f.time<.38).every(f=>f.visible===true&&f.flower&&f.scale>.95&&f.position.every(Number.isFinite)));
  console.log('PASS real frame loop',frames.length,frames[0],frames.at(-1));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
