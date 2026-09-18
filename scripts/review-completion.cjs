// Actual WebGL captures of the level-complete dioramas, one per chapter, with
// the real overlay on top of them — the wordmark, the results and the buttons
// are half the composition, so a capture without them tells you nothing about
// whether the diorama is framed.
//
//   node scripts/review-completion.cjs                 all five, desktop
//   node scripts/review-completion.cjs 0 4             only those chapters
//   COMPLETION_ROUND=2 node scripts/review-completion.cjs
//   COMPLETION_PORTRAIT=1 node scripts/review-completion.cjs
//
// Captures land in docs/completion-dioramas/round-<n>/chapter-<i>-<name>.png.
const fs=require('fs'),assert=require('assert/strict');
const {review,patchApp,PROJECT}=require('./support/review.cjs');
const root=process.env.REVIEW_SOURCE_ROOT||PROJECT;
const round=process.env.COMPLETION_ROUND||'1';
const out=`${PROJECT}/docs/completion-dioramas/round-${round}`;
const NAMES=['canyon','wildwood','caverns','quarter','dream'];
const only=process.argv.slice(2).filter(a=>/^\d+$/.test(a)).map(Number);
const chapters=only.length?only:[0,1,2,3,4];
const portrait=!!process.env.COMPLETION_PORTRAIT;
const viewport=portrait?{width:430,height:932}:{width:1672,height:941};

review(async({page,url,errors,requests})=>{
  fs.mkdirSync(out,{recursive:true});
  // The Soft Dream is hidden until ß is typed with the chapter list open. A
  // review is not going to type it, so the unlock is seeded straight into the
  // save the page reads on load.
  await page.addInitScript(()=>{
    try{localStorage.setItem('claybound-v1',JSON.stringify({labUnlocked:true,last:0,best:{},runs:{},customRuns:{},customBest:{},chapterSource:{}}));}catch{}
  });
  await patchApp(page,{root,expose:`window.playtest={manual:false,
    get game(){return game},get world(){return world},get completion(){return completionScene},
    begin,result,
    draw(){world.render(game,0);updateHUD(performance.now());}};`});
  await page.goto(process.env.REVIEW_URL||url);
  await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:180000});

  const report={};
  for(const index of chapters){
    // Walk the chapter's real goal platform into the bell with ordinary
    // simulation ticks, so the diorama is reached the way a player reaches it
    // and the completion record is the one the screen would really show.
    const reached=await page.evaluate(async index=>{
      playtest.manual=true;
      await playtest.begin(index,true,'original');
      const g=playtest.game,s=g.level.platforms.find(p=>p.goal);
      if(!s)throw new Error('chapter '+index+' has no goal platform');
      // The bell only counts once the chapter's own ending has happened: the
      // Wildwood's boss has to be beaten and the Dream's finale woken. A
      // capture is not going to play either, so both are granted outright.
      if(g.level.boss)g.level.boss.state='defeated';
      if(g.finale)g.finale.state='awake';
      Object.assign(g.player,{x:Math.max(s.x+.6,g.level.end-5.9),y:s.y,vx:0,vy:0,facing:1,groundId:s.id});
      g.sectionId=s.section;
      g.player.x=g.level.end-1.4;
      for(let i=0;i<400&&g.status!=='complete';i++)g.tick(1/60,{right:true});
      return {status:g.status,biome:g.level.biome,short:g.level.short,end:g.level.end,x:g.player.x,y:g.player.y};
    },index);
    assert.equal(reached.status,'complete',`chapter ${index} never rang the bell`);

    // result() is on a 750 ms timer so the victory pose can read first.
    await page.waitForFunction(()=>document.body.classList.contains('is-complete'),null,{timeout:15000});
    const live=await page.evaluate(()=>{
      const c=playtest.completion;
      if(!c?.active)return {diorama:false};
      // Settle the idle, the bell and the spun pieces before the shutter.
      for(let i=0;i<150;i++)c.render(1/60);
      const w=playtest.world.renderer.info.render;
      let meshes=0,triangles=0;
      c.view.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
      return {diorama:true,key:c.key,calls:w.calls,drawnTriangles:w.triangles,meshes,triangles:Math.round(triangles)};
    });
    assert.equal(live.diorama,true,`chapter ${index} fell back to the painted plate`);
    const name=`chapter-${index + 1}-${NAMES[index]}${portrait?'-portrait':''}`;
    await page.screenshot({path:`${out}/${name}.png`});
    report[name]={...reached,...live};
    console.log(`captured ${name}`,live.key,`${live.meshes} meshes / ${live.triangles} triangles / ${live.calls} draw calls`);
    // Leave the screen the way a player would, so the next chapter starts clean.
    await page.evaluate(()=>{playtest.completion.hide();document.body.classList.remove('is-complete','has-completion-diorama');});
  }

  fs.writeFileSync(`${out}/results.json`,JSON.stringify({round,viewport,report,errors,requests},null,2)+'\n');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('PASS completion diorama capture →',out);
},{root,viewport}).catch(e=>{console.error(e);process.exit(1);});
