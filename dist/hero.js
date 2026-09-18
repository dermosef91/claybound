import * as THREE from './lib/three.module.js';
import {GLTFLoader} from './lib/GLTFLoader.js';
import {clayModel} from './clay.js';
import {assetURL} from './model-assets.js';
import {animateFlowerCelebration} from './flower-celebration.js';
import {CHARACTERS} from './characters.js';
import {between} from './camera.js';

const clamp=THREE.MathUtils.clamp;
const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
// The height the original stands, and the scale every other measurement that
// follows a body — its shadow, its reach, the motes that circle its head — is
// expressed in. A taller character carries all of them up with it.
const MODEL_HEIGHT=1.78;
const SOURCE={idle:'Armature|Idle_9|baselayer',longIdle:'Idle_03',walk:'Walking',run:'Running',jump:'Regular_Jump',leap:'Jump_Over_Obstacle_2',hurt:'Face_Punch_Reaction_2',death:'Knock_Down',victory:'Skip_Forward'};
const LOOPING=new Set(['idle','walk','run','victory']);
// The impact response. A landing sets the deformation outright, so its peak is
// on the frame of contact rather than a twentieth of a second after it, and a
// damped spring relaxes it with the rebound clay gives back. Jump, spring and
// hurt still arrive as velocity; the stiffer spring shortens their reach, so
// their impulses carry a matching scale and keep the stretch they always had.
const IMPACT_K=620,IMPACT_DAMP=18,IMPACT_LIMIT=.46,IMPACT_GAIN=.45,IMPULSE=1.115;
// Clay keeps its volume, so a body squashed thinner spreads wider by about the
// same amount: 1/sqrt(1-q) over this range is within a thousandth of 1+.55q.
const IMPACT_SPREAD=.55;
// How far a landing compresses the body, by arrival speed. The cap is reached
// near 25, the hardest fall any chapter asks for, which keeps the heaviest
// landings distinguishable from the merely hard ones instead of saturating
// halfway up the range the levels actually use.
export const landSquash=impact=>clamp(impact*.0185,.06,IMPACT_LIMIT);

export function createHero(w){
  const root=new THREE.Group(),body=new THREE.Group(),facing=new THREE.Group();
  root.name='Player';body.name='Impact response';facing.name='Model orientation';
  root.add(body);body.add(facing);facing.rotation.y=Math.PI/2;
  // The gameplay origin is at the feet. Imported mesh transforms never move it.
  const shadow=w.mesh(new THREE.CircleGeometry(.55,30),w.mat.shadow.clone(),w.scene);
  shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;shadow.receiveShadow=false;shadow.visible=false;
  return {root,body,facing,shadow,loaded:false,build:1,actions:{},weights:{},state:'idle',idleTime:0,idleVariant:'idle',longIdlePlayed:false,turn:0,spring:0,springV:0,gait:0,clock:0,hurt:0,landing:0,death:false,jumpKind:'jump',lastVx:0};
}

export async function loadHero(w,onProgress,choice=CHARACTERS[0]){
  const [gltf,motion,animation]=await Promise.all([
    new GLTFLoader().loadAsync(assetURL(choice.model),e=>onProgress?.(e.total?e.loaded/e.total:null)),
    fetch(assetURL(choice.motion)).then(r=>{if(!r.ok)throw new Error('Character motion data could not load.');return r.json();}),
    fetch(assetURL(choice.animation)).then(r=>{if(!r.ok)throw new Error('The character animations could not load.');return r.json();})
  ]);
  attachHero(w,gltf,motion,animation,choice);onProgress?.(1);
  return w.character;
}

// Every character carries its own copy of the game's states. The original rig
// keeps its nine clips in the GLB and supplies only the newer idle alongside;
// a retargeted rig supplies the whole set, since its own file has just one.
const suppliedClips=animation=>animation.clips||[animation.clip];

// Exact boundary samples keep short takeoff / landing excerpts continuous.
function excerpt(source,name,start=0,end=source.duration){
  const tracks=source.tracks.map(track=>{
    const times=[start,...Array.from(track.times).filter(t=>t>start&&t<end),end];
    const interpolant=track.createInterpolant(),values=[];
    for(const time of times)values.push(...interpolant.evaluate(time));
    return new track.constructor(track.name,times.map(t=>t-start),values,track.getInterpolation());
  });
  return new THREE.AnimationClip(name,end-start,tracks);
}

