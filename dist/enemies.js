import * as THREE from './lib/three.module.js';
import {clone} from './lib/SkeletonUtils.js';
import {loadModel,loadData,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';
import {createBatView,animateBat} from './bats.js';
import {createSporeView,animateSpore} from './spore-puff.js';
import {createDrifterView,animateDrifter} from './drifter.js';
import {createSpitterView,animateSpitter} from './spitter.js';
import {applyFlatten} from './clay-feel.js';

export async function loadEnemies(w,onProgress){
  const [gltf,motion]=await Promise.all([loadModel('enemy.glb',onProgress),loadData('enemy-motion.json')]);
  prepareEnemyAsset(w,gltf,motion);onProgress?.(1);
}
export function prepareEnemyAsset(w,gltf,motion){
  const source=gltf.animations.find(a=>a.name===motion.sourceClip);
  if(!source||!gltf.scene.getObjectByName('Hips')?.isBone)throw new Error('The enemy rig or walking animation is missing.');
  const clip=source.clone(),track=clip.tracks.find(t=>t.name===motion.rootTrack);
  if(!track||track.values.length!==motion.values.length||!(motion.height>0))throw new Error('The enemy motion data does not match its model.');
  track.values.set(motion.values);clip.name='Clayling walk';
  clayMaterials(gltf.scene,{orangeSource:.816});clayModel(w,gltf.scene);retainModel(w,gltf.scene);
  w.enemyAsset={scene:gltf.scene,clip,motion};
  for(const view of w.enemyViews?.values()||[])if(!['bat','drifter','spore','spitter'].includes(view.kind))attachEnemyView(w,view);
}
export function createEnemyView(w,e){
  if(e.kind==='spitter')return createSpitterView(w,e);
  if(e.kind==='spore')return createSporeView(w,e);
  if(e.kind==='bat')return createBatView(w,e);
  if(e.kind==='drifter')return createDrifterView(w,e);
  const root=new THREE.Group();root.name='Clayling '+e.id;root.position.set(e.x,e.y+.065,.35);w.levelRoot.add(root);
  const view={root,id:e.id,turn:e.dir>0?0:Math.PI,deathTime:0,loaded:false};
  root.rotation.y=view.turn;
  if(w.enemyAsset)attachEnemyView(w,view);return view;
}
function attachEnemyView(w,view){
  if(view.loaded)return;
  const {scene,clip,motion}=w.enemyAsset,model=clone(scene),orientation=new THREE.Group(),scale=.80/motion.height;
  orientation.rotation.y=Math.PI/2;orientation.scale.setScalar(scale);
  model.position.set(-motion.center[0],0,-motion.center[2]);orientation.add(model);view.root.add(orientation);
  const mixer=new THREE.AnimationMixer(model),action=mixer.clipAction(clip);action.play();action.time=(view.id*.21)%clip.duration;mixer.update(0);
  view.model=model;view.mixer=mixer;view.action=action;view.loaded=true;view.orientation=orientation;
}
export function animateEnemy(view,e,dt,status){
  if(!view)return;
  if(view.kind==='spitter'){animateSpitter(view,e,dt,status);return;}
  if(view.kind==='spore'){animateSpore(view,e,dt,status);return;}
  if(view.kind==='bat'){animateBat(view,e,dt,status);return;}
  if(view.kind==='drifter'){animateDrifter(view,e,dt,status);return;}
  const step=status==='paused'||status==='complete'?0:Math.min(dt,.05);
  view.root.position.set(e.x,e.y+.065,.35);
  if(!view.loaded)return;
  if(e.alive){
    view.deathTime=0;view.root.visible=true;view.root.scale.setScalar(1);
    const angle=e.dir>0?0:Math.PI;view.turn+=(angle-view.turn)*(1-Math.exp(-22*step));view.root.rotation.y=view.turn;
    view.action.setEffectiveTimeScale(e.speed/1.65);view.mixer.update(step);
  }else{
    view.deathTime+=step;applyFlatten(view.root,view.deathTime);
  }
}
export function releaseEnemyView(view){
  if(view?.mixer){
    view.mixer.stopAllAction();view.mixer.uncacheRoot(view.model);
  }
  view?.model?.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});
}
export function releaseEnemyViews(w){for(const view of w.enemyViews?.values()||[])releaseEnemyView(view);}
