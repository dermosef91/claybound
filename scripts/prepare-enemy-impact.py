"""Cut the supplied clay-break recording into the cue a stomped enemy makes.

Usage: python scripts/prepare-enemy-impact.py <source.wav|source.mp3> [dist/assets]

  python scripts/prepare-enemy-impact.py "new assets/Firefly_audio_Large_clay_block_breaking_variation4.wav"

The enemy a player lands on used to make a tight, generic thud. What the game
wants is the material it is made of giving way, so the cue is now a block of
clay breaking. The supplied recording is a second of 48 kHz stereo that cannot
be shipped as it arrived, and neither of the scripts beside this one can cut it:

  * `prepare-effects.py` trims trailing silence at .002 of a file's peak, which
    is below this recording's own noise floor — it would keep the full second
    and 88 KB, four tenths of it a tail no one can hear. It also does not trim
    the head at all, and this recording carries 47 ms of room tone before the
    break. That is 47 ms of latency on a cue fired the instant a player lands,
    which is exactly the delay `prepare-boot-cues.py` was written to avoid;
  * `prepare-boot-cues.py` does cut at the onset, but it is built for runs of
    footsteps and caps a cue at 340 ms (`LENGTH`), which would cut this break
    off in the middle of itself.

So: the head is cut at the onset with four milliseconds of lead, the way a boot
cue is, and the tail ends where the break has decayed into the recording it came
from. Where that end falls is not a tuned number — every threshold between
-48 dB and -40 dB lands within three milliseconds of the same place, because the
break genuinely stops there and what follows is a floor that does not decay.

The fold to mono is the same bargain the other cues make: these one-shots go
through a bare GainNode with no panner, so the second channel is bytes the game
never uses. A source whose channels would cancel is refused rather than quietly
damaged. The result stays 16-bit PCM, because AAC and Opus both carry encoder
priming that `decodeAudioData` does not uniformly strip.

The cue keeps the peak it was recorded at; `dist/audio.js` sets its level, and
pitches it a little either way on every kill so a chapter of stomps does not
wear one recording through.
"""
from pathlib import Path
import shutil, subprocess, sys, tempfile, wave
import numpy as np

NAME = 'enemy-head-impact'  # the cue this replaces, so no URL in dist/ changes
ENVELOPE = .005      # seconds of the RMS envelope the onset is found on
ONSET_LEVEL = .06    # of that envelope's peak: where the break is taken to begin
LEAD = .004          # seconds kept before the onset
SILENCE = .006       # of the file's peak: quieter than this is the room, not the break
TAIL_ROOM = .03      # seconds kept after it has decayed into that room
FADE = (.0015, .002) # seconds faded in at the cut and out at its end
MONO_TOLERANCE = .9  # refuse the fold if it keeps less of the energy than this
LOUDNESS = .05       # seconds of the loudest stretch the cue is reported by


def decode(source):
    """The source as 16-bit PCM, with any encoder's priming removed."""
    if source.suffix.lower() == '.wav':
        return source, None
    if not shutil.which('afconvert'):
        raise SystemExit(f'{source.name}: install afconvert, or supply a WAV')
    scratch = Path(tempfile.mkdtemp()) / (source.stem + '.wav')
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16', str(source), str(scratch)], check=True)
    return scratch, scratch.parent


def load(path):
    with wave.open(str(path)) as clip:
        channels, width, rate = clip.getnchannels(), clip.getsampwidth(), clip.getframerate()
        if width != 2:
            raise SystemExit(f'{path.name}: {width * 8}-bit, expected 16')
        audio = np.frombuffer(clip.readframes(clip.getnframes()), dtype='<i2').reshape(-1, channels).astype(np.float64) / 32768

    mono = audio.mean(axis=1)
    kept = np.sqrt((mono ** 2).mean()) / max(np.sqrt((audio ** 2).mean()), 1e-12)
    if channels == 2 and kept < MONO_TOLERANCE:
        raise SystemExit(f'{path.name}: the channels cancel ({kept:.3f} of the energy survives the fold)')
    return mono, rate, kept


def bounds(audio, rate):
    """Where the break begins and where it has finished, as samples."""
    window = max(1, int(ENVELOPE * rate))
    level = np.sqrt(np.convolve(audio ** 2, np.ones(window) / window, mode='same'))
    onset = int(np.argmax(level > level.max() * ONSET_LEVEL))
    audible = np.nonzero(np.abs(audio) > np.abs(audio).max() * SILENCE)[0]
    if not len(audible):
        raise SystemExit('the recording is silent')
    return (max(0, onset - int(LEAD * rate)),
            min(len(audio), int(audible[-1]) + 1 + int(TAIL_ROOM * rate)))


def cut(audio, rate, start, end):
    """The break on its own, faded at both new edges so neither can click."""
    piece = audio[start:end].copy()
    opening = max(1, int(FADE[0] * rate))
    closing = max(1, int(FADE[1] * rate))
    piece[:opening] *= np.linspace(0, 1, opening)
    piece[-closing:] *= np.linspace(1, 0, closing)
    return piece


def loudness(audio, rate):
    """The loudest short stretch of the cue — what a listener judges an impact
    by, where its whole-file RMS only measures how much silence was cut off it."""
    window = max(1, int(LOUDNESS * rate))
    return np.sqrt(np.convolve(audio ** 2, np.ones(window) / window, mode='valid')).max()


def write(path, audio, rate):
    samples = np.clip(np.rint(audio * 32768), -32768, 32767).astype('<i2')
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(rate)
        out.writeframes(samples.tobytes())


def prepare(source, folder):
    decoded, scratch = decode(source)
    try:
        audio, rate, kept = load(decoded)
    finally:
        if scratch:
            shutil.rmtree(scratch, ignore_errors=True)

    start, end = bounds(audio, rate)
    piece = cut(audio, rate, start, end)
    target = folder / f'{NAME}.wav'
    write(target, piece, rate)
    print(f'{source.name}\n  {len(audio) / rate:.2f}s in, mono keeps {kept:.3f} of the energy, '
          f'cut from {start / rate * 1000:.0f} ms to {end / rate * 1000:.0f} ms')
    print(f'  {target.name:22} {len(piece) / rate * 1000:5.0f}ms  '
          f'peak {20 * np.log10(np.abs(piece).max()):5.1f} dB  '
          f'loudest {LOUDNESS * 1000:.0f} ms {20 * np.log10(loudness(piece, rate)):5.1f} dB  '
          f'{target.stat().st_size / 1024:4.0f} KB')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__.strip().splitlines()[2].strip())
    source = Path(sys.argv[1])
    if not source.is_file():
        raise SystemExit(f'{source}: no such file')
    folder = Path(sys.argv[2] if len(sys.argv) > 2 else 'dist/assets')
    if not folder.is_dir():
        raise SystemExit(f'{folder}: no such folder')
    prepare(source, folder)
