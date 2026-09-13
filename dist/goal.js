import * as THREE from './lib/three.module.js';
import {clayMaterial,sculptClay} from './clay.js';
import {canyonModel} from './canyon-assets.js';

// A hand-built clay finish arch. All pieces belong to the streamed goal, and
// the rope, cup and clapper share one suspension pivot for the ringing motion.
function materials(w){
  if(w.goalMaterials)return w.goalMaterials;
  w.assetMaterials??=new Set();
  const specs={
    wood:[0x874322,.96,.03],stone:[0xd96a36,.94,.033],edge:[0xec783d,.92,.032],
    recess:[0x9f361c,.98,.045],rope:[0xddb46d,.94,.035],red:[0xe94b1b,.9,.055],
    cream:[0xe9bf65,.91,.04],gold:[0xefb821,.43,.045],star:[0xffcf42,.78,.028],
    clapper:[0xb42b0c,.84,.035]
  };
  const result={};
  for(const [key,[color,roughness,depth]]of Object.entries(specs)){
    const base=key==='gold'?new THREE.MeshPhysicalMaterial({color,roughness,metalness:0,clearcoat:1,clearcoatRoughness:.23}):new THREE.MeshStandardMaterial({color,roughness,metalness:0});
    const m=clayMaterial(w,base,depth);
    w.assetMaterials.add(m);result[key]=m;
  }
  w.goalMaterials=result;return result;
}

function roundedPolygon(points,round=.15){
  const s=new THREE.Shape(),toward=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  points.forEach((p,i)=>{
    const before=toward(p,points[(i+points.length-1)%points.length],round),after=toward(p,points[(i+1)%points.length],round);
    if(i===0)s.moveTo(...before);else s.lineTo(...before);
    s.quadraticCurveTo(...p,...after);
  });
  s.closePath();return s;
}
function relief(w,parent,shape,material,depth,bevel,x=0,y=0,z=0){
  const source=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,curveSegments:8});
  const geometry=sculptClay(w,source,{amplitude:.012,planar:true});
  if(geometry!==source)source.dispose();
  return w.mesh(geometry,material,parent,x,y,z);
}
function star(w,parent,r,x,y,z,mat){
  const points=Array.from({length:10},(_,i)=>{
    const a=Math.PI/2+i*Math.PI/5,radius=i%2?r*.46:r;
    return [Math.cos(a)*radius,Math.sin(a)*radius];
  });
  const mesh=relief(w,parent,roundedPolygon(points,.12),mat,.055,.025,x,y,z);
  mesh.name='Raised golden star';return mesh;
}

function plaque(w,parent,width,height,depth,x,y,z,turn,m){
  const g=new THREE.Group();g.name='Triangle-carved sandstone';g.position.set(x,y,z);g.rotation.z=turn;parent.add(g);
  const hw=width/2,hh=height/2;
  const foot=height>.8,taper=foot?.84:1;
  const face=roundedPolygon([[-hw,-hh],[hw,-hh],[hw*taper,hh],[-hw*taper,hh]],.16);
  const r=Math.min(width*(foot?.33:.30),height*(foot?.38:.32)),triangle=[[0,r],[-r*.89,-r*.65],[r*.89,-r*.65]];
  // The face has a real opening. The inset triangle sits behind the lip, with a
  // narrow shadow channel between its edges and the carved hole's bevel.
  const hole=roundedPolygon(triangle,.09);face.holes.push(hole);
  relief(w,g,face,m.stone,depth,.026,0,0,-depth/2);
  const inset=roundedPolygon(triangle.map(([a,b])=>[a*.66,b*.66]),.12);
  relief(w,g,inset,m.edge,.045,.013,0,0,depth/2-.070);
  relief(w,g,roundedPolygon(triangle,.09),m.recess,.035,.012,0,0,depth/2-.16);
  return g;
}

function binding(w,parent,x,y,m){
  const g=new THREE.Group();g.name='Double rope binding';g.position.set(x,y,0);parent.add(g);
  for(let row=0;row<2;row++){
    const points=[];
    for(let i=0;i<=48;i++){
      const a=i/48*Math.PI*2;
      // Rounded-square loops closely hug the flattened timber, including the
      // two readable front strands and the rope disappearing around its sides.
      const signed=v=>Math.sign(v)*Math.pow(Math.abs(v),.62);
      points.push(new THREE.Vector3(signed(Math.cos(a))*.225, row*.115+Math.sin(a*2+row)*.009,signed(Math.sin(a))*.255));
    }
    w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,.054,8,false),m.rope,g);
  }
}

function pennant(w,parent,a,b,drop,mat){
  const span=b[0]-a[0];
  const s=roundedPolygon([[0,0],[span,b[1]-a[1]],[span*.58,(b[1]-a[1])*.5-drop]],.085);
  const flag=relief(w,parent,s,mat,.035,.016,a[0],a[1],.035);
  flag.name='Clay bunting pennant';flag.rotation.y=span>0?.09:-.09;return flag;
}

