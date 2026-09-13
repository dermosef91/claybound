import * as THREE from './lib/three.module.js';
import {clayMaterial} from './clay.js';

// One sculpted timber-and-rope assembly for the moving decks in every world.
// All ornamental pieces move with the deck; only the upper rope can stretch
// to a fixed ceiling. The top of the timber remains at the collision plane.
function materials(w){
  if(w.movingPlatformMaterials)return w.movingPlatformMaterials;
  w.assetMaterials??=new Set();
  const colors={wood:0xc6652c,grain:0x98431e,ridge:0xd9803d,strap:0x95532d,
    rim:0xb56b32,red:0xe3441c,redEdge:0xb63314,rope:0xe7b970,ropeShade:0xc99550,gold:0xf5c764};
  const result={};
  for(const [key,color]of Object.entries(colors)){
    const m=clayMaterial(w,new THREE.MeshStandardMaterial({color,roughness:key==='gold'?.79:.93}),key==='wood'?.07:.035);
    w.assetMaterials.add(m);result[key]=m;
  }
  return w.movingPlatformMaterials=result;
}

function tube(w,g,points,r,material,name,segments=48,closed=false,radial=8){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed);
  const mesh=w.mesh(new THREE.TubeGeometry(curve,segments,r,radial,closed),material,g);
  mesh.name=name;return mesh;
}

function star(w,g,x,y,z,r,m){
  const points=Array.from({length:10},(_,i)=>{
    const a=Math.PI/2+i*Math.PI/5,d=r*(i%2?.47:1);return [Math.cos(a)*d,Math.sin(a)*d];
  });
  const shape=new THREE.Shape(),mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  points.forEach((p,i)=>{
    const before=mix(p,points[(i+9)%10],.16),after=mix(p,points[(i+1)%10],.16);
    if(i===0)shape.moveTo(...before);else shape.lineTo(...before);
    shape.quadraticCurveTo(...p,...after);
  });shape.closePath();
  const mesh=w.mesh(new THREE.ExtrudeGeometry(shape,{depth:r*.18,bevelEnabled:true,
    bevelSize:r*.075,bevelThickness:r*.08,bevelSegments:3,curveSegments:5,steps:1}),m,g,x,y,z);
  mesh.name='Soft raised gold star';return mesh;
}

function disk(w,g,x,y,z,r,depth,m,name){
  const mesh=w.ball(r,r,depth,m,g,x,y,z);mesh.name=name;return mesh;
}

function braid(w,g,x,start,end,z,k,m){
  const rope=new THREE.Group();rope.name='Two twisted honey rope strands';rope.position.set(x,start,z);g.add(rope);
  const length=Math.max(.15,end-start),pitch=.43*k;
  for(let strand=0;strand<2;strand++){
    const points=[],steps=Math.ceil(length/pitch*10);
    for(let i=0;i<=steps;i++){
      const y=i/steps*length,angle=y/pitch*Math.PI*2+strand*Math.PI;
      points.push([Math.cos(angle)*.054*k,y,Math.sin(angle)*.054*k]);
    }
    tube(w,rope,points,.061*k,strand?m.ropeShade:m.rope,'Spun clay rope',Math.min(640,steps),false,6);
  }
  return rope;
}

