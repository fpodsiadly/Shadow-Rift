/* eslint-disable import/no-named-as-default-member */
import Phaser from 'phaser';

type EnemyKind = 'hound' | 'puppet' | 'swarm' | 'brute' | 'watcher';
type EnemyState = 'advance' | 'dead';
type AuraMode = 'speed' | 'regen';
type Point = { x: number; y: number };

type EnemyConfig = {
  texture: string;
  speed: number;
  hp: number;
  reward?: number;
  speedBoostMultiplier?: number;
  speedBoostDuration?: number;
  auraRadius?: number;
  auraToggle?: number;
  speedBuff?: number;
  regenPerSecond?: number;
  aoeCap?: number;
  towerDamage?: number;
  towerRange?: number;
  attackCooldown?: number;
  blinkInterval?: number;
  blinkDistance?: number;
  summonInterval?: number;
  summonCount?: number;
};

type AuraInfo = {
  pos: Phaser.Math.Vector2;
  radius: number;
  mode: AuraMode;
  speedMult: number;
  regenPerSecond: number;
};

const ENEMY_CONFIG: Record<EnemyKind, EnemyConfig> = {
  hound: {
    texture: 'enemy-hound',
    speed: 120,
    hp: 42,
    reward: 8,
    speedBoostMultiplier: 2,
    speedBoostDuration: 0.8
  },
  puppet: {
    texture: 'enemy-puppet',
    speed: 60,
    hp: 180,
    reward: 18,
    auraRadius: 180,
    auraToggle: 4,
    speedBuff: 1.25,
    regenPerSecond: 6
  },
  swarm: {
    texture: 'enemy-swarm',
    speed: 95,
    hp: 65,
    reward: 6,
    aoeCap: 10
  },
  brute: {
    texture: 'enemy-brute',
    speed: 70,
    hp: 320,
    reward: 25,
    towerDamage: 26,
    towerRange: 70,
    attackCooldown: 1.6
  },
  watcher: {
    texture: 'enemy-puppet',
    speed: 52,
    hp: 480,
    reward: 120,
    auraRadius: 210,
    auraToggle: 3,
    speedBuff: 1.12,
    regenPerSecond: 8,
    blinkInterval: 5,
    blinkDistance: 0.1,
    summonInterval: 7,
    summonCount: 2
  }
};

class PathManager {
  readonly path: Phaser.Curves.Path;
  length: number;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly markers: Phaser.GameObjects.Arc[] = [];

  constructor(scene: Phaser.Scene, points: Point[]) {
    if (points.length < 2) {
      throw new Error('Path requires at least two points.');
    }

    this.path = new Phaser.Curves.Path(points[0].x, points[0].y);
    points.slice(1).forEach((p) => this.path.lineTo(p.x, p.y));
    this.length = this.path.getLength();

    this.graphics = scene.add.graphics();
    this.graphics.lineStyle(2, 0x4c5176, 0.8);
    this.path.draw(this.graphics, 64);

    points.forEach((p) => {
      const marker = scene.add.circle(p.x, p.y, 4, 0x9aa6ff, 0.9);
      marker.setDepth(1);
      this.markers.push(marker);
    });
  }

  getPoint(t: number): Phaser.Math.Vector2 {
    return this.path.getPoint(t);
  }

  distanceToPath(point: Phaser.Math.Vector2, samples = 80): number {
    let min = Number.MAX_VALUE;
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const p = this.path.getPoint(t);
      const d = Phaser.Math.Distance.BetweenPoints(point, p);
      if (d < min) min = d;
    }
    return min;
  }

  setPoints(points: Point[]) {
    this.graphics.clear();
    this.markers.forEach((m) => m.destroy());
    this.markers.length = 0;

    const nextPath = new Phaser.Curves.Path(points[0].x, points[0].y);
    points.slice(1).forEach((p) => nextPath.lineTo(p.x, p.y));
    // Replace curves on the existing Path instance so dependents retain their reference.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.path.curves = nextPath.curves;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.path.cacheLengths = nextPath.cacheLengths;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.path.startPoint = nextPath.startPoint;
    this.length = nextPath.getLength();

    this.graphics.lineStyle(2, 0x4c5176, 0.8);
    this.path.draw(this.graphics, 64);
    points.forEach((p) => {
      const marker = this.graphics.scene.add.circle(p.x, p.y, 4, 0x9aa6ff, 0.9);
      marker.setDepth(1);
      this.markers.push(marker);
    });
  }
}

