"""
Chewinstein Comedy Physics Audio, BGM & Foley Generator
(/home/antigravity/chewinstein-mc2-short/audio/generate_audio.py)

Synthesizes:
  1. All 12 multi-character dialogue lines via Kokoro ONNX (`am_puck` narrator,
     `bm_george` Chewinstein pan -0.15, `af_bella` Sassy Atom pan +0.16)
     using shared `audio/dspCore.py` (`atempo` in [0.88, 1.24]).
  2. Playful, expressive 114 BPM science-comedy underscore (`bgm_bus`, 30.0s stereo 44.1 kHz):
     - Beats 1-3 & 5-6: Bouncy pizzicato/marimba melody, warm plucky upright bassline,
       and light crisp woodblock/shaker percussion groove.
     - Beat 2 (4.5..9.8s): Quirky slow-down wobble/tremolo woodwind/synth echo feeling sluggish light.
     - Beat 4 (15.0..20.2s): Drop main bouncy beat and shift to chilly glass/celesta shimmer + icy low pad tension.
     - Beats 5-6 (20.2..30.0s): Triumphant energetic brassy-marimba chord swell and cheeky final button sting at 29.6s.
  3. All 15 synchronized comedy Foley SFX from `config/timeline.json` `sfxEvents`.
  4. Mastered 44.1 kHz stereo WAV (`30.000s`, `-5.5 dB` sidechain BGM ducking,
     peak <= -1.0 dBFS), `audio/output/voice_manifest.json` (with 900-frame lipSync
     arrays for narrator, chewinstein, atom), and `output/subtitles.srt`.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np

try:
    from audio.dspCore import (
        CHANNELS,
        DURATION,
        SR,
        TOTAL_SAMPLES,
        add_stereo_event,
        adsr_env,
        butter_filter,
        master_and_export,
        midi_to_hz,
        pan_stereo,
        peaking_eq,
        synthesize_dialogue,
    )
except ImportError:
    from dspCore import (
        CHANNELS,
        DURATION,
        SR,
        TOTAL_SAMPLES,
        add_stereo_event,
        adsr_env,
        butter_filter,
        master_and_export,
        midi_to_hz,
        pan_stereo,
        peaking_eq,
        synthesize_dialogue,
    )

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TIMELINE_PATH = PROJECT_ROOT / "config" / "timeline.json"

BPM = 114.0
BEAT = 60.0 / BPM         # 0.52631579 s
EIGHTH = BEAT * 0.5       # 0.26315789 s
SIXTEENTH = BEAT * 0.25   # 0.13157895 s

# Phonetic clarity overrides for Kokoro TTS (display subtitles keep original timeline.json text untouched)
TTS_OVERRIDES: dict[str, str] = {
    "line_02": "Oops! What if E doesn't equal M C squared?",
    "line_08": "Brurr! Even my Einstein hair is freezing!",
    "line_09": "Until Chewinstein grabs gold chalk and slams back equals!",
    "line_12": "Actually, E equals M C squared, plus coffee!",
}


def load_timeline(path: Path = TIMELINE_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Procedural Science-Comedy Instrument Synthesizers (114 BPM)
# ---------------------------------------------------------------------------
def synth_pizz_marimba(freq: float, dur: float = 0.34, gain: float = 0.18, bright: float = 1.0) -> np.ndarray:
    """Bouncy wooden marimba + plucked pizzicato hybrid for science-comedy motif."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

    # Warm wooden fundamental + marimba 4th overtone + crisp pizzicato 2nd/3rd partial
    fund = 0.68 * np.sin(2.0 * math.pi * freq * t) * np.exp(-t * 8.2)
    p2 = 0.22 * bright * np.sin(2.0 * math.pi * (freq * 2.001) * t) * np.exp(-t * 14.0)
    p3 = 0.08 * bright * np.sin(2.0 * math.pi * (freq * 3.003) * t) * np.exp(-t * 21.0)
    bar4 = 0.14 * bright * np.sin(2.0 * math.pi * (freq * 3.98) * t) * np.exp(-t * 38.0)

    # Crisp soft-rubber mallet knock transient
    mallet = np.sin(2.0 * math.pi * min(freq * 6.5, 4200.0) * t) * np.exp(-t * 115.0) * 0.16 * bright
    attack = np.clip(t / 0.0025, 0.0, 1.0)
    sig = (fund + p2 + p3 + bar4 + mallet) * attack * gain

    fade = min(n, int(0.024 * SR))
    if fade > 1:
        sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
    return sig.astype(np.float32)


