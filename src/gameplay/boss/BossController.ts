import * as THREE from 'three';
import { GameConfig } from '../../data/configs/gameConfig';
import { ToonMaterialFactory, addOutlines } from '../../core/ToonMaterialFactory';
import type { AssetInstance } from '../../core/AssetRegistry';
import type { Phase } from '../level/LevelSchema';

export type BossState = 'INTRO' | 'IDLE' | 'TELEGRAPH' | 'SLAM' | 'RECOVER' | 'STAGGER' | 'ENRAGE' | 'DEAD';

export interface BossHooks {
  /** 重拳落地：回傳是否命中同色炸藥桶 */
  onImpact(pos: THREE.Vector3, phase: Phase): boolean;
  onBanner(text: string, phase: Phase | null): void;
  onHp(hp: number, max: number): void;
  onStageChange(stage: number): void;
  onFlipTiles(): void;
  onDefeated(): void;
}

/**
 * 雙相監工：預備（顏色提示目標相位）→ 重拳 → 硬直；
 * 重拳命中同色炸藥桶時爆炸造成傷害 → 受傷踉蹌。三階段逐步加速，第三階段翻轉場地相位。
 * 重拳／標記由程式建立，與 boss_foreman.glb 分離，替換模型不影響戰鬥邏輯。
 */
export class BossController {
  root = new THREE.Group();
  hp: number;
  max: number;
  state: BossState = 'INTRO';
  stage = 1;
  attackPhase: Phase = 'RED';
  private t = 1.5;
  private time = 0;
  private slams = 0;
  private target = new THREE.Vector3();
  private fist: THREE.Mesh;
  private fistMat: THREE.MeshToonMaterial;
  private marker: THREE.Mesh;
  private markerMat: THREE.MeshBasicMaterial;
  private fistHome: THREE.Vector3;
  private model: THREE.Object3D;
  private hitFlash = 0;

