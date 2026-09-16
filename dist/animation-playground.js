// The animation lab. Two copies of the real shipped rig, side by side: the left
// one driven by the stock motion-capture clips through the same AnimationMixer
// the game uses, the right one driven by clay-motion.js instead.
//
// This is a bench, not a level — it has no World, no chapter and no physics. It
// fakes exactly the handful of signals hero.js reads (grounded, vy, speed,
// landing, hurt) so both columns see identical state and the only difference on
// screen is the motion itself.
import * as THREE from './lib/three.module.js';
import {GLTFLoader} from './lib/GLTFLoader.js';
import {assetURL} from './model-assets.js';
import {makeHeroClips} from './hero.js';
import {CHARACTERS} from './characters.js';
import {clayPose,heldPose,motionMode,collectJoints,capturePose,restorePose,applyClayPose,lagStep,MOTION_DEFAULTS} from './clay-motion.js';

const $=id=>document.getElementById(id);
const stage=$('stage'),status=$('status');
const STANDING=1.78;

// --- the fake game state both columns read ---------------------------------
// One script, played on a clock, so stock and clay are always on the same beat.
const SCRIPTS={
  idle:()=>({grounded:true,vy:0,speed:0,landing:0,hurt:0}),
  run:()=>({grounded:true,vy:0,speed:6.7,landing:0,hurt:0}),
  jump(t){
    const cycle=t%2.2;
    if(cycle<.18)return {grounded:true,vy:0,speed:2.4,landing:0,hurt:0};
    if(cycle<1.05){const v=11.8-27*(cycle-.18);return {grounded:false,vy:v,speed:2.4,landing:0,hurt:0};}
    if(cycle<1.55)return {grounded:true,vy:0,speed:.4,landing:1-(cycle-1.05)/.5,hurt:0};
    return {grounded:true,vy:0,speed:0,landing:0,hurt:0};
  },
  hurt(t){
    const cycle=t%2.4;
    return cycle<.9?{grounded:true,vy:0,speed:0,landing:0,hurt:1-cycle/.9}:{grounded:true,vy:0,speed:0,landing:0,hurt:0};
  },
};
// The stock clips the game would play for each state, so the left column is a
// fair comparison rather than a straw man.
const STOCK={idle:'idle',run:'run',rise:'jumpRise',fall:'jumpFall',land:'land',hurt:'hurt'};

const ui={state:'idle',fps:0,paused:false,spin:true,character:CHARACTERS[0].id,
  options:{...MOTION_DEFAULTS}};
let clock=0,phase=0,stepOnce=false;

// --- scene ------------------------------------------------------------------
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
stage.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x89b7db);
const camera=new THREE.PerspectiveCamera(32,1,.1,60);
scene.add(new THREE.HemisphereLight(0xd3e3f0,0x23466b,2.1));
const sun=new THREE.DirectionalLight(0xffe3bd,2.6);sun.position.set(-4,7,6);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.top=3;sun.shadow.camera.bottom=-1;sun.shadow.camera.left=-4;sun.shadow.camera.right=4;
scene.add(sun,sun.target);
const floor=new THREE.Mesh(new THREE.CylinderGeometry(4.6,4.6,.35,40),new THREE.MeshStandardMaterial({color:0x5f8fbe,roughness:.96}));
floor.position.y=-.175;floor.receiveShadow=true;scene.add(floor);

function resize(){
  const rect=stage.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height);
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  // Pull back on a narrow screen so both figures stay in frame.
  camera.position.set(0,1.45,width/height<1.1?9.4:7.2);
  camera.lookAt(0,.95,0);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);

// --- two copies of the rig ---------------------------------------------------
const columns=[];

function dressed(scene3){
  scene3.traverse(o=>{
    if(!o.isMesh)return;
    o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      m.roughness=.94;m.metalness=0;m.emissiveIntensity=0;m.needsUpdate=true;
    }
  });
}

