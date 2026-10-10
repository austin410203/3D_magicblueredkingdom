import * as THREE from 'three';
import { ToonMaterialFactory as TMF } from './ToonMaterialFactory';
import { GameConfig } from '../data/configs/gameConfig';
import type { Phase } from '../gameplay/level/LevelSchema';

/**
 * 程式化佔位模型。GLB 未提供時由 AssetRegistry 使用，資產 ID 與 GLB 完全相同。
 * - fit 'size' 的資產：以原點為中心，填滿 size
 * - fit 'height' 的資產：原點在底部中心，正面 +Z
 */
const T = TMF.make;
const C = GameConfig.colors;

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function phaseColor(p: Phase) {
  return p === 'RED' ? C.RED : p === 'BLUE' ? C.BLUE : C.NEUTRAL;
}

/** 紅＝三角、藍＝菱形，避免只靠顏色辨識 */
export function phaseSymbolGeometry(p: Phase, r = 0.28) {
  return new THREE.CircleGeometry(r, p === 'RED' ? 3 : 4);
}

function platform(size: THREE.Vector3, phase: Phase, kind: string) {
  const g = new THREE.Group();
  const col = phaseColor(phase);
  const body = T(kind === 'container' ? new THREE.Color(col).multiplyScalar(0.85).getHex() : col, {
    emissive: phase === 'NEUTRAL' ? 0x000000 : col,
    emissiveIntensity: phase === 'NEUTRAL' ? 0 : 0.18,
  });
  g.add(mesh(new THREE.BoxGeometry(size.x, size.y, size.z), body));

  if (kind === 'container') {
    // 貨櫃肋條
    const rib = T(new THREE.Color(col).multiplyScalar(0.6).getHex());
    const n = Math.max(2, Math.floor(size.x / 0.6));
    for (let i = 0; i < n; i++) {
      const x = -size.x / 2 + (i + 0.5) * (size.x / n);
      const r = mesh(new THREE.BoxGeometry(0.08, size.y * 0.9, size.z + 0.06), rib, x, 0, 0);
      r.userData.noOutline = true;
      g.add(r);
    }
  }
  if (phase !== 'NEUTRAL' && size.x * size.z > 0.5) {
    // 頂面相位符號 + 警示條紋
    const symMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    const nx = Math.min(4, Math.max(1, Math.floor(size.x / 2.2)));
    const nz = Math.min(4, Math.max(1, Math.floor(size.z / 2.2)));
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const s = new THREE.Mesh(phaseSymbolGeometry(phase, 0.3), symMat);
        s.rotation.x = -Math.PI / 2;
        if (phase === 'RED') s.rotation.z = Math.PI / 2;
        s.position.set(-size.x / 2 + (i + 0.5) * (size.x / nx), size.y / 2 + 0.01, -size.z / 2 + (j + 0.5) * (size.z / nz));
        s.userData.noOutline = true;
        g.add(s);
      }
  } else if (kind === 'floor' && size.x * size.z > 4) {
    // 中性地板：警示條紋邊
    const stripe = new THREE.MeshBasicMaterial({ color: 0xf2c230 });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 0.96, 0.18), stripe);
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, size.y / 2 + 0.01, size.z / 2 - 0.2);
    s.userData.noOutline = true;
    g.add(s);
  }
  return g;
}

