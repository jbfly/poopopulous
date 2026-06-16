import * as THREE from 'three';
import { PIPE_INNER_RADIUS, PIPE_WALL_THICKNESS } from './constants.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

function colliderTop(segment) {
  const top = new THREE.Vector3().crossVectors(segment.side, segment.dir).normalize();
  if (top.dot(WORLD_UP) < 0) top.multiplyScalar(-1);
  return top;
}

function segmentRotation(segment) {
  const top = colliderTop(segment);
  const basis = new THREE.Matrix4().makeBasis(segment.dir, top, segment.side);
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

function addBox(world, RAPIER, segment, center, halfExtents, rotation, colliders) {
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
      .setTranslation(center.x, center.y, center.z)
      .setRotation(rotation)
      .setFriction(0.95)
      .setRestitution(0.05)
  );
  colliders.push(collider);
}

export function createPipeColliders(physics, graph) {
  const { RAPIER, world } = physics;
  const colliders = [];
  const floorThickness = PIPE_WALL_THICKNESS * 0.75;
  const sideThickness = PIPE_WALL_THICKNESS;
  const wallHeight = PIPE_INNER_RADIUS * 0.9;

  for (const segment of graph.segments) {
    const rotation = segmentRotation(segment);
    const top = colliderTop(segment);
    const midpoint = segment.start.clone().add(segment.end).multiplyScalar(0.5);
    const halfLength = segment.length / 2 + PIPE_INNER_RADIUS * 0.18;

    addBox(
      world,
      RAPIER,
      segment,
      midpoint.clone().addScaledVector(top, -PIPE_INNER_RADIUS),
      new THREE.Vector3(halfLength, floorThickness, PIPE_INNER_RADIUS * 0.92),
      rotation,
      colliders
    );

    for (const side of [-1, 1]) {
      addBox(
        world,
        RAPIER,
        segment,
        midpoint.clone().addScaledVector(segment.side, side * PIPE_INNER_RADIUS * 0.94)
          .addScaledVector(top, -PIPE_INNER_RADIUS * 0.25),
        new THREE.Vector3(halfLength, wallHeight, sideThickness),
        rotation,
        colliders
      );
    }
  }

  return {
    dispose() {
      for (const collider of colliders) world.removeCollider(collider, false);
      colliders.length = 0;
    },
  };
}
