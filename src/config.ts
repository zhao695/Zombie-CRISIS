export const VIEW_W = 480;
export const VIEW_H = 270;
export const TILE = 16;

export const WORLD = {
  w: 2368,
  h: 1728,
};

/** 开局可选地图（布局不同，机制一致） */
export interface MapDef {
  id: string;
  name: string;
  sub: string;
  desc: string;
  color: string;
}

export const MAPS: MapDef[] = [
  { id: 'maze', name: '迷宫遗迹', sub: '经典回廊', desc: '曲折巷道与开阔广场交错，攻防节奏均衡', color: '#7cbd3a' },
  { id: 'plains', name: '开阔平原', sub: '无遮无拦', desc: '大片空地只有零星建筑，适合风筝走位', color: '#a8d06a' },
  { id: 'fortress', name: '废弃要塞', sub: '街区纵横', desc: '规整的街区与房间，巷道遭遇战频繁', color: '#9d9d95' },
  { id: 'forest', name: '枯木密林', sub: '树影重重', desc: '密集的树丛障碍，卡视野也卡走位', color: '#4f7d3a' },
  { id: 'arena', name: '环形竞技场', sub: '层层环道', desc: '同心环墙与缺口，天然的分波对决场', color: '#c9a26b' },
];

export const PLAYER = {
  speed: 100,
  radius: 8,
  maxHp: 20,
  invuln: 0.9,
  dashSpeed: 330,
  dashTime: 0.13,
  dashCd: 1.0,
};

export interface WeaponDef {
  name: string;
  en: string;
  kills: number;
  dmg: number;
  cd: number;
  range: number;
  arc: number;
  blade: string;
}

export const WEAPONS: WeaponDef[] = [
  { name: '拳头', en: 'FISTS', kills: 0, dmg: 1, cd: 0.34, range: 30, arc: 112, blade: '#c99c6b' },
  { name: '木剑', en: 'WOOD SWORD', kills: 5, dmg: 2, cd: 0.34, range: 36, arc: 112, blade: '#a9764a' },
  { name: '石剑', en: 'STONE SWORD', kills: 14, dmg: 3, cd: 0.32, range: 40, arc: 114, blade: '#8f8f8f' },
  { name: '铁剑', en: 'IRON SWORD', kills: 28, dmg: 5, cd: 0.30, range: 44, arc: 116, blade: '#e2e2e2' },
  { name: '金剑', en: 'GOLD SWORD', kills: 45, dmg: 7, cd: 0.26, range: 46, arc: 118, blade: '#f5d327' },
  { name: '钻石剑', en: 'DIAMOND SWORD', kills: 70, dmg: 10, cd: 0.24, range: 50, arc: 122, blade: '#4aedd9' },
  { name: '下界合金剑', en: 'NETHERITE SWORD', kills: 100, dmg: 13, cd: 0.22, range: 52, arc: 124, blade: '#5a4a5e' },
  { name: '宗师之剑', en: 'MASTER SWORD', kills: 140, dmg: 17, cd: 0.20, range: 55, arc: 128, blade: '#ffd76b' },
];

/** 弓：100 击杀（金剑）解锁 */
export const BOW = {
  unlockKills: 100,
  dmg: 5,
  cd: 0.45,
  speed: 290,
  life: 1.8,
};

/** 斧头：60 击杀解锁，攻速慢伤害高，E 键旋转飞斧 */
export const AXE = {
  unlockKills: 60,
  dmg: 9,
  cd: 0.62,
  range: 34,
  arc: 100,
  swingT: 0.24,
  spinDmg: 6,
  spinCd: 6,
  spinTime: 1.6,
  spinRadius: 36,
};

/** 钓鱼竿：30 击杀解锁，钩中敌人拉过来并沉默 */
export const ROD = {
  unlockKills: 30,
  cd: 2.4,
  range: 330,
  hookSpeed: 520,
  pullTime: 0.55,
  silence: 3,
  dmg: 1,
  /** 拉到位后的眩晕时间：给玩家反应窗口，避免敌人 0 帧反打 */
  stun: 1.5,
  /** 眩晕期间承受的额外伤害倍率 */
  stunDmgMul: 1.35,
};

/** TNT：150 击杀解锁，投掷爆炸 */
export const TNT = {
  unlockKills: 150,
  startAmmo: 3,
  maxAmmo: 999,
  cd: 0.55,
  fuse: 1.0,
  radius: 64,
  /** 对怪伤害：一次炸掉一片普通怪，才配得上 3 火药 */
  dmg: 26,
  /** 自伤压到很低，别让玩家不敢用 */
  playerDmg: 1,
  throwSpeed: 260,
};

/** 快捷栏显示顺序：位置 -> 内部武器槽（按解锁先后排列，越早解锁越靠左） */
export const SLOT_ORDER = [0, 3, 8, 5, 2, 1, 4, 7, 6];

export const SLOT_NAMES = ['近战', '弓', '斧头', '钓竿', 'TNT', '火球', '三叉戟', '弩', '重锤'];

/** 重锤：慢、重、范围大，附带击退；35 杀就能拿到 */
export const MACE = {
  unlockKills: 35,
  dmg: 13,
  cd: 0.95,
  range: 40,
  arc: 100,
  knock: 260,
};

/** 三叉戟：150 杀解锁，投掷穿透 */
export const TRIDENT = {
  unlockKills: 240,
  dmg: 8,
  cd: 0.85,
  speed: 300,
  pierce: 4,
};

/** 弩：200 杀解锁，三连发 */
export const CROSSBOW = {
  unlockKills: 200,
  dmg: 4,
  cd: 1.0,
  bolts: 3,
  speed: 330,
  spread: 0.09,
};

