import { panelById } from '../data/storyPanels';

/**
 * 漫畫分格播放器：上一格／下一格／略過；桌面適配寬度、手機逐格。
 * 支援鍵盤 ← → Enter Esc。
 */
export class StorySequence {
  private el: HTMLDivElement;
  private ids: string[] = [];
  private i = 0;
  private resolve: (() => void) | null = null;
  private keyHandler = (e: KeyboardEvent) => {
    if (!this.resolve) return;
    if (e.code === 'ArrowRight' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.next(); }
    else if (e.code === 'ArrowLeft') this.prev();
    else if (e.code === 'Escape') this.finish();
  };

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'story hidden';
    this.el.innerHTML = `
      <div class="story-card comic-panel">
        <div class="story-art"></div>
        <div class="story-caption">
          <div class="story-title"></div>
          <div class="story-text"></div>
        </div>
        <div class="story-nav">
          <button class="btn small" data-a="prev">◀ 上一格</button>
          <span class="story-count"></span>
          <button class="btn small" data-a="next">下一格 ▶</button>
          <button class="btn small ghost" data-a="skip">略過 ⏭</button>
        </div>
      </div>`;
    parent.appendChild(this.el);
    this.el.querySelector('[data-a=prev]')!.addEventListener('click', () => this.prev());
    this.el.querySelector('[data-a=next]')!.addEventListener('click', () => this.next());
    this.el.querySelector('[data-a=skip]')!.addEventListener('click', () => this.finish());
    window.addEventListener('keydown', this.keyHandler);
  }

  play(ids: string[]): Promise<void> {
    this.ids = ids.filter((id) => panelById(id));
    if (!this.ids.length) return Promise.resolve();
    this.i = 0;
    this.render();
    this.el.classList.remove('hidden');
    return new Promise((r) => (this.resolve = r));
  }

  private render() {
    const p = panelById(this.ids[this.i])!;
    const art = this.el.querySelector('.story-art') as HTMLDivElement;
    art.style.backgroundImage = `url("${p.image}")`;
    if (p.crop) {
      const [x, y, w, h] = p.crop;
      art.style.backgroundSize = `${100 / w}% ${100 / h}%`;
      art.style.backgroundPosition = `${w >= 1 ? 0 : (x / (1 - w)) * 100}% ${h >= 1 ? 0 : (y / (1 - h)) * 100}%`;
      // 原圖比例 3:2
      art.style.aspectRatio = `${(w * 1536) / (h * 1024)}`;
    } else {
      art.style.backgroundSize = 'contain';
      art.style.backgroundPosition = 'center';
      art.style.aspectRatio = '3 / 2';
    }
    (this.el.querySelector('.story-title') as HTMLElement).textContent = p.title;
    (this.el.querySelector('.story-text') as HTMLElement).textContent = p.text;
    (this.el.querySelector('.story-count') as HTMLElement).textContent = `${this.i + 1} / ${this.ids.length}`;
    (this.el.querySelector('[data-a=prev]') as HTMLButtonElement).disabled = this.i === 0;
    (this.el.querySelector('[data-a=next]') as HTMLButtonElement).textContent = this.i === this.ids.length - 1 ? '開始 ▶' : '下一格 ▶';
    const card = this.el.querySelector('.story-card') as HTMLElement;
    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
  }

  private next() {
    if (this.i < this.ids.length - 1) {
      this.i++;
      this.render();
    } else this.finish();
  }
  private prev() {
    if (this.i > 0) {
      this.i--;
      this.render();
    }
  }
  private finish() {
    this.el.classList.add('hidden');
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }
}
