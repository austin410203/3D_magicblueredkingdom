import type { LevelObject, Phase, Vec3 } from '../../gameplay/level/LevelSchema';

const FLOOR: Record<Phase, string> = { RED: 'floor_red', BLUE: 'floor_blue', NEUTRAL: 'floor_neutral' };

/** 平台：以「頂面高度 top」描述，較易做關卡設計 */
export function platform(id: string, phase: Phase, x: number, top: number, z: number, w: number, d: number, h = 0.6, extra: Partial<LevelObject> = {}): LevelObject {
  return { id, assetId: FLOOR[phase], position: [x, top - h / 2, z], size: [w, h, d], phase, tags: ['platform', 'phase_surface'], ...extra };
}

export function container(id: string, phase: Phase, x: number, top: number, z: number, w: number, d: number, h: number, extra: Partial<LevelObject> = {}): LevelObject {
  return { id, assetId: w * d > 10 ? 'container_large' : 'container_small', position: [x, top - h / 2, z], size: [w, h, d], phase, tags: ['container'], ...extra };
}

export function pylon(id: string, phase: 'RED' | 'BLUE', x: number, y: number, z: number): LevelObject {
  return {
    id,
    assetId: phase === 'RED' ? 'phase_pylon_red' : 'phase_pylon_blue',
    position: [x, y, z],
    phase,
    interaction: { type: 'phase_exchange', range: 1.0 },
    tags: ['exchange'],
  };
}

export function barrel(id: string, phase: 'RED' | 'BLUE', x: number, y: number, z: number, stage = 1): LevelObject {
  return {
    id,
    assetId: phase === 'RED' ? 'explosive_barrel_red' : 'explosive_barrel_blue',
    position: [x, y, z],
    phase,
    interaction: { type: 'explosive', range: 1.0, stage },
  };
}

export function checkpoint(id: string, x: number, y: number, z: number): LevelObject {
  return { id, assetId: 'checkpoint', position: [x, y, z], interaction: { type: 'checkpoint', range: 1.6 } };
}

export function exitGate(id: string, x: number, y: number, z: number): LevelObject {
  return { id, assetId: 'exit_gate', position: [x, y, z], interaction: { type: 'exit', range: 1.3 } };
}

export function tutorial(id: string, x: number, y: number, z: number, range: number, text: string): LevelObject {
  return { id, assetId: '__none__', position: [x, y, z], interaction: { type: 'tutorial', range, text } };
}

export function decor(id: string, assetId: string, pos: Vec3, size?: Vec3, phase: Phase = 'NEUTRAL'): LevelObject {
  return { id, assetId, position: pos, size, phase, collider: false, tags: ['decor'] };
}
