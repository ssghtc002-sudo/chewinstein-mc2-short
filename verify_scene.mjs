/**
 * Sub-1-Second Node Pre-Flight Gate (/home/antigravity/chewinstein-mc2-short/verify_scene.mjs)
 * Evaluates 30 timestamps (0..30s) for:
 *  - Zero NaN matrices or positions across scene graph
 *  - Strict WebGL budgets (<= 55 draws, <= 55,000 tris, <= 25 materials, <= 3 lights)
 *  - Chewinstein foot grounding when standing (t < 21.2 || t > 22.6, |minY - 0.0| <= 0.025)
 *  - Camera NDC safe viewport bounds (|ndcX| <= 0.90, ndcY in [-0.60 .. +0.88])
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { MaterialRegistry } from './src/engine/baseRig.js';
import { buildPhysicsLab } from './src/scene/physicsLab.js';
import { buildChewinsteinCast } from './src/scene/characters.js';
import { createChewinsteinDirector } from './src/camera/director.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const timeline = JSON.parse(await fs.readFile(path.join(__dirname, 'config', 'timeline.json'), 'utf-8'));
const manifest = await fs
  .readFile(path.join(__dirname, 'audio', 'output', 'voice_manifest.json'), 'utf-8')
  .then((txt) => JSON.parse(txt))
  .catch(() => null);

const BUDGETS = {
  maxDraws: 55,
  maxTris: 55000,
  maxMaterials: 25,
  maxLights: 3,
};

function countSceneMetrics(root) {
  let draws = 0;
  let totalTris = 0;
  let lights = 0;
  const uniqueMaterials = new Set();

  function walk(obj) {
    if (!obj.visible) return;
    if (obj.isLight) lights++;

    if (obj.isInstancedMesh) {
      draws++;
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => uniqueMaterials.add(m));
        else uniqueMaterials.add(obj.material);
      }
      const g = obj.geometry;
      if (g) {
        const trisPerInst = g.index
          ? g.index.count / 3
          : g.attributes.position
            ? g.attributes.position.count / 3
            : 0;
        totalTris += Math.round(trisPerInst * obj.count);
      }
    } else if (obj.isMesh || obj.isSprite || obj.isLine || obj.isLineSegments || obj.isPoints) {
      draws++;
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => uniqueMaterials.add(m));
        else uniqueMaterials.add(obj.material);
      }
      if (obj.geometry) {
        const g = obj.geometry;
        const tris = g.index
          ? g.index.count / 3
          : g.attributes.position
            ? g.attributes.position.count / 3
            : 0;
        totalTris += Math.round(tris);
      }
    }

    for (let i = 0; i < obj.children.length; i++) {
      walk(obj.children[i]);
    }
  }

  walk(root);
  return {
    draws,
    totalTris,
    uniqueMaterials: uniqueMaterials.size,
    lights,
  };
}

function findNaNNode(root) {
  let bad = null;
  root.traverse((obj) => {
    if (bad) return;
    const p = obj.position;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      bad = `${obj.name || obj.type} (position)`;
      return;
    }
    const elems = obj.matrixWorld.elements;
    for (let i = 0; i < 16; i++) {
      if (!Number.isFinite(elems[i])) {
        bad = `${obj.name || obj.type} (matrixWorld[${i}])`;
        return;
      }
    }
  });
  return bad;
}

function resolveAnchorVec(raw, outVec) {
  if (!raw) return null;
  if (raw.isVector3 || (typeof raw.x === 'number' && typeof raw.y === 'number' && typeof raw.z === 'number')) {
    outVec.set(raw.x, raw.y, raw.z);
    return { vec: outVec, visible: raw.visible !== false };
  }
  const src = raw.worldPos || raw.pos || raw.position;
  if (src && typeof src.x === 'number') {
    outVec.set(src.x, src.y, src.z);
    return { vec: outVec, visible: raw.visible !== false };
  }
  if (Array.isArray(raw) && raw.length >= 3) {
    outVec.set(raw[0], raw[1], raw[2]);
    return { vec: outVec, visible: true };
  }
  return null;
}

// Match src/main.js setup
const width = timeline.resolution?.width || 1080;
const height = timeline.resolution?.height || 1920;
const duration = Number(timeline.duration || 30.0);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#241A14');
scene.fog = new THREE.FogExp2('#241A14', 0.028);

const camera = new THREE.PerspectiveCamera(45.5, width / height, 0.1, 80);

// Strict 3-light setup matching src/main.js
scene.add(new THREE.HemisphereLight('#FFF5E4', '#1F2A3D', 1.15));
const keyLight = new THREE.DirectionalLight('#FFEED6', 2.4);
keyLight.position.set(2.4, 4.6, 3.6);
keyLight.target.position.set(0.10, 0.85, -0.20);
keyLight.castShadow = true;
scene.add(keyLight);
scene.add(keyLight.target);
const rimLight = new THREE.DirectionalLight('#60A5FA', 1.15);
rimLight.position.set(-3.2, 3.0, -2.8);
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

const timestamps = Array.from({ length: 30 }, (_, i) => +((i + 0.5) * (duration / 30)).toFixed(2));
const errors = [];
const warnings = [];
const tmpVec = new THREE.Vector3();

let peakMetrics = { draws: 0, totalTris: 0, uniqueMaterials: 0, registryMaterials: 0, lights: 0 };

for (const t of timestamps) {
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

  const nanNode = findNaNNode(scene);
  if (nanNode) {
    errors.push(`t=${t.toFixed(2)}s NaN detected at ${nanNode}`);
  }

  const m = countSceneMetrics(scene);
  const regCount = registry.count();
  peakMetrics.draws = Math.max(peakMetrics.draws, m.draws);
  peakMetrics.totalTris = Math.max(peakMetrics.totalTris, m.totalTris);
  peakMetrics.uniqueMaterials = Math.max(peakMetrics.uniqueMaterials, m.uniqueMaterials);
  peakMetrics.registryMaterials = Math.max(peakMetrics.registryMaterials, regCount);
  peakMetrics.lights = Math.max(peakMetrics.lights, m.lights);

  const labAnchors = lab.getAnchors ? lab.getAnchors() : {};
  const allAnchors = { ...labAnchors, ...castAnchors };

  // Foot grounding assertion when Chewinstein is standing on the floor (t < 21.2 || t > 22.6)
  if (t < 21.2 || t > 22.6) {
    let minFootY = null;
    if (cast.chewinstein?.legL?.shoe && cast.chewinstein?.legR?.shoe) {
      const bL = new THREE.Box3().setFromObject(cast.chewinstein.legL.shoe);
      const bR = new THREE.Box3().setFromObject(cast.chewinstein.legR.shoe);
      minFootY = Math.min(bL.min.y, bR.min.y);
    } else if (allAnchors.chewinsteinFeet) {
      const res = resolveAnchorVec(allAnchors.chewinsteinFeet, tmpVec);
      if (res) minFootY = res.vec.y;
    }
    if (minFootY === null) {
      errors.push(`t=${t.toFixed(2)}s could not inspect Chewinstein foot grounding`);
    } else if (Math.abs(minFootY - 0.0) > 0.025) {
      errors.push(`t=${t.toFixed(2)}s Chewinstein foot grounding error |minY|=${Math.abs(minFootY).toFixed(4)}m > 0.025m (minY=${minFootY.toFixed(4)})`);
    }
  }

  // Required anchor NDC safe viewport checks
  const requiredKeys = ['chewinsteinHead', 'chewinsteinFeet', 'chalkboard', 'deskTop'];
  if (t >= 9.8 && t <= 15.0) {
    requiredKeys.push('atomCenter');
  }

  for (const key of requiredKeys) {
    const raw = allAnchors[key];
    const resolved = resolveAnchorVec(raw, tmpVec);
    if (!resolved) {
      errors.push(`t=${t.toFixed(2)}s missing required anchor "${key}"`);
      continue;
    }
    const ndc = resolved.vec.clone().project(camera);
    if (ndc.z < -1 || ndc.z > 1) {
      errors.push(`t=${t.toFixed(2)}s "${key}" outside clip plane (ndcZ=${ndc.z.toFixed(3)})`);
      continue;
    }
    if (Math.abs(ndc.x) > 0.90) {
      errors.push(`t=${t.toFixed(2)}s "${key}" clipped horizontal safe bound (ndcX=${ndc.x.toFixed(3)}, limit=0.90)`);
    } else if (Math.abs(ndc.x) > 0.86) {
      warnings.push(`t=${t.toFixed(2)}s "${key}" near horizontal bound (ndcX=${ndc.x.toFixed(3)})`);
    }
    if (ndc.y < -0.60 || ndc.y > 0.88) {
      errors.push(`t=${t.toFixed(2)}s "${key}" outside vertical safe bound (ndcY=${ndc.y.toFixed(3)}, allowed=[-0.60..0.88])`);
    } else if (ndc.y < -0.52 || ndc.y > 0.84) {
      warnings.push(`t=${t.toFixed(2)}s "${key}" near vertical bound (ndcY=${ndc.y.toFixed(3)})`);
    }
  }
}

if (peakMetrics.draws > BUDGETS.maxDraws) {
  errors.push(`Draw budget exceeded: peak visible draws=${peakMetrics.draws} > ${BUDGETS.maxDraws}`);
}
if (peakMetrics.totalTris > BUDGETS.maxTris) {
  errors.push(`Triangle budget exceeded: peak tris=${peakMetrics.totalTris} > ${BUDGETS.maxTris}`);
}
if (peakMetrics.uniqueMaterials > BUDGETS.maxMaterials) {
  errors.push(`Material budget exceeded: visible uniqueMaterials=${peakMetrics.uniqueMaterials} > ${BUDGETS.maxMaterials}`);
}
if (peakMetrics.lights > BUDGETS.maxLights) {
  errors.push(`Light budget exceeded: ${peakMetrics.lights} > ${BUDGETS.maxLights}`);
}

console.log('[VerifyScene] Peak Metrics:', JSON.stringify(peakMetrics));
if (warnings.length > 0) {
  console.log(`[VerifyScene] Warnings (${warnings.length}):`);
  for (const w of warnings) console.log('  WARN:', w);
}
if (errors.length > 0) {
  console.error(`[VerifyScene] FAILED (${errors.length} errors):`);
  for (const e of errors) console.error('  ERR:', e);
  process.exit(1);
}
console.log('[VerifyScene] ALL 30 TIMESTAMPS PASSED BUDGET, GROUNDING, & SAFE-FRAME GATES!');
