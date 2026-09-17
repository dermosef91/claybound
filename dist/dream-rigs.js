import * as THREE from './lib/three.module.js';

// Bones for the Soft Dream's supplied creatures. The caterpillar arrives as one
// static mesh, so it is given its skeleton here, once per World, before the
// clay materials go on; the giraffe arrives rigged by its vendor, so what it
// needs is a way to pose and drive bones whose local frames are arbitrary. Both
// are animated the way the echo spitter is (spitter.js): a rest pose is
// snapshotted, put back every frame, and the motion is layered on top — no
// AnimationMixer, so a paused frame, a restore and a replay all pose the same.

// --- the caterpillar's rig -----------------------------------------------------
// Seven stations along the body from the curled tail to the head, in the
// upload's own unit-length model space (the body runs along +x, the head at
// +x). Every bone hangs off one root rather than off the bone before it: the
// walk is a travelling hump — each station lifted in turn, as the sculpted
// segments were — and a flat rig lets a station rise on its own without
// swinging everything after it. The last station is the head's pivot, at the
// neck, so the raised face (x .28 to .5) turns as one piece.
export const CATERPILLAR_RIG={stations:[-.45,-.3,-.15,0,.15,.28,.40],headY:.2};
export const CATERPILLAR_HEAD='Caterpillar head bone';

// Turn the caterpillar's mesh into a skinned mesh over CATERPILLAR_RIG. Each
// vertex is shared between the two stations around it by how far along it
// lies, so the skin between stations stretches smoothly and the ends — tail
// and face — stay rigid. The geometry object is kept (retainModel will hold
// it), only gaining its skin attributes. Returns the skinned mesh.
export function rigCaterpillar(scene){
  let mesh=null;scene.traverse(o=>{if(o.isMesh&&!mesh)mesh=o;});
  if(!mesh||mesh.isSkinnedMesh)return mesh;
  const {stations,headY}=CATERPILLAR_RIG,n=stations.length,head=n-1;
  const root=new THREE.Bone();root.name='Caterpillar root';
  const bones=stations.map((x,i)=>{
    const b=new THREE.Bone();b.name=i===head?CATERPILLAR_HEAD:`Caterpillar bone ${i}`;
    b.position.set(x,i===head?headY:0,0);root.add(b);return b;
  });
  const p=mesh.geometry.attributes.position,index=new Uint16Array(p.count*4),weight=new Float32Array(p.count*4);
  for(let v=0;v<p.count;v++){
    const x=p.getX(v);let i=0;while(i<n-2&&x>stations[i+1])i++;
    const t=Math.min(1,Math.max(0,(x-stations[i])/(stations[i+1]-stations[i])));
    index[v*4]=i;index[v*4+1]=i+1;weight[v*4]=1-t;weight[v*4+1]=t;
  }
  mesh.geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(index,4));
  mesh.geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weight,4));
  const skinned=new THREE.SkinnedMesh(mesh.geometry,mesh.material);
  skinned.name=mesh.name;skinned.position.copy(mesh.position);skinned.quaternion.copy(mesh.quaternion);skinned.scale.copy(mesh.scale);
  const parent=mesh.parent;parent.add(skinned);parent.remove(mesh);
  // The bones live beside the mesh under the scene: SkeletonUtils.clone only
  // re-binds bones it finds inside the object it clones.
  scene.add(root);
  // Skeleton() reads each bone's matrixWorld for the bind pose; fresh bones
  // carry identity until the tree is updated, so this update is load-bearing.
  scene.updateMatrixWorld(true);
  skinned.bind(new THREE.Skeleton(bones),skinned.matrixWorld);
  return skinned;
}

// The caterpillar's walk on its rig, layered over the rest pose: a hump
// travels down the stations from the tail, each lifted and stretched in turn
// (never pushed below its feet), and the head nods at the neck. `wave` is 1
// walking and about .3 standing, the way the sculpted beads bobbed; `rig` is
// what dreamCaterpillar hands back. A paused frame holds exactly.
export function caterpillarWalk(rig,t,wave){
  restoreRest(rig.rest);
  // rest[0] is the root bone; the stations follow it tail first, the head last.
  rig.rest.forEach((r,i)=>{
    if(i===0||r.bone===rig.head)return;
    const s=Math.sin(t*10-(i-1)*1.2);
    r.bone.position.y+=Math.max(0,s)*.035*wave;r.bone.scale.y=1+s*.08*wave;
  });
  rig.head.rotation.z=Math.sin(t*10+.6)*.025*wave;
}

