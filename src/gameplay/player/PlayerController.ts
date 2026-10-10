import * as THREE from 'three';
import { GameConfig } from '../../data/configs/gameConfig';
import type { Body, PhysicsWorld } from '../../core/PhysicsWorld';
import type { InputManager } from '../../core/InputManager';
import type { AssetInstance } from '../../core/AssetRegistry';
import type { Phase } from '../level/LevelSchema';
import { phaseSymbolGeometry } from '../../core/Placeholders';

export type PlayerState = 'IDLE' | 'RUN' | 'JUMP' | 'FALL' | 'DEAD' | 'VICTORY';

/**
 * 玩家輸入、移動、跳躍、地面檢測、衝刺、相位外觀。
 * 碰撞體（AABB 膠囊近似）完全由程式定義，與 GLB 模型分離。
 */
export class PlayerController {
  body: Body;
  root = new THREE.Group();
  model: THREE.Object3D;
  state: PlayerState = 'IDLE';
  facing = Math.PI;
  invuln = 0;
  private coyote = 0;
  private jumpBuf = 0;
  private jumpCut = false;
  private dashT = 0;
  dashCd = 0;
  private squash = 0;
  private airTime = 0;
  private phaseFlash = 0;
  private time = 0;
  private ring: THREE.Mesh;
  private ringSym: THREE.Mesh;
  private aura: THREE.PointLight;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private currentAnim = '';
  onJump?: () => void;
  onLand?: (hard: boolean) => void;
  onDash?: (dir: THREE.Vector3) => void;

  constructor(asset: AssetInstance) {
    const c = GameConfig.player;
    this.body = {
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      halfWidth: c.halfWidth,
      height: c.height,
      phase: 'BLUE',
      onGround: false,
      ground: null,
      graceCollider: null,
      gravityScale: 1,
    };
    this.model = asset.root;
    this.root.add(this.model);

    // 腳下相位符文環（與模型無關，替換 GLB 後仍有效）
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.55, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.root.add(this.ring);
    this.ringSym = new THREE.Mesh(phaseSymbolGeometry('BLUE', 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
    this.ringSym.rotation.x = -Math.PI / 2;
    this.ringSym.position.y = 0.035;
    this.root.add(this.ringSym);
    this.aura = new THREE.PointLight(0xffffff, 3, 3.5, 2);
    this.aura.position.y = 0.6;
    this.root.add(this.aura);

    if (asset.clips.size) {
      this.mixer = new THREE.AnimationMixer(this.model);
      asset.clips.forEach((clip, name) => this.actions.set(name, this.mixer!.clipAction(clip)));
    }
    this.applyPhaseVisual('BLUE');
  }

  get phase() {
    return this.body.phase;
  }

  applyPhaseVisual(p: Phase) {
    const col = p === 'RED' ? GameConfig.colors.RED : GameConfig.colors.BLUE;
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(col);
    this.ringSym.geometry.dispose();
    this.ringSym.geometry = phaseSymbolGeometry(p, 0.16);
    this.ringSym.rotation.z = p === 'RED' ? Math.PI / 2 : 0;
    (this.ringSym.material as THREE.MeshBasicMaterial).color.setHex(col);
    this.aura.color.setHex(col);
    const core = this.model.userData.core as THREE.Mesh | undefined;
    if (core) ((core.material as THREE.MeshToonMaterial).emissive as THREE.Color).setHex(col);
    this.phaseFlash = 1;
  }

  teleport(p: THREE.Vector3) {
    this.body.pos.copy(p);
    this.body.vel.set(0, 0, 0);
    this.body.onGround = false;
    this.body.ground = null;
    this.body.graceCollider = null;
    this.state = 'IDLE';
    this.dashT = 0;
    this.root.position.copy(p);
  }

  update(dt: number, input: InputManager, camYaw: number, physics: PhysicsWorld, controlsEnabled: boolean) {
    const c = GameConfig.player;
    const b = this.body;
    this.time += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);

    // 相機相對移動
    const ax = controlsEnabled ? input.axis() : { x: 0, y: 0 };
    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const move = right.multiplyScalar(ax.x).add(fwd.multiplyScalar(ax.y));

    if (controlsEnabled && input.justPressed('dash') && this.dashCd <= 0) {
      this.dashT = c.dashTime;
      this.dashCd = c.dashCooldown;
      const d = move.lengthSq() > 0.01 ? move.clone().normalize() : new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
      b.vel.x = d.x * c.dashSpeed;
      b.vel.z = d.z * c.dashSpeed;
      this.onDash?.(d);
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      b.vel.y = Math.max(b.vel.y, -1);
    } else {
      const accel = b.onGround ? c.accelGround : c.accelAir;
      const k = 1 - Math.exp(-accel * dt);
      b.vel.x += (move.x * c.speed - b.vel.x) * k;
      b.vel.z += (move.z * c.speed - b.vel.z) * k;
    }
    if (move.lengthSq() > 0.01) this.facing = Math.atan2(move.x, move.z);

    // 跳躍：緩衝 + 土狼時間 + 可變高度
    this.coyote = b.onGround ? c.coyoteTime : this.coyote - dt;
    this.jumpBuf = controlsEnabled && input.justPressed('jump') ? c.jumpBuffer : this.jumpBuf - dt;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      b.vel.y = c.jumpVelocity;
      this.jumpBuf = 0;
      this.coyote = 0;
      this.jumpCut = false;
      b.onGround = false;
      b.ground = null;
      this.squash = -0.6;
      this.onJump?.();
    }
    if (!input.held('jump') && b.vel.y > 0 && !this.jumpCut) {
      b.vel.y *= c.jumpCutMultiplier;
      this.jumpCut = true;
    }

    const wasGround = b.onGround;
    const fallSpeed = b.vel.y;
    physics.step(b, dt);
    if (b.onGround && b.ground?.conveyor) {
      b.pos.x += b.ground.conveyor[0] * dt;
      b.pos.z += b.ground.conveyor[1] * dt;
    }
    if (!wasGround && b.onGround) {
      const hard = fallSpeed < -12;
      if (this.airTime > 0.12) {
        this.squash = hard ? 0.9 : 0.5;
        this.onLand?.(hard);
      }
    }
    this.airTime = b.onGround ? 0 : this.airTime + dt;

    if (this.state !== 'DEAD' && this.state !== 'VICTORY') {
      if (!b.onGround) this.state = b.vel.y > 0 ? 'JUMP' : 'FALL';
      else this.state = Math.hypot(b.vel.x, b.vel.z) > 0.6 ? 'RUN' : 'IDLE';
    }
    this.animate(dt);
  }

