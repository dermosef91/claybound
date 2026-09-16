import * as THREE from './lib/three.module.js';
import {buildCitadelBackdrop,buildCitadelTerrain} from './citadel.js';
import {clayMaterial} from './clay.js';
import {buildCanyonBackdrop,buildCanyonTerrain} from './canyon.js';
import {buildForestBackdrop} from './forest.js';
import {forestCover,forestMushroom} from './forest-details.js';
import {buildCaveBackdrop,caveMushrooms,caveCrystals,caveLedgeDetails} from './cavern.js';
import {animateCaveLights} from './cave-lighting.js';
import {CLAY_PALETTE} from './palette.js';
const rand=n=>{const v=Math.sin(n*127.1+87.3)*43758.5453;return v-Math.floor(v);};

export const THEMES={
  citadel:{terrain:0x315e96,terrain2:0x2d588c,top:CLAY_PALETTE.orange,bark:0x244973,barkLight:CLAY_PALETTE.orangeLight,foliage:0x4775a2,leafLight:0x638eb8,vine:0x3e6491,back:0x587fa8,back2:0x416e9d,accent:CLAY_PALETTE.orange,water:0x507d9f,rope:0xdfbc86,dust:0xe8cca0,skyLight:0xd3e3f0,groundLight:0x23466b,sun:0xffe3bd,sunPower:3.25,ambient:2.1,fill:0xb8d1e9,fillPower:.5},
  desert:{terrain:CLAY_PALETTE.orange,terrain2:CLAY_PALETTE.orangeDark,top:CLAY_PALETTE.orangeLight,bark:0x8e4e27,barkLight:0xbe793d,foliage:0x408559,leafLight:0x5b9b62,vine:0x487c47,back:CLAY_PALETTE.orangeLight,back2:CLAY_PALETTE.orange,accent:0xffd568,water:0x7daaae,rope:0xe3b56f,dust:0xf1c798,skyLight:0xd3e5fa,groundLight:0xa35b35,sun:0xffdfb6,sunPower:3.3,ambient:2.1,fill:0xc7def7,fillPower:.7,cameraElevation:1.6},
  forest:{terrain:0xaa7950,terrain2:0x906344,top:0x67a650,bark:0x795135,barkLight:0xb68a52,foliage:0x628448,leafLight:0x87a958,vine:0x58804b,back:0x93aa91,back2:0xa58b68,accent:0xf4d592,water:0x86b7b3,rope:0x829656,dust:0xaec387,skyLight:0xe5f0d7,groundLight:0x606646,sun:0xffe5b7,sunPower:3.2,ambient:2.1,fill:0xc4e1dc,fillPower:.7,cameraElevation:1.65},
  cave:{terrain:0x474751,terrain2:0x363c48,top:0x777e8a,bark:0x654731,barkLight:0x9b7043,foliage:0x378e94,leafLight:0x7bbdc0,vine:0x4b7c78,back:0x1e2c39,back2:0x334756,accent:0x8acedd,water:0x244b59,rope:0x9d7d54,dust:0xa1acb1,skyLight:0xb0c5d9,groundLight:0x293444,sun:0xc6d2df,sunPower:2.35,ambient:1.55,fill:0x91c5e8,fillPower:1.1,cameraElevation:1.8}
};

