import * as THREE from './lib/three.module.js';
import {cullCaveCells} from './cavern.js';

// Render only distant scenery at reduced resolution. The game plane, hero,
// ropes and platforms stay sharp, like a small photographed clay set.
export function renderCitadelDepth(w){
  // Draw canyon, cavern and Wildwood scenery together with the playfield. The
  // offscreen blur/composite path can disappear on mobile, leaving only the
  // clear color, and it flattened Wildwood's canopy into an indistinct haze.
  // These environments already use depth-separated meshes and distance fog.
  if(w.biome==='desert'||w.biome==='cave'||w.biome==='forest'){
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
  const softness=.7;material.uniforms.texel.value.set(softness/width,softness/height);
  const hidden=[w.levelRoot,w.fxRoot,w.character.root,w.character.shadow,w.depthRoot].filter(Boolean),visibility=hidden.map(o=>o.visible);
  hidden.forEach(o=>o.visible=false);quad.visible=false;
  const updateShadows=w.renderer.shadowMap.autoUpdate;w.renderer.shadowMap.autoUpdate=false;
  w.renderer.setRenderTarget(target);w.renderer.render(w.scene,w.camera);
  w.renderer.setRenderTarget(null);w.renderer.shadowMap.autoUpdate=updateShadows;
  hidden.forEach((o,i)=>o.visible=visibility[i]);w.backRoot.visible=false;quad.visible=true;
  w.renderer.render(w.scene,w.camera);
  w.backRoot.visible=true;quad.visible=false;
}
