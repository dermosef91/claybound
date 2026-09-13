import {BAT} from './enemy-rules.js';
import {DRIFTER} from './drifter-rules.js';
export const DRAFT_KEY='claybound-editor-v1';
export const KINDS={stone:'Solid cliff',wall:'Wall block',ledge:'Thin ledge',bridge:'Rope bridge',lift:'Rope lift',spring:'Spring / mushroom',crumble:'Crumbling ledge',break:'Breakable seal',switch:'Switch',timed:'Switched bridge',pulse:'Pulse ledge',balance:'Counterweight',counter:'Counter lift',gate:'Relay grate',ferry:'Weight ferry',orbit:'Orbit cradle'};
export const LISTS=['platforms','coins','stamps','enemies','hazards','winds','crushers'];
const clone=value=>structuredClone(value);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const idOK=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,70}$/.test(value);
const finite=(n,a,b,label)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<a||n>b)throw new Error(`${label} must be between ${a} and ${b}.`);return n;};
const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(36);};

export function repairDraft(level){
  const ids=new Set(level.platforms.map(p=>p.id));
  for(const p of level.platforms){
    if(p.checkpoint!==undefined)p.checkpoint=clamp(p.checkpoint,p.x+.2,p.x+p.w-.2)||.001;
    if(p.goal){p.bellX=clamp(p.bellX??p.w/2,.4,p.w-.4);level.end=p.x+p.bellX;}
    p.section=level.sections.findLast(s=>p.x>=s.x)?.id??0;
  }
  const old=level.circuits||[];
  level.circuits=level.platforms.flatMap(source=>{
    const channel=source.kind==='break'?source.releases:source.channel;
    if(!channel||!['switch','break','balance'].includes(source.kind))return [];
    const targets=new Set();
    for(const c of old)if(c.source===source.id&&c.channel===channel)for(const id of c.targets){const p=level.platforms.find(p=>p.id===id);if(p&&id!==source.id&&(!p.channel||p.channel===channel))targets.add(id);}
    for(const p of level.platforms)if(p.id!==source.id&&p.channel===channel&&['timed','counter','pulse','gate'].includes(p.kind)&&!old.some(c=>ids.has(c.source)&&c.channel===channel&&c.targets.includes(p.id)))targets.add(p.id);
    const kind=old.find(c=>c.source===source.id&&c.channel===channel)?.kind||(source.kind==='balance'?'weight':source.releases?(level.biome==='forest'?'spore':'wind'):source.latch?'wind':'relay');
    return targets.size?[{source:source.id,channel,targets:[...targets],kind}]:[];
  });
  level.routeLinks=(level.routeLinks||[]).filter(l=>ids.has(l.from)&&ids.has(l.to));
  for(const list of ['detours','recoveries'])level[list]=(level[list]||[]).map(links=>links.filter(l=>ids.has(l.from)&&ids.has(l.to)));
  return level;
}