export function makeMovingPlatform(w,s,g,{ceiling=null}={}){
  g.name='Star-bound timber moving platform';
  const m=materials(w),k=Math.min(1.15,Math.max(.48,s.w/5.8)),h=.94*k,front=.79;
  const beam=w.box(s.w,h,1.58,m.wood,g,s.w/2,-h/2,0,h*.43);beam.name='Rounded orange timber beam';
  // Flowing wood fibres wrap around two knots. Low relief keeps the surface
  // sculptural at close range without turning the board into striped planks.
  // Build the grain directly on the kneaded beam's face, using ray hits so
  // every channel follows its rounded edges and surface dents.
  const probe=new THREE.Mesh(beam.geometry,m.wood);probe.position.copy(beam.position);probe.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  const surface=(x,y)=>{
    ray.set(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1));
    return ray.intersectObject(probe)[0]?.point.z??front;
  };
  const left=.31*k,right=s.w-left;
  for(let row=0;row<11;row++){
    const vertices=[],indices=[];
    for(let i=0;i<=90;i++){
      const t=i/90,x=left+(right-left)*t,base=-h*(.13+row*.071);
      const bend=Math.exp(-(((t-.37)/.13)**2))*Math.sin(row*.74-1.1)*h*.12;
      const y=base+Math.sin(t*10+row*.72)*h*.027+Math.sin(t*21+row)*h*.007+bend;
      const width=(row%3===0?.015:.005)*k*(.45+.55*Math.sin(t*Math.PI))*(1+.25*Math.sin(t*29+row));
      for(const side of [-1,1]){const py=y+side*width;vertices.push(x,py,surface(x,py)+.0015);}
      if(i<90){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    // Already conforms to sculpted geometry; do not sculpt the inset twice.
    const groove=new THREE.Mesh(geometry,m.grain);groove.name='Inset flowing wood grain';groove.receiveShadow=true;g.add(groove);
  }
  const ropes=[];
  for(const x of [.70*k,s.w-.70*k]){
    const strap=w.box(.51*k,h+.085*k,1.68,m.strap,g,x,-h/2,0,.13*k);strap.name='Brown wraparound end strap';
    for(const y of [-.11*k,-h+.10*k])disk(w,g,x,y,.887,.085*k,.055*k,m.gold,'Round gold strap stud');
    const badgeY=-h*.51;
    disk(w,g,x,badgeY,.881,.293*k,.092*k,m.rim,'Round wooden end badge');
    disk(w,g,x,badgeY,.959,.241*k,.039*k,m.wood,'Inset end badge');
    const rim=w.mesh(new THREE.TorusGeometry(.257*k,.028*k,8,32),m.ridge,g,x,badgeY,.981);rim.name='Rolled wooden badge rim';
    star(w,g,x,badgeY,1.005,.173*k,m.gold);

    // Upright wooden eyes and actual interlaced knots, behind the play lane.
    const z=-.30;
    tube(w,g,[[x-.24*k,.015,z],[x-.23*k,.26*k,z],[x-.13*k,.39*k,z],[x+.06*k,.40*k,z],[x+.22*k,.26*k,z],[x+.24*k,.015,z]],.092*k,m.strap,'Wooden suspension eye',32);
    for(const side of [-1,1])w.ball(.15*k,.065*k,.14*k,m.rim,g,x+side*.23*k,.035*k,z);
    tube(w,g,[[x-.055*k,.73*k,z],[x-.09*k,.48*k,z+.11*k],[x-.07*k,.31*k,z+.14*k],[x+.04*k,.26*k,z+.10*k],[x+.09*k,.36*k,z-.065*k],[x+.05*k,.58*k,z-.10*k]],.073*k,m.rope,'Loop through wooden eye',36);
    for(let n=0;n<2;n++){
      const points=Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2;return [x+Math.cos(a)*.15*k,(.58+n*.095)*k+Math.sin(a)*.048*k,z+Math.sin(a)*.13*k];});
      tube(w,g,points,.062*k,n?m.rope:m.ropeShade,'Overlapping rope knot',32);
    }
    const start=.72*k,end=ceiling===null?14:Math.max(start+.15,ceiling-s.y);
    const rope=braid(w,g,x,start,end,z,k,m);
    if(ceiling!==null)rope.userData.ceiling={y:ceiling,rest:end-start,offset:start};
    ropes.push(rope);
    const badgeHeight=2.58*k;
    for(const y of [badgeHeight-.43*k,badgeHeight+.43*k])w.ball(.23*k,.085*k,.14*k,m.ropeShade,g,x,y,z+.01);
    disk(w,g,x,badgeHeight,z+.045,.455*k,.139*k,m.redEdge,'Red rope medallion edge');
    disk(w,g,x,badgeHeight,z+.11,.430*k,.106*k,m.red,'Pressed red rope medallion');
    star(w,g,x,badgeHeight,z+.214,.303*k,m.gold);
  }
  return {root:g,ropes,bounce:0};
}
