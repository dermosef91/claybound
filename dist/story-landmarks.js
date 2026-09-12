import * as THREE from './lib/three.module.js';
import {clayMaterial} from './clay.js';

// Small, platform-owned arrangements. They stream and move with their owner;
// nothing here is a collider, a collectible, or a second checkpoint.
const group=(parent,name)=>{const g=new THREE.Group();g.name=name;parent.add(g);return g;};

export function dryBasin(w,parent){
  const g=group(parent,'Eroded sandstone basin');
  // A broken horseshoe rim makes the old sandwheel station a distinct ruin.
  for(let i=0;i<8;i++){
    const a=.25+i*.38,x=Math.cos(a)*1.6,z=Math.sin(a)*.64;
    const stone=w.box(.63,.47+(i%3)*.16,.54,i%2?'terrain2':'top',g,x,.24+(i%3)*.08,z,.2);
    stone.rotation.y=-a;stone.rotation.z=Math.sin(i*2)*.09;
  }
  w.ball(1.35,.13,.6,'terrain2',g,0,.10,0);
  for(const [x,y,z,r]of [[-1.8,.13,.25,.3],[1.3,.12,-.45,.38],[.4,.12,.8,.24]])w.ball(r,.15,r*.7,'top',g,x,y,z);
  const post=w.box(.22,1.55,.27,'bark',g,-1.15,.72,-.38,.09);post.rotation.z=.18;
  w.rope([-1.26,1.35,-.38],[-.4,.12,-.23],g,.055);
  return g;
}

export function caveStory(w,s,parent){
  const role={
    'spark-balcony':'echo','ferry-exit':'cooling','heart-entry':'bearing',
    'heart-balcony':'bearing','vault-entry':'survey','sluice-balcony':'survey',
    'gallery-entry':'geode'
  }[s.id];
  if(!role)return false;
  const g=group(parent,'Cavern story: '+role);g.position.set(s.w*.66,0,-1.18);
  // Narrow balconies get a shallow arrangement that still fits their deck.
  if(s.kind==='ledge'){g.position.z=-.58;g.scale.z=.55;}
  if(role==='echo'){
    for(let i=0;i<3;i++){
      const h=1.1+i*.42;w.box(.47,h,.65,'terrain2',g,(i-1)*.64,h/2,0,.21);
      w.ball(.18,.12,.16,'accent',g,(i-1)*.64,h+.04,0);
    }
  }else if(role==='cooling'){
    for(let i=0;i<3;i++){
      const h=.5+i*.33;w.cylinder(.38,h,'terrain2',g,(i-1)*.85,h/2,0);
      const ring=w.mesh(new THREE.TorusGeometry(.27,.09,8,20),'barkLight',g,(i-1)*.85,h,0);ring.rotation.x=Math.PI/2;
    }
  }else if(role==='bearing'){
    const ring=w.mesh(new THREE.TorusGeometry(.75,.18,10,28),'terrain2',g,0,.87,0);ring.rotation.y=.22;
    w.box(2.1,.35,.9,'terrain',g,0,.16,0,.15);
    w.box(.4,.8,.35,'barkLight',g,-.65,.55,.05,.12);
    w.ball(.16,.16,.12,'cream',g,-.65,.93,.25);
  }else if(role==='survey'){
    w.box(1.25,.34,.85,'terrain2',g,0,.17,0,.15);
    for(let i=0;i<3;i++)w.box(.15,.15+i*.12,.23,'accent',g,(i-1)*.28,.4+i*.06,.03,.06);
    w.box(.18,1.75,.22,'bark',g,.76,.88,-.13,.08);
    for(let i=0;i<4;i++)w.box(.28,.055,.08,'cream',g,.73,.45+i*.32,.015,.02);
  }else{
    for(let i=0;i<5;i++){
      const a=i*Math.PI/4;
      w.ball(.48,.55,.36,'terrain2',g,Math.cos(a)*1.1,.35+Math.sin(a)*1.15,0);
      if(i>0&&i<4)w.ball(.13,.25,.15,'accent',g,Math.cos(a)*.74,.34+Math.sin(a)*.91,.29);
    }
  }
  return true;
}

export function cityStory(w,s,parent){
  const role={'roof1':'home','laundry-home':'home','exchange-entry':'ropeyard','bell-court':'garden'}[s.id];
  if(!role)return;
  const g=group(parent,'City story: '+role);
  if(role==='home'){
    // Recesses live below the deck, so they cannot look like another landing.
    for(const x of [s.w*.32,s.w*.68]){
      w.box(.84,1.13,.12,'dark',g,x,-1.8,1.77,.23);
      w.box(.72,.13,.2,'cream',g,x,-2.36,1.85,.06);
      w.box(.055,.95,.06,'barkLight',g,x,-1.8,1.86,.02);
    }
  }else if(role==='ropeyard'){
    g.position.set(s.w*.68,.03,-1.15);
    w.box(2.55,.18,.92,'terrain2',g,0,.07,0,.08);
    for(const [x,r]of [[-.66,.37],[.33,.26]]){
      const spool=w.mesh(new THREE.TorusGeometry(r,.12,9,24),'rope',g,x,r+.16,0);spool.rotation.y=.1;
      w.box(.14,r*2+.2,.13,'bark',g,x,r+.16,-.05,.05);
    }
    w.box(.75,.55,.61,'barkLight',g,.92,.35,-.05,.14);
  }else{
    g.position.set(s.w*.69,.01,-1.25);
    if(!w.mat.cityHerb){w.mat.cityHerb=new THREE.MeshStandardMaterial({color:0x63846a,roughness:.98});clayMaterial(w,w.mat.cityHerb,.025);}
    for(let i=0;i<2;i++){
      w.cylinder(.35,.55,'terrain2',g,i*.86,.27,0);
      for(let j=0;j<3;j++){const leaf=w.ball(.18,.31,.12,'cityHerb',g,i*.86+(j-1)*.17,.73,0);leaf.rotation.z=(j-1)*-.42;}
    }
    w.box(1.4,.16,.42,'barkLight',g,-1.22,.54,0,.08);
    for(const x of [-1.68,-.78])w.box(.16,.5,.27,'bark',g,x,.25,0,.06);
  }
}
