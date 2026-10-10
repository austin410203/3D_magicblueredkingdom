import { GameConfig } from '../../data/configs/gameConfig';
import type { EventBus } from '../../app/EventBus';
import type { PhysicsWorld } from '../../core/PhysicsWorld';
import type { PlayerController } from '../player/PlayerController';
import type { LevelManager } from '../level/LevelManager';
import type { Phase } from '../level/LevelSchema';

/**
 * 管理角色相位、交換規則、冷卻、寬限時間與外觀同步。
 * 規則：只有接觸「與自己不同相位」的可交換物件，才會切換成該物件的相位。
 */
export class PhaseSystem {
  cooldown = 0;
  private graceT = 0;

  constructor(private bus: EventBus, private physics: PhysicsWorld, private level: LevelManager) {}

  reset(player: PlayerController, phase: Phase) {
    player.body.phase = phase;
    player.body.graceCollider = null;
    this.cooldown = 0;
    this.graceT = 0;
    player.applyPhaseVisual(phase);
    this.level.applyGhosting(phase);
  }

  /** 嘗試交換到 target 相位；回傳是否成功 */
  trySwap(player: PlayerController, target: Phase): boolean {
    if (target === 'NEUTRAL') return false;
    if (this.cooldown > 0) return false;
    if (target === player.phase) {
      this.bus.emit('swapFailed', { reason: '與物件相位相同，無法交換' });
      return false;
    }
    const b = player.body;
    // 寬限：腳下平台將變為異色時，延遲 0.15 秒才失去承重
    if (b.onGround && b.ground && b.ground.phase !== 'NEUTRAL' && b.ground.phase !== target) {
      b.graceCollider = b.ground;
      this.graceT = GameConfig.phase.groundGrace;
      this.bus.emit('warning', { text: '腳下即將失去承重！' });
    }
    b.phase = target;
    this.cooldown = GameConfig.phase.swapCooldown;
    player.applyPhaseVisual(target);
    this.level.applyGhosting(target);
    this.bus.emit('phaseChanged', { phase: target, position: { x: b.pos.x, y: b.pos.y, z: b.pos.z } });
    return true;
  }

  update(dt: number, player: PlayerController) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.graceT > 0) {
      this.graceT -= dt;
      if (this.graceT <= 0) player.body.graceCollider = null;
    }
  }
}
