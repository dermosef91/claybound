import {BAT} from './enemy-rules.js';
import {DRIFTER} from './drifter-rules.js';
import {BLINKER,DRIP,HATWORM} from './dream-enemy-rules.js';
import {SINK,FOLD} from './cavern-machines.js';
import {DECOR_KINDS,DECOR_BOUNDS,DECOR_LIMIT} from './decor-kinds.js';
export const DRAFT_KEY='claybound-editor-v1';
export const KINDS={stone:'Solid cliff',wall:'Wall block',ledge:'Thin ledge',bridge:'Rope bridge',lift:'Rope lift',spring:'Spring / mushroom',crumble:'Crumbling ledge',break:'Breakable seal',switch:'Switch',timed:'Switched bridge',pulse:'Pulse ledge',balance:'Counterweight',counter:'Counter lift',gate:'Relay grate',ferry:'Weight ferry',orbit:'Orbit cradle',clay:'Kneadable clay',sink:'Sinking raft',fold:'Folding deck',dome:'Dome island'};
// Trigger zones are the one list added since the first backups were written,
// so a draft without one imports as a draft with none, and the list joins the
// content hash only when a chapter carries some — an old chapter's layout
// version, and the checkpoints hung on it, are untouched by the list existing.
export const LISTS=['platforms','coins','stamps','enemies','hazards','winds','crushers','triggers'];
const OPTIONAL_LISTS=new Set(['triggers']);
const ENEMY_KINDS=['bat','clayling','drifter','spore','spitter','hatworm','blinker','drip'];
// Decoration is edited but never played, so it stays out of LISTS: nothing that
// reads the gameplay lists — the simulation, the route repair, the content hash
// behind a chapter's layout version — should have to know it exists. Every
// backup written before this list existed still imports unchanged.
export const DECOR='decor';
export const EDIT_LISTS=[...LISTS,DECOR];
const clone=value=>structuredClone(value);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const idOK=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,70}$/.test(value);
const finite=(n,a,b,label)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<a||n>b)throw new Error(`${label} must be between ${a} and ${b}.`);return n;};
const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(36);};

export function repairDraft(level){
  level.decor??=[];
  const ids=new Set(level.platforms.map(p=>p.id));
  if(level.boss){
    const arena=level.platforms.find(p=>p.motherArena);
    if(!arena)delete level.boss;
    else Object.assign(level.boss,{x:arena.x+arena.w-6.5,y:arena.y,left:arena.x+3.5,right:arena.x+arena.w-2.5,triggerX:arena.x+4.5});
  }
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
  if(level.shaping){
    const clay=new Set(level.platforms.filter(p=>p.shape).map(p=>p.id));
    level.shaping=level.shaping.map(s=>({...s,parts:s.parts.filter(id=>clay.has(id))})).filter(s=>s.parts.length);
  }
  level.routeLinks=(level.routeLinks||[]).filter(l=>ids.has(l.from)&&ids.has(l.to));
  for(const list of ['detours','recoveries'])level[list]=(level[list]||[]).map(links=>links.filter(l=>ids.has(l.from)&&ids.has(l.to)));
  return level;
}

