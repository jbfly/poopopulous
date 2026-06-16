import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const GRID_SIZE = 16;   // tiles per side
export const TILE_SIZE = 1;    // world units per tile

// Isometric scene: ortho camera on the classic diagonal, a tile grid floor,
// and a hover highlight as a nod to v1's glowing cells.
export function createWorld(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1423);
  scene.fog = new THREE.Fog(0x1a1423, 40, 90);

  const aspect = window.innerWidth / window.innerHeight;
  const viewSize = 14;
  const camera = new THREE.OrthographicCamera(
    -viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 200
  );
  camera.position.set(20, 20, 20);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.minZoom = 0.4;
  controls.maxZoom = 4;

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(12, 25, 8);
  sun.castShadow = true;
  sun.shadow.camera.left = -15;
  sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -15;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const half = (GRID_SIZE * TILE_SIZE) / 2;
  const splashGroup = new THREE.Group();
  scene.add(splashGroup);

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(GRID_SIZE * TILE_SIZE, 1, GRID_SIZE * TILE_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x7a9e60, roughness: 1 })
  );
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  splashGroup.add(ground);

  const grid = new THREE.GridHelper(GRID_SIZE * TILE_SIZE, GRID_SIZE, 0x33502a, 0x4f7240);
  grid.position.y = 0.005;
  splashGroup.add(grid);

  // Hover highlight tile
  const highlight = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE),
    new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.35 })
  );
  highlight.rotation.x = -Math.PI / 2;
  highlight.position.y = 0.01;
  highlight.visible = false;
  splashGroup.add(highlight);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  window.addEventListener('pointermove', (e) => {
    if (!splashGroup.visible) {
      highlight.visible = false;
      return;
    }

    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(ground)[0];
    if (hit && Math.abs(hit.point.x) < half && Math.abs(hit.point.z) < half) {
      const tx = Math.floor(hit.point.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      const tz = Math.floor(hit.point.z / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      highlight.position.set(tx, 0.01, tz);
      highlight.visible = true;
    } else {
      highlight.visible = false;
    }
  });

  window.addEventListener('resize', () => {
    const a = window.innerWidth / window.innerHeight;
    camera.left = -viewSize * a;
    camera.right = viewSize * a;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // v1 tribute: +/- zoom buttons
  const zoomBy = (f) => {
    camera.zoom = THREE.MathUtils.clamp(camera.zoom * f, controls.minZoom, controls.maxZoom);
    camera.updateProjectionMatrix();
  };
  document.getElementById('zoomInButton').addEventListener('click', () => zoomBy(1.2));
  document.getElementById('zoomOutButton').addEventListener('click', () => zoomBy(1 / 1.2));

  function setSplashVisible(visible) {
    splashGroup.visible = visible;
    if (!visible) highlight.visible = false;
  }

  function setCameraHome({ position = [20, 20, 20], target = [0, 0, 0], zoom = 1 } = {}) {
    camera.position.set(...position);
    controls.target.set(...target);
    camera.zoom = zoom;
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
  }

  return { scene, splashGroup, camera, renderer, controls, setSplashVisible, setCameraHome };
}
