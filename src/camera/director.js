/**
 * Chewinstein E != mc^2 6-Beat Camera Director (/home/antigravity/chewinstein-mc2-short/src/camera/director.js)
 * Built on shared baseDirector.js with easeOutQuint whip-pans, organic handheld sway,
 * comedic SFX spring shakes, and exact 9:16 portrait NDC safe-zone framing above y=1650 subtitles.
 */
import { createBaseDirector, clamp01, lerp, smoothstep } from '../engine/baseDirector.js';

const TRANSITIONS = {
  chalkboard_sneeze_hook: { duration: 0.0, whipFov: 0.0, whipRoll: 0.0 },
  sluggish_photon_lamp: { duration: 0.34, whipFov: 3.8, whipRoll: 0.032 },
  atom_anti_gravity_roast: { duration: 0.36, whipFov: 4.2, whipRoll: -0.034 },
  freezing_sun_shiver: { duration: 0.38, whipFov: 3.5, whipRoll: 0.026 },
  chalk_slam_restore: { duration: 0.32, whipFov: 4.6, whipRoll: -0.038 },
  coffee_theory_finale: { duration: 0.40, whipFov: 3.2, whipRoll: 0.022 },
};

function easeOutCubic(x) {
  const u = clamp01(x);
  return 1 - Math.pow(1 - u, 3);
}