// Import only known gameplay fields. The original biome assets and environment
// code remain owned by the game; a draft is data, never executable content.
export function validateDraft(source,base){
  if(!source||typeof source!=='object')throw new Error('This file does not contain a level.');
  const out=clone(base),limits={platforms:260,coins:1000,stamps:30,enemies:60,hazards:150,winds:35,crushers:35};
  const nums={x:[-100,2000],y:[-40,160],w:[.6,80],h:[.6,80],moveX:[-30,30],moveY:[-30,30],period:[.5,60],phase:[-20,20],bob:[0,4],rise:[0,30],travel:[1,30],floorY:[-40,160],delay:[.15,3.5],duty:[.1,.95],duration:[1,60],fx:[-30,30],fy:[-15,25],speed:[.1,8],min:[-100,2000],max:[-100,2000],range:[.2,25],bellX:[.1,80],checkpoint:[-100,2080]};
  for(const list of LISTS){
    if(!Array.isArray(source[list])||source[list].length>limits[list])throw new Error(`Invalid ${list} list (maximum ${limits[list]}).`);
    out[list]=source[list].map((item,i)=>{
      if(!item||typeof item!=='object')throw new Error(`Invalid ${list} item.`);
      const clean={};
      for(const key of ['x','y'])clean[key]=finite(item[key],...nums[key],`${list} ${i+1}: ${key}`);
      for(const [key,bounds]of Object.entries(nums))if(!['x','y'].includes(key)&&item[key]!==undefined)clean[key]=finite(item[key],...bounds,key);
      for(const key of ['id','channel','releases','holdChannel','landmark'])if(item[key]!==undefined){if(!idOK(item[key]))throw new Error(`Invalid ${key}. Use letters, numbers and hyphens.`);clean[key]=item[key];}
      for(const key of ['goal','latch','gust','spores','arch','house','entrance','optional','recovery','rest'])if(item[key]!==undefined)clean[key]=!!item[key];
      if(list==='platforms'){
        if(!idOK(item.id)||!KINDS[item.kind])throw new Error('Every platform needs a unique ID and a supported type.');
        clean.kind=item.kind;finite(clean.w,.6,80,'Platform width');
        if(clean.kind==='lift')clean.period??=5;
        if(clean.kind==='gate')clean.h??=10;
        if(clean.kind==='wall')clean.h??=4;
        if(clean.kind==='ferry'){clean.travel??=24;clean.speed??=3.2;}
        if(clean.kind==='orbit'){clean.moveX??=4;clean.moveY??=4;clean.period??=12;}
        if(clean.kind==='counter')clean.rise??=3;
        if(clean.kind==='pulse'){clean.period??=4.8;clean.duty??=.76;}
      }
      if(list==='winds'){if(!idOK(item.id))throw new Error('Each wind area needs an ID.');clean.fx??=0;clean.fy??=18;finite(clean.w,.6,80,'Wind width');finite(clean.h,.6,80,'Wind height');}
      if(list==='hazards'||list==='crushers')finite(clean.w,.6,80,'Hazard width');
      if(list==='crushers'){clean.period??=5;clean.range??=3;}
      if(list==='enemies'){
        if(item.kind!==undefined){if(!['bat','clayling','drifter','spore','spitter'].includes(item.kind))throw new Error('Choose a clayling, flying bat, Dust Drifter Spore Puff or Echo Spitter.');clean.kind=item.kind;}
        if(clean.kind==='bat'){clean.bob??=BAT.bob;clean.period??=BAT.period;clean.min??=clean.x;clean.max??=clean.x;}
        if(clean.kind==='drifter'){clean.bob??=DRIFTER.bob;clean.period??=DRIFTER.period;clean.speed??=DRIFTER.patrolSpeed;clean.phase??=0;}
        if(clean.kind==='spitter'){clean.min??=clean.x-2;clean.max??=clean.x+2;clean.speed??=.38;}
        clean.min??=clean.x-1;clean.max??=clean.x+1;clean.speed??=1.5;
        if(clean.min>clean.max)throw new Error('Enemy patrol start must precede its end.');clean.x=clamp(clean.x,clean.min,clean.max);
      }
      return clean;
    });
  }
  for(const list of ['platforms','winds'])if(new Set(out[list].map(p=>p.id)).size!==out[list].length)throw new Error(`Duplicate IDs in ${list}.`);
  if(!out.platforms.some(p=>p.id==='start'))throw new Error('Keep the starting platform.');
  if(out.platforms.filter(p=>p.goal).length!==1)throw new Error('A chapter needs exactly one finish platform.');
  const goal=out.platforms.find(p=>p.goal);if(goal.w<2.5)throw new Error('The finish platform must be at least 2.5 units wide.');
  out.spawn={x:finite(source.spawn?.x,-100,2000,'Start X'),y:finite(source.spawn?.y,-40,160,'Start height')};
  out.custom=true;repairDraft(out);
  const content=JSON.stringify([out.spawn,...LISTS.map(k=>out[k])]);out.layoutVersion=`editor-${base.layoutVersion}-${hash(content)}`;
  return out;
}

export class DraftLibrary{
  constructor(levels,storage){
    this.levels=levels;this.storage=storage;this.drafts={};this.error='';
    try{const data=JSON.parse(storage?.getItem(DRAFT_KEY)||'{}');for(const [index,value]of Object.entries(data))if(levels[index]&&value.baseVersion===levels[index].layoutVersion){try{this.drafts[index]=validateDraft(value.level,levels[index]);}catch{this.error='An invalid draft was skipped. Import a backup to recover it.';}}}catch{this.error='Draft storage is unavailable. Export your changes to keep a copy.';}
  }
  get(index){return this.drafts[index]||this.levels[index];}
  has(index){return !!this.drafts[index];}
  persist(){
    const data=Object.fromEntries(Object.entries(this.drafts).map(([i,level])=>[i,{baseVersion:this.levels[i].layoutVersion,level}]));
    try{if(!this.storage)throw new Error();this.storage.setItem(DRAFT_KEY,JSON.stringify(data));this.error='';return true;}catch{this.error='Storage is full or unavailable. Export a backup to keep your changes.';return false;}
  }
  save(index,level){const clean=validateDraft(level,this.levels[index]);this.drafts[index]=clean;this.persist();return clean;}
  reset(index){delete this.drafts[index];this.persist();return clone(this.levels[index]);}
  export(index,level=this.get(index)){return JSON.stringify({format:'claybound-level',version:1,chapter:index,baseVersion:this.levels[index].layoutVersion,level:validateDraft(level,this.levels[index])},null,2);}
  read(text,index){
    if(text.length>1500000)throw new Error('This level file is too large.');
    let data;try{data=JSON.parse(text);}catch{throw new Error('Choose a valid Claybound JSON level file.');}
    if(data.format!=='claybound-level'||data.version!==1||data.chapter!==index)throw new Error('Open the matching chapter before importing this Claybound file.');
    if(data.baseVersion!==this.levels[index].layoutVersion)throw new Error('This backup belongs to an older level layout.');
    return validateDraft(data.level,this.levels[index]);
  }
}

