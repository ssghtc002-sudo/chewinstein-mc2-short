/**
 * Professor Chewinstein & Sassy Cosmic Atom Orb Cast Rig + 6-Beat Choreography
 * (/home/antigravity/chewinstein-mc2-short/src/scene/characters.js)
 *
 * Built atop ../engine/baseRig.js with consolidated vertex-colored sub-parts so
 * BOTH Chewinstein and the Sassy Talking Atom Orb stay <= 22 draw calls and <= 18k tris.
 * Pure Node-safe (no crash if document is undefined).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  MaterialRegistry,
  buildPixarHumanoid,
  createGlowSprite,
  createIrisTexture,
  safeMerge,
} from '../engine/baseRig.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function lerp(a, b, t) {
  return a + (b - a) * clamp01(t);
}
function smoothstep(e0, e1, x) {
  const u = clamp01((x - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
}

/**
 * Normalizes and merges geometries with per-part sRGB->linear vertex colors
 * so multi-colored rigid joint assemblies render in 1 single draw call.
 */
function mergeWithVertexColors(entries) {
  const prep = entries.map(({ geo, color }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    const count = g.attributes.position.count;
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    const c = new THREE.Color(color);
    const colArr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colArr[i * 3] = c.r;
      colArr[i * 3 + 1] = c.g;
      colArr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    // Strip any mismatched extra attributes before mergeGeometries
    for (const key of Object.keys(g.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv' && key !== 'color') {
        g.deleteAttribute(key);
      }
    }
    return g;
  });
  const merged = mergeGeometries(prep, false);
  for (const g of prep) g.dispose();
  return merged;
}

/**
 * Extracts world/local geometry baked into parent space for clean merging.
 */
function cloneTransformed(mesh) {
  mesh.updateMatrix();
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrix);
  return g;
}

function buildEinsteinHairGeometry() {
  const tufts = [];
  const addPuff = (x, y, z, r, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
    const g = new THREE.SphereGeometry(r, 10, 8);
    g.scale(sx, sy, sz);
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    tufts.push(g);
  };
  const addSpike = (x, y, z, r, h, rx = 0, ry = 0, rz = 0) => {
    const g = new THREE.ConeGeometry(r, h, 7);
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    tufts.push(g);
  };

  // Crown cloud base (strictly above forehead / brows y > +0.02 in headgearGroup space)
  addPuff(0.0, 0.055, -0.02, 0.135, 1.32, 0.72, 1.18);
  addPuff(-0.11, 0.045, 0.02, 0.095, 1.15, 0.86, 1.02, 0, 0, 0.35);
  addPuff(0.11, 0.045, 0.02, 0.095, 1.15, 0.86, 1.02, 0, 0, -0.35);
  addPuff(0.0, 0.075, 0.06, 0.088, 1.28, 0.72, 0.92, -0.18, 0, 0);

  // Back-of-head thick fluffy mane
  addPuff(0.0, -0.04, -0.135, 0.125, 1.45, 1.10, 0.78);
  addPuff(-0.125, -0.075, -0.115, 0.092, 1.1, 1.15, 0.85);
  addPuff(0.125, -0.075, -0.115, 0.092, 1.1, 1.15, 0.85);
  addPuff(0.0, -0.14, -0.155, 0.105, 1.42, 0.85, 0.72);

  // Iconic Einstein wild side wings flaring out behind/above ears (x = ±0.19..0.25)
  for (const s of [-1, 1]) {
    addPuff(s * 0.185, -0.035, -0.015, 0.082, 1.18, 0.92, 0.96, 0, 0, s * -0.45);
    addPuff(s * 0.215, -0.095, -0.045, 0.075, 1.24, 0.86, 0.88, 0, 0, s * -0.25);
    addPuff(s * 0.185, -0.155, -0.065, 0.068, 1.15, 0.82, 0.85, 0, 0, s * 0.15);
    // Wild spiky tufts around temples & crown
    addSpike(s * 0.24, 0.02, -0.02, 0.046, 0.125, 0, 0, s * -1.18);
    addSpike(s * 0.23, -0.07, -0.04, 0.044, 0.12, 0.1, 0, s * -1.42);
    addSpike(s * 0.16, 0.11, -0.01, 0.045, 0.115, -0.1, 0, s * -0.62);
  }

  // Asymmetrical wild forehead cowlick spikes
  addSpike(-0.055, 0.118, 0.055, 0.044, 0.115, 0.35, 0, 0.32);
  addSpike(0.042, 0.126, 0.035, 0.048, 0.125, 0.22, 0, -0.24);
  addSpike(0.0, 0.112, -0.08, 0.052, 0.12, -0.45, 0, 0.08);

  return safeMerge(tufts);
}

function buildEinsteinMustacheParts() {
  const parts = [];
  // Center lush puff tucked cleanly under nose (y = 0.159, z = 0.174, strictly above teeth y = 0.141)
  const mid = new THREE.SphereGeometry(0.020, 10, 8);
  mid.scale(1.42, 0.72, 0.85);
  mid.translate(0, 0.159, 0.172);
  parts.push(mid);

  // Sweeping bushy wings framing mouth without touching cavity
  for (const s of [-1, 1]) {
    const inner = new THREE.CapsuleGeometry(0.0155, 0.030, 5, 8);
    inner.rotateZ(s * 1.24);
    inner.rotateY(s * 0.28);
    inner.translate(s * 0.026, 0.156, 0.166);
    parts.push(inner);

    const outer = new THREE.SphereGeometry(0.0185, 10, 8);
    outer.scale(1.28, 0.82, 0.78);
    outer.rotateZ(s * -0.28);
    outer.rotateY(s * 0.32);
    outer.translate(s * 0.048, 0.148, 0.154);
    parts.push(outer);
  }
  return parts;
}

