/* eslint-disable import/no-named-as-default-member */
import Phaser from 'phaser';

export type Point = { x: number; y: number };

export class PathManager {
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

export class RiftHazard {
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

export const buildPath = (): Point[] => [
  { x: 64, y: 480 },
  { x: 200, y: 420 },
  { x: 340, y: 420 },
  { x: 520, y: 320 },
  { x: 700, y: 360 },
  { x: 860, y: 200 }
];

export const buildAltPath = (): Point[] => [
  { x: 64, y: 420 },
  { x: 220, y: 320 },
  { x: 400, y: 360 },
  { x: 620, y: 260 },
  { x: 780, y: 320 },
  { x: 880, y: 160 }
];
