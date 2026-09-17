import * as THREE from './lib/three.module.js';
import {clone} from './lib/SkeletonUtils.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';
import {rigCaterpillar,snapshotRest,poseGiraffe,GIRAFFE_POSE,GIRAFFE_BONES,CATERPILLAR_HEAD} from './dream-rigs.js';

// The Soft Dream's supplied models: the Upside-Down Orchard's two clay
// planets, which stand in for the dome islands' spheres, its two frosted
// saucer bowls, which hang from the canopy on the orchard's ropes, the Melted
// Parade's clay hat — stacked five high on the hat-worm's plinth and three
// high on every hatworm's head — the caterpillar that is the hatworm's body,
// and the parade's giraffe. Loaded once per World, kept across level rebuilds,
// cloned per placement — the same shape as the forest's and the canyon's
// sets; the two creatures are skinned, so they clone through SkeletonUtils.
// The collision never comes from here: a dome is still the arc in
// simulation.js, a saucer is still its deck's flat top, the hatworm is still
// HATWORM in dream-enemy-rules.js and the giraffe's decks are still the
// level's ledges; these only replace what is seen.
export const DREAM_FILES={mint:'dream-planet-mint.glb',raspberry:'dream-planet-raspberry.glb',saucerMint:'dream-saucer-mint.glb',saucerRaspberry:'dream-saucer-raspberry.glb',hat:'dream-hat.glb',caterpillar:'dream-caterpillar.glb',giraffe:'dream-giraffe.glb'};

// Each planet's core orb in model space — the sphere the fruit and the leaf
// sprouts are stuck onto — fitted over every vertex by a modal-radius
// least-squares fit that rejects the decoration as outliers. dreamPlanet
// scales a planet by r/radius and shifts it by -center, so this orb IS the
// dome's collider and everything reaching past it is scenery the rider's spin
// carries round. The uploads are unit-height; tests/dream-models.mjs re-fits
// the shipped geometry against these numbers so a re-export cannot drift.
export const PLANET_ORBS={
  mint:{center:[.0210,.4632,-.0038],radius:.3704},
  raspberry:{center:[.0046,.4859,-.0166],radius:.3911}
};

export function prepareDreamAsset(w,key,gltf){
  // The caterpillar is boned here, before the clay materials go on (they mark
  // skinned meshes as never frustum-culled) and before the box is measured —
  // at rest the skin reproduces the mesh, so the box is the upload's own.
  if(key==='caterpillar')rigCaterpillar(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0)||!DREAM_FILES[key])throw new Error('Invalid dream model: '+key);
  clayMaterials(gltf.scene);clayModel(w,gltf.scene);retainModel(w,gltf.scene);
  w.dreamAssets??={};w.dreamAssets[key]={scene:gltf.scene,box,size,center};
}
export async function loadDreamAssets(w,onProgress){
  if(Object.keys(DREAM_FILES).every(key=>w.dreamAssets?.[key])){onProgress?.(1);return;}
  if(!w.dreamLoading){
    const progress=Object.keys(DREAM_FILES).map(()=>0);
    w.dreamLoading=Promise.all(Object.entries(DREAM_FILES).map(async([key,file],i)=>{
      if(w.dreamAssets?.[key]){progress[i]=1;return;}
      prepareDreamAsset(w,key,await loadModel(file,v=>{if(v!==null){progress[i]=v;onProgress?.(progress.reduce((a,b)=>a+b,0)/progress.length);}}));progress[i]=1;
    })).catch(e=>{w.dreamLoading=null;throw e;});
  }
  await w.dreamLoading;onProgress?.(1);
}
const asset=(w,key)=>{
  const a=w.dreamAssets?.[key];if(!a)throw new Error('Load the dream models before dressing the dream.');
  return a;
};
// A planet under `parent`, scaled so its core orb has `radius` with its centre
// on the parent's origin — the dome view's sphere group, which the spin turns.
export function dreamPlanet(w,key,parent,radius){
  const a=asset(w,key),orb=PLANET_ORBS[key],root=new THREE.Group(),model=a.scene.clone(true);
  root.name='Dream planet '+key;model.name='Supplied clay planet';
  root.scale.setScalar(radius/orb.radius);model.position.set(-orb.center[0],-orb.center[1],-orb.center[2]);
  root.add(model);parent.add(root);
  return root;
}
// A saucer bowl under `parent`, `width` across, its flat top on the parent's
// origin plane and its foot hanging below — the walk plane of the deck it dresses.
export function dreamSaucer(w,key,parent,width){
  const a=asset(w,key),root=new THREE.Group(),model=a.scene.clone(true);
  root.name='Dream saucer '+key;model.name='Supplied clay saucer';
  root.scale.setScalar(width/a.size.x);model.position.set(-a.center.x,-a.box.max.y,-a.center.z);
  root.add(model);parent.add(root);
  return root;
}
// The hat under `parent`, `width` across the brim, its foot — the brim's
// underside — on the parent's origin. The parade's hat groups are moved and
// spun about that foot, so a hat placed here tumbles exactly as the sculpted
// one did. The upload is modelled about its own centre; the shift puts the
// foot at the origin the way the saucer's puts its top there.
export function dreamHat(w,parent,width){
  const a=asset(w,'hat'),root=new THREE.Group(),model=a.scene.clone(true);
  root.name='Dream hat';model.name='Supplied clay hat';
  root.scale.setScalar(width/a.size.x);model.position.set(-a.center.x,-a.box.min.y,-a.center.z);
  root.add(model);parent.add(root);
  return root;
}
// How tall a hat `width` across stands, foot to crown — what a stack steps by.
export const dreamHatHeight=(w,width)=>{const a=asset(w,'hat');return width*a.size.y/a.size.x;};

