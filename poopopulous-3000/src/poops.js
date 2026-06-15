import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAX_POOPS = 30000;     // instanced mesh capacity; the pile should reach absurdity
const MAX_DYNAMIC = 260;     // active physics bodies before we freeze the oldest movers
const SETTLE_SECONDS = 8;    // v2's DisablePhysicsAfterTime, reborn
const POOP_HEIGHT = 0.9;     // world-space size of one poop
const BASE_SPAWN_HEIGHT = 9;
const SPAWN_CLEARANCE = 5;
const SPAWN_COLUMN_RADIUS = 1.8;

const LOD_LEVELS = [0, 1, 2];
const SURFACE_CELL = POOP_HEIGHT * 0.9;
const VISIBLE_DEPTH = POOP_HEIGHT * 2.2; // hide poos buried under a couple layers
const RENDER_REBUILD_MS = 120;
const VIEW_MARGIN = 0.22;
const MAX_VISIBLE_POOPS = 18000;
const MAX_LOD0_POOPS = 900;
const MAX_LOD1_POOPS = 4500;

// Bake material colors into vertex colors so each LOD can be drawn as one
// InstancedMesh. The LOD split keeps the close-up eyes and mouth crisp without
// asking the GPU to draw the expensive mesh for every buried turd in the heap.
function bakeColors(mesh) {
  const out = [];
  const geom = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const groups = geom.groups?.length
    ? geom.groups
    : [{ start: 0, count: geom.attributes.position.count, materialIndex: 0 }];

  for (const g of groups) {
    const sub = new THREE.BufferGeometry();
    for (const name of ['position', 'normal']) {
      const attr = geom.attributes[name];
      if (!attr) continue;
      const arr = attr.array.slice(g.start * attr.itemSize, (g.start + g.count) * attr.itemSize);
      sub.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize));
    }
    const color = mats[g.materialIndex]?.color ?? new THREE.Color(0xffffff);
    const colors = new Float32Array(g.count * 3);
    for (let i = 0; i < g.count; i++) colors.set([color.r, color.g, color.b], i * 3);
    sub.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    out.push(sub);
  }
  return out;
}

async function loadPoopGeometry(lod) {
  const path = 'assets/models/';
  const name = `LOD${lod}emoji_poop`;
  const mtl = await new MTLLoader().setPath(path).loadAsync(`${name}.mtl`);
  mtl.preload();
  const obj = await new OBJLoader().setMaterials(mtl).setPath(path).loadAsync(`${name}.obj`);

  const parts = [];
  obj.traverse((child) => { if (child.isMesh) parts.push(...bakeColors(child)); });
  const geom = mergeGeometries(parts);

  // Normalize: center on origin, rest base on y=0, scale to POOP_HEIGHT.
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const scale = POOP_HEIGHT / size.y;
  geom.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geom.scale(scale, scale, scale);
  geom.computeBoundingBox();

  return { geom, size: size.multiplyScalar(scale) };
}

function cellCoord(v) {
  return Math.floor(v / SURFACE_CELL);
}

function cellKey(cx, cz) {
  return `${cx},${cz}`;
}

function chooseLod(camera) {
  if (!camera?.isOrthographicCamera) return 1;
  const pixelsPerUnit = window.innerHeight * camera.zoom / (camera.top - camera.bottom);
  const poopPixels = POOP_HEIGHT * pixelsPerUnit;
  if (poopPixels >= 48) return 0;
  if (poopPixels >= 18) return 1;
  return 2;
}

function inCameraView(poop, camera, size, scratch) {
  if (!camera) return true;
  scratch.copy(poop.pos);
  scratch.y += size.y * 0.5;
  scratch.project(camera);
  return scratch.z >= -1 && scratch.z <= 1
    && scratch.x >= -1 - VIEW_MARGIN && scratch.x <= 1 + VIEW_MARGIN
    && scratch.y >= -1 - VIEW_MARGIN && scratch.y <= 1 + VIEW_MARGIN;
}

