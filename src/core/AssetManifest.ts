/**
 * 集中式資產清單。替換模型時只需放入對應 GLB 檔，或修改此處路徑。
 *
 * fit:
 *  - 'size'   ：模型依關卡物件 size 擬合包圍盒（地板、貨櫃、平台）
 *  - 'height' ：模型等比例縮放至指定 height（角色、道具）
 * 原點規範：角色腳底／道具底部位於原點；正面朝 +Z。
 */
export interface AssetDef {
  id: string;
  path?: string;
  fit: 'size' | 'height';
  height?: number;
  /** 額外 Y 軸旋轉（弧度），用於修正模型朝向 */
  rotationY?: number;
  /** 動畫別名：遊戲內動畫名 → GLB 中的 clip 名稱 */
  animations?: Record<string, string>;
}

const A = (id: string, path: string | undefined, fit: AssetDef['fit'], extra: Partial<AssetDef> = {}): AssetDef => ({
  id,
  path,
  fit,
  ...extra,
});

export const PLAYER_ANIMS = ['idle', 'run', 'jump_start', 'jump_loop', 'fall', 'land', 'phase_switch', 'interact', 'hurt', 'victory'];

export const AssetManifest: Record<string, AssetDef> = Object.fromEntries(
  [
    A('player_cat_mage', '/assets/characters/cat_mage.glb', 'height', {
      height: 1.0,
      animations: Object.fromEntries(PLAYER_ANIMS.map((n) => [n, n])),
    }),
    A('enemy_hunter', '/assets/characters/enemy_hunter.glb', 'height', { height: 1.3 }),
    A('boss_foreman', '/assets/characters/boss_foreman.glb', 'height', { height: 8 }),
    A('floor_red', '/assets/environment/floor_red.glb', 'size'),
    A('floor_blue', '/assets/environment/floor_blue.glb', 'size'),
    A('floor_neutral', '/assets/environment/floor_neutral.glb', 'size'),
    A('container_small', '/assets/environment/container_small.glb', 'size'),
    A('container_large', '/assets/environment/container_large.glb', 'size'),
    A('bridge', '/assets/environment/bridge.glb', 'size'),
    A('moving_platform', '/assets/environment/moving_platform.glb', 'size'),
    A('phase_wall', '/assets/environment/phase_wall.glb', 'size'),
    A('lava_pool', '/assets/environment/lava_pool.glb', 'size'),
    A('conveyor', '/assets/environment/conveyor.glb', 'size'),
    A('phase_pylon_red', '/assets/props/phase_pylon_red.glb', 'height', { height: 1.8 }),
    A('phase_pylon_blue', '/assets/props/phase_pylon_blue.glb', 'height', { height: 1.8 }),
    A('explosive_barrel_red', '/assets/props/explosive_barrel_red.glb', 'height', { height: 1.2 }),
    A('explosive_barrel_blue', '/assets/props/explosive_barrel_blue.glb', 'height', { height: 1.2 }),
    A('checkpoint', '/assets/props/checkpoint.glb', 'height', { height: 2 }),
    A('exit_gate', '/assets/props/exit_gate.glb', 'height', { height: 3.4 }),
    A('hazard_sign', '/assets/props/hazard_sign.glb', 'height', { height: 1.4 }),
    A('industrial_pipe', '/assets/props/industrial_pipe.glb', 'size'),
  ].map((d) => [d.id, d]),
);

export const StoryAssets = {
  storyboard: '/assets/story/comic_storyboard.png',
};
