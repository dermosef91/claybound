import * as THREE from './lib/three.module.js';
import {createDreamView,animateDreamViews} from './dream-views.js';
import {dreamVisual} from './dream/index.js';
import {dreamSectionAt,sectionDecks} from './dream/support.js';
export {dreamSectionAt,sectionDecks};
// The Soft Dream's biome module: the theme the shared materials start from,
// the terrain and backdrop stand-ins, and the per-frame work the chapter adds
// to the renderer — a palette that cross-fades with the player's x, a camera
// roll/zoom list, props that lean toward the player, and the hook through
// which the dream's own platform views (dream-views.js) are built and animated.
// Everything here is render-only: the simulation never reads any of it.
//
// Each section has a visual module of its own (dist/dream/<key>.js, listed in
// dist/dream/index.js). This file finds a platform's section by x through
// L.dreamSections — the table the assembler attaches — and offers the module
// its deck dressing, its far scenery, its streamed props and a per-frame
// hook, falling back to the chapter's defaults for anything it declines.

// The section a chapter x belongs to and its visual module, if any.
function visualAt(L,x){
  const section=dreamSectionAt(L,x);
  return {section,visual:section?dreamVisual(section.key):null};
}

const rand=n=>{const v=Math.sin(n*127.1+87.3)*43758.5453;return v-Math.floor(v);};
const WHITE=new THREE.Color(0xffffff);
// The chapter opens on the garden's pastel palette, so the theme the shared
// materials are tinted with at build is that palette spelt out in theme slots.
// `top` has to differ from every other chapter's (tests/scene.mjs holds each
// chapter to its own terrain palette).
export const THEME_DREAM={
  terrain:0xb9a3dc,terrain2:0x907fac,top:0xa9e4c8,bark:0x76a08c,barkLight:0xffd6e8,foliage:0xa9e4c8,leafLight:0xffe6f1,vine:0x76a08c,
  back:0xd9c8ee,back2:0xb8aaca,accent:0xffd6e8,water:0xd9c8ee,rope:0xe8d3f2,dust:0xffe6f1,
  skyLight:0xf1eaf9,groundLight:0x534962,sun:0xfff0e0,sunPower:3,ambient:2.2,fill:0xd8cdf3,fillPower:.7,cameraElevation:1.7
};

