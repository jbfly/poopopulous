import * as THREE from 'three';
import { createPoops } from '../poops.js';
import { createPipeVisuals, getPipeFittingStats } from '../level1/pipeGeometry.js';
import { FluidSimulation } from '../level1/fluidSimulation.js';
import { createFluidRenderer } from '../level1/fluidRenderer.js';
import { createFloaterPhysics } from '../level1/floaterPhysics.js';
import { createPipeSeed, generatePipeGraph } from '../level1/pipeGraph.js';
import { createPipeColliders } from '../level1/pipeColliders.js';
import { createExitSign } from '../level1/exitSign.js';
import {
  FLOATER_SCALE,
  MAX_PRE_UNLEASH_POOS,
  PRE_UNLEASH_INTERVAL,
} from '../level1/constants.js';

export async function createLevel1Mode({
  world,
  physics,
  audio,
  setCounter,
  onUnleashChange,
  seed = createPipeSeed(),
}) {
  world.setSplashVisible(false);
  world.setCameraHome({ position: [14, 13, 15], target: [0, 0.2, 0.5], zoom: 1.25 });

  const group = new THREE.Group();
  group.name = 'level-1';
  world.scene.add(group);

  const graph = generatePipeGraph(seed);
  const pipeGroup = createPipeVisuals(graph);
  group.add(pipeGroup);
  const exitSign = createExitSign(graph);
  group.add(exitSign.group);
  const pipeColliders = createPipeColliders(physics, graph);

  const fluid = new FluidSimulation(graph);
  const fluidRenderer = createFluidRenderer(group, fluid);
  const floaters = await createFloaterPhysics(group, physics, fluid);

  let unleashed = false;
  let prePoops = await createPoops(group, physics, {
    maxPoops: MAX_PRE_UNLEASH_POOS,
    maxDynamic: MAX_PRE_UNLEASH_POOS,
    settleSeconds: 15,
    poopHeight: FLOATER_SCALE,
    spawnCenter: {
      x: graph.entryPosition.x,
      y: graph.entryPosition.y + 1.35,
      z: graph.entryPosition.z,
    },
    spawnSpread: 0.12,
    onSpawn: () => audio.plop({ storm: false }),
    onCount: (n) => { setCounter(`💩 × ${n.toLocaleString()}`); },
  });

  let lastPreSpawn = 0;
  let lastStormSound = 0;
  let lastNow = performance.now();
  let fpsEstimate = 60;
  const graphStats = (() => {
    const degrees = [...graph.nodeSegments.values()].map((segments) => segments.length);
    return {
      pipeSegments: graph.segments.length,
      maxNodeDegree: Math.max(...degrees),
      overfullNodes: degrees.filter((degree) => degree > 4).length,
      ...getPipeFittingStats(graph),
    };
  })();

  setCounter('💩 × 0');

  function setUnleashed(value) {
    if (value === unleashed) return;
    unleashed = value;
    onUnleashChange?.(unleashed);

    if (unleashed && prePoops) {
      const snapshots = prePoops.getSnapshots();
      fluid.convertPoops(snapshots);
      if (!snapshots.length) fluid.spawnAtEntry(80);
      prePoops.dispose();
      prePoops = null;
    }
  }

  function updateCounter() {
    if (!unleashed) {
      setCounter(`💩 × ${(prePoops?.total ?? 0).toLocaleString()}`);
      return;
    }

    setCounter(`💩 fluid × ${fluid.count.toLocaleString()} · floaters × ${floaters.count}`);
  }

  function update({ now, dt }) {
    fpsEstimate = fpsEstimate * 0.92 + (1 / Math.max(dt, 0.001)) * 0.08;

    if (!unleashed && prePoops) {
      if (now - lastPreSpawn >= PRE_UNLEASH_INTERVAL && prePoops.count < MAX_PRE_UNLEASH_POOS) {
        prePoops.spawn();
        lastPreSpawn = now;
      }
      prePoops.update();
    }

    fluid.update(dt, { emitting: unleashed });
    exitSign.update(fluid.drainedParticles);
    if (unleashed && now - lastStormSound > 75) {
      audio.plop({ storm: true });
      lastStormSound = now;
    }

    fluidRenderer.update();
    floaters.update();
    updateCounter();
    lastNow = now;
  }

  function getMetrics() {
    return {
      ...fluid.getMetrics(),
      activeFloaters: floaters.count,
      prePooCount: prePoops?.count ?? 0,
      floaterClampCount: floaters.floaterClampCount,
      fpsEstimate,
      seed,
      unleashed,
      lastNow,
      exitSignText: exitSign.text,
      exitSignPoopulation: exitSign.poopulation,
      ...graphStats,
    };
  }

  function dispose() {
    prePoops?.dispose();
    exitSign.dispose();
    fluidRenderer.dispose();
    floaters.dispose();
    pipeColliders.dispose();
    world.scene.remove(group);
    group.traverse((obj) => {
      if (obj.geometry && !obj.isInstancedMesh) obj.geometry.dispose?.();
      if (obj.material && !obj.isInstancedMesh) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
        else obj.material.dispose?.();
      }
    });
  }

  return {
    name: 'level1',
    seed,
    update,
    dispose,
    setUnleashed,
    getMetrics,
    regenerate: () => {},
    get unleashed() { return unleashed; },
    get graph() { return graph; },
    get fluid() { return fluid; },
  };
}