  private animate(dt: number) {
    const b = this.body;
    this.root.position.copy(b.pos);
    // 平滑轉向
    let d = this.facing - this.model.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.model.rotation.y += d * Math.min(1, dt * 14);

    this.squash += (0 - this.squash) * Math.min(1, dt * 10);
    const sq = this.squash;
    // squash/stretch（僅視覺，碰撞體不變）
    const sy = 1 - sq * 0.25;
    const sxz = 1 + sq * 0.15;
    const speed = Math.hypot(b.vel.x, b.vel.z);
    let bob = 0;
    if (this.state === 'RUN') bob = Math.abs(Math.sin(this.time * 14)) * 0.07;
    this.model.scale.set(sxz, sy, sxz);
    this.model.position.y = bob;
    this.model.rotation.x = this.state === 'RUN' ? Math.min(0.2, speed * 0.03) : this.state === 'FALL' ? -0.1 : 0;

    const cape = this.model.userData.cape as THREE.Object3D | undefined;
    if (cape) cape.rotation.x = -0.15 - Math.min(1.1, speed * 0.12 + (b.onGround ? 0 : 0.4)) + Math.sin(this.time * 18) * 0.06 * (speed > 1 ? 1 : 0.3);
    const tail = this.model.userData.tail as THREE.Object3D | undefined;
    if (tail) tail.rotation.z = Math.sin(this.time * 4) * 0.15;

    this.phaseFlash = Math.max(0, this.phaseFlash - dt * 3);
    const pulse = 1 + this.phaseFlash * 1.5 + Math.sin(this.time * 5) * 0.08;
    this.ring.scale.setScalar(pulse);
    this.aura.intensity = 2.5 + this.phaseFlash * 6;
    const core = this.model.userData.core as THREE.Mesh | undefined;
    if (core) (core.material as THREE.MeshToonMaterial).emissiveIntensity = 1.3 + this.phaseFlash * 2;
    // 無敵閃爍
    this.model.visible = this.invuln <= 0 || Math.floor(this.time * 16) % 2 === 0;

    // GLB 動畫（若有）
    if (this.mixer) {
      const want =
        this.state === 'RUN' ? 'run' :
        this.state === 'JUMP' ? 'jump_loop' :
        this.state === 'FALL' ? 'fall' :
        this.state === 'VICTORY' ? 'victory' :
        this.state === 'DEAD' ? 'hurt' : 'idle';
      if (want !== this.currentAnim && this.actions.has(want)) {
        this.actions.get(this.currentAnim)?.fadeOut(0.15);
        this.actions.get(want)!.reset().fadeIn(0.15).play();
        this.currentAnim = want;
      }
      this.mixer.update(dt);
    }
  }
}