// --- terrain -----------------------------------------------------------------
// A stone deck: the section's own dressing if its visual module claims it
// (dress() returned true), else the chapter's rolled slab. Flags and the bell
// are placed exactly as the generic terrain does, so checkpoints and the goal
// need nothing extra from a section author.
export function buildDreamTerrain(w,s,g){
  const {section,visual}=visualAt(w.currentLevel,s.x);
  if(visual?.dress?.(w,s,g,section)!==true)rolledSlab(w,s,g);
  if(s.checkpoint)w.flag(s.checkpoint-s.x,.05,g,.83,s.id);
  if(s.goal)w.makeBell(g,s.bellX??s.w-3.5,.1);
}
// A chunky rolled slab: three softly rounded rows narrowing downward under the
// walkable cap, with the cap's ends curled up into lips so a deck reads as a
// sheet of Play-Doh rolled at both edges.
export function rolledSlab(w,s,g){
  const width=s.w,depth=3.4,rows=3,rowH=10.4/rows;
  for(let row=0;row<rows;row++){
    const inset=row*.22;
    w.box(width-inset*2+.1,rowH+.3,depth-row*.12,row===1?'terrain2':'terrain',g,width/2,-.18-(row+.5)*rowH,-.04-row*.05,.55);
  }
  w.box(width+.14,.49,3.6,'top',g,width/2,-.18,0,.22);
  // Each end curls up in three diminishing rolls, the way a rolled sheet ends.
  for(const x of [.25,width-.25]){
    w.ball(.6,.44,1.72,'top',g,x,-.04,.12);
    w.ball(.4,.3,1.3,'top',g,x,.3,.32);
    w.ball(.24,.2,.9,'accent',g,x,.5,.52);
  }
  // Loose pebbles of clay rest on the deck behind the walk line, and the
  // underside sags into a few soft drips where the sheet was lifted warm.
  for(let i=0;i<Math.max(2,Math.round(width/3));i++){
    const x=1.2+rand(i*5+s.x)*(width-2.4),size=.55+rand(i+s.x*.7)*.5;
    w.ball(size*.5,size*.36,size*.42,i%2?'accent':'terrain2',g,x,.02+size*.3,-1.15-rand(i+s.x)*.3);
  }
  for(let i=0;i<Math.max(3,Math.round(width/2));i++){
    const x=.9+rand(i*11+s.x)*(width-1.8),len=.45+rand(i*2+s.x)*.7;
    w.ball(.3,len,.28,'terrain',g,x,-3.75-len*.5,1.1+rand(i+s.x)*.3);
  }
  // A fringe of thumb-pressed beads along the front edge, and pressed pebbles
  // down the face at two depths, so a slab reads as handled clay rather than
  // a smooth block. (tests/scene.mjs also expects a chapter's decks to carry a
  // fair number of treated clay surfaces near the spawn.)
  for(let i=0;i<Math.ceil(width/.62);i++){
    const x=.55+i*.62;if(x>width-.45)continue;
    w.ball(.34,.13+rand(i+s.x)*.07,.16,i%3===1?'accent':'top',g,x,-.3,1.7);
  }
  for(let i=0;i<Math.max(3,Math.round(width/1.4));i++){
    const x=.7+rand(i*7+s.x)*(width-1.4),y=-1.3-rand(i*3+s.x)*7;
    w.ball(.38+rand(i+s.x)*.22,.28,.2,i%2?'terrain2':'accent',g,x,y,1.6+(i%3)*.03);
  }
}

// --- backdrop ----------------------------------------------------------------
function group(parent,name,x=0,y=0,z=0){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;}
// Far scenery a section module places by WORLD x, without the wrapping math.
// `at(factor)` is one parallax group per factor (shared by every section that
// asks for it), registered with a repeat so large it never wraps; `place(
// group, worldX, y, z)` adds a child at the layer-local x (worldX*factor), so
// the child stands at worldX when the camera is there and drifts at the
// layer's rate as it moves. animateEnvironment reads a layer's children once,
// so everything has to be placed at build — which is when backdrop() runs.
export function dreamLayers(w){
  const groups=new Map();
  const at=(factor,{heightFollow}={})=>{
    const key=factor.toFixed(3);
    if(!groups.has(key)){
      const g=group(w.backRoot,`Dream section layer ×${key}`);g.userData.factor=factor;
      w.parallax.push({group:g,factor,heightFollow:heightFollow??Math.min(1,.5+factor*.8),repeat:1e6});
      groups.set(key,g);
    }
    return groups.get(key);
  };
  const place=(layer,worldX,y=0,z=-30)=>{
    const factor=layer?.userData?.factor;
    if(factor===undefined)throw new Error('layers.place wants a group from layers.at(factor)');
    return group(layer,'Dream backdrop item',worldX*factor,y,z);
  };
  return {at,place};
}
// Placeholder parallax: two layers of large soft blobs and a few tall rounded
// columns, and a ring of flat accent swirls high in the sky. Every layer
// repeats every 150 units, so items are laid inside 0..150. The columns are
// registered as leaners (they turn toward the player) and the swirls spin.
// Then every section's module adds its own far scenery through dreamLayers.
export function buildDreamBackdrop(w,L){
  w.dreamLeaners=[];w.dreamSwirls=[];
  const far=group(w.backRoot,'Dream far blobs'),mid=group(w.backRoot,'Dream near blobs'),sky=group(w.backRoot,'Dream sky swirls');
  w.parallax.push({group:far,factor:.16,heightFollow:.6,repeat:150},{group:mid,factor:.38,heightFollow:.8,repeat:150},{group:sky,factor:.1,heightFollow:.5,repeat:150});
  for(let i=0;i<8;i++){
    const x=i*18.75+rand(i)*4;
    w.ball(7+rand(i+1)*4,4.5+rand(i+2)*2.5,4,'back',far,x,-5-rand(i+3)*2,-56);
    if(i%2===0){const h=16+rand(i+4)*8;w.box(2.6,h,2.6,'back2',far,x+9,-4+h/2,-50,1.1);}
  }
  for(let i=0;i<10;i++){
    const x=i*15+rand(i+20)*5;
    w.ball(3.5+rand(i+21)*2.5,2.6+rand(i+22)*1.4,3,'back2',mid,x,-5-rand(i+23)*1.5,-28);
    if(i%2===1){
      const h=11+rand(i+24)*5,col=group(mid,'Dream column',x+6,-6,-24);
      w.box(1.6,h,1.6,'back',col,0,h/2,0,.75);w.ball(1.3,.9,1.3,'accent',col,0,h+.2,0);
      // x is left unset: a parallax item wraps with the camera, so its world
      // position is read each frame rather than remembered.
      w.dreamLeaners.push({group:col,rest:0,strength:.14,x:undefined,y:-6});
    }
  }
  for(let i=0;i<6;i++){
    const ring=w.mesh(new THREE.TorusGeometry(2.2+rand(i+30)*1.4,.2,8,40),'accent',sky,i*25+6,13+rand(i+31)*4,-40);
    ring.scale.y=.55;ring.rotation.z=rand(i+32)*6;
    w.dreamSwirls.push({mesh:ring,speed:(rand(i+33)-.5)*.5});
  }
  const layers=dreamLayers(w);
  for(const section of L.dreamSections||[])dreamVisual(section.key)?.backdrop?.(w,L,section,layers);
  w.backRoot.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
}

