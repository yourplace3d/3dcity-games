# The intro film's sound: an original synthwave bed (A minor, 120 BPM) with hits and type blips on the film's cuts.
# python3 tools/intro-sound.py <out.wav> [seconds of the five steps' starts, comma separated]
# Timings below follow tools/intro-cut.mjs: opener 1.3 s, footage, rise, slab.
import sys
import wave
import numpy as np

SR = 44100
OUT = sys.argv[1]
TOTAL = 28.27
OPEN = 1.3
STEPS = [float(v) for v in sys.argv[2].split(',')] if len(sys.argv) > 2 else [3.3, 5.0, 8.3, 11.1, 14.7]
RISE = 17.9      # the camera starts to climb
ASK = 19.6       # "guess the city" comes back
SLAB = 23.07     # the city tips away
MARK = 24.8      # the wordmark
PLAY = 25.4      # "or play the city"
BEAT = 0.5
DRUMS = 1.5      # the beat comes in with the street

N = int(TOTAL * SR)
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(3)


def put(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * (1 - max(0, pan))
    R[i:i + len(sig)] += sig * gain * (1 + min(0, pan))


def t(d):
    return np.arange(int(d * SR)) / SR


def lowpass(x, hz):
    # one pole, hz may be an array
    a = 1 - np.exp(-2 * np.pi * np.asarray(hz, dtype=float) / SR)
    a = np.broadcast_to(a, x.shape)
    y = np.empty_like(x)
    s = 0.0
    for k in range(len(x)):
        s += a[k] * (x[k] - s)
        y[k] = s
    return y


def saw(f, d, detune=0.0):
    x = t(d)
    out = np.zeros_like(x)
    for dt in (-detune, 0, detune) if detune else (0,):
        ph = (x * f * (1 + dt)) % 1
        out += 2 * ph - 1
    return out / (3 if detune else 1)


def square(f, d, duty=0.5):
    return np.where((t(d) * f) % 1 < duty, 1.0, -1.0)


def env(d, a=0.005, r=0.05):
    x = t(d)
    return np.minimum(1, x / a) * np.minimum(1, (d - x) / r).clip(0)


def note(n):  # midi to Hz
    return 440 * 2 ** ((n - 69) / 12)


def kick():
    x = t(0.32)
    f = 48 + 110 * np.exp(-x * 38)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 9) + 0.25 * rng.standard_normal(len(x)) * np.exp(-x * 400)


def snare():
    x = t(0.3)
    n = rng.standard_normal(len(x))
    n = n - lowpass(n, 1800)
    return (0.8 * n * np.exp(-x * 13) + 0.5 * np.sin(2 * np.pi * 190 * x) * np.exp(-x * 30))


def hat(d=0.05):
    x = t(d)
    n = rng.standard_normal(len(x))
    return (n - lowpass(n, 7000)) * np.exp(-x * 90)


def boom(d=2.6):
    x = t(d)
    f = 38 + 60 * np.exp(-x * 6)
    n = lowpass(rng.standard_normal(len(x)), 900 * np.exp(-x * 2.5) + 60)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 1.6) + 1.5 * n * np.exp(-x * 3)


def riser(d):
    x = t(d)
    n = rng.standard_normal(len(x))
    n = lowpass(n, 300 * (40 ** (x / d)))
    tone = np.sin(2 * np.pi * np.cumsum(110 * 4 ** (x / d)) / SR)
    return (1.4 * n + 0.25 * tone) * (x / d) ** 2


def blips(chars, hz=1760):
    out = np.zeros(int((chars / 30 + 0.05) * SR))
    for c in range(chars):
        b = square(hz * (1 if c % 3 else 1.5), 0.018, 0.25) * env(0.018, 0.001, 0.01)
        i = int(c / 30 * SR)
        out[i:i + len(b)] += b
    return out


