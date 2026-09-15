// Controller reading and device feedback, with only the browser's gamepad and
// vibration devices emulated.
import assert from 'node:assert/strict';
import {GamepadInput, Haptics, PULSES, stickAxis, padAxis, DEAD_ZONE} from './gamepad-imports.mjs';

const pad = (overrides = {}) => ({
  connected: true,
  axes: [0, 0],
  buttons: Array.from({length: 17}, () => ({pressed: false, value: 0})),
  ...overrides,
});
const press = (p, ...indices) => {
  for (const index of indices) p.buttons[index] = {pressed: true, value: 1};
  return p;
};

// --- stick shaping -------------------------------------------------------
assert.equal(stickAxis(0), 0);
assert.equal(stickAxis(DEAD_ZONE - .01), 0, 'a resting stick never steers');
assert.equal(stickAxis(-DEAD_ZONE + .01), 0);
assert.equal(stickAxis(1), 1);
assert.equal(stickAxis(-1), -1);
assert.equal(stickAxis(NaN), 0);
assert.equal(stickAxis(undefined), 0);
const half = stickAxis(.5 + DEAD_ZONE * .5);
assert(half > 0 && half < .5, 'the curve keeps small pushes gentle');
assert(stickAxis(.9) > stickAxis(.6), 'the axis stays monotonic');
assert.equal(stickAxis(2), 1, 'an over-range axis clamps');

// --- d-pad and stick coexist --------------------------------------------
assert.equal(padAxis(pad({axes: [.8, 0]})), 1 * stickAxis(.8));
assert.equal(padAxis(press(pad(), 15)), 1, 'the d-pad is full deflection');
assert.equal(padAxis(press(pad(), 14)), -1);
assert.equal(padAxis(press(pad({axes: [-.9, 0]}), 15)), 1, 'a pressed d-pad beats a pushed stick');
assert.equal(padAxis(press(pad(), 14, 15)), 0, 'both directions cancel');
console.log('PASS stick dead zone, response curve, clamping and d-pad precedence');

// --- edges are reported once ---------------------------------------------
let pads = [];
const input = new GamepadInput({getGamepads: () => pads});
assert.deepEqual(input.poll(), {connected: false, axis: 0, jumpHeld: false, jumpPressed: false, stompPressed: false, pausePressed: false});

pads = [press(pad(), 0)];
let state = input.poll();
assert(state.connected && state.jumpPressed && state.jumpHeld, 'the first poll reports the press');
state = input.poll();
assert(!state.jumpPressed && state.jumpHeld, 'a held button is not a new press');
pads = [pad()];
assert.equal(input.poll().jumpHeld, false);
pads = [press(pad(), 0)];
assert(input.poll().jumpPressed, 'releasing and pressing again is a new edge');

for (const [index, field] of [[3, 'jumpPressed'], [1, 'stompPressed'], [2, 'stompPressed'], [7, 'stompPressed'], [13, 'stompPressed'], [9, 'pausePressed']]) {
  const fresh = new GamepadInput({getGamepads: () => [press(pad(), index)]});
  assert(fresh.poll()[field], `button ${index} maps to ${field}`);
}

// A trigger that reports only an analog value still counts as pressed.
const analog = pad();
analog.buttons[7] = {pressed: false, value: .8};
assert(new GamepadInput({getGamepads: () => [analog]}).poll().stompPressed, 'analog triggers register');

// A browser that throws, or has no gamepad API at all, must not break the loop.
assert.equal(new GamepadInput({getGamepads: () => {throw new Error('blocked');}}).poll().connected, false);
assert.equal(new GamepadInput({}).poll().connected, false);
assert.equal(new GamepadInput(undefined).poll().connected, false);
// Disconnected entries and null slots are skipped, the way browsers report them.
assert.equal(new GamepadInput({getGamepads: () => [null, pad({connected: false})]}).poll().connected, false);
console.log('PASS button mapping, one-shot edges, analog triggers and missing/failing gamepad APIs');

