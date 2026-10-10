/**
 * 鍵鼠輸入；觸控以虛擬搖桿／按鈕寫入同一介面（setTouchAxis / pressAction）。
 */
export type Action = 'jump' | 'swap' | 'dash' | 'pause';

const ACTION_KEYS: Record<Action, string[]> = {
  jump: ['Space'],
  swap: ['KeyE'],
  dash: ['ShiftLeft', 'ShiftRight'],
  pause: ['Escape', 'KeyP'],
};

export class InputManager {
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private touchActions = new Set<Action>();
  private touchHeld = new Set<Action>();
  private touchAxis = { x: 0, y: 0 };
  private dragging = false;
  private lastX = 0;
  dragDX = 0;
  wheel = 0;

  constructor(canvas: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.dragging = true;
      this.lastX = e.clientX;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.dragDX += e.clientX - this.lastX;
      this.lastX = e.clientX;
    });
    window.addEventListener('pointerup', () => (this.dragging = false));
    canvas.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  axis() {
    const k = (c: string) => (this.keys.has(c) ? 1 : 0);
    let x = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft') + this.touchAxis.x;
    let y = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown') + this.touchAxis.y;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  held(a: Action) {
    return ACTION_KEYS[a].some((c) => this.keys.has(c)) || this.touchHeld.has(a);
  }
  justPressed(a: Action) {
    return ACTION_KEYS[a].some((c) => this.pressed.has(c)) || this.touchActions.has(a);
  }

  // —— 觸控介面 ——
  setTouchAxis(x: number, y: number) {
    this.touchAxis.x = x;
    this.touchAxis.y = y;
  }
  pressAction(a: Action, down: boolean) {
    if (down) {
      this.touchActions.add(a);
      this.touchHeld.add(a);
    } else this.touchHeld.delete(a);
  }

  endFrame() {
    this.pressed.clear();
    this.touchActions.clear();
    this.dragDX = 0;
    this.wheel = 0;
  }
}
