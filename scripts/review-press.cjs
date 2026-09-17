// Isolated browser profile and fixed simulation states for press visual review.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {playwright,chromePath}=require('./support/review.cjs');
const {chromium}=playwright();
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/press-design');
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:chromePath(),args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:941,height:1672}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    if(process.env.PRESS_BASELINE)await page.route('**/press-views.js*',route=>route.fulfill({
      contentType:'text/javascript',body:require('child_process').execFileSync('git',['show','e08e768:dist/press-views.js'],{cwd:root,encoding:'utf8'})
    }));
    await page.route('**/app.js*',async route=>{
      let body=fs.readFileSync(root+'/dist/app.js','utf8');
      body=body.replace('function frame(now){','function frame(now){if(window.playtest?.manual){requestAnimationFrame(frame);return;}');
      body+='\nwindow.playtest={manual:false,get game(){return game},get world(){return world},begin,draw(){world.render(game,0);},step(n){for(let i=0;i<n;i++)game.tick(FIXED_DT,{});this.draw();}};';
      await route.fulfill({contentType:'text/javascript',body});
    });
    await page.goto('http://127.0.0.1:5184');
    await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
    await page.waitForFunction(()=>!!window.playtest);
    await page.evaluate(async()=>{playtest.manual=true;await playtest.begin(2,true,'original');});
    const prefix=process.env.PRESS_BASELINE?'before':'after';
    await page.evaluate(()=>{
      const w=playtest.world,g=playtest.game,c=g.level.crushers[0];
      Object.assign(g.player,{x:c.x,y:1,vx:0,vy:0});
      w.setEditorCamera({x:c.x,y:3.65,viewH:5.8});playtest.draw();
      w.character.root.visible=false;w.renderer.render(w.scene,w.camera);
      document.getElementById('hud').style.visibility='hidden';
    });
    await page.screenshot({path:out+'/'+prefix+'-portrait.png'});
    if(!process.env.PRESS_BASELINE){
      const states=await page.evaluate(()=>{
        const g=playtest.game,w=playtest.world,c=g.level.crushers[0],states=new Set();
        let grounded=false;
        for(let i=0;i<650;i++){
          playtest.step(1);states.add(c.state);
          if(c.state==='impact'){
            const head=w.crusherViews[0].userData.press.head;
            grounded=Math.abs(c.y-.65-c.floorY)<1e-6&&Math.abs(head.position.y-(c.y-c.baseY))<1e-6;
          }
        }
        return {states:[...states],grounded};
      });
      assert(states.grounded);for(const s of ['rest','warning','slam','impact','retract'])assert(states.states.includes(s));
      await page.evaluate(()=>{
        const g=playtest.game,w=playtest.world,c=g.level.crushers[0];
        while(c.state!=='impact')playtest.step(1);
        w.setEditorCamera({x:c.x,y:2.9,viewH:7.5});playtest.draw();
        playtest.world.character.root.visible=false;playtest.world.renderer.render(playtest.world.scene,playtest.world.camera);
      });
      await page.screenshot({path:out+'/after-impact.png'});
      await page.evaluate(()=>{
        const g=playtest.game,c=g.level.crushers[0];g.channels[c.holdChannel]=8;playtest.step(100);
        playtest.world.setEditorCamera({x:c.x,y:3.65,viewH:5.8});playtest.draw();
        if(!g.level.crushers.every(p=>p.held))throw new Error('Press hold failed');
        playtest.world.character.root.visible=false;playtest.world.renderer.render(playtest.world.scene,playtest.world.camera);
      });
      await page.screenshot({path:out+'/after-held.png'});
      await page.setViewportSize({width:1672,height:941});
      await page.evaluate(()=>{const w=playtest.world,g=playtest.game;Object.assign(g.player,{x:77,y:1,vx:0,vy:0});w.setEditorCamera(null);w.character.root.visible=true;document.getElementById('hud').style.visibility='visible';for(let i=0;i<90;i++)w.render(g,.05);});
      await page.screenshot({path:out+'/after-gameplay.png'});
      fs.writeFileSync(out+'/browser-checks.json',JSON.stringify({states,errors},null,2)+'\n');
    }
    assert.deepEqual(errors,[]);console.log('PASS press browser capture and checks: '+prefix);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
