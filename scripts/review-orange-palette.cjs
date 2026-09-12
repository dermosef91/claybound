// Orange-palette review; set PALETTE_BASELINE=1 before editing to capture a baseline.
// Start the game server on 127.0.0.1:5173 first. Uses an isolated browser profile.
const fs=require('fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=require('path').resolve(__dirname,'..'),out=root+'/docs/orange-palette';
(async()=>{
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1500,height:850}}),errors=[],requests=[];
page.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.message)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE',m.text());}});page.on('response',r=>{if(r.status()>=400)requests.push({url:r.url(),status:r.status()})});
await page.route('**/app.js',async route=>{let s=fs.readFileSync(root+'/dist/app.js','utf8');s=s.replace('function frame(now){','function frame(now){ if(window.playtest?.manual){requestAnimationFrame(frame);return;}');s+='\nwindow.playtest={manual:false,get game(){return game},get world(){return world},get health(){return healthHUD.view},begin,home,draw(){world.render(game,FIXED_DT);healthHUD.draw(game,FIXED_DT);updateHUD(performance.now());},step(inputs){for(const i of inputs){game.tick(FIXED_DT,i);world.render(game,FIXED_DT);}this.draw();return {index:game.index,status:game.status,x:game.player.x,y:game.player.y,health:game.player.health,deaths:game.deaths,section:game.level.sections[game.sectionId]?.name,checkpoint:game.checkpointId,coins:game.coins,flowers:game.stamps,elapsed:game.elapsed,calls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles};}};';await route.fulfill({contentType:'text/javascript',body:s});});

const targets=[{index:3,x:8,y:0,name:'city-start'},{index:3,x:44,y:5.2,name:'city-flags'},{index:3,x:120,y:13.3,name:'city-laundry'},{index:0,x:12,y:0,name:'canyon'},{index:1,x:8,y:0,name:'forest'},{index:2,x:80,y:5,name:'cave'}];
await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});await page.evaluate(()=>playtest.manual=true);
const results=[];
await page.screenshot({path:out+'/'+(process.env.PALETTE_BASELINE?'before':'after')+'-title.png'});
for(const p of targets){
 await page.evaluate(i=>playtest.begin(i,true,'original'),p.index);
 await page.evaluate(p=>{const g=playtest.game;Object.assign(g.player,{x:p.x,y:p.y,vx:0,vy:0});g.sectionId=g.level.sections.findLastIndex(s=>p.x>=s.x);for(let i=0;i<80;i++)playtest.draw();},p);
 await page.waitForTimeout(300);await page.evaluate(()=>playtest.draw());await page.screenshot({path:out+'/'+(process.env.PALETTE_BASELINE?'before-':'after-')+p.name+'.png'});
 results.push(await page.evaluate(()=>{const w=playtest.world,g=playtest.game;w.render(g,0);return {index:g.index,x:g.player.x,draws:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles,palette:{world:w.mat.orange.color.getHexString(),top:w.mat.top.color.getHexString(),health:playtest.health.clay.color.getHexString()},textures:w.renderer.info.memory.textures,geometries:w.renderer.info.memory.geometries}}));
 if(p.name==='city-flags'){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.evaluate(()=>{for(let i=0;i<60;i++)playtest.draw()});await page.screenshot({path:out+'/'+(process.env.PALETTE_BASELINE?'before-':'after-')+'city-portrait.png'});await page.setViewportSize({width:1500,height:850});await page.waitForTimeout(250);}
 console.log('CAPTURE',p.name);
}
fs.writeFileSync(out+'/'+(process.env.PALETTE_BASELINE?'before':'after')+'-results.json',JSON.stringify({errors,requests,results},null,2));await browser.close();
if(errors.length||requests.length)throw new Error('Palette review found browser or asset errors');
})().catch(e=>{console.error(e);process.exit(1)});
