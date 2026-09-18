// Real WebGL frames of each character standing on canyon clay, facing both
// ways, with a close look at the boots: for judging a rig's profile and stance
// the way the game shows them. Not part of the check. Serves dist/ itself and
// drives the live game in headless Chrome through the same Playwright the
// other review scripts use.
//   [CAST=clay,apprentice] [OUT=dir] [PLAYWRIGHT_MODULE=…] [CHROME_PATH=…] node scripts/review-cast.cjs
// Frames land in docs/cast-stance/ by default, like the other capture tools:
// ID-right.png and ID-left.png are the standing idle each way, ID-feet.png the
// boots on the slab facing right.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
const {review,patchApp,PROJECT}=require('./support/review.cjs');
const root=PROJECT,out=process.env.OUT||path.join(root,'docs/cast-stance');
review(async({page,url,errors,requests})=>{
  const {CHARACTERS}=await import(pathToFileURL(path.join(root,'dist/characters.js')).href);
  const cast=(process.env.CAST||CHARACTERS.map(c=>c.id).join(',')).split(',');
  fs.mkdirSync(out,{recursive:true});
  await patchApp(page,{root,expose:'window.playtest={manual:false,get game(){return game},get world(){return world},begin,draw(){world.render(game,0);}};'});
  await page.goto(url);
  await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
  await page.waitForFunction(()=>!!window.playtest);
  await page.evaluate(async()=>{
    playtest.manual=true;await playtest.begin(0,true,'original');
    // The title screen fades out on frames the held loop never runs, so it is
    // put away outright, with the loading card and the HUD.
    for(const id of ['menu','loading','hud'])document.getElementById(id).style.visibility='hidden';
    document.querySelector('.health-hud')?.style.setProperty('visibility','hidden');
    for(const id of ['touch-controls','desktop-controls','hint','chapter-intro','timer'])document.getElementById(id)?.classList.add('hidden');
  });
  const frames=[];
  for(const id of cast){
    const stood=await page.evaluate(async id=>{
      const w=playtest.world,g=playtest.game;
      await w.setCharacter(id);
      Object.assign(g.player,{x:g.level.spawn.x+1.2,y:g.level.spawn.y,vx:0,vy:0,facing:1,groundId:'start'});
      w.time=0;w.syncVisible(g.level,g.player.x,true);
      // Half a second of idle, so the pose is the one a player sees.
      for(let i=0;i<30;i++)w.render(g,1/60);
      return {id:w.character.choice.id,height:w.character.choice.height};
    },id);
    assert.equal(stood.id,id);
    // Framing scales with the character, so the cast reads at one size.
    const frame=async(facing,viewH,lift)=>page.evaluate(([facing,viewH,lift])=>{
      const w=playtest.world,g=playtest.game;
      g.player.facing=facing;
      // The turn is damped; let it settle before the camera is pinned.
      for(let i=0;i<40;i++)w.render(g,1/60);
      w.setEditorCamera({x:g.player.x,y:g.player.y+lift,viewH});
      playtest.draw();
      w.camera.position.y=w.cameraY+(w.theme.cameraElevation??1.25);w.camera.lookAt(w.cameraX,w.cameraY,0);w.renderer.render(w.scene,w.camera);
    },[facing,viewH,lift]);
    const h=stood.height;
    for(const [name,facing,viewH,lift] of [['right',1,h*2.15,h*.27],['left',-1,h*2.15,h*.27],['feet',1,h*.8,h*.17]]){
      await frame(facing,viewH,lift);
      await page.screenshot({path:path.join(out,`${id}-${name}.png`)});frames.push({id,name,facing,viewH:+viewH.toFixed(2)});
    }
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({frames,errors,requests},null,2)+'\n');
  console.log(`${cast.length} characters on canyon clay → ${out}`);console.table(frames);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
},{root,viewport:{width:1280,height:720},page:{deviceScaleFactor:1}}).catch(e=>{console.error(e);process.exit(1);});
