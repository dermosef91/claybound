// The Spitters' Gallery's rotten corner (dist/routes/cave.js, station
// gallery-fix), through the real app: the cliff at rest with the rot in its
// bite and the block on the dock, the bite open with its outline, the block
// seated, and the corner mended in the cave's own clay. The beats are played
// with real inputs through tests/fix-pilot.mjs, the same controller the
// playthrough recording uses, so what is shot is what the game does.
//   node scripts/review-gallery-fix.cjs
// Writes docs/gallery-fix/*.png and fails on any page error. REVIEW_URL points
// it at a running server instead of the harness's own.
const fs=require('fs'),path=require('path');
const {review,patchApp,PROJECT}=require('./support/review.cjs');
const root=PROJECT,out=path.resolve(PROJECT,process.env.REVIEW_OUT||'docs/gallery-fix');
review(async({page,url,errors})=>{
  fs.mkdirSync(out,{recursive:true});
  await patchApp(page,{root,during:'shapingControls.update();',expose:'window.playtest={manual:false,get game(){return game},get world(){return world},get input(){return input},begin,draw(){for(let i=0;i<12;i++)world.render(game,.05);healthHUD.draw(game,0);updateHUD(performance.now());shapingControls.update();},step(n,extra={}){for(let i=0;i<n;i++){game.tick(FIXED_DT,{...input,...extra});input.jumpPressed=false;input.stompPressed=false;}this.draw();}};'});
  // The pilot lives in tests/, which the server does not reach: hand it over
  // as a module of its own, pointed at the served game.
  await page.route('**/fix-pilot.mjs',async route=>{
    const source=fs.readFileSync(path.join(root,'tests/fix-pilot.mjs'),'utf8').replace(/'\.\.\/dist\//g,"'/");
    await route.fulfill({contentType:'text/javascript',body:source});
  });
  await page.goto(process.env.REVIEW_URL||url);
  await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
  await page.evaluate(async()=>{playtest.manual=true;await playtest.begin(2,true,'original');});
  await page.waitForFunction(()=>document.getElementById('loading').classList.contains('hidden'),null,{timeout:60000});
  const shot=async name=>{await page.evaluate(()=>{const w=playtest.world,g=playtest.game;w.cameraX=g.player.x+3;for(let i=0;i<60;i++)w.render(g,.05);playtest.draw();});await page.waitForTimeout(300);await page.evaluate(()=>playtest.draw());await page.screenshot({path:`${out}/${name}.png`});};
  // Stand on the dock as a player arriving from the sluice would.
  await page.evaluate(()=>{const g=playtest.game,L=g.level,dock=L.platforms.find(p=>p.id==='gallery-entry');Object.assign(g.player,{x:dock.x+2,y:dock.y,vx:0,vy:0,groundId:dock.id,facing:1});g.checkpoint={x:dock.x+2.4,y:dock.y};playtest.step(5);});
  await shot('1-rot');
  // Play the pilot up to each beat.
  const play=async until=>page.evaluate(async until=>{
    const {fixPilot}=await import('/fix-pilot.mjs');
    const g=playtest.game,st=g.level.shaping.find(s=>s.id==='gallery-fix');
    const pilot=window.__pilot??=fixPilot(g,st);
    const stop=new Function('st','g',`return (${until})(st,g)`);
    let n=0;
    for(;;){if(stop(st,g))break;const r=pilot.next();if(r.done)break;playtest.game.tick(1/120,r.value);if(++n>12000)break;}
    playtest.draw();
    return {n,phase:st.fix.phase,block:g.level.platforms.find(p=>p.id==='gallery-block').pushPhase,deaths:g.deaths,player:[+g.player.x.toFixed(2),+g.player.y.toFixed(2)]};
  },until.toString());
  console.log('open',JSON.stringify(await play((st)=>st.fix.phase!=='rot')));
  await page.evaluate(()=>playtest.step(30));await shot('2-open');
  console.log('seated',JSON.stringify(await play((st)=>st.fix.phase==='settling'||st.fix.phase==='shaping')));
  await page.evaluate(()=>playtest.step(100));await shot('3-seated');
  console.log('healed',JSON.stringify(await play((st)=>st.fix.phase==='healed')));
  await page.evaluate(()=>playtest.step(20));await shot('4-flash');
  await page.evaluate(()=>playtest.step(200));await shot('5-mended');
  // The Kiln, without its clay.
  await page.evaluate(()=>{const g=playtest.game,L=g.level,s=L.platforms.find(p=>p.id==='kiln-ledge');Object.assign(g.player,{x:s.x+3,y:s.y,vx:0,vy:0,groundId:s.id,facing:1});playtest.step(5);});
  await shot('6-kiln');
  if(errors.length)throw new Error('page errors: '+errors.map(e=>e.message||e).join(' | '));
});
