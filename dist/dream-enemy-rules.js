// The Soft Dream's creatures. Three small rule sets that read like the
// clayling's: a body the player can be hurt by, a top they can land on, and a
// patrol or a fall that is a pure function of the fixed step. Nothing here
// draws; dream-enemies.js builds each body from the world's clay primitives.
//
// The player's measurements are written in here rather than imported, because
// the simulation imports this file, and the other rule sets keep to the same
// habit for the same reason.
const RADIUS=.32,HEIGHT=1.7;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const DREAM_KINDS=Object.freeze(['hatworm','blinker','drip']);
export const isDreamKind=kind=>DREAM_KINDS.includes(kind);

// A ground patroller in a stack of hats, .72 wide. Its measurements are the
// clayling's: land on it from above its shoulders and it squashes; touch its
// side and it hurts.
export const HATWORM=Object.freeze({half:.36,height:.83,stompAbove:.54,perch:.85,speed:1.5,range:1.5});
// A floating clay eye. It patrols in the air along min..max at its height,
// bobbing, and turns to watch the player. Its body is a ball from `bottom` to
// `top` above e.y; a descending player within `stompRadius` of its centre
// pops it, anyone else touching it is hurt.
export const BLINKER=Object.freeze({radius:.5,stompRadius:.6,bottom:.1,top:1.05,bob:.35,period:3.2,speed:1.4,range:1.6});
// A drop of clay hanging at (x,y). When the player passes beneath within
// `reach` it lets go and falls under the world's gravity until it meets the
// first deck below (or has fallen `fall` units into nothing); it hurts while
// it falls, lies as a harmless splat where it lands, and `period` seconds
// after letting go it hangs at its spot again. A splat can be stomped away.
export const DRIP=Object.freeze({reach:1.2,period:4,gravity:27,radius:.42,height:.9,splat:.3,fall:20});

export function initializeDreamEnemy(e){
  if(e.kind==='hatworm'){e.min??=e.x-HATWORM.range;e.max??=e.x+HATWORM.range;e.speed??=HATWORM.speed;e.x=clamp(e.x,e.min,e.max);}
  if(e.kind==='blinker'){
    e.min??=e.x-BLINKER.range;e.max??=e.x+BLINKER.range;e.speed??=BLINKER.speed;
    e.bob??=BLINKER.bob;e.period??=BLINKER.period;e.phase??=0;e.homeX=clamp(e.x,e.min,e.max);e.face=-1;
    resetDreamEnemy(e,0);
  }
  if(e.kind==='drip'){e.homeX=e.x;e.homeY=e.y;e.reach??=DRIP.reach;e.period??=DRIP.period;resetDreamEnemy(e,0);}
}
// Back to where the level put it, after a fall or a checkpoint restore. The
// hatworm, like the clayling, keeps its place on the ground.
export function resetDreamEnemy(e,time=0){
  if(!e.alive)return;
  if(e.kind==='blinker'){e.x=e.homeX;e.y=hoverY(e,time);e.dir=-1;e.face=-1;e.prevX=e.x;e.prevY=e.y;}
  if(e.kind==='drip'){e.x=e.homeX;e.y=e.homeY;e.drip='hanging';e.regrow=0;e.fallSpeed=0;e.floorId=null;e.prevX=e.x;e.prevY=e.y;}
}
const hoverY=(e,time)=>e.baseY+Math.sin(time*Math.PI*2/e.period+e.phase)*e.bob;
const flat=(s,x)=>s.y;

