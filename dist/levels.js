import canyon from './routes/canyon.js';
import forest from './routes/forest.js';
import cave from './routes/cave.js';
import city from './routes/city.js';
import {initializeShaping} from './shaping.js';
import {initializeEnemy} from './enemy-rules.js';
import {initializePress} from './presses.js';
import {updateCavernMachine} from './cavern-machines.js';
import {initializeMotherPuff} from './mother-puff-rules.js';
export const LEVELS=[canyon,forest,cave,city];
export function instantiateLevel(index,source=LEVELS[index]){
  const d=structuredClone(source);
  initializeMotherPuff(d);
  d.platforms.forEach(p=>Object.assign(p,{baseX:p.x,baseY:p.y,prevX:p.x,prevY:p.y,active:p.kind!=='timed',timer:0,broken:false,angle:0,prevAngle:0,charge:0}));
  d.platforms.forEach(p=>{updateCavernMachine(p,{groundId:null},0,0,{});p.prevX=p.x;p.prevY=p.y;});
  initializeShaping(d);
  d.coins.forEach((c,i)=>Object.assign(c,{id:i,taken:false}));d.stamps.forEach((c,i)=>Object.assign(c,{id:i,taken:false}));
  d.enemies.forEach((e,id)=>initializeEnemy(e,id,d.platforms));d.crushers.forEach(c=>initializePress(c,d.platforms));return d;
}
