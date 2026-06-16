import * as THREE from 'three';
import {
  LEVEL_COLS,
  LEVEL_ROWS,
  PIPE_TILE_SIZE,
  SLOPE_DROP_PER_ROW,
} from './constants.js';

export const DIRS = {
  N: { bit: 1, dc: 0, dr: -1, opposite: 'S' },
  E: { bit: 2, dc: 1, dr: 0, opposite: 'W' },
  S: { bit: 4, dc: 0, dr: 1, opposite: 'N' },
  W: { bit: 8, dc: -1, dr: 0, opposite: 'E' },
};

function hashSeed(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
}

export function createPipeSeed() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') return randomUUID.call(globalThis.crypto);

  const bytes = new Uint32Array(4);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 0xffffffff);
  }

  return [...bytes].map((value) => value.toString(16).padStart(8, '0')).join('-');
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function key(c, r) {
  return `${c},${r}`;
}

function edgeKey(a, b) {
  return [key(a.c, a.r), key(b.c, b.r)].sort().join('|');
}

function fromKey(k) {
  const [c, r] = k.split(',').map(Number);
  return { c, r };
}

function nodeId(c, r) {
  return `${c}:${r}`;
}

function nodePosition(c, r) {
  return new THREE.Vector3(
    (c - (LEVEL_COLS - 1) / 2) * PIPE_TILE_SIZE,
    1.15 - r * SLOPE_DROP_PER_ROW,
    (r - (LEVEL_ROWS - 1) / 2) * PIPE_TILE_SIZE
  );
}

function addEdge(cells, a, b) {
  const dc = b.c - a.c;
  const dr = b.r - a.r;
  const dir = Object.entries(DIRS).find(([, d]) => d.dc === dc && d.dr === dr)?.[0];
  if (!dir) return false;

  cells.set(key(a.c, a.r), (cells.get(key(a.c, a.r)) ?? 0) | DIRS[dir].bit);
  cells.set(key(b.c, b.r), (cells.get(key(b.c, b.r)) ?? 0) | DIRS[DIRS[dir].opposite].bit);
  return true;
}

function bitCount(mask) {
  let n = 0;
  for (const dir of Object.values(DIRS)) if (mask & dir.bit) n++;
  return n;
}

function hasEdge(cells, a, b) {
  const dc = b.c - a.c;
  const dr = b.r - a.r;
  const dir = Object.entries(DIRS).find(([, d]) => d.dc === dc && d.dr === dr)?.[0];
  return Boolean(dir && (cells.get(key(a.c, a.r)) ?? 0) & DIRS[dir].bit);
}

function tryAddEdge(cells, a, b, { allowMerge = false } = {}) {
  if (!inBounds(b.c, b.r)) return false;
  if (hasEdge(cells, a, b)) return true;

  const aMask = cells.get(key(a.c, a.r)) ?? 0;
  const bMask = cells.get(key(b.c, b.r)) ?? 0;
  const bOccupied = cells.has(key(b.c, b.r));

  // Treat occupied pipe cells as solid unless this branch is explicitly
  // merging into the chosen endpoint. This avoids visual overpasses.
  if (bOccupied && !allowMerge) return false;
  if (bitCount(aMask) >= 4 || bitCount(bMask) >= 4) return false;

  return addEdge(cells, a, b);
}

function inBounds(c, r) {
  return c >= 0 && c < LEVEL_COLS && r >= 0 && r < LEVEL_ROWS;
}

function randomDir(rng, biasDown = 0.45) {
  const roll = rng();
  if (roll < biasDown) return 'S';
  if (roll < biasDown + 0.25) return 'E';
  if (roll < biasDown + 0.5) return 'W';
  return 'N';
}

function shuffledDirs(primary, rng) {
  const dirs = ['S', 'E', 'W', 'N'].filter((d) => d !== primary);
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }
  return [primary, ...dirs];
}

function shuffledAllDirs(rng) {
  const dirs = ['S', 'E', 'W', 'N'];
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }
  return dirs;
}

function ensureFourWayJunction(cells, route, rng) {
  const candidates = [...route]
    .filter((cell) => cell.c > 0 && cell.c < LEVEL_COLS - 1 && cell.r > 0 && cell.r < LEVEL_ROWS - 1);

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (const base of candidates) {
    let guard = 0;
    while (bitCount(cells.get(key(base.c, base.r)) ?? 0) < 4 && guard++ < 4) {
      let added = false;
      const mask = cells.get(key(base.c, base.r)) ?? 0;

      for (const name of shuffledAllDirs(rng)) {
        if (mask & DIRS[name].bit) continue;
        const next = { c: base.c + DIRS[name].dc, r: base.r + DIRS[name].dr };
        if (!tryAddEdge(cells, base, next, { allowMerge: true })) continue;
        added = true;
        break;
      }

      if (!added) break;
    }

    if (bitCount(cells.get(key(base.c, base.r)) ?? 0) === 4) return true;
  }

  return false;
}