// --- props -------------------------------------------------------------------
// A section's props() list, gathered once per level: {key,x,w,y,z,make} with
// x the WORLD x of the prop's centre and w its width, keyed
// dream:<section>:<key>. Streamed by streaming.js as scenery, like authored
// decoration: never a collider, always behind a deck the player is about to
// land on, dropped (and disposed) when the camera leaves.
function dreamProps(w,L){
  if(w.dreamPropsFor===L)return w.dreamProps;
  const list=[],keys=new Set();
  for(const section of L.dreamSections||[]){
    const visual=dreamVisual(section.key);
    for(const prop of visual?.props?.(section,L)||[]){
      if(typeof prop?.make!=='function'||!Number.isFinite(prop.x)||!prop.key)throw new Error(`dream/${section.key}: every prop needs {key, x, make(w,parent)} — got ${JSON.stringify(prop)}`);
      const key=`dream:${section.key}:${prop.key}`;
      if(keys.has(key))throw new Error(`dream/${section.key}: two props share the key ${prop.key}`);
      keys.add(key);list.push({...prop,key,section});
    }
  }
  w.dreamPropsFor=L;w.dreamProps=list;return list;
}
// A section may draw its own hazards: the engine's cream spike rows suit a
// canyon, not a corridor of soft cones or a pool of ink. The hook receives a
// group already standing at the band's corner and returns true to keep it;
// anything else falls back to the shared spikes.
export function dreamHazardView(w,L,h){
  const section=dreamSectionAt(L,h.x),visual=section&&dreamVisual(section.key);
  if(!visual?.hazard)return null;
  const g=new THREE.Group();g.name='Dream hazard';g.position.set(h.x,h.y,0);w.levelRoot.add(g);
  if(visual.hazard(w,h,g,section))return g;
  g.removeFromParent();return null;
}
export function syncDreamScenery(w,L,near,addScenery){
  for(const prop of dreamProps(w,L)){
    const width=prop.w??2;
    if(!near(prop.x-width/2,width))continue;
    addScenery(prop.key,()=>{
      const parent=new THREE.Group();parent.name=prop.key;parent.position.set(prop.x,prop.y??0,prop.z??0);w.levelRoot.add(parent);
      prop.make(w,parent,prop.section);return parent;
    },()=>{},prop.x);
  }
}

