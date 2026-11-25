import { WAVE, WEAPONS } from '../config';

export const TAU = Math.PI * 2;

/** 怪物伤害随波次成长的系数，封顶 WAVE.dmgCap */
export function waveDmgMul(wave: number) {
  const base = Math.min(WAVE.dmgCap, 1 + (Math.max(1, wave) - 1) * WAVE.dmgPerWave);
  // 前 4 波给新手缓冲：第 1 波只有 65%，第 5 波回到 100%
  // 前 15 波逐步恢复：第 1 波 65% → 第 15 波 100%
  const early = wave >= 30 ? 1 : 0.65 + (wave - 1) * (0.35 / 29);
  return base * early;
}

/** 按波次放大怪物造成的伤害（0 保持不变，避免把 0 伤害变成 1） */
export function scaleEnemyDmg(g: { wave: number }, base: number) {
  if (base <= 0) return base;
  return Math.max(1, Math.round(base * waveDmgMul(g.wave)));
}

export function normAngle(a: number) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

export function weaponFor(kills: number): number {
  let idx = 0;
  for (let i = 0; i < WEAPONS.length; i++) {
    if (kills >= WEAPONS[i].kills) idx = i;
  }
  return idx;
}
