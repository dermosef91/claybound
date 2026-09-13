// Review the actual WebGL scene in an isolated profile; never touch saved drafts.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,process.env.REVIEW_OUT||'docs/canyon-bridge');
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
    const prefix=process.env.BRIDGE_BASELINE?'before':'after';
    await page.evaluate(()=>{
      const w=playtest.world,g=playtest.game;Object.assign(g.player,{x:173,y:16,vx:0,vy:0,groundId:'arch-roof'});
      g.sectionId=3;w.setEditorCamera({x:178.85,y:13.15,viewH:10.5});playtest.draw();
      // Composition crop uses the level editor's straight-on camera, as in the reference.
      w.character.root.visible=false;w.renderer.render(w.scene,w.camera);
      document.getElementById('hud').style.visibility='hidden';
    });
    await page.screenshot({path:out+'/'+prefix+'-scene.png'});
    if(!process.env.BRIDGE_BASELINE){
      await page.evaluate(()=>{
        const w=playtest.world,g=playtest.game;w.character.root.visible=true;
        document.getElementById('hud').style.visibility='visible';
        Object.assign(g.player,{x:180,y:13.3,vx:0,vy:0,groundId:'arch-drop'});
        w.setEditorCamera(null);for(let i=0;i<90;i++)w.render(g,.05);playtest.draw();
      });
      await page.screenshot({path:out+'/gameplay-desktop.png'});
      await page.keyboard.down('KeyD');await page.evaluate(()=>playtest.step(150));await page.keyboard.up('KeyD');
      const crossing=await page.evaluate(()=>({x:playtest.game.player.x,y:playtest.game.player.y,health:playtest.game.player.health,deaths:playtest.game.deaths,checkpoint:playtest.game.checkpointId}));
      assert(crossing.x>187&&crossing.deaths===0&&crossing.checkpoint==='last-rest','keyboard crossing reaches the checkpoint');
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>{const w=playtest.world,g=playtest.game;Object.assign(g.player,{x:180,y:13.3,vx:0,vy:0,groundId:'arch-drop'});for(let i=0;i<90;i++)w.render(g,.05);playtest.draw();});
      await page.screenshot({path:out+'/gameplay-portrait.png'});
      const stats=await page.evaluate(()=>{playtest.world.render(playtest.game,0);return {calls:playtest.world.renderer.info.render.calls,triangles:playtest.world.renderer.info.render.triangles,layoutVersion:playtest.game.level.layoutVersion};});
      await page.setViewportSize({width:1672,height:941});
      await page.evaluate(async()=>{
        await playtest.editor.open(0,{x:180,y:13.8});
        playtest.world.render(playtest.game,0);playtest.editor.draw();
      });
      await page.locator('[data-edit="browse"]').first().click();
      const choice=await page.evaluate(()=>'platforms:'+playtest.editor.session.level.platforms.findIndex(s=>s.id==='arch-drop'));
      await page.locator('#editor-browse').selectOption(choice);
      assert.equal(await page.locator('select[data-field="kind"]').inputValue(),'bridge');
      await page.locator('input[data-field="w"]').fill('7.1');await page.locator('input[data-field="w"]').press('Tab');
      assert.equal(await page.evaluate(()=>playtest.game.level.platforms.find(s=>s.id==='arch-drop').w),7.1);
      await page.locator('[data-edit="undo"]').click();
      assert.equal(await page.evaluate(()=>playtest.game.level.platforms.find(s=>s.id==='arch-drop').w),6.3);
      const plank=await page.evaluate(()=>{
        const editor=playtest.editor;editor.select(null);editor.camera.viewH=8;
        playtest.world.render(playtest.game,0);editor.draw();
        const point=editor.toScreen(180,13.15),rect=editor.canvas.getBoundingClientRect();return {x:point.x+rect.left,y:point.y+rect.top};
      });
      await page.mouse.click(plank.x,plank.y);
      assert.equal(await page.locator('select[data-field="kind"]').inputValue(),'bridge');
      await page.evaluate(()=>{
        const w=playtest.world;Object.assign(playtest.editor.camera,{x:178.85,y:12.8,viewH:11.7});w.render(playtest.game,0);playtest.editor.draw();
      });
      await page.screenshot({path:out+'/editor.png'});
      // A wider reference crop includes the spike bed and both sandstone banks.
      await page.evaluate(()=>{
        const w=playtest.world;playtest.editor.root.style.visibility='hidden';
        w.character.root.visible=false;w.renderer.render(w.scene,w.camera);
      });
      await page.screenshot({path:out+'/bridge-overview.png'});
      fs.writeFileSync(out+'/browser-results.json',JSON.stringify({errors,requests,crossing,stats,editor:['browse rope bridge','resize','undo','click curved planks','rebuild']},null,2)+'\n');
    }
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    console.log('PASS canyon bridge WebGL review:',prefix);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
