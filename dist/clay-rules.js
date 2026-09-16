// Experimental clay behaviours, kept out of shaping.js on purpose: a chapter
// station has no `rule`, so none of this can reach the campaign. These are the
// ideas that ask what clay does beyond holding a shape you pushed it into —
// it sags under weight and keeps the sag, it wears thin where you keep walking,
// it stores the energy you press into it, and it takes an impression.
//
// Every rule is a pure function of the station, the player and dt, so the whole
// set can be driven headlessly.
import {clampShape} from './shaping.js';

export const RULES=Object.freeze(['sag','wear','catapult','stamp']);
export const isRule=name=>RULES.includes(name);

// How fast any amount chases its target. Matches the hand-worked rate in
// shaping.js so ruled clay never feels like a different material.
export const CHASE=.9;

// Stations whose parts move independently carry an amount each. Everything
// else keeps the single amount the chapters use.
export const perPart=station=>station.rule==='stamp';

export function initializeRule(station){
  if(!station.rule)return;
  if(!isRule(station.rule))throw new Error(`Unknown clay rule: ${station.rule}`);
  if(perPart(station)){
    station.amounts=station.parts.map(()=>0);
    station.targets=station.parts.map(()=>0);
  }
  station.charge=0;station.standing=false;station.crossings=0;station.launched=0;
}

// The shared chase, per part where a station has parts that move apart.
export function stepAmounts(station,dt){
  if(!perPart(station))return false;
  for(let i=0;i<station.amounts.length;i++){
    const target=station.targets[i],amount=station.amounts[i];
    station.amounts[i]=amount+Math.sign(target-amount)*Math.min(Math.abs(target-amount),dt*CHASE);
  }
  // The station as a whole is only finished when its slowest part is, which is
  // what the checkpoint save and the "shaped" announcement both want to know.
  station.amount=Math.min(...station.amounts);
  station.target=Math.min(...station.targets);
  return true;
}

export const partAmount=(station,index)=>perPart(station)?station.amounts[index]:station.amount;

// Which of a station's parts the player is standing on, or -1.
export function standingOn(station,player){
  return station.parts.indexOf(player.groundId);
}

// A stomp lands on one piece of clay. A stamping station raises only that
// piece; every other rule takes the press across the whole station.
export function stompRule(station,partIndex){
  if(!station.rule)return false;
  if(perPart(station)){
    if(partIndex<0)return false;
    station.targets[partIndex]=1;return true;
  }
  station.target=clampShape(station.target+.5);return true;
}

// One tick of a ruled station. Returns true when it has taken charge of the
// station's target, so the ordinary hold-to-shape input is left alone.
export function applyRule(game,station,dt,{near=false}={}){
  const p=game.player,index=standingOn(station,p),on=index>=0;
  const arrived=on&&!station.standing;
  station.standing=on;

  if(station.rule==='sag'){
    // Weight is the tool. Standing on the beam pushes it down, and it keeps
    // every millimetre — you sculpt the crossing by walking it, and you can
    // absolutely sink it past the point of climbing back out.
    if(on)station.target=clampShape(station.target+dt*(station.rate??.55));
    return true;
  }

  if(station.rule==='wear'){
    // Thin clay remembers. Each fresh arrival takes a share of its thickness.
    if(arrived)station.crossings=(station.crossings||0)+1;
    const uses=Math.max(1,station.uses??3),worn=(station.crossings||0)/uses;
    // The last crossing does not take the span the instant a boot touches it:
    // it gives way underfoot over about a second, so a player who reads how thin
    // it has become and runs can still make the far side. Stepping off stops the
    // tearing where it is, which is the only mercy the span offers.
    if(worn>=1){if(on)station.target=clampShape(station.target+dt*(station.give??.3));}
    else station.target=clampShape(Math.max(station.target,worn));
    return true;
  }

  if(station.rule==='catapult'){
    // Compression you can feel: every stomp packs the lump tighter, and the
    // moment it cannot take another it throws back whatever is standing on it.
    if(station.amount>=.999&&on&&!(station.launched>0)){
      p.vy=station.launch??19;p.groundId=null;p.coyote=0;p.springing=true;p.stomping=false;p.stompWindup=0;
      // Let the lump swell back at its own pace rather than snapping: a surface
      // that leaps a unit in one tick is moving upward faster than the launch,
      // and the landing check catches the player straight back onto it.
      station.launched=.35;station.target=0;
      game.event('spring',{platformId:station.parts[index],x:p.x,y:p.y});
      return true;
    }
    station.launched=Math.max(0,(station.launched||0)-dt);
    // Packed clay only relaxes with nobody on it. Relaxing underfoot would bleed
    // the charge faster than a stomp could top it up, and the lump could never
    // reach the point of throwing anyone at all.
    if(!on)station.target=clampShape(station.target-dt*(station.relax??.22));
    return true;
  }

  if(station.rule==='stamp'){
    // The print of your own landing is the step. Nothing rises until you put
    // your weight through it, so the staircase is exactly where you stamped.
    return true;
  }
  return false;
}
