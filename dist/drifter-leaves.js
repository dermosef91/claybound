import * as THREE from './lib/three.module.js';

// Small, thick, pointed clay leaves reuse the world's clay materials. The
// outline is the one leaf shape the game has (base at the origin's foot,
// -.75; tip up and a little right at .85), so scenery that wants a leaf —
// the orchard's canopy and fruit — builds its own copy with leafGeometry()
// and keeps it in the clay cache; this module's own copy feeds the burst.
export const leafShape=new THREE.Shape();
leafShape.moveTo(0,-.75);leafShape.bezierCurveTo(-.48,-.3,-.5,.35,.12,.85);
leafShape.bezierCurveTo(.44,.28,.38,-.38,0,-.75);
export function leafGeometry(){
  const g=new THREE.ExtrudeGeometry(leafShape,{depth:.12,bevelEnabled:true,bevelSize:.065,bevelThickness:.065,bevelSegments:2,steps:1,curveSegments:5});
  g.translate(0,0,-.06);return g;
}
const geometry=leafGeometry();

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
