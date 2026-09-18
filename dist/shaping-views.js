import * as THREE from './lib/three.module.js';
import {rampProfile} from './shaping.js';
import {clayMaterial} from './clay.js';
import {GIVE,giveDepth} from './clay-give.js';
import {FORM,formHeight} from './clay-form.js';
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
export const MAGIC_CLAY=0x7a55b5;
function magicMaterials(w){
  if(w.mat.magicClay)return;
  const m=new THREE.MeshStandardMaterial({color:MAGIC_CLAY,roughness:.55,metalness:0,emissive:MAGIC_CLAY,emissiveIntensity:.04});
  // A shallower relief than terrain keeps the surface soft rather than gritty.
  clayMaterial(w,m,.032);
  // Prints and glitter follow each piece's own buffer, offset by where the piece
  // started, so neighbouring pieces read as one sheet cut apart.
  magicSkin(m,'position + vec3(magicSeed, 0.0)','position.y','attribute vec2 magicSeed;');
  w.mat.magicClay=m;
}
// The violet for a piece a section draws itself (the Folding Path's twisted
// tongue). Its geometry has to carry the `magicSeed` attribute the skin reads,
// set the way createClayView sets it below.
export function magicClayMaterial(w){magicMaterials(w);return w.mat.magicClay;}

// One lump of clay, and nothing stuck on it. An earlier pass gave every piece a
// separate slab on top and a cream grip ring with dents around it; on screen
// that read as machined parts bolted to a blob. The colour, the soft silhouette
// and the idle squash carry the meaning, so the ornament is gone.
export function createClayView(w,s,root){
  root.name='Shapeable clay · '+s.id;
  magicMaterials(w);
  if(s.clayRole==='block')return createBlockView(w,s,root);
  // The formable mass is the same welded lattice, with every column stretched
  // or squashed to the height the player has left it.
  if(s.clayRole==='mass')return createBlockView(w,s,root,{form:true});
  // A private buffer deforms in place; the existing clay material supplies surface relief.
  const mesh=new THREE.Mesh(roundedGrid(.13),w.mat.magicClay);
  mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  const from=s.shape?.from??s,seed=new Float32Array(mesh.geometry.attributes.position.count*2);
  for(let i=0;i<seed.length;i+=2){seed[i]=from.x;seed[i+1]=from.y;}
  mesh.geometry.setAttribute('magicSeed',new THREE.BufferAttribute(seed,2));
  const pieces=[{mesh,rest:mesh.geometry.attributes.position.array.slice()}];
  const view={root,clay:{pieces,breath:0,time:0},ropes:[],bounce:0};updateClayView(view,s);return view;
}

// Clay that can be worked is never quite still once the player is beside it: a
// slow squash about its own centre. The collider never moves — the breath is
// under two per cent — so this is feel, not geometry, and reduced motion keeps
// the clay perfectly still.
export function animateClayView(view,s,dt,{near=false,playing=true,reducedMotion=false}={}){
  const clay=view.clay;if(!clay)return;
  // A block this size breathing would shift tons of clay under the player's
  // feet. Its surface is already alive, and that is the only motion it has.
  if(clay.block){
    view.root.scale.set(1,1,1);view.root.position.set(s.x,s.y,0);
    if(clay.marble)animateMarbleView(clay.marble,s);
    if(clay.socket)animateSocketView(clay.socket,s,playing?dt:0);
    if(clay.mould)animateMouldView(clay.mould,s);
    return;
  }
  // Everything about the breath holds still when the game does, envelope
  // included, so a paused frame is genuinely a frozen frame.
  if(playing){clay.breath+=((near?1:0)-clay.breath)*(1-Math.exp(-dt*4));clay.time+=dt;}
  const swell=reducedMotion?0:Math.sin(clay.time*2.2)*.019*clay.breath;
  const kx=1+swell*.62,ky=1-swell,kz=1+swell*.62;
  view.root.scale.set(kx,ky,kz);
  const h=s.h??.65,cx=s.w/2,cy=(s.slope||0)/2-h/2;
  view.root.position.set(s.x+cx*(1-kx),s.y+cy*(1-ky),0);
}
// Two slow waves, so the lumps read as pinched by hand rather than tiled.
const lump=(a,b)=>Math.sin(a*5.1+b*3.7)*.56+Math.sin(a*2.3-b*4.9)*.44;

