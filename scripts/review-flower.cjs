// Actual runtime pickup, with an isolated save and deterministic capture clock.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=root+'/docs/flower-celebration';
(async()=>{
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:1672,height:941}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/app.js*',async route=>{
 let body=fs.readFileSync(root+'/dist/app.js','utf8').replace('function frame(now){','function frame(now){if(window.playtest?.manual){requestAnimationFrame(frame);return;}');
 body+='\nwindow.playtest={manual:false,get game(){return game},get world(){return world},get sound(){return sound},begin,draw(dt=0){world.render(game,dt);updateHUD(performance.now());}};';
 await route.fulfill({contentType:'text/javascript',body});
});
await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5176');
await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
await page.evaluate(async()=>{playtest.manual=true;await playtest.begin(0,true,'original');});
await page.mouse.click(800,400);
const pickup=await page.evaluate(async()=>{
 const {game:g,world:w,sound}=playtest; sound.unlock();await sound.flowerLoading;
 const c=g.level.stamps[0],ground=g.level.platforms.find(s=>s.active&&c.x>=s.x&&c.x<=s.x+s.w&&Math.abs(s.y+.8-c.y)<.85);
 Object.assign(g.player,{x:c.x,y:ground?.y??c.y-.8,vx:0,vy:0,groundId:ground?.id??null});
 for(let i=0;i<60;i++)w.render(g,1/60);
 g.tick(1/120,{});const snapshot=JSON.stringify({p:g.player,time:g.time,elapsed:g.elapsed,platforms:g.level.platforms,enemies:g.level.enemies});
 for(let i=0;i<100;i++){g.tick(1/120,{right:true,jumpPressed:true});w.render(g,1/120);}
 playtest.draw();
 const assertFreeze= snapshot===JSON.stringify({p:g.player,time:g.time,elapsed:g.elapsed,platforms:g.level.platforms,enemies:g.level.enemies});
 return {active:!!g.flowerCelebration,frozen:assertFreeze,soundDecoded:!!sound.flowerBuffer,stamps:g.stamps,time:g.flowerCelebration.time};
});
assert(pickup.active&&pickup.frozen&&pickup.soundDecoded);assert.equal(pickup.stamps,1);
await page.screenshot({path:out+'/gameplay-desktop.png'});
await page.evaluate(()=>{const {world:w,game:g}=playtest;w.setEditorCamera({x:g.player.x,y:g.player.y+1.15,viewH:4.8});playtest.draw();});
await page.screenshot({path:out+'/pose-detail.png'});
const paused=await page.evaluate(()=>{
 const {game:g,world:w}=playtest;g.pause();const f=w.character.flower,before=f.chains.flat().map(b=>b.quaternion.toArray());
 const t=g.flowerCelebration.time;for(let i=0;i<60;i++){g.tick(1/60,{});w.render(g,1/60);}
 return {clockFrozen:t===g.flowerCelebration.time,poseFrozen:JSON.stringify(before)===JSON.stringify(f.chains.flat().map(b=>b.quaternion.toArray()))};
});
assert(paused.clockFrozen&&paused.poseFrozen);
await page.setViewportSize({width:390,height:844});
await page.evaluate(()=>{playtest.world.setEditorCamera(null);playtest.draw();});
await page.screenshot({path:out+'/gameplay-portrait.png'});
const resume=await page.evaluate(()=>{
 const {game:g,world:w}=playtest;g.resume();for(let i=0;i<160;i++){g.tick(1/120,{});w.render(g,1/120);}
 return {active:!!g.flowerCelebration,visible:w.character.flower.root.visible,time:g.time};
});assert(!resume.active&&!resume.visible);assert.deepEqual(errors,[]);
fs.writeFileSync(out+'/verification.json',JSON.stringify({pickup,paused,resume,errors},null,2)+'\n');console.log('PASS flower WebGL', {pickup,paused,resume});
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
