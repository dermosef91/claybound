import * as THREE from './lib/three.module.js';
import {applyEnvironment} from './environments.js';
import {canyonModel} from './canyon-assets.js';
import {cloudModel} from './clouds.js';
import {animateHero,heroEvent} from './hero.js';
import {tickPuppets} from './stop-motion.js';
import {clayMaterial} from './clay.js';

// A persistent diorama using the game's renderer, source models and clay.
// Its materials and geometry caches are separate from streamed chapter scenery.
export class TitleScene {
  constructor(world){
    this.world=world;this.time=0;this.active=false;
    const w=this.view=Object.create(world);
    w.scene=new THREE.Scene();w.scene.background=new THREE.Color('#3dabe7');
    w.scene.fog=new THREE.Fog('#a8cae0',38,105);
    w.clay=world.clay?{...world.clay,boxes:new Map(),sculpted:new WeakMap(),bytes:0}:null;
    w.assetGeometry=new Set(world.assetGeometry);w.assetMaterials=new Set(world.assetMaterials);
    w.mat={};
    for(const [name,base]of Object.entries(world.mat)){
      const m=base.clone();delete m.userData.clay;clayMaterial(w,m);w.mat[name]=m;
    }
    w.hemi=new THREE.HemisphereLight();w.sun=new THREE.DirectionalLight();w.fill=new THREE.DirectionalLight();w.torchLights=[];
    applyEnvironment(w,{biome:'desert'});
    w.hemi.color.set('#e4f4ff');w.hemi.groundColor.set('#af6335');w.hemi.intensity=1.6;
    w.sun.color.set('#ffdb9d');w.sun.intensity=4.2;
    w.sun.position.set(9,13,7);w.sun.target.position.set(2,-1,0);w.sun.castShadow=true;
    w.sun.shadow.mapSize.set(2048,2048);Object.assign(w.sun.shadow.camera,{left:-13,right:13,top:12,bottom:-12,near:.5,far:65});
    w.sun.shadow.bias=-.00025;w.sun.shadow.normalBias=.035;
    w.sun.shadow.radius=4;w.fill.position.set(-9,6,10);w.fill.intensity=.65;
    w.scene.add(w.hemi,w.sun,w.sun.target,w.fill);
    w.scene.fog.near=38;w.scene.fog.far=105;
    w.flags=[];this.backRoot=new THREE.Group();this.backRoot.name='Title canyon vista';w.scene.add(this.backRoot);
    this.foreground=new THREE.Group();this.foreground.name='Title overlook';w.scene.add(this.foreground);
    this.camera=new THREE.OrthographicCamera(-10,10,6,-6,.1,160);
    this.camera.position.set(0,8,26);this.camera.lookAt(0,3,0);this.pitch=Math.atan2(5,26);
    this.formations=[];
    // Three receding planes keep the arch opening and the river valley legible.
    for(const [key,nx,ny,z,h,turn]of [
      ['summit',.47,1.12,-55,5.8,.12],['summit',.64,1.02,-60,6.9,-.2],
      ['arch',.83,.83,-27,6.15,-.08],['summit',.51,1.02,-36,4.5,.2],
      ['summit',1.07,1.07,-18,5.5,-.3],['arch',.71,1.17,-72,5.8,.15],
      ['summit',.41,1.06,-54,4.2,-.1],['summit',.58,1.07,-48,4.6,.15]
    ]){
      const model=canyonModel(w,key,this.backRoot,0,0,z,h,turn);
      this.formations.push({model,nx,ny,z,h,scale:model.scale.x});
      model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;const m=o.material.clone();delete m.userData.clay;clayMaterial(w,m,.025);m.color.set('#ffc29c');o.material=m;}});
    }
    const riverShape=new THREE.Shape();riverShape.moveTo(-.06,0);
    riverShape.bezierCurveTo(-.8,-.65,.9,-1.25,.05,-2);riverShape.bezierCurveTo(-.8,-2.6,-1.2,-3.3,-.65,-4.3);
    riverShape.lineTo(.45,-4.3);riverShape.bezierCurveTo(-.5,-3.3,.15,-2.6,.55,-2);riverShape.bezierCurveTo(1.4,-1.25,-.2,-.65,.08,0);riverShape.closePath();
    this.river=new THREE.Mesh(new THREE.ShapeGeometry(riverShape,40),new THREE.MeshBasicMaterial({color:'#8acde5',side:THREE.DoubleSide}));
    this.river.quaternion.copy(this.camera.quaternion);this.river.name='Canyon river';this.backRoot.add(this.river);
    this.clouds=[];
    for(const [nx,ny,z,width]of [[.102,.218,-16,2.85],[.491,.272,-18,2.7],[1.01,.162,-18,5.8],[.548,.525,-34,3.1],[.97,.474,-33,3.8],[.008,1.005,-13,3.3]]){
      const model=cloudModel(w,this.backRoot,0,0,z,width,.08);this.clouds.push({model,nx,ny,z,scale:model.scale.x});
      model.traverse(o=>{if(o.isMesh){const m=o.material.clone();delete m.userData.clay;clayMaterial(w,m,.025);m.fog=false;o.material=m;}});
    }
    this.sunOrb=new THREE.Mesh(new THREE.SphereGeometry(.58,48,32),new THREE.MeshBasicMaterial({color:new THREE.Color(2.6,1.15,.24),toneMapped:false,fog:false}));
    this.sunOrb.name='Warm afternoon sun';this.backRoot.add(this.sunOrb);
    this.sunHalo=new THREE.Mesh(new THREE.PlaneGeometry(4,4),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,depthTest:false,toneMapped:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec2 vUv;void main(){float d=length(vUv-.5);float a=exp(-d*d*34.0)*.38*(1.0-smoothstep(.32,.5,d));gl_FragColor=vec4(1.0,.72,.39,a);}'
    }));this.sunHalo.quaternion.copy(this.camera.quaternion);this.backRoot.add(this.sunHalo);
    this.sky=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({depthWrite:false,uniforms:{aspect:{value:1},sun:{value:new THREE.Vector2(.841,.622)},top:{value:new THREE.Color('#158fef')},bottom:{value:new THREE.Color('#429ee9')},haze:{value:new THREE.Color('#f1c1bb')}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec2 vUv;uniform float aspect;uniform vec2 sun;uniform vec3 top;uniform vec3 bottom;uniform vec3 haze;void main(){vec2 d=(vUv-sun)*vec2(aspect,1.0);vec3 color=mix(bottom,top,vUv.y*.8);color=mix(color,haze,exp(-dot(d,d)*18.0)*.45);gl_FragColor=vec4(color,1.0);}'
    }));this.sky.quaternion.copy(this.camera.quaternion);this.sky.name='Sunlit blue atmosphere';this.backRoot.add(this.sky);
    this.makeOverlook();
    this.makeDefocus();
    this.game={status:'menu',respawnTimer:0,player:{x:0,y:0,vx:0,vy:0,facing:1,groundId:'overlook',invuln:0},level:{platforms:[{id:'overlook',kind:'stone',x:-6,y:0,w:9,active:true}]}};
    this.resize(1280,720);
  }
  makeOverlook(){
    if(!this.world.titleMesa)throw new Error('Load the supplied title mesa before composing the title.');
    this.mesa=this.world.titleMesa.scene.clone(true);this.mesa.name='Supplied clay cactus mesa';
    this.flagCloths=[];this.mesa.traverse(o=>{if(o.isMesh&&o.geometry.userData.titleFlagWind)this.flagCloths.push(o);});
    // Match the feet to an actual triangle on the clear upper surface.
    const ray=new THREE.Raycaster(new THREE.Vector3(.23,2,.15),new THREE.Vector3(0,-1,0));
    this.mesa.updateMatrixWorld(true);const surface=ray.intersectObject(this.mesa,true)[0];
    if(!surface)throw new Error('The title player has no supporting mesa surface.');
    this.mesa.scale.set(7,4.4,3.4);
    this.mesa.position.set(-.23*7,-surface.point.y*4.4,.48-.15*3.4);
    this.foreground.add(this.mesa);
  }
  makeDefocus(){
    this.backdropTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
    this.composite=new THREE.Scene();this.compositeCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.defocus=new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:this.backdropTarget.texture},texel:{value:new THREE.Vector2()}},depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 texel;varying vec2 vUv;
        void main(){vec3 c=texture2D(tDiffuse,vUv).rgb*.227027;
          c+=(texture2D(tDiffuse,vUv+texel*vec2(1.384615,0.0)).rgb+texture2D(tDiffuse,vUv-texel*vec2(1.384615,0.0)).rgb)*.158108;
          c+=(texture2D(tDiffuse,vUv+texel*vec2(0.0,1.384615)).rgb+texture2D(tDiffuse,vUv-texel*vec2(0.0,1.384615)).rgb)*.158108;
          c+=(texture2D(tDiffuse,vUv+texel*vec2(2.0,2.0)).rgb+texture2D(tDiffuse,vUv-texel*vec2(2.0,2.0)).rgb+texture2D(tDiffuse,vUv+texel*vec2(-2.0,2.0)).rgb+texture2D(tDiffuse,vUv+texel*vec2(2.0,-2.0)).rgb)*.03513525;
          gl_FragColor=vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });this.composite.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.defocus));
  }
  anchor(object,nx,ny,z){
    object.position.set((nx-.5)*this.viewW,3+((.5-ny)*this.viewH+Math.sin(this.pitch)*z)/Math.cos(this.pitch),z);
  }
  resize(width,height){
    if(this.width===width&&this.height===height)return;
    this.width=width;this.height=height;const aspect=width/height,wide=aspect>4/3;
    this.viewH=wide?10.8:14.5;this.viewW=this.viewH*aspect;
    const c=this.camera;c.left=-this.viewW/2;c.right=this.viewW/2;c.top=this.viewH/2;c.bottom=-this.viewH/2;c.updateProjectionMatrix();
    this.anchor(this.foreground,wide?.747:.70,wide?.862:.86,2);this.foreground.scale.setScalar(wide?1.25:1.2);
    this.backdropTarget.setSize(Math.ceil(width*.65),Math.ceil(height*.65));this.defocus.uniforms.texel.value.set(1.7/width,1.7/height);
    for(const f of this.formations){this.anchor(f.model,wide?f.nx:.5+(f.nx-.5)*.9,f.ny,f.z);f.model.scale.setScalar(f.scale*(wide?1:.75));}
    this.formations[2].model.scale.y*=.73;
    for(const cloud of this.clouds){this.anchor(cloud.model,cloud.nx,cloud.ny,cloud.z);cloud.model.scale.setScalar(cloud.scale*(wide?1:.62));}
    this.clouds[0].model.scale.y*=1.3;this.clouds[1].model.scale.y*=1.15;
    this.anchor(this.sunOrb,wide?.841:.86,wide?.378:.55,-45);
    this.sunHalo.position.copy(this.sunOrb.position);this.sunHalo.position.z+=.05;
    this.anchor(this.river,wide?.862:.89,.60,-31);
    this.anchor(this.sky,.5,.5,-115);this.sky.scale.set(this.viewW,this.viewH,1);this.sky.material.uniforms.aspect.value=aspect;this.sky.material.uniforms.sun.value.set(wide?.841:.86,wide?.622:.45);
  }
  show(){
    if(this.active)return;this.active=true;
    this.foreground.add(this.world.character.root,this.world.character.shadow);
    heroEvent(this.world.character,{type:'respawn'});
  }
  hide(){
    if(!this.active)return;this.active=false;
    this.world.scene.add(this.world.character.root,this.world.character.shadow);
    this.world.character.root.rotation.y=0;this.world.character.root.scale.setScalar(1);
    heroEvent(this.world.character,{type:'respawn'});
  }
  update(dt){
    const w=this.view,step=this.world.reducedMotion?0:Math.min(dt,.05);this.time+=step;w.reducedMotion=this.world.reducedMotion;
    // The title is the set's own stage: its hero exposes on the world's clock too.
    w.puppetClock=tickPuppets(this.world,step);
    if(step>0)for(const cloth of this.flagCloths){
      const swell=this.time*1.65,ripple=this.time*2.7+.7;
      cloth.morphTargetInfluences[0]=Math.cos(swell);cloth.morphTargetInfluences[1]=Math.sin(swell);
      cloth.morphTargetInfluences[2]=Math.cos(ripple);cloth.morphTargetInfluences[3]=Math.sin(ripple);
    }
    animateHero(w,this.game,step);w.character.root.rotation.y=1.3;w.character.root.scale.set(1.2,1.02,1.15);
    // animateHero's pose and skin remain intact; only the presentation yaw differs.
    w.character.root.visible=true;
    w.character.shadow.visible=false;
    for(const [i,c]of this.clouds.entries())c.model.position.x=(c.nx-.5)*this.viewW+Math.sin(this.time*.045+i)*.035;
  }
  render(dt){
    if(!this.active)return;
    const rect=this.world.canvas.getBoundingClientRect();this.resize(Math.max(1,rect.width),Math.max(1,rect.height));this.update(dt);
    const r=this.world.renderer,scene=this.view.scene,background=scene.background,autoClear=r.autoClear;
    this.foreground.visible=false;r.setRenderTarget(this.backdropTarget);r.render(scene,this.camera);
    r.setRenderTarget(null);r.render(this.composite,this.compositeCamera);
    this.foreground.visible=true;this.backRoot.visible=false;scene.background=null;r.autoClear=false;r.clearDepth();r.render(scene,this.camera);
    scene.background=background;this.backRoot.visible=true;r.autoClear=autoClear;
  }
}
