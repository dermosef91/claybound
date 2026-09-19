import * as THREE from './lib/three.module.js';
import {cullCaveCells} from './cavern.js';

// Render only distant scenery at reduced resolution. The game plane, hero,
// ropes and platforms stay sharp, like a small photographed clay set.
//
// Two blurs. The citadel, the forest and the soft dream sections keep the
// original: one pass at six tenths of the frame through a 3×3 tent, a
// softness you barely name. The canyon's reference softens its far buttes
// and clouds like a lens would, so it takes a stronger one: a half-size
// frame blurred across into a second target, then blurred down as it is
// composited — a separable Gaussian, nine taps each way, its reach set in
// half-frame texels. Backdrop groups marked `userData.sharp` (the canyon's
// two nearer ranks of buttes and clouds) stay out of the blur and draw with
// the playfield, so only what is far away goes soft.
const SOFT={forest:2.2,citadel:.7},STRONG={desert:{scale:.5,radius:1.2}};
const VERTEX='varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}';
// Nine-tap Gaussian along `step` (a texel vector already scaled by the reach).
const GAUSS=`vec3 gauss(sampler2D map,vec2 uv,vec2 step){
  vec3 c=texture2D(map,uv).rgb*.227027;
  c+=(texture2D(map,uv+step).rgb+texture2D(map,uv-step).rgb)*.1945946;
  c+=(texture2D(map,uv+step*2.).rgb+texture2D(map,uv-step*2.).rgb)*.1216216;
  c+=(texture2D(map,uv+step*3.).rgb+texture2D(map,uv-step*3.).rgb)*.054054;
  c+=(texture2D(map,uv+step*4.).rgb+texture2D(map,uv-step*4.).rgb)*.016216;
  return c;}`;

