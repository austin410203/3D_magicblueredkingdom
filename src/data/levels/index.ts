import { level01 } from './level01';
import { level03 } from './level03';
import { level05 } from './level05';
import type { LevelData } from '../../gameplay/level/LevelSchema';

/**
 * 關卡順序。規格中的 02〈貨櫃迷城〉與 04〈熔爐外環〉尚未製作，
 * 新增時只要建立 levelXX.ts 並加入此陣列即可。
 */
export const LEVELS: LevelData[] = [level01, level03, level05];
