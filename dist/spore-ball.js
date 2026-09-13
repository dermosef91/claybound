import * as THREE from './lib/three.module.js';
import {clayMaterial} from './clay.js';

// Tilt the crown towards the side-view camera so its red opening stays readable.
const crownTilt=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,.94,.34).normalize());
const point=(theta,phi,r)=>new THREE.Vector3(Math.sin(theta)*Math.sin(phi),Math.cos(theta),Math.sin(theta)*Math.cos(phi)).multiplyScalar(r).applyQuaternion(crownTilt);
function mesh(w,geometry,material,parent,name){
  const m=new THREE.Mesh(geometry,clayMaterial(w,material,.065));m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}

// A closed, rounded shell plate, sampled over the sphere. The depressed edge
// and raised middle give the cream panels real thickness above the gold core.
function plate(center,span,top,bottom,seed){
  const nu=18,nv=26,positions=[],uvs=[],indices=[];
  for(let layer=0;layer<2;layer++)for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
    const u=i/nu,v=j/nv,a=u*2-1,b=v*2-1;
    const roundedU=a*Math.sqrt(1-.22*b*b),roundedV=(b*Math.sqrt(1-.22*a*a)+1)/2;
    const phi=center+roundedU*span/2,lo=typeof top==='function'?top(roundedU):top;
    const theta=lo+(bottom-lo)*roundedV;
    const edge=Math.min(u,1-u,v,1-v),soft=Math.sin(Math.min(1,edge/.13)*Math.PI/2);
    const irregular=Math.sin(phi*11+seed)*Math.sin(theta*14+seed)*.005*soft;
    const radius=layer?.91:.954+.060*soft+.040*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)+irregular;
    const p=point(theta,phi,radius);positions.push(...p);uvs.push(u,v);
  }
  const stride=nu+1,count=stride*(nv+1);
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
    const a=j*stride+i,b=a+1,c=a+stride,d=c+1;
    indices.push(a,c,b,b,c,d,a+count,b+count,c+count,b+count,d+count,c+count);
  }
  const edge=[];
  for(let i=0;i<=nu;i++)edge.push(i);
  for(let j=1;j<=nv;j++)edge.push(j*stride+nu);
  for(let i=nu-1;i>=0;i--)edge.push(nv*stride+i);
  for(let j=nv-1;j>0;j--)edge.push(j*stride);
  for(let i=0;i<edge.length;i++){const a=edge[i],b=edge[(i+1)%edge.length];indices.push(a,b,b+count,a,b+count,a+count);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function createSporeBall(w,s,g){
  g.name='Stompable spore balloon';
  const radius=s.w/2,depth=Math.max(.66,radius*.78);
  const cream=new THREE.MeshStandardMaterial({color:0xffe4a0,roughness:.92});
  const pale=new THREE.MeshStandardMaterial({color:0xffeab5,roughness:.95});
  const gold=new THREE.MeshStandardMaterial({color:0xeeb649,roughness:.9,emissive:0xa96716,emissiveIntensity:.035});
  const red=new THREE.MeshStandardMaterial({color:0xbb4947,roughness:.97,emissive:0x742126,emissiveIntensity:.04});
  const pollen=new THREE.MeshStandardMaterial({color:0xf5ba47,roughness:.93});
  const cloud=new THREE.MeshStandardMaterial({color:0xffe8b0,roughness:1});
  const shell=new THREE.Group();shell.name='Breathing spore shell';shell.position.x=radius;g.add(shell);
  const pod=new THREE.Group();pod.name='Stompable seed';shell.add(pod);
  mesh(w,new THREE.SphereGeometry(.935,40,28),gold,pod,'Golden inner spore body');
  // The red cap is recessed behind the five cream crown petals. Their pointed
  // inner edges reveal an actual star opening rather than a painted symbol.
  const mouth=mesh(w,new THREE.SphereGeometry(.946,48,16,0,Math.PI*2,0,.68),red,pod,'Recessed red star opening');mouth.quaternion.copy(crownTilt);
  for(let i=0;i<8;i++)mesh(w,plate(i*Math.PI/4,Math.PI/4-.028,.86+Math.sin(i*2)*.025,Math.PI-.09,i),i%3===0?pale:cream,pod,'Cream body shell segment');
  for(let i=0;i<5;i++)mesh(w,plate(i*Math.PI*2/5,Math.PI*2/5-.012,u=>.18+.31*Math.pow(Math.abs(u),2.4),.97,i+8),cream,pod,'Cream crown petal');
  // Broad golden speckles sit flush on the shell, like the target's clay spots.
  for(let i=0;i<8;i++){
    const phi=i*Math.PI/4,theta=1.25+(i%3)*.32,p=point(theta,phi,1.064);
    const spot=mesh(w,new THREE.SphereGeometry(1,16,10),gold,pod,'Golden shell spot');spot.position.copy(p);
    spot.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),p.clone().normalize());spot.scale.set(.10+(i%2)*.025,.12,.009);
  }
  // Fit the complete sculpture to the existing collider, with its top pinned.
  const localBox=new THREE.Box3(),size=new THREE.Vector3(),vertex=new THREE.Vector3();
  pod.traverse(o=>{if(o.isMesh){o.updateMatrix();const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)localBox.expandByPoint(vertex.fromBufferAttribute(p,i).applyMatrix4(o.matrix));}});
  localBox.getSize(size);pod.scale.set(s.w/size.x,s.w*.88/size.y,depth*2/size.z);
  pod.position.set(-(localBox.min.x+localBox.max.x)/2*pod.scale.x,-localBox.max.y*pod.scale.y,-(localBox.min.z+localBox.max.z)/2*pod.scale.z);
  const vent=point(.08,0,1.03).multiply(pod.scale).add(pod.position);vent.x+=radius;
  const spores=new THREE.Group();spores.name='Exhaled spores';g.add(spores);
  const motes=Array.from({length:12},(_,i)=>{
    const m=mesh(w,new THREE.SphereGeometry(1,14,10),pollen,spores,'Golden pollen ball');m.castShadow=false;m.receiveShadow=false;m.visible=false;return m;
  });
  const puffs=Array.from({length:3},(_,i)=>{
    const puff=new THREE.Group();puff.name='Clustered cream spore puff';spores.add(puff);
    for(const [x,y,z,r]of [[0,0,0,.12],[-.08,.09,0,.13],[.08,.12,.025,.12],[0,.23,-.025,.11],[-.035,.14,.09,.10]]){
      const m=mesh(w,new THREE.SphereGeometry(r,12,8),cloud,puff,'Soft puff lobe');m.position.set(x,y,z);m.castShadow=false;m.receiveShadow=false;
    }
    puff.visible=false;return puff;
  });
  g.userData.pod=pod;
  g.userData.sporeBreath={shell,material:gold,poreMaterial:red,spores,motes,puffs,vent,radius,depth,phase:s.x*.071};
}