/** 武器技能（R 键），每个槽位一个 */
export const SKILLS: Record<number, { name: string; cd: number; desc: string }> = {
  0: { name: '剑气斩', cd: 7, desc: '向前劈出穿透剑气' },
  1: { name: '箭雨', cd: 9, desc: '扇形 5 箭' },
  2: { name: '震地斩', cd: 10, desc: '原地范围爆发并击退' },
  3: { name: '强钩', cd: 8, desc: '把附近敌人全部定身' },
  4: { name: '三连爆破', cd: 12, desc: '一次掷出 3 个 TNT' },
  5: { name: '火墙', cd: 10, desc: '前方倾泻 5 发火焰弹' },
  6: { name: '落雷', cd: 11, desc: '在瞄准点召唤 3 道雷' },
  7: { name: '穿透齐射', cd: 9, desc: '扇形 5 发穿透弩箭' },
  8: { name: '震地重击', cd: 11, desc: '砸地范围伤害并击退' },
};

export const COMBO = {
  window: 3,
  perKill: 0.0125,
  max: 40,
};

export const APPLE = {
  duration: 10,
  mul: 1.5,
};

export const SKELETON = {
  windup: 0.55,
  cdMin: 1.7,
  cdMax: 2.5,
  range: 360,
  retreat: 76,
  hold: 150,
  arrowSpeed: 190,
  arrowDmg: 2,
};

export const SPIDER = {
  lungeCdMin: 2.6,
  lungeCdMax: 3.6,
  lungeRange: 80,
  lungeSpeed: 310,
  lungeTime: 0.22,
  crouch: 0.35,
};

export const ENDER = {
  teleportCdMin: 2.8,
  teleportCdMax: 4.2,
  teleportMin: 50,
  teleportMax: 95,
  hitTeleportChance: 0.45,
};

export const WITCH = {
  windup: 0.6,
  throwCdMin: 3.0,
  throwCdMax: 4.5,
  range: 300,
  retreat: 110,
  hold: 190,
  splashR: 24,
  dmg: 2,
  potionTime: 0.55,
  slowT: 1.5,
};

export const SPAWN = {
  minD: 170,
  maxD: 300,
};

/** 天气：0 晴 1 阴 2 小雨 3 大雨 4 雷暴，随波数恶化 */
export const WEATHER = {
  names: ['晴', '阴', '小雨', '大雨', '雷暴'],
  stageEvery: 2,
  strikeMin: 4.5,
  strikeMax: 8.5,
  strikeDmg: 3,
  strikeRadius: 34,
  strikeZombieDmg: 6,
  telegraph: 0.9,
};

/** 高压苦力怕：雷暴限定，爆炸更大 */
export const CHARGED = {
  radius: 84,
  dmg: 12,
  playerDmg: 4,
};

/** 资源采集与合成 */
export const GATHER = {
  stoneHp: 3,
  stonePerNode: 3,
  treeHp: 2,
  /** 1 石 = 10 块墙体方块 */
  wallCost: 1,
  wallsPerStone: 10,
  wallCap: 9999,
  wallHp: 6,
  tntCraftCost: 3,
  eatHeal: 4,
  eatCd: 1.2,
  eyeRange: 170,
  eyeCd: 2,
  stoneNodes: 14,
  treeNodes: 10,
  foodMax: 9999,
};

export interface ZombieDef {
  label: string;
  hp: number;
  speed: number;
  dmg: number;
  r: number;
  scale: number;
  ranged?: boolean;
  tier?: 'leather' | 'iron' | 'gold';
}

export const ZOMBIES: Record<string, ZombieDef> = {
  normal: { label: '僵尸', hp: 2, speed: 42, dmg: 1, r: 9, scale: 1 },
  fast: { label: '快速僵尸', hp: 1, speed: 82, dmg: 1, r: 8, scale: 1 },
  leather: { label: '皮革僵尸', hp: 5, speed: 33, dmg: 2, r: 10, scale: 1, tier: 'leather' },
  iron: { label: '铁甲僵尸', hp: 9, speed: 29, dmg: 2, r: 10, scale: 1, tier: 'iron' },
  gold: { label: '黄金僵尸', hp: 14, speed: 27, dmg: 3, r: 10, scale: 1, tier: 'gold' },
  skeleton: { label: '骷髅', hp: 4, speed: 36, dmg: 1, r: 8, scale: 1, ranged: true },
  creeper: { label: '苦力怕', hp: 3, speed: 54, dmg: 6, r: 9, scale: 1 },
  charged: { label: '高压苦力怕', hp: 6, speed: 50, dmg: 8, r: 10, scale: 1.05 },
  spider: { label: '蜘蛛', hp: 3, speed: 95, dmg: 2, r: 9, scale: 1 },
  enderman: { label: '末影人', hp: 8, speed: 48, dmg: 3, r: 10, scale: 1.2 },
  witch: { label: '女巫', hp: 4, speed: 30, dmg: 1, r: 8, scale: 1, ranged: true },
  slime: { label: '史莱姆', hp: 6, speed: 36, dmg: 2, r: 9, scale: 1 },
  blaze: { label: '烈焰人', hp: 5, speed: 34, dmg: 1, r: 8, scale: 1, ranged: true },
  phantom: { label: '幻翼', hp: 3, speed: 88, dmg: 2, r: 8, scale: 1 },
  witherSkel: { label: '凋灵骷髅', hp: 6, speed: 38, dmg: 1, r: 8, scale: 1, ranged: true },
  pigman: { label: '僵尸猪人', hp: 6, speed: 46, dmg: 2, r: 9, scale: 1 },
  silverfish: { label: '蠹虫', hp: 1.5, speed: 115, dmg: 1, r: 6, scale: 0.62 },
  drowned: { label: '溺尸', hp: 5, speed: 34, dmg: 1, r: 8, scale: 1, ranged: true },
  stray: { label: '流浪者', hp: 3.5, speed: 38, dmg: 1, r: 8, scale: 1, ranged: true },
  guardian: { label: '守卫者', hp: 7, speed: 26, dmg: 2, r: 9, scale: 1, ranged: true },
  evoker: { label: '唤魔者', hp: 8, speed: 32, dmg: 2, r: 8, scale: 1, ranged: true },
  pillager: { label: '掠夺者', hp: 4.5, speed: 40, dmg: 2, r: 8, scale: 1, ranged: true },
  ravager: { label: '劫掠兽', hp: 18, speed: 42, dmg: 3, r: 13, scale: 1.35 },
  boss: { label: '巨型僵尸', hp: 34, speed: 27, dmg: 3, r: 18, scale: 2 },
  bossCreeper: { label: '高压苦力怕王', hp: 55, speed: 38, dmg: 4, r: 22, scale: 2.2 },
  wither: { label: '凋灵', hp: 70, speed: 40, dmg: 4, r: 17, scale: 1.8 },
  bossDragon: { label: '末影龙', hp: 120, speed: 54, dmg: 6, r: 22, scale: 1.7 },
  bossWarden: { label: '监守者', hp: 100, speed: 42, dmg: 6, r: 14, scale: 1.5 },
  spiderJockey: { label: '蜘蛛骑士', hp: 9, speed: 86, dmg: 2, r: 10, scale: 1, ranged: true },
  chickenJockey: { label: '鸡骑士', hp: 2.5, speed: 118, dmg: 2, r: 7, scale: 0.68 },
};

