import * as THREE from 'three';
import {
  MAX_FLUID_PARTICLES,
  FLOW_EMIT_RATE,
  PARTICLES_PER_PRE_POO,
  PARTICLE_RADIUS,
  PIPE_INNER_RADIUS,
  SMOOTHING_RADIUS,
  SPH_SUBSTEPS,
  LEAK_SNAP_DISTANCE,
} from './constants.js';
import {
  clampRadial,
  nearestPipePoint,
  particleWorldPosition,
  randomLowerOffset,
} from './pipeGeometry.js';

const GRAVITY = new THREE.Vector3(0, -9.81, 0);
const MAX_NEIGHBORS_PER_PARTICLE = 36;
const OPEN_SEGMENT_CAPACITY_PER_UNIT = 92;
const DEAD_END_CAPACITY_PER_UNIT = 48;
const MIN_OPEN_SEGMENT_CAPACITY = 72;
const MIN_DEAD_END_CAPACITY = 42;
const NODE_PRESSURE_LENGTH = PIPE_INNER_RADIUS * 1.35;
const TERMINAL_NODE_CAPACITY = 34;
const CORNER_NODE_CAPACITY = 48;
const JUNCTION_NODE_CAPACITY = 72;
const MAX_CHUTE_PARTICLES = 140;
const CHUTE_EMIT_HEIGHT = 1.02;
const CHUTE_INJECT_HEIGHT = 0.48;
const CHUTE_SPREAD = 0.1;
const PRESSURE_RADIUS_SQ = SMOOTHING_RADIUS * SMOOTHING_RADIUS;
const FLOW_DRAG_RADIUS = SMOOTHING_RADIUS * 1.16;
const FLOW_DRAG_RADIUS_SQ = FLOW_DRAG_RADIUS * FLOW_DRAG_RADIUS;
const FLOW_DRAG_HASH_RANGE = Math.ceil(FLOW_DRAG_RADIUS / SMOOTHING_RADIUS);
const FLOW_FAST_BRAKE_COUPLING = 0.24;
const FLOW_ENTRAINMENT_COUPLING = 0.82;
const FLOW_ENTRAINMENT_PULL = 0.18;
const FLOW_ENTRAINMENT_THRESHOLD = 0.45;
const FLOW_ENTRAINMENT_MAX_SPEED = 2.6;
const DRAIN_PATH_ACCELERATION = 0.64;

function computeDrainDistances(graph) {
  const distances = new Map();
  const drainSegment = graph.segments[graph.drainSegmentId];
  const drainNode = drainSegment?.b;
  if (!drainNode) return distances;

  distances.set(drainNode, 0);
  const unsettled = new Set(graph.nodes.keys());

  while (unsettled.size) {
    let current = null;
    let best = Infinity;

    for (const id of unsettled) {
      const distance = distances.get(id) ?? Infinity;
      if (distance >= best) continue;
      current = id;
      best = distance;
    }

    if (!current) break;
    unsettled.delete(current);

    for (const segmentId of graph.nodeSegments.get(current) ?? []) {
      const segment = graph.segments[segmentId];
      const other = segment.a === current ? segment.b : segment.a;
      if (!unsettled.has(other)) continue;
      const nextDistance = best + segment.length;
      if (nextDistance < (distances.get(other) ?? Infinity)) {
        distances.set(other, nextDistance);
      }
    }
  }

  return distances;
}

function nodeDegree(graph, nodeId) {
  return graph.nodeSegments.get(nodeId)?.length ?? 0;
}

function computeSegmentCapacities(graph) {
  const capacities = new Float32Array(graph.segments.length);

  for (const segment of graph.segments) {
    if (segment.isDrain) {
      capacities[segment.id] = Number.POSITIVE_INFINITY;
      continue;
    }

    const terminal = nodeDegree(graph, segment.a) <= 1 || nodeDegree(graph, segment.b) <= 1;
    capacities[segment.id] = terminal
      ? Math.max(MIN_DEAD_END_CAPACITY, segment.length * DEAD_END_CAPACITY_PER_UNIT)
      : Math.max(MIN_OPEN_SEGMENT_CAPACITY, segment.length * OPEN_SEGMENT_CAPACITY_PER_UNIT);
  }

  return capacities;
}