function catMage() {
  const g = new THREE.Group();
  const fur = T(0x2a2533);
  const white = T(0xf3ece2);
  const red = T(0xd8243a, { side: THREE.DoubleSide });
  const brass = T(0xd09a3a);
  const lens = T(0x7fd4ff, { emissive: 0x2a88cc, emissiveIntensity: 0.7 });
  const leather = T(0x7a4a2a);
  const eye = T(0xffc61a, { emissive: 0x664400, emissiveIntensity: 0.6 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x111111 });

  const body = mesh(new THREE.SphereGeometry(0.26, 20, 16), fur, 0, 0.33, 0);
  body.scale.set(1, 1.1, 0.95);
  g.add(body);
  const belly = mesh(new THREE.SphereGeometry(0.19, 16, 12), white, 0, 0.3, 0.1);
  belly.scale.set(1, 1.1, 0.75);
  belly.userData.noOutline = true;
  g.add(belly);

  const head = new THREE.Group();
  head.position.y = 0.7;
  g.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.29, 22, 18), fur));
  const muzzle = mesh(new THREE.SphereGeometry(0.12, 16, 12), white, 0, -0.08, 0.2);
  muzzle.scale.set(1.3, 0.8, 0.8);
  muzzle.userData.noOutline = true;
  head.add(muzzle);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.11, 0.24, 4), fur, s * 0.17, 0.25, -0.02);
    ear.rotation.z = -s * 0.35;
    head.add(ear);
    const e = mesh(new THREE.SphereGeometry(0.075, 14, 10), eye, s * 0.11, 0.02, 0.23);
    e.scale.z = 0.6;
    e.userData.noOutline = true;
    head.add(e);
    const p = mesh(new THREE.SphereGeometry(0.035, 10, 8), dark, s * 0.11, 0.02, 0.28);
    p.scale.set(0.7, 1.3, 0.5);
    p.userData.noOutline = true;
    head.add(p);
    // 護目鏡
    const ring = mesh(new THREE.TorusGeometry(0.075, 0.025, 8, 16), brass, s * 0.11, 0.17, 0.2);
    ring.rotation.x = -0.5;
    head.add(ring);
    const l = mesh(new THREE.CircleGeometry(0.068, 16), lens, s * 0.11, 0.17, 0.205);
    l.rotation.x = -0.5;
    l.userData.noOutline = true;
    head.add(l);
  }
  const band = mesh(new THREE.TorusGeometry(0.285, 0.025, 6, 28), leather, 0, 0.12, 0);
  band.rotation.x = Math.PI / 2 - 0.25;
  band.userData.noOutline = true;
  head.add(band);

  // 紅色圍巾＋短披風
  const scarf = mesh(new THREE.TorusGeometry(0.2, 0.065, 8, 20), red, 0, 0.5, 0);
  scarf.rotation.x = Math.PI / 2;
  g.add(scarf);
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 0.52, -0.16);
  const cape = mesh(new THREE.PlaneGeometry(0.46, 0.5, 1, 3), red, 0, -0.25, 0);
  cape.userData.noOutline = true;
  capePivot.add(cape);
  g.add(capePivot);
  g.userData.cape = capePivot;

  // 皮革背帶與工具包
  const strap = mesh(new THREE.TorusGeometry(0.27, 0.025, 6, 24), leather, 0, 0.35, 0);
  strap.rotation.set(Math.PI / 2, 0.5, 0);
  strap.userData.noOutline = true;
  g.add(strap);
  g.add(mesh(new THREE.BoxGeometry(0.14, 0.12, 0.1), leather, 0.24, 0.24, 0.05));

  // 雙相核心
  const core = mesh(new THREE.SphereGeometry(0.075, 16, 12), T(0xffffff, { emissive: C.BLUE, emissiveIntensity: 1.4 }), 0, 0.42, 0.24);
  core.userData.noOutline = true;
  g.add(core);
  g.userData.core = core;

  // 腳與尾巴
  for (const [x, z] of [[-0.12, 0.08], [0.12, 0.08], [-0.12, -0.08], [0.12, -0.08]]) {
    const f = mesh(new THREE.SphereGeometry(0.08, 10, 8), fur, x, 0.06, z);
    f.scale.y = 0.75;
    g.add(f);
  }
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.2, -0.22),
    new THREE.Vector3(0, 0.3, -0.42),
    new THREE.Vector3(0, 0.6, -0.48),
    new THREE.Vector3(0.05, 0.72, -0.38),
  ]);
  const tail = mesh(new THREE.TubeGeometry(tailCurve, 12, 0.05, 8), fur);
  g.add(tail);
  g.userData.tail = tail;
  return g;
}

