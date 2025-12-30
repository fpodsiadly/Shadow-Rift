/* eslint-disable import/no-named-as-default-member */
import Phaser from 'phaser';

import { GAME_CONFIG, getTowerTint } from '../config/gameConfig';

import { Tower, TowerType } from './towers';
import { Point, PathManager, RiftHazard } from './world';

export type PlacementDeps = {
  scene: Phaser.Scene;
  pathManager: PathManager;
  getRift: () => RiftHazard | undefined;
  getTowers: () => Tower[];
  getResources: () => number;
  spendResources: (amount: number) => void;
  selectedType: () => TowerType;
  getSelectedCost: () => number;
  addTower: (tower: Tower) => void;
  selectTower: (tower: Tower) => void;
  flashPlacement: (pos: Point) => void;
  showPopup: (pos: Point, text: string, color: string) => void;
  findTowerAt: (pos: Point) => Tower | null;
};

export class PlacementManager {
  private readonly deps: PlacementDeps;
  private pendingPlacement: Point | null = null;
  private snapEnabled = true;
  private ghost?: Phaser.GameObjects.Sprite;
  private ghostText?: Phaser.GameObjects.Text;

  constructor(deps: PlacementDeps) {
    this.deps = deps;
  }

  setGhosts(ghost: Phaser.GameObjects.Sprite | undefined, text: Phaser.GameObjects.Text | undefined) {
    this.ghost = ghost;
    this.ghostText = text;
  }

  toggleSnap() {
    this.snapEnabled = !this.snapEnabled;
  }

  cancel() {
    this.pendingPlacement = null;
    this.ghost?.setVisible(false);
    this.ghostText?.setVisible(false);
  }

  tryPlace(pos: Point) {
    const snapped = this.getSnappedPoint(pos);
    const check = this.isPlacementAllowed(snapped);

    if (!this.pendingPlacement) {
      this.pendingPlacement = snapped;
      if (this.ghostText) {
        this.ghostText.setText(check.valid ? 'Click to confirm' : `Blocked: ${check.reason}`);
        this.ghostText.setColor(check.valid ? '#b0ffd6' : '#ff6b6b');
      }
      return;
    }

    const nearPending = Phaser.Math.Distance.Between(snapped.x, snapped.y, this.pendingPlacement.x, this.pendingPlacement.y) < 14;
    if (!nearPending) {
      this.pendingPlacement = snapped;
      return;
    }

    if (!check.valid) {
      this.deps.showPopup(snapped, `Blocked: ${check.reason}`, '#ff6b6b');
      return;
    }

    const tower = new Tower(this.deps.scene, snapped, this.deps.selectedType());
    this.deps.addTower(tower);
    this.deps.spendResources(this.deps.getSelectedCost());
    this.pendingPlacement = null;
    this.deps.flashPlacement(snapped);
    this.deps.showPopup(snapped, `Built ${tower.getType()}`, '#9ef7c2');
    this.deps.selectTower(tower);
  }

  updateGhost(pos: Point) {
    if (!this.ghost || !this.ghostText) return;
    const snapped = this.getSnappedPoint(pos);
    const hoveredTower = this.deps.findTowerAt(snapped);
    this.ghost.setPosition(snapped.x, snapped.y);
    this.ghostText.setPosition(snapped.x + 28, snapped.y - 12);

    if (hoveredTower) {
      const levelInfo = `Lv ${hoveredTower.getLevel()} ${hoveredTower.getType()}`;
      this.ghost.setVisible(false);
      this.ghostText.setVisible(true);
      this.ghostText.setText(levelInfo);
      this.ghostText.setColor('#c8d0ff');
      return;
    }

    this.ghost.setVisible(true);
    this.ghostText.setVisible(true);

    const check = this.isPlacementAllowed(snapped);
    const texture = check.valid ? 'tower-ghost-ok' : 'tower-ghost-bad';
    this.ghost.setTexture(texture);
    this.ghost.setAlpha(check.valid ? 0.9 : 0.6);
    this.ghost.setTint(getTowerTint(this.deps.selectedType(), 1));
    const hasPending = !!this.pendingPlacement;
    this.ghostText.setText(check.valid ? (hasPending ? 'Confirm' : `Place (${this.deps.getSelectedCost()})`) : `Blocked: ${check.reason}`);
    this.ghostText.setColor(check.valid ? '#88ffb7' : '#ff6b6b');
  }

  private getSnappedPoint(pos: Point): Point {
    if (!this.snapEnabled) return pos;
    const grid = GAME_CONFIG.placement.snapGrid;
    return {
      x: Math.round(pos.x / grid) * grid,
      y: Math.round(pos.y / grid) * grid
    };
  }

  private isPlacementAllowed(pos: Point) {
    const { bounds, minPathDistance, minTowerDistance, minRiftDistance } = GAME_CONFIG.placement;
    if (pos.x < bounds.minX || pos.x > bounds.maxX || pos.y < bounds.minY || pos.y > bounds.maxY) {
      return { valid: false, reason: 'out-of-bounds' };
    }
    if (this.deps.getResources() < this.deps.getSelectedCost()) {
      return { valid: false, reason: 'no-resources' };
    }
    const pt = new Phaser.Math.Vector2(pos.x, pos.y);
    if (this.deps.pathManager.distanceToPath(pt) < minPathDistance) {
      return { valid: false, reason: 'too-close-to-path' };
    }
    const rift = this.deps.getRift();
    if (rift && pt.distance(rift.getPosition()) < minRiftDistance) {
      return { valid: false, reason: 'near-rift' };
    }
    const blocked = this.deps.getTowers().some((t) => t.getPosition().distance(pt) < minTowerDistance);
    if (blocked) {
      return { valid: false, reason: 'too-close-to-tower' };
    }
    return { valid: true, reason: '' };
  }
}