function computeNodeCapacities(graph, nodeIds) {
  const capacities = new Float32Array(nodeIds.length);

  for (let i = 0; i < nodeIds.length; i++) {
    const degree = nodeDegree(graph, nodeIds[i]);
    if (degree <= 1) capacities[i] = TERMINAL_NODE_CAPACITY;
    else if (degree === 2) capacities[i] = CORNER_NODE_CAPACITY;
    else capacities[i] = JUNCTION_NODE_CAPACITY;
  }

  return capacities;
}

function hashCoord(v) {
  return Math.floor(v / SMOOTHING_RADIUS);
}

function hashKey(x, y, z) {
  return `${x},${y},${z}`;
}

export class FluidSimulation {
  constructor(graph, {
    maxParticles = MAX_FLUID_PARTICLES,
    emitRate = FLOW_EMIT_RATE,
  } = {}) {
    this.graph = graph;
    this.maxParticles = maxParticles;
    this.emitRate = emitRate;
    this.count = 0;
    this.emitAccumulator = 0;
    this.drainedParticles = 0;
    this.chuteCount = 0;

    this.segmentIds = new Int32Array(maxParticles);
    this.s = new Float32Array(maxParticles);
    this.u = new Float32Array(maxParticles);
    this.v = new Float32Array(maxParticles);
    this.sVel = new Float32Array(maxParticles);
    this.uVel = new Float32Array(maxParticles);
    this.vVel = new Float32Array(maxParticles);
    this.positions = new Float32Array(maxParticles * 3);
    this.velocities = new Float32Array(maxParticles * 3);
    this.chutePositions = new Float32Array(MAX_CHUTE_PARTICLES * 3);
    this.chuteVelocities = new Float32Array(MAX_CHUTE_PARTICLES * 3);
    this.segmentCounts = new Int32Array(graph.segments.length);
    this.drainDistances = computeDrainDistances(graph);
    this.segmentCapacities = computeSegmentCapacities(graph);
    this.nodeIds = [...graph.nodes.keys()];
    this.nodeIndexById = new Map(this.nodeIds.map((id, index) => [id, index]));
    this.nodePressureCounts = new Int32Array(this.nodeIds.length);
    this.nodeCapacities = computeNodeCapacities(graph, this.nodeIds);

    this.hash = new Map();
    this.metrics = {
      outsidePipeCount: 0,
      maxOutsideDistance: 0,
      boundaryClampCount: 0,
      connectorTransferCount: 0,
      multiPathTransferCount: 0,
      offPrimaryTransferCount: 0,
      backpressureRejectCount: 0,
      deadEndTransferCount: 0,
      maxSegmentLoadRatio: 0,
      fullSegmentCount: 0,
      maxNodePressureRatio: 0,
      fullNodeCount: 0,
      avgNeighborCount: 0,
      flowDragPairCount: 0,
      flowDragImpulse: 0,
      entrainmentImpulse: 0,
    };
  }

  spawnAtEntry(n = 1) {
    const { entrySegment, baseS, baseVel } = this._entrySpawnParams();

    for (let i = 0; i < n && this.count < this.maxParticles; i++) {
      const offset = randomLowerOffset();
      this._addParticle(entrySegment.id, baseS + (Math.random() - 0.5) * 0.08, offset.u, offset.v, baseVel);
    }
  }

