import * as THREE from 'three';
import {
  PIPE_INNER_RADIUS,
  PIPE_RADIUS,
  PIPE_TILE_SIZE,
  PIPE_WALL_THICKNESS,
  PARTICLE_RADIUS,
  BOUNDARY_SKIN,
  SLOPE_DROP_PER_ROW,
} from './constants.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ELBOW_ARC_STEPS = 14;
const ELBOW_VERTICAL_STEPS = 12;
const ELBOW_OVERLAP_ANGLE = 0.045;
const SADDLE_CUT_DEPTH = 0.78;
const ROW_SLOPE_PER_WORLD_Z = -SLOPE_DROP_PER_ROW / PIPE_TILE_SIZE;
const SLOPE_UP = new THREE.Vector3(0, 1, -ROW_SLOPE_PER_WORLD_Z).normalize();

export function preparePipeFrames(graph) {
  for (const segment of graph.segments) {
    const side = new THREE.Vector3().crossVectors(segment.dir, SLOPE_UP);
    if (side.lengthSq() < 0.0001) side.set(1, 0, 0);
    side.normalize();

    segment.side = side;
    segment.top = SLOPE_UP.clone();
    segment.bottom = SLOPE_UP.clone().multiplyScalar(-1);
  }

  return graph;
}

function lowerHalfTubeGeometry(segment, radius, radialSteps = 18, {
  startCutSides = [],
  endCutSides = [],
} = {}) {
  const positions = [];
  const normals = [];
  const indices = [];
  const arcStart = Math.PI;
  const arcEnd = Math.PI * 2;
  const hasCuts = Boolean(startCutSides.length || endCutSides.length);
  const axialSteps = hasCuts ? 6 : 1;

  for (let ring = 0; ring <= axialSteps; ring++) {
    const t = ring / axialSteps;
    for (let i = 0; i <= radialSteps; i++) {
      const theta = arcStart + (arcEnd - arcStart) * (i / radialSteps);
      const startBack = saddleCutback(theta, startCutSides, radius);
      const endBack = saddleCutback(theta, endCutSides, radius);
      const usableLength = Math.max(0.03, segment.length - startBack - endBack);
      const base = segment.start.clone().addScaledVector(segment.dir, startBack + usableLength * t);
      const radial = segment.side.clone().multiplyScalar(Math.cos(theta))
        .add(segment.top.clone().multiplyScalar(Math.sin(theta)));
      const p = base.clone().add(radial.clone().multiplyScalar(radius));
      positions.push(p.x, p.y, p.z);
      normals.push(radial.x, radial.y, radial.z);
    }
  }

  for (let ring = 0; ring < axialSteps; ring++) {
    const row = radialSteps + 1;
    for (let i = 0; i < radialSteps; i++) {
      const a = ring * row + i;
      const b = a + 1;
      const c = (ring + 1) * row + i + 1;
      const d = (ring + 1) * row + i;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setIndex(indices);
  return geom;
}

function saddleCutback(theta, sides, radius) {
  let amount = 0;
  for (const side of sides) {
    amount = Math.max(amount, Math.max(0, side * Math.cos(theta)));
  }
  return amount * radius * SADDLE_CUT_DEPTH;
}

function connectedDirections(graph, id) {
  const node = graph.nodes.get(id);
  return (graph.nodeSegments.get(id) ?? []).map((segmentId) => {
    const segment = graph.segments[segmentId];
    const otherId = segment.a === id ? segment.b : segment.a;
    const other = graph.nodes.get(otherId);

    return {
      x: Math.sign(other.c - node.c),
      z: Math.sign(other.r - node.r),
      segment,
    };
  });
}

function isStraightThrough(dirs) {
  return dirs.length === 2 && dirs[0].x === -dirs[1].x && dirs[0].z === -dirs[1].z;
}

export function classifyPipeNode(graph, id) {
  const dirs = connectedDirections(graph, id);
  const degree = dirs.length;
  let type = 'dead-end';

  if (degree === 2) type = isStraightThrough(dirs) ? 'straight' : 'corner';
  else if (degree === 3) type = 'tee';
  else if (degree === 4) type = 'cross';
  else if (degree > 4) type = 'overfull';

  return { type, degree, dirs };
}

function needsFitting(type) {
  return type === 'corner';
}

function cutSidesForSegmentEndpoint(graph, nodeId, segment) {
  const { type, dirs } = classifyPipeNode(graph, nodeId);
  if (type === 'dead-end' || type === 'straight') return [];

  const current = dirs.find((dir) => dir.segment.id === segment.id);
  if (!current) return [];

  const currentVector = new THREE.Vector3(current.x, 0, current.z);
  const sides = new Set();

  for (const other of dirs) {
    if (other.segment.id === segment.id) continue;

    const otherVector = new THREE.Vector3(other.x, 0, other.z);
    if (currentVector.dot(otherVector) < -0.5) continue;

    const sideDot = otherVector.dot(segment.side);
    if (Math.abs(sideDot) > 0.25) sides.add(sideDot >= 0 ? 1 : -1);
  }

  return [...sides];
}

function normalizeAngle(angle) {
  let a = angle;
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function cornerLowerHemisphereGeometry(node, dirs, radius) {
  const positions = [];
  const normals = [];
  const indices = [];
  const a0 = Math.atan2(dirs[0].z, dirs[0].x) + Math.PI;
  const a1 = Math.atan2(dirs[1].z, dirs[1].x) + Math.PI;
  let delta = normalizeAngle(a1 - a0);

  if (Math.abs(delta) > Math.PI / 2 + 0.001) {
    delta = delta > 0 ? delta - Math.PI * 2 : delta + Math.PI * 2;
  }

  const direction = Math.sign(delta) || 1;
  const startAngle = a0 - direction * ELBOW_OVERLAP_ANGLE;
  const arcDelta = delta + direction * ELBOW_OVERLAP_ANGLE * 2;

  for (let arc = 0; arc <= ELBOW_ARC_STEPS; arc++) {
    const angle = startAngle + arcDelta * (arc / ELBOW_ARC_STEPS);
    const horizontal = new THREE.Vector3(
      Math.cos(angle),
      ROW_SLOPE_PER_WORLD_Z * Math.sin(angle),
      Math.sin(angle)
    ).normalize();

    for (let v = 0; v <= ELBOW_VERTICAL_STEPS; v++) {
      const t = (Math.PI / 2) * (v / ELBOW_VERTICAL_STEPS);
      const radial = horizontal.clone().multiplyScalar(Math.cos(t))
        .addScaledVector(SLOPE_UP, -Math.sin(t));
      const p = node.position.clone().addScaledVector(radial, radius);
      positions.push(p.x, p.y, p.z);
      normals.push(radial.x, radial.y, radial.z);
    }
  }

  const row = ELBOW_VERTICAL_STEPS + 1;
  for (let arc = 0; arc < ELBOW_ARC_STEPS; arc++) {
    for (let v = 0; v < ELBOW_VERTICAL_STEPS; v++) {
      const a = arc * row + v;
      const b = a + 1;
      const c = (arc + 1) * row + v + 1;
      const d = (arc + 1) * row + v;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function deadEndCapGeometry(segment, nodeId, radius, radialSteps = 20) {
  const positions = [];
  const normals = [];
  const indices = [];
  const atStart = segment.a === nodeId;
  const center = atStart ? segment.start : segment.end;
  const capUp = segment.top.clone();
  const normal = segment.dir.clone().multiplyScalar(atStart ? -1 : 1);
  const capCenter = center.clone().addScaledVector(normal, 0.004);

  positions.push(capCenter.x, capCenter.y, capCenter.z);
  normals.push(normal.x, normal.y, normal.z);

  for (let i = 0; i <= radialSteps; i++) {
    const theta = Math.PI + Math.PI * (i / radialSteps);
    const radial = segment.side.clone().multiplyScalar(Math.cos(theta))
      .add(capUp.clone().multiplyScalar(Math.sin(theta)));
    const p = capCenter.clone().addScaledVector(radial, radius);
    positions.push(p.x, p.y, p.z);
    normals.push(normal.x, normal.y, normal.z);
  }

  for (let i = 1; i <= radialSteps; i++) {
    if (atStart) indices.push(0, i, i + 1);
    else indices.push(0, i + 1, i);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setIndex(indices);
  return geom;
}

function shouldCapDeadEnd(graph, nodeId, segment) {
  if (segment.isDrain || nodeId === graph.entryNode) return false;
  if (nodeId === graph.segments[graph.drainSegmentId]?.b) return false;
  return (graph.nodeSegments.get(nodeId)?.length ?? 0) <= 1;
}

function createSpawnPipeVisual(entryPosition, pipeMat, innerMat) {
  const group = new THREE.Group();
  group.name = 'level1-spawn-pipe';

  const bodyRadius = PIPE_RADIUS * 0.94;
  const lipRadius = PIPE_RADIUS * 1.16;
  const bodyHeight = 2.65;
  const lipHeight = 0.24;
  const bottomY = entryPosition.y + 1.08;
  const radialSegments = 40;

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyHeight, radialSegments, 1, true),
    pipeMat
  );
  body.position.set(entryPosition.x, bottomY + bodyHeight / 2, entryPosition.z);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const lip = new THREE.Mesh(
    new THREE.CylinderGeometry(lipRadius, lipRadius, lipHeight, radialSegments, 1, true),
    pipeMat
  );
  lip.position.set(entryPosition.x, bottomY + lipHeight / 2, entryPosition.z);
  lip.castShadow = true;
  lip.receiveShadow = true;
  group.add(lip);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(lipRadius, PIPE_WALL_THICKNESS * 0.62, 10, radialSegments),
    pipeMat
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(entryPosition.x, bottomY, entryPosition.z);
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_INNER_RADIUS * 0.9, PIPE_INNER_RADIUS * 0.9, 0.72, radialSegments, 1, true),
    innerMat
  );
  inner.position.set(entryPosition.x, bottomY + 0.34, entryPosition.z);
  inner.receiveShadow = true;
  group.add(inner);

  return group;
}

export function getPipeFittingStats(graph) {
  const stats = {
    pipeNodes: graph.nodes.size,
    junctionCorners: 0,
    junctionTees: 0,
    junctionCrosses: 0,
    junctionStraights: 0,
    junctionDeadEnds: 0,
    junctionOverfull: 0,
    renderedFittings: 0,
  };

  for (const id of graph.nodes.keys()) {
    const { type } = classifyPipeNode(graph, id);
    if (type === 'corner') stats.junctionCorners++;
    else if (type === 'tee') stats.junctionTees++;
    else if (type === 'cross') stats.junctionCrosses++;
    else if (type === 'straight') stats.junctionStraights++;
    else if (type === 'dead-end') stats.junctionDeadEnds++;
    else if (type === 'overfull') stats.junctionOverfull++;

    if (needsFitting(type)) stats.renderedFittings++;
  }

  return stats;
}

export function createPipeVisuals(graph) {
  preparePipeFrames(graph);

  const group = new THREE.Group();
  group.name = 'level1-pipes';

  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0x18a91d,
    roughness: 0.62,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const connectorMat = new THREE.MeshStandardMaterial({
    color: 0x18a91d,
    roughness: 0.62,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x0b5e18,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });

  for (const segment of graph.segments) {
    const cuts = {
      startCutSides: cutSidesForSegmentEndpoint(graph, segment.a, segment),
      endCutSides: cutSidesForSegmentEndpoint(graph, segment.b, segment),
    };
    const mesh = new THREE.Mesh(lowerHalfTubeGeometry(segment, PIPE_RADIUS, 18, cuts), pipeMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const inner = new THREE.Mesh(lowerHalfTubeGeometry(segment, PIPE_INNER_RADIUS, 14, cuts), innerMat);
    inner.receiveShadow = true;
    group.add(inner);

    for (const nodeId of [segment.a, segment.b]) {
      if (!shouldCapDeadEnd(graph, nodeId, segment)) continue;
      const cap = new THREE.Mesh(deadEndCapGeometry(segment, nodeId, PIPE_RADIUS), pipeMat);
      cap.castShadow = true;
      cap.receiveShadow = true;
      group.add(cap);
    }
  }

  for (const [id, node] of graph.nodes.entries()) {
    const { type, dirs } = classifyPipeNode(graph, id);
    if (!needsFitting(type)) continue;

    const mesh = new THREE.Mesh(cornerLowerHemisphereGeometry(node, dirs, PIPE_RADIUS), connectorMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const inner = new THREE.Mesh(cornerLowerHemisphereGeometry(node, dirs, PIPE_INNER_RADIUS), innerMat);
    inner.receiveShadow = true;
    group.add(inner);
  }

  group.add(createSpawnPipeVisual(graph.entryPosition, pipeMat, innerMat));

  return group;
}

export function particleWorldPosition(segment, s, u, v, out = new THREE.Vector3()) {
  return out.copy(segment.start)
    .addScaledVector(segment.dir, s)
    .addScaledVector(segment.side, u)
    .addScaledVector(segment.top, v);
}

export function clampRadial(u, v) {
  const maxRadius = PIPE_INNER_RADIUS - PARTICLE_RADIUS - BOUNDARY_SKIN;
  const dist = Math.hypot(u, v);
  if (dist <= maxRadius) return { u, v, clamped: false };
  const f = maxRadius / Math.max(dist, 0.0001);
  return { u: u * f, v: v * f, clamped: true };
}

export function randomLowerOffset(rng = Math.random) {
  const radius = (PIPE_INNER_RADIUS - PARTICLE_RADIUS - BOUNDARY_SKIN) * Math.sqrt(rng());
  const theta = Math.PI + Math.PI * rng();
  return {
    u: Math.cos(theta) * radius * 0.85,
    v: Math.sin(theta) * radius * 0.85,
  };
}

export function nearestPipePoint(graph, point) {
  let best = null;
  const tmp = new THREE.Vector3();
  const pointVec = new THREE.Vector3(point.x, point.y, point.z);

  for (const segment of graph.segments) {
    const rel = tmp.copy(pointVec).sub(segment.start);
    const s = THREE.MathUtils.clamp(rel.dot(segment.dir), 0, segment.length);
    const center = segment.start.clone().addScaledVector(segment.dir, s);
    const radial = pointVec.clone().sub(center);
    const u = radial.dot(segment.side);
    const v = radial.dot(segment.top);
    const radialDistance = Math.hypot(u, v);
    const outside = Math.max(0, radialDistance - (PIPE_INNER_RADIUS - PARTICLE_RADIUS));
    const score = outside + center.distanceTo(point) * 0.001;

    if (!best || score < best.score) {
      const clamped = clampRadial(u, v);
      best = {
        score,
        segment,
        s,
        u: clamped.u,
        v: clamped.v,
        outsideDistance: outside,
        position: particleWorldPosition(segment, s, clamped.u, clamped.v),
      };
    }
  }

  return best;
}
