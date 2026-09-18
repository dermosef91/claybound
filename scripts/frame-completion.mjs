// Where a diorama's pieces actually land in the frame, and what world position
// would put them somewhere else.
//
// Composing these by eye alone wasted two rounds: the frame is an asymmetric
// frustum (completion-scene.js builds one so the subject sits right of centre),
// the camera looks down a diagonal, and the pieces nearest it are the ones
// furthest off its axis — so "x=3.5" is not a position you can reason about,
// and the same number means something different in every chapter.
//
//   node scripts/frame-completion.mjs                    every chapter's report
//   node scripts/frame-completion.mjs desert             one chapter
//   node scripts/frame-completion.mjs desert 0.4 0.62    solve: ground point at
//                                                        40% across, 62% down
//
// Fractions are of the visible canvas: 0,0 is its top-left corner.
import * as THREE from '../dist/lib/three.module.js';
import {DIORAMAS} from '../dist/completion-dioramas.js';

const W=1672,H=941;

// The same asymmetric frustum completion-scene.js builds, so what this reports
// is what the capture shows.
function build(spec,portrait=false){
  const view=portrait?spec.portrait||spec.camera:spec.camera;
  const width=portrait?430:W,height=portrait?932:H,aspect=width/height;
  const focus=view.focus||(aspect<1?[.5,.44]:[.655,.605]);
  const camera=new THREE.PerspectiveCamera(view.fov,aspect,.35,520);
  camera.position.set(...view.position);camera.lookAt(...view.target);
  const frameW=width*2*focus[0],frameH=height*2*focus[1];
  camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(view.fov)/2)*frameH/height));
  camera.setViewOffset(frameW,frameH,0,0,width,height);
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  return camera;
}

// Frame fraction of a world point, plus how far along the camera's own axis it
// stands — depth is what decides how big it draws, so it belongs in the report.
function where(camera,x,y,z){
  const v=new THREE.Vector3(x,y,z),ndc=v.clone().project(camera);
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  return {fx:(ndc.x+1)/2,fy:(1-ndc.y)/2,depth:v.clone().sub(camera.position).dot(forward)};
}

// The inverse: the point on the ground plane that appears at (fx,fy).
function ground(camera,fx,fy,planeY=0){
  const ndc=new THREE.Vector3(fx*2-1,1-fy*2,.5).unproject(camera);
  const dir=ndc.sub(camera.position).normalize();
  if(Math.abs(dir.y)<1e-6)return null;
  const t=(planeY-camera.position.y)/dir.y;
  if(t<0)return null;
  const p=camera.position.clone().addScaledVector(dir,t);
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  return {x:p.x,y:p.y,z:p.z,depth:p.clone().sub(camera.position).dot(forward)};
}

// A point at (fx,fy) a given distance along the camera axis — for anything that
// does not have to touch the ground: a landmark's centre, a planet, a cloud.
function at(camera,fx,fy,depth){
  const ndc=new THREE.Vector3(fx*2-1,1-fy*2,.5).unproject(camera);
  const dir=ndc.sub(camera.position).normalize();
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const p=camera.position.clone().addScaledVector(dir,depth/dir.dot(forward));
  return {x:p.x,y:p.y,z:p.z};
}

const f3=n=>(n<0?'':' ')+n.toFixed(2);
const pct=n=>(n*100).toFixed(1).padStart(5)+'%';