  spawnFromChute(n = 1) {
    const entry = this.graph.entryPosition;
    for (
      let i = 0;
      i < n && this.chuteCount < MAX_CHUTE_PARTICLES && this.count + this.chuteCount < this.maxParticles;
      i++
    ) {
      const index = this.chuteCount++;
      const p = index * 3;
      this.chutePositions[p] = entry.x + (Math.random() - 0.5) * CHUTE_SPREAD;
      this.chutePositions[p + 1] = entry.y + CHUTE_EMIT_HEIGHT + Math.random() * 0.28;
      this.chutePositions[p + 2] = entry.z + (Math.random() - 0.5) * CHUTE_SPREAD;
      this.chuteVelocities[p] = (Math.random() - 0.5) * 0.08;
      this.chuteVelocities[p + 1] = -1.35 - Math.random() * 0.65;
      this.chuteVelocities[p + 2] = (Math.random() - 0.5) * 0.08;
    }
  }

  _entrySpawnParams() {
    const entrySegment = this.graph.segments[this.graph.entrySegmentId];
    const fromStart = entrySegment.a === this.graph.entryNode;
    const baseS = fromStart ? 0.12 : entrySegment.length - 0.12;
    const baseVel = fromStart ? 0.3 : -0.3;
    return { entrySegment, baseS, baseVel };
  }

  convertPoops(snapshots) {
    for (const snapshot of snapshots) {
      const nearest = nearestPipePoint(this.graph, snapshot.position);
      const amount = Math.min(PARTICLES_PER_PRE_POO, this.maxParticles - this.count);
      for (let i = 0; i < amount; i++) {
        const offset = randomLowerOffset();
        this._addParticle(
          nearest.segment.id,
          nearest.s + (Math.random() - 0.5) * 0.18,
          nearest.u * 0.3 + offset.u * 0.7,
          nearest.v * 0.3 + offset.v * 0.7,
          0.15 + Math.random() * 0.4
        );
      }
    }
  }

  update(dt, { emitting = false } = {}) {
    if (emitting) {
      this.emitAccumulator += this.emitRate * dt;
      while (this.emitAccumulator >= 1 && this.count + this.chuteCount < this.maxParticles) {
        this.spawnFromChute(1);
        this.emitAccumulator -= 1;
      }
    } else {
      this.emitAccumulator = Math.min(this.emitAccumulator, 1);
    }

    const subDt = Math.min(dt / SPH_SUBSTEPS, 1 / 45);
    this._updateChute(Math.min(dt, 1 / 30));
    this._updateWorldPositions();
    this._pressurePass(Math.min(dt, 1 / 30));
    for (let i = 0; i < SPH_SUBSTEPS; i++) {
      this._updateSegmentCounts();
      this._integrate(subDt);
    }
    this._updateWorldPositions();
  }