export const PAL = {
  grass: '#7cbd3a',
  grass2: '#74b234',
  grass3: '#88c946',
  dirt: '#96623d',
  dirt2: '#7f5334',
  street: '#9d9d95',
  street2: '#8c8c84',
  street3: '#b0b0a8',
  stone: '#7f7f7f',
  stoneDark: '#5c5c5c',
  stoneLight: '#9c9c9c',
  skin: '#c99c6b',
  skinDark: '#a87c4f',
  hair: '#4a3a2a',
  shirt: '#00aaaa',
  shirtDark: '#008080',
  pants: '#3b3b9e',
  shoe: '#4a4a5a',
  zSkin: '#5b945b',
  zSkinDark: '#3f703f',
  zShirt: '#2e5f63',
  zPants: '#36366b',
  creeper: '#58b04b',
  creeperDark: '#3a8231',
  bone: '#eceae0',
  boneDark: '#b9b7a8',
  spider: '#26262e',
  spiderDark: '#1a1a20',
  ender: '#16121f',
  enderDark: '#0b0812',
  enderEye: '#d06cff',
  witch: '#5a2a6e',
  witchDark: '#3c1a4e',
  potion: '#8a3ac0',
  outline: '#141414',
  heart: '#e02626',
  heartDark: '#7a1010',
  gold: '#f5d327',
};

/** 巨型僵尸的外骨骼：前几波几乎没有，随波数慢慢长 */
export function bossArmorMax(wave: number): number {
  return Math.min(90, Math.max(0, Math.round((wave - 4) * 4)));
}

export const WAVE = {
  breakTime: 6,
  /** 单波持续时间上限：到时自动进入下一波，残留怪会留场堆积 */
  duration: 36,
  /** 场上残敌少于这个数（且队列已空）时，最多再等 10 秒就进下一波 */
  fastAdvance: 5,
  fastAdvanceT: 10,
  spawnBase: 0.36,
  spawnMin: 0.12,
  maxOnScreen: 80,
  maxPerWave: 60,
  /** 待生成队列上限（堆积过多时丢弃最旧的） */
  maxQueued: 220,
  /** 普通怪血量成长：hpBase + (wave-1)*hpPerWave */
  hpBase: 1.15,
  hpPerWave: 0.2,
  /** Boss 血量成长系数 */
  bossHpPerWave: 0.10,
  /** 敌人伤害成长：1 + (wave-1)*dmgPerWave，封顶 dmgCap */
  dmgPerWave: 0.08,
  dmgCap: 3,
};

/** 蓄力重击（按住左键蓄力，松开释放） */
export const CHARGE = {
  time: 0.5,
  mul: 2.5,
  rangeMul: 1.5,
  arcMul: 1.25,
};

/** 处决：低血量敌人靠近按 X */
export const EXECUTE = {
  hpFrac: 0.22,
  range: 56,
  heal: 1,
  stone: 2,
  slowmo: 0.35,
};

/** 精英词缀 */
export interface EliteDef {
  id: string;
  name: string;
  color: string;
  hpMul: number;
  speedMul: number;
  dmgAdd: number;
  scaleMul: number;
}

export const ELITES: EliteDef[] = [
  { id: 'burn', name: '燃烧', color: '#ff7a30', hpMul: 1.2, speedMul: 1.1, dmgAdd: 1, scaleMul: 1 },
  { id: 'speedy', name: '迅捷', color: '#7ae0ff', hpMul: 0.9, speedMul: 1.55, dmgAdd: 0, scaleMul: 0.92 },
  { id: 'giant', name: '巨化', color: '#ff4a5a', hpMul: 2.2, speedMul: 0.85, dmgAdd: 2, scaleMul: 1.6 },
  { id: 'regen', name: '再生', color: '#6ee86e', hpMul: 1.1, speedMul: 1, dmgAdd: 0, scaleMul: 1 },
  { id: 'frost', name: '冰冻', color: '#9fd8ff', hpMul: 1.15, speedMul: 0.95, dmgAdd: 1, scaleMul: 1 },
  { id: 'shimmer', name: '幻影', color: '#c8b8ff', hpMul: 1, speedMul: 1.2, dmgAdd: 1, scaleMul: 0.96 },
  { id: 'split', name: '分裂', color: '#8ef0b0', hpMul: 1.1, speedMul: 1, dmgAdd: 0, scaleMul: 1 },
  { id: 'vampire', name: '汲取', color: '#c8343a', hpMul: 1.15, speedMul: 1.05, dmgAdd: 1, scaleMul: 1 },
  { id: 'thunder', name: '雷源', color: '#9fd8ff', hpMul: 1.15, speedMul: 0.95, dmgAdd: 1, scaleMul: 1.05 },
];

