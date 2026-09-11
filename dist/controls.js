// Vertical thumb drift must never speed up, reverse, jump, or stomp the player.
export function joystickState(dx,dy,radius){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(radius)||radius<=12)return {axis:0,x:0,y:0};
  const deadZone=Math.max(10,radius*.28);
  const amount=Math.min(1,Math.max(0,(Math.abs(dx)-deadZone)/(radius-deadZone)));
  const scale=radius/Math.max(radius,Math.hypot(dx,dy));
  return {axis:amount?Math.sign(dx)*Math.pow(amount,1.5):0,x:dx*scale,y:dy*scale};
}

export class VirtualJoystick{
  constructor(element,{enabled=()=>true,onChange=()=>{},onStart=()=>{}}={}){
    this.element=element;this.enabled=enabled;this.onChange=onChange;this.onStart=onStart;
    this.pointerId=null;this.axis=0;
    element.addEventListener('pointerdown',e=>this.down(e),{passive:false});
    element.addEventListener('pointermove',e=>this.move(e),{passive:false});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(name,e=>{
      if(e.pointerId===this.pointerId)this.reset();
    });
    this.paint({x:0,y:0});
  }
  down(e){
    // One thumb owns the stick until it lifts. Jump/stomp touches cannot steal it.
    if(!this.enabled()||this.pointerId!==null||(e.button!==undefined&&e.button!==0))return;
    const bounds=this.element.getBoundingClientRect();
    this.radius=Math.min(bounds.width,bounds.height)*.28;
    if(this.radius<=12)return;
    this.center={x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2};
    e.preventDefault();this.pointerId=e.pointerId;
    try{this.element.setPointerCapture(e.pointerId);}catch{this.reset();return;}
    this.onStart();this.update(e);
  }
  move(e){
    if(e.pointerId!==this.pointerId)return;
    if(!this.enabled()||(e.pointerType==='mouse'&&e.buttons===0)){this.reset();return;}
    e.preventDefault();this.update(e);
  }
  update(e){
    const state=joystickState(e.clientX-this.center.x,e.clientY-this.center.y,this.radius);
    this.axis=state.axis;this.paint(state);this.onChange(this.axis);
  }
  paint({x,y}){
    this.element.style.setProperty('--stick-x',`${x.toFixed(2)}px`);
    this.element.style.setProperty('--stick-y',`${y.toFixed(2)}px`);
    this.element.classList.toggle('is-active',this.pointerId!==null);
    this.element.classList.toggle('is-steering',this.axis!==0);
  }
  reset(){
    const id=this.pointerId;
    this.pointerId=null;this.axis=0;this.paint({x:0,y:0});
    // Clear ownership before releasing capture, which can dispatch another event.
    if(id!==null){try{if(this.element.hasPointerCapture(id))this.element.releasePointerCapture(id);}catch{}}
    this.onChange(0);
  }
}
