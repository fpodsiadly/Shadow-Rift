/* eslint-disable import/no-named-as-default-member */
import Phaser from 'phaser';

import { GAME_CONFIG, getTowerTint, TOWER_CONFIG } from '../config/gameConfig';
import { EnemyKind, EnemyUnit, AuraInfo } from '../game/enemies';
import { PlacementManager } from '../game/placement';
import { Bullet, Tower, TowerType } from '../game/towers';
import { buildWaveSpec, describeNextWave, pickKind } from '../game/waves';
import { buildAltPath, buildPath, PathManager, Point, RiftHazard } from '../game/world';
import { buildStartWaveButton, StartButtonUi, updateStartButtonState } from '../ui/startButton';
import { buildTypeSelector, TypeSelectorUi, updateTypeSelectorHighlight } from '../ui/typeSelector';

export default class GameScene extends Phaser.Scene {
  private pathManager!: PathManager;
  private enemies: EnemyUnit[] = [];
  private towers: Tower[] = [];
  private bullets: Bullet[] = [];
  private selectedTower: Tower | null = null;
  private rangeCircle?: Phaser.GameObjects.Arc;
  private nextRangeCircle?: Phaser.GameObjects.Arc;
  private hudText?: Phaser.GameObjects.Text;
  private waveText?: Phaser.GameObjects.Text;
  private waveInfoText?: Phaser.GameObjects.Text;
  private sealBarBg?: Phaser.GameObjects.Rectangle;
  private sealBarFill?: Phaser.GameObjects.Rectangle;
  private placementGhost?: Phaser.GameObjects.Sprite;
  private placementText?: Phaser.GameObjects.Text;
  private placementManager!: PlacementManager;
  private typeSelector?: TypeSelectorUi;
  private startButton?: StartButtonUi;
  private towerPanel?: {
    bg: Phaser.GameObjects.Rectangle;
    text: Phaser.GameObjects.Text;
    button: Phaser.GameObjects.Rectangle;
    buttonText: Phaser.GameObjects.Text;
    sellButton: Phaser.GameObjects.Rectangle;
    sellText: Phaser.GameObjects.Text;
  };
  private rift?: RiftHazard;
  private sealKey?: Phaser.Input.Keyboard.Key;
  private upgradeKey?: Phaser.Input.Keyboard.Key;
  private cancelKey?: Phaser.Input.Keyboard.Key;
  private snapToggleKey?: Phaser.Input.Keyboard.Key;
  private resources = GAME_CONFIG.startResources;
  private selectedTowerType: TowerType = 'basic';
  private typeKeys?: Partial<Record<TowerType, Phaser.Input.Keyboard.Key>>;
  private useAltPath = false;
  private lastReward = 0;
  private lastRewardTimer = 0;
  private sealPulseTimer = 0;

  private elapsed = 0;
  private wave = 1;
  private pendingSpawns = 0;
  private spawnTimer = 0;
  private spawnInterval = 1.1;
  private buildPhase = true;
  private buildTimer = GAME_CONFIG.buildPhaseDuration;
  private interestRate = GAME_CONFIG.interestRate;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.drawBackdrop();
    this.pathManager = new PathManager(this, buildPath());
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

    this.placementManager = new PlacementManager({
      scene: this,
      pathManager: this.pathManager,
      getRift: () => this.rift,
      getTowers: () => this.towers,
      getResources: () => this.resources,
      spendResources: (amount) => {
        this.resources -= amount;
        this.updateTypeSelectorHighlight();
      },
      selectedType: () => this.selectedTowerType,
      getSelectedCost: () => this.getSelectedCost(),
      addTower: (tower) => this.towers.push(tower),
      selectTower: (tower) => this.selectTower(tower),
      flashPlacement: (p) => this.flashPlacement(p),
      showPopup: (p, text, color) => this.showPopup(p, text, color),
      findTowerAt: (p) => this.findTowerAt(p)
    });
    this.placementManager.setGhosts(this.placementGhost, this.placementText);

    this.typeKeys = {
      basic: this.input.keyboard?.addKey('ONE') as Phaser.Input.Keyboard.Key,
      slow: this.input.keyboard?.addKey('TWO') as Phaser.Input.Keyboard.Key,
      splash: this.input.keyboard?.addKey('THREE') as Phaser.Input.Keyboard.Key,
      sniper: this.input.keyboard?.addKey('FOUR') as Phaser.Input.Keyboard.Key
    };

