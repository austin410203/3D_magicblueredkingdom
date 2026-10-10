/**
 * 以 WebAudio 合成的佔位音效（無需音檔）。之後可改為載入 public/assets/audio/ 內的檔案。
 * 所有音效皆有對應視覺提示，靜音時仍可遊玩。
 */
export type Sfx = 'jump' | 'land' | 'swap' | 'swapFail' | 'hurt' | 'alert' | 'explode' | 'bossHit' | 'win' | 'checkpoint' | 'warn' | 'click';

export class AudioManager {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol = 0.15, slideTo?: number, delay = 0) {
    const c = this.ensure();
    if (!c || this.muted) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol = 0.3) {
    const c = this.ensure();
    if (!c || this.muted) return;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const s = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = vol;
    s.buffer = buf;
    s.connect(g).connect(c.destination);
    s.start();
  }

  play(s: Sfx) {
    switch (s) {
      case 'jump': return this.tone(380, 0.14, 'square', 0.06, 720);
      case 'land': return this.tone(140, 0.08, 'triangle', 0.1, 80);
      case 'swap': this.tone(520, 0.1, 'sawtooth', 0.06, 1040); return this.tone(1040, 0.12, 'sine', 0.08, 1560, 0.06);
      case 'swapFail': return this.tone(200, 0.15, 'square', 0.06, 150);
      case 'hurt': return this.tone(300, 0.3, 'sawtooth', 0.1, 80);
      case 'alert': this.tone(880, 0.08, 'square', 0.07); return this.tone(880, 0.08, 'square', 0.07, undefined, 0.12);
      case 'explode': this.noise(0.6, 0.4); return this.tone(90, 0.5, 'sine', 0.25, 40);
      case 'bossHit': this.noise(0.25, 0.25); return this.tone(220, 0.3, 'square', 0.1, 60);
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, undefined, i * 0.12)); return;
      case 'checkpoint': return this.tone(660, 0.2, 'triangle', 0.08, 990);
      case 'warn': return this.tone(440, 0.2, 'square', 0.05, 330);
      case 'click': return this.tone(700, 0.05, 'square', 0.04);
    }
  }
}
