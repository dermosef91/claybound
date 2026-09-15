import { instantiateLevel, LEVELS } from './levels.js';
import {BAT,moveEnemy,batAttacking,recoverBat,resetBat} from './enemy-rules.js';
import {contactSpore,resetSpore,sporeAttacking} from './spore-rules.js';
import {contactDrifter,resetDrifter} from './drifter-rules.js';
import {updatePress,pressTouches} from './presses.js';
import {updateCavernMachine,solidWall,solidDepth} from './cavern-machines.js';
import {resetSpitter,contactSpitter,updateShots} from './spitter-rules.js';

import {claySurface,clayWallBounds,updateShaping,stompClay} from './shaping.js';
import {bridgeOffset} from './bridge-surface.js';
import {MOTHER_PUFF,motherCinematic,motherIntroTarget,updateMotherPuff,contactMotherPuff,resetMotherPuff} from './mother-puff-rules.js';

export const FIXED_DT=1/120;
export const FLOWER_CELEBRATION_DURATION=.5;
export const RULES={speed:6.7,jump:11.8,gravity:27,radius:.32,height:1.7,maxHealth:3};
const approach=(v,t,d)=>v<t?Math.min(t,v+d):Math.max(t,v-d);
export const surfaceAt=(s,x,previous=false)=>s.shape?claySurface(s,x,previous):(previous?s.prevY:s.y)+(s.kind==='bridge'?bridgeOffset(s,x-(previous?s.prevX:s.x)):s.kind==='balance'?Math.sin(previous?s.prevAngle:s.angle)*(x-(previous?s.prevX:s.x)-s.w/2):0);