    this.upgradeKey = this.input.keyboard?.addKey('U') as Phaser.Input.Keyboard.Key;
    this.cancelKey = this.input.keyboard?.addKey('ESC') as Phaser.Input.Keyboard.Key;
    this.snapToggleKey = this.input.keyboard?.addKey('G') as Phaser.Input.Keyboard.Key;
    this.buildTowerPanel();
    this.typeSelector = buildTypeSelector(this, (t) => this.setSelectedTowerType(t));
    this.startButton = buildStartWaveButton(this, () => this.startNextWaveEarly());
    this.updateStartButtonState();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const pos = { x: pointer.worldX, y: pointer.worldY };
      if (pointer.rightButtonDown()) {
        this.placementManager.cancel();
        return;
      }
      if (this.isPointerOverPanel(pos)) return;
      const targetTower = this.findTowerAt(pos);
      if (targetTower) {
        this.selectTower(targetTower);
        return;
      }
      this.clearSelection();
      this.placementManager.tryPlace(pos);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.placementManager.updateGhost({ x: pointer.worldX, y: pointer.worldY });
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

    this.handleTypeHotkeys();
    this.handleUpgradeHotkey();
    this.handleCancelHotkey();
    this.handleSnapHotkey();

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
    if (this.selectedTower && this.selectedTower.isDestroyed()) {
      this.clearSelection();
    }
    this.updateTowerPanel();

    this.bullets.forEach((b) => b.update(dt));
    this.bullets = this.bullets.filter((b) => b.isAlive());

    if (this.hudText) {
      const seal = this.rift ? (this.rift.isSealed() ? 'sealed' : `${Math.round(this.rift.getSealProgress() * 100)}%`) : 'n/a';
      const cd = this.buildPhase ? `prep ${this.buildTimer.toFixed(1)}s` : this.pendingSpawns > 0 ? `spawning` : 'active';
      const cost = this.getSelectedCost();
      this.hudText.setText(
        `Wave ${this.wave}\nNext wave: ${cd}\nEnemies: ${this.enemies.length}\nTowers: ${this.towers.length}\nResources: ${this.resources} (cost ${cost})${
          this.lastRewardTimer > 0 ? ` [+${this.lastReward}]` : ''
        }\nRift seal: ${seal}\nType: ${this.selectedTowerType} [1-4]\nClick to place | click tower to inspect (U to upgrade)\nHold [S] to seal`
      );
    }

    if (this.waveInfoText) {
      const phase = this.buildPhase ? `prep ${this.buildTimer.toFixed(1)}s` : `wave ${this.wave}`;
      this.waveInfoText.setText(`${phase} | ${this.describeNextWave()}`);
    }

