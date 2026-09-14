import * as THREE from './lib/three.module.js';
import {nearbyStation,visitStation,clampShape,nudgeClay} from './shaping.js';

// Kneading has no panel. The clay says what it is by being violet, soft and
// alive, and says how to work it with the hand cue over it; this class only
// carries the input — drag the clay itself, hold E, stomp it, R to soften.
export class ShapingControls {
  constructor({game,world,input,picker}){
    Object.assign(this,{game,world,input,picker});
    window.addEventListener('keydown',e=>{
      if(!this.enabled()||e.ctrlKey||e.metaKey||e.altKey)return;
      if(e.code==='KeyE'){e.preventDefault();input.shapeHeld=true;}
      if(e.code==='KeyR'&&!e.repeat){e.preventDefault();this.reset();}
    });
    window.addEventListener('keyup',e=>{if(e.code==='KeyE')input.shapeHeld=false;});
    const canvas=document.getElementById('world');
    canvas.addEventListener('pointerdown',e=>{
      if(!this.enabled()||e.button!==0||this.drag)return;
      const station=nearbyStation(game);if(!station)return;
      const w=world(),rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),w.camera);
      const point=new THREE.Vector3();if(!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-1.4),point))return;
      // A thumb is not a cursor: accept a touch anywhere around the clay, and
      // all the way down its body, rather than only on its exact silhouette.
      const grab=1.1;
      const s=game.level.platforms.find(p=>station.parts.includes(p.id)&&point.x>=p.x-grab&&point.x<=p.x+p.w+grab&&point.y<=p.y+(p.slope||0)+grab&&point.y>=p.y-p.h-grab);
      if(!s)return;
      e.preventDefault();canvas.setPointerCapture(e.pointerId);
      this.drag={id:e.pointerId,station,x:e.clientX,y:e.clientY,start:station.target,side:point.x<s.x+s.w/2?-1:1,moved:0};
      input.shapeId=station.id;
    });
    canvas.addEventListener('pointermove',e=>{
      const d=this.drag;if(!d||e.pointerId!==d.id||!this.enabled())return;
      d.moved=Math.max(d.moved,Math.abs(e.clientX-d.x),Math.abs(e.clientY-d.y));
      const delta=d.station.gesture==='down'?e.clientY-d.y:(e.clientX-d.x)*(d.station.gesture==='out'?d.side:1);
      // How far the thumb travels for a full press. The stroke is the primary
      // verb, so it is sized to be finished comfortably inside one swipe:
      // a short push already moves the clay visibly, rather than needing most
      // of the screen before anything appears to happen.
      input.shapeAmount=clampShape(d.start+delta/Math.max(64,Math.min(140,innerWidth*.12)));
    });
    const end=e=>{
      const d=this.drag;if(!d||e.pointerId!==d.id)return;
      // Touch that never travelled is a tap on the clay, so give it a press.
      if(d.moved<9&&this.enabled())nudgeClay(this.game,d.station.id);
      this.drag=null;input.shapeId=null;input.shapeAmount=null;
    };
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,end);
  }
  enabled(){return !!this.game.level.shaping?.length&&this.game.status==='playing';}
  clear(){this.drag=null;this.input.shapeHeld=false;this.input.shapeId=null;this.input.shapeAmount=null;this.input.shapeReset=false;}
  // In the playground R also returns the player to the station's own spawn.
  // A chapter only softens the clay again, wherever the player is standing.
  reset(){
    if(!this.enabled())return;const station=nearbyStation(this.game);if(!station)return;
    this.clear();
    if(this.game.level.playground)visitStation(this.game,station.id,{reset:true});else this.pendingReset=true;
  }
  update(){
    this.input.shapeReset=!!this.pendingReset;this.pendingReset=false;
    if(!this.enabled())this.clear();
  }
}
