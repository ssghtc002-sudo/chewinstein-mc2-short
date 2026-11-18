/**
 * Chewinstein Clean-Frame HUD & Boxless YouTube Subtitle Wrapper (/home/antigravity/chewinstein-mc2-short/src/hud/chewinsteinHud.js)
 * Strictly follows Clean Frame + Boxless YouTube Subtitle Standard:
 *  - ZERO top UI bars, progress bars, chapter boxes, or hook pills
 *  - ZERO bottom subtitle box/card containers
 *  - Centered 800-weight 42px #FFFFFF + #38BDF8 active-word subtitles at y=1650 via offscreen subCanvas
 *  - Subtle peripheral Beat 4 freeze-tint vignette & brief comedic SFX impact flashes only
 */
import { createHudCompositor, createFrameCompositor } from '../engine/hudCompositor.js';

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(e0, e1, x) {
  const u = clamp01((x - e0) / Math.max(1e-5, e1 - e0));
  return u * u * (3 - 2 * u);
}

export function createChewinsteinHud(timeline, manifest = null, hudCanvas = null) {
  const width = timeline?.resolution?.width || 1080;
  const height = timeline?.resolution?.height || 1920;
  const sfxEvents = Array.isArray(timeline?.sfxEvents) ? timeline.sfxEvents : [];

  function drawOverlay(ctx, t) {
    // 1. Subtle peripheral icy frost edge tint during Beat 4 (15.0..20.2s) — zero boxes, zero labels
    const freezeIn = smoothstep(15.2, 16.4, t);
    const freezeOut = 1.0 - smoothstep(19.6, 20.4, t);
    const freezeAlpha = freezeIn * freezeOut * 0.20;
    if (freezeAlpha > 0.005) {
      const grad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.44,
        width * 0.36,
        width * 0.5,
        height * 0.48,
        height * 0.66
      );
      grad.addColorStop(0.0, 'rgba(125, 211, 252, 0)');
      grad.addColorStop(0.65, `rgba(56, 189, 248, ${(freezeAlpha * 0.45).toFixed(3)})`);
      grad.addColorStop(1.0, `rgba(186, 230, 253, ${freezeAlpha.toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Comedic SFX impact flashes (cartoon_sneeze, equals_slam, shades_snap)
    for (let i = 0; i < sfxEvents.length; i++) {
      const ev = sfxEvents[i];
      const dt = t - ev.time;
      if (dt < 0 || dt > 0.28) continue;

      if (ev.type === 'equals_slam') {
        const a = 0.36 * Math.exp(-dt * 12.0);
        if (a > 0.01) {
          const g = ctx.createRadialGradient(width * 0.52, height * 0.40, 20, width * 0.52, height * 0.40, height * 0.55);
          g.addColorStop(0.0, `rgba(255, 244, 180, ${a.toFixed(3)})`);
          g.addColorStop(0.5, `rgba(251, 191, 36, ${(a * 0.45).toFixed(3)})`);
          g.addColorStop(1.0, 'rgba(251, 191, 36, 0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, width, height);
        }
      } else if (ev.type === 'cartoon_sneeze') {
        const a = 0.22 * Math.exp(-dt * 15.0);
        if (a > 0.01) {
          ctx.fillStyle = `rgba(255, 248, 225, ${a.toFixed(3)})`;
          ctx.fillRect(0, 0, width, height);
        }
      } else if (ev.type === 'shades_snap') {
        const a = 0.24 * Math.exp(-dt * 16.0);
        if (a > 0.01) {
          const g = ctx.createRadialGradient(width * 0.36, height * 0.34, 10, width * 0.36, height * 0.34, 420);
          g.addColorStop(0.0, `rgba(224, 242, 254, ${a.toFixed(3)})`);
          g.addColorStop(1.0, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, width, height);
        }
      }
    }
  }

  return createHudCompositor(timeline, manifest, hudCanvas, {
    subtitleY: 1650,
    accentColor: '#38BDF8',
    accentGlow: 'rgba(56, 189, 248, 0.50)',
    drawOverlay,
  });
}

export { createFrameCompositor };
