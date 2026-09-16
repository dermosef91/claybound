import * as THREE from './lib/three.module.js';

// Small, thick, pointed clay leaves reuse the world's clay materials.
const shape=new THREE.Shape();
shape.moveTo(0,-.75);shape.bezierCurveTo(-.48,-.3,-.5,.35,.12,.85);
shape.bezierCurveTo(.44,.28,.38,-.38,0,-.75);
const geometry=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSize:.065,bevelThickness:.065,bevelSegments:2,steps:1,curveSegments:5});
geometry.translate(0,0,-.06);

export function burstDrifterLeaves(w,x,y){
  // Fewer than there were: the body now also breaks into clay clumps behind them.
  const count=Math.max(0,Math.min(w.reducedMotion?5:10,110-w.particles.length));
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2+.15*(Math.random()-.5),size=.14+Math.random()*.075;
    const m=w.mesh(geometry,i%3?'orangeLight':'cream',w.fxRoot,x,y,.35);
    m.name='Drifter clay leaf';m.castShadow=false;m.receiveShadow=false;
    m.scale.set(size,size,.8*size);m.rotation.set(Math.random()*2,Math.random()*2,a);
    w.assetGeometry??=new Set();w.assetGeometry.add(m.geometry);
    const life=.7+Math.random()*.25,power=w.reducedMotion?.55:1;
    w.particles.push({kind:'drifter-leaf',mesh:m,life,maxLife:life,
      vx:Math.cos(a)*(1.7+Math.random()*.6)*power,vy:(1.2+Math.sin(a)*1.6)*power,vz:(Math.random()-.5)*1.1,
      spinX:(Math.random()-.5)*6,spinY:3+Math.random()*4,spinZ:(Math.random()-.5)*9,phase:a});
  }
}
