import type { LevelData } from '../../gameplay/level/LevelSchema';
import { platform, pylon, checkpoint, exitGate, tutorial, decor } from './helpers';

/** 序章〈失色車站〉：移動、跳躍、同色承重、接觸交換、異色穿透、移動平台 */
export const level01: LevelData = {
  id: 'level_01',
  chapter: '序章',
  title: '失色車站',
  objective: '抵達車站出口',
  spawn: { position: [0, 0.1, 2], phase: 'BLUE' },
  goal: { type: 'reach_exit' },
  storyIntro: ['p3'],
  theme: { sky: 0x3a2346, fog: 0x4a2c52, fogNear: 30, fogFar: 80 },
  objects: [
    platform('start', 'NEUTRAL', 0, 0, 0, 6, 8, 1),
    platform('b1', 'BLUE', 0, 0, -7, 4, 4),
    platform('red_decoy_1', 'RED', -4.5, 0, -7, 3, 4),
    platform('n2', 'NEUTRAL', 0, 0, -11, 4, 4, 1),
    pylon('pylon_red_01', 'RED', 1.3, 0, -11.3),
    platform('r1', 'RED', 0, 0, -15, 4, 4),
    platform('r2', 'RED', 0, 1, -18.5, 4, 3),
    platform('r3', 'RED', 0, 1, -23, 4, 6),
    { id: 'blue_wall_01', assetId: 'phase_wall', position: [0, 2.2, -23], size: [4, 2.4, 0.5], phase: 'BLUE', tags: ['wall'] },
    platform('n3', 'NEUTRAL', 0, 1, -27, 4, 2, 1),
    checkpoint('cp_01', -1.4, 1, -27),
    pylon('pylon_blue_01', 'BLUE', 1.3, 1, -27.2),
    platform('blue_bridge', 'BLUE', -0.6, 1, -30.5, 1.6, 5, 0.4, { assetId: 'bridge' }),
    platform('red_bridge_decoy', 'RED', 1.6, 1, -30.5, 1.8, 5, 0.4, { assetId: 'bridge' }),
    platform('moving_01', 'BLUE', 0, 1, -36, 3, 3, 0.5, { assetId: 'moving_platform', motion: { axis: 'x', amplitude: 2.2, speed: 1.3 } }),
    platform('goal_floor', 'NEUTRAL', 0, 1, -42, 8, 6, 1),
    exitGate('exit_01', 0, 1, -43.6),

    tutorial('t_move', 0, 0, 2, 3, 'WASD／方向鍵移動，空白鍵跳躍，拖曳滑鼠旋轉鏡頭、滾輪縮放。'),
    tutorial('t_blue', 0, 0, -3.2, 1.8, '你現在是【藍色 ◆】相位：只能站在藍色或灰色地板。跳上前方的藍色平台！左邊的紅色平台不會承重。'),
    tutorial('t_pylon', 0, 0, -10, 1.8, '接觸【紅色交換柱 ▲】，相位就會切換成紅色，才能踏上紅色地板。'),
    tutorial('t_wall', 0, 1, -21, 1.8, '異色物件就像幽影：紅色的你可以直接穿過藍色牆！'),
    tutorial('t_bridge', 0, 1, -26.8, 1.6, '切回藍色走窄橋。紅色橋對藍色的你不會承重！'),
    tutorial('t_moving', 0, 1, -33, 1.4, '抓準時機跳上移動平台。按 Shift 可以衝刺。'),

    decor('d_c1', 'container_large', [-8, -1.5, -14], [3, 3, 6], 'RED'),
    decor('d_c2', 'container_large', [8, -2, -22], [3, 3, 7], 'BLUE'),
    decor('d_c3', 'container_small', [7, -0.5, -6], [2.4, 2.4, 2.4]),
    decor('d_c4', 'container_small', [-7, 0, -32], [2.4, 2.4, 5], 'BLUE'),
    decor('d_pipe1', 'industrial_pipe', [-7, -2, -20], [0.5, 0.5, 30]),
    decor('d_pipe2', 'industrial_pipe', [7, -1.5, -40], [0.6, 0.6, 14]),
    decor('d_sign1', 'hazard_sign', [2.6, 0, -2]),
    decor('d_lava', 'lava_pool', [0, -9, -22], [40, 0.2, 70]),
  ],
};
