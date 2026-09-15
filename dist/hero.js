import * as THREE from './lib/three.module.js';
import {GLTFLoader} from './lib/GLTFLoader.js';
import {clayModel} from './clay.js';
import {assetURL} from './model-assets.js';
import {animateFlowerCelebration} from './flower-celebration.js';

const clamp=THREE.MathUtils.clamp;
const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
const MODEL_HEIGHT=1.78;
const SOURCE={idle:'Armature|Idle_9|baselayer',longIdle:'Idle_03',walk:'Walking',run:'Running',jump:'Regular_Jump',leap:'Jump_Over_Obstacle_2',hurt:'Face_Punch_Reaction_2',death:'Knock_Down',victory:'Skip_Forward'};
const LOOPING=new Set(['idle','walk','run','victory']);

export function createHero(w){
  const root=new THREE.Group(),body=new THREE.Group(),facing=new THREE.Group();
  root.name='Player';body.name='Impact response';facing.name='Model orientation';
  root.add(body);body.add(facing);facing.rotation.y=Math.PI/2;
  // The gameplay origin is at the feet. Imported mesh transforms never move it.
  const shadow=w.mesh(new THREE.CircleGeometry(.55,30),w.mat.shadow.clone(),w.scene);
  shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;shadow.receiveShadow=false;shadow.visible=false;
  return {root,body,facing,shadow,loaded:false,actions:{},weights:{},state:'idle',idleTime:0,idleVariant:'idle',longIdlePlayed:false,turn:0,spring:0,springV:0,gait:0,clock:0,hurt:0,landing:0,death:false,jumpKind:'jump',lastVx:0};
}

export async function loadHero(w,onProgress){
  const [gltf,motion,idle]=await Promise.all([
    new GLTFLoader().loadAsync(assetURL('player.glb'),e=>onProgress?.(e.total?e.loaded/e.total:null)),
    fetch(assetURL('player-motion.json')).then(r=>{if(!r.ok)throw new Error('Character motion data could not load.');return r.json();}),
    fetch(assetURL('player-idle.json')).then(r=>{if(!r.ok)throw new Error('The new idle animation could not load.');return r.json();})
  ]);
  attachHero(w,gltf,motion,idle);onProgress?.(1);
  return w.character;
}

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

