// gamepad.js and haptics.js read globalThis.navigator by default; the tests pass
// their own, so re-export both through one module for a single import line.
export {GamepadInput, stickAxis, padAxis, DEAD_ZONE, BUTTONS} from '../dist/gamepad.js';
export {Haptics, PULSES} from '../dist/haptics.js';
