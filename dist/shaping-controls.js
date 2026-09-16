import * as THREE from './lib/three.module.js';
import {nearbyStation,visitStation,clampShape,nudgeClay} from './shaping.js';
import {takesHands,perPart} from './clay-rules.js';

// Kneading has no panel. The clay says what it is by being violet, soft and
// alive, and says how to work it with the hand cue over it; this class only
// carries the input — drag the clay itself, hold E, stomp it, R to soften.
export class ShapingControls {
  constructor({game,world,input,picker}){
    Object.assign(this,{game,world,input,picker});
    // The key is remembered here rather than only written into the shared input,
    // because anything that wipes that object — a resize, a stray blur — would
    // otherwise strand a key that is still physically down, and E only ever
    // sets the flag again on a fresh press. `update` re-asserts it every frame.
    window.addEventListener('keydown',e=>{
      if(!this.enabled()||e.ctrlKey||e.metaKey||e.altKey)return;
      if(e.code==='KeyE'){e.preventDefault();this.held=true;input.shapeHeld=true;}
      if(e.code==='KeyR'&&!e.repeat){e.preventDefault();this.reset();}
    });
    window.addEventListener('keyup',e=>{if(e.code==='KeyE'){this.held=false;input.shapeHeld=false;}});
    const canvas=document.getElementById('world');
    canvas.addEventListener('pointerdown',e=>{
      if(!this.enabled()||e.button!==0)return;
      // Clay whose rule wants weight alone does not take hold of a pointer.
      const station=nearbyStation(game);if(!station||!takesHands(station))return;
      const point=this.point(e);if(!point)return;
      // The formable mass has no pose to drag between: the pointer itself is
      // the tool, so it carries a world point to the rule every tick it is
      // down. Anywhere over the trough counts, in the air included, since a
      // press in from outside is one of the things a hand does to it.
      if(station.rule==='form'){
        const s=game.level.platforms.find(p=>station.parts.includes(p.id));if(!s)return;
        const grab=1.1;
        if(point.x<s.x-grab||point.x>s.x+s.w+grab||point.y<s.y-s.h-grab||point.y>s.y-s.h+12)return;
        e.preventDefault();this.take();
        this.drag={id:e.pointerId,station,part:0,x:e.clientX,y:e.clientY,start:0,side:1,moved:0,form:true,point:{x:point.x,y:point.y}};
        input.shapeId=station.id;input.shapePart=0;input.shapeAmount=null;input.shapeX=point.x;input.shapeY=point.y;
        this.capture(e.pointerId);
        return;
      }
      // A thumb is not a cursor: accept a touch anywhere around the clay, and
      // all the way down its body, rather than only on its exact silhouette.
      const grab=1.1;
      // Neighbouring pieces sit closer together than that allowance, so their
      // grab boxes overlap; the piece nearest the touch is the one meant.
      const gap=p=>Math.hypot(Math.max(p.x-point.x,0,point.x-p.x-p.w),Math.max(point.y-p.y-(p.slope||0),0,p.y-p.h-point.y));
      const s=game.level.platforms.filter(p=>station.parts.includes(p.id)&&point.x>=p.x-grab&&point.x<=p.x+p.w+grab&&point.y<=p.y+(p.slope||0)+grab&&point.y>=p.y-p.h-grab).reduce((best,p)=>!best||gap(p)<gap(best)?p:best,null);
      if(!s)return;
      e.preventDefault();this.take();
      // A slab that moves on its own is dragged from where that slab is, not
      // from where the station as a whole is.
      const part=station.parts.indexOf(s.id),start=perPart(station)?station.targets[part]:station.target;
      this.drag={id:e.pointerId,station,part,x:e.clientX,y:e.clientY,start,side:point.x<s.x+s.w/2?-1:1,moved:0};
      // The stroke owns the amount from here: clearing it means a hold cannot be
      // pinned by whatever the previous drag happened to leave behind.
      input.shapeId=station.id;input.shapePart=part;input.shapeAmount=null;
      this.capture(e.pointerId);
    });
    canvas.addEventListener('pointermove',e=>{
      const d=this.drag;if(!d||e.pointerId!==d.id||!this.enabled())return;
      d.moved=Math.max(d.moved,Math.abs(e.clientX-d.x),Math.abs(e.clientY-d.y));
      if(d.form){
        const point=this.point(e);if(!point)return;
        d.point={x:point.x,y:point.y};input.shapeX=point.x;input.shapeY=point.y;return;
      }
      const gesture=d.station.gesture,dx=e.clientX-d.x,dy=e.clientY-d.y;
      const vertical=gesture==='down'||gesture==='up';
      // How far the thumb has come the way this piece is pulled, and how far
      // across that.
      const along=gesture==='down'?dy:gesture==='up'?-dy:dx*(gesture==='out'?d.side:1),across=vertical?dx:dy;
      // Travel back along the pull eases the clay off again, which is the only
      // way a hand undoes one. But a stroke plainly not on that line is not a
      // player undoing anything — it is a player dragging the clay — and
      // answering it with nothing at all was the clay's worst habit: a thumb
      // drawn sideways across the far mound moved it not one bit, and clay that
      // ignores an honest stroke reads as clay that cannot be dragged. So a
      // stroke clearly across the line counts towards the pose by how far it
      // went. Twice over, so that a pull back with a little drift in it is
      // still a pull back.
      const travel=Math.abs(across)>Math.abs(along)*2?Math.abs(across):along;
      // How far the thumb travels for a full press. The stroke is the primary
      // verb, so it is sized to be finished comfortably inside one swipe:
      // a short push already moves the clay visibly, rather than needing most
      // of the screen before anything appears to happen.
      input.shapeAmount=clampShape(d.start+travel/Math.max(64,Math.min(140,innerWidth*.12)));
    });
    // Only the pointer itself going away ends a stroke. Losing capture does not:
    // the browser can take capture back mid-drag, and the clay going dead under
    // a thumb that is still down is the worst version of this to debug. The
    // window pair catches a release the canvas never sees, and runs harmlessly
    // after the canvas pair when both fire.
    const end=(e,tap)=>{
      const d=this.drag;if(!d||e.pointerId!==d.id)return;
      // Touch that never travelled is a tap on the clay, so give it a press.
      if(tap&&d.moved<9&&this.enabled())nudgeClay(this.game,d.station.id,d.part,d.point);
      this.release();
    };
    for(const target of [canvas,window]){
      target.addEventListener('pointerup',e=>end(e,true));
      target.addEventListener('pointercancel',e=>end(e,false));
    }
  }
  enabled(){return !!this.game.level.shaping?.length&&this.game.status==='playing'&&!this.game.flowerCelebration;}
  // A fresh press that has found clay takes it over from whatever drag is still
  // on record. One is still on record when the last pointer never reported going
  // up, which is what releasing the button outside the window does; standing on
  // ceremony there left the clay dead to every later press. A touch that misses
  // the clay never gets this far, so a second thumb elsewhere costs a stroke
  // nothing.
  take(){if(this.drag)this.release();}
  // Capture only keeps a stroke alive when the thumb slides off the clay. A
  // pointer the browser has already let go of throws here, and a thrown capture
  // used to take the whole press down with it — including the tap on release.
  capture(id){try{document.getElementById('world').setPointerCapture(id);}catch{}}
  // Where a pointer event lands in the world, on the plane the clay's front
  // face is nearest to.
  point(e){
    const w=this.world();if(!w?.camera)return null;
    const canvas=document.getElementById('world'),rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),w.camera);
    const point=new THREE.Vector3();return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-1.4),point)?point:null;
  }
  // Letting go of the clay with the pointer, leaving a held key alone.
  release(){const i=this.input;this.drag=null;i.shapeId=null;i.shapePart=null;i.shapeAmount=null;i.shapeX=null;i.shapeY=null;}
  clear(){this.held=false;this.input.shapeHeld=false;this.input.shapeReset=false;this.release();}
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
    // A key that is still down is still kneading, whatever else touched the
    // shared input since the frame it went down on.
    else if(this.held)this.input.shapeHeld=true;
  }
}