function hunter() {
  const g = new THREE.Group();
  const metal = T(0x5b5868);
  const darkM = T(0x34303f);
  const body = mesh(new THREE.SphereGeometry(0.45, 18, 14), metal, 0, 0.85, 0);
  body.scale.y = 0.85;
  g.add(body);
  const eye = mesh(new THREE.SphereGeometry(0.16, 14, 10), T(0xffffff, { emissive: 0xff3030, emissiveIntensity: 1.5 }), 0, 0.9, 0.36);
  eye.userData.noOutline = true;
  g.add(eye);
  g.userData.eye = eye;
  const band = mesh(new THREE.TorusGeometry(0.47, 0.05, 8, 24), T(0xffffff, { emissive: C.RED, emissiveIntensity: 1 }), 0, 0.85, 0);
  band.rotation.x = Math.PI / 2;
  band.userData.noOutline = true;
  g.add(band);
  g.userData.band = band;
  const legs: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const l = mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.6, 6), darkM, Math.cos(a) * 0.38, 0.3, Math.sin(a) * 0.38);
    l.rotation.z = Math.cos(a) * 0.4;
    l.rotation.x = -Math.sin(a) * 0.4;
    legs.push(l);
    g.add(l);
  }
  g.userData.legs = legs;
  const ant = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 5), darkM, 0.15, 1.35, -0.1);
  g.add(ant);
  return g;
}

function boss() {
  const g = new THREE.Group();
  const metal = T(0x4b4658);
  const rust = T(0x8a5a3a);
  const stripe = T(0xf2c230);
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(1.2, 3, 1.4), metal, s * 1.4, 1.5, 0));
  const torso = mesh(new THREE.BoxGeometry(4.6, 3, 2.8), rust, 0, 4.4, 0);
  g.add(torso);
  g.add(mesh(new THREE.BoxGeometry(4.7, 0.35, 2.9), stripe, 0, 3.05, 0));
  const head = mesh(new THREE.BoxGeometry(2, 1.4, 1.8), metal, 0, 6.6, 0.2);
  g.add(head);
  const visor = mesh(new THREE.BoxGeometry(1.6, 0.35, 0.1), T(0xffffff, { emissive: 0xff4060, emissiveIntensity: 1.5 }), 0, 6.65, 1.13);
  visor.userData.noOutline = true;
  g.add(visor);
  g.userData.visor = visor;
  const core = mesh(new THREE.SphereGeometry(0.6, 20, 14), T(0xffffff, { emissive: 0xaa66ff, emissiveIntensity: 1.6 }), 0, 4.5, 1.35);
  core.userData.noOutline = true;
  g.add(core);
  g.userData.core = core;
  for (const s of [-1, 1]) {
    const sh = mesh(new THREE.SphereGeometry(0.9, 14, 10), metal, s * 2.9, 5.4, 0);
    g.add(sh);
    const arm = mesh(new THREE.BoxGeometry(0.8, 2.6, 0.8), rust, s * 3.1, 3.9, 0.3);
    g.add(arm);
  }
  return g;
}

function pylon(phase: Phase) {
  const g = new THREE.Group();
  const col = phaseColor(phase);
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.35, 12), T(0x4a4556), 0, 0.175, 0));
  const tank = mesh(new THREE.CapsuleGeometry(0.3, 0.7, 6, 14), T(col, { emissive: col, emissiveIntensity: 0.65 }), 0, 0.95, 0);
  g.add(tank);
  g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 12), T(0xc8932e), 0, 1.55, 0));
  const sym = new THREE.Mesh(phaseSymbolGeometry(phase, 0.22), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  sym.position.y = 2.05;
  sym.userData.noOutline = true;
  sym.userData.spin = true;
  g.add(sym);
  g.userData.symbol = sym;
  return g;
}

function barrel(phase: Phase) {
  const g = new THREE.Group();
  const col = phaseColor(phase);
  g.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 14), T(col, { emissive: col, emissiveIntensity: 0.3 }), 0, 0.6, 0));
  for (const y of [0.25, 0.95]) {
    const b = mesh(new THREE.TorusGeometry(0.46, 0.04, 6, 18), T(0x2b2733), 0, y, 0);
    b.rotation.x = Math.PI / 2;
    b.userData.noOutline = true;
    g.add(b);
  }
  const sym = new THREE.Mesh(phaseSymbolGeometry(phase, 0.22), new THREE.MeshBasicMaterial({ color: 0xffe14a }));
  sym.position.set(0, 0.6, 0.46);
  sym.userData.noOutline = true;
  g.add(sym);
  return g;
}