function buildLabMugGeometry() {
  const cupOuter = new THREE.CylinderGeometry(0.054, 0.047, 0.118, 16);
  const blueStripe = new THREE.CylinderGeometry(0.0548, 0.0543, 0.015, 16, 1, true);
  blueStripe.translate(0, 0.036, 0);
  const goldStripe = new THREE.CylinderGeometry(0.0540, 0.0536, 0.006, 16, 1, true);
  goldStripe.translate(0, 0.024, 0);

  const rim = new THREE.TorusGeometry(0.051, 0.0065, 6, 16);
  rim.rotateX(Math.PI * 0.5);
  rim.translate(0, 0.058, 0);

  // Prominent outer C-handle pointing -X (screen left) so mug silhouette is unmistakable!
  const handle = new THREE.TorusGeometry(0.034, 0.0095, 6, 14, Math.PI * 1.15);
  handle.rotateZ(Math.PI * 0.5);
  handle.translate(-0.050, 0.002, 0);

  const coffee = new THREE.CylinderGeometry(0.045, 0.045, 0.010, 14);
  coffee.translate(0, 0.054, 0);

  const steam1 = new THREE.SphereGeometry(0.016, 8, 6);
  steam1.scale(1.0, 1.45, 0.9);
  steam1.translate(-0.012, 0.098, 0.004);

  const steam2 = new THREE.SphereGeometry(0.013, 8, 6);
  steam2.scale(0.95, 1.55, 0.9);
  steam2.translate(0.016, 0.128, -0.004);

  return mergeWithVertexColors([
    { geo: cupOuter, color: '#F6F2EA' },
    { geo: blueStripe, color: '#2563EB' },
    { geo: goldStripe, color: '#F59E0B' },
    { geo: rim, color: '#F6F2EA' },
    { geo: handle, color: '#F6F2EA' },
    { geo: coffee, color: '#381C11' },
    { geo: steam1, color: '#FFFFFF' },
    { geo: steam2, color: '#E0F2FE' },
  ]);
}

function buildSassyAtomOrb(registry, timeline) {
  const atomRoot = new THREE.Group();
  atomRoot.name = 'sassy_atom_orb';

  const anchorArr = timeline?.worldContract?.atomOrbPos || [0.46, 1.56, 0.34];
  const restPos = new THREE.Vector3(anchorArr[0], anchorArr[1], anchorArr[2]);
  atomRoot.position.copy(restPos);

  const bodyGroup = new THREE.Group();
  atomRoot.add(bodyGroup);

  // 1. Clustered glowing cyan nucleus core (front face kept smooth for eyes & mouth!)
  const coreMain = new THREE.SphereGeometry(0.132, 18, 14);
  const bumpTopL = new THREE.SphereGeometry(0.068, 10, 8);
  bumpTopL.translate(-0.085, 0.095, -0.035);
  const bumpTopR = new THREE.SphereGeometry(0.064, 10, 8);
  bumpTopR.translate(0.088, 0.088, -0.04);
  const bumpBot = new THREE.SphereGeometry(0.070, 10, 8);
  bumpBot.translate(0.0, -0.105, -0.045);

  const coreMat = registry.getStandard('atom_core', {
    color: '#FFFFFF',
    vertexColors: true,
    emissive: '#0EA5E9',
    emissiveIntensity: 0.72,
    roughness: 0.22,
    metalness: 0.10,
  });
  const coreMesh = new THREE.Mesh(
    mergeWithVertexColors([
      { geo: coreMain, color: '#38BDF8' },
      { geo: bumpTopL, color: '#0284C7' },
      { geo: bumpTopR, color: '#60D5FF' },
      { geo: bumpBot, color: '#0EA5E9' },
    ]),
    coreMat
  );
  bodyGroup.add(coreMesh);

  // 2. Two tilted crossing electron orbital rings + orbiting electron beads (1 merged mesh!)
  const ringEntries = [];
  const ringConfigs = [
    { rx: 0.56, ry: 0.42, rz: 0.28, eAngle: 0.4 },
    { rx: -0.52, ry: -0.46, rz: -0.68, eAngle: 2.5 },
  ];
  for (const cfg of ringConfigs) {
    const euler = new THREE.Euler(cfg.rx, cfg.ry, cfg.rz);
    const mat4 = new THREE.Matrix4().makeRotationFromEuler(euler);

    const torus = new THREE.TorusGeometry(0.245, 0.011, 8, 28);
    torus.applyMatrix4(mat4);
    ringEntries.push({ geo: torus, color: '#BAE6FD' });

    const elec = new THREE.SphereGeometry(0.025, 10, 8);
    elec.translate(Math.cos(cfg.eAngle) * 0.245, Math.sin(cfg.eAngle) * 0.245, 0);
    elec.applyMatrix4(mat4);
    ringEntries.push({ geo: elec, color: '#FDE047' });
  }

  const ringMat = registry.getStandard('atom_rings', {
    color: '#FFFFFF',
    vertexColors: true,
    emissive: '#38BDF8',
    emissiveIntensity: 0.62,
    roughness: 0.22,
    metalness: 0.25,
  });
  const ringsMesh = new THREE.Mesh(mergeWithVertexColors(ringEntries), ringMat);
  bodyGroup.add(ringsMesh);

  // 3. Expressive cartoon eyeballs + integrated sassy raised eyebrow bar (UV-mapped onto dark pupil center!)
  const atomIrisTex = createIrisTexture('#0284C7');
  const atomEyeMat = registry.getStandard('eyeball_#0284C7', {
    map: atomIrisTex || null,
    color: atomIrisTex ? '#FFFFFF' : '#F4F4F4',
    roughness: 0.14,
    metalness: 0.04,
  });

  const eyeParts = [];
  for (const side of [-1, 1]) {
    const eGeo = new THREE.SphereGeometry(0.042, 14, 10);
    const pos = eGeo.attributes.position;
    const uv = eGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (z > 0) {
        uv.setXY(
          i,
          Math.max(0.02, Math.min(0.98, 0.5 + x / 0.072)),
          Math.max(0.02, Math.min(0.98, 0.5 + y / 0.072))
        );
      } else {
        uv.setXY(i, 0.02, 0.02);
      }
    }
    eGeo.scale(0.95, 1.08, 0.68);
    eGeo.translate(side * 0.052, 0.036, 0.118);
    eyeParts.push(eGeo);

    // Sassy asymmetric eyebrow bar (right brow cocked higher for roast attitude!)
    const bGeo = new THREE.CapsuleGeometry(0.009, 0.040, 4, 8);
    const bUv = bGeo.attributes.uv;
    for (let i = 0; i < bUv.count; i++) {
      bUv.setXY(i, 0.5, 0.5); // jet-black center of irisTex!
    }
    bGeo.rotateZ(Math.PI * 0.5 + (side === 1 ? 0.24 : -0.10));
    bGeo.translate(side * 0.052, side === 1 ? 0.094 : 0.080, 0.128);
    eyeParts.push(bGeo);
  }
  const eyesMesh = new THREE.Mesh(safeMerge(eyeParts), atomEyeMat);
  bodyGroup.add(eyesMesh);

  // 4. Lip-synced sassy cartoon mouth (1 vertex-colored mesh scaled smoothly via lipSync.atom!)
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.046, 0.122);
  bodyGroup.add(mouthGroup);

  const atomCav = new THREE.SphereGeometry(0.038, 12, 8);
  atomCav.scale(1.22, 0.72, 0.52);

  const atomTeeth = new THREE.CylinderGeometry(0.034, 0.034, 0.015, 10, 1, false, -0.75, 1.5);
  atomTeeth.translate(0, 0.014, 0.008);

  const atomLip = new THREE.CapsuleGeometry(0.009, 0.048, 4, 8);
  atomLip.rotateZ(Math.PI * 0.5);
  atomLip.translate(0, -0.018, 0.016);

  const atomMouthMat = registry.getStandard('atom_mouth', {
    color: '#FFFFFF',
    vertexColors: true,
    roughness: 0.34,
    metalness: 0.02,
  });
  const mouthMesh = new THREE.Mesh(
    mergeWithVertexColors([
      { geo: atomCav, color: '#220915' },
      { geo: atomTeeth, color: '#FFFFFF' },
      { geo: atomLip, color: '#F43F5E' },
    ]),
    atomMouthMat
  );
  mouthGroup.add(mouthMesh);

  // 5. Additive cosmic aura sprite (Node-safe)
  let glowSprite = null;
  if (typeof document !== 'undefined') {
    glowSprite = createGlowSprite('#38BDF8', 0.88, 0.58);
    glowSprite.position.set(0, 0, -0.04);
    atomRoot.add(glowSprite);
  }

  function setLipSync(open01 = 0, smile = 0.65) {
    const o = clamp01(open01);
    mouthMesh.scale.set(1.0 + smile * 0.18, 0.24 + o * 0.96, 0.95);
    mouthMesh.rotation.z = o > 0.08 ? Math.sin(o * 4.0) * 0.04 : 0.06; // subtle sassy smirk tilt!
  }

  setLipSync(0, 0.65);

  return {
    root: atomRoot,
    bodyGroup,
    coreMesh,
    ringsMesh,
    eyesMesh,
    mouthGroup,
    mouthMesh,
    glowSprite,
    restPos,
    setLipSync,
  };
}

