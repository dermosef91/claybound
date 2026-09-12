import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayMaterial} from './clay.js';

// The imported sculpture is one mesh. Only the cloth beyond its sewn edge
// receives morph deltas; built-in morphing also carries them into the shadows.
function prepareFlagWind(geometry,source,normalGroups){
  const p=geometry.attributes.position,n=geometry.attributes.normal;
  const cloth=[];
  for(let i=0;i<source.count;i++){
    const x=source.getX(i),y=source.getY(i),z=source.getZ(i);
    if(x>.165&&y>.2&&y<.49&&z>-.5&&z<-.25)cloth.push(i);
  }
  if(!cloth.length)return;
  const positions=[],normals=[];
  for(let target=0;target<4;target++){
    const detail=target>=2,quadrature=target%2===1,delta=new Float32Array(p.count*3);
    for(const i of cloth){
      const u=THREE.MathUtils.clamp((source.getX(i)-.165)/.247,0,1),weight=u*u*(3-2*u);
      const phase=-u*(detail?9.2:4.6)+(source.getY(i)-.35)*(detail?11:3)+(quadrature?Math.PI/2:0);
      delta[i*3+1]=weight*(detail?.0015:.008)*Math.cos(phase);
      delta[i*3+2]=weight*(detail?.004:.022)*Math.sin(phase);
    }
    const posed=geometry.clone(),pp=posed.attributes.position;
    for(const i of cloth)pp.setXYZ(i,p.getX(i),p.getY(i)+delta[i*3+1],p.getZ(i)+delta[i*3+2]);
    posed.computeVertexNormals();
    const pn=posed.attributes.normal,sum=new THREE.Vector3(),v=new THREE.Vector3();
    for(const {indices}of normalGroups.values()){
      sum.set(0,0,0);for(const i of indices)sum.add(v.fromBufferAttribute(pn,i));sum.normalize();
      for(const i of indices)pn.setXYZ(i,sum.x,sum.y,sum.z);
    }
    const normalDelta=new Float32Array(n.count*3);
    for(const i of cloth)for(let axis=0;axis<3;axis++)normalDelta[i*3+axis]=pn.array[i*3+axis]-n.array[i*3+axis];
    positions.push(new THREE.Float32BufferAttribute(delta,3));
    normals.push(new THREE.Float32BufferAttribute(normalDelta,3));
    posed.dispose();
  }
  geometry.morphTargetsRelative=true;geometry.morphAttributes.position=positions;geometry.morphAttributes.normal=normals;
  geometry.userData.titleFlagWind=true;
  // Include both wave amplitudes in culling bounds.
  geometry.boundingBox.expandByScalar(.03);geometry.boundingSphere.radius+=.03;
}

// Keep the source GLB and UVs intact; title-only proportions are applied to a copy.
export function prepareTitleMesa(world,gltf){
  const scene=gltf.scene;
  scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(scene,true);
  if(bounds.isEmpty())throw new Error('The title mesa has no geometry.');
  clayMaterials(scene,{orangeSource:.882});
  scene.traverse(o=>{if(o.isMesh){
    const geometry=o.geometry.clone(),positions=geometry.attributes.position;
    // The menu camera presents a broad mesa. Compensate its upper dressing so
    // the cactus stays slender and the flag leaves breathing room by the hero.
    const sourceX=[-1,-.4,-.18,.04,.1,.42,.65,1],titleX=[-.78,-.31,-.18,-.05,-.035,.2,.65,1.1];
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i);
      let section=0;while(section<sourceX.length-2&&x>sourceX[section+1])section++;
      const t=(x-sourceX[section])/(sourceX[section+1]-sourceX[section]);
      // A continuous monotonic warp through the whole sculpture keeps the
      // connected pole, roots and plateau intact, with no cut or seam.
      positions.setXY(i,THREE.MathUtils.lerp(titleX[section],titleX[section+1],t),y>0?y*(x>.045?.97:.84):y);
    }
    // Smooth coincident normals across UV seams after the title-only shaping.
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const p=geometry.attributes.position,n=geometry.attributes.normal,groups=new Map();
    for(let i=0;i<p.count;i++){
      const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(':');
      if(!groups.has(key))groups.set(key,{sum:new THREE.Vector3(),indices:[]});
      const group=groups.get(key);group.sum.add(new THREE.Vector3().fromBufferAttribute(n,i));group.indices.push(i);
    }
    for(const {sum,indices}of groups.values()){sum.normalize();for(const i of indices)n.setXYZ(i,sum.x,sum.y,sum.z);}
    prepareFlagWind(geometry,o.geometry.attributes.position,groups);
    o.geometry=geometry;o.updateMorphTargets();o.material.roughness=.96;o.material.normalScale?.setScalar(.24);clayMaterial(world,o.material,.075);
  }});
  retainModel(world,scene);
  world.titleMesa={scene,bounds};
}

export async function loadTitleAssets(world){
  if(!world.titleMesa)prepareTitleMesa(world,await loadModel('title/cactus-mesa.glb'));
}
