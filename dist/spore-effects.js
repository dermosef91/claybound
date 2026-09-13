import * as THREE from './lib/three.module.js';
import {clayMaterial} from './clay.js';

export const SPORE_COLORS={cream:0xffe8b0,gold:0xf5ba47};
function material(color,opacity=1){return new THREE.MeshStandardMaterial({color,roughness:.96,transparent:opacity<1,opacity,depthWrite:opacity===1});}
export function sporeCloud(w,parent,mat,size=1){
  const g=new THREE.Group();g.name='Cream spore cloud';parent.add(g);
  for(const [x,y,z,r]of [[0,0,0,.18],[-.13,.10,0,.15],[.12,.13,.015,.16],[0,.25,-.02,.14]]){
    const m=w.ball(r,r*.94,r,mat,g,x,y,z);m.castShadow=false;m.receiveShadow=false;
  }
  g.scale.setScalar(size);return g;
}

export function createSporeWind(w,wind,root){
  root.name='Released spore updraft';
  const cream=material(SPORE_COLORS.cream,.60),gold=material(SPORE_COLORS.gold,.88),bits=[],clouds=[];
  for(let i=0;i<24;i++){
    const m=w.ball(1,1,1,gold,root);m.name='Rising golden spore';m.castShadow=false;m.receiveShadow=false;bits.push(m);
  }
  for(let i=0;i<9;i++)clouds.push(sporeCloud(w,root,cream));
  root.visible=wind.active!==false;
  return {root,wind,bits,clouds,spore:true};
}
export function animateSporeWind(view,time,reducedMotion){
  const {root,wind,bits,clouds}=view;root.visible=wind.active!==false;if(!root.visible)return;
  const t=reducedMotion?0:time,h=Math.max(.6,wind.h),width=Math.max(.6,wind.w);
  for(let i=0;i<bits.length;i++){
    const rise=((t*2.7+i*.79)%h)/h,lane=(i%6+.5)/6;
    const swirl=Math.sin(rise*Math.PI*3+i)*Math.min(.42,width*.07);
    bits[i].position.set(lane*width+swirl,rise*h,-.28-(i%3)*.17);
    const size=(.065+(i%3)*.025)*(.55+Math.sin(rise*Math.PI)*.6);bits[i].scale.setScalar(size);
  }
  for(let i=0;i<clouds.length;i++){
    const rise=((t*1.65+i*h/9)%h)/h,lane=(i%3+.5)/3;
    clouds[i].position.set(lane*width+Math.sin(rise*Math.PI*2+i)*Math.min(.55,width*.09),rise*h,-.85-(i%2)*.35);
    clouds[i].scale.setScalar((.48+Math.sin(rise*Math.PI)*.65)*(reducedMotion?.75:1));clouds[i].rotation.z=Math.sin(t*.8+i)*.12;
  }
}

// Every burst owns its transient materials; copied shell plates also own their
// geometry so streaming can safely release the original pod while they fall.
export function burstSporePod(w,e){
  const source=w.platforms.get(e.platformId)?.root,definition=w.currentLevel?.platforms.find(s=>s.id===e.platformId);
  const x=definition?definition.x+definition.w/2:e.x,width=definition?.w??e.w??1.7,y=e.y-Math.min(1,width*.42);
  const capacity=Math.max(0,110-w.particles.length),budget=Math.min(w.reducedMotion?5:36,capacity);
  let added=0;
  const add=(m,kind,life,vx,vy,ownedGeometry=false)=>{
    if(added>=budget)return;added++;const ownedMaterials=new Set();m.traverse(o=>{if(o.material)ownedMaterials.add(o.material);});
    const q={kind,mesh:m,life,maxLife:life,vx,vy,vz:0,spin:(added%2?1:-1)*(1.4+added%3),ownedGeometry,ownedMaterials};w.particles.push(q);return q;
  };
  if(source&&!w.reducedMotion){
    source.updateWorldMatrix(true,true);const plates=[];source.traverse(o=>{if(o.name==='Cream crown petal'||o.name==='Cream body shell segment')plates.push(o);});
    for(let i=0;i<Math.min(8,plates.length,budget);i++){
      const original=plates[i],geo=original.geometry.clone().applyMatrix4(original.matrixWorld);geo.computeBoundingBox();const center=geo.boundingBox.getCenter(new THREE.Vector3());geo.translate(-center.x,-center.y,-center.z);
      const mat=original.material.clone();delete mat.userData.clay;clayMaterial(w,mat,.065);
      const m=new THREE.Mesh(geo,mat);m.name='Burst spore shell fragment';m.position.copy(center);m.castShadow=false;m.receiveShadow=false;w.fxRoot.add(m);
      const dir=Math.sign(center.x-x)||(i%2?1:-1);add(m,'spore-shell',.8+i*.04,dir*(1.8+i%3*.5),1.7+(i%3)*.5,true);
    }
  }
  for(let i=0;added<budget;i++){
    const cloud=i%3===0,a=i*2.399,size=cloud?.7+(i%2)*.25:.09+(i%3)*.035;
    const mat=material(cloud?SPORE_COLORS.cream:SPORE_COLORS.gold,cloud?.82:1);
    const m=cloud?sporeCloud(w,w.fxRoot,mat,size):w.ball(size,size,size,mat,w.fxRoot);
    m.name=cloud?'Spore burst billow':'Spore burst pollen';m.position.set(x+Math.cos(a)*.15,y+Math.sin(a)*.12,.4);m.castShadow=false;m.receiveShadow=false;
    const power=w.reducedMotion?.3:1,q=add(m,'spore-bloom',cloud?1.45:1.15,Math.cos(a)*(cloud?1.3:3.2)*power,(2.1+Math.sin(a)*1.5)*power);
    q.restScale=m.scale.clone();q.cloud=cloud;
  }
}
export function updateSporeParticle(q,dt){
  const age=q.maxLife-q.life;
  if(q.kind==='spore-shell'){
    q.vy-=5.5*dt;q.mesh.position.x+=q.vx*dt;q.mesh.rotation.z+=q.spin*dt;q.mesh.rotation.x+=q.spin*.6*dt;
    if(q.life<.35)q.mesh.scale.multiplyScalar(Math.exp(-dt*8));
  }else{
    q.vx*=Math.exp(-dt*2.1);q.vy+=(.75-q.vy)*Math.min(1,dt*1.6);q.mesh.position.x+=q.vx*dt;
    const fade=Math.min(1,q.life/.45),growth=q.cloud?.5+Math.min(age/.22,1)*.8:1;
    q.mesh.scale.copy(q.restScale).multiplyScalar(growth*fade);
    if(q.cloud)for(const mat of q.ownedMaterials)mat.opacity=.82*fade;
  }
}
export function disposeSporeParticle(q){
  if(q.ownedGeometry)q.mesh.geometry.dispose();for(const mat of q.ownedMaterials||[])mat.dispose();
}