/** 护甲：铁→金→钻 三阶，减伤叠加 */
export const ARMOR = {
  /** dur = 耐久值，每挨一次伤害扣 1 点，归零就碎 */
  tiers: [
    { name: '皮革甲', cost: 3, red: 0.1, color: '#b07a4a', dur: 16, res: 'apple' },
    { name: '锁链甲', cost: 3, red: 0.14, color: '#9aa0a6', dur: 22, res: 'stone' },
    { name: '铁甲', cost: 3, red: 0.2, color: '#e2e2e2', dur: 28, res: 'iron' },
    { name: '金甲', cost: 3, red: 0.35, color: '#f5d327', dur: 20, res: 'gold' },
    { name: '钻石甲', cost: 3, red: 0.5, color: '#4aedd9', dur: 36, res: 'diamond' },
    { name: '下界合金甲', cost: 4, red: 0.62, color: '#7a3a5a', dur: 48, res: 'diamond' },
  ],
  /** 商人修护甲：每点耐久多少绿宝石 */
  repairEmerald: 1,
  goldenAppleCost: 3,
  goldenAppleGold: 1,
  goldenBuffT: 5,
  goldenInvuln: 3,
};

/** 地图宝箱 */
export const CHEST = {
  count: 7,
  minFromStart: 150,
};

/** 击杀慢镜头 */
export const SLOWMO = {
  multiKill: 3,
  time: 0.28,
  scale: 0.35,
};

/** 掉落磁吸（基础值，商店可升级） */
export const MAGNET = {
  base: 90,
  perLevel: 40,
  pickup: 16,
};

/** 反软锁：残敌指引（新波次规则下 10 秒就翻波，所以把施救时间提前到 8 秒） */
export const STALL = {
  fewLeft: 3,
  arrowAfter: 8,
  teleportAfter: 14,
};

/** 波次主题：每 4 波一次主题波（5 的倍数 Boss 波优先） */
export const THEME_WAVES: Record<number, { name: string; kinds: string[] }> = {
  4: { name: '蜘蛛狂潮', kinds: ['spider', 'spider', 'spider', 'fast', 'fast', 'normal'] },
  6: { name: '蠹虫巢穴', kinds: ['silverpack', 'spider', 'silverpack', 'fast', 'normal'] },
  8: { name: '骷髅军团', kinds: ['skeleton', 'skeleton', 'skeleton', 'witch', 'fast', 'normal'] },
  12: { name: '铁甲洪流', kinds: ['iron', 'iron', 'leather', 'leather', 'gold', 'fast'] },
  14: { name: '猎手小队', kinds: ['pillager', 'pillager', 'ravager', 'stray', 'skeleton'] },
  16: { name: '苦力怕狂潮', kinds: ['creeper', 'creeper', 'charged', 'charged', 'fast', 'normal'] },
  18: { name: '幽影巡夜', kinds: ['phantom', 'phantom', 'enderman', 'witherSkel', 'fast'] },
};

/** Boss 轮换：wave%10===0 出高压苦力怕王，其余 5 倍数出巨型僵尸 */
export const BOSS_CREEPER_EVERY = 10;

/** 高压苦力怕王 */
export const BOSS_CREEPER = {
  hp: 66,
  speed: 46,
  dmg: 5,
  r: 22,
  fuseRange: 92,
  fuseTime: 1.35,
  summonAt: 0.85,
  minis: 8,
  explodeRadius: 120,
  explodeDmg: 20,
  playerDmg: 7,
};

/** 巨型僵尸 Boss 阶段机制 */
export const BOSS_PHASE = {
  enrageAt: 0.66,
  rageAt: 0.33,
  summonCd: 2.4,
  summonN: 2,
  chargeCdMin: 3,
  chargeCdMax: 4,
  chargeTelegraph: 0.55,
  chargeSpeed: 460,
  chargeTime: 0.55,
  chargeDmg: 4,
  rockWindup: 0.45,
  rockCdMin: 1.4,
  rockCdMax: 2.2,
  rockSpeed: 185,
  rockDmg: 2,
  slamWindup: 0.45,
  slamCd: 2.6,
  slamRange: 88,
  slamRadius: 84,
  slamDmg: 2,
  /** 二阶段震地追加的地刺环（数量 / 半径 / 间隔） */
  slamFangs: 8,
  slamFangR: 34,
  slamFangGap: 0.04,
};

/** 新手引导步骤（条件在 game 中判定） */
export const TUTORIAL = {
  steps: ['WASD 移动', '左键攻击敌人', '挥击石头矿点/苹果树采集', 'C 打开合成 · F 吃苹果回血', 'Q 放置墙体阻挡敌人'],
};

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));

/** 史莱姆：死亡分裂成 2 个小号，最小号不再分裂 */
export const SLIME = {
  sizes: 3,
  hpMul: [1, 0.55, 0.3],
  scaleMul: [1.2, 0.8, 0.5],
  dmgMul: [1, 0.6, 0.4],
  hopTime: 0.7,
  hopSpeed: 150,
};

/** 烈焰人：悬停远程火球 */
export const BLAZE = {
  hoverDist: 170,
  bobSpeed: 3,
  shootCdMin: 1.8,
  shootCdMax: 2.8,
  windup: 0.5,
  fireballSpeed: 170,
  fireballDmg: 2,
};

/** 幻翼：飞行无视墙体，盘旋俯冲 */
export const PHANTOM = {
  orbitR: 120,
  orbitSpeed: 1.6,
  diveCdMin: 2.4,
  diveCdMax: 3.6,
  diveSpeed: 260,
  diveTime: 0.9,
  riseSpeed: 90,
};

