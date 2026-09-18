// A block that is pushed: walk into it and it slides ahead of you, at a walk's
// third, until something solid stops it. Pure numbers on a platform record, so
// the simulation, the rule, the view and the tests read one block.
//
// The block is the plug of the Clay Lab's broken corner. Free, it is stone to
// the player — a deck to stand on, a face to walk into. Pushed onto the rotten
// corner while the rot still stands it reacts with it: it hisses, blackens,
// falls to pieces and comes back where it started. Pushed over the gap the
// stomped rot has left, it drops in and locks, and from then on the station's
// formable mass stands in its place.
export const PUSH=Object.freeze({
  // Units a second a grounded walk moves it.
  speed:2.4,
  // How far onto the standing rot the block may reach before it reacts.
  contact:.4,
  // Seconds the reaction takes, seconds it is gone, and how long the pop of
  // its return is read.
  dissolve:.5,gone:.8,pop:.35,
  // The share of its footprint over the open gap that drops it in, and how
  // long the drop takes.
  lock:.7,drop:.3,
});

export const overlap=(ax,aw,bx,bw)=>Math.max(0,Math.min(ax+aw,bx+bw)-Math.max(ax,bx));

// The block's own state lives on the platform record beside its position:
// `pushPhase` is free | dissolving | gone | locking | locked; `dissolve` is the
// reaction's progress and `pop` the return's, both 0..1, for the view.
export function initPush(s){
  s.baseX=s.baseX??s.x;s.baseY=s.baseY??s.y;
  s.pushPhase='free';s.pushT=0;s.dissolve=0;s.pop=0;s.active=true;s.hidden=false;
}
export function resetPush(s){s.x=s.baseX;s.y=s.baseY;s.prevX=s.x;s.prevY=s.y;initPush(s);}

// The player has swept from `prevX` to `p.x` this tick, on the ground. If that
// sweep runs into the block's face, the block goes ahead by up to `speed·dt`,
// and no further than the first wall in its way; the player is then resolved
// against the moved face by the passes that follow. Returns how far it went.
export function resolvePush(s,p,{prevX,radius,height,dt,walls=[]}){
  if(s.active===false||s.pushPhase!=='free')return 0;
  const base=s.y-s.h;
  if(!(p.y<s.y-.12&&p.y+height>base+.12))return 0;
  const left=s.x-radius,right=s.x+s.w+radius;
  let want=0;
  if(prevX<=left&&p.x>left)want=p.x-left;
  else if(prevX>=right&&p.x<right)want=p.x-right;
  else return 0;
  let dx=Math.sign(want)*Math.min(Math.abs(want),PUSH.speed*dt);
  for(const b of walls){
    if(!(b.top>base+1e-6&&b.bottom<s.y-1e-6))continue;
    if(dx>0&&b.x>=s.x+s.w-1e-6)dx=Math.min(dx,b.x-(s.x+s.w));
    if(dx<0&&b.x+b.w<=s.x+1e-6)dx=Math.max(dx,b.x+b.w-s.x);
  }
  if(Math.abs(dx)<1e-9)return 0;
  s.x+=dx;return dx;
}

// One tick of the block's own life. `notch` is the gap it is meant to plug —
// {x, w, floor} — and `open` whether the rot that filled it is gone; `clear`
// says the player is not standing where the block would come back. Returns the
// transition made this tick, or null: 'dissolve' as the reaction starts,
// 'shatter' as it falls to pieces, 'respawn' as it comes back, 'lock' as it
// tips into the gap, 'locked' as it settles there.
export function stepPush(s,dt,{open=false,notch=null,clear=true}={}){
  const step=Math.max(0,Math.min(1/30,Number.isFinite(dt)?dt:0));
  s.pop=Math.max(0,s.pop-step/PUSH.pop);
  const over=notch?overlap(s.x,s.w,notch.x,notch.w):0;
  switch(s.pushPhase){
    case 'free':
      if(notch&&!open&&over>PUSH.contact){s.pushPhase='dissolving';s.pushT=0;return 'dissolve';}
      if(notch&&open&&over>=PUSH.lock*s.w){s.pushPhase='locking';s.pushT=0;s.dropFromX=s.x;s.dropToX=notch.x;s.dropFrom=s.y;s.dropTo=notch.floor+s.h;return 'lock';}
      return null;
    case 'dissolving':
      s.pushT+=step;s.dissolve=Math.min(1,s.pushT/PUSH.dissolve);
      if(s.pushT>=PUSH.dissolve){s.pushPhase='gone';s.pushT=0;s.active=false;s.hidden=true;return 'shatter';}
      return null;
    case 'gone':
      s.pushT+=step;
      if(s.pushT>=PUSH.gone&&clear){s.x=s.baseX;s.y=s.baseY;s.prevX=s.x;s.prevY=s.y;s.dissolve=0;s.pop=1;s.pushPhase='free';s.active=true;s.hidden=false;return 'respawn';}
      return null;
    case 'locking':{
      // It tips the last of the way in as it drops, and settles seated.
      s.pushT+=step;
      const u=Math.min(1,s.pushT/PUSH.drop),k=u*u*(3-2*u);
      s.x=s.dropFromX+(s.dropToX-s.dropFromX)*k;
      s.y=s.dropFrom+(s.dropTo-s.dropFrom)*k;
      if(u>=1){s.x=s.dropToX;s.y=s.dropTo;s.pushPhase='locked';s.active=false;s.hidden=true;return 'locked';}
      return null;}
    default:return null;
  }
}

// How far the block has come towards plugging the gap, 0..1, for a readout.
export const lockShare=(s,notch)=>notch&&s.w>0?Math.min(1,overlap(s.x,s.w,notch.x,notch.w)/(PUSH.lock*s.w)):0;
