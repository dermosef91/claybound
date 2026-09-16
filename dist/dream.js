import * as THREE from './lib/three.module.js';
import {createDreamView,animateDreamViews} from './dream-views.js';
// The Soft Dream's biome module: the theme the shared materials start from,
// the terrain and backdrop stand-ins, and the per-frame work the chapter adds
// to the renderer — a palette that cross-fades with the player's x, a camera
// roll/zoom list, props that lean toward the player, and the hook through
// which the dream's own platform views (dream-views.js) are built and animated.
// Everything here is render-only: the simulation never reads any of it.

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
// A chunky rolled slab: three softly rounded rows narrowing downward under the
// walkable cap, with the cap's ends curled up into lips so a deck reads as a
// sheet of Play-Doh rolled at both edges. Flags and the bell are placed exactly
// as the generic terrain does, so checkpoints and the goal need nothing extra.
export function buildDreamTerrain(w,s,g){
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
  if(s.checkpoint)w.flag(s.checkpoint-s.x,.05,g,.83,s.id);
  if(s.goal)w.makeBell(g,s.bellX??width-3.5,.1);
}

// --- backdrop ----------------------------------------------------------------
function group(parent,name,x=0,y=0,z=0){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;}
// Placeholder parallax: two layers of large soft blobs and a few tall rounded
// columns, and a ring of flat accent swirls high in the sky. Every layer
// repeats every 150 units, so items are laid inside 0..150. The columns are
// registered as leaners (they turn toward the player) and the swirls spin.
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
  w.backRoot.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
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
export function animateDream(w,game,dt){
  if(w.biome!=='dream')return;
  const L=game.level,x=game.player.x;
  paletteStep(w,L,x);
  cameraStep(w,L,x,dt);
  leanStep(w,x,dt);
  if(!w.reducedMotion)for(const s of w.dreamSwirls||[])s.mesh.rotation.z+=dt*s.speed;
  animateDreamViews(w,game,dt);
}

// The dream's own platform kinds (dome, fold, sink, conveyor decks, breathing
// walls…) are built by dream-views.js; anything it declines falls through to
// the ordinary per-kind views in world.js.
export function dreamPlatformView(w,s,g){return createDreamView(w,s,g)||null;}
