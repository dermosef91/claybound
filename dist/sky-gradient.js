import * as THREE from './lib/three.module.js';

// One vertex-coloured quad far behind every layer is the whole sky: unfogged
// and untone-mapped so its stops show exactly. Two triangles, one draw.
// Stops are `[y,hex]` from top to bottom, in screen heights around the eye
// line; the parallax layer that carries the quad follows the camera.
export function skyGradient(w,parent,stops,{name='Sky gradient',depth=110,width=240,height=60}={}){
  const geo=new THREE.PlaneGeometry(width,height,1,stops.length-1),p=geo.attributes.position,colors=new Float32Array(p.count*3),c=new THREE.Color();
  for(let i=0;i<p.count;i++){
    const [y,hex]=stops[Math.floor(i/2)];c.setHex(hex);
    p.setY(i,y);colors.set([c.r,c.g,c.b],i*3);
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const sky=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,fog:false,toneMapped:false}));
  // The camera looks down at the play plane from its elevation, so a plane
  // this deep appears higher than its world height — seven and a half units
  // at the cave's depth; the offset puts the stops back at the screen heights
  // they name. Without it only the gradient's floor showed behind the route.
  sky.name=name;sky.position.set(0,1.2-depth*(w.theme?.cameraElevation??1.8)/26,-depth);parent.add(sky);return sky;
}
