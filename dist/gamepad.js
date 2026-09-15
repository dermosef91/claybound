// Standard-mapping gamepad reading. The button map lives here as one readable
// table instead of magic indices scattered through the frame loop, and the
// analog stick arrives as the same signed axis the touch joystick produces, so
// the rest of the app never learns which device is steering.
export const DEAD_ZONE = .24;
export const AXIS_CURVE = 1.5;

// Standard mapping: 0 A/cross, 1 B/circle, 2 X/square, 3 Y/triangle,
// 6/7 triggers, 9 start, 12–15 d-pad up/down/left/right.
export const BUTTONS = Object.freeze({
  jump: [0, 3],
  stomp: [1, 2, 7, 13],
  pause: [9, 8],
  left: [14],
  right: [15],
});

export function stickAxis(value) {
  if (!Number.isFinite(value) || Math.abs(value) < DEAD_ZONE) return 0;
  const amount = (Math.abs(value) - DEAD_ZONE) / (1 - DEAD_ZONE);
  return Math.sign(value) * Math.min(1, amount) ** AXIS_CURVE;
}

const pressed = (pad, index) => !!pad.buttons[index]?.pressed || (pad.buttons[index]?.value ?? 0) > .5;
const anyPressed = (pad, indices) => indices.some(index => pressed(pad, index));

// The d-pad wins over a resting stick, and the stick wins over a resting d-pad,
// so a player can use either without one silently cancelling the other.
export function padAxis(pad) {
  const digital = Number(anyPressed(pad, BUTTONS.right)) - Number(anyPressed(pad, BUTTONS.left));
  return digital || stickAxis(pad.axes?.[0]);
}

export class GamepadInput {
  constructor(navigatorRef = globalThis.navigator) {
    this.navigator = navigatorRef;
    this.held = new Set();
    this.axis = 0;
    this.active = false;
    this.pad = null;
  }
  pads() {
    try { return [...(this.navigator?.getGamepads?.() || [])].filter(pad => pad?.connected); }
    catch { return []; }
  }
  // One poll per frame. Returns the edges the frame loop needs; `active` says
  // whether a pad is touched at all, so keyboard and touch keep priority when
  // a stick is merely resting off-centre.
  poll() {
    const pads = this.pads();
    this.pad = pads[0] || null;
    const down = new Set();
    let axis = 0;
    for (const pad of pads) {
      axis = axis || padAxis(pad);
      for (const [name, indices] of Object.entries(BUTTONS)) if (anyPressed(pad, indices)) down.add(name);
    }
    const edge = name => down.has(name) && !this.held.has(name);
    const state = {
      connected: pads.length > 0,
      axis,
      jumpHeld: down.has('jump'),
      jumpPressed: edge('jump'),
      stompPressed: edge('stomp'),
      pausePressed: edge('pause'),
    };
    this.held = down;
    this.axis = axis;
    this.active = state.connected && (axis !== 0 || down.size > 0);
    return state;
  }
  // Gamepads that cannot rumble simply report nothing; never let that throw
  // into the frame loop.
  rumble(duration, strong, weak) {
    const actuator = this.pad?.vibrationActuator;
    if (!actuator?.playEffect) return false;
    try {
      const effect = actuator.playEffect('dual-rumble', {
        duration, startDelay: 0, strongMagnitude: strong, weakMagnitude: weak,
      });
      effect?.catch?.(() => {});
      return true;
    } catch { return false; }
  }
}
