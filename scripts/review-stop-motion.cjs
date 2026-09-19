// Contact sheets of the stop-motion setting: sixteen consecutive frames at sixty,
// the setting off above the setting on, so held poses and cuts can be counted
// against the smooth run they replace. Not part of the check. Serves dist/
// itself and drives the live game in headless Chrome through the same
// Playwright the other review scripts use.
//   [CAST=apprentice] [OUT=dir] [PLAYWRIGHT_MODULE=…] [CHROME_PATH=…] node scripts/review-stop-motion.cjs
// Frames land in docs/stop-motion/ by default, like the other capture tools:
// ID-run.png, ID-idle.png and ID-land.png are the hero's sheets, KIND.png the
// chapter's first creature's (the canyon's drifter, whose roll reads the
// simulation directly), ID-boil-a/b.png two consecutive exposures of the skin close
// up, for the crawl of the prints between them.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {review,patchApp,PROJECT}=require('./support/review.cjs');
const root=PROJECT,out=process.env.OUT||path.join(root,'docs/stop-motion');
const cast=(process.env.CAST||'apprentice').split(',');
const FRAMES=16,TILE={w:112,h:210},CROP={w:300,h:560};
// One tile per exposure on the landing sheet: a twelfth of a second is five
// frames at sixty (the clock spends on the fifth).
const PER=5;
review(async({page,url,errors,requests})=>{
  fs.mkdirSync(out,{recursive:true});
  await patchApp(page,{root,expose:'window.playtest={manual:false,get game(){return game},get world(){return world},begin,draw(){world.render(game,0);}};'});
  await page.goto(url);
  await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
  await page.waitForFunction(()=>!!window.playtest);
  await page.evaluate(async()=>{
    playtest.manual=true;await playtest.begin(0,true,'original');
    for(const id of ['menu','loading','hud'])document.getElementById(id).style.visibility='hidden';
    document.querySelector('.health-hud')?.style.setProperty('visibility','hidden');
    for(const id of ['touch-controls','desktop-controls','hint','chapter-intro','timer'])document.getElementById(id)?.classList.add('hidden');
    // The sheet is drawn in the page from the live canvas, one tile per frame.
    const sheet=document.createElement('canvas');sheet.id='sheet';document.body.appendChild(sheet);
    Object.assign(sheet.style,{position:'fixed',left:'0',top:'0',zIndex:'99',background:'#222'});
  });
  const results=[];
  for(const id of cast){
    await page.evaluate(async id=>{await playtest.world.setCharacter(id);},id);
    // run and idle: every frame, so the holds and cuts can be counted. land: one
    // tile per exposure after a drop, so the squash is seen settling (it once
    // rang against its clamp for ever under the long step).
    for(const [name,input,every,drop] of [['run',{right:true},1,false],['idle',{},1,false],['land',{},PER,true]]){
      const cuts=await page.evaluate(([input,FRAMES,TILE,CROP,label,every,drop])=>{
        const w=playtest.world,g=playtest.game,sheet=document.getElementById('sheet'),ctx=sheet.getContext('2d');
        sheet.width=FRAMES*TILE.w;sheet.height=2*TILE.h+24;ctx.fillStyle='#222';ctx.fillRect(0,0,sheet.width,sheet.height);
        const cuts=[],squash=[];
        for(const [row,on] of [[0,false],[1,true]]){
          // The same start each time: stood at the spawn, half a second settled.
          Object.assign(g.player,{x:g.level.spawn.x+.5,y:g.level.spawn.y,vx:0,vy:0,facing:1,groundId:'start'});
          w.stopMotion=on;w.time=0;w.syncVisible(g.level,g.player.x,true);
          for(let i=0;i<30;i++){for(let k=0;k<2;k++)g.tick(1/120,input);w.render(g,1/60);}
          if(drop){
            // Fall from a little over two units and catch the frame that lands.
            Object.assign(g.player,{y:g.level.spawn.y+2.2,vy:0,groundId:null});
            while(!g.player.groundId){for(let k=0;k<2;k++)g.tick(1/120,input);w.render(g,1/60);}
          }
          let moved=0,last=null,worst=0;
          for(let i=0;i<FRAMES*every;i++){
            for(let k=0;k<2;k++)g.tick(1/120,input);
            w.setEditorCamera({x:g.player.x,y:g.player.y+.55,viewH:4.4});
            w.render(g,1/60);
            if(i>=FRAMES*every/2)worst=Math.max(worst,Math.abs(w.character.spring));
            if(i%every)continue;
            const q=w.character.asset.getObjectByName('LeftArm').quaternion.toArray().join();if(last!==null&&q!==last)moved++;last=q;
            const tile=i/every,c=w.renderer.domElement,sx=(c.width-CROP.w)/2,sy=(c.height-CROP.h)/2;
            ctx.drawImage(c,sx,sy,CROP.w,CROP.h,tile*TILE.w,row*TILE.h+24,TILE.w,TILE.h);
            ctx.strokeStyle='#111';ctx.strokeRect(tile*TILE.w+.5,row*TILE.h+24.5,TILE.w-1,TILE.h-1);
          }
          cuts.push(moved);squash.push(+worst.toFixed(3));
        }
        ctx.fillStyle='#eee';ctx.font='13px sans-serif';
        ctx.fillText(every===1
          ?`${label}: ${FRAMES} consecutive frames at 60 fps — top: stop motion off (${cuts[0]} pose changes), bottom: on (${cuts[1]} cuts)`
          :`${label}: ${FRAMES} exposures (every ${every}th frame) after a landing — top: off, bottom: on; worst squash in the second half ${squash[0]} / ${squash[1]}`,8,16);
        return {cuts,squash};
      },[input,FRAMES,TILE,CROP,`${id} ${name}`,every,drop]);
      await page.locator('#sheet').screenshot({path:path.join(out,`${id}-${name}.png`)});
      results.push({id,name,off:cuts.cuts[0],on:cuts.cuts[1],squashOff:cuts.squash[0],squashOn:cuts.squash[1]});
      if(every===1){
        assert.equal(cuts.cuts[0],FRAMES-1,`${id} ${name}: off, every frame moves`);
        assert(cuts.cuts[1]>=2&&cuts.cuts[1]<=4,`${id} ${name}: on, about three cuts in sixteen frames (${cuts.cuts[1]})`);
      }else assert(cuts.squash[1]<.02,`${id} ${name}: the landing squash has settled a second on, not ${cuts.squash[1]}`);
    }
    // The chapter's first creature: they expose on the same clock as the hero.
    const creature=await page.evaluate(async([FRAMES,TILE,CROP])=>{
      const w=playtest.world,g=playtest.game,sheet=document.getElementById('sheet'),ctx=sheet.getContext('2d');
      const e=g.level.enemies.find(e=>e.alive);if(!e)return null;const kind=e.kind||'clayling';
      // The game's own three.js, by the URL it was loaded from.
      const THREE=await import('/lib/three.module.js');
      // A bead over the creature would burst gold into the tiles.
      for(const c of g.level.coins)if(Math.abs(c.x-e.x)<2.5&&Math.abs(c.y-e.y)<3)c.taken=true;
      sheet.width=FRAMES*TILE.w;sheet.height=2*TILE.h+24;ctx.fillStyle='#222';ctx.fillRect(0,0,sheet.width,sheet.height);
      const cuts=[];
      for(const [row,on] of [[0,false],[1,true]]){
        w.stopMotion=on;
        // Keep the hero well away, so nothing but the creature is in frame.
        Object.assign(g.player,{x:e.x-12,y:g.level.spawn.y,vx:0,vy:0,groundId:null});
        w.syncVisible(g.level,e.x,true);
        for(let i=0;i<30;i++){for(let k=0;k<2;k++)g.tick(1/120,{});w.render(g,1/60);}
        // A skinned creature's mixer, or a sculpted one's pose, tells a cut.
        const view=w.enemyViews.get(e.id),read=()=>view.mixer?view.mixer.time:view.pose.rotation.toArray().join();let moved=0,last=null;
        // Frame the creature on its own bounds: kinds differ in where they hang.
        view.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(view.root,true),mid=box.getCenter(new THREE.Vector3()),tall=box.max.y-box.min.y;
        for(let i=0;i<FRAMES;i++){
          for(let k=0;k<2;k++)g.tick(1/120,{});
          w.setEditorCamera({x:e.x,y:mid.y,viewH:Math.max(2.6,tall*2.2)});
          w.render(g,1/60);
          const t=read();if(last!==null&&t!==last)moved++;last=t;
          const c=w.renderer.domElement,sx=(c.width-CROP.w)/2,sy=(c.height-CROP.h)/2;
          ctx.drawImage(c,sx,sy,CROP.w,CROP.h,i*TILE.w,row*TILE.h+24,TILE.w,TILE.h);
          ctx.strokeStyle='#111';ctx.strokeRect(i*TILE.w+.5,row*TILE.h+24.5,TILE.w-1,TILE.h-1);
        }
        cuts.push(moved);
      }
      ctx.fillStyle='#eee';ctx.font='13px sans-serif';
      ctx.fillText(`${kind}: ${FRAMES} consecutive frames at 60 fps — top: stop motion off (${cuts[0]} pose changes), bottom: on (${cuts[1]} cuts)`,8,16);
      w.stopMotion=false;return {kind,cuts};
    },[FRAMES,TILE,CROP]);
    if(creature){
      await page.locator('#sheet').screenshot({path:path.join(out,`${creature.kind}.png`)});
      results.push({id:creature.kind,name:'creature',off:creature.cuts[0],on:creature.cuts[1]});
      assert.equal(creature.cuts[0],FRAMES-1,`${creature.kind}: off, every frame moves`);
      assert(creature.cuts[1]>=2&&creature.cuts[1]<=4,`${creature.kind}: on, about three cuts (${creature.cuts[1]})`);
    }
    // Two consecutive exposures, close on the chest, for the boil.
    for(const [k,name] of [['a'],['b']].map((v,k)=>[k,v[0]])){
      await page.evaluate(async([k])=>{
        const w=playtest.world,g=playtest.game;document.getElementById('sheet').style.visibility='hidden';
        w.stopMotion=true;
        if(k===0){Object.assign(g.player,{x:g.level.spawn.x+.5,y:g.level.spawn.y,vx:0,vy:0,facing:1,groundId:'start'});for(let i=0;i<30;i++){g.tick(1/120,{});w.render(g,1/60);}}
        // Advance to the next exposure exactly.
        do{g.tick(1/120,{});g.tick(1/120,{});w.render(g,1/60);}while(!w.puppetClock.stepped);
        w.setEditorCamera({x:g.player.x,y:g.player.y+1.05,viewH:1.4});playtest.draw();
      },[k]);
      await page.screenshot({path:path.join(out,`${id}-boil-${name}.png`)});
    }
    await page.evaluate(()=>{document.getElementById('sheet').style.visibility='visible';playtest.world.stopMotion=false;});
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors,requests},null,2)+'\n');
  console.log(`stop-motion sheets → ${out}`);console.table(results);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
},{root,viewport:{width:1800,height:1000},page:{deviceScaleFactor:1}}).catch(e=>{console.error(e);process.exit(1);});