// --- palettes ----------------------------------------------------------------
export const PALETTE_KEYS=['main','secondary','backdrop','accent','sky','fog'];
const BLEND=4;
const smoothstep=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Which entry of an x-sorted list the player is in, and how far into the
// 4-unit cross-fade centred on that entry's x they are. `snap` (reduced
// motion) turns the fade into a step at the entry's x.
export function dreamBlendAt(entries,x,snap=false){
  if(!entries?.length)return null;
  let c=0;for(let i=0;i<entries.length;i++)if(x>=entries[i].x-BLEND/2)c=i;
  const to=entries[c],from=entries[c-1]??to;
  let t=smoothstep((x-(to.x-BLEND/2))/BLEND);if(snap)t=t<.5?0:1;
  return {index:c,t,from,to};
}
const scratch=new THREE.Color();
// The blended palette as colours, into `out` ({main,...} of THREE.Color).
export function dreamPaletteAt(palettes,x,out,snap=false){
  const b=dreamBlendAt(palettes,x,snap);if(!b)return null;
  for(const k of PALETTE_KEYS)out[k].set(b.from[k]).lerp(scratch.set(b.to[k]),b.t);
  return b;
}
// One palette → the shared theme materials, lights, sky and fog. Six authored
// colours fan out into the thirteen theme slots the same way every time, so a
// section author only ever chooses six.
export function applyDreamPalette(w,pal){
  const m=w.mat;
  m.terrain.color.copy(pal.main);m.terrain2.color.copy(pal.main).multiplyScalar(.78);
  m.top.color.copy(pal.secondary);m.foliage.color.copy(pal.secondary);
  m.bark.color.copy(pal.secondary).multiplyScalar(.7);m.vine.color.copy(pal.secondary).multiplyScalar(.7);
  m.back.color.copy(pal.backdrop);m.back2.color.copy(pal.backdrop).multiplyScalar(.85);m.water.color.copy(pal.backdrop);
  m.back.emissive.copy(m.back.color);m.back2.emissive.copy(m.back2.color);
  m.accent.color.copy(pal.accent);m.barkLight.color.copy(pal.accent);
  m.leafLight.color.copy(pal.accent).lerp(WHITE,.35);m.dust.color.copy(pal.accent).lerp(WHITE,.35);
  w.hemi.color.copy(pal.sky).lerp(WHITE,.35);w.hemi.groundColor.copy(pal.main).multiplyScalar(.45);
  w.scene.background.copy(pal.sky);w.scene.fog.color.copy(pal.fog);
}
function paletteStep(w,L,x){
  const pal=w.dreamPalette??=Object.fromEntries(PALETTE_KEYS.map(k=>[k,new THREE.Color()]));
  const b=dreamPaletteAt(L.palettes,x,pal,w.reducedMotion);if(!b)return;
  // Colours are written only when the blend moved: thirteen material uniforms
  // and two lights a frame is cheap, but doing nothing is cheaper.
  const key=b.index+':'+b.t.toFixed(4);if(w.dreamPaletteKey===key)return;
  w.dreamPaletteKey=key;applyDreamPalette(w,pal);
}