export function makeHeroClips(animations,motion,animation){
  if(!animation||animation.playerSha256!==motion.sourceSha256)throw new Error('The animations do not match this character.');
  const supplied=suppliedClips(animation).map(clip=>THREE.AnimationClip.parse(clip));
  const originals=new Map([...animations,...supplied].map(clip=>[clip.name,clip]));
  function prepare(source,name,mode,start,end){
    const original=originals.get(source);if(!original)throw new Error(`Character animation is missing: ${source}`);
    const clip=original.clone(),track=clip.tracks.find(t=>t.name==='Hips.position');
    if(!track)throw new Error(`Character root animation is missing: ${source}`);
    // A clip that arrived beside the model brings its own floor correction.
    const correction=motion.clips[source]||animation.ground;
    if(mode==='ground'&&!correction)throw new Error(`Character floor correction is missing: ${source}`);
    const ground=mode==='ground'?new THREE.NumberKeyframeTrack('floor',correction.times,correction.values).createInterpolant():null;
    for(let i=0;i<track.times.length;i++){
      track.values[i*3]=motion.anchor[0];track.values[i*3+2]=motion.anchor[2];
      // Vertical physics owns airborne displacement; authored limb poses stay intact.
      track.values[i*3+1]=ground?ground.evaluate(track.times[i])[0]:motion.anchor[1];
    }
    const result=excerpt(clip,name,start,end);result.userData={source,mode};return result;
  }
  return {
    idle:prepare(SOURCE.idle,'idle','ground'),longIdle:prepare(SOURCE.longIdle,'longIdle','ground'),walk:prepare(SOURCE.walk,'walk','ground'),run:prepare(SOURCE.run,'run','ground'),
    jumpRise:prepare(SOURCE.jump,'jumpRise','air',.53,.86),jumpFall:prepare(SOURCE.jump,'jumpFall','air',.88,1.13),
    leapRise:prepare(SOURCE.leap,'leapRise','air',.1,.39),leapFall:prepare(SOURCE.leap,'leapFall','air',.43,.60),
    stomp:prepare(SOURCE.jump,'stomp','air',1.03,1.13),land:prepare(SOURCE.jump,'land','ground',1.2,1.7),
    hurt:prepare(SOURCE.hurt,'hurt','ground',.70,1.40),death:prepare(SOURCE.death,'death','ground',.08,1.1),
    victory:prepare(SOURCE.victory,'victory','ground')
  };
}

