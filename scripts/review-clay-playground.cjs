const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=root+'/docs/clay-playground';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1500,height:850}}),errors=[],badRequests=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)badRequests.push(r.url());});
 await page.route('**/app.js',async route=>{
  let body=fs.readFileSync(root+'/dist/app.js','utf8');
  body=body.replace('function frame(now){','function frame(now){ if(window.playtest?.manual){shapingControls.update();requestAnimationFrame(frame);return;}');
  body+='\nwindow.playtest={manual:false,get game(){return game},get world(){return world},get input(){return input},begin,home,stationPicker,draw(){for(let i=0;i<20;i++)world.render(game,.05);healthHUD.draw(game,0);updateHUD(performance.now());shapingControls.update();},step(n){for(let i=0;i<n;i++){game.tick(FIXED_DT,input);input.jumpPressed=false;input.stompPressed=false;}this.draw();}};';
  await route.fulfill({contentType:'text/javascript',body});
 });
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
 await page.locator('#chapters').click();await page.screenshot({path:out+'/chapter-picker.png'});await page.locator('[data-action="playground"]').click();
 await page.waitForFunction(()=>window.playtest?.game.level.playground&&document.getElementById('loading').classList.contains('hidden'),null,{timeout:120000});
 await page.evaluate(()=>{playtest.manual=true;playtest.draw();});
 const savedBefore=await page.evaluate(()=>localStorage.getItem('claybound-v1'));
 for(const [index,id]of ['lift','ramp','landing','stairs','bridge'].entries()){
  if(index){await page.locator('#shape-stations').click();await page.locator(`[data-station="${id}"]`).click();await page.evaluate(()=>{playtest.step(1);playtest.draw();});}
  await page.screenshot({path:out+'/'+id+'-before.png'});
  const target=await page.evaluate(async id=>{
   const THREE=await import('./lib/three.module.js'),g=playtest.game,w=playtest.world,station=g.level.shaping.find(s=>s.id===id),s=g.level.platforms.find(s=>s.id===station.parts.at(-1));
   const v=new THREE.Vector3(s.x+s.w*.75,s.y+(s.slope||0)*.75-.55,1.4).project(w.camera),r=w.canvas.getBoundingClientRect();
   return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2,gesture:station.gesture};
  },id);
  await page.mouse.move(target.x,target.y);await page.mouse.down();
  await page.mouse.move(target.x+(target.gesture==='down'?0:215),target.y+(target.gesture==='down'?215:0),{steps:10});
  await page.evaluate(()=>playtest.step(180));await page.mouse.up();
  const state=await page.evaluate(id=>({id,amount:playtest.game.level.shaping.find(s=>s.id===id).amount,health:playtest.game.player.health,draws:playtest.world.renderer.info.render.calls,geometries:playtest.world.renderer.info.memory.geometries}),id);
  assert.equal(state.amount,1,id+' responds to pointer dragging');results.push(state);
  await page.screenshot({path:out+'/'+id+'-after.png'});
  if(id==='ramp'){
    await page.keyboard.down('KeyD');await page.evaluate(()=>playtest.step(270));await page.keyboard.up('KeyD');
    assert(await page.evaluate(()=>playtest.game.player.x>39&&playtest.game.player.y>=4.39),'ramp walked with keyboard');
  }
 }
 await page.keyboard.press('KeyR');await page.evaluate(()=>playtest.step(180));assert.equal(await page.evaluate(()=>playtest.game.level.shaping[4].amount),0);
 await page.keyboard.down('KeyE');await page.evaluate(()=>playtest.step(240));await page.keyboard.up('KeyE');assert.equal(await page.evaluate(()=>playtest.game.level.shaping[4].amount),1);
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>playtest.game.status),'paused');await page.keyboard.down('KeyE');await page.evaluate(()=>playtest.step(240));await page.keyboard.up('KeyE');await page.keyboard.press('Escape');
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>playtest.draw());await page.screenshot({path:out+'/bridge-mobile-landscape.png'});
 await page.locator('#shape-reset').click();await page.evaluate(()=>playtest.step(180));
 const box=await page.locator('#knead').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.evaluate(()=>playtest.step(240));await page.mouse.up();assert.equal(await page.evaluate(()=>playtest.game.level.shaping[4].amount),1,'on-screen hold kneads');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>playtest.draw());await page.screenshot({path:out+'/bridge-mobile-portrait.png'});
 await page.evaluate(()=>playtest.home());assert.equal(await page.evaluate(()=>localStorage.getItem('claybound-v1')),savedBefore,'playground must not alter campaign progress');
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(badRequests.length,0,badRequests.join('\n'));
 fs.writeFileSync(out+'/browser-results.json',JSON.stringify({errors,badRequests,results,checks:['chapter entry','5 pointer drags','keyboard ramp traversal','E hold','R reset','pause/resume','on-screen hold','landscape/portrait screenshots','campaign save isolation']},null,2));
 await browser.close();console.log('PASS browser playground:',results.length,'drag gestures, keyboard/touch controls, campaign isolation, no errors');
})().catch(e=>{console.error(e);process.exit(1)});
