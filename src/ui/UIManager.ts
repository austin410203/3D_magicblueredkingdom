import type { Phase } from '../gameplay/level/LevelSchema';
import type { Quality } from '../data/configs/gameConfig';
import { STORY_PANELS } from '../data/storyPanels';
import { StorySequence } from './StorySequence';
import type { InputManager } from '../core/InputManager';

export interface UIActions {
  start(levelIndex: number): void;
  resume(): void;
  restart(): void;
  toMenu(): void;
  next(): void;
  setQuality(q: Quality): void;
  setAutoSwap(v: boolean): void;
  setMuted(v: boolean): void;
  replayPrologue(): void;
}

export interface Settings {
  quality: Quality;
  autoSwap: boolean;
  muted: boolean;
}

const $ = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

/** HUD、教學、暫停、設定、結算、主選單、劇情回顧、觸控按鈕 */
export class UIManager {
  root: HTMLDivElement;
  story: StorySequence;
  private tutTimer = 0;
  private bannerTimer = 0;
  private toastTimer = 0;

  constructor(parent: HTMLElement, private actions: UIActions, levelNames: string[], private settings: Settings) {
    this.root = document.createElement('div');
    this.root.className = 'ui';
    this.root.innerHTML = `
      <div class="flash"></div>
      <div class="speedlines"></div>
      <div class="hud hidden">
        <div class="hud-tl">
          <div class="lives comic-pill"><span class="heart">♥</span> × <b class="lives-n">5</b></div>
          <div class="phase-badge comic-pill"><span class="phase-sym">◆</span><span class="phase-name">藍色相位</span></div>
        </div>
        <div class="hud-top">
          <div class="goal comic-pill"></div>
          <div class="timer comic-pill hidden"></div>
        </div>
        <div class="hud-tr">
          <button class="icon-btn" data-a="help" title="教學">?</button>
          <button class="icon-btn" data-a="pause" title="暫停 (Esc)">❚❚</button>
        </div>
        <div class="bossbar hidden">
          <div class="bossbar-name">雙相監工</div>
          <div class="bossbar-track"><div class="bossbar-fill"></div></div>
        </div>
        <div class="banner hidden"></div>
        <div class="tutorial hidden"></div>
        <div class="toast hidden"></div>
        <div class="hint">WASD 移動 · Space 跳躍 · Shift 衝刺 · E 交換 · 拖曳旋轉鏡頭</div>
        <div class="touch">
          <div class="joy"><div class="joy-knob"></div></div>
          <div class="touch-btns">
            <button data-t="swap">交換</button>
            <button data-t="dash">衝刺</button>
            <button data-t="jump" class="big">跳</button>
          </div>
        </div>
      </div>

      <div class="screen menu">
        <div class="menu-card">
          <div class="logo">
            <div class="logo-zh"><span class="r">雙色</span><span class="b">界域</span></div>
            <div class="logo-sub">魔法龐克 · CHROMAFALL: ARCANE PUNK</div>
          </div>
          <div class="menu-btns">
            <button class="btn big" data-a="start">▶ 開始冒險</button>
            <div class="level-row">${levelNames.map((n, i) => `<button class="btn small" data-level="${i}">${n}</button>`).join('')}</div>
            <button class="btn" data-a="gallery">📖 劇情回顧</button>
            <button class="btn" data-a="settings">⚙ 設定</button>
          </div>
          <div class="asset-note"></div>
        </div>
      </div>

      <div class="screen pause hidden">
        <div class="menu-card comic-panel">
          <h2>暫停</h2>
          <button class="btn" data-a="resume">繼續</button>
          <button class="btn" data-a="restart">重新開始本關</button>
          <button class="btn" data-a="settings">設定</button>
          <button class="btn ghost" data-a="menu">回主選單</button>
        </div>
      </div>

      <div class="screen settings hidden">
        <div class="menu-card comic-panel">
          <h2>設定</h2>
          <label>畫質（陰影／描邊／粒子／解析度）
            <select data-s="quality">
              <option value="low">低</option><option value="medium">中</option><option value="high">高</option>
            </select>
          </label>
          <label class="check"><input type="checkbox" data-s="autoSwap"/> 接觸交換柱自動交換（關閉則需按 E）</label>
          <label class="check"><input type="checkbox" data-s="muted"/> 靜音</label>
          <button class="btn" data-a="replay">重播序章</button>
          <button class="btn" data-a="close-settings">完成</button>
        </div>
      </div>

      <div class="screen result hidden">
        <div class="menu-card comic-panel">
          <h2 class="result-title">通關！</h2>
          <div class="result-body"></div>
          <button class="btn big" data-a="next">下一關 ▶</button>
          <button class="btn" data-a="restart">再玩一次</button>
          <button class="btn ghost" data-a="menu">回主選單</button>
        </div>
      </div>

      <div class="screen gallery hidden">
        <div class="menu-card comic-panel wide">
          <h2>劇情回顧</h2>
          <div class="gallery-grid"></div>
          <button class="btn" data-a="close-gallery">返回</button>
        </div>
      </div>

      <div class="screen loading">
        <div class="loading-text">載入中…</div>
        <div class="loading-bar"><div></div></div>
      </div>
    `;
    parent.appendChild(this.root);
    this.story = new StorySequence(this.root);
    this.bind();
  }

