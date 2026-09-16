"""Turn the supplied canyon wind recording into a seamless ambient loop.

Usage: python scripts/prepare-canyon-wind.py <source.wav> [dist/assets/canyon-wind.wav]

The recording is a gusting rumble, and measurement decides every step here —
the script prints what it kept and refuses a source the settings would damage:

  * stereo is folded to mono; the two channels of this recording are 99.98%
    correlated, so the fold is free, and the bed plays through a bare GainNode
    with no panner anyway;
  * 86% of the recording's energy sits below 20 Hz and 94% below 30 Hz, none of
    which any speaker a player owns can reproduce. That infrasound is removed
    with a zero-phase high-pass, so the level the game sets is the level the
    player hears instead of headroom spent on cone excursion;
  * what survives holds nothing above 2 kHz, so the file is resampled to 12 kHz,
    which keeps everything up to 6 kHz and drops 432 KB to about 45 KB;
  * the last of the clip is crossfaded into its head, so a looping
    AudioBufferSourceNode wraps without a seam.

Filtering and resampling share one FFT, which is the honest transform for a
clip that is about to be looped: it treats the recording as periodic, which is
exactly what the game will do with it.
"""
from pathlib import Path
import sys, wave
import numpy as np

RATE = 12000       # output sample rate; Nyquist 6 kHz
SUB = (20., 45.)   # high-pass: silent below 20 Hz, untouched above 45 Hz
FADE = .35         # seconds of the tail crossfaded into the head
PEAK = .9          # normalized so the runtime gain describes audible loudness
KEEP = .9999       # of the audible (above SUB) power the resample must retain


def prepare(source, target):
    with wave.open(str(source)) as clip:
        channels, width, rate, frames = (clip.getnchannels(), clip.getsampwidth(),
                                         clip.getframerate(), clip.getnframes())
        if width != 2:
            raise SystemExit(f'{source.name}: {width * 8}-bit, expected 16')
        audio = np.frombuffer(clip.readframes(frames), dtype='<i2').reshape(-1, channels).astype(np.float64) / 32768

    mono = audio.mean(axis=1)
    kept = np.sqrt((mono ** 2).mean()) / max(np.sqrt((audio ** 2).mean()), 1e-12)
    if channels == 2 and kept < .9:
        raise SystemExit(f'{source.name}: the channels cancel ({kept:.3f} of the energy survives the fold)')

    spectrum = np.fft.rfft(mono)
    freqs = np.fft.rfftfreq(len(mono), 1 / rate)
    power = np.abs(spectrum) ** 2

    # Everything the resample would fold back as aliasing has to be silent
    # first; this source has nothing up there at all, but a future recording
    # might, and a quietly damaged loop is worse than a refusal.
    audible = power[freqs >= SUB[1]].sum()
    if audible and power[(freqs >= SUB[1]) & (freqs < RATE / 2)].sum() / audible < KEEP:
        raise SystemExit(f'{source.name}: too much content above {RATE // 2} Hz to resample')

    # One pass: a raised-cosine high-pass, then a truncation to the new Nyquist.
    low, high = SUB
    ramp = np.clip((freqs - low) / (high - low), 0, 1)
    response = .5 - .5 * np.cos(np.pi * ramp)
    removed = 1 - (power * response ** 2).sum() / power.sum()
    spectrum = spectrum * response
    length = round(len(mono) * RATE / rate)
    loop = np.fft.irfft(spectrum[:length // 2 + 1], n=length) * (length / len(mono))

    # Wrap the tail onto the head. Equal-power weights keep a noisy bed at a
    # constant loudness across the join, where a linear pair would dip.
    fade = int(FADE * RATE)
    tail, loop = loop[len(loop) - fade:], loop[:len(loop) - fade].copy()
    blend = np.linspace(0, 1, fade, endpoint=False)
    loop[:fade] = loop[:fade] * np.sqrt(blend) + tail * np.sqrt(1 - blend)

    loop *= PEAK / max(np.abs(loop).max(), 1e-12)
    samples = np.clip(np.rint(loop * 32768), -32768, 32767).astype('<i2')
    with wave.open(str(target), 'wb') as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(RATE)
        out.writeframes(samples.tobytes())

    # The seam is only as good as its two neighbours: compare the energy across
    # the wrap with the energy of an ordinary interior stretch of the same size.
    edge = np.concatenate([loop[-240:], loop[:240]])
    interior = loop[len(loop) // 2 - 240:len(loop) // 2 + 240]
    return {
        'seconds': len(loop) / RATE,
        'bytes': target.stat().st_size,
        'inaudible energy cut': removed,
        'rms': float(np.sqrt((loop ** 2).mean())),
        'seam step': float(np.abs(np.diff(edge)).max() / max(np.abs(np.diff(interior)).max(), 1e-12)),
    }


if __name__ == '__main__':
    source = Path(sys.argv[1])
    target = Path(sys.argv[2] if len(sys.argv) > 2 else 'dist/assets/canyon-wind.wav')
    for name, value in prepare(source, target).items():
        print(f'{name:>20}: {value:.4f}' if isinstance(value, float) else f'{name:>20}: {value}')
