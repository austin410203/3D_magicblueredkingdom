import * as THREE from 'three';
import { GameConfig, QualityPresets, type Quality } from '../data/configs/gameConfig';
import { AssetRegistry } from '../core/AssetRegistry';
import { PhysicsWorld } from '../core/PhysicsWorld';
import { InputManager } from '../core/InputManager';
import { AudioManager } from '../core/AudioManager';
import { ComicFX } from '../core/ComicFX';
import { setOutlinesVisible } from '../core/ToonMaterialFactory';
import { EventBus } from './EventBus';
import { LevelManager, type RuntimeObject } from '../gameplay/level/LevelManager';
import { PhaseSystem } from '../gameplay/phase/PhaseSystem';
import { PlayerController } from '../gameplay/player/PlayerController';
import { HunterAI } from '../gameplay/enemies/HunterAI';
import { BossController } from '../gameplay/boss/BossController';
import type { Phase } from '../gameplay/level/LevelSchema';
import { LEVELS } from '../data/levels';
import { PROLOGUE } from '../data/storyPanels';
import { UIManager, type Settings } from '../ui/UIManager';

type Mode = 'loading' | 'menu' | 'story' | 'playing' | 'paused' | 'result';
const FIXED_DT = 1 / 120;
const PHASE_HEX: Record<Phase, string> = { RED: '#ff2a5c', BLUE: '#2f7dff', NEUTRAL: '#ffffff' };

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sun = new THREE.DirectionalLight(0xfff0e0, 2.2);
  private hemi = new THREE.HemisphereLight(0xc8b8ff, 0x3a2030, 1.3);
  private registry = new AssetRegistry();
  private physics = new PhysicsWorld();
  private bus = new EventBus();
  private audio = new AudioManager();
  private input: InputManager;
  private fx: ComicFX;
  private level: LevelManager;
  private phase: PhaseSystem;
  private ui: UIManager;
  private player!: PlayerController;
  private hunters: HunterAI[] = [];
  private boss: BossController | null = null;

  private mode: Mode = 'loading';
  private levelIndex = 0;
  private lives = GameConfig.player.lives;
  private checkpoint = { pos: new THREE.Vector3(), phase: 'BLUE' as Phase, id: '' };
  private timer: number | null = null;
  private timerRunning = false;
  private triggered = new Set<string>();
  private seenTutorials = new Set<string>();
  private deaths = 0;
  private levelTime = 0;
  private dying = 0;
  private hitStop = 0;
  private shake = 0;
  private bossDefeated = false;
  private pendingFlip = 0;
  private time = 0;
  private acc = 0;
  private last = performance.now();

  private camYaw = GameConfig.camera.yaw;
  private camDist = GameConfig.camera.distance;
  private camTarget = new THREE.Vector3();

  private settings: Settings;

  constructor(private container: HTMLElement) {
    const saved = JSON.parse(localStorage.getItem('cf_settings') ?? '{}');
    this.settings = { quality: 'medium', autoSwap: GameConfig.phase.autoSwapOnTouch, muted: false, ...saved };

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(GameConfig.camera.fov, 1, 0.1, 200);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -18;
    this.sun.shadow.camera.right = this.sun.shadow.camera.top = 18;
    this.sun.shadow.camera.far = 60;
    this.sun.shadow.bias = -0.0008;

    this.input = new InputManager(this.renderer.domElement);
    this.fx = new ComicFX(this.scene);
    this.level = new LevelManager(this.scene, this.registry, this.physics);
    this.phase = new PhaseSystem(this.bus, this.physics, this.level);
    this.ui = new UIManager(
      container,
      {
        start: (i) => void this.startLevel(i, true),
        resume: () => this.togglePause(),
        restart: () => void this.startLevel(this.levelIndex, false),
        toMenu: () => this.toMenu(),
        next: () => void this.startLevel(this.levelIndex + 1, true),
        setQuality: (q) => { this.settings.quality = q; this.applyQuality(); this.saveSettings(); },
        setAutoSwap: (v) => { this.settings.autoSwap = v; this.saveSettings(); },
        setMuted: (v) => { this.settings.muted = v; this.audio.muted = v; this.saveSettings(); },
        replayPrologue: () => void this.ui.story.play(PROLOGUE),
      },
      LEVELS.map((l) => `${l.chapter}·${l.title}`),
      this.settings,
    );
    this.ui.bindTouch(this.input);
    this.audio.muted = this.settings.muted;
    this.wireEvents();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.applyQuality();
  }

  private saveSettings() {
    localStorage.setItem('cf_settings', JSON.stringify(this.settings));
  }

  async init() {
    await this.registry.preload((d, t) => this.ui.setLoading(d, t));
    const rep = this.registry.report;
    const notes: string[] = [];
    if (rep.loaded.length) notes.push(`已載入 GLB：${rep.loaded.length} 個`);
    if (rep.missing.length) notes.push(`未提供 GLB，使用程式化佔位模型：${rep.missing.length} 個`);
    if (rep.failed.length) notes.push(`⚠ GLB 載入失敗（已改用佔位）：${rep.failed.map((f) => f.id).join(', ')}`);
    this.ui.setAssetNote(notes.join('　·　'));

    this.player = new PlayerController(this.registry.create('player_cat_mage', undefined, 'BLUE', 0.025));
    this.player.onJump = () => this.audio.play('jump');
    this.player.onLand = (hard) => {
      this.audio.play('land');
      if (hard) this.fx.ring(this.player.body.pos.clone().add(new THREE.Vector3(0, 0.05, 0)), 0xffffff, 1.4, 0.3);
    };
    this.player.onDash = (dir) => {
      this.ui.speedLines();
      this.fx.speedLines(this.player.body.pos, dir);
    };
    this.scene.add(this.player.root);
    this.player.root.visible = false;

    this.ui.show('loading', false);
    this.toMenu();
    this.loop();
  }

  private wireEvents() {
    this.bus.on('phaseChanged', ({ phase, position }) => {
      const p = new THREE.Vector3(position.x, position.y + 0.05, position.z);
      const col = phase === 'RED' ? GameConfig.colors.RED : GameConfig.colors.BLUE;
      this.fx.ring(p, col, 2.2, 0.4);
      this.fx.sparks(p.clone().add(new THREE.Vector3(0, 0.5, 0)), col, 16, 4);
      this.fx.burst(p.clone().add(new THREE.Vector3(0, 0.7, 0)), 1.6, 0.3);
      this.ui.setPhase(phase);
      this.ui.flash(PHASE_HEX[phase]);
      this.audio.play('swap');
      this.hitStop = 0.04;
    });
    this.bus.on('swapFailed', ({ reason }) => {
      this.ui.toast(reason);
      this.audio.play('swapFail');
    });
    this.bus.on('warning', ({ text }) => {
      this.ui.toast('⚠ ' + text, 0.8);
      this.audio.play('warn');
    });
  }

  private applyQuality() {
    const q = QualityPresets[this.settings.quality as Quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.sun.castShadow = q.shadows;
    this.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    this.sun.shadow.map?.dispose();
    (this.sun.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
    setOutlinesVisible(q.outlines);
    if (this.player) this.level.applyGhosting(this.player.phase);
    this.fx.particleScale = q.particles;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => (x.needsUpdate = true));
    });
    this.resize();
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ———————————— 流程 ————————————

  private toMenu() {
    this.mode = 'menu';
    ['hud', 'pause', 'result', 'settings', 'gallery'].forEach((s) => this.ui.show(s as 'hud', false));
    this.ui.show('menu', true);
    this.cleanupLevel();
    this.buildMenuScene();
  }

  private buildMenuScene() {
    // 主選單背景：直接展示第一關
    const d = LEVELS[0];
    this.level.load(d);
    this.applyTheme(d.theme);
    this.player.root.visible = true;
    this.player.teleport(new THREE.Vector3(...d.spawn.position));
    this.phase.reset(this.player, d.spawn.phase);
    this.camTarget.copy(this.player.body.pos);
  }

  private cleanupLevel() {
    this.hunters.forEach((h) => this.scene.remove(h.root));
    this.hunters = [];
    this.boss?.dispose();
    this.boss = null;
    this.fx.clear();
    this.ui.setBoss(null);
    this.ui.setTimer(null);
  }

  private unlockStory(ids: string[]) {
    const s = new Set<string>(JSON.parse(localStorage.getItem('cf_story') ?? '[]'));
    ids.forEach((i) => s.add(i));
    localStorage.setItem('cf_story', JSON.stringify([...s]));
  }

  private async startLevel(index: number, withStory: boolean) {
    if (index >= LEVELS.length) return this.toMenu();
    this.levelIndex = index;
    const d = LEVELS[index];
    ['menu', 'pause', 'result', 'settings', 'gallery'].forEach((s) => this.ui.show(s as 'hud', false));
    this.cleanupLevel();
    this.level.load(d);
    this.applyTheme(d.theme);

    this.lives = GameConfig.player.lives;
    this.deaths = 0;
    this.levelTime = 0;
    this.dying = 0;
    this.bossDefeated = false;
    this.pendingFlip = 0;
    this.triggered.clear();
    this.seenTutorials.clear();
    this.timer = null;
    this.timerRunning = false;
    this.checkpoint = { pos: new THREE.Vector3(...d.spawn.position), phase: d.spawn.phase, id: '' };
    this.player.state = 'IDLE';
    this.player.invuln = 0;
    this.respawnPlayer();
    this.camYaw = GameConfig.camera.yaw;
    this.camDist = d.cameraDistance ?? GameConfig.camera.distance;
    this.camTarget.copy(this.player.body.pos);

    for (const h of d.hunters ?? []) {
      const hu = new HunterAI(h.id, this.registry.create('enemy_hunter', undefined, h.phase, 0.03), new THREE.Vector3(...h.spawn), h.phase);
      hu.onAlert = () => {
        this.audio.play('alert');
        this.fx.burst(hu.body.pos.clone().add(new THREE.Vector3(0, 1.8, 0)), 1.2, 0.5);
      };
      hu.root.userData.triggerId = h.triggerId;
      this.hunters.push(hu);
      this.scene.add(hu.root);
    }
    if (d.boss) {
      const pos = new THREE.Vector3(...d.boss.position);
      this.boss = new BossController(this.registry.create('boss_foreman', undefined, 'NEUTRAL', 0.06), pos, this.scene, {
        onImpact: (p, ph) => this.onBossImpact(p, ph),
        onBanner: (t, ph) => this.ui.showBanner(t, ph, 3.2),
        onHp: (hp, max) => this.ui.setBoss(hp, max),
        onStageChange: () => this.refreshBarrels(),
        onFlipTiles: () => {
          this.pendingFlip = 1.2;
          this.ui.showBanner('⚠ 場地相位即將翻轉！', null, 1.2);
          this.audio.play('warn');
        },
        onDefeated: () => this.onBossDefeated(),
      });
      this.refreshBarrels();
      const exit = this.level.objects.find((o) => o.def.interaction?.type === 'exit');
      if (exit) exit.root.visible = false;
    }

    this.ui.setLives(this.lives);
    this.ui.setGoal(`${d.chapter}〈${d.title}〉 ${d.objective}`);
    this.ui.setPhase(this.player.phase);
    this.ui.clearTransient();

    if (withStory) {
      this.mode = 'story';
      this.ui.show('hud', false);
      const seq: string[] = [];
      if (index === 0 && !localStorage.getItem('cf_prologue')) {
        seq.push(...PROLOGUE);
        localStorage.setItem('cf_prologue', '1');
      }
      seq.push(...(d.storyIntro ?? []));
      this.unlockStory(seq);
      await this.ui.story.play(seq);
    }
    this.mode = 'playing';
    this.ui.show('hud', true);
    this.ui.showBanner(`${d.chapter}〈${d.title}〉`, null, 2.2);
  }

  private applyTheme(t: { sky: number; fog: number; fogNear: number; fogFar: number }) {
    this.scene.background = new THREE.Color(t.sky);
    this.scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
  }

  private respawnPlayer() {
    this.player.teleport(this.checkpoint.pos.clone().add(new THREE.Vector3(0, 0.1, 0)));
    this.player.root.visible = true;
    this.player.model.rotation.y = Math.PI;
    this.player.facing = Math.PI;
    this.phase.reset(this.player, this.checkpoint.phase);
    this.ui.setPhase(this.checkpoint.phase);
    this.level.resetDynamic();
    if (this.boss) this.refreshBarrels();
  }

  private togglePause() {
    if (this.mode === 'playing') {
      this.mode = 'paused';
      this.ui.show('pause', true);
    } else if (this.mode === 'paused') {
      this.mode = 'playing';
      this.ui.show('pause', false);
      this.ui.show('settings', false);
    }
  }

  private die(reason: string, force = false) {
    if (this.dying > 0 || this.mode !== 'playing') return;
    if (this.player.invuln > 0 && !force) return;
    this.dying = 0.7;
    this.deaths++;
    this.lives--;
    this.ui.setLives(this.lives);
    this.ui.toast(reason, 1.5);
    this.ui.flash('#ffffff');
    this.audio.play('hurt');
    this.shake = 0.4;
    this.player.state = 'DEAD';
    this.fx.burst(this.player.body.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 2, 0.5);
  }

  private finishDeath() {
    if (this.lives <= 0) {
      this.mode = 'result';
      this.ui.show('hud', false);
      this.ui.showResult('任務失敗…', `<p>小墨的魔力耗盡了。</p><p>再試一次吧！相位與腳下地板同色才能站穩。</p>`, false);
      return;
    }
    this.player.state = 'IDLE';
    this.respawnPlayer();
    this.player.invuln = GameConfig.player.invulnTime;
    // 追逐狀態重置
    this.hunters.forEach((h) => h.deactivate());
    this.triggered.clear();
    const d = LEVELS[this.levelIndex];
    if (d.goal.timeLimit) {
      this.timerRunning = false;
      this.timer = null;
      this.ui.setTimer(null);
    }
  }

  private complete() {
    if (this.mode !== 'playing') return;
    this.mode = 'result';
    this.player.state = 'VICTORY';
    this.audio.play('win');
    this.fx.burst(this.player.body.pos.clone().add(new THREE.Vector3(0, 1, 0)), 3, 0.7);
    const d = LEVELS[this.levelIndex];
    const best = Number(localStorage.getItem('cf_progress') ?? 0);
    localStorage.setItem('cf_progress', String(Math.max(best, this.levelIndex + 1)));
    const last = this.levelIndex >= LEVELS.length - 1;
    setTimeout(async () => {
      this.ui.show('hud', false);
      if (d.storyOutro?.length) {
        this.unlockStory(d.storyOutro);
        await this.ui.story.play(d.storyOutro);
      }
      this.ui.showResult(
        last ? '全部章節通關！' : '通關！',
        `<p>${d.chapter}〈${d.title}〉</p><p>時間：<b>${this.levelTime.toFixed(1)}</b> 秒　失誤：<b>${this.deaths}</b> 次</p>` +
          (last ? '<p>小墨關閉了局部源爐……但整座群島仍在崩落。待續！</p>' : ''),
        !last,
      );
    }, 900);
  }

  // ———————————— Boss 互動 ————————————

  private barrels() {
    return this.level.objects.filter((o) => o.def.interaction?.type === 'explosive');
  }

  private refreshBarrels() {
    const stage = this.boss?.stage ?? 1;
    for (const b of this.barrels()) {
      const eligible = (b.def.interaction?.stage ?? 1) <= stage;
      if (!eligible) this.level.setActive(b, false);
      else if (!b.active && b.timer <= 0) this.level.setActive(b, true);
    }
  }

  private explode(b: RuntimeObject) {
    this.level.setActive(b, false);
    b.timer = GameConfig.boss.barrelRespawn;
    const p = b.root.position.clone().add(new THREE.Vector3(0, 0.8, 0));
    const col = b.phase === 'RED' ? GameConfig.colors.RED : GameConfig.colors.BLUE;
    this.fx.burst(p, 4.5, 0.6);
    this.fx.ring(b.root.position.clone().add(new THREE.Vector3(0, 0.1, 0)), col, 4, 0.5);
    this.fx.sparks(p, 0xffb020, 30, 8, 0.8);
    this.audio.play('explode');
    this.ui.flash('#ffd23a');
    this.hitStop = GameConfig.world.hitStop * 1.5;
    this.shake = 0.5;
  }

  private onBossImpact(pos: THREE.Vector3, ph: Phase): boolean {
    const col = ph === 'RED' ? GameConfig.colors.RED : GameConfig.colors.BLUE;
    this.fx.ring(pos.clone().add(new THREE.Vector3(0, 0.1, 0)), col, GameConfig.boss.slamRadius * 1.3, 0.4);
    this.fx.sparks(pos.clone().add(new THREE.Vector3(0, 0.3, 0)), col, 20, 6);
    this.shake = 0.35;
    this.audio.play('bossHit');
    const pp = this.player.body.pos;
    if (Math.hypot(pp.x - pos.x, pp.z - pos.z) < GameConfig.boss.slamRadius && Math.abs(pp.y - pos.y) < 1.6) this.die('被監工的重拳擊中！');

    if (GameConfig.boss.mode !== 'boss_punch') return false;
    let mismatch = false;
    for (const b of this.barrels()) {
      if (!b.active) continue;
      const d = Math.hypot(b.root.position.x - pos.x, b.root.position.z - pos.z);
      if (d > GameConfig.boss.barrelHitRadius) continue;
      if (b.phase === ph) {
        this.explode(b);
        this.ui.showBanner('命中！同色炸藥桶引爆，監工受到重創！', ph, 2);
        return true;
      }
      mismatch = true;
    }
    if (mismatch) this.ui.toast('相位不同，炸藥桶沒有反應！');
    return false;
  }

  private onBossDefeated() {
    this.bossDefeated = true;
    this.shake = 1;
    this.audio.play('explode');
    this.fx.burst(this.boss!.root.position.clone().add(new THREE.Vector3(0, 5, 0)), 8, 1);
    const exit = this.level.objects.find((o) => o.def.interaction?.type === 'exit');
    if (exit) exit.root.visible = true;
    this.ui.setGoal('出口已開啟！回到南側出口');
    this.ui.showTutorial('監工倒下了！出口已在南側開啟。', 4);
    this.barrels().forEach((b) => this.level.setActive(b, false));
  }

  private flipTiles() {
    for (const o of this.level.objects) {
      if (!o.def.flippable) continue;
      this.level.setObjectPhase(o, o.phase === 'RED' ? 'BLUE' : 'RED');
    }
    // 腳下地塊翻轉時給予寬限
    const g = this.player.body.ground;
    if (g && g.phase !== 'NEUTRAL' && g.phase !== this.player.phase) this.player.body.graceCollider = g;
    setTimeout(() => (this.player.body.graceCollider = null), GameConfig.phase.groundGrace * 1000 + 100);
    this.level.applyGhosting(this.player.phase);
    this.ui.flash('#b070ff');
    this.audio.play('swap');
  }

  // ———————————— 主迴圈 ————————————

  private loop = () => {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const frame = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += frame;

    if (this.input.justPressed('pause') && (this.mode === 'playing' || this.mode === 'paused')) this.togglePause();

    if (this.mode === 'playing') {
      if (this.hitStop > 0) {
        this.hitStop -= frame;
      } else {
        this.acc += frame;
        let steps = 0;
        while (this.acc >= FIXED_DT && steps < 8) {
          this.fixedUpdate(FIXED_DT, steps === 0);
          this.acc -= FIXED_DT;
          steps++;
        }
        if (steps === 8) this.acc = 0;
      }
    } else if (this.mode === 'menu') {
      this.level.update(frame, this.time);
      this.camYaw += frame * 0.08;
    }

    this.updateCamera(frame);
    this.fx.update(frame);
    this.ui.update(frame);
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  };

  private fixedUpdate(dt: number, firstStep: boolean) {
    const d = LEVELS[this.levelIndex];
    this.levelTime += dt;
    this.level.update(dt, this.levelTime);

    if (this.dying > 0) {
      this.dying -= dt;
      this.player.root.position.y += dt * 2;
      if (this.dying <= 0) this.finishDeath();
      return;
    }

    this.player.update(dt, this.input, this.camYaw, this.physics, true);
    this.phase.update(dt, this.player);
    const pp = this.player.body.pos;

    if (pp.y < GameConfig.world.killY) this.die('跌落深淵！', true);

    // 互動
    const swapPressed = firstStep && this.input.justPressed('swap');
    let nearPylon = false;
    for (const o of this.level.objects) {
      const it = o.def.interaction;
      if (!it || !o.active) continue;
      const op = o.root.position;
      const dist = Math.hypot(pp.x - op.x, pp.z - op.z);
      const dy = pp.y - op.y;
      const range = (it.range ?? 1) + this.player.body.halfWidth;
      const inRange = dist < range && dy > -0.6 && dy < 2.2;
      switch (it.type) {
        case 'phase_exchange':
          if (inRange) {
            nearPylon = true;
            if (this.settings.autoSwap ? o.phase !== this.player.phase || swapPressed : swapPressed) this.phase.trySwap(this.player, o.phase);
          }
          break;
        case 'checkpoint':
          if (inRange && this.checkpoint.id !== o.def.id) {
            this.checkpoint = { pos: new THREE.Vector3(op.x + 0.8, op.y, op.z), phase: this.player.phase, id: o.def.id };
            this.ui.toast('✔ 存檔點');
            this.audio.play('checkpoint');
            this.fx.ring(op.clone().add(new THREE.Vector3(0, 0.1, 0)), 0x36e0b0, 2, 0.5);
          }
          break;
        case 'exit':
          if (inRange && (d.goal.type === 'reach_exit' || this.bossDefeated)) this.complete();
          break;
        case 'enemy_trigger':
          if (inRange && !this.triggered.has(o.def.id)) {
            this.triggered.add(o.def.id);
            this.hunters.filter((h) => h.root.userData.triggerId === o.def.id).forEach((h) => h.activate());
            if (d.goal.timeLimit && !this.timerRunning) {
              this.timer = d.goal.timeLimit;
              this.timerRunning = true;
            }
          }
          break;
        case 'tutorial':
          if (inRange && !this.seenTutorials.has(o.def.id) && it.text) {
            this.seenTutorials.add(o.def.id);
            this.ui.showTutorial(it.text, 5.5);
          }
          break;
        case 'explosive':
          if (GameConfig.boss.mode === 'player_trigger' && inRange && o.phase === this.player.phase) {
            this.explode(o);
            this.boss?.damage();
          }
          break;
        case 'hazard':
          if (inRange) this.die('碰到危險區域！');
          break;
      }
    }
    if (swapPressed && !nearPylon) this.ui.toast('附近沒有可交換的物件');

    // 炸藥桶重生
    if (this.boss && !this.bossDefeated) {
      for (const b of this.barrels()) {
        if (b.timer > 0 && (b.timer -= dt) <= 0) this.refreshBarrels();
      }
    }

    // 追獵機
    for (const h of this.hunters) {
      if (h.update(dt, pp, this.physics)) this.die('被巡色者抓到了！');
    }

    // Boss
    if (this.boss) {
      this.boss.update(dt, pp, this.dying <= 0);
      if (this.pendingFlip > 0) {
        this.pendingFlip -= dt;
        const blink = Math.floor(this.pendingFlip * 10) % 2 === 0;
        for (const o of this.level.objects) if (o.def.flippable) o.root.visible = blink;
        if (this.pendingFlip <= 0) this.flipTiles();
      }
    }

    // 倒數
    if (this.timerRunning && this.timer !== null) {
      this.timer -= dt;
      this.ui.setTimer(this.timer);
      if (this.timer <= 0) {
        this.timerRunning = false;
        this.die('時間到！安全門關閉了', true);
      }
    }
  }

  private updateCamera(dt: number) {
    const c = GameConfig.camera;
    this.camYaw -= this.input.dragDX * c.dragSensitivity;
    this.camDist = THREE.MathUtils.clamp(this.camDist + this.input.wheel * 1.2, c.minDistance, c.maxDistance);
    const b = this.player?.body;
    if (b) {
      const want = b.pos.clone().add(new THREE.Vector3(b.vel.x, 0, b.vel.z).multiplyScalar(c.lead / GameConfig.player.speed));
      want.y = b.pos.y + 0.6;
      // 墜落時不要追太低，保持平台可讀
      if (this.mode === 'playing' && !b.onGround && b.vel.y < 0) want.y = Math.max(want.y, this.camTarget.y - 2);
      this.camTarget.lerp(want, Math.min(1, dt * c.followLerp));
    }
    const off = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(c.pitch),
      Math.sin(c.pitch),
      Math.cos(this.camYaw) * Math.cos(c.pitch),
    ).multiplyScalar(this.camDist);
    this.camera.position.copy(this.camTarget).add(off);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.6;
      this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
    }
    this.camera.lookAt(this.camTarget);
    this.sun.position.copy(this.camTarget).add(new THREE.Vector3(8, 18, 6));
    this.sun.target.position.copy(this.camTarget);
  }
}