  getPosition(i, out = new THREE.Vector3()) {
    return out.set(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
  }

  getRenderCount() {
    return this.count + this.chuteCount;
  }

  getRenderPosition(i, out = new THREE.Vector3()) {
    if (i < this.count) return this.getPosition(i, out);
    const p = (i - this.count) * 3;
    return out.set(this.chutePositions[p], this.chutePositions[p + 1], this.chutePositions[p + 2]);
  }

  getVelocity(i, out = new THREE.Vector3()) {
    return out.set(this.velocities[i * 3], this.velocities[i * 3 + 1], this.velocities[i * 3 + 2]);
  }

  sampleSurface(index = Math.floor(Math.random() * Math.max(1, this.count))) {
    if (!this.count) return null;
    const i = Math.min(index, this.count - 1);
    const segment = this.graph.segments[this.segmentIds[i]];
    const pos = this.getPosition(i);
    pos.addScaledVector(segment.top, PARTICLE_RADIUS * 2.4);
    return {
      position: pos,
      velocity: this.getVelocity(i),
      segment,
    };
  }

  getMetrics() {
    return {
      activeParticles: this.count,
      chuteParticles: this.chuteCount,
      drainedParticles: this.drainedParticles,
      outsidePipeCount: this.metrics.outsidePipeCount,
      maxOutsideDistance: this.metrics.maxOutsideDistance,
      boundaryClampCount: this.metrics.boundaryClampCount,
      connectorTransferCount: this.metrics.connectorTransferCount,
      multiPathTransferCount: this.metrics.multiPathTransferCount,
      offPrimaryTransferCount: this.metrics.offPrimaryTransferCount,
      backpressureRejectCount: this.metrics.backpressureRejectCount,
      deadEndTransferCount: this.metrics.deadEndTransferCount,
      maxSegmentLoadRatio: this.metrics.maxSegmentLoadRatio,
      fullSegmentCount: this.metrics.fullSegmentCount,
      maxNodePressureRatio: this.metrics.maxNodePressureRatio,
      fullNodeCount: this.metrics.fullNodeCount,
      avgNeighborCount: this.metrics.avgNeighborCount,
      flowDragPairCount: this.metrics.flowDragPairCount,
      flowDragImpulse: this.metrics.flowDragImpulse,
      entrainmentImpulse: this.metrics.entrainmentImpulse,
    };
  }

  _addParticle(segmentId, s, u, v, sVel) {
    const i = this.count++;
    this.segmentIds[i] = segmentId;
    this.s[i] = s;
    this.u[i] = u;
    this.v[i] = v;
    this.sVel[i] = sVel;
    this.uVel[i] = (Math.random() - 0.5) * 0.08;
    this.vVel[i] = (Math.random() - 0.5) * 0.08;
  }

  _removeParticle(i) {
    const last = this.count - 1;
    if (i !== last) {
      this.segmentIds[i] = this.segmentIds[last];
      this.s[i] = this.s[last];
      this.u[i] = this.u[last];
      this.v[i] = this.v[last];
      this.sVel[i] = this.sVel[last];
      this.uVel[i] = this.uVel[last];
      this.vVel[i] = this.vVel[last];
      this.positions.set(this.positions.subarray(last * 3, last * 3 + 3), i * 3);
      this.velocities.set(this.velocities.subarray(last * 3, last * 3 + 3), i * 3);
    }
    this.count--;
  }

  _removeChuteParticle(i) {
    const last = this.chuteCount - 1;
    if (i !== last) {
      this.chutePositions.set(this.chutePositions.subarray(last * 3, last * 3 + 3), i * 3);
      this.chuteVelocities.set(this.chuteVelocities.subarray(last * 3, last * 3 + 3), i * 3);
    }
    this.chuteCount--;
  }

  _updateChute(dt) {
    if (!this.chuteCount) return;

    const entryY = this.graph.entryPosition.y + CHUTE_INJECT_HEIGHT;
    const { entrySegment, baseS, baseVel } = this._entrySpawnParams();

    for (let i = this.chuteCount - 1; i >= 0; i--) {
      const p = i * 3;
      this.chuteVelocities[p + 1] += GRAVITY.y * dt;
      this.chuteVelocities[p] *= 0.985;
      this.chuteVelocities[p + 2] *= 0.985;
      this.chutePositions[p] += this.chuteVelocities[p] * dt;
      this.chutePositions[p + 1] += this.chuteVelocities[p + 1] * dt;
      this.chutePositions[p + 2] += this.chuteVelocities[p + 2] * dt;

      if (this.chutePositions[p + 1] > entryY) continue;

      if (this.count < this.maxParticles) {
        const offset = randomLowerOffset();
        this._addParticle(
          entrySegment.id,
          baseS + (Math.random() - 0.5) * 0.08,
          offset.u * 0.55,
          offset.v * 0.35,
          baseVel + Math.random() * 0.25
        );
      }
      this._removeChuteParticle(i);
    }
  }

  _updateWorldPositions() {
    this.metrics.outsidePipeCount = 0;
    this.metrics.maxOutsideDistance = 0;

    for (let i = 0; i < this.count; i++) {
      const segment = this.graph.segments[this.segmentIds[i]];
      const p = particleWorldPosition(segment, this.s[i], this.u[i], this.v[i]);
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;

      const velocity = segment.dir.clone().multiplyScalar(this.sVel[i])
        .addScaledVector(segment.side, this.uVel[i])
        .addScaledVector(segment.top, this.vVel[i]);
      this.velocities[i * 3] = velocity.x;
      this.velocities[i * 3 + 1] = velocity.y;
      this.velocities[i * 3 + 2] = velocity.z;

      const radial = Math.hypot(this.u[i], this.v[i]);
      const outside = Math.max(0, radial - (PIPE_INNER_RADIUS - PARTICLE_RADIUS));
      if (outside > 0) this.metrics.outsidePipeCount++;
      this.metrics.maxOutsideDistance = Math.max(this.metrics.maxOutsideDistance, outside);
    }
  }

  _buildHash() {
    this.hash.clear();
    for (let i = 0; i < this.count; i++) {
      const x = hashCoord(this.positions[i * 3]);
      const y = hashCoord(this.positions[i * 3 + 1]);
      const z = hashCoord(this.positions[i * 3 + 2]);
      const k = hashKey(x, y, z);
      let bucket = this.hash.get(k);
      if (!bucket) {
        bucket = [];
        this.hash.set(k, bucket);
      }
      bucket.push(i);
    }
  }

  _updateSegmentCounts() {
    this.segmentCounts.fill(0);
    this.nodePressureCounts.fill(0);
    for (let i = 0; i < this.count; i++) {
      const segmentId = this.segmentIds[i];
      const segment = this.graph.segments[segmentId];
      this.segmentCounts[segmentId]++;

      if (this.s[i] < NODE_PRESSURE_LENGTH) {
        const index = this.nodeIndexById.get(segment.a);
        if (index !== undefined) this.nodePressureCounts[index]++;
      }
      if (segment.length - this.s[i] < NODE_PRESSURE_LENGTH) {
        const index = this.nodeIndexById.get(segment.b);
        if (index !== undefined) this.nodePressureCounts[index]++;
      }
    }

    this.metrics.maxSegmentLoadRatio = 0;
    this.metrics.fullSegmentCount = 0;
    for (let i = 0; i < this.segmentCounts.length; i++) {
      const capacity = this.segmentCapacities[i];
      if (!Number.isFinite(capacity)) continue;
      const ratio = this.segmentCounts[i] / capacity;
      this.metrics.maxSegmentLoadRatio = Math.max(this.metrics.maxSegmentLoadRatio, ratio);
      if (ratio >= 1) this.metrics.fullSegmentCount++;
    }

    this.metrics.maxNodePressureRatio = 0;
    this.metrics.fullNodeCount = 0;
    for (let i = 0; i < this.nodePressureCounts.length; i++) {
      const ratio = this.nodePressureCounts[i] / this.nodeCapacities[i];
      this.metrics.maxNodePressureRatio = Math.max(this.metrics.maxNodePressureRatio, ratio);
      if (ratio >= 1) this.metrics.fullNodeCount++;
    }
  }

  _pressurePass(dt) {
    this._buildHash();
    let neighborTotal = 0;
    this.metrics.flowDragPairCount = 0;
    this.metrics.flowDragImpulse = 0;
    this.metrics.entrainmentImpulse = 0;

    for (let i = 0; i < this.count; i++) {
      const px = this.positions[i * 3];
      const py = this.positions[i * 3 + 1];
      const pz = this.positions[i * 3 + 2];
      const vx = this.velocities[i * 3];
      const vy = this.velocities[i * 3 + 1];
      const vz = this.velocities[i * 3 + 2];
      const speed = Math.hypot(vx, vy, vz);
      const cx = hashCoord(px);
      const cy = hashCoord(py);
      const cz = hashCoord(pz);
      let neighbors = 0;

      neighbors: for (let ox = -FLOW_DRAG_HASH_RANGE; ox <= FLOW_DRAG_HASH_RANGE; ox++) {
        for (let oy = -FLOW_DRAG_HASH_RANGE; oy <= FLOW_DRAG_HASH_RANGE; oy++) {
          for (let oz = -FLOW_DRAG_HASH_RANGE; oz <= FLOW_DRAG_HASH_RANGE; oz++) {
            const bucket = this.hash.get(hashKey(cx + ox, cy + oy, cz + oz));
            if (!bucket) continue;

            for (const j of bucket) {
              if (j === i) continue;
              const dx = px - this.positions[j * 3];
              const dy = py - this.positions[j * 3 + 1];
              const dz = pz - this.positions[j * 3 + 2];
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 <= 0.00001 || d2 > FLOW_DRAG_RADIUS_SQ) continue;

              neighbors++;
              const dist = Math.sqrt(d2);
              const nx = dx / dist;
              const ny = dy / dist;
              const nz = dz / dist;
              const segment = this.graph.segments[this.segmentIds[i]];

              if (d2 <= PRESSURE_RADIUS_SQ) {
                const push = (SMOOTHING_RADIUS - dist) / SMOOTHING_RADIUS;
                const strength = push * push * 1.6;
                this.sVel[i] += (nx * segment.dir.x + ny * segment.dir.y + nz * segment.dir.z) * strength * dt;
                this.uVel[i] += (nx * segment.side.x + ny * segment.side.y + nz * segment.side.z) * strength * dt;
                this.vVel[i] += (nx * segment.top.x + ny * segment.top.y + nz * segment.top.z) * strength * dt;
              }

              const dragKernel = (FLOW_DRAG_RADIUS - dist) / FLOW_DRAG_RADIUS;
              const dragStrength = dragKernel * dragKernel;
              const otherVx = this.velocities[j * 3];
              const otherVy = this.velocities[j * 3 + 1];
              const otherVz = this.velocities[j * 3 + 2];
              const otherSpeed = Math.hypot(
                otherVx,
                otherVy,
                otherVz
              );
              const speedGap = Math.abs(otherSpeed - speed);
              if (speedGap <= FLOW_ENTRAINMENT_THRESHOLD) {
                if (neighbors >= MAX_NEIGHBORS_PER_PARTICLE) break neighbors;
                continue;
              }

              const coupling = otherSpeed > speed
                ? FLOW_ENTRAINMENT_COUPLING
                : FLOW_FAST_BRAKE_COUPLING;
              const cappedGap = Math.min(speedGap - FLOW_ENTRAINMENT_THRESHOLD, FLOW_ENTRAINMENT_MAX_SPEED);
              let ix = (otherVx - vx) * coupling * dragStrength * dt;
              let iy = (otherVy - vy) * coupling * dragStrength * dt;
              let iz = (otherVz - vz) * coupling * dragStrength * dt;

              if (otherSpeed > speed) {
                const pull = cappedGap * FLOW_ENTRAINMENT_PULL * dragStrength * dt;
                ix -= nx * pull;
                iy -= ny * pull;
                iz -= nz * pull;
                this.metrics.entrainmentImpulse += Math.hypot(ix, iy, iz);
              }

              this.sVel[i] += ix * segment.dir.x + iy * segment.dir.y + iz * segment.dir.z;
              this.uVel[i] += ix * segment.side.x + iy * segment.side.y + iz * segment.side.z;
              this.vVel[i] += ix * segment.top.x + iy * segment.top.y + iz * segment.top.z;
              this.metrics.flowDragImpulse += Math.hypot(ix, iy, iz);
              this.metrics.flowDragPairCount++;

              if (neighbors >= MAX_NEIGHBORS_PER_PARTICLE) break neighbors;
            }
          }
        }
      }

      neighborTotal += neighbors;
    }

    this.metrics.avgNeighborCount = this.count ? neighborTotal / this.count : 0;
  }

