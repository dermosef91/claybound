import * as THREE from './lib/three.module.js';
import {cavernMaterials,caveMoss,caveCap,bakeStatic} from './cavern.js';

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
    root.name='Turning-heart cradle';cavernMaterials(w);
    // The hanging deck is a heavy rounded stone slab that visibly hangs from
    // rope: a pale walked plate over a dark clay belly that sags under the
    // middle, two lashings wrap it near the ends, rope-bound posts stand at
    // the back corners, and a pair of lines from the posts run up to a knot
    // well above the deck's centre where the hanger from the hub ties on. The
    // knot's height gives the lines a real diagonal run, the target's rope,
    // instead of two stubs.
    caveCap(w,root,s.w,.4,1.9,s.w/2,-.2,0,s.x);w.box(s.w-.3,.5,1.62,'terrain2',root,s.w/2,-.6,0,.22);
    w.ball(s.w*.3,.32,.66,'terrain2',root,s.w*.46,-.74,-.08);
    for(const x of [.6,s.w-.6]){const lash=w.mesh(new THREE.TorusGeometry(1,.055,6,28),'rope',root,x,-.3,0);lash.rotation.y=Math.PI/2;lash.scale.set(1,.44,1);}
    const knot=[s.w/2,2.1,-1.1];v.knotY=knot[1];
    for(const x of [.36,s.w-.36]){
      // Each post is bound by three turns of rope under a clay knob.
      w.cylinder(.11,.95,'bark',root,x,.47,-.6);
      for(let k=0;k<3;k++){const wrap=w.mesh(new THREE.TorusGeometry(.15,.045,6,14),'rope',root,x,.26+k*.19,-.6);wrap.rotation.x=Math.PI/2;}
      w.ball(.14,.12,.14,'barkLight',root,x,.98,-.6);
      w.rope([x,.92,-.6],knot,root,.06);
    }
    w.ball(.17,.15,.17,'rope',root,knot[0],knot[1],knot[2]);
    // Everything so far rides with the deck as one piece: baked, the deck is
    // a draw per material instead of twenty. The axle and hanger are added
    // afterwards, since they move against the deck every frame.
    bakeStatic(w,root);
    v.axle=new THREE.Group();root.add(v.axle);
    // The hanger is a real twisted rope built at the orbit's nominal radius
    // and only stretched by the ratio to the live hub-to-knot distance, so on
    // a circular orbit its twist never distorts as the deck swings round.
    v.armLength=s.moveY||4;v.arm=new THREE.Group();v.arm.position.z=knot[2];v.axle.add(v.arm);
    w.rope([0,0,0],[v.armLength,0,0],v.arm,.11);
    if((s.phase||0)<0){
      const wheel=new THREE.Group();v.axle.add(wheel);v.wheel=wheel;const r=s.moveY||4;
      // One thick dark clay ring bound at intervals by knotted clamps: a clay
      // block astride the tube with a turn of rope on either side of it and a
      // knot bulb on its outer face. The clamps turn with the ring so its
      // motion stays readable without cogs.
      w.mesh(new THREE.TorusGeometry(r,.38,12,84),'caveRing',wheel,0,0,-1.6);
      const axis=new THREE.Vector3(0,0,1);
      for(let i=0;i<5;i++){
        const a=i*Math.PI*2/5+.3,cx=Math.cos(a)*r,cy=Math.sin(a)*r,tangent=new THREE.Vector3(-Math.sin(a),Math.cos(a),0);
        const collar=w.box(1,.82,1,'rope',wheel,cx,cy,-1.6,.26);collar.rotation.z=a;
        for(const side of [-1,1]){const wrap=w.mesh(new THREE.TorusGeometry(.47,.07,6,16),'rope',wheel,cx+tangent.x*side*.64,cy+tangent.y*side*.64,-1.6);wrap.quaternion.setFromUnitVectors(axis,tangent);}
        w.ball(.21,.19,.2,'rope',wheel,Math.cos(a)*(r+.48),Math.sin(a)*(r+.48),-1.5);
      }
      // Moss has taken hold on the old ring: cushions only, no drips, because
      // they turn with it and a drip pointing sideways would give the game away.
      for(const a of [1.9,4.4]){const pad=caveMoss(w,wheel,Math.cos(a)*r,Math.sin(a)*r,-1.3,1.1,0,a*10);pad.rotation.z=a-Math.PI/2;}
      w.ball(.95,.95,.3,'caveRing',wheel,0,0,-1.48);w.ball(.5,.5,.38,'gold',wheel,0,0,-1.28);
      // The ring never changes shape, only turns: baked, it is a draw per
      // material (ring clay, rope, gold, two mosses) instead of thirty.
      bakeStatic(w,wheel);
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
    const dx=s.x-s.baseX,dy=s.y-s.baseY+(v.knotY||0),r=Math.hypot(dx,dy);
    v.axle.position.set(s.baseX+s.w/2-s.x,s.baseY-s.y,0);
    // The rope runs from the hub to the knot above the deck, not to the deck.
    v.arm.rotation.z=Math.atan2(dy,dx);v.arm.scale.x=r/(v.armLength||r||1);
    if(v.wheel)v.wheel.rotation.z=s.orbitAngle||0;
  }
}
