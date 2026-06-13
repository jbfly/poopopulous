import RAPIER from '@dimforge/rapier3d-compat';
import { GRID_SIZE, TILE_SIZE } from './world.js';

export async function createPhysics() {
  await RAPIER.init();

  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const half = (GRID_SIZE * TILE_SIZE) / 2;

  // Ground slab matching the visual platform
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(half, 0.5, half)
      .setTranslation(0, -0.5, 0)
      .setFriction(0.9)
  );

  return { RAPIER, world };
}
