import * as THREE from 'three';
import { loadPoopGeometry } from './poopModel.js';

const MAX_POOPS = 4000;     // instanced mesh capacity
const MAX_DYNAMIC = 350;    // active physics bodies before we start freezing the oldest
const SETTLE_SECONDS = 8;   // v2's DisablePhysicsAfterTime, reborn
const POOP_HEIGHT = 0.9;    // world-space size of one poop
const SPAWN_HEIGHT = 9;

export async function createPoops(scene, physics, {
  onSpawn,
  onCount,
  maxPoops = MAX_POOPS,
  maxDynamic = MAX_DYNAMIC,
  settleSeconds = SETTLE_SECONDS,
  spawnCenter = { x: 0, y: SPAWN_HEIGHT, z: 0 },
  spawnSpread = 0.8,
  poopHeight = POOP_HEIGHT,
} = {}) {
  const { RAPIER, world } = physics;
  const { geom, size } = await loadPoopGeometry({ height: poopHeight });

  const mesh = new THREE.InstancedMesh(
    geom,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 }),
    maxPoops
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

  function spawn({ center = spawnCenter, spread = spawnSpread } = {}) {
    if (mesh.count >= maxPoops) return;

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(
          center.x + (Math.random() - 0.5) * spread,
          center.y,
          center.z + (Math.random() - 0.5) * spread
        )
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

      if (p.body.isSleeping() || now - p.born > settleSeconds * 1000) {
        freeze(p);
        dynamic.splice(i, 1);
      }
    }

    // Perf valve: under heavy unleashing, retire the oldest movers first
    while (dynamic.length > maxDynamic) {
      freeze(dynamic.shift());
    }

    mesh.instanceMatrix.needsUpdate = true;
  }

  function getSnapshots() {
    return poops.filter(Boolean).map((p) => ({
      position: p.body.translation(),
      rotation: p.body.rotation(),
    }));
  }

  function dispose() {
    for (const p of poops) {
      if (p?.body) world.removeRigidBody(p.body);
    }
    poops.length = 0;
    dynamic.length = 0;
    scene.remove(mesh);
    mesh.material.dispose();
  }

  return {
    spawn,
    update,
    dispose,
    getSnapshots,
    get total() { return totalSpawned; },
    get count() { return mesh.count; },
  };
}
