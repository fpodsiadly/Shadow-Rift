/* eslint-disable import/no-named-as-default-member */
import Phaser from 'phaser';

import { getTowerTint, TOWER_CONFIG } from '../config/gameConfig';
import type { TowerLevelStats, TowerType } from '../config/gameConfig';

type Point = { x: number; y: number };

export type { TowerConfig, TowerLevelStats, TowerType } from '../config/gameConfig';
export { TOWER_COLOR, TOWER_CONFIG } from '../config/gameConfig';

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
    const color = getTowerTint(this.type, this.level);
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