export function moveDreamEnemy(e,dt,time,{player:p=null,platforms=[],surfaceAt=flat}={}){
  if(e.kind==='hatworm'){
    e.x+=e.dir*e.speed*dt;
    if(e.x<e.min){e.x=e.min;e.dir=1;}if(e.x>e.max){e.x=e.max;e.dir=-1;}
  }else if(e.kind==='blinker'){
    e.x+=e.dir*e.speed*dt;
    if(e.x<=e.min){e.x=e.min;e.dir=1;}if(e.x>=e.max){e.x=e.max;e.dir=-1;}
    e.y=hoverY(e,time);
    // The eye follows the player when there is one to follow; otherwise it
    // looks where it is going.
    e.face=p&&p.health>0?(Math.sign(p.x-e.x)||e.face||e.dir):e.dir;
  }else if(e.kind==='drip'){
    if(e.drip==='hanging'){
      if(p&&p.health>0&&Math.abs(p.x-e.x)<e.reach&&p.y<e.y){e.drip='falling';e.fallSpeed=0;e.regrow=0;}
    }else if(e.drip==='falling'){
      e.regrow+=dt;
      e.fallSpeed-=DRIP.gravity*dt;
      const ny=e.y+e.fallSpeed*dt;
      // The first surface it reaches this tick: live, unbroken, under its
      // centre, no higher than where it was and no lower than where it goes.
      let floor=null,top=-Infinity;
      for(const s of platforms){
        if(s.active===false||s.broken||e.x<s.x||e.x>s.x+s.w)continue;
        const y=surfaceAt(s,e.x);
        if(y<=e.y+1e-9&&y>=ny&&y>top){top=y;floor=s;}
      }
      if(floor){e.y=top;e.drip='splat';e.floorId=floor.id;e.fallSpeed=0;}
      else if(ny<e.homeY-DRIP.fall){e.y=ny;e.drip='gone';e.fallSpeed=0;}
      else e.y=ny;
    }else{
      // Splatted or gone, it waits out its period from the moment it let go,
      // then hangs where it started. A splat lies on its deck and goes with it.
      e.regrow+=dt;
      const floor=e.drip==='splat'&&platforms.find(s=>s.id===e.floorId);
      if(floor){e.x+=floor.x-(floor.prevX??floor.x);e.y=surfaceAt(floor,e.x);}
      if(e.regrow>=e.period){e.x=e.homeX;e.y=e.homeY;e.drip='hanging';e.regrow=0;e.floorId=null;}
    }
  }
}

// The stomp bounce every stompable creature gives.
function pop(p,e,top,jumpHeld){
  e.alive=false;p.y=top+.03;p.vy=jumpHeld?12.6:9.5;p.groundId=null;p.coyote=0;p.stomping=false;p.stompWindup=0;p.springing=true;
  return 'defeat';
}
// 'defeat' when the player has just squashed it, 'hit' when its body has hurt
// them, null otherwise. Game.damage owns knockback and invulnerability.
export function contactDreamEnemy(game,e,prevY,input={}){
  const p=game.player;
  if(!e.alive)return null;
  if(e.kind==='hatworm'){
    if(Math.abs(p.x-e.x)>=HATWORM.half+RADIUS||!(p.y<e.y+HATWORM.height&&p.y+HEIGHT>e.y+.15))return null;
    if(p.vy<0&&prevY>e.y+HATWORM.stompAbove)return pop(p,e,e.y+HATWORM.perch-.03,input.jumpHeld);
    return 'hit';
  }
  if(e.kind==='blinker'){
    const top=e.y+BLINKER.top,bottom=e.y+BLINKER.bottom;
    if(p.vy<0&&prevY>=(e.prevY??e.y)+BLINKER.top-.15&&p.y<=top+.03&&Math.abs(p.x-e.x)<BLINKER.stompRadius+RADIUS)return pop(p,e,top,input.jumpHeld);
    if(Math.abs(p.x-e.x)<BLINKER.radius+RADIUS&&p.y<top&&p.y+HEIGHT>bottom)return 'hit';
    return null;
  }
  if(e.kind==='drip'){
    if(e.drip==='hanging'||e.drip==='gone'||Math.abs(p.x-e.x)>=DRIP.radius+RADIUS)return null;
    if(e.drip==='falling')return p.y<e.y+DRIP.height&&p.y+HEIGHT>e.y?'hit':null;
    // A splat is harmless; landing on it presses it away.
    const top=e.y+DRIP.splat;
    if(p.vy<0&&prevY>=(e.prevY??e.y)+DRIP.splat-.15&&p.y<=top+.03)return pop(p,e,top,input.jumpHeld);
    return null;
  }
  return null;
}
