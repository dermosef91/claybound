import * as THREE from '../lib/three.module.js';
import {clayMaterial,clayShape,sculptClay} from '../clay.js';
// Helpers every section's visual module can lean on. Kept apart from dream.js
// (which imports the modules) so a module importing these makes no cycle.
//
// Coordinates on the render side are WORLD coordinates: a platform `s` has
// its chapter x, `ctx.playerX` is the chapter x, and a section entry
// `{key,name,x,length}` tells you where the module's local 0 landed
// (`section.x`). The reliable way to place scenery on a deck is to look the
// deck up by id in `L.platforms` — ids are prefixed with the section key and
// never change between the full chapter and a solo build — rather than
// adding numbers to `section.x` by hand.

// The section whose [x, x+length) holds x, or null.
export function dreamSectionAt(L,x){
  const table=L?.dreamSections;if(!table)return null;
  return table.find(s=>x>=s.x&&x<s.x+s.length)??null;
}
// The platforms that lie in a section, left to right. In the full chapter the
// garden's entry deck is the chapter's `start`; in a solo build it keeps its
// own id — so "the entry deck" is decks(L,section)[0], not a fixed id.
export function sectionDecks(L,section){
  return L.platforms.filter(s=>s.x>=section.x&&s.x<section.x+section.length).sort((a,b)=>a.x-b.x);
}
// A platform by id, or null: `deck(L,'garden-arch')`.
export const deck=(L,id)=>L.platforms.find(s=>s.id===id)??null;

// Register a group as a leaner: dream.js turns it about z each frame so its
// top tilts toward the player, by atan2(dx, 6)*strength from `rest`, eased.
// `x` is the group's world x (pass undefined for parallax items, whose world
// x is read each frame). Entries whose group has streamed out are dropped
// automatically; reduced motion holds every leaner at rest.
export function lean(w,group,{x,y=0,strength=.15,rest=0}={}){
  (w.dreamLeaners??=[]).push({group,rest,strength,x,y});return group;
}

// A theme slot where the world has one, else a colour every world carries —
// so a module built against the dream's palette still draws in a bare test rig.
export const slot=(w,name,fallback='cream')=>w.mat?.[name]?name:fallback;

// A deterministic 0..1 from a number, for scattering props the same way on
// every build.
export const rand=n=>{const v=Math.sin(n*127.1+87.3)*43758.5453;return v-Math.floor(v);};

// --- colours the palette cannot reach ------------------------------------------
// A material of one fixed colour, made once per world and kept in w.mat so the
// streaming disposer and a level rebuild treat it as shared. Matte clay takes
// the relief hook; `gloss` skips it (the relief shader clamps roughness to
// .52, and slime or a pupil is meant to shine) and carries the clay tag the
// scene checks look for. Returns the name, for w.box/w.ball/w.mesh.
export function fixedMaterial(w,name,hex,{roughness=.95,depth=.075,gloss=false}={}){
  if(!w.mat)return 'orange';
  if(!w.mat[name]){
    const m=new THREE.MeshStandardMaterial({color:hex,roughness:gloss?.25:roughness,metalness:0});m.name=name;
    if(gloss)m.userData.clay={type:'gloss',requestedDepth:0,depth:0};
    else{clayMaterial(w,m,depth);m.userData.clay??={type:'relief',requestedDepth:depth,depth:0};}
    w.mat[name]=m;
  }
  return name;
}

// --- shared shapes --------------------------------------------------------------
// Unit-high lathes kept in the clay cache: soft cones for hazard beds, drips
// for frosting that has run over a lip. `variant` picks a bulge so a row of
// them does not read as one shape stamped out.
const CONE=[[1,0],[1,.1],[.96,.24],[.86,.4],[.72,.56],[.56,.7],[.4,.82],[.25,.91],[.12,.97],[0,1]];
const DRIP=[[1,0],[1,.1],[.95,.25],[.85,.42],[.7,.58],[.52,.72],[.34,.84],[.18,.93],[.06,.99],[0,1]];
export function lathe(w,key,profile,bulge=0,segments=16){
  return clayShape(w,key,()=>sculptClay(w,new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r*(1+bulge*Math.sin(y*Math.PI)),y)),segments),{amplitude:.05}));
}
export function cone(w,parent,x,y,z,r,h,material,variant=0){
  const m=w.mesh(lathe(w,'dream-cone:'+(variant%3),CONE,[0,.07,-.06][variant%3]),material,parent,x,y,z);
  m.scale.set(r,h,r);m.name='Soft cone';return m;
}
export function drip(w,parent,x,y,z,r,h,material,variant=0){
  const m=w.mesh(lathe(w,'dream-drip:'+(variant%2),DRIP,[0,.06][variant%2]),material,parent,x,y,z);
  m.scale.set(r,h,r);m.rotation.z=Math.PI;m.name='Drip';return m;
}
// A hanging leaf: widest just under where it is pinched onto a lip, pointed
// at the tip, and flattened front-to-back so it reads as a blade rather than
// a drip. `r` is its half-width, `h` its length below (x,y,z).
const LEAF=[[.55,0],[.9,.12],[1,.28],[.86,.5],[.6,.7],[.3,.87],[0,1]];
export function leaf(w,parent,x,y,z,r,h,material,variant=0){
  const m=w.mesh(lathe(w,'dream-leaf:'+(variant%2),LEAF,[0,.05][variant%2]),material,parent,x,y,z);
  m.scale.set(r,h,r*.42);m.rotation.z=Math.PI;m.name='Leaf';return m;
}
// A mushroom's stem, unit high: a flared foot, a slight waist, a little wider
// again under the cap. Scale (r, height, r).
const STEM=[[.62,0],[.55,.12],[.44,.4],[.4,.72],[.48,.95],[.5,1]];
export const stem=w=>lathe(w,'dream-stem',STEM,0,18);
// A cap's rolled rim: a unit torus, sculpted, to lie flat under a cap's edge.
export const rim=w=>clayShape(w,'dream-rim',()=>sculptClay(w,new THREE.TorusGeometry(1,.14,8,30),{amplitude:.02}));
// An upper hemisphere of radius 1: an eyelid hinged at the eye's centre, so
// rotation.x swings it from behind the eye (-π/2, open) over the top to the
// front (+π/2, shut).
export const lid=w=>clayShape(w,'dream-lid',()=>sculptClay(w,new THREE.SphereGeometry(1,18,9,0,Math.PI*2,0,Math.PI/2),{amplitude:.035}));

// Whether an object still hangs in the scene: animated registries drop entries
// whose group has streamed out.
export const attached=(o,scene)=>{for(let p=o;p;p=p.parent)if(p===scene)return true;return false;};