export function createChewinsteinDirector(camera, timeline = {}) {
  const sfxEvents = Array.isArray(timeline?.sfxEvents) ? timeline.sfxEvents : [];

  function evalChewinsteinShake(t) {
    let best = 0;
    for (let i = 0; i < sfxEvents.length; i++) {
      const ev = sfxEvents[i];
      const dt = t - ev.time;
      if (dt < 0 || dt > 0.65) continue;

      let strength = 0;
      let decay = 10.0;
      switch (ev.type) {
        case 'equals_slam':
          strength = 0.72;
          decay = 8.5;
          break;
        case 'vine_boom':
          strength = 0.62;
          decay = 9.0;
          break;
        case 'squish_boing':
          strength = 0.48;
          decay = 9.5;
          break;
        case 'cartoon_sneeze':
          strength = 0.44;
          decay = 10.5;
          break;
        case 'sun_power_down':
          strength = 0.30;
          decay = 9.0;
          break;
        case 'antigrav_whoosh':
          strength = 0.24;
          decay = 8.5;
          break;
        case 'shades_snap':
          strength = 0.28;
          decay = 13.0;
          break;
        case 'mug_clink_bell':
          strength = 0.16;
          decay = 14.0;
          break;
        default:
          strength = 0.0;
      }
      if (strength > 0) {
        best = Math.max(best, strength * Math.exp(-dt * decay));
      }
    }
    return clamp01(best);
  }

  function evaluateShot(shotName, t, activeBeat, state, outPos, outLook, outScalars) {
    const start = activeBeat?.start ?? 0;
    const end = activeBeat?.end ?? start + 4.5;
    const u = clamp01((t - start) / Math.max(0.05, end - start));
    const s = u * u * (3 - 2 * u);

    switch (shotName) {
      case 'chalkboard_sneeze_hook': {
        // Beat 1 (0.0..4.5s): Chewinstein beside chalkboard E = mc^2, sneezes at 1.35s, vine_boom punch at 2.15s
        const preSneeze = smoothstep(0.0, 1.35, t);
        const boomPunch = t >= 2.12 ? easeOutCubic(clamp01((t - 2.12) / 0.22)) : 0;
        const boomRelax = t >= 2.60 ? smoothstep(2.60, 4.40, t) : 0;

        outPos.set(
          lerp(0.13, 0.12, preSneeze) - boomPunch * 0.012,
          lerp(1.24, 1.21, preSneeze) + boomPunch * 0.018,
          lerp(4.32, 4.26, preSneeze) - boomPunch * 0.05 + boomRelax * 0.05
        );
        outLook.set(
          lerp(0.12, 0.11, s),
          lerp(0.80, 0.81, s) + boomPunch * 0.015,
          -0.06
        );
        outScalars.fov = lerp(46.5, 46.0, preSneeze) - boomPunch * 0.4 + boomRelax * 0.3;
        outScalars.roll = boomPunch * (1 - boomRelax) * 0.018;
        outScalars.swayAmp = 0.72;
        break;
      }

      case 'sluggish_photon_lamp': {
        // Beat 2 (4.5..9.8s): Desk sun-lamp drops slow-mo photon blobs that boing off Chewinstein's nose at 6.65s
        const boingBounce =
          t >= 6.62 && t <= 7.25
            ? Math.sin(((t - 6.62) / 0.63) * Math.PI * 2.0) * Math.exp(-(t - 6.62) * 3.8)
            : 0;

        outPos.set(
          lerp(0.19, 0.14, s) + boingBounce * 0.02,
          lerp(1.22, 1.19, s) + Math.abs(boingBounce) * 0.018,
          lerp(4.32, 4.26, s)
        );
        outLook.set(
          lerp(0.17, 0.13, s),
          lerp(0.80, 0.82, s),
          0.06
        );
        outScalars.fov = lerp(46.5, 46.0, s);
        outScalars.roll = boingBounce * 0.022;
        outScalars.swayAmp = 0.68;
        break;
      }

      case 'atom_anti_gravity_roast': {
        // Beat 3 (9.8..15.0s): Floating mug & gold weight + Sassy Atom Orb popping eyes at 10.65s
        const eyePop = t >= 10.62 ? easeOutCubic(clamp01((t - 10.62) / 0.25)) : 0;
        const floatRoll = Math.sin((t - 9.8) * 1.45) * 0.014;

        outPos.set(
          lerp(0.14, 0.16, s),
          lerp(1.20, 1.25, s),
          lerp(4.34, 4.38, s) - eyePop * 0.04
        );
        outLook.set(
          lerp(0.12, 0.14, s),
          lerp(0.81, 0.85, s),
          0.08
        );
        outScalars.fov = 46.8 - eyePop * 0.3;
        outScalars.roll = floatRoll;
        outScalars.swayAmp = 0.78;
        break;
      }

      case 'freezing_sun_shiver': {
        // Beat 4 (15.0..20.2s): Shrinking ice-cold Sun Orb & shivering Chewinstein
        const freezeProg = smoothstep(15.2, 19.6, t);
        const shiver = freezeProg * Math.sin(t * 36.0) * 0.005;

        outPos.set(
          lerp(0.13, 0.12, s) + shiver,
          lerp(1.24, 1.20, s) + shiver * 0.6,
          lerp(4.32, 4.26, s)
        );
        outLook.set(
          lerp(0.12, 0.11, s),
          lerp(0.81, 0.81, s),
          0.02
        );
        outScalars.fov = lerp(46.5, 46.0, s);
        outScalars.roll = -0.010 * freezeProg;
        outScalars.swayAmp = 0.62;
        break;
      }

      case 'chalk_slam_restore': {
        // Beat 5 (20.2..25.4s): Leap with golden chalk -> equals_slam@22.15 -> reignited Sun -> shades_snap@24.20
        const leapTrack = Math.sin(clamp01((t - 21.1) / 1.45) * Math.PI) * 0.09;
        const slamPunch = t >= 22.15 ? easeOutCubic(clamp01((t - 22.15) / 0.25)) : 0;
        const shadesSnap = t >= 24.20 ? easeOutCubic(clamp01((t - 24.20) / 0.20)) : 0;

        outPos.set(
          lerp(0.14, 0.12, s),
          lerp(1.22, 1.18, s) + leapTrack * 0.4,
          lerp(4.34, 4.28, s) - shadesSnap * 0.03
        );
        outLook.set(
          lerp(0.12, 0.11, s),
          lerp(0.81, 0.82, s) + leapTrack * 0.45,
          lerp(-0.08, 0.0, slamPunch)
        );
        outScalars.fov = lerp(46.5, 46.0, s) - shadesSnap * 0.25;
        outScalars.roll = (1 - slamPunch) * -0.012 + shadesSnap * 0.010;
        outScalars.swayAmp = 0.58;
        break;
      }

      case 'coffee_theory_finale':
      default: {
        // Beat 6 (25.4..30.0s): Smug "+ COFFEE" scribble, confetti sparks, mug toast & camera flash
        const toastClink = t >= 28.40 ? easeOutCubic(clamp01((t - 28.40) / 0.30)) : 0;

        outPos.set(
          lerp(0.13, 0.15, s),
          lerp(1.21, 1.24, s),
          lerp(4.28, 4.36, s)
        );
        outLook.set(
          lerp(0.11, 0.13, s),
          lerp(0.81, 0.83, s) + toastClink * 0.02,
          -0.04
        );
        outScalars.fov = lerp(46.2, 46.6, s);
        outScalars.roll = 0.0;
        outScalars.swayAmp = 0.42;
        break;
      }
    }
  }

  const base = createBaseDirector(camera, timeline, evaluateShot, {
    transitions: TRANSITIONS,
  });

  function update(t = 0, state = {}) {
    const sfxShake = state.sfxShake !== undefined ? state.sfxShake : evalChewinsteinShake(t);
    base.update(t, { ...state, sfxShake });
  }

  return {
    update,
    findBeatAt: base.findBeatAt,
  };
}

export const createDirector = createChewinsteinDirector;
