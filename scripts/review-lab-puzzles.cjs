// Screenshots of the five puzzle benches at the end of the Clay Lab, at rest
// and mid-solve, through the real app against a dev server on 5174:
//   npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
//   node scripts/review-lab-puzzles.cjs
// Writes docs/clay-lab-puzzles/*.png and fails on any page error.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {review,patchApp,PROJECT}=require('./support/review.cjs');
const root=PROJECT,out=root+'/docs/clay-lab-puzzles';
fs.mkdirSync(out,{recursive:true});
review(async({page,url,errors,requests:badRequests})=>{
 // The benches are worked with the pointer, so their controls have to keep
 // updating even on a frame the review is holding.
 await patchApp(page,{root,during:'shapingControls.update();',expose:'window.playtest={manual:false,get game(){return game},get world(){return world},get input(){return input},begin,home,stationPicker,draw(){for(let i=0;i<20;i++)world.render(game,.05);healthHUD.draw(game,0);updateHUD(performance.now());shapingControls.update();},step(n,extra={}){for(let i=0;i<n;i++){game.tick(FIXED_DT,{...input,...extra});input.jumpPressed=false;input.stompPressed=false;}this.draw();}};'});
 await page.goto(process.env.REVIEW_URL||url);await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
 await page.locator('#chapters').click();await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'ß'})));await page.locator('[data-action="playground"]').click();
 try{await page.waitForFunction(()=>window.playtest?.game.level.playground&&document.getElementById('loading').classList.contains('hidden'),null,{timeout:60000});}
 catch(e){await page.screenshot({path:out+'/debug-load.png'});console.error('LOADSTATE',await page.evaluate(()=>({playground:window.playtest?.game?.level?.playground,status:window.playtest?.game?.status,loading:document.getElementById('loading').className,text:document.body.innerText.slice(0,300)})));throw e;}
 await page.evaluate(()=>{playtest.manual=true;playtest.draw();});
 // The picker, with ten entries; choosing one resumes the game at it.
 await page.keyboard.press('Escape');await page.locator('[data-action="stations"]').click();
 await page.screenshot({path:out+'/station-picker.png'});
 const count=await page.locator('[data-station]').count();assert.equal(count,10,'ten stations in the picker');
 await page.locator('[data-station="dig"]').click();
 await page.waitForFunction(()=>!document.querySelector('.dialog-close'),null,{timeout:10000}).catch(()=>{});
 await page.evaluate(()=>{playtest.step(1);playtest.draw();});
 // Teleport to a station and stand the player mid-trough so the whole bench is in frame.
 const goTo=async(id,offset=null)=>{
  await page.evaluate(async([id,offset])=>{
   const {visitStation}=await import('/shaping.js');
   visitStation(playtest.game,id,{reset:true});
   const g=playtest.game,st=g.level.shaping.find(s=>s.id===id),s=g.level.platforms.find(q=>q.id===st.parts[0]);
   playtest.step(2);
   if(offset!==null){const {formHeight}=await import('/clay-form.js');const x=s.x+offset;Object.assign(g.player,{x,y:s.y-s.h+formHeight(s.form,offset)+.02,vx:0,vy:0,groundId:null});playtest.step(3);}
   for(let i=0;i<40;i++)playtest.world.render(g,.05);
   playtest.draw();
  },[id,offset]);
  await page.waitForTimeout(400);await page.evaluate(()=>playtest.draw());
 };
 const shot=async name=>{await page.evaluate(()=>playtest.draw());await page.screenshot({path:`${out}/${name}.png`});};
 const form=async fn=>page.evaluate(async fn=>{const mod=await import('/clay-form.js');const marble=await import('/clay-marble.js');const g=playtest.game;const run=new Function('mod','marble','g','playtest',`return (${fn})(mod,marble,g,playtest)`);return run(mod,marble,g,playtest);},fn.toString());

 // 06 · buried: at rest, then a hole dug to the flower.
 await goTo('dig',3.5);await shot('06-buried-rest');
 await form((mod,marble,g,pt)=>{const st=g.level.shaping.find(s=>s.id==='dig'),s=g.level.platforms.find(q=>q.id==='dig-mass'),f=s.form;for(let i=0;i<30;i++)mod.pressForm(f,8,Math.max(mod.FORM.minThick+.3,mod.formHeight(f,8)-.2)+mod.FORM.tool);pt.step(40);});
 await shot('06-buried-dug');
 // 07 · under & over: at rest against the lintel, then trenched.
 await goTo('lintel',5);await shot('07-lintel-rest');
 await form((mod,marble,g,pt)=>{const s=g.level.platforms.find(q=>q.id==='lintel-mass'),f=s.form;for(let pass=0;pass<4;pass++)for(let x=5.2;x<=11.8;x+=.4){for(let i=0;i<6;i++)mod.pressForm(f,x,Math.max(3.55,mod.formHeight(f,x)-.25)+mod.FORM.tool);}pt.step(30);Object.assign(g.player,{x:s.x+8.5,y:s.y-s.h+mod.formHeight(f,8.5)+.02,vx:0,vy:0,groundId:null});pt.step(20);});
 await shot('07-lintel-trenched');
 // 08 · cast: the mould at rest, then cast with the grate open.
 await goTo('mould',7);await shot('08-mould-rest');
 await form((mod,marble,g,pt)=>{const st=g.level.shaping.find(s=>s.id==='mould'),s=g.level.platforms.find(q=>q.id==='mould-mass');s.form.h.set(st.cast);s.form.version++;pt.step(200);});
 await shot('08-mould-cast');
 // 09 · wet: a pillar, then the same pillar three seconds later.
 await goTo('wet',10.5);
 await form((mod,marble,g,pt)=>{const s=g.level.platforms.find(q=>q.id==='wet-mass'),f=s.form;for(let i=0;i<40;i++)mod.pullForm(f,10.5,0,.3);pt.step(10);});
 await shot('09-wet-pillar');
 await form((mod,marble,g,pt)=>{const s=g.level.platforms.find(q=>q.id==='wet-mass');Object.assign(playtest.game.player,{x:s.x-3,y:0,vx:0,vy:0,groundId:null});pt.step(360);});
 await shot('09-wet-melted');
 // 10 · the marble run: at rest, mid-roll, and seated with the lift up.
 await goTo('marble',10);await shot('10-marble-rest');
 await form((mod,marble,g,pt)=>{const st=g.level.shaping.find(s=>s.id==='marble'),s=g.level.platforms.find(q=>q.id==='marble-mass'),f=s.form;for(let i=0;i<10;i++)mod.pullForm(f,1.6,0,.3);pt.step(45);});
 await shot('10-marble-rolling');
 await form((mod,marble,g,pt)=>{const st=g.level.shaping.find(s=>s.id==='marble');st.ball.x=18;st.ball.vx=0;pt.step(400);});
 await goTo('marble',null);await form((mod,marble,g,pt)=>{const st=g.level.shaping.find(s=>s.id==='marble');st.ball.x=18;st.ball.vx=0;pt.step(400);const lift=g.level.platforms.find(q=>q.id==='marble-lift');Object.assign(g.player,{x:344.5,y:lift.y+.02,vx:0,vy:0,groundId:null});pt.step(20);});
 await shot('10-marble-home');
 assert.deepEqual(badRequests,[],'no failed requests');
 assert.deepEqual(errors,[],'no page errors');
 console.log('PASS wrote',fs.readdirSync(out).length,'screenshots to',out);
},{root,viewport:{width:1500,height:850}}).catch(e=>{console.error(e);process.exit(1);});
