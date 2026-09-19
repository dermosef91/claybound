// Frame the Sky-Sand Run's windwell ledge the way the atmosphere reference was
// painted: hero on 'last-well' under the mill, the sky-lift and its bricks to
// the right, three ranks of buttes and the cloud field behind. Captures the
// gameplay frame with HUD, and a HUD-less plate for colour sampling. Other
// platforms can be sampled too (REVIEW_SPOTS=start,arch-drop,summit) so the
// sky, the cloud field and the ranks are checked along the whole route;
// REVIEW_LEVEL picks another chapter. Two switches look into the depth pass:
// REVIEW_FORCE_COMPOSITE=1 skips its probe, and REVIEW_PROBE_DUMP=1 writes
// the offscreen backdrop target itself to <spot>-probe.png.
const fs=require('fs'),path=require('path');
const {review,patchApp,PROJECT}=require('./support/review.cjs');
// REVIEW_ROOT serves another checkout — the main one, say — for a before plate.
const root=process.env.REVIEW_ROOT||PROJECT,out=path.resolve(PROJECT,process.env.REVIEW_OUT||'docs/canyon-atmosphere');
const label=process.env.REVIEW_LABEL||'after',spots=(process.env.REVIEW_SPOTS||'last-well').split(',');
review(async({page,url,errors})=>{
  fs.mkdirSync(out,{recursive:true});
  await patchApp(page,{root,expose:'window.playtest={manual:false,get game(){return game},get world(){return world},begin,draw(){world.render(game,0);healthHUD.draw(game,0);updateHUD(performance.now());}};'});
  await page.goto(process.env.REVIEW_URL||url);
  await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
  if(process.env.REVIEW_TITLE){await page.waitForTimeout(1500);await page.screenshot({path:`${out}/${label}-title.png`});console.log(label,'title');return;}
  await page.evaluate(async([level,force])=>{window.forceComposite=force;playtest.manual=true;await playtest.begin(level,true,'original');},[+(process.env.REVIEW_LEVEL||0),!!process.env.REVIEW_FORCE_COMPOSITE]);
  const all={};
  for(const spot of spots){
    const stats=await page.evaluate((spot)=>{
      const w=playtest.world,g=playtest.game,L=g.level;
      const s=spot==='start'?null:L.platforms.find(p=>p.id===spot);
      if(s)Object.assign(g.player,{x:s.x+s.w-.9,y:s.y,vx:0,vy:0,groundId:s.id,facing:1});
      else Object.assign(g.player,{x:L.spawn.x,y:L.spawn.y,vx:0,vy:0,facing:1});
      w.setEditorCamera(null);w.cameraX=g.player.x;w.cameraY=g.player.y;
      if(window.forceComposite){w.render(g,0);if(w.citadelDepth)w.citadelDepth.verdict[w.biome]=true;}
      // Settle the camera and stream the views in, as the game would.
      for(let i=0;i<160;i++)w.render(g,.05);
      document.getElementById('hud').style.visibility='visible';playtest.draw();
      w.render(g,0);const info=w.renderer.info.render;
      let clouds=0;w.backRoot.traverse(o=>{if(o.name==='Ivory cloud')clouds++;});
      return {calls:info.calls,triangles:info.triangles,clouds,cameraX:+w.cameraX.toFixed(2),cameraY:+w.cameraY.toFixed(2),fog:'#'+w.scene.fog.color.getHexString(),fogNear:w.scene.fog.near,fogFar:w.scene.fog.far,depthPass:w.citadelDepth?{verdict:w.citadelDepth.verdict,probe:w.citadelDepth.probe}:null};
    },spot);
    if(process.env.REVIEW_PROBE_DUMP){
      const dataUrl=await page.evaluate(()=>{
        const w=playtest.world,d=w.citadelDepth;if(!d)return null;const t=d.target;
        const hidden=[w.levelRoot,w.fxRoot,w.character.root,w.character.shadow,w.depthRoot,d.quad,...w.backRoot.children.filter(o=>o.userData.sky)],vis=hidden.map(o=>o.visible);
        hidden.forEach(o=>o.visible=false);w.backRoot.visible=true;
        w.renderer.setRenderTarget(t);w.renderer.render(w.scene,w.camera);
        const calls=w.renderer.info.render.calls,buf=new Uint8Array(t.width*t.height*4);w.renderer.readRenderTargetPixels(t,0,0,t.width,t.height,buf);
        w.renderer.setRenderTarget(null);hidden.forEach((o,i)=>o.visible=vis[i]);
        const c=document.createElement('canvas');c.width=t.width;c.height=t.height;const ctx=c.getContext('2d'),img=ctx.createImageData(t.width,t.height);
        for(let y=0;y<t.height;y++)img.data.set(buf.subarray(y*t.width*4,(y+1)*t.width*4),(t.height-1-y)*t.width*4);
        ctx.putImageData(img,0,0);return JSON.stringify({calls,url:c.toDataURL('image/png')});
      });
      if(dataUrl){const {calls,url}=JSON.parse(dataUrl);fs.writeFileSync(`${out}/${label}-${spot}-probe.png`,Buffer.from(url.split(',')[1],'base64'));console.log('probe dump calls',calls);}
    }
    await page.screenshot({path:`${out}/${label}-${spot}.png`});
    await page.evaluate(()=>{document.getElementById('hud').style.visibility='hidden';playtest.draw();});
    await page.screenshot({path:`${out}/${label}-${spot}-plate.png`});
    all[spot]=stats;console.log(label,spot,JSON.stringify(stats));
  }
  fs.writeFileSync(`${out}/${label}-stats.json`,JSON.stringify({...all,errors},null,2)+'\n');
  if(errors.length)throw new Error('page errors: '+errors.join(' | '));
},{root});
