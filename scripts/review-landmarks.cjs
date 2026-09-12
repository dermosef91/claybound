// Review harness. Start the game server on 127.0.0.1:5173 first. Uses an isolated browser profile.
const fs=require('fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=require('path').resolve(__dirname,'..'),out=root+'/docs/landmark-storytelling';
(async()=>{
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1500,height:850}}),errors=[],requests=[];
page.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.message)});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});page.on('response',r=>{if(r.status()>=400)requests.push({url:r.url(),status:r.status()})});
await page.route('**/app.js',async route=>{let s=fs.readFileSync(root+'/dist/app.js','utf8');s=s.replace('function frame(now){','function frame(now){ if(window.playtest?.manual){requestAnimationFrame(frame);return;}');s+='\nwindow.playtest={manual:false,get game(){return game},get world(){return world},begin,home,draw(){world.render(game,FIXED_DT);healthHUD.draw(game,FIXED_DT);updateHUD(performance.now());},step(inputs){for(const i of inputs){game.tick(FIXED_DT,i);world.render(game,FIXED_DT);}this.draw();return {index:game.index,status:game.status,x:game.player.x,y:game.player.y,health:game.player.health,deaths:game.deaths,section:game.level.sections[game.sectionId]?.name,checkpoint:game.checkpointId,coins:game.coins,flowers:game.stamps,elapsed:game.elapsed,calls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles};}};';await route.fulfill({contentType:'text/javascript',body:s});});

const targets=[
 {index:0,x:45,y:4.3,name:'windwell'},{index:0,x:93,y:9.2,name:'sinking-shortcut'},{index:0,x:145,y:9.4,name:'great-arch'},
 {index:2,x:62,y:0,name:'furnace-ferry'},{index:2,x:118,y:0,name:'turning-heart'},{index:2,x:168,y:0,name:'sunken-relay'},{index:2,x:226,y:0,name:'spitter-gallery'},
 {index:3,x:120,y:13.3,name:'laundry-switchbacks'},{index:3,x:168,y:19.5,name:'city-windows'},{index:3,x:183,y:16.5,name:'ropeyard'},{index:3,x:243,y:19.2,name:'bell-court'}];
if(process.env.BEFORE){
 const baseline=JSON.parse(require('zlib').gunzipSync(fs.readFileSync(out+'/baseline-sources.json.gz')));
 for(const [name,body]of Object.entries(baseline))await page.route('http://127.0.0.1:5173/'+name+'.js',route=>route.fulfill({contentType:'text/javascript',body}));
}
await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});await page.evaluate(()=>playtest.manual=true);
const results=[];
for(const p of targets){
 await page.evaluate(i=>playtest.begin(i,true,'original'),p.index);
 await page.evaluate(p=>{const g=playtest.game;Object.assign(g.player,{x:p.x,y:p.y,vx:0,vy:0});g.sectionId=g.level.sections.findLastIndex(s=>p.x>=s.x);for(let i=0;i<80;i++)playtest.draw();},p);
 await page.waitForTimeout(300);await page.evaluate(()=>playtest.draw());await page.screenshot({path:out+'/'+(process.env.BEFORE?'before-':'after-')+p.name+'.png'});
 results.push(await page.evaluate(()=>{const w=playtest.world,g=playtest.game;w.render(g,0);return {index:g.index,x:g.player.x,draws:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles,textures:w.renderer.info.memory.textures,geometries:w.renderer.info.memory.geometries}}));
 if(p.name==='laundry-switchbacks'){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.evaluate(()=>{for(let i=0;i<60;i++)playtest.draw()});await page.screenshot({path:out+'/'+(process.env.BEFORE?'before-':'after-')+'laundry-portrait.png'});await page.setViewportSize({width:1500,height:850});await page.waitForTimeout(250);}
 console.log('CAPTURE',p.name);
}
fs.writeFileSync(out+'/'+(process.env.BEFORE?'before':'after')+'-results.json',JSON.stringify({errors,requests,results},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