export function attachHero(w,gltf,motion,animation,choice=CHARACTERS[0]){
  const c=w.character;
  if(c.loaded)throw new Error('The character has already been loaded.');
  // A supplied rig may carry its exporter's joint prefix. Drop it once, from the
  // nodes and from the clips bound to them, so the movement states and the
  // flower celebration address one vocabulary of joint names.
  if(choice.bonePrefix){
    const plain=name=>name.startsWith(choice.bonePrefix)?name.slice(choice.bonePrefix.length):name;
    gltf.scene.traverse(o=>{o.name=plain(o.name);});
    for(const clip of gltf.animations)for(const track of clip.tracks)track.name=plain(track.name);
  }
  const hips=gltf.scene.getObjectByName('Hips');if(!hips?.isBone)throw new Error('The supplied character has no usable skeleton.');
  gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene,true),height=bounds.max.y-bounds.min.y;
  if(!Number.isFinite(height)||height<=0)throw new Error('The character has invalid geometry.');
  // The skeleton's own root scale carries its units: the original armature is
  // authored in centimetres, the Wanderer's in metres. Both normalize to the
  // same standing height, so the two read as one cast at one size.
  const rootScale=hips.parent.getWorldScale(new THREE.Vector3()).y;
  const standing=choice.height||MODEL_HEIGHT;c.build=standing/MODEL_HEIGHT;
  const scale=standing/height,model=new THREE.Group();model.name='Normalized custom character';
  // A character that reads better from its other side is mirrored across its
  // own sagittal plane: the rig, its clips and the joints the game reaches for
  // all come along, and the renderer turns the winding with the determinant.
  model.scale.set(choice.mirror?-scale:scale,scale,scale);model.position.set(0,-bounds.min.y*scale,-motion.anchor[2]*rootScale*scale);
  model.add(gltf.scene);c.facing.add(model);c.model=model;c.asset=gltf.scene;c.hips=hips;c.choice=choice;
  const maxAnisotropy=Math.min(4,w.renderer?.capabilities.getMaxAnisotropy()||4);
  gltf.scene.traverse(o=>{
    if(!o.isMesh)return;
    o.castShadow=true;o.receiveShadow=true;
    // One skinned mesh: avoid stale rest-pose bounds culling a jump or turn.
    o.frustumCulled=false;
    for(const material of Array.isArray(o.material)?o.material:[o.material]){
      // Keep the supplied surface detail while matching its orange pigment, and
      // press the clay relief as deep as the character declares.
      material.userData.clayOrangeSource=choice.orangeSource;
      if(choice.clayDepth)material.userData.clayDepth=choice.clayDepth;
      material.roughness=.94;material.metalness=0;material.emissiveIntensity=0;
      if('specularIntensity' in material)material.specularIntensity=.22;
      if(material.map)material.map.anisotropy=maxAnisotropy;
      material.needsUpdate=true;
    }
  });
  clayModel(w,gltf.scene);
  c.clips=makeHeroClips(gltf.animations,motion,animation);
  c.sourceClips=[...gltf.animations.map(a=>a.name),...suppliedClips(animation).map(clip=>clip.name)];
  c.mixer=new THREE.AnimationMixer(gltf.scene);
  for(const [name,clip] of Object.entries(c.clips)){
    const a=c.mixer.clipAction(clip);a.setLoop(LOOPING.has(name)?THREE.LoopRepeat:THREE.LoopOnce,LOOPING.has(name)?Infinity:1);
    a.clampWhenFinished=!LOOPING.has(name);a.play();a.setEffectiveWeight(name==='idle'?1:0);c.actions[name]=a;c.weights[name]=name==='idle'?1:0;
  }
  c.actions.walk.setEffectiveTimeScale(0);c.actions.run.setEffectiveTimeScale(0);
  c.actions.land.setEffectiveTimeScale(1.9);c.actions.hurt.setEffectiveTimeScale(1.9);c.actions.death.setEffectiveTimeScale(3.4);
  c.loaded=true;c.mixer.update(0);c.root.updateMatrixWorld(true);
}