class RiftHazard {
  private readonly scene: Phaser.Scene;
  private readonly pos: Phaser.Math.Vector2;
  private readonly radius: number;
  private readonly slowMultiplier: number;
  private sealProgress = 0;
  private sealed = false;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly fog: Phaser.GameObjects.Ellipse;

  constructor(scene: Phaser.Scene, pos: Point, radius = 140, slowMultiplier = 0.75) {
    this.scene = scene;
    this.pos = new Phaser.Math.Vector2(pos.x, pos.y);
    this.radius = radius;
    this.slowMultiplier = slowMultiplier;

    this.ring = scene.add.image(pos.x, pos.y, 'rift');
    this.ring.setDepth(4);

    this.fog = scene.add.ellipse(pos.x, pos.y, radius * 1.8, radius * 1.8, 0x7c3aed, 0.09);
    this.fog.setDepth(1);
  }

  update(dt: number, channeling: boolean) {
    if (this.sealed) return;
    const sealRate = 0.35;
    const decayRate = 0.08;
    if (channeling) {
      this.sealProgress = Math.min(1, this.sealProgress + dt * sealRate);
    } else {
      this.sealProgress = Math.max(0, this.sealProgress - dt * decayRate);
    }

    if (this.sealProgress >= 1) {
      this.sealed = true;
      this.ring.setTint(0x52ffa8);
      this.fog.setFillStyle(0x52ffa8, 0.06);
    }

    const alphaPulse = 0.06 + 0.04 * Math.sin(this.scene.time.now / 420);
    this.fog.setAlpha(this.sealed ? 0.05 : alphaPulse + 0.04 * (1 - this.sealProgress));
  }

  getSpeedMultiplier(target: Phaser.Math.Vector2) {
    if (this.sealed) return 1;
    return target.distance(this.pos) <= this.radius ? this.slowMultiplier : 1;
  }

  isSealed() {
    return this.sealed;
  }

  getSealProgress() {
    return this.sealProgress;
  }

  getPosition() {
    return this.pos.clone();
  }
}

class EnemyUnit {
  private readonly scene: Phaser.Scene;
  private readonly path: PathManager;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly kind: EnemyKind;
  private readonly cfg: EnemyConfig;
  private readonly onDeath: (reward: number) => void;
  private readonly spawnExtra: (kind: EnemyKind, progress?: number) => void;
  private progress = 0;
  private state: EnemyState = 'advance';
  private hp: number;
  private readonly maxHp: number;
  private boostTimer = 0;
  private auraMode: AuraMode = 'speed';
  private auraTimer = 0;
  private bruteCooldown = 0;
  private blinkTimer = 0;
  private summonTimer = 0;

  constructor(
    scene: Phaser.Scene,
    path: PathManager,
    kind: EnemyKind,
    onDeath: (reward: number) => void,
    spawnExtra: (kind: EnemyKind, progress?: number) => void,
    startProgress = 0
  ) {
    this.scene = scene;
    this.path = path;
    this.kind = kind;
    this.cfg = ENEMY_CONFIG[kind];
    this.onDeath = onDeath;
    this.spawnExtra = spawnExtra;
    this.hp = this.cfg.hp;
    this.maxHp = this.cfg.hp;
    this.progress = startProgress;

    const startPoint = this.path.getPoint(this.progress);
    this.sprite = scene.add.sprite(startPoint.x, startPoint.y, this.cfg.texture);
    this.sprite.setDepth(2);

    if (kind === 'puppet' || kind === 'watcher') {
      this.auraTimer = this.cfg.auraToggle ?? 0;
    }
    if (kind === 'watcher') {
      this.blinkTimer = this.cfg.blinkInterval ?? 4;
      this.summonTimer = this.cfg.summonInterval ?? 6;
    }
  }

