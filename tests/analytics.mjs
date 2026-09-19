import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reportsFrom,active,initAnalytics,track,setAnalyticsEnabled,flush,sampleFrame,frameSummary,rendererInfo} from '../dist/analytics.js';
import {settingsMarkup} from '../dist/title-menu.js';

// The host gate is the whole privacy and data-hygiene story: Pages serves the
// identical bundle and a developer serves dist/ off localhost, so anything but
// the two Firebase addresses must stay silent.
assert(reportsFrom('claybound-56949.web.app'),'the hosted game reports');
assert(reportsFrom('claybound-56949.firebaseapp.com'),'so does the firebaseapp mirror');
for(const host of ['dermosef91.github.io','localhost','127.0.0.1','','terminal.local','claybound-56949.web.app.evil.test'])
  assert(!reportsFrom(host),`${host||'(empty)'} must never report`);
console.log('PASS analytics host gate: Firebase only, Pages and local silent');

// Importing this module must not start anything. Every entry point has to be
// safe before init, because app.js calls track() from the game loop and from
// event handlers that run long before -- and on hosts where never -- the SDK
// arrives. None of these may throw, and none may make the module active.
assert.equal(active(),false,'nothing is running on import');
track('chapter_started',{chapter:1});
track('nonsense');
setAnalyticsEnabled(true);setAnalyticsEnabled(false);
flush();
sampleFrame(1/60);
assert.equal(frameSummary(),null,'no frames are summarised before init');
assert.deepEqual(rendererInfo(undefined),{},'a missing renderer is not an error');
assert.deepEqual(rendererInfo({getContext:()=>{throw new Error('lost');}}),{},'a lost context is not an error');
assert.equal(active(),false,'still nothing running');
console.log('PASS analytics is inert before init and never throws');

// init refuses in each of the three ways it can, and in particular refuses on
// the placeholder key -- so a deploy that forgot to paste the real key sends
// nothing rather than failing requests into the void.
assert.equal(await initAnalytics({host:'dermosef91.github.io',enabled:true}),false,'wrong host');
assert.equal(await initAnalytics({host:'localhost',enabled:true}),false,'local development');
assert.equal(await initAnalytics({host:'claybound-56949.web.app',enabled:false}),false,'player opted out');
assert.equal(await initAnalytics({}),false,'no host at all');
// Every condition met except a browser. This runs in bare Node, so it must
// still refuse -- and refusing matters more than it looks: the SDK imported
// into Node installs timers that never let the process exit, which turns a
// test run into a hang rather than a failure.
assert.equal(await initAnalytics({host:'claybound-56949.web.app',enabled:true}),false,'no browser, no SDK');
assert.equal(active(),false,'and nothing was started');
console.log('PASS analytics init refuses every wrong condition, including bare Node');

// The key that ships. It has to be a public phc_ ingest key: a phs_ or phx_
// key is a secret, and this file is readable by every player.
const source=readFileSync(new URL('../dist/analytics.js',import.meta.url),'utf8');
const key=source.match(/const PROJECT_KEY *= *'([^']*)'/)?.[1];
assert(key,'a PROJECT_KEY constant is present');
assert(key.startsWith('phc_'),`the shipped key must be a public phc_ key, not ${key.slice(0,4)}…`);
// Quoted literals only: the file's own comment warns about phs_/phx_ keys by
// name, and that warning is not a leak.
assert(!/['"`](phs_|phx_)/.test(source),'no secret key may be written as a literal in this file');
const host=source.match(/const API_HOST *= *'([^']*)'/)?.[1];
assert(/^https:\/\/(eu|us)\.i\.posthog\.com$/.test(host),`API_HOST is a PostHog ingest host, got ${host}`);
console.log(`PASS analytics ships a public ${key.slice(0,4)} key to ${host}`);

// frameSummary only speaks when it has enough frames to mean something, and
// drains itself so one chapter's cost never leaks into the next.
assert.equal(frameSummary(),null,'a drain with nothing in it stays quiet');
console.log('PASS analytics frame summary stays quiet without a session');

// The opt-out switch: present, on by default, and reflecting a stored refusal.
const on=settingsMarkup(true,false,{});
assert(on.includes('data-action="settings-analytics"'),'the switch is in the settings panel');
const row=/<button class="title-setting" data-action="settings-analytics"[\s\S]*?<\/button>/;
assert(row.test(on));
assert(on.match(row)[0].includes('aria-checked="true"'),'usage stats default to on');
assert(on.match(row)[0].includes('<strong>On</strong>'),'and read as On');
assert(on.match(row)[0].includes('role="switch"'),'it is a switch for a screen reader');
const off=settingsMarkup(true,false,{analytics:false});
assert(off.match(row)[0].includes('aria-checked="false"'),'a refusal is carried into the markup');
assert(off.match(row)[0].includes('<strong>Off</strong>'),'and reads as Off');
assert(on.includes('anonymous'),'the panel says what is collected');
console.log('PASS analytics opt-out switch renders, defaults on, and honours a refusal');
