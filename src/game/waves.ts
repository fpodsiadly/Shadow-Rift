import { EnemyKind } from './enemies';

export const buildWaveSpec = (wave: number) => {
  const count = 5 + Math.floor(wave * 1.8);
  const interval = Math.max(0.75, 1.05 - wave * 0.04);
  const rest = Math.max(5.5, 9 - wave * 0.12);
  const weights: Record<EnemyKind, number> = {
    hound: 6,
    swarm: Math.max(1, wave - 1),
    puppet: wave >= 3 ? 1 : 0,
    brute: wave >= 4 ? 1 : 0,
    watcher: wave >= 6 && wave % 3 === 0 ? 1 : 0
  };
  return { count, interval, rest, weights };
};

export const pickKind = (wave: number, buildSpec = buildWaveSpec): EnemyKind => {
  const spec = buildSpec(wave - 1);
  const entries = Object.entries(spec.weights) as [EnemyKind, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (const [kind, w] of entries) {
    acc += w;
    if (r <= acc) return kind;
  }
  return 'hound';
};

export const describeNextWave = (wave: number, buildSpec = buildWaveSpec) => {
  const spec = buildSpec(wave);
  const entries = Object.entries(spec.weights).filter(([, w]) => w > 0) as [EnemyKind, number][];
  const parts = entries.map(([k, w]) => `${k}:${w}`);
  return `Next wave: ${parts.join(' | ')}`;
};