export function updateClayView(view,s){
  if(!view.clay)return;
  if(view.clay.block){updateBlockView(view,s);return;}
  const {pieces}=view.clay,key=[s.x,s.w,s.y,s.h,s.slope].join(':');
  if(view.clay.key===key)return;view.clay.key=key;
  const depth=s.clayRole==='landing'?3:2.6;
  for(const {mesh,rest}of pieces){
    const a=mesh.geometry.attributes.position;
    for(let i=0;i<a.count;i++){
      const u=rest[i*3]+.5,v=rest[i*3+1]+.5,z=rest[i*3+2];
      const rise=(s.slope||0)*(s.clayRole==='ramp'?rampProfile(u):u);
      // The body itself now reaches the collider's top, since nothing caps it.
      const h=s.h+(s.clayRole==='ramp'?rise:0),top=rise;
      let width=s.w;
      if(s.clayRole==='landing')width=1.5+(s.w-1.5)*Math.pow(v,5);
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
        z*depth*(1+lump(u*2.9,v*3.3)*.1)+Math.sin(u*s.w*3.1+v*s.h*2.2)*.05*Math.sin(z*3));
    }
    a.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  }
}

// --- a block of clay that gives ---------------------------------------------

// The block is drawn from its own buffer: one welded rounded box whose top rides
// the heightfield. Columns sit on the heightfield's nodes, so the drawn edge
// between two of them is the same straight line the collider interpolates, and
// the rows crowd towards the top where a dent bends the clay.
const BLOCK=Object.freeze({depth:3.5,round:.34,reach:4.2,thumbs:15});

// Where the press fades out down the body. Deeper than the deepest dent can go,
// so the rows below the surface are squeezed but can never fold over it.
const fall=y=>Math.max(0,Math.min(1,1+y/BLOCK.reach));

// Big soft thumb presses and the clay they push up around them, placed by a
// seed so the same block always wears the same hand.
function thumbs(s,H){
  let seed=Math.abs(Math.floor(s.x*97+s.w*13))%2147483646+1;
  const rand=()=>(seed=seed*16807%2147483647)/2147483647;
  return Array.from({length:BLOCK.thumbs},(_,i)=>({
    x:(i+.2+rand()*.6)/BLOCK.thumbs*s.w,y:-.9-rand()*Math.max(.5,Math.min(6.5,H-1)),
    rx:1+rand()*1.1,ry:.8+rand()*.8,turn:rand()*Math.PI,deep:.16+rand()*.16,swell:rand()<.35
  }));
}
function thumbRelief(list,x,y){
  let r=Math.sin(x*.9+y*.4)*.06+Math.sin(x*.37-y*.83)*.09;
  for(const t of list){
    const c=Math.cos(t.turn),n=Math.sin(t.turn),u=((x-t.x)*c+(y-t.y)*n)/t.rx,v=(-(x-t.x)*n+(y-t.y)*c)/t.ry,q=u*u+v*v;
    // A press is a soft bowl with a low rim; a swell is the same shape outward.
    if(q<2.2)r+=(t.swell?1:-1)*t.deep*(q<1?(1-q)*(1-q):0)+(t.swell?0:.05*Math.exp(-((Math.sqrt(q)-1.05)**2)/.05));
  }
  return r;
}