  update(dt: number, ctx: { auras: AuraInfo[]; rift?: RiftHazard; towers: Tower[]; pathLength: number }) {
    if (this.state === 'dead') return;

    const aura = this.pickAura(ctx.auras);
    const speedBuff = aura && aura.mode === 'speed' ? aura.speedMult : 1;
    const regen = aura && aura.mode === 'regen' ? aura.regenPerSecond : 0;
    if (regen > 0) {
      this.hp = Math.min(this.maxHp, this.hp + regen * dt);
    }

    if (this.kind === 'brute') {
      this.attackNearbyTower(ctx.towers, dt);
    }

    if (this.kind === 'watcher') {
      this.tickWatcher(dt);
    }

    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
    }

    const riftMultiplier = ctx.rift ? ctx.rift.getSpeedMultiplier(this.getPosition()) : 1;
    const boostMultiplier = this.boostTimer > 0 ? this.cfg.speedBoostMultiplier ?? 1 : 1;
    const speed = this.cfg.speed * speedBuff * riftMultiplier * boostMultiplier;

    this.progress += (speed * dt) / ctx.pathLength;
    if (this.progress >= 1) {
      this.destroy();
      return;
    }

    const point = this.path.getPoint(this.progress);
    this.sprite.setPosition(point.x, point.y);
  }

  tickAura(dt: number): AuraInfo | null {
    if (this.state === 'dead' || (this.kind !== 'puppet' && this.kind !== 'watcher')) return null;
    this.auraTimer -= dt;
    if (this.auraTimer <= 0) {
      this.auraMode = this.auraMode === 'speed' ? 'regen' : 'speed';
      this.auraTimer = this.cfg.auraToggle ?? 0;
    }
    return {
      pos: this.getPosition(),
      radius: this.cfg.auraRadius ?? 0,
      mode: this.auraMode,
      speedMult: this.cfg.speedBuff ?? 1,
      regenPerSecond: this.cfg.regenPerSecond ?? 0
    };
  }

  takeDamage(amount: number) {
    if (this.state === 'dead') return;
    const capped = this.cfg.aoeCap ? Math.min(amount, this.cfg.aoeCap) : amount;
    this.hp -= capped;
    if (this.kind === 'hound') {
      this.boostTimer = this.cfg.speedBoostDuration ?? 0;
    }
    if (this.hp <= 0) {
      this.destroy();
    }
  }

  private attackNearbyTower(towers: Tower[], dt: number) {
    this.bruteCooldown -= dt;
    if (this.bruteCooldown > 0) return;
    const origin = this.getPosition();
    const towerRange = this.cfg.towerRange ?? 0;
    const towerDamage = this.cfg.towerDamage ?? 0;
    const tower = towers.find((t) => !t.isDestroyed() && origin.distance(t.getPosition()) <= towerRange);
    if (tower) {
      tower.takeDamage(towerDamage);
      this.bruteCooldown = this.cfg.attackCooldown ?? 1.5;
    }
  }

  private tickWatcher(dt: number) {
    this.blinkTimer -= dt;
    this.summonTimer -= dt;

    if (this.blinkTimer <= 0) {
      const step = this.cfg.blinkDistance ?? 0.1;
      this.progress = Math.min(0.97, this.progress + step);
      const point = this.path.getPoint(this.progress);
      this.sprite.setPosition(point.x, point.y);
      this.blinkTimer = this.cfg.blinkInterval ?? 4.5;
      const ripple = this.scene.add.circle(point.x, point.y, 8, 0x7c3aed, 0.35);
      ripple.setDepth(5);
      this.scene.tweens.add({ targets: ripple, radius: 50, alpha: 0, duration: 320, onComplete: () => ripple.destroy() });
    }

    if (this.summonTimer <= 0) {
      const count = this.cfg.summonCount ?? 2;
      const base = Math.max(0, this.progress - 0.04);
      for (let i = 0; i < count; i += 1) {
        this.spawnExtra('hound', base);
      }
      this.summonTimer = this.cfg.summonInterval ?? 6;
    }
  }

  private pickAura(auras: AuraInfo[]): AuraInfo | null {
    const pos = this.getPosition();
    for (const aura of auras) {
      if (pos.distance(aura.pos) <= aura.radius) return aura;
    }
    return null;
  }

  destroy() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.sprite.destroy();
    this.onDeath(this.cfg.reward ?? 0);
  }

  isDead() {
    return this.state === 'dead';
  }

  getPosition(): Phaser.Math.Vector2 {
    return this.sprite.getCenter();
  }
}