export function applyEnvironment(w,L){
  const theme=THEMES[L.biome];w.theme=theme;w.biome=L.biome;w.parallax=[];w.ambient=[];w.torches=[];w.water=null;
  for(const name of ['terrain','terrain2','top','bark','barkLight','foliage','leafLight','vine','back','back2','accent','water','dust']){
    if(!w.mat[name])w.mat[name]=new THREE.MeshStandardMaterial({roughness:.98,metalness:0,bumpMap:w.bump,bumpScale:['terrain','terrain2','top'].includes(name)?.12:.065});
    w.mat[name].color.setHex(theme[name]);
    w.mat[name].bumpScale={terrain:.075,terrain2:.075,top:.055,back:.03,back2:.035}[name]||.045;
    clayMaterial(w,w.mat[name],w.mat[name].bumpScale);
    if(name==='back'||name==='back2'){w.mat[name].emissive.copy(w.mat[name].color);w.mat[name].emissiveIntensity=L.biome==='citadel'?.12:0;}
  }
  w.mat.rope.color.setHex(theme.rope);w.mat.shadow.color.setHex(L.biome==='cave'?0x0e1920:0x333b28);
  w.mat.water.roughness=.72;w.mat.accent.emissive.setHex(L.biome==='cave'?0x286b71:0x000000);w.mat.accent.emissiveIntensity=.5;
  if(!w.mat.flame)w.mat.flame=new THREE.MeshStandardMaterial({color:0xffdb72,emissive:0xffb743,emissiveIntensity:1.2,roughness:1});
  w.hemi.color.setHex(theme.skyLight);w.hemi.groundColor.setHex(theme.groundLight);w.hemi.intensity=theme.ambient;
  w.sun.color.setHex(theme.sun);w.sun.intensity=theme.sunPower;w.fill.color.setHex(theme.fill);w.fill.intensity=theme.fillPower;
  // Outside the caverns these four contribute nothing, but a light that is only
  // dimmed still occupies a slot in the shader's light array, so every material
  // in the canyon, the forest and the citadel was shading four point lights per
  // fragment for no picture. Hiding them drops the count to zero instead.
  const lit=L.biome==='cave';
  w.torchLights.forEach(l=>{l.intensity=0;l.visible=lit;});w.caveLightState=null;
  w.scene.fog.near=L.biome==='forest'?24:L.biome==='cave'?28:L.biome==='citadel'?34:32;w.scene.fog.far=L.biome==='forest'?76:L.biome==='cave'?108:L.biome==='citadel'?104:91;
}