/** 凋灵骷髅：箭矢附带凋零效果 */
export const WITHER_SKEL = {
  arrowSpeed: 200,
  arrowDmg: 1,
  witherTime: 4,
  witherTick: 0.8,
  witherDmg: 1,
  cdMin: 2.0,
  cdMax: 3.2,
  retreat: 90,
  hold: 170,
};

/** 火焰弹（第 6 槽投掷武器） */
export const FIREBALL = {
  unlockKills: 40,
  speed: 240,
  life: 1.4,
  radius: 42,
  dmg: 5,
  playerDmg: 2,
  cd: 0.6,
  maxAmmo: 999,
};

/** 营火：放置后范围回血 */
export const CAMPFIRE = {
  coalCost: 2,
  stoneCost: 4,
  duration: 40,
  radius: 85,
  healEvery: 1.5,
  healAmt: 1,
};

/** 铁傀儡：友军单位（怪物会主动攻击它） */
export const GOLEM = {
  ironCost: 8,
  hp: 220,
  dmg: 8,
  cd: 1.1,
  range: 34,
  knockback: 130,
  follow: 130,
  speed: 55,
  /** 仇恨半径：范围内的怪物会优先攻击铁傀儡 */
  aggroR: 175,
  /** 怪物攻击铁傀儡的间隔 */
  hitCd: 0.9,
  /** 铁傀儡受到怪物伤害的倍率 */
  dmgTakenMul: 5,
};

/** 附魔书：随机给当前武器附魔 */
export const ENCHANT_DEFS = [
  { id: 'sharp', name: '锋利', icon: '🗡', desc: '近战伤害 +25%' },
  { id: 'power', name: '力量', icon: '🏹', desc: '弓箭伤害 +30%' },
  { id: 'fire', name: '火焰附加', icon: '🔥', desc: '近战点燃敌人' },
  { id: 'knock', name: '击退', icon: '💥', desc: '近战击退翻倍' },
] as const;

/** 女巫掉落药水：拾取即饮 */
export const POTION_DROPS = [
  { id: 'heal', name: '治疗药水', color: '#ff5a8a', desc: '回复 6 HP' },
  { id: 'speed', name: '迅捷药水', color: '#7ae0ff', desc: '6 秒移速 +25%' },
  { id: 'strength', name: '力量药水', color: '#ff9a3c', desc: '8 秒伤害 +30%' },
] as const;

export const POTION_EFFECTS = {
  heal: 6,
  speedT: 6,
  speedMul: 1.25,
  strT: 8,
  strMul: 1.3,
};

/** 流浪商人：波间出现，E 键交易 */
export const TRADER = {
  appearChance: 0.7,
  minD: 130,
  maxD: 260,
  offers: [
    { cost: ['stone', 8], give: ['apple', 3], label: '8 石 → 3 苹果' },
    { cost: ['gold', 2], give: ['emerald', 2], label: '2 金 → 2 绿宝石' },
    { cost: ['iron', 2], give: ['potion', 1], label: '2 铁 → 治疗药水' },
    { cost: ['emerald', 15], give: ['growth', 1], label: '15 绿宝石 → 随机成长' },
    { cost: ['gunpowder', 3], give: ['iron', 2], label: '3 火药 → 2 铁' },
    { cost: ['gold', 1], give: ['fireball', 5], label: '1 金 → 5 火焰弹' },
    { cost: ['emerald', 3], give: ['armorRepair', 1], label: '3 绿宝石 → 修满护甲耐久' },
    { cost: ['stone', 4], give: ['wall', 60], label: '4 石 → 60 块墙' },
    { cost: ['coal', 4], give: ['apple', 4], label: '4 煤 → 4 苹果' },
  ],
};

/** 音乐唱片：切换本局 BGM 风格 */
export const DISCS = [
  { id: 'chill', name: '风之唱片', color: '#7ae0ff' },
  { id: 'battle', name: '战之唱片', color: '#ff7a30' },
  { id: 'rain', name: '雨之唱片', color: '#c98af0' },
] as const;

/** 黑暗波：wave 9/14/19/... 全图黑暗，只有玩家周围有光 */
export const DARK_WAVE = {
  startWave: 9,
  every: 5,
  lightRadius: 78,
  extraMobs: 1.25,
};

/** 附魔金苹果：宝箱稀有掉落 */
export const EAPPLE = {
  healFull: true,
  maxHpAdd: 2,
  buffT: 8,
};

/** 凋灵 Boss：wave 15/30/... */
export const WITHER = {
  hp: 70,
  skullDmg: 3,
  skullSpeed: 200,
  volley: 3,
  volleyCdMin: 1.4,
  volleyCdMax: 2.2,
  explodeRadius: 30,
  explodeDmg: 3,
  witherTime: 4,
  rageAt: 0.5,
  rageVolley: 5,
  hoverD: 150,
  spiralWindup: 0.4,
  spiralCd: 4,
  spiralN: 10,
};

/** 末影龙：飞行 BOSS，俯冲 + 龙息扇形 + 召唤蠹虫 */
export const DRAGON = {
  hp: 120,
  hoverD: 180,
  diveWindup: 2,
  diveSpeed: 520,
  diveTime: 0.42,
  diveDmg: 6,
  diveCdMin: 3.0,
  diveCdMax: 4.4,
  breathWindup: 0.5,
  breathN: 7,
  breathSpeed: 185,
  breathDmg: 3,
  breathSpread: 0.7,
  breathCdMin: 1.4,
  breathCdMax: 2.0,
  summonAt: 0.55,
  summonN: 8,
  rageAt: 0.35,
};

