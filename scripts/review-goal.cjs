// Deterministic, actual WebGL captures using the shipped game and an isolated save.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=root+'/docs/goal-design';
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1672,height:941}}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)requests.push({url:r.url(),status:r.status()});});
    await page.route('**/app.js',async route=>{
      let body=fs.readFileSync(root+'/dist/app.js','utf8');
      body=body.replace('function frame(now){','function frame(now){if(window.playtest?.manual){requestAnimationFrame(frame);return;}');
      body+='\nwindow.playtest={manual:false,get game(){return game},get world(){return world},get editor(){return editor},begin,draw(){world.render(game,0);healthHUD.draw(game,0);updateHUD(performance.now());}};';
      await route.fulfill({contentType:'text/javascript',body});
    });
    await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5173');
    await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
    await page.evaluate(async()=>{playtest.manual=true;await playtest.begin(0,true,'original');});
    await page.evaluate(()=>{
      const w=playtest.world,g=playtest.game,s=g.level.platforms.find(s=>s.goal);
      Object.assign(g.player,{x:g.level.end-5.9,y:s.y,vx:0,vy:0,facing:1,groundId:s.id});
      g.sectionId=s.section;w.time=0;w.setEditorCamera({x:g.level.end-1.2,y:s.y+2.25,viewH:7.6});
      playtest.draw();document.getElementById('hud').style.visibility='hidden';
      document.querySelector('.health-hud')?.style.setProperty('visibility','hidden');
      // Use the same mild downward view as play, retaining a fixed framing.
      w.camera.position.y=w.cameraY+w.theme.cameraElevation;w.camera.lookAt(w.cameraX,w.cameraY,0);w.renderer.render(w.scene,w.camera);
    });
    const label=process.env.GOAL_CAPTURE||'after';
    await page.screenshot({path:out+'/'+label+'.png'});
    const stats=await page.evaluate(()=>{
      const w=playtest.world,g=playtest.game;w.render(g,0);let goalMeshes=0,goalTriangles=0;
      w.levelRoot.getObjectByName('Chapter goal').traverse(o=>{if(o.isMesh){goalMeshes++;goalTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
      return {calls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles,goalMeshes,goalTriangles};
    });
    if(process.env.GOAL_FULL){
      await page.evaluate(()=>{document.getElementById('hud').style.visibility='visible';const w=playtest.world,g=playtest.game;w.setEditorCamera(null);for(let i=0;i<90;i++)w.render(g,.05);playtest.draw();});
      await page.screenshot({path:out+'/gameplay-desktop.png'});
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.evaluate(()=>{const w=playtest.world,g=playtest.game;g.player.x=g.level.end-2.6;for(let i=0;i<90;i++)w.render(g,.05);playtest.draw();});
      await page.screenshot({path:out+'/gameplay-portrait.png'});
      // Approach the actual completion trigger with normal simulation ticks.
      const completion=await page.evaluate(()=>{
        const w=playtest.world,g=playtest.game;g.player.x=g.level.end-1.4;
        for(let i=0;i<90&&g.status==='playing';i++)g.tick(1/60,{right:true});
        w.render(g,.08);return {status:g.status,x:g.player.x,bellRotation:w.bell.rotation.z};
      });
      assert.equal(completion.status,'complete');stats.completion=completion;
      await page.setViewportSize({width:1672,height:941});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      for(const index of [1,2,3]){
        await page.evaluate(async index=>{
          await playtest.begin(index,true,'original');const w=playtest.world,g=playtest.game,s=g.level.platforms.find(s=>s.goal);
          Object.assign(g.player,{x:g.level.end-5.9,y:s.y,vx:0,vy:0,facing:1,groundId:s.id});g.sectionId=s.section;
          w.setEditorCamera({x:g.level.end-1.2,y:s.y+2.25,viewH:7.6});playtest.draw();
          document.getElementById('hud').style.visibility='hidden';
          w.camera.position.y=w.cameraY+(w.theme.cameraElevation??1.25);w.camera.lookAt(w.cameraX,w.cameraY,0);w.renderer.render(w.scene,w.camera);
        },index);
        await page.screenshot({path:out+'/chapter-'+(index+1)+'.png'});
      }
    }
    fs.writeFileSync(out+'/'+label+'-results.json',JSON.stringify({errors,requests,stats},null,2)+'\n');
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('PASS goal WebGL capture',stats);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