    this.updateStartButtonState();
  }

  private updateWaves(dt: number) {
    if (this.buildPhase) {
      this.buildTimer -= dt;
      if (this.buildTimer <= 0) {
        this.startWave();
      }
      return;
    }

    if (this.pendingSpawns <= 0) {
      if (this.enemies.length <= 0) {
        this.enterBuildPhase();
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
    this.buildPhase = false;
    const spec = this.buildWaveSpec(this.wave);
    this.pendingSpawns = spec.count;
    this.spawnInterval = spec.interval;
    this.spawnTimer = 0.2;
    this.alertWave(`Wave ${this.wave} incoming`);
    this.wave += 1;
    this.buildTimer = 0;
    this.updateStartButtonState();
  }

  private startNextWaveEarly() {
    if (this.buildPhase) {
      this.startWave();
    }
  }

  private buildWaveSpec(wave: number) {
    return buildWaveSpec(wave);
  }

  private pickKind(): EnemyKind {
    return pickKind(this.wave);
  }

  private describeNextWave() {
    return describeNextWave(this.wave);
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

  private enterBuildPhase() {
    this.buildPhase = true;
    this.buildTimer = GAME_CONFIG.buildPhaseDuration;
    this.pendingSpawns = 0;
    this.spawnTimer = 0;
    const interest = Math.min(30, Math.floor(this.resources * this.interestRate));
    if (interest > 0) {
      this.addResources(interest);
      this.showPopup({ x: 60, y: 52 }, `Interest +${interest}`, '#9ef7c2');
    }
    this.updateStartButtonState();
  }

  private buildTowers() {
    const placements: Point[] = [
      { x: 260, y: 340 },
      { x: 460, y: 260 },
      { x: 720, y: 300 }
    ];
    return placements.map((p) => new Tower(this, p, 'basic'));
  }

  private tryUpgradeTower(tower: Tower, pos: Point): boolean {
    const rawNextCost = tower.getNextCost();
    const discount = this.buildPhase ? GAME_CONFIG.upgradeDiscountPrep : 1;
    const nextCost = rawNextCost === null ? null : Math.max(1, Math.floor(rawNextCost * discount));
    if (nextCost === null) {
      this.showPopup(pos, 'Max level', '#d4d4d8');
      return false;
    }
    if (this.resources < nextCost) {
      this.showPopup(pos, `Need ${nextCost}`, '#ff8a8a');
      return false;
    }
    const upgraded = tower.upgrade(nextCost);
    if (upgraded) {
      this.resources -= nextCost;
      this.updateTypeSelectorHighlight();
      this.flashPlacement(pos);
      this.showPopup(pos, `Level ${tower.getLevel()}`, '#9ef7c2');
      return true;
    }
    return false;
  }

  private trySellTower(tower: Tower) {
    const refundRatio = this.buildPhase ? GAME_CONFIG.sellRefundPrep : GAME_CONFIG.sellRefundWave;
    const value = tower.getSellValue(refundRatio);
    const pos = tower.getPosition();
    tower.destroyTower();
    this.towers = this.towers.filter((t) => t !== tower);
    this.resources += value;
    this.updateTypeSelectorHighlight();
    this.flashPlacement({ x: pos.x, y: pos.y });
    this.showPopup({ x: pos.x, y: pos.y }, `Sold +${value}`, '#9ef7c2');
    this.clearSelection();
  }

  private getSelectedCost() {
    return TOWER_CONFIG[this.selectedTowerType].levels[0].cost;
  }

  private handleTypeHotkeys() {
    if (!this.typeKeys) return;
    if (this.typeKeys.basic && Phaser.Input.Keyboard.JustDown(this.typeKeys.basic)) this.setSelectedTowerType('basic');
    if (this.typeKeys.slow && Phaser.Input.Keyboard.JustDown(this.typeKeys.slow)) this.setSelectedTowerType('slow');
    if (this.typeKeys.splash && Phaser.Input.Keyboard.JustDown(this.typeKeys.splash)) this.setSelectedTowerType('splash');
    if (this.typeKeys.sniper && Phaser.Input.Keyboard.JustDown(this.typeKeys.sniper)) this.setSelectedTowerType('sniper');
  }

  private setSelectedTowerType(type: TowerType) {
    if (this.selectedTowerType === type) {
      this.updateTypeSelectorHighlight();
      return;
    }
    this.selectedTowerType = type;
    this.updateTypeSelectorHighlight();
  }

  private handleCancelHotkey() {
    if (!this.cancelKey) return;
    if (Phaser.Input.Keyboard.JustDown(this.cancelKey)) {
      this.placementManager.cancel();
    }
  }

  private handleSnapHotkey() {
    if (!this.snapToggleKey) return;
    if (Phaser.Input.Keyboard.JustDown(this.snapToggleKey)) {
      this.placementManager.toggleSnap();
    }
  }

  private handleUpgradeHotkey() {
    if (!this.upgradeKey || !this.selectedTower) return;
    if (Phaser.Input.Keyboard.JustDown(this.upgradeKey)) {
      this.tryUpgradeSelected();
    }
  }

  private findTowerAt(pos: Point): Tower | null {
    const pt = new Phaser.Math.Vector2(pos.x, pos.y);
    return this.towers.find((t) => t.getPosition().distance(pt) < 26) ?? null;
  }

  private selectTower(tower: Tower) {
    this.selectedTower = tower;
    this.refreshRangeIndicators(tower);
    this.updateTowerPanel(true);
  }

  private clearSelection() {
    this.selectedTower = null;
    this.hideRangeIndicators();
    if (!this.towerPanel) return;
    this.towerPanel.bg.setVisible(false);
    this.towerPanel.text.setVisible(false);
    this.towerPanel.button.setVisible(false);
    this.towerPanel.buttonText.setVisible(false);
    this.towerPanel.sellButton.setVisible(false);
    this.towerPanel.sellText.setVisible(false);
  }

  private buildTowerPanel() {
    const width = 260;
    const height = 120;
    const x = 820;
    const y = 420;
    const bg = this.add.rectangle(x, y, width, height, 0x11121f, 0.9).setStrokeStyle(2, 0x2f3148, 0.95);
    bg.setDepth(12);

    const text = this.add.text(x - width / 2 + 12, y - height / 2 + 10, '', {
      fontSize: '13px',
      color: '#e4e4ec',
      fontFamily: 'Montserrat, sans-serif'
    });
    text.setDepth(13);

    const button = this.add.rectangle(x, y + 32, width - 24, 28, 0x25273a, 0.95).setStrokeStyle(2, 0x40435c, 0.9);
    button.setDepth(13);
    button.setInteractive({ useHandCursor: true });
    button.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Prevent world click handling from firing when hitting the button.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pointer.event as any)?.stopPropagation?.();
      this.tryUpgradeSelected();
    });

    const buttonText = this.add.text(button.x, button.y, 'Upgrade', {
      fontSize: '13px',
      color: '#f2f09e',
      fontFamily: 'Montserrat, sans-serif'
    });
    buttonText.setOrigin(0.5, 0.5);
    buttonText.setDepth(14);

    const sellButton = this.add.rectangle(x, y + 70, width - 24, 26, 0x25273a, 0.95).setStrokeStyle(2, 0x40435c, 0.9);
    sellButton.setDepth(13);
    sellButton.setInteractive({ useHandCursor: true });
    sellButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pointer.event as any)?.stopPropagation?.();
      this.trySellSelected();
    });

    const sellText = this.add.text(sellButton.x, sellButton.y, 'Sell', {
      fontSize: '12px',
      color: '#ffd18a',
      fontFamily: 'Montserrat, sans-serif'
    });
    sellText.setOrigin(0.5, 0.5);
    sellText.setDepth(14);

    this.towerPanel = { bg, text, button, buttonText, sellButton, sellText };
    this.clearSelection();
  }

  private updateStartButtonState() {
    updateStartButtonState(this.startButton, this.buildPhase, this.buildTimer);
  }

  private tryUpgradeSelected() {
    if (!this.selectedTower) return;
    const pos = this.selectedTower.getPosition();
    const prevRange = this.selectedTower.getStats().range;
    const upgraded = this.tryUpgradeTower(this.selectedTower, { x: pos.x, y: pos.y });
    if (upgraded) {
      this.refreshRangeIndicators(this.selectedTower, prevRange);
    }
    this.updateTowerPanel();
  }

  private trySellSelected() {
    if (!this.selectedTower) return;
    this.trySellTower(this.selectedTower);
  }

  private updateTowerPanel(forceShow = false) {
    if (!this.towerPanel) return;
    const { bg, text, button, buttonText, sellButton, sellText } = this.towerPanel;
    if (!this.selectedTower) {
      this.clearSelection();
      return;
    }

    const stats = this.selectedTower.getStats();
    const nextStats = this.selectedTower.getNextStats();
    const rawNextCost = this.selectedTower.getNextCost();
    const discount = this.buildPhase ? GAME_CONFIG.upgradeDiscountPrep : 1;
    const nextCost = rawNextCost === null ? null : Math.max(1, Math.floor(rawNextCost * discount));
    const type = this.selectedTower.getType();
    const color = getTowerTint(type, this.selectedTower.getLevel());
    const refundRatio = this.buildPhase ? GAME_CONFIG.sellRefundPrep : GAME_CONFIG.sellRefundWave;
    const sellValue = this.selectedTower.getSellValue(refundRatio);

    bg.setVisible(true).setFillStyle(0x11121f, 0.92);
    text.setVisible(true);
    button.setVisible(true);
    buttonText.setVisible(true);
    sellButton.setVisible(true);
    sellText.setVisible(true);

    const tags: string[] = [];
    if (stats.splashRadius) tags.push(`Splash ${stats.splashRadius}`);
    if (stats.slowPercent) tags.push(`Slow ${Math.round(stats.slowPercent * 100)}%`);
    if (stats.critChance) tags.push(`Crit ${Math.round((stats.critChance ?? 0) * 100)}% x${stats.critMultiplier ?? 1}`);

    text.setText(
      `Tower: ${type} (Lv ${this.selectedTower.getLevel()})\n` +
        `DMG ${stats.damage} | Rate ${stats.fireRate.toFixed(2)}s | Range ${stats.range}` +
        (tags.length ? `\n${tags.join(' | ')}` : '')
    );

    if (nextCost === null || !nextStats) {
      button.setFillStyle(0x20222f, 0.8);
      buttonText.setText('Max level');
      buttonText.setColor('#d4d4d8');
      button.disableInteractive();
    } else {
      const affordable = this.resources >= nextCost;
      button.setFillStyle(affordable ? 0x2f7b4a : 0x3a2c2c, 0.9);
      buttonText.setText(`Upgrade ${nextCost} → Lv ${this.selectedTower.getLevel() + 1}`);
      buttonText.setColor(affordable ? '#e9ffe0' : '#ffb7b7');
      button.setInteractive({ useHandCursor: true });
    }

    sellButton.setFillStyle(0x2d2f44, 0.95);
    sellButton.setStrokeStyle(2, 0x40435c, 0.9);
    sellText.setText(`Sell +${sellValue}`);
    sellText.setColor('#ffd18a');

    // Subtle highlight per tower type.
    bg.setStrokeStyle(2, color, 0.85);
    button.setStrokeStyle(2, 0x40435c, 0.9);
    sellButton.setStrokeStyle(2, color, 0.4);

    if (forceShow) {
      this.tweens.add({ targets: bg, alpha: { from: 0, to: 0.92 }, duration: 120 });
    }
  }

  private refreshRangeIndicators(tower: Tower, prevRange?: number) {
    const pos = tower.getPosition();
    const color = getTowerTint(tower.getType(), tower.getLevel());
    const currentRange = tower.getStats().range;
    const nextRange = tower.getNextStats()?.range ?? null;

    if (!this.rangeCircle) {
      this.rangeCircle = this.add.circle(pos.x, pos.y, currentRange, color, 0.06);
      this.rangeCircle.setDepth(1);
    }
    this.rangeCircle.setVisible(true);
    this.rangeCircle.setPosition(pos.x, pos.y);
    this.rangeCircle.setFillStyle(color, 0.035);
    this.rangeCircle.setStrokeStyle(2, color, 0.4);

    if (prevRange !== undefined) {
      this.rangeCircle.setRadius(prevRange);
      this.tweens.add({ targets: this.rangeCircle, radius: currentRange, duration: 220, ease: 'Sine.easeOut' });
    } else {
      this.rangeCircle.setRadius(currentRange);
    }

    if (nextRange) {
      if (!this.nextRangeCircle) {
        this.nextRangeCircle = this.add.circle(pos.x, pos.y, nextRange, color, 0);
        this.nextRangeCircle.setDepth(1);
      }
      this.nextRangeCircle.setVisible(true);
      this.nextRangeCircle.setPosition(pos.x, pos.y);
      this.nextRangeCircle.setRadius(nextRange);
      this.nextRangeCircle.setStrokeStyle(2, color, 0.18);
      this.nextRangeCircle.setFillStyle(color, 0);
    } else if (this.nextRangeCircle) {
      this.nextRangeCircle.setVisible(false);
    }
  }

  private hideRangeIndicators() {
    this.rangeCircle?.destroy();
    this.nextRangeCircle?.destroy();
    this.rangeCircle = undefined;
    this.nextRangeCircle = undefined;
  }

  private updateTypeSelectorHighlight() {
    updateTypeSelectorHighlight(this.typeSelector, this.selectedTowerType, this.resources);
  }

  private showPopup(pos: Point, text: string, color: string) {
    const label = this.add.text(pos.x, pos.y - 28, text, {
      fontSize: '12px',
      color,
      fontFamily: 'Montserrat, sans-serif'
    });
    label.setDepth(11);
    this.tweens.add({ targets: label, y: label.y - 12, alpha: 0, duration: 600, onComplete: () => label.destroy() });
  }

  private isPointerOverPanel(pos: Point) {
    const inTowerPanel = (() => {
      if (!this.towerPanel || !this.towerPanel.bg.visible) return false;
      const { bg } = this.towerPanel;
      const halfW = bg.width / 2;
      const halfH = bg.height / 2;
      return pos.x >= bg.x - halfW && pos.x <= bg.x + halfW && pos.y >= bg.y - halfH && pos.y <= bg.y + halfH;
    })();

    const inTypeSelector = (() => {
      if (!this.typeSelector || !this.typeSelector.bg.visible) return false;
      const bg = this.typeSelector.bg;
      const halfW = bg.width / 2;
      const halfH = bg.height / 2;
      return pos.x >= bg.x - halfW && pos.x <= bg.x + halfW && pos.y >= bg.y - halfH && pos.y <= bg.y + halfH;
    })();

    return inTowerPanel || inTypeSelector;
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
    this.updateTypeSelectorHighlight();
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
    const points = this.useAltPath ? buildAltPath() : buildPath();
    this.pathManager.setPoints(points);
    this.cameras.main.flash(200, 124, 58, 237);
    this.alertWave('Path shifted!');
  }
}
