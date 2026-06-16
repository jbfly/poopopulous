import * as THREE from 'three';
import { PIPE_TILE_SIZE } from './constants.js';

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 512;
const SIGN_WIDTH = 4.25;
const SIGN_HEIGHT = 1.96;
const SIGN_LIFT = 1.78;

function arrowPoints(direction = 1) {
  const points = [
    [70, 150],
    [650, 150],
    [650, 78],
    [958, 256],
    [650, 434],
    [650, 362],
    [70, 362],
  ];

  if (direction === 1) return points;
  return points.map(([x, y]) => [CANVAS_WIDTH - x, y]);
}

function tracePolygon(ctx, points, inset = 0) {
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const len = Math.max(Math.hypot(dx, dy), 0.0001);
    const px = x - (dx / len) * inset;
    const py = y - (dy / len) * inset;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

function drawBulb(ctx, x, y, size, phase) {
  const glow = ctx.createRadialGradient(x, y, 1, x, y, size * 2.2);
  glow.addColorStop(0, 'rgba(255, 252, 209, 0.88)');
  glow.addColorStop(0.35, 'rgba(255, 184, 74, 0.42)');
  glow.addColorStop(1, 'rgba(255, 128, 20, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, size * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = phase % 2 === 0 ? '#fff6b7' : '#ffd27a';
  ctx.strokeStyle = '#8e2e13';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawBulbs(ctx, points) {
  let phase = 0;
  const spacing = 43;

  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const length = Math.hypot(x2 - x1, y2 - y1);
    const count = Math.max(1, Math.floor(length / spacing));

    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count;
      drawBulb(ctx, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 10, phase++);
    }
  }
}

function fitText(ctx, text, maxWidth, startSize, weight = '800') {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 4;
  } while (size > 22);

  return size;
}

function drawSignFace(ctx, drainedParticles, direction = 1) {
  const points = arrowPoints(direction);
  const populationText = `Poopulation ${Math.floor(drainedParticles).toLocaleString()}`;
  const textX = direction === 1 ? 390 : CANVAS_WIDTH - 390;

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 12;
  ctx.shadowOffsetY = 16;
  tracePolygon(ctx, points);
  ctx.fillStyle = '#7a1f18';
  ctx.fill();
  ctx.restore();

  tracePolygon(ctx, points);
  ctx.fillStyle = '#b52a1d';
  ctx.fill();

  tracePolygon(ctx, points, 28);
  ctx.fillStyle = '#fff3c7';
  ctx.fill();

  tracePolygon(ctx, points, 52);
  ctx.fillStyle = '#107aa4';
  ctx.fill();

  ctx.save();
  tracePolygon(ctx, points, 52);
  ctx.clip();
  const stripe = ctx.createLinearGradient(0, 100, 0, 420);
  stripe.addColorStop(0, 'rgba(255,255,255,0.18)');
  stripe.addColorStop(0.5, 'rgba(255,255,255,0)');
  stripe.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();

  drawBulbs(ctx, points);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const titleSize = fitText(ctx, 'Poopopulous', 590, 86, '900');
  ctx.font = `900 ${titleSize}px Arial Black, Arial, Helvetica, sans-serif`;
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#7b241b';
  ctx.strokeText('Poopopulous', textX, 226);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('Poopopulous', textX, 226);

  const lineSize = fitText(ctx, populationText, 470, 46, '800');
  ctx.font = `800 ${lineSize}px Arial, Helvetica, sans-serif`;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#7b241b';
  ctx.strokeText(populationText, textX, 306);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(populationText, textX, 306);
}

function drainDirection(graph) {
  const drain = graph.segments[graph.drainSegmentId];
  const direction = drain.end.clone().sub(drain.start);
  direction.y = 0;
  if (direction.lengthSq() < 0.0001) direction.set(0, 0, 1);
  return direction.normalize();
}

export function createExitSign(graph) {
  const createFace = (direction) => {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.FrontSide,
      toneMapped: false,
    });
    return {
      canvas,
      ctx,
      texture,
      material,
      mesh: new THREE.Mesh(new THREE.PlaneGeometry(SIGN_WIDTH, SIGN_HEIGHT), material),
      direction,
    };
  };

  const front = createFace(1);
  const back = createFace(-1);
  front.mesh.position.z = 0.025;
  back.mesh.position.z = -0.025;
  back.mesh.rotation.y = Math.PI;

  front.mesh.renderOrder = 8;
  back.mesh.renderOrder = 8;

  const postMat = new THREE.MeshStandardMaterial({
    color: 0x2a2523,
    roughness: 0.55,
    metalness: 0.4,
  });
  const postGeom = new THREE.CylinderGeometry(0.028, 0.04, 2.08, 10);

  const group = new THREE.Group();
  group.name = 'poopopulous-exit-sign';
  group.add(front.mesh, back.mesh);

  for (const x of [-1.28, 1.28]) {
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.set(x, -1.44, -0.04);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  }

  const glow = new THREE.PointLight(0xffb14f, 1.2, 4.5, 1.8);
  glow.position.set(0.15, 0.08, 0.22);
  group.add(glow);

  const drain = graph.segments[graph.drainSegmentId];
  const dir = drainDirection(graph);
  const xAxis = dir;
  const yAxis = new THREE.Vector3(0, 1, 0);
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
  const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  group.quaternion.setFromRotationMatrix(basis);
  group.position.copy(drain.start)
    .addScaledVector(dir, PIPE_TILE_SIZE * 1.08)
    .addScaledVector(yAxis, SIGN_LIFT);

  let lastDrained = -1;
  let text = '';

  function update(drainedParticles) {
    const next = Math.floor(drainedParticles);
    if (next === lastDrained) return;
    lastDrained = next;
    text = `Poopulation ${next.toLocaleString()}`;
    for (const face of [front, back]) {
      drawSignFace(face.ctx, next, face.direction);
      face.texture.needsUpdate = true;
    }
  }

  function dispose() {
    for (const face of [front, back]) {
      face.mesh.geometry.dispose();
      face.material.dispose();
      face.texture.dispose();
    }
    postGeom.dispose();
    postMat.dispose();
  }

  update(0);

  return {
    group,
    update,
    dispose,
    get text() { return text; },
    get poopulation() { return lastDrained; },
  };
}
