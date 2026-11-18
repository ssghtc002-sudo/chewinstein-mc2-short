/**
 * Chewinstein E != mc^2 Main Application & Deterministic Frame Engine
 * (/home/antigravity/chewinstein-mc2-short/src/main.js)
 * Wires strict 3-light studio, dynamic per-beat FogExp2 atmospheric mood interpolation,
 * PhysicsLab + ChewinsteinCast, 6-beat camera director, clean boxless YouTube HUD,
 * and deterministic WebCodecs frame hooks.
 */
import * as THREE from 'three';
import { MaterialRegistry } from './engine/baseRig.js';
import { buildPhysicsLab } from './scene/physicsLab.js';
import { buildChewinsteinCast } from './scene/characters.js';
import { createChewinsteinDirector } from './camera/director.js';
import { createChewinsteinHud, createFrameCompositor } from './hud/chewinsteinHud.js';

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  const u = clamp01((x - e0) / Math.max(1e-5, e1 - e0));
  return u * u * (3 - 2 * u);
}

const MOODS = {
  amberLab: {
    bg: new THREE.Color('#322014'),
    fogDensity: 0.058,
    hemiSky: new THREE.Color('#FFEED6'),
    hemiGround: new THREE.Color('#3F2718'),
    hemiInt: 1.18,
    keyColor: new THREE.Color('#FFEAD0'),
    keyInt: 2.40,
    rimColor: new THREE.Color('#60A5FA'),
    rimInt: 1.15,
  },
  twilightTeal: {
    bg: new THREE.Color('#0E263A'),
    fogDensity: 0.064,
    hemiSky: new THREE.Color('#DDF3FF'),
    hemiGround: new THREE.Color('#132B45'),
    hemiInt: 1.12,
    keyColor: new THREE.Color('#F2F9FF'),
    keyInt: 2.15,
    rimColor: new THREE.Color('#38BDF8'),
    rimInt: 1.32,
  },
  frostBlue: {
    bg: new THREE.Color('#0A2142'),
    fogDensity: 0.072,
    hemiSky: new THREE.Color('#CBE6FF'),
    hemiGround: new THREE.Color('#0C203D'),
    hemiInt: 1.02,
    keyColor: new THREE.Color('#D8EEFF'),
    keyInt: 1.75,
    rimColor: new THREE.Color('#7DD3FC'),
    rimInt: 1.45,
  },
  goldFinale: {
    bg: new THREE.Color('#3B2611'),
    fogDensity: 0.052,
    hemiSky: new THREE.Color('#FFF5D6'),
    hemiGround: new THREE.Color('#472D14'),
    hemiInt: 1.25,
    keyColor: new THREE.Color('#FFE6A8'),
    keyInt: 2.60,
    rimColor: new THREE.Color('#60A5FA'),
    rimInt: 1.22,
  },
};

function blendMoods(a, b, alpha, outBg, outHemiSky, outHemiGround, outKey, outRim) {
  outBg.lerpColors(a.bg, b.bg, alpha);
  outHemiSky.lerpColors(a.hemiSky, b.hemiSky, alpha);
  outHemiGround.lerpColors(a.hemiGround, b.hemiGround, alpha);
  outKey.lerpColors(a.keyColor, b.keyColor, alpha);
  outRim.lerpColors(a.rimColor, b.rimColor, alpha);
  return {
    fogDensity: lerp(a.fogDensity, b.fogDensity, alpha),
    hemiInt: lerp(a.hemiInt, b.hemiInt, alpha),
    keyInt: lerp(a.keyInt, b.keyInt, alpha),
    rimInt: lerp(a.rimInt, b.rimInt, alpha),
  };
}

