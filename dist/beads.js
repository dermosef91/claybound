import * as THREE from './lib/three.module.js';
import {clayMaterial,sculptClay} from './clay.js';

export function createBead(w,parent){
  if(!w.beadGeometry){
    // The reward artwork's recessed disc, rolled rim and raised central dot.
    const profile=[[0,-.045],[.15,-.045],[.204,-.032],[.231,-.005],[.236,.028],[.225,.052],[.207,.063],[.189,.057],[.179,.036],[.175,.018],[.09,.018],[.082,.03],[.077,.061],[.057,.083],[.028,.092],[0,.095]].map(([x,y])=>new THREE.Vector2(x,y));
    const geo=new THREE.LatheGeometry(profile,36);geo.rotateX(Math.PI/2);
    w.beadGeometry=sculptClay(w,geo,{amplitude:.007});w.assetGeometry.add(w.beadGeometry);
    w.beadMaterial=clayMaterial(w,new THREE.MeshStandardMaterial({color:0xedb82b,roughness:.89,metalness:0,emissive:0x87501c,emissiveIntensity:.10}),.045);
    w.assetMaterials.add(w.beadMaterial);
  }
  const mesh=new THREE.Mesh(w.beadGeometry,w.beadMaterial);mesh.name='Golden clay bead';mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
