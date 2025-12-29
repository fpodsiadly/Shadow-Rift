/* eslint-disable import/no-named-as-default-member */
import Phaser from 'phaser';

type Point = { x: number; y: number };

export type TowerType = 'basic' | 'slow' | 'splash' | 'sniper';

export type TowerLevelStats = {
  range: number;
  fireRate: number;
  damage: number;
  bulletSpeed: number;
  cost: number;
  slowPercent?: number;
  slowDuration?: number;
  splashRadius?: number;
  critChance?: number;
  critMultiplier?: number;
};

export type TowerConfig = {
  texture: string;
  levels: TowerLevelStats[];
};

export const TOWER_CONFIG: Record<TowerType, TowerConfig> = {
  basic: {
    texture: 'tower',
    levels: [
      { range: 170, fireRate: 0.8, damage: 16, bulletSpeed: 340, cost: 65 },
      { range: 185, fireRate: 0.75, damage: 20, bulletSpeed: 360, cost: 105 },
      { range: 200, fireRate: 0.68, damage: 25, bulletSpeed: 380, cost: 145 }
    ]
  },
  slow: {
    texture: 'tower-slow',
    levels: [
      { range: 155, fireRate: 0.9, damage: 9, bulletSpeed: 320, slowPercent: 0.35, slowDuration: 1.6, cost: 60 },
      { range: 170, fireRate: 0.82, damage: 11, bulletSpeed: 340, slowPercent: 0.42, slowDuration: 1.8, cost: 90 },
      { range: 185, fireRate: 0.74, damage: 13, bulletSpeed: 360, slowPercent: 0.5, slowDuration: 2.1, cost: 130 }
    ]
  },
  splash: {
    texture: 'tower-splash',
    levels: [
      { range: 165, fireRate: 1.05, damage: 24, bulletSpeed: 310, splashRadius: 55, cost: 75 },
      { range: 180, fireRate: 0.95, damage: 30, bulletSpeed: 330, splashRadius: 65, cost: 115 },
      { range: 195, fireRate: 0.85, damage: 38, bulletSpeed: 360, splashRadius: 75, cost: 155 }
    ]
  },
  sniper: {
    texture: 'tower-sniper',
    levels: [
      { range: 260, fireRate: 1.55, damage: 50, bulletSpeed: 520, critChance: 0.25, critMultiplier: 2, cost: 90 },
      { range: 290, fireRate: 1.36, damage: 63, bulletSpeed: 560, critChance: 0.32, critMultiplier: 2.2, cost: 135 },
      { range: 320, fireRate: 1.22, damage: 78, bulletSpeed: 600, critChance: 0.38, critMultiplier: 2.5, cost: 185 }
    ]
  }
};

export const TOWER_COLOR: Record<TowerType, number> = {
  basic: 0x88ffb7,
  slow: 0x7bd7ff,
  splash: 0xffb347,
  sniper: 0xc8a8ff
};

export type EnemyTarget = {
  getPosition(): Phaser.Math.Vector2;
  takeDamage(amount: number): void;
  applySlow(percent: number, duration: number): void;
  isDead(): boolean;
};

export class Tower {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly type: TowerType;
  private level: number;
  private stats: TowerLevelStats;
  private cooldown = 0;
  private hp = 180;
  private destroyed = false;
  private invested: number;

  constructor(scene: Phaser.Scene, position: Point, type: TowerType, level = 1) {
    this.scene = scene;
    this.type = type;
    const cfg = TOWER_CONFIG[type];
    this.level = Math.min(level, cfg.levels.length);
    this.stats = this.computeStats();
    this.invested = cfg.levels[0]?.cost ?? 0;
    this.sprite = scene.add.sprite(position.x, position.y, cfg.texture);
    this.sprite.setDepth(2);
    this.applyLevelTint();
  }

