import * as THREE from './lib/three.module.js';
import {cullCaveCells} from './cavern.js';

// Some drivers hand back an offscreen target that never received the scenery
// drawn into it, which turns the composite below into a blank sky rather than
// an unblurred one. A synthetic probe does not catch this - a bare quad
// survives the round trip on hardware where the chapter's own clay materials
// do not - so the probe has to be the real thing: draw this chapter's own
// backdrop into the target once, with no background behind it, and read it
// back. All black means nothing arrived, and the chapter draws its scenery
// straight into the frame for the rest of the session instead.
const PROBE_POINTS=[[.5,.5],[.25,.6],[.75,.6],[.5,.75],[.35,.4]];
function compositeUsable(w,target,hidden){
  const cache=w.depthCompositeOk??={};
  if(cache[w.biome]!==undefined)return cache[w.biome];
  if(typeof w.renderer.readRenderTargetPixels!=='function')return cache[w.biome]=true;
  const background=w.scene.background,pixel=new Uint8Array(4);let lit=false;
  try{
    w.scene.background=null;
    hidden.forEach(o=>o.visible=false);
    w.renderer.setRenderTarget(target);w.renderer.render(w.scene,w.camera);
    for(const [u,v] of PROBE_POINTS){
      w.renderer.readRenderTargetPixels(target,Math.round(u*target.width),Math.round(v*target.height),1,1,pixel);
      if(pixel[0]||pixel[1]||pixel[2]){lit=true;break;}
    }
  }catch{lit=false;}
  finally{
    w.scene.background=background;hidden.forEach(o=>o.visible=true);w.renderer.setRenderTarget(null);
  }
  return cache[w.biome]=lit;
}

// Render only distant scenery at reduced resolution. The game plane, hero,
// ropes and platforms stay sharp, like a small photographed clay set.
export function renderCitadelDepth(w){
  // The canyon and the caverns are authored for the direct draw. Wildwood and
  // the citadel take the composite where it survives; distance fog carries
  // the depth either way.
  const direct=w.biome==='desert'||w.biome==='cave'||w.depthCompositeOk?.[w.biome]===false;
  if(direct){
    if(w.biome==='cave')cullCaveCells(w);
    if(w.citadelDepth)w.citadelDepth.quad.visible=false;
    w.backRoot.visible=true;w.renderer.setRenderTarget(null);
    w.renderer.render(w.scene,w.camera);return;
  }
  if(!w.citadelDepth){
    const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false});
    const material=new THREE.ShaderMaterial({
      uniforms:{map:{value:target.texture},texel:{value:new THREE.Vector2()}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}',
      fragmentShader:`uniform sampler2D map;uniform vec2 texel;varying vec2 vUv;
        void main(){
          vec3 c=texture2D(map,vUv).rgb*.25;
          c+=texture2D(map,vUv+vec2(texel.x,0.)).rgb*.125;
          c+=texture2D(map,vUv-vec2(texel.x,0.)).rgb*.125;
          c+=texture2D(map,vUv+vec2(0.,texel.y)).rgb*.125;
          c+=texture2D(map,vUv-vec2(0.,texel.y)).rgb*.125;
          c+=texture2D(map,vUv+texel).rgb*.0625;
          c+=texture2D(map,vUv-texel).rgb*.0625;
          c+=texture2D(map,vUv+vec2(texel.x,-texel.y)).rgb*.0625;
          c+=texture2D(map,vUv+vec2(-texel.x,texel.y)).rgb*.0625;
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest:false,depthWrite:false,toneMapped:true
    });
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);quad.frustumCulled=false;quad.renderOrder=-10000;w.scene.add(quad);
    w.citadelDepth={target,quad,material,size:new THREE.Vector2()};
  }
  const {target,quad,material,size}=w.citadelDepth;
  w.renderer.getDrawingBufferSize(size);
  const width=Math.max(1,Math.round(size.x*.6)),height=Math.max(1,Math.round(size.y*.6));
  if(target.width!==width||target.height!==height)target.setSize(width,height);
  const softness={forest:1.4}[w.biome]||.7;material.uniforms.texel.value.set(softness/width,softness/height);
  const hidden=[w.levelRoot,w.fxRoot,w.character.root,w.character.shadow,w.depthRoot].filter(Boolean),visibility=hidden.map(o=>o.visible);
  if(!compositeUsable(w,target,hidden)){
    quad.visible=false;w.backRoot.visible=true;w.renderer.setRenderTarget(null);
    w.renderer.render(w.scene,w.camera);return;
  }
  hidden.forEach(o=>o.visible=false);quad.visible=false;
  const updateShadows=w.renderer.shadowMap.autoUpdate;w.renderer.shadowMap.autoUpdate=false;
  w.renderer.setRenderTarget(target);w.renderer.render(w.scene,w.camera);
  w.renderer.setRenderTarget(null);w.renderer.shadowMap.autoUpdate=updateShadows;
  hidden.forEach((o,i)=>o.visible=visibility[i]);w.backRoot.visible=false;quad.visible=true;
  w.renderer.render(w.scene,w.camera);
  w.backRoot.visible=true;quad.visible=false;
}