class Tower {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly range: number;
  private readonly fireRate: number;
  private readonly damage: number;
  private cooldown = 0;
  private hp = 180;
  private destroyed = false;

  constructor(scene: Phaser.Scene, position: Point, range = 210, fireRate = 0.8, damage = 16) {
    this.scene = scene;
    this.range = range;
    this.fireRate = fireRate;
    this.damage = damage;
    this.sprite = scene.add.sprite(position.x, position.y, 'tower');
    this.sprite.setDepth(2);
  }

  update(dt: number, enemies: EnemyUnit[], bullets: Bullet[]) {
    if (this.destroyed) return;
    this.cooldown -= dt;
    if (this.cooldown > 0) return;

    const target = this.findTarget(enemies);
    if (!target) return;

    bullets.push(new Bullet(this.scene, this.sprite.getCenter(), target, this.damage));
    this.cooldown = this.fireRate;
  }

  takeDamage(amount: number) {
    if (this.destroyed) return;
    this.hp -= amount;
    this.sprite.setAlpha(0.9 * Math.max(0.2, this.hp / 180));
    if (this.hp <= 0) {
      this.destroyed = true;
      this.sprite.destroy();
    }
  }

  isDestroyed() {
    return this.destroyed;
  }

  getPosition(): Phaser.Math.Vector2 {
    return this.sprite.getCenter();
  }

  private findTarget(enemies: EnemyUnit[]) {
    const origin = this.sprite.getCenter();
    let closest: EnemyUnit | null = null;
    let closestDist = Number.MAX_VALUE;

    enemies.forEach((enemy) => {
      if (enemy.isDead()) return;
      const dist = Phaser.Math.Distance.BetweenPoints(origin, enemy.getPosition());
      if (dist <= this.range && dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    });

    return closest;
  }
}

class Bullet {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly speed = 340;
  private readonly damage: number;
  private target: EnemyUnit;
  private alive = true;

  constructor(scene: Phaser.Scene, start: Point, target: EnemyUnit, damage: number) {
    this.target = target;
    this.damage = damage;
    this.sprite = scene.add.sprite(start.x, start.y, 'bullet');
    this.sprite.setDepth(3);
  }

  update(dt: number) {
    if (!this.alive) return;
    if (this.target.isDead()) {
      this.destroy();
      return;
    }

    const targetPos = this.target.getPosition();
    const current = this.sprite.getCenter();
    const toTarget = targetPos.clone().subtract(current);
    const distance = toTarget.length();

    if (distance < 1) {
      this.hit();
      return;
    }

    const step = this.speed * dt;
    if (distance <= step) {
      this.sprite.setPosition(targetPos.x, targetPos.y);
      this.hit();
      return;
    }

    const direction = toTarget.normalize();
    this.sprite.x += direction.x * step;
    this.sprite.y += direction.y * step;
  }

  private hit() {
    if (!this.alive) return;
    this.target.takeDamage(this.damage);
    this.destroy();
  }

  private destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
  }

  isAlive() {
    return this.alive;
  }
}

export default class GameScene extends Phaser.Scene {
  private pathManager!: PathManager;
  private enemies: EnemyUnit[] = [];
  private towers: Tower[] = [];
  private bullets: Bullet[] = [];
  private hudText?: Phaser.GameObjects.Text;
  private waveText?: Phaser.GameObjects.Text;
  private waveInfoText?: Phaser.GameObjects.Text;
  private sealBarBg?: Phaser.GameObjects.Rectangle;
  private sealBarFill?: Phaser.GameObjects.Rectangle;
  private placementGhost?: Phaser.GameObjects.Sprite;
  private placementText?: Phaser.GameObjects.Text;
  private rift?: RiftHazard;
  private sealKey?: Phaser.Input.Keyboard.Key;
  private resources = 150;
  private readonly towerCost = 70;
  private useAltPath = false;
  private lastReward = 0;
  private lastRewardTimer = 0;
  private sealPulseTimer = 0;

