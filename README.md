# 雙色界域：魔法龐克（Chromafall: Arcane Punk）

3D Cel-Shading 漫畫風格 2.5D 動作冒險。主角魔法貓咪「小墨」在紅／藍兩種相位間切換：**只有與自己同色（或灰色中性）的物件能站立、碰撞與觸發**，異色物件像幽影一樣可穿過、不會承重。

技術：Vite + TypeScript + Three.js（r169），可直接部署 Vercel（純靜態，無後端）。

---

## 1. 安裝與啟動

```bash
npm install
npm run dev        # 開發伺服器 http://localhost:5173
npm run build      # 型別檢查 + 產生 dist/
npm run preview    # 預覽 production build
```

需求：Node.js 18 以上、支援 WebGL 的瀏覽器（桌面 Chrome / Edge / Firefox / Safari）。

## 2. 部署到 Vercel

**方式 A：GitHub 匯入（建議）**
1. 將專案推到 GitHub（例如 `austin410203/3D_Chromafall`）。
2. 到 https://vercel.com/new → Import 該 repo。
3. Framework Preset 選 **Vite**（會自動偵測）；Build Command `npm run build`、Output Directory `dist`。
4. Deploy，完成後即可用公開網址遊玩。之後每次 push 會自動重新部署。

**方式 B：Vercel CLI**
```bash
npm i -g vercel
vercel          # 第一次：依提示連結專案
vercel --prod   # 正式部署
```

本專案不需要 `vercel.json`（沒有自訂路由）。

## 3. 操作方式

| 操作 | 鍵鼠 | 觸控 |
|---|---|---|
| 移動 | WASD／方向鍵 | 左下虛擬搖桿 |
| 跳躍 | Space（按住跳更高） | 「跳」 |
| 衝刺 | Shift | 「衝刺」 |
| 交換相位 | 接觸交換柱自動交換；或 E（設定中可關閉自動） | 「交換」 |
| 鏡頭 | 滑鼠拖曳旋轉、滾輪縮放 | — |
| 暫停 | Esc／P | 右上 ❚❚ |

## 4. 目前內容

| 關卡 | 內容 | 狀態 |
|---|---|---|
| 序章〈失色車站〉 | 移動、跳躍、同色承重、接觸交換、異色穿牆、窄橋、移動平台、存檔點、出口 | ✅ 完整可玩 |
| 第二章〈追獵工廠〉 | 巡色者追逐（狀態機）、90 秒倒數、輸送帶、紅／藍分岔路線甩開敵人、升降台 | ✅ 可玩 |
| 章末〈雙相監工〉Boss | 攻擊預告（顏色＋落點圈）、重拳引爆同色炸藥桶、3 階段（紅拳教學 → 紅藍交替 → 場地相位翻轉）、勝利開啟出口 | ✅ 可玩原型 |

其他系統：漫畫故事分格（序章、各關前情、通關後回顧、主選單「劇情回顧」）、HUD（生命、相位、目標、倒數、Boss 血條）、教學提示（燈芯）、暫停／設定／結算、畫質低中高、合成音效、觸控按鈕。

## 5. 專案結構

```
src/
  main.ts
  app/        Game.ts（主迴圈、流程、互動）、EventBus.ts
  core/       AssetManifest.ts、AssetRegistry.ts、Placeholders.ts、ToonMaterialFactory.ts、
              PhysicsWorld.ts、InputManager.ts、AudioManager.ts、ComicFX.ts
  gameplay/   player/PlayerController.ts、phase/PhaseSystem.ts、enemies/HunterAI.ts、
              boss/BossController.ts、level/LevelManager.ts、level/LevelSchema.ts
  ui/         UIManager.ts、StorySequence.ts
  data/       levels/（level01, level03, level05, helpers, index）、storyPanels.ts、configs/gameConfig.ts
public/assets/  characters/ environment/ props/ effects/ audio/ ui/ story/
```

所有可調數值（速度、跳躍、交換冷卻 0.35s、寬限 0.15s、敵人速度、Boss 血量與節奏、色彩、畫質）都在 `src/data/configs/gameConfig.ts`。

## 6. 替換 GLB 模型

目前**沒有任何實際 GLB**，所有角色與物件都是程式化佔位模型（主選單底部會顯示數量）。替換方式：

1. 把 GLB 放到 `src/core/AssetManifest.ts` 中對應的路徑，例如主角 → `public/assets/characters/cat_mage.glb`。
2. 重新整理頁面即可，**不需修改任何遊戲邏輯**。載入失敗會在主選單顯示錯誤並自動退回佔位模型（不會白屏）。

