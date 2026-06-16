import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const cache = new Map();

// Bake material colors into vertex colors so the same geometry can be used by
// instanced meshes without creating one draw call per material.
function bakeColors(mesh) {
  const out = [];
  const geom = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const groups = geom.groups?.length
    ? geom.groups
    : [{ start: 0, count: geom.attributes.position.count, materialIndex: 0 }];

  for (const g of groups) {
    const sub = new THREE.BufferGeometry();
    for (const name of ['position', 'normal']) {
      const attr = geom.attributes[name];
      if (!attr) continue;
      const arr = attr.array.slice(g.start * attr.itemSize, (g.start + g.count) * attr.itemSize);
      sub.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize));
    }

    const color = mats[g.materialIndex]?.color ?? new THREE.Color(0xffffff);
    const colors = new Float32Array(g.count * 3);
    for (let i = 0; i < g.count; i++) colors.set([color.r, color.g, color.b], i * 3);
    sub.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    out.push(sub);
  }

  return out;
}

export async function loadPoopGeometry({ lod = 1, height = 0.9 } = {}) {
  const key = `${lod}:${height}`;
  if (cache.has(key)) return cache.get(key);

  const name = `LOD${lod}emoji_poop`;
  const mtl = await new MTLLoader().setPath('assets/models/').loadAsync(`${name}.mtl`);
  mtl.preload();

  const obj = await new OBJLoader()
    .setMaterials(mtl)
    .setPath('assets/models/')
    .loadAsync(`${name}.obj`);

  const parts = [];
  obj.traverse((child) => { if (child.isMesh) parts.push(...bakeColors(child)); });
  const geom = mergeGeometries(parts);

  // Normalize: center on origin, rest base on y=0, scale to requested height.
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const scale = height / size.y;
  geom.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geom.scale(scale, scale, scale);
  geom.computeBoundingBox();

  const result = { geom, size: size.multiplyScalar(scale) };
  cache.set(key, result);
  return result;
}