// --- camera ------------------------------------------------------------------
// `L.camera` entries carry a roll (radians) and/or a viewH; an entry that
// leaves one out means "the ordinary value" — no roll, the framing's own
// height (world.js stashes that as baseViewH). The roll is eased here at ~2/s;
// the view height is handed to world.js as a target, which eases viewH toward
// it the way the boss zoom does. Null means the camera is not asking for one.
function cameraStep(w,L,x,dt){
  let roll=0,viewH=null;
  const b=dreamBlendAt(L.camera,x,w.reducedMotion);
  if(b){
    roll=(b.from.roll??0)+((b.to.roll??0)-(b.from.roll??0))*b.t;
    if(b.from.viewH!==undefined||b.to.viewH!==undefined){
      const base=w.baseViewH??w.viewH,v0=b.from.viewH??base,v1=b.to.viewH??base;viewH=v0+(v1-v0)*b.t;
    }
  }
  const current=w.dreamRoll??0;
  w.dreamRoll=w.reducedMotion?roll:current+(roll-current)*(1-Math.exp(-dt*2));
  w.dreamViewH=viewH;
}

// --- leaners -----------------------------------------------------------------
// Builders register {group, rest, strength, x, y}: the group turns about z so
// its top leans toward the player, by atan2(dx, 6)*strength, eased. `x` may be
// left undefined for props whose world x moves (parallax items). Entries whose
// group has left the scene (streamed out) are dropped here. Reduced motion
// holds every leaner at its rest angle.
const attached=(o,scene)=>{for(let p=o;p;p=p.parent)if(p===scene)return true;return false;};
const worldPosition=new THREE.Vector3();
function leanStep(w,x,dt){
  const leaners=w.dreamLeaners;if(!leaners?.length)return;
  const rate=1-Math.exp(-dt*3);
  for(let i=leaners.length-1;i>=0;i--){
    const e=leaners[i];
    if(!attached(e.group,w.scene)){leaners.splice(i,1);continue;}
    const lx=e.x??e.group.getWorldPosition(worldPosition).x;
    const target=w.reducedMotion?e.rest:e.rest-Math.atan2(x-lx,6)*e.strength;
    e.angle=w.reducedMotion?target:(e.angle??e.rest)+(target-(e.angle??e.rest))*rate;
    e.group.rotation.z=e.angle;
  }
}

// --- per frame ---------------------------------------------------------------
// Section modules' animate() runs for every section the player is within 40
// units of, with one shared context record (read it, do not keep it).
const ctx={playerX:0,time:0,reducedMotion:false};
const REACH=40;
export function animateDream(w,game,dt){
  if(w.biome!=='dream')return;
  const L=game.level,x=game.player.x;
  paletteStep(w,L,x);
  cameraStep(w,L,x,dt);
  leanStep(w,x,dt);
  if(!w.reducedMotion)for(const s of w.dreamSwirls||[])s.mesh.rotation.z+=dt*s.speed;
  animateDreamViews(w,game,dt);
  ctx.playerX=x;ctx.time=game.time;ctx.reducedMotion=!!w.reducedMotion;
  for(const section of L.dreamSections||[]){
    if(x<section.x-REACH||x>section.x+section.length+REACH)continue;
    dreamVisual(section.key)?.animate?.(w,game,dt,section,ctx);
  }
}

// A platform's view in the dream. The section's module is asked first
// (deck()); then the dream's own kinds (dome, fold, sink, conveyor decks,
// breathing walls…) are built by dream-views.js; anything both decline falls
// through to the ordinary per-kind views in world.js. A view a module returns
// gets the checkpoint flag and the goal bell if it left them out, so a
// section author never has to think about either.
export function dreamPlatformView(w,s,g){
  const {section,visual}=visualAt(w.currentLevel,s.x);
  if(visual?.deck){
    const view=visual.deck(w,s,g,section);
    if(view){
      if(s.checkpoint&&!g.getObjectByName('Checkpoint flag'))w.flag(s.checkpoint-s.x,.08,g,.83,s.id);
      if(s.goal&&!g.getObjectByName('Chapter goal'))w.makeBell(g,s.bellX??s.w-3,.1);
      return {ropes:[],bounce:0,...view,root:view.root||g};
    }
  }
  return createDreamView(w,s,g)||null;
}