export class Game {
  constructor(onEvent=()=>{}) {this.onEvent=onEvent;this.status='menu';this.load(0);this.status='menu';}
  event(type,data={}) {this.onEvent({type,...data});}
  load(index,source) {
    this.index=index;this.level=instantiateLevel(index,source);this.time=0;this.elapsed=0;this.coins=0;this.stamps=0;
    this.shots=[];this.shotSerial=0;this.flowerCelebration=null;
    this.deaths=0;this.channels={a:0,b:0};this.latched={};this.channelDurations={};this.activeChannel=null;this.sectionId=0;this.checkpoint={...this.level.spawn};this.checkpointId='start';this.activatedCheckpoints=new Set();
    for(const s of this.level.platforms)if(s.channel){this.channels[s.channel]=0;if(s.kind==='switch')this.channelDurations[s.channel]=s.duration||10;}
    const ground=this.level.platforms.find(p=>this.level.spawn.x>=p.x&&this.level.spawn.x<=p.x+p.w&&Math.abs(p.y-this.level.spawn.y)<.2);
    this.respawnTimer=0;this.player={...this.level.spawn,vx:0,vy:0,facing:1,health:RULES.maxHealth,invuln:0,coyote:ground?.135:0,jumpBuffer:0,groundId:ground?.id??null,stomping:false,springing:false,squash:0,skidding:false,stride:0,stompWindup:0,stunTime:0,sporeGrace:0};
    this.status='playing';this.event('level',{index});
  }
  pause() {if(this.status==='playing'){this.status='paused';this.event('pause');}}
  resume() {if(this.status==='paused'){this.status='playing';this.event('resume');}}
  start(index=0,source) {this.load(index,source);}
  activate(channel,x,y,message){
    if(this.latched[channel])return;
    this.latched[channel]=true;this.channels[channel]=1;this.event('activate',{channel,x,y,message});
  }
  snapshot(){return {bossDefeated:this.level.boss?.state==='defeated',version:this.level.layoutVersion,index:this.index,checkpointId:this.checkpointId,activatedCheckpoints:[...this.activatedCheckpoints],elapsed:this.elapsed,deaths:this.deaths,latched:Object.keys(this.latched).filter(c=>this.latched[c]),broken:this.level.platforms.filter(s=>s.broken).map(s=>s.id),shaped:(this.level.shaping||[]).filter(s=>s.amount>.995).map(s=>s.id),coins:this.level.coins.filter(c=>c.taken).map(c=>c.id),stamps:this.level.stamps.filter(c=>c.taken).map(c=>c.id)};}
  restore(save){
    if(!save||save.version!==this.level.layoutVersion||save.index!==this.index)return false;
    const checkpoint=this.level.platforms.find(s=>s.id===save.checkpointId&&s.checkpoint);if(!checkpoint)return false;
    this.checkpoint={x:checkpoint.checkpoint,y:checkpoint.y};this.checkpointId=checkpoint.id;
    const visited=new Set(Array.isArray(save.activatedCheckpoints)?save.activatedCheckpoints:[]);visited.add(checkpoint.id);
    this.activatedCheckpoints=new Set(this.level.platforms.filter(s=>s.checkpoint&&visited.has(s.id)).map(s=>s.id));
    this.elapsed=Math.max(0,Number(save.elapsed)||0);this.deaths=Math.max(0,Number(save.deaths)||0);
    for(const name of ['coins','stamps']){const ids=new Set(Array.isArray(save[name])?save[name]:[]);this.level[name].forEach(c=>c.taken=ids.has(c.id));this[name]=this.level[name].filter(c=>c.taken).length;}
    // Clay the player already finished stays finished: a checkpoint past a
    // kneaded ramp must never resume in front of an unshaped one.
    const shaped=new Set(Array.isArray(save.shaped)?save.shaped:[]);
    for(const station of this.level.shaping||[])if(shaped.has(station.id)){station.target=1;station.amount=1;station.announced=true;}
    updateShaping(this,0,{});
    const allowed=new Set(this.level.platforms.flatMap(s=>s.releases?[s.releases]:(s.latch||s.kind==='balance')&&s.channel?[s.channel]:[]));
    for(const c of Array.isArray(save.latched)?save.latched:[])if(allowed.has(c)){this.latched[c]=true;this.channels[c]=1;}
    for(const s of this.level.platforms){
      if(s.kind==='break'&&Array.isArray(save.broken)&&save.broken.includes(s.id)){s.broken=true;s.active=false;}
      if(s.kind==='counter'&&this.latched[s.channel])s.y=s.prevY=s.baseY+s.rise;
      if(s.kind==='gate'&&this.latched[s.channel]){s.open=1;s.active=false;}
    }
    Object.assign(this.player,{...this.checkpoint,groundId:checkpoint.id,health:RULES.maxHealth,invuln:1.4,stunTime:0,sporeGrace:0,stunJumpQueued:false});
    this.shots=[];this.level.enemies.forEach(e=>{resetBat(e,this.time);resetDrifter(e,this.time);resetSpore(e);resetSpitter(e);});
    resetMotherPuff(this,save.bossDefeated===true);
    this.sectionId=this.level.sections.findLast(s=>this.player.x>=s.x)?.id||0;return true;
  }
  damage(fall=false) {
    const p=this.player;
    if((p.invuln>0&&!fall)||this.respawnTimer>0||this.flowerCelebration||motherCinematic(this.level.boss)||this.status!=='playing') return;
    p.stunTime=0;p.stunJumpQueued=false;p.sporeGrace=Math.max(p.sporeGrace||0,2);p.health--;this.event('hurt',{x:p.x,y:p.y});
    if(fall||p.health<=0) {
      this.deaths++;this.respawnTimer=.48;
      this.event('fall');
    } else {p.invuln=1.6;p.vy=6;p.vx=-p.facing*4;p.groundId=null;p.stomping=false;}
  }
  respawn() {
    this.flowerCelebration=null;
    const p=this.player;Object.assign(p,{...this.checkpoint,vx:0,vy:0,health:p.health<=0?RULES.maxHealth:Math.min(RULES.maxHealth,p.health),invuln:1.4,groundId:null,coyote:.135,jumpBuffer:0,stomping:false,springing:false,skidding:false,stride:0,stompWindup:0,dropTimer:0,dropThrough:null,stunTime:0,sporeGrace:0,stunJumpQueued:false});
    resetMotherPuff(this,this.level.boss?.state==='defeated');
    // A failed timed crossing always resets its route so the switch can be used again.
    this.level.platforms.forEach(s=>{if(s.kind==='crumble'){s.active=true;s.timer=0;}});
    this.shots=[];this.level.enemies.forEach(e=>{resetBat(e,this.time);resetDrifter(e,this.time);resetSpore(e);resetSpitter(e);});
    for(const s of this.level.platforms)if(s.kind==='ferry'){s.x=s.prevX=s.baseX;s.velocity=0;s.emptyTime=0;s.drive=0;}
    this.event('respawn');
  }
  tick(dt,input={}) {
    if(this.status!=='playing')return;
    // The flourish runs alongside gameplay; movement, hazards and the run clock continue.
    if(this.flowerCelebration){
      this.flowerCelebration.time+=dt;
      if(this.flowerCelebration.time>=FLOWER_CELEBRATION_DURATION){this.flowerCelebration=null;this.event('flower-resume');}
    }
    this.time+=dt;this.elapsed+=dt;
    const p=this.player, L=this.level;
    const previousPlayer={x:p.x,y:p.y};
    updateMotherPuff(this,dt);
    if(motherCinematic(L.boss)){
      // Keep gravity and landing live; gently bring the player beside her for
      // the recovery scene. Held buttons cannot skip or interrupt the reveal.
      const aim=L.boss.hits===3?L.boss.x-6:motherIntroTarget(L.boss);
      input={moveAxis:Math.max(-.4,Math.min(.4,(aim-p.x)*.6))};
      if(L.boss.hits===3&&Math.abs(L.boss.x-6-p.x)<.35)p.facing=1;
      p.jumpBuffer=0;p.stomping=false;p.stompWindup=0;p.motherBounce=false;
    }
    const motherPushed=(p.motherPush||0)>0;
    if(motherPushed){p.motherPush=Math.max(0,p.motherPush-dt);input={};p.jumpBuffer=0;p.stomping=false;p.stompWindup=0;}
    for(const c of Object.keys(this.channels))if(!this.latched[c])this.channels[c]=Math.max(0,this.channels[c]-dt);
    for(const wind of L.winds||[])wind.active=!wind.channel||this.channels[wind.channel]>0;
    for(const s of L.platforms) {
      s.prevX=s.x;s.prevY=s.y;s.prevAngle=s.angle;
      updateCavernMachine(s,p,this.time,dt,this.channels);
      if(s.kind==='lift'&&!s.shapeLift){
        const a=this.time*Math.PI*2/s.period+(s.phase||0);
        s.x=s.baseX+Math.sin(a)*(s.moveX||0);s.y=s.baseY+Math.sin(a)*(s.moveY||0);
      }
      if(s.kind==='counter')s.y=approach(s.y,s.baseY+(this.latched[s.channel]?s.rise:0),dt*1.8);
      if(s.kind==='timed')s.active=this.channels[s.channel]>0;
      if(s.kind==='pulse'){const phase=((this.time/(s.period||4.8)+(s.phase||0))%1+1)%1;s.active=phase<(s.duty||.76);s.warning=s.active?phase>(s.duty||.76)-.14:phase>.9;}
      if(s.kind==='balance'){
        s.angle=approach(s.angle,p.groundId===s.id?Math.max(-.14,Math.min(.14,-(p.x-s.x-s.w/2)*.065)):0,dt*.28);
        if(s.channel&&!this.latched[s.channel]){
          s.charge=s.angle<-.075&&p.groundId===s.id?Math.min(1,s.charge+dt/.65):Math.max(0,s.charge-dt);
          if(s.charge>=1)this.activate(s.channel,s.x+s.w-.7,s.y,'Ropeway raised · the counterweight is locked');
        }
      }
      if(s.kind==='crumble'&&s.timer>0) {
        s.timer+=dt;
        if(s.timer>(s.delay||.62)&&s.active){s.active=false;this.event('crumble-collapse',{platformId:s.id,x:s.x+s.w/2,y:s.y,w:s.w});}
        if(s.timer>3.8){s.timer=0;s.active=true;}
      }
    }
    updateShaping(this,dt,input);
    for(const c of L.crushers||[])updatePress(c,dt,this.channels,L.platforms,(type,data)=>this.event(type,data));
    const wasStunned=p.stunTime>0;
    if(wasStunned&&input.jumpPressed)p.stunJumpQueued=true;
    p.stunTime=Math.max(0,(p.stunTime||0)-dt);p.sporeGrace=Math.max(0,(p.sporeGrace||0)-dt);
    let canStart=!L.enemies.some(e=>batAttacking(e)||sporeAttacking(e));
    for(const e of L.enemies){
      moveEnemy(e,dt,this.time,{player:this.respawnTimer>0?null:p,platforms:L.platforms,winds:L.winds,canStart,shots:this.shots,nextShotId:()=>this.shotSerial++,onEvent:(type,data)=>this.event(type,data)});
      if(batAttacking(e)||sporeAttacking(e))canStart=false;
    }
    if(this.respawnTimer>0){this.respawnTimer-=dt;if(this.respawnTimer<=0)this.respawn();return;}
    if(p.stunTime>0)input={};
    else if(wasStunned&&p.stunJumpQueued){input={...input,jumpPressed:!!input.jumpHeld};p.stunJumpQueued=false;}
    p.invuln=Math.max(0,p.invuln-dt);p.squash=approach(p.squash,0,dt*3.8);p.dropTimer=Math.max(0,(p.dropTimer||0)-dt);
    const oldGround=L.platforms.find(s=>s.id===p.groundId&&s.active);
    if(oldGround){
      const previousFoot=surfaceAt(oldGround,p.x,true);
      if(oldGround.shape){const u=(p.x-oldGround.prevX)/(oldGround.prevW||oldGround.w);p.x=oldGround.x+u*oldGround.w;p.y+=surfaceAt(oldGround,p.x)-previousFoot;}
      else {p.x+=oldGround.x-oldGround.prevX;p.y+=surfaceAt(oldGround,p.x)-surfaceAt(oldGround,p.x,true);}
      p.coyote=.135;
    }
    else {p.groundId=null;p.coyote=Math.max(0,p.coyote-dt);}
    if(p.stunTime>0)p.jumpBuffer=0;
    p.jumpBuffer=input.jumpPressed ? .16 : Math.max(0,p.jumpBuffer-dt);
    const axis=Number.isFinite(input.moveAxis)?Math.max(-1,Math.min(1,input.moveAxis)):(input.right?1:0)-(input.left?1:0);
    if(Math.abs(axis)>.08)p.facing=Math.sign(axis);
    const reversing=Math.abs(axis)>.1&&Math.sign(axis)!==Math.sign(p.vx)&&Math.abs(p.vx)>1;
    const skidding=!!p.groundId&&reversing&&Math.abs(p.vx)>3;
    if(skidding&&!p.skidding)this.event('skid',{x:p.x,y:p.y});p.skidding=skidding;
    const accel=p.groundId?(reversing?110:68):(reversing?58:42);
    let windX=0,windY=0;
    for(const wind of L.winds||[])if(wind.active&&p.x>wind.x&&p.x<wind.x+wind.w&&p.y+RULES.height>wind.y&&p.y<wind.y+wind.h){const strength=wind.gust?.35+.65*(.5+.5*Math.sin(this.time*1.3+wind.phase)):1;windX+=wind.fx*strength;windY+=wind.fy*strength;}
    p.windX=windX;p.windY=windY;
    p.vx=approach(p.vx,axis*RULES.speed*(p.stomping?.45:1)*(p.sporeSlow?MOTHER_PUFF.slow:1)+windX*(p.groundId?.025:.16),dt*(Math.abs(axis)>.01?accel:(p.groundId?80:10)));
    if(motherPushed)p.vx=-13;
    if(p.jumpBuffer>0&&p.coyote>0) {
      p.vy=RULES.jump;p.groundId=null;p.coyote=0;p.jumpBuffer=0;p.stomping=false;p.springing=false;p.squash=-.12;p.stompWindup=0;
      this.event('jump',{x:p.x,y:p.y});
    }
    if(input.stompPressed&&oldGround?.kind==='ledge'){
      p.dropThrough=oldGround.id;p.dropTimer=.28;p.groundId=null;p.coyote=0;p.vy=-4;
    }else if(input.stompPressed&&!p.groundId&&!p.stomping&&p.y>-.5) {
      p.stomping=true;p.springing=false;p.stompWindup=.05;p.vy=1;p.vx*=.6;this.event('stomp',{x:p.x,y:p.y});
    }
    const prevY=p.y,prevX=p.x;
    const apex=!windY&&!p.springing&&!p.stomping&&input.jumpHeld&&Math.abs(p.vy)<2 ? .72 : 1;
    p.vy-=RULES.gravity*dt*(p.vy>0&&!input.jumpHeld&&!p.springing?2.05:(!p.springing&&p.vy<0?1.08:apex));
    if(!p.groundId&&!p.stomping)p.vy+=windY*dt;
    if(p.stompWindup>0){p.stompWindup-=dt;p.vy=p.stompWindup>0?1:-24;}
    p.vy=Math.max(-26,p.vy);
    p.x=Math.max(-6,p.x+p.vx*dt);p.y+=p.vy*dt;
    p.groundId=null;
    // Wall blocks occupy their full rectangle. Resolve horizontal travel
    // against the previous height, then stop rising heads at the underside.
    // Swept edges also catch narrow blocks at high movement speeds.
    for(const s of L.platforms)if(s.kind==='wall'&&solidWall(s)){
      const bottom=s.y-solidDepth(s),left=s.x-RULES.radius,right=s.x+s.w+RULES.radius;
      if(prevY<s.y-1e-7&&prevY+RULES.height>bottom+1e-7){
        if(prevX<=left&&p.x>left){p.x=left;p.vx=Math.min(0,p.vx);}
        else if(prevX>=right&&p.x<right){p.x=right;p.vx=Math.max(0,p.vx);}
        else if(p.x>left&&p.x<right){
          p.x=prevX<(left+right)/2?left:right;p.vx=0;
        }
      }
    }
    for(const s of L.platforms)if(s.kind==='wall'&&solidWall(s)&&p.x+RULES.radius>s.x&&p.x-RULES.radius<s.x+s.w){
      const bottom=s.y-solidDepth(s);
      if(p.vy>0&&prevY+RULES.height<=bottom+1e-7&&p.y+RULES.height>=bottom){p.y=bottom-RULES.height;p.vy=0;p.springing=false;}
    }
    if((oldGround?.kind==='balance'||oldGround?.kind==='bridge'||oldGround?.shape)&&p.vy<=0&&p.x>oldGround.x&&p.x<oldGround.x+oldGround.w)p.y=(oldGround.shape||oldGround.kind==='bridge')?surfaceAt(oldGround,p.x):Math.min(p.y,surfaceAt(oldGround,p.x));
    const candidates=L.platforms.filter(s=>s.active&&!s.broken&&!(p.dropTimer>0&&p.dropThrough===s.id)&&p.x+RULES.radius>s.x&&p.x-RULES.radius<s.x+s.w&&prevY>=surfaceAt(s,p.x,true)-(s.kind==='spring'&&oldGround ? .55 : .14)&&p.y<=surfaceAt(s,p.x)+.03&&p.vy<=Math.max(0,(surfaceAt(s,p.x)-surfaceAt(s,p.x,true))/dt)).sort((a,b)=>surfaceAt(b,p.x)-surfaceAt(a,p.x));
    if(candidates.length) {
      const s=candidates[0],impact=p.vy;
      if(s.kind==='break'&&p.stomping) {
        s.broken=true;s.active=false;this.event('break',{platformId:s.id,w:s.w,x:p.x,y:s.y,spore:L.biome==='forest'});p.vy=-14;p.stomping=false;
        if(s.releases)this.activate(s.releases,p.x,s.y,'The roots are breathing · follow the rising spores');
      } else {
        if(s.shape&&p.stomping)stompClay(this,s);
        p.y=surfaceAt(s,p.x);p.vy=0;p.groundId=s.id;p.coyote=.135;p.springing=false;
        if(impact<-2){p.squash=Math.min(.4,-impact*.019);this.event('land',{x:p.x,y:p.y,strong:p.stomping,impact:-impact});}
        if(s.kind==='spring') {
          p.vy=(input.jumpHeld?18.7:17.6)+(p.stomping?1.7:0);p.groundId=null;p.coyote=0;p.squash=.34;p.springing=true;
          this.event('spring',{platformId:s.id,x:p.x,y:p.y});
        }
        if(s.kind==='crumble'&&!s.timer){s.timer=.001;this.event('crumble',{platformId:s.id,x:s.x+s.w/2,y:s.y,w:s.w});}
        if(s.kind==='switch'&&s.latch)this.activate(s.channel,p.x,p.y,L.biome==='cave'?'Passage unlocked':'Windwell open · ride the rising ribbons');
        else if(s.kind==='switch') {
          const duration=s.duration||10;
          if(this.channels[s.channel]<duration-1.5)this.event('switch',{x:p.x,y:p.y,channel:s.channel,duration});
          this.channels[s.channel]=duration;this.channelDurations[s.channel]=duration;this.activeChannel=s.channel;
          L.platforms.filter(b=>b.kind==='timed'&&b.channel===s.channel).forEach(b=>b.active=true);
        }
        p.stomping=false;p.stompWindup=0;
      }
    }
    if(p.groundId&&Math.abs(p.vx)>.8){p.stride+=Math.abs(p.vx)*dt;if(p.stride>.86){p.stride=0;const ground=L.platforms.find(s=>s.id===p.groundId);this.event('step',{x:p.x-p.facing*.13,y:p.y,platformId:p.groundId,surface:ground?.kind});}}
    // Tall solid towers have sides; ledges and rope decks can be jumped through.
    for(const s of L.platforms)if(s.kind!=='wall'&&(solidWall(s)||s.shape)&&p.y<(s.shape?surfaceAt(s,p.x):s.y)-.12&&p.y+RULES.height>s.y-(s.shape?s.h:solidDepth(s))){
      const bounds=s.shape?clayWallBounds(s,p.y+RULES.height):{left:s.x,right:s.x+s.w};
      if(p.x+RULES.radius>bounds.left&&p.x-RULES.radius<bounds.right){
        const mid=(bounds.left+bounds.right)/2;
        if(p.x<mid){p.x=bounds.left-RULES.radius;p.vx=Math.min(0,p.vx);}else {p.x=bounds.right+RULES.radius;p.vx=Math.max(0,p.vx);}
      }
    }
    for(const s of L.platforms)if(s.checkpoint&&Math.abs(p.x-s.checkpoint)<1&&Math.abs(p.y-s.y)<.3&&this.checkpointId!==s.id) {
      this.checkpoint={x:s.checkpoint,y:s.y};this.checkpointId=s.id;this.activatedCheckpoints.add(s.id);p.health=RULES.maxHealth;
      this.event('checkpoint',{x:s.checkpoint,y:s.y,platformId:s.id});
    }
    const section=L.sections?.findLast(s=>p.x>=s.x);
    if(section&&section.id!==this.sectionId){this.sectionId=section.id;this.event('section',{section});}
    for(const c of L.coins)if(!c.taken&&Math.hypot(p.x-c.x,p.y+.65-c.y)<.8){c.taken=true;this.coins++;this.event('coin',{x:c.x,y:c.y});}
    for(const c of L.stamps)if(!c.taken&&Math.hypot(p.x-c.x,p.y+.8-c.y)<.9){
      c.taken=true;this.stamps++;this.flowerCelebration={id:c.id,time:0};
      this.event('stamp',{x:c.x,y:c.y,id:c.id});
      // Collection is a presentation event. Keep the active jump state and
      // finish the simulation tick normally, while collecting at most one flower.
      break;
    }
    for(const e of L.enemies)if(e.alive&&e.kind==='bat'){
      const top=e.y+BAT.top,above=prevY>=(e.prevY??e.y)+BAT.top-.18;
      // Swept top crossing catches a fast stomp even if it traverses the
      // entire body in one tick. Inner wings extend the safe landing window.
      if(p.vy<0&&above&&p.y<=top+.03&&Math.abs(p.x-e.x)<BAT.stompRadius+RULES.radius){
        e.alive=false;p.y=top+.03;p.vy=input.jumpHeld?12.6:9.5;p.groundId=null;p.coyote=0;p.stomping=false;p.stompWindup=0;p.springing=true;
        this.event('squish',{x:e.x,y:e.y+.45,kind:'bat'});
      }else if(Math.abs(p.x-e.x)<BAT.bodyRadius+RULES.radius&&p.y<top&&p.y+RULES.height>e.y+BAT.bottom){
        const health=p.health;this.damage();if(p.health<health)recoverBat(e);
      }
    }
    for(const e of L.enemies)if(e.alive&&e.kind==='drifter'){
      const contact=contactDrifter(p,e,prevY,RULES,input.jumpHeld);
      if(contact==='defeat')this.event('squish',{x:e.x,y:e.y,kind:'drifter'});
      else if(contact==='hit'){
        const health=p.health;this.damage();
        if(p.health<health){e.bump=.22;e.rest=.18;}
      }
    }
    for(const e of L.enemies)if(e.alive&&e.kind==='spore'){
      const contact=contactSpore(p,e,prevY,RULES,input.jumpHeld);
      if(contact==='defeat')this.event('squish',{x:e.x,y:e.y+.65,kind:'spore'});
      else if(contact==='hit'){const health=p.health;this.damage();if(p.health<health){e.leapVX*=.15;e.cooldown=3;}}
    }
    for(const e of L.enemies)if(e.alive&&e.kind==='spitter'){
      const contact=contactSpitter(p,e,prevY,input.jumpHeld);
      if(contact==='defeat')this.event('squish',{x:e.x,y:e.y+.6,kind:'spitter'});
      else if(contact==='hit')this.damage();
    }
    contactMotherPuff(this,previousPlayer,input,RULES);
    updateShots(this,dt,previousPlayer);
    for(const e of L.enemies)if(e.alive&&!['bat','drifter','spore','spitter'].includes(e.kind)&&Math.abs(p.x-e.x)<.72&&p.y<e.y+.83&&p.y+RULES.height>e.y+.15){
      if(p.vy<0&&prevY>e.y+.54){e.alive=false;p.y=e.y+.85;p.vy=input.jumpHeld?12.6:9.5;p.groundId=null;p.stomping=false;p.springing=true;this.event('squish',{x:e.x,y:e.y,kind:'clayling'});}
      else this.damage();
    }
    for(const h of L.hazards)if(p.x+.2>h.x&&p.x-.2<h.x+h.w&&p.y<h.y+.7&&p.y+RULES.height>h.y-.4)this.damage(true);
    for(const c of L.crushers||[])if(pressTouches(c,p,RULES,prevY))this.damage(true);
    if(p.y<-7||p.y<this.checkpoint.y-13)this.damage(true);
    if(p.x>L.end&&p.y>=L.platforms.find(s=>s.goal).y-.1&&(!L.boss||L.boss.state==='defeated')){
      this.status='complete';this.event('complete',{index:this.index,coins:this.coins,stamps:this.stamps,time:this.elapsed,deaths:this.deaths});
    }
  }
}
