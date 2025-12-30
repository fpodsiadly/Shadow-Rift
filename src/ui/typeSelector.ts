/* eslint-disable import/no-named-as-default-member */
import Phaser from 'phaser';

import { TOWER_COLOR, TOWER_CONFIG, TowerType } from '../game/towers';

export type TypeButtonEntry = { type: TowerType; box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; cost: Phaser.GameObjects.Text };
export type TypeSelectorUi = { bg: Phaser.GameObjects.Rectangle; buttons: TypeButtonEntry[] };

export function buildTypeSelector(scene: Phaser.Scene, onSelect: (type: TowerType) => void): TypeSelectorUi {
  const types: TowerType[] = ['basic', 'slow', 'splash', 'sniper'];
  const centerX = 300;
  const y = 506;
  const spacing = 112;
  const bgWidth = spacing * types.length + 24;

  const bg = scene.add.rectangle(centerX, y, bgWidth, 48, 0x0f101c, 0.92).setStrokeStyle(1, 0x2f3148, 0.9);
  bg.setDepth(10);

  const buttons: TypeButtonEntry[] = [];
  const startX = centerX - ((types.length - 1) * spacing) / 2;
  types.forEach((type, idx) => {
    const bx = startX + idx * spacing;
    const box = scene.add.rectangle(bx, y, 96, 34, 0x171827, 0.95).setStrokeStyle(2, TOWER_COLOR[type], 0.55);
    box.setDepth(11);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pointer.event as any)?.stopPropagation?.();
      onSelect(type);
    });

    const label = scene.add.text(bx - 42, y - 10, type, {
      fontSize: '12px',
      color: '#e4e4ec',
      fontFamily: 'Montserrat, sans-serif'
    });
    label.setDepth(12);

    const costVal = TOWER_CONFIG[type].levels[0].cost;
    const cost = scene.add.text(bx - 42, y + 4, `cost ${costVal}`, {
      fontSize: '11px',
      color: '#9ef7c2',
      fontFamily: 'Montserrat, sans-serif'
    });
    cost.setDepth(12);

    buttons.push({ type, box, label, cost });
  });

  return { bg, buttons };
}

export function updateTypeSelectorHighlight(ui: TypeSelectorUi | undefined, selectedType: TowerType, resources: number) {
  if (!ui) return;
  ui.buttons.forEach(({ type, box, label, cost }) => {
    const selected = selectedType === type;
    const baseColor = TOWER_COLOR[type] ?? 0xffffff;
    const need = TOWER_CONFIG[type].levels[0].cost;
    const affordable = resources >= need;
    box.setFillStyle(selected ? 0x202437 : 0x171827, selected ? 0.95 : 0.88);
    box.setStrokeStyle(selected ? 3 : 1.5, baseColor, selected ? 0.9 : 0.55);
    label.setColor(selected ? '#ffffff' : '#e4e4ec');
    cost.setColor(affordable ? '#b0ffd6' : '#ff9f9f');
    cost.setText(affordable ? `cost ${need}` : `need ${need}`);
    box.setAlpha(affordable ? 1 : 0.75);
    label.setAlpha(affordable ? 1 : 0.85);
    cost.setAlpha(affordable ? 1 : 0.9);
  });
}
