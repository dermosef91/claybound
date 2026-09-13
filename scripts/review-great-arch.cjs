// Actual WebGL review in an isolated profile; existing saves/drafts are untouched.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=root+'/docs/great-arch';
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
      body+='\nwindow.playtest={manual:false,get game(){return game},get world(){return world},get editor(){return editor},get input(){return input},begin,draw(){world.render(game,0);healthHUD.draw(game,0);updateHUD(performance.now());},step(n){for(let i=0;i<n;i++){game.tick(FIXED_DT,input);input.jumpPressed=false;input.stompPressed=false;}this.draw();}};';
      await route.fulfill({contentType:'text/javascript',body});
    });
    await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5173');
    await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
    await page.evaluate(async()=>{playtest.manual=true;await playtest.begin(0,true,'original');});
    await page.evaluate(()=>{
      const w=playtest.world,g=playtest.game;Object.assign(g.player,{x:152,y:10.6,vx:0,vy:0,groundId:'arch-shelf'});
      g.sectionId=3;w.setEditorCamera({x:159,y:15,viewH:24.5});playtest.draw();
      w.character.root.visible=false;w.renderer.render(w.scene,w.camera);document.getElementById('hud').style.visibility='hidden';
    });
    await page.screenshot({path:out+'/overview.png'});
    await page.evaluate(()=>{
      const w=playtest.world,g=playtest.game;w.character.root.visible=true;document.getElementById('hud').style.visibility='visible';
      Object.assign(g.player,{x:154,y:10.6,vx:0,vy:0,groundId:'arch-shelf'});w.setEditorCamera(null);
      for(let i=0;i<90;i++)w.render(g,.05);playtest.draw();
    });
    await page.screenshot({path:out+'/gameplay-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(()=>{const w=playtest.world,g=playtest.game;Object.assign(g.player,{x:160,y:g.level.platforms.find(s=>s.id==='arch-lift').y,groundId:'arch-lift'});for(let i=0;i<90;i++)w.render(g,.05);playtest.draw();});
    await page.screenshot({path:out+'/gameplay-portrait.png'});
    const ride=await page.evaluate(()=>{
      playtest.step(720);const g=playtest.game,w=playtest.world;
      const ropes=w.platforms.get('arch-lift').ropes;w.scene.updateMatrixWorld(true);
      return {deaths:g.deaths,ground:g.player.groundId,health:g.player.health,ceiling:ropes.map(rope=>rope.position.y+rope.parent.position.y+rope.scale.y*rope.userData.ceiling.rest)};
    });
    assert.equal(ride.deaths,0);assert.equal(ride.ground,'arch-lift');assert.equal(ride.health,3);
    await page.setViewportSize({width:1672,height:941});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(async()=>{
      await playtest.editor.open(0,{x:159,y:14});Object.assign(playtest.editor.camera,{x:159,y:15,viewH:24.5});
      playtest.world.render(playtest.game,0);playtest.editor.draw();
    });
    await page.locator('#editor-passage').selectOption('3');
    await page.locator('[data-edit="browse"]').first().click();
    const choice=await page.evaluate(()=>'platforms:'+playtest.editor.session.level.platforms.findIndex(s=>s.id==='arch-shelf'));
    await page.locator('#editor-browse').selectOption(choice);
    await page.locator('input[data-field="w"]').fill('4.6');await page.locator('input[data-field="w"]').press('Tab');
    assert.equal(await page.evaluate(()=>playtest.game.level.platforms.find(s=>s.id==='arch-shelf').w),4.6);
    assert(await page.evaluate(()=>!!playtest.world.levelRoot.getObjectByName('Supplied sandstone cave')));
    await page.locator('[data-edit="undo"]').click();
    assert.equal(await page.evaluate(()=>playtest.game.level.platforms.find(s=>s.id==='arch-shelf').w),4);
    await page.evaluate(()=>{playtest.editor.select(null);Object.assign(playtest.editor.camera,{x:159,y:15,viewH:24.5});playtest.world.render(playtest.game,0);playtest.editor.draw();});
    await page.screenshot({path:out+'/editor.png'});
    const stats=await page.evaluate(()=>{playtest.world.render(playtest.game,0);return {calls:playtest.world.renderer.info.render.calls,triangles:playtest.world.renderer.info.render.triangles,layoutVersion:playtest.game.level.layoutVersion};});
    fs.writeFileSync(out+'/browser-results.json',JSON.stringify({errors,requests,stats,ride,editor:['select Great Arch section','resize shelf','undo','retain enclosure']},null,2)+'\n');
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('PASS Great Arch WebGL review',stats);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