  _integrate(dt) {
    for (let i = this.count - 1; i >= 0; i--) {
      const segment = this.graph.segments[this.segmentIds[i]];
      const alongGravity = GRAVITY.dot(segment.dir) * 1.08;
      const drainPath = this._drainPathAcceleration(segment);
      const topGravity = GRAVITY.dot(segment.top) * 0.12;

      this.sVel[i] += (alongGravity + drainPath) * dt;
      this.vVel[i] += topGravity * dt;

      this.sVel[i] *= 0.997;
      this.uVel[i] *= 0.94;
      this.vVel[i] *= 0.94;

      this.sVel[i] = THREE.MathUtils.clamp(this.sVel[i], -7.0, 7.0);
      this.uVel[i] = THREE.MathUtils.clamp(this.uVel[i], -1.2, 1.2);
      this.vVel[i] = THREE.MathUtils.clamp(this.vVel[i], -1.2, 1.2);

      this.s[i] += this.sVel[i] * dt;
      this.u[i] += this.uVel[i] * dt;
      this.v[i] += this.vVel[i] * dt;

      const clamped = clampRadial(this.u[i], this.v[i]);
      if (clamped.clamped) {
        const len = Math.max(Math.hypot(this.u[i], this.v[i]), 0.0001);
        const nx = this.u[i] / len;
        const ny = this.v[i] / len;
        const outward = this.uVel[i] * nx + this.vVel[i] * ny;
        if (outward > 0) {
          this.uVel[i] -= outward * nx * 1.25;
          this.vVel[i] -= outward * ny * 1.25;
        }
        this.u[i] = clamped.u;
        this.v[i] = clamped.v;
        this.metrics.boundaryClampCount++;
      }

      if (!this._handleSegmentCrossing(i)) continue;

      const p = this.getPosition(i);
      const nearest = nearestPipePoint(this.graph, p);
      if (nearest.outsideDistance > LEAK_SNAP_DISTANCE) {
        this.segmentIds[i] = nearest.segment.id;
        this.s[i] = nearest.s;
        this.u[i] = nearest.u;
        this.v[i] = nearest.v;
        this.metrics.boundaryClampCount++;
      }
    }
  }

