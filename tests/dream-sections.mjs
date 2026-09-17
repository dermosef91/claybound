// One section of The Soft Dream at a time, on its own: the checks a section
// author runs while authoring, before the full chapter's checks ever see it.
//
//   node tests/dream-sections.mjs                 every section
//   SECTION=garden node tests/dream-sections.mjs  one (or a comma list)
//   PILOT=0 …                                     skip the pilot search
//
// Each section is built into a mini chapter by soloSection (dist/routes/
// dream.js): a plain `start` deck, the section, a plain goal deck. Then:
//   1. it builds; ids are prefixed; the entry/exit decks keep the contract
//   2. unique ids, one goal, the previousDistance ratio, flowers over ledges
//   3. every route, detour and recovery link crosses under real physics
//   4. every clay station keeps the chapter clay rules, and its bypass is
//      impossible while it is unworked
//   5. the deterministic pilot plays the section through with no deaths
//   6. the layout audit's notes (advisory)
//   7. a CPU World build: clay materials, streaming limits, draw estimate
//   8. the section's budgets, printed
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/lib/three.module.js';
import {Game,FIXED_DT as dt,RULES} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {MODULES,soloSection} from '../dist/routes/dream.js';
import {World} from '../dist/world.js';
import {createHero,attachHero} from '../dist/hero.js';
import {createCaveLights} from '../dist/cave-lighting.js';
import {solveFormStation} from '../dist/clay-rules.js';
import {formVolume} from '../dist/clay-form.js';
import {readPlayer} from './load-player.mjs';
import {attachClay} from './load-clay.mjs';
import {attachDream} from './load-dream.mjs';
import {crossing} from './routes.mjs';
import {auditLevel} from './layout-audit.mjs';
import {searchRoute} from './playthroughs.mjs';

const INDEX=LEVELS.findIndex(L=>L.biome==='dream');
assert(INDEX>=0,'the dream is a registered chapter');
const wanted=(process.env.SECTION||'').split(',').map(s=>s.trim()).filter(Boolean);
const modules=wanted.length?wanted.map(key=>{
  const m=MODULES.find(m=>m.key===key);
  if(!m)throw new Error(`unknown section ${key} (known: ${MODULES.map(m=>m.key).join(', ')})`);
  return m;
}):MODULES;
const PILOT=process.env.PILOT!=='0';
// Per-section rendering budget from the build contract.
const DRAW_BUDGET=200,TRI_BUDGET=400000;
const warn=(...a)=>console.log('WARN',...a);
const volume=(q,role)=>q.w*((q.h??0)+(role==='ramp'?(q.slope||0)/2:0));
const standable=s=>!['wall','switch'].includes(s.kind);

// A World with the renderer stubbed, the way tests/scene.mjs builds one. The
// dream's only models are the orchard's planets and saucer bowls and the
// parade's hat, so the hero, the clay surface and those are all it needs.
async function cpuWorld(){
  const w=Object.create(World.prototype);
  w.scene=new THREE.Scene();w.scene.background=new THREE.Color();w.scene.fog=new THREE.Fog(0,32,90);w.bump=new THREE.Texture();w.mat={};
  for(const key of ['blue','blueDark','blueLight','orange','orangeLight','cream','rope','dark','gold','ghost','shadow'])w.mat[key]=new THREE.MeshStandardMaterial({color:0xffffff,transparent:key==='shadow'});
  w.hemi=new THREE.HemisphereLight();w.sun=new THREE.DirectionalLight();w.fill=new THREE.DirectionalLight();w.torchLights=createCaveLights();
  w.camera=new THREE.OrthographicCamera(-6,6,3.3,-3.3,.1,160);
  w.renderer={render(){},setRenderTarget(){},getDrawingBufferSize(v){return v.set(1280,720);},shadowMap:{autoUpdate:true},capabilities:{getMaxAnisotropy(){return 4;}}};
  w.levelRoot=new THREE.Group();w.backRoot=new THREE.Group();w.fxRoot=new THREE.Group();w.scene.add(w.levelRoot,w.backRoot,w.fxRoot);w.time=0;w.character=createHero(w);w.scene.add(w.character.root);
  const data=async name=>JSON.parse(await readFile(new URL('../dist/assets/'+name,import.meta.url)));
  attachHero(w,await readPlayer(),await data('player-motion.json'),await data('player-idle.json'));
  await attachClay(w);
  await attachDream(w);
  return w;
}
// What the frame at x would submit: meshes under levelRoot and backRoot whose
// bounding sphere meets the camera's frustum, the way tests/perf.mjs counts.
// A CPU estimate, not a GPU measurement.
function submitted(w){
  w.camera.left=-w.viewW/2;w.camera.right=w.viewW/2;w.camera.top=w.viewH/2;w.camera.bottom=-w.viewH/2;w.camera.updateProjectionMatrix();
  w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld(true);
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(w.camera.projectionMatrix,w.camera.matrixWorldInverse));
  const sphere=new THREE.Sphere();let draws=0,triangles=0,back=0;
  const walk=(o,isBack)=>{
    if(!o.visible)return;
    if(o.isMesh){
      if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
      sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      if(!o.frustumCulled||frustum.intersectsSphere(sphere)){
        draws++;const index=o.geometry.index,position=o.geometry.attributes.position;
        const t=Math.floor((index?index.count:position.count)/3);triangles+=t;if(isBack)back+=t;
      }
    }
    for(const c of o.children)walk(c,isBack);
  };
  walk(w.levelRoot,false);walk(w.backRoot,true);
  return {draws,triangles,back};
}