/** 监守者：失明 BOSS，只在你发出声音（移动/攻击/冲刺）时锁定 */
export const WARDEN = {
  hp: 100,
  roarWindup: 2,
  roarCdMin: 2.6,
  roarCdMax: 3.6,
  roarLen: 320,
  roarHalf: 24,
  roarDmg: 4,
  slamCd: 2.8,
  slamR: 78,
  slamDmg: 5,
  slamRange: 90,
  /** 声音系统：玩家动作产生的"噪音"，超过阈值才被锁定 */
  lockAt: 1.0,
  forgetAfter: 1.6,
  noiseDecay: 0.85,
  noiseMove: 1.6,
  noiseAttack: 2.6,
  noiseDash: 2.0,
  noiseShoot: 1.4,
};

/** 僵尸猪人：中立，受击后狂暴并呼朋引伴 */
export const PIGMAN = {
  alertRadius: 230,
  frenzySpeed: 92,
  frenzyDmg: 3,
  calmSpeed: 22,
  calmWander: 40,
};

/** 蠹虫：集群快速小怪 */
export const SILVERFISH = {
  packMin: 3,
  packMax: 5,
  spawnGap: 16,
};

/** 溺尸：投掷三叉戟 */
export const DROWNED = {
  tridentSpeed: 220,
  tridentDmg: 2,
  cdMin: 2.2,
  cdMax: 3.4,
  windup: 0.5,
  range: 330,
  retreat: 90,
  hold: 170,
};

/** 流浪者：骷髅变种，冰霜箭命中减速 */
export const STRAY = {
  windup: 0.6,
  cdMin: 2.4,
  cdMax: 3.4,
  range: 340,
  retreat: 84,
  hold: 160,
  arrowSpeed: 168,
  arrowDmg: 1,
  slowT: 2.2,
};

/** 守卫者：蓄力激光，锁定一条直线持续灼烧 */
export const GUARDIAN = {
  windup: 0.95,
  cdMin: 2.8,
  cdMax: 4.0,
  range: 300,
  keep: 170,
  beamTime: 1.1,
  beamLen: 210,
  beamHalf: 9,
  beamTick: 0.22,
  beamDmg: 2,
};

/** 唤魔者：召唤尖牙阵，低血召唤蠹虫 */
export const EVOKER = {
  windup: 0.7,
  cdMin: 3.6,
  cdMax: 5.0,
  range: 280,
  retreat: 96,
  hold: 180,
  fangCount: 6,
  fangGap: 24,
  fangDelay: 0.06,
  fangRise: 0.4,
  fangDmg: 3,
  fangHitR: 13,
  summonAt: 0.5,
};

/** 掠夺者：弩箭快速直射 */
export const PILLAGER = {
  windup: 0.5,
  cdMin: 2.2,
  cdMax: 3.2,
  range: 380,
  retreat: 108,
  hold: 190,
  boltSpeed: 330,
  boltDmg: 3,
};

/** 劫掠兽：蓄力后直线冲锋，撞墙破墙 */
export const RAVAGER = {
  telegraph: 0.55,
  chargeTime: 0.75,
  chargeSpeed: 250,
  chargeCdMin: 3.2,
  chargeCdMax: 4.6,
  chargeRange: 150,
  chargeDmg: 4,
  wallTick: 0.2,
};

/** 事件波：怪物成群、配比特殊，逼迫玩家换打法 */
export const EVENT_WAVES: Record<number, { name: string; kinds: string[]; mul: number }> = {
  11: { name: '僵尸围城', kinds: ['normal', 'normal', 'normal', 'leather', 'fast'], mul: 2 },
  13: { name: '掠夺者袭击', kinds: ['pillager', 'pillager', 'evoker', 'skeleton', 'witherSkel', 'drowned'], mul: 1.4 },
  17: { name: '苦力怕围爆', kinds: ['creeper', 'charged', 'creeper', 'charged', 'fast'], mul: 1.3 },
  19: { name: '守卫者齐射', kinds: ['guardian', 'guardian', 'drowned', 'pillager', 'evoker'], mul: 1.5 },
  21: { name: '末影围猎', kinds: ['enderman', 'enderman', 'phantom', 'phantom', 'spider'], mul: 1.7 },
  23: { name: '猪人狂怒', kinds: ['pigman', 'pigman', 'pigman', 'ravager', 'gold'], mul: 1.5 },
};

/** 红石：矿点采集→合成红石陷阱 */
export const REDSTONE = {
  nodes: 6,
  nodeHp: 2,
  perNode: 3,
  trapCost: 3,
  trapStoneCost: 2,
  trapRadius: 34,
  trapDmg: 5,
  trapSlow: 2.5,
  trapSlowMul: 0.5,
  trapLife: 25,
};

/** 天降空投补给 */
export const SUPPLY = {
  firstAt: 75,
  every: 90,
  fallTime: 3.2,
  lifetime: 60,
  emeraldChance: 0.4,
  enchantChance: 0.15,
  eappleChance: 0.1,
};

/** 难度：简单/普通/困难，影响敌强度与绿宝石收益 */
export const DIFFICULTIES = [
  { id: 'easy', name: '简单', hpMul: 0.8, dmgAdd: -1, emeraldMul: 0.7 },
  { id: 'normal', name: '普通', hpMul: 1, dmgAdd: 0, emeraldMul: 1 },
  { id: 'hard', name: '困难', hpMul: 1.25, dmgAdd: 1, emeraldMul: 1.5 },
] as const;

/** 背刺 / 暴击 / 连杀增益 */
export const COMBAT = {
  backstabMul: 1.5,
  backstabDot: -0.35,
  critBase: 0.05,
  critMul: 2,
  comboBuffAt: 8,
  comboDmgMul: 1.15,
  comboSpeedMul: 1.1,
};

/** 波次清场奖励 */
export const CLEAR_REWARD = {
  stone: 2,
  apple: 1,
  emeraldEvery: 5,
  emeraldN: 1,
};

/** 狂潮波：每 7 波一次，怪物数量暴涨、全体提速 */
export const HORDE = {
  every: 7,
  countMul: 1.8,
  speedMul: 1.12,
  emeraldN: 2,
};

