// The frame's own behaviour, independent of the renderer: what the player sees
// when they jump, fall, land and turn around.
import assert from 'node:assert/strict';
import {cameraFraming, cameraTarget, cameraAnchorY, anchorDragged, verticalBand, VERTICAL_BAND, VERTICAL_BIAS} from '../dist/camera.js';
import {Game, RULES, FIXED_DT} from '../dist/simulation.js';

const wide = cameraFraming(844, 390, 'desert');
const portrait = cameraFraming(390, 844, 'desert');

// --- framing ---------------------------------------------------------------
assert(wide.landscape && !portrait.landscape);
assert(Math.abs(wide.viewW - wide.viewH * 844 / 390) < 1e-9);
assert(portrait.viewH > wide.viewH, 'portrait still shows more height than landscape');
assert(portrait.viewH < wide.viewH * 1.45, 'but nothing like the old near-double');
assert(cameraFraming(844, 390, 'citadel').viewH < wide.viewH, 'the citadel keeps its tighter frame');

// The player used to sit a fifth of the view below centre, so the frame spent
// itself on sky. They now sit close to the middle, with room below to land in.
const still = {x: 0, y: 0, vy: 0, facing: 1, groundId: 'floor'};
const framed = cameraTarget(still, wide.viewW, wide.viewH, true);
assert(framed.y > still.y, 'the frame still sits above the feet, not on them');
assert(framed.y < still.y + RULES.height, 'and no higher than the character is tall');
assert.equal(framed.y, wide.viewH * VERTICAL_BIAS);
console.log('PASS framing: comparable orientations, tighter citadel, room below the player');

// --- a jump must not move the frame ----------------------------------------
// Run the real simulation: stand, jump, and watch what the anchor does.
const game = new Game();
game.load(0);
const p = game.player;
let anchor = cameraAnchorY(undefined, p, wide.viewH, 0);
assert.equal(anchor, p.y, 'the anchor starts on the player');

const ground = p.y;
let peak = -Infinity, anchorDrift = 0, airborneFrames = 0;
for (let i = 0; i < 240; i++) {
  game.tick(FIXED_DT, {jumpPressed: i === 0, jumpHeld: i < 30});
  anchor = cameraAnchorY(anchor, game.player, wide.viewH, FIXED_DT);
  if (!game.player.groundId) {
    airborneFrames++;
    peak = Math.max(peak, game.player.y);
    anchorDrift = Math.max(anchorDrift, Math.abs(anchor - ground));
  }
  if (airborneFrames > 4 && game.player.groundId) break;
}
assert(airborneFrames > 30, `the jump actually left the ground (${airborneFrames} frames)`);
assert(peak - ground > 1.5, `and rose a real distance (${(peak - ground).toFixed(2)} units)`);
assert(peak - ground < verticalBand(wide.viewH), 'a full jump fits inside the band');
assert.equal(anchorDrift, 0, 'so the frame does not move at all during an ordinary jump');
console.log(`PASS a ${(peak - ground).toFixed(2)}-unit jump moves the character inside a still frame`);

// --- a long fall does carry the frame ---------------------------------------
const band = verticalBand(wide.viewH);
let falling = {x: 0, y: 0, vy: -20, facing: 1, groundId: null};
let fallAnchor = 0;
for (let i = 0; i < 90; i++) {
  falling = {...falling, y: falling.y - 20 * FIXED_DT};
  fallAnchor = cameraAnchorY(fallAnchor, falling, wide.viewH, FIXED_DT);
}
assert(fallAnchor < 0, 'a long fall drags the frame down with the player');
assert(Math.abs(fallAnchor - falling.y) <= band + 1e-6, 'never further than the band');
assert(fallAnchor > falling.y, 'and the frame stays above them, showing the ground below');
assert(anchorDragged(fallAnchor, falling, wide.viewH), 'a dragged anchor is reported, so the follow can keep up');
assert(!anchorDragged(0, {y: 0}, wide.viewH), 'a resting anchor is not');
console.log('PASS a long fall carries the frame, capped at the band, with the ground kept in view');

// --- landing somewhere new retargets ----------------------------------------
// Standing still on a new ledge, the frame settles onto it rather than staying
// where the last one was.
let landed = {x: 0, y: 6, vy: 0, facing: 1, groundId: 'ledge'};
let settleAnchor = 6 - band;
const before = settleAnchor;
for (let i = 0; i < 120; i++) settleAnchor = cameraAnchorY(settleAnchor, landed, wide.viewH, FIXED_DT);
assert(settleAnchor > before, 'the anchor climbs towards the new surface');
assert(Math.abs(settleAnchor - landed.y) < .05, `and arrives on it (${settleAnchor.toFixed(3)})`);
console.log('PASS standing on a new surface retargets the frame onto it');

// --- turning around ---------------------------------------------------------
const right = cameraTarget({...still, facing: 1}, wide.viewW, wide.viewH, true);
const left = cameraTarget({...still, facing: -1}, wide.viewW, wide.viewH, true);
assert(right.x > still.x && left.x < still.x, 'the frame leads the way the player faces');
const swing = (right.x - left.x) / wide.viewW;
assert(swing < .25, `turning moves the frame less than a quarter of the view (${(swing * 100).toFixed(0)}%)`);
// A partially eased facing value lands between the two, so a turn slides.
const mid = cameraTarget(still, wide.viewW, wide.viewH, true, 0, still.y, 0);
assert(mid.x > left.x && mid.x < right.x, 'an easing facing value gives an intermediate frame');
console.log(`PASS turning swings the frame ${(swing * 100).toFixed(0)}% of the view, and eases rather than snapping`);

// --- guards -----------------------------------------------------------------
assert.equal(cameraAnchorY(NaN, still, wide.viewH, .016), still.y, 'an unset anchor seats on the player');
assert.equal(cameraAnchorY(undefined, still, wide.viewH, .016), still.y);
assert(VERTICAL_BAND > 0 && VERTICAL_BIAS > 0);
const zeroFacing = cameraTarget({...still, facing: 0}, wide.viewW, wide.viewH, true);
assert(zeroFacing.x > still.x, 'a character with no facing still gets a lead, not a collapse');
console.log('PASS anchor seeding, unset facing and constant sanity');