# ---- the bed: Am | F | C | G, a bar is four beats
CHORDS = [(45, [57, 60, 64, 69]), (41, [57, 60, 65, 69]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]
BAR = 4 * BEAT
duck = np.ones(N)  # the kick pushes the rest down for a moment
bars = int(np.ceil((TOTAL - DRUMS) / BAR))
for b in range(bars):
    t0 = DRUMS + b * BAR
    root, tones = CHORDS[b % 4]
    full = t0 < RISE - 0.01          # full beat until the camera climbs
    quiet = RISE <= t0 < SLAB - 0.5  # the climb: no drums, the arp thins out
    after = t0 >= SLAB - 0.5         # the slab: half-time, wide
    # pad
    d = BAR + 0.3
    pad = sum(saw(note(n), d, 0.004) for n in tones) / 4
    pad = lowpass(pad, 900 if full else 1500) * env(d, 0.25, 0.4)
    put(pad, t0, 0.20 if full else 0.28)
    for k in range(8):  # eighths
        tk = t0 + k * BEAT / 2
        if tk >= TOTAL - 0.2:
            break
        if not quiet:
            bs = saw(note(root - 12), 0.22, 0.003) + 0.6 * np.sin(2 * np.pi * note(root - 12) * t(0.22))
            bs = lowpass(bs, 500 * np.exp(-t(0.22) * 9) + 120) * env(0.22, 0.004, 0.05)
            if full or k % 2 == 0:
                put(bs, tk, 0.55)
        if full and k % 2 == 1:
            put(hat(), tk, 0.10, 0.3)
    for k in range(16):  # sixteenths: the arp, up and over the chord
        tk = t0 + k * BEAT / 4
        if tk >= TOTAL - 0.4 or (quiet and k % 2):
            continue
        n = tones[[0, 1, 2, 3, 2, 1, 2, 3][k % 8]] + 12
        a = (square(note(n), 0.11, 0.3) * 0.6 + saw(note(n), 0.11)) * env(0.11, 0.003, 0.06)
        a = lowpass(a, 3200)
        for echo, g in ((0, 1.0), (0.375, 0.35), (0.75, 0.14)):
            put(a, tk + echo, 0.085 * g, 0.5 if (k + (echo > 0)) % 2 else -0.5)
    for k in range(4):  # beats
        tk = t0 + k * BEAT
        if tk >= TOTAL - 1.2:
            break
        if full or (after and k % 2 == 0):
            put(kick(), tk, 0.85)
            i = int(tk * SR)
            x = t(0.3)
            duck[i:i + len(x)] *= (1 - 0.55 * np.exp(-x * 14))[: N - i]
        if (full and k % 2 == 1) or (after and k == 2):
            put(snare(), tk, 0.34)
L *= duck
R *= duck

# ---- the opener: flash, then the grid hums until the street
put(boom(2.2), 0.0, 0.6)
x = t(1.5)
hum = lowpass(saw(55, 1.5, 0.006), 200 + 1400 * (x / 1.5) ** 2) * env(1.5, 0.15, 0.1)
put(hum, 0.05, 0.35)
put(riser(0.9), DRUMS - 0.9, 0.18)

# ---- the cuts
put(blips(13), 0.45, 0.07)
for s, chars in zip(STEPS, (15, 20, 17, 23, 18)):
    put(blips(chars), s, 0.06, 0.2)
    put(lowpass(rng.standard_normal(int(0.25 * SR)), 2500) * np.exp(-t(0.25) * 16), s - 0.02, 0.22)
# the police: a two-tone wail under the fifth step
d = RISE - STEPS[4]
x = t(d)
wail = np.sin(2 * np.pi * np.cumsum(np.where((x * 1.6) % 1 < 0.5, 660.0, 880.0)) / SR) * env(d, 0.2, 0.6)
put(lowpass(wail, 1800), STEPS[4], 0.045, -0.4)
# the climb, the question, the slab, the name
put(riser(SLAB - RISE), RISE, 0.3)
put(blips(13), ASK, 0.07)
put(boom(3.0), SLAB, 0.75)
x = t(1.2)
put(lowpass(rng.standard_normal(len(x)), 6000 * np.exp(-x * 3) + 200) * np.exp(-x * 2.5), SLAB, 0.3)
stab = sum(saw(note(n), 2.6, 0.005) for n in (57, 64, 69, 72, 76)) / 5
stab = lowpass(stab, 400 + 4000 * np.exp(-t(2.6) * 1.6)) * env(2.6, 0.01, 1.4)
put(stab, MARK, 0.5)
put(boom(1.6), MARK, 0.5)
put(blips(16), PLAY, 0.07)

# ---- out: fade the tail, keep it off the ceiling
fade = np.clip((TOTAL - np.arange(N) / SR) / 1.6, 0, 1)
mix = np.stack([L * fade, R * fade], axis=1)
mix = np.tanh(mix * 1.5) / np.tanh(1.5)
mix *= 0.89 / np.abs(mix).max()
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('wrote', OUT, round(TOTAL, 2), 's')