export function generatePipeGraph(seed = createPipeSeed()) {
  const rng = createRng(seed);
  const cells = new Map();
  const route = [];
  const mainEdges = new Set();

  let c = 2 + Math.floor(rng() * (LEVEL_COLS - 4));
  let r = 0;
  const entry = { c, r };
  cells.set(key(c, r), 0);
  route.push({ c, r });

  while (r < LEVEL_ROWS - 1) {
    const down = { c, r: r + 1 };
    const prev = { c, r };
    addEdge(cells, prev, down);
    mainEdges.add(edgeKey(prev, down));
    r = down.r;
    route.push({ c, r });

    const target = clamp(c + Math.floor(rng() * 3) - 1, 1, LEVEL_COLS - 2);
    while (c !== target) {
      const next = { c: c + Math.sign(target - c), r };
      const previous = { c, r };
      addEdge(cells, previous, next);
      mainEdges.add(edgeKey(previous, next));
      c = next.c;
      route.push({ c, r });
    }

  }

  const exit = { c, r };
  const branchCount = 18 + Math.floor(rng() * 11);
  for (let i = 0; i < branchCount; i++) {
    const start = route[Math.floor(rng() * route.length)];
    let bc = start.c;
    let br = start.r;
    const length = 3 + Math.floor(rng() * 6);
    const mergeTarget = rng() < 0.4 ? route[Math.floor(rng() * route.length)] : null;

    for (let j = 0; j < length; j++) {
      let dir = randomDir(rng, br < LEVEL_ROWS - 2 ? 0.35 : 0.1);
      if (mergeTarget && j > length / 2) {
        if (Math.abs(mergeTarget.c - bc) > Math.abs(mergeTarget.r - br)) {
          dir = mergeTarget.c > bc ? 'E' : 'W';
        } else {
          dir = mergeTarget.r > br ? 'S' : 'N';
        }
      }

      for (const candidate of shuffledDirs(dir, rng)) {
        const next = { c: bc + DIRS[candidate].dc, r: br + DIRS[candidate].dr };
        const allowMerge = Boolean(mergeTarget && next.c === mergeTarget.c && next.r === mergeTarget.r);
        if (!tryAddEdge(cells, { c: bc, r: br }, next, { allowMerge })) continue;
        bc = next.c;
        br = next.r;
        break;
      }
    }
  }

  ensureFourWayJunction(cells, route, rng);

  const nodes = new Map();
  const nodeSegments = new Map();
  const segmentByEdge = new Map();
  const segments = [];
  const seenEdges = new Set();

  function ensureNode(cn, rn) {
    const id = nodeId(cn, rn);
    if (!nodes.has(id)) nodes.set(id, { id, c: cn, r: rn, position: nodePosition(cn, rn) });
    if (!nodeSegments.has(id)) nodeSegments.set(id, []);
    return id;
  }

  for (const [cellKey, mask] of cells.entries()) {
    const cell = fromKey(cellKey);
    ensureNode(cell.c, cell.r);
    for (const [name, dir] of Object.entries(DIRS)) {
      if (!(mask & dir.bit)) continue;
      const other = { c: cell.c + dir.dc, r: cell.r + dir.dr };
      const segmentEdgeKey = edgeKey(cell, other);
      if (seenEdges.has(segmentEdgeKey) || !inBounds(other.c, other.r)) continue;
      seenEdges.add(segmentEdgeKey);

      const [from, to] = (
        other.r < cell.r || (other.r === cell.r && other.c < cell.c)
      )
        ? [other, cell]
        : [cell, other];
      const a = ensureNode(from.c, from.r);
      const b = ensureNode(to.c, to.r);
      const start = nodes.get(a).position.clone();
      const end = nodes.get(b).position.clone();
      const id = segments.length;
      const segment = { id, a, b, start, end, isDrain: false, isMain: mainEdges.has(segmentEdgeKey) };
      segments.push(segment);
      segmentByEdge.set(segmentEdgeKey, id);
      nodeSegments.get(a).push(id);
      nodeSegments.get(b).push(id);
    }
  }

  const exitNode = ensureNode(exit.c, exit.r);
  const drainStart = nodes.get(exitNode).position.clone();
  const drainEnd = nodePosition(exit.c, LEVEL_ROWS + 1);
  const drainNode = `drain:${exit.c}`;
  nodes.set(drainNode, { id: drainNode, c: exit.c, r: LEVEL_ROWS + 1, position: drainEnd });
  nodeSegments.set(drainNode, []);
  const drainSegment = { id: segments.length, a: exitNode, b: drainNode, start: drainStart, end: drainEnd, isDrain: true, isMain: true };
  segments.push(drainSegment);
  segmentByEdge.set(edgeKey(exit, { c: exit.c, r: LEVEL_ROWS + 1 }), drainSegment.id);
  nodeSegments.get(exitNode).push(drainSegment.id);
  nodeSegments.get(drainNode).push(drainSegment.id);

  for (const segment of segments) {
    segment.vector = segment.end.clone().sub(segment.start);
    segment.length = segment.vector.length();
    segment.dir = segment.vector.clone().normalize();
  }

  const entryNode = ensureNode(entry.c, entry.r);
  const primaryNextSegmentByNode = new Map();
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const segmentId = segmentByEdge.get(edgeKey(a, b));
    if (segmentId !== undefined) primaryNextSegmentByNode.set(nodeId(a.c, a.r), segmentId);
  }
  primaryNextSegmentByNode.set(exitNode, drainSegment.id);

  const entrySegmentId = (nodeSegments.get(entryNode) ?? [])
    .filter((id) => !segments[id].isDrain)
    .sort((a, b) => {
      const sa = segments[a].a === entryNode ? segments[a].end.y - segments[a].start.y : segments[a].start.y - segments[a].end.y;
      const sb = segments[b].a === entryNode ? segments[b].end.y - segments[b].start.y : segments[b].start.y - segments[b].end.y;
      return sa - sb;
    })[0] ?? 0;
  const entryPosition = nodes.get(entryNode).position.clone();

  return {
    seed,
    cells,
    nodes,
    nodeSegments,
    segments,
    entry,
    exit,
    entryNode,
    entrySegmentId,
    entryPosition,
    drainSegmentId: drainSegment.id,
    primaryNextSegmentByNode,
  };
}
