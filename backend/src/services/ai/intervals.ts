export type RefreshInterval =
  | 'every6h'
  | 'every12h'
  | 'every24h'
  | 'every2d'
  | 'weekly'
  | 'biweekly'
  | 'custom';

export function intervalToMs(interval: RefreshInterval, customHours?: number): number {
  switch (interval) {
    case 'every6h':
      return 6 * 60 * 60 * 1000;
    case 'every12h':
      return 12 * 60 * 60 * 1000;
    case 'every24h':
      return 24 * 60 * 60 * 1000;
    case 'every2d':
      return 2 * 24 * 60 * 60 * 1000;
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000;
    case 'biweekly':
      return 14 * 24 * 60 * 60 * 1000;
    case 'custom':
      return Math.max(1, customHours ?? 24) * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

