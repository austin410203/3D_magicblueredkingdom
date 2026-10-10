import * as THREE from 'three';
import { GameConfig } from '../data/configs/gameConfig';
import type { Phase } from '../gameplay/level/LevelSchema';

/**
 * 輕量 AABB 角色物理（取代 Rapier 的評估結果）：
 * 本遊戲的碰撞體皆為軸對齊方塊，且「依相位即時啟用／停用碰撞」是核心規則，
 * 自訂解算器能保證相位切換當幀即生效、不殘留碰撞體，並大幅縮小 bundle。
 */
export interface Collider {
  id: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
  phase: Phase;
  enabled: boolean;
  conveyor?: [number, number];
  /** 本幀位移（移動平台用，帶動站在上面的角色） */
  delta: THREE.Vector3;
}

export interface Body {
  pos: THREE.Vector3; // 腳底中心
  vel: THREE.Vector3;
  halfWidth: number;
  height: number;
  phase: Phase;
  onGround: boolean;
  ground: Collider | null;
  /** 寬限碰撞體：相位切換後短暫仍可承重 */
  graceCollider: Collider | null;
  gravityScale: number;
}

const EPS = 0.001;

export class PhysicsWorld {
  colliders: Collider[] = [];

  clear() {
    this.colliders = [];
  }

  add(c: Collider) {
    this.colliders.push(c);
  }

  /** 核心相位規則：中性或同色才有實體碰撞 */
  isSolidFor(c: Collider, b: { phase: Phase; graceCollider?: Collider | null }) {
    if (!c.enabled) return false;
    if (c.phase === 'NEUTRAL' || c.phase === b.phase) return true;
    return c === b.graceCollider;
  }

  step(b: Body, dt: number) {
    const cfg = GameConfig.player;
    // 移動平台帶動
    if (b.onGround && b.ground) b.pos.add(b.ground.delta);

    b.vel.y = Math.max(b.vel.y + cfg.gravity * b.gravityScale * dt, cfg.maxFallSpeed);

    b.pos.x += b.vel.x * dt;
    this.resolveHorizontal(b, 'x');
    b.pos.z += b.vel.z * dt;
    this.resolveHorizontal(b, 'z');

    const wasGround = b.ground;
    b.onGround = false;
    b.ground = null;
    b.pos.y += b.vel.y * dt;
    for (const c of this.colliders) {
      if (!this.isSolidFor(c, b) || !this.overlapXZ(b, c)) continue;
      if (b.pos.y < c.max.y && b.pos.y + b.height > c.min.y) {
        const prevBottom = b.pos.y - b.vel.y * dt;
        if (b.vel.y <= 0 && prevBottom >= c.max.y - 0.35 - (c === wasGround ? 0.2 : 0)) {
          b.pos.y = c.max.y;
          b.vel.y = 0;
          b.onGround = true;
          b.ground = c;
        } else if (b.vel.y > 0 && b.pos.y + b.height - b.vel.y * dt <= c.min.y + 0.05) {
          b.pos.y = c.min.y - b.height - EPS;
          b.vel.y = 0;
        }
      }
    }
    // 貼地：剛才在地面上、平台下降時保持接觸
    if (!b.onGround && wasGround && b.vel.y <= 0 && this.isSolidFor(wasGround, b) && this.overlapXZ(b, wasGround)) {
      const gap = b.pos.y - wasGround.max.y;
      if (gap > -0.05 && gap < 0.12) {
        b.pos.y = wasGround.max.y;
        b.vel.y = 0;
        b.onGround = true;
        b.ground = wasGround;
      }
    }
  }

  private overlapXZ(b: Body, c: Collider) {
    return (
      b.pos.x + b.halfWidth > c.min.x && b.pos.x - b.halfWidth < c.max.x &&
      b.pos.z + b.halfWidth > c.min.z && b.pos.z - b.halfWidth < c.max.z
    );
  }

  private resolveHorizontal(b: Body, axis: 'x' | 'z') {
    for (const c of this.colliders) {
      if (!this.isSolidFor(c, b)) continue;
      // 站立面不算水平阻擋
      if (!(b.pos.y + 0.05 < c.max.y && b.pos.y + b.height > c.min.y)) continue;
      if (!this.overlapXZ(b, c)) continue;
      const lo = b.pos[axis] + b.halfWidth - c.min[axis];
      const hi = c.max[axis] - (b.pos[axis] - b.halfWidth);
      // 低矮台階（< 0.3）自動踏上
      if (c.max.y - b.pos.y < 0.3 && b.onGround) {
        b.pos.y = c.max.y;
        continue;
      }
      if (lo < hi) b.pos[axis] -= lo + EPS;
      else b.pos[axis] += hi + EPS;
      b.vel[axis] = 0;
    }
  }

  /** 查詢某點下方對指定相位而言是否有可站立地面（敵人路徑檢查用） */
  groundBelow(x: number, z: number, y: number, phase: Phase, depth = 1.5): Collider | null {
    for (const c of this.colliders) {
      if (!this.isSolidFor(c, { phase })) continue;
      if (x > c.min.x && x < c.max.x && z > c.min.z && z < c.max.z && c.max.y <= y + 0.4 && c.max.y >= y - depth) return c;
    }
    return null;
  }

  /** 某點是否被實體擋住（敵人避障用） */
  blocked(x: number, z: number, y: number, h: number, phase: Phase, r: number) {
    for (const c of this.colliders) {
      if (!this.isSolidFor(c, { phase })) continue;
      if (c.max.y - y < 0.3) continue;
      if (y + h <= c.min.y) continue;
      if (x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z) return true;
    }
    return false;
  }
}
