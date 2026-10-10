import type { LevelData } from '../../gameplay/level/LevelSchema';
import { platform, pylon, checkpoint, exitGate, tutorial, decor, container } from './helpers';

/** 第二章〈追獵工廠〉：追獵機、倒數、輸送帶、利用異色路線甩開敵人 */
export const level03: LevelData = {
  id: 'level_03',
  chapter: '第二章',
  title: '追獵工廠',
  objective: '在倒數結束前抵達安全門',
  spawn: { position: [0, 0.1, 1.5], phase: 'RED' },
  goal: { type: 'reach_exit', timeLimit: 90 },
  storyIntro: ['p4'],
  hunters: [{ id: 'hunter_01', spawn: [-3.5, 0.1, -17.5], phase: 'RED', triggerId: 'trig_chase' }],
  theme: { sky: 0x2a1f3c, fog: 0x3b2448, fogNear: 28, fogFar: 75 },
  objects: [
    platform('start', 'NEUTRAL', 0, 0, 0, 8, 6, 1),
    platform('hall', 'NEUTRAL', 0, 0, -11, 10, 16, 1),
    { id: 'conveyor_01', assetId: 'conveyor', position: [-3.4, 0.1, -10], size: [2.6, 0.2, 10], phase: 'NEUTRAL', conveyor: [0, 3.2], tags: ['conveyor'] },
    container('box_a', 'NEUTRAL', 1.8, 2, -6.5, 2, 2, 2),
    container('box_b', 'NEUTRAL', 3.5, 2, -12.5, 2, 3, 2),
    container('box_c', 'NEUTRAL', -0.5, 1.4, -14.5, 2.4, 1.4, 1.4),
    { id: 'trig_chase', assetId: '__none__', position: [0, 0, -4], interaction: { type: 'enemy_trigger', range: 3.5 } },
    pylon('pylon_blue_01', 'BLUE', 3.6, 0, -17.6),
    checkpoint('cp_01', -4.2, 0, -3.5),

    // 紅色路線：巡色者（紅）能跟上
    platform('red_a', 'RED', -3, 0, -24, 3, 10),
    platform('red_s1', 'RED', -3, 0.27, -29.5, 3, 1),
    platform('red_s2', 'RED', -3, 0.54, -30.5, 3, 1),
    // 藍色路線：巡色者無法踏上
    platform('blue_a', 'BLUE', 3, 0, -21, 3, 4),
    platform('blue_b', 'BLUE', 3, 0.8, -25.5, 3, 3),
    platform('blue_c', 'BLUE', 3, 0.8, -29, 3, 3),

    platform('hub', 'NEUTRAL', 0, 0.8, -34, 10, 6, 1),
    checkpoint('cp_02', 0, 0.8, -32),
    pylon('pylon_red_02', 'RED', -3.8, 0.8, -36),
    pylon('pylon_blue_02', 'BLUE', 3.8, 0.8, -36),
    platform('red_bridge', 'RED', -2.5, 1.4, -40, 2, 6, 0.4, { assetId: 'bridge' }),
    platform('blue_lift', 'BLUE', 2.5, 1.4, -40, 3, 3, 0.5, { assetId: 'moving_platform', motion: { axis: 'y', amplitude: 0.7, speed: 1.6 } }),
    platform('exit_floor', 'NEUTRAL', 0, 2, -46, 8, 6, 1),
    exitGate('exit_01', 0, 2, -47.8),

    tutorial('t_chase', 0, 0, -4, 3.6, '巡色者啟動了！它會追你——碰到就失去一條命。注意倒數計時！'),
    tutorial('t_conv', -3.4, 0, -8, 1.6, '黃色箭頭是輸送帶，會把你往回推。'),
    tutorial('t_route', 0, 0, -17, 3, '巡色者是【紅色】，只能走紅色或灰色地板。切成藍色走藍色路線就能甩開它！'),
    tutorial('t_hub', 0, 0.8, -33, 3, '紅色橋或藍色升降台，選一條路通往安全門。'),

    decor('d_c1', 'container_large', [-9, -1, -12], [3, 4, 8], 'BLUE'),
    decor('d_c2', 'container_large', [9, -1, -26], [3, 4, 10], 'RED'),
    decor('d_pipe1', 'industrial_pipe', [0, -2, -20], [24, 0.7, 0.7]),
    decor('d_pipe2', 'industrial_pipe', [-7, -1.5, -36], [0.6, 0.6, 16]),
    decor('d_sign1', 'hazard_sign', [4.6, 0, -3]),
    decor('d_lava', 'lava_pool', [0, -9, -24], [40, 0.2, 70]),
  ],
};
