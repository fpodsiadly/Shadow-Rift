/* eslint-disable import/no-named-as-default-member */
import Phaser from 'phaser';

import { Tower } from './towers';
import { PathManager, RiftHazard } from './world';

type EnemyState = 'advance' | 'dead';
export type EnemyKind = 'hound' | 'puppet' | 'swarm' | 'brute' | 'watcher';
export type AuraMode = 'speed' | 'regen';

export type EnemyConfig = {
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

export type AuraInfo = {
  pos: Phaser.Math.Vector2;
  radius: number;
  mode: AuraMode;
  speedMult: number;
  regenPerSecond: number;
};

export const ENEMY_CONFIG: Record<EnemyKind, EnemyConfig> = {
  hound: {
    texture: 'enemy-hound',
    speed: 110,
    hp: 38,
    reward: 10,
    speedBoostMultiplier: 2,
    speedBoostDuration: 0.8
  },
  puppet: {
    texture: 'enemy-puppet',
    speed: 56,
    hp: 160,
    reward: 22,
    auraRadius: 180,
    auraToggle: 4,
    speedBuff: 1.2,
    regenPerSecond: 5
  },
  swarm: {
    texture: 'enemy-swarm',
    speed: 88,
    hp: 58,
    reward: 8,
    aoeCap: 10
  },
  brute: {
    texture: 'enemy-brute',
    speed: 64,
    hp: 280,
    reward: 32,
    towerDamage: 22,
    towerRange: 70,
    attackCooldown: 1.7
  },
  watcher: {
    texture: 'enemy-puppet',
    speed: 48,
    hp: 430,
    reward: 140,
    auraRadius: 210,
    auraToggle: 3,
    speedBuff: 1.08,
    regenPerSecond: 7,
    blinkInterval: 5.2,
    blinkDistance: 0.1,
    summonInterval: 7.2,
    summonCount: 2
  }
};

export class EnemyUnit {
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
  private slowTimer = 0;
  private slowFactor = 1;

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
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowFactor = 1;
      }
    }

    const riftMultiplier = ctx.rift ? ctx.rift.getSpeedMultiplier(this.getPosition()) : 1;
    const boostMultiplier = this.boostTimer > 0 ? this.cfg.speedBoostMultiplier ?? 1 : 1;
    const speed = this.cfg.speed * speedBuff * riftMultiplier * boostMultiplier * this.slowFactor;

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

  applySlow(percent: number, duration: number) {
    if (percent <= 0 || duration <= 0) return;
    const factor = Math.max(0.2, 1 - percent);
    if (factor < this.slowFactor || this.slowTimer <= 0) {
      this.slowFactor = factor;
      this.slowTimer = duration;
    } else if (factor === this.slowFactor) {
      this.slowTimer = Math.max(this.slowTimer, duration);
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