def synth_upright_bass(freq: float, dur: float = 0.42, gain: float = 0.25, droop: float = 0.0) -> np.ndarray:
    """Warm playful plucky acoustic upright bassline."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

    if droop != 0.0:
        f_curve = freq * (1.0 + droop * np.clip(t / max(0.08, dur * 0.85), 0.0, 1.0))
        phase = 2.0 * math.pi * np.cumsum(f_curve) / SR
    else:
        # Subtle acoustic finger-pluck pitch settle (+3.5% -> 1.0 in 18ms)
        f_curve = freq * (1.0 + 0.035 * np.exp(-t * 95.0))
        phase = 2.0 * math.pi * np.cumsum(f_curve) / SR

    body = (
        0.72 * np.sin(phase) * np.exp(-t * 4.8)
        + 0.24 * np.sin(phase * 2.0) * np.exp(-t * 9.5)
        + 0.10 * np.sin(phase * 3.0) * np.exp(-t * 16.0)
    )
    finger = np.sin(2.0 * math.pi * (freq * 4.2) * t) * np.exp(-t * 75.0) * 0.12
    attack = np.clip(t / 0.004, 0.0, 1.0)
    sig = butter_filter((body + finger) * attack, "low", 720.0, order=2)
    fade = min(n, int(0.035 * SR))
    if fade > 1:
        sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
    return (sig * gain).astype(np.float32)


def synth_woodblock(high: bool = True, gain: float = 0.14) -> np.ndarray:
    """Crisp hollow wooden block percussion tap."""
    dur = 0.095
    n = int(round(dur * SR))
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
    f0 = 1140.0 if high else 845.0
    tone = (
        0.72 * np.sin(2.0 * math.pi * f0 * t) * np.exp(-t * 58.0)
        + 0.28 * np.sin(2.0 * math.pi * (f0 * 1.47) * t) * np.exp(-t * 82.0)
    )
    click = np.sin(2.0 * math.pi * (f0 * 2.8) * t) * np.exp(-t * 180.0) * 0.22
    attack = np.clip(t / 0.0015, 0.0, 1.0)
    return ((tone + click) * attack * gain).astype(np.float32)


def synth_shaker(rng: np.random.Generator, accent: bool = False, gain: float = 0.07) -> np.ndarray:
    """Light crisp high-frequency rhythmic shaker."""
    dur = 0.075 if accent else 0.055
    n = int(round(dur * SR))
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
    noise = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (4400.0, 9600.0), order=2)
    env = np.sin(math.pi * np.clip(t / dur, 0.0, 1.0)) ** (1.2 if accent else 1.6)
    return (noise * env * gain * (1.25 if accent else 0.85)).astype(np.float32)


def synth_soft_kick(gain: float = 0.22) -> np.ndarray:
    """Warm light comedy-groove thump (tight, never muddies dialogue)."""
    dur = 0.16
    n = int(round(dur * SR))
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
    f = 108.0 * (0.44 ** np.clip(t / 0.055, 0.0, 1.0)) + 44.0
    sub = np.sin(2.0 * math.pi * np.cumsum(f) / SR) * np.exp(-t * 24.0)
    tap = np.sin(2.0 * math.pi * 260.0 * t) * np.exp(-t * 95.0) * 0.18
    attack = np.clip(t / 0.0025, 0.0, 1.0)
    return ((sub + tap) * attack * gain).astype(np.float32)


def synth_sluggish_wobble_woodwind(
    freq: float,
    dur: float = 0.72,
    gain: float = 0.16,
    droop_ratio: float = -0.055,
) -> np.ndarray:
    """
    Beat 2 sluggish light motif: quirky clarinet/woodwind synth with lazy pitch droop,
    warbly vibrato, and rhythmic tremolo echo feeling tired/slowed-down.
    """
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

    # Lazy pitch droop + comical wobbly vibrato
    sag = 1.0 + droop_ratio * (np.clip(t / max(0.12, dur * 0.8), 0.0, 1.0) ** 1.4)
    wobble = 1.0 + 0.013 * np.sin(2.0 * math.pi * 4.4 * t) * np.clip(t / 0.08, 0.0, 1.0)
    phase = 2.0 * math.pi * freq * np.cumsum(sag * wobble) / SR

    # Hollow quirky woodwind odd harmonics
    tone = (
        0.65 * np.sin(phase)
        + 0.12 * np.sin(2.0 * phase)
        + 0.28 * np.sin(3.0 * phase)
        + 0.10 * np.sin(5.0 * phase)
    )
    tone = butter_filter(tone, "low", 2100.0, order=2)

    # Expressive tremolo wobble
    tremolo = 0.76 + 0.24 * np.sin(2.0 * math.pi * 7.2 * t + 0.4)
    env = adsr_env(n, attack=0.055, decay=0.14, sustain=0.72, release=0.14)
    return (tone * tremolo * env * gain).astype(np.float32)


def synth_icy_pad(midis: list[int], dur: float, gain: float = 0.16) -> np.ndarray:
    """Beat 4 chilly low pad tension + icy stereo frost shimmer."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, CHANNELS), dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
    rng = np.random.default_rng(midis[0] * 101 + int(dur * 100))

    left = np.zeros(n, dtype=np.float32)
    right = np.zeros(n, dtype=np.float32)
    drift_l = 0.0022 * np.sin(2.0 * math.pi * 0.31 * t)
    drift_r = 0.0022 * np.sin(2.0 * math.pi * 0.37 * t + 1.2)

    for idx, m in enumerate(midis):
        f = midi_to_hz(m)
        fl = f * (0.9982 - 0.0005 * idx)
        fr = f * (1.0018 + 0.0005 * idx)
        pl = 2.0 * math.pi * np.cumsum(fl * (1.0 + drift_l)) / SR
        pr = 2.0 * math.pi * np.cumsum(fr * (1.0 + drift_r)) / SR

        wl = 0.72 * np.sin(pl) + 0.18 * np.sin(2.0 * pl) + 0.09 * np.sin(3.0 * pl)
        wr = 0.72 * np.sin(pr) + 0.18 * np.sin(2.0 * pr) + 0.09 * np.sin(3.0 * pr)
        weight = 1.0 / (1.0 + 0.14 * idx)
        left += wl * weight
        right += wr * weight

    norm = max(1.0, len(midis) * 0.62)
    stereo = np.stack([left / norm, right / norm], axis=-1).astype(np.float32)
    stereo = butter_filter(stereo, "low", 980.0, order=2)

    # Subtle frosty high wind air texture
    frost_l = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (2600.0, 6200.0), order=2)
    frost_r = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (2800.0, 6500.0), order=2)
    frost_lfo = 0.65 + 0.35 * np.sin(2.0 * math.pi * 0.45 * t)
    stereo[:, 0] += frost_l * frost_lfo * 0.045
    stereo[:, 1] += frost_r * frost_lfo * 0.045

    env = adsr_env(n, attack=0.45, decay=0.30, sustain=0.82, release=0.65)
    return (stereo * env[:, None] * gain).astype(np.float32)


