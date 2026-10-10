import * as THREE from 'three';
import type { AssetRegistry } from '../../core/AssetRegistry';
import type { Collider, PhysicsWorld } from '../../core/PhysicsWorld';
import { removeOutlines, areOutlinesVisible } from '../../core/ToonMaterialFactory';
import { GameConfig } from '../../data/configs/gameConfig';
import type { LevelData, LevelObject, Phase } from './LevelSchema';

export interface RuntimeObject {
  def: LevelObject;
  root: THREE.Object3D;
  phase: Phase;
  collider: Collider | null;
  base: THREE.Vector3;
  size: THREE.Vector3;
  t: number;
  active: boolean;
  /** 炸藥桶重生倒數等狀態 */
  timer: number;
  materials: THREE.Material[];
}

const INTERACTION_ONLY = new Set(['phase_exchange', 'checkpoint', 'exit', 'enemy_trigger', 'tutorial', 'explosive', 'hazard']);

/** 依關卡資料建立場景、碰撞體、移動平台與物件狀態 */
export class LevelManager {
  data!: LevelData;
  objects: RuntimeObject[] = [];
  byId = new Map<string, RuntimeObject>();
  group = new THREE.Group();
  placeholderCount = 0;

  constructor(private scene: THREE.Scene, private registry: AssetRegistry, private physics: PhysicsWorld) {
    scene.add(this.group);
  }

  load(data: LevelData) {
    this.unload();
    this.data = data;
    for (const def of data.objects) this.spawnObject(def);
  }

  private spawnObject(def: LevelObject) {
    const size = new THREE.Vector3(...(def.size ?? [1, 1, 1]));
    const phase: Phase = def.phase ?? 'NEUTRAL';
    let root: THREE.Object3D;
    if (def.assetId.startsWith('__')) {
      root = new THREE.Group(); // 純觸發區，無視覺
    } else {
      const inst = this.registry.create(def.assetId, size, phase);
      if (inst.placeholder) this.placeholderCount++;
      root = inst.root;
    }
    root.position.set(...def.position);
    root.rotation.y = def.rotationY ?? 0;
    this.group.add(root);

    const hasCollider = def.collider ?? (!!def.size && !(def.interaction && INTERACTION_ONLY.has(def.interaction.type)));
    let collider: Collider | null = null;
    if (hasCollider) {
      const half = size.clone().multiplyScalar(0.5);
      collider = {
        id: def.id,
        min: new THREE.Vector3(...def.position).sub(half),
        max: new THREE.Vector3(...def.position).add(half),
        phase,
        enabled: true,
        conveyor: def.conveyor,
        delta: new THREE.Vector3(),
      };
      this.physics.add(collider);
    }
    const materials: THREE.Material[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.userData.isOutline) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => materials.push(x));
    });
    const ro: RuntimeObject = {
      def,
      root,
      phase,
      collider,
      base: new THREE.Vector3(...def.position),
      size,
      t: 0,
      active: true,
      timer: 0,
      materials,
    };
    this.objects.push(ro);
    this.byId.set(def.id, ro);
    return ro;
  }

  unload() {
    removeOutlines(this.group);
    this.group.clear();
    this.objects = [];
    this.byId.clear();
    this.physics.clear();
    this.placeholderCount = 0;
  }

  /** Boss 第三階段：翻轉地塊相位（重建視覺，碰撞體同步更新） */
  setObjectPhase(ro: RuntimeObject, phase: Phase) {
    const newAsset = phase === 'RED' ? 'floor_red' : phase === 'BLUE' ? 'floor_blue' : 'floor_neutral';
    removeOutlines(ro.root);
    this.group.remove(ro.root);
    const inst = this.registry.create(newAsset, ro.size, phase);
    inst.root.position.copy(ro.root.position);
    this.group.add(inst.root);
    ro.root = inst.root;
    ro.phase = phase;
    ro.materials = [];
    inst.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.userData.isOutline) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => ro.materials.push(x));
    });
    if (ro.collider) ro.collider.phase = phase;
  }

  setActive(ro: RuntimeObject, v: boolean) {
    ro.active = v;
    ro.root.visible = v;
    if (ro.collider) ro.collider.enabled = v;
  }

  /** 重置可破壞／可變狀態（重生時） */
  resetDynamic() {
    for (const ro of this.objects) {
      if (ro.def.interaction?.type === 'explosive') {
        ro.timer = 0;
        this.setActive(ro, true);
      }
    }
  }

  update(dt: number, time: number) {
    for (const ro of this.objects) {
      const m = ro.def.motion;
      if (m) {
        const prev = ro.root.position.clone();
        const off = Math.sin(time * m.speed + ro.base.x * 0.1) * m.amplitude;
        ro.root.position.copy(ro.base);
        ro.root.position[m.axis] += off;
        if (ro.collider) {
          const d = ro.root.position.clone().sub(prev);
          ro.collider.delta.copy(d);
          ro.collider.min.add(d);
          ro.collider.max.add(d);
        }
      }
      const ud = ro.root.userData;
      if (ud.symbol) (ud.symbol as THREE.Object3D).rotation.y += dt * 2;
      if (ud.portal) ((ud.portal as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(time * 4) * 0.2;
      if (ud.lava) ((ud.lava as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHSL(0.04 + Math.sin(time * 2) * 0.012, 0.9, 0.3);
      if (ud.arrows && ro.def.conveyor) {
        const arrows = ud.arrows as THREE.Group;
        const len = ro.size.z;
        arrows.children.forEach((a, i) => {
          const z0 = -len / 2 + (i + 0.5) * (len / arrows.children.length);
          a.position.z = ((z0 + len / 2 + time * Math.sign(ro.def.conveyor![1] || 1) * 1.5) % len + len) % len - len / 2;
          a.rotation.z = ro.def.conveyor![1] > 0 ? Math.PI / 2 * 3 : Math.PI / 2;
        });
      }
    }
  }

  /** 依玩家相位更新「幽影」外觀：異色物件半透明 */
  applyGhosting(playerPhase: Phase) {
    for (const ro of this.objects) {
      if (ro.phase === 'NEUTRAL') continue;
      const ghost = ro.phase !== playerPhase;
      const op = ghost ? GameConfig.phase.ghostOpacity : 1;
      for (const mat of ro.materials) {
        if (mat.userData.baseOpacity === undefined) mat.userData.baseOpacity = mat.opacity;
        const tr = ghost || mat.userData.baseOpacity < 1;
        if (mat.transparent !== tr) mat.needsUpdate = true;
        mat.transparent = tr;
        mat.opacity = (mat.userData.baseOpacity as number) * op;
        mat.depthWrite = !ghost;
      }
      ro.root.traverse((o) => {
        if (o.userData.isOutline) o.visible = !ghost && areOutlinesVisible();
      });
    }
  }
}