// Import only known gameplay fields. The original biome assets and environment
// code remain owned by the game; a draft is data, never executable content.
export function validateDraft(source,base){
  if(!source||typeof source!=='object')throw new Error('This file does not contain a level.');
  const out=clone(base),limits={platforms:260,coins:1000,stamps:30,enemies:60,hazards:150,winds:35,crushers:35,triggers:60};
  // An older imported forest has no boss clearing. Do not silently gate its
  // earlier finish bell on a boss that is outside that draft's playable path.
  if(source.boss?.kind!=='mother-puff')delete out.boss;
  const nums={x:[-100,2000],y:[-40,160],w:[.6,80],h:[.6,80],moveX:[-30,30],moveY:[-30,30],period:[.5,60],phase:[-20,20],bob:[0,4],rise:[0,30],travel:[1,30],floorY:[-40,160],delay:[.15,3.5],duty:[.1,.95],duration:[.3,60],fx:[-30,30],fy:[-15,25],speed:[.1,8],min:[-100,2000],max:[-100,2000],range:[.2,25],bellX:[.1,80],checkpoint:[-100,2080],rate:[.1,12],drop:[.1,40],conveyor:[-12,12],reach:[.2,10]};
  const oneOf=(value,choices,label)=>{if(!choices.includes(value))throw new Error(`${label} must be one of ${choices.join(', ')}.`);return value;};
  for(const list of LISTS){
    const items=source[list]??(OPTIONAL_LISTS.has(list)?[]:undefined);
    if(!Array.isArray(items)||items.length>limits[list])throw new Error(`Invalid ${list} list (maximum ${limits[list]}).`);
    out[list]=items.map((item,i)=>{
      if(!item||typeof item!=='object')throw new Error(`Invalid ${list} item.`);
      const clean={};
      for(const key of ['x','y'])clean[key]=finite(item[key],...nums[key],`${list} ${i+1}: ${key}`);
      for(const [key,bounds]of Object.entries(nums))if(!['x','y'].includes(key)&&item[key]!==undefined)clean[key]=finite(item[key],...bounds,key);
      if(list==='platforms'&&item.kind==='clay'){
        const pose=(source,label)=>{
          if(!source||typeof source!=='object')throw new Error(`Kneadable clay needs a ${label} shape.`);
          const out={};
          for(const key of ['x','y','w','h','slope'])if(source[key]!==undefined)out[key]=finite(source[key],key==='slope'?-30:nums[key][0],key==='slope'?30:nums[key][1],`${label} ${key}`);
          return out;
        };
        clean.shape={from:pose(item.shape?.from,'unshaped'),to:pose(item.shape?.to,'shaped')};
        for(const key of ['station','clayRole'])if(item[key]!==undefined){if(!idOK(item[key]))throw new Error(`Invalid ${key}.`);clean[key]=item[key];}
      }
      for(const key of ['id','channel','releases','holdChannel','landmark','waitFor'])if(item[key]!==undefined){if(!idOK(item[key]))throw new Error(`Invalid ${key}. Use letters, numbers and hyphens.`);clean[key]=item[key];}
      for(const key of ['goal','latch','gust','spores','arch','house','entrance','optional','recovery','rest','motherArena'])if(item[key]!==undefined)clean[key]=!!item[key];
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
        if(clean.kind==='sink'){clean.rate??=SINK.rate;clean.drop??=SINK.drop;}
        if(clean.kind==='fold'){
          if(!clean.channel)throw new Error('A folding deck needs the channel that turns it.');
          clean.duration??=FOLD.duration;clean.pivot=oneOf(item.pivot??'left',['left','right'],'A fold pivot');
          clean.from=oneOf(item.from??'deck',['deck','wall'],'A fold start');clean.to=oneOf(item.to??(clean.from==='deck'?'wall':'deck'),['deck','wall'],'A fold end');
        }
        // A breathing wall is data: how far and how fast it swings about its
        // authored pose. Anything the simulation reads is bounded here.
        if(item.breathe!==undefined){
          if(!item.breathe||typeof item.breathe!=='object')throw new Error(`${item.id} needs a breathe object with a period.`);
          clean.breathe={period:finite(item.breathe.period,...nums.period,'breathe period')};
          for(const key of ['dh','dx','dy','phase'])if(item.breathe[key]!==undefined)clean.breathe[key]=finite(item.breathe[key],-30,30,'breathe '+key);
        }
        if(item.tint!==undefined)clean.tint=oneOf(item.tint,['terrain'],'A clay tint');
      }
      if(list==='winds'){if(!idOK(item.id))throw new Error('Each wind area needs an ID.');clean.fx??=0;clean.fy??=18;finite(clean.w,.6,80,'Wind width');finite(clean.h,.6,80,'Wind height');}
      if(list==='hazards'||list==='crushers')finite(clean.w,.6,80,'Hazard width');
      if(list==='crushers'){clean.period??=5;clean.range??=3;}
      if(list==='triggers'){
        if(!idOK(item.channel))throw new Error('Each trigger zone needs the channel it latches.');
        clean.w=finite(item.w,.6,80,'Trigger width');clean.h=finite(item.h,.6,80,'Trigger height');
      }
      if(list==='enemies'){
        if(item.kind!==undefined){if(!ENEMY_KINDS.includes(item.kind))throw new Error('Choose a clayling, flying bat, Dust Drifter, Spore Puff, Echo Spitter, hatworm, blinker or drip.');clean.kind=item.kind;}
        if(clean.kind==='bat'){clean.bob??=BAT.bob;clean.period??=BAT.period;clean.min??=clean.x;clean.max??=clean.x;}
        if(clean.kind==='drifter'){clean.bob??=DRIFTER.bob;clean.period??=DRIFTER.period;clean.speed??=DRIFTER.patrolSpeed;clean.phase??=0;}
        if(clean.kind==='spitter'){clean.min??=clean.x-2;clean.max??=clean.x+2;clean.speed??=.38;}
        if(clean.kind==='hatworm'){clean.min??=clean.x-HATWORM.range;clean.max??=clean.x+HATWORM.range;clean.speed??=HATWORM.speed;}
        if(clean.kind==='blinker'){clean.bob??=BLINKER.bob;clean.period??=BLINKER.period;clean.min??=clean.x-BLINKER.range;clean.max??=clean.x+BLINKER.range;clean.speed??=BLINKER.speed;}
        if(clean.kind==='drip'){clean.reach??=DRIP.reach;clean.period??=DRIP.period;clean.min??=clean.x;clean.max??=clean.x;}
        clean.min??=clean.x-1;clean.max??=clean.x+1;clean.speed??=1.5;
        // A default a creature was given here lands after its kind, while the
        // same field authored in the level lands before it. The draft's
        // version is a hash of its text, so the two orders read as two
        // layouts and a draft could not round-trip; write every creature in
        // one order whatever it arrived with.
        {const ordered={};for(const key of [...Object.keys(nums),'kind'])if(clean[key]!==undefined)ordered[key]=clean[key];for(const key of Object.keys(clean))delete clean[key];Object.assign(clean,ordered);}
        if(clean.min>clean.max)throw new Error('Enemy patrol start must precede its end.');clean.x=clamp(clean.x,clean.min,clean.max);
      }
      return clean;
    });
  }
  // Decoration is data in the same sense: a placement names one of the game's
  // own shapes and says where it stands. It can never introduce geometry, a
  // collider or a save record, and an unknown name is refused rather than
  // carried, so an import stays inert.
  if(source[DECOR]!==undefined){
    if(!Array.isArray(source[DECOR])||source[DECOR].length>DECOR_LIMIT)throw new Error(`Invalid decor list (maximum ${DECOR_LIMIT}).`);
    out[DECOR]=source[DECOR].map((item,i)=>{
      if(!item||typeof item!=='object')throw new Error(`Invalid decoration ${i+1}.`);
      if(!DECOR_KINDS[item.kind])throw new Error(`Decoration ${i+1} is not a shape this game can build.`);
      const clean={kind:item.kind,x:finite(item.x,...nums.x,`decor ${i+1}: x`),y:finite(item.y,...nums.y,`decor ${i+1}: y`)};
      for(const [key,bounds]of Object.entries(DECOR_BOUNDS))if(item[key]!==undefined)clean[key]=finite(item[key],...bounds,`decor ${i+1}: ${key}`);
      clean.size??=DECOR_KINDS[item.kind].size;clean.z??=DECOR_KINDS[item.kind].z;
      return clean;
    });
  }
  // Shaping stations are data too: ids, a gesture, the clay they own and where
  // the prompt applies. Never any behaviour, so an import stays inert. The one
  // rule a chapter carries, the formable mass, is data as well — a clump of
  // knots and a solution of strokes, all bounded — and it is the only rule an
  // import may name; without it the canyon's mass would arrive as a dead slab.
  if(source.shaping!==undefined){
    if(!Array.isArray(source.shaping)||source.shaping.length>30)throw new Error('Invalid shaping list (maximum 30).');
    const clay=new Set(out.platforms.filter(p=>p.shape).map(p=>p.id));
    const text=(value,label,max=240)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`Invalid station ${label}.`);return value;};
    out.shaping=source.shaping.map(s=>{
      if(!s||typeof s!=='object')throw new Error('Invalid shaping station.');
      if(!idOK(s.id))throw new Error('Each shaping station needs an ID.');
      if(!['down','right','out','up'].includes(s.gesture))throw new Error('A station gesture must be down, right, out or up.');
      const parts=(Array.isArray(s.parts)?s.parts:[]).filter(id=>clay.has(id));
      if(!parts.length)throw new Error(`Station ${s.id} has no kneadable clay.`);
      const station={id:s.id,name:text(s.name,'name',80),verb:text(s.verb,'verb',40),gesture:s.gesture,parts,
        x:finite(s.x,-100,2000,'station x'),end:finite(s.end,-100,2080,'station end'),
        spawn:{x:finite(s.spawn?.x,-100,2000,'station spawn x'),y:finite(s.spawn?.y,-40,160,'station spawn height'),groundId:s.spawn?.groundId},
        hint:text(s.hint,'hint')};
      if(station.end<=station.x)throw new Error(`Station ${s.id} needs a forward range.`);
      if(station.spawn.groundId!==undefined&&!idOK(station.spawn.groundId))throw new Error('Invalid station spawn platform.');
      if(s.lift!==undefined){
        if(!idOK(s.lift))throw new Error('Invalid station lift.');
        Object.assign(station,{lift:s.lift,liftFrom:finite(s.liftFrom,-40,160,'lift start'),liftTo:finite(s.liftTo,-40,160,'lift end')});
      }
      // A station may wait on a channel to work itself (`auto`) and may open
      // one when it is done (`channel`); both are names, never behaviour.
      for(const key of ['auto','channel'])if(s[key]!==undefined){if(!idOK(s[key]))throw new Error(`Invalid station ${key}.`);station[key]=s[key];}
      if(s.rule!==undefined){
        if(s.rule!=='form')throw new Error(`Station ${s.id} asks for a clay rule that stays in the lab.`);
        if(!Array.isArray(s.clump)||!s.clump.length||s.clump.length>24)throw new Error(`Station ${s.id} needs a clump of up to 24 knots.`);
        if(!Array.isArray(s.solution)||s.solution.length>40)throw new Error(`Station ${s.id} needs a solution of up to 40 strokes.`);
        Object.assign(station,{rule:'form',free:!!s.free,
          clump:s.clump.map((k,i)=>[finite(k?.[0],0,1,`station ${s.id} knot ${i+1} across`),finite(k?.[1],-40,40,`station ${s.id} knot ${i+1} top`)]),
          solution:s.solution.map((k,i)=>({x:finite(k?.x,...nums.x,`station ${s.id} stroke ${i+1} x`),lift:finite(k?.lift,-30,30,`stroke ${i+1} lift`),dx:finite(k?.dx,-30,30,`stroke ${i+1} dx`),dy:finite(k?.dy,-30,30,`stroke ${i+1} dy`),t:finite(k?.t,.05,10,`stroke ${i+1} t`)}))});
        if(s.relax===false)station.relax=false;
        if(s.shaped!==undefined)station.shaped=finite(s.shaped,.02,1,'station shaped share');
        // A mould is a target surface authored like a clump; the station is done
        // when the clay lies along it, and `message` is what that announces.
        if(s.mould!==undefined){
          if(!Array.isArray(s.mould)||s.mould.length<2||s.mould.length>24)throw new Error(`Station ${s.id} needs a mould of 2 to 24 knots.`);
          station.mould=s.mould.map((k,i)=>[finite(k?.[0],0,1,`station ${s.id} mould knot ${i+1} across`),finite(k?.[1],-40,40,`station ${s.id} mould knot ${i+1} top`)]);
        }
        if(s.message!==undefined)station.message=text(s.message,'message',80);
      }
      // Where the prompt's hand cue stands, for any station that names one;
      // after the rule's own fields, so a formable mass keeps the key order
      // its canonical export was hashed with.
      if(s.cueX!==undefined)station.cueX=finite(s.cueX,...nums.x,'station cue x');
      return station;
    });
  }
  for(const list of ['platforms','winds'])if(new Set(out[list].map(p=>p.id)).size!==out[list].length)throw new Error(`Duplicate IDs in ${list}.`);
  if(out.shaping&&new Set(out.shaping.map(s=>s.id)).size!==out.shaping.length)throw new Error('Duplicate IDs in shaping.');
  if(!out.platforms.some(p=>p.id==='start'))throw new Error('Keep the starting platform.');
  if(out.platforms.filter(p=>p.goal).length!==1)throw new Error('A chapter needs exactly one finish platform.');
  const goal=out.platforms.find(p=>p.goal);if(goal.w<2.5)throw new Error('The finish platform must be at least 2.5 units wide.');
  out.spawn={x:finite(source.spawn?.x,-100,2000,'Start X'),y:finite(source.spawn?.y,-40,160,'Start height')};
  out.custom=true;repairDraft(out);
  // Decoration only joins the content hash once a chapter carries some, so a
  // layout version — and the checkpoints that depend on it — is unchanged by
  // this list existing. Moving scenery still revises it, because a saved
  // checkpoint is cheap to retire and a stale one is confusing.
  const content=JSON.stringify([out.spawn,...LISTS.filter(k=>!OPTIONAL_LISTS.has(k)||out[k].length).map(k=>out[k]),out.shaping??null,...(out[DECOR].length?[out[DECOR]]:[])]);
  out.layoutVersion=`editor-${base.layoutVersion}-${hash(content)}`;
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
const ENEMY_LABELS={spitter:'Echo Spitter',spore:'Spore Puff',bat:'Flying bat',drifter:'Dust Drifter',hatworm:'Hatworm',blinker:'Blinker',drip:'Drip'};
export const objectLabel=(obj,list)=>list===DECOR?(DECOR_KINDS[obj.kind]?.label||'Decoration'):list==='platforms'?(KINDS[obj.kind]||'Platform'):list==='enemies'&&ENEMY_LABELS[obj.kind]?ENEMY_LABELS[obj.kind]:({coins:'Clay bead',stamps:'Secret flower',hazards:'Spikes',enemies:'Clayling',winds:'Wind area',crushers:'Press',triggers:'Trigger zone',spawn:'Player start'}[list]||'Object');

