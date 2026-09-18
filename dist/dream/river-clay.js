import * as THREE from '../lib/three.module.js';
import {clayMaterial} from '../clay.js';
import {MAGIC_SKIN} from '../shaping-views.js';
// The Colour River's stream clay: the formable clay's material (violet
// MeshStandardMaterial → clay relief → the magic skin's hashes, spots and
// glitter) recoloured to a stream, made wet, and set moving. Compared with the
// magic clay the relief is shallower and the roughness clamp is lifted so the
// pour shines; the thumbprints and foot-darkening are gone, and in their place
// streaks of the colour run along the stream, the surface bulges in a
// travelling wave, and the glitter drifts with the flow.
//
// Where a mesh is *flowing* comes from a `riverFlow` vertex attribute
// (distance along the stream in world units, 0..1 round it, speed in units per
// second, and how far the crest is held still) stamped only on the fresh tube
// geometries. Shared and cached shapes — bubbles, saucers, the slabs under the
// deep — carry none, read as (0,0,0,0), and take the still branch: the same
// wet colour and sheen with a slow marbling and a normal-only ripple, but no
// displacement. A river the player stands on is a flowing tube with its top
// held (fourth component 1): the wave fades out on upward-facing surface, so
// the crest stays on the collider's line while the face bulges and drops hang
// underneath.
//
// Shadows come from the shared depth material, which never runs this hook, so
// a stream's shadow keeps the undisplaced silhouette: at ±.06 on a rope behind
// the play plane that is not visible.

const RIVER_TIME={value:0};
const WHITE=new THREE.Color(1,1,1);

// Both stages evaluate the same wave: the vertex stage moves the surface by
// it, the fragment stage reads it back as a height so the lighting follows
// the bulge (vNormal is fixed before the displacement runs). `f` is riverFlow
// and `n` the surface normal in the stream's own space. Several motions at
// once, as a thick pour has: a slow swell; beads — bulges brief and fat with
// a long neck between, so a blob is seen to travel; a spiralling sway (a
// first harmonic round the tube shifts the whole cross-section, so the rope
// sways as well as bulges); a quick ripple; and drops that hang under the
// rope and slide along it. The across coordinate only enters through its
// angle, keeping the seam ring watertight. Still meshes (speed 0) get none;
// a held crest (f.w) loses the wave where the surface faces up, and keeps its
// drops, which hang from the underside anyway.
const RIVER_WAVE=`
float riverWave(vec4 f, float t, vec3 n) {
  float u = f.x - t * f.z, a = f.y * PI2;
  float bead = pow(0.5 + 0.5 * sin(u * 1.35 + 0.4 * sin(u * 0.37)), 3.0);
  float drop = pow(0.5 + 0.5 * sin(u * 1.1 + 2.0 + 0.3 * sin(u * 0.53)), 2.0) * max(0.0, -n.y);
  float held = 1.0 - f.w * smoothstep(0.0, 0.7, n.y);
  return step(0.001, f.z) * ((0.035 * sin(u * 0.9) + 0.09 * bead - 0.03 + 0.045 * sin(u * 2.6 + a) + 0.02 * sin(u * 5.3 - 2.0 * a + 1.3)) * held + 0.06 * drop);
}`;
// Fragment helpers, pure functions only: they land ahead of the clay relief's
// own declarations at <common>.
const RIVER_SURFACE=`
uniform float riverTime;
uniform vec3 riverDeep;
uniform vec3 riverSheen;
varying vec4 vRiverFlow;
float riverNoise(vec3 p) {
  vec3 i = floor(p), f = p - i;f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(magicHash3(i), magicHash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(magicHash3(i + vec3(0.0, 1.0, 0.0)), magicHash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(magicHash3(i + vec3(0.0, 0.0, 1.0)), magicHash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(magicHash3(i + vec3(0.0, 1.0, 1.0)), magicHash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float riverStreaks(vec3 p) { return 0.65 * riverNoise(p) + 0.35 * riverNoise(p * 2.1 + vec3(9.2, 3.7, 5.1)); }`;

