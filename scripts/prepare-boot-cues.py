"""Cut the supplied boot recordings into the one-shots the game fires.

Usage: python scripts/prepare-boot-cues.py <source.mp3|source.wav> <name> [--takes N] [dist/assets]

  python scripts/prepare-boot-cues.py "new assets/jump.mp3" jump
  python scripts/prepare-boot-cues.py "new assets/footsteps-walking-on-wood-….mp3" wood-step --takes 3
  python scripts/prepare-boot-cues.py "new assets/footsteps-running-on-gravel-….mp3" clay-step --takes 3

The three sources are a single jump thud and two runs of consecutive footsteps,
all as 44.1 kHz stereo MP3s. What the game needs instead is one short mono PCM
cue per sound, because `decodeAudioData` keeps the byte-exact PCM path on every
browser while AAC and Opus carry encoder priming it does not uniformly strip —
and a leading 40 ms on a footstep is the latency this game cannot afford, as
`prepare-effects.py` already records. So:

  * the MP3 is decoded through afconvert, which drops the encoder's priming
    frames, and folded to mono, which these cues are played as anyway — they go
    through a bare GainNode with no panner. A source whose channels would lose
    energy to the fold is refused rather than quietly damaged;
  * each hit is cut at its own onset, keeping four milliseconds of lead, so the
    sound starts when the boot lands and not when the microphone was switched
    on. The supplied jump carries 35 ms of room tone ahead of its attack, which
    is 35 ms of delay on the most frequent cue in the game;
  * each hit ends where its own decay reaches the noise floor of the recording
    it came from, so the file holds the step rather than the room. The rest is
    a flat floor that does not decay, and several of them overlapping while a
    player runs would be audible as hiss where one is not;
  * the takes of one set are picked for difference, not for loudness: of every
    candidate step, the combination whose members correlate least is chosen, so
    three takes actually sound like three boots rather than one boot three
    times. The wood recording, for instance, is eight steps and then those same
    eight steps again.

One gain normalizes a whole set, so the takes keep the loudness differences
they were recorded with; the runtime varies pitch and level per step on top.
"""
from pathlib import Path
import shutil, subprocess, sys, tempfile, wave
import numpy as np

ENVELOPE = .005     # seconds of the RMS envelope that finds hits and their ends
HIT_LEVEL = .12     # of the recording's peak envelope: quieter is not a step
HIT_GAP = .15       # seconds; two hits closer than this are one hit
ONSET_LEVEL = .06   # of a hit's own envelope: where its attack is taken to begin
LEAD = .004         # seconds kept before that onset
TAIL_ROOM = .02     # seconds kept after a hit has decayed into the room
LENGTH = (.06, .34) # seconds a cut cue may last
FADE = (.0015, .004)# seconds faded in at the cut and out at its end
LOUDNESS = .02      # seconds of the loudest stretch a take is levelled by
PEAK = .9           # the loudest take of a set, so runtime gain means loudness
MONO_TOLERANCE = .9 # keep stereo if the downmix retains less than this energy


def decode(source):
    """The supplied MP3s as 16-bit PCM, with the encoder's priming removed."""
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


def envelope(audio, rate):
    window = max(1, int(ENVELOPE * rate))
    return np.sqrt(np.convolve(audio ** 2, np.ones(window) / window, mode='same'))


def hits(audio, rate):
    """Every candidate one-shot in the recording, as (onset, end) samples."""
    level = envelope(audio, rate)
    floor = np.quantile(level, .1)          # the recording's own room tone
    gap, loud = int(HIT_GAP * rate), level.max() * HIT_LEVEL
    found, i = [], 0
    while i < len(level):
        if level[i] <= loud:
            i += 1
            continue
        crest = i + int(np.argmax(level[i:i + gap]))
        start = crest
        while start > 0 and level[start] > level[crest] * ONSET_LEVEL:
            start -= 1
        # The hit is over where it has decayed into the room it was recorded in.
        quiet = max(floor * 1.5, level[crest] * .02)
        end = crest
        while end < len(level) - 1 and level[end] > quiet:
            end += 1
        found.append([max(0, start - int(LEAD * rate)),
                      min(len(audio), end + int(TAIL_ROOM * rate))])
        i = crest + gap
    # A boot in a run lands before the last one has finished decaying. Each cue
    # ends at the next attack at the latest, so no take carries a second step.
    for hit, following in zip(found, found[1:]):
        hit[1] = min(hit[1], following[0])
    return [(start, end) for start, end in found if end - start >= LENGTH[0] * rate]


