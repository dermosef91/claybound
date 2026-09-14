import * as THREE from './lib/three.module.js';
import {rampProfile} from './shaping.js';
import {clayMaterial} from './clay.js';
// Keep vertices across the broad faces, so curved collision profiles also
// curve between the corners. Corner-only rounded boxes leave a flat centre.
function roundedGrid(radius){
  const geometry=new THREE.BoxGeometry(1,1,1,24,16,8),a=geometry.attributes.position,half=.5-radius;
  for(let i=0;i<a.count;i++){
    const point=new THREE.Vector3().fromBufferAttribute(a,i),inner=point.clone().clampScalar(-half,half);
    point.sub(inner).normalize().multiplyScalar(radius).add(inner);a.setXYZ(i,point.x,point.y,point.z);
  }
  return geometry;
}

// Magic clay is its own material, not a recolour of terrain: violet, smoother
// and glossier than the sculpted world around it, so "you can work this" reads
// before any cue appears and without depending on colour alone.
// One step darker than the first pass: the reference blob is a deeper violet
// than the lilac that ended up on screen, which read washed out against the sky.
export const MAGIC_CLAY=0x7a55b5,MAGIC_CLAY_LIGHT=0x8b68c7;
function magicMaterials(w){
  for(const [name,color,roughness]of [['magicClay',MAGIC_CLAY,.55],['magicClayLight',MAGIC_CLAY_LIGHT,.47]]){
    if(w.mat[name])continue;
    const m=new THREE.MeshStandardMaterial({color,roughness,metalness:0,emissive:color,emissiveIntensity:.04});
    // A shallower relief than terrain keeps the surface soft rather than gritty.
    clayMaterial(w,m,.032);w.mat[name]=m;
  }
}

export function createClayView(w,s,root){
  root.name='Shapeable clay · '+s.id;
  magicMaterials(w);
  const pieces=[],monolithic=['ramp','bridge'].includes(s.clayRole);
  for(const cap of monolithic?[false]:[false,true]){
    // Private buffers deform in place; the existing clay material supplies surface relief.
    // Caps round off harder than the body so the silhouette reads as pinchable.
    const mesh=new THREE.Mesh(roundedGrid(cap?.3:.13),w.mat[cap||monolithic?'magicClayLight':'magicClay']);
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    pieces.push({mesh,rest:mesh.geometry.attributes.position.array.slice(),cap});
  }
  const marker=new THREE.Group();root.add(marker);marker.name='Clay grip';
  const grip=w.mesh(new THREE.TorusGeometry(.2,.045,8,24),'cream',marker,0,0,0);
  for(const dx of [-.12,0,.12])w.ball(.026,.075,.025,'cream',marker,dx,0,.04);
  // Two thumb dents pressed into the surface either side of the grip: the clay
  // looks like something hands have already worked, and will work again.
  for(const dx of [-.42,.42]){const dent=w.ball(.14,.17,.05,'magicClay',marker,dx,0,-.02);dent.scale.z=.5;dent.rotation.z=dx>0?-.3:.3;}
  const view={root,clay:{pieces,marker,grip,breath:0,time:0},ropes:[],bounce:0};updateClayView(view,s);return view;
}

// Clay that can be worked is never quite still once the player is beside it: a
// slow squash about its own centre, and a grip mark that swells with it. The
// collider never moves — the breath is under two per cent — so this is feel,
// not geometry. Reduced motion keeps the clay still and the grip steady.
export function animateClayView(view,s,dt,{near=false,playing=true,reducedMotion=false}={}){
  const clay=view.clay;if(!clay)return;
  // Everything about the breath holds still when the game does, envelope
  // included, so a paused frame is genuinely a frozen frame.
  if(playing){clay.breath+=((near?1:0)-clay.breath)*(1-Math.exp(-dt*4));clay.time+=dt;}
  const swell=reducedMotion?0:Math.sin(clay.time*2.2)*.019*clay.breath;
  const kx=1+swell*.62,ky=1-swell,kz=1+swell*.62;
  view.root.scale.set(kx,ky,kz);
  const h=s.h??.65,cx=s.w/2,cy=(s.slope||0)/2-h/2;
  view.root.position.set(s.x+cx*(1-kx),s.y+cy*(1-ky),0);
  clay.marker.scale.setScalar(1+clay.breath*.22+(reducedMotion?0:swell*2.2));
}
// Two slow waves, so the lumps read as pinched by hand rather than tiled.
const lump=(a,b)=>Math.sin(a*5.1+b*3.7)*.56+Math.sin(a*2.3-b*4.9)*.44;

export function updateClayView(view,s){
  if(!view.clay)return;
  const {pieces,marker}=view.clay,key=[s.x,s.w,s.y,s.h,s.slope].join(':');
  if(view.clay.key===key)return;view.clay.key=key;
  const depth=s.clayRole==='landing'?3:2.6,monolithic=['ramp','bridge'].includes(s.clayRole);
  for(const {mesh,rest,cap}of pieces){
    const a=mesh.geometry.attributes.position;
    for(let i=0;i<a.count;i++){
      const u=rest[i*3]+.5,v=rest[i*3+1]+.5,z=rest[i*3+2];
      const rise=(s.slope||0)*(s.clayRole==='ramp'?rampProfile(u):u);
      const h=cap?.35:s.h+(s.clayRole==='ramp'?rise:0),top=rise-(cap||monolithic?0:.23);
      let width=s.w;
      if(s.clayRole==='landing'&&!cap)width=1.5+(s.w-1.5)*Math.pow(v,5);
      // Hand-pressed lumps: the sides and base bulge, the surface dimples, and
      // the top row is only ever pushed down — never above its own collider,
      // and never far enough to disagree with the walking surface.
      const amp=Math.min(.15,Math.max(.05,Math.min(s.w,h)*.1));
      const flank=Math.pow(1-v,.6);
      const bulge=lump(u*3.1+s.x*.37,v*2.6)*amp*flank;
      const dimple=-Math.abs(lump(u*4.3+s.x*.53,v*1.7))*Math.min(.02,amp*.3);
      a.setXYZ(i,
        s.w/2+(u-.5)*width+bulge,
        top-(1-v)*h+dimple,
        z*(cap?depth+.16:depth)*(1+lump(u*2.9,v*3.3)*.1)+Math.sin(u*s.w*3.1+v*s.h*2.2)*.05*Math.sin(z*3));
    }
    a.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  }
  marker.position.set(s.w*.5,(s.slope||0)*.5-.55,depth*.5+.12);
}
