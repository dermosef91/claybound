// CPU export of actual scene geometry and embedded colour maps for visual review.
import * as THREE from '../dist/lib/three.module.js';
import {mkdir,writeFile} from 'node:fs/promises';

export async function exportReview(scene,backRoot,dir,data,images=new Map()){
  await mkdir(dir,{recursive:true});scene.updateMatrixWorld(true);
  const imagePaths=new Map();let imageIndex=0;
  for(const [key,image] of images){const name=`texture-${imageIndex++}.${image.mimeType==='image/png'?'png':'jpg'}`;await writeFile(`${dir}/${name}`,image.data);imagePaths.set(key,name);}
  const batches=new Map(),v=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3(),bgObjects=new Set();
  const c=data.camera,camera=new THREE.OrthographicCamera(-c.viewW/2,c.viewW/2,c.viewH/2,-c.viewH/2,.1,160);
  camera.position.set(c.x,c.y+c.elevation,c.z);camera.lookAt(c.x,c.y,0);camera.updateMatrixWorld(true);
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  backRoot?.traverse(o=>bgObjects.add(o));
  scene.traverse(o=>{
    if(!o.isMesh||!o.visible||o.material?.transparent)return;
    for(let p=o.parent;p;p=p.parent)if(!p.visible)return;
    const box=new THREE.Box3().setFromObject(o,true);
    if(!frustum.intersectsBox(box))return;
    const bg=bgObjects.has(o),mat=Array.isArray(o.material)?o.material[0]:o.material,z=o.getWorldPosition(v).z,key=mat.uuid+':'+bg+':'+(bg?Math.round(z/6):0);
    const relief=mat.userData.clay?.type==='relief';
    if(!batches.has(key))batches.set(key,{positions:[],normals:[],uvs:[],indices:[],bg,material:{color:mat.color.toArray(),roughness:mat.roughness,bump:!!mat.bumpMap&&!mat.map,bumpScale:mat.bumpScale||0,clay:mat.userData.clay?.type||null,normalTexture:imagePaths.get(mat.normalMap?.userData.sourceImage)||null,texture:imagePaths.get(mat.map?.userData.sourceImage)||null,z,emissiveIntensity:mat.emissiveIntensity||0,emissive:mat.emissive?.toArray()||[0,0,0],emissiveTexture:imagePaths.get(mat.emissiveMap?.userData.sourceImage)||null}});
    const b=batches.get(key),geo=o.geometry,base=b.positions.length/3,count=geo.attributes.position.count;normalMatrix.getNormalMatrix(o.matrixWorld);
    for(let i=0;i<count;i++){
      o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);b.positions.push(v.x,v.y,v.z);
      normal.fromBufferAttribute(geo.attributes.normal,i).applyMatrix3(normalMatrix).normalize();b.normals.push(normal.x,normal.y,normal.z);
      const uv=geo.attributes.uv;
      if(relief&&!mat.map){
        // Dominant-face projection approximates the runtime's triplanar blend.
        const pos=new THREE.Vector3().fromBufferAttribute(geo.attributes.position,i),scale=o.getWorldScale(new THREE.Vector3());pos.multiply(scale).add(new THREE.Vector3().fromArray(mat.userData.clayOffset||[0,0,0]));
        const period=mat.userData.clay.period||4.8;
        const n=new THREE.Vector3().fromBufferAttribute(geo.attributes.normal,i),axis=Math.abs(n.x)>.65?'x':Math.abs(n.y)>.65?'y':'z';
        b.uvs.push((axis==='x'?pos.y:pos.x)/period,(axis==='y'?pos.z:axis==='x'?pos.z:pos.y)/period);
      }else b.uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);
    }
    const ids=geo.index?.array||Array.from({length:count},(_,i)=>i);for(const index of ids)b.indices.push(base+index);
  });
  const items=[];let n=0,total=0;
  for(const b of batches.values()){
    const count=b.positions.length/3,faces=b.indices.length/3,name=`mesh-${n++}.ply`;
    const header=Buffer.from(`ply\nformat binary_little_endian 1.0\nelement vertex ${count}\nproperty float x\nproperty float y\nproperty float z\nproperty float nx\nproperty float ny\nproperty float nz\nproperty float s\nproperty float t\nelement face ${faces}\nproperty list uchar uint vertex_indices\nend_header\n`);
    const bytes=Buffer.alloc(count*32+faces*13);let offset=0;
    for(let i=0;i<count;i++)for(const x of [...b.positions.slice(i*3,i*3+3),...b.normals.slice(i*3,i*3+3),...b.uvs.slice(i*2,i*2+2)]){bytes.writeFloatLE(x,offset);offset+=4;}
    for(let i=0;i<faces;i++){bytes.writeUInt8(3,offset++);for(let j=0;j<3;j++){bytes.writeUInt32LE(b.indices[i*3+j],offset);offset+=4;}}
    await writeFile(`${dir}/${name}`,Buffer.concat([header,bytes]));items.push({file:name,background:b.bg,...b.material});total+=faces;
  }
  await writeFile(`${dir}/scene.json`,JSON.stringify({items,...data},null,2));
  console.log(`Exported ${items.length} material groups, ${total} triangles and ${imagePaths.size} source textures.`);
}
