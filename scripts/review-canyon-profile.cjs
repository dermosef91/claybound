// Render the canyon as one wide strip, the way the chapter's profile is
// judged: plateau, descent, riverbed clay, the long climb, the summit and
// the ropeway down to the bell. Tiles are stitched by tools/stitch-strip.py.
const fs=require('fs'),path=require('path');
const {review,patchApp,PROJECT}=require('./support/review.cjs');
const root=PROJECT,out=path.resolve(root,process.env.REVIEW_OUT||'docs/canyon-reshape');
const INDEX=0;
// The whole chapter, plus a margin at each end.
const FROM=Number(process.env.FROM??-14),TO=Number(process.env.TO??362);
const VIEW_H=Number(process.env.VIEW_H??44),CENTER_Y=Number(process.env.CENTER_Y??16);

review(async({page,url,errors})=>{
  fs.mkdirSync(out,{recursive:true});
  await patchApp(page,{root,expose:'window.playtest={manual:false,get game(){return game},get world(){return world},get saved(){return saved},begin,draw(){world.render(game,0);},step(n){for(let i=0;i<n;i++)game.tick(FIXED_DT,input);world.render(game,0);}};'});
  await page.goto(process.env.REVIEW_URL||url);
  await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
  await page.evaluate(async i=>{playtest.manual=true;await playtest.begin(i,true,'original');},INDEX);
  const loaded=await page.evaluate(()=>({index:playtest.game.index,short:playtest.game.level.short,biome:playtest.game.level.biome}));
  if(loaded.index!==INDEX)throw new Error('expected chapter '+INDEX+', got '+loaded.index+' ('+loaded.short+')');
  console.log('rendering',loaded.short,'-',loaded.biome);

  // A picture of the ride itself: stand on the trolley, let it run, and look
  // at it from alongside.
  if(process.env.RIDE){
    const at=Number(process.env.RIDE);
    const where=await page.evaluate(seconds=>{
      const w=playtest.world,g=playtest.game,t=g.level.platforms.find(s=>s.kind==='zip');
      Object.assign(g.player,{x:t.x+t.w/2,y:t.y,vx:0,vy:0,groundId:t.id,coyote:.1});
      playtest.step(Math.round(seconds*120));
      w.syncVisible(g.level,t.x,true);
      w.setEditorCamera({x:t.x+2,y:t.y+1,viewH:22});
      for(const id of ['hud','menu','loading'])document.getElementById(id).style.display='none';
      w.render(g,0);w.renderer.render(w.scene,w.camera);
      return {x:t.x.toFixed(2),y:t.y.toFixed(2),ground:g.player.groundId,deaths:g.deaths};
    },at);
    console.log('ride at',at+'s:','trolley',where.x+','+where.y,'rider on',where.ground,'deaths',where.deaths);
    await page.screenshot({path:`${out}/ride-${at}.png`});
    return;
  }
  const viewport=page.viewportSize(),viewW=VIEW_H*viewport.width/viewport.height;
  const tiles=Math.ceil((TO-FROM)/viewW);
  for(let i=0;i<tiles;i++){
    const x=FROM+viewW*(i+.5);
    await page.evaluate(({x,y,viewH})=>{
      const w=playtest.world,g=playtest.game;
      // Stream the chapter in around the camera, not around the spawn, and
      // keep the hero and the HUD out of a picture about terrain.
      Object.assign(g.player,{x,y,vx:0,vy:0});
      w.syncVisible(g.level,x,true);
      w.setEditorCamera({x,y,viewH});
      w.render(g,0);w.character.root.visible=false;
      // The frame loop is held for the review, so the title and loading
      // overlays never dismiss themselves. This is a picture of terrain.
      for(const id of ['hud','menu','loading'])document.getElementById(id).style.display='none';
      w.renderer.render(w.scene,w.camera);
    },{x,y:CENTER_Y,viewH:VIEW_H});
    await page.screenshot({path:`${out}/tile-${String(i).padStart(2,'0')}.png`});
  }
  fs.writeFileSync(out+'/strip.json',JSON.stringify({index:INDEX,from:FROM,to:TO,viewH:VIEW_H,centerY:CENTER_Y,viewW,tiles},null,2)+'\n');
  const failures=errors.filter(e=>!/favicon/.test(String(e)));
  if(failures.length)throw new Error('page errors: '+failures.join(' | '));
  console.log(`rendered ${tiles} tiles of ${viewW.toFixed(1)} units into ${out}`);
});
