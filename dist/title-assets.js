import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayMaterial} from './clay.js';

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
    o.geometry=geometry;o.material.roughness=.96;o.material.normalScale?.setScalar(.24);clayMaterial(world,o.material,.075);
  }});
  retainModel(world,scene);
  world.titleMesa={scene,bounds};
}

export async function loadTitleAssets(world){
  if(!world.titleMesa)prepareTitleMesa(world,await loadModel('title/cactus-mesa.glb'));
}