  private bind() {
    const r = this.root;
    r.querySelectorAll<HTMLElement>('[data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        const a = b.dataset.a!;
        if (a === 'start') this.actions.start(0);
        else if (a === 'pause') this.actions.resume(); // resume() 在 Game 中為 toggle
        else if (a === 'help') this.showTutorial('目標：讓相位與腳下地板同色。觸碰異色交換柱可切換相位；異色物件可穿過、不會承重。', 6);
        else if (a === 'resume') this.actions.resume();
        else if (a === 'restart') this.actions.restart();
        else if (a === 'menu') this.actions.toMenu();
        else if (a === 'next') this.actions.next();
        else if (a === 'settings') this.show('settings', true);
        else if (a === 'close-settings') this.show('settings', false);
        else if (a === 'gallery') this.openGallery();
        else if (a === 'close-gallery') this.show('gallery', false);
        else if (a === 'replay') {
          this.show('settings', false);
          this.actions.replayPrologue();
        }
      }),
    );
    r.querySelectorAll<HTMLElement>('[data-level]').forEach((b) => b.addEventListener('click', () => this.actions.start(Number(b.dataset.level))));
    const q = $<HTMLSelectElement>(r, '[data-s=quality]');
    q.value = this.settings.quality;
    q.addEventListener('change', () => this.actions.setQuality(q.value as Quality));
    const a = $<HTMLInputElement>(r, '[data-s=autoSwap]');
    a.checked = this.settings.autoSwap;
    a.addEventListener('change', () => this.actions.setAutoSwap(a.checked));
    const m = $<HTMLInputElement>(r, '[data-s=muted]');
    m.checked = this.settings.muted;
    m.addEventListener('change', () => this.actions.setMuted(m.checked));
  }

  bindTouch(input: InputManager) {
    const isTouch = matchMedia('(pointer: coarse)').matches;
    this.root.classList.toggle('is-touch', isTouch);
    const joy = $<HTMLDivElement>(this.root, '.joy');
    const knob = $<HTMLDivElement>(this.root, '.joy-knob');
    let id: number | null = null;
    let cx = 0;
    let cy = 0;
    joy.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      const rect = joy.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
      joy.setPointerCapture(e.pointerId);
    });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = (e.clientX - cx) / 50;
      let dy = (e.clientY - cy) / 50;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
      input.setTouchAxis(dx, -dy);
    });
    const end = () => { id = null; knob.style.transform = ''; input.setTouchAxis(0, 0); };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);
    this.root.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => {
      const act = b.dataset.t as 'jump' | 'swap' | 'dash';
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); input.pressAction(act, true); });
      b.addEventListener('pointerup', () => input.pressAction(act, false));
      b.addEventListener('pointercancel', () => input.pressAction(act, false));
    });
  }

  show(name: 'hud' | 'menu' | 'pause' | 'settings' | 'result' | 'gallery' | 'loading', v: boolean) {
    $(this.root, '.' + name).classList.toggle('hidden', !v);
  }

  setLoading(done: number, total: number) {
    ($(this.root, '.loading-bar div') as HTMLDivElement).style.width = `${(done / Math.max(1, total)) * 100}%`;
  }

  setAssetNote(text: string) {
    $(this.root, '.asset-note').textContent = text;
  }

  setLives(n: number) {
    $(this.root, '.lives-n').textContent = String(n);
    const el = $(this.root, '.lives');
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  setPhase(p: Phase) {
    const b = $(this.root, '.phase-badge');
    b.classList.toggle('red', p === 'RED');
    b.classList.toggle('blue', p === 'BLUE');
    $(this.root, '.phase-sym').textContent = p === 'RED' ? '▲' : '◆';
    $(this.root, '.phase-name').textContent = p === 'RED' ? '紅色相位' : '藍色相位';
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
  }

  setGoal(text: string) {
    $(this.root, '.goal').textContent = '🎯 ' + text;
  }

  setTimer(s: number | null) {
    const t = $(this.root, '.timer');
    t.classList.toggle('hidden', s === null);
    if (s !== null) {
      t.textContent = `⏱ ${Math.ceil(s)}`;
      t.classList.toggle('urgent', s < 15);
    }
  }

  setBoss(hp: number | null, max = 1) {
    const bar = $(this.root, '.bossbar');
    bar.classList.toggle('hidden', hp === null);
    if (hp !== null) ($(this.root, '.bossbar-fill') as HTMLElement).style.width = `${(Math.max(0, hp) / max) * 100}%`;
  }

  showBanner(text: string, phase: Phase | null, dur = 3) {
    const b = $(this.root, '.banner');
    b.textContent = text;
    b.className = 'banner' + (phase === 'RED' ? ' red' : phase === 'BLUE' ? ' blue' : '');
    this.bannerTimer = dur;
  }

  showTutorial(text: string, dur = 5) {
    const t = $(this.root, '.tutorial');
    t.textContent = text;
    t.classList.remove('hidden');
    this.tutTimer = dur;
  }

  toast(text: string, dur = 1.4) {
    const t = $(this.root, '.toast');
    t.textContent = text;
    t.classList.remove('hidden');
    this.toastTimer = dur;
  }

  flash(color: string) {
    const f = $(this.root, '.flash');
    f.style.background = color;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  speedLines() {
    const s = $(this.root, '.speedlines');
    s.classList.remove('go');
    void s.offsetWidth;
    s.classList.add('go');
  }

  showResult(title: string, body: string, hasNext: boolean) {
    $(this.root, '.result-title').textContent = title;
    $(this.root, '.result-body').innerHTML = body;
    ($(this.root, '.result [data-a=next]') as HTMLElement).style.display = hasNext ? '' : 'none';
    this.show('result', true);
  }

  openGallery() {
    const unlocked = new Set<string>(JSON.parse(localStorage.getItem('cf_story') ?? '[]'));
    const grid = $(this.root, '.gallery-grid');
    grid.innerHTML = '';
    for (const p of STORY_PANELS) {
      const ok = unlocked.has(p.id);
      const b = document.createElement('button');
      b.className = 'gallery-item' + (ok ? '' : ' locked');
      b.innerHTML = ok ? `<span>${p.title}</span>` : '<span>🔒 尚未解鎖</span>';
      if (ok && p.crop) {
        const [x, y, w, h] = p.crop;
        b.style.backgroundImage = `url("${p.image}")`;
        b.style.backgroundSize = `${100 / w}% ${100 / h}%`;
        b.style.backgroundPosition = `${(x / (1 - w)) * 100}% ${(y / (1 - h)) * 100}%`;
        b.addEventListener('click', () => this.story.play([p.id]));
      }
      grid.appendChild(b);
    }
    this.show('gallery', true);
  }

  update(dt: number) {
    if (this.tutTimer > 0 && (this.tutTimer -= dt) <= 0) $(this.root, '.tutorial').classList.add('hidden');
    if (this.bannerTimer > 0 && (this.bannerTimer -= dt) <= 0) $(this.root, '.banner').classList.add('hidden');
    if (this.toastTimer > 0 && (this.toastTimer -= dt) <= 0) $(this.root, '.toast').classList.add('hidden');
  }

  clearTransient() {
    this.tutTimer = this.bannerTimer = this.toastTimer = 0.0001;
  }
}
