// Orange-palette review; set PALETTE_BASELINE=1 before editing to capture a baseline.
const fs=require('fs');
const {review,patchApp,PROJECT}=require('./support/review.cjs');
const root=PROJECT,out=root+'/docs/orange-palette';
review(async({page,url,errors,requests})=>{
fs.mkdirSync(out,{recursive:true});
await patchApp(page,{root,expose:'window.playtest={manual:false,get game(){return game},get world(){return world},get health(){return healthHUD.view},begin,home,draw(){world.render(game,FIXED_DT);healthHUD.draw(game,FIXED_DT);updateHUD(performance.now());},step(inputs){for(const i of inputs){game.tick(FIXED_DT,i);world.render(game,FIXED_DT);}this.draw();return {index:game.index,status:game.status,x:game.player.x,y:game.player.y,health:game.player.health,deaths:game.deaths,section:game.level.sections[game.sectionId]?.name,checkpoint:game.checkpointId,coins:game.coins,flowers:game.stamps,elapsed:game.elapsed,calls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles};}};'});

const targets=[{index:3,x:8,y:0,name:'city-start'},{index:3,x:44,y:5.2,name:'city-flags'},{index:3,x:120,y:13.3,name:'city-laundry'},{index:0,x:12,y:0,name:'canyon'},{index:1,x:8,y:0,name:'forest'},{index:2,x:80,y:5,name:'cave'}];
await page.goto(process.env.REVIEW_URL||url);await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});await page.evaluate(()=>playtest.manual=true);
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
fs.writeFileSync(out+'/'+(process.env.PALETTE_BASELINE?'before':'after')+'-results.json',JSON.stringify({errors,requests,results},null,2));
if(errors.length||requests.length)throw new Error('Palette review found browser or asset errors');
},{root,viewport:{width:1500,height:850}}).catch(e=>{console.error(e);process.exit(1)});