function finishFlag(w,parent,m){
  const g=new THREE.Group();g.name='Star finish flag';g.position.set(1.94,-.06,-.15);parent.add(g);
  w.cylinder(.048,3.0,m.wood,g,0,1.49,0);w.ball(.15,.15,.145,m.wood,g,0,3.02,0);
  const s=new THREE.Shape();s.moveTo(.055,0);s.bezierCurveTo(.46,.015,.87,-.19,1.31,-.11);
  s.lineTo(1.06,-.54);s.lineTo(1.28,-.89);s.bezierCurveTo(.83,-.90,.39,-.71,.055,-.82);s.closePath();
  const flag=relief(w,g,s,m.red,.045,.024,0,2.70,.035);flag.name='Star finish flag cloth';
  star(w,flag,.27,.59,-.42,.095,m.star);w.flags.push(flag);
}

export function createGoal(w,parent,x,y){
  const m=materials(w),g=new THREE.Group();g.name='Chapter goal';g.position.set(x,y,-.65);parent.add(g);
  for(const side of [-1,1]){
    const px=side*1.38;
    const timber=w.box(.43,3.56,.47,m.wood,g,px,1.91,0,.145);timber.name='Goal timber';
    plaque(w,g,.98,.90,.65,px,.37,.035,side*-.025,m);
    binding(w,g,px,1.0,m);binding(w,g,px,2.36,m);
    w.box(.66,.36,.63,m.edge,g,px,3.14,.015,.13).name='Sandstone shoulder';
    plaque(w,g,.66,.61,.42,side*.80,3.38,.065,side*-.34,m);
    // Ground the feet with a small, asymmetrical cluster, leaving the walk
    // through the centre of the portal open.
    const rocks=side<0?[[-.85,.20,.32],[-.63,.30,.29],[-.48,.09,.14],[.67,.18,.23]]:
      [[.67,.28,.30],[.49,.11,.19],[.92,.13,.18],[-.64,.14,.22]];
    for(const [offset,ry,rx]of rocks){
      const rock=w.ball(rx,ry,rx*.79,m.stone,g,px+offset,ry-.08,-.015+(rx<.2?.3:-.1));
      rock.rotation.z=side*.2;rock.name='Goal footing stone';
    }
    if(w.biome==='desert')canyonModel(w,'cactus',g,px+side*.36,-.08,-.50,1.30,side*-.10);
  }
  // The little lintel blocks slope up toward the raised star seal.
  const seal=w.cylinder(.52,.19,m.stone,g,0,3.61,.075);seal.rotation.x=Math.PI/2;seal.name='Star crest';
  const inset=w.cylinder(.407,.07,m.recess,g,0,3.61,.22);inset.rotation.x=Math.PI/2;
  const disk=w.cylinder(.369,.055,m.red,g,0,3.61,.266);disk.rotation.x=Math.PI/2;
  w.mesh(new THREE.TorusGeometry(.448,.067,12,56),m.edge,g,0,3.61,.23);
  star(w,g,.312,0,3.61,.332,m.star);
  for(const [rx,ry,angle]of [[-.57,4.18,.68],[0,4.43,0],[.57,4.18,-.68]]){
    const ray=w.mesh(sculptClay(w,new THREE.CapsuleGeometry(.085,.22,8,16),{amplitude:.01}),m.star,g,rx,ry,.10);ray.rotation.z=angle;ray.name='Golden crest ray';
  }
  // Two strands rise from the posts to the middle under the crest.
  for(const side of [-1,1]){
    const points=[[side*1.20,2.74,-.05],[side*.82,2.77,-.04],[side*.36,2.94,-.03],[0,3.13,-.02]].map(p=>new THREE.Vector3(...p));
    w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.03,7,false),m.wood,g);
  }
  pennant(w,g,[-1.11,2.745],[-.77,2.80],.37,m.red);
  pennant(w,g,[-.72,2.82],[-.35,2.96],.38,m.cream);
  pennant(w,g,[.35,2.96],[.72,2.82],.38,m.cream);
  pennant(w,g,[.77,2.80],[1.11,2.745],.37,m.red);

  const bell=new THREE.Group();bell.name='Finish bell';bell.position.set(0,3.12,.10);g.add(bell);
  // Suspension and bell are made relative to the pivot, so the rim describes
  // an arc and the clapper cannot be left floating when the goal rings.
  for(let i=0;i<4;i++)w.ball(.062,.10,.065,m.wood,bell,Math.sin(i*2)*.011,-.085-i*.11,0);
  const profile=[
    [0,.88],[.14,.86],[.28,.81],[.34,.735],[.36,.64],[.37,.50],[.40,.28],
    [.445,.18],[.51,.15],[.535,.11],[.535,.035],[.50,.01],[.405,.025],
    [.38,.085],[.305,.18],[.265,.37],[.25,.51],[.17,.57],[0,.57]
  ].map(([r,h])=>new THREE.Vector2(r,h));
  // A hollow skirt with a rounded, rolled lip; reverse the closed profile so
  // the outside and the inner cup both receive the correct surface normals.
  profile.reverse();
  const cup=w.mesh(new THREE.LatheGeometry(profile,56),m.gold,bell,0,-1.32,0);cup.name='Golden bell cup';
  w.cylinder(.037,.40,m.clapper,bell,0,-1.29,0);
  w.ball(.135,.135,.13,m.clapper,bell,0,-1.41,.012).name='Bell clapper';
  w.bell=bell;
  finishFlag(w,g,m);
  return g;
}
