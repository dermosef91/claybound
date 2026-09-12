import * as THREE from './lib/three.module.js';
import {rampProfile} from './shaping.js';
// Keep vertices across the broad faces, so curved collision profiles also
// curve between the corners. Corner-only rounded boxes leave a flat centre.
function roundedGrid(radius){
  const geometry=new THREE.BoxGeometry(1,1,1,24,16,8),a=geometry.attributes.position,half=.5-radius;
  for(let i=0;i<a.count;i++){
    const point=new THREE.Vector3().fromBufferAttribute(a,i),inner=point.clone().clampScalar(-half,half);
    point.sub(inner).normalize().multiplyScalar(radius).add(inner);a.setXYZ(i,point.x,point.y,point.z);
  }
  return geometry;
}

export function createClayView(w,s,root){
  root.name='Shapeable clay · '+s.id;
  const pieces=[],monolithic=['ramp','bridge'].includes(s.clayRole);
  for(const cap of monolithic?[false]:[false,true]){
    // Private buffers deform in place; the existing clay material supplies surface relief.
    const mesh=new THREE.Mesh(roundedGrid(cap?.22:.06),w.mat[cap||['ramp','bridge'].includes(s.clayRole)?'top':'terrain']);
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    pieces.push({mesh,rest:mesh.geometry.attributes.position.array.slice(),cap});
  }
  const marker=new THREE.Group();root.add(marker);marker.name='Clay grip';
  const grip=w.mesh(new THREE.TorusGeometry(.2,.045,8,24),'cream',marker,0,0,0);
  for(const dx of [-.12,0,.12])w.ball(.026,.075,.025,'cream',marker,dx,0,.04);
  const view={root,clay:{pieces,marker,grip},ropes:[],bounce:0};updateClayView(view,s);return view;
}
export function updateClayView(view,s){
  if(!view.clay)return;
  const {pieces,marker}=view.clay,key=[s.x,s.w,s.y,s.h,s.slope].join(':');
  if(view.clay.key===key)return;view.clay.key=key;
  const depth=s.clayRole==='landing'?3:2.6,monolithic=['ramp','bridge'].includes(s.clayRole);
  for(const {mesh,rest,cap}of pieces){
    const a=mesh.geometry.attributes.position;
    for(let i=0;i<a.count;i++){
      const u=rest[i*3]+.5,v=rest[i*3+1]+.5,z=rest[i*3+2];
      const rise=(s.slope||0)*(s.clayRole==='ramp'?rampProfile(u):u);
      const h=cap?.35:s.h+(s.clayRole==='ramp'?rise:0),top=rise-(cap||monolithic?0:.23);
      let width=s.w;
      if(s.clayRole==='landing'&&!cap)width=1.5+(s.w-1.5)*Math.pow(v,5);
      a.setXYZ(i,s.w/2+(u-.5)*width,top-(1-v)*h,z*(cap?depth+.16:depth)+Math.sin(u*s.w*3.1+v*s.h*2.2)*.018*Math.sin(z*3));
    }
    a.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  }
  marker.position.set(s.w*.5,(s.slope||0)*.5-.55,depth*.5+.12);
}