function createBlockView(w,s,root,{form=false}={}){
  // The mass is built to the height of its clump and stretched from there; a
  // free lump on a bench has next to no depth of its own below its base.
  const W=s.w,H=form?(s.form?.ref??Math.max(1,s.h||0)):(s.h??8),D=BLOCK.depth,r=BLOCK.round;
  const n=Math.max(3,Math.round(W/(form?FORM.spacing:GIVE.spacing))+1),dx=W/(n-1);
  // Lattice lines: every heightfield node across, rows dense near the top, and
  // extra lines inside each rounded edge so the corners stay round.
  const xs=[];for(let i=0;i<n;i++)xs.push(i*dx);
  for(const e of [.05,.14])xs.push(e,W-e);
  xs.sort((a,b)=>a-b);
  // The block dents only near its top, so its rows crowd there; the mass is
  // stretched whole, so its rows are spread evenly down the body, and closer
  // together, since a column pulled to full height pulls them apart.
  const ys=form?[0,-.05,-.14]:[0,-.03,-.09,-.17,-.27,-.4,-.56,-.75,-.97,-1.22,-1.5];
  while(ys.at(-1)-(form?.2:.38)>-H+.2)ys.push(ys.at(-1)-(form?.2:.38));
  ys.push(-H+.06,-H);ys.reverse();
  const zs=[-D/2,-D/2+.04,-D/2+.13,-D/2+.26];
  const inner=Math.ceil((D-.8)/.45);for(let i=1;i<inner;i++)zs.push(-D/2+.4+(D-.8)*i/inner);
  zs.push(D/2-.26,D/2-.13,D/2-.04,D/2);
  const NX=xs.length,NY=ys.length,NZ=zs.length,index=new Map(),rest=[],normal=[],columns=[];
  const vertex=(i,j,k)=>{
    const key=(i*NY+j)*NZ+k;if(index.has(key))return index.get(key);
    const x=xs[i],y=ys[j],z=zs[k];
    const cx=Math.max(r,Math.min(W-r,x)),cy=Math.max(-H+r,Math.min(-r,y)),cz=Math.max(-D/2+r,Math.min(D/2-r,z));
    let ox=x-cx,oy=y-cy,oz=z-cz;const len=Math.hypot(ox,oy,oz)||1;ox/=len;oy/=len;oz/=len;
    rest.push(cx+ox*r,cy+oy*r,cz+oz*r);normal.push(ox,oy,oz);columns.push(i);
    index.set(key,rest.length/3-1);return rest.length/3-1;
  };
  const faces=[];
  // Six faces of one lattice, welded along their shared edges so the rounded
  // corners shade smoothly instead of showing a seam.
  const face=(na,nb,at,out)=>{
    for(let a=0;a<na-1;a++)for(let b=0;b<nb-1;b++){
      const q=[at(a,b),at(a+1,b),at(a+1,b+1),at(a,b+1)];
      const p=k=>[rest[q[k]*3],rest[q[k]*3+1],rest[q[k]*3+2]];
      const [p0,p1,p2]=[p(0),p(1),p(2)];
      const e1=[p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]],e2=[p2[0]-p0[0],p2[1]-p0[1],p2[2]-p0[2]];
      const cross=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
      const flip=cross[0]*out[0]+cross[1]*out[1]+cross[2]*out[2]<0;
      if(flip)faces.push(q[0],q[2],q[1],q[0],q[3],q[2]);else faces.push(q[0],q[1],q[2],q[0],q[2],q[3]);
    }
  };
  face(NX,NY,(a,b)=>vertex(a,b,NZ-1),[0,0,1]);
  face(NX,NY,(a,b)=>vertex(a,b,0),[0,0,-1]);
  face(NX,NZ,(a,b)=>vertex(a,NY-1,b),[0,1,0]);
  face(NX,NZ,(a,b)=>vertex(a,0,b),[0,-1,0]);
  face(NY,NZ,(a,b)=>vertex(0,a,b),[-1,0,0]);
  face(NY,NZ,(a,b)=>vertex(NX-1,a,b),[1,0,0]);
  // Hand-pressed relief, pushed along each rest normal. It fades out towards the
  // top so the rounded upper edge is never lifted above the walking surface.
  const list=thumbs(s,H),count=rest.length/3,push=new Float32Array(count*3),down=new Float32Array(count);
  for(let i=0;i<count;i++){
    const x=rest[i*3],y=rest[i*3+1],z=rest[i*3+2],nz=normal[i*3+2];
    const band=Math.max(0,Math.min(1,(-y-.15)/.65)),facing=Math.abs(nz)>.2?Math.abs(nz):.35;
    // The front carries the thumbs; the ends and the back are only lumpy.
    const amount=band*facing*(nz>.2?thumbRelief(list,x,y):Math.sin(x*1.3+y*.7+z)*.05);
    // A soft belly: the body bows out a little below the top and tucks in at
    // the foot, the way a heavy lump settles.
    const belly=band*Math.sin(Math.min(1,-y/H)*Math.PI)*.12;
    for(let k=0;k<3;k++)push[i*3+k]=normal[i*3+k]*(amount+belly*(k===1?0:1));
    down[i]=fall(y);
  }
  const geometry=new THREE.BufferGeometry();
  const position=new THREE.BufferAttribute(new Float32Array(count*3),3);position.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',position);
  geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(normal),3));
  // The relief texture is laid in the rest shape, so it stretches with the clay
  // instead of sliding over it as the surface moves.
  geometry.setAttribute('clayRest',new THREE.BufferAttribute(new Float32Array(rest),3));
  // How far a vertex's own stretch of clay stands from its rest height, so the
  // relief can let go of the shape once holding onto it would squash it flat.
  const stretch=new THREE.BufferAttribute(new Float32Array(count).fill(1),1);stretch.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('clayStretch',stretch);
  geometry.setIndex(faces);
  const mesh=new THREE.Mesh(geometry,blockMaterial(w));mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.name='Soft clay block';root.add(mesh);
  // Room for the swell above the top and the belly at the sides, so culling
  // never drops a block that is still on screen.
  // Room for the swell above the top and the belly at the sides, and for the
  // mass, for every column at the most clay it can hold.
  const reachY=form?FORM.maxHeight:H,base=form?-(s.h||0):-H;
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(W/2,base+reachY/2,0),Math.hypot(W/2+.5,reachY/2+.6,D/2+.5));
  const block={rest:new Float32Array(rest),push,down,columns:Uint16Array.from(columns),xs:Float64Array.from(xs),lift:new Float64Array(NX),version:-1,form,H,base};
  const view={root,clay:{pieces:[{mesh,rest:block.rest}],block,breath:0,time:0},ropes:[],bounce:0};
  if(form&&s.mould)view.clay.mould=createMouldView(s,root,D,base);
  if(form&&s.marble)view.clay.marble=createMarbleView(w,s,root);
  if(form&&s.marble&&s.socket)view.clay.socket=createSocketView(w,s,root);
  updateBlockView(view,s);return view;
}