def synth_celesta_glass(freq: float, dur: float = 0.75, gain: float = 0.14) -> np.ndarray:
    """Chilly crystalline glass / celesta shimmer note for Beat 4."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
    sig = (
        0.58 * np.sin(2.0 * math.pi * freq * t) * np.exp(-t * 4.2)
        + 0.26 * np.sin(2.0 * math.pi * (freq * 2.0) * t) * np.exp(-t * 7.5)
        + 0.12 * np.sin(2.0 * math.pi * (freq * 3.005) * t) * np.exp(-t * 13.0)
        + 0.06 * np.sin(2.0 * math.pi * (freq * 5.42) * t) * np.exp(-t * 28.0)
    )
    attack = np.clip(t / 0.004, 0.0, 1.0)
    fade = min(n, int(0.06 * SR))
    sig = sig * attack * gain
    if fade > 1:
        sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
    return sig.astype(np.float32)


def synth_brassy_chord(
    midis: list[int],
    dur: float,
    gain: float = 0.19,
    attack: float = 0.075,
    release: float = 0.22,
) -> np.ndarray:
    """Triumphant energetic warm brass-ensemble chord swell for Beats 5-6."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, CHANNELS), dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

    left = np.zeros(n, dtype=np.float32)
    right = np.zeros(n, dtype=np.float32)

    # Subtle brass lip-attack pitch scoop (+1.8% -> 1.0 in 30ms)
    scoop = 1.0 - 0.018 * np.exp(-t * 58.0)
    for idx, m in enumerate(midis):
        f = midi_to_hz(m)
        fl = f * (0.9985 - 0.0004 * idx)
        fr = f * (1.0015 + 0.0004 * idx)
        pl = 2.0 * math.pi * np.cumsum(fl * scoop) / SR
        pr = 2.0 * math.pi * np.cumsum(fr * scoop) / SR

        # Warm brassy harmonic stack (1st..5th)
        wl = (
            0.52 * np.sin(pl)
            + 0.26 * np.sin(2.0 * pl)
            + 0.14 * np.sin(3.0 * pl)
            + 0.06 * np.sin(4.0 * pl)
            + 0.025 * np.sin(5.0 * pl)
        )
        wr = (
            0.52 * np.sin(pr)
            + 0.26 * np.sin(2.0 * pr)
            + 0.14 * np.sin(3.0 * pr)
            + 0.06 * np.sin(4.0 * pr)
            + 0.025 * np.sin(5.0 * pr)
        )
        w = 1.0 / (1.0 + 0.10 * idx)
        spread = -0.22 if idx % 2 == 0 else 0.22
        left += wl * w * (1.0 - 0.18 * spread)
        right += wr * w * (1.0 + 0.18 * spread)

    norm = max(1.0, len(midis) * 0.62)
    stereo = np.stack([left / norm, right / norm], axis=-1).astype(np.float32)
    stereo = butter_filter(stereo, "low", 2400.0, order=2)
    # Carve gentle dialogue clarity pocket around 2.0 kHz
    stereo[:, 0] = peaking_eq(stereo[:, 0], 2050.0, 0.9, -2.5)
    stereo[:, 1] = peaking_eq(stereo[:, 1], 2050.0, 0.9, -2.5)

    env = adsr_env(n, attack=attack, decay=0.14, sustain=0.82, release=release)
    return (stereo * env[:, None] * gain).astype(np.float32)


def apply_stereo_echo(bus: np.ndarray, delay_sec: float = 0.39, feedback: float = 0.30) -> np.ndarray:
    d = int(round(delay_sec * SR))
    out = np.copy(bus)
    if d <= 0 or d >= len(bus):
        return out
    tap1 = np.zeros_like(bus)
    tap1[d:, 0] = bus[:-d, 1] * feedback
    tap1[d:, 1] = bus[:-d, 0] * feedback
    d2 = d * 2
    tap2 = np.zeros_like(bus)
    if d2 < len(bus):
        tap2[d2:, 0] = bus[:-d2, 0] * (feedback * 0.42)
        tap2[d2:, 1] = bus[:-d2, 1] * (feedback * 0.42)
    wet = butter_filter(tap1 + tap2, "low", 2600.0, order=2)
    return (out + wet).astype(np.float32)