  update(dt: number, enemies: EnemyTarget[], bullets: Bullet[]) {
    if (this.destroyed) return;
    this.cooldown -= dt;
    if (this.cooldown > 0) return;

    const target = this.findTarget(enemies);
    if (!target) return;

    bullets.push(new Bullet(this.scene, this.sprite.getCenter(), target, enemies, this.stats));
    this.cooldown = this.stats.fireRate;
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

  upgrade(costPaid?: number): boolean {
    const cfg = TOWER_CONFIG[this.type];
    if (this.level >= cfg.levels.length) return false;
    const nextCost = costPaid ?? cfg.levels[this.level].cost;
    this.invested += nextCost;
    this.level += 1;
    this.stats = this.computeStats();
    this.applyLevelTint();
    return true;
  }

  getNextCost(): number | null {
    const cfg = TOWER_CONFIG[this.type];
    if (this.level >= cfg.levels.length) return null;
    return cfg.levels[this.level].cost;
  }

  getLevel() {
    return this.level;
  }

  getType() {
    return this.type;
  }

  getStats() {
    return this.stats;
  }

  getNextStats(): TowerLevelStats | null {
    const cfg = TOWER_CONFIG[this.type];
    if (this.level >= cfg.levels.length) return null;
    return cfg.levels[this.level];
  }

  isDestroyed() {
    return this.destroyed;
  }

  getSellValue(refundRatio = 0.7) {
    return Math.floor(this.invested * refundRatio);
  }

  destroyTower() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.sprite.destroy();
  }

  getPosition(): Phaser.Math.Vector2 {
    return this.sprite.getCenter();
  }

  private computeStats(): TowerLevelStats {
    const cfg = TOWER_CONFIG[this.type];
    const idx = Math.min(this.level - 1, cfg.levels.length - 1);
    return cfg.levels[idx];
  }

  private applyLevelTint() {
    const base = TOWER_COLOR[this.type] ?? 0xffffff;
    const boost = (this.level - 1) * 28;
    const color = Phaser.Display.Color.ValueToColor(base).brighten(boost).saturate(20).color;
    this.sprite.setTint(color);
    this.sprite.setScale(1 + (this.level - 1) * 0.12);
    this.sprite.setAlpha(0.9 + (this.level - 1) * 0.04);
    this.sprite.setBlendMode(Phaser.BlendModes.ADD);
  }

  private findTarget(enemies: EnemyTarget[]) {
    const origin = this.sprite.getCenter();
    let closest: EnemyTarget | null = null;
    let closestDist = Number.MAX_VALUE;

    enemies.forEach((enemy) => {
      if (enemy.isDead()) return;
      const dist = Phaser.Math.Distance.BetweenPoints(origin, enemy.getPosition());
      if (dist <= this.stats.range && dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    });

    return closest;
  }
}

export class Bullet {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly stats: TowerLevelStats;
  private readonly enemies: EnemyTarget[];
  private target: EnemyTarget;
  private alive = true;

  constructor(scene: Phaser.Scene, start: Point, target: EnemyTarget, enemies: EnemyTarget[], stats: TowerLevelStats) {
    this.target = target;
    this.enemies = enemies;
    this.stats = stats;
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

    const step = this.stats.bulletSpeed * dt;
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
    const crit = this.stats.critChance && Math.random() < this.stats.critChance;
    const critMul = crit ? this.stats.critMultiplier ?? 1 : 1;
    const damage = this.stats.damage * critMul;
    const splash = this.stats.splashRadius ?? 0;
    const slowP = this.stats.slowPercent ?? 0;
    const slowDur = this.stats.slowDuration ?? 0;

    const impactPos = this.sprite.getCenter();
    const applyHit = (enemy: EnemyTarget) => {
      enemy.takeDamage(damage);
      if (slowP > 0) enemy.applySlow(slowP, slowDur);
    };

    if (splash > 0) {
      this.enemies.forEach((enemy) => {
        if (enemy.isDead()) return;
        if (Phaser.Math.Distance.BetweenPoints(enemy.getPosition(), impactPos) <= splash) {
          applyHit(enemy);
        }
      });
    } else {
      applyHit(this.target);
    }

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
