import * as THREE from 'three';

/**
 * 可重用漫畫特效：衝擊環、爆炸星芒、速度線粒子、相位符文環。
 * 特效不帶碰撞，數量受品質設定 particleScale 影響。
 */
interface Fx {
  obj: THREE.Object3D;
  life: number;
  max: number;
  update: (t: number, o: THREE.Object3D, dt: number) => void;
}

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.translate(128, 128);
  const spikes = 12;
  const draw = (r1: number, r2: number, fill: string) => {
    g.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 ? r2 : r1 * (0.8 + Math.random() * 0.2);
      const a = (i / (spikes * 2)) * Math.PI * 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = '#1a0f24';
    g.stroke();
  };
  draw(120, 55, '#ffd23a');
  draw(70, 32, '#fff6d8');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ComicFX {
  private list: Fx[] = [];
  private star = starTexture();
  particleScale = 1;
  constructor(private scene: THREE.Scene) {}

  ring(pos: THREE.Vector3, color: number, maxR = 1.6, dur = 0.4, flat = true) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    m.position.copy(pos);
    if (flat) m.rotation.x = -Math.PI / 2;
    this.add(m, dur, (t, o) => {
      const s = 0.2 + t * maxR;
      o.scale.setScalar(s);
      ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - t;
    });
  }

  burst(pos: THREE.Vector3, size = 2.5, dur = 0.45) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.star, transparent: true, depthWrite: false, depthTest: false }));
    s.position.copy(pos);
    s.renderOrder = 10;
    this.add(s, dur, (t, o) => {
      const k = t < 0.2 ? t / 0.2 : 1;
      o.scale.setScalar(size * (0.4 + 0.6 * k) * (1 + t * 0.3));
      ((o as THREE.Sprite).material as THREE.SpriteMaterial).opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      (o as THREE.Sprite).material.rotation = t * 0.6;
    });
  }

  sparks(pos: THREE.Vector3, color: number, count = 14, speed = 4, dur = 0.5) {
    const n = Math.max(2, Math.round(count * this.particleScale));
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    const v: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      v.push(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random())));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.18, transparent: true, depthWrite: false }));
    pts.position.copy(pos);
    this.add(pts, dur, (t, o, dt) => {
      const a = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) {
        v[i].y -= 9 * dt;
        a.setXYZ(i, a.getX(i) + v[i].x * dt, a.getY(i) + v[i].y * dt, a.getZ(i) + v[i].z * dt);
      }
      a.needsUpdate = true;
      ((o as THREE.Points).material as THREE.PointsMaterial).opacity = 1 - t;
    });
  }

  /** 漫畫速度線（角色身後的條狀拖影） */
  speedLines(pos: THREE.Vector3, dir: THREE.Vector3, color = 0xffffff) {
    const n = Math.max(2, Math.round(6 * this.particleScale));
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.9),
        new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }),
      );
      m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.2 + Math.random() * 0.7, (Math.random() - 0.5) * 0.7));
      m.lookAt(m.position.clone().add(dir));
      const d = dir.clone().multiplyScalar(-4);
      this.add(m, 0.25, (t, o, dt) => {
        o.position.addScaledVector(d, dt);
        ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - t;
      });
    }
  }

  private add(obj: THREE.Object3D, max: number, update: Fx['update']) {
    this.scene.add(obj);
    this.list.push({ obj, life: 0, max, update });
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.life += dt;
      const t = Math.min(1, f.life / f.max);
      f.update(t, f.obj, dt);
      if (t >= 1) {
        this.scene.remove(f.obj);
        f.obj.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
        });
        this.list.splice(i, 1);
      }
    }
  }

  clear() {
    for (const f of this.list) this.scene.remove(f.obj);
    this.list = [];
  }
}