async function init() {
  const [timeline, manifest] = await Promise.all([
    fetch('/config/timeline.json').then((r) => r.json()),
    fetch('/audio/output/voice_manifest.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);

  const width = timeline.resolution?.width || 1080;
  const height = timeline.resolution?.height || 1920;
  const fps = timeline.fps || 30;
  const duration = timeline.duration || 30.0;
  const totalFrames = timeline.totalFrames || 900;

  const webglCanvas = document.getElementById('webgl-canvas');
  const hudCanvas = document.getElementById('hud-canvas');

  const renderer = new THREE.WebGLRenderer({
    canvas: webglCanvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = MOODS.amberLab.bg.clone();
  scene.fog = new THREE.FogExp2(MOODS.amberLab.bg.getHex(), MOODS.amberLab.fogDensity);

  const camera = new THREE.PerspectiveCamera(45.5, width / height, 0.1, 80);

  // Strict 3-Light Compiled Cap
  const hemiLight = new THREE.HemisphereLight('#FFF5E4', '#1F2A3D', 1.15);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#FFEED6', 2.4);
  keyLight.position.set(2.4, 4.6, 3.6);
  keyLight.target.position.set(0.10, 0.85, -0.20);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -2.4;
  keyLight.shadow.camera.right = 2.4;
  keyLight.shadow.camera.top = 2.4;
  keyLight.shadow.camera.bottom = -2.4;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 16.0;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.025;
  scene.add(keyLight);
  scene.add(keyLight.target);

  const rimLight = new THREE.DirectionalLight('#60A5FA', 1.15);
  rimLight.position.set(-3.2, 3.0, -2.8);
  rimLight.castShadow = false;
  scene.add(rimLight);

  const registry = new MaterialRegistry();
  const lab = buildPhysicsLab(scene, registry, timeline);
  if (lab?.labGroup && !lab.labGroup.parent) {
    scene.add(lab.labGroup);
  }

  const cast = buildChewinsteinCast(scene, registry, timeline);
  if (cast?.castGroup && !cast.castGroup.parent) {
    scene.add(cast.castGroup);
  } else {
    if (cast?.chewinstein?.root && !cast.chewinstein.root.parent) {
      scene.add(cast.chewinstein.root);
    }
    if (cast?.atom?.root && !cast.atom.root.parent) {
      scene.add(cast.atom.root);
    }
  }

  const director = createChewinsteinDirector(camera, timeline);
  const hud = createChewinsteinHud(timeline, manifest, hudCanvas);
  const compositor = createFrameCompositor(webglCanvas, hudCanvas, width, height);

  const tmpBg = new THREE.Color();
  const tmpHemiSky = new THREE.Color();
  const tmpHemiGround = new THREE.Color();
  const tmpKey = new THREE.Color();
  const tmpRim = new THREE.Color();

  function updateAtmosphere(t) {
    let scalars;
    if (t < 14.8) {
      const u = smoothstep(9.5, 10.2, t);
      scalars = blendMoods(MOODS.amberLab, MOODS.twilightTeal, u, tmpBg, tmpHemiSky, tmpHemiGround, tmpKey, tmpRim);
    } else if (t < 20.0) {
      const u = smoothstep(14.8, 15.6, t);
      scalars = blendMoods(MOODS.twilightTeal, MOODS.frostBlue, u, tmpBg, tmpHemiSky, tmpHemiGround, tmpKey, tmpRim);
    } else {
      const uPre = smoothstep(20.0, 20.6, t) * 0.45;
      const uSlam = smoothstep(22.05, 22.45, t) * 0.55;
      const u = clamp01(uPre + uSlam);
      scalars = blendMoods(MOODS.frostBlue, MOODS.goldFinale, u, tmpBg, tmpHemiSky, tmpHemiGround, tmpKey, tmpRim);
    }

    scene.background.copy(tmpBg);
    scene.fog.color.copy(tmpBg);
    scene.fog.density = scalars.fogDensity;

    hemiLight.color.copy(tmpHemiSky);
    hemiLight.groundColor.copy(tmpHemiGround);
    hemiLight.intensity = scalars.hemiInt;
    keyLight.color.copy(tmpKey);
    keyLight.intensity = scalars.keyInt;
    rimLight.color.copy(tmpRim);
    rimLight.intensity = scalars.rimInt;
  }

  function renderFrame(frameIdx) {
    const f = Math.max(0, Math.min(totalFrames - 1, Math.round(frameIdx)));
    const t = f / fps;

    updateAtmosphere(t);

    cast.update(t, manifest);
    const castState = cast.getState ? cast.getState() : {};
    const castAnchors = cast.getAnchors ? cast.getAnchors() : {};
    const sharedState = {
      ...castState,
      anchors: castAnchors,
      chewinsteinNosePos: castState.chewinsteinNosePos || castAnchors.chewinsteinNose,
    };

    lab.update(t, sharedState);
    director.update(t, sharedState);

    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    hud.draw(t, { ...sharedState, beat: director.findBeatAt(t) });

    return {
      frame: f,
      t: +t.toFixed(4),
      calls: renderer.info.render.calls,
      tris: renderer.info.render.triangles,
      materials: registry.count(),
    };
  }

  window.__RENDER_FRAME__ = renderFrame;
  window.__GET_COMPOSITE_CANVAS__ = () => compositor.composite();
  window.__TIMELINE__ = timeline;
  window.__SCENE_READY__ = true;

  renderFrame(0);

  const params = new URLSearchParams(window.location.search);
  if (!params.has('render')) {
    const startMs = performance.now();
    function tick() {
      const elapsed = ((performance.now() - startMs) / 1000) % duration;
      renderFrame(Math.round(elapsed * fps));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
}

init().catch((err) => {
  console.error('[Main Init Error]', err);
});
