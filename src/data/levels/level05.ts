import type { LevelData, LevelObject, Phase } from '../../gameplay/level/LevelSchema';
import { platform, pylon, barrel, exitGate, tutorial, decor } from './helpers';

/** 章末 Boss〈雙相監工〉：5×5 地塊競技場，紅藍地塊可在第三階段翻轉 */
const pattern: Phase[][] = [
  // z = -16, -12, -8, -4, 0 ；x = -8, -4, 0, 4, 8
  ['NEUTRAL', 'RED', 'NEUTRAL', 'BLUE', 'NEUTRAL'],
  ['NEUTRAL', 'BLUE', 'NEUTRAL', 'RED', 'NEUTRAL'],
  ['BLUE', 'NEUTRAL', 'NEUTRAL', 'NEUTRAL', 'RED'],
  ['NEUTRAL', 'RED', 'NEUTRAL', 'BLUE', 'NEUTRAL'],
  ['NEUTRAL', 'NEUTRAL', 'NEUTRAL', 'NEUTRAL', 'NEUTRAL'],
];
const tiles: LevelObject[] = [];
pattern.forEach((row, i) =>
  row.forEach((ph, j) => {
    const x = -8 + j * 4;
    const z = -16 + i * 4;
    tiles.push(platform(`tile_${i}_${j}`, ph, x, 0, z, 3.9, 3.9, 0.8, { flippable: ph !== 'NEUTRAL' }));
  }),
);

export const level05: LevelData = {
  id: 'level_05',
  chapter: '章末',
  title: '雙相監工',
  objective: '把監工的重拳引到同色炸藥桶，擊倒 Boss',
  spawn: { position: [0, 0.1, 0], phase: 'RED' },
  goal: { type: 'defeat_boss' },
  boss: { position: [0, 0, -25] },
  storyIntro: ['p5', 'p6'],
  storyOutro: ['p7'],
  cameraDistance: 18,
  theme: { sky: 0x3d1a2e, fog: 0x4a1f35, fogNear: 30, fogFar: 85 },
  objects: [
    ...tiles,
    platform('boss_dais', 'NEUTRAL', 0, 0, -25, 12, 6, 1.4, { collider: true }),
    platform('exit_ledge', 'NEUTRAL', 0, 0, 4, 6, 4, 0.8),
    pylon('pylon_red_a', 'RED', -8, 0, 0),
    pylon('pylon_blue_a', 'BLUE', 8, 0, 0),
    pylon('pylon_red_b', 'RED', 8, 0, -16),
    pylon('pylon_blue_b', 'BLUE', -8, 0, -16),
    barrel('barrel_red_1', 'RED', -4.8, 0, -8, 1),
    barrel('barrel_blue_1', 'BLUE', 4.8, 0, -8, 2),
    barrel('barrel_red_2', 'RED', 8, 0, -12, 2),
    barrel('barrel_blue_2', 'BLUE', -8, 0, -12, 2),
    exitGate('exit_01', 0, 0, 5),
    tutorial('t_boss', 0, 0, 0, 2.5, '監工出拳前會亮出顏色與落點圈。站到「同色炸藥桶」旁引誘重拳，然後在落下前跑開！'),
    decor('d_pipe1', 'industrial_pipe', [-12, -1, -10], [0.8, 0.8, 26]),
    decor('d_pipe2', 'industrial_pipe', [12, -1, -10], [0.8, 0.8, 26]),
    decor('d_sign1', 'hazard_sign', [-3, 0, 3.5]),
    decor('d_sign2', 'hazard_sign', [3, 0, 3.5]),
    decor('d_lava', 'lava_pool', [0, -9, -10], [50, 0.2, 50]),
  ],
};
