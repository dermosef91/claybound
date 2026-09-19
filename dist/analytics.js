// Product analytics for the hosted game: where players stop, and whether the
// machine in front of them could run it.
//
// Four rules shape this module, and every one of them is load-bearing.
//
// It is **silent everywhere but the Firebase deployment**. GitHub Pages serves
// the identical bundle and a developer serves dist/ straight off a local
// static server, so a module that reported from wherever it found itself would
// mix three populations into one number. The host allowlist below is the whole
// gate; nothing else in the game checks where it is running.
//
// It is **side-effect free until initAnalytics runs**. Tests import dist/
// modules into bare Node with no DOM, and one of them evaluates app.js inside a
// node:vm context that has no navigator, no location and no fetch. So nothing
// here touches window, document or location at module scope, and the PostHog
// SDK is only imported once init has decided it is wanted.
//
// It **never throws into the game**. A blocked request, a wiped localStorage, a
// content blocker that removed the SDK — none of these are the player's
// problem, so every entry point swallows its own failure.
//
// And it captures **anonymous events only** (`person_profiles:'identified_only'`
// with nothing ever identified). The game has no accounts and asks for nothing.
//
// The project key is public by design: PostHog project keys are write-only
// ingest keys meant to ship in client code. It is a constant here rather than a
// build-time variable because dist/ has to stay servable with no build step.

// Replace with the phc_… project key, then redeploy. Until it is filled in,
// initAnalytics returns false and the whole module stays inert — which is why a
// half-finished setup can never send events to nowhere.
const PROJECT_KEY = 'phc_REPLACE_WITH_PROJECT_KEY';
const API_HOST = 'https://eu.i.posthog.com';

// The two addresses Firebase Hosting answers on for this project. Pages
// (dermosef91.github.io) and localhost are deliberately absent.
const HOSTS = new Set(['claybound-56949.web.app', 'claybound-56949.firebaseapp.com']);

// A frame slower than this reads as a stutter rather than a slow machine.
const SLOW_FRAME = 1 / 30;

let client = null;
let frames = 0, elapsed = 0, slow = 0, worst = 0;

/** Whether a hostname is one the hosted game reports from. */
export const reportsFrom = host => HOSTS.has(host);

/** Whether the module is live — false before init, and on every other host. */
export const active = () => !!client;

// Start PostHog, unless this is not the hosted game, the key was never filled
// in, or the player has turned analytics off. Resolves to whether it started.
export async function initAnalytics({host = '', enabled = true} = {}) {
  if (client || !enabled || !reportsFrom(host)) return false;
  if (!PROJECT_KEY.startsWith('phc_') || PROJECT_KEY.includes('REPLACE')) return false;
  try {
    const {posthog} = await import('./lib/posthog.js');
    posthog.init(PROJECT_KEY, {
      api_host: API_HOST,
      defaults: '2025-05-24',
      // Anonymous events, no person profiles: nobody signs in, so a profile
      // per visitor would be a cost and a liability for no added insight.
      person_profiles: 'identified_only',
      // localStorage, not cookies. Returning players are still recognised --
      // which is the whole point of retention -- without a cookie banner.
      persistence: 'localStorage',
      // The game is one canvas. Autocapture would record clicks on a handful
      // of menu buttons and nothing that happens inside the world, so every
      // event here is deliberate.
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: true,
      disable_session_recording: true
    });
    client = posthog;
    return true;
  } catch (err) {
    // A content blocker eating the SDK is the common case and is not an error
    // worth a console line in a player's browser.
    return false;
  }
}

/** Send one event. A no-op before init, off-host, or when opted out. */
export function track(name, props = {}) {
  if (!client) return;
  try { client.capture(name, props); } catch {}
}

// Flip capture at runtime from the Settings switch. Turning it back on after
// init has been skipped entirely (the player started opted out) does nothing
// until the next load, which is the honest trade for never loading the SDK.
export function setAnalyticsEnabled(on) {
  if (!client) return;
  try { on ? client.opt_in_capturing() : client.opt_out_capturing(); } catch {}
}

// Push whatever is queued before the tab goes away. pagehide is the last
// reliable moment on mobile Safari, and a normal request would be cancelled.
export function flush() {
  if (!client) return;
  try { client.capture('$pageleave', {}, {transport: 'sendBeacon'}); } catch {}
}

// Frame cost, accumulated by the game loop and drained when a chapter ends.
// Two adds and a compare per frame: cheap enough to sit in the hot path.
export function sampleFrame(dt) {
  if (!client || !(dt > 0) || dt > 1) return;
  frames++; elapsed += dt;
  if (dt > SLOW_FRAME) slow++;
  if (dt > worst) worst = dt;
}

// The frames since the last drain, as properties to hang on an event. Returns
// null below a second of play, where the average would be noise.
export function frameSummary() {
  if (frames < 30 || elapsed < 1) { frames = elapsed = slow = worst = 0; return null; }
  const summary = {
    fps_mean: Math.round(frames / elapsed),
    slow_frame_pct: Math.round((slow / frames) * 100),
    worst_frame_ms: Math.round(worst * 1000),
    frames_sampled: frames
  };
  frames = elapsed = slow = worst = 0;
  return summary;
}

// What the player's machine is, read off the live WebGL context. The unmasked
// strings need an extension the browser may withhold; the masked ones are
// always there and are usually enough to tell a software rasteriser from a GPU.
export function rendererInfo(renderer) {
  try {
    const gl = renderer?.getContext?.();
    if (!gl) return {};
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      gl_renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      gl_vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)
    };
  } catch { return {}; }
}
