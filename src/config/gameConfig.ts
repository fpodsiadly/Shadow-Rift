/* eslint-disable import/no-named-as-default-member */
import Phaser from 'phaser';

// Tower typings
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

export const GAME_CONFIG = {
  startResources: 220,
  buildPhaseDuration: 18,
  interestRate: 0.05,
  upgradeDiscountPrep: 0.9,
  sellRefundPrep: 1,
  sellRefundWave: 0.7,
  placement: {
    bounds: { minX: 30, maxX: 930, minY: 30, maxY: 510 },
    minPathDistance: 34,
    minTowerDistance: 28,
    minRiftDistance: 90,
    snapGrid: 20
  }
};

// Utility to resolve tower tinting color (shared usage)
export function getTowerTint(type: TowerType, level: number) {
  const base = TOWER_COLOR[type] ?? 0xffffff;
  const boost = (level - 1) * 28;
  return Phaser.Display.Color.ValueToColor(base).brighten(boost).saturate(20).color;
}
