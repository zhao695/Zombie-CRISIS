/** 局外成长：绿宝石货币、商店强化、开局祝福（遗物）、成就、难度 */

const KEY = 'zc_meta_v1';

export interface MetaState {
  emeralds: number;
  lvls: Record<string, number>;
  ach: Record<string, number>;
  diff: number;
  kills: number;
}

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  baseCost: number;
  costStep: number;
  maxLvl: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'hp', name: '生命上限', desc: '每级 +2 最大生命', baseCost: 10, costStep: 8, maxLvl: 5 },
  { id: 'speed', name: '移动速度', desc: '每级 +5% 移速', baseCost: 12, costStep: 8, maxLvl: 4 },
  { id: 'magnet', name: '磁吸范围', desc: '每级 +40px 拾取磁吸', baseCost: 8, costStep: 6, maxLvl: 3 },
  { id: 'apple', name: '随身干粮', desc: '每级开局 +2 苹果', baseCost: 6, costStep: 5, maxLvl: 3 },
  { id: 'stone', name: '随身石料', desc: '每级开局 +5 石头', baseCost: 6, costStep: 5, maxLvl: 3 },
  { id: 'wall', name: '随身墙体', desc: '每级开局 +1 墙体', baseCost: 10, costStep: 7, maxLvl: 3 },
  { id: 'dash', name: '冲刺冷却', desc: '每级冲刺冷却 -10%', baseCost: 10, costStep: 8, maxLvl: 4 },
  { id: 'emerald', name: '绿宝石收益', desc: '每级结算绿宝石 +25%', baseCost: 15, costStep: 12, maxLvl: 3 },
  { id: 'crit', name: '暴击', desc: '每级 +5% 暴击率 (2倍伤害)', baseCost: 12, costStep: 10, maxLvl: 5 },
  { id: 'rest', name: '休整', desc: '每级波次清场 +1 HP', baseCost: 8, costStep: 6, maxLvl: 3 },
  { id: 'atk', name: '力量', desc: '每级 +5% 全部伤害', baseCost: 12, costStep: 10, maxLvl: 4 },
  { id: 'cdr', name: '手感', desc: '每级 武器冷却 -4%', baseCost: 10, costStep: 8, maxLvl: 4 },
];

export function upgradeCost(u: UpgradeDef, lvl: number): number {
  return u.baseCost + u.costStep * lvl;
}

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const RELICS: RelicDef[] = [
  { id: 'magnet', name: '磁石护符', icon: '🧲', desc: '磁吸范围 +60px' },
  { id: 'swift', name: '迅捷之靴', icon: '👟', desc: '移动速度 +15%' },
  { id: 'power', name: '强击手套', icon: '👊', desc: '近战伤害 +25%' },
  { id: 'archer', name: '神射之眼', icon: '🎯', desc: '箭矢伤害 +50%，射速 +20%' },
  { id: 'powder', name: '火药亲和', icon: '💥', desc: '苦力怕火药掉落翻倍' },
  { id: 'harvest', name: '丰收之镰', icon: '🌾', desc: '采集产出 +1' },
  { id: 'stomach', name: '铁胃', icon: '🍖', desc: '吃苹果回复 +3' },
  { id: 'thorn', name: '荆棘护甲', icon: '🌵', desc: '受击反弹 2 点伤害' },
  { id: 'spring', name: '生命之泉', icon: '⛲', desc: '每波清场回复 2 HP' },
  { id: 'totem', name: '不死图腾', icon: '🗿', desc: '死亡时原地复活 50% HP (每局一次)' },
  { id: 'luck', name: '幸运四叶草', icon: '🍀', desc: '宝箱与空投必出稀有物品' },
  { id: 'builder', name: '建筑师图纸', icon: '📐', desc: '墙仅需 3 石 · 墙体血量 5' },
];

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstKill', name: '初战告捷', icon: '⚔', desc: '击杀第一个敌人' },
  { id: 'kill100', name: '百人斩', icon: '💯', desc: '累计击杀 100 敌人' },
  { id: 'kill500', name: '屠戮者', icon: '☠', desc: '累计击杀 500 敌人' },
  { id: 'wave10', name: '坚守者', icon: '🛡', desc: '存活到第 10 波' },
  { id: 'wave20', name: '末日幸存者', icon: '🏆', desc: '存活到第 20 波' },
  { id: 'rich', name: '富可敌国', icon: '💎', desc: '累计持有 100 绿宝石' },
  { id: 'exec10', name: '处刑人', icon: '🗡', desc: '累计处决 10 次' },
  { id: 'dj', name: '收藏家', icon: '💿', desc: '集齐 3 张音乐唱片' },
  { id: 'enchanter', name: '附魔大师', icon: '📖', desc: '单局集齐 4 种附魔' },
  { id: 'hard10', name: '挑战者', icon: '🔥', desc: '困难难度存活到第 10 波' },
];

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const m = JSON.parse(raw) as MetaState;
      return { emeralds: m.emeralds | 0, lvls: m.lvls || {}, ach: m.ach || {}, diff: m.diff | 0, kills: m.kills | 0 };
    }
  } catch {
    /* ignore */
  }
  return { emeralds: 0, lvls: {}, ach: {}, diff: 1, kills: 0 };
}

export function saveMeta(m: MetaState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}
