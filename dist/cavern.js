import * as THREE from './lib/three.module.js';
import {mergeGeometries} from './lib/BufferGeometryUtils.js';
import {clayMaterial} from './clay.js';
import {cavernModel} from './cavern-asset.js';

const group=(parent,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;};
// Sampled from the supplied grotto/crystalcap albedo under their glow masks:
// the lit crystal faces average #5fedf2 and the mushroom caps #f3982f, and the
// models emit their own colour at intensity .7 (white emissive x glow map).
// Built props now use those numbers so all three depth tiers agree.
export const CAVE_CRYSTAL=0x5fedf2,CAVE_MUSHROOM=0xf3a147;
function materials(w){
  for(const [name,color,emissive,intensity,roughness]of [
    ['caveMushroom',CAVE_MUSHROOM,0xff831e,.8,.85],
    ['caveCrystal',CAVE_CRYSTAL,CAVE_CRYSTAL,.7,.62]
  ]){
    if(!w.mat[name]){w.mat[name]=new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,roughness,metalness:0});clayMaterial(w,w.mat[name],.02);}
  }
}
function lightMarker(w,mesh,kind,color,power){
  w.torches.push({flame:mesh,position:new THREE.Vector3(),phase:0,kind,color,power,range:11});
}
export function caveMushrooms(w,parent,x,y,z=-1.2,size=1){
  materials(w);const g=group(parent,x,y,z);g.name='Amber mushroom cluster';g.scale.setScalar(size);
  for(const [dx,h,r]of [[0,1.25,.55],[-.6,.62,.32],[.65,.78,.37]]){
    w.cylinder(.095,h,'cream',g,dx,h*.48,0);
    const cap=w.ball(r,.23,r*.83,'caveMushroom',g,dx,h,0);
    w.ball(r*.72,.045,r*.63,'caveMushroom',g,dx,h-.14,.025);
    if(dx===0)lightMarker(w,cap,'mushroom',0xff962f,45*size);
  }
  return g;
}
// The supplied models grow their crystals as squat, many-faceted geode clumps:
// measured height/width 0.9-1.4, eight-ish facets, blunt tips seated in rock.
// The old build was a 3.4:1 six-sided spike, which both mismatched the models
// and gave safe scenery the silhouette this game uses for hazards.
const GEMS=[[-.42,.1,.3,.42,-.3],[-.04,.24,.4,.54,.04],[.4,.06,.27,.36,.28],[-.2,-.16,.2,.26,-.14],[.24,-.2,.17,.22,.18]];
export function caveCrystals(w,parent,x,y,z=-1.15,size=1,{light=true}={}){
  materials(w);const g=group(parent,x,y,z);g.name='Blue crystal cluster';g.scale.setScalar(size);
  w.ball(.66,.2,.46,'terrain2',g,0,.1,0);
  for(const [dx,dz,r,h,tilt]of GEMS){
    const gem=w.mesh(new THREE.CylinderGeometry(r*.44,r,h,8,1),'caveCrystal',g,dx,.16+h/2,dz);
    gem.rotation.z=tilt;
    // A shallow cap keeps it reading as a crystal without a spike's point.
    w.mesh(new THREE.ConeGeometry(r*.44,r*.52,8),'caveCrystal',gem,0,h/2+r*.26,0);
    w.box(r*1.25,.3,r*1.3,'terrain2',g,dx,.13,dz,.1);
    if(light&&r===.4)lightMarker(w,gem,'crystal',0x46bbff,42*size);
  }
  return g;
}
function backdropMaterials(w){
  for(const [name,color]of [
    ['caveVault',0x29333f],['caveColumn',0x34414e],['caveDistant',0x344d67],
    ['caveVeil',0x314b66],['caveMoss',0x728044],['caveMossLight',0x8c9953]
  ])if(!w.mat[name]){
    w.mat[name]=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:name.includes('Moss')?.05:.18,roughness:.94,metalness:0});
    clayMaterial(w,w.mat[name],name.includes('Moss')?.022:.06);
  }
}
const rand=n=>{const r=Math.sin(n*117.17+51.61)*43758.5453;return r-Math.floor(r);};

// Rounded rock volumes with irregular, overlapping facets, rather than extruded
// flat silhouettes. Local coordinates keep the shared clay field attached.
export function caveRock(w,parent,x,y,z,width,height,depth,material='caveColumn',seed=0){
  backdropMaterials(w);
  const geo=new THREE.SphereGeometry(1,14,12),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const a=p.getX(i),b=p.getY(i),c=p.getZ(i);
    const dent=1+.065*Math.sin(a*9+b*7+c*5+seed)+.045*Math.sin(a*5-b*11+c*7+seed*2);
    p.setXYZ(i,a*width*.5*dent,b*height*.5*dent,c*depth*.5*dent);
  }
  geo.computeVertexNormals();const mesh=w.mesh(geo,material,parent,x,y,z);
  mesh.name='Rounded cavern rock';return mesh;
}
function tooth(w,parent,x,y,r,h,material,down=true,seed=0){
  const profile=[[.025,-1],[.1,-.87],[.23,-.64],[.38,-.44],[.57,-.21],[.79,-.07],[1,.04]];
  const geo=new THREE.LatheGeometry(profile.map(([a,b])=>new THREE.Vector2(a*r,b*h)),13),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),q=1+.11*Math.sin(y*7/h+x*5+z*3+seed);
    p.setXYZ(i,x*q+Math.sin(y*3/h+seed)*r*.16,y,z*q);
  }
  geo.computeVertexNormals();const m=w.mesh(geo,material,parent,x,y,.4);m.name=down?'Ceiling stalactite':'Cave stalagmite';
  m.rotation.z=(down?0:Math.PI)+Math.sin(seed*3.2)*.09;return m;
}
function pillar(w,parent,x,base,width,height,material,seed=0){
  const g=group(parent,x,base,.1);g.name='Cavern buttress';
  // A lobed shaft gives the column real depth and a curved, varied silhouette.
  const profile=Array.from({length:19},(_,i)=>{
    const t=i/18;return new THREE.Vector2(width*.5*(.73+.22*Math.sin(t*10+seed)+.13*Math.cos(t*22+seed*.7)),t*height);
  });
  const geo=new THREE.LatheGeometry(profile,16),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=y/height,q=1+.09*Math.sin(x*5+z*4+t*41+seed);
    p.setXYZ(i,x*q+Math.sin(t*7+seed)*width*.14,y,z*q*.9);
  }
  geo.computeVertexNormals();w.mesh(geo,material,g);
  for(let i=0;i<5;i++){
    const y=height*(i+.4)/5,side=i%2?-1:1;
    caveRock(w,g,side*width*.19,y,width*.12,width*.83,height/4,width*.8,material,seed+i);
  }
  return g;
}

export function caveMoss(w,parent,x,y,z=0,size=1,hanging=0,seed=0){
  backdropMaterials(w);const g=group(parent,x,y,z);g.name='Hanging cave moss';g.scale.setScalar(size);
  for(let i=0;i<5;i++){
    const leaf=w.ball(.18,.095,.115,i%2?'caveMoss':'caveMossLight',g,(i-2)*.12,.06+rand(i+seed)*.05,rand(i+seed*2)*.15);
    leaf.rotation.set(.3,(i-2)*.45,(i-2)*-.2);
  }
  if(hanging)for(let j=0;j<3;j++){
    const len=hanging*(.65+rand(j+seed)*.35),dx=(j-1)*.17;
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(dx,.02,0),new THREE.Vector3(dx+.04,-len*.4,.1),new THREE.Vector3(dx-.09,-len,.13)]);
    w.mesh(new THREE.TubeGeometry(path,9,.045,5,false),'caveMoss',g);
    for(let i=0;i<4;i++){
      const t=(i+.6)/4,pos=path.getPoint(t),leaf=w.ball(.08,.17,.075,i%2?'caveMoss':'caveMossLight',g,pos.x+(i%2?-.04:.04),pos.y,pos.z);
      leaf.rotation.z=(i%2?-.25:.2);
    }
  }
  // These leaves are static. Merge each material locally so a hanging cluster
  // needs two draw calls while keeping all of its volume and surface detail.
  const byMaterial=new Map();
  for(const mesh of [...g.children]){
    mesh.updateMatrix();const geo=mesh.geometry.clone().applyMatrix4(mesh.matrix);
    const list=byMaterial.get(mesh.material)||[];list.push(geo);byMaterial.set(mesh.material,list);
    if(!w.assetGeometry.has(mesh.geometry))mesh.geometry.dispose();mesh.removeFromParent();
  }
  for(const [material,list]of byMaterial){
    const geo=mergeGeometries(list);list.forEach(g=>g.dispose());geo.userData.clayRelief=true;
    const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
  }
  return g;
}

// Only fixed stone ledges grow moss. Timed platforms keep their clear signal.
export function caveLedgeDetails(w,s,g,depth=1.8){
  backdropMaterials(w);
  if(s.kind==='stone'||s.kind==='ledge'){
    caveMoss(w,g,.19,-.025,depth*.46,.92,s.w>3?1.0:.5,s.x);
    caveMoss(w,g,s.w-.2,-.035,depth*.43,.9,.7,s.x+7);
    if(s.w>6)caveMoss(w,g,s.w*.61,-.015,-depth*.36,.8,0,s.x+2);
    // Small fractured underside pieces tie the slab to the surrounding rock.
    for(let i=0;i<Math.ceil(s.w/1.7);i++){
      const x=(i+.5)*s.w/Math.ceil(s.w/1.7);
      caveRock(w,g,x,-.44,depth*.27,1.12,.37,.77,'terrain2',s.x+i);
    }
  }
}
function layer(w,name,factor,repeat){
  const g=group(w.backRoot);g.name=name;w.parallax.push({group:g,factor,heightFollow:1,repeat});return g;
}

export function buildCaveBackdrop(w){
  backdropMaterials(w);
  const deep=layer(w,'Hazy cave depth',.12,144),arches=layer(w,'Distant cavern arches',.24,144),rooms=layer(w,'Lit grotto recesses',.43,144),vault=layer(w,'Overhead cave silhouette',.72,144);
  for(let i=-2;i<4;i++){
    const far=group(deep,i*24,0,-59);far.name='Distant mineral chamber';
    caveRock(w,far,0,-1,-14,30,48,9,'caveVeil',i);
    pillar(w,far,-7,-18,3.4,32,'caveDistant',i);
    tooth(w,far,1,9,1.3,9,'caveDistant',true,i+1);
    tooth(w,far,6,-15,1.6,14,'caveDistant',false,i+2);
  }
  for(let i=-4;i<6;i++){
    const span=group(arches,i*14.4+2+Math.sin(i*2.3)*1.8,0,-43-(i%2)*3);span.name='Distant grotto chamber';
    cavernModel(w,i%3===0?'grotto':'crystalcap',span,0,-6.8+rand(i)*3.4,0,7.5+rand(i+5)*3.2,(rand(i)-.5)*.85,{lights:false});
  }
  // Wider assets overlap their neighbours and disappear into rock at the base.
  // Alternate heights/turns keep the supplied islands from reading as repeated
  // freestanding miniatures against a blank wall.
  for(let i=-3;i<6;i++){
    const recess=group(rooms,i*16-1.5+Math.sin(i*1.9)*2.4,0,-25-(i%2)*3);recess.name='Embedded grotto alcove';
    const width=8.4+rand(i+11)*4.8,base=-9.6+rand(i+2)*4.2;
    // Continuous backing buries the island bases inside the cavern wall.
    caveRock(w,recess,0,-1.5,-4.5,19,25,6,'caveDistant',i+31);
    // Reserve the spiral silhouette for occasional landmarks. Most recesses
    // expose different side views of the crystal formations instead.
    cavernModel(w,i%3===0?'grotto':'crystalcap',recess,0,base,0,width,(rand(i+2)-.5)*1.12);
    for(let j=0;j<3;j++)caveRock(w,recess,(j-1)*width*.28,base-.1,-.2,width*.45,2.1,3.6,'caveDistant',i*7+j);
    tooth(w,recess,width*.44,base+.6,.6,3.8,'caveDistant',false,i+6);
  }
  for(let i=-2;i<4;i++){
    const roof=group(vault,i*24,0,-8.5);roof.name='Continuous cave vault';
    // Hidden overlapping volume guarantees roof coverage even on portrait
    // screens; a chain of sculpted lobes forms the visible irregular edge.
    w.box(24.4,18,3.5,'caveVault',roof,0,13.4,-1,.8);
    for(let j=0;j<6;j++){
      const x=-10+j*4,low=4.3+rand(i*6+j)*.75;
      caveRock(w,roof,x,low+2,-.2,5.8,5.6,4.6,'caveVault',i*6+j);
      tooth(w,roof,x+.6,low,.45+rand(j+i)*.55,1.4+rand(i*8+j)*1.8,'caveVault',true,i*6+j);
      if(rand(i*17+j)>.58)caveMoss(w,roof,x+.35,low-.15,2,.7+rand(i+j)*.5,.6+rand(i*3+j)*1.4,i*5+j);
    }
    pillar(w,roof,-4.2+rand(i+2)*2,-13,2.1+rand(i+3)*1.1,22,'caveColumn',i*2+.6);
    pillar(w,roof,10+rand(i+5)*2.2,-13,1.5+rand(i+4)*.8,23,'caveColumn',i*2+4);
    for(let j=0;j<6;j++){
      const x=-10+j*4,base=-3.9+rand(i*8+j)*.5;
      caveRock(w,roof,x,base-2.5,-.6,6.7,6.1,4.4,'caveColumn',j+i*7);
      if(j%2===0)tooth(w,roof,x+.7,base+.3,.65,2.4+rand(j+i)*1.8,'caveColumn',false,i+j);
      if(j===1||j===4){
        caveMoss(w,roof,x,base+.55,1.8,1.15,.7,i+j);
        if(j===1)caveCrystals(w,roof,x+.4,base+.6,.7,1.25);
        else caveMushrooms(w,roof,x-.2,base+.7,1.1,.8);
      }
    }
  }
  for(let i=0;i<14;i++){
    const ember=w.ball(.009,.013,.01,'flame',w.backRoot,-8+i*10,(i%7)*.8,-7-(i%3));ember.castShadow=false;
    w.ambient.push({mesh:ember,base:ember.position.clone(),seed:i});
  }
  // Static descendants retain their exact transforms. Only the parallax layer
  // and its wrapping cells need local matrix composition each frame.
  w.backRoot.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  for(const layer of w.parallax)for(const cell of layer.group.children){
    cell.traverse(o=>{if(o!==cell){o.updateMatrix();o.matrixAutoUpdate=false;}});
    cell.updateWorldMatrix(true,true);
    cell.userData.caveBounds=new THREE.Box3().setFromObject(cell).applyMatrix4(new THREE.Matrix4().copy(cell.matrixWorld).invert()).getBoundingSphere(new THREE.Sphere());
  }
}

const caveFrustum=new THREE.Frustum(),caveProjection=new THREE.Matrix4(),caveSphere=new THREE.Sphere();
export function cullCaveCells(w){
  w.camera.updateMatrixWorld();
  caveFrustum.setFromProjectionMatrix(caveProjection.multiplyMatrices(w.camera.projectionMatrix,w.camera.matrixWorldInverse));
  for(const layer of w.parallax)for(const cell of layer.group.children){
    if(!cell.userData.caveBounds)continue;
    cell.updateWorldMatrix(true,false);
    cell.visible=caveFrustum.intersectsSphere(caveSphere.copy(cell.userData.caveBounds).applyMatrix4(cell.matrixWorld));
  }
}
