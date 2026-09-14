import * as THREE from './lib/three.module.js';

const kinds=['mushroom','crystal','torch'],fadeSeconds=.6;

// Three selected fixtures plus one shared handoff light. Only one fixture
// changes at a time, keeping the shader's light count fixed at four.
export function createCaveLights(){
  return Array.from({length:4},()=>new THREE.PointLight(0xffbd70,0,13,2));
}

const bind=source=>source?{source,position:source.position.clone(),color:source.color||0xffbd70,power:source.power||26,range:source.range||13}:null;
function draw(light,binding,weight,live){
  light.intensity=0;if(!binding)return;
  // Removed or wrapped fixtures fade from their last position. Never move a
  // still-lit lamp to a detached node's local origin or across a parallax seam.
  if(live.has(binding.source)&&!binding.frozen){
    if(binding.position.distanceTo(binding.source.position)>binding.range*2)binding.frozen=true;
    else binding.position.copy(binding.source.position);
  }
  light.position.copy(binding.position);light.color.setHex(binding.color);
  light.distance=binding.range;light.intensity=binding.power*weight;
}

// Backdrop fixtures hang from baked, non-updating transforms, and the caller
// resolves those parallax parents immediately before this runs. Reading the
// resolved matrix avoids rebuilding the same chain once per fixture. Fixtures
// built into platforms sit under transforms that compose themselves each
// frame, so those still resolve their own chain.
const settled=(node,root)=>{if(!root)return false;for(let p=node;p;p=p.parent)if(p===root)return true;return false;};

export function animateCaveLights(w,dt=0){
  if(w.biome!=='cave'){w.torchLights.forEach(l=>l.intensity=0);w.caveLightState=null;return;}
  for(const tr of w.torches){
    if(!tr.kind||tr.kind==='torch'){
      tr.flame.scale.y=.42*(1+Math.sin(w.time*8.5+tr.phase)*.045);
      tr.flame.rotation.z=Math.sin(w.time*5+tr.phase)*.055;
    }
    if(settled(tr.flame,w.backRoot))tr.position.setFromMatrixPosition(tr.flame.matrixWorld);
    else tr.flame.getWorldPosition(tr.position);
    tr.position.z+=1.1;
  }
  const live=new Set(w.torches),score=tr=>(tr.position.x-w.cameraX)**2+(tr.position.y-w.cameraY)**2;
  const near=w.torches.filter(tr=>Math.abs(tr.position.x-w.cameraX)<(w.viewW||18)*.7+5&&Math.abs(tr.position.y-w.cameraY)<(w.viewH||10)*.8+5).sort((a,b)=>score(a)-score(b));
  const nearest=kind=>near.find(tr=>(tr.kind||'torch')===kind)||null;
  let state=w.caveLightState;
  if(!state||Math.hypot(w.cameraX-state.x,w.cameraY-state.y)>Math.max(24,(w.viewW||18)*2)){
    w.torchLights.forEach(l=>l.intensity=0);
    state=w.caveLightState={slots:kinds.map((kind,i)=>({kind,light:w.torchLights[i],binding:bind(nearest(kind))})),spare:w.torchLights[3],transition:null};
  }
  state.x=w.cameraX;state.y=w.cameraY;
  if(!state.transition){
    for(const slot of state.slots){
      const current=slot.binding?.source,candidate=nearest(slot.kind);
      const valid=current&&live.has(current)&&!slot.binding.frozen&&near.includes(current);
      // Keep the current fixture through tiny camera changes at a midpoint.
      const better=candidate&&(!valid||score(candidate)+9<score(current)*.72);
      if((!valid&&current)||(!current&&candidate)||(candidate!==current&&better)){
        state.transition={slot,incoming:bind(candidate),progress:0};break;
      }
    }
  }
  const transition=state.transition;
  if(transition)transition.progress=Math.min(1,transition.progress+Math.max(0,dt)/fadeSeconds);
  const blend=transition?transition.progress**2*(3-2*transition.progress):0;
  state.spare.intensity=0;
  for(const slot of state.slots)draw(slot.light,slot.binding,transition?.slot===slot?1-blend:1,live);
  if(transition){
    draw(state.spare,transition.incoming,blend,live);
    if(transition.progress===1){
      const previous=transition.slot.light;
      transition.slot.light=state.spare;transition.slot.binding=transition.incoming;
      state.spare=previous;state.spare.intensity=0;state.transition=null;
    }
  }
}