// --- rest poses and overlays ---------------------------------------------------------
// Every bone's local transform, to put back at the start of each frame.
export function snapshotRest(model){
  const rest=[];model.traverse(o=>{if(o.isBone)rest.push({bone:o,position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});});
  return rest;
}
export function restoreRest(rest){
  for(const r of rest){r.bone.position.copy(r.position);r.bone.quaternion.copy(r.quaternion);r.bone.scale.copy(r.scale);}
}
// An axis given in the frame `root` sits in (the deck's, for a placed model),
// expressed in `bone`'s parent's frame — where a rotation has to be applied
// for it to turn the bone about that axis. A vendor rig's bones point every
// which way, so no bone's own x, y or z can be trusted to mean anything.
export function parentAxis(bone,axis,root){
  const q=new THREE.Quaternion();
  for(let o=bone.parent;o&&o!==root.parent;o=o.parent)q.premultiply(o.quaternion);
  return axis.clone().applyQuaternion(q.invert()).normalize();
}
const turn=new THREE.Quaternion();
// Turn `bone` by `angle` about an axis already in its parent's frame.
export function rotateAbout(bone,axisParent,angle){bone.quaternion.premultiply(turn.setFromAxisAngle(axisParent,angle));}

// --- the giraffe's pose ------------------------------------------------------------
// The vendor's joint names after GLTFLoader strips the "tripo::" prefixes.
export const GIRAFFE_BONES={
  spine:['tripoSpine_0','tripoSpine_1','tripoSpine_2','tripoSpine_3'],
  neck:['tripoHead_0','tripoHead_1','tripoHead_2','tripoHead_3'],
  head:'tripoHead_2',withers:'tripoSpine_3',
  // Hips in marching order: the diagonal pairs (0,2) and (1,3) swing together.
  hips:['tripo0_Left_Limb_0','tripo1_Right_Limb_0','tripo0_Right_Limb_0','tripo1_Left_Limb_0'],
  knees:['tripo0_Left_Limb_1','tripo1_Right_Limb_1','tripo0_Right_Limb_1','tripo1_Left_Limb_1']
};
// How the parade's giraffe stands, fitted so the player climbs the animal
// itself: the level's ledges are its body. The back deck lies along its back,
// the collar deck rests in the crook of its neck and the head deck is the top
// of its head — so the neck rises straight from the withers, bends forward at
// the crook and runs level to the head, which is turned back upright. The
// upload is a compact, short-necked thing a unit long; the spine's and each
// neck bone's offset from its parent is lengthened (the skin between stations
// stretches with them, as soft clay would) and each neck bone turned about the
// world's side axis — negative tips the neck toward +x, its facing. `neck` is
// one entry per tripoHead_0..3: tripoHead_2 carries the head, so its turn is
// the head's own. backTop is the model-space height of the back's surface,
// which dreamGiraffe scales to the back deck's top; the rest were settled with
// scripts/fit-dream-creatures.mjs against the parade's decks.
// At rest the neck leaves the withers at 45° forward, then 16°, 9° and level
// segment by segment; `base` turns the withers bone (tripoSpine_3, whose only
// children are the neck) to stand the first segment up, and the leans below
// are measured from there: the second segment a little forward, the third
// level, the head turned back to face ahead with a slight droop.
export const GIRAFFE_POSE={backTop:.46,bodyStretch:2,base:.785,
  neck:[{stretch:1.93,lean:-.77},{stretch:1.93,lean:-1.43},{stretch:1.65,lean:1.18},{stretch:1,lean:0}],
  lift:{bone:'tripo1_Left_Limb_0',pitch:-.25}};
const Z=new THREE.Vector3(0,0,1),Y=new THREE.Vector3(0,1,0);
// Pose the cloned giraffe once: yaw it so its spine runs along +x (the upload
// stands some thirty degrees across its own box), stretch the body, then
// stretch and turn the neck bone by bone, and lift one hind leg. Returns the
// yaw applied.
export function poseGiraffe(model,pose=GIRAFFE_POSE){
  const bone=name=>{const b=model.getObjectByName(name);if(!b)throw new Error('The giraffe rig has no bone '+name);return b;};
  model.updateMatrixWorld(true);
  const a=bone(GIRAFFE_BONES.spine[0]).getWorldPosition(new THREE.Vector3()),b=bone(GIRAFFE_BONES.spine[3]).getWorldPosition(new THREE.Vector3());
  const yaw=Math.atan2(b.z-a.z,b.x-a.x);model.rotation.y=yaw;
  for(const name of GIRAFFE_BONES.spine.slice(1))bone(name).position.multiplyScalar(pose.bodyStretch);
  const neck=GIRAFFE_BONES.neck.map(bone),withers=bone(GIRAFFE_BONES.withers);
  neck.forEach((n,i)=>n.position.multiplyScalar(pose.neck[i].stretch));
  model.updateMatrixWorld(true);
  // Turns about one shared axis leave that axis fixed in every child's frame,
  // so each bone's axis can be read once from the unturned rest.
  const axes=neck.map(n=>parentAxis(n,Z,model));
  if(pose.base)rotateAbout(withers,parentAxis(withers,Z,model),pose.base);
  neck.forEach((n,i)=>{if(pose.neck[i].lean)rotateAbout(n,axes[i],pose.neck[i].lean);});
  if(pose.lift){const hip=bone(pose.lift.bone);rotateAbout(hip,parentAxis(hip,Z,model),pose.lift.pitch);}
  model.updateMatrixWorld(true);
  return yaw;
}
export {Z as SIDE_AXIS,Y as UP_AXIS};