/** 特殊天象：隔几波随机触发，整波生效，逼玩家重新理解地图 */
export const SKY = {
  names: { none: '', fog: '浓雾', sand: '沙尘暴', blood: '血月' } as Record<string, string>,
  every: 4,
  chance: 0.55,
  /** 浓雾 / 沙尘暴的可见半径 */
  fogRadius: 110,
  sandRadius: 150,
  /** 沙尘暴：玩家移速打折 */
  sandSlow: 0.14,
  /** 血月：怪物提速与加伤 */
  bloodSpeed: 1.15,
  bloodDmgAdd: 1,
};

/** 骷髅族三连射（第 8 波起） */
export const TRIPLE_SHOT = {
  fromWave: 8,
  gap: 0.13,
  windup: 0.55,
};

/** 蜘蛛扑击附带蛛网减速 */
export const SPIDER_WEB = {
  slowT: 2.0,
  slowMul: 0.5,
};

/** 苦力怕疾冲（第 6 波起，靠近后短距离加速） */
export const CREEPER_DASH = {
  fromWave: 6,
  range: 110,
  speedMul: 1.75,
  time: 0.55,
  cd: 3.4,
  windup: 0.35,
};

/** 女巫虚弱药水：命中削弱玩家输出 */
export const WITCH_WEAK = {
  weakT: 6,
  dmgMul: 0.72,
  chance: 0.45,
};

/** BOSS 领域：就地圈出一块战场，打完消失 */
export const DOMAIN = {
  /** 半径（格）：29x21 格的场地，外面只压暗不封死，杂兵能涌进来 */
  halfW: 14,
  halfH: 10,
  /** 末影水晶 */
  crystalHp: 26,
  crystalOffset: 9,
  /** 监守者尖啸体 */
  shriekCd: 6,
  shriekPulse: 0.7,
  shriekNoise: 2.8,
  /** 龙在还有水晶时的技能冷却倍率 */
  crystalBuffMul: 0.55,
  /** 水晶被打碎时龙的硬直 */
  crystalStagger: 0.9,
  /** BOSS 血量到这两个比例时会换位（遁地 / 飞走） */
  repositionAt: [0.66, 0.33],
  repositionInvuln: 0.9,
  repositionGap: 240,
};

/** 统一"危险预警"色（所有蓄力/冲锋/落雷/X 招式共用一种，玩家只需记一种颜色） */
export const DANGER = '#ffb040';

/** 每 10 波一次的成长三选一 */
export const GROWTH_WAVES = 10;

export interface GrowthDef {
  id: string;
  name: string;
  desc: string;
  color: string;
  /** 可叠加次数，0 = 不限 */
  max: number;
}

