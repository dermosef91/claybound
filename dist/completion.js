const artRoot='./assets/completion/';
// The dream has no completion art yet; the blue citadel plate reads closer
// to a dream than the canyon fallback would.
const sceneNames={desert:'canyon',forest:'forest',cave:'cave',citadel:'citadel',dream:'citadel'};
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const clock=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;

// Capture the comparison before saving the new record. Reopening the world map
// must not turn the same run into a different result, or compare old layouts.
export function completionRecord(run,level,old){
  const before=old?.version===level.layoutVersion?old:null;
  const priorTime=Number.isFinite(before?.time)?before.time:Infinity;
  return {
    result:Object.freeze({...run,newBest:run.time<priorTime,previousBest:Number.isFinite(priorTime)?priorTime:null}),
    best:{version:level.layoutVersion,coins:Math.max(before?.coins||0,run.coins),stamps:Math.max(before?.stamps||0,run.stamps),time:Math.min(priorTime,run.time)},
    previous:old&&!before?old:null
  };
}

export function completionMarkup(run,level,chapterCount){
  const final=run.index===chapterCount-1;
  const scene=sceneNames[level.biome]||'canyon';
  const timeLabel=run.newBest
    ?`<span class="completion-record">${icon('star')} New best!</span>`
    :run.previousBest!==null&&run.previousBest!==undefined
      ?`<span class="completion-personal-best">Best ${clock(run.previousBest)}</span>`:'';
  const reward=(asset,value,label,extra='')=>`<div class="completion-stat"><img class="completion-reward" src="${artRoot}${asset}.webp" alt="" width="1254" height="1254"><dt>${label}</dt><dd>${value}</dd>${extra}</div>`;
  return `<div class="completion-scene" data-scene="${scene}">
    <img class="completion-background" src="${artRoot}${scene}.webp" alt="" width="1254" height="1254" decoding="async">
    <div class="completion-shade" aria-hidden="true"></div>
    <div class="completion-content">
      <div class="completion-chapter"><span>${String(run.index+1).padStart(2,'0')}</span><span>${escape(level.short)}</span></div>
      <header class="completion-heading">
        <h2 id="dialog-title"><span>Level</span><span>Complete!</span></h2>
        <div class="completion-flourish" aria-hidden="true"><img src="${artRoot}flourish.webp" alt="" width="2172" height="724"></div>
      </header>
      <dl class="completion-stats" aria-label="Your chapter results">
        ${reward('bead',`${run.coins}<span class="completion-denominator"> / ${level.coins.length}</span>`,'Clay beads')}
        ${reward('flower',`${run.stamps}<span class="completion-denominator"> / ${level.stamps.length}</span>`,'Secret flowers')}
        ${reward('timer',clock(run.time),'Your time',timeLabel)}
      </dl>
      <nav class="completion-actions" aria-label="Continue your adventure">
        <button class="completion-button completion-primary" data-action="${final?'chapters':'next'}">${icon(final?'map':'arrow-right')}<span>${final?'Chapters':'Next Chapter'}</span></button>
        <button class="completion-button" data-action="restart">${icon('rotate-cw')}<span>Play Again</span></button>
        <button class="completion-button" data-action="${final?'home':'chapters'}">${icon(final?'house':'map')}<span>${final?'Back to Title':'Chapters'}</span></button>
      </nav>
    </div>
    <p class="completion-note completion-note-top" aria-hidden="true">${final?'What a little<br>adventure.':'Another<br>step forward.'}</p>
    <p class="completion-note completion-note-bottom" aria-hidden="true">Same clay.<br>New horizons.</p>
  </div>`;
}

const warmed=new Set();
export function warmCompletionAssets(biome){
  const scene=sceneNames[biome]||'canyon';
  for(const file of [scene,'bead','flower','timer','flourish']){
    if(warmed.has(file))continue;
    warmed.add(file);
    const img=new Image();img.decoding='async';img.src=`${artRoot}${file}.webp`;
  }
  for(const font of ['1em "Clay Display"','500 1em "Clay Sans"','700 1em "Clay Sans"','1em "Clay Hand"'])document.fonts?.load(font).catch(()=>{});
}
