/**
 * 所有可調數值集中在此，避免 magic numbers 散落各系統。
 */
export type Quality = 'low' | 'medium' | 'high';

export const GameConfig = {
  player: {
    speed: 6,
    accelGround: 22,
    accelAir: 11,
    dashSpeed: 12,
    dashTime: 0.2,
    dashCooldown: 0.8,
    jumpVelocity: 9.4,
    jumpCutMultiplier: 0.5,
    gravity: -26,
    maxFallSpeed: -30,
    halfWidth: 0.3,
    height: 0.9,
    coyoteTime: 0.1,
    jumpBuffer: 0.12,
    lives: 5,
    invulnTime: 1.4,
  },
  phase: {
    /** 交換冷卻（秒），規格 0.25–0.4 */
    swapCooldown: 0.35,
    /** 切換後腳下變異色時的寬限時間（秒） */
    groundGrace: 0.15,
    /** 觸碰交換柱即自動交換；false 時需按 E */
    autoSwapOnTouch: true,
    /** 異相位物件的半透明程度 */
    ghostOpacity: 0.38,
  },
  camera: {
    distance: 11.5,
    minDistance: 7,
    maxDistance: 22,
    pitch: 0.92, // 弧度，斜俯視
    yaw: 0,
    followLerp: 6,
    lead: 1.6,
    fov: 45,
    dragSensitivity: 0.006,
  },
  world: {
    killY: -7,
    hitStop: 0.08,
  },
  hunter: {
    speed: 4.4,
    sightRange: 14,
    alertTime: 0.6,
    chaseMemory: 6,
    catchDistance: 0.85,
    respawnDelay: 3,
  },
  boss: {
    hp: 6,
    /** 'boss_punch'：引誘 Boss 重拳打中同色炸藥桶；'player_trigger'：玩家以同色相位接觸引爆 */
    mode: 'boss_punch' as 'boss_punch' | 'player_trigger',
    telegraphByStage: [1.8, 1.35, 1.0],
    trackRatio: 0.65,
    slamTime: 0.28,
    recoverTime: 1.1,
    staggerTime: 1.6,
    slamRadius: 2.3,
    barrelHitRadius: 2.4,
    barrelRespawn: 5,
    tileFlipEvery: 2,
  },
  colors: {
    RED: 0xff2a5c,
    BLUE: 0x2f7dff,
    NEUTRAL: 0x8c8598,
    outline: 0x1a0f24,
  },
};

export const QualityPresets: Record<Quality, { pixelRatio: number; shadows: boolean; shadowSize: number; outlines: boolean; particles: number }> = {
  low: { pixelRatio: 0.75, shadows: false, shadowSize: 512, outlines: false, particles: 0.4 },
  medium: { pixelRatio: 1, shadows: true, shadowSize: 1024, outlines: true, particles: 0.7 },
  high: { pixelRatio: 2, shadows: true, shadowSize: 2048, outlines: true, particles: 1 },
};
