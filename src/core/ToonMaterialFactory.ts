import * as THREE from 'three';
import { GameConfig } from '../data/configs/gameConfig';

/**
 * 集中管理 Cel-Shading 材質與輪廓線。
 * - 3 階明暗 gradientMap
 * - 曲面網格：背面擴張法（inverted hull）
 * - Box 網格：EdgesGeometry 線段（避免平面法線擴張造成角落破口）
 */
let gradient: THREE.DataTexture | null = null;
function gradientMap() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([85, 165, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export interface ToonOpts {
  emissive?: number;
  emissiveIntensity?: number;
  map?: THREE.Texture | null;
  side?: THREE.Side;
}

export const ToonMaterialFactory = {
  make(color: number, o: ToonOpts = {}) {
    return new THREE.MeshToonMaterial({
      color,
      gradientMap: gradientMap(),
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 1,
      map: o.map ?? null,
      side: o.side ?? THREE.FrontSide,
    });
  },

  /** 將 GLB 內的 PBR 材質轉為 toon 材質；原始材質保留於 userData.originalMaterial 作為 fallback */
  convert(root: THREE.Object3D) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const conv = (src: THREE.Material) => {
        const s = src as THREE.MeshStandardMaterial;
        const t = new THREE.MeshToonMaterial({
          color: s.color ? s.color.clone() : new THREE.Color(0xffffff),
          map: s.map ?? null,
          gradientMap: gradientMap(),
          emissive: s.emissive ? s.emissive.clone() : new THREE.Color(0),
          emissiveMap: s.emissiveMap ?? null,
          transparent: s.transparent,
          opacity: s.opacity,
          side: s.side,
        });
        return t;
      };
      m.userData.originalMaterial = m.material;
      m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
      m.castShadow = true;
      m.receiveShadow = true;
    });
  },
};

const hullMats = new Map<number, THREE.MeshBasicMaterial>();
function hullMaterial(thickness: number) {
  const key = Math.round(thickness * 10000);
  let m = hullMats.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: GameConfig.colors.outline, side: THREE.BackSide });
    m.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n transformed += normalize(normal) * ${thickness.toFixed(5)};`,
      );
    };
    m.customProgramCacheKey = () => 'hull' + key;
    hullMats.set(key, m);
  }
  return m;
}
const edgeMat = new THREE.LineBasicMaterial({ color: GameConfig.colors.outline });

/** 所有輪廓物件，品質設定可整批開關 */
export const outlineObjects = new Set<THREE.Object3D>();
let outlinesVisible = true;
export function areOutlinesVisible() {
  return outlinesVisible;
}
export function setOutlinesVisible(v: boolean) {
  outlinesVisible = v;
  outlineObjects.forEach((o) => (o.visible = v));
}

/** 為物件加上輪廓。worldThickness 為世界座標下的描邊厚度 */
export function addOutlines(root: THREE.Object3D, worldThickness = 0.03) {
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.noOutline && !m.userData.isOutline) meshes.push(m);
  });
  const ws = new THREE.Vector3();
  for (const m of meshes) {
    let ol: THREE.Object3D;
    if (m.geometry.type === 'BoxGeometry') {
      ol = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), edgeMat);
    } else if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
      continue; // 骨架網格的 hull 需共用骨架，MVP 先略過
    } else {
      m.getWorldScale(ws);
      const s = Math.max(1e-4, (Math.abs(ws.x) + Math.abs(ws.y) + Math.abs(ws.z)) / 3);
      ol = new THREE.Mesh(m.geometry, hullMaterial(worldThickness / s));
    }
    ol.userData.isOutline = true;
    ol.raycast = () => {};
    ol.visible = outlinesVisible;
    m.add(ol);
    outlineObjects.add(ol);
  }
}

export function removeOutlines(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o.userData.isOutline) outlineObjects.delete(o);
  });
}