def generate_bgm() -> np.ndarray:
    """Compose 30.0s playful 114 BPM science-comedy underscore aligned to all 6 story beats."""
    rng = np.random.default_rng(20261905)
    bgm = np.zeros((TOTAL_SAMPLES, CHANNELS), dtype=np.float32)

    # ------------------------------------------------------------------
    # 1. BEATS 1-3 (0.00..14.95s): Bouncy Pizzicato/Marimba + Upright Bass + Woodblock/Shaker
    # ------------------------------------------------------------------
    # Catchy cheeky C-major/Lydian 8th-note melody motif
    beat1_motif = [
        # (time_beats, midi, dur_s, gain, pan)
        (0.0, 72, 0.28, 0.19, -0.22), (0.5, 76, 0.26, 0.17, 0.18),
        (1.0, 79, 0.28, 0.20, -0.18), (1.5, 81, 0.26, 0.18, 0.24),
        (2.0, 79, 0.26, 0.18, -0.20), (2.5, 78, 0.22, 0.16, 0.20),  # Cheeky F#5 Lydian spice
        (3.0, 79, 0.30, 0.20, -0.16), (3.5, 76, 0.22, 0.16, 0.22),
        # Brief pause around sneeze/boom (beats 4..5), then playful pickup
        (5.0, 74, 0.28, 0.19, -0.24), (5.5, 79, 0.26, 0.18, 0.22),
        (6.0, 83, 0.28, 0.20, -0.18), (6.5, 84, 0.32, 0.21, 0.20),
        (7.0, 79, 0.26, 0.18, -0.20), (7.5, 76, 0.24, 0.17, 0.18),
        (8.0, 72, 0.36, 0.20, 0.00),
    ]
    for b_t, midi_n, dur_n, g_n, pan_n in beat1_motif:
        t_pos = b_t * BEAT + 0.04
        if t_pos < 4.45:
            add_stereo_event(bgm, pan_stereo(synth_pizz_marimba(midi_to_hz(midi_n), dur_n, g_n), pan_n), t_pos)

    beat1_bass = [
        (0.0, 48, 0.38, 0.26), (1.0, 43, 0.34, 0.23), (1.5, 45, 0.26, 0.21),
        (2.0, 48, 0.38, 0.25), (3.0, 43, 0.34, 0.23),
        (5.0, 43, 0.38, 0.25), (6.0, 47, 0.34, 0.23), (7.0, 48, 0.42, 0.26), (8.0, 43, 0.32, 0.22),
    ]
    for b_t, midi_n, dur_n, g_n in beat1_bass:
        t_pos = b_t * BEAT + 0.04
        if t_pos < 4.45:
            add_stereo_event(bgm, pan_stereo(synth_upright_bass(midi_to_hz(midi_n), dur_n, g_n), -0.04), t_pos)

    # Beat 2 (4.5..9.8s): Quirky sluggish slow-down wobble/tremolo woodwind + lazy drooping pizzicato/bass
    wobble_bus = np.zeros((TOTAL_SAMPLES, CHANNELS), dtype=np.float32)
    sluggish_woodwind_phrases = [
        # (start_s, midi, dur_s, gain, droop, pan)
        (4.62, 67, 0.72, 0.17, -0.055, -0.28),
        (5.45, 66, 0.68, 0.16, -0.060, 0.26),
        (6.28, 65, 0.78, 0.17, -0.070, -0.24),
        (7.25, 64, 0.74, 0.16, -0.055, 0.28),
        (8.15, 62, 0.78, 0.17, -0.065, -0.22),
        (9.02, 60, 0.68, 0.16, -0.045, 0.24),
    ]
    for st_s, midi_n, dur_n, g_n, droop_r, pan_n in sluggish_woodwind_phrases:
        ww = synth_sluggish_wobble_woodwind(midi_to_hz(midi_n), dur_n, g_n, droop_ratio=droop_r)
        add_stereo_event(wobble_bus, pan_stereo(ww, pan_n), st_s)
    bgm += apply_stereo_echo(wobble_bus, delay_sec=EIGHTH * 1.5, feedback=0.34)

    # Sparse sluggish marimba/upright bass in Beat 2 (with slight lazy droop)
    t_cur = 4.60
    idx = 0
    b2_marimba = [72, 71, 69, 67, 65, 64, 62, 60]
    b2_bass = [48, 47, 45, 43, 41, 40, 38, 43]
    while t_cur < 9.55:
        mn = b2_marimba[idx % len(b2_marimba)]
        bn = b2_bass[idx % len(b2_bass)]
        pan_n = -0.26 if idx % 2 == 0 else 0.26
        add_stereo_event(bgm, pan_stereo(synth_pizz_marimba(midi_to_hz(mn), 0.34, 0.13, bright=0.80), pan_n), t_cur)
        if idx % 2 == 0:
            add_stereo_event(bgm, pan_stereo(synth_upright_bass(midi_to_hz(bn), 0.48, 0.21, droop=-0.04), -0.03), t_cur)
        t_cur += BEAT * 1.5 if idx % 3 == 1 else BEAT
        idx += 1

    # Beat 3 (9.8..15.0s): Buoyant anti-gravity bouncy marimba/pizzicato + sassy upright bass
    b3_melody = [72, 76, 79, 83, 84, 79, 76, 74, 72, 75, 79, 81, 79, 76, 74, 71]
    b3_bass = [48, 43, 45, 48, 41, 45, 43, 47]
    t_cur = 9.85
    step = 0
    while t_cur < 14.82:
        mn = b3_melody[step % len(b3_melody)]
        pan_n = -0.28 if step % 2 == 0 else 0.28
        add_stereo_event(bgm, pan_stereo(synth_pizz_marimba(midi_to_hz(mn), 0.30, 0.18, bright=1.08), pan_n), t_cur)
        if step % 2 == 0:
            bn = b3_bass[(step // 2) % len(b3_bass)]
            add_stereo_event(bgm, pan_stereo(synth_upright_bass(midi_to_hz(bn), 0.36, 0.24), 0.0), t_cur)
        elif step % 4 == 3:
            # Playful bouncy offbeat bass pickup
            bn = b3_bass[(step // 2) % len(b3_bass)] + 7
            add_stereo_event(bgm, pan_stereo(synth_upright_bass(midi_to_hz(bn), 0.22, 0.16), 0.04), t_cur)
        t_cur += EIGHTH
        step += 1

    # Light crisp woodblock/shaker + soft groove percussion (Beats 1-3)
    perc_t = 0.04
    p_step = 0
    while perc_t < 14.85:
        # Leave brief comedic air pocket right at Beat 1 vine_boom (2.10..2.45s)
        if not (2.08 <= perc_t <= 2.48):
            beat_pos = p_step % 4
            if beat_pos == 0:
                add_stereo_event(bgm, pan_stereo(synth_soft_kick(0.20 if perc_t < 4.5 or perc_t >= 9.8 else 0.14), 0.0), perc_t)
            if beat_pos in (1, 3):
                wb = synth_woodblock(high=(beat_pos == 1), gain=0.12 if perc_t < 4.5 or perc_t >= 9.8 else 0.08)
                add_stereo_event(bgm, pan_stereo(wb, 0.22 if beat_pos == 1 else -0.20), perc_t)
            sh = synth_shaker(rng, accent=(beat_pos == 2), gain=0.065 if perc_t < 4.5 or perc_t >= 9.8 else 0.045)
            add_stereo_event(bgm, pan_stereo(sh, -0.26 if p_step % 2 == 0 else 0.26), perc_t)
        perc_t += EIGHTH
        p_step += 1

    # ------------------------------------------------------------------
    # 2. BEAT 4 (15.0..20.2s): Drop Main Beat -> Chilly Glass/Celesta Shimmer + Icy Low Pad Tension
    # ------------------------------------------------------------------
    icy_chords = [
        # (start_s, dur_s, midis, gain)
        (15.00, 2.85, [36, 43, 51, 58, 62], 0.185),  # Cm9 icy low tension
        (17.45, 2.75, [41, 48, 56, 62, 67], 0.195),  # Fm6/9 frosty cold chord
    ]
    for st_s, dur_s, midis_c, g_c in icy_chords:
        add_stereo_event(bgm, synth_icy_pad(midis_c, dur_s, gain=g_c), st_s)

    celesta_bus = np.zeros((TOTAL_SAMPLES, CHANNELS), dtype=np.float32)
    celesta_notes = [
        (15.12, 79, 0.85, 0.15, -0.34),
        (15.52, 75, 0.85, 0.14, 0.30),
        (15.95, 74, 0.85, 0.14, -0.26),
        (16.40, 72, 0.95, 0.15, 0.28),
        (17.00, 70, 0.85, 0.13, -0.32),
        (17.55, 80, 0.85, 0.15, 0.34),
        (18.02, 77, 0.85, 0.14, -0.28),
        (18.50, 74, 0.90, 0.14, 0.26),
        (19.00, 72, 0.95, 0.15, -0.22),
        (19.55, 71, 0.80, 0.14, 0.24),  # Leading tone B4 tension before Beat 5 triumph!
    ]
    for st_s, midi_n, dur_n, g_n, pan_n in celesta_notes:
        add_stereo_event(celesta_bus, pan_stereo(synth_celesta_glass(midi_to_hz(midi_n), dur_n, g_n), pan_n), st_s)
    bgm += apply_stereo_echo(celesta_bus, delay_sec=0.31, feedback=0.32)

    # ------------------------------------------------------------------
    # 3. BEATS 5-6 (20.2..30.0s): Triumphant Brassy-Marimba Chord Swell + Cheeky Button Sting @ 29.6s
    # ------------------------------------------------------------------
    # Energetic rising marimba pickup roll (20.08..20.38s) into Beat 5 triumph
    for i, m in enumerate([67, 69, 71, 72, 74, 76]):
        add_stereo_event(
            bgm,
            pan_stereo(synth_pizz_marimba(midi_to_hz(m), 0.24, 0.14 + 0.012 * i, bright=1.12), -0.25 + 0.10 * i),
            20.04 + i * 0.065,
        )

    triumph_chords = [
        # (start_s, dur_s, midis, gain)
        (20.42, 1.75, [48, 55, 60, 64, 67, 72], 0.20),  # Cmaj — heroic leap
        (22.10, 1.80, [41, 48, 57, 60, 64, 69], 0.23),  # Fmaj9 — equals slam peak swell!
        (23.80, 1.75, [43, 50, 59, 62, 67, 74], 0.22),  # G6/9 — shades snap energy!
        (25.48, 1.85, [45, 52, 60, 64, 67, 72], 0.19),  # Am9 — playful coffee strut
        (27.25, 1.88, [48, 55, 60, 64, 69, 74], 0.20),  # C6/9 — radiant finale swell
    ]
    for st_s, dur_s, midis_c, g_c in triumph_chords:
        add_stereo_event(bgm, synth_brassy_chord(midis_c, dur_s, gain=g_c), st_s)

    # Energetic marimba + upright bass + crisp woodblock/shaker groove across Beats 5-6 (20.42..29.15s)
    b56_melody = [72, 76, 79, 84, 81, 79, 76, 74, 72, 74, 76, 79, 83, 84, 79, 76]
    b56_bass = [48, 48, 41, 41, 43, 43, 45, 47, 48, 45, 41, 43]
    t_cur = 20.42
    step = 0
    while t_cur < 29.08:
        mn = b56_melody[step % len(b56_melody)]
        pan_n = -0.30 if step % 2 == 0 else 0.30
        add_stereo_event(bgm, pan_stereo(synth_pizz_marimba(midi_to_hz(mn), 0.30, 0.18, bright=1.15), pan_n), t_cur)

        beat_pos = step % 4
        if beat_pos in (0, 2):
            bn = b56_bass[(step // 2) % len(b56_bass)]
            add_stereo_event(bgm, pan_stereo(synth_upright_bass(midi_to_hz(bn), 0.36, 0.26), 0.0), t_cur)
        elif beat_pos == 3:
            bn = b56_bass[(step // 2) % len(b56_bass)] + 7
            add_stereo_event(bgm, pan_stereo(synth_upright_bass(midi_to_hz(bn), 0.22, 0.18), 0.03), t_cur)

        if beat_pos == 0:
            add_stereo_event(bgm, pan_stereo(synth_soft_kick(0.24), 0.0), t_cur)
        if beat_pos in (1, 3):
            add_stereo_event(
                bgm,
                pan_stereo(synth_woodblock(high=(beat_pos == 1), gain=0.14), 0.24 if beat_pos == 1 else -0.22),
                t_cur,
            )
        add_stereo_event(
            bgm,
            pan_stereo(synth_shaker(rng, accent=(beat_pos == 2), gain=0.075), -0.28 if step % 2 == 0 else 0.28),
            t_cur,
        )
        t_cur += EIGHTH
        step += 1

    # Cheeky Final Button Sting at 29.60s!
    # Crisp triumphant C6/9 brassy-marimba hit + playful comic high plink cadence ending before 30.00s
    add_stereo_event(
        bgm,
        synth_brassy_chord([48, 55, 60, 64, 69, 74, 79], 0.34, gain=0.25, attack=0.012, release=0.16),
        29.60,
    )
    add_stereo_event(bgm, pan_stereo(synth_upright_bass(midi_to_hz(48), 0.32, 0.28), 0.0), 29.60)
    add_stereo_event(bgm, pan_stereo(synth_pizz_marimba(midi_to_hz(84), 0.24, 0.22, bright=1.22), -0.14), 29.60)
    add_stereo_event(bgm, pan_stereo(synth_woodblock(high=True, gain=0.18), 0.18), 29.60)
    # Cheeky little high "ding!" punctuation pop at 29.74s
    add_stereo_event(bgm, pan_stereo(synth_pizz_marimba(midi_to_hz(91), 0.20, 0.19, bright=1.25), 0.16), 29.74)

    # Clean master intro fade & tail fade strictly inside 30.000s
    fade_in = int(0.08 * SR)
    fade_out = int(0.09 * SR)
    bgm[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)[:, None]
    bgm[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)[:, None]
    return bgm


# ---------------------------------------------------------------------------
# All 15 Synchronized Comedy Foley SFX
# ---------------------------------------------------------------------------
def synth_sfx(sfx_type: str) -> np.ndarray:
    rng = np.random.default_rng(sum(ord(c) * (i + 1) for i, c in enumerate(sfx_type)) + 1905)

    if sfx_type == "cartoon_sneeze":
        # Rapid comedic "ah-... CHOOO!" + tiny pitch-drop squeak
        dur = 0.44
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

        # Inhale buildup (0.00..0.11s): rising comical squeak + airy intake
        inhale_mask = t < 0.115
        f_in = 320.0 + 480.0 * (np.clip(t / 0.115, 0.0, 1.0) ** 1.5)
        inhale_tone = np.sin(2.0 * math.pi * np.cumsum(f_in) / SR) * np.sin(math.pi * np.clip(t / 0.115, 0.0, 1.0)) * 0.26 * inhale_mask
        inhale_air = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (1400.0, 4200.0), order=2)
        inhale_air *= np.sin(math.pi * np.clip(t / 0.115, 0.0, 1.0)) * 0.24 * inhale_mask

        # Explosive "CHOOO!" burst at t = 0.12s
        t_b = np.maximum(0.0, t - 0.12)
        burst_mask = (t >= 0.12).astype(np.float32)
        choo_noise = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (650.0, 5200.0), order=2)
        choo_env = np.exp(-t_b * 13.5) * np.clip(t_b / 0.008, 0.0, 1.0) * burst_mask
        f_drop = 920.0 * (0.28 ** np.clip(t_b / 0.22, 0.0, 1.0)) + 160.0
        choo_voice = np.sin(2.0 * math.pi * np.cumsum(f_drop) / SR) * np.exp(-t_b * 11.0) * burst_mask * 0.48
        mono = inhale_tone + inhale_air + choo_noise * choo_env * 0.95 + choo_voice
        mono = np.tanh(mono * 1.25).astype(np.float32) * 0.85
        fade = int(0.03 * SR)
        mono[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return mono

    if sfx_type == "chalk_screech":
        # Classic cringe-funny chalkboard squeak + chalk grit swipe
        dur = 0.34
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        f_squeal = 3150.0 - 650.0 * (t / dur) + 290.0 * np.sin(2.0 * math.pi * 29.0 * t)
        ph = 2.0 * math.pi * np.cumsum(f_squeal) / SR
        squeal = (np.sin(ph) + 0.45 * np.sin(ph * 1.48) + 0.22 * np.sin(ph * 2.12))
        grit = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (1800.0, 5600.0), order=2)
        env = np.sin(math.pi * t / dur) ** 0.75 * (0.75 + 0.25 * np.sin(2.0 * math.pi * 22.0 * t))
        sig = np.tanh((squeal * 0.48 + grit * 0.55) * env * 1.3) * 0.62
        return sig.astype(np.float32)

    if sfx_type == "vine_boom":
        # Deep punchy meme vine-boom sub drop
        dur = 0.78
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        f = 135.0 * (0.24 ** np.clip(t / 0.22, 0.0, 1.0)) + 30.0
        sub = np.sin(2.0 * math.pi * np.cumsum(f) / SR) * np.exp(-t * 4.4)
        crack = butter_filter(rng.standard_normal(n).astype(np.float32), "low", 480.0, order=2) * np.exp(-t * 28.0) * 0.35
        thump = np.sin(2.0 * math.pi * 160.0 * t) * np.exp(-t * 42.0) * 0.40
        sig = np.tanh((sub * 0.98 + crack + thump) * 1.45) * 0.88
        fade = int(0.06 * SR)
        sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return sig.astype(np.float32)

    if sfx_type == "lamp_click":
        # Tactile mechanical brass toggle click-clack + soft warm bulb hum
        dur = 0.26
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        out = np.zeros(n, dtype=np.float32)
        for delay_s, f_c, amp in [(0.00, 1950.0, 0.55), (0.045, 2580.0, 0.72)]:
            d = int(round(delay_s * SR))
            tt = t[: n - d]
            snap = butter_filter(rng.standard_normal(len(tt)).astype(np.float32), "band", (1400.0, 6200.0), order=2)
            clk = (np.sin(2.0 * math.pi * f_c * tt) * 0.55 + snap * 0.65) * np.exp(-tt * 145.0)
            out[d:] += clk * amp
        hum = np.sin(2.0 * math.pi * 120.0 * t) * np.exp(-t * 9.0) * np.clip(t / 0.05, 0.0, 1.0) * 0.14
        return (out + hum).astype(np.float32)

    if sfx_type == "squish_boing":
        # Wet photon squish ("blorp") immediately springing into cartoon BOING!
        dur = 0.62
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

        # Squish blorp (0..0.11s)
        sq_mask = (t < 0.12).astype(np.float32)
        f_sq = 175.0 + 360.0 * np.sin(math.pi * np.clip(t / 0.11, 0.0, 1.0))
        squish = np.sin(2.0 * math.pi * np.cumsum(f_sq) / SR) * np.exp(-t * 16.0) * sq_mask * 0.52

        # Elastic BOING! starting at 0.075s
        t_b = np.maximum(0.0, t - 0.075)
        b_mask = (t >= 0.075).astype(np.float32)
        wobble = np.sin(2.0 * math.pi * 15.0 * t_b) * np.exp(-t_b * 4.2)
        f_boing = 235.0 + 185.0 * (1.0 - np.exp(-t_b * 18.0)) + 165.0 * wobble
        ph = 2.0 * math.pi * np.cumsum(f_boing) / SR
        boing = (np.sin(ph) + 0.35 * np.sin(ph * 2.0 + 0.5 * np.exp(-t_b * 5.0))) * np.exp(-t_b * 4.8) * b_mask * 0.68
        fade = int(0.04 * SR)
        out = (squish + boing).astype(np.float32)
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out

    if sfx_type == "antigrav_whoosh":
        # Weightless upward sci-fi levitation whoosh + dreamy harmonic sweep
        dur = 0.72
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        noise = rng.standard_normal(n).astype(np.float32)
        low_air = butter_filter(noise, "band", (220.0, 950.0), order=2)
        hi_air = butter_filter(noise, "band", (1100.0, 4200.0), order=2)
        sweep = np.clip(t / dur, 0.0, 1.0) ** 1.2
        env = np.sin(math.pi * t / dur) ** 1.15
        air = ((1.0 - sweep) * low_air + sweep * hi_air) * env * 0.72
        f_sci = 280.0 + 620.0 * (t / dur) ** 1.3 + 22.0 * np.sin(2.0 * math.pi * 11.0 * t)
        warble = np.sin(2.0 * math.pi * np.cumsum(f_sci) / SR) * env * 0.24
        return (air + warble).astype(np.float32)

    if sfx_type == "pop_eye":
        # Twin snappy cartoon cork-pop eye-bulge bloops
        dur = 0.28
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        out = np.zeros(n, dtype=np.float32)
        for delay_s, f_lo, f_hi, amp in [(0.00, 290.0, 980.0, 0.72), (0.075, 360.0, 1220.0, 0.68)]:
            d = int(round(delay_s * SR))
            tt = t[: n - d]
            f_p = f_lo + (f_hi - f_lo) * (1.0 - np.exp(-tt * 65.0))
            pop = np.sin(2.0 * math.pi * np.cumsum(f_p) / SR) * np.exp(-tt * 28.0) * np.clip(tt / 0.002, 0.0, 1.0)
            out[d:] += pop * amp
        return out.astype(np.float32)

    if sfx_type == "sun_power_down":
        # Dramatic comedic solar shutdown turbine droop + fizzle
        dur = 0.92
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        f_turb = 780.0 * (0.075 ** (np.clip(t / dur, 0.0, 1.0) ** 0.82)) + 45.0
        ph = 2.0 * math.pi * np.cumsum(f_turb) / SR
        turbine = (0.65 * np.sin(ph) + 0.28 * np.sin(ph * 2.0) + 0.12 * np.sin(ph * 3.0))
        env = np.clip(t / 0.015, 0.0, 1.0) * (1.0 - np.clip((t - 0.60) / 0.32, 0.0, 1.0))
        fizzle = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (1800.0, 6200.0), order=2)
        fizzle *= np.exp(-t * 4.5) * 0.28
        return np.tanh((turbine * env * 0.60 + fizzle) * 1.15).astype(np.float32)

    if sfx_type == "freeze_shimmer":
        # Icy frost crystallization bells + crackling ice shimmer
        dur = 1.05
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        out = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (3600.0, 9200.0), order=2)
        crackle_mod = (np.abs(np.sin(2.0 * math.pi * 18.0 * t)) ** 2.2) * np.sin(math.pi * t / dur)
        out = out * crackle_mod * 0.36
        # Descending & sparkling high icy glass tones
        ice_notes = [(0.00, 2093.0), (0.07, 2489.0), (0.14, 3136.0), (0.22, 3729.0), (0.31, 4186.0)]
        for delay_s, fr in ice_notes:
            d = int(round(delay_s * SR))
            tt = t[: n - d]
            bell = (np.sin(2.0 * math.pi * fr * tt) + 0.35 * np.sin(2.0 * math.pi * fr * 2.71 * tt)) * np.exp(-tt * 6.5)
            out[d:] += bell * np.clip(tt / 0.004, 0.0, 1.0) * 0.24
        fade = int(0.08 * SR)
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out.astype(np.float32)

    if sfx_type == "chalk_whoosh":
        # Heroic fast golden-chalk air slice + bright gold sparkle
        dur = 0.50
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        noise = rng.standard_normal(n).astype(np.float32)
        air_lo = butter_filter(noise, "band", (350.0, 1400.0), order=2)
        air_hi = butter_filter(noise, "band", (1600.0, 5200.0), order=2)
        u = np.clip(t / dur, 0.0, 1.0)
        env = np.sin(math.pi * u) ** 1.35
        whoosh = ((1.0 - u) * air_lo + u * air_hi) * env * 0.78
        sparkle = (np.sin(2.0 * math.pi * 1568.0 * t) + 0.5 * np.sin(2.0 * math.pi * 2093.0 * t)) * np.exp(-t * 8.0) * 0.16
        return (whoosh + sparkle).astype(np.float32)

    if sfx_type == "equals_slam":
        # Massive triumphant chalkboard "=" slam + golden C-major power ring!
        dur = 0.98
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        f_sub = 165.0 * (0.21 ** np.clip(t / 0.16, 0.0, 1.0)) + 34.0
        sub = np.sin(2.0 * math.pi * np.cumsum(f_sub) / SR) * np.exp(-t * 5.2) * 0.85
        slate = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (380.0, 2600.0), order=2) * np.exp(-t * 36.0) * 0.65
        power_chord = (
            0.35 * np.sin(2.0 * math.pi * 523.25 * t)
            + 0.28 * np.sin(2.0 * math.pi * 783.99 * t)
            + 0.22 * np.sin(2.0 * math.pi * 1046.50 * t)
            + 0.15 * np.sin(2.0 * math.pi * 1318.51 * t)
        ) * np.exp(-t * 3.8) * np.clip(t / 0.008, 0.0, 1.0) * 0.52
        sig = np.tanh((sub + slate + power_chord) * 1.22) * 0.86
        fade = int(0.07 * SR)
        sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return sig.astype(np.float32)

    if sfx_type == "shades_snap":
        # Cool deal-with-it sunglasses snap + sparkling diamond bling
        dur = 0.68
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        snap = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (1800.0, 6400.0), order=2) * np.exp(-t * 140.0) * 0.65
        clack = np.sin(2.0 * math.pi * 1650.0 * t) * np.exp(-t * 110.0) * 0.40
        out = snap + clack
        for idx, fr in enumerate([1567.98, 2093.0, 2637.02, 3135.96]):
            d = int(round((0.025 + idx * 0.032) * SR))
            tt = t[: n - d]
            trem = 0.80 + 0.20 * np.sin(2.0 * math.pi * 18.0 * tt)
            out[d:] += np.sin(2.0 * math.pi * fr * tt) * np.exp(-tt * 6.8) * trem * 0.22
        fade = int(0.05 * SR)
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out.astype(np.float32)

    if sfx_type == "chalk_scribble":
        # Brisk rhythmic "+ COFFEE" chalkboard scribble bursts + emphatic final dot tap
        dur = 0.72
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        out = np.zeros(n, dtype=np.float32)
        strokes = [0.00, 0.11, 0.22, 0.34, 0.45, 0.58]
        for idx, st_s in enumerate(strokes):
            d = int(round(st_s * SR))
            s_len = int(round((0.045 if idx == len(strokes) - 1 else 0.085) * SR))
            s_len = min(s_len, n - d)
            if s_len <= 4:
                continue
            tt = t[:s_len]
            chalk_f = 1950.0 + idx * 140.0
            friction = butter_filter(rng.standard_normal(s_len).astype(np.float32), "band", (1200.0, 4400.0), order=2)
            tap = np.sin(2.0 * math.pi * chalk_f * tt) * np.exp(-tt * 65.0) * 0.38
            env = np.sin(math.pi * tt / (s_len / SR)) ** 0.85
            out[d : d + s_len] += (friction * 0.70 + tap) * env * (0.95 if idx == len(strokes) - 1 else 0.72)
        return out.astype(np.float32)

    if sfx_type == "mug_clink_bell":
        # Warm ceramic coffee mug toast clink + cheerful celebratory bell ping
        dur = 0.65
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        mug = (
            0.55 * np.sin(2.0 * math.pi * 1920.0 * t) * np.exp(-t * 16.0)
            + 0.32 * np.sin(2.0 * math.pi * 3140.0 * t) * np.exp(-t * 22.0)
            + 0.18 * np.sin(2.0 * math.pi * 4680.0 * t) * np.exp(-t * 32.0)
        )
        bell = (
            0.38 * np.sin(2.0 * math.pi * 1567.98 * t) * np.exp(-t * 5.2)
            + 0.26 * np.sin(2.0 * math.pi * 2093.00 * t) * np.exp(-t * 4.6)
        )
        attack = np.clip(t / 0.002, 0.0, 1.0)
        out = (mug + bell) * attack * 0.68
        fade = int(0.05 * SR)
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out.astype(np.float32)

    if sfx_type == "camera_flash":
        # Crisp mechanical shutter click + xenon flash capacitor pop/whine
        dur = 0.36
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        shutter = butter_filter(rng.standard_normal(n).astype(np.float32), "high", 2300.0, order=2) * np.exp(-t * 78.0) * 0.42
        pop = np.sin(2.0 * math.pi * 190.0 * t) * np.exp(-t * 65.0) * 0.36
        whine = np.sin(2.0 * math.pi * (1950.0 + 1050.0 * (t / dur)) * t) * np.exp(-t * 11.5) * 0.24
        out = np.tanh((shutter + pop + whine) * 1.15).astype(np.float32) * 0.82
        return out

    return np.zeros(int(0.1 * SR), dtype=np.float32)


def _bound_sfx(wav: np.ndarray, ceiling: float = 0.85) -> np.ndarray:
    pk = float(np.max(np.abs(wav)))
    if pk > ceiling:
        wav = (wav * (ceiling / pk)).astype(np.float32)
    return wav


def main() -> None:
    timeline = load_timeline(TIMELINE_PATH)

    print("[Audio] Synthesizing Kokoro dialogue lines (am_puck / bm_george / af_bella)...")
    dialogue_bus, speaker_mono_buses, manifest_lines = synthesize_dialogue(
        timeline,
        tts_overrides=TTS_OVERRIDES,
    )

    print("[Audio] Synthesizing 114 BPM science-comedy underscore...")
    bgm_bus = generate_bgm()

    sfx_events = timeline.get("sfxEvents", [])
    print(f"[Audio] Synthesizing {len(sfx_events)} comedy Foley SFX events...")
    sfx_bus = np.zeros((TOTAL_SAMPLES, CHANNELS), dtype=np.float32)
    for ev in sfx_events:
        wav = _bound_sfx(synth_sfx(ev["type"])) * float(ev.get("gain", 0.65))
        add_stereo_event(sfx_bus, pan_stereo(wav, float(ev.get("pan", 0.0))), float(ev["time"]))

    master_and_export(
        PROJECT_ROOT,
        timeline,
        dialogue_bus,
        bgm_bus,
        sfx_bus,
        speaker_mono_buses,
        manifest_lines,
    )


if __name__ == "__main__":
    main()
