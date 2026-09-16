import * as THREE from './lib/three.module.js';
import {clone} from './lib/SkeletonUtils.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';
import {BAT} from './enemy-rules.js';
import {createBatEcho,animateBatEcho,batLookVector} from './bat-echo.js';
import {applyFlatten} from './clay-feel.js';

const front=new THREE.Vector3(0,0,1),centerY=(BAT.bottom+BAT.top)/2;

export async function loadBats(w,onProgress){
  if(w.batAsset){onProgress?.(1);return;}
  if(!w.batLoading)w.batLoading=loadModel('bat.glb',onProgress).then(gltf=>prepareBatAsset(w,gltf)).catch(error=>{w.batLoading=null;throw error;});
  await w.batLoading;onProgress?.(1);
}
export function prepareBatAsset(w,gltf){
  if(!gltf.scene.getObjectByName('Root')?.isBone)throw new Error('The bat skeleton is missing.');
  const clips={};
  for(const name of ['Fly','Hover','Swoop']){
    const source=gltf.animations.find(a=>a.name===name);if(!source)throw new Error('Missing bat animation: '+name);
    const clip=source.clone();
    // The flight path owns body travel. Preserve wing/body rotations, but
    // remove the clips' baked root drift so the body stays on its collider.
    clip.tracks=clip.tracks.filter(t=>t.name!=='Root.position');clips[name]=clip;
  }
  clayMaterials(gltf.scene);clayModel(w,gltf.scene);retainModel(w,gltf.scene);
  w.batAsset={scene:gltf.scene,clips};
  for(const view of w.enemyViews?.values()||[])if(view.kind==='bat')attachBatView(w,view);
}
export function createBatView(w,e){
  const root=new THREE.Group();root.name='Flying bat '+e.id;root.position.set(e.x,e.y+BAT.modelOffsetY,.35);w.levelRoot.add(root);
  const pose=new THREE.Group();pose.name='Bat facing';pose.position.y=centerY-BAT.modelOffsetY;root.add(pose);
  const echo=createBatEcho(w,root);
  const view={kind:'bat',root,pose,echo,id:e.id,loaded:false,deathTime:0,turn:0,aim:new THREE.Quaternion(),look:new THREE.Vector3(),reducedMotion:!!w.reducedMotion};
  if(w.batAsset)attachBatView(w,view);return view;
}
function attachBatView(w,view){
  if(view.loaded)return;
  const model=clone(w.batAsset.scene);model.scale.setScalar(BAT.scale);model.position.y+=BAT.modelOffsetY-centerY;view.pose.add(model);
  const mixer=new THREE.AnimationMixer(model),actions={};
  for(const [name,clip]of Object.entries(w.batAsset.clips)){
    const a=mixer.clipAction(clip);a.play();a.time=(view.id*.193)%clip.duration;a.setEffectiveWeight(name==='Hover'?1:0);actions[name]=a;
  }
  mixer.update(0);Object.assign(view,{model,mixer,actions,loaded:true});
}
export function animateBat(view,e,dt,status){
  const step=status==='playing'?Math.min(dt,.05):0;
  view.root.position.set(e.x,e.y+BAT.modelOffsetY,.35);if(!view.loaded)return;
  if(e.alive){
    view.root.visible=true;view.root.scale.setScalar(1);view.deathTime=0;
    const state=e.aiState||'patrol',charging=state==='charge',diving=state==='dive';
    if(view.state!==state){
      if(diving)view.actions.Swoop.reset().play();
      view.state=state;
    }
    view.actions.Hover.setEffectiveWeight(charging?1:0);
    view.actions.Fly.setEffectiveWeight(charging||diving?0:1);
    view.actions.Swoop.setEffectiveWeight(diving?1:0);
    view.actions.Hover.setEffectiveTimeScale(charging?1.45:1);
    view.actions.Fly.setEffectiveTimeScale(state==='retreat'?1.35:1);
    view.actions.Swoop.setEffectiveTimeScale(diving?view.actions.Swoop.getClip().duration/(e.diveDuration||.5):1);
    animateBatEcho(view.echo,e,status);
    view.mixer.update(step);
    view.root.rotation.set(0,0,0);
    if(state==='retreat'||charging||diving){
      batLookVector(e,view.look);
      // Preserve the target bearing in the play plane, but keep the face and
      // wing silhouette visible in this 2.5D camera instead of turning edge-on.
      view.look.z=view.look.length()*.9;view.look.normalize();
      if(view.look.lengthSq()>0)view.aim.setFromUnitVectors(front,view.look);
      // Turn toward the player during retreat. The charge and its waves
      // then share the locked dive direction, so the cue stays truthful.
      if(charging||diving)view.pose.quaternion.copy(view.aim);
      else view.pose.quaternion.slerp(view.aim,1-Math.exp(-14*step));
    }else{
      view.turn+=(e.dir*.22-view.turn)*(1-Math.exp(-7*step));
      view.aim.setFromEuler(new THREE.Euler(0,view.turn,-view.turn*.16));
      view.pose.quaternion.slerp(view.aim,status==='editing'?1:1-Math.exp(-9*step));
    }
  }else{
    // Pressed flat where it was hit, like every other creature, with its
    // echo rings stopped. The root is squashed rather than the facing pose, so
    // the press is always straight down whichever way the bat was turned;
    // clay-shatter.js then drops the clumps to whatever deck lies below.
    view.echo.root.visible=false;view.root.rotation.set(0,0,0);
    view.deathTime+=step;applyFlatten(view.root,view.deathTime,{reducedMotion:view.reducedMotion});
    // Nothing holds a swatted bat up: the disc sinks slowly while it is held,
    // but never below the deck settleSquash found under it.
    const fall=view.reducedMotion?0:3*view.deathTime*view.deathTime;
    view.root.position.y=Math.max(e.y+BAT.modelOffsetY-fall,view.squashFloorY!==undefined?view.squashFloorY+.12:-Infinity);
  }
}