export function buildChewinsteinCast(scene, registry = new MaterialRegistry(), timeline = {}) {
  const matReg = registry || new MaterialRegistry();
  const tl = timeline || {};

  // 1. Build Professor Chewinstein via shared baseRig
  const chewinstein = buildPixarHumanoid(
    {
      id: 'chewinstein',
      skinColor: '#E5B490',
      suitColor: '#EEF3FA',
      accentColor: '#254B7C',
      trouserColor: '#1E2430',
      shoeColor: '#362218',
      hairColor: '#F7F9FC',
      irisColor: '#2E73B8',
      hasMustache: false, // custom fuller fluffy Einstein mustache merged cleanly onto headGroup
      hasGoatee: false,
      headgear: 'none', // custom wild Einstein hair mounted onto headgearGroup for hatPop!
      hasMonocle: true,
      castShadow: true,
    },
    matReg
  );

  // Shared vertex-colored matte PBR material to consolidate rigid multi-color joint parts
  const multiMat = matReg.getStandard('chew_multi_matte', {
    color: '#FFFFFF',
    vertexColors: true,
    roughness: 0.54,
    metalness: 0.04,
  });

  // Consolidate chest coat (#EEF3FA) + navy waistcoat/tie/collar (#254B7C) into 1 mesh
  if (chewinstein.chestGroup.children.length >= 2) {
    const coatMesh = chewinstein.chestGroup.children[0];
    const accentMesh = chewinstein.chestGroup.children[1];
    const mergedChestGeo = mergeWithVertexColors([
      { geo: cloneTransformed(coatMesh), color: '#EEF3FA' },
      { geo: cloneTransformed(accentMesh), color: '#254B7C' },
    ]);
    chewinstein.chestGroup.remove(coatMesh);
    chewinstein.chestGroup.remove(accentMesh);
    coatMesh.geometry.dispose();
    accentMesh.geometry.dispose();
    const chestMesh = new THREE.Mesh(mergedChestGeo, multiMat);
    chestMesh.castShadow = true;
    chewinstein.chestGroup.add(chestMesh);
  }

  // Consolidate head skin (#E5B490) + fluffy white Einstein mustache (#F7F9FC) into 1 mesh
  {
    const headSkinMesh = chewinstein.headGroup.children[0];
    const mustacheParts = buildEinsteinMustacheParts();
    const headEntries = [{ geo: cloneTransformed(headSkinMesh), color: '#E5B490' }];
    for (const mp of mustacheParts) {
      headEntries.push({ geo: mp, color: '#F7F9FC' });
    }
    const mergedHeadGeo = mergeWithVertexColors(headEntries);
    for (const mp of mustacheParts) mp.dispose();
    chewinstein.headGroup.remove(headSkinMesh);
    headSkinMesh.geometry.dispose();
    const newHeadMesh = new THREE.Mesh(mergedHeadGeo, multiMat);
    newHeadMesh.castShadow = true;
    chewinstein.headGroup.add(newHeadMesh);
  }

  // Consolidate mouth cavity + teeth into 1 mesh (preserving lowerLip independently)
  let mouthCavityTeeth = null;
  let mouthLowerLip = null;
  {
    const mouthGroup = chewinstein.headGroup.children.find(
      (c) => c.isGroup && Math.abs(c.position.y - 0.125) < 0.01
    );
    if (mouthGroup && mouthGroup.children.length >= 3) {
      const [cavMesh, teethMesh, lipMesh] = mouthGroup.children;
      const mergedMouthGeo = mergeWithVertexColors([
        { geo: cloneTransformed(cavMesh), color: '#2A0B0F' },
        { geo: cloneTransformed(teethMesh), color: '#F6F2E8' },
      ]);
      mouthGroup.remove(cavMesh);
      mouthGroup.remove(teethMesh);
      cavMesh.geometry.dispose();
      teethMesh.geometry.dispose();
      mouthCavityTeeth = new THREE.Mesh(mergedMouthGeo, multiMat);
      mouthGroup.add(mouthCavityTeeth);
      mouthLowerLip = lipMesh;
    }
  }

  // Consolidate armL & armR forearm + hand into 1 mesh each
  for (const arm of [chewinstein.armL, chewinstein.armR]) {
    const forearmMesh = arm.elbow.children[0];
    const handMesh = arm.hand;
    if (forearmMesh && handMesh) {
      const mergedFH = mergeWithVertexColors([
        { geo: cloneTransformed(forearmMesh), color: '#EEF3FA' },
        { geo: cloneTransformed(handMesh), color: '#E5B490' },
      ]);
      arm.elbow.remove(forearmMesh);
      arm.elbow.remove(handMesh);
      forearmMesh.geometry.dispose();
      handMesh.geometry.dispose();
      const fhMesh = new THREE.Mesh(mergedFH, multiMat);
      arm.elbow.add(fhMesh);
      arm.hand = fhMesh;
    }
  }

  // Consolidate legL & legR shin + shoe into 1 mesh each (and preserve exact groundFeet!)
  const legShoeMeshes = [];
  for (const leg of [chewinstein.legL, chewinstein.legR]) {
    const knee = leg.hip.children.find((c) => c.isGroup);
    if (knee && knee.children.length >= 2) {
      const shinMesh = knee.children[0];
      const ankle = knee.children[1];
      const shoeMesh = leg.shoe;
      ankle.updateMatrix();
      shoeMesh.updateMatrix();
      const shoeMat4 = new THREE.Matrix4().multiplyMatrices(ankle.matrix, shoeMesh.matrix);
      const shoeGeoInKnee = shoeMesh.geometry.clone();
      shoeGeoInKnee.applyMatrix4(shoeMat4);

      const mergedSS = mergeWithVertexColors([
        { geo: cloneTransformed(shinMesh), color: '#1E2430' },
        { geo: shoeGeoInKnee, color: '#362218' },
      ]);
      shoeGeoInKnee.dispose();
      knee.remove(shinMesh);
      knee.remove(ankle);
      shinMesh.geometry.dispose();
      shoeMesh.geometry.dispose();

      const ssMesh = new THREE.Mesh(mergedSS, multiMat);
      ssMesh.castShadow = true;
      knee.add(ssMesh);
      leg.shin = ssMesh;
      leg.shoe = ssMesh;
      legShoeMeshes.push(ssMesh);
    }
  }

  // Upgrade monocle ring to gleaming warm physics gold (#E6B442)
  if (chewinstein.monocleGroup && chewinstein.monocleGroup.children[0]) {
    chewinstein.monocleGroup.children[0].material = matReg.getStandard('chew_monocle_gold', {
      color: '#E6B442',
      roughness: 0.25,
      metalness: 0.72,
    });
  }

  // Mount wild fluffy white Einstein hair onto headgearGroup (so setHatPop pops hair!)
  const whiteHairMat = matReg.getStandard('hair_#F7F9FC', {
    color: '#F7F9FC',
    roughness: 0.65,
    metalness: 0.04,
  });
  const einsteinHairMesh = new THREE.Mesh(buildEinsteinHairGeometry(), whiteHairMat);
  einsteinHairMesh.castShadow = true;
  chewinstein.headgearGroup.add(einsteinHairMesh);
  chewinstein.headgearGroup.visible = true;

  // Override setHatPop so custom hair on headgearGroup pops reliably even with headgear: 'none'
  const origHatPop = chewinstein.setHatPop;
  chewinstein.setHatPop = (pop01 = 0) => {
    chewinstein.headgearGroup.visible = true;
    const p = clamp01(pop01);
    chewinstein.headgearGroup.position.y = 0.345 + p * 0.24;
    chewinstein.headgearGroup.rotation.z = p * 0.20;
    chewinstein.headgearGroup.rotation.y = p * 1.15;
  };
  void origHatPop;

  // Override setLipSync to drive consolidated mouthCavityTeeth cleanly
  chewinstein.setLipSync = (open01 = 0, smile = 0.25) => {
    const o = clamp01(open01);
    if (mouthCavityTeeth) {
      mouthCavityTeeth.visible = o > 0.04 || smile > 0.48;
      mouthCavityTeeth.scale.set(1.0 + smile * 0.14, 0.35 + o * 1.15, 1.0);
    }
    if (mouthLowerLip) {
      mouthLowerLip.position.y = -0.012 - o * 0.030;
      mouthLowerLip.scale.x = 1.0 + Math.max(0, smile) * 0.12;
    }
  };

  // Scale & position Chewinstein per worldContract
  chewinstein.root.scale.setScalar(0.96);
  const posArr = tl.worldContract?.chewinsteinPos || [-0.36, 0.0, 0.08];
  const basePos = new THREE.Vector3(posArr[0], posArr[1], posArr[2]);
  chewinstein.root.position.copy(basePos);

  // Override groundFeet to measure consolidated shinShoe meshes accurately with root.scale
  let groundedRigY = 0;
  chewinstein.groundFeet = (surfaceY = 0) => {
    chewinstein.rig.position.y = 0;
    chewinstein.root.updateMatrixWorld(true);
    let minWorldY = Infinity;
    for (const m of legShoeMeshes) {
      const box = new THREE.Box3().setFromObject(m);
      if (box.min.y < minWorldY) minWorldY = box.min.y;
    }
    if (!Number.isFinite(minWorldY)) return 0;
    const scaleY = chewinstein.root.scale.y || 1;
    const delta = (surfaceY - minWorldY) / scaleY;
    chewinstein.rig.position.y = delta;
    groundedRigY = delta;
    chewinstein.root.updateMatrixWorld(true);
    chewinstein.contactShadow.position.y = 0.004;
    return delta;
  };
  chewinstein.groundFeet(tl.worldContract?.floorY ?? 0.0);

  // Override resetPose so groundedRigY & headgearGroup.visible are preserved
  const origReset = chewinstein.resetPose;
  chewinstein.resetPose = () => {
    origReset();
    chewinstein.rig.position.set(0, groundedRigY, 0);
    chewinstein.headgearGroup.visible = true;
    chewinstein.setHatPop(0);
    chewinstein.sunglassesGroup.position.set(0, 0.242, 0.186);
  };

  // 2. Right-hand Chunky Chalk Stick (white in Beat 1, glowing golden-yellow in Beats 5-6)
  const chalkMat = matReg.getStandard('chew_chalk', {
    color: '#F4F7FC',
    emissive: '#000000',
    emissiveIntensity: 0.0,
    roughness: 0.48,
    metalness: 0.05,
  });
  const chalkGeo = new THREE.CylinderGeometry(0.014, 0.017, 0.155, 10);
  chalkGeo.rotateX(Math.PI * 0.44);
  chalkGeo.translate(0, -0.010, 0.048);
  const chalkMesh = new THREE.Mesh(chalkGeo, chalkMat);
  chewinstein.armR.propMount.add(chalkMesh);

  // 3. Left-hand Steaming Lab Coffee Mug (hidden Beats 1-5, visible Beat 6 toast t >= 25.8s!)
  const mugMesh = new THREE.Mesh(buildLabMugGeometry(), multiMat);
  mugMesh.position.set(0.0, -0.028, 0.054);
  mugMesh.rotation.set(0.62, 0.16, 0.08);
  mugMesh.scale.setScalar(1.16);
  mugMesh.visible = false;
  chewinstein.armL.propMount.add(mugMesh);

  // 4. Build Sassy Talking Cosmic Atom Orb
  const atom = buildSassyAtomOrb(matReg, tl);
  atom.root.visible = false;

  if (scene) {
    scene.add(chewinstein.root);
    scene.add(atom.root);
  }

  function getLipValue(manifest, spk, frameIdx) {
    const arr = manifest?.lipSync?.[spk];
    if (!arr || arr.length === 0) return 0;
    const val = arr[clamp(frameIdx, 0, arr.length - 1)];
    if (typeof val === 'number') return val;
    if (val && typeof val === 'object') return Number(val.open ?? val.open01 ?? 0);
    return 0;
  }

  // Tracking state for getState() & getAnchors()
  const state = {
    t: 0,
    beatId: 'beat_1_chalkboard_oops',
    grounded: true,
    leaping: false,
    shadesOn: false,
    monocleDropped: false,
    hairPopped: false,
    goldChalk: false,
    mugInHand: false,
    atomVisible: false,
    shivering: false,
    chewinsteinMinY: 0,
    drawCount: 0,
    triCount: 0,
  };

  function countStats() {
    let draws = 0;
    let tris = 0;
    for (const rootObj of [chewinstein.root, atom.root]) {
      rootObj.traverse((obj) => {
        if (!obj.visible) return;
        // Skip descendants if an ancestor is hidden
        let p = obj.parent;
        while (p) {
          if (!p.visible) return;
          p = p.parent;
        }
        if (obj.isMesh) {
          draws += 1;
          const geo = obj.geometry;
          if (geo) {
            tris += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
          }
        } else if (obj.isSprite) {
          draws += 1;
          tris += 2;
        }
      });
    }
    return { draws, tris: Math.round(tris) };
  }

  const fps = tl.fps || 30;
  const floorY = tl.worldContract?.floorY ?? 0.0;

  function update(t = 0, manifest = null) {
    const frameIdx = Math.round(t * fps);
    const lipChew = getLipValue(manifest, 'chewinstein', frameIdx);
    const lipAtom = getLipValue(manifest, 'atom', frameIdx);

    chewinstein.resetPose();
    chewinstein.root.visible = true;
    chewinstein.root.position.copy(basePos);
    chewinstein.root.rotation.set(0, 0.28, 0);
    chewinstein.contactShadow.position.y = 0.004;
    chewinstein.contactShadow.scale.setScalar(1.0);

    chalkMesh.visible = false;
    chalkMat.color.set('#F4F7FC');
    chalkMat.emissive.set('#000000');
    chalkMat.emissiveIntensity = 0.0;

    mugMesh.visible = false;
    atom.root.visible = false;

    let hairPop = 0;
    let smile = 0.22;
    let openChew = lipChew;
    let isLeaping = false;
    let isShivering = false;
    let monocleDropped = false;
    let shadesOn = false;
    let goldChalk = false;
    let beatId = 'beat_1_chalkboard_oops';

    const breathe = Math.sin(t * 2.5) * 0.018;

    if (t < 4.5) {
      // ================================================================
      // BEAT 1 (0.0 .. 4.5s): Proud Chalk Pose -> Sneeze Whip -> Monocle Drop
      // ================================================================
      beatId = 'beat_1_chalkboard_oops';
      chalkMesh.visible = true;
      chewinstein.root.rotation.y = 0.28;

      if (t < 0.95) {
        // Proud lecture pose
        smile = 0.62;
        chewinstein.chestGroup.rotation.x = breathe;
        chewinstein.armL.shoulder.rotation.set(0.14, 0, -0.34);
        chewinstein.armL.elbow.rotation.set(-1.12, 0.45, 0);
        chewinstein.armR.shoulder.rotation.set(-1.05 + Math.sin(t * 4.2) * 0.06, -0.15, 0.28);
        chewinstein.armR.elbow.rotation.set(-0.55, 0, 0);
        chewinstein.headGroup.rotation.y = 0.14;
      } else if (t < 1.35) {
        // Sneeze windup ("Aaaah... chhh—")
        const u = smoothstep(0.95, 1.35, t);
        const twitch = t > 1.15 ? Math.sin(t * 58.0) * 0.045 : 0;
        smile = -0.15;
        chewinstein.chestGroup.rotation.x = -0.20 * u;
        chewinstein.headGroup.rotation.x = -0.54 * u + twitch;
        chewinstein.eyeL.brow.position.y += 0.024 * u;
        chewinstein.armL.shoulder.rotation.set(-0.55 * u, 0, -0.45 * u);
        chewinstein.armL.elbow.rotation.set(-0.85 * u, 0, 0);
        chewinstein.armR.shoulder.rotation.set(-0.95 - 0.35 * u, -0.22, 0.42 * u);
        chewinstein.armR.elbow.rotation.set(-0.65, 0, 0);
      } else if (t < 2.00) {
        // Violent Sneeze Whip at 1.35s + chalk screech smear toward board!
        const dt = t - 1.35;
        const whip = smoothstep(0.0, 0.12, dt) * (1.0 - smoothstep(0.32, 0.65, dt));
        smile = -0.25;
        openChew = Math.max(lipChew, whip * 0.65);
        chewinstein.chestGroup.rotation.x = 0.36 * whip;
        chewinstein.headGroup.rotation.x = 0.46 * whip;
        chewinstein.headGroup.rotation.y = 0.25 * whip;
        chewinstein.armR.shoulder.rotation.set(-1.35, 0.45 * whip, 0.54);
        chewinstein.armR.elbow.rotation.set(-0.32, 0, 0);
        chewinstein.armL.shoulder.rotation.set(-0.55 * whip, 0, -0.55);
        chewinstein.armL.elbow.rotation.set(-0.85, 0, 0);
        hairPop = whip * 0.32;
      } else {
        // Shocked recoil + vine_boom Monocle Drop at 2.15s + sheepish line_02
        const boomU = smoothstep(2.12, 2.52, t);
        monocleDropped = t >= 2.12;
        chewinstein.setMonocleDrop(boomU);
        const popPulse = t >= 2.15 ? Math.sin(clamp01((t - 2.15) / 0.85) * Math.PI) : 0;
        hairPop = popPulse * 0.85;

        const shock = smoothstep(2.05, 2.25, t) * (1.0 - smoothstep(3.2, 4.4, t) * 0.55);
        chewinstein.chestGroup.rotation.x = -0.10 * shock + breathe;
        chewinstein.headGroup.rotation.x = -0.14 * shock;
        chewinstein.eyeL.brow.position.y += 0.028 * shock;
        chewinstein.armL.shoulder.rotation.set(-0.92, 0.18, -0.44);
        chewinstein.armL.elbow.rotation.set(-1.05, 0, 0);
        chewinstein.armR.shoulder.rotation.set(-0.98, -0.18, 0.46 + Math.sin(t * 5.0) * 0.08);
        chewinstein.armR.elbow.rotation.set(-0.95, 0, 0);
        smile = t >= 2.55 ? 0.12 : -0.22;
      }
    } else if (t < 9.8) {
      // ================================================================
      // BEAT 2 (4.5 .. 9.8s): Slow-Mo Photon Squint + Nose Boing at 6.65s
      // ================================================================
      beatId = 'beat_2_speed_of_light_drop';
      chewinstein.root.rotation.y = 0.48;

      if (t < 6.65) {
        // Squinting curiously toward the slow-mo lamp
        smile = 0.08;
        chewinstein.chestGroup.rotation.x = 0.15 + breathe;
        chewinstein.headGroup.rotation.x = 0.10;
        chewinstein.headGroup.rotation.y = 0.14;
        chewinstein.eyeL.brow.position.y -= 0.011;
        chewinstein.armL.shoulder.rotation.set(0.16, 0, -0.28);
        chewinstein.armL.elbow.rotation.set(-0.95, 0.35, 0);
        chewinstein.armR.shoulder.rotation.set(-1.05, 0.22, 0.24);
        chewinstein.armR.elbow.rotation.set(-0.35, 0, 0);
      } else {
        // 6.65s squish_boing hits nose -> smooth cartoon head whip recoil + flailing point!
        const dt = t - 6.65;
        const hitEase = smoothstep(0.0, 0.08, dt);
        const recoil = hitEase * Math.exp(-Math.max(0, dt - 0.06) * 3.6);
        const boingOsc = Math.sin(dt * 20.0) * Math.exp(-dt * 4.5) * hitEase;
        smile = dt < 0.65 ? -0.20 : 0.18;
        openChew = Math.max(lipChew, dt < 0.38 ? 0.45 * recoil : 0);

        chewinstein.chestGroup.rotation.x = lerp(0.15, -0.18, recoil) + breathe;
        chewinstein.headGroup.rotation.x = lerp(0.10, -0.44, recoil) + boingOsc * 0.15;
        chewinstein.headGroup.rotation.y = 0.14;
        chewinstein.eyeL.brow.position.y += lerp(-0.011, 0.026, recoil);
        hairPop = recoil * 0.52;

        chewinstein.armL.shoulder.rotation.set(lerp(0.16, -0.82, recoil), 0, lerp(-0.28, -0.58, recoil));
        chewinstein.armL.elbow.rotation.set(-0.90, lerp(0.35, 0, recoil), 0);
        chewinstein.armR.shoulder.rotation.set(-1.12, 0.18, 0.38 + Math.sin(t * 6.5) * 0.10);
        chewinstein.armR.elbow.rotation.set(-0.42, 0, 0);
      }
    } else if (t < 15.0) {
      // ================================================================
      // BEAT 3 (9.8 .. 15.0s): Atomic Roast + Floating Panic (feet locked y = 0)
      // ================================================================
      beatId = 'beat_3_mass_float_chaos';
      chewinstein.root.rotation.y = 0.42;

      // Chewinstein has zero dialogue in Beat 3; keep mouth closed/tight shock so draw calls stay <= 21
      openChew = 0;
      smile = -0.18;
      const panic = smoothstep(9.85, 10.35, t);
      const wave = Math.sin(t * 7.2);
      chewinstein.chestGroup.rotation.z = Math.sin(t * 4.5) * 0.08 * panic;
      chewinstein.chestGroup.rotation.x = -0.08 * panic;
      chewinstein.headGroup.rotation.y = 0.22;
      chewinstein.headGroup.rotation.x = -0.16 * panic;
      chewinstein.eyeL.brow.position.y += 0.028 * panic;

      chewinstein.armL.shoulder.rotation.set(-1.25 + wave * 0.28, 0.15, -0.78 - Math.abs(wave) * 0.25);
      chewinstein.armL.elbow.rotation.set(-0.55, 0, 0);
      chewinstein.armR.shoulder.rotation.set(-1.25 - wave * 0.28, -0.15, 0.78 + Math.abs(wave) * 0.25);
      chewinstein.armR.elbow.rotation.set(-0.55, 0, 0);

      hairPop = 0.38 * panic + Math.abs(Math.sin(t * 6.2)) * 0.38 * panic;
    } else if (t < 20.2) {
      // ================================================================
      // BEAT 4 (15.0 .. 20.2s): Freezing Ice-Cold Sun + Rapid Shivering
      // ================================================================
      beatId = 'beat_4_sun_goes_dim';
      chewinstein.root.rotation.y = 0.28;

      const huddle = smoothstep(15.0, 15.65, t);
      const shiverAmp = smoothstep(16.2, 16.7, t) * (1.0 - smoothstep(19.95, 20.2, t));
      isShivering = t >= 16.2 && t <= 20.2;

      const vib1 = Math.sin(t * 44.0) * shiverAmp;
      const vib2 = Math.sin(t * 54.0) * shiverAmp;

      // Crossed arms hugging torso cleanly with front clearance
      chewinstein.chestGroup.rotation.x = 0.22 * huddle;
      chewinstein.chestGroup.rotation.z = vib1 * 0.042;
      chewinstein.headGroup.rotation.x = 0.12 * huddle + vib2 * 0.025;
      chewinstein.headGroup.rotation.y = 0.10 + vib2 * 0.058;
      chewinstein.headgearGroup.rotation.z = vib1 * 0.075;
      chewinstein.eyeL.brow.position.y += 0.012 * huddle;

      chewinstein.armL.shoulder.rotation.set(-0.88, 0.60, -0.18 + vib1 * 0.04);
      chewinstein.armL.elbow.rotation.set(-1.32, 0.58, 0);
      chewinstein.armR.shoulder.rotation.set(-0.84, -0.60, 0.18 - vib1 * 0.04);
      chewinstein.armR.elbow.rotation.set(-1.26, -0.58, 0);

      // Teeth chatter accent at start of line_08 ("Brrr!")
      const chatter = t >= 17.75 && t <= 18.6 ? Math.max(0, Math.sin(t * 42.0)) * 0.35 : 0;
      openChew = Math.max(lipChew, chatter);
      smile = -0.20;
    } else if (t < 25.4) {
      // ================================================================
      // BEAT 5 (20.2 .. 25.4s): Gold Chalk Leap Slam + Shades Snap (24.20s)
      // ================================================================
      beatId = 'beat_5_fixing_the_math';
      chalkMesh.visible = true;
      goldChalk = true;
      chalkMat.color.set('#FFE566');
      chalkMat.emissive.set('#FFBE1A');
      chalkMat.emissiveIntensity = 1.05;

      if (t < 21.30) {
        // Determined crouch windup grabbing gold chalk
        const wind = smoothstep(20.25, 21.15, t);
        chewinstein.root.rotation.y = 0.18;
        chewinstein.chestGroup.rotation.x = 0.24 * wind;
        chewinstein.headGroup.rotation.x = -0.12 * wind;
        chewinstein.eyeL.brow.position.y -= 0.014 * wind;
        chewinstein.armR.shoulder.rotation.set(-0.65 - 0.85 * wind, -0.25, 0.45);
        chewinstein.armR.elbow.rotation.set(-0.75, 0, 0);
        chewinstein.armL.shoulder.rotation.set(0.18, 0, -0.35);
        chewinstein.armL.elbow.rotation.set(-0.95, 0.35, 0);
        smile = 0.40;
      } else if (t <= 22.45) {
        // Energetic vertical leap & equals_slam at 22.15s!
        isLeaping = true;
        const leapU = clamp01((t - 21.30) / 1.15);
        const arc = Math.sin(leapU * Math.PI);
        const leapY = 0.42 * arc;

        chewinstein.root.position.y = basePos.y + leapY;
        chewinstein.root.rotation.y = 0.14;
        chewinstein.contactShadow.position.y = 0.004 - leapY / (chewinstein.root.scale.y || 1);
        chewinstein.contactShadow.scale.setScalar(1.0 - 0.32 * arc);

        chewinstein.legL.hip.rotation.x = -0.48 * arc;
        chewinstein.legL.knee.rotation.x = 0.78 * arc;
        chewinstein.legR.hip.rotation.x = -0.32 * arc;
        chewinstein.legR.knee.rotation.x = 0.56 * arc;

        // Raise chalk high before 22.00s then SLAM down onto 22.15s!
        const slamU = smoothstep(21.90, 22.18, t);
        chewinstein.chestGroup.rotation.x = lerp(-0.14, 0.26, slamU);
        chewinstein.armR.shoulder.rotation.set(lerp(-2.45, -1.05, slamU), 0.18, 0.42);
        chewinstein.armR.elbow.rotation.set(lerp(-0.25, -0.45, slamU), 0, 0);
        chewinstein.armL.shoulder.rotation.set(-0.95, 0.15, -0.75);
        chewinstein.armL.elbow.rotation.set(-0.65, 0, 0);
        hairPop = arc * 0.22;
        smile = 0.75;
      } else {
        // Landed superhero stance + Relativity Shades snap at t >= 24.20s!
        chewinstein.root.rotation.y = 0.22;
        shadesOn = t >= 24.20;
        chewinstein.sunglassesGroup.visible = shadesOn;
        if (chewinstein.monocleGroup) chewinstein.monocleGroup.visible = !shadesOn;

        if (shadesOn) {
          const snapU = smoothstep(24.20, 24.34, t);
          chewinstein.sunglassesGroup.position.y = lerp(0.295, 0.242, snapU);
          chewinstein.chestGroup.rotation.x = -0.06 + breathe;
          chewinstein.headGroup.rotation.y = 0.08;
          chewinstein.armL.shoulder.rotation.set(-1.18, 0.32, -0.32);
          chewinstein.armL.elbow.rotation.set(-0.95, 0, 0);
          chewinstein.armR.shoulder.rotation.set(-0.92, -0.15, 0.45);
          chewinstein.armR.elbow.rotation.set(-0.75, 0, 0);
          smile = 0.88;
        } else {
          chewinstein.chestGroup.rotation.x = -0.08 + breathe;
          chewinstein.armR.shoulder.rotation.set(-1.65, -0.12, 0.48);
          chewinstein.armR.elbow.rotation.set(-0.35, 0, 0);
          chewinstein.armL.shoulder.rotation.set(-0.55, 0.15, -0.42);
          chewinstein.armL.elbow.rotation.set(-0.85, 0, 0);
          smile = 0.78;
        }
      }
    } else {
      // ================================================================
      // BEAT 6 (25.4 .. 30.0s): Gold Chalk Flourish + Smug Coffee Toast!
      // ================================================================
      beatId = 'beat_6_chewinstein_theory';
      chalkMesh.visible = true;
      goldChalk = true;
      chalkMat.color.set('#FFE566');
      chalkMat.emissive.set('#FFBE1A');
      chalkMat.emissiveIntensity = 1.05;

      shadesOn = true;
      chewinstein.sunglassesGroup.visible = true;
      if (chewinstein.monocleGroup) chewinstein.monocleGroup.visible = false;

      if (t >= 25.80) {
        mugMesh.visible = true;
      }

      if (t < 27.25) {
        // Quick + COFFEE gold chalk scribble flourish (26.4..27.1s)
        const scrib = t >= 26.35 && t <= 27.15 ? 1 : 0;
        chewinstein.root.rotation.y = lerp(0.24, 0.56, smoothstep(26.2, 26.5, t) * (1 - smoothstep(27.0, 27.25, t)));
        chewinstein.chestGroup.rotation.x = breathe;
        chewinstein.armR.shoulder.rotation.set(
          -1.26 + scrib * Math.sin(t * 28.0) * 0.14,
          0.25 + scrib * Math.cos(t * 22.0) * 0.14,
          0.32
        );
        chewinstein.armR.elbow.rotation.set(-0.45, 0, 0);
        chewinstein.armL.shoulder.rotation.set(-0.45, 0.15, -0.35);
        chewinstein.armL.elbow.rotation.set(-0.92, 0, 0);
        smile = 0.76;
      } else {
        // Smug joyful Coffee Toast finale (27.25 .. 30.0s)!
        const toastU = smoothstep(27.25, 27.85, t);
        const clinkBump = t >= 28.42 && t <= 28.78 ? Math.sin(clamp01((t - 28.42) / 0.36) * Math.PI) * 0.18 : 0;
        chewinstein.root.rotation.y = 0.20;
        chewinstein.chestGroup.rotation.x = -0.05 + breathe;
        chewinstein.headGroup.rotation.y = 0.08;
        chewinstein.headGroup.rotation.x = -0.04;

        // Left arm raises steaming coffee mug proudly outward in clear toast!
        chewinstein.armL.shoulder.rotation.set(-1.12 * toastU - clinkBump, 0.14, -0.34);
        chewinstein.armL.elbow.rotation.set(-0.74 * toastU, 0, 0);
        mugMesh.position.set(-0.015, -0.018, 0.056);
        mugMesh.rotation.set(
          -(chewinstein.armL.shoulder.rotation.x + chewinstein.armL.elbow.rotation.x + chewinstein.chestGroup.rotation.x),
          0.12,
          0.26
        );

        // Right arm holds glowing gold chalk out to the side cleanly
        chewinstein.armR.shoulder.rotation.set(-0.82, -0.18, 0.48);
        chewinstein.armR.elbow.rotation.set(-0.62, 0, 0);
        smile = 0.92;
      }
    }

    chewinstein.setHatPop(hairPop);
    chewinstein.setLipSync(openChew, smile);

    // Strictly guarantee floor grounding (|minY - 0.0| <= 0.001) outside Beat 5 leap!
    let minWorldY = 0;
    if (!isLeaping) {
      chewinstein.groundFeet(floorY);
      minWorldY = floorY;
    } else {
      chewinstein.root.updateMatrixWorld(true);
      let minB = Infinity;
      for (const m of legShoeMeshes) {
        const box = new THREE.Box3().setFromObject(m);
        if (box.min.y < minB) minB = box.min.y;
      }
      minWorldY = Number.isFinite(minB) ? minB : 0;
    }

    // ------------------------------------------------------------------
    // Sassy Talking Cosmic Atom Orb Animation (Hero in Beat 3: 9.45..15.35s)
    // ------------------------------------------------------------------
    const atomWindow = t >= 9.45 && t <= 15.35;
    if (atomWindow) {
      atom.root.visible = true;
      const enterU = smoothstep(9.45, 9.95, t);
      const exitU = 1.0 - smoothstep(14.85, 15.35, t);
      const atomScale = Math.max(0.001, enterU * exitU);
      atom.root.scale.setScalar(atomScale);

      const bob = Math.sin(t * 3.4) * 0.045;
      atom.root.position.set(
        lerp(0.58, atom.restPos.x, enterU),
        atom.restPos.y + bob,
        lerp(0.08, atom.restPos.z, enterU)
      );
      // Angle playfully toward camera and Chewinstein
      atom.bodyGroup.rotation.y = -0.24 + Math.sin(t * 2.4) * 0.14;
      atom.bodyGroup.rotation.z = Math.sin(t * 3.1) * 0.06;

      // Spin electron orbital rings continuously
      atom.ringsMesh.rotation.y = t * 2.9;
      atom.ringsMesh.rotation.x = Math.sin(t * 2.1) * 0.34;

      // Pop eyes & cocked eyebrow comically at sfx_07 (10.65s)
      const eyePopDt = t - 10.65;
      const eyePop =
        eyePopDt >= 0 && eyePopDt < 0.75
          ? 1.0 + 0.42 * Math.exp(-eyePopDt * 5.2) * Math.abs(Math.sin(eyePopDt * 15.0))
          : 1.0;
      atom.eyesMesh.scale.setScalar(eyePop);

      atom.setLipSync(lipAtom, 0.74);
      atom.root.updateMatrixWorld(true);
    } else {
      atom.root.visible = false;
      atom.root.scale.setScalar(0.001);
      atom.root.position.copy(atom.restPos);
      atom.root.updateMatrixWorld(true);
    }

    const stats = countStats();
    state.t = t;
    state.beatId = beatId;
    state.grounded = !isLeaping;
    state.leaping = isLeaping;
    state.shadesOn = shadesOn;
    state.monocleDropped = monocleDropped;
    state.hairPopped = hairPop > 0.05;
    state.goldChalk = goldChalk;
    state.mugInHand = mugMesh.visible;
    state.atomVisible = atom.root.visible;
    state.shivering = isShivering;
    state.chewinsteinMinY = Number(minWorldY.toFixed(5));
    state.drawCount = stats.draws;
    state.triCount = stats.tris;
  }

  // Initialize pose at t = 0
  update(0, null);

  function getAnchors() {
    chewinstein.root.updateMatrixWorld(true);
    atom.root.updateMatrixWorld(true);

    const chewinsteinHead = new THREE.Vector3(0, 0.415, 0).applyMatrix4(chewinstein.headGroup.matrixWorld);
    const chewinsteinNose = new THREE.Vector3(0, 0.195, 0.21).applyMatrix4(chewinstein.headGroup.matrixWorld);
    const chewinsteinChalk = new THREE.Vector3(0, -0.01, 0.08).applyMatrix4(
      chewinstein.armR.propMount.matrixWorld
    );

    const feetPos = new THREE.Vector3();
    let minY = Infinity;
    for (const m of legShoeMeshes) {
      const box = new THREE.Box3().setFromObject(m);
      if (box.min.y < minY) minY = box.min.y;
    }
    feetPos.set(
      chewinstein.root.position.x,
      Number.isFinite(minY) ? minY : chewinstein.root.position.y,
      chewinstein.root.position.z
    );

    const atomCenter = new THREE.Vector3();
    atom.root.getWorldPosition(atomCenter);

    return {
      chewinsteinHead,
      chewinsteinFeet: feetPos,
      chewinsteinNose,
      chewinsteinChalk,
      atomCenter,
    };
  }

  function getState() {
    return { ...state };
  }

  return {
    update,
    getAnchors,
    getState,
    chewinstein,
    atom,
  };
}