function setup(w){
  const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false});
  const material=new THREE.ShaderMaterial({
    uniforms:{map:{value:target.texture},texel:{value:new THREE.Vector2()}},
    vertexShader:VERTEX,
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
  // The strong blur's second target and its two materials: across (into the
  // target, linear, no tone mapping) and down (composited to the frame).
  const across=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false});
  const acrossMaterial=new THREE.ShaderMaterial({
    uniforms:{map:{value:target.texture},step:{value:new THREE.Vector2()}},
    vertexShader:VERTEX,
    fragmentShader:`uniform sampler2D map;uniform vec2 step;varying vec2 vUv;${GAUSS}
      void main(){gl_FragColor=vec4(gauss(map,vUv,step),1.);}`,
    depthTest:false,depthWrite:false,toneMapped:false
  });
  const downMaterial=new THREE.ShaderMaterial({
    uniforms:{map:{value:across.texture},step:{value:new THREE.Vector2()}},
    vertexShader:VERTEX,
    fragmentShader:`uniform sampler2D map;uniform vec2 step;varying vec2 vUv;${GAUSS}
      void main(){gl_FragColor=vec4(gauss(map,vUv,step),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest:false,depthWrite:false,toneMapped:true
  });
  const acrossScene=new THREE.Scene(),acrossQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),acrossMaterial);acrossQuad.frustumCulled=false;acrossScene.add(acrossQuad);
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);quad.frustumCulled=false;quad.renderOrder=-10000;w.scene.add(quad);
  return {target,across,quad,material,acrossScene,acrossMaterial,downMaterial,size:new THREE.Vector2(),verdict:{},warm:{}};
}

// The backdrop, drawn hidden and read back. On some hardware the chapter's
// clay materials do not survive the round trip through a render target while
// a plain quad does, so a synthetic probe passes and the backdrop vanishes;
// the probe is therefore the real thing. Once per chapter it draws that
// chapter's own scenery into the target and compares the read against the
// same frame without it; nothing different means nothing arrived, and the
// chapter draws its scenery straight into the frame for the rest of the
// session. Camera-wide sky quads (`userData.sky`) are hidden for the read,
// since they would pass on their own. A renderer that cannot read back (the
// test stage) is trusted.
const frustum=new THREE.Frustum(),projection=new THREE.Matrix4();
function clayInView(w){
  w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld(true);
  frustum.setFromProjectionMatrix(projection.multiplyMatrices(w.camera.projectionMatrix,w.camera.matrixWorldInverse));
  let found=false;
  for(const group of w.backRoot.children){
    if(found||group.userData.sky||!group.visible)continue;
    group.traverseVisible(o=>{if(!found&&o.isMesh&&o.material.isMeshStandardMaterial&&frustum.intersectsObject(o))found=true;});
  }
  return found;
}
function probe(w,d){
  const cached=d.verdict[w.biome];if(cached!==undefined)return cached;
  if(typeof w.renderer.readRenderTargetPixels!=='function')return d.verdict[w.biome]=true;
  // Nothing to judge by until some backdrop clay is actually in frame — the
  // menu's frame, or a summit that is all sky, would read black and condemn
  // the chapter for the session. Draw direct until there is, without caching.
  if(!clayInView(w))return false;
  const {target}=d,{width,height}=target,step=Math.max(1,Math.floor(Math.min(width,height)/24));
  const hidden=[w.levelRoot,w.fxRoot,w.character?.root,w.character?.shadow,w.depthRoot,d.quad,...w.backRoot.children.filter(o=>o.userData.sky)].filter(Boolean),visibility=hidden.map(o=>o.visible);
  hidden.forEach(o=>o.visible=false);
  const updateShadows=w.renderer.shadowMap.autoUpdate;w.renderer.shadowMap.autoUpdate=false;
  const backVisible=w.backRoot.visible;w.backRoot.visible=true;w.renderer.setRenderTarget(target);
  // The first two frames only warm the target: the materials' programs and
  // textures are set up for it, and on at least one GPU (ANGLE over Metal) a
  // draw issued the frame they are first used lands nothing in the target,
  // which a probe would read as failure. The verdict waits for the third.
  d.warm[w.biome]=(d.warm[w.biome]||0)+1;
  let ok;
  if(d.warm[w.biome]<3)w.renderer.render(w.scene,w.camera);
  else{
    // Drawn twice at the size the composite will use, with the frame's own
    // background — a render with none came back black on hardware where the
    // same render with one did not — once with the backdrop hidden and once
    // with it shown. Any pixel that differs between the two is clay that
    // arrived; none means the round trip fails here.
    const read=()=>{const out=new Uint8Array(width*height*4);w.renderer.readRenderTargetPixels(target,0,0,width,height,out);return out;};
    w.backRoot.visible=false;w.renderer.render(w.scene,w.camera);const empty=read();
    w.backRoot.visible=true;w.renderer.render(w.scene,w.camera);const drawn=read();
    let lit=0;for(let i=0;i<drawn.length;i+=step*4)if(drawn[i]!==empty[i]||drawn[i+1]!==empty[i+1]||drawn[i+2]!==empty[i+2])lit++;
    ok=lit>0;d.probe={lit,size:[width,height]};
  }
  w.backRoot.visible=backVisible;
  w.renderer.setRenderTarget(null);w.renderer.shadowMap.autoUpdate=updateShadows;
  hidden.forEach((o,i)=>o.visible=visibility[i]);
  if(ok===undefined)return false;
  if(!ok)console.warn(`Claybound: the ${w.biome} backdrop did not survive the render target; drawing it straight into the frame.`);
  return d.verdict[w.biome]=ok;
}

// Scenery and playfield in one pass to the frame.
function drawDirect(w){
  if(w.biome==='cave')cullCaveCells(w);
  if(w.citadelDepth)w.citadelDepth.quad.visible=false;
  w.backRoot.visible=true;w.renderer.setRenderTarget(null);
  w.renderer.render(w.scene,w.camera);
}

export function renderCitadelDepth(w){
  const strong=STRONG[w.biome];
  // The caverns draw in one pass, and so does the dream except in a section
  // that asks for a soft backdrop (dream.js sets w.dreamSoftness).
  if(w.biome==='cave'||(w.biome==='dream'&&!(w.dreamSoftness>0))||(w.citadelDepth&&w.citadelDepth.verdict[w.biome]===false)){drawDirect(w);return;}
  w.citadelDepth??=setup(w);
  const d=w.citadelDepth,{target,across,quad,material,acrossScene,acrossMaterial,downMaterial,size}=d;
  w.renderer.getDrawingBufferSize(size);
  const scale=strong?strong.scale:.6,width=Math.max(1,Math.round(size.x*scale)),height=Math.max(1,Math.round(size.y*scale));
  if(target.width!==width||target.height!==height)target.setSize(width,height);
  if(!probe(w,d)){drawDirect(w);return;}
  if(strong){
    if(across.width!==width||across.height!==height)across.setSize(width,height);
    acrossMaterial.uniforms.step.value.set(strong.radius/width,0);downMaterial.uniforms.step.value.set(0,strong.radius/height);
    if(quad.material!==downMaterial)quad.material=downMaterial;
  }else{
    const softness=w.biome==='dream'?w.dreamSoftness:SOFT[w.biome]||.7;material.uniforms.texel.value.set(softness/width,softness/height);
    if(quad.material!==material)quad.material=material;
  }
  const sharp=w.backRoot.children.filter(o=>o.userData.sharp);
  const hidden=[w.levelRoot,w.fxRoot,w.character.root,w.character.shadow,w.depthRoot,...sharp].filter(Boolean),visibility=hidden.map(o=>o.visible);
  hidden.forEach(o=>o.visible=false);quad.visible=false;w.backRoot.visible=true;
  const updateShadows=w.renderer.shadowMap.autoUpdate;w.renderer.shadowMap.autoUpdate=false;
  w.renderer.setRenderTarget(target);w.renderer.render(w.scene,w.camera);
  if(strong){w.renderer.setRenderTarget(across);w.renderer.render(acrossScene,w.camera);}
  w.renderer.setRenderTarget(null);w.renderer.shadowMap.autoUpdate=updateShadows;
  hidden.forEach((o,i)=>o.visible=visibility[i]);
  // The sharp pass: the playfield over the composite, with the backdrop's
  // sharp groups the only backdrop drawn. Each child's own visibility is
  // put back as it was — a chapter may keep some of its backdrop hidden.
  const kids=w.backRoot.children,kidVisibility=kids.map(o=>o.visible);
  w.backRoot.visible=sharp.length>0;kids.forEach(o=>{if(!o.userData.sharp)o.visible=false;});
  quad.visible=true;
  w.renderer.render(w.scene,w.camera);
  kids.forEach((o,i)=>o.visible=kidVisibility[i]);w.backRoot.visible=true;quad.visible=false;
}
