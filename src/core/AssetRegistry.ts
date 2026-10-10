import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AssetManifest, type AssetDef } from './AssetManifest';
import { buildPlaceholder } from './Placeholders';
import { ToonMaterialFactory, addOutlines } from './ToonMaterialFactory';
import type { Phase } from '../gameplay/level/LevelSchema';

export interface AssetInstance {
  root: THREE.Object3D;
  /** 是否為程式化佔位模型 */
  placeholder: boolean;
  /** GLB 內附動畫（以遊戲內別名為 key） */
  clips: Map<string, THREE.AnimationClip>;
}

export interface LoadReport {
  loaded: string[];
  missing: string[];
  failed: { id: string; error: string }[];
}

/**
 * 以穩定 ID 載入／建立資產。遊戲邏輯只依賴 assetId，
 * 不依賴 GLB 的 mesh 名稱、材質名稱或內部階層。
 */
export class AssetRegistry {
  private gltfs = new Map<string, GLTF>();
  private loader = new GLTFLoader();
  report: LoadReport = { loaded: [], missing: [], failed: [] };

  async preload(onProgress?: (done: number, total: number) => void) {
    const defs = Object.values(AssetManifest).filter((d) => d.path);
    let done = 0;
    await Promise.all(
      defs.map(async (d) => {
        try {
          const exists = await this.exists(d.path!);
          if (!exists) {
            this.report.missing.push(d.id);
          } else {
            const g = await this.loader.loadAsync(d.path!);
            this.gltfs.set(d.id, g);
            this.report.loaded.push(d.id);
          }
        } catch (e) {
          this.report.failed.push({ id: d.id, error: String((e as Error)?.message ?? e) });
          console.error(`[AssetRegistry] GLB 載入失敗：${d.id} (${d.path})`, e);
        } finally {
          onProgress?.(++done, defs.length);
        }
      }),
    );
    if (this.report.missing.length) console.info('[AssetRegistry] 未提供 GLB，改用佔位模型：', this.report.missing.join(', '));
  }

  /** 以 HEAD 檢查檔案是否存在；避免開發伺服器 SPA fallback 回傳 index.html */
  private async exists(path: string) {
    try {
      const r = await fetch(path, { method: 'HEAD' });
      if (!r.ok) return false;
      const ct = r.headers.get('content-type') ?? '';
      return !ct.includes('text/html');
    } catch {
      return false;
    }
  }

  create(assetId: string, size: THREE.Vector3 = new THREE.Vector3(1, 1, 1), phase: Phase = 'NEUTRAL', outline = 0.03): AssetInstance {
    const def: AssetDef | undefined = AssetManifest[assetId];
    const gltf = this.gltfs.get(assetId);
    const clips = new Map<string, THREE.AnimationClip>();
    let root: THREE.Object3D;
    let placeholder = false;

    if (gltf && def) {
      const model = SkeletonUtils.clone(gltf.scene);
      ToonMaterialFactory.convert(model);
      const holder = new THREE.Group();
      holder.add(model);
      model.rotation.y = def.rotationY ?? 0;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const bs = box.getSize(new THREE.Vector3());
      const bc = box.getCenter(new THREE.Vector3());
      if (def.fit === 'size') {
        model.scale.set(size.x / Math.max(bs.x, 1e-3), size.y / Math.max(bs.y, 1e-3), size.z / Math.max(bs.z, 1e-3));
        model.position.set(-bc.x * model.scale.x, -bc.y * model.scale.y, -bc.z * model.scale.z);
      } else {
        const s = (def.height ?? 1) / Math.max(bs.y, 1e-3);
        model.scale.setScalar(s);
        model.position.set(-bc.x * s, -box.min.y * s, -bc.z * s);
      }
      const alias = def.animations ?? {};
      for (const clip of gltf.animations) {
        const gameName = Object.keys(alias).find((k) => alias[k] === clip.name) ?? clip.name;
        clips.set(gameName, clip);
      }
      root = holder;
    } else {
      root = buildPlaceholder(assetId, size, phase);
      placeholder = true;
    }
    root.userData.assetId = assetId;
    if (outline > 0) addOutlines(root, outline);
    return { root, placeholder, clips };
  }
}
