import * as THREE from './lib/three.module.js';
import {clayMaterial,sculptClay} from './clay.js';
import {RULES} from './simulation.js';
import {CLAY_PALETTE} from './palette.js';
import {THEMES} from './environments.js';

export function createHealthClumps(w){
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(0,1,1,0,.1,200);camera.position.z=100;
  const clay=clayMaterial(w,new THREE.MeshStandardMaterial({color:CLAY_PALETTE.orange,roughness:.94}),.048);
  const empty=clayMaterial(w,new THREE.MeshStandardMaterial({color:0x395066,roughness:1}),.04);
  const geo=new THREE.SphereGeometry(1,30,22),pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const r=1+.105*Math.sin(x*3.5+y*2.9)*Math.cos(z*3.7-x)+.038*Math.cos(y*8+z*5);
    pos.setXYZ(i,x*r,y*r*.91,z*r*.94);
  }
  geo.computeVertexNormals();const geometry=sculptClay(w,geo,{amplitude:.035});
  w.assetGeometry.add(geometry);w.assetMaterials.add(clay);w.assetMaterials.add(empty);
  const clumps=Array.from({length:RULES.maxHealth},(_,i)=>{
    const mesh=new THREE.Mesh(geometry,clay);mesh.name='Health clay clump '+(i+1);mesh.rotation.set(i*.73,i*1.71,i*.29);scene.add(mesh);
    return {mesh,phase:i*2.31,angle:0,health:true,radius:12};
  });
  const light=THEMES.citadel;
  scene.add(new THREE.HemisphereLight(light.skyLight,light.groundLight,light.ambient));
  const key=new THREE.DirectionalLight(light.sun,light.sunPower);key.position.set(-40,60,80);scene.add(key);
  const fill=new THREE.DirectionalLight(light.fill,light.fillPower);fill.position.set(60,-10,30);scene.add(fill);
  return {scene,camera,clumps,clay,empty,time:0};
}
export function animateHealthClumps(view,health,dt,reducedMotion=false){
  if(!reducedMotion)view.time+=dt;
  for(const [i,c]of view.clumps.entries()){
    const t=view.time,a=c.phase;
    // Independent slow turns with smooth direction changes, never frame jitter.
    c.mesh.rotation.set(i*.73+t*(.075+i*.017)+Math.sin(t*.13+a)*.21,i*1.71+t*(.13-i*.018)+Math.sin(t*.09+a)*.27,i*.29+Math.sin(t*.11+a)*.32);
    c.health=i<health;c.mesh.material=c.health?view.clay:view.empty;
    c.mesh.scale.setScalar(c.radius*(c.health?1:.72));
  }
}
export class HealthHUD{
  constructor(w,element){
    this.world=w;this.element=element;this.view=createHealthClumps(w);this.dirty=true;
    this.onResize=()=>this.dirty=true;
    window.addEventListener('resize',this.onResize);window.visualViewport?.addEventListener('resize',this.onResize);
    this.observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(this.onResize);this.observer?.observe(element);
  }
  draw(game,dt){
    const w=this.world,view=this.view;
    if(this.dirty){
      const canvas=w.canvas.getBoundingClientRect();if(!canvas.width||!canvas.height)return;
      view.camera.right=canvas.width;view.camera.top=canvas.height;view.camera.updateProjectionMatrix();
      const slots=[...this.element.children];
      view.clumps.forEach((c,i)=>{const r=slots[i].getBoundingClientRect();c.radius=r.width*.49;c.mesh.position.set(r.left-canvas.left+r.width/2,canvas.height-(r.top-canvas.top+r.height/2),0);});
      this.dirty=false;
    }
    animateHealthClumps(view,game.player.health,game.status==='playing'?dt:0,w.reducedMotion);
    const auto=w.renderer.autoClear;w.renderer.autoClear=false;w.renderer.clearDepth();w.renderer.render(view.scene,view.camera);w.renderer.autoClear=auto;
    this.element.classList.add('is-3d');
  }
}
