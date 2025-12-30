/* eslint-disable import/no-named-as-default-member */
import Phaser from 'phaser';

export type StartButtonUi = { button: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text };

export function buildStartWaveButton(scene: Phaser.Scene, onClick: () => void): StartButtonUi {
  const x = 820;
  const y = 474;
  const width = 260;
  const height = 34;
  const button = scene.add.rectangle(x, y, width, height, 0x1f2233, 0.92).setStrokeStyle(2, 0x3a4b7a, 0.9);
  button.setDepth(12);
  button.setInteractive({ useHandCursor: true });
  button.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pointer.event as any)?.stopPropagation?.();
    onClick();
  });

  const text = scene.add.text(x, y, 'Start wave', {
    fontSize: '14px',
    color: '#e9ffe0',
    fontFamily: 'Montserrat, sans-serif'
  });
  text.setDepth(13);
  text.setOrigin(0.5, 0.5);

  return { button, text };
}

export function updateStartButtonState(ui: StartButtonUi | undefined, buildPhase: boolean, buildTimer: number) {
  if (!ui) return;
  ui.button.setVisible(buildPhase);
  ui.text.setVisible(buildPhase);
  if (buildPhase) {
    ui.text.setText(`Start wave (${buildTimer.toFixed(1)}s)`);
  }
}
