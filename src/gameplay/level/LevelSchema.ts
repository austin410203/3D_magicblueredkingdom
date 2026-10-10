export type Phase = 'RED' | 'BLUE' | 'NEUTRAL';
export type Vec3 = [number, number, number];

export type InteractionType =
  | 'phase_exchange'
  | 'explosive'
  | 'checkpoint'
  | 'exit'
  | 'hazard'
  | 'enemy_trigger'
  | 'tutorial';

export interface LevelObject {
  /** 穩定 ID，所有可互動物件必須唯一 */
  id: string;
  /** 對應 AssetManifest 的資產 ID */
  assetId: string;
  /** 物件中心點（世界座標） */
  position: Vec3;
  /** 尺寸（同時用於視覺擬合與 box 碰撞體） */
  size?: Vec3;
  rotationY?: number;
  phase?: Phase;
  /** 是否有實體碰撞體（預設：有 size 且非互動觸發物件 → true） */
  collider?: boolean;
  tags?: string[];
  interaction?: { type: InteractionType; range?: number; text?: string; stage?: number };
  /** 簡單往返移動平台 */
  motion?: { axis: 'x' | 'y' | 'z'; amplitude: number; speed: number };
  /** 輸送帶推力 [vx, vz] */
  conveyor?: [number, number];
  /** Boss 第三階段會翻轉相位的地塊 */
  flippable?: boolean;
}

export interface LevelData {
  id: string;
  chapter: string;
  title: string;
  objective: string;
  spawn: { position: Vec3; phase: Phase };
  objects: LevelObject[];
  goal: { type: 'reach_exit' | 'defeat_boss'; timeLimit?: number };
  hunters?: { id: string; spawn: Vec3; phase: Phase; triggerId: string }[];
  boss?: { position: Vec3 };
  storyIntro?: string[];
  storyOutro?: string[];
  /** 覆寫預設鏡頭距離 */
  cameraDistance?: number;
  theme: { sky: number; fog: number; fogNear: number; fogFar: number };
}