// --- rumble ---------------------------------------------------------------
const played = [];
const rumbling = new GamepadInput({getGamepads: () => [Object.assign(pad(), {
  vibrationActuator: {playEffect: (type, options) => {played.push({type, options}); return Promise.resolve();}},
})]});
rumbling.poll();
assert(rumbling.rumble(100, .5, .2));
assert.equal(played.length, 1);
assert.equal(played[0].type, 'dual-rumble');
assert.equal(played[0].options.duration, 100);
assert.equal(played[0].options.strongMagnitude, .5);

const broken = new GamepadInput({getGamepads: () => [Object.assign(pad(), {
  vibrationActuator: {playEffect: () => {throw new Error('unsupported');}},
})]});
broken.poll();
assert.equal(broken.rumble(100, .5, .2), false, 'an actuator that throws is not fatal');
const plain = new GamepadInput({getGamepads: () => [pad()]});
plain.poll();
assert.equal(plain.rumble(100, .5, .2), false, 'a pad with no actuator reports nothing');
// A rejected effect promise must not surface as an unhandled rejection.
const rejecting = new GamepadInput({getGamepads: () => [Object.assign(pad(), {
  vibrationActuator: {playEffect: () => Promise.reject(new Error('busy'))},
})]});
rejecting.poll();
assert(rejecting.rumble(50, .3, .3));
await new Promise(resolve => setTimeout(resolve, 0));
console.log('PASS controller rumble, unsupported actuators and rejected effects');

// --- haptics --------------------------------------------------------------
let clock = 0;
const buzzes = [];
const makeHaptics = (options = {}) => {
  const rumbles = [];
  const h = new Haptics({rumble: (...args) => {rumbles.push(args); return true;}},
    {navigatorRef: {vibrate: ms => {buzzes.push(ms); return true;}}, ...options});
  h.now = () => clock;
  h.rumbles = rumbles;
  return h;
};

let h = makeHaptics();
assert(h.pulse({type: 'jump'}), 'a jump is felt');
assert.deepEqual(buzzes, [PULSES.jump.phone]);
assert.equal(h.rumbles.length, 1);
assert.equal(h.pulse({type: 'jump'}), false, 'a second pulse inside the gap is dropped');
clock += 100;
assert(h.pulse({type: 'hurt'}));
assert.equal(buzzes.at(-1), PULSES.hurt.phone);
assert(PULSES.hurt.phone > PULSES.jump.phone, 'damage is felt harder than a jump');

clock += 100;
assert.equal(h.pulse({type: 'section'}), false, 'events with no mapping stay silent');
assert.equal(h.pulse(undefined), false);
assert.equal(h.pulse({}), false);

// A soft landing is weaker than a long drop.
clock += 100; buzzes.length = 0; h.rumbles.length = 0;
h.pulse({type: 'land', impact: 3});
const soft = h.rumbles.at(-1);
clock += 100;
h.pulse({type: 'land', impact: 20});
const hard = h.rumbles.at(-1);
assert(hard[0] > soft[0] && hard[1] > soft[1], 'landing feedback scales with the impact');
assert(soft[1] > 0, 'even a gentle landing registers');

clock += 100; buzzes.length = 0;
h.enabled = false;
assert.equal(h.pulse({type: 'jump'}), false, 'the rumble setting silences everything');
assert.deepEqual(buzzes, []);

// A device with no vibration motor is normal, not an error.
const padless = new Haptics(null, {navigatorRef: {}});
padless.now = () => (clock += 100);
assert(padless.pulse({type: 'coin'}), 'a missing motor is still a handled pulse');
const throwing = new Haptics(null, {navigatorRef: {vibrate: () => {throw new Error('denied');}}});
throwing.now = () => (clock += 100);
assert(throwing.pulse({type: 'coin'}));
console.log('PASS haptic mapping, repeat suppression, impact scaling, opt-out and absent motors');
