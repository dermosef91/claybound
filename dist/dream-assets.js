import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';
import {fixedMaterial,lid,slot} from './dream/support.js';

// The Soft Dream's supplied models: the Crooked Garden's watching flower, the
// Upside-Down Orchard's two clay planets, which stand in for the dome islands'
// spheres, its two frosted saucer bowls, which hang from the canopy on the
// orchard's ropes, and the Melted Parade's clay hat, stacked five high on the
// hat-worm's plinth. Loaded once per World, kept across level rebuilds, cloned
// per placement — the same shape as the forest's and the canyon's sets. The
// collision never comes from here: a dome is still the arc in simulation.js, a
// saucer is still its deck's flat top, the hats and the flowers are scenery;
// these only replace what is seen.
//
// The flower (dist/assets/dream-flower.glb, repacked with the others by
// scripts/prepare-dream-assets.py) is a clay flower with an eyeball for a
// heart, supplied as a single mesh with no rig and no pupil. Rigging it is
// done here at load: the mesh is cut in two where the petals begin, so the
// head can turn on its own pivot, and the eyeball is found on the head's face
// so a pupil can be set on it and slid toward the player. Every flower in the
// chapter is a clone of those two parts under its own pivots.
export const DREAM_FILES={flower:'dream-flower.glb',mint:'dream-planet-mint.glb',raspberry:'dream-planet-raspberry.glb',saucerMint:'dream-saucer-mint.glb',saucerRaspberry:'dream-saucer-raspberry.glb',hat:'dream-hat.glb'};

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

// The flower's petals begin this far up the model; below it is stem, leaves
// and root.
const HEAD_CUT=.62;
// The flower's eyeball as a share of the model's height, should the fit fail.
const EYE_RADIUS=.115;

// One mesh → two geometries sharing its vertex data: triangles whose centre is
// above the cut are the head, the rest the stem. Sharing the attributes costs
// nothing; only the index differs.
function splitFlower(geometry,cutY){
  const pos=geometry.attributes.position,index=geometry.index;
  const count=index?index.count:pos.count,at=i=>index?index.getX(i):i;
  const head=[],stem=[];
  for(let t=0;t+2<count;t+=3){
    const a=at(t),b=at(t+1),c=at(t+2);
    ((pos.getY(a)+pos.getY(b)+pos.getY(c))/3>=cutY?head:stem).push(a,b,c);
  }
  const part=(indices,name)=>{
    const g=new THREE.BufferGeometry();
    for(const key of Object.keys(geometry.attributes))g.setAttribute(key,geometry.attributes[key]);
    g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();g.name=name;return g;
  };
  return {head:part(head,'Flower head'),stem:part(stem,'Flower stem')};
}

// The eyeball is the head's forward bulge. Take the frontmost vertex of the
// head band near the stem's axis as the pole, then fit a sphere through the
// cap around it (least squares on x²+y²+z² = 2cx·x + 2cy·y + 2cz·z + k). A
// fit that is not a plausible eyeball falls back to a sphere of the expected
// radius resting behind the pole.
function findEye(geometry,box){
  const pos=geometry.attributes.position,h=box.max.y-box.min.y,cx=(box.min.x+box.max.x)/2;
  let pole=null;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    if(y<box.min.y+h*HEAD_CUT||Math.abs(x-cx)>h*.08)continue;
    if(!pole||z>pole.z)pole={x,y,z};
  }
  const fallback=()=>({centre:new THREE.Vector3(pole.x,pole.y,pole.z-h*EYE_RADIUS),radius:h*EYE_RADIUS});
  const A=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],b=[0,0,0,0];let n=0;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    if(z<pole.z-h*.06||Math.abs(x-pole.x)>h*.11||Math.abs(y-pole.y)>h*.11)continue;
    const r=[2*x,2*y,2*z,1],t=x*x+y*y+z*z;n++;
    for(let p=0;p<4;p++){b[p]+=r[p]*t;for(let q=0;q<4;q++)A[p][q]+=r[p]*r[q];}
  }
  if(n<12)return fallback();
  for(let i=0;i<4;i++){
    let m=i;for(let k=i+1;k<4;k++)if(Math.abs(A[k][i])>Math.abs(A[m][i]))m=k;
    [A[i],A[m]]=[A[m],A[i]];[b[i],b[m]]=[b[m],b[i]];
    if(Math.abs(A[i][i])<1e-12)return fallback();
    for(let k=i+1;k<4;k++){const f=A[k][i]/A[i][i];for(let j=i;j<4;j++)A[k][j]-=f*A[i][j];b[k]-=f*b[i];}
  }
  const v=[0,0,0,0];
  for(let i=3;i>=0;i--){let s=b[i];for(let j=i+1;j<4;j++)s-=A[i][j]*v[j];v[i]=s/A[i][i];}
  const centre=new THREE.Vector3(v[0],v[1],v[2]),radius=Math.sqrt(Math.max(0,v[3]+centre.lengthSq()));
  if(!Number.isFinite(radius)||radius<h*.07||radius>h*.16)return fallback();
  return {centre,radius};
}