// A vertex-accurate box of a placed skinned model, in `frame`'s own space:
// the skin is evaluated on the CPU, which is why this is for placement and
// tests, never per frame.
export function skinnedBox(model,frame=model){
  model.updateMatrixWorld(true);
  const inverse=frame.matrixWorld.clone().invert(),box=new THREE.Box3(),v=new THREE.Vector3();
  model.traverse(o=>{
    if(!o.isMesh)return;const count=o.geometry.attributes.position.count;
    for(let i=0;i<count;i++)box.expandByPoint(o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld).applyMatrix4(inverse));
  });
  return box;
}

// The caterpillar under `parent`, `length` long, its feet on the parent's
// origin plane and centred on it — the hatworm's body. Cloned with its
// skeleton, with the rest pose kept so the walk can be layered on each frame.
export function dreamCaterpillar(w,parent,length){
  const a=asset(w,'caterpillar'),root=new THREE.Group(),model=clone(a.scene),scale=length/a.size.x;
  root.name='Dream caterpillar';model.name='Supplied clay caterpillar';
  root.scale.setScalar(scale);model.position.set(-a.center.x,-a.box.min.y,-a.center.z);
  root.add(model);parent.add(root);
  return {root,model,scale,rest:snapshotRest(model),head:model.getObjectByName(CATERPILLAR_HEAD)};
}
// The giraffe under `parent`, posed for the parade (dream-rigs.js), scaled so
// the surface of its back stands `backTop` above the parent's origin plane,
// where its feet stand; its withers — the last spine bone, where the neck
// leaves the body — at `withersX` along the parent's x. The rest pose kept is
// the posed one, so the lean and the march are layered over the parade stance.
export function dreamGiraffe(w,parent,{backTop,withersX=0}){
  const a=asset(w,'giraffe'),root=new THREE.Group(),model=clone(a.scene),scale=backTop/GIRAFFE_POSE.backTop;
  root.name='Dream giraffe';model.name='Supplied clay giraffe';
  root.scale.setScalar(scale);root.add(model);parent.add(root);
  const yaw=poseGiraffe(model),rest=snapshotRest(model);
  const bone=name=>model.getObjectByName(name);
  const bones={neck:GIRAFFE_BONES.neck.map(bone),hips:GIRAFFE_BONES.hips.map(bone),knees:GIRAFFE_BONES.knees.map(bone),head:bone(GIRAFFE_BONES.head),withers:bone(GIRAFFE_BONES.withers)};
  const box=skinnedBox(model,root),withers=bones.withers.getWorldPosition(new THREE.Vector3()).applyMatrix4(root.matrixWorld.clone().invert());
  model.position.set(withersX/scale-withers.x,-box.min.y,-(box.min.z+box.max.z)/2);
  root.updateMatrixWorld(true);
  return {root,model,scale,yaw,rest,bones};
}