const w=await cpuWorld();
let sections=0,failures=[];
for(const module of modules){
  const began=performance.now();
  console.log(`\n== ${module.key} — ${module.name} (${module.length} units)`);
  try{
    // --- 1. it builds, and keeps the section contract ----------------------------
    const L=soloSection(module);
    const section=L.dreamSections[0];
    assert.equal(section.key,module.key);assert.equal(section.x,0,'a solo section starts at 0');
    const goalId=`${module.key}-goal`;
    const own=L.platforms.filter(s=>s.id!=='start'&&s.id!==goalId);
    for(const s of own)assert(s.id.startsWith(module.key+'-'),`platform id ${s.id} is not prefixed ${module.key}-`);
    for(const st of L.shaping)assert(st.id.startsWith(module.key+'-'),`station id ${st.id} is not prefixed ${module.key}-`);
    for(const list of ['winds','triggers'])for(const item of L[list]||[])if(item.id!==undefined&&!String(item.id).startsWith(module.key+'-'))warn(`${list} id ${item.id} is not prefixed ${module.key}-`);
    const at=id=>L.platforms.find(s=>s.id===id);
    const entry=at(module.entryId),exit=at(module.exitId);
    assert(entry&&exit,'entryId and exitId name platforms');
    assert.equal(entry.x,0,'the entry deck starts at local 0');assert.equal(entry.y,0,'the entry deck is at y 0');
    assert(entry.w>=6,`the entry deck is a safe ${entry.w}-wide deck (needs ≥6)`);
    if(entry.checkpoint===undefined)warn(`the entry deck ${entry.id} carries no checkpoint (fine only for the chapter's first section)`);
    assert(Math.abs(exit.x+exit.w-module.length)<1e-9,`the exit deck ${exit.id} runs out at ${exit.x+exit.w}, not at length ${module.length}`);
    if(!exit.goal)assert.equal(exit.y,0,'the exit deck is at y 0 so the next section abuts it');
    console.log(`PASS builds: ${own.length} platforms, ${L.routeLinks.length} route links, end ${L.end}`);

    // --- 2. ids, goal, ratio, flowers -----------------------------------------------
    assert.equal(new Set(L.platforms.map(s=>s.id)).size,L.platforms.length,'platform ids are unique');
    const goals=L.platforms.filter(s=>s.goal);assert.equal(goals.length,1,'exactly one goal deck');assert(goals[0].w>=2.5,'the goal deck is at least 2.5 wide');
    assert(Math.abs((L.end-L.spawn.x)/L.previousDistance-.3)<.005,'previousDistance keeps the .3 ratio');
    assert(Math.abs(goals[0].x+goals[0].bellX-L.end)<1e-6);
    for(const c of L.stamps){
      const under=L.platforms.find(s=>s.optional&&c.x>=s.x-1&&c.x<=s.x+s.w+1&&c.y>s.y&&c.y<=s.y+2.6);
      assert(under,`flower at (${c.x}, ${c.y}) has no optional ledge within 2.6 under it`);
      assert(L.detours.some(d=>d.some(l=>l.to===under.id)),`flower ledge ${under.id} is not reached by any detour`);
    }
    const links=[...L.routeLinks,...L.detours.flat(),...L.recoveries.flat()];
    for(const link of links)assert(at(link.from)&&at(link.to),`link ${link.from} → ${link.to} names a platform that does not exist`);
    console.log(`PASS ids unique, one goal, ratio .3, ${L.stamps.length} flower${L.stamps.length===1?'':'s'} over optional ledges`);

    // --- 3. every link crosses -------------------------------------------------------
    let crossed=0;const unreachable=[];
    for(const link of links){if(crossing(INDEX,link,{source:L}))crossed++;else unreachable.push(`${link.from} → ${link.to} (${link.mode})`);}
    assert.equal(unreachable.length,0,`unreachable: ${unreachable.join('; ')}`);
    console.log(`PASS ${crossed} crossings under real physics (${L.routeLinks.length} route, ${L.detours.flat().length} detour, ${L.recoveries.flat().length} recovery)`);

    // --- 4. clay stations ------------------------------------------------------------
    for(const station of L.shaping){
      assert.equal(station.parts.length,1,`${station.id} moves ${station.parts.length} pieces from one input`);
      const piece=at(station.parts[0]);assert(piece?.shape,`${station.id} has its clay`);
      assert.notEqual(piece.clayRole,'landing',`${piece.id} is drawn as a stemmed cap, which loses its clay on screen`);
      assert(!station.lift,`${station.id} moves nothing but its own clay`);
      assert(!station.rule||station.rule==='form',`${station.id} carries a rule that belongs in the lab`);
      if(station.rule==='form'){
        assert.equal(piece.clayRole,'mass');assert(station.free,`${station.id} sits free on its footing`);
        assert(Array.isArray(station.clump)&&station.clump.length>=2&&station.solution?.length,`${station.id} has a clump and a solution`);
        const g=new Game();g.start(INDEX,L);
        const live=g.level.shaping.find(s=>s.id===station.id),f=solveFormStation(live,g.level.platforms.find(p=>p.id===piece.id),{dt});
        assert(Math.abs(formVolume(f)-f.volume)<1e-7,`${piece.id} keeps its volume exactly when solved`);
        assert.equal(live.amount,1,`${station.id}'s solution shapes it fully`);
      }else{
        const before=volume(piece.shape.from,piece.clayRole),after=volume(piece.shape.to,piece.clayRole);
        assert(Math.abs(after-before)/before<=.1,`${piece.id} goes from ${before.toFixed(2)} to ${after.toFixed(2)} units of clay`);
        assert(piece.shape.to.w>=piece.shape.from.w,`${piece.id} narrows (to.w must be ≥ from.w)`);
        for(const amount of [.1,.3,.5,.7,.9]){
          const g=new Game();g.start(INDEX,L);
          const live=g.level.shaping.find(s=>s.id===station.id);live.amount=live.target=amount;live.announced=true;g.tick(dt,{});
          const now=volume(g.level.platforms.find(p=>p.id===piece.id),piece.clayRole);
          assert(Math.abs(now-before)/before<=.1,`${piece.id} holds ${now.toFixed(2)} units of clay at ${amount} worked, not ${before.toFixed(2)}`);
        }
      }
      if(station.auto){console.log(`PASS ${station.id} (self-working on ${station.auto}) keeps the clay rules`);continue;}
      // A purple station: hint and cue, and a bypass that is impossible unworked.
      assert(typeof station.hint==='string'&&station.hint,`${station.id} needs a hint`);
      if(!Number.isFinite(station.cueX))warn(`${station.id} has no cueX (the hand cue falls back to the station's middle)`);
      const unworked=other=>other.id!==station.id;
      const ground=L.platforms.filter(s=>standable(s)&&s.id!==piece.id&&!s.optional);
      const before=ground.filter(s=>s.x+s.w<=piece.x+.01).sort((a,b)=>(b.x+b.w)-(a.x+a.w))[0];
      const after=ground.filter(s=>s.x>=piece.x+piece.w-.01).sort((a,b)=>a.x-b.x)[0];
      const bypass=station.bypass??(before&&after?{from:before.id,to:after.id,mode:'jump'}:null);
      assert(bypass,`${station.id}: no ground on both sides of ${piece.id} to judge its bypass (author station.bypass={from,to})`);
      assert.equal(crossing(INDEX,bypass,{shaped:unworked,source:L}),null,`${bypass.from} → ${bypass.to} is crossable without working ${station.id}, so that clay is optional`);
      if(!station.rideable)assert.equal(crossing(INDEX,{from:bypass.from,to:piece.id,mode:'jump'},{shaped:unworked,source:L}),null,`the unworked ${piece.id} can be landed on from ${bypass.from} (mark the station rideable:true if that is meant)`);
      const spans=(a,b)=>(a.x+a.w<=piece.x+.01&&b.x>=piece.x+piece.w-.01)||(b.x+b.w<=piece.x+.01&&a.x>=piece.x+piece.w-.01);
      for(const link of L.routeLinks)if(spans(at(link.from),at(link.to)))assert.equal(crossing(INDEX,link,{shaped:unworked,source:L}),null,`${link.from} → ${link.to} crosses ${piece.id}'s range with ${station.id} unworked`);
      const touching=L.routeLinks.filter(l=>l.from===piece.id||l.to===piece.id);
      if(touching.length<2)warn(`${station.id}: the route steps onto ${piece.id} through ${touching.length} link(s); most stations are walked over in and out`);
      console.log(`PASS ${station.id}: one piece, volume held, ${bypass.from} → ${bypass.to} impossible unworked`);
    }
    if(!L.shaping.length)console.log('PASS no clay stations (nothing to hold to the clay rules)');

    // --- 5. the pilot -------------------------------------------------------------------
    if(PILOT){
      const t0=performance.now(),run=searchRoute(INDEX,L,{source:L});
      assert(!run.blocked,`the pilot is blocked after ${run.furthest} of ${L.routeLinks.length} crossings (${run.attempts} input candidates)`);
      const g=run.g;assert.equal(g.status,'complete','the pilot rings the bell');assert.equal(g.deaths,0,'the pilot dies on the way');
      const replay=new Game();replay.start(INDEX,L);for(const input of run.controls)replay.tick(dt,input);
      assert.equal(replay.status,'complete');assert.equal(replay.deaths,0);assert.equal(replay.coins,g.coins);
      console.log(`PASS pilot: ${g.elapsed.toFixed(1)} s of play, ${run.controls.length} frames, ${g.coins}/${L.coins.length} beads, ${run.attempts} candidates, deterministic replay (${((performance.now()-t0)/1000).toFixed(1)} s search)`);
    }else console.log('SKIP pilot (PILOT=0)');

    // --- 6. the layout audit --------------------------------------------------------------
    const notes=auditLevel(L,INDEX);
    console.log(`AUDIT ${notes.length?notes.length+' notes':'clean'}`);for(const n of notes)console.log('  ·',n);

    // --- 7. a CPU World build -------------------------------------------------------------
    {
      const g=new Game();g.start(INDEX,L);w.build(g.level,INDEX,L.spawn.x);
      let solid=0;
      w.levelRoot.traverse(o=>{
        if(!o.isMesh||!o.material.isMeshStandardMaterial||o.material.transparent)return;
        assert(o.material.userData.clay,`${o.name||o.parent?.name||'a mesh'} uses a material without the clay surface`);solid++;
      });
      const geometry=new Set();w.scene.traverse(o=>{if(o.isMesh)geometry.add(o.geometry);});
      for(const geo of geometry)for(const attribute of ['position','normal'])assert(geo.attributes[attribute].array.every(Number.isFinite),'geometry is finite');
      let maxPlatforms=0,maxViews=0,estimate=null;
      for(const x of [section.x+8,section.x+section.length/2,section.x+section.length-4,L.end,section.x+8]){
        const floor=g.level.platforms.find(s=>x>=s.x&&x<=s.x+s.w);
        Object.assign(g.player,{x,y:floor?.y??0,vx:0,vy:0,groundId:floor?.id??null});
        w.syncVisible(g.level,x,true);w.cameraX=x;w.cameraY=(floor?.y??0)+2;w.render(g,1/60);
        assert(w.camera.position.toArray().every(Number.isFinite));
        maxPlatforms=Math.max(maxPlatforms,w.platforms.size);maxViews=Math.max(maxViews,w.streamViews.size);
        assert(w.platforms.size<45,'streaming retains only nearby platforms');assert(w.streamViews.size<180,'render region must not grow with level length');
        estimate=submitted(w);
      }
      const props=[...w.streamViews.keys()].filter(k=>k.startsWith('dream:')).length;
      console.log(`PASS scene: ${solid} clay surfaces, max ${maxPlatforms} platforms / ${maxViews} views streamed, ${props} section props near the entry, ${w.dreamLeaners.length} leaners, ${w.parallax.length} parallax layers`);
      const over=estimate.draws>DRAW_BUDGET||estimate.triangles>TRI_BUDGET;
      console.log(`${over?'WARN':'COST'} frame at x ${section.x+8}: ~${estimate.draws} draws, ~${estimate.triangles} triangles (${estimate.back} in the backdrop); budget ${DRAW_BUDGET} / ${TRI_BUDGET}`);
    }

    // --- 8. budgets ------------------------------------------------------------------------
    const stations=L.shaping.filter(s=>!s.auto).length,autos=L.shaping.length-stations;
    console.log(`BUDGET platforms ${own.length} · enemies ${L.enemies.length} · hazards ${L.hazards.length} · beads ${L.coins.length} · flowers ${L.stamps.length} · checkpoints ${own.filter(s=>s.checkpoint!==undefined).length} · stations ${stations}${autos?` (+${autos} self-working)`:''} · triggers ${(L.triggers||[]).length} · winds ${(L.winds||[]).length}`);
    console.log(`OK ${module.key} in ${((performance.now()-began)/1000).toFixed(1)} s`);
    sections++;
  }catch(err){
    failures.push(module.key);
    console.log(`FAIL ${module.key}: ${err.message.split('\n')[0]}`);
    if(process.env.STACK)console.log(err.stack);
  }
}
console.log(`\n${sections} of ${modules.length} sections pass${failures.length?`; failing: ${failures.join(', ')}`:''}`);
if(failures.length)process.exitCode=1;
