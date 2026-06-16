import * as THREE from 'three';
import { loadPoopGeometry } from '../poopModel.js';
import { FLOATER_SCALE, MAX_FLOATERS } from './constants.js';

export async function createFloaterPhysics(scene, physics, simulation) {
  const { RAPIER, world } = physics;
  const { geom } = await loadPoopGeometry({ lod: 2, height: FLOATER_SCALE });
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66 });
  const mesh = new THREE.InstancedMesh(geom, mat, MAX_FLOATERS);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  const floaters = [];
  const mat4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  let frame = 0;
  let floaterClampCount = 0;

  function spawnFloater() {
    const sample = simulation.sampleSurface();
    if (!sample) return;

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setGravityScale(0)
        .setTranslation(sample.position.x, sample.position.y, sample.position.z)
        .setLinearDamping(1.8)
        .setAngularDamping(4.5)
        .setAngvel({
          x: (Math.random() - 0.5) * 0.35,
          y: (Math.random() - 0.5) * 0.35,
          z: (Math.random() - 0.5) * 0.35,
        })
    );

    world.createCollider(
      RAPIER.ColliderDesc.ball(FLOATER_SCALE * 0.28)
        .setFriction(0.6)
        .setRestitution(0.08),
      body
    );

    floaters.push({ body, sampleIndex: Math.floor(Math.random() * Math.max(1, simulation.count)) });
  }

  function update() {
    frame++;
    const desired = Math.min(MAX_FLOATERS, Math.floor(simulation.count / 165));
    while (floaters.length < desired) spawnFloater();

    mesh.count = floaters.length;
    for (let i = floaters.length - 1; i >= 0; i--) {
      const floater = floaters[i];
      if (floater.sampleIndex >= simulation.count) floater.sampleIndex = Math.floor(Math.random() * Math.max(1, simulation.count));
      const sample = simulation.sampleSurface(floater.sampleIndex);
      if (!sample) continue;

      const t = floater.body.translation();
      pos.set(t.x, t.y, t.z);
      const delta = sample.position.clone().sub(pos);

      if (delta.length() > 1.2) {
        floater.body.setTranslation(sample.position, true);
        floater.body.setLinvel(sample.velocity, true);
        floaterClampCount++;
      } else {
        const lin = floater.body.linvel();
        const force = delta.multiplyScalar(12)
          .add(sample.velocity.clone().multiplyScalar(2))
          .add(new THREE.Vector3(-lin.x, -lin.y, -lin.z).multiplyScalar(3.5));
        floater.body.addForce(force, true);
      }

      const ang = floater.body.angvel();
      floater.body.setAngvel({ x: ang.x * 0.82, y: ang.y * 0.82, z: ang.z * 0.82 }, true);

      if (frame % 180 === 0) {
        floater.sampleIndex = Math.floor(Math.random() * Math.max(1, simulation.count));
      }

      const r = floater.body.rotation();
      const p = floater.body.translation();
      quat.set(r.x, r.y, r.z, r.w);
      pos.set(p.x, p.y, p.z);
      mat4.compose(pos, quat, scale);
      mesh.setMatrixAt(i, mat4);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }

  function dispose() {
    for (const floater of floaters) world.removeRigidBody(floater.body);
    floaters.length = 0;
    scene.remove(mesh);
    mat.dispose();
  }

  return {
    update,
    dispose,
    get count() { return floaters.length; },
    get floaterClampCount() { return floaterClampCount; },
  };
}
