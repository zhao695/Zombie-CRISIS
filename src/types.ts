export interface PlayerState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  invuln: number;
  dashT: number;
  dashCd: number;
  dashDx: number;
  dashDy: number;
  facing: number;
  aim: number;
  walkT: number;
  moving: boolean;
  swingT: number;
  swingMax: number;
  swingCd: number;
  swingFrom: number;
  swingTo: number;
  swingKind: 'sword' | 'axe';
  hurtT: number;
  weapon: number;
  slot: number;
  bowCd: number;
  axeCd: number;
  spinT: number;
  spinTick: number;
  spinAngle: number;
  rodCd: number;
  tntAmmo: number;
  tntCd: number;
  fireCd: number;
  buffT: number;
  slowT: number;
  witherT: number;
  witherTick: number;
  speedT: number;
  strT: number;
  stone: number;
  apples: number;
  gunpowder: number;
  eyes: number;
  walls: number;
  iron: number;
  gold: number;
  diamond: number;
  coal: number;
  goldApples: number;
  eapples: number;
  fireballs: number;
  potion: string;
  armor: number;
  /** 当前护甲耐久 */
  armorDur: number;
  /** 燃烧光环剩余时间（火法词条） */
  burnAuraT: number;
  /** 护甲耐久上限 */
  armorMax: number;
  charge: number;
  eatCd: number;
  teleCd: number;
  placing: boolean;
  placingKind: 'wall' | 'trap';
  combo: number;
  comboT: number;
  redstone: number;
  traps: number;
  critT: number;
  /** 虚弱：女巫药水命中后输出打折 */
  weakT: number;
  /** 武器技能冷却（R 键） */
  skillCd: number;
}

export interface ZombieState {
  id: number;
  kind: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  r: number;
  scale: number;
  flash: number;
  fuse: number;
  anim: number;
  shootCd: number;
  windup: number;
  abilCd: number;
  crouch: number;
  stateT: number;
  silenced: number;
  tx: number;
  ty: number;
  dead: boolean;
  affix: string;
  chargeT: number;
  chargeDx: number;
  chargeDy: number;
  enraged: boolean;
  size: number;
  burnT: number;
  hoverT: number;
  slowT: number;
  beamT: number;
  beamA: number;
  beamTick: number;
  rockT: number;
  slamT: number;
  slamCd: number;
  spiralT: number;
  spiralCd: number;
  stuckT: number;
  phase: number;
  /** 眩晕剩余时间（钓竿拉近后触发），期间不移动不攻击 */
  stunT: number;
  /** 巨型僵尸外骨骼护甲值（>0 时减伤，只能在其破绽窗口内削） */
  armorHp: number;
  /** 破绽窗口剩余时间（震地/撞墙后的硬直） */
  exposeT: number;
  /** 凋灵剩余头颅数（3/2/1，掉一个少一种弹幕） */
  headsLeft: number;
  /** BOSS 专用计时：俯冲 / 龙息 / 咆哮 / 锁定 */
  diveT: number;
  breathT: number;
  roarT: number;
  lockT: number;
  /** 攻击铁傀儡的冷却 */
  atkT: number;
}

export interface FangState {
  x: number;
  y: number;
  t: number;
  max: number;
  hit: boolean;
}

export interface ArrowState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  fromPlayer: boolean;
  angle: number;
  wither?: boolean;
  trident?: boolean;
  slow?: boolean;
  /** 剩余可穿透次数（贯穿箭） */
  pierce?: number;
  /** 火焰箭：命中点燃 */
  burn?: boolean;
  /** 回旋投掷物（三叉戟） */
  boomerang?: boolean;
  returned?: boolean;
}

export interface HookState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: 'fly' | 'pull' | 'return';
  targetId: number;
  t: number;
}

export interface TntState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuse: number;
}

export interface PotionState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  life: number;
}

export interface ExplosionFx {
  x: number;
  y: number;
  r: number;
  t: number;
  max: number;
}

export interface Scorch {
  x: number;
  y: number;
  r: number;
  t: number;
  max: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  grav: number;
}

export interface DmgNum {
  /** 来源目标 id：用于合并连续命中 */
  src?: number;
  /** 累计伤害 */
  acc?: number;
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  color: string;
  big?: boolean;
}

export interface SlashFx {
  x: number;
  y: number;
  angle: number;
  arc: number;
  range: number;
  t: number;
  max: number;
  color?: string;
}

export interface DropState {
  x: number;
  y: number;
  life: number;
  bob: number;
  kind:
    | 'heart'
    | 'apple'
    | 'gunpowder'
    | 'eye'
    | 'xp'
    | 'emerald'
    | 'iron'
    | 'gold'
    | 'diamond'
    | 'coal'
    | 'potion'
    | 'enchant'
    | 'disc'
    | 'fireball'
    | 'eapple'
    | 'redstone';
  sub?: string;
  mag?: boolean;
}

export interface ChestState {
  x: number;
  y: number;
  opened: boolean;
  anim: number;
}

export interface RunStats {
  wave: number;
  kills: number;
  time: number;
  stone: number;
  apples: number;
  powder: number;
  eyes: number;
  emeralds: number;
  chests: number;
  executed: number;
  heavyHits: number;
  dmg: number;
  crits: number;
  supplies: number;
  newBest: boolean;
}

export interface ResourceNode {
  kind: 'stone' | 'tree' | 'redstone';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shake: number;
}

export interface Banner {
  title: string;
  sub: string;
  t: number;
  max: number;
}

export interface LightningStrike {
  x: number;
  y: number;
  t: number;
  max: number;
  struck: boolean;
}

export interface FireballState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  fromPlayer: boolean;
  skull: boolean;
  r: number;
}

export interface GolemState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  anim: number;
  swingT: number;
  targetId: number;
  flash: number;
}

export interface CampfireState {
  x: number;
  y: number;
  t: number;
  max: number;
  heal: number;
}

export interface TraderState {
  x: number;
  y: number;
  anim: number;
  bob: number;
}

export interface DashGhost {
  x: number;
  y: number;
  t: number;
  max: number;
}

export interface CloudShadow {
  x: number;
  y: number;
  r: number;
  vx: number;
}

export interface SupplyState {
  x: number;
  y: number;
  fallT: number;
  landed: boolean;
  life: number;
  opened: boolean;
}

export interface TrapState {
  x: number;
  y: number;
  t: number;
  max: number;
  armed: boolean;
}

export interface Ripple {
  x: number;
  y: number;
  t: number;
  max: number;
}

export interface AchievementToast {
  title: string;
  sub: string;
  t: number;
  max: number;
}

/** BOSS 领域：就地圈出的战场 */
export interface DomainState {
  kind: 'dragon' | 'warden' | 'generic';
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
  /** 本领域新建的墙体格索引，结束后逐一拆除 */
  walls: number[];
  t: number;
}

export interface CrystalState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  flash: number;
  dead: boolean;
}

export interface ShriekerState {
  x: number;
  y: number;
  cd: number;
  pulse: number;
  anim: number;
}
