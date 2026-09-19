import * as THREE from './lib/three.module.js';
import {applyEnvironment} from './environments.js';
import {clayMaterial} from './clay.js';
import {animateHero,heroEvent} from './hero.js';
import {tickPuppets} from './stop-motion.js';
import {parentAxis,rotateAbout} from './dream-rigs.js';
import {DIORAMAS} from './completion-dioramas.js';

// The level-complete screen is a diorama, not a plate of art: the finished
// chapter rebuilt as a small stage, lit from one side and set against its own
// sky. It borrows the game's renderer, its clay and the chapter's own supplied
// models, but nothing else about it is the playfield — the camera is a real
// perspective lens rather than the game's orthographic side-on box, and every
// piece is placed and turned in three dimensions.
//
// It is photographed the way a model on a table is photographed: a low lens
// almost level with the stage, the hero centred with both arms up, the gate
// they have just rung beside them, and behind them the chapter's own country
// out of focus — the platform and everything on it sharp, everything past its
// far lip drawn soft, so the eye has a foreground to stand on and a depth to
// look into.

// A dome rather than a flat plate, because a perspective camera can see the
// sky's curve. The gradient runs zenith → horizon with a haze that gathers
// around the sun, and the sun itself is a soft disc with a wide bloom, so a
// chapter can be finished at any hour of its own day.
const SKY_VERTEX=`varying vec3 vWorld;
void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const SKY_FRAGMENT=`uniform vec3 zenith;uniform vec3 horizon;uniform vec3 haze;uniform vec3 sunDirection;
uniform float sunSize;uniform float sunPower;uniform float hazeHeight;
varying vec3 vWorld;
void main(){
  vec3 dir=normalize(vWorld-cameraPosition);
  float height=clamp(dir.y*hazeHeight+.08,0.0,1.0);
  vec3 color=mix(horizon,zenith,pow(height,.72));
  float toSun=max(dot(dir,normalize(sunDirection)),0.0);
  color=mix(color,haze,pow(toSun,3.2)*.62*(1.0-height*.55));
  color+=haze*pow(toSun,sunSize)*sunPower;
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// A separable Gaussian, run once across and once down at half resolution: the
// background's depth of field. The title's single diagonal tap was a softening;
// the stage wants the country behind it genuinely out of focus, which takes a
// real kernel and two passes. The second pass tone-maps as it lands on screen.
const BLUR_VERTEX='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
const blurFragment=final=>`uniform sampler2D tDiffuse;uniform vec2 step;varying vec2 vUv;
void main(){
  vec3 c=texture2D(tDiffuse,vUv).rgb*.1964825;
  c+=(texture2D(tDiffuse,vUv+step).rgb+texture2D(tDiffuse,vUv-step).rgb)*.1746813;
  c+=(texture2D(tDiffuse,vUv+step*2.0).rgb+texture2D(tDiffuse,vUv-step*2.0).rgb)*.1216974;
  c+=(texture2D(tDiffuse,vUv+step*3.0).rgb+texture2D(tDiffuse,vUv-step*3.0).rgb)*.0662803;
  c+=(texture2D(tDiffuse,vUv+step*4.0).rgb+texture2D(tDiffuse,vUv-step*4.0).rgb)*.0281928;
  c+=(texture2D(tDiffuse,vUv+step*5.0).rgb+texture2D(tDiffuse,vUv-step*5.0).rgb)*.0093571;
  gl_FragColor=vec4(c,1.0);
  ${final?'#include <tonemapping_fragment>\n#include <colorspace_fragment>':''}
}`;

// The cheer. Both upper arms swung up and out about the character's own
// forward axis, the forearms opened a little further, layered over whatever
// the idle is doing that frame — the same way the parade's giraffe is posed.
const CHEER={arm:2.35,forearm:.42,shoulder:.18};
const FORWARD=new THREE.Vector3(0,0,1);
// Everything from the hips down, which the diorama stands still rather than
// letting the idle walk it about. The hips are held outright — turn as well as
// position — because a leg held against a hip that sways is still a foot that
// slides; with the hip still, the whole chain below it is.
const STANCE=['LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase'];

export class CompletionScene{
  constructor(world){
    this.world=world;this.time=0;this.active=false;this.key=null;this.built=new Map();
    // The bones last frame's cheer turned, and what they held before it did.
    this.cheerBase=null;
    // The standing pose the lower body is kept in, taken once per opening.
    this.stance=null;
    // Object.create keeps World's builders — box, ball, cylinder, mesh, rope,
    // flag — while every cache they write to is this scene's own, so a diorama
    // never hands the running chapter a mesh or a material it did not make.
    const w=this.view=Object.create(world);
    w.scene=new THREE.Scene();
    w.scene.background=new THREE.Color('#8fb6d8');
    w.scene.fog=new THREE.Fog('#a8cae0',40,150);
    w.clay=world.clay?{...world.clay,boxes:new Map(),sculpted:new WeakMap(),bytes:0}:null;
    w.assetGeometry=new Set(world.assetGeometry);w.assetMaterials=new Set(world.assetMaterials);
    w.mat={};
    for(const [name,base]of Object.entries(world.mat)){
      const m=base.clone();delete m.userData.clay;clayMaterial(w,m);w.mat[name]=m;
    }
    w.hemi=new THREE.HemisphereLight();w.sun=new THREE.DirectionalLight();w.fill=new THREE.DirectionalLight();
    // The cave's four roaming fixtures belong to the playfield. A diorama
    // lights itself, so the slots stay empty and no material pays for them.
    w.torchLights=[];
    w.sun.castShadow=true;w.sun.shadow.mapSize.set(2048,2048);
    w.sun.shadow.bias=-.00025;w.sun.shadow.normalBias=.035;w.sun.shadow.radius=4;
    w.scene.add(w.hemi,w.sun,w.sun.target,w.fill);
    // A back light the playfield has no use for. Side-on, a rim light would
    // only graze the front faces; on a stage it is what lifts the hero and
    // the gate off the country behind them.
    w.rim=new THREE.DirectionalLight(0xffffff,0);w.scene.add(w.rim);
    w.flags=[];w.particles=[];
    w.fxRoot=new THREE.Group();w.scene.add(w.fxRoot);

    this.sky=new THREE.Mesh(new THREE.SphereGeometry(1,48,32),new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false,
      uniforms:{zenith:{value:new THREE.Color()},horizon:{value:new THREE.Color()},haze:{value:new THREE.Color()},
        sunDirection:{value:new THREE.Vector3(1,.4,1)},sunSize:{value:220},sunPower:{value:.5},hazeHeight:{value:1.35}},
      vertexShader:SKY_VERTEX,fragmentShader:SKY_FRAGMENT
    }));
    this.sky.name='Diorama sky';this.sky.scale.setScalar(300);this.sky.frustumCulled=false;w.scene.add(this.sky);

    // The hero's own animation writes its world position from the simulated
    // player, and always at the playfield's depth. Standing it anywhere else
    // means carrying it: the mount holds the real placement and cancels that
    // fixed depth, and the rig moves inside it.
    this.heroMount=new THREE.Group();this.heroMount.name='Diorama footing';w.scene.add(this.heroMount);
    this.camera=new THREE.PerspectiveCamera(34,16/9,.35,520);
    this.game={status:'menu',respawnTimer:0,flowerCelebration:null,
      player:{x:0,y:0,vx:0,vy:0,facing:1,groundId:'diorama',invuln:0,stunTime:0,stomping:false,stompWindup:0,skidding:false},
      level:{boss:null,platforms:[{id:'diorama',kind:'stone',x:-6,y:0,w:12,active:true}]}};
    this.width=0;this.height=0;
    this.makeDefocus();
  }

  makeDefocus(){
    const options={type:THREE.HalfFloatType,depthBuffer:true};
    this.backTarget=new THREE.WebGLRenderTarget(1,1,options);
    this.blurTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
    this.compositeCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.blurAcross=new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:this.backTarget.texture},step:{value:new THREE.Vector2()}},depthTest:false,depthWrite:false,vertexShader:BLUR_VERTEX,fragmentShader:blurFragment(false)});
    this.blurDown=new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:this.blurTarget.texture},step:{value:new THREE.Vector2()}},depthTest:false,depthWrite:false,vertexShader:BLUR_VERTEX,fragmentShader:blurFragment(true)});
    this.acrossScene=new THREE.Scene();this.acrossScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.blurAcross));
    this.downScene=new THREE.Scene();this.downScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.blurDown));
  }

  // Each chapter's diorama is built once and kept. Its models are the ones the
  // chapter already streamed, so building costs geometry and nothing else, and
  // a player who replays a chapter gets the scene back immediately.
  build(biome){
    const key=DIORAMAS[biome]?biome:'desert';
    if(this.key===key)return;
    this.key=key;
    for(const [name,entry]of this.built){entry.front.visible=entry.back.visible=entry.lamps.visible=name===key;}
    if(this.built.has(key)){this.apply(this.built.get(key));return;}
    const w=this.view,spec=DIORAMAS[key];
    applyEnvironment(w,{biome:spec.biome});
    // applyEnvironment leaves the playfield's fixtures and parallax bookkeeping
    // behind it; a diorama keeps none of that, and its lights are its own.
    w.torches=[];w.parallax=[];w.ambient=[];w.water=null;w.flags=[];
    // Three roots: what is sharp, what is out of focus, and the lamps that
    // have to light both passes and so belong to neither.
    const front=new THREE.Group();front.name=`Completion stage · ${key}`;
    const back=new THREE.Group();back.name=`Completion country · ${key}`;
    const lamps=new THREE.Group();lamps.name=`Completion lamps · ${key}`;
    w.scene.add(front,back,lamps);
    const entry={front,back,lamps,spec,flags:[],bell:null,spin:[],pulse:[]};
    w.bell=null;
    spec.build(w,front,back,{
      // A diorama's own lamp: placed in three dimensions, kept with the scene
      // and never handed to the chapter's roaming fixtures.
      light:(color,intensity,distance,x,y,z)=>{
        const l=new THREE.PointLight(color,intensity,distance);l.position.set(x,y,z);lamps.add(l);return l;
      },
      // Anything a diorama wants to keep turning: a windmill's sails, a
      // gondola's slow sway, a planet on its axis.
      spin:(object,speed,axis='y',amplitude=0)=>{entry.spin.push({object,speed,axis,amplitude,base:object.rotation[axis]});return object;},
      // A lamp that breathes — the ember caverns' mushrooms and crystals.
      pulse:(lamp,amount=.25,speed=1.3,phase=0)=>{entry.pulse.push({lamp,base:lamp.intensity,amount,speed,phase});return lamp;}
    });
    entry.flags=w.flags.slice();entry.bell=w.bell||null;
    this.built.set(key,entry);
    this.apply(entry);
  }

  // Re-seat the shared rig — lights, sky, camera, hero footing — on the
  // chapter whose diorama is showing, so a cached scene comes back identical.
  apply(entry){
    const w=this.view,spec=entry.spec,l=spec.light;
    applyEnvironment(w,{biome:spec.biome});
    w.torches=[];w.parallax=[];w.ambient=[];w.water=null;
    w.hemi.color.set(l.sky);w.hemi.groundColor.set(l.ground);w.hemi.intensity=l.ambient;
    w.sun.color.set(l.sunColor);w.sun.intensity=l.sunPower;
    w.sun.position.set(...l.sun);w.sun.target.position.set(...(l.sunTarget||spec.camera.target));
    const reach=l.shadow||16;
    Object.assign(w.sun.shadow.camera,{left:-reach,right:reach,top:reach,bottom:-reach,near:.5,far:reach*6});
    w.sun.shadow.camera.updateProjectionMatrix();
    w.fill.color.set(l.fill);w.fill.intensity=l.fillPower;w.fill.position.set(...(l.fillFrom||[-9,7,12]));
    w.rim.color.set(l.rim||l.sunColor);w.rim.intensity=l.rimPower||0;w.rim.position.set(...(l.rimFrom||[6,5,-12]));
    const sky=this.sky.material.uniforms;
    sky.zenith.value.set(l.zenith);sky.horizon.value.set(l.horizon);sky.haze.value.set(l.haze);
    sky.sunDirection.value.set(...(l.sunDirection||l.sun)).normalize();
    sky.sunSize.value=l.sunSize??220;sky.sunPower.value=l.sunGlow??.5;sky.hazeHeight.value=l.hazeHeight??1.35;
    w.scene.background.set(l.horizon);
    w.scene.fog.color.set(l.fog||l.horizon);w.scene.fog.near=l.fogNear??40;w.scene.fog.far=l.fogFar??150;
    this.blur=spec.blur??2.2;
    const hero=spec.hero;
    this.heroMount.position.set(hero.x,hero.y,hero.z-.48);
    this.heroMount.rotation.set(hero.tilt||0,0,hero.roll||0);
    this.heroScale=hero.scale??1;this.heroYaw=hero.yaw??0;this.cheer=hero.cheer??1;
    this.width=0;this.resize(this.lastWidth||1280,this.lastHeight||720);
  }

  // The frame is the one thing a diorama cannot compose for itself: it has to
  // survive a phone held upright and a desktop window three times as wide.
  //
  // Putting the subject off-centre by moving the camera would swing the whole
  // scene past it. An asymmetric frustum moves the framing instead: the lens
  // renders a wider, taller frame than the canvas shows and the canvas takes
  // its top-left corner, which lands what the camera is aimed at at a chosen
  // fraction across and down. The field of view is then divided back out, so
  // the subject is off-centre at the size it would have been in the middle.
  resize(width,height){
    this.lastWidth=width;this.lastHeight=height;
    if(this.width===width&&this.height===height)return;
    this.width=width;this.height=height;
    const spec=DIORAMAS[this.key];if(!spec)return;
    const aspect=width/height,portrait=aspect<1,squat=!portrait&&height<=850;
    const view=portrait?spec.portrait||spec.camera:spec.camera;
    const focus=view.focus||(portrait?[.5,.44]:squat?[.72,.6]:[.655,.605]);
    const camera=this.camera;
    camera.position.set(...view.position);camera.lookAt(...view.target);
    camera.aspect=aspect;
    const frameW=width*2*focus[0],frameH=height*2*focus[1];
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(view.fov)/2)*frameH/height));
    camera.setViewOffset(frameW,frameH,0,0,width,height);
    camera.updateProjectionMatrix();
    this.baseQuaternion=camera.quaternion.clone();
    this.basePosition=camera.position.clone();
    const bw=Math.max(1,Math.ceil(width*.5)),bh=Math.max(1,Math.ceil(height*.5));
    this.backTarget.setSize(bw,bh);this.blurTarget.setSize(bw,bh);
    this.blurAcross.uniforms.step.value.set(this.blur/bw,0);
    this.blurDown.uniforms.step.value.set(0,this.blur/bh);
  }

  show(){
    if(this.active)return;this.active=true;this.time=0;
    // A fresh stance is taken from the first frame of this opening, not kept
    // from the last one, which was another chapter's rig at another scale.
    this.stance=null;
    const c=this.world.character;
    this.heroMount.add(c.root);
    heroEvent(c,{type:'respawn'});
    // The bell has just been rung. Let it come to rest rather than hanging
    // dead still in a scene that is otherwise about having finished.
    this.ring=1;
  }
  hide(){
    if(!this.active)return;this.active=false;
    // The rig goes back to the game wearing whatever it was last posed into,
    // and on a held frame the mixer will not write over it for a while — so
    // the cheer comes off before it is handed back. The stance is only ever
    // copied on, never added, so it needs no undoing — the running game's own
    // idle writes over it — but it is dropped so the next opening takes its own.
    this.clearCheer();this.stance=null;
    const c=this.world.character;
    this.world.scene.add(c.root);
    c.root.rotation.y=0;c.root.scale.setScalar(1);
    heroEvent(c,{type:'respawn'});
  }

  // Arms up, layered over the idle so the body keeps breathing under it.
  //
  // The turn is a rotation *onto* whatever the bone already holds, so it may
  // only ever be laid on a bone the mixer has just written. It cannot count on
  // that: three.js writes a bone only when the blended value changed since the
  // last frame, and on the stop-motion clock the pose is held — the mixer is
  // stepped by nothing at all — for every frame between exposures. On a held
  // frame the arm still carries the last frame's cheer, and turning it again
  // winds it round and round.
  //
  // So the cheer undoes itself: each frame remembers the bones it is about to
  // turn, and `update` puts them back before the mixer runs again. It is the
  // flower celebration's `basePose` (flower-celebration.js), kept here because
  // this overlay is the completion screen's own and outlives no frame.
  poseCheer(c,strength){
    if(!c.loaded||!c.asset||strength<=0)return;
    const bone=name=>c.asset.getObjectByName(name);
    const base=this.cheerBase=new Map();
    const turn=(b,angle)=>{
      if(!b)return;
      base.set(b,b.quaternion.clone());
      rotateAbout(b,parentAxis(b,FORWARD,c.model),angle);
    };
    for(const [side,sign]of [['Left',1],['Right',-1]]){
      const shoulder=bone(side+'Shoulder'),arm=bone(side+'Arm'),fore=bone(side+'ForeArm');
      if(!arm)continue;
      turn(shoulder,sign*CHEER.shoulder*strength);
      turn(arm,sign*CHEER.arm*strength);
      turn(fore,sign*CHEER.forearm*strength);
    }
  }

  // Feet planted, body alive.
  //
  // The idle underneath is a gameplay idle: it rocks the weight from one foot
  // to the other, and after four seconds standing it plays a fidget over the
  // top. Out on the playfield that reads as life. Held as a celebration shot
  // it reads as a fault — a few centimetres of foot sliding about under arms
  // that are raised and still.
  //
  // So the lower body is taken from the idle's opening frame and kept there
  // for as long as the screen is up, and only the lower body: the spine, the
  // arms and the head go on breathing and looking about above it. The pose is
  // copied on rather than turned on, so a held stop-motion frame that re-runs
  // it lands in exactly the same place — unlike the cheer, this cannot stack.
  holdStance(c){
    if(!c.loaded||!c.asset)return;
    const hips=c.asset.getObjectByName('Hips');
    if(!hips)return;
    if(!this.stance){
      // The frame after `show`, which is the idle's own first pose: the
      // respawn event there has just put every action back to it.
      this.stance={position:hips.position.clone(),quaternion:hips.quaternion.clone(),hips,turns:new Map()};
      for(const name of STANCE){
        const bone=c.asset.getObjectByName(name);
        if(bone)this.stance.turns.set(bone,bone.quaternion.clone());
      }
      return;
    }
    const {position,quaternion,turns}=this.stance;
    hips.position.copy(position);hips.quaternion.copy(quaternion);
    for(const [bone,turn] of turns)bone.quaternion.copy(turn);
  }

  // Put back what the last frame's cheer turned, so the mixer and the next
  // cheer both start from the pose the clips actually asked for.
  clearCheer(){
    if(!this.cheerBase)return;
    for(const [bone,q] of this.cheerBase)bone.quaternion.copy(q);
    this.cheerBase=null;
  }

  update(dt){
    const w=this.view,entry=this.built.get(this.key);
    const step=this.world.reducedMotion?0:Math.min(dt,.05);
    this.time+=step;w.time=this.time;w.reducedMotion=this.world.reducedMotion;w.puppetClock=tickPuppets(this.world,step);
    // Before the mixer: a held pose is left exactly as it was, so last frame's
    // cheer has to come off the bones or this one would stack on top of it.
    this.clearCheer();
    animateHero(w,this.game,step);
    const c=w.character;
    this.holdStance(c);
    c.root.rotation.y=this.heroYaw;c.root.scale.setScalar(this.heroScale);
    c.root.visible=true;c.shadow.visible=false;
    // The arms come up over the first half second and then hold, with the
    // smallest sway so a held pose does not read as a frozen one.
    const raised=Math.min(1,this.time*2.2),sway=this.world.reducedMotion?0:Math.sin(this.time*1.7)*.02;
    this.poseCheer(c,this.cheer*(raised*(1-.5*(1-raised)*(1-raised))+sway));
    if(!entry)return;
    for(const s of entry.spin){
      if(s.amplitude)s.object.rotation[s.axis]=s.base+Math.sin(this.time*s.speed)*s.amplitude;
      else s.object.rotation[s.axis]=s.base+this.time*s.speed;
    }
    for(const p of entry.pulse)p.lamp.intensity=p.base*(1+Math.sin(this.time*p.speed+p.phase)*p.amount);
    // Clay bunting does not flap; it settles. A slow, shallow roll per pennant
    // keeps the gate alive without turning a solid material into cloth.
    for(const [i,flag]of entry.flags.entries())flag.rotation.y=(flag.userData.baseYaw??=flag.rotation.y)+Math.sin(this.time*.9+i*1.3)*.055;
    if(entry.bell){
      this.ring=Math.max(0,this.ring-step*.55);
      entry.bell.rotation.z=Math.sin(this.time*5.2)*.14*this.ring*this.ring;
    }
    // A very slight drift, under a degree, so the scene reads as a held object
    // and not a photograph. Reduced motion keeps it perfectly still.
    if(this.baseQuaternion){
      const drift=this.world.reducedMotion?0:1;
      this.camera.quaternion.copy(this.baseQuaternion);
      this.camera.rotateY(Math.sin(this.time*.17)*.0055*drift);
      this.camera.rotateX(Math.sin(this.time*.13+1.1)*.0035*drift);
      this.camera.position.copy(this.basePosition);
      this.camera.position.y+=Math.sin(this.time*.21)*.035*drift;
    }
  }

  // Two passes. The country behind the stage — the sky, the far models, the
  // clouds — is drawn to a half-size target and blurred across and down onto
  // the canvas; then the stage, the hero and the gate are drawn sharp over it
  // with the depth cleared, so nothing sharp is ever hidden behind something
  // soft. The renderer is left exactly as the game had it.
  render(dt){
    if(!this.active||!this.key)return;
    const rect=this.world.canvas.getBoundingClientRect();
    this.resize(Math.max(1,Math.round(rect.width)),Math.max(1,Math.round(rect.height)));
    this.update(dt);
    const entry=this.built.get(this.key),r=this.world.renderer,scene=this.view.scene;
    const background=scene.background,autoClear=r.autoClear;
    entry.front.visible=false;this.heroMount.visible=false;
    r.setRenderTarget(this.backTarget);r.render(scene,this.camera);
    r.setRenderTarget(this.blurTarget);r.render(this.acrossScene,this.compositeCamera);
    r.setRenderTarget(null);r.render(this.downScene,this.compositeCamera);
    entry.front.visible=true;this.heroMount.visible=true;entry.back.visible=false;this.sky.visible=false;
    scene.background=null;r.autoClear=false;r.clearDepth();r.render(scene,this.camera);
    scene.background=background;entry.back.visible=true;this.sky.visible=true;r.autoClear=autoClear;
  }
}
