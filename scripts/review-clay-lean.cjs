// Screenshots of a walk leaning on shapeable clay — the pushed pillar on the
// Clay Lab's formable bench and the playground's ramp pulled out by walking
// into it — through the real app, a frame at a time:
//   node scripts/review-clay-lean.cjs
// Writes docs/clay-lean/*.png and fails on any page error.
const fs=require('fs'),assert=require('assert/strict');
const {review,patchApp,PROJECT}=require('./support/review.cjs');
const root=PROJECT,out=root+'/docs/clay-lean';
fs.mkdirSync(out,{recursive:true});
review(async({page,url,errors,requests:badRequests})=>{
 await patchApp(page,{root,during:'shapingControls.update();',expose:'window.playtest={manual:false,get game(){return game},get world(){return world},get input(){return input},begin,home,stationPicker,draw(){for(let i=0;i<20;i++)world.render(game,.05);healthHUD.draw(game,0);updateHUD(performance.now());shapingControls.update();},step(n,extra={}){for(let i=0;i<n;i++){game.tick(FIXED_DT,{...input,...extra});input.jumpPressed=false;input.stompPressed=false;}this.draw();}};'});
 await page.goto(process.env.REVIEW_URL||url);await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
 await page.locator('#chapters').click();await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'ß'})));await page.locator('[data-action="playground"]').click();
 await page.waitForFunction(()=>window.playtest?.game.level.playground&&document.getElementById('loading').classList.contains('hidden'),null,{timeout:60000});
 await page.evaluate(()=>{playtest.manual=true;playtest.draw();});
 await page.keyboard.press('Escape');await page.locator('[data-action="stations"]').click();
 await page.locator('[data-station="form"]').click();
 await page.waitForFunction(()=>!document.querySelector('.dialog-close'),null,{timeout:10000}).catch(()=>{});
 await page.evaluate(()=>{playtest.step(1);playtest.draw();});
 const shot=async name=>{await page.evaluate(()=>playtest.draw());await page.screenshot({path:`${out}/${name}.png`});};
 const run=async fn=>page.evaluate(async fn=>{const mod=await import('/clay-form.js');const shaping=await import('/shaping.js');const g=playtest.game;const call=new Function('mod','shaping','g','playtest',`return (${fn})(mod,shaping,g,playtest)`);return call(mod,shaping,g,playtest);},fn.toString());

 // The formable bench: a pillar in the way, the walker brought to its foot.
 await run((mod,shaping,g,pt)=>{
  shaping.visitStation(g,'form',{reset:true});
  const s=g.level.platforms.find(q=>q.id==='form-mass'),f=s.form;
  for(let i=0;i<40;i++)mod.pullForm(f,7,0,.3);
  pt.step(10);
  Object.assign(g.player,{x:s.x+4.6,y:s.y-s.h+mod.formHeight(f,4.6)+.02,vx:0,vy:0,groundId:null,facing:1});
  pt.step(180);
 });
 await shot('01-pillar-rest');
 // Lean on it: a quarter second in, the pose has taken and the clay has begun to go.
 const early=await run((mod,shaping,g,pt)=>{pt.step(30,{moveAxis:1});const p=g.player,s=g.level.platforms.find(q=>q.id==='form-mass');return {pushing:p.pushing,pushed:p.pushed,lean:!!p.lean,x:+(p.x-s.x).toFixed(2),crest:+mod.formPeak(s.form).toFixed(2)};});
 await shot('02-pillar-lean');
 const late=await run((mod,shaping,g,pt)=>{pt.step(120,{moveAxis:1});const p=g.player,s=g.level.platforms.find(q=>q.id==='form-mass');return {pushing:p.pushing,pushed:p.pushed,lean:!!p.lean,x:+(p.x-s.x).toFixed(2),crest:+mod.formPeak(s.form).toFixed(2)};});
 await shot('03-pillar-pushed');
 const rest=await run((mod,shaping,g,pt)=>{pt.step(60);const p=g.player;return {pushing:p.pushing,lean:!!p.lean};});
 await shot('04-pillar-let-go');
 console.log('form bench: after .25 s',JSON.stringify(early),'after 1.25 s',JSON.stringify(late),'let go',JSON.stringify(rest));
 assert(early.lean&&early.pushing===1,'leaning on the pillar reads as a push');
 assert(late.x>early.x+.5,'and the walker has gone ahead with the clay');
 assert(!rest.lean&&!rest.pushing,'let go of, nothing is pushed');

 // The Kneading Quarter's ramp, pulled out by a walk from the dock. The
 // quarter is not on the menu, so the app is begun on it directly.
 await page.evaluate(async()=>{const quarter=(await import('/routes/clay-playground.js')).default;await playtest.begin(3,true,'original',quarter);});
 await page.waitForFunction(()=>window.playtest?.game.level.short==='Clay playground'&&document.getElementById('loading').classList.contains('hidden'),null,{timeout:60000});
 await run((mod,shaping,g,pt)=>{shaping.visitStation(g,'ramp',{reset:true});pt.step(180);});
 await shot('05-ramp-rest');
 const ramp=await run((mod,shaping,g,pt)=>{
  const st=g.level.shaping.find(s=>s.id==='ramp'),p=g.player;
  let firstLean=-1;for(let i=0;i<70;i++){pt.step(1,{moveAxis:1});if(p.lean&&firstLean<0)firstLean=i;}
  return {firstLean,pushing:p.pushing,target:+st.target.toFixed(2),amount:+st.amount.toFixed(2)};
 });
 await shot('06-ramp-lean');
 const done=await run((mod,shaping,g,pt)=>{const st=g.level.shaping.find(s=>s.id==='ramp');pt.step(240,{moveAxis:1});return {target:+st.target.toFixed(2),amount:+st.amount.toFixed(2),x:+g.player.x.toFixed(2),ground:g.player.groundId};});
 await shot('07-ramp-walked-up');
 console.log('ramp: mid-lean',JSON.stringify(ramp),'then',JSON.stringify(done));
 assert(ramp.firstLean>=0&&ramp.pushing===1&&ramp.target>0,'the walk into the ramp pulls it and reads as a push');
 assert(done.amount===1&&done.x>36,'the ramp is out and the walker is up it');

 assert.deepEqual(errors,[],'no page errors');
 assert.deepEqual(badRequests,[],'no failed requests');
 console.log('PASS wrote',fs.readdirSync(out).filter(f=>f.endsWith('.png')).length,'frames to',out);
}).catch(e=>{console.error(e);process.exit(1);});