  constructor(asset: AssetInstance, public position: THREE.Vector3, private scene: THREE.Scene, private hooks: BossHooks) {
    this.max = this.hp = GameConfig.boss.hp;
    this.model = asset.root;
    this.root.add(this.model);
    this.root.position.copy(position);
    scene.add(this.root);

    this.fistMat = ToonMaterialFactory.make(0x8a5a3a, { emissive: GameConfig.colors.RED, emissiveIntensity: 0.6 });
    this.fist = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), this.fistMat);
    this.fist.castShadow = true;
    addOutlines(this.fist, 0.05);
    this.fistHome = position.clone().add(new THREE.Vector3(3.2, 2.8, 1.5));
    this.fist.position.copy(this.fistHome);
    scene.add(this.fist);

    this.markerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    this.marker = new THREE.Mesh(new THREE.RingGeometry(GameConfig.boss.slamRadius - 0.25, GameConfig.boss.slamRadius, 40), this.markerMat);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    scene.add(this.marker);
    hooks.onHp(this.hp, this.max);
  }

  dispose() {
    this.scene.remove(this.root, this.fist, this.marker);
  }

  private stageIndex() {
    return Math.min(2, this.stage - 1);
  }

  private pickPhase() {
    if (this.stage === 1) return 'RED' as Phase; // 第一階段：單一紅桶教學
    return Math.random() < 0.5 ? ('RED' as Phase) : ('BLUE' as Phase);
  }

  update(dt: number, playerPos: THREE.Vector3, playerAlive: boolean) {
    const cfg = GameConfig.boss;
    this.time += dt;
    this.t -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);

    // 待機擺動與面向玩家
    const look = Math.atan2(playerPos.x - this.position.x, playerPos.z - this.position.z);
    this.root.rotation.y += (look - this.root.rotation.y) * Math.min(1, dt * 2);
    this.model.position.y = Math.sin(this.time * 1.5) * 0.15;
    const core = this.model.userData.core as THREE.Mesh | undefined;
    const visor = this.model.userData.visor as THREE.Mesh | undefined;
    const atkCol = this.attackPhase === 'RED' ? GameConfig.colors.RED : GameConfig.colors.BLUE;

    switch (this.state) {
      case 'INTRO':
        if (this.t <= 0) {
          this.state = 'IDLE';
          this.t = 0.6;
          this.hooks.onBanner('雙相監工啟動！觀察拳頭顏色，把重拳引到同色炸藥桶旁！', null);
        }
        break;
      case 'IDLE':
        this.fist.position.lerp(this.fistHome, Math.min(1, dt * 4));
        if (this.t <= 0 && playerAlive) {
          this.state = 'TELEGRAPH';
          this.attackPhase = this.pickPhase();
          this.t = cfg.telegraphByStage[this.stageIndex()];
          this.target.copy(playerPos);
          this.marker.visible = true;
          const name = this.attackPhase === 'RED' ? '紅色 ▲' : '藍色 ◆';
          this.hooks.onBanner(`監工蓄力：${name} 重拳！引導至${this.attackPhase === 'RED' ? '紅色' : '藍色'}炸藥桶`, this.attackPhase);
        }
        break;
      case 'TELEGRAPH': {
        const total = cfg.telegraphByStage[this.stageIndex()];
        const progress = 1 - this.t / total;
        if (progress < cfg.trackRatio) this.target.lerp(new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z), Math.min(1, dt * 6));
        this.marker.position.set(this.target.x, this.target.y + 0.05, this.target.z);
        this.markerMat.color.setHex(atkCol);
        this.markerMat.opacity = 0.35 + 0.5 * Math.abs(Math.sin(this.time * (8 + progress * 14)));
        this.marker.scale.setScalar(1 + (1 - progress) * 0.4);
        this.fistMat.emissive.setHex(atkCol);
        this.fistMat.emissiveIntensity = 0.6 + progress * 1.4;
        const hover = this.target.clone().add(new THREE.Vector3(0, 6, 0));
        this.fist.position.lerp(hover, Math.min(1, dt * 5));
        if (this.t <= 0) {
          this.state = 'SLAM';
          this.t = cfg.slamTime;
        }
        break;
      }
      case 'SLAM': {
        const k = 1 - Math.max(0, this.t) / cfg.slamTime;
        this.fist.position.set(this.target.x, this.target.y + 6 * (1 - k * k) + 0.7, this.target.z);
        if (this.t <= 0) {
          this.marker.visible = false;
          this.slams++;
          const hit = this.hooks.onImpact(this.target.clone(), this.attackPhase);
          if (hit) this.damage();
          else {
            this.state = 'RECOVER';
            this.t = cfg.recoverTime;
          }
          if (this.stage === 3 && this.slams % cfg.tileFlipEvery === 0 && this.hp > 0) this.hooks.onFlipTiles();
        }
        break;
      }
      case 'RECOVER':
        if (this.t <= 0) {
          this.state = 'IDLE';
          this.t = 0.5;
        }
        break;
      case 'STAGGER':
        this.root.rotation.z = Math.sin(this.time * 30) * 0.04 * (this.t / cfg.staggerTime);
        this.fist.position.lerp(this.fistHome, Math.min(1, dt * 3));
        if (this.t <= 0) {
          this.root.rotation.z = 0;
          this.state = 'IDLE';
          this.t = 0.4;
        }
        break;
      case 'DEAD':
        this.root.rotation.x = Math.min(0.5, this.root.rotation.x + dt * 0.4);
        this.root.position.y = Math.max(this.position.y - 2, this.root.position.y - dt * 1.2);
        this.fist.position.y = Math.max(-3, this.fist.position.y - dt * 4);
        break;
    }

    if (core) {
      const m = core.material as THREE.MeshToonMaterial;
      m.emissive.setHex(this.state === 'DEAD' ? 0x222222 : this.hitFlash > 0 ? 0xffffff : this.state === 'TELEGRAPH' ? atkCol : 0xaa66ff);
      m.emissiveIntensity = this.state === 'DEAD' ? 0.1 : 1.4 + this.hitFlash * 2;
    }
    if (visor) (visor.material as THREE.MeshToonMaterial).emissive.setHex(this.state === 'TELEGRAPH' ? atkCol : 0xff4060);
  }

  /** 玩家觸發模式時由外部呼叫；亦用於重拳命中炸藥桶 */
  damage() {
    if (this.state === 'DEAD') return;
    this.hp--;
    this.hitFlash = 1;
    this.hooks.onHp(this.hp, this.max);
    if (this.hp <= 0) {
      this.state = 'DEAD';
      this.marker.visible = false;
      this.hooks.onBanner('雙相監工的核心熄滅了！', null);
      this.hooks.onDefeated();
      return;
    }
    const newStage = this.hp > this.max * (2 / 3) ? 1 : this.hp > this.max / 3 ? 2 : 3;
    if (newStage !== this.stage) {
      this.stage = newStage;
      this.hooks.onStageChange(newStage);
      this.hooks.onBanner(newStage === 2 ? '第二階段：紅藍拳交替！看清顏色！' : '最終階段：監工暴走，場地相位將會翻轉！', null);
    }
    this.state = 'STAGGER';
    this.t = GameConfig.boss.staggerTime;
  }
}
