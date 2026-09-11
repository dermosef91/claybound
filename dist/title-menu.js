const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=(value,max)=>Math.min(max,Math.max(0,Math.floor(Number(value)||0)));
const scenes={desert:'canyon',forest:'forest',cave:'cave',citadel:'citadel'};

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

export function collectiblesMarkup(levels,saved){
  const records=levels.map((level,i)=>chapterCollections(level,i,saved));
  const total=key=>records.reduce((sum,r)=>sum+r[key],0);
  return `<button class="dialog-close" data-action="close" aria-label="Close collectibles">${icon('x')}</button>
    <span class="eyebrow">COLLECTIBLES</span><h2>Little treasures.</h2>
    <p class="collection-summary">${total('stamps')} / ${total('stampTotal')} secret flowers · ${total('coins')} / ${total('coinTotal')} clay beads</p>
    <div class="collection-list">${levels.map((level,i)=>{const r=records[i];return `<button class="collection-chapter" data-level="${i}" aria-label="Play ${escape(level.short)}. ${r.stamps} of ${r.stampTotal} flowers, ${r.coins} of ${r.coinTotal} beads.">
      <img src="./assets/completion/${scenes[level.biome]}.webp" alt="" width="62" height="76">
      <span class="collection-details"><strong>${escape(level.short)}${level.custom?' · Edited':''}</strong>
        <span class="collection-flowers" aria-hidden="true">${Array.from({length:r.stampTotal},(_,j)=>`<img src="./assets/completion/flower.webp" alt="" width="25" height="25" class="${j<r.stamps?'':'unfound'}">`).join('')}<small>${r.stamps} / ${r.stampTotal}</small></span>
        <span class="collection-beads">${r.coins} / ${r.coinTotal} beads</span>
      </span>${icon('chevron-right')}</button>`;}).join('')}</div>
    <p>Your best chapter totals, including finds at your saved checkpoint. Choose a chapter to keep exploring.</p>`;
}

export function settingsMarkup(soundEnabled,fullscreenActive){
  return `<button class="dialog-close" data-action="close" aria-label="Close settings">${icon('x')}</button>
    <span class="eyebrow">SETTINGS</span><h2>Make yourself at home.</h2>
    <div class="title-settings">
      <button class="title-setting" data-action="settings-sound" role="switch" aria-checked="${soundEnabled}" aria-label="Game sound">${icon(soundEnabled?'volume-2':'volume-x')}<span>Sound</span><strong>${soundEnabled?'On':'Off'}</strong></button>
      <button class="title-setting" data-action="fullscreen" data-fullscreen="label" aria-pressed="${fullscreenActive}">${icon(fullscreenActive?'minimize':'expand')}<span>${fullscreenActive?'Exit fullscreen':'Fullscreen'}</span></button>
      <button id="play-fullscreen" class="title-setting" data-action="play-fullscreen">${icon('play')}<span>Play fullscreen</span></button>
      <button class="title-setting" data-action="help">${icon('gamepad-2')}<span>How to play</span></button>
      <button class="title-setting" data-action="editor">${icon('pencil-ruler')}<span>Level editor</span></button>
    </div><p>Sound preferences and progress save on this device.</p>`;
}
