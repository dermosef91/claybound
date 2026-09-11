import assert from 'node:assert/strict';
import {Fullscreen} from '../dist/fullscreen.js';
import {VirtualJoystick,joystickState} from '../dist/controls.js';
import {Game,FIXED_DT} from '../dist/simulation.js';
// Small involuntary motion stays neutral. Vertical drift cannot change speed.
for(const radius of [32.48,34.944,36.96]){
  for(const dx of [-10,-5,0,5,10])for(const dy of [-200,0,200])assert.equal(joystickState(dx,dy,radius).axis,0);
  let previous=0;
  for(let dx=0;dx<=200;dx+=.25){const state=joystickState(dx,200,radius);assert(state.axis>=previous&&state.axis<=1);assert.equal(state.axis,joystickState(dx,0,radius).axis);assert.equal(state.axis,Math.abs(joystickState(-dx,0,radius).axis));assert(Math.hypot(state.x,state.y)<=radius+.0001);previous=state.axis;}
  const gentle=joystickState(18,0,radius).axis;assert(gentle>.1&&gentle<.3);
  assert.equal(joystickState(radius,0,radius).axis,1);assert.equal(joystickState(-radius,0,radius).axis,-1);
}
assert.equal(joystickState(NaN,0,35).axis,0);assert.equal(joystickState(35,0,0).axis,0);
console.log('PASS joystick neutral zone, precision curve, vertical-drift rejection and full speed at mobile sizes');

function stickFixture(){
  const handlers={},classes=new Set(),css=new Map(),captured=new Set();let enabled=true,starts=0;
  const element={addEventListener:(n,f)=>{handlers[n]=f;},style:{setProperty:(k,v)=>css.set(k,v)},classList:{toggle:(k,active)=>active?classes.add(k):classes.delete(k)},getBoundingClientRect:()=>({left:20,top:400,width:132,height:132}),setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>{captured.delete(id);handlers.lostpointercapture({pointerId:id});}};
  const values=[],stick=new VirtualJoystick(element,{enabled:()=>enabled,onStart:()=>starts++,onChange:v=>values.push(v)});
  const emit=(name,id,x=86,y=466,extra={})=>handlers[name]({pointerId:id,clientX:x,clientY:y,button:0,pointerType:'touch',preventDefault(){},...extra});
  return {stick,values,css,classes,captured,emit,disable(){enabled=false;},starts:()=>starts};
}
{
  const f=stickFixture();f.emit('pointerdown',1);assert.equal(f.stick.axis,0);assert(f.captured.has(1));
  f.emit('pointermove',1,105);const precision=f.stick.axis;assert(precision>.1&&precision<.3);
  f.emit('pointerdown',2,20);f.emit('pointermove',2,0);f.emit('pointerup',2);assert.equal(f.stick.axis,precision);assert.equal(f.starts(),1);
  f.emit('pointermove',1,500,700);assert.equal(f.stick.axis,1);assert(f.captured.has(1));
  f.emit('pointermove',1,-300,700);assert.equal(f.stick.axis,-1);
  f.emit('pointerup',1);assert.equal(f.stick.axis,0);assert.equal(f.stick.pointerId,null);assert.equal(f.css.get('--stick-x'),'0.00px');assert(!f.captured.size);assert(!f.classes.has('is-active'));
  f.emit('pointermove',1,500);assert.equal(f.stick.axis,0);
}
for(const event of ['pointercancel','lostpointercapture']){
  const f=stickFixture();f.emit('pointerdown',7,130);assert.equal(f.stick.axis,1);f.emit(event,7);assert.equal(f.stick.axis,0);assert(!f.captured.size);
}
{
  const f=stickFixture();f.emit('pointerdown',7,130);f.disable();f.emit('pointermove',7,150);assert.equal(f.stick.axis,0);f.emit('pointerdown',8,130);assert.equal(f.stick.pointerId,null);
}
console.log('PASS one-thumb ownership, tracking beyond the ring, release/cancel/capture loss and disabled input');

{
  const game=new Game();game.start(0);game.level.enemies=[];
  const gentle=joystickState(18,0,36.96).axis;
  for(let i=0;i<36;i++)game.tick(FIXED_DT,{moveAxis:gentle});
  assert(game.player.vx>.6&&game.player.vx<1.8);const x=game.player.x;
  for(let i=0;i<12;i++)game.tick(FIXED_DT,{moveAxis:0});
  assert.equal(game.player.vx,0);assert(game.player.x-x<.025);
  for(let i=0;i<36;i++)game.tick(FIXED_DT,{moveAxis:joystickState(100,100,36.96).axis});
  assert.equal(game.player.vx,6.7);
}
console.log('PASS gentle joystick steps brake within 0.025 world units; full tilt retains run speed');
function fixture(){
  const listeners={};let enters=0,exits=0;const states=[];
  const doc={fullscreenElement:null,addEventListener(n,f){listeners[n]=f;},documentElement:{async requestFullscreen(){enters++;doc.fullscreenElement=this;listeners.fullscreenchange();}},async exitFullscreen(){exits++;doc.fullscreenElement=null;listeners.fullscreenchange();}};
  const f=new Fullscreen({doc,screenRef:{orientation:{unlock(){}}},onChange:a=>states.push(a)});
  return {f,doc,listeners,states,counts:()=>[enters,exits]};
}
{
  const {f,doc,listeners,states,counts}=fixture();assert(await f.enter());assert(f.active);assert.deepEqual(counts(),[1,0]);
  await f.enter();assert.deepEqual(counts(),[1,0]);await f.toggle();assert(!f.active);assert.deepEqual(counts(),[1,1]);
  await f.enter();doc.fullscreenElement=null;listeners.fullscreenchange();assert(!f.active);assert.equal(states.at(-1),false);
  console.log('PASS fullscreen enter, duplicate requests, exit, and Escape state synchronization');
}
{
  let failures=0;const doc={fullscreenElement:null,addEventListener(){},documentElement:{async requestFullscreen(){throw new Error('Blocked by host');}}};
  const f=new Fullscreen({doc,screenRef:{},onUnavailable:()=>failures++});assert.equal(await f.enter(),false);assert(!f.active);assert(!f.pending);assert.equal(failures,1);
  console.log('PASS blocked fullscreen returns an honest error and remains usable');
}