// --- a mould to cast, and a marble to roll -----------------------------------

// The shape the clay is to be cast into, drawn as a soft ribbon along the front
// edge of the trough at the target's height, so the silhouette to match is
// read against the clay's own silhouette. It brightens as the cast comes close
// and turns green when it is done, which is the only scoreboard the mould has.
const MOULD_INK=0xf6ecd6,MOULD_CAST=0x9be7a8,MOULD_BAND=.09;
function createMouldView(s,root,D,base){
  const target=s.mould,n=target.length,dx=s.w/(n-1),z=D/2+.06;
  const positions=new Float32Array(n*2*3),indices=[];
  for(let i=0;i<n;i++){
    const x=i*dx,y=base+target[i],j=i*6;
    positions[j]=x;positions[j+1]=y+MOULD_BAND;positions[j+2]=z;
    positions[j+3]=x;positions[j+4]=y-MOULD_BAND;positions[j+5]=z;
    if(i){const a=(i-1)*2,b=i*2;indices.push(a,a+1,b,a+1,b+1,b);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({color:MOULD_INK,transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Mould · '+s.id;mesh.renderOrder=2;root.add(mesh);
  return mesh;
}
function animateMouldView(mesh,s){
  const k=Math.max(0,Math.min(1,s.mouldMatch||0));
  mesh.material.opacity=.45+.45*k;
  mesh.material.color.setHex(k>=.995?MOULD_CAST:MOULD_INK);
}

// The marble: a bead-gold ball that sits on the surface where the rule has it
// and turns as it rolls. Or, where the station asks for a rock, a boulder in
// the chapter's own clay: the same ball, bigger, the colour of the ground it
// came off, and a little flattened so it reads as stone rather than a bead.
const MARBLE_GOLD=0xe4b04a;
function createMarbleView(w,s,root){
  const m=s.marble,rock=s.marbleLook==='rock';
  const colour=rock?(w.mat.terrain?.color?.getHex()??0xe64e1e):MARBLE_GOLD;
  const material=clayMaterial(w,new THREE.MeshStandardMaterial({color:colour,roughness:rock?.62:.38,metalness:rock?0:.12,emissive:colour,emissiveIntensity:rock?.03:.08}),rock?.09:.04);
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(m.r,rock?22:28,rock?16:20),material);
  if(rock){mesh.scale.set(1,.93,.96);mesh.rotation.y=.4;}
  mesh.name=(rock?'Boulder · ':'Marble · ')+s.id;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  animateMarbleView(mesh,s);return mesh;
}
// The socket the marble is bound for is marked so the goal reads from the far
// end of the trough: a gold hoop the marble's colour standing over the hollow,
// facing the camera (flat on the clay it would be a line from the side), just
// big enough that the seated marble sits inside it. It rides the surface as
// the clay is worked, turns slowly until the marble is home, and glows green
// once it is.
const SOCKET_HOME=0x9be7a8;
function createSocketView(w,s,root){
  const m=s.marble,material=new THREE.MeshStandardMaterial({color:MARBLE_GOLD,roughness:.4,metalness:.15,emissive:MARBLE_GOLD,emissiveIntensity:.35});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(m.r*1.5,.07,10,40),material);
  ring.name='Socket · '+s.id;ring.castShadow=true;root.add(ring);
  animateSocketView(ring,s,0);return ring;
}
function animateSocketView(ring,s,dt){
  const f=s.form,socket=s.socket,m=s.marble;if(!f||!socket)return;
  const x=(socket[0]+socket[1])/2,home=!!m?.home;
  ring.position.set(x,-(s.h||0)+formHeight(f,x)+m.r,0);
  ring.rotation.y+=home?0:dt*.9;
  ring.material.color.setHex(home?SOCKET_HOME:MARBLE_GOLD);ring.material.emissive.setHex(home?SOCKET_HOME:MARBLE_GOLD);
}
function animateMarbleView(mesh,s){
  const m=s.marble,f=s.form;if(!m||!f)return;
  // Over the edge it is placed by the world, read back into the root that
  // stands at the mass's own corner.
  if(m.spilled&&Number.isFinite(m.wx))mesh.position.set(m.wx-s.x,m.wy-s.y,0);
  else mesh.position.set(m.x,-(s.h||0)+formHeight(f,m.x)+m.r,0);
  mesh.rotation.z=-m.spin;
}

// Thumbprints, glitter and depth for every piece of violet clay, keyed on a
// position that belongs to the clay rather than to the world, so they stay put
// as a piece breathes. Neither prints nor glitter cover the whole skin: a noise
// map picks the few spots a thumb pressed hard and the patches where glitter
// was kneaded in, and everywhere else the clay keeps its plain surface.
// Exported for the Colour River's stream clay (dream/river-clay.js), which
// wears the same hashes, spots and glitter recoloured.
export const MAGIC_SKIN=`
// A sine hash loses precision on large inputs, and chapters run to hundreds of
// units. Folding coordinates into ±289 keeps every hash well conditioned while
// leaving anything already inside that range untouched.
vec2 magicFold(vec2 p) { return p - 578.0 * floor((p + 289.0) / 578.0); }
vec3 magicFold(vec3 p) { return p - 578.0 * floor((p + 289.0) / 578.0); }
float magicHash(vec2 p) { p = magicFold(p);return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float magicHash3(vec3 p) { p = magicFold(p);return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
vec2 magicHash2(vec2 p) { p = magicFold(p);return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
// One plane for the three directions: blending coordinates rather than samples
// costs one search instead of three, and the stretch at the rounded edges reads
// as a smeared print.
vec2 magicPlane(vec3 p, vec3 n) {
  vec3 k = pow(abs(normalize(n)), vec3(4.0));k /= max(dot(k, vec3(1.0)), 0.0001);
  return p.xy * k.z + (p.xz + vec2(3.1, 7.7)) * k.y + (p.zy + vec2(5.3, 1.9)) * k.x;
}
float magicNoise(vec2 p) {
  vec2 i = floor(p), f = p - i;f = f * f * (3.0 - 2.0 * f);
  return mix(mix(magicHash(i), magicHash(i + vec2(1.0, 0.0)), f.x), mix(magicHash(i + vec2(0.0, 1.0)), magicHash(i + 1.0), f.x), f.y);
}
// Soft-edged spots over a share of the skin. Two octaves keep their outlines
// irregular; the threshold is where that sum leaves the share uncovered, so
// 0.71 marks about a tenth of the surface and 0.59 about three tenths. That
// holds over the whole map, but one block face spans only a few of its cells,
// so each map is offset onto a patch that gives the face its share: measured
// on the sag block's front, 9% prints and 30% glitter.
float magicSpots(vec2 p, float scale, float threshold) {
  float n = 0.65 * magicNoise(p * scale) + 0.35 * magicNoise(p * scale * 2.3 + vec2(17.1, 5.3));
  return smoothstep(threshold - 0.025, threshold + 0.025, n);
}
// Each cell of a jittered grid holds one pressed thumb at its own angle, drawn
// at a scale the eye can read: the ball texture's own ridges are finer than a
// pixel at this framing. The nearest thumb wins, so ridges run on unbroken.
float magicPrints(vec2 p, float size) {
  // A slow wander bends every ridge, and a finer one lets them fork and end.
  p += 0.09 * sin(p.yx * vec2(3.3, 2.9) + 1.7) + 0.035 * sin(p.yx * vec2(11.0, 9.0));
  float fork = 0.9 * magicNoise(p * 5.5);
  vec2 cell = floor(p / size);
  float sum = 0.0, weights = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(i, j), h = magicHash2(c);
    vec2 d = p - (c + 0.15 + 0.7 * h) * size;
    float a = h.x * 6.2832;
    d = mat2(cos(a), -sin(a), sin(a), cos(a)) * d;
    float w = pow(exp(-dot(d, d) * 3.4) * (0.5 + 0.5 * h.y), 3.0);
    // Mostly the sweeping arches of a thumb's side; now and then its whorl.
    float whorl = length(d * vec2(1.0, 0.6 + 0.3 * h.y)) + 0.04 * sin(atan(d.y, d.x) * 2.0 + h.y * 9.0);
    float arch = d.y + (0.35 + 0.4 * h.y) * d.x * d.x + 0.06 * sin(d.x * 4.0 + h.x * 5.0);
    sum += w * sin(mix(arch, whorl, step(0.72, magicHash(c + 7.3))) * 60.0 + fork * 2.2 + h.y * 6.2832);weights += w;
  }
  return sum / (weights + 0.0000001);
}
// Glitter kneaded through the clay: at most one fleck per small cell, thinned by
// a coarser field so flecks gather loosely, and measured across the surface so
// each reads as a round speck. Dim ones sit just under the skin.
vec3 magicGlitter(vec3 p, vec3 n, float pixel) {
  vec3 cell = floor(p / 0.15), f = p / 0.15 - cell;
  float cluster = magicHash3(floor(p / 0.9) + 7.0);
  if (magicHash3(cell) > 0.013 + 0.045 * cluster * cluster) return vec3(0.0);
  vec3 v = f - (0.3 + 0.4 * vec3(magicHash3(cell + 1.3), magicHash3(cell + 4.1), magicHash3(cell + 8.7)));
  // Never smaller than a pixel, but a grazing edge must not blow one up.
  float size = max(0.09 + 0.17 * pow(magicHash3(cell + 2.9), 4.0), min(pixel * 8.0, 0.2)), d = length(v - n * dot(v, n)) / size;
  float kind = magicHash3(cell + 5.5), depth = mix(0.35, 1.0, magicHash3(cell + 9.2));
  vec3 tint = kind < 0.4 ? vec3(1.6, 0.35, 1.25) : kind < 0.7 ? vec3(0.35, 0.85, 1.2) : vec3(1.2, 0.95, 0.55);
  return tint * depth * ((1.0 - smoothstep(0.25, 1.0, d)) * 2.6 + exp(-d * 1.4) * step(0.13, size)) * (1.0 - smoothstep(0.03, 0.06, pixel));
}
`;

// Layers the violet skin over a material the clay relief is already installed
// on. `source` names the clay's own coordinates and `height` how far below its
// top a point sits, both as vertex-shader expressions.
function magicSkin(m,source,height,declare=''){
  if(!m.userData.clay)return m;
  const compile=m.onBeforeCompile,key=m.customProgramCacheKey;
  m.onBeforeCompile=(shader,renderer)=>{
    compile.call(m,shader,renderer);
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
${declare}
varying vec3 vMagicPosition;
varying float vMagicHeight;`).replace('#include <project_vertex>',`vMagicPosition = ${source};
vMagicHeight = ${height};
#include <project_vertex>`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vMagicPosition;\nvarying float vMagicHeight;'+MAGIC_SKIN)
      .replace('diffuseColor.rgb *= mix(1.0, clayData.b / 0.94, 0.55);',`diffuseColor.rgb *= mix(1.0, clayData.b / 0.94, 0.55);
vec2 magicUV = magicPlane(vMagicPosition, vClayNormal);
float magicPixel = max(length(dFdx(magicUV)), length(dFdy(magicUV)));
// Prints on a tenth of the skin, fading where ridges would be finer than about
// three pixels and only shimmer. Outside a spot the search can be skipped.
float magicMask = magicSpots(magicUV + vec2(1.0, -2.0), 0.45, 0.71) * (1.0 - smoothstep(0.022, 0.036, magicPixel)), magicPrint = 0.0;
if (magicMask > 0.0) magicPrint = magicPrints(magicUV, 1.15);
diffuseColor.rgb *= 1.0 - 0.06 * magicMask * smoothstep(0.1, 0.9, -magicPrint);
// The foot of a tall piece sits darker than its top.
diffuseColor.rgb *= mix(0.66, 1.0, smoothstep(-7.5, -1.0, vMagicHeight));`)
      .replace('clayData.r * bumpScale, faceDirection','clayData.r * bumpScale + magicPrint * magicMask * 0.0019, faceDirection')
      .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
// Light bouncing inside the clay keeps its turned-away sides a deep, saturated
// violet rather than the grey the sky's ground colour would give them, and a
// little of it scatters back out at the rims.
vec3 magicUp = inverseTransformDirection(geometryNormal, viewMatrix);
reflectedLight.indirectDiffuse *= mix(vec3(0.62, 0.5, 0.95), vec3(1.0), smoothstep(-0.8, 0.6, magicUp.y));
totalEmissiveRadiance += vec3(0.32, 0.16, 0.8) * pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 3.0) * 0.16;
// Glitter at half strength, and only in about three tenths of the skin. Its
// brightest cores clip in tone mapping, so 0.45 of the light is what reads as
// half as bright on screen.
float magicSparkle = magicSpots(magicUV + vec2(32.7, 20.9), 0.35, 0.59);
if (magicSparkle > 0.0) totalEmissiveRadiance += magicGlitter(vMagicPosition, normalize(vClayNormal), magicPixel) * magicSparkle * 0.45;`);
  };
  m.customProgramCacheKey=()=>key.call(m)+'-magic';
  return m;
}

// How far the surface may be squashed, or drawn out, before it stops following
// the clay. Rest coordinates hold the grain to the material, which is what a
// hand worked into it should do, but a column pressed to a fraction of its
// height draws its whole rest span across that fraction, and the mass spread
// flat is a thirteenth of the height it was built at. Two is about as far as a
// thumbprint goes on being a thumbprint.
export const BLOCK_SQUASH=2;

// The shared magic clay, taught to read its relief from the rest shape.
function blockMaterial(w){
  if(w.mat.magicBlock)return w.mat.magicBlock;
  // A fresh material rather than a clone: a clone shares the relief's settings
  // but not its shader hook, and would come out perfectly smooth.
  const m=new THREE.MeshStandardMaterial({color:MAGIC_CLAY,roughness:.55,metalness:0,emissive:MAGIC_CLAY,emissiveIntensity:.04});
  clayMaterial(w,m,.045);
  const cap=BLOCK_SQUASH.toFixed(1),compile=m.onBeforeCompile,key=m.customProgramCacheKey;
  m.onBeforeCompile=(shader,renderer)=>{
    compile.call(m,shader,renderer);
    // The rest height comes down with its column as far as the cap allows, and
    // past that the surface slides through the clay rather than squashing with
    // it. `clayFit` is what squashing is left after the cap, between 1/cap and
    // cap, and the clay's own coordinates follow for the prints and the glitter.
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute vec3 clayRest;
attribute float clayStretch;
varying float vClayRelief;`).replace('vClayPosition = position * claySize',`float clayHold = max(clayStretch, 0.0001);
float clayFlatten = clamp(1.0, clayHold / ${cap}, clayHold * ${cap});
float clayFit = clayHold / clayFlatten;
vClayRelief = min(1.0, clayFit);
vec3 clayFlat = vec3(clayRest.x, clayRest.y * clayFlatten, clayRest.z);
vClayPosition = clayFlat * claySize`)
    // The normals belong to the squashed surface while the coordinates belong to
    // the flattened rest one, so the triplanar blend has to be carried across:
    // on a slab pressed thin a rounded edge turns its normal over within a pixel
    // or two while its coordinates are still a third of a unit from the corner,
    // and the projection that picks the wrong face there smears along the edge.
      .replace('vClayNormal = normalize(normal / max(claySize, vec3(0.0001)));','vClayNormal = normalize(normal * vec3(1.0, clayFit, 1.0) / max(claySize, vec3(0.0001)));');
    // Whatever squashing the cap let through steepens every slope in the relief
    // by as much, which is what reads as hard banding rather than clay, so the
    // relief is softened to match and keeps the depth it was drawn at. Only the
    // height's screen gradient is used, so the softening is taken about the
    // field's middle: scaling the height whole would turn the change in
    // softening from one column to the next into a slope of its own.
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vClayRelief;')
      .replace('vec3 clayData = claySurface(vClayPosition, vClayNormal);','vec3 clayData = claySurface(vClayPosition, vClayNormal);\nclayData.r = (clayData.r - 0.5) * vClayRelief + 0.5;');
  };
  m.customProgramCacheKey=()=>key.call(m)+'-rest';
  // The block's top is its rest shape's zero, so its rest height is the depth.
  return w.mat.magicBlock=magicSkin(m,'clayFlat','clayFlat.y');
}

