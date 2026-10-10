import type { Phase } from '../gameplay/level/LevelSchema';

/** 型別化事件匯流排，讓 UI／音效／特效與玩法系統解耦 */
export interface GameEvents {
  phaseChanged: { phase: Phase; position: { x: number; y: number; z: number } };
  swapFailed: { reason: string };
  playerDied: { reason: string };
  livesChanged: { lives: number };
  checkpoint: { id: string };
  tutorial: { id: string; text: string };
  levelComplete: { levelId: string };
  bossHp: { hp: number; max: number };
  bossBanner: { text: string; phase: Phase | null };
  timer: { seconds: number | null };
  hunterAlert: { id: string };
  warning: { text: string };
}

type Handler<T> = (p: T) => void;

export class EventBus {
  private map = new Map<keyof GameEvents, Set<Handler<any>>>();
  on<K extends keyof GameEvents>(k: K, h: Handler<GameEvents[K]>) {
    if (!this.map.has(k)) this.map.set(k, new Set());
    this.map.get(k)!.add(h);
    return () => this.map.get(k)!.delete(h);
  }
  emit<K extends keyof GameEvents>(k: K, p: GameEvents[K]) {
    this.map.get(k)?.forEach((h) => h(p));
  }
}
