// A marble on the formable mass: a ball that rolls down whatever slope the clay
// has under it, is carried up when a hand raises the clay beneath it, and comes
// to rest in a hollow. Pure numbers, driven with the form it sits on, so the
// rule, the view and the tests read one marble.
//
// It is the clay that is worked, never the marble: the only way to move it is
// to change the ground under it — lean the ground, raise a step behind it,
// stomp a crater whose rim tips it on — which is the whole of the puzzle.
import {formHeight} from './clay-form.js';

export const MARBLE=Object.freeze({
  radius:.5,
  // The player's gravity, so it falls like everything else here.
  gravity:27,
  // Rolling resistance: a share of speed lost a second, and a steady braking
  // in units a second squared that brings a marble rocking in a bowl to a
  // stop in a couple of seconds rather than a slow forever. And the most it
  // ever rolls: a marble that never stopped would make the socket a lottery.
  drag:.5,roll:1.1,top:9,
  // Slower than `rest` on ground shallower than `flat` is standing still, and
  // standing still it stays: a marble does not creep off nearly level ground
  // on its own, so a shape that has caught it holds it until the ground
  // changes — but any real lean, a stomp crater's rim included, sets it going.
  rest:.2,flat:.12,
  // What a bench end gives back.
  bounce:.3,
  // How far either side of the ball the ground under it is read.
  probe:.3,
  // Seconds at rest in the socket before it counts as home.
  seat:.5,
});

export function createMarble(x,{radius=MARBLE.radius}={}){
  const start=Number.isFinite(x)?x:2;
  return {start,x:start,vx:0,r:radius>0?radius:MARBLE.radius,spin:0,still:0,home:false};
}
export function resetMarble(m){m.x=m.start;m.vx=0;m.spin=0;m.still=0;m.home=false;}

// Where the marble's centre sits over the base of the form.
export const marbleHeight=(f,m)=>formHeight(f,m.x)+m.r;

// One fixed tick. `socket` is [left, right] in the form's own x, where the
// marble is home once it has sat still for `seat`. Returns whether it is at rest.
export function stepMarble(m,f,dt,socket=null){
  const step=Math.max(0,Math.min(1/30,Number.isFinite(dt)?dt:0));
  if(!step)return Math.abs(m.vx)<MARBLE.rest;
  const e=MARBLE.probe,slope=(formHeight(f,m.x+e)-formHeight(f,m.x-e))/(2*e);
  const held=Math.abs(slope)<MARBLE.flat&&Math.abs(m.vx)<MARBLE.rest;
  if(held)m.vx=0;
  else {
    // Gravity along the surface, read back onto x: g·sinθ·cosθ.
    m.vx-=MARBLE.gravity*slope/(1+slope*slope)*step;
    m.vx*=Math.exp(-MARBLE.drag*step);
    const brake=MARBLE.roll*step;
    m.vx=Math.abs(m.vx)<=brake?0:m.vx-Math.sign(m.vx)*brake;
    m.vx=Math.max(-MARBLE.top,Math.min(MARBLE.top,m.vx));
  }
  m.x+=m.vx*step;
  // The benches either end of the trough are walls.
  if(m.x<m.r){m.x=m.r;m.vx=Math.abs(m.vx)*MARBLE.bounce;}
  if(m.x>f.w-m.r){m.x=f.w-m.r;m.vx=-Math.abs(m.vx)*MARBLE.bounce;}
  m.spin+=m.vx*step/m.r;
  const resting=m.vx===0||Math.abs(m.vx)<MARBLE.rest&&Math.abs(slope)<MARBLE.flat;
  m.still=resting?m.still+step:0;
  m.home=Array.isArray(socket)&&m.x>=socket[0]&&m.x<=socket[1]&&m.still>=MARBLE.seat;
  return resting;
}
