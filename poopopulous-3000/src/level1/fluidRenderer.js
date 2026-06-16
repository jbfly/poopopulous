import * as THREE from 'three';
import { PARTICLE_RADIUS } from './constants.js';

export function createFluidRenderer(scene, simulation) {
  const geom = new THREE.SphereGeometry(PARTICLE_RADIUS * 1.35, 8, 6);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4b2012,
    roughness: 0.42,
    metalness: 0.02,
  });
  const mesh = new THREE.InstancedMesh(geom, mat, simulation.maxParticles);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  const mat4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3(1.45, 0.85, 1.45);

  function update() {
    const count = simulation.getRenderCount?.() ?? simulation.count;
    mesh.count = count;
    for (let i = 0; i < count; i++) {
      if (simulation.getRenderPosition) simulation.getRenderPosition(i, pos);
      else simulation.getPosition(i, pos);
      mat4.compose(pos, quat, scale);
      mesh.setMatrixAt(i, mat4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function dispose() {
    scene.remove(mesh);
    geom.dispose();
    mat.dispose();
  }

  return { update, dispose, mesh };
}
