import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAX_POOPS = 4000;     // instanced mesh capacity
const MAX_DYNAMIC = 350;    // active physics bodies before we start freezing the oldest
const SETTLE_SECONDS = 8;   // v2's DisablePhysicsAfterTime, reborn
const POOP_HEIGHT = 0.9;    // world-space size of one poop
const SPAWN_HEIGHT = 9;

// Bake material colors into vertex colors so the whole model can be drawn
// as a single InstancedMesh (one draw call for thousands of poops).
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

async function loadPoopGeometry() {
  const mtl = await new MTLLoader().setPath('assets/models/').loadAsync('LOD1emoji_poop.mtl');
  mtl.preload();
  const obj = await new OBJLoader().setMaterials(mtl).setPath('assets/models/').loadAsync('LOD1emoji_poop.obj');

  const parts = [];
  obj.traverse((child) => { if (child.isMesh) parts.push(...bakeColors(child)); });
  const geom = mergeGeometries(parts);

  // Normalize: center on origin, rest base on y=0, scale to POOP_HEIGHT
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

export async function createPoops(scene, physics, { onSpawn, onCount } = {}) {
  const { RAPIER, world } = physics;
  const { geom, size } = await loadPoopGeometry();

  const mesh = new THREE.InstancedMesh(
    geom,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 }),
    MAX_POOPS
  );
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  const poops = [];        // every poop ever, indexed by instance slot
  const dynamic = [];      // subset still owned by the physics engine
  let totalSpawned = 0;

  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);

  const coneHalfHeight = size.y / 2;
  const coneRadius = Math.max(size.x, size.z) / 2 * 0.85;

  function spawn() {
    if (mesh.count >= MAX_POOPS) return;

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation((Math.random() - 0.5) * 0.8, SPAWN_HEIGHT, (Math.random() - 0.5) * 0.8)
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

    const poop = { body, slot: mesh.count, born: performance.now() };
    poops[poop.slot] = poop;
    dynamic.push(poop);
    mesh.count++;
    totalSpawned++;
    onSpawn?.();
    onCount?.(totalSpawned);
  }

  function freeze(poop) {
    poop.body.setBodyType(RAPIER.RigidBodyType.Fixed, false);
  }

  // Remove a poop entirely (fell off the world): swap-remove its instance slot
  function remove(poop) {
    world.removeRigidBody(poop.body);
    const last = poops[mesh.count - 1];
    if (last !== poop) {
      mesh.getMatrixAt(last.slot, mat4);
      mesh.setMatrixAt(poop.slot, mat4);
      last.slot = poop.slot;
      poops[poop.slot] = last;
    }
    poops[mesh.count - 1] = undefined;
    mesh.count--;
  }

  function update() {
    const now = performance.now();
    for (let i = dynamic.length - 1; i >= 0; i--) {
      const p = dynamic[i];
      const t = p.body.translation();

      if (t.y < -25) {
        dynamic.splice(i, 1);
        remove(p);
        continue;
      }

      pos.set(t.x, t.y, t.z);
      const r = p.body.rotation();
      quat.set(r.x, r.y, r.z, r.w);
      mat4.compose(pos, quat, one);
      mesh.setMatrixAt(p.slot, mat4);

      if (p.body.isSleeping() || now - p.born > SETTLE_SECONDS * 1000) {
        freeze(p);
        dynamic.splice(i, 1);
      }
    }

    // Perf valve: under heavy unleashing, retire the oldest movers first
    while (dynamic.length > MAX_DYNAMIC) {
      freeze(dynamic.shift());
    }

    mesh.instanceMatrix.needsUpdate = true;
  }

  return { spawn, update, get total() { return totalSpawned; } };
}