export class DraftSession{
  // A chapter that carries no trigger zones (or, before it was edited, no
  // decoration) still gives the editor every list to draw and place into.
  constructor(library,index){this.library=library;this.index=index;this.level=clone(library.get(index));for(const list of EDIT_LISTS)this.level[list]??=[];this.selection=null;this.undoStack=[];this.redoStack=[];this.pending=null;}
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
      for(const list of ['coins','stamps','enemies',DECOR])for(let i=0;i<before[list].length;i++){
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
      const previous=obj[field];
      if(value===null||value==='')delete obj[field];else obj[field]=value;
      if(field==='kind'&&this.selection.list===DECOR){
        // Trying another shape in the same spot should arrive at a sensible
        // size rather than a tiny castle. A size the author set by hand is
        // theirs, so only the previous shape's own default is replaced.
        const spec=DECOR_KINDS[value],old=DECOR_KINDS[previous];
        if(spec){if(!old||obj.size===old.size)obj.size=spec.size;if(!old||obj.z===old.z)obj.z=spec.z;}
        return;
      }
      if(field==='kind'){
        if(this.selection.list==='enemies'&&value==='bat'){obj.bob??=BAT.bob;obj.period??=BAT.period;}
        if(this.selection.list==='enemies'&&value==='drifter'){obj.bob??=DRIFTER.bob;obj.period??=DRIFTER.period;}
        if(this.selection.list==='enemies'&&value==='blinker'){obj.bob??=BLINKER.bob;obj.period??=BLINKER.period;}
        if(this.selection.list==='enemies'&&value==='drip'){obj.reach??=DRIP.reach;obj.period??=DRIP.period;}
        if(value==='sink'){obj.rate??=SINK.rate;obj.drop??=SINK.drop;}
        if(value==='fold'){obj.channel??='new-circuit';obj.duration??=FOLD.duration;obj.pivot??='left';obj.from??='deck';obj.to??='wall';}
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
      if(type.startsWith('decor:')){
        const kind=type.slice(6),spec=DECOR_KINDS[kind];
        if(!spec)throw new Error('Choose a decoration from the palette.');
        list=DECOR;obj={kind,x,y,z:spec.z,size:spec.size,turn:0};
      }
      else if(KINDS[type]){list='platforms';obj={id:id('clay'),x:x-2,y,w:4,kind:type};if(type==='wall')Object.assign(obj,{y:y+2,h:4});if(type==='gate')Object.assign(obj,{h:10,channel:'new-circuit'});if(type==='ferry')Object.assign(obj,{travel:24,speed:3.2});if(type==='orbit')Object.assign(obj,{moveX:4,moveY:4,period:12});if(type==='lift')Object.assign(obj,{period:5,moveY:1.2});if(type==='pulse')Object.assign(obj,{period:4.8,duty:.76});if(type==='switch')Object.assign(obj,{w:1.8,channel:'new-circuit',duration:10});if(type==='timed'||type==='counter')Object.assign(obj,{channel:'new-circuit',...(type==='counter'?{rise:3}:{})});if(type==='sink')Object.assign(obj,{rate:SINK.rate,drop:SINK.drop});if(type==='fold')Object.assign(obj,{channel:'new-circuit',duration:FOLD.duration,pivot:'left',from:'deck',to:'wall'});
        if(type==='clay'){
          // Clay is placed as a plug that presses down into a bridge, and it
          // arrives with the station that lets the player knead it.
          const station=id('station');
          Object.assign(obj,{x:x-1.2,w:2.4,y:y+3.4,h:4,clayRole:'bridge',station,
            shape:{from:{x:x-1.2,w:2.4,y:y+3.4,h:4},to:{x:x-1.2,w:6.4,y,h:.65}}});
          const dock=level.platforms.find(p=>!p.shape&&x>=p.x-2&&x<=p.x+p.w+2)||level.platforms[0];
          (level.shaping??=[]).push({id:station,name:'Press a bridge',verb:'Press down',gesture:'down',parts:[obj.id],
            x:x-10,end:x+10,spawn:{x:dock.x+dock.w/2,y:dock.y,groundId:dock.id},
            hint:'Press the orange clay down — drag, hold E, or stomp it.'});
        }}
      else{list=['bat','drifter','spore','spitter','hatworm','blinker','drip'].includes(type)?'enemies':type;obj={x,y};if(type==='spitter')Object.assign(obj,{kind:'spitter',min:x-2,max:x+2,speed:.38});if(type==='hatworm')Object.assign(obj,{kind:'hatworm',min:x-HATWORM.range,max:x+HATWORM.range,speed:HATWORM.speed});if(type==='blinker')Object.assign(obj,{kind:'blinker',min:x-BLINKER.range,max:x+BLINKER.range,speed:BLINKER.speed,bob:BLINKER.bob,period:BLINKER.period});if(type==='drip')Object.assign(obj,{kind:'drip',reach:DRIP.reach,period:DRIP.period});if(type==='triggers')Object.assign(obj,{x:x-2,w:4,h:3,channel:'new-circuit'});if(type==='spore')Object.assign(obj,{kind:'spore',min:x-1,max:x+1,speed:.5});if(type==='bat')Object.assign(obj,{kind:'bat',min:x-1.6,max:x+1.6,speed:BAT.patrolSpeed,bob:BAT.bob,period:BAT.period});if(type==='drifter')Object.assign(obj,{kind:'drifter',min:x-1.5,max:x+1.5,speed:DRIFTER.patrolSpeed,bob:DRIFTER.bob,period:DRIFTER.period});if(type==='hazards')Object.assign(obj,{x:x-2,w:4});if(type==='enemies')Object.assign(obj,{min:x-1.5,max:x+1.5,speed:1.5});if(type==='winds')Object.assign(obj,{id:id('wind'),x:x-2,w:4,h:7,fx:0,fy:18});if(type==='crushers')Object.assign(obj,{w:1.8,range:3,period:5});}
      if(!EDIT_LISTS.includes(list))throw new Error('Unsupported object type.');
      level[list].push(obj);this.selection={list,index:level[list].length-1};
    });
  }
  duplicate(){const obj=selectedObject(this.level,this.selection);if(!obj||this.selection.list==='spawn')return;this.change(level=>{const copy=clone(obj);copy.x+=1;copy.y+=1;if(copy.min!==undefined){copy.min+=1;copy.max+=1;}delete copy.goal;delete copy.bellX;delete copy.checkpoint;if(copy.id){let n=1;while(level[this.selection.list].some(p=>p.id===`${obj.id.slice(0,55)}-copy-${n}`))n++;copy.id=`${obj.id.slice(0,55)}-copy-${n}`;}level[this.selection.list].push(copy);this.selection={list:this.selection.list,index:level[this.selection.list].length-1};});}
  remove(){const obj=selectedObject(this.level,this.selection);if(!obj||this.selection.list==='spawn'||obj.id==='start'||obj.goal)throw new Error('Keep the player start, starting platform and finish. You can move them.');this.change(level=>{level[this.selection.list].splice(this.selection.index,1);this.selection=null;});}
}
