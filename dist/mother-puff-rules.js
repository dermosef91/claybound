import {initializeEnemy} from './enemy-rules.js';

// All encounter state is plain data, so saves, pause and deterministic replays
// use the same simulation as keyboard/touch play. Y always means the feet.
export const MOTHER_PUFF={height:6.4,friendlyHeight:6,capRadius:2.7,bodyRadius:2.55,hits:3,
  reveal:5.8,shotGap:1.4,recover:.5,hurt:2.1,flight:1.85,
  bounce:23,padHeight:.46,capLife:12,cloudLife:5.5,blastLife:.65,slow:.73,maxChildren:3};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const enter=(b,state)=>{b.state=state;b.stateTime=0;};
const combat=b=>b&&['inhale','release','recover','hurt'].includes(b.state);
export const motherCinematic=b=>!!b&&(b.state==='reveal'||b.hits===3&&b.state!=='defeated');
export const motherQuiet=b=>!!b&&['veil','transform'].includes(b.state);
export const motherIntroTarget=b=>b.left+(b.x-b.left)*.43;
export const motherCapHeight=b=>[7.25,7.0,6.8,6.4][b.hits];
export const motherCorrupted=game=>!!game.level.boss&&game.level.boss.state!=='defeated'&&(game.level.boss.state!=='sleeping'||game.player.x>=game.level.boss.triggerX);
const ENDING=[['veil',1.5],['transform',1.8],['reveal-form',2.6],['regard',1.7],['farewell',1.8],['bloom',3.6]];

export function initializeMotherPuff(L){
  if(!L.boss||L.boss.kind!=='mother-puff')return;
  Object.assign(L.boss,{state:'sleeping',stateTime:0,hits:0,cycle:0,serial:0,spores:[],patches:[],queue:[],nextShot:0,lastShotTime:-100,healing:0});
}
export function resetMotherPuff(game,defeated=false){
  const b=game.level.boss;if(!b)return;
  // IDs never repeat during a level instance: a streamed child view cannot
  // accidentally be rebound to an enemy from a different attempt.
  const serial=b.serial;initializeMotherPuff(game.level);b.serial=serial;
  game.level.enemies=game.level.enemies.filter(e=>!e.motherChild);
  game.player.motherBounce=false;game.player.motherPush=0;game.player.sporeSlow=0;
  if(defeated){b.hits=MOTHER_PUFF.hits;enter(b,'defeated');b.healing=1;}
  game.level.dynamicRevision=(game.level.dynamicRevision||0)+1;
}

function prepareVolley(game){
  const b=game.level.boss;
  // Hazards aim independently. The orange launch pad ends each spree and
  // always lands within bouncing distance of the crown.
  const flip=b.cycle%2;
  const sequence=['purple','white','green','purple','white','purple','green','white','purple'];
  if(flip)sequence.reverse();
  sequence.push('orange');
  b.queue=sequence;

  b.nextShot=0;b.cycle++;
}
function launchOne(game){
  const b=game.level.boss,color=b.queue.shift(),x=color==='orange'?b.x-5.9:game.player.x,y=b.y+motherCapHeight(b)-.35;
  b.spores.push({id:++b.serial,color,x:b.x,y,startX:b.x,startY:y,targetX:x,targetY:b.y,age:0,duration:MOTHER_PUFF.flight});
  b.lastShotTime=game.time;
  game.event('mother-release',{x:b.x,y,color});
}
function beginSpree(game){enter(game.level.boss,'release');prepareVolley(game);}

export function motherSporePosition(s,progress){
  const t=clamp(progress,0,1),u=1-t,a=3*u*u*t,c=3*u*t*t,end=t*t*t;
  // A steep upward launch rounds into a high arc, then falls onto the
  // release-time ground marker. Later movement cannot steer a flying spore.
  return {x:s.startX+(s.targetX-s.startX)*(a*.12+c*.62+end),
    y:s.startY+(s.targetY-s.startY)*end+a*3.8+c*5.4};
}