async function loadColumn(choice,x,kind){
  const [gltf,motion,animation]=await Promise.all([
    new GLTFLoader().loadAsync(assetURL(choice.model)),
    fetch(assetURL(choice.motion)).then(r=>r.json()),
    fetch(assetURL(choice.animation)).then(r=>r.json()),
  ]);
  if(choice.bonePrefix){
    const plain=n=>n.startsWith(choice.bonePrefix)?n.slice(choice.bonePrefix.length):n;
    gltf.scene.traverse(o=>{o.name=plain(o.name);});
    for(const clip of gltf.animations)for(const track of clip.tracks)track.name=plain(track.name);
  }
  gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene,true),height=bounds.max.y-bounds.min.y;
  const standing=choice.height||STANDING,scale=standing/height;
  const root=new THREE.Group(),body=new THREE.Group(),facing=new THREE.Group();
  root.position.x=x;root.add(body);body.add(facing);facing.rotation.y=Math.PI/2;
  const model=new THREE.Group();model.scale.setScalar(scale);
  model.position.y=-bounds.min.y*scale;model.add(gltf.scene);facing.add(model);
  scene.add(root);
  dressed(gltf.scene);
  const clips=makeHeroClips(gltf.animations,motion,animation);
  const mixer=new THREE.AnimationMixer(gltf.scene);
  const actions={};
  for(const [name,clip] of Object.entries(clips)){
    const action=mixer.clipAction(clip);
    const looping=['idle','walk','run','victory'].includes(name);
    action.setLoop(looping?THREE.LoopRepeat:THREE.LoopOnce,looping?Infinity:1);
    action.clampWhenFinished=!looping;action.play();action.setEffectiveWeight(name==='idle'?1:0);
    actions[name]=action;
  }
  actions.walk.setEffectiveTimeScale(0);actions.run.setEffectiveTimeScale(0);
  return {kind,root,body,facing,model,asset:gltf.scene,mixer,actions,clips,
    joints:collectJoints(gltf.scene),base:null,build:standing/STANDING,
    lag:{value:0,velocity:0},lastMode:'idle'};
}

// --- driving ----------------------------------------------------------------
function driveStock(column,state,mode,dt){
  const target={};
  target[STOCK[mode]||'idle']=1;
  if(mode==='run'){target.run=1;target.idle=0;}
  for(const [name,action] of Object.entries(column.actions)){
    const want=target[name]||0,now=action.getEffectiveWeight();
    action.setEffectiveWeight(now+(want-now)*(1-Math.exp(-26*dt)));
  }
  if(column.lastMode!==mode){
    const action=column.actions[STOCK[mode]];
    if(action&&!['idle','run'].includes(STOCK[mode]))action.reset().play();
    column.lastMode=mode;
  }
  column.actions.walk.time=phase*column.clips.walk.duration;
  column.actions.run.time=phase*column.clips.run.duration;
  column.mixer.update(dt);
  column.body.scale.set(1,1,1);
}

function driveClay(column,state,mode,dt){
  // The stock clips still evaluate underneath: the clay pose is written over the
  // top of them, which keeps the rig in a sane bind pose and means an unposed
  // joint simply keeps whatever the clips gave it.
  restorePose(column.base);column.base=null;
  driveStock(column,state,mode,dt);
  column.base=capturePose(column.joints);
  const options={...ui.options,fps:ui.fps};
  const solved=heldPose({mode,phase,speed:state.speed,vy:state.vy,time:clock,
    build:column.build,landing:state.landing,hurt:state.hurt,phaseRate:state.speed/2.6},options);
  // A soft head on a soft neck arrives after the body does. Folding the lag into
  // the pose keeps it on the same world-axis path as every other joint, instead
  // of a second rotation in the bone's own frame that fights the first.
  const lag=lagStep(column.lag,solved.squash,dt);
  const trail=(lag-solved.squash)*26*ui.options.headLag;
  if(trail)(solved.pose.Head??={pitch:0,side:0,twist:0}).pitch+=trail;
  applyClayPose(column.joints,solved,{weight:1,facing:1});
  const scale=solved.scale;
  column.body.scale.set(scale.x,scale.y,scale.z);
}

