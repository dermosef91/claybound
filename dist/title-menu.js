// Names must come from the curated set bundled in lib/lucide.min.js —
// an unknown name renders as an empty element with no warning.
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const count=(value,max)=>Math.min(max,Math.max(0,Math.floor(Number(value)||0)));

// Best-run counts are separate from checkpoint IDs. Never add them together or
// count records from a superseded layout as finds in the current chapter.
export function chapterCollections(level,index,saved){
  const best=(level.custom?saved.customBest:saved.best)?.[index];
  const run=(level.custom?saved.customRuns:saved.runs)?.[index];
  const found=key=>{
    // instantiateLevel assigns collectible IDs from their array indices.
    const validIds=new Set(level[key].map((_,i)=>i));
    const checkpoint=run?.version===level.layoutVersion&&Array.isArray(run[key])
      ?new Set(run[key].filter(id=>validIds.has(id))).size:0;
    return Math.max(checkpoint,best?.version===level.layoutVersion?count(best[key],level[key].length):0);
  };
  return {coins:found('coins'),stamps:found('stamps'),coinTotal:level.coins.length,stampTotal:level.stamps.length};
}

const percent=value=>Math.round(Math.min(1,Math.max(0,Number(value)||0))*100);

// Music and effects are separate because they are used differently: plenty of
// players want their own soundtrack without losing the landing and pickup cues
// that tell them what just happened.
function slider(action,label,iconName,value){
  const now=percent(value);
  return `<div class="title-slider">
      <label for="setting-${action}">${icon(iconName)}<span>${label}</span><strong data-readout="${action}">${now}%</strong></label>
      <input id="setting-${action}" type="range" min="0" max="100" step="5" value="${now}"
        data-action="${action}" aria-label="${label} volume" aria-valuetext="${now} per cent">
    </div>`;
}

// Who you play as is a preference, not a level: it changes nothing about a
// chapter's layout, its records or its collectibles, so it belongs beside the
// volume and rumble switches rather than in the chapter list. It stays out of
// sight until someone finds it — see the unlock in app.js — so the panel a
// first-time player opens is still just sound, rumble and fullscreen.
export function characterMarkup(characters,current){
  const choices=characters.map(entry=>{
    const chosen=entry.id===current;
    return `<button class="title-character" data-action="settings-character" data-character="${entry.id}"
      role="radio" aria-checked="${chosen}"><span><strong>${entry.name}</strong><small>${entry.note}</small></span>${chosen?icon('check'):''}</button>`;
  }).join('');
  return `<div class="title-characters" role="radiogroup" aria-label="Character">
      <p class="title-characters-label">${icon('user-round')}<span>Character</span></p>${choices}
    </div>`;
}

export function settingsMarkup(soundEnabled,fullscreenActive,{music=.55,effects=1,rumble=true,characters=[],character='',charactersUnlocked=false}={}){
  return `<button class="dialog-close" data-action="close" aria-label="Close settings">${icon('x')}</button>
    <span class="eyebrow">SETTINGS</span><h2>Make yourself at home.</h2>
    <div class="title-levels">
      ${slider('settings-music','Music','bell',music)}
      ${slider('settings-effects','Effects','sparkles',effects)}
    </div>
    ${charactersUnlocked&&characters.length>1?characterMarkup(characters,character):''}
    <div class="title-settings">
      <button class="title-setting" data-action="settings-sound" role="switch" aria-checked="${soundEnabled}" aria-label="Game sound">${icon(soundEnabled?'volume-2':'volume-x')}<span>Sound</span><strong>${soundEnabled?'On':'Off'}</strong></button>
      <button class="title-setting" data-action="settings-rumble" role="switch" aria-checked="${rumble}" aria-label="Vibration and controller rumble">${icon('move-vertical')}<span>Rumble</span><strong>${rumble?'On':'Off'}</strong></button>
      <button class="title-setting" data-action="fullscreen" data-fullscreen="label" aria-pressed="${fullscreenActive}">${icon(fullscreenActive?'minimize':'expand')}<span>${fullscreenActive?'Exit fullscreen':'Fullscreen'}</span></button>
      <button class="title-setting" data-action="help">${icon('gamepad-2')}<span>How to play</span></button>
      <button class="title-setting" data-action="editor">${icon('pencil-ruler')}<span>Level editor</span></button>
    </div><p>Sound preferences and progress save on this device.</p>`;
}
