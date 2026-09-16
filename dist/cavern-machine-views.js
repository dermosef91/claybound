import * as THREE from './lib/three.module.js';

function arrow(w,g,x,dir){
  const shape=new THREE.Shape();shape.moveTo(-.28,-.07);shape.lineTo(.06,-.07);shape.lineTo(.06,-.2);shape.lineTo(.34,0);shape.lineTo(.06,.2);shape.lineTo(.06,.07);shape.lineTo(-.28,.07);shape.closePath();
  const m=w.mesh(new THREE.ExtrudeGeometry(shape,{depth:.05,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:2}),'cream',g,x,-.28,1.05);
  if(dir<0)m.rotation.z=Math.PI;
}
export function createCavernMachine(w,s,root){
  const v={root,ropes:[],bounce:0};
  if(s.kind==='gate'){
    root.name='Relay grate '+s.channel;const h=s.h||10,mover=new THREE.Group();root.add(mover);v.grate=mover;
    for(const x of [-.26,s.w+.26])w.box(.35,h+.7,2.3,'terrain2',root,x,-h/2,0,.14);
    w.box(s.w+1.1,.55,2.4,'terrain',root,s.w/2,.2,0,.18);
    for(let i=0;i<4;i++)w.box(.2,h,1.15,'barkLight',mover,.12+i*(s.w-.24)/3,-h/2,0,.09);
    for(const y of [-h+.5,-h+2.3])w.box(s.w,.25,1.3,'bark',mover,s.w/2,y,0,.08);
    v.lamp=w.ball(.24,.24,.13,'gold',root,s.w+.25,-h+1.4,1.18);
  }else if(s.kind==='ferry'){
    root.name='Weight-steered furnace ferry';
    w.box(s.w,.3,2.05,'barkLight',root,s.w/2,-.16,0,.14);
    w.box(s.w-.3,.5,1.7,'terrain2',root,s.w/2,-.53,0,.22);
    for(const x of [.38,s.w-.38]){
      const wheel=w.mesh(new THREE.TorusGeometry(.28,.095,9,22),'orange',root,x,-.59,.75);v.wheels??=[];v.wheels.push(wheel);
      w.ball(.1,.1,.1,'gold',root,x,-.59,.79);
    }
    const brake=w.mesh(new THREE.TorusGeometry(.37,.065,8,24),'cream',root,s.w/2,.025,0);brake.rotation.x=Math.PI/2;
    arrow(w,root,.85,-1);arrow(w,root,s.w-.85,1);
    v.left=w.ball(.12,.12,.05,'gold',root,1.6,-.25,1.06);v.right=w.ball(.12,.12,.05,'gold',root,s.w-1.6,-.25,1.06);
    const rail=new THREE.Group();root.add(rail);v.rail=rail;
    for(const z of [-.64,.64])w.box((s.travel||24)+s.w,.1,.12,'bark',rail,((s.travel||24)+s.w)/2,-.88,z,.045);
    for(const x of [0,(s.travel||24)+s.w])w.box(.28,1.3,2,'terrain2',rail,x,-.65,0,.1);
  }else if(s.kind==='orbit'){
    root.name='Turning-heart cradle';
    w.box(s.w,.32,1.9,'top',root,s.w/2,-.16,0,.15);w.box(s.w-.12,.25,1.6,'barkLight',root,s.w/2,-.43,0,.1);
    for(const x of [.12,s.w-.12]){w.cylinder(.08,.55,'barkLight',root,x,.15,-.8);w.ball(.13,.13,.13,'gold',root,x,.44,-.8);}
    v.axle=new THREE.Group();root.add(v.axle);
    // The spoke is a rope from hub to deck, not a plank: one continuous line
    // that ties the ring, hub and cradle into a single hoist.
    v.arm=w.box(1,.16,.16,'rope',v.axle,0,0,-1.2,.06);
    if((s.phase||0)<0){
      const wheel=new THREE.Group();v.axle.add(wheel);v.wheel=wheel;
      // A thick clay ring; the thin tube read as wire against the collars.
      w.mesh(new THREE.TorusGeometry(s.moveY||4,.3,10,64),'terrain2',wheel,0,0,-1.6);
      w.ball(.75,.75,.28,'terrain2',wheel,0,0,-1.48);w.ball(.37,.37,.34,'gold',wheel,0,0,-1.3);
      for(let i=0;i<10;i++){
        const a=i*Math.PI/5,r=(s.moveY||4);
        const tooth=w.box(.48,.48,.44,i%2?'bark':'barkLight',wheel,Math.cos(a)*r,Math.sin(a)*r,-1.55,.15);tooth.rotation.z=a;
      }
    }
  }
  animateCavernMachine(v,s,w);return v;
}
export function animateCavernMachine(v,s,w){
  if(v.grate){v.grate.position.y=((s.h||10)+1)*(s.open||0);v.grate.visible=(s.open||0)<.99;v.lamp.material=s.active?w.mat.gold:w.mat.accent;}
  if(v.rail){
    v.rail.position.x=s.baseX-s.x;v.left.visible=s.drive<-.05;v.right.visible=s.drive>.05;
    for(const wheel of v.wheels)wheel.rotation.z=-(s.x-s.baseX)/.28;
  }
  if(v.axle){
    const dx=s.x-s.baseX,dy=s.y-s.baseY,r=Math.hypot(dx,dy);
    v.axle.position.set(s.baseX+s.w/2-s.x,s.baseY-s.y,0);
    v.arm.position.set(dx/2,dy/2,-1.2);v.arm.scale.x=r;v.arm.rotation.z=Math.atan2(dy,dx);
    if(v.wheel)v.wheel.rotation.z=s.orbitAngle||0;
  }
}
