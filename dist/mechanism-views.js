import * as THREE from './lib/three.module.js';
import {clayMaterial} from './clay.js';
import {forestLeaf} from './forest-details.js';
import {sporeCloud,SPORE_COLORS} from './spore-effects.js';

// Visible cause and effect: a clay cable and moving light link the control to
// the thing it changes. All decoration is behind the collision plane.
export function circuitView(w,L,c){
  const root=new THREE.Group();root.name='Connected '+c.kind;w.levelRoot.add(root);
  const source=L.platforms.find(p=>p.id===c.source),points=[new THREE.Vector3(source.x+source.w/2,source.y-.28,-1.2)],tethers=[];
  for(const id of c.targets){
    const p=L.platforms.find(p=>p.id===id),top=(p.baseY??p.y)+(p.kind==='counter'?p.rise+1.7:0);points.push(new THREE.Vector3(p.x+p.w/2,top,-1.2));
    if(p.kind==='counter')tethers.push({platform:p,top,mesh:w.cylinder(.043,1,'rope',root,p.x+p.w/2,top,-1.2)});
  }
  const bent=[];for(let i=0;i<points.length;i++){if(i){const a=points[i-1],b=points[i];bent.push(new THREE.Vector3((a.x+b.x)/2,Math.min(a.y,b.y)-(c.kind==='weight'?-.7:.8),-1.25));}bent.push(points[i]);}
  const curve=new THREE.CatmullRomCurve3(bent),length=curve.getLength();
  const cable=w.mesh(new THREE.TubeGeometry(curve,Math.max(12,Math.ceil(length*2)),c.kind==='spore'?.072:c.kind==='weight'?.043:.06,8,false),c.kind==='spore'?'vine':c.kind==='weight'?'rope':'bark',root);
  const leaves=[];
  if(c.kind==='spore')for(let i=1;i<Math.ceil(length/.95);i++){
    const u=i/Math.ceil(length/.95),p=curve.getPoint(u),t=curve.getTangent(u);
    leaves.push(forestLeaf(w,root,p.x,p.y,p.z+.08,.22,Math.atan2(t.y,t.x)+(i%2?-.8:2.1)));
  }
  const material=new THREE.MeshStandardMaterial({color:c.kind==='relay'?0x9ee2d5:0xf7d28e,roughness:.9,emissive:c.kind==='relay'?0x4dc1b2:0xeb9e43,emissiveIntensity:.1});clayMaterial(w,material,.018);
  const cloudMaterial=c.kind==='spore'?new THREE.MeshStandardMaterial({color:SPORE_COLORS.cream,roughness:1,transparent:true,opacity:.72,depthWrite:false}):null;
  const beads=[],beadSize=c.kind==='spore'?.095:.075;for(let i=0;i<(c.kind==='spore'?6:4);i++)beads.push(cloudMaterial&&i%2===0?sporeCloud(w,root,cloudMaterial,.55):w.ball(beadSize,beadSize,beadSize,material,root));
  const lamp=w.ball(.16,.16,.13,material,root,points[0].x,points[0].y,-1.05);
  return {root,c,curve,beads,lamp,material,tethers,leaves,cable};
}
export function animateCircuit(v,game,reducedMotion=false){
  for(const t of v.tethers){const bottom=t.platform.y-.18;t.mesh.scale.y=t.top-bottom;t.mesh.position.y=(t.top+bottom)/2;}
  const active=game.channels[v.c.channel]>0;v.material.emissiveIntensity=active?.55:.03;
  if(v.c.kind==='spore'){
    const broken=game.level.platforms.find(p=>p.id===v.c.source)?.broken;
    v.lamp.visible=!broken;v.cable.visible=!broken;for(const leaf of v.leaves)leaf.visible=!broken;
  }
  const time=reducedMotion&&v.c.kind==='spore'?0:game.time;
  for(let i=0;i<v.beads.length;i++){const p=((time*.25+i/v.beads.length)%1);v.beads[i].position.copy(v.curve.getPoint(p));v.beads[i].visible=active;}
  const size=active?1+Math.sin(time*3)*.1:.65;v.lamp.scale.set(.16*size,.16*size,.13*size);
}
export function guideView(w,s,platform,view){
  // The post belongs to its supporting deck, including editor moves and lifts.
  const margin=Math.min(.4,platform.w/2),offset=THREE.MathUtils.clamp(s.offset,margin,platform.w-margin);
  const g=new THREE.Group();g.name='Wooden direction sign';g.userData.platformId=platform.id;
  g.position.set(offset-(view.balance?platform.w/2:0),.015,-.9);(view.balance||view.root).add(g);
  w.box(.11,.75,.16,'bark',g,0,.34,0,.05);w.box(.68,.42,.16,'barkLight',g,0,.7,0,.1);
  const shape=new THREE.Shape();shape.moveTo(-.21,-.055);shape.lineTo(.06,-.055);shape.lineTo(.06,-.14);shape.lineTo(.25,0);shape.lineTo(.06,.14);shape.lineTo(.06,.055);shape.lineTo(-.21,.055);shape.closePath();
  const arrow=w.mesh(new THREE.ExtrudeGeometry(shape,{depth:.04,bevelEnabled:true,bevelThickness:.015,bevelSize:.012,bevelSegments:2}),'cream',g,0,.7,.095);
  arrow.rotation.z=s.dir===-1?Math.PI:s.dir===0?-Math.PI/2:0;return g;
}
