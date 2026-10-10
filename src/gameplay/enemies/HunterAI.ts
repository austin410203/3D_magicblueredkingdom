import * as THREE from 'three';
import { GameConfig } from '../../data/configs/gameConfig';
import type { Body, PhysicsWorld } from '../../core/PhysicsWorld';
import type { AssetInstance } from '../../core/AssetRegistry';
import type { Phase } from '../level/LevelSchema';

export type HunterState = 'INACTIVE' | 'IDLE' | 'ALERT' | 'CHASE' | 'OBSTACLE_AVOID' | 'SEARCH' | 'RETURN' | 'DESPAWN';

/**
 * 巡色者：狀態機 IDLE → ALERT → CHASE → OBSTACLE_AVOID → SEARCH → RETURN/DESPAWN。
 * 遵守與玩家相同的相位碰撞規則：只能走在同色或中性地面上；
 * 前方無法承重時會停下或繞路，因此玩家可以利用異色路線甩開它。
 */
export class HunterAI {
  body: Body;
  root = new THREE.Group();
  state: HunterState = 'INACTIVE';
  private t = 0;
  private memory = 0;
  private time = 0;
  private lastSeen = new THREE.Vector3();
  private dir = new THREE.Vector3();
  onAlert?: () => void;

  constructor(public id: string, asset: AssetInstance, public home: THREE.Vector3, phase: Phase) {
    this.root.add(asset.root);
    this.body = {
      pos: home.clone(),
      vel: new THREE.Vector3(),
      halfWidth: 0.42,
      height: 1.2,
      phase,
      onGround: false,
      ground: null,
      graceCollider: null,
      gravityScale: 1,
    };
    const band = asset.root.userData.band as THREE.Mesh | undefined;
    if (band) ((band.material as THREE.MeshToonMaterial).emissive as THREE.Color).setHex(phase === 'RED' ? GameConfig.colors.RED : GameConfig.colors.BLUE);
    this.root.visible = false;
  }

  activate() {
    if (this.state !== 'INACTIVE' && this.state !== 'DESPAWN') return;
    this.body.pos.copy(this.home);
    this.body.vel.set(0, 0, 0);
    this.state = 'IDLE';
    this.root.visible = true;
  }

  deactivate() {
    this.state = 'INACTIVE';
    this.root.visible = false;
  }

  /** 回傳 true 代表抓到玩家 */
  update(dt: number, playerPos: THREE.Vector3, physics: PhysicsWorld): boolean {
    if (this.state === 'INACTIVE') return false;
    const cfg = GameConfig.hunter;
    const b = this.body;
    this.time += dt;
    if (this.state === 'DESPAWN') {
      this.t -= dt;
      if (this.t <= 0) this.activate();
      return false;
    }
    const toP = new THREE.Vector3(playerPos.x - b.pos.x, 0, playerPos.z - b.pos.z);
    const dist = toP.length();
    const canSee = dist < cfg.sightRange && Math.abs(playerPos.y - b.pos.y) < 4;
    let target: THREE.Vector3 | null = null;
    let speed = cfg.speed;

    switch (this.state) {
      case 'IDLE':
        if (canSee) {
          this.state = 'ALERT';
          this.t = cfg.alertTime;
          this.onAlert?.();
        }
        break;
      case 'ALERT':
        this.t -= dt;
        if (this.t <= 0) {
          this.state = 'CHASE';
          this.memory = cfg.chaseMemory;
        }
        break;
      case 'CHASE':
      case 'OBSTACLE_AVOID':
        if (canSee) {
          this.lastSeen.copy(playerPos);
          this.memory = cfg.chaseMemory;
        } else this.memory -= dt;
        if (this.memory <= 0) {
          this.state = 'SEARCH';
          this.t = 2;
        }
        target = this.lastSeen;
        break;
      case 'SEARCH':
        this.t -= dt;
        speed *= 0.4;
        target = this.lastSeen.clone().add(new THREE.Vector3(Math.sin(this.time * 2) * 2, 0, Math.cos(this.time * 2) * 2));
        if (canSee) {
          this.state = 'CHASE';
          this.memory = cfg.chaseMemory;
        } else if (this.t <= 0) this.state = 'RETURN';
        break;
      case 'RETURN':
        target = this.home;
        speed *= 0.6;
        if (canSee) this.state = 'ALERT';
        else if (b.pos.distanceTo(this.home) < 0.8) this.state = 'IDLE';
        break;
    }

    let vx = 0;
    let vz = 0;
    if (target) {
      const d = new THREE.Vector3(target.x - b.pos.x, 0, target.z - b.pos.z);
      if (d.lengthSq() > 0.04) {
        d.normalize();
        // 嘗試直行，否則左右偏轉繞路；前方必須是自己相位可站立的地面
        const tries = [0, 0.7, -0.7, 1.4, -1.4];
        let ok: THREE.Vector3 | null = null;
        for (const a of tries) {
          const dd = d.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
          const ahead = b.pos.clone().addScaledVector(dd, 0.8);
          if (physics.groundBelow(ahead.x, ahead.z, b.pos.y, b.phase) && !physics.blocked(ahead.x, ahead.z, b.pos.y, b.height, b.phase, 0.35)) {
            ok = dd;
            break;
          }
        }
        if (this.state === 'CHASE' || this.state === 'OBSTACLE_AVOID') this.state = ok && ok.dot(d) > 0.99 ? 'CHASE' : 'OBSTACLE_AVOID';
        if (ok) {
          this.dir.lerp(ok, Math.min(1, dt * 8));
          vx = this.dir.x * speed;
          vz = this.dir.z * speed;
        }
      }
    }
    b.vel.x = vx;
    b.vel.z = vz;
    physics.step(b, dt);

    if (b.pos.y < GameConfig.world.killY) {
      this.state = 'DESPAWN';
      this.root.visible = false;
      this.t = cfg.respawnDelay;
      return false;
    }

    // 視覺
    this.root.position.copy(b.pos);
    if (Math.abs(vx) + Math.abs(vz) > 0.1) this.root.rotation.y = Math.atan2(vx, vz);
    const model = this.root.children[0];
    model.position.y = Math.abs(Math.sin(this.time * 12)) * 0.08;
    const eye = model.userData.eye as THREE.Mesh | undefined;
    if (eye) {
      const alert = this.state === 'ALERT' || this.state === 'CHASE';
      (eye.material as THREE.MeshToonMaterial).emissiveIntensity = alert ? 2 + Math.sin(this.time * 20) : 0.8;
    }

    const caught =
      (this.state === 'CHASE' || this.state === 'OBSTACLE_AVOID') &&
      dist < cfg.catchDistance + 0.3 &&
      Math.abs(playerPos.y - b.pos.y) < 1;
    return caught;
  }
}