// --- controls ---------------------------------------------------------------
const SLIDERS=[
  {key:'squash',label:'Squash & stretch',min:0,max:2,step:.05},
  {key:'bend',label:'Spine bend',min:0,max:2,step:.05},
  {key:'lean',label:'Run lean',min:0,max:2,step:.05},
  {key:'headLag',label:'Head lag',min:0,max:2,step:.05},
  {key:'overshoot',label:'Landing overshoot',min:0,max:2,step:.05},
  {key:'stagger',label:'Frame stagger',min:0,max:1,step:.05},
];
function buildSliders(){
  $('sliders').innerHTML=SLIDERS.map(s=>`
    <div class="slider">
      <label for="opt-${s.key}"><span>${s.label}</span><strong data-out="${s.key}">${ui.options[s.key].toFixed(2)}</strong></label>
      <input id="opt-${s.key}" type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${ui.options[s.key]}" data-opt="${s.key}">
    </div>`).join('');
  $('sliders').addEventListener('input',e=>{
    const key=e.target.dataset.opt;if(!key)return;
    ui.options[key]=Number(e.target.value);
    document.querySelector(`[data-out="${key}"]`).textContent=ui.options[key].toFixed(2);
  });
}
function press(group,attr,value){
  for(const b of document.querySelectorAll(`[${attr}]`))b.setAttribute('aria-pressed',String(b.getAttribute(attr)===String(value)));
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.state){ui.state=b.dataset.state;clock=0;phase=0;press(null,'data-state',ui.state);}
  if(b.dataset.fps!==undefined&&b.dataset.fps!==''){ui.fps=Number(b.dataset.fps);press(null,'data-fps',ui.fps);}
  if(b.id==='pause'){ui.paused=!ui.paused;b.setAttribute('aria-pressed',String(ui.paused));b.textContent=ui.paused?'Play':'Pause';}
  if(b.id==='stepFrame'){stepOnce=true;ui.paused=true;$('pause').setAttribute('aria-pressed','true');$('pause').textContent='Play';}
  if(b.id==='spin'){ui.spin=!ui.spin;b.setAttribute('aria-pressed',String(ui.spin));}
});

// --- boot -------------------------------------------------------------------
let last=performance.now();
function frame(now){
  const raw=Math.min((now-last)/1000,.05);last=now;
  const dt=ui.paused&&!stepOnce?0:(stepOnce?1/60:raw);
  stepOnce=false;
  clock+=dt;
  const state=SCRIPTS[ui.state](clock);
  const mode=motionMode(state);
  phase=(phase+dt*state.speed/2.6)%1;
  for(const column of columns){
    if(column.kind==='clay')driveClay(column,state,mode,dt);
    else driveStock(column,state,mode,dt);
    if(ui.spin)column.root.rotation.y+=dt*.35;
  }
  status.textContent=`${mode} · ${ui.fps?`${ui.fps} fps held`:'smooth'} · squash ${(clayPose({mode,phase,speed:state.speed,vy:state.vy,time:clock,landing:state.landing,hurt:state.hurt},{...ui.options,fps:ui.fps}).squash).toFixed(3)}`;
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}

async function boot(){
  try{
    const choice=CHARACTERS.find(c=>c.id===ui.character)||CHARACTERS[0];
    const [stock,clay]=await Promise.all([loadColumn(choice,-1.35,'stock'),loadColumn(choice,1.35,'clay')]);
    columns.length=0;columns.push(stock,clay);
    resize();
    status.textContent='ready';
    requestAnimationFrame(frame);
  }catch(error){
    console.error(error);
    stage.innerHTML=`<p class="fail">The rig could not load: ${error.message}. Serve this page from the same folder as the game (see LOCAL-DEPLOYMENT.md) so <code>assets/</code> resolves.</p>`;
  }
}

$('character').innerHTML=CHARACTERS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
$('character').addEventListener('change',async e=>{
  ui.character=e.target.value;
  for(const column of columns)scene.remove(column.root);
  columns.length=0;status.textContent='loading the rig…';
  await boot();
});
buildSliders();
boot();
