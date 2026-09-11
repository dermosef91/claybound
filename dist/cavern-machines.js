// Machine motion is part of the fixed-step simulation, including passenger carry.
const approach=(a,b,d)=>a<b?Math.min(b,a+d):Math.max(b,a-d);
export function updateCavernMachine(s,p,time,dt,channels){
  if(s.kind==='gate'){
    const unlocked=channels[s.channel]>0;
    s.open=approach(s.open||0,unlocked?1:0,dt*1.8);
    // The grate stays solid until the opening is visibly clear.
    s.active=s.open<.95;
  }
  if(s.kind==='orbit'){
    const a=time*Math.PI*2/(s.period||12)+(s.phase||0);
    s.orbitAngle=a;s.x=s.baseX+Math.cos(a)*(s.moveX||4);s.y=s.baseY+Math.sin(a)*(s.moveY||4);
  }
  if(s.kind==='ferry'){
    const occupied=p.groundId===s.id;
    s.emptyTime=occupied?0:(s.emptyTime||0)+dt;
    const weight=p.x-(s.x+s.w/2),dead=.42;
    s.drive=occupied&&Math.abs(weight)>dead?Math.sign(weight)*Math.min(1,(Math.abs(weight)-dead)/.55):0;
    // An abandoned ferry returns to the boarding dock, so a missed transfer
    // never strands a player in a side alcove or after a checkpoint restart.
    if(!occupied&&s.emptyTime>1.4)s.drive=s.x>s.baseX+.02?-1:0;
    s.velocity=approach(s.velocity||0,s.drive*(s.speed||3.2),dt*9);
    s.x=Math.max(s.baseX,Math.min(s.baseX+(s.travel||24),s.x+s.velocity*dt));
    if(s.x===s.baseX&&s.velocity<0||s.x===s.baseX+(s.travel||24)&&s.velocity>0)s.velocity=0;
  }
}

export const solidDepth=s=>s.kind==='gate'?(s.h||10):11;
export const solidWall=s=>s.active!==false&&!s.broken&&(s.kind==='stone'||s.kind==='gate');
