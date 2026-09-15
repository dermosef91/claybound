"""Tighten the sampled effects without changing how they sound.

Usage: python scripts/prepare-effects.py [dist/assets]

Two lossless-in-practice passes, no re-encoding and no format change, so
decodeAudioData keeps the byte-exact PCM path every browser supports and the
one-shots keep firing on the sample they fire on today:

  * trailing silence is cut (several cues carry up to half a second of it),
    with a two-millisecond fade so the new end cannot click;
  * stereo is folded to mono, which these cues are played as anyway — they go
    through a bare GainNode with no panner. A file whose channels would lose
    energy to phase cancellation keeps both, so nothing is quietly damaged.

A compressed format would save more, but AAC and Opus both carry encoder
priming that decodeAudioData does not uniformly strip, and a leading 40 ms on
an impact sound is exactly the latency this game cannot afford.
"""
from pathlib import Path
import sys, wave
import numpy as np

SILENCE = 0.002      # relative to the file's own peak
TAIL = 0.05          # seconds of room kept after the last audible sample
FADE = 0.002         # seconds faded out at the new end
MONO_TOLERANCE = 0.9 # keep stereo if the downmix retains less than this energy


def tighten(path):
    with wave.open(str(path)) as source:
        channels, width, rate, frames = (source.getnchannels(), source.getsampwidth(),
                                         source.getframerate(), source.getnframes())
        if width != 2:
            return f'{path.name}: {width * 8}-bit, skipped'
        audio = np.frombuffer(source.readframes(frames), dtype='<i2').reshape(-1, channels).astype(np.float32)

    envelope = np.abs(audio).max(axis=1)
    audible = np.nonzero(envelope > envelope.max() * SILENCE)[0]
    end = min(len(audio), int(audible[-1]) + 1 + int(TAIL * rate)) if len(audible) else len(audio)
    audio = audio[:end]

    if channels == 2:
        mono = audio.mean(axis=1)
        # Energy the fold keeps. Inverted channels cancel; those files stay stereo.
        kept = np.sqrt((mono ** 2).mean()) / max(np.sqrt((audio ** 2).mean()), 1e-9)
        if kept >= MONO_TOLERANCE:
            audio, channels = mono.reshape(-1, 1), 1

    fade = min(int(FADE * rate), len(audio))
    if fade:
        audio[-fade:] *= np.linspace(1, 0, fade)[:, None]

    samples = np.clip(np.rint(audio), -32768, 32767).astype('<i2')
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(channels); out.setsampwidth(2); out.setframerate(rate)
        out.writeframes(samples.tobytes())
    return channels, end / rate


if __name__ == '__main__':
    folder = Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/assets')
    before = after = 0
    for path in sorted(folder.glob('*.wav')):
        was = path.stat().st_size
        result = tighten(path)
        if isinstance(result, str):
            print(result); continue
        channels, seconds = result
        now = path.stat().st_size
        before += was; after += now
        print(f"{path.name:26} {was / 1024:7.0f} KB → {now / 1024:6.0f} KB  "
              f"({'mono' if channels == 1 else 'stereo'}, {seconds:.2f}s)")
    if before:
        print(f"\n{'total':26} {before / 1024:7.0f} KB → {after / 1024:6.0f} KB  (−{1 - after / before:.0%})")