def distinct(audio, rate, cuts, takes):
    """The combination of `takes` cuts whose members resemble each other least.

    Correlation is measured on a common window of each hit's opening, which is
    what a listener hears of a footstep, and compared in the spectrum so that
    two boots landing a few milliseconds apart in their cut do not read as
    different sounds when they are the same sound.
    """
    from itertools import combinations
    if takes < 2:
        return [max(cuts, key=lambda bounds: np.abs(audio[bounds[0]:bounds[1]]).max())], None
    span = min(int(.12 * rate), min(e - s for s, e in cuts))
    shapes = []
    for s, _ in cuts:
        piece = audio[s:s + span] * np.hanning(span)
        spectrum = np.abs(np.fft.rfft(piece))
        shapes.append(spectrum / max(np.linalg.norm(spectrum), 1e-12))
    shapes = np.array(shapes)
    similarity = shapes @ shapes.T
    best, cost = None, None
    for combination in combinations(range(len(cuts)), takes):
        worst = max(similarity[a, b] for a, b in combinations(combination, 2))
        if cost is None or worst < cost:
            best, cost = combination, worst
    return [cuts[i] for i in best], cost


def cut(audio, rate, bounds):
    piece = audio[bounds[0]:min(bounds[1], bounds[0] + int(LENGTH[1] * rate))].copy()
    for fade, weights in ((FADE[0], np.linspace(0, 1, max(1, int(FADE[0] * rate)))),
                          (FADE[1], np.linspace(1, 0, max(1, int(FADE[1] * rate))))):
        length = len(weights)
        if fade == FADE[0]:
            piece[:length] *= weights
        else:
            piece[-length:] *= weights
    return piece


def loudness(audio, rate):
    """The loudest short stretch of a cue — what a listener judges an impact by,
    where its whole-file RMS only measures how much silence was cut off it."""
    window = max(1, int(LOUDNESS * rate))
    return np.sqrt(np.convolve(audio ** 2, np.ones(window) / window, mode='valid')).max()


def write(path, audio, rate):
    samples = np.clip(np.rint(audio * 32768), -32768, 32767).astype('<i2')
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(rate)
        out.writeframes(samples.tobytes())


def prepare(source, name, takes, folder):
    decoded, scratch = decode(source)
    try:
        audio, rate, kept = load(decoded)
    finally:
        if scratch:
            shutil.rmtree(scratch, ignore_errors=True)

    candidates = hits(audio, rate)
    if len(candidates) < takes:
        raise SystemExit(f'{source.name}: found {len(candidates)} hits, needed {takes}')
    chosen, similarity = distinct(audio, rate, candidates, takes)
    chosen.sort()

    pieces = [cut(audio, rate, bounds) for bounds in chosen]
    # The takes of a set are levelled to each other, not just peak-normalized:
    # a footstep fires every stride, and three boots that differ in loudness
    # read as an uneven walk where three that differ only in timbre read as
    # three boots. The runtime varies level and pitch per step on top of this.
    if takes > 1:
        loud = [loudness(piece, rate) for piece in pieces]
        middle = float(np.median(loud))
        pieces = [piece * (middle / max(level, 1e-12)) for piece, level in zip(pieces, loud)]
    gain = PEAK / max(max(np.abs(piece).max() for piece in pieces), 1e-12)
    print(f'{source.name}\n  {len(audio) / rate:.2f}s, {len(candidates)} hits, '
          f'mono keeps {kept:.3f} of the energy, set gain {gain:.2f}'
          + (f', takes correlate at most {similarity:.2f}' if takes > 1 else ''))
    for i, (piece, (start, _)) in enumerate(zip(pieces, chosen), 1):
        piece = piece * gain
        target = folder / (f'{name}.wav' if takes == 1 else f'{name}-{i}.wav')
        write(target, piece, rate)
        print(f'  {target.name:16} from {start / rate:6.3f}s  {len(piece) / rate * 1000:5.0f}ms  '
              f'peak {20 * np.log10(np.abs(piece).max()):5.1f} dB  '
              f'loudest {LOUDNESS * 1000:.0f} ms {20 * np.log10(loudness(piece, rate)):5.1f} dB  '
              f'{target.stat().st_size / 1024:4.0f} KB')


if __name__ == '__main__':
    arguments = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    if len(arguments) < 2:
        raise SystemExit(__doc__.splitlines()[2])
    takes = next((int(f.split('=')[1]) for f in flags if f.startswith('--takes=')), None)
    if takes is None and '--takes' in sys.argv:
        takes = int(sys.argv[sys.argv.index('--takes') + 1])
        arguments = [a for a in arguments if a != str(takes)]
    prepare(Path(arguments[0]), arguments[1], takes or 1,
            Path(arguments[2] if len(arguments) > 2 else 'dist/assets'))