function group(parent,x=0,y=0,z=0,scale=1){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);return g;}
function link(w,parent,a,b,r,mat){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const m=w.cylinder(r,delta.length(),mat,parent);m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
export function clayTree(w,parent,x,y,size=1,mat='foliage',z=-1.3){
  const g=group(parent,x,y,z,size);
  w.box(.66,5.9,.75,'bark',g,0,2.95,0,.28);
  link(w,g,[0,3.35,0],[-1.35,4.9,0],.22,'bark');link(w,g,[.02,3.7,0],[1.18,5.2,-.12],.2,'bark');
  w.ball(1.83,1.62,1.16,mat,g,-.55,6,0);w.ball(1.51,1.49,1.06,mat,g,1,6.45,-.06);w.ball(1.4,1.25,1.12,mat,g,.1,7.04,-.18);
  w.box(.027,3.28,.037,'barkLight',g,-.16,2.35,.38,.008);
  w.ball(.16,.23,.043,'barkLight',g,.07,2.9,.389);
  return g;
}
function mushrooms(w,parent,x,y,size=1){
  const g=group(parent,x,y,-1,size);
  w.ball(.15,.32,.16,'cream',g,0,.28,0);w.ball(.47,.23,.43,'orange',g,0,.6,0);
  for(const [x,z]of [[-.23,.12],[.17,.2],[0,-.21]])w.ball(.088,.034,.09,'cream',g,x,.79-Math.abs(x)*.16,z);
}
export function clayTorch(w,parent,x,y,z=-1.1){
  const g=group(parent,x,y,z);w.box(.17,1.37,.2,'bark',g,0,.57,0,.075);w.ball(.31,.17,.26,'barkLight',g,0,1.11,0);
  const f=w.ball(.185,.42,.19,'flame',g,0,1.47,0);f.castShadow=false;w.ball(.088,.24,.105,'cream',g,.025,1.4,.12);
  const position=new THREE.Vector3();g.getWorldPosition(position);position.y+=1.4;
  w.torches.push({flame:f,position,phase:x*1.4});return g;
}

export function buildTerrain(w,s,g){
  if(w.biome==='citadel'){buildCitadelTerrain(w,s,g);return;}
  if(w.biome==='desert'){buildCanyonTerrain(w,s,g);return;}
  const width=s.w,columns=Math.max(2,Math.ceil(width/3.1));
  for(let i=0;i<columns;i++){
    const cw=width/columns,depth=3.25+rand(i+s.x)*.15;
    // Overlapping hand-pressed masses retain the source sculpture's proportions.
    // Their shallow, staggered joins remain under the continuous walkable cap.
    const rows=3,rowH=10.4/rows;
    for(let row=0;row<rows;row++)w.box(cw+.15,rowH+.20,depth+(row%2)*.06,(i+row)%3===1?'terrain2':'terrain',g,(i+.5)*cw,-.18-(row+.5)*rowH,-.03,.33);
  }
  w.box(width+.14,.49,3.6,'top',g,width/2,-.18,0,.22);
  for(let i=0;i<Math.ceil(width/.93);i++){
    const x=.25+i*.93;
    if(x>width-.15)continue;
    w.ball(.51,.17+rand(i+s.x)*.09,.15,'top',g,x,-.32,1.68);
  }
  if(w.biome==='forest'){
    forestCover(w,s,g,3.6);
    if(s.id==='start'||s.checkpoint||s.goal)clayTree(w,g,s.id==='start'?2.7:width-1.3,0,s.id==='start'?1.22:.95);
    forestMushroom(w,g,width-2.9,.02,-.9,.85,.1);forestMushroom(w,g,width-3.8,.02,-.8,.5,-.2);
    const root=new THREE.CatmullRomCurve3([new THREE.Vector3(width*.6,-.33,1.73),new THREE.Vector3(width*.53,-2,1.78),new THREE.Vector3(width*.7,-3.8,1.7),new THREE.Vector3(width*.55,-6,1.68)]);
    w.mesh(new THREE.TubeGeometry(root,24,.105,7,false),'barkLight',g);
    for(let j=0;j<3;j++){const y=-1.3-j*1.7;w.ball(.42,.16,.11,'foliage',g,width*.54+Math.sin(j)*.6,y,1.78);}
  }else{
    caveLedgeDetails(w,s,g,3.6);
    // Let room function change the dressing: warm foundry, quiet survey
    // chamber, and cooler crystal gallery. Spikes remain behind the walk line.
    const foundry=['ferry-dock','ferry-exit','heart-entry'].includes(s.id);
    const survey=['vault-entry','sluice-floor'].includes(s.id);
    if(!foundry&&!survey)caveCrystals(w,g,width-1.2,.07,-1.38,s.id==='gallery-entry'?.5:.64);
    if(s.id==='start'||s.checkpoint||s.goal)clayTorch(w,g,s.id==='start'?8.1:s.goal?Math.max(.7,(s.bellX??width-3.5)-2.75):width*.4,.05);
    if(width>8&&!survey)caveMushrooms(w,g,foundry?width-2.2:2,.03,-1.4,foundry?.86:.6);
    for(let i=0;i<3;i++)w.ball(.47,.35,.15,'terrain',g,.8+rand(i+s.x)*Math.max(1,width-1.6),-1.3-i*2.1,1.64);
    if(s.goal){const chest=group(g,Math.min(width-.85,(s.bellX??width-3.5)+4.2),.18,-.72);w.box(1.28,.67,.77,'bark',chest,0,.33,0,.17);w.box(1.3,.39,.82,'barkLight',chest,0,.74,0,.18);for(const x of [-.42,.42])w.box(.14,.96,.85,'gold',chest,x,.49,0,.04);w.box(.24,.27,.1,'gold',chest,0,.51,.47,.04);}
  }
  if(s.checkpoint)w.flag(s.checkpoint-s.x,.05,g,.83,s.id);
  if(s.goal)w.makeBell(g,s.bellX??width-3.5,.1);
}

export function buildBackdrop(w,L){
  if(w.biome==='citadel')buildCitadelBackdrop(w,L);
  else if(w.biome==='desert')buildCanyonBackdrop(w);
  else if(w.biome==='forest')buildForestBackdrop(w,L);
  else buildCaveBackdrop(w);
}

export function animateEnvironment(w,dt){
  const t=w.time;
  for(const layer of w.parallax){
    if(!layer.items){
      layer.items=layer.group.children.map(o=>({o,x:o.position.x,y:o.position.y,scale:o.scale.clone()}));
      const xs=layer.items.map(i=>i.x);layer.span=layer.repeat??Math.max(100,Math.max(...xs)-Math.min(...xs)+25);
    }
    layer.group.position.x=w.cameraX*(1-layer.factor);
    // Vertical parallax stays gentler than horizontal, because vertical motion
    // is what makes a backdrop hard to look at. But every layer used to be
    // pinned to the camera vertically while it scrolled sideways at up to
    // seven tenths of the playfield, and the two axes disagreeing about how far
    // away a layer is reads as the background being wrong rather than deep.
    // A near layer therefore cannot be frozen: its own factor caps the follow.
    const heightFollow=Math.min(layer.heightFollow??1,1-layer.factor*.35);
    layer.group.position.y=Math.max(0,w.cameraY-1.1)*heightFollow;
    for(const item of layer.items)item.o.position.x=item.x+Math.round((w.cameraX*layer.factor-item.x)/layer.span)*layer.span;
    if(layer.anchors?.length){
      for(const item of layer.items){item.o.position.y=item.y;item.o.scale.copy(item.scale);}
      // Authored landmarks can compose one existing cloud at a fixed world
      // position while the rest of the sky keeps its normal parallax.
      const anchor=layer.anchors.find(a=>Math.abs(w.cameraX-a.x)<20);
      if(anchor&&layer.items.length){
        const item=layer.items.reduce((best,item)=>Math.abs(item.o.position.x+layer.group.position.x-anchor.x)<Math.abs(best.o.position.x+layer.group.position.x-anchor.x)?item:best);
        item.o.position.set(anchor.x-layer.group.position.x,anchor.y-layer.group.position.y,item.o.position.z);item.o.scale.setScalar(anchor.scale);
      }
    }
  }
  for(const a of w.ambient){
    if(a.leaf){
      const time=w.reducedMotion?0:(w.forestTime??0),phase=((time*.045+a.seed*.317)%1+1)%1;
      a.mesh.position.x=a.base.x+Math.round((w.cameraX-a.base.x)/140)*140+Math.sin(time*.45+a.seed)*.7;
      a.mesh.position.y=w.cameraY+4.8-phase*9.6;a.mesh.rotation.set(.3,Math.sin(time*.6+a.seed)*.8,a.seed*.7+Math.sin(time*.5+a.seed)*.45);
      a.mesh.scale.copy(a.restScale).multiplyScalar(Math.min(1,phase*12,(1-phase)*12));continue;
    }
    a.mesh.position.x=a.base.x+Math.round((w.cameraX-a.base.x)/140)*140+Math.sin(t*.6+a.seed)*.22;
    a.mesh.position.y=a.base.y+Math.max(0,w.cameraY-1.1)*.85+(a.wave?Math.sin(t+a.seed)*.03:Math.sin(t*.8+a.seed)*.5);
  }
  if(w.water){w.water.position.x=w.cameraX;w.water.position.y=-7.8+Math.max(0,w.cameraY-1.1)*.85;}
  // Resolve moved parallax parents before sampling static light anchors.
  if(w.biome==='cave')w.backRoot.updateMatrixWorld(true);
  animateCaveLights(w,dt);
}
