// Real WebGL frames of a stomped creature being pressed flat, popping pellets
// and breaking into clumps, for visual review. Not part of the check. Serves
// dist/ itself and drives the live game in headless Chrome through the same
// Playwright the other review scripts use.
//   KIND=clayling|bat|spore|spitter|drifter [OUT=dir] [PORT=n] [PLAYWRIGHT_MODULE=…] [CHROME_PATH=…] node scripts/review-squash.cjs
// Frames land in docs/squash-review/ by default, like the other capture tools.
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const {review,patchApp,PROJECT}=require('./support/review.cjs');
const root=PROJECT,out=process.env.OUT||path.join(root,'docs/squash-review');
const kind=process.env.KIND||'clayling';
review(async({page,url,errors})=>{
  const {LEVELS}=await import(pathToFileURL(path.join(root,'dist/levels.js')).href);
  const index=LEVELS.findIndex(L=>L.enemies.some(e=>(e.kind||'clayling')===kind));
  if(index<0)throw new Error('no chapter has a '+kind);
  fs.mkdirSync(out,{recursive:true});
  {
    // The editor camera is the only way to frame the creature closely, but the
    // world reads it as "editing" and holds its particles; while `live` is
    // set the particles are stepped anyway, at the frame rate advance() uses.
    await patchApp(page,{root,expose:`window.playtest={manual:false,live:false,get game(){return game},get world(){return world},begin,
  draw(){world.render(game,0);},
  arm(){const base=Object.getPrototypeOf(world).updateParticles;world.updateParticles=function(dt,press){return base.call(this,dt||(playtest.live?1/60:0),press);};},
  advance(seconds,tick=true){playtest.live=true;try{for(let t=0;t<seconds-1e-9;t+=1/60){if(tick)for(let i=0;i<2;i++)game.tick(FIXED_DT,{});world.render(game,1/60);}}finally{playtest.live=false;}},
  info(){const r=world.renderer.info.render;return {calls:r.calls,triangles:r.triangles,particles:world.particles.length,clumps:world.particles.filter(q=>q.kind==='clay-clump').length,pellets:world.particles.filter(q=>q.kind==='clay-pellet').length};}};`});
    await page.goto(url);
    await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
    await page.waitForFunction(()=>!!window.playtest);
    await page.evaluate(async index=>{playtest.manual=true;await playtest.begin(index,true,'original');playtest.arm();},index);
    const setup=await page.evaluate(kind=>{
      const g=playtest.game,w=playtest.world;
      const e=g.level.enemies.find(e=>(e.kind||'clayling')===kind);
      e.speed=0;if(e.kind==='bat')e.aiState='patrol';
      // A bead hanging over the creature would burst gold into the frames.
      for(const c of g.level.coins)if(Math.abs(c.x-e.x)<2.5&&Math.abs(c.y-e.y)<3)c.taken=true;
      Object.assign(g.player,{x:e.x-.05,y:e.y+(kind==='bat'?1.3:1.6),vx:0,vy:-5,groundId:null,coyote:0,invuln:0});
      w.syncVisible(g.level,e.x,true);
      w.setEditorCamera({x:e.x,y:e.y+.9,viewH:4.6});
      document.getElementById('hud').style.visibility='hidden';
      for(const id of ['touch-controls','desktop-controls','hint','chapter-intro','timer'])document.getElementById(id)?.classList.add('hidden');
      let n=0;while(e.alive&&n<600){g.tick(1/120,{});n++;}
      playtest.draw();
      return {x:e.x,y:e.y,alive:e.alive,ticks:n,quiet:playtest.info()};
    },kind);
    if(setup.alive)throw new Error('the stomp did not land: '+JSON.stringify(setup));
    // The first two frames are the hit-stop: drawn with the simulation held.
    const marks=[['00-impact',1/60,false],['01-hitstop',1/60,false],['02-pressed',.1,true],['03-held',.15,true],['04-swell',.08,true],['05-break',.05,true],['06-flying',.1,true],['07-landed',.25,true],['08-resting',.25,true],['09-sinking',.35,true],['10-gone',.45,true]];
    const frames=[];let elapsed=0;
    for(const [name,dt,tick]of marks){
      const info=await page.evaluate(([dt,tick])=>{playtest.advance(dt,tick);return playtest.info();},[dt,tick]);
      elapsed+=dt;
      await page.screenshot({path:path.join(out,`${kind}-${name}.png`)});
      frames.push({name,t:+elapsed.toFixed(3),...info});
    }
    fs.writeFileSync(path.join(out,`${kind}-log.json`),JSON.stringify({kind,index,setup,frames,errors},null,2)+'\n');
    console.log(`${kind} (chapter ${index}, enemy at ${setup.x},${setup.y}) → ${out}`);console.table(frames);
    if(errors.length){console.error(errors);process.exitCode=1;}
  }
},{root,viewport:{width:1280,height:720},page:{deviceScaleFactor:1}}).catch(e=>{console.error(e);process.exit(1);});
