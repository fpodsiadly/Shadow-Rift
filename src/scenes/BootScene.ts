/* eslint-disable import/no-named-as-default-member */
import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Minimal generated textures to avoid external assets.
    const houndColor = 0xff5577;
    const puppetColor = 0x9b8cff;
    const swarmColor = 0x5cd6a6;
    const bruteColor = 0xffb347;
    const towerColor = 0x88ddee;
    const bulletColor = 0xf7e27d;
    const riftColor = 0x7c3aed;
    const ghostOk = 0x88ffb7;
    const ghostBad = 0xff6b6b;

    const g = this.add.graphics({ x: 0, y: 0 });
    g.setVisible(false);

    g.fillStyle(houndColor, 1);
    g.fillCircle(16, 16, 16);
    g.generateTexture('enemy-hound', 32, 32);
    g.clear();

    g.fillStyle(puppetColor, 1);
    g.fillCircle(18, 18, 18);
    g.lineStyle(3, puppetColor, 0.65);
    g.strokeCircle(18, 18, 26);
    g.generateTexture('enemy-puppet', 52, 52);
    g.clear();

    g.fillStyle(swarmColor, 1);
    g.fillCircle(10, 10, 10);
    g.fillCircle(26, 16, 8);
    g.fillCircle(18, 30, 9);
    g.generateTexture('enemy-swarm', 40, 40);
    g.clear();

    g.fillStyle(bruteColor, 1);
    g.fillRoundedRect(0, 0, 40, 40, 6);
    g.lineStyle(4, 0xd9822b, 0.8);
    g.strokeRoundedRect(2, 2, 36, 36, 6);
    g.generateTexture('enemy-brute', 44, 44);
    g.clear();

    g.fillStyle(towerColor, 1);
    g.fillRoundedRect(0, 0, 36, 36, 6);
    g.generateTexture('tower', 36, 36);
    g.clear();

    g.fillStyle(bulletColor, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture('bullet', 12, 12);
    g.clear();

    g.lineStyle(3, riftColor, 0.9);
    g.strokeCircle(24, 24, 20);
    g.generateTexture('rift', 48, 48);
    g.clear();

    g.lineStyle(3, ghostOk, 0.8);
    g.strokeRoundedRect(0, 0, 40, 40, 8);
    g.generateTexture('tower-ghost-ok', 40, 40);
    g.clear();

    g.lineStyle(3, ghostBad, 0.8);
    g.strokeRoundedRect(0, 0, 40, 40, 8);
    g.generateTexture('tower-ghost-bad', 40, 40);
    g.clear();
  }

  create() {
    this.scene.start('GameScene');
  }
}
