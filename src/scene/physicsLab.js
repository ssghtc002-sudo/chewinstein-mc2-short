/**
 * Physics Lab Environment, Dynamic 4-State Chalkboard & Comedy Props
 * (/home/antigravity/chewinstein-mc2-short/src/scene/physicsLab.js)
 *
 * Strictly budgeted: <= 22 draw calls, <= 18,000 tris, <= 14 materials, 100% Node-safe.
 */
import * as THREE from 'three';
import {
  MaterialRegistry,
  safeMerge,
  createGlowSprite,
  createContactShadowDisc,
} from '../engine/baseRig.js';

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  const u = clamp01((x - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
}

function easeOutBack(x) {
  const u = clamp01(x);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

function easeOutCubic(x) {
  const u = clamp01(x);
  return 1 - Math.pow(1 - u, 3);
}

/**
 * Multi-ring radial disc geometry with smooth vertex-color vignette fading into fog.
 */
function buildRadialWoodFloorGeometry(rings = [0, 2.1, 4.4, 8.5], segs = 40) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const ringColors = [
    new THREE.Color(1.0, 1.0, 1.0),
    new THREE.Color(0.95, 0.94, 0.92),
    new THREE.Color(0.55, 0.56, 0.62),
    new THREE.Color(0.10, 0.13, 0.19),
  ];

  for (let rIdx = 0; rIdx < rings.length; rIdx++) {
    const r = rings[rIdx];
    const col = ringColors[rIdx];
    for (let s = 0; s <= segs; s++) {
      const theta = (s / segs) * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      positions.push(x, 0, z);
      normals.push(0, 1, 0);
      uvs.push(x * 0.42 + 0.5, z * 0.42 + 0.5);
      colors.push(col.r, col.g, col.b);
    }
  }

  const stride = segs + 1;
  for (let rIdx = 0; rIdx < rings.length - 1; rIdx++) {
    for (let s = 0; s < segs; s++) {
      const a = rIdx * stride + s;
      const b = a + 1;
      const c = (rIdx + 1) * stride + s;
      const d = c + 1;
      // Winding facing +Y
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}

function createHardwoodFloorTexture() {
  const c = makeCanvas(512, 512);
  if (!c) return null;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#8C5E39';
  ctx.fillRect(0, 0, 512, 512);

  // Polished staggered oak hardwood planks
  const rows = 8;
  const cols = 4;
  const rowH = 512 / rows;
  const colW = 512 / cols;
  const plankPalette = ['#98663E', '#845633', '#A67248', '#7B4F2D', '#916039', '#8A5B36'];

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let k = -1; k <= cols; k++) {
      const x = k * colW + offset;
      const y = r * rowH;
      const tone = plankPalette[(r * 5 + k + 12) % plankPalette.length];
      ctx.fillStyle = tone;
      ctx.fillRect(x, y, colW, rowH);

      // Subtle glossy plank sheen gradient
      const g = ctx.createLinearGradient(x, y, x, y + rowH);
      g.addColorStop(0, 'rgba(255,228,196,0.10)');
      g.addColorStop(0.5, 'rgba(255,228,196,0.0)');
      g.addColorStop(1, 'rgba(30,15,6,0.16)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, colW, rowH);

      // Wood grain streaks
      ctx.strokeStyle = 'rgba(54, 30, 14, 0.20)';
      ctx.lineWidth = 1.4;
      for (let gLine = 0; gLine < 4; gLine++) {
        const gy = y + 10 + gLine * 14 + ((k + r) % 3) * 2;
        ctx.beginPath();
        ctx.moveTo(x + 2, gy);
        ctx.bezierCurveTo(
          x + colW * 0.35,
          gy + ((gLine % 2 === 0 ? 1 : -1) * 3.5),
          x + colW * 0.7,
          gy + ((gLine % 2 === 0 ? -1 : 1) * 3.5),
          x + colW - 2,
          gy
        );
        ctx.stroke();
      }

      // Crisp plank bevel seams
      ctx.strokeStyle = 'rgba(34, 18, 8, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, colW, rowH);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.2, 3.2);
  tex.needsUpdate = true;
  return tex;
}

function createLabWallTexture() {
  const c = makeCanvas(512, 256);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(256, 138, 30, 256, 138, 320);
  g.addColorStop(0, '#22364F');
  g.addColorStop(0.55, '#182436');
  g.addColorStop(1, '#0F1824');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Faint architectural studio plaster texture
  ctx.fillStyle = 'rgba(255,255,255,0.018)';
  for (let i = 0; i < 400; i++) {
    const px = (i * 97) % 512;
    const py = (i * 53) % 256;
    ctx.fillRect(px, py, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createGoldWeightTexture() {
  const c = makeCanvas(256, 256);
  if (!c) return null;
  const ctx = c.getContext('2d');

  // Top strip (v >= 0.68 in UV, i.e. y <= 82px): pure brushed gold for bar & rims
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#FFE074');
  grad.addColorStop(0.45, '#F5B82E');
  grad.addColorStop(1, '#C98A14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Bottom badge area (centered at x=128, y=168 -> UV (0.5, 0.34)): stamped "10 KG" medallion
  ctx.save();
  ctx.translate(128, 168);
  ctx.strokeStyle = '#7A4E04';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 68, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#FFE994';
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6B4202';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 42px "DejaVu Sans", sans-serif';
  ctx.fillText('10', 0, -14);
  ctx.font = '800 24px "DejaVu Sans", sans-serif';
  ctx.fillText('KG', 0, 22);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createCeramicMugTexture() {
  const c = makeCanvas(256, 128);
  if (!c) return null;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#F6F2EA';
  ctx.fillRect(0, 0, 256, 128);

  // Cute teal & gold lab stripe
  ctx.fillStyle = '#2563EB';
  ctx.fillRect(0, 14, 256, 8);
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(0, 24, 256, 3);

  ctx.fillStyle = '#1E3A5F';
  ctx.font = '800 26px "DejaVu Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E=mc²', 128, 72);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Draw crisp chalk doodles on the left/outer chalkboard regions so Chewinstein never obscures the core equation.
 */
function drawBoardBaseAndDoodles(ctx, w, h) {
  // Deep green-slate base
  const bg = ctx.createRadialGradient(w * 0.56, h * 0.48, 40, w * 0.5, h * 0.5, w * 0.72);
  bg.addColorStop(0, '#1D3E33');
  bg.addColorStop(0.65, '#17332A');
  bg.addColorStop(1, '#10251F');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Faint dusty chalk clouds
  ctx.fillStyle = 'rgba(230, 248, 240, 0.03)';
  for (let i = 0; i < 18; i++) {
    const cx = ((i * 193) % (w - 140)) + 70;
    const cy = ((i * 107) % (h - 120)) + 60;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 65 + (i % 4) * 20, 26 + (i % 3) * 12, (i % 5) * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle chalk border frame
  ctx.strokeStyle = 'rgba(226, 244, 236, 0.16)';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  // Left-side physics doodles (behind Chewinstein's silhouette area)
  ctx.save();
  ctx.strokeStyle = 'rgba(228, 244, 236, 0.36)';
  ctx.fillStyle = 'rgba(228, 244, 236, 0.40)';
  ctx.lineWidth = 3.2;

  // Mini Bohr atom doodle (top-left)
  ctx.save();
  ctx.translate(148, 138);
  for (let a = 0; a < 3; a++) {
    ctx.save();
    ctx.rotate((a * Math.PI) / 3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 56, 21, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Mini rocket doodle (bottom-left)
  ctx.save();
  ctx.translate(128, 468);
  ctx.rotate(-0.28);
  ctx.beginPath();
  ctx.moveTo(0, -42);
  ctx.quadraticCurveTo(22, -10, 16, 24);
  ctx.lineTo(-16, 24);
  ctx.quadraticCurveTo(-22, -10, 0, -42);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -8, 7, 0, Math.PI * 2);
  ctx.stroke();
  // Exhaust flame
  ctx.beginPath();
  ctx.moveTo(-8, 26);
  ctx.lineTo(0, 44);
  ctx.lineTo(8, 26);
  ctx.stroke();
  ctx.restore();

  // Small formula notes on far margins
  ctx.font = 'italic 700 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(216, 240, 230, 0.34)';
  ctx.fillText('c ≈ 3×10⁸ m/s', 54, 272);
  ctx.fillText('ΔE = Δmc²', 842, 540);

  // Subtle chalk arrow pointing toward main center-right formula
  ctx.beginPath();
  ctx.moveTo(212, 326);
  ctx.quadraticCurveTo(258, 300, 294, 298);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(282, 290);
  ctx.lineTo(298, 298);
  ctx.lineTo(283, 308);
  ctx.stroke();
  ctx.restore();
}

function drawChalkText(ctx, text, x, y, font, fillHex, glowHex = null, glowBlur = 10) {
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';

  if (glowHex) {
    ctx.shadowColor = glowHex;
    ctx.shadowBlur = glowBlur;
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 4;
  ctx.strokeText(text, x, y);

  ctx.fillStyle = fillHex;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawEquationLine(ctx, centerX, baselineY, eqState, scale = 1.0) {
  const mainPx = Math.round(142 * scale);
  const supPx = Math.round(88 * scale);
  const mainFont = `900 ${mainPx}px "DejaVu Sans", sans-serif`;
  const supFont = `900 ${supPx}px "DejaVu Sans", sans-serif`;

  ctx.save();
  ctx.font = mainFont;
  const wE = ctx.measureText('E').width;
  const wGap = Math.round(28 * scale);
  const wEq = ctx.measureText('=').width;
  const wMC = ctx.measureText('mc').width;
  ctx.font = supFont;
  const wSup = ctx.measureText('2').width;

  const totalW = wE + wGap + wEq + wGap + wMC + wSup;
  const startX = centerX - totalW * 0.5;

  const xE = startX;
  const xEq = xE + wE + wGap;
  const xMC = xEq + wEq + wGap;
  const xSup = xMC + wMC + Math.round(3 * scale);

  // "E"
  drawChalkText(ctx, 'E', xE, baselineY, mainFont, '#F8FAF9', 'rgba(255,255,255,0.35)', 8);

  // "=" or "≠"
  if (eqState === 1) {
    // Broken red-coral "≠" with glow
    drawChalkText(ctx, '=', xEq, baselineY, mainFont, '#FFF1F2', 'rgba(255,75,98,0.65)', 14);
    const eqMidX = xEq + wEq * 0.5;
    const eqMidY = baselineY - mainPx * 0.34;
    ctx.save();
    ctx.strokeStyle = '#FF4D6A';
    ctx.shadowColor = '#FF1F4B';
    ctx.shadowBlur = 24;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.round(16 * scale);
    ctx.beginPath();
    ctx.moveTo(eqMidX - 38 * scale, eqMidY + 52 * scale);
    ctx.lineTo(eqMidX + 40 * scale, eqMidY - 56 * scale);
    ctx.stroke();

    // Inner bright coral highlight core
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#FFD1D9';
    ctx.lineWidth = Math.round(5 * scale);
    ctx.beginPath();
    ctx.moveTo(eqMidX - 36 * scale, eqMidY + 49 * scale);
    ctx.lineTo(eqMidX + 38 * scale, eqMidY - 53 * scale);
    ctx.stroke();
    ctx.restore();
  } else if (eqState === 2 || eqState === 3) {
    // Gleaming golden "="
    drawChalkText(ctx, '=', xEq, baselineY, mainFont, '#FFE45E', '#FFB703', 26);
    drawChalkText(ctx, '=', xEq, baselineY, mainFont, '#FFF7C2', null, 0);
  } else {
    // Crisp white chalk "="
    drawChalkText(ctx, '=', xEq, baselineY, mainFont, '#F8FAF9', 'rgba(255,255,255,0.4)', 10);
  }

  // "mc" + superscript "2"
  drawChalkText(ctx, 'mc', xMC, baselineY, mainFont, '#F8FAF9', 'rgba(255,255,255,0.35)', 8);
  drawChalkText(ctx, '2', xSup, baselineY - Math.round(52 * scale), supFont, '#F8FAF9', 'rgba(255,255,255,0.35)', 8);
  ctx.restore();

  return {
    eqMidX: xEq + wEq * 0.5,
    eqMidY: baselineY - mainPx * 0.34,
  };
}

function drawFourPointStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.quadraticCurveTo(0, 0, 0, r);
  ctx.quadraticCurveTo(0, 0, -r, 0);
  ctx.quadraticCurveTo(0, 0, 0, -r);
  ctx.fill();
  ctx.restore();
}

function renderChalkboardState(canvas, stateIdx) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  drawBoardBaseAndDoodles(ctx, w, h);

  // Center-right anchor X = 616px (strictly clear of Chewinstein hair on left and SunOrb high above right!)
  const centerX = 616;

  if (stateIdx === 0) {
    drawEquationLine(ctx, centerX, 298, 0, 0.94);
    // Subtle cheerful underline
    ctx.save();
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.72)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(418, 330);
    ctx.quadraticCurveTo(616, 338, 814, 326);
    ctx.stroke();
    ctx.font = '800 26px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(167, 243, 208, 0.88)';
    ctx.textAlign = 'center';
    ctx.fillText('ENERGY = MASS × LIGHT²', centerX, 378);
    ctx.restore();
  } else if (stateIdx === 1) {
    // Comedic chalk sneeze smear streak sweeping across the "="
    ctx.save();
    for (let s = 0; s < 5; s++) {
      const grad = ctx.createLinearGradient(310, 335, 790, 175);
      grad.addColorStop(0, 'rgba(255,255,255,0.0)');
      grad.addColorStop(0.45, `rgba(255,220,226,${0.16 - s * 0.02})`);
      grad.addColorStop(1, 'rgba(255,255,255,0.0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 24 - s * 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(325 + s * 14, 336 - s * 16);
      ctx.quadraticCurveTo(520, 246 - s * 8, 765, 192 - s * 10);
      ctx.stroke();
    }
    // Chalk dust puffs around the slash
    ctx.fillStyle = 'rgba(255, 228, 232, 0.42)';
    for (let d = 0; d < 14; d++) {
      const dx = 490 + ((d * 31) % 140);
      const dy = 170 + ((d * 47) % 165);
      ctx.beginPath();
      ctx.arc(dx, dy, 2.5 + (d % 3) * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const { eqMidX, eqMidY } = drawEquationLine(ctx, centerX, 298, 1, 0.96);

    // Bold impact stress lines around ≠
    ctx.save();
    ctx.strokeStyle = '#FF6B81';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const rays = [
      [-60, -78, -82, -98],
      [58, -78, 82, -100],
      [-64, 52, -88, 70],
      [60, 52, 84, 70],
    ];
    for (const [x1, y1, x2, y2] of rays) {
      ctx.beginPath();
      ctx.moveTo(eqMidX + x1, eqMidY + y1);
      ctx.lineTo(eqMidX + x2, eqMidY + y2);
      ctx.stroke();
    }
    ctx.font = '900 30px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FCA5A5';
    ctx.textAlign = 'center';
    ctx.fillText('PHYSICS BROKEN!', centerX, 382);
    ctx.restore();
  } else if (stateIdx === 2) {
    drawEquationLine(ctx, centerX, 298, 2, 0.96);

    // Gleaming star sparks around golden "="
    drawFourPointStar(ctx, 514, 174, 21, '#FFE066');
    drawFourPointStar(ctx, 578, 188, 15, '#FFF59D');
    drawFourPointStar(ctx, 506, 330, 16, '#FFE066');
    drawFourPointStar(ctx, 580, 338, 23, '#FFD166');
    drawFourPointStar(ctx, 842, 198, 17, '#38BDF8');

    ctx.save();
    ctx.font = '900 30px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FDE68A';
    ctx.textAlign = 'center';
    ctx.fillText('RESTORED!', centerX, 386);
    ctx.restore();
  } else {
    // State 3: "E = mc²" top + bold "+ COFFEE" cleanly clear of Chewinstein + cute steaming mug doodle
    drawEquationLine(ctx, 608, 234, 3, 0.86);

    ctx.save();
    const coffeeText = '+ COFFEE';
    const coffeeFont = '900 84px "DejaVu Sans", sans-serif';
    drawChalkText(ctx, coffeeText, 412, 376, coffeeFont, '#5EEAD4', '#38BDF8', 20);

    // Gold-cyan playful swoosh underline
    ctx.strokeStyle = '#FFE066';
    ctx.shadowColor = '#FFB703';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(416, 402);
    ctx.quadraticCurveTo(610, 416, 822, 398);
    ctx.stroke();
    ctx.restore();

    // Cute steaming chalk coffee mug doodle beside "+ COFFEE"
    ctx.save();
    ctx.translate(888, 344);
    ctx.strokeStyle = '#FFF3C4';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Mug body
    ctx.beginPath();
    ctx.roundRect(-30, -22, 56, 62, [4, 4, 14, 14]);
    ctx.stroke();
    // Mug handle
    ctx.beginPath();
    ctx.arc(26, 9, 16, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    // Heart on mug
    ctx.fillStyle = '#FF758F';
    ctx.font = '900 22px "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♥', -2, 16);
    // 3 wavy steam curls
    ctx.strokeStyle = '#7DD3FC';
    ctx.lineWidth = 3.5;
    for (let s = -1; s <= 1; s++) {
      const sx = s * 14 - 3;
      ctx.beginPath();
      ctx.moveTo(sx, -32);
      ctx.quadraticCurveTo(sx - 8, -45, sx + 2, -58);
      ctx.quadraticCurveTo(sx + 9, -69, sx - 2, -78);
      ctx.stroke();
    }
    ctx.restore();

    drawFourPointStar(ctx, 386, 314, 15, '#FFE066');
    drawFourPointStar(ctx, 840, 174, 17, '#38BDF8');
  }
}

/**
 * Builds the 3D Physics Lab environment, 4-state dynamic chalkboard, desk, brass lamp,
 * slow-mo instanced photons, floating mug & weight, morphing Sun Orb, snow & confetti.
 */
export function buildPhysicsLab(scene, registry = new MaterialRegistry(), timeline = null) {
  const wc = timeline?.worldContract || {};
  const floorY = wc.floorY ?? 0.0;
  const chalkboardPos = wc.chalkboardPos || [0.10, 1.38, -1.16];
  const deskPos = wc.deskPos || [0.60, 0.0, 0.14];
  const deskTopY = wc.deskTopY ?? 0.78;
  const lampPos = wc.lampPos || [0.80, 0.78, 0.24];
  const mugRestPos = wc.mugRestPos || [0.38, 0.78, 0.28];
  const weightRestPos = wc.weightRestPos || [0.60, 0.78, 0.02];
  const sunOrbPos = wc.sunOrbPos || [0.58, 1.56, 0.08];
  const defaultNosePos = [-0.25, 1.48, 0.24];

  const labGroup = new THREE.Group();
  labGroup.name = 'physics_lab';
  if (scene) scene.add(labGroup);

  // --- Shared Materials (compact count for <= 25 total scene materials) ---
  const floorTex = createHardwoodFloorTexture();
  const floorMat = registry.getStandard('lab_floor_oak', {
    map: floorTex || null,
    color: floorTex ? '#FFFFFF' : '#7B5638',
    roughness: 0.36,
    metalness: 0.05,
    vertexColors: true,
  });

  const wallTex = createLabWallTexture();
  const wallMat = registry.getStandard('lab_wall_teal', {
    map: wallTex || null,
    color: wallTex ? '#FFFFFF' : '#182436',
    roughness: 0.90,
    metalness: 0.02,
  });

  const oakMat = registry.getStandard('lab_wood_oak', {
    color: '#633F26',
    roughness: 0.56,
    metalness: 0.04,
  });

  const walnutMat = registry.getStandard('lab_wood_walnut', {
    color: '#4B2D1B',
    roughness: 0.44,
    metalness: 0.05,
  });

  const brassMat = registry.getStandard('lab_brass', {
    color: '#D5A238',
    roughness: 0.28,
    metalness: 0.72,
  });

  const goldTex = createGoldWeightTexture();
  const goldWeightMat = registry.getStandard('lab_gold_weight', {
    map: goldTex || null,
    color: goldTex ? '#FFFFFF' : '#F4BE37',
    roughness: 0.22,
    metalness: 0.76,
  });

  const mugTex = createCeramicMugTexture();
  const mugMat = registry.getStandard('lab_ceramic_mug', {
    map: mugTex || null,
    color: mugTex ? '#FFFFFF' : '#F6F2EA',
    roughness: 0.22,
    metalness: 0.04,
  });

  const coffeeMat = registry.getStandard('lab_coffee_dark', {
    color: '#2F170B',
    roughness: 0.16,
    metalness: 0.02,
  });

  const photonMat = registry.getStandard('lab_photon_glow', {
    color: '#FFF3A8',
    emissive: '#FFD43B',
    emissiveIntensity: 1.5,
    roughness: 0.18,
    metalness: 0.0,
  });

  const sunMat = registry.getStandard('lab_sun_orb', {
    color: '#FFA928',
    emissive: '#FF7B00',
    emissiveIntensity: 1.45,
    roughness: 0.28,
    metalness: 0.04,
  });

  const snowMat = registry.getBasic('lab_snow_ice', {
    color: '#DFF3FF',
  });

  const confettiMat = registry.getBasic('lab_confetti', {
    color: '#FFFFFF',
  });

  // --- 1. Floor (1 draw) ---
  const floorGeo = buildRadialWoodFloorGeometry([0, 2.1, 4.4, 8.5], 40);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = floorY;
  floorMesh.receiveShadow = true;
  floorMesh.name = 'lab_floor';
  labGroup.add(floorMesh);

  // --- 2. Back Studio Wall + Wainscot Trim (2 draws) ---
  const wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(16.0, 7.2), wallMat);
  wallMesh.position.set(0, floorY + 3.6, -1.36);
  wallMesh.receiveShadow = true;
  wallMesh.name = 'lab_wall';
  labGroup.add(wallMesh);

  const wainscotParts = [];
  const chairRail = new THREE.BoxGeometry(16.0, 0.075, 0.048);
  chairRail.translate(0, 0.72, -1.335);
  wainscotParts.push(chairRail);

  const midRail = new THREE.BoxGeometry(16.0, 0.04, 0.032);
  midRail.translate(0, 0.36, -1.34);
  wainscotParts.push(midRail);

  const baseboard = new THREE.BoxGeometry(16.0, 0.12, 0.052);
  baseboard.translate(0, 0.06, -1.335);
  wainscotParts.push(baseboard);

  for (let px = -5.5; px <= 5.51; px += 1.1) {
    const pilaster = new THREE.BoxGeometry(0.055, 0.64, 0.028);
    pilaster.translate(px, 0.38, -1.342);
    wainscotParts.push(pilaster);
  }
  const wainscotMesh = new THREE.Mesh(safeMerge(wainscotParts), oakMat);
  wainscotMesh.receiveShadow = true;
  wainscotMesh.name = 'lab_wainscot';
  labGroup.add(wainscotMesh);

  // --- 3. Dynamic 4-State Vintage Chalkboard (3 draws) ---
  const chalkboardGroup = new THREE.Group();
  chalkboardGroup.name = 'chalkboard_assembly';
  chalkboardGroup.position.set(chalkboardPos[0], chalkboardPos[1], chalkboardPos[2]);
  labGroup.add(chalkboardGroup);

  const slateW = 2.30;
  const slateH = 1.38;
  const frameT = 0.075;
  const frameD = 0.07;

  const frameParts = [];
  const topBar = new THREE.BoxGeometry(slateW + frameT * 2, frameT, frameD);
  topBar.translate(0, slateH * 0.5 + frameT * 0.5, 0);
  frameParts.push(topBar);

  const botBar = new THREE.BoxGeometry(slateW + frameT * 2, frameT, frameD);
  botBar.translate(0, -slateH * 0.5 - frameT * 0.5, 0);
  frameParts.push(botBar);

  const leftBar = new THREE.BoxGeometry(frameT, slateH, frameD);
  leftBar.translate(-slateW * 0.5 - frameT * 0.5, 0, 0);
  frameParts.push(leftBar);

  const rightBar = new THREE.BoxGeometry(frameT, slateH, frameD);
  rightBar.translate(slateW * 0.5 + frameT * 0.5, 0, 0);
  frameParts.push(rightBar);

  // Chalk ledge tray
  const tray = new THREE.BoxGeometry(slateW + 0.08, 0.028, 0.10);
  tray.translate(0, -slateH * 0.5 - frameT + 0.014, 0.055);
  frameParts.push(tray);

  const trayLip = new THREE.BoxGeometry(slateW + 0.08, 0.020, 0.016);
  trayLip.translate(0, -slateH * 0.5 - frameT + 0.032, 0.098);
  frameParts.push(trayLip);

  // Back mounting struts to wall (z = -1.16 -> -1.36 => depth ~0.18)
  for (const sx of [-0.72, 0.72]) {
    const mount = new THREE.BoxGeometry(0.08, 0.18, 0.18);
    mount.translate(sx, 0.42, -0.11);
    frameParts.push(mount);
  }

  const boardFrameMesh = new THREE.Mesh(safeMerge(frameParts), oakMat);
  boardFrameMesh.receiveShadow = true;
  boardFrameMesh.name = 'chalkboard_frame';
  chalkboardGroup.add(boardFrameMesh);

  // Chalkboard Slate CanvasTexture (redraws ONLY on 4 discrete state changes)
  const boardCanvas = makeCanvas(1024, 614);
  let boardTex = null;
  if (boardCanvas) {
    renderChalkboardState(boardCanvas, 0);
    boardTex = new THREE.CanvasTexture(boardCanvas);
    boardTex.colorSpace = THREE.SRGBColorSpace;
    boardTex.needsUpdate = true;
  }

  const slateMat = registry.getStandard('lab_chalkboard_slate', {
    map: boardTex || null,
    color: boardTex ? '#FFFFFF' : '#17332A',
    emissive: '#FFFFFF',
    emissiveMap: boardTex || null,
    emissiveIntensity: boardTex ? 0.24 : 0.0,
    roughness: 0.88,
    metalness: 0.02,
  });

  const slateMesh = new THREE.Mesh(new THREE.PlaneGeometry(slateW, slateH), slateMat);
  slateMesh.position.set(0, 0, 0.018);
  slateMesh.receiveShadow = true;
  slateMesh.name = 'chalkboard_slate';
  chalkboardGroup.add(slateMesh);

  // Chalk sticks on tray (shares ceramic white mat, 1 draw)
  const chalkParts = [];
  const c1 = new THREE.CylinderGeometry(0.008, 0.008, 0.068, 8);
  c1.rotateZ(Math.PI * 0.5);
  c1.rotateY(0.14);
  c1.translate(0.32, -slateH * 0.5 - frameT + 0.036, 0.062);
  chalkParts.push(c1);
  const c2 = new THREE.CylinderGeometry(0.008, 0.008, 0.056, 8);
  c2.rotateZ(Math.PI * 0.5);
  c2.rotateY(-0.22);
  c2.translate(0.45, -slateH * 0.5 - frameT + 0.036, 0.066);
  chalkParts.push(c2);
  const chalkSticksMesh = new THREE.Mesh(safeMerge(chalkParts), mugMat);
  chalkSticksMesh.name = 'chalkboard_chalks';
  chalkboardGroup.add(chalkSticksMesh);

  // --- 4. Physics Lab Desk & Brass Hardware (3 draws) ---
  const deskGroup = new THREE.Group();
  deskGroup.name = 'physics_desk';
  deskGroup.position.set(deskPos[0], deskPos[1], deskPos[2]);
  labGroup.add(deskGroup);

  const deskW = 0.94;
  const deskD = 0.56;
  const topThick = 0.048;
  const legH = deskTopY - topThick;

  const deskWoodParts = [];
  // Beveled main tabletop (top exactly at y = deskTopY)
  const topGeo = new THREE.BoxGeometry(deskW, topThick, deskD);
  topGeo.translate(0, deskTopY - topThick * 0.5, 0);
  deskWoodParts.push(topGeo);

  // Apron + front drawer box
  const apronH = 0.14;
  const apronGeo = new THREE.BoxGeometry(deskW - 0.08, apronH, deskD - 0.07);
  apronGeo.translate(0, deskTopY - topThick - apronH * 0.5, 0);
  deskWoodParts.push(apronGeo);

  // Left & Right front drawer panels
  for (const dx of [-0.21, 0.21]) {
    const drawerFace = new THREE.BoxGeometry(0.38, 0.105, 0.024);
    drawerFace.translate(dx, deskTopY - topThick - apronH * 0.5, (deskD - 0.07) * 0.5 + 0.01);
    deskWoodParts.push(drawerFace);
  }

  // 4 Tapered legs
  const lx = deskW * 0.5 - 0.065;
  const lz = deskD * 0.5 - 0.065;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.CylinderGeometry(0.028, 0.019, legH, 8);
      leg.rotateY(Math.PI * 0.25);
      leg.translate(sx * lx, legH * 0.5, sz * lz);
      deskWoodParts.push(leg);
    }
  }

  const deskMesh = new THREE.Mesh(safeMerge(deskWoodParts), walnutMat);
  deskMesh.castShadow = true;
  deskMesh.receiveShadow = true;
  deskMesh.name = 'desk_wood';
  deskGroup.add(deskMesh);

  // Brass drawer pulls + leg ferrules (1 draw)
  const deskBrassParts = [];
  for (const dx of [-0.21, 0.21]) {
    const pull = new THREE.TorusGeometry(0.022, 0.0055, 6, 12, Math.PI);
    pull.rotateX(Math.PI * 0.85);
    pull.translate(dx, deskTopY - topThick - apronH * 0.5 + 0.005, (deskD - 0.07) * 0.5 + 0.025);
    deskBrassParts.push(pull);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cap = new THREE.CylinderGeometry(0.022, 0.020, 0.045, 8);
      cap.translate(sx * lx, 0.0225, sz * lz);
      deskBrassParts.push(cap);
    }
  }
  const deskBrassMesh = new THREE.Mesh(safeMerge(deskBrassParts), brassMat);
  deskBrassMesh.name = 'desk_brass_hardware';
  deskGroup.add(deskBrassMesh);

  // Desk floor contact shadow (1 draw)
  const deskShadow = createContactShadowDisc(0.56, 0.72, registry.contactShadowMat);
  deskShadow.scale.set(1.0, 1.0, 0.66);
  deskShadow.position.set(0, 0.003, 0);
  deskGroup.add(deskShadow);

  // --- 5. Brass Sun-Lamp (2 draws: brass frame + glowing bulb) ---
  const lampGroup = new THREE.Group();
  lampGroup.name = 'brass_sun_lamp';
  lampGroup.position.set(lampPos[0], lampPos[1], lampPos[2]);
  labGroup.add(lampGroup);

  const lampParts = [];
  // Weighted stepped base (bottom at y = 0)
  const baseProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.086, 0.0),
    new THREE.Vector2(0.082, 0.018),
    new THREE.Vector2(0.056, 0.032),
    new THREE.Vector2(0.022, 0.046),
    new THREE.Vector2(0.0, 0.048),
  ];
  lampParts.push(new THREE.LatheGeometry(baseProfile, 16));

  // Lower stem leaning slightly backward-right
  const stem1 = new THREE.CylinderGeometry(0.011, 0.013, 0.19, 10);
  stem1.rotateZ(-0.18);
  stem1.translate(0.017, 0.135, 0);
  lampParts.push(stem1);

  const joint1 = new THREE.SphereGeometry(0.018, 10, 8);
  joint1.translate(0.034, 0.225, 0);
  lampParts.push(joint1);

  // Upper arm reaching forward-left toward Chewinstein
  const stem2 = new THREE.CylinderGeometry(0.010, 0.011, 0.19, 10);
  stem2.rotateZ(0.58);
  stem2.translate(-0.018, 0.305, 0);
  lampParts.push(stem2);

  const joint2 = new THREE.SphereGeometry(0.017, 10, 8);
  joint2.translate(-0.068, 0.382, 0);
  lampParts.push(joint2);

  // Bell reflector shade pointing left-upward toward Chewinstein's nose (~[-0.25, 1.48, 0.24])
  const shadeProfile = [
    new THREE.Vector2(0.008, -0.02),
    new THREE.Vector2(0.032, -0.01),
    new THREE.Vector2(0.044, 0.035),
    new THREE.Vector2(0.076, 0.095),
    new THREE.Vector2(0.084, 0.105),
    new THREE.Vector2(0.074, 0.105),
    new THREE.Vector2(0.038, 0.035),
    new THREE.Vector2(0.008, 0.0),
  ];
  const shadeGeo = new THREE.LatheGeometry(shadeProfile, 18);
  // Orient shade mouth (-Y -> +Y) toward (-0.93, +0.34, 0)
  shadeGeo.rotateZ(1.92);
  shadeGeo.translate(-0.072, 0.362, 0);
  lampParts.push(shadeGeo);

  const lampMesh = new THREE.Mesh(safeMerge(lampParts), brassMat);
  lampMesh.castShadow = true;
  lampMesh.name = 'lamp_brass';
  lampGroup.add(lampMesh);

  // Lamp nozzle glowing bulb tucked inside shade opening
  const lampNozzleLocal = new THREE.Vector3(-0.155, 0.388, 0.0);
  const lampNozzleWorld = new THREE.Vector3(
    lampPos[0] + lampNozzleLocal.x,
    lampPos[1] + lampNozzleLocal.y,
    lampPos[2] + lampNozzleLocal.z
  );
  const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), photonMat);
  bulbMesh.position.set(lampNozzleLocal.x + 0.036, lampNozzleLocal.y - 0.012, 0);
  bulbMesh.name = 'lamp_bulb';
  lampGroup.add(bulbMesh);

  // --- 6. 12 Slow-Motion Bouncy Photons (InstancedMesh, 1 draw + 1 hero sprite) ---
  const PHOTON_COUNT = 12;
  const photonGeo = new THREE.SphereGeometry(0.048, 14, 10);
  const photonsMesh = new THREE.InstancedMesh(photonGeo, photonMat, PHOTON_COUNT);
  photonsMesh.frustumCulled = false;
  photonsMesh.name = 'slow_photons_instanced';
  labGroup.add(photonsMesh);

  const heroPhotonGlow = createGlowSprite('#FFE066', 0.34, 0.78);
  heroPhotonGlow.name = 'slow_photon_hero_glow';
  labGroup.add(heroPhotonGlow);

  // Deterministic parameters for sibling photons #1..#11
  const photonConfigs = [];
  for (let i = 0; i < PHOTON_COUNT; i++) {
    photonConfigs.push({
      delay: i === 0 ? 0.15 : 0.15 + ((i * 0.43) % 2.4),
      period: 2.55 + (i % 4) * 0.32,
      targetX: -0.52 + ((i * 0.27) % 0.92),
      targetY: 1.02 + ((i * 0.31) % 0.82),
      targetZ: 0.06 + ((i * 0.13) % 0.38),
      bobAmp: 0.055 + (i % 3) * 0.025,
      phase: i * 1.17,
      radiusScale: i === 0 ? 1.15 : 0.72 + (i % 4) * 0.10,
    });
  }

  // --- 7. Gold "10 KG" Weight (1 draw) ---
  const weightGroup = new THREE.Group();
  weightGroup.name = 'gold_weight';
  weightGroup.position.set(weightRestPos[0], weightRestPos[1], weightRestPos[2]);
  labGroup.add(weightGroup);

  const wPlateR = 0.072;
  const wPlateH = 0.038;
  const wBarHalf = 0.066;
  const weightParts = [];

  // Helper to orient UVs on dumbbell plates: outer circular caps map to "10 KG" medallion,
  // while side barrel strips sample pure brushed gold.
  // Note: rotateZ(+PI/2) maps (x, y, z) -> (-y, x, z), so ny > 0 becomes -X (left) and ny < 0 becomes +X (right).
  function makeGoldPlate(xOffset, sideSign) {
    const pGeo = new THREE.CylinderGeometry(wPlateR, wPlateR, wPlateH, 16);
    const pos = pGeo.attributes.position;
    const norm = pGeo.attributes.normal;
    const uv = pGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const nx = norm.getX(i);
      const ny = norm.getY(i);
      const nz = norm.getZ(i);
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      if (Math.abs(ny) > 0.7 && ny * sideSign < 0) {
        // Outer circular end face showing upright "10 KG"
        const u = 0.5 + (-sideSign) * (pz / (wPlateR * 2)) * 0.62;
        const v = 0.343 + (px / (wPlateR * 2)) * 0.58;
        uv.setXY(i, u, v);
      } else {
        // Pure brushed gold top band
        uv.setXY(i, 0.5 + (px / (wPlateR * 2)) * 0.3, 0.85 + nx * 0.05 + nz * 0.05);
      }
    }
    pGeo.rotateZ(Math.PI * 0.5);
    pGeo.translate(xOffset, wPlateR, 0);
    return pGeo;
  }

  weightParts.push(makeGoldPlate(-wBarHalf, -1));
  weightParts.push(makeGoldPlate(wBarHalf, 1));

  const barGeo = new THREE.CylinderGeometry(0.020, 0.020, wBarHalf * 2.0, 12);
  const barUv = barGeo.attributes.uv;
  for (let i = 0; i < barUv.count; i++) barUv.setXY(i, 0.5, 0.88);
  barGeo.rotateZ(Math.PI * 0.5);
  barGeo.translate(0, wPlateR, 0);
  weightParts.push(barGeo);

  const weightMesh = new THREE.Mesh(safeMerge(weightParts), goldWeightMat);
  weightMesh.castShadow = true;
  weightMesh.rotation.y = 0.54; // angle outer "10 KG" medallion nicely toward camera
  weightMesh.name = 'gold_10kg_mesh';
  weightGroup.add(weightMesh);

  // --- 8. Ceramic Lab Mug (2 draws: ceramic body+handle + inner dark coffee disc) ---
  const mugGroup = new THREE.Group();
  mugGroup.name = 'lab_coffee_mug';
  mugGroup.position.set(mugRestPos[0], mugRestPos[1], mugRestPos[2]);
  labGroup.add(mugGroup);

  const mugProfile = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.044, 0.0),
    new THREE.Vector2(0.047, 0.012),
    new THREE.Vector2(0.047, 0.106),
    new THREE.Vector2(0.045, 0.114),
    new THREE.Vector2(0.039, 0.114),
    new THREE.Vector2(0.038, 0.022),
    new THREE.Vector2(0.001, 0.022),
  ];
  const mugCupGeo = new THREE.LatheGeometry(mugProfile, 18);
  // Remap outer wall vertical UVs directly by height so "E=mc^2" & stripes span the outer mug wall cleanly
  const mPos = mugCupGeo.attributes.position;
  const mUv = mugCupGeo.attributes.uv;
  for (let i = 0; i < mPos.count; i++) {
    const x = mPos.getX(i);
    const y = mPos.getY(i);
    const z = mPos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.042 && y >= 0.006 && y <= 0.112) {
      mUv.setY(i, clamp01(y / 0.114));
    } else {
      mUv.setXY(i, 0.05, 0.05);
    }
  }
  mugCupGeo.rotateY(Math.PI); // put u=0.5 ("E=mc^2") dead center facing +Z toward camera

  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.043, 0.094, 0),
    new THREE.Vector3(0.075, 0.088, 0),
    new THREE.Vector3(0.078, 0.056, 0),
    new THREE.Vector3(0.072, 0.026, 0),
    new THREE.Vector3(0.043, 0.022, 0),
  ]);
  const mugHandleGeo = new THREE.TubeGeometry(handleCurve, 12, 0.0075, 8, false);
  const mugHuv = mugHandleGeo.attributes.uv;
  for (let i = 0; i < mugHuv.count; i++) mugHuv.setXY(i, 0.05, 0.05);
  const mugBodyMesh = new THREE.Mesh(safeMerge([mugCupGeo, mugHandleGeo]), mugMat);
  mugBodyMesh.castShadow = true;
  mugBodyMesh.name = 'mug_ceramic';
  mugGroup.add(mugBodyMesh);

  const coffeeDiscGeo = new THREE.CircleGeometry(0.038, 16);
  coffeeDiscGeo.rotateX(-Math.PI * 0.5);
  const coffeeDiscMesh = new THREE.Mesh(coffeeDiscGeo, coffeeMat);
  coffeeDiscMesh.position.y = 0.096;
  coffeeDiscMesh.name = 'mug_coffee';
  mugGroup.add(coffeeDiscMesh);

  // --- 9. Miniature Orbiting Sun Orb (3 draws: sphere + mini ring + glow sprite) ---
  const sunGroup = new THREE.Group();
  sunGroup.name = 'miniature_sun_orb';
  sunGroup.position.set(sunOrbPos[0], sunOrbPos[1], sunOrbPos[2]);
  labGroup.add(sunGroup);

  const sunSphere = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 14), sunMat);
  sunSphere.name = 'sun_core';
  sunGroup.add(sunSphere);

  // Miniature orbiting planetoid ring sharing sunMat (morphs icy in Beat 4 cleanly!)
  const ringTorus = new THREE.TorusGeometry(0.225, 0.007, 6, 28);
  ringTorus.rotateX(Math.PI * 0.5);
  const miniPlanet = new THREE.SphereGeometry(0.022, 10, 8);
  miniPlanet.translate(0.225, 0, 0);
  const sunRingMesh = new THREE.Mesh(safeMerge([ringTorus, miniPlanet]), sunMat);
  sunRingMesh.rotation.set(0.32, 0, -0.22);
  sunRingMesh.name = 'sun_orbit_ring';
  sunGroup.add(sunRingMesh);

  const sunGlow = createGlowSprite('#FFBE3B', 0.92, 0.85);
  sunGlow.name = 'sun_glow_sprite';
  sunGroup.add(sunGlow);

  // --- 10. 28 Instanced Icy Snow Specks (Beat 4) ---
  const SNOW_COUNT = 28;
  const snowMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.018, 0), snowMat, SNOW_COUNT);
  snowMesh.frustumCulled = false;
  snowMesh.name = 'icy_snow_instanced';
  labGroup.add(snowMesh);

  const snowSpecs = [];
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowSpecs.push({
      x0: -0.78 + ((i * 0.37) % 1.66),
      yOffset: ((i * 0.61) % 2.1),
      z0: -0.25 + ((i * 0.29) % 0.78),
      speed: 0.42 + (i % 5) * 0.08,
      swirlAmp: 0.06 + (i % 3) * 0.03,
      phase: i * 0.95,
      scale: 0.75 + (i % 4) * 0.22,
    });
  }

  // --- 11. 32 Instanced Chalk Confetti Sparks (Beats 5-6) ---
  const CONFETTI_COUNT = 32;
  const confettiGeo = new THREE.BoxGeometry(0.032, 0.032, 0.007);
  const confettiMesh = new THREE.InstancedMesh(confettiGeo, confettiMat, CONFETTI_COUNT);
  confettiMesh.frustumCulled = false;
  confettiMesh.name = 'chalk_confetti_instanced';
  const confettiColors = [
    new THREE.Color('#FFD43B'),
    new THREE.Color('#38BDF8'),
    new THREE.Color('#FF6B8B'),
    new THREE.Color('#FFFBEB'),
  ];
  const confettiSpecs = [];
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    confettiMesh.setColorAt(i, confettiColors[i % confettiColors.length]);
    const angle = (i / CONFETTI_COUNT) * Math.PI * 2 + (i % 3) * 0.35;
    const radialSpeed = 0.36 + (i % 5) * 0.14;
    confettiSpecs.push({
      vx: Math.cos(angle) * radialSpeed,
      vy: 0.58 + (i % 4) * 0.22,
      vz: Math.sin(angle) * radialSpeed * 0.55,
      spinX: 3.5 + (i % 5) * 1.4,
      spinY: 4.2 + (i % 4) * 1.3,
      scale: 0.85 + (i % 3) * 0.22,
    });
  }
  if (confettiMesh.instanceColor) confettiMesh.instanceColor.needsUpdate = true;
  labGroup.add(confettiMesh);

  // --- Pre-allocated reusable update math objects (0 heap allocations in update) ---
  const dummy = new THREE.Object3D();
  const colGolden = new THREE.Color('#FFA928');
  const colGoldenEmissive = new THREE.Color('#FF7B00');
  const colFrost = new THREE.Color('#7DD3FC');
  const colFrostEmissive = new THREE.Color('#38BDF8');
  const colGlowGold = new THREE.Color('#FFBE3B');
  const colGlowFrost = new THREE.Color('#BAE6FD');

  const anchors = {
    chalkboard: new THREE.Vector3(chalkboardPos[0], chalkboardPos[1], chalkboardPos[2]),
    deskTop: new THREE.Vector3(deskPos[0], deskTopY, deskPos[2]),
    slowPhotonHero: new THREE.Vector3(lampNozzleWorld.x, lampNozzleWorld.y, lampNozzleWorld.z),
    sunOrb: new THREE.Vector3(sunOrbPos[0], sunOrbPos[1], sunOrbPos[2]),
    floatingMug: new THREE.Vector3(mugRestPos[0], mugRestPos[1], mugRestPos[2]),
    confettiOrigin: new THREE.Vector3(0.24, 1.52, -0.08),
  };

  let lastBoardState = 0;

  function updateChalkboard(t) {
    let nextState = 0;
    if (t >= 26.85) nextState = 3;
    else if (t >= 22.15) nextState = 2;
    else if (t >= 1.80) nextState = 1;
    else nextState = 0;

    if (nextState !== lastBoardState) {
      lastBoardState = nextState;
      if (boardCanvas && boardTex) {
        renderChalkboardState(boardCanvas, nextState);
        boardTex.needsUpdate = true;
      }
    }
  }

  function updatePhotons(t, nosePos) {
    const active = t >= 4.55 && t <= 9.90;
    photonsMesh.visible = active;
    heroPhotonGlow.visible = active && t >= 4.65 && t <= 9.75;

    if (!active) {
      anchors.slowPhotonHero.copy(lampNozzleWorld);
      return;
    }

    const envelope = smoothstep(4.55, 4.90, t) * (1 - smoothstep(9.55, 9.90, t));

    // Photon #0 (slowPhotonHero): emerges at 4.65s, drifts lazily to Chewinstein's nose at t=6.65s, squishes & boings!
    let px = lampNozzleWorld.x;
    let py = lampNozzleWorld.y;
    let pz = lampNozzleWorld.z;
    let sx = 1.0;
    let sy = 1.0;
    let sz = 1.0;

    if (t < 4.65) {
      sx = sy = sz = 0.001;
    } else if (t < 5.05) {
      const e = smoothstep(4.65, 5.05, t);
      const s = 0.92 * e;
      sx = s * (1 + 0.12 * Math.sin(t * 14));
      sy = s * (1 - 0.10 * Math.sin(t * 14));
      sz = s;
    } else if (t < 6.65) {
      const u = clamp01((t - 5.05) / 1.60);
      px = lerp(lampNozzleWorld.x, nosePos.x, u);
      py = lerp(lampNozzleWorld.y, nosePos.y, u) + Math.sin(u * Math.PI) * 0.14 + Math.sin(u * Math.PI * 3.0) * 0.025;
      pz = lerp(lampNozzleWorld.z, nosePos.z, u) + Math.sin(u * Math.PI) * 0.04;

      const wobble = Math.sin(t * 9.5) * 0.10;
      sx = 1.14 + wobble;
      sy = 0.88 - wobble * 0.6;
      sz = 0.96;
    } else if (t < 6.88) {
      // Comedic nose squish boing right at t = 6.65s!
      const b = clamp01((t - 6.65) / 0.23);
      const sq = Math.sin(b * Math.PI);
      px = nosePos.x + sq * 0.028;
      py = nosePos.y;
      pz = nosePos.z;
      sx = 1.0 - sq * 0.52;
      sy = 1.0 + sq * 0.48;
      sz = 1.0 + sq * 0.42;
    } else {
      // Comedic slow-mo bounce away rightward-upward-forward
      const r = clamp01((t - 6.88) / 2.92);
      px = nosePos.x + 0.02 + r * 0.55;
      py = nosePos.y + Math.sin(r * Math.PI) * 0.40 - r * 0.28;
      pz = nosePos.z + Math.sin(r * Math.PI * 0.85) * 0.18;

      const jiggle = Math.sin((t - 6.65) * 18.0) * Math.exp(-(t - 6.65) * 2.2) * 0.34;
      sx = 1.0 + jiggle;
      sy = 1.0 - jiggle * 0.7;
      sz = 1.0 - jiggle * 0.5;
    }

    const heroScale = photonConfigs[0].radiusScale * envelope;
    dummy.position.set(px, py, pz);
    dummy.rotation.set(0, 0, Math.sin(t * 4.5) * 0.2);
    dummy.scale.set(sx * heroScale, sy * heroScale, sz * heroScale);
    dummy.updateMatrix();
    photonsMesh.setMatrixAt(0, dummy.matrix);

    anchors.slowPhotonHero.set(px, py, pz);
    heroPhotonGlow.position.set(px, py, pz);
    heroPhotonGlow.scale.setScalar(0.36 * Math.max(0.05, heroScale));
    heroPhotonGlow.material.opacity = 0.78 * envelope;

    // Photons #1..#11: staggered slow-motion wobbling photons
    for (let i = 1; i < PHOTON_COUNT; i++) {
      const cfg = photonConfigs[i];
      const localT = t - 4.60 - cfg.delay;
      if (localT <= 0) {
        dummy.position.copy(lampNozzleWorld);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        photonsMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const cycle = (localT % cfg.period) / cfg.period;
      const fadeIn = smoothstep(0.0, 0.14, cycle);
      const fadeOut = 1 - smoothstep(0.82, 1.0, cycle);
      const sBase = cfg.radiusScale * envelope * fadeIn * fadeOut;

      const ox = lerp(lampNozzleWorld.x, cfg.targetX, cycle);
      const oy =
        lerp(lampNozzleWorld.y, cfg.targetY, cycle) +
        Math.sin(cycle * Math.PI) * 0.16 +
        Math.sin(t * 3.8 + cfg.phase) * cfg.bobAmp;
      const oz = lerp(lampNozzleWorld.z, cfg.targetZ, cycle) + Math.cos(t * 2.9 + cfg.phase) * 0.05;

      const sq = Math.sin(t * 7.2 + cfg.phase) * 0.18;
      dummy.position.set(ox, oy, oz);
      dummy.rotation.set(0, 0, Math.sin(t * 3.1 + cfg.phase) * 0.25);
      dummy.scale.set((1 + sq) * sBase, (1 - sq * 0.75) * sBase, (1 - sq * 0.4) * sBase);
      dummy.updateMatrix();
      photonsMesh.setMatrixAt(i, dummy.matrix);
    }

    photonsMesh.instanceMatrix.needsUpdate = true;
  }

  function updateWeightAndMug(t) {
    // Desk mug hides cleanly for Beat 6 (t >= 25.8s) while Chewinstein toasts his hand mug
    mugGroup.visible = t < 25.80;

    let floatAmount = 0;
    let impactBounce = 0;

    if (t >= 9.85 && t < 21.85) {
      const up = easeOutCubic((t - 9.85) / 1.25);
      floatAmount = up;
    } else if (t >= 21.85 && t < 22.15) {
      // Gravity slams back on right at 22.15s!
      const drop = clamp01((t - 21.85) / 0.30);
      floatAmount = 1 - drop * drop;
    } else if (t >= 22.15 && t < 22.50) {
      const dt = t - 22.15;
      impactBounce = Math.abs(Math.sin(dt * Math.PI * 7.5)) * Math.exp(-dt * 11.0) * 0.042;
    }

    // Gold 10 KG Weight
    if (floatAmount > 0.0001) {
      const wx = lerp(weightRestPos[0], 0.76, floatAmount) + Math.sin(t * 1.4) * 0.03 * floatAmount;
      const wy = lerp(weightRestPos[1], 1.32, floatAmount) + Math.sin(t * 1.85 + 0.6) * 0.075 * floatAmount;
      const wz = lerp(weightRestPos[2], -0.02, floatAmount) + Math.cos(t * 1.3) * 0.03 * floatAmount;
      weightGroup.position.set(wx, wy, wz);
      weightGroup.rotation.set(
        Math.sin(t * 1.1) * 0.28 * floatAmount,
        (t - 9.85) * 0.55 * floatAmount,
        Math.cos(t * 1.25) * 0.38 * floatAmount
      );
    } else {
      weightGroup.position.set(weightRestPos[0], weightRestPos[1] + impactBounce, weightRestPos[2]);
      weightGroup.rotation.set(0, 0, impactBounce * 1.2);
    }

    // Ceramic Lab Mug
    if (floatAmount > 0.0001) {
      const mx = lerp(mugRestPos[0], 0.18, floatAmount) + Math.cos(t * 1.35) * 0.03 * floatAmount;
      const my = lerp(mugRestPos[1], 1.38, floatAmount) + Math.sin(t * 1.7 + 1.8) * 0.08 * floatAmount;
      const mz = lerp(mugRestPos[2], 0.32, floatAmount) + Math.sin(t * 1.2) * 0.025 * floatAmount;
      mugGroup.position.set(mx, my, mz);
      mugGroup.rotation.set(
        Math.cos(t * 1.15) * 0.24 * floatAmount,
        (t - 9.85) * 0.68 * floatAmount,
        Math.sin(t * 1.42) * 0.34 * floatAmount
      );
      anchors.floatingMug.set(mx, my, mz);
    } else {
      mugGroup.position.set(mugRestPos[0], mugRestPos[1] + impactBounce * 1.15, mugRestPos[2]);
      mugGroup.rotation.set(0, 0, -impactBounce * 1.1);
      anchors.floatingMug.set(mugRestPos[0], mugRestPos[1] + impactBounce * 1.15, mugRestPos[2]);
    }
  }

  function updateSunOrb(t) {
    const hoverY = sunOrbPos[1] + Math.sin(t * 2.1) * 0.025;
    let hoverX = sunOrbPos[0];

    let freeze01 = 0;
    if (t >= 15.0 && t < 22.15) {
      freeze01 = smoothstep(15.0, 15.85, t);
    }

    let sunScale = 1.0 + Math.sin(t * 4.2) * 0.04;
    if (freeze01 > 0.001) {
      sunScale = lerp(sunScale, 0.62, freeze01);
      // Shivering chill in Beat 4 / early Beat 5
      if (t >= 15.4 && t < 22.15) {
        hoverX += Math.sin(t * 44.0) * 0.007 * freeze01;
      }
    }

    let blazeBoost = 0;
    if (t >= 22.15) {
      const dt = t - 22.15;
      const pop = Math.sin(clamp01(dt / 0.28) * Math.PI) * 0.22;
      const settle = easeOutBack(clamp01(dt / 0.45));
      sunScale = lerp(0.62, 1.15, settle) + pop + Math.sin(t * 4.5) * 0.045;
      blazeBoost = Math.exp(-dt * 2.8) * 0.75 + 0.20;
    }

    sunGroup.position.set(hoverX, hoverY, sunOrbPos[2]);
    sunGroup.scale.setScalar(sunScale);
    anchors.sunOrb.set(hoverX, hoverY, sunOrbPos[2]);

    // Morph Sun material between blazing golden and icy frost-blue
    sunMat.color.copy(colGolden).lerp(colFrost, freeze01);
    sunMat.emissive.copy(colGoldenEmissive).lerp(colFrostEmissive, freeze01);
    sunMat.emissiveIntensity = lerp(1.45 + blazeBoost, 0.24, freeze01);
    sunMat.roughness = lerp(0.26, 0.84, freeze01);

    // Orbit ring spins happily when warm, freezes almost still when icy
    const ringSpin = freeze01 > 0.5 ? 15.3 * 1.4 : t * (t >= 22.15 ? 2.1 : 1.4);
    sunRingMesh.rotation.y = ringSpin;

    // Glow halo
    sunGlow.material.color.copy(colGlowGold).lerp(colGlowFrost, freeze01);
    const glowScale = lerp(0.92 + Math.sin(t * 4.2) * 0.06 + (t >= 22.15 ? 0.16 : 0), 0.36, freeze01);
    sunGlow.scale.set(glowScale, glowScale, 1);
    sunGlow.material.opacity = lerp(0.84 + (t >= 22.15 ? 0.10 : 0), 0.16, freeze01);
  }

  function updateSnow(t) {
    const active = t >= 15.0 && t <= 21.80;
    snowMesh.visible = active;
    if (!active) return;

    const env = smoothstep(15.0, 15.65, t) * (1 - smoothstep(20.30, 21.65, t));

    for (let i = 0; i < SNOW_COUNT; i++) {
      const sp = snowSpecs[i];
      const travel = ((t - 15.0) * sp.speed + sp.yOffset) % 2.15;
      const y = 2.25 - travel;
      const x = sp.x0 + Math.sin(t * 2.6 + sp.phase) * sp.swirlAmp;
      const z = sp.z0 + Math.cos(t * 2.1 + sp.phase) * sp.swirlAmp * 0.6;
      const s = sp.scale * env * smoothstep(0.10, 0.32, y) * (1 - smoothstep(2.02, 2.25, y));

      dummy.position.set(x, y, z);
      dummy.rotation.set(t * 2.2 + sp.phase, t * 1.7 + sp.phase, 0);
      dummy.scale.setScalar(Math.max(0.0001, s));
      dummy.updateMatrix();
      snowMesh.setMatrixAt(i, dummy.matrix);
    }
    snowMesh.instanceMatrix.needsUpdate = true;
  }

  function updateConfetti(t) {
    const active = t >= 22.15;
    confettiMesh.visible = active;
    if (!active) return;

    // Two bursts: at 22.15s (equals_slam) and 26.85s (chalk_scribble + COFFEE!)
    const isSecondBurst = t >= 26.85;
    const burstStart = isSecondBurst ? 26.85 : 22.15;
    const dt = t - burstStart;
    const fadeOut = isSecondBurst ? 1.0 - smoothstep(2.95, 3.35, dt) : 1.0 - smoothstep(2.8, 3.8, dt);
    const origin = anchors.confettiOrigin;

    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const sp = confettiSpecs[i];
      const spread = 1 - Math.exp(-dt * 2.4);
      const x = origin.x + sp.vx * spread * 1.35 + Math.sin(dt * 3.0 + i) * 0.08 * dt;
      const y = origin.y + sp.vy * dt * 0.65 - 0.22 * dt * dt;
      const z = origin.z + sp.vz * spread * 1.15;

      const s = sp.scale * fadeOut * (y > 0.10 ? 1.0 : 0.0001);
      dummy.position.set(x, Math.max(0.08, y), z);
      dummy.rotation.set(dt * sp.spinX, dt * sp.spinY, i * 0.4);
      dummy.scale.setScalar(Math.max(0.0001, s));
      dummy.updateMatrix();
      confettiMesh.setMatrixAt(i, dummy.matrix);
    }
    confettiMesh.instanceMatrix.needsUpdate = true;
  }

  const tmpNose = { x: defaultNosePos[0], y: defaultNosePos[1], z: defaultNosePos[2] };

  function update(t = 0, state = {}) {
    const nosePos = state?.chewinsteinNosePos || state?.nosePos || defaultNosePos;
    if (nosePos.isVector3) {
      tmpNose.x = nosePos.x;
      tmpNose.y = nosePos.y;
      tmpNose.z = nosePos.z;
    } else {
      tmpNose.x = nosePos[0] ?? defaultNosePos[0];
      tmpNose.y = nosePos[1] ?? defaultNosePos[1];
      tmpNose.z = nosePos[2] ?? defaultNosePos[2];
    }

    updateChalkboard(t);
    updatePhotons(t, tmpNose);
    updateWeightAndMug(t);
    updateSunOrb(t);
    updateSnow(t);
    updateConfetti(t);
  }

  function getAnchors() {
    return anchors;
  }

  // Initialize deterministic state at t=0
  update(0, {});

  return {
    update,
    getAnchors,
    labGroup,
  };
}
