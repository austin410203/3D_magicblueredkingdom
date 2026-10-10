import { StoryAssets } from '../core/AssetManifest';

/**
 * 漫畫故事分格。crop 為相對於整張圖片的比例座標 [x, y, w, h]（0–1），可自由調整。
 * 圖中文字只作插畫底圖；正式文案以下方 text 由 HTML 重新排版。
 */
export interface StoryPanel {
  id: string;
  image: string;
  crop?: [number, number, number, number];
  title: string;
  text: string;
}

const IMG = StoryAssets.storyboard;

export const STORY_PANELS: StoryPanel[] = [
  {
    id: 'p1',
    image: IMG,
    crop: [0.0, 0.0, 0.55, 0.385],
    title: '1. 破裂的雙相之城',
    text: '魔法與科技交織的赫克斯工業群島，古老的「雙相源爐」突然失控。整座城市被撕裂成互相排斥的紅相與藍相。為了修復世界，魔法貓咪小墨踏上了旅程。',
  },
  {
    id: 'p2',
    image: IMG,
    crop: [0.55, 0.0, 0.45, 0.385],
    title: '2. 雙相的力量',
    text: '世界的一切都分屬紅色或藍色。只有與自己相同顏色的物件才能站立與接觸；接觸不同顏色的交換物件，就能切換自己的相位。',
  },
  {
    id: 'p3',
    image: IMG,
    crop: [0.0, 0.385, 0.37, 0.3],
    title: '3. 穿越複雜的關卡',
    text: '貨櫃、平台、機械與浮空裝置交錯的迷城中，小墨必須靈活切換顏色與跳躍，找出通往終點的道路。',
  },
  {
    id: 'p4',
    image: IMG,
    crop: [0.37, 0.385, 0.32, 0.3],
    title: '4. 小心！敵人的追擊',
    text: '工廠的守衛機械「巡色者」已被雙相之力污染，會追擊入侵者。它們也受相位規則束縛——善用異色路線就能甩開追兵。',
  },
  {
    id: 'p5',
    image: IMG,
    crop: [0.69, 0.385, 0.31, 0.3],
    title: '5. 利用環境與道具',
    text: '場景中有各種機關與炸藥桶。善用顏色特性，就能啟動機關、開闢道路，甚至在戰鬥中造成傷害。',
  },
  {
    id: 'p6',
    image: IMG,
    crop: [0.0, 0.685, 0.6, 0.315],
    title: '6. 挑戰強大的 BOSS',
    text: '在最深處等待的是失控的「雙相監工」。它的巨拳會切換紅藍形態——觀察顏色規律，把重拳引到同色炸藥桶，打破它的防禦！',
  },
  {
    id: 'p7',
    image: IMG,
    crop: [0.6, 0.685, 0.4, 0.315],
    title: '7. 找回雙相核心',
    text: '擊敗監工後，小墨奪回了一部分雙相核心。但這只是冒險的開始——更多分裂的區域、更多謎題，正等著魔法貓咪去探索。',
  },
];

/** 首次啟動時播放的序章 */
export const PROLOGUE = ['p1', 'p2'];

export function panelById(id: string) {
  return STORY_PANELS.find((p) => p.id === id);
}