export function makeHeroClips(animations,motion,idle){
  if(!idle||idle.playerSha256!==motion.sourceSha256)throw new Error('The idle animation does not match this character.');
  const originals=new Map([...animations,THREE.AnimationClip.parse(idle.clip)].map(clip=>[clip.name,clip]));
  function prepare(source,name,mode,start,end){
    const original=originals.get(source);if(!original)throw new Error(`Character animation is missing: ${source}`);
    const clip=original.clone(),track=clip.tracks.find(t=>t.name==='Hips.position');
    if(!track)throw new Error(`Character root animation is missing: ${source}`);
    const correction=source===SOURCE.idle?idle.ground:motion.clips[source];
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

export function attachHero(w,gltf,motion,idle){
  const c=w.character;
  if(c.loaded)throw new Error('The character has already been loaded.');
  const hips=gltf.scene.getObjectByName('Hips');if(!hips?.isBone)throw new Error('The supplied character has no usable skeleton.');
  gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene,true),height=bounds.max.y-bounds.min.y;
  if(!Number.isFinite(height)||height<=0)throw new Error('The character has invalid geometry.');
  const scale=MODEL_HEIGHT/height,model=new THREE.Group();model.name='Normalized custom character';
  model.scale.setScalar(scale);model.position.set(0,-bounds.min.y*scale,-motion.anchor[2]*.01*scale);
  model.add(gltf.scene);c.facing.add(model);c.model=model;c.asset=gltf.scene;c.hips=hips;
  const maxAnisotropy=Math.min(4,w.renderer?.capabilities.getMaxAnisotropy()||4);
  gltf.scene.traverse(o=>{
    if(!o.isMesh)return;
    o.castShadow=true;o.receiveShadow=true;
    // One skinned mesh: avoid stale rest-pose bounds culling a jump or turn.
    o.frustumCulled=false;
    for(const material of Array.isArray(o.material)?o.material:[o.material]){
      // Keep the supplied surface detail while matching its orange pigment.
      material.userData.clayOrangeSource=.780;
      material.roughness=.94;material.metalness=0;material.emissiveIntensity=0;
      if('specularIntensity' in material)material.specularIntensity=.22;
      if(material.map)material.map.anisotropy=maxAnisotropy;
      material.needsUpdate=true;
    }
  });
  clayModel(w,gltf.scene);
  c.clips=makeHeroClips(gltf.animations,motion,idle);c.sourceClips=[...gltf.animations.map(a=>a.name),idle.clip.name];
  c.mixer=new THREE.AnimationMixer(gltf.scene);
  for(const [name,clip] of Object.entries(c.clips)){
    const a=c.mixer.clipAction(clip);a.setLoop(LOOPING.has(name)?THREE.LoopRepeat:THREE.LoopOnce,LOOPING.has(name)?Infinity:1);
    a.clampWhenFinished=!LOOPING.has(name);a.play();a.setEffectiveWeight(name==='idle'?1:0);c.actions[name]=a;c.weights[name]=name==='idle'?1:0;
  }
  c.actions.walk.setEffectiveTimeScale(0);c.actions.run.setEffectiveTimeScale(0);
  c.actions.land.setEffectiveTimeScale(1.9);c.actions.hurt.setEffectiveTimeScale(1.9);c.actions.death.setEffectiveTimeScale(3.4);
  c.loaded=true;c.mixer.update(0);c.root.updateMatrixWorld(true);
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
    c.springV=e.type==='spring'?-5:-3;c.landing=0;
    transition(c,`${c.jumpKind}Rise`,true);
  }
  if(e.type==='land'){c.springV=Math.min(6,(e.impact||7)*.35);c.landing=.26;transition(c,'land',true);}
  if(e.type==='hurt'){c.hurt=.35;c.springV=3;transition(c,'hurt',true);}
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

export function animateHero(w,game,dt){
  const c=w.character,p=game.player,paused=game.status==='paused';
  // Remove last frame's procedural pose before the mixer evaluates its clips.
  if(c.flower?.basePose){for(const [bone,q] of c.flower.basePose)bone.quaternion.copy(q);c.flower.basePose=null;}
  const step=paused?0:Math.min(dt,.05),air=!p.groundId;
  c.clock+=step;c.root.position.set(p.x,p.y,.48);c.lastVx=p.vx;
  c.turn=damp(c.turn,p.facing<0?Math.PI:0,26,step);c.root.rotation.y=c.turn;
  if(c.loaded){
    c.hurt=Math.max(0,c.hurt-step);c.landing=Math.max(0,c.landing-step);
    const speed=game.status==='playing'&&!game.flowerCelebration?Math.abs(p.vx):0;
    if(!paused){
      const resting=!game.flowerCelebration&&(game.status==='menu'||(game.status==='playing'&&!air&&speed<.08&&c.hurt===0&&c.landing===0&&!c.death));
      if(resting){
        c.idleTime+=step;
        const idleDelay=game.status==='menu'?3:1;
        if(c.idleTime>idleDelay&&!c.longIdlePlayed){
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
    else if(game.status==='menu'||game.flowerCelebration)state='idle';
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
    c.springV+=(-320*c.spring-20*c.springV)*step;c.spring+=c.springV*step;c.spring=clamp(c.spring,-.18,.18);
    const strength=w.reducedMotion?.25:1,windup=p.stompWindup>0?.07:0;
    const squash=(c.spring*.45+windup)*strength;
    c.body.scale.set(1+squash*.35,1-squash,1+squash*.35);
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
    m.position.set(Math.cos(angle)*.35,1.98+Math.sin(angle*2)*.04,Math.sin(angle)*.24);
  }
  const dying=game.respawnTimer>0;
  c.root.visible=c.loaded&&(!dying||game.respawnTimer>.22)&&(game.flowerCelebration||dying||!(p.invuln>.1&&Math.floor(c.clock*10)%2===1));
  // Follow the nearest actual collision surface, including moving platforms.
  let beneath=null;
  for(const s of game.level.platforms)if(s.active&&!s.broken&&p.x>s.x-.2&&p.x<s.x+s.w+.2&&p.y>=s.y-.15&&(!beneath||s.y>beneath.y))beneath=s;
  c.shadow.visible=c.loaded&&!!beneath&&p.y-beneath.y<8&&!dying;
  if(beneath){const height=Math.max(0,p.y-beneath.y),scale=1/(1+height*.15);c.shadow.position.set(p.x,beneath.y+.10,.48);c.shadow.scale.set(scale,scale*.58,1);c.shadow.material.opacity=.22/(1+height*.36);}
}
