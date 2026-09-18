// Real WebGL frames of the Clay apprentice standing on canyon clay, pressed to
// a sweep of relief depths, for choosing how deep its clay should read. Not part
// of the check. Serves dist/ itself and drives the live game in headless Chrome
// through the same Playwright the other review scripts use.
//   [DEPTHS=.025,.045,.06,.075] [OUT=dir] [PLAYWRIGHT_MODULE=…] [CHROME_PATH=…] node scripts/review-apprentice.cjs
// Frames land in docs/apprentice-clay/ by default, like the other capture tools:
// before.png is the press every imported model takes, after.png the one the
// apprentice declares, depth-NNN.png the sweep between, and play-*.png the same
// two at the distance the game is actually played from.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {review,patchApp,PROJECT}=require('./support/review.cjs');
const root=PROJECT,out=process.env.OUT||path.join(root,'docs/apprentice-clay');
const depths=(process.env.DEPTHS||'.025,.045,.06,.075').split(',').map(Number);
const label=d=>'depth-'+String(Math.round(d*1000)).padStart(3,'0');
review(async({page,url,errors,requests})=>{
  fs.mkdirSync(out,{recursive:true});
  await patchApp(page,{root,expose:'window.playtest={manual:false,get game(){return game},get world(){return world},begin,draw(){world.render(game,0);}};'});
  await page.goto(url);
  await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
  await page.waitForFunction(()=>!!window.playtest);
  const setup=await page.evaluate(async()=>{
    playtest.manual=true;await playtest.begin(0,true,'original');
    const w=playtest.world,g=playtest.game;
    await w.setCharacter('apprentice');
    // Stand on the start slab, a step in from the spawn so the slab's clay
    // fills the foot of the frame; the idle settles for half a second so the
    // pose is the one a player sees, not the bind pose.
    Object.assign(g.player,{x:g.level.spawn.x+1.2,y:g.level.spawn.y,vx:0,vy:0,facing:1,groundId:'start'});
    w.time=0;w.syncVisible(g.level,g.player.x,true);
    // The title screen fades out on frames the held loop never runs, so it is
    // put away outright, with the loading card and the HUD.
    for(const id of ['menu','loading','hud'])document.getElementById(id).style.visibility='hidden';
    document.querySelector('.health-hud')?.style.setProperty('visibility','hidden');
    for(const id of ['touch-controls','desktop-controls','hint','chapter-intro','timer'])document.getElementById(id)?.classList.add('hidden');
    for(let i=0;i<30;i++)w.render(g,1/60);
    const depth=w.character.choice.clayDepth,materials=[];
    w.character.asset.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.push({bumpScale:m.bumpScale,clay:m.userData.clay,map:!!m.map,roughness:m.roughness});});
    return {character:w.character.choice.id,declared:depth,height:w.character.choice.height,materials};
  });
  assert.equal(setup.character,'apprentice');
  assert(setup.materials.every(m=>m.clay?.type==='relief'),'the apprentice wears the ball relief');
  assert(setup.materials.every(m=>Math.abs(m.bumpScale-setup.declared*.48)<1e-9),'the declared depth is what the relief was installed at');
  // Re-pressing in place is exactly what clayMaterial does to an installed
  // material: the depth and its bump scale, nothing else.
  const press=async depth=>page.evaluate(depth=>{
    const w=playtest.world,g=playtest.game;
    w.character.asset.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.userData.clay.requestedDepth=depth;m.userData.clay.depth=depth*.48;m.bumpScale=depth*.48;}});
    w.render(g,0);
  },depth);
  const close=async()=>page.evaluate(()=>{
    const w=playtest.world,g=playtest.game;
    w.setEditorCamera({x:g.player.x,y:g.player.y+.55,viewH:4.4});
    playtest.draw();
    // The same mild downward view as play, so the clay's presses catch the sun
    // the way they do in a game frame.
    w.camera.position.y=w.cameraY+(w.theme.cameraElevation??1.25);w.camera.lookAt(w.cameraX,w.cameraY,0);w.renderer.render(w.scene,w.camera);
  });
  const play=async()=>page.evaluate(()=>{
    const w=playtest.world,g=playtest.game;
    w.setEditorCamera(null);for(let i=0;i<90;i++)w.render(g,0);
  });
  const frames=[];
  const shoot=async(name,depth,framing)=>{await press(depth);await framing();await page.screenshot({path:path.join(out,name+'.png')});frames.push({name,depth});};
  await shoot('before',.025,close);
  for(const d of depths)await shoot(label(d),d,close);
  await shoot('after',setup.declared,close);
  await shoot('play-before',.025,play);
  await shoot('play-after',setup.declared,play);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({setup,frames,errors,requests},null,2)+'\n');
  console.log(`apprentice at .025 → ${setup.declared} on canyon clay → ${out}`);console.table(frames);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
},{root,viewport:{width:1280,height:720},page:{deviceScaleFactor:1}}).catch(e=>{console.error(e);process.exit(1);});