// Release one character so another can take its place mid-session. The group
// the game drives — position, facing, shadow, spore motes — is not a character
// and stays put; only the rig, its clips and the bones the flower reaches for
// belong to whoever is being put away.
export function detachHero(w){
  const c=w.character;
  // Keyed on the model, not on `loaded`: a rig whose clips were rejected is
  // still attached, and it is exactly the one worth clearing away.
  if(!c.model)return;
  c.mixer?.stopAllAction();c.mixer?.uncacheRoot(c.asset);
  c.model.removeFromParent();c.flower?.root.removeFromParent();
  for(const root of [c.asset,c.flower?.root])root?.traverse(o=>{
    if(!o.isMesh)return;
    o.geometry.dispose();
    for(const material of Array.isArray(o.material)?o.material:[o.material]){
      for(const map of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap'])material[map]?.dispose();
      material.dispose();
    }
  });
  c.loaded=false;c.build=1;c.model=c.asset=c.hips=c.mixer=c.clips=c.choice=undefined;
  c.flower=null;c.actions={};c.weights={};c.state='idle';
  c.idleTime=0;c.idleVariant='idle';c.longIdlePlayed=false;
  c.spring=0;c.springV=0;c.gait=0;c.hurt=0;c.landing=0;c.death=false;c.lastVx=0;c.jumpKind='jump';
  c.body.scale.setScalar(1);c.body.rotation.set(0,0,0);c.body.position.y=0;
}

function transition(c,state,restart=false){
  if(c.state===state&&!restart)return;
  c.state=state;
  const action=c.actions[state];
  if(action&&!LOOPING.has(state))action.reset().play().setEffectiveWeight(c.weights[state]||0);
}

export function heroEvent(c,e){
  if(e.type==='jump'||e.type==='spring'||e.type==='squish'){
    c.jumpKind=e.type==='jump'&&Math.abs(c.lastVx)>2.4?'leap':'jump';
    c.springV=(e.type==='spring'?-5:-3)*IMPULSE;c.landing=0;
    transition(c,`${c.jumpKind}Rise`,true);
  }
  if(e.type==='land'){c.spring=landSquash(e.impact||7);c.springV=0;c.landing=.26;transition(c,'land',true);}
  if(e.type==='hurt'){c.hurt=.35;c.springV=3*IMPULSE;transition(c,'hurt',true);}
  if(e.type==='fall'){c.death=true;c.hurt=0;transition(c,'death',true);}
  if(e.type==='stomp')transition(c,'stomp',true);
  if(e.type==='complete')transition(c,'victory');
  if(e.type==='respawn'){
    if(c.flower){c.flower.root.visible=false;if(c.flower.basePose)for(const [bone,q] of c.flower.basePose)bone.quaternion.copy(q);c.flower.basePose=null;}
    c.idleTime=0;c.idleVariant='idle';c.longIdlePlayed=false;
    c.spring=0;c.springV=0;c.gait=0;c.hurt=0;c.landing=0;c.death=false;c.lastVx=0;c.jumpKind='jump';
    c.body.scale.setScalar(1);c.body.rotation.set(0,0,0);c.turn=0;c.root.rotation.y=0;
    if(c.loaded){for(const [name,action] of Object.entries(c.actions)){action.reset().play();action.setEffectiveWeight(name==='idle'?1:0);c.weights[name]=name==='idle'?1:0;}c.mixer.update(0);}
    c.state='idle';
  }
}

export function animateHero(w,game,dt,alpha=1){
  const c=w.character,p=game.player,paused=game.status==='paused';
  // Remove last frame's procedural pose before the mixer evaluates its clips.
  if(c.flower?.basePose){for(const [bone,q] of c.flower.basePose)bone.quaternion.copy(q);c.flower.basePose=null;}
  // Normal locomotion keeps running; the reward clock drives only the arm/head overlay.
  const step=paused?0:Math.min(dt,.05),air=!p.groundId;
  // Drawn `alpha` of the way between the last two ticks (camera.js `between`),
  // as the decks are, so a rider and their deck move as one.
  const x=between(p.prevX,p.x,alpha),y=between(p.prevY,p.y,alpha);
  c.clock+=step;c.root.position.set(x,y,.48);c.lastVx=p.vx;
  c.turn=damp(c.turn,p.facing<0?Math.PI:0,26,step);c.root.rotation.y=c.turn;
  if(c.loaded){
    c.hurt=Math.max(0,c.hurt-step);c.landing=Math.max(0,c.landing-step);
    const speed=game.status==='playing'?Math.abs(p.vx):0;
    if(!paused){
      const encounter=game.level.boss&&!['sleeping','defeated'].includes(game.level.boss.state);
      c.actions.idle.paused=!!encounter;
      if(encounter){c.actions.idle.time=0;c.weights.longIdle=0;c.actions.longIdle.setEffectiveWeight(0);}
      const resting=!encounter&&!game.flowerCelebration&&(game.status==='menu'||(game.status==='playing'&&!air&&speed<.08&&c.hurt===0&&c.landing===0&&!c.death));
      if(resting){
        c.idleTime+=step;
        const idleDelay=4;
        if(c.idleTime>=idleDelay&&!c.longIdlePlayed){
          c.longIdlePlayed=true;c.idleVariant='longIdle';
          c.actions.longIdle.reset().play().setEffectiveWeight(c.weights.longIdle);
        }
        // One fidget per uninterrupted rest, then settle into the standard idle.
        if(c.idleVariant==='longIdle'&&c.actions.longIdle.time>=c.clips.longIdle.duration-.001)c.idleVariant='idle';
      }else{c.idleTime=0;c.idleVariant='idle';c.longIdlePlayed=false;}
    }
    let state;
    if(c.death&&game.respawnTimer>0)state='death';
    else if(game.status==='complete')state='victory';
    else if(game.status==='menu')state='idle';
    else if(c.hurt>0||p.stunTime>0)state='hurt';
    else if(air)state=p.stomping?'stomp':`${c.jumpKind}${p.vy>0?'Rise':'Fall'}`;
    else if(c.landing>0&&speed<2.4)state='land';
    else state='locomotion';
    // Pausing freezes both the current pose and crossfade, even during a jump.
    if(!paused)transition(c,state);
    const target={};
    if(c.state==='locomotion'){
      const moving=clamp(speed/1.0,0,1),running=clamp((speed-2.5)/2.4,0,1);
      target[c.idleVariant]=1-moving;target.walk=moving*(1-running);target.run=moving*running;
    }else target[c.state==='idle'?c.idleVariant:c.state]=1;
    if(!air&&speed>.1)c.gait=(c.gait+step*speed/THREE.MathUtils.lerp(2.1,2.85,clamp((speed-2.5)/2.4,0,1)))%1;
    c.actions.walk.time=c.gait*c.clips.walk.duration;c.actions.run.time=c.gait*c.clips.run.duration;
    for(const [name,action] of Object.entries(c.actions)){
      c.weights[name]=damp(c.weights[name],target[name]||0,28,step);
      // LoopOnce sets paused on its last pose, which is intentional in midair.
      action.setEffectiveWeight(c.weights[name]<.00001?0:c.weights[name]);
    }
    c.mixer.update(step);
    // A small foot-anchored response complements, rather than distorts, the rig.
    c.springV+=(-IMPACT_K*c.spring-IMPACT_DAMP*c.springV)*step;c.spring+=c.springV*step;c.spring=clamp(c.spring,-IMPACT_LIMIT,IMPACT_LIMIT);
    const strength=w.reducedMotion?.25:1,windup=p.stompWindup>0?.07:0;
    const squash=(c.spring*IMPACT_GAIN+windup)*strength;
    c.body.scale.set(1+squash*IMPACT_SPREAD,1-squash,1+squash*IMPACT_SPREAD);
    const surface=game.level.platforms.find(s=>s.id===p.groundId);
    c.body.position.y=damp(c.body.position.y,surface?.kind==='stone'?.065:.02,24,step);
    const lean=p.skidding?.09:-p.vx*p.facing*.007;
    c.body.rotation.z=damp(c.body.rotation.z,lean*strength,18,step);
  }
  if(c.loaded)animateFlowerCelebration(c,game,w);
  if(p.stunTime>0&&!c.sporeMotes){
    c.sporeMotes=Array.from({length:3},()=>{const m=w.ball(.065,.075,.06,'cream',c.root);m.name='Spore daze mote';m.castShadow=false;return m;});
  }
  for(const [i,m]of (c.sporeMotes||[]).entries()){
    m.visible=p.stunTime>0;
    const angle=(w.reducedMotion?0:c.clock*8)+i*Math.PI*2/3;
    m.position.set(Math.cos(angle)*.35,(1.98+Math.sin(angle*2)*.04)*c.build,Math.sin(angle)*.24);
  }
  const dying=game.respawnTimer>0;
  c.root.visible=c.loaded&&(!dying||game.respawnTimer>.22)&&(!!game.flowerCelebration||dying||!(p.invuln>.1&&Math.floor(c.clock*10)%2===1));
  // Follow the nearest actual collision surface, including moving platforms.
  let beneath=null;
  for(const s of game.level.platforms)if(s.active&&!s.broken&&p.x>s.x-.2&&p.x<s.x+s.w+.2&&p.y>=s.y-.15&&(!beneath||s.y>beneath.y))beneath=s;
  c.shadow.visible=c.loaded&&!!beneath&&p.y-beneath.y<8&&!dying;
  // The pool under a bigger character is bigger; its softening with height is not.
  // The deck is drawn between ticks too, so the pool sits on the drawn deck.
  if(beneath){const floor=between(beneath.prevY,beneath.y,alpha),height=Math.max(0,y-floor),scale=c.build/(1+height*.15);c.shadow.position.set(x,floor+.10,.48);c.shadow.scale.set(scale,scale*.58,1);c.shadow.material.opacity=.22/(1+height*.36);}
}
