// Touch and pad feedback for the events the player causes. Kept as one table so
// the whole feel of the device in your hands can be read and tuned in one place,
// rather than being spread across the event handler.
//
// Phone durations are short on purpose: a platformer fires these several times a
// second, and anything above roughly 20ms for a routine action reads as a buzz
// rather than a tap.
export const PULSES = Object.freeze({
  jump:     {phone: 8,  duration: 70,  strong: .12, weak: .30},
  land:     {phone: 12, duration: 90,  strong: .22, weak: .18},
  spring:   {phone: 16, duration: 130, strong: .30, weak: .45},
  coin:     {phone: 5,  duration: 40,  strong: 0,   weak: .22},
  stamp:    {phone: 22, duration: 200, strong: .25, weak: .55},
  squish:   {phone: 14, duration: 110, strong: .42, weak: .25},
  break:    {phone: 18, duration: 140, strong: .48, weak: .30},
  hurt:     {phone: 34, duration: 240, strong: .70, weak: .40},
  fall:     {phone: 42, duration: 300, strong: .80, weak: .35},
  checkpoint: {phone: 18, duration: 160, strong: .18, weak: .42},
  shape:    {phone: 10, duration: 80,  strong: .26, weak: .20},
  spitterfire: {phone: 0, duration: 0, strong: 0, weak: 0},
});

// A land at walking pace should not feel like a land from four storeys up.
const scaleForEvent = event =>
  event.type === 'land' ? Math.min(1, Math.max(.35, (event.impact || 6) / 16)) : 1;

export class Haptics {
  constructor(pads, {enabled = true, navigatorRef = globalThis.navigator} = {}) {
    this.pads = pads;
    this.enabled = enabled;
    this.navigator = navigatorRef;
    // Never suppress the first pulse of a session.
    this.last = -Infinity;
    // Bursts of identical events (a coin run, a stair of landings) must not
    // stack into one long buzz.
    this.minimumGap = 28;
  }
  now() { return globalThis.performance?.now?.() ?? Date.now(); }
  pulse(event) {
    if (!this.enabled) return false;
    const pulse = PULSES[event?.type];
    if (!pulse) return false;
    const time = this.now();
    if (time - this.last < this.minimumGap) return false;
    this.last = time;
    const scale = scaleForEvent(event);
    const phone = Math.round(pulse.phone * scale);
    // The pad is the better instrument when one is connected; the phone motor
    // still fires, because a player may be holding both.
    if (pulse.duration) this.pads?.rumble(Math.round(pulse.duration * scale), pulse.strong * scale, pulse.weak * scale);
    if (phone > 0) { try { this.navigator?.vibrate?.(phone); } catch {} }
    return true;
  }
  silence() { try { this.navigator?.vibrate?.(0); } catch {} }
}