export const selectedObject=(level,selection)=>!selection?null:selection.list==='spawn'?level.spawn:level[selection.list]?.[selection.index];
export const objectLabel=(obj,list)=>list==='platforms'?(KINDS[obj.kind]||'Platform'):list==='enemies'&&obj.kind==='spitter'?'Echo Spitter':list==='enemies'&&obj.kind==='spore'?'Spore Puff':list==='enemies'&&obj.kind==='bat'?'Flying bat':list==='enemies'&&obj.kind==='drifter'?'Dust Drifter':({coins:'Clay bead',stamps:'Secret flower',hazards:'Spikes',enemies:'Clayling',winds:'Wind area',crushers:'Press',spawn:'Player start'}[list]||'Object');

export class DraftSession{
  constructor(library,index){this.library=library;this.index=index;this.level=clone(library.get(index));this.selection=null;this.undoStack=[];this.redoStack=[];this.pending=null;}
  snapshot(){return {level:clone(this.level),selection:clone(this.selection)};}
  startChange(){this.pending=this.snapshot();}
  commit(){
    if(!this.pending)return false;
    const previous=this.pending;this.pending=null;repairDraft(this.level);
    if(JSON.stringify(previous.level)===JSON.stringify(this.level))return false;
    try{this.level=this.library.save(this.index,this.level);}catch(error){this.level=previous.level;this.selection=previous.selection;throw error;}
    this.undoStack.push(previous);if(this.undoStack.length>40)this.undoStack.shift();this.redoStack=[];return true;
  }
  cancel(){if(this.pending){this.level=this.pending.level;this.selection=this.pending.selection;this.pending=null;}}
  change(fn){this.startChange();try{fn(this.level);return this.commit();}catch(error){this.cancel();throw error;}}
  undo(){if(!this.undoStack.length)return;this.redoStack.push(this.snapshot());const state=this.undoStack.pop();this.level=this.library.save(this.index,state.level);this.selection=state.selection;}
  redo(){if(!this.redoStack.length)return;this.undoStack.push(this.snapshot());const state=this.redoStack.pop();this.level=this.library.save(this.index,state.level);this.selection=state.selection;}
  move(dx,dy,carry=true){
    const before=this.pending?.level;if(!before)return;
    this.level=clone(before);const obj=selectedObject(this.level,this.selection),original=selectedObject(before,this.selection);if(!obj)return;
    const translate=(p,x,y)=>{p.x+=x;p.y+=y;if(p.checkpoint!==undefined)p.checkpoint+=x;if(p.min!==undefined){p.min+=x;p.max+=x;}};
    translate(obj,dx,dy);
    if(carry&&this.selection.list==='platforms'){
      const inside=p=>p.x>=original.x-.05&&p.x<=original.x+original.w+.05;
      for(const list of ['coins','stamps','enemies'])for(let i=0;i<before[list].length;i++){
        const p=before[list][i];if(inside(p)&&p.y>=original.y-.05&&p.y<=original.y+(list==='enemies'&&!['bat','drifter'].includes(p.kind)?.15:2.2))translate(this.level[list][i],dx,dy);
      }
      before.platforms.forEach((p,i)=>{if(i!==this.selection.index&&inside(p)&&p.y>=original.y&&p.y<original.y+.4&&['switch','spring'].includes(p.kind))translate(this.level.platforms[i],dx,dy);});
      if(inside(before.spawn)&&Math.abs(before.spawn.y-original.y)<.2)translate(this.level.spawn,dx,dy);
    }
    repairDraft(this.level);
  }
  set(field,value){
    return this.change(()=>{
      const obj=selectedObject(this.level,this.selection);if(!obj)return;
      if(value===null||value==='')delete obj[field];else obj[field]=value;
      if(field==='kind'){
        if(this.selection.list==='enemies'&&value==='bat'){obj.bob??=BAT.bob;obj.period??=BAT.period;}
        if(this.selection.list==='enemies'&&value==='drifter'){obj.bob??=DRIFTER.bob;obj.period??=DRIFTER.period;}
        if(value==='lift'){obj.period??=5;obj.moveY??=1.2;}
        if(value==='counter')obj.rise??=3;
        if(value==='gate'){obj.h??=10;obj.channel??='new-circuit';}
        if(value==='wall')obj.h??=4;
        if(value==='ferry'){obj.travel??=24;obj.speed??=3.2;}
        if(value==='orbit'){obj.moveX??=4;obj.moveY??=4;obj.period??=12;}
        if(value==='pulse'){obj.period??=4.8;obj.duty??=.76;}
        if(value==='switch')obj.duration??=10;
      }
    });
  }
  add(type,x,y){
    const id=prefix=>{let i=1;while(this.level.platforms.some(p=>p.id===`${prefix}-${i}`)||this.level.winds.some(p=>p.id===`${prefix}-${i}`))i++;return `${prefix}-${i}`;};
    this.change(level=>{
      let list,obj;
      if(KINDS[type]){list='platforms';obj={id:id('clay'),x:x-2,y,w:4,kind:type};if(type==='wall')Object.assign(obj,{y:y+2,h:4});if(type==='gate')Object.assign(obj,{h:10,channel:'new-circuit'});if(type==='ferry')Object.assign(obj,{travel:24,speed:3.2});if(type==='orbit')Object.assign(obj,{moveX:4,moveY:4,period:12});if(type==='lift')Object.assign(obj,{period:5,moveY:1.2});if(type==='pulse')Object.assign(obj,{period:4.8,duty:.76});if(type==='switch')Object.assign(obj,{w:1.8,channel:'new-circuit',duration:10});if(type==='timed'||type==='counter')Object.assign(obj,{channel:'new-circuit',...(type==='counter'?{rise:3}:{})});}
      else{list=['bat','drifter','spore','spitter'].includes(type)?'enemies':type;obj={x,y};if(type==='spitter')Object.assign(obj,{kind:'spitter',min:x-2,max:x+2,speed:.38});if(type==='spore')Object.assign(obj,{kind:'spore',min:x-1,max:x+1,speed:.5});if(type==='bat')Object.assign(obj,{kind:'bat',min:x-1.6,max:x+1.6,speed:BAT.patrolSpeed,bob:BAT.bob,period:BAT.period});if(type==='drifter')Object.assign(obj,{kind:'drifter',min:x-1.5,max:x+1.5,speed:DRIFTER.patrolSpeed,bob:DRIFTER.bob,period:DRIFTER.period});if(type==='hazards')Object.assign(obj,{x:x-2,w:4});if(type==='enemies')Object.assign(obj,{min:x-1.5,max:x+1.5,speed:1.5});if(type==='winds')Object.assign(obj,{id:id('wind'),x:x-2,w:4,h:7,fx:0,fy:18});if(type==='crushers')Object.assign(obj,{w:1.8,range:3,period:5});}
      if(!LISTS.includes(list))throw new Error('Unsupported object type.');
      level[list].push(obj);this.selection={list,index:level[list].length-1};
    });
  }
  duplicate(){const obj=selectedObject(this.level,this.selection);if(!obj||this.selection.list==='spawn')return;this.change(level=>{const copy=clone(obj);copy.x+=1;copy.y+=1;if(copy.min!==undefined){copy.min+=1;copy.max+=1;}delete copy.goal;delete copy.bellX;delete copy.checkpoint;if(copy.id){let n=1;while(level[this.selection.list].some(p=>p.id===`${obj.id.slice(0,55)}-copy-${n}`))n++;copy.id=`${obj.id.slice(0,55)}-copy-${n}`;}level[this.selection.list].push(copy);this.selection={list:this.selection.list,index:level[this.selection.list].length-1};});}
  remove(){const obj=selectedObject(this.level,this.selection);if(!obj||this.selection.list==='spawn'||obj.id==='start'||obj.goal)throw new Error('Keep the player start, starting platform and finish. You can move them.');this.change(level=>{level[this.selection.list].splice(this.selection.index,1);this.selection=null;});}
}