  private elapsed = 0;
  private wave = 1;
  private waveCooldown = 3;
  private pendingSpawns = 0;
  private spawnTimer = 0;
  private spawnInterval = 1.1;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.drawBackdrop();
    this.pathManager = new PathManager(this, this.buildPath());
    this.towers = this.buildTowers();
    this.rift = new RiftHazard(this, { x: 520, y: 320 });
    this.sealKey = this.input.keyboard?.addKey('S');

    this.placementGhost = this.add.sprite(0, 0, 'tower-ghost-bad');
    this.placementGhost.setDepth(9);
    this.placementGhost.setAlpha(0.75);
    this.placementGhost.setVisible(false);

    this.placementText = this.add.text(0, 0, '', {
      fontSize: '12px',
      color: '#e4e4ec',
      fontFamily: 'Montserrat, sans-serif'
    });
    this.placementText.setDepth(9);
    this.placementText.setVisible(false);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.tryPlaceTower({ x: pointer.worldX, y: pointer.worldY });
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.updatePlacementGhost({ x: pointer.worldX, y: pointer.worldY });
    });

    this.hudText = this.add.text(12, 12, 'Shadow Rift', {
      fontSize: '16px',
      color: '#e4e4ec',
      fontFamily: 'Montserrat, sans-serif'
    });
    this.hudText.setDepth(10);

    this.waveText = this.add.text(480, 40, '', {
      fontSize: '22px',
      color: '#e0ddff',
      fontFamily: 'Montserrat, sans-serif'
    });
    this.waveText.setOrigin(0.5, 0);
    this.waveText.setDepth(10);

    this.waveInfoText = this.add.text(720, 12, '', {
      fontSize: '14px',
      color: '#c8d0ff',
      fontFamily: 'Montserrat, sans-serif'
    });
    this.waveInfoText.setDepth(10);

    this.sealBarBg = this.add.rectangle(480, 518, 360, 12, 0x202033, 0.9);
    this.sealBarBg.setDepth(9);
    this.sealBarFill = this.add.rectangle(300, 518, 0, 12, 0x7c3aed, 0.9);
    this.sealBarFill.setOrigin(0, 0.5);
    this.sealBarFill.setDepth(10);
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.elapsed += dt;

    this.lastRewardTimer = Math.max(0, this.lastRewardTimer - dt);

    if (this.rift) {
      const channeling = !!this.sealKey && this.sealKey.isDown;
      this.rift.update(dt, channeling);
      if (this.sealBarFill && this.sealBarBg) {
        const progress = this.rift.getSealProgress();
        const width = 360 * progress;
        this.sealBarFill.width = width;
        this.sealBarFill.fillColor = this.rift.isSealed() ? 0x52ffa8 : 0x7c3aed;
      }
      if (channeling && !this.rift.isSealed()) {
        this.sealPulseTimer -= dt;
        if (this.sealPulseTimer <= 0) {
          this.spawnSealPulse();
          this.sealPulseTimer = 0.35;
        }
      }
    }

    this.updateWaves(dt);

    const auras = this.collectAuras(dt);

    this.enemies.forEach((e) => e.update(dt, { auras, rift: this.rift, towers: this.towers, pathLength: this.pathManager.length }));
    this.enemies = this.enemies.filter((e) => !e.isDead());

    this.towers.forEach((t) => t.update(dt, this.enemies, this.bullets));
    this.towers = this.towers.filter((t) => !t.isDestroyed());

    this.bullets.forEach((b) => b.update(dt));
    this.bullets = this.bullets.filter((b) => b.isAlive());

    if (this.hudText) {
      const seal = this.rift ? (this.rift.isSealed() ? 'sealed' : `${Math.round(this.rift.getSealProgress() * 100)}%`) : 'n/a';
      const cd = this.pendingSpawns > 0 ? `spawning` : `${this.waveCooldown.toFixed(1)}s`;
      this.hudText.setText(
        `Wave ${this.wave}\nNext wave: ${cd}\nEnemies: ${this.enemies.length}\nTowers: ${this.towers.length}\nResources: ${this.resources} (cost ${this.towerCost})${
          this.lastRewardTimer > 0 ? ` [+${this.lastReward}]` : ''
        }\nRift seal: ${seal}\nClick to place tower\nHold [S] to seal`
      );
    }

    if (this.waveInfoText) {
      this.waveInfoText.setText(this.describeNextWave());
    }
  }

  private updateWaves(dt: number) {
    if (this.pendingSpawns <= 0) {
      this.waveCooldown -= dt;
      if (this.waveCooldown <= 0) {
        this.startWave();
      }
      return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.pendingSpawns > 0) {
      this.spawnEnemy(this.pickKind());
      this.pendingSpawns -= 1;
      this.spawnTimer = this.spawnInterval + (this.rift?.isSealed() ? 0.2 : 0);
    }
  }

  private collectAuras(dt: number): AuraInfo[] {
    const results: AuraInfo[] = [];
    this.enemies.forEach((e) => {
      const aura = e.tickAura(dt);
      if (aura) results.push(aura);
    });
    return results;
  }

  private startWave() {
    const spec = this.buildWaveSpec(this.wave);
    this.pendingSpawns = spec.count;
    this.spawnInterval = spec.interval;
    this.spawnTimer = 0.2;
    this.waveCooldown = spec.rest;
    this.alertWave(`Wave ${this.wave} incoming`);
    this.wave += 1;
  }

  private buildWaveSpec(wave: number) {
    const count = 6 + Math.floor(wave * 2.4);
    const interval = Math.max(0.55, 1 - wave * 0.05);
    const rest = Math.max(4, 7 - wave * 0.15);
    const weights: Record<EnemyKind, number> = {
      hound: 6,
      swarm: Math.max(2, wave - 1),
      puppet: wave >= 3 ? 1 : 0,
      brute: wave >= 4 ? 1 : 0,
      watcher: wave >= 6 && wave % 3 === 0 ? 1 : 0
    };
    return { count, interval, rest, weights };
  }

  private pickKind(): EnemyKind {
    const spec = this.buildWaveSpec(this.wave - 1);
    const entries = Object.entries(spec.weights) as [EnemyKind, number][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    const r = Math.random() * total;
    let acc = 0;
    for (const [kind, w] of entries) {
      acc += w;
      if (r <= acc) return kind;
    }
    return 'hound';
  }

  private describeNextWave() {
    const spec = this.buildWaveSpec(this.wave);
    const entries = Object.entries(spec.weights).filter(([, w]) => w > 0) as [EnemyKind, number][];
    const parts = entries.map(([k, w]) => `${k}:${w}`);
    return `Next wave: ${parts.join(' | ')}`;
  }

  private spawnEnemy(kind: EnemyKind, startProgress = 0) {
    const enemy = new EnemyUnit(
      this,
      this.pathManager,
      kind,
      (reward) => this.addResources(reward),
      (k, p) => this.spawnEnemy(k, p),
      startProgress
    );
    this.enemies.push(enemy);
    if (kind === 'watcher') {
      this.togglePath();
    }
  }

  private buildPath(): Point[] {
    return [
      { x: 64, y: 480 },
      { x: 200, y: 420 },
      { x: 340, y: 420 },
      { x: 520, y: 320 },
      { x: 700, y: 360 },
      { x: 860, y: 200 }
    ];
  }

  private buildAltPath(): Point[] {
    return [
      { x: 64, y: 420 },
      { x: 220, y: 320 },
      { x: 400, y: 360 },
      { x: 620, y: 260 },
      { x: 780, y: 320 },
      { x: 880, y: 160 }
    ];
  }

  private buildTowers() {
    const placements: Point[] = [
      { x: 260, y: 340 },
      { x: 460, y: 260 },
      { x: 720, y: 300 }
    ];
    return placements.map((p) => new Tower(this, p));
  }

  private tryPlaceTower(pos: Point) {
    const check = this.isPlacementAllowed(pos);
    if (!check.valid) return;
    this.towers.push(new Tower(this, pos));
    this.resources -= this.towerCost;
    this.flashPlacement(pos);
  }

  private isPlacementAllowed(pos: Point) {
    if (pos.x < 30 || pos.x > 930 || pos.y < 30 || pos.y > 510) {
      return { valid: false, reason: 'out-of-bounds' };
    }
    if (this.resources < this.towerCost) {
      return { valid: false, reason: 'no-resources' };
    }
    const pt = new Phaser.Math.Vector2(pos.x, pos.y);
    if (this.pathManager.distanceToPath(pt) < 34) {
      return { valid: false, reason: 'too-close-to-path' };
    }
    if (this.rift && pt.distance(this.rift.getPosition()) < 90) {
      return { valid: false, reason: 'near-rift' };
    }
    const blocked = this.towers.some((t) => t.getPosition().distance(pt) < 56);
    if (blocked) {
      return { valid: false, reason: 'too-close-to-tower' };
    }
    return { valid: true, reason: '' };
  }

  private updatePlacementGhost(pos: Point) {
    if (!this.placementGhost || !this.placementText) return;
    this.placementGhost.setVisible(true);
    this.placementText.setVisible(true);
    this.placementGhost.setPosition(pos.x, pos.y);
    this.placementText.setPosition(pos.x + 28, pos.y - 12);

    const check = this.isPlacementAllowed(pos);
    const texture = check.valid ? 'tower-ghost-ok' : 'tower-ghost-bad';
    this.placementGhost.setTexture(texture);
    this.placementGhost.setAlpha(check.valid ? 0.9 : 0.6);
    this.placementText.setText(check.valid ? `Place (${this.towerCost})` : 'Blocked');
    this.placementText.setColor(check.valid ? '#88ffb7' : '#ff6b6b');
  }

  private flashPlacement(pos: Point) {
    const circle = this.add.circle(pos.x, pos.y, 6, 0x88ffb7, 0.5);
    circle.setDepth(8);
    this.tweens.add({ targets: circle, radius: 40, alpha: 0, duration: 280, onComplete: () => circle.destroy() });
  }

  private spawnSealPulse() {
    if (!this.rift) return;
    const pos = this.rift.getPosition();
    const ring = this.add.circle(pos.x, pos.y, 24, 0x7c3aed, 0.25);
    ring.setDepth(5);
    this.tweens.add({ targets: ring, radius: 120, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
  }

  private addResources(amount: number) {
    this.resources += amount;
    this.lastReward = amount;
    this.lastRewardTimer = 1.6;
  }

  private drawBackdrop() {
    const g = this.add.graphics();
    g.fillStyle(0x0b0b12, 1);
    g.fillRect(0, 0, 960, 540);

    g.lineStyle(1, 0x1a1c2c, 0.65);
    for (let x = 0; x <= 960; x += 40) {
      g.lineBetween(x, 0, x, 540);
    }
    for (let y = 0; y <= 540; y += 40) {
      g.lineBetween(0, y, 960, y);
    }

    const vignette = this.add.rectangle(480, 270, 960, 540, 0x000000, 0.08);
    vignette.setDepth(9);
  }

  private alertWave(message: string) {
    if (!this.waveText) return;
    this.waveText.setText(message);
    this.waveText.setAlpha(1);
    this.tweens.killTweensOf(this.waveText);
    this.tweens.add({ targets: this.waveText, alpha: 0, duration: 1800, delay: 600 });
  }

  private togglePath() {
    this.useAltPath = !this.useAltPath;
    const points = this.useAltPath ? this.buildAltPath() : this.buildPath();
    this.pathManager.setPoints(points);
    this.cameras.main.flash(200, 124, 58, 237);
    this.alertWave('Path shifted!');
  }
}