| 資產 ID | 路徑 | 擬合方式 |
|---|---|---|
| `player_cat_mage` | characters/cat_mage.glb | 等比縮放至高 1.0 |
| `enemy_hunter` | characters/enemy_hunter.glb | 高 1.3 |
| `boss_foreman` | characters/boss_foreman.glb | 高 8 |
| `floor_red/blue/neutral`、`bridge`、`moving_platform`、`phase_wall`、`container_small/large`、`conveyor`、`lava_pool`、`industrial_pipe` | environment/*.glb | 依關卡物件 size 拉伸填滿 |
| `phase_pylon_red/blue`、`explosive_barrel_red/blue`、`checkpoint`、`exit_gate`、`hazard_sign` | props/*.glb | 依 height 等比縮放 |

**模型規範**
- 原點：角色腳底中心／道具底部；正面朝 **+Z**（若不同，在 manifest 設定 `rotationY`）。
- 遊戲規則不讀取 mesh 名稱、材質或階層：相位、碰撞體、互動範圍都在關卡資料中。
- Toon 材質與描邊在載入後由程式套用（`ToonMaterialFactory.convert` + `addOutlines`），GLB 不需預先烘焙；原材質保留在 `mesh.userData.originalMaterial`。
- 主角動畫 clip 名稱：`idle, run, jump_start, jump_loop, fall, land, phase_switch, interact, hurt, victory`。名稱不同時在 manifest 的 `animations` 建立別名對照（遊戲名 → clip 名）。沒有動畫時使用程式化 squash/stretch。
- 主角相位符文環、光暈由程式附加，換模型後仍有效；若要讓模型胸前核心也變色，目前只支援佔位模型（GLB 版本可在 `PlayerController.applyPhaseVisual` 依自訂規則尋找核心 mesh）。

## 7. 修改／新增關卡

關卡是純資料（`src/data/levels/levelXX.ts`），以 `helpers.ts` 快速描述：

```ts
platform('r1', 'RED', x, topY, z, width, depth)       // 頂面高度為 topY
pylon('pylon_red_01', 'RED', x, y, z)                 // 相位交換柱
checkpoint('cp_01', x, y, z) · exitGate('exit_01', x, y, z)
tutorial('t_id', x, y, z, range, '提示文字')
{ ..., motion: { axis: 'x', amplitude: 2, speed: 1.3 } }   // 移動平台
{ ..., conveyor: [0, 3] }                                    // 輸送帶
```

新增關卡：建立檔案後加入 `src/data/levels/index.ts` 的 `LEVELS` 陣列。

## 8. 漫畫故事分格

- 圖檔：`public/assets/story/comic_storyboard.png`（取自規格書附錄 B）。直接覆蓋同名檔案即可替換。
- 分格設定：`src/data/storyPanels.ts`，每格有 `id`、`crop: [x, y, w, h]`（相對比例 0–1，可調整）、標題與正式文案。圖中文字只是插畫，正式文案由 HTML 重排。
- 在關卡資料以 `storyIntro: ['p3']`／`storyOutro: ['p7']` 指定播放哪幾格。看過的分格會解鎖到「劇情回顧」。
- 播放器支援上一格／下一格／略過與鍵盤 ← → Esc。

## 9. Cel-Shading 品質設定

設定 → 畫質（存在 localStorage）：

| | 低 | 中 | 高 |
|---|---|---|---|
| 解析度倍率 | 0.75 | 1 | 最高 2 |
| 即時陰影 | 關 | 1024 | 2048 |
| 輪廓線 | 關 | 開 | 開 |
| 粒子量 | 40% | 70% | 100% |

數值在 `QualityPresets`（gameConfig.ts）。色階由 `ToonMaterialFactory` 的 3 階 gradientMap 控制。

## 10. 尚未完成／限制（請勿視為已完成）

- **沒有實際 GLB 與骨架動畫**：全部是程式化佔位模型。
- 規格中的第 02 關〈貨櫃迷城〉、第 04 關〈熔爐外環〉**尚未製作**（資料格式已支援，可直接新增）。
- **未使用 Rapier**：評估後改用自製 AABB 角色物理（本作碰撞體皆為方塊，且相位碰撞需當幀切換）。不支援斜坡、旋轉碰撞體與物件推動。
- 鏡頭沒有防穿牆處理（高俯角下關卡中少見）；Bloom 後製未實作。
- 骨架（SkinnedMesh）模型目前不會產生描邊。
- 音效為 WebAudio 合成佔位，無背景音樂。
- 觸控操作已有基本按鈕，但未在實機手機上測試。
- 驗證範圍：已在 headless Chromium（軟體渲染）中測試主選單、故事分格、第一關相位規則與通關、追獵機啟動、Boss 重拳命中炸藥桶與場地翻轉；**尚未在實體 GPU 瀏覽器確認 60 FPS，也尚未實際部署到 Vercel**。

## 11. 常見問題

- **畫面全黑／啟動失敗**：瀏覽器需支援 WebGL，可試著把畫質調低或更新顯示卡驅動。
- **換了 GLB 沒變**：確認路徑與檔名與 manifest 一致，並強制重新整理（Ctrl+Shift+R）。主選單底部會顯示 GLB 載入狀態。
- **模型太大／太小／方向錯**：調整 manifest 的 `height` 或 `rotationY`。
- **想讓交換需要按鍵**：設定中取消「接觸交換柱自動交換」，或改 `phase.autoSwapOnTouch`。
- **Boss 改成玩家自己引爆炸藥桶**：`boss.mode = 'player_trigger'`。
