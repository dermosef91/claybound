// A fixed housing and a moving head share the same floor-contact dimensions.
export const PRESS={halfHeight:.65,warningStart:.40,slamStart:.54,impactStart:.64,retractStart:.74};
const clamp=n=>Math.max(0,Math.min(1,n));
const approach=(a,b,d)=>a<b?Math.min(b,a+d):Math.max(b,a-d);
export function initializePress(c,platforms){
  c.baseY=c.y;c.prevY=c.y;c.cycleTime=0;c.state='rest';c.warning=0;c.held=false;c.didImpact=false;
  const floor=platforms.filter(p=>['stone','ledge'].includes(p.kind)&&c.x>=p.x&&c.x<=p.x+p.w&&p.y<c.baseY-PRESS.halfHeight&&p.y>=c.baseY-c.range-PRESS.halfHeight-1.2).sort((a,b)=>b.y-a.y)[0];
  const fixed=Number.isFinite(c.floorY);
  c.supportId=fixed?null:floor?.id;c.floorY=fixed?c.floorY:floor?.y??c.baseY-c.range-PRESS.halfHeight;
  c.bottomY=c.floorY+PRESS.halfHeight;
}
export function updatePress(c,dt,channels,platforms,onEvent){
  c.prevY=c.y;c.held=!!(c.holdChannel&&channels[c.holdChannel]>0);
  const floor=platforms.find(p=>p.id===c.supportId);
  if(floor){c.floorY=floor.y;c.bottomY=Math.min(c.baseY,floor.y+PRESS.halfHeight);}
  if(c.held){
    c.cycleTime=0;c.warning=0;c.state='held';c.didImpact=false;
    c.y=approach(c.y,c.baseY,dt*14);return;
  }
  c.cycleTime+=dt;
  const phase=((c.cycleTime/(c.period||5)+(c.phase||0)/(Math.PI*2))%1+1)%1;
  let travel=0;
  c.warning=0;
  if(phase<PRESS.warningStart){c.state='rest';c.didImpact=false;}
  else if(phase<PRESS.slamStart){c.state='warning';c.warning=clamp((phase-PRESS.warningStart)/(PRESS.slamStart-PRESS.warningStart));}
  else if(phase<PRESS.impactStart){c.state='slam';travel=clamp((phase-PRESS.slamStart)/(PRESS.impactStart-PRESS.slamStart))**2;}
  else if(phase<PRESS.retractStart){c.state='impact';travel=1;}
  else{c.state='retract';const t=(phase-PRESS.retractStart)/(1-PRESS.retractStart);travel=1-t*t*(3-2*t);}
  c.y=c.baseY-(c.baseY-c.bottomY)*travel;
  if(c.state==='impact'&&!c.didImpact){c.didImpact=true;onEvent?.('press-impact',{x:c.x,y:c.floorY,w:c.w});}
}
export function pressTouches(c,p,rules,previousPlayerY=p.y){
  if(c.held)return false;
  return Math.abs(p.x-c.x)<c.w/2+rules.radius*.82&&
    Math.max(p.y,previousPlayerY)+rules.height>Math.min(c.y,c.prevY)-PRESS.halfHeight&&
    Math.min(p.y,previousPlayerY)<Math.max(c.y,c.prevY)+PRESS.halfHeight;
}