export const GROWTHS: GrowthDef[] = [
  { id: 'atk', name: '力量', desc: '近战与弓箭伤害 +15%', color: '#ff6a6a', max: 0 },
  { id: 'spd', name: '轻身', desc: '移动速度 +8%', color: '#7ae0ff', max: 0 },
  { id: 'hp', name: '强健', desc: '最大生命 +6 并立即回满', color: '#6ee86e', max: 0 },
  { id: 'crit', name: '锐利', desc: '暴击率 +8%', color: '#ffd24a', max: 0 },
  { id: 'cdr', name: '巧手', desc: '武器冷却 -10%', color: '#c8b8ff', max: 0 },
  { id: 'lifesteal', name: '夺魂', desc: '击杀回复 1 点生命', color: '#c8343a', max: 0 },
  { id: 'magnet', name: '磁石', desc: '拾取磁吸 +80px', color: '#8ef0b0', max: 0 },
  { id: 'emerald', name: '贪婪', desc: '绿宝石收益 +30%', color: '#2fae5a', max: 0 },
  { id: 'armor', name: '铁皮', desc: '受到伤害 -8%', color: '#e2e2e2', max: 0 },
  { id: 'dash', name: '疾行', desc: '冲刺冷却 -25%', color: '#9fe8ff', max: 0 },
  { id: 'regen', name: '再生', desc: '每次清场额外回复 2 点生命', color: '#7ae0ff', max: 0 },
  { id: 'rage', name: '狂怒', desc: '生命低于 30% 时伤害 +35%', color: '#ff8a30', max: 1 },
  // ── 改变打法的构筑（每样只能拿一次）──
  { id: 'dashFire', name: '火焰冲刺', desc: '冲刺撞到的敌人被点燃并受伤', color: '#ff7a30', max: 1 },
  { id: 'pierceShot', name: '贯穿箭', desc: '箭矢可再穿透 2 个目标（每个 −15% 伤害）', color: '#9fe8ff', max: 1 },
  { id: 'executeBlast', name: '处决爆裂', desc: '处决时对周围敌人造成范围伤害', color: '#c8343a', max: 1 },
  { id: 'berserk', name: '背水', desc: '生命低于 40% 时攻速 +35%，但受伤 +15%', color: '#ff4a5a', max: 1 },
  { id: 'thorns', name: '荆棘', desc: '受到攻击时反弹伤害给周围敌人', color: '#8ef0b0', max: 1 },
  { id: 'chainBolt', name: '连锁闪电', desc: '暴击时对附近 2 个敌人放电', color: '#7ad8ff', max: 1 },
  { id: 'scavenge', name: '拾荒', desc: '击杀有 30% 概率掉落苹果', color: '#ffd76b', max: 1 },
  { id: 'rapidShot', name: '速射', desc: '弓箭冷却 −35%', color: '#c8b8ff', max: 1 },
  // ── 第二批：更细分的流派（同样只能拿一次）──
  { id: 'parryReflect', name: '箭矢反弹', desc: '格挡箭矢后 30% 概率反弹一支', color: '#9fe8ff', max: 1 },
  { id: 'fireArrow', name: '火焰箭', desc: '箭矢命中点燃敌人 3 秒', color: '#ff7a30', max: 1 },
  { id: 'frostArrow', name: '冰霜箭', desc: '箭矢命中减速敌人', color: '#9fd8ff', max: 1 },
  { id: 'doubleShot', name: '双发', desc: '每次射击额外射出一支箭', color: '#c8b8ff', max: 1 },
  { id: 'arrowSpeed', name: '疾箭', desc: '箭速 +25% 并附带穿透', color: '#8fd6ff', max: 1 },
  { id: 'wallMaster', name: '筑城', desc: '墙体耐久 +3，放墙返还 1 石', color: '#c9a26b', max: 1 },
  { id: 'trapMaster', name: '陷阱师', desc: '红石陷阱伤害 +50%、半径 +30%', color: '#ff5a5a', max: 1 },
  { id: 'campfireMaster', name: '篝火师', desc: '营火回血速度翻倍', color: '#ff9a3c', max: 1 },
  { id: 'golemMaster', name: '巨像', desc: '铁傀儡伤害与血量 +50%', color: '#e2e2e2', max: 1 },
  { id: 'blastMaster', name: '爆破专家', desc: '你的爆炸伤害与半径 +25%', color: '#ff8a30', max: 1 },
  { id: 'blastResist', name: '抗爆', desc: '自己受到的爆炸伤害 −70%', color: '#8a8a92', max: 1 },
  { id: 'harvest', name: '快采', desc: '采集矿点速度翻倍', color: '#c9c9c0', max: 1 },
  { id: 'superMagnet', name: '磁石护符', desc: '拾取磁吸 +150px', color: '#8ef0b0', max: 1 },
  { id: 'lucky', name: '幸运', desc: '击杀有 8% 概率掉绿宝石', color: '#2fae5a', max: 1 },
  { id: 'hunter', name: '猎人', desc: '对远程怪伤害 +25%', color: '#ffd76b', max: 1 },
  { id: 'execHeal', name: '处决回春', desc: '处决额外回复 2 点生命', color: '#ff6a8a', max: 1 },
  { id: 'shieldParry', name: '盾墙', desc: '受到远程伤害 −30%', color: '#9aa0a6', max: 1 },
  { id: 'gale', name: '疾风', desc: '冲刺后 2 秒移速 +20%', color: '#7ae0ff', max: 1 },
  { id: 'beast', name: '兽性', desc: '本波每次击杀 +1% 伤害（上限 +30%）', color: '#c8343a', max: 1 },
  { id: 'creeperGentle', name: '拆弹专家', desc: '苦力怕引信时间 +35%', color: '#8ef06a', max: 1 },
  // ── 武器派系专精（配合武器线等级）──
  { id: 'wpnBow', name: '弓术精通', desc: '弓箭伤害 +20%、冷却 −10%', color: '#c8b8ff', max: 1 },
  { id: 'wpnCross', name: '弩术精通', desc: '弩伤害 +25%、三连发变四连发', color: '#9fe8ff', max: 1 },
  { id: 'wpnMace', name: '重锤精通', desc: '重锤伤害 +25%、击退 +40%', color: '#d8d8d0', max: 1 },
  { id: 'wpnTrident', name: '投枪精通', desc: '三叉戟伤害 +30%、穿透 +1', color: '#4ae0d0', max: 1 },
  { id: 'wpnAxe', name: '斧战精通', desc: '斧头伤害 +25%、挥击范围 +15%', color: '#c9a26b', max: 1 },
  { id: 'wpnBlastGift', name: '爆破赠礼', desc: '扔出 TNT 后原地留下一个红石陷阱', color: '#ff5a5a', max: 1 },
  { id: 'fireAura', name: '燃烧光环', desc: '投出火焰弹后自身燃烧 4 秒，近身敌人持续掉血', color: '#ff9a3c', max: 1 },
  { id: 'wpnRod', name: '钓术精通', desc: '钓竿拉拽眩晕时间 +40%', color: '#b08a54', max: 1 },
  { id: 'wpnReturn', name: '回旋投枪', desc: '三叉戟投出后会飞回来，返程同样造成伤害', color: '#4ae0d0', max: 1 },
  { id: 'wpnFire', name: '火法精通', desc: '火焰弹伤害 +30%', color: '#ff9a3c', max: 1 },
  { id: 'wpnBlast', name: '爆破精通', desc: 'TNT 伤害 +25%、爆炸半径 +15%', color: '#ff8a30', max: 1 },
];

/** 可选角色职业 */
export interface JobDef {
  id: string;
  name: string;
  tag: string;
  desc: string;
}

export const JOBS: JobDef[] = [
  { id: 'warrior', name: '战士', tag: '近战', desc: '近战伤害 +25%、最大生命 +4，但移速 -6%' },
  { id: 'ranger', name: '游侠', tag: '远程', desc: '弓箭伤害 +35%、弓提前到 50 杀解锁，移速 +4%' },
  { id: 'engineer', name: '工程师', tag: '建造', desc: '开局 10 石 + 20 墙 + 10 陷阱；墙更硬，陷阱伤害翻倍' },
  { id: 'miner', name: '矿工', tag: '采集', desc: '开采速度翻倍、开局 20 石、每次采矿额外 +1 石' },
  { id: 'alchemist', name: '炼金师', tag: '道具', desc: '开局 5 苹果 + 力量药水；TNT/火焰弹合成双倍' },
  { id: 'assassin', name: '刺客', tag: '敏捷', desc: '移速 +8%、暴击 +8%、冲刺冷却 −30%' },
  { id: 'enderman', name: '末影人', tag: '位移', desc: 'H 键瞬移 84px（3 秒冷却），可穿墙脱身' },
  { id: 'beastmaster', name: '驯兽师', tag: '召唤', desc: '苦力怕不炸你；J 键吹哨召唤一只苦力怕伙伴（12 秒）' },
];