// Rebuilds the buffer only when the heightfield has actually moved, and
// recomputes normals only then.
function updateBlockView(view,s){
  const b=view.clay.block,f=b.form?s.form:s.give,version=f?f.version:0;
  if(b.version===version&&b.x===s.x&&b.y===s.y)return false;
  b.version=version;b.x=s.x;b.y=s.y;
  const {mesh}=view.clay.pieces[0],a=mesh.geometry.attributes.position,out=a.array,{rest,push,down,columns,xs,lift,H,base}=b;
  const span=mesh.geometry.attributes.clayStretch,stretch=span.array;
  if(b.form){
    // Every vertex is the rest body scaled from the base to the height the
    // clay stands at its own x, relief included, so the surface relief
    // squashes with a low column and can never lift a rounded top edge above
    // the walking surface. Its own x, not its lattice line's: a rounded corner
    // vertex sits inside its line, and on a squashed column beside a steep
    // face that difference is the whole of its height. That scale is also the
    // whole of how far the clay stands from its rest height, so it is what the
    // surface has to follow.
    for(let i=0,count=a.count;i<count;i++){
      const j=i*3,k=(f?formHeight(f,rest[j]):H)/H;
      out[j]=rest[j]+push[j]*k;
      out[j+1]=base+(rest[j+1]+H+push[j+1])*k;
      out[j+2]=rest[j+2]+push[j+2]*k;
      stretch[i]=k;
    }
    a.needsUpdate=true;span.needsUpdate=true;mesh.geometry.computeVertexNormals();
    return true;
  }
  // A dent carries the rows under it down less than the ones at the surface, so
  // the clay between them is squeezed by however fast the press fades with
  // depth. A boot goes most of `reach` down, so that is a real squash too.
  for(let c=0;c<xs.length;c++)lift[c]=f?giveDepth(f,xs[c]):0;
  for(let i=0,count=a.count;i<count;i++){
    const j=i*3;
    out[j]=rest[j]+push[j];
    out[j+1]=rest[j+1]-lift[columns[i]]*down[i]+push[j+1];
    out[j+2]=rest[j+2]+push[j+2];
    stretch[i]=down[i]>0?1-lift[columns[i]]/BLOCK.reach:1;
  }
  a.needsUpdate=true;span.needsUpdate=true;mesh.geometry.computeVertexNormals();
  return true;
}