function checkpoint() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 2, 8), T(0x3c3846), 0, 1, 0));
  const flag = mesh(new THREE.PlaneGeometry(0.7, 0.45), T(0x36e0b0, { emissive: 0x139070, emissiveIntensity: 0.6, side: THREE.DoubleSide }), 0.36, 1.7, 0);
  flag.userData.noOutline = true;
  g.add(flag);
  g.userData.flag = flag;
  return g;
}

function exitGate() {
  const g = new THREE.Group();
  const m = T(0x3c3846);
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.5, 3.4, 0.5), m, s * 1.4, 1.7, 0));
  g.add(mesh(new THREE.BoxGeometry(3.4, 0.5, 0.6), T(0xf2c230), 0, 3.35, 0));
  const portal = mesh(
    new THREE.PlaneGeometry(2.3, 2.9),
    new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    0,
    1.5,
    0,
  );
  portal.userData.noOutline = true;
  g.add(portal);
  g.userData.portal = portal;
  return g;
}

function lava(size: THREE.Vector3) {
  const g = new THREE.Group();
  const m = mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
  m.userData.noOutline = true;
  g.add(m);
  g.userData.lava = m;
  return g;
}

function conveyor(size: THREE.Vector3) {
  const g = platform(size, 'NEUTRAL', 'floor');
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xf2c230 });
  const n = Math.max(1, Math.floor(Math.max(size.x, size.z) / 1.5));
  const arrows = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = new THREE.Mesh(new THREE.CircleGeometry(0.35, 3), arrowMat);
    a.rotation.x = -Math.PI / 2;
    a.position.set(0, size.y / 2 + 0.015, -size.z / 2 + (i + 0.5) * (size.z / n));
    a.userData.noOutline = true;
    arrows.add(a);
  }
  g.add(arrows);
  g.userData.arrows = arrows;
  return g;
}

function pipe(size: THREE.Vector3) {
  const g = new THREE.Group();
  const len = Math.max(size.x, size.z);
  const p = mesh(new THREE.CylinderGeometry(size.y / 2, size.y / 2, len, 12), T(0xc8803a));
  p.rotation.z = size.x >= size.z ? Math.PI / 2 : 0;
  if (size.z > size.x) p.rotation.x = Math.PI / 2;
  g.add(p);
  return g;
}

function sign() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), T(0x3c3846), 0, 0.5, 0));
  const s = mesh(new THREE.CircleGeometry(0.4, 3), T(0xf2c230, { side: THREE.DoubleSide }), 0, 1.1, 0);
  s.rotation.z = Math.PI / 2;
  g.add(s);
  return g;
}

export function buildPlaceholder(assetId: string, size: THREE.Vector3, phase: Phase): THREE.Object3D {
  switch (assetId) {
    case 'player_cat_mage':
      return catMage();
    case 'enemy_hunter':
      return hunter();
    case 'boss_foreman':
      return boss();
    case 'floor_red':
    case 'floor_blue':
    case 'floor_neutral':
    case 'bridge':
    case 'moving_platform':
    case 'phase_wall':
      return platform(size, phase, 'floor');
    case 'container_small':
    case 'container_large':
      return platform(size, phase, 'container');
    case 'phase_pylon_red':
      return pylon('RED');
    case 'phase_pylon_blue':
      return pylon('BLUE');
    case 'explosive_barrel_red':
      return barrel('RED');
    case 'explosive_barrel_blue':
      return barrel('BLUE');
    case 'checkpoint':
      return checkpoint();
    case 'exit_gate':
      return exitGate();
    case 'lava_pool':
      return lava(size);
    case 'conveyor':
      return conveyor(size);
    case 'industrial_pipe':
      return pipe(size);
    case 'hazard_sign':
      return sign();
    default: {
      // 未知資產：洋紅色問號方塊，便於辨識
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(size.x || 1, size.y || 1, size.z || 1), T(0xff00ff)));
      return g;
    }
  }
}