function puff(game,s){
  const b=game.level.boss,color=s.color;
  const life=color==='orange'?MOTHER_PUFF.capLife:color==='white'?MOTHER_PUFF.cloudLife:color==='purple'?MOTHER_PUFF.blastLife:1;
  b.patches.push({id:s.id,color,x:s.targetX,y:s.targetY,age:0,life,radius:color==='white'?2.6:color==='purple'?2.15:1.55,bounceAge:10});
  if(color==='green'&&game.level.enemies.filter(e=>e.motherChild&&e.alive).length<MOTHER_PUFF.maxChildren){
    const e={kind:'spore',motherChild:true,x:s.targetX,y:s.targetY,min:Math.max(b.left+.7,s.targetX-3),max:Math.min(b.right-.7,s.targetX+3),speed:.8};
    initializeEnemy(e,'mother-child-'+(++b.serial),game.level.platforms);e.cooldown=2;
    game.level.enemies.push(e);game.level.dynamicRevision=(game.level.dynamicRevision||0)+1;
  }
  game.event('mother-puff',{x:s.targetX,y:s.targetY,color});
}
export function updateMotherPuff(game,dt){
  const b=game.level.boss,p=game.player;p.sporeSlow=0;if(!b||game.respawnTimer>0)return;
  if(b.state==='sleeping'){
    if(p.x>=b.triggerX&&p.y>=b.y-1&&p.y<=b.y+14){enter(b,'reveal');game.event('mother-wake',{x:b.x,y:b.y});}
    else return;
  }
  if(b.state==='defeated'){b.stateTime+=dt;return;}
  b.stateTime+=dt;
  if(b.hits===3){
    const i=ENDING.findIndex(([name])=>name===b.state);
    if(i>=0&&b.stateTime>=ENDING[i][1]){
      enter(b,ENDING[i+1]?.[0]||'defeated');
      if(b.state==='reveal-form'||b.state==='regard'||b.state==='farewell')game.event('mother-friendly',{x:b.x,y:b.y+1.2});
      if(b.state==='bloom')game.event('mother-bloom',{x:b.x,y:b.y});
      if(b.state==='defeated')game.event('mother-defeat',{x:b.x,y:b.y});
    }
    b.healing=b.state==='defeated'?1:b.state==='bloom'?clamp(b.stateTime/3.1,0,1):0;
    return;
  }
  if(b.state==='reveal'&&b.stateTime>=MOTHER_PUFF.reveal){beginSpree(game);game.event('mother-open',{x:b.x,y:b.y});}
  else if(b.state==='inhale')beginSpree(game);
  else if(b.state==='recover'&&b.stateTime+1e-6>=MOTHER_PUFF.recover)beginSpree(game);
  else if(b.state==='hurt'&&b.stateTime>=MOTHER_PUFF.hurt)beginSpree(game);
  if(b.state==='release')while(b.queue.length&&b.stateTime+1e-6>=b.nextShot){
    launchOne(game);b.nextShot+=MOTHER_PUFF.shotGap;
    if(!b.queue.length)enter(b,'recover');
  }
  for(const s of b.spores){
    s.age+=dt;const t=Math.min(1,s.age/s.duration);
    Object.assign(s,motherSporePosition(s,t));
    if(s.age>=s.duration)puff(game,s);
  }
  b.spores=b.spores.filter(s=>s.age<s.duration);
  for(const patch of b.patches){
    patch.age+=dt;patch.bounceAge+=dt;
    if(patch.color==='white'&&Math.abs(p.x-patch.x)<patch.radius&&p.y<patch.y+3&&p.y+1.7>patch.y)p.sporeSlow=1;
  }
  b.patches=b.patches.filter(s=>s.age<s.life);
  // Repeated volleys cannot accumulate dead minions or unlimited effects.
  const before=game.level.enemies.length;
  game.level.enemies=game.level.enemies.filter(e=>!e.motherChild||e.alive);
  if(game.level.enemies.length!==before)game.level.dynamicRevision=(game.level.dynamicRevision||0)+1;
}

export function contactMotherPuff(game,previous,input,rules){
  const b=game.level.boss,p=game.player;if(!b||['sleeping','defeated'].includes(b.state)||game.respawnTimer>0)return;
  // Invisible encounter bounds keep the action on her left, without scenery gates.
  const nx=clamp(p.x,b.left+rules.radius,combat(b)?b.x:b.right-rules.radius);
  if(nx!==p.x){p.x=nx;p.vx=0;}
  if(!combat(b))return;
  const top=b.y+motherCapHeight(b);
  if(p.vy<0&&previous.y>=top-.12&&p.y<=top+.03&&Math.abs(p.x-b.x)<MOTHER_PUFF.capRadius){
    const hit=b.state!=='hurt';
    p.y=top+.04;p.vy=9;p.groundId=null;p.coyote=0;p.springing=true;p.stomping=false;p.stompWindup=0;
    if(hit){
      b.hits++;p.motherBounce=false;p.motherPush=.85;p.vx=-13;p.facing=-1;b.spores=[];b.patches=[];b.queue=[];
      game.level.enemies=game.level.enemies.filter(e=>!e.motherChild);
      game.level.dynamicRevision=(game.level.dynamicRevision||0)+1;
      enter(b,b.hits===MOTHER_PUFF.hits?'veil':'hurt');
      game.event(b.state==='veil'?'mother-collapse':'mother-hit',{x:b.x,y:top,hits:b.hits});
    }else game.event('mother-cap',{x:b.x,y:top});
    return;
  }
  // Her soft body is stationary and solid. Damage comes from spores/children.
  if(p.y<top-1&&p.y+rules.height>b.y&&Math.abs(p.x-b.x)<MOTHER_PUFF.bodyRadius+rules.radius){
    p.x=b.x-(MOTHER_PUFF.bodyRadius+rules.radius);p.vx=0;
  }
  for(const s of b.patches){
    if(s.color==='orange'){
      const cap=s.y+MOTHER_PUFF.padHeight;
      if(Math.abs(p.x-s.x)<s.radius&&p.vy<=0&&previous.y>=cap-(p.groundId?1:.14)&&p.y<=cap+.04&&p.y>=s.y-.2){
        p.y=cap;p.vy=MOTHER_PUFF.bounce;p.groundId=null;p.coyote=0;p.springing=true;p.stomping=false;p.stompWindup=0;p.motherBounce=true;p.squash=.32;s.bounceAge=0;
        game.event('mother-bounce',{x:p.x,y:p.y});
      }
    }else if(s.color==='purple'&&s.age<.32&&Math.abs(p.x-s.x)<s.radius&&p.y<s.y+2.3&&p.y+rules.height>s.y){
      const health=p.health;game.damage();
      if(p.health<health){p.vx=(Math.sign(p.x-s.x)||-1)*10;p.vy=8;p.motherBounce=false;}
    }
  }
  if(p.groundId)p.motherBounce=false;
}