// A shader anchor that has moved (a three.js bump, a change to the clay hook)
// must not leave a silently still river: report it where the review capture
// collects errors, and keep drawing.
function swap(source,anchor,text){
  if(!source.includes(anchor)){console.error('river clay: shader anchor missing: '+anchor.slice(0,48));return source;}
  return source.replace(anchor,text);
}

// One stream material, kept in w.mat under `name` so the streaming disposer
// and the level rebuild treat it as shared. `hex` is the stream's colour; the
// two tints the skin needs are derived from it.
export function riverClay(w,name,hex){
  if(w.mat[name])return name;
  const m=new THREE.MeshStandardMaterial({color:hex,roughness:.14,metalness:0,emissive:hex,emissiveIntensity:.07});m.name=name;
  // Without the clay surface (never in the game; the world is ready before a
  // chapter builds) the stream falls back to the plain gloss it used to be.
  if(w.clay){clayMaterial(w,m,.02);riverSkin(m,hex);}
  else m.userData.clay={type:'gloss',requestedDepth:0,depth:0};
  w.mat[name]=m;return name;
}

// Layers the stream skin over a material the clay relief is installed on.
function riverSkin(m,hex){
  const c=new THREE.Color(hex),peak=Math.max(c.r,c.g,c.b,1e-4);
  // The turned-away tone: the colour at full saturation, a little lifted and
  // darkened — light bouncing inside a thick liquid rather than the sky's grey.
  const deep=c.clone().multiplyScalar(1/peak).lerp(WHITE,.35).multiplyScalar(.8);
  // The wet glaze: a pale version of the colour, standing in for the
  // environment reflection the scene has no map for.
  const sheen=c.clone().lerp(WHITE,.72).multiplyScalar(.95);
  const compile=m.onBeforeCompile,key=m.customProgramCacheKey;
  m.onBeforeCompile=(shader,renderer)=>{
    compile.call(m,shader,renderer);
    shader.uniforms.riverTime=RIVER_TIME;
    shader.uniforms.riverDeep={value:deep};
    shader.uniforms.riverSheen={value:sheen};
    let v=shader.vertexShader;
    v=swap(v,'#include <common>','#include <common>\nattribute vec4 riverFlow;\nuniform float riverTime;\nvarying vec4 vRiverFlow;'+RIVER_WAVE);
    v=swap(v,'#include <project_vertex>',`vRiverFlow = riverFlow;
transformed += objectNormal * riverWave(riverFlow, riverTime, objectNormal);
#include <project_vertex>`);
    shader.vertexShader=v;
    let f=shader.fragmentShader;
    f=swap(f,'#include <common>','#include <common>'+MAGIC_SKIN+RIVER_WAVE+RIVER_SURFACE);
    // The relief's grain darkening is eased (a pour is smoother than kneaded
    // clay), then the streaks: noise read in a space that travels with the
    // flow, stretched along it, periodic round the tube. Still meshes read the
    // same noise off their own coordinates, drifting slowly.
    f=swap(f,'diffuseColor.rgb *= mix(1.0, clayData.b / 0.94, 0.55);',`diffuseColor.rgb *= mix(1.0, clayData.b / 0.94, 0.25);
float riverFlowing = step(0.001, vRiverFlow.z), riverA = vRiverFlow.y * PI2;
vec3 riverP = mix(vClayPosition * 1.3 + vec3(riverTime * 0.12, 0.0, 0.0),
                  vec3((vRiverFlow.x - riverTime * vRiverFlow.z) * 0.35, cos(riverA) * 0.9, sin(riverA) * 0.9), riverFlowing);
vec3 riverN = mix(normalize(vClayNormal), vec3(0.0, cos(riverA), sin(riverA)), riverFlowing);
float riverStreak = riverStreaks(riverP), riverWet = smoothstep(0.32, 0.66, riverStreak);
diffuseColor.rgb *= mix(riverDeep, vec3(1.06), 0.55 + 0.45 * riverStreak);
// The height the lighting sees: the wave itself, the streaks as ridges along
// a stream (they break the highlight into glints that run with the flow), a
// fine ripple hurrying along with the flow, and on a still surface a
// standing ripple.
float riverU = vRiverFlow.x - riverTime * vRiverFlow.z;
float riverRipple = riverWave(vRiverFlow, riverTime, normalize(vClayNormal)) + riverFlowing * (0.04 * (riverStreak - 0.5) + 0.008 * sin(riverU * 14.0 + riverStreak * 6.0 + 0.7 * riverA))
  + (1.0 - riverFlowing) * 0.012 * sin(dot(vClayPosition.xz, vec2(9.0, 7.0)) + riverTime * 1.9) * sin(dot(vClayPosition.xz, vec2(-5.0, 11.0)) - riverTime * 1.3);`);
    // The relief clamps roughness to .52 so clay never shines; a stream is
    // meant to. Glossier than the old plain gloss everywhere, glossier still
    // where a wet streak runs.
    f=swap(f,'roughnessFactor = clamp(roughnessFactor * clayData.g, 0.52, 0.98);',
      'roughnessFactor = clamp(mix(roughnessFactor * mix(1.0, clayData.g, 0.3) + 0.05, roughnessFactor - 0.07, riverWet), 0.05, 0.5);');
    f=swap(f,'clayData.r * bumpScale, faceDirection','clayData.r * bumpScale + riverRipple, faceDirection');
    f=swap(f,'#include <lights_fragment_end>',`#include <lights_fragment_end>
// Light inside the liquid keeps its underside a deep, saturated tone rather
// than the sky's grey; the glaze sits on the rims and, faintly, on top, and
// where the surface both faces up and turns toward the light it catches a
// white wet highlight — the one thing a shine needs that the lights alone
// do not give a rope this thin.
vec3 riverUp = transformNormalByInverseViewMatrix(geometryNormal, viewMatrix);
reflectedLight.indirectDiffuse *= mix(riverDeep, vec3(1.0), smoothstep(-0.8, 0.6, riverUp.y));
float riverRim = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 3.0);
totalEmissiveRadiance += riverSheen * (riverRim * 0.42 + smoothstep(0.35, 1.0, riverUp.y) * 0.05 * (0.6 + 0.4 * riverWet));
float riverShine = pow(saturate(dot(geometryNormal, normalize(vec3(-0.35, 0.8, 0.5)))), 14.0);
totalEmissiveRadiance += vec3(0.9, 0.88, 0.85) * riverShine * (0.16 + 0.2 * riverWet);
// The magic clay's glitter, thinner, riding the flow.
float riverPixel = max(length(dFdx(riverP)), length(dFdy(riverP)));
float riverSparkle = magicSpots(riverP.xy + vec2(32.7, 20.9), 0.35, 0.59);
if (riverSparkle > 0.0) totalEmissiveRadiance += magicGlitter(riverP, riverN, riverPixel) * riverSparkle * 0.3;`);
    shader.fragmentShader=f;
  };
  m.customProgramCacheKey=()=>key.call(m)+'-river-v2';m.needsUpdate=true;
  return m;
}

// Stamp a fresh tube with its flow coordinates, read off TubeGeometry's uv:
// u runs 0..1 along the path (sampled by arc length, so times the curve's
// length it is a distance) and v 0..1 round it. `hold` (0..1) is how much of
// the wave the crest gives up, 1 for a river the player walks on. Call it on
// the geometry that will be drawn — after sculpting — and never on a shared
// shape.
export function flowTube(g,length,speed,hold=0){
  const uv=g.attributes.uv;if(!uv)return g;
  const flow=new Float32Array(uv.count*4);
  for(let i=0;i<uv.count;i++){flow[i*4]=uv.getX(i)*length;flow[i*4+1]=uv.getY(i);flow[i*4+2]=speed;flow[i*4+3]=hold;}
  g.setAttribute('riverFlow',new THREE.BufferAttribute(flow,4));return g;
}

// Per frame, from the section's animate(). Reduced motion holds the streams
// where they are rather than snapping them back to their start.
export function tickRiverClay(time,still){if(!still)RIVER_TIME.value=time;}