export function prepareDreamAsset(w,key,gltf){
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0)||!DREAM_FILES[key])throw new Error('Invalid dream model: '+key);
  // Every model keeps the colours it was painted in and takes only the clay
  // surface relief.
  clayMaterials(gltf.scene);clayModel(w,gltf.scene);retainModel(w,gltf.scene);
  w.dreamAssets??={};const record=w.dreamAssets[key]={scene:gltf.scene,box,size,center};
  if(key!=='flower')return;
  // The flower's rig: its one mesh cut at the stem's top, and its eyeball found.
  let mesh=null;gltf.scene.traverse(o=>{if(o.isMesh&&!mesh)mesh=o;});
  if(!mesh)throw new Error('Invalid dream model: '+key);
  const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
  const cutY=box.min.y+size.y*HEAD_CUT,{head,stem}=splitFlower(mesh.geometry,cutY),eye=findEye(mesh.geometry,box);
  w.assetGeometry.add(head);w.assetGeometry.add(stem);
  Object.assign(record,{material,head,stem,cutY,eye});
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

// Pupil and lid are the same two colours on every flower: near-black clay
// polished as far as the relief shader allows, and the petals' pink.
const pupilMaterial=w=>fixedMaterial(w,'dreamPupil',0x1a1416,{roughness:.35,depth:.02});
const petalMaterial=w=>fixedMaterial(w,'dreamPetal',0xe8598a,{depth:.06});

// A watching flower, `height` tall, standing with its root at the parent's
// origin. Returns the parts the garden animates: `root` (turn it about z to
// lean the whole flower), `head` (a pivot at the stem's top), `gaze` (a group
// at the eyeball's centre holding the pupil — turn it to look somewhere) and
// `lid` (rotation.x −π/2 open … +π/2 shut).
export function dreamFlower(w,parent,{height=2}={}){
  const a=w.dreamAssets?.flower;
  const root=new THREE.Group();root.name='Watching flower';parent.add(root);
  if(!a?.head)return standInFlower(w,root,height);
  const s=height/a.size.y;root.scale.setScalar(s);
  const offset=new THREE.Vector3(-a.center.x,-a.box.min.y,-a.center.z),cut=a.cutY+offset.y;
  const stem=new THREE.Mesh(a.stem,a.material);stem.position.copy(offset);stem.castShadow=stem.receiveShadow=true;stem.name='Flower stem';root.add(stem);
  const head=new THREE.Group();head.name='Flower head pivot';head.position.set(0,cut,0);root.add(head);
  const petals=new THREE.Mesh(a.head,a.material);petals.position.copy(offset).y-=cut;petals.castShadow=petals.receiveShadow=true;petals.name='Flower head';head.add(petals);
  const R=a.eye.radius,eye=new THREE.Vector3().copy(a.eye.centre).add(offset);eye.y-=cut;
  const gaze=new THREE.Group();gaze.name='Flower gaze';gaze.position.copy(eye);head.add(gaze);
  const r=R*.34,pupil=w.ball(r,r,r*.6,pupilMaterial(w),gaze,0,0,R*.9);pupil.name='Flower pupil';
  w.ball(r*.28,r*.28,r*.16,'cream',gaze,-r*.38,r*.4,R*.9+r*.5).name='Flower glint';
  const shut=w.mesh(lid(w),petalMaterial(w),head,eye.x,eye.y,eye.z);shut.scale.setScalar(R*1.07);shut.rotation.x=-Math.PI/2;shut.name='Flower lid';
  return {root,head,gaze,pupil,lid:shut,eye:{radius:R,reach:R*.9},scale:s};
}
// Without the model (a bare test rig, or the file failed to load) a flower is
// still a flower: a stem, a ring of petals and an eye, in the same rig.
function standInFlower(w,root,height){
  const s=height,offset=.62;root.scale.setScalar(s);
  w.cylinder(.045,offset+.12,slot(w,'vine','dark'),root,0,(offset+.12)/2,0).name='Flower stem';
  const head=new THREE.Group();head.name='Flower head pivot';head.position.set(0,offset,0);root.add(head);
  const R=.115,eye=new THREE.Vector3(0,.16,0);
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;w.ball(.085,.085,.05,petalMaterial(w),head,eye.x+Math.cos(a)*.17,eye.y+Math.sin(a)*.17,-.01).name='Flower petal';}
  w.ball(R,R,R*.8,'cream',head,eye.x,eye.y,eye.z).name='Flower eyeball';
  const gaze=new THREE.Group();gaze.name='Flower gaze';gaze.position.copy(eye);head.add(gaze);
  const r=R*.34,pupil=w.ball(r,r,r*.6,pupilMaterial(w),gaze,0,0,R*.9);pupil.name='Flower pupil';
  const shut=w.mesh(lid(w),petalMaterial(w),head,eye.x,eye.y,eye.z);shut.scale.setScalar(R*1.07);shut.rotation.x=-Math.PI/2;shut.name='Flower lid';
  return {root,head,gaze,pupil,lid:shut,eye:{radius:R,reach:R*.9},scale:s};
}
