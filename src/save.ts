const KEY = 'zc_best_v1';
const DAILY_KEY = 'zc_daily_v1';

export interface Best {
  wave: number;
  kills: number;
}

export function loadBest(): Best {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const b = JSON.parse(raw) as Best;
      return { wave: b.wave | 0, kills: b.kills | 0 };
    }
  } catch {
    /* ignore */
  }
  return { wave: 0, kills: 0 };
}

export function saveBest(best: Best) {
  try {
    localStorage.setItem(KEY, JSON.stringify(best));
  } catch {
    /* ignore */
  }
}

/** 每日挑战：当日固定种子 + 当日纪录 */
export function dailySeed(): number {
  const d = new Date();
  const ymd = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return (ymd * 2654435761) % 0x7fffffff || 1;
}

export function dailyKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export interface DailyBest {
  day: string;
  wave: number;
  kills: number;
}

export function loadDaily(): DailyBest {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (raw) {
      const b = JSON.parse(raw) as DailyBest;
      return { day: b.day || '', wave: b.wave | 0, kills: b.kills | 0 };
    }
  } catch {
    /* ignore */
  }
  return { day: '', wave: 0, kills: 0 };
}

export function saveDaily(b: DailyBest) {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

/** 每周挑战：ISO 周（周一为界），同一周所有人同一颗种子 */
export function weekKey(d = new Date()): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function weekSeed(): number {
  const k = weekKey();
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) {
    h ^= k.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 1) || 1;
}