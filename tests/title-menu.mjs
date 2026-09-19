import assert from 'node:assert/strict';
import {LEVELS} from '../dist/levels.js';
import {chapterCollections,settingsMarkup,stopMotionTuningMarkup} from '../dist/title-menu.js';
import {CHARACTERS} from '../dist/characters.js';

const level=LEVELS[0];
const saved={best:{0:{version:level.layoutVersion,stamps:2,coins:6}},runs:{0:{version:level.layoutVersion,stamps:[0,0,999],coins:[0,1,2,3,4,5,6,7]}},customBest:{},customRuns:{}};
assert.deepEqual(chapterCollections(level,0,saved),{stamps:2,coins:8,stampTotal:4,coinTotal:level.coins.length});
saved.best[0].version='older-layout';assert.equal(chapterCollections(level,0,saved).stamps,1);
saved.runs[0].version='older-layout';assert.equal(chapterCollections(level,0,saved).stamps,0);
saved.customBest[0]={version:level.layoutVersion,stamps:3,coins:100000};
const custom={...level,custom:true};assert.equal(chapterCollections(custom,0,saved).stamps,3);assert.equal(chapterCollections(custom,0,saved).coins,level.coins.length);
assert.equal(chapterCollections(level,0,saved).stamps,0,'Edited designs must not change original totals');
console.log('PASS title collectibles: checkpoint IDs, no duplicate finds, best/checkpoint overlap, old-layout exclusion and edited score isolation');

// The character picker is a radio group: exactly one option is checked, every
// option carries the id the click handler reads back, and a lone character
// leaves the panel as it was.
assert(!settingsMarkup(true,false,{characters:CHARACTERS,character:'clay'}).includes('title-characters'),
  'the cast stays out of sight until it is unlocked');
const settings=settingsMarkup(true,false,{characters:CHARACTERS,character:'emberleaf',charactersUnlocked:true});
for(const choice of CHARACTERS){
  assert(settings.includes(`data-character="${choice.id}"`),`${choice.id} is offered`);
  assert(settings.includes(choice.name)&&settings.includes(choice.note));
}
const rows=settings.match(/<button class="title-character"[\s\S]*?<\/button>/g);
assert.equal(rows.length,CHARACTERS.length);
const worn=rows.filter(row=>row.includes('aria-checked="true"'));
assert.equal(worn.length,1,'one character is worn at a time');
assert(worn[0].includes('data-character="emberleaf"'),'the saved character is the checked one');
assert(worn[0].includes('data-lucide="check"'),'and the only one showing a tick');
assert(settings.includes('role="radiogroup"'));
assert(!settingsMarkup(true,false,{characters:[CHARACTERS[0]],character:'clay',charactersUnlocked:true}).includes('title-characters'),
  'a single character offers no choice to make');
assert(!settingsMarkup(true,false).includes('title-characters'));
console.log('PASS settings character picker: hidden until unlocked, every option present, exactly one checked, absent when there is nothing to choose');

// Stop motion is a switch beside Rumble, off unless the player turned it on.
for(const stopMotion of [false,true]){
  const markup=settingsMarkup(true,false,{stopMotion}),row=markup.match(/<button class="title-setting" data-action="settings-stopmotion"[\s\S]*?<\/button>/)?.[0];
  assert(row,'the panel offers stop motion');
  assert(row.includes('role="switch"')&&row.includes(`aria-checked="${stopMotion}"`),'as a switch showing the saved state');
  assert(row.includes(stopMotion?'<strong>On</strong>':'<strong>Off</strong>'));
  assert(row.includes('data-lucide="camera"'),'with a glyph from the committed subset');
}
assert(settingsMarkup(true,false).includes('data-action="settings-stopmotion" role="switch" aria-checked="false"'),'off by default');
console.log('PASS settings stop motion: a switch beside rumble, off until chosen, showing the saved state');

// The look's tuning unfolds under the switch only while it is on, every number
// in its own unit at its saved value, the two switches showing their state.
assert(!settingsMarkup(true,false,{stopMotion:false,stopMotionTuning:{fps:12}}).includes('data-tuning'),'folded away while off');
const tuned=settingsMarkup(true,false,{stopMotion:true,stopMotionTuning:{fps:16,boil:9,wobble:5,flicker:2,creatures:false}});
const block=tuned.match(/<div class="title-tuning" data-tuning="stopmotion">[\s\S]*?<\/button>\s*<\/div>/)?.[0];
assert(block,'the tuning block is there while on');
assert(tuned.indexOf('data-action="settings-stopmotion"')<tuned.indexOf('data-tuning')&&tuned.indexOf('data-tuning')<tuned.indexOf('data-action="fullscreen"'),'right under the switch');
for(const [key,value,unit] of [['fps',16,'/s'],['boil',9,'‰'],['wobble',5,'‰'],['flicker',2,'%']]){
  assert(block.includes(`data-tune="${key}"`)&&block.includes(`value="${value}"`),`${key} slider at its saved value`);
  assert(block.includes(`data-readout="tune-${key}">${value}${unit}<`),`${key} readout in its unit`);
  assert(!block.includes(`data-action="tune-${key}"`),'a tuner never wears the audio sliders\' data-action');
}
assert(block.includes('data-action="settings-stopmotion-creatures" role="switch" aria-checked="false"'));
assert(!block.includes('stopmotion-hold'),'no hold-position switch: a puppet is never held in place');
assert(stopMotionTuningMarkup({fps:99,boil:-4}).includes('value="24"')&&stopMotionTuningMarkup({fps:99,boil:-4}).includes('data-tune="boil" data-unit="‰"'),'out-of-range saves are clamped into the sliders');
const shipped=stopMotionTuningMarkup();
for(const needle of ['data-readout="tune-fps">12/s<','data-readout="tune-boil">6‰<','data-readout="tune-wobble">3‰<','data-readout="tune-flicker">4%<','settings-stopmotion-creatures" role="switch" aria-checked="true"'])assert(shipped.includes(needle),'defaults are the tuned look: '+needle);
console.log('PASS settings stop-motion tuning: unfolds under the switch while on, five controls at their saved values in their units, clamped');
