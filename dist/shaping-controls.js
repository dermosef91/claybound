import * as THREE from './lib/three.module.js';
import {nearbyStation,visitStation,clampShape} from './shaping.js';

export class ShapingControls {
  constructor({game,world,input,picker}){
    Object.assign(this,{game,world,input,picker});
    this.root=document.createElement('aside');this.root.id='shaping-controls';this.root.className='shaping-controls hidden';this.root.setAttribute('aria-label','Clay shaping controls');
    this.root.innerHTML='<div class="shape-heading"><strong id="shape-name"></strong><button id="shape-stations" aria-label="Choose shaping station">Stations ↗</button></div><div class="shape-progress" role="progressbar" aria-label="Clay shaped" aria-valuemin="0" aria-valuemax="100"><span></span></div><div class="shape-actions"><button id="knead" aria-label="Hold to knead nearby clay">Hold E · KNEAD</button><button id="shape-reset" aria-label="Reset this clay station (R)">↺ Reset</button></div>';
    document.getElementById('game-shell').append(this.root);
    this.name=this.root.querySelector('strong');this.meter=this.root.querySelector('[role="progressbar"]');this.fill=this.meter.firstElementChild;
    this.root.querySelector('#shape-stations').onclick=picker;
    this.root.querySelector('#shape-reset').onclick=()=>this.reset();
    const button=this.root.querySelector('#knead');
    button.addEventListener('pointerdown',e=>{if(!this.enabled())return;e.preventDefault();button.setPointerCapture(e.pointerId);this.held=e.pointerId;input.shapeHeld=true;});
    const release=()=>{this.held=null;input.shapeHeld=false;};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
    // Keyboard activation also works for assistive technology using a click.
    button.addEventListener('click',e=>{if(e.detail===0&&this.enabled()){const s=nearbyStation(game);if(s)s.target=1;}});
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
      const s=game.level.platforms.find(p=>station.parts.includes(p.id)&&point.x>=p.x-.5&&point.x<=p.x+p.w+.5&&point.y<=p.y+(p.slope||0)+.4&&point.y>=p.y-Math.min(p.h,7));
      if(!s)return;
      e.preventDefault();canvas.setPointerCapture(e.pointerId);
      this.drag={id:e.pointerId,station,x:e.clientX,y:e.clientY,start:station.target,side:point.x<s.x+s.w/2?-1:1};
      input.shapeId=station.id;
    });
    canvas.addEventListener('pointermove',e=>{
      const d=this.drag;if(!d||e.pointerId!==d.id||!this.enabled())return;
      const delta=d.station.gesture==='down'?e.clientY-d.y:(e.clientX-d.x)*(d.station.gesture==='out'?d.side:1);
      input.shapeAmount=clampShape(d.start+delta/Math.max(90,Math.min(200,innerWidth*.18)));
    });
    const end=e=>{if(e.pointerId===this.drag?.id){this.drag=null;input.shapeId=null;input.shapeAmount=null;}};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,end);
  }
  enabled(){return !!this.game.level.shaping?.length&&this.game.status==='playing';}
  clear(){this.drag=null;this.held=null;this.input.shapeHeld=false;this.input.shapeId=null;this.input.shapeAmount=null;this.input.shapeReset=false;}
  // In the playground R also returns the player to the station's own spawn.
  // A chapter only softens the clay again, wherever the player is standing.
  reset(){
    if(!this.enabled())return;const station=nearbyStation(this.game);if(!station)return;
    this.clear();
    if(this.game.level.playground)visitStation(this.game,station.id,{reset:true});else this.pendingReset=true;
  }
  update(){
    this.input.shapeReset=!!this.pendingReset;this.pendingReset=false;
    const station=this.enabled()?nearbyStation(this.game):null;
    this.root.classList.toggle('hidden',!station);
    if(!station){this.clear();return;}
    this.name.textContent=station.name+(station.amount>.995?' ✓':'');const amount=Math.round(station.amount*100);
    this.fill.style.width=amount+'%';this.meter.setAttribute('aria-valuenow',String(amount));
    this.root.querySelector('#knead').classList.toggle('pressed',!!this.input.shapeHeld);
  }
}