const argv=process.argv.slice(2);
const keys=argv.filter(a=>DIORAMAS[a]);
const nums=argv.filter(a=>/^-?[\d.]+$/.test(a)).map(Number);
// `at <fx> <fy> <depth>` is the one a landmark needs: the camera looks down a
// diagonal, so a mass far back and well to the left of the origin can still
// draw on the right of the frame — which is how the Great Arch spent a round
// hiding behind the gate. Asking for a frame position directly avoids it.
const wantAt=argv.includes('at');
// The composition slots every chapter draws from, solved once. All five share
// one camera, so one table places the landmark, the flanking masses, the
// receding ranks and the high accent in every chapter.
const SLOTS=[
  ['landmark centre',.38,.46,34],['landmark near',.38,.46,28],['landmark far',.38,.46,42],
  ['right mass',.72,.56,30],['right mass far',.78,.34,36],['far right',.88,.48,40],
  ['left far',.18,.44,52],['left high',.12,.30,40],
  ['deep centre',.50,.38,62],['deep rank',.46,.30,44],['deep rank right',.62,.24,50],
  ['high accent',.30,.18,26],['mid accent',.55,.52,24],['near left prop',.34,.62,22]
];
if(argv.includes('--slots')){
  for(const key of keys.length?keys:['desert']){
    const camera=build(DIORAMAS[key]);
    console.log(`\n=== ${key}: composition slots ===`);
    for(const [name,fx,fy,d]of SLOTS){
      const p=at(camera,fx,fy,d);
      console.log(`  ${name.padEnd(17)} ${pct(fx)},${pct(fy)} @${String(d).padStart(3)}  →  x ${f3(p.x)} y ${f3(p.y)} z ${f3(p.z)}`);
    }
    console.log('  ground slots:');
    for(const [name,fx,fy]of [['hero',.46,.83],['gate',.65,.80],['near left',.30,.88],['near right',.76,.86],['mid left',.34,.74],['mid right',.70,.73]]){
      const g=ground(camera,fx,fy);
      if(g)console.log(`  ${name.padEnd(17)} ${pct(fx)},${pct(fy)}       →  x ${f3(g.x)} z ${f3(g.z)}  depth ${g.depth.toFixed(1)}`);
    }
  }
  process.exit(0);
}

for(const key of keys.length?keys:Object.keys(DIORAMAS)){
  const spec=DIORAMAS[key];
  for(const portrait of [false,true]){
    const camera=build(spec,portrait);
    if(wantAt&&nums.length>=3){
      const p=at(camera,nums[0],nums[1],nums[2]);
      console.log(`${key}${portrait?' portrait':''}: ${pct(nums[0])},${pct(nums[1])} @depth ${nums[2]} → x ${f3(p.x)} y ${f3(p.y)} z ${f3(p.z)}`);
      continue;
    }
    if(nums.length>=3){
      const p=where(camera,nums[0],nums[1],nums[2]);
      console.log(`${key}${portrait?' portrait':''}: world ${nums.join(' ')} → ${pct(p.fx)} , ${pct(p.fy)}  depth ${p.depth.toFixed(1)}`+
        (p.fx<0||p.fx>1||p.fy<0||p.fy>1?'  <-- OUTSIDE':''));
      continue;
    }
    if(nums.length===2){
      const g=ground(camera,nums[0],nums[1]);
      console.log(`${key}${portrait?' portrait':''}: ground at ${pct(nums[0])},${pct(nums[1])} →`,
        g?`x ${f3(g.x)} z ${f3(g.z)} (depth ${g.depth.toFixed(1)})`:'never meets the ground');
      continue;
    }
    if(portrait)continue;
    const hero=spec.hero;
    // The gate's own extremes, carried through its placement: the flag tip is
    // 3.3 out along its local x and the crest 4.43 up, and those are what
    // leave the frame first.
    const turn=-.52,gx=1.6,gz=-.2;
    const tip=[gx+3.3*Math.cos(turn),0,gz-3.3*Math.sin(turn)];
    const points=[
      ['hero feet',hero.x,hero.y,hero.z],
      ['hero head',hero.x,hero.y+1.78,hero.z],
      ['gate centre',gx,0,gz],
      ['gate crest',gx,4.43,gz],
      ['gate flag tip',tip[0],3.2,tip[2]],
      ['footing front lip',0,0,3.6],
      ['footing far lip',0,0,-3.6]
    ];
    console.log(`\n=== ${key} ===`);
    for(const [name,x,y,z]of points){
      const p=where(camera,x,y,z);
      const off=p.fx<0||p.fx>1||p.fy<0||p.fy>1?'  <-- OUTSIDE':'';
      console.log(`  ${name.padEnd(18)} x${f3(x)} y${f3(y)} z${f3(z)}  →  ${pct(p.fx)} , ${pct(p.fy)}   depth ${p.depth.toFixed(1)}${off}`);
    }
    // Where the useful thirds of the frame are on the ground, so a landmark or
    // a prop can be put at one directly instead of by trial.
    console.log('  ground reference:');
    for(const [fx,fy]of [[.38,.78],[.5,.72],[.62,.76],[.45,.66]]){
      const g=ground(camera,fx,fy);
      if(g)console.log(`    ${pct(fx)},${pct(fy)} → x${f3(g.x)} z${f3(g.z)} depth ${g.depth.toFixed(1)}`);
    }
    const mid=at(camera,.46,.42,26);
    console.log(`    landmark centre 46%,42% @depth 26 → x${f3(mid.x)} y${f3(mid.y)} z${f3(mid.z)}`);
  }
}
