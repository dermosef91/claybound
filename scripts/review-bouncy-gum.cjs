// Real WebGL frames of the Clay Lab's bouncy clay — the formable slab (04), the
// lump on the bench (05) and, as the violet control, the buried bench (06) —
// at rest, from the play camera, stomped into a crater and pulled into a
// pillar, for matching the pink to the bubble-gum target. Not part of the
// check. Serves dist/ itself and drives the live game in headless Chrome
// through the same Playwright the other review scripts use.
//   [OUT=dir] [HEXES=e0508f,d94584] [ROUGH=.3,.34] [COAT=.12,.16] [FOLD=.07,.09]
//   [PLAYWRIGHT_MODULE=…] [CHROME_PATH=…] node scripts/review-bouncy-gum.cjs
// Frames land in docs/bouncy-gum/after/ by default (OUT=docs/bouncy-gum/before
// on the tree the change started from). Beside them, results.json holds the
// slab's tone bands — the mean colour of its darkest twentieth, its shadow,
// mid and light bands and its brightest twentieth — measured off the drawn
// frame the same way the target's were, so the two can be read side by side:
//   target   b33366  ce4478  e86092  f98ab5  fdc9e2
// Each HEXES/ROUGH/COAT/FOLD value is shot on its own with the rest at their
// baked values; none of it recompiles the shader, so a sweep is quick.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {review,patchApp,PROJECT}=require('./support/review.cjs');
const root=PROJECT,out=process.env.OUT||path.join(root,'docs/bouncy-gum/after');
const list=(name,parse)=>(process.env[name]||'').split(',').filter(Boolean).map(parse);
const sweep={hex:list('HEXES',s=>parseInt(s.replace(/^(0x|#)/,''),16)),rough:list('ROUGH',Number),coat:list('COAT',Number),fold:list('FOLD',Number)};
const TARGET={dark:'b33366',shadow:'ce4478',mid:'e86092',light:'f98ab5',bright:'fdc9e2'};
review(async({page,url,errors,requests})=>{
  fs.mkdirSync(out,{recursive:true});
  await patchApp(page,{root,during:'shapingControls.update();',expose:'window.playtest={manual:false,get game(){return game},get world(){return world},get input(){return input},begin,draw(){for(let i=0;i<20;i++)world.render(game,.05);healthHUD.draw(game,0);updateHUD(performance.now());shapingControls.update();},step(n,extra={}){for(let i=0;i<n;i++){game.tick(FIXED_DT,{...input,...extra});input.jumpPressed=false;input.stompPressed=false;}this.draw();}};'});
  await page.goto(url);await page.waitForFunction(()=>document.body.classList.contains('title-scene-ready'),null,{timeout:120000});
  // The lab stays hidden until ß is typed with the chapter list open.
  await page.locator('#chapters').click();await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'ß'})));await page.locator('[data-action="playground"]').click();
  await page.waitForFunction(()=>window.playtest?.game.level.playground&&document.getElementById('loading').classList.contains('hidden'),null,{timeout:60000});
  await page.waitForFunction(()=>playtest.world.character?.loaded,null,{timeout:60000});
  await page.evaluate(()=>{
    playtest.manual=true;
    // The title screen fades out on frames the held loop never runs, so it is
    // put away outright, with the loading card, the HUD, the station's card and
    // the unlock toast — the HUD update would show the card again on every draw.
    for(const id of ['menu','loading','hud','hint','toast'])document.getElementById(id).style.visibility='hidden';
    document.querySelector('.health-hud')?.style.setProperty('visibility','hidden');
    for(const id of ['touch-controls','desktop-controls','hint','chapter-intro','timer'])document.getElementById(id)?.classList.add('hidden');
    playtest.draw();
  });
  // Teleport to a station and stand the player on its clay at `offset` along it.
  const goTo=async(id,offset=null)=>{
    await page.evaluate(async([id,offset])=>{
      const {visitStation}=await import('/shaping.js');
      visitStation(playtest.game,id,{reset:true});
      const g=playtest.game,st=g.level.shaping.find(s=>s.id===id),s=g.level.platforms.find(q=>q.id===st.parts[0]);
      playtest.step(2);
      if(offset!==null){const {formHeight}=await import('/clay-form.js');Object.assign(g.player,{x:s.x+offset,y:s.y-s.h+formHeight(s.form,offset)+.02,vx:0,vy:0,groundId:null});playtest.step(3);}
      // A fresh arrival blinks invulnerable for a moment, and a held frame can
      // land on a blink's off tick, so the hero is never drawn: end it now.
      g.player.invuln=0;
      for(let i=0;i<40;i++)playtest.world.render(g,.05);
      playtest.draw();
    },[id,offset]);
    await page.waitForTimeout(300);
  };
  const form=async fn=>page.evaluate(async fn=>{const mod=await import('/clay-form.js');const g=playtest.game;return new Function('mod','g','playtest',`return (${fn})(mod,g,playtest)`)(mod,g,playtest);},fn.toString());
  // The slab fills the frame the way the target's does, seen with the same mild
  // downward tilt as play so its gloss catches the sun where a game frame would.
  const close=async id=>page.evaluate(async id=>{
    const w=playtest.world,g=playtest.game,st=g.level.shaping.find(s=>s.id===id),s=g.level.platforms.find(q=>q.id===st.parts[0]);
    const {formHeight}=await import('/clay-form.js');
    let top=0;for(let x=0;x<=s.w;x+=.25)top=Math.max(top,formHeight(s.form,x));
    w.setEditorCamera({x:s.x+s.w/2,y:s.y-s.h+top/2+.6,viewH:Math.max(7,s.w*.66,top*1.7)});
    playtest.draw();
    w.camera.position.y=w.cameraY+(w.theme.cameraElevation??1.25);w.camera.lookAt(w.cameraX,w.cameraY,0);w.renderer.render(w.scene,w.camera);
  },id);
  const play=async()=>page.evaluate(()=>{const w=playtest.world,g=playtest.game;w.setEditorCamera(null);for(let i=0;i<40;i++)w.render(g,.05);});
  // Tone bands of the clay's front face. The drawing buffer is cleared once a
  // frame is composited, so the framed view is drawn again and read in the same
  // task; the face's rectangle is projected through the camera and its pixels
  // sorted by luma into the five bands the target was measured in.
  const bands=async id=>page.evaluate(async id=>{
    const THREE=await import('/lib/three.module.js');
    const w=playtest.world,g=playtest.game,st=g.level.shaping.find(s=>s.id===id),s=g.level.platforms.find(q=>q.id===st.parts[0]);
    const {formHeight}=await import('/clay-form.js');
    const view=w.renderer.domElement,canvas=document.createElement('canvas');canvas.width=view.width;canvas.height=view.height;
    w.renderer.render(w.scene,w.camera);
    const ctx=canvas.getContext('2d');ctx.drawImage(view,0,0);
    const px=(x,y)=>{const v=new THREE.Vector3(x,y,1.75).project(w.camera);return [(v.x+1)/2*canvas.width,(1-v.y)/2*canvas.height];};
    // A rectangle inside the face: in from the rounded ends, below the lowest
    // point of the walking surface, above the foot.
    let top=Infinity;for(let x=.6;x<=s.w-.6;x+=.25)top=Math.min(top,formHeight(s.form,x));
    const [x0,y0]=px(s.x+.6,s.y-s.h+top-.45),[x1,y1]=px(s.x+s.w-.6,s.y-s.h+.35);
    const rect=[Math.round(Math.min(x0,x1)),Math.round(Math.min(y0,y1)),Math.round(Math.abs(x1-x0)),Math.round(Math.abs(y1-y0))];
    const data=ctx.getImageData(...rect).data,pixels=[];
    for(let i=0;i<data.length;i+=4)pixels.push([data[i],data[i+1],data[i+2]]);
    pixels.sort((a,b)=>(.2126*a[0]+.7152*a[1]+.0722*a[2])-(.2126*b[0]+.7152*b[1]+.0722*b[2]));
    const n=pixels.length,hex=v=>v.map(c=>Math.round(c).toString(16).padStart(2,'0')).join('');
    const mean=(a,b)=>{const s=[0,0,0];for(let i=a;i<b;i++)for(let k=0;k<3;k++)s[k]+=pixels[i][k];return hex(s.map(v=>v/Math.max(1,b-a)));};
    let white=0,sat=0;for(const p of pixels){const mx=Math.max(...p),mn=Math.min(...p);if(mn>235)white++;sat+=mx?(mx-mn)/mx:0;}
    return {rect,pixels:n,dark:mean(0,n*.05|0),shadow:mean(n*.05|0,n*.25|0),mid:mean(n*.25|0,n*.75|0),light:mean(n*.75|0,n*.95|0),bright:mean(n*.95|0,n),white:+(white/n).toFixed(4),saturation:+(sat/n).toFixed(3)};
  },id);
  const frames=[],measured={target:TARGET};
  const shoot=async(name,id,framing,measure=true)=>{
    await framing();await page.screenshot({path:path.join(out,name+'.png')});
    const entry={name};if(measure){const b=await bands(id);Object.assign(entry,b);measured[name]=b;}
    frames.push(entry);
  };
  // 04 · the slab at rest, close and from the play camera.
  await goTo('form',8);await shoot('04-form-rest','form',()=>close('form'));await shoot('04-form-play','form',play);
  // A real stomp into it: the crater is freshest one tick after the throw.
  await form((mod,g,pt)=>{const s=g.level.platforms.find(q=>q.id==='form-mass');Object.assign(g.player,{x:s.x+9,y:s.y+2.5,vx:0,vy:-24,groundId:null,stomping:true});pt.step(6);pt.step(8);});
  await shoot('04-form-crater','form',()=>close('form'));
  // A pillar pulled through the squash cap, so the folds are seen stretched.
  await goTo('form',3);await form((mod,g,pt)=>{const s=g.level.platforms.find(q=>q.id==='form-mass');for(let i=0;i<40;i++)mod.pullForm(s.form,9,0,.3);pt.step(10);});
  await shoot('04-form-pillar','form',()=>close('form'));
  // 05 · the lump, and 06 · the violet control, which must not change.
  await goTo('lump',7);await shoot('05-lump-rest','lump',()=>close('lump'));
  await goTo('dig',8);await shoot('06-dig-control','dig',()=>close('dig'));
  // The sweep, each value on its own against the baked rest.
  const material=await page.evaluate(()=>{const m=playtest.world.mat.magicBlockBouncy;return {type:m.type,color:m.color.getHex(),roughness:m.roughness,clearcoat:m.clearcoat,clearcoatRoughness:m.clearcoatRoughness,bumpScale:m.bumpScale,fold:m.userData.magic?.fold.value,program:m.customProgramCacheKey()};});
  if(Object.values(sweep).some(v=>v.length)){
    await goTo('form',8);
    const set=async fn=>page.evaluate(async fn=>{const m=playtest.world.mat.magicBlockBouncy,views=await import('/shaping-views.js');new Function('m','views',`(${fn})(m,views)`)(m,views);},fn.toString());
    const restore=()=>set((m,views)=>{m.color.setHex(m.userData.magicBase??=m.color.getHex());m.emissive.setHex(m.color.getHex());m.userData.magic?.sheen.value.copy(views.gumSheen(m.color));m.roughness=m.userData.magicRough??=m.roughness;m.clearcoatRoughness=m.userData.magicCoat??=m.clearcoatRoughness;if(m.userData.magic)m.userData.magic.fold.value=m.userData.magicFold??=m.userData.magic.fold.value;});
    await restore();
    const tag=(k,v)=>k==='hex'?v.toString(16).padStart(6,'0'):String(Math.round(v*1000)).padStart(3,'0');
    for(const [k,values] of Object.entries(sweep))for(const v of values){
      await restore();
      if(k==='hex')await page.evaluate(async hex=>{const m=playtest.world.mat.magicBlockBouncy,views=await import('/shaping-views.js');m.color.setHex(hex);m.emissive.setHex(hex);m.userData.magic?.sheen.value.copy(views.gumSheen(m.color));},v);
      else if(k==='rough')await page.evaluate(v=>{playtest.world.mat.magicBlockBouncy.roughness=v;},v);
      else if(k==='coat')await page.evaluate(v=>{playtest.world.mat.magicBlockBouncy.clearcoatRoughness=v;},v);
      else await page.evaluate(v=>{const m=playtest.world.mat.magicBlockBouncy;if(m.userData.magic)m.userData.magic.fold.value=v;},v);
      await shoot(`sweep-${k}-${tag(k,v)}`,'form',()=>close('form'));
    }
    await restore();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({material,frames,errors,requests},null,2)+'\n');
  console.log(`bouncy clay → ${out}`);console.log('material',material);
  console.table(Object.entries(measured).map(([name,b])=>({name,dark:b.dark,shadow:b.shadow,mid:b.mid,light:b.light,bright:b.bright,white:b.white,sat:b.saturation})));
  assert.deepEqual(errors,[],'no page errors');assert.deepEqual(requests,[],'no failed requests');
},{root,viewport:{width:1500,height:850},page:{deviceScaleFactor:1}}).catch(e=>{console.error(e);process.exit(1);});