export function animateSporeBall(g,t,reducedMotion){
  const b=g.userData.sporeBreath;if(!b)return;
  if(reducedMotion){b.shell.scale.set(1,1,1);b.material.emissiveIntensity=.035;b.poreMaterial.emissiveIntensity=.04;b.spores.visible=false;return;}
  b.spores.visible=true;
  const phase=((t+b.phase)%2.8)/2.8;
  const swell=phase<.72?Math.sin(phase/.72*Math.PI/2):Math.pow(1-(phase-.72)/.28,2);
  // Swell downwards and towards the camera; the landing surface stays fixed.
  b.shell.scale.set(1,.90+swell*.10,.96+swell*.12);
  b.material.emissiveIntensity=.025+swell*.08;b.poreMaterial.emissiveIntensity=.025+swell*.09;
  for(let i=0;i<b.motes.length;i++){
    const mote=b.motes[i],life=((phase-.69-(i%3)*.018+1)%1)/.30;
    mote.visible=life<1;if(!mote.visible)continue;
    const angle=i/b.motes.length*Math.PI*2,spread=.73+life*.75;
    mote.position.set(b.radius+Math.sin(angle)*b.radius*spread,-b.radius*.65+Math.cos(angle)*b.radius*.60+life*(.65+b.radius*.35),b.depth*.85+Math.sin(i*2.4)*life*.22);
    const size=(.065+(i%3)*.035)*Math.sin(Math.PI*life)*Math.max(.9,Math.sqrt(b.radius));mote.scale.setScalar(size);
  }
  for(let i=0;i<b.puffs.length;i++){
    const puff=b.puffs[i],life=((phase-.70-i*.045+1)%1)/.28;
    puff.visible=life<1;if(!puff.visible)continue;
    const side=i-1,travel=life*(.9+b.radius*.5);
    puff.position.set(b.vent.x+side*(.12+travel*.65),b.vent.y*b.shell.scale.y+travel,b.vent.z*b.shell.scale.z+.06+life*.22);
    puff.scale.setScalar(Math.sin(Math.PI*life)*(.8+life*.6)*Math.sqrt(b.radius));puff.rotation.z=-side*life*.38;
  }
}