export async function createPoops(scene, physics, { camera, onSpawn, onCount } = {}) {
  const { RAPIER, world } = physics;
  const loaded = await Promise.all(LOD_LEVELS.map((lod) => loadPoopGeometry(lod)));
  const size = loaded[1].size;

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });
  const meshes = loaded.map(({ geom }, lod) => {
    const mesh = new THREE.InstancedMesh(geom, material, MAX_POOPS);
    mesh.count = 0;
    // Three.js frustum culls an InstancedMesh as one object. That made the
    // whole pile disappear when zoomed into a corner. We cull per instance
    // below, so keep the batches alive.
    mesh.frustumCulled = false;
    mesh.castShadow = lod !== 2;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    return mesh;
  });

  const poops = [];
  const dynamic = [];
  let totalSpawned = 0;
  let lastRenderRebuild = 0;
  let spawnTopY = 0;
  let retiredPhysicsCount = 0;
  let renderStats = { visible: 0, hidden: 0, retiredPhysics: 0, lod: [0, 0, 0] };

  const one = new THREE.Vector3(1, 1, 1);
  const scratch = new THREE.Vector3();

  const coneHalfHeight = size.y / 2;
  const coneRadius = Math.max(size.x, size.z) / 2 * 0.85;

  function syncFromBody(poop) {
    if (!poop.body) return;
    const t = poop.body.translation();
    poop.pos.set(t.x, t.y, t.z);
    const r = poop.body.rotation();
    poop.quat.set(r.x, r.y, r.z, r.w);
    poop.matrix.compose(poop.pos, poop.quat, one);
  }

  function freeze(poop) {
    if (!poop.body || poop.frozen) return;
    poop.body.setBodyType(RAPIER.RigidBodyType.Fixed, false);
    poop.frozen = true;
  }

  function retirePhysics(poop) {
    if (!poop.body || !poop.frozen) return false;
    world.removeRigidBody(poop.body);
    poop.body = null;
    poop.physicsRetired = true;
    retiredPhysicsCount++;
    return true;
  }

  function remove(poop) {
    if (poop.removed) return;
    if (poop.body) world.removeRigidBody(poop.body);
    poop.body = null;
    poop.removed = true;
    poop.renderMesh = null;
    poop.renderSlot = -1;
  }

  function spawn() {
    if (totalSpawned >= MAX_POOPS) return;

    const spawnY = Math.max(BASE_SPAWN_HEIGHT, spawnTopY + SPAWN_CLEARANCE);
    const spread = Math.min(1.8, 0.35 + spawnTopY * 0.05);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * spread;

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(Math.cos(angle) * radius, spawnY, Math.sin(angle) * radius)
        .setRotation(new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5)
        ))
        .setAngvel({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 2 })
        .setLinearDamping(0.05)
    );
    world.createCollider(
      RAPIER.ColliderDesc.cone(coneHalfHeight, coneRadius)
        .setTranslation(0, coneHalfHeight, 0)  // body origin at the poop's base
        .setFriction(0.95)
        .setRestitution(0.15),
      body
    );

    const poop = {
      body,
      born: performance.now(),
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      matrix: new THREE.Matrix4(),
      frozen: false,
      physicsRetired: false,
      removed: false,
      buried: false,
      renderMesh: null,
      renderSlot: -1,
      renderLod: 1,
    };
    syncFromBody(poop);
    poops.push(poop);
    dynamic.push(poop);
    totalSpawned++;
    onSpawn?.();
    onCount?.(totalSpawned);
  }

  function rebuildRender(activeCamera = camera) {
    activeCamera?.updateMatrixWorld();

    const heights = new Map();
    let nextSpawnTopY = 0;
    let hidden = 0;

    for (const p of poops) {
      if (p.removed) continue;
      const cx = cellCoord(p.pos.x);
      const cz = cellCoord(p.pos.z);
      p.cellX = cx;
      p.cellZ = cz;
      const key = cellKey(cx, cz);
      const h = heights.get(key);
      if (h === undefined || p.pos.y > h) heights.set(key, p.pos.y);

      if ((p.frozen || p.physicsRetired)
          && p.pos.x * p.pos.x + p.pos.z * p.pos.z <= SPAWN_COLUMN_RADIUS * SPAWN_COLUMN_RADIUS) {
        nextSpawnTopY = Math.max(nextSpawnTopY, p.pos.y + size.y);
      }
    }

    spawnTopY = nextSpawnTopY;
    for (const mesh of meshes) mesh.count = 0;

    const targetLod = chooseLod(activeCamera);
    const lodCounts = [0, 0, 0];
    let visible = 0;

    for (const p of poops) {
      p.renderMesh = null;
      p.renderSlot = -1;
      if (p.removed) continue;

      const localTop = heights.get(cellKey(p.cellX, p.cellZ)) ?? p.pos.y;
      p.buried = localTop - p.pos.y > VISIBLE_DEPTH;
      if (p.buried) {
        hidden++;
        retirePhysics(p);
        continue;
      }

      if (!inCameraView(p, activeCamera, size, scratch)) continue;
      if (visible >= MAX_VISIBLE_POOPS) {
        hidden++;
        continue;
      }

      let lod = targetLod;
      if (lod === 0 && lodCounts[0] >= MAX_LOD0_POOPS) lod = 1;
      if (lod === 1 && lodCounts[1] >= MAX_LOD1_POOPS) lod = 2;

      const mesh = meshes[lod];
      const slot = mesh.count;
      mesh.setMatrixAt(slot, p.matrix);
      mesh.count++;
      lodCounts[lod]++;
      visible++;

      p.renderMesh = mesh;
      p.renderSlot = slot;
      p.renderLod = lod;
    }

    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
    renderStats = { visible, hidden, retiredPhysics: retiredPhysicsCount, lod: lodCounts };
    lastRenderRebuild = performance.now();
  }

  function update(activeCamera = camera) {
    const now = performance.now();
    for (let i = dynamic.length - 1; i >= 0; i--) {
      const p = dynamic[i];
      if (!p.body) {
        dynamic.splice(i, 1);
        continue;
      }

      syncFromBody(p);

      if (p.pos.y < -25) {
        dynamic.splice(i, 1);
        remove(p);
        continue;
      }

      if (p.renderMesh) {
        p.renderMesh.setMatrixAt(p.renderSlot, p.matrix);
        p.renderMesh.instanceMatrix.needsUpdate = true;
      }

      if (p.body.isSleeping() || now - p.born > SETTLE_SECONDS * 1000) {
        freeze(p);
        dynamic.splice(i, 1);
      }
    }

    // Perf valve: under heavy unleashing, retire the oldest movers first.
    while (dynamic.length > MAX_DYNAMIC) {
      freeze(dynamic.shift());
    }

    if (now - lastRenderRebuild >= RENDER_REBUILD_MS) rebuildRender(activeCamera);
  }

  return {
    spawn,
    update,
    get total() { return totalSpawned; },
    get live() { return poops.length - poops.filter((p) => p.removed).length; },
    get stats() { return renderStats; },
  };
}