  _drainPathAcceleration(segment) {
    if (segment.isDrain) return 0;
    const aDistance = this.drainDistances.get(segment.a) ?? Infinity;
    const bDistance = this.drainDistances.get(segment.b) ?? Infinity;
    if (!Number.isFinite(aDistance) || !Number.isFinite(bDistance)) return 0;

    const normalizedGradient = THREE.MathUtils.clamp((aDistance - bDistance) / segment.length, -1, 1);
    return normalizedGradient * DRAIN_PATH_ACCELERATION;
  }

  _handleSegmentCrossing(i) {
    let guard = 0;
    while (guard++ < 4) {
      const segment = this.graph.segments[this.segmentIds[i]];
      if (this.s[i] >= 0 && this.s[i] <= segment.length) return true;

      if (segment.isDrain && this.s[i] > segment.length) {
        this._removeParticle(i);
        this.drainedParticles++;
        return false;
      }

      const atStart = this.s[i] < 0;
      const node = atStart ? segment.a : segment.b;
      const overflow = atStart ? -this.s[i] : this.s[i] - segment.length;
      const candidates = (this.graph.nodeSegments.get(node) ?? []).filter((id) => id !== segment.id);

      if (!candidates.length) {
        this.s[i] = atStart ? 0.02 : segment.length - 0.02;
        this.sVel[i] *= -0.35;
        return true;
      }

      let totalWeight = 0;
      const options = [];
      const primaryNext = this.graph.primaryNextSegmentByNode?.get(node);
      for (const id of candidates) {
        const candidate = this.graph.segments[id];
        const leavesFromStart = candidate.a === node;
        const sign = leavesFromStart ? 1 : -1;
        const outgoing = candidate.dir.clone().multiplyScalar(sign);
        const downhill = GRAVITY.dot(outgoing);
        const incoming = segment.dir.clone().multiplyScalar(this.sVel[i]);
        const incomingLength = incoming.length();
        const alignment = incomingLength > 0.001 ? outgoing.dot(incoming.multiplyScalar(1 / incomingLength)) : 0;
        const load = this.segmentCounts[id] ?? 0;
        const targetNode = leavesFromStart ? candidate.b : candidate.a;
        const currentDrainDistance = this.drainDistances.get(node) ?? Infinity;
        const nextDrainDistance = this.drainDistances.get(targetNode) ?? Infinity;
        const drainProgress = Number.isFinite(currentDrainDistance) && Number.isFinite(nextDrainDistance)
          ? Math.max(0, currentDrainDistance - nextDrainDistance)
          : 0;
        const capacity = this.segmentCapacities[id] ?? MIN_OPEN_SEGMENT_CAPACITY;
        const fillRatio = Number.isFinite(capacity) ? load / capacity : 0;
        const targetDegree = nodeDegree(this.graph, targetNode);
        const entersDeadEnd = !candidate.isDrain && targetDegree <= 1;
        const targetNodeIndex = this.nodeIndexById.get(targetNode);
        const targetNodeFill = targetNodeIndex === undefined || candidate.isDrain
          ? 0
          : this.nodePressureCounts[targetNodeIndex] / this.nodeCapacities[targetNodeIndex];
        const terminalIsFull = entersDeadEnd && (fillRatio >= 1 || targetNodeFill >= 1);
        if (terminalIsFull) {
          this.metrics.backpressureRejectCount++;
          continue;
        }

        const fillExcess = Math.max(0, fillRatio - (entersDeadEnd ? 0.55 : 0.82));
        const nodeExcess = Math.max(0, targetNodeFill - (entersDeadEnd ? 0.58 : 0.85));
        const capacityGate = candidate.isDrain ? 1 : 1 / (1 + fillExcess * fillExcess * 6);
        const nodeGate = candidate.isDrain ? 1 : 1 / (1 + nodeExcess * nodeExcess * 8);
        const deadEndGate = entersDeadEnd ? nodeGate / (1 + fillExcess * fillExcess * 8) : Math.max(0.35, nodeGate);
        const downhillWeight = Math.max(0, downhill) * 1.65;
        const flatBranchWeight = downhill > -0.08 ? 0.7 : 0.08;
        const inertiaWeight = Math.max(0, alignment) * 1.1;
        const uphillPenalty = downhill < -0.08 ? 0.12 : 1;
        const drainBonus = candidate.isDrain ? 16 : 0;
        const drainPathWeight = drainProgress * 2.4;
        const loadRelief = capacityGate * deadEndGate;
        const weight = (flatBranchWeight + downhillWeight + inertiaWeight + drainPathWeight + drainBonus)
          * uphillPenalty
          * loadRelief;
        if (weight < 0.001) {
          this.metrics.backpressureRejectCount++;
          continue;
        }
        totalWeight += weight;
        options.push({ candidate, sign, leavesFromStart, weight, primary: id === primaryNext, entersDeadEnd });
      }

      if (!options.length || totalWeight <= 0) {
        this.s[i] = atStart ? 0.02 : segment.length - 0.02;
        this.sVel[i] *= -0.25;
        return true;
      }

      let best = options[options.length - 1];
      let roll = Math.random() * totalWeight;
      for (const option of options) {
        roll -= option.weight;
        if (roll > 0) continue;
        best = option;
        break;
      }

      this.segmentIds[i] = best.candidate.id;
      this.s[i] = best.leavesFromStart ? overflow : best.candidate.length - overflow;
      this.sVel[i] = Math.max(Math.abs(this.sVel[i]) * 0.92, 0.25) * best.sign;
      this.metrics.connectorTransferCount++;
      if (candidates.length > 1) this.metrics.multiPathTransferCount++;
      if (!best.primary) this.metrics.offPrimaryTransferCount++;
      if (best.entersDeadEnd) this.metrics.deadEndTransferCount++;
    }

    return true;
  }
}
