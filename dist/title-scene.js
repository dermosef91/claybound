import * as THREE from './lib/three.module.js';
import {applyEnvironment} from './environments.js';
import {canyonModel} from './canyon-assets.js';
import {cloudModel} from './clouds.js';
import {animateHero,heroEvent} from './hero.js';
import {clayMaterial} from './clay.js';

// A persistent diorama using the game's renderer, source models and clay.
// Its materials and geometry caches are separate from streamed chapter scenery.
export class TitleScene {
  constructor(world){
    this.world=world;this.time=0;this.active=false;
    const w=this.view=Object.create(world);
    w.scene=new THREE.Scene();w.scene.background=new THREE.Color('#81aed1');
    w.scene.fog=new THREE.Fog('#81aed1',35,155);
    w.clay=world.clay?{...world.clay,boxes:new Map(),sculpted:new WeakMap()}:null;
    w.assetGeometry=new Set(world.assetGeometry);w.assetMaterials=new Set(world.assetMaterials);
    w.mat={};
    for(const [name,base]of Object.entries(world.mat)){
      const m=base.clone();delete m.userData.clay;clayMaterial(w,m);w.mat[name]=m;
    }
    w.hemi=new THREE.HemisphereLight();w.sun=new THREE.DirectionalLight();w.fill=new THREE.DirectionalLight();w.torchLights=[];
    applyEnvironment(w,{biome:'desert'});
    w.hemi.intensity=1.65;w.sun.intensity=3.4;
    w.sun.position.set(-8,18,12);w.sun.target.position.set(1,-1,0);w.sun.castShadow=true;
    w.sun.shadow.mapSize.set(1024,1024);Object.assign(w.sun.shadow.camera,{left:-15,right:15,top:14,bottom:-12,near:.5,far:80});
    w.sun.shadow.bias=-.00025;w.sun.shadow.normalBias=.035;
    w.fill.position.set(8,5,-12);w.fill.intensity=.6;
    w.scene.add(w.hemi,w.sun,w.sun.target,w.fill);
    w.scene.fog.near=35;w.scene.fog.far=155;
    w.flags=[];this.backRoot=new THREE.Group();this.backRoot.name='Title canyon vista';w.scene.add(this.backRoot);
    this.foreground=new THREE.Group();this.foreground.name='Title overlook';w.scene.add(this.foreground);
    this.camera=new THREE.OrthographicCamera(-10,10,6,-6,.1,160);
    this.camera.position.set(0,8,26);this.camera.lookAt(0,3,0);
    this.formations=[];
    // Three receding planes keep the arch opening and the river valley legible.
    for(const [key,x,y,z,h,turn]of [
      ['summit',-8,-13.8,-49,9,.15],['summit',11,-16.3,-58,10,-.3],
      ['arch',7,-8.5,-28,8,-.1],['summit',-10,-10,-22,7,.22],
      ['summit',13,-11.5,-17,8,-.28],['arch',-6,-18,-65,9,.15]
    ]){
      const model=canyonModel(w,key,this.backRoot,x,y,z,h,turn);
      this.formations.push({model,x,y,z,h,scale:model.scale.x});
      model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
    }
    // The winding river is clay geometry, set below the rims of the canyon.
    const riverShape=new THREE.Shape();riverShape.moveTo(-.6,-7);
    riverShape.bezierCurveTo(.8,-14,-1.2,-23,-.3,-31);riverShape.bezierCurveTo(.5,-37,-.2,-40,0,-43);
    riverShape.lineTo(.22,-43);riverShape.bezierCurveTo(.05,-40,.8,-37,.1,-31);
    riverShape.bezierCurveTo(-.6,-23,1.4,-14,.5,-7);riverShape.closePath();
    this.river=w.mesh(new THREE.ShapeGeometry(riverShape,36),'water',this.backRoot,0,-7.5,0);
    this.river.rotation.x=Math.PI/2;this.river.material.side=THREE.DoubleSide;this.river.name='Clay river';
    this.clouds=[];
    for(const [x,y,z,width]of [[-11,-.5,-34,6],[10,-.7,-43,7],[18,-.7,-28,5],[-2,-3.9,-59,6]]){
      const model=cloudModel(w,this.backRoot,x,y,z,width,.15);this.clouds.push({model,x,y,scale:model.scale.x});
      model.traverse(o=>{if(o.isMesh){const m=o.material.clone();delete m.userData.clay;clayMaterial(w,m,.025);m.fog=false;o.material=m;}});
    }
    this.makeOverlook();
    this.game={status:'menu',respawnTimer:0,player:{x:0,y:0,vx:0,vy:0,facing:1,groundId:'overlook',invuln:0},level:{platforms:[{id:'overlook',kind:'stone',x:-6,y:0,w:9,active:true}]}};
    this.resize(1280,720);
  }
  makeOverlook(){
    const w=this.view,g=this.foreground;
    // Staggered, rounded sandstone masses, with a broad irregular top surface.
    for(let row=0;row<4;row++)for(let col=0;col<4;col++){
      const x=-5.3+col*1.95+(row%2)*.16,y=-1.15-row*1.92;
      const m=w.box(2.15,2.08,4.1+(col%2)*.18,(col+row)%3?'terrain':'terrain2',g,x,y,-.35,.34);
      m.rotation.z=Math.sin(col*5+row)*.028;
    }
    for(let col=0;col<4;col++){
      const cap=w.box(2.16,.36,4.5,'top',g,-5.25+col*1.96,-.12,-.26,.17);cap.rotation.y=(col%2?1:-1)*.025;
    }
    const cactus=canyonModel(w,'cactus',g,-3.5,.025,-.45,2.6,-.35);cactus.name='Title cactus';
    this.flag=w.flag(-2.3,.01,g,1.05);this.flag.position.z=.16;
    for(const [x,z,s]of [[-4.7,1.2,.5],[-1.5,1.4,.2],[.8,1.1,.25],[-3.1,1.5,.17],[1.4,-.6,.18]]){
      const rock=w.ball(s,s*.6,s*.7,'terrain2',g,x,s*.38,z);rock.rotation.set(.1,x*.8,.12);
    }
    for(let i=0;i<5;i++){
      const leaf=w.ball(.12,.37,.1,'foliage',g,-3.7+i*.17,.2,1.12);leaf.rotation.z=(i-2)*.3;
    }
  }
  resize(width,height){
    if(this.width===width&&this.height===height)return;
    this.width=width;this.height=height;const aspect=width/height,wide=aspect>1;
    this.viewH=wide?10.8:14.5;this.viewW=this.viewH*aspect;
    const c=this.camera;c.left=-this.viewW/2;c.right=this.viewW/2;c.top=this.viewH/2;c.bottom=-this.viewH/2;c.updateProjectionMatrix();
    const z=2,heroX=((wide?.72:.61)-.5)*this.viewW;
    this.foreground.position.set(heroX,3+(.5-(wide?.81:.82))*this.viewH+z*5/26,z);
    this.foreground.scale.setScalar(wide?1.2:1.25);
    this.river.position.x=heroX+2.3;
    // Recompose the same models for narrow screens rather than crop the hero.
    for(const f of this.formations){f.model.position.x=f.x*(wide?1:.52);f.model.position.y=f.y;f.model.scale.setScalar(f.scale);}
    this.formations[2].model.position.x=wide?7:3.8;
    if(!wide){const f=this.formations[2];f.model.scale.setScalar(f.scale*.65);f.model.position.y=-6.3;}
    for(const c of this.clouds){c.model.position.x=c.x*(wide?1:.48);c.model.scale.setScalar(c.scale*(wide?1:.55));}
  }
  show(){
    if(this.active)return;this.active=true;
    this.foreground.add(this.world.character.root,this.world.character.shadow);
    heroEvent(this.world.character,{type:'respawn'});
  }
  hide(){
    if(!this.active)return;this.active=false;
    this.world.scene.add(this.world.character.root,this.world.character.shadow);
    heroEvent(this.world.character,{type:'respawn'});
  }
  update(dt){
    const w=this.view,step=this.world.reducedMotion?0:Math.min(dt,.05);this.time+=step;w.reducedMotion=this.world.reducedMotion;
    animateHero(w,this.game,step);w.character.root.rotation.y=.65;
    // animateHero's pose and skin remain intact; only the presentation yaw differs.
    w.character.root.visible=true;
    for(const [i,f]of w.flags.entries()){f.rotation.y=Math.sin(this.time*2+i)*.12;f.rotation.z=Math.sin(this.time*1.6+i)*.018;}
    for(const [i,c]of this.clouds.entries())c.model.position.x=c.x*(this.width>this.height?1:.48)+Math.sin(this.time*.055+i)*.7;
    this.camera.position.x=Math.sin(this.time*.12)*.09;this.camera.lookAt(0,3,0);
  }
  render(dt){
    if(!this.active)return;
    const rect=this.world.canvas.getBoundingClientRect();this.resize(Math.max(1,rect.width),Math.max(1,rect.height));this.update(dt);
    const r=this.world.renderer;r.setRenderTarget(null);r.render(this.view.scene,this.camera);
  }
}
