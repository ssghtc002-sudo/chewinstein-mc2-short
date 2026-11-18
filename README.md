# What if E ≠ mc²? — The Chewinstein Theory (3D Comedy Physics Short)

A 30-second vertical (`1080×1920`, `30 fps`, `900` frames) 3D Pixar-style animated YouTube Short built with Three.js, procedural CanvasTextures, Kokoro ONNX neural multi-voice TTS + WSOLA DSP mastering, and Chrome SwiftShader + WebCodecs H.264 High Profile rendering.

## Story & 6-Beat Arc
1. **The Equation Sneeze (`0.0–4.5s`)**: Professor Chewinstein poses proudly beside `E = mc²`, sneezes violently, and smears the chalkboard into glowing red `E ≠ mc²` as his monocle drops.
2. **Slow-Mo Photons (`4.5–9.8s`)**: Light speed collapses—his brass desk sun-lamp drops lazy bouncy photon blobs that squish softly off Chewinstein's nose.
3. **Atomic Roast (`9.8–15.0s`)**: Mass loses energy while gravity goes wild—his lab mug and `10 KG` weight float away as a Sassy Talking Atom Orb roasts his math.
4. **Sun Turns Ice Cold (`15.0–20.2s`)**: No fusion energy means the orbiting miniature Sun freezes into an icy snowball while snow falls and Chewinstein shivers.
5. **Super-Chalk Fix (`20.2–25.4s`)**: Grabbing glowing golden chalk, Chewinstein leaps to slam `=` back into `E = mc²`, reigniting the Sun and snapping on his Relativity Shades.
6. **+ COFFEE Twist (`25.4–30.0s`)**: Chewinstein scribbles `+ COFFEE` under `E = mc²` and raises a steaming ceramic mug toast beneath chalk confetti sparks.

## Deliverable Video
- [output/chewinstein_mc2_short.mp4](output/chewinstein_mc2_short.mp4) (`1080×1920`, `30 fps`, `30.0s`, `H.264 High`, `AAC Stereo -2.7 dBFS peak`)
- [output/subtitles.srt](output/subtitles.srt)

## Commands
```bash
# 1. Generate 3-voice Kokoro dialogue, 114 BPM comedy BGM, and 15 SFX
.venv/bin/python audio/generate_audio.py

# 2. Sub-1s Node preflight verification (budgets, grounding, NDC safe viewport)
node verify_scene.mjs

# 3. Fast Chrome QA keyframes or full 900-frame WebCodecs H.264 render
node render/render_frames.mjs --qa-only
node render/render_frames.mjs --batch-size=150
```
