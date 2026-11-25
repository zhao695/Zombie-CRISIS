import {
  ARMOR,
  AXE,
  BOW,
  CHARGE,
  CHEST,
  COMBAT,
  CROSSBOW,
  MACE,
  DARK_WAVE,
  DIFFICULTIES,
  FIREBALL,
  GATHER,
  GROWTHS,
  JOBS,
  MAGNET,
  MAPS,
  PLAYER,
  POTION_EFFECTS,
  ROD,
  SKILLS,
  SKY,
  SLOT_NAMES,
  SLOT_ORDER,
  SLOWMO,
  SUPPLY,
  TNT,
  TRADER,
  TRIDENT,
  VIEW_H,
  VIEW_W,
  WARDEN,
  WITHER_SKEL,
  WORLD,
  clamp,
} from './config';
import { AudioSys } from './audio';
import { dailyKey, loadBest, loadDaily, saveBest, saveDaily, weekKey, weekSeed } from './save';
import { LB_READY, lbSubmit, lbTop, loadName, saveName } from './leaderboard';
import type { LbRow } from './leaderboard';
import type { Best } from './save';
import { ACHIEVEMENTS, loadMeta, saveMeta, RELICS, UPGRADES, upgradeCost } from './meta';
import type { MetaState } from './meta';
import { Music } from './music';
import type { Input } from './input';
import type {
  AchievementToast,
  ArrowState,
  Banner,
  CampfireState,
  ChestState,
  CloudShadow,
  CrystalState,
  DashGhost,
  DmgNum,
  DomainState,
  DropState,
  ExplosionFx,
  FangState,
  FireballState,
  GolemState,
  HookState,
  LightningStrike,
  Particle,
  PlayerState,
  PotionState,
  ResourceNode,
  Ripple,
  RunStats,
  Scorch,
  ShriekerState,
  SlashFx,
  SupplyState,
  TntState,
  TraderState,
  TrapState,
  ZombieState,
} from './types';
import { world } from './world';
import { mulberry32 } from './sys/rng';
import type { Rng } from './sys/rng';
import * as combat from './sys/combat';
import * as zombies from './sys/zombies';
import * as waves from './sys/waves';
import * as weather from './sys/weather';
import * as domain from './sys/domain';
import * as items from './sys/items';

function makePlayer(): PlayerState {
  return {
    x: world.start.x,
    y: world.start.y,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    invuln: 0,
    dashT: 0,
    dashCd: 0,
    dashDx: 1,
    dashDy: 0,
    facing: 1,
    aim: 0,
    walkT: 0,
    moving: false,
    swingT: 0,
    swingMax: 0,
    swingCd: 0,
    swingFrom: 0,
    swingTo: 0,
    swingKind: 'sword',
    hurtT: 0,
    weapon: 0,
    slot: 0,
    bowCd: 0,
    axeCd: 0,
    spinT: 0,
    spinTick: 0,
    spinAngle: 0,
    rodCd: 0,
    tntAmmo: TNT.startAmmo,
    tntCd: 0,
    fireCd: 0,
    buffT: 0,
    slowT: 0,
    witherT: 0,
    witherTick: 0,
    speedT: 0,
    strT: 0,
    stone: 0,
    apples: 0,
    gunpowder: 0,
    eyes: 0,
    walls: 0,
    iron: 0,
    gold: 0,
    diamond: 0,
    coal: 0,
    goldApples: 0,
    eapples: 0,
    fireballs: 3,
    potion: '',
    armor: 0,
    armorDur: 0,
    burnAuraT: 0,
    armorMax: 0,
    charge: 0,
    eatCd: 0,
    teleCd: 0,
    placing: false,
    placingKind: 'wall',
    combo: 0,
    comboT: 0,
    redstone: 0,
    traps: 0,
    critT: 0,
    weakT: 0,
    skillCd: 0,
  };
}

export type Phase = 'menu' | 'map' | 'bless' | 'play' | 'pause' | 'over' | 'grow';

export class Game {
  phase: Phase = 'menu';
  mapIdx = 0;
  player: PlayerState = makePlayer();
  zombies: ZombieState[] = [];
  arrows: ArrowState[] = [];
  fangs: FangState[] = [];
  hooks: HookState[] = [];
  tnts: TntState[] = [];
  potions: PotionState[] = [];
  explosions: ExplosionFx[] = [];
  scorches: Scorch[] = [];
  particles: Particle[] = [];
  numbers: DmgNum[] = [];
  slashes: SlashFx[] = [];
  drops: DropState[] = [];
  nodes: ResourceNode[] = [];
  chests: ChestState[] = [];
  wallDirty = false;
  placeTarget = { tx: 0, ty: 0, ok: false, active: false };

  cam = { x: 0, y: 0 };

  wave = 0;
  kills = 0;
  runTime = 0;
  time = 0;
  overT = 0;
  seed = 0;

  spawnQueue: string[] = [];
  spawnTimer = 0;
  breakT = 0;
  waveActive = false;
  /** 当前波剩余时间：归零后直接开启下一波，残留敌人留场堆积 */
  waveT = 0;
  /** 本波是否已发放清场奖励 */
  clearRewarded = false;

  shake = 0;
  hitStop = 0;
  flash = 0;
  slowmo = 0;
  weather = 0;
  lightning: LightningStrike[] = [];
  lightningTimer = 6;
  /** 特殊天象：none / fog / sand / blood，整波生效 */
  sky: 'none' | 'fog' | 'sand' | 'blood' = 'none';
  /** 狂潮波标记 */
  horde = false;
  /** 玩家"噪音"：监守者靠它锁定你，移动/攻击/冲刺会提高 */
  noise = 0;

  banner: Banner = { title: '', sub: '', t: 0, max: 1 };
  best: Best = loadBest();
  meta: MetaState = loadMeta();
  audio = new AudioSys();
  music = new Music(this.audio);

  relics: string[] = [];
  blessing: string[] = [];
  craftMenu = false;
  lastRun: RunStats | null = null;
  stallTimer = 0;
  tutStep = 0;
  tutDone = true;
  runEmeralds = 0;
  gathered = { stone: 0, apples: 0, powder: 0, eyes: 0 };
  runExecuted = 0;
  runHeavy = 0;
  runChests = 0;
  eatenCount = 0;
  placedWallCount = 0;
  private wasMouseDown = false;
  private inputRef: Input | null = null;

  nextId = 1;
  private lastMove = { x: 0, y: 1 };

  fireballs: FireballState[] = [];
  golems: GolemState[] = [];
  campfires: CampfireState[] = [];
  traders: TraderState[] = [];
  dashGhosts: DashGhost[] = [];
  clouds: CloudShadow[] = [];
  enchants: string[] = [];
  discs: string[] = [];
  discStyle = 'default';
  tradeMenu = false;
  darkK = 0;
  /** BOSS 领域 */
  domain: DomainState | null = null;
  crystals: CrystalState[] = [];
  shriekers: ShriekerState[] = [];
  /** 本局成长（每 10 波三选一） */
  growth: Record<string, number> = {};
  /** 职业 */
  job = 'warrior';
  /** 待选的成长三选一（非空时进入 grow 阶段） */
  growthChoices: string[] = [];
  /** 靠近领域边缘的提示强度 */
  domainHint = 0;
  /** 兽性构筑：本波击杀叠加的伤害层数 */
  beastStacks = 0;
  /** 本局累计击杀（用于"击杀数给成长"） */
  killCount = 0;
  /** 下一次按击杀数发成长所需的击杀数 */
  nextGrowthKills = 90;
  /** 这次成长是否来自波次边界（决定选完是否翻波） */
  growthAtBoundary = false;
  /** 成长卡高亮下标（Enter 确认，避免误触） */
  growthSel = 0;
  /** 每把武器的击杀数（武器线成长） */
  weaponXp: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  /** 当前这次伤害来自哪把武器（击杀归属用） */
  dmgSrc = 0;
  /** 燃烧光环的伤害计时 */
  auraTick = 0;
  /** 震慑定身：>0 时不能移动也不能冲刺 */
  rootT = 0;
  /** 主菜单的作者信是否展开 */
  letterOpen = false;
  /** 触屏模式：HUD 排版走手机布局（地图移右上等） */
  touchUI = false;
  /** 排行榜面板 */
  lbOpen = false;
  lbRows: LbRow[] | null = null;
  lbMsg = '';
  lbSent = false;
  runStart = 0;
  myName = '';
  /** 末影龙龙息地火区域 */
  breathZones: { x: number; y: number; t: number; tick: number }[] = [];
  /** 延迟爆炸队列（苦力怕王死亡引爆） */
  pendingBlasts: { x: number; y: number; t: number }[] = [];
  /** 已提示过解锁的武器槽 */
  unlockSeen: boolean[] = [true, false, false, false, false, false, false, false, false];
  supplies: SupplyState[] = [];
  traps: TrapState[] = [];
  ripples: Ripple[] = [];
  supplyTimer = SUPPLY.firstAt;
  achToast: AchievementToast | null = null;
  zoomT = 0;
  runDmg = 0;
  runCrits = 0;
  runSupplies = 0;
  totemUsed = false;
  daily = loadDaily();
  diffIdx = Math.min(Math.max(this.meta.diff || 1, 0), DIFFICULTIES.length - 1);
  dailyMode = false;

  /** 种子确定性随机数（保证同一种子整局可复现） */
  rnd: Rng = Math.random;

  rndRange(a: number, b: number): number {
    return a + (b - a) * this.rnd();
  }

  rndInt(a: number, b: number): number {
    return a + Math.floor(this.rnd() * (b - a + 1));
  }

  hasRelic(id: string): boolean {
    return this.relics.includes(id);
  }

  metaLvl(id: string): number {
    return this.meta.lvls[id] || 0;
  }

  speedMul(): number {
    const comboBuff = this.player.combo >= COMBAT.comboBuffAt ? COMBAT.comboSpeedMul : 1;
    // 沙尘暴：逆风走不动，逼你提前规划路线
    const skyMul = this.sky === 'sand' ? 1 - SKY.sandSlow : 1;
    return (
      (1 + 0.05 * this.metaLvl('speed')) *
      (this.hasRelic('swift') ? 1.15 : 1) *
      comboBuff *
      skyMul *
      (1 + 0.08 * this.growthLvl('spd')) *
      (this.job === 'ranger' ? 1.04 : this.job === 'warrior' ? 0.94 : this.job === 'assassin' ? 1.08 : 1)
    );
  }

  magnetRange(): number {
    return MAGNET.base + MAGNET.perLevel * this.metaLvl('magnet') + (this.hasRelic('magnet') ? 60 : 0) + 80 * this.growthLvl('magnet');
  }

  armorRed(): number {
    const base = this.player.armor > 0 ? ARMOR.tiers[this.player.armor - 1].red : 0;
    return Math.min(0.78, base + 0.08 * this.growthLvl('armor'));
  }

  isNewPlayer(): boolean {
    return this.meta.emeralds === 0 && Object.keys(this.meta.lvls).length === 0 && this.best.wave === 0;
  }

  unlocked(slot: number): boolean {
    const k = this.kills;
    if (slot === 0) return true;
    if (slot === 1) return k >= BOW.unlockKills;
    if (slot === 2) return k >= AXE.unlockKills;
    if (slot === 3) return k >= ROD.unlockKills;
    if (slot === 4) return k >= TNT.unlockKills;
    return k >= FIREBALL.unlockKills;
  }

  /** 武器线等级：自己击杀 + 全局保底（总击杀/120，最高 Lv3） */
  weaponLvl(slot: number): number {
    const own = this.weaponXp[slot] ?? 0;
    const lvl = own >= 220 ? 4 : own >= 110 ? 3 : own >= 40 ? 2 : 1;
    const floorLv = Math.min(3, 1 + Math.floor(this.kills / 120));
    return Math.max(lvl, floorLv);
  }

  weaponMul(slot: number): number {
    return 1 + 0.15 * (this.weaponLvl(slot) - 1);
  }

  weaponCdMul(slot: number): number {
    return Math.max(0.8, 1 - 0.05 * (this.weaponLvl(slot) - 1));
  }

  unlockNeed(slot: number): number {
    // 游侠：弓提前到 50 击杀
    if (slot === 1) return this.job === 'ranger' ? 50 : BOW.unlockKills;
    if (slot === 2) return AXE.unlockKills;
    if (slot === 3) return ROD.unlockKills;
    if (slot === 4) return TNT.unlockKills;
    if (slot === 6) return TRIDENT.unlockKills;
    if (slot === 7) return CROSSBOW.unlockKills;
    if (slot === 8) return MACE.unlockKills;
    return FIREBALL.unlockKills;
  }

  /** 武器技能（R 键） */
  useSkill() {
    combat.useSkill(this);
  }

  swingMace() {
    combat.swingMace(this);
  }

  throwTrident() {
    combat.throwTrident(this);
  }

  fireCrossbow() {
    combat.fireCrossbow(this);
  }

  /** 手机端点职业格：直接选中该职业 */
  pickJob(id: string) {
    if (JOBS.some((j) => j.id === id)) this.job = id;
  }

  start(daily = false, mapId?: string) {
    this.dailyMode = daily;
    this.lbSent = false;
    this.runStart = Date.now();
    this.myName = loadName();
    this.seed = daily ? weekSeed() : Math.floor(Math.random() * 0x7fffffff) + 1;
    this.rnd = mulberry32(this.seed);
    world.generate(this.seed, mapId ?? MAPS[this.mapIdx].id);
    this.player = makePlayer();
    this.zombies = [];
    this.arrows = [];
    this.fangs = [];
    this.hooks = [];
    this.tnts = [];
    this.potions = [];
    this.explosions = [];
    this.scorches = [];
    this.particles = [];
    this.numbers = [];
    this.slashes = [];
    this.drops = [];
    this.nodes = [];
    this.chests = [];
    this.wallDirty = true;
    this.placeTarget = { tx: 0, ty: 0, ok: false, active: false };
    world.clearWalls();
    this.wave = 0;
    this.kills = 0;
    this.runTime = 0;
    this.overT = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.breakT = 0;
    this.waveActive = false;
    this.waveT = 0;
    this.clearRewarded = false;
    this.shake = 0;
    this.hitStop = 0;
    this.flash = 0;
    this.slowmo = 0;
    this.weather = 0;
    this.lightning = [];
    this.lightningTimer = 6;
    this.sky = 'none';
    this.horde = false;
    this.noise = 0;
    this.banner = { title: '', sub: '', t: 0, max: 1 };
    this.nextId = 1;
    this.stallTimer = 0;
    this.runEmeralds = 0;
    this.killCount = 0;
    this.nextGrowthKills = 90;
    this.gathered = { stone: 0, apples: 0, powder: 0, eyes: 0 };
    this.runExecuted = 0;
    this.runHeavy = 0;
    this.runChests = 0;
    this.eatenCount = 0;
    this.placedWallCount = 0;
    this.relics = [];
    this.craftMenu = false;
    this.tradeMenu = false;
    this.wasMouseDown = false;
    this.fireballs = [];
    this.golems = [];
    this.campfires = [];
    this.traders = [];
    this.dashGhosts = [];
    this.enchants = [];
    this.discs = [];
    this.discStyle = 'default';
    this.darkK = 0;
    this.domain = null;
    this.crystals = [];
    this.shriekers = [];
    this.growth = {};
    this.growthChoices = [];
    this.clouds = [];
    this.supplies = [];
    this.traps = [];
    this.ripples = [];
    this.supplyTimer = SUPPLY.firstAt;
    this.achToast = null;
    this.zoomT = 0;
    this.runDmg = 0;
    this.runCrits = 0;
    this.runSupplies = 0;
    this.totemUsed = false;
    for (let i = 0; i < 7; i++) {
      this.clouds.push({
        x: this.rndRange(0, WORLD.w),
        y: this.rndRange(0, WORLD.h),
        r: this.rndRange(90, 190),
        vx: this.rndRange(7, 20),
      });
    }
    this.music.setStyle('default');
    this.cam = {
      x: clamp(this.player.x - VIEW_W / 2, 0, WORLD.w - VIEW_W),
      y: clamp(this.player.y - VIEW_H / 2, 0, WORLD.h - VIEW_H),
    };
    this.tutDone = !this.isNewPlayer();
    this.tutStep = 0;

    // 商店强化应用到本局
    const p = this.player;
    p.maxHp = PLAYER.maxHp + 2 * this.metaLvl('hp');
    p.hp = p.maxHp;
    p.apples += 2 * this.metaLvl('apple');
    p.stone += 5 * this.metaLvl('stone');
    p.walls += this.metaLvl('wall');

    // 开局三选一祝福
    const pool = [...RELICS].sort(() => this.rnd() - 0.5);
    this.blessing = pool.slice(0, 3).map((r) => r.id);
    this.phase = 'bless';
  }

  private beginRun(choice: number) {
    const id = this.blessing[choice];
    if (id) this.relics.push(id);
    this.blessing = [];
    this.phase = 'play';
    // 职业初始加成
    const p = this.player;
    if (this.job === 'warrior') {
      p.maxHp += 4;
      p.hp = p.maxHp;
    } else if (this.job === 'miner') {
      this.player.stone += 20;
      this.player.walls += 2;
    } else if (this.job === 'alchemist') {
      this.player.apples += 5;
      this.player.potion = 'strength';
    } else if (this.job === 'ranger') {
      p.apples += 2;
    } else if (this.job === 'engineer') {
      p.stone += 10;
      p.walls += 20;
      p.traps += 10;
      p.iron += 1;
    }
    this.spawnChests();
    this.spawnNodes();
    this.nextWave();
    this.audio.bless();
  }

  private spawnChests() {
    const p = this.player;
    for (let i = 0; i < CHEST.count; i++) {
      const w = world.findSpawn(p.x, p.y, CHEST.minFromStart, 900, 30);
      this.chests.push({ x: w.x, y: w.y, opened: false, anim: 0 });
    }
  }

  private buyUpgrade(idx: number) {
    const u = UPGRADES[idx];
    if (!u) return;
    const lvl = this.metaLvl(u.id);
    if (lvl >= u.maxLvl) {
      this.audio.click();
      return;
    }
    const cost = upgradeCost(u, lvl);
    if (this.meta.emeralds < cost) {
      this.audio.click();
      return;
    }
    this.meta.emeralds -= cost;
    this.meta.lvls[u.id] = lvl + 1;
    saveMeta(this.meta);
    this.audio.buy();
  }

  cycleDifficulty() {
    this.diffIdx = (this.diffIdx + 1) % DIFFICULTIES.length;
    this.meta.diff = this.diffIdx;
    saveMeta(this.meta);
    this.audio.click();
  }

  diffDef() {
    return DIFFICULTIES[this.diffIdx];
  }

  metaKills(): number {
    return this.meta.kills | 0;
  }

  unlockAch(id: string, cond = true) {
    if (!cond) return;
    if (this.meta.ach[id]) return;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    this.meta.ach[id] = 1;
    saveMeta(this.meta);
    this.achToast = { title: `成就达成 ${def.icon} ${def.name}`, sub: def.desc, t: 0, max: 3.2 };
    this.audio.ach();
  }

  updateAchToast(dt: number) {
    if (this.achToast) {
      this.achToast.t += dt;
      if (this.achToast.t >= this.achToast.max) this.achToast = null;
    }
  }

  toMenu() {
    this.phase = 'menu';
    this.lastRun = null;
    this.craftMenu = false;
    this.tradeMenu = false;
  }

  key(code: string) {
    this.audio.unlock();
    this.music.start();
    if (code === 'KeyM') {
      this.audio.toggleMute();
      return;
    }
    // P / Esc 都当暂停键；浏览器全屏时 ESC 可能被系统吞掉，所以 P 是可靠备选
    if (code === 'KeyP' || code === 'Esc') code = 'Escape';
    if (this.phase === 'menu') {
      if (this.letterOpen) {
        if (code === 'Escape' || code === 'KeyL' || code === 'Enter' || code === 'Space') this.letterOpen = false;
        return;
      }
      if (code === 'KeyL') {
        this.letterOpen = true;
        return;
      }
      if (code === 'Enter' || code === 'Space') {
        this.dailyMode = false;
        this.phase = 'map';
      }
      else if (code === 'KeyD') this.cycleDifficulty();
      else if (code === 'KeyZ') {
        this.daily = loadDaily();
        this.start(true);
      } else if (code.startsWith('Digit')) {
        let n = Number(code.slice(5));
        if (n === 0) n = 10;
        if (n >= 1 && n <= UPGRADES.length) this.buyUpgrade(n - 1);
      } else if (code === 'Minus') this.buyUpgrade(10);
      else if (code === 'Equal') this.buyUpgrade(11);
      return;
    }
    if (this.phase === 'map') {
      // 职业选择：Q / E 切换
      if (code === 'KeyQ') this.job = JOBS[(JOBS.findIndex((j) => j.id === this.job) + JOBS.length - 1) % JOBS.length].id;
      else if (code === 'KeyE') this.job = JOBS[(JOBS.findIndex((j) => j.id === this.job) + 1) % JOBS.length].id;
      else if (code === 'Escape') this.phase = 'menu';
      else if (code.startsWith('Digit')) {
        const n = Number(code.slice(5));
        if (n >= 1 && n <= MAPS.length) {
          this.mapIdx = n - 1;
        }
      } else if (code === 'ArrowLeft' || code === 'KeyA') this.mapIdx = (this.mapIdx + MAPS.length - 1) % MAPS.length;
      else if (code === 'ArrowRight' || code === 'KeyD') this.mapIdx = (this.mapIdx + 1) % MAPS.length;
      else if (code === 'Enter' || code === 'Space') this.start(false, MAPS[this.mapIdx].id);
      return;
    }
    if (this.phase === 'grow') {
      // 数字键 / 方向键只移动高亮，Enter 或空格才确认（防左键误触）
      if (code === 'Digit1') this.growthSel = 0;
      else if (code === 'Digit2') this.growthSel = 1;
      else if (code === 'Digit3') this.growthSel = 2;
      else if (code === 'ArrowLeft' || code === 'KeyA') this.growthSel = Math.max(0, this.growthSel - 1);
      else if (code === 'ArrowRight' || code === 'KeyD') this.growthSel = Math.min(2, this.growthSel + 1);
      else if (code === 'Enter' || code === 'Space') this.chooseGrowth(this.growthSel);
      // 不允许跳过成长：ESC 直接选第一张，避免卡在选卡界面
      else if (code === 'Escape') this.chooseGrowth(0);
      return;
    }
    if (this.phase === 'bless') {
      if (code === 'Digit1') this.beginRun(0);
      else if (code === 'Digit2') this.beginRun(1);
      else if (code === 'Digit3') this.beginRun(2);
      else if (code === 'Enter') this.beginRun(0);
      else if (code === 'Escape') this.phase = 'map';
      return;
    }
    if (this.phase === 'over') {
      if (code === 'KeyN') {
        const n = window.prompt('输入昵称（最多 12 字）', this.myName);
        if (n) {
          saveName(n);
          this.myName = loadName();
          this.lbMsg = '昵称已改为 ' + this.myName;
        }
        return;
      }
      if (code === 'KeyR') this.start(this.dailyMode);
      else if (code === 'Escape') this.toMenu();
      return;
    }
    if (this.phase === 'pause') {
      if (code === 'Digit1') this.audio.setMusicVol(Math.min(0.5, Math.round((this.audio.musicVol + 0.05) * 20) / 20));
      else if (code === 'Digit2') this.audio.setMusicVol(Math.max(0, Math.round((this.audio.musicVol - 0.05) * 20) / 20));
      else if (code === 'Digit3') this.audio.setSfxVol(Math.min(0.5, Math.round((this.audio.sfxVol + 0.05) * 20) / 20));
      else if (code === 'Digit4') this.audio.setSfxVol(Math.max(0, Math.round((this.audio.sfxVol - 0.05) * 20) / 20));
      else if (code === 'Digit5') this.start(this.dailyMode);
      else if (code === 'Digit6') this.toMenu();
      if (code === 'Escape') this.phase = 'play';
      return;
    }
    if (this.phase === 'play') {
      if (this.tradeMenu) {
        if (code.startsWith('Digit')) {
          const n = Number(code.slice(5));
          if (n >= 1 && n <= TRADER.offers.length) this.doTrade(n - 1);
        } else if (code === 'KeyE' || code === 'Escape') this.tradeMenu = false;
        return;
      }
      if (this.craftMenu) {
        if (code === 'Digit1') this.craftRecipe(1);
        else if (code === 'Digit2') this.craftRecipe(2);
        else if (code === 'Digit3') this.craftRecipe(3);
        else if (code === 'Digit4') this.craftRecipe(4);
        else if (code === 'Digit5') this.craftRecipe(5);
        else if (code === 'Digit6') this.craftRecipe(6);
        else if (code === 'Digit7') this.craftRecipe(7);
        else if (code === 'Digit8') this.craftRecipe(8);
        else if (code === 'Digit9') this.craftRecipe(9);
        else if (code === 'KeyC' || code === 'Escape') this.craftMenu = false;
        return;
      }
      if (code === 'Escape') {
        if (this.player.placing) this.player.placing = false;
        else this.phase = 'pause';
        return;
      }
      if (code === 'Digit1') this.selectSlot(SLOT_ORDER[0]);
      else if (code === 'Digit2') this.selectSlot(SLOT_ORDER[1]);
      else if (code === 'Digit3') this.selectSlot(SLOT_ORDER[2]);
      else if (code === 'Digit4') this.selectSlot(SLOT_ORDER[3]);
      else if (code === 'Digit5') this.selectSlot(SLOT_ORDER[4]);
      else if (code === 'Digit6') this.selectSlot(SLOT_ORDER[5]);
      else if (code === 'Digit7') this.selectSlot(SLOT_ORDER[6]);
      else if (code === 'Digit8') this.selectSlot(SLOT_ORDER[7]);
      else if (code === 'Digit9') this.selectSlot(SLOT_ORDER[8]);
      else if (code === 'KeyR') this.useSkill();
      else if (code === 'KeyH') this.tryBlink();
      else if (code === 'KeyJ') this.tryWhistle();
      else if (code === 'KeyE') {
        if (this.nearTrader()) this.tradeMenu = true;
        else if (this.player.potion) this.drinkPotion();
        else this.trySpin();
      } else if (code === 'Space') this.tryDash();
      else if (code === 'KeyF') this.tryEat();
      else if (code === 'KeyC') this.craftMenu = !this.craftMenu;
      else if (code === 'KeyV') this.craftTnt();
      else if (code === 'KeyT') this.tryTeleportEye();
      else if (code === 'KeyQ') this.togglePlacing('wall');
      else if (code === 'KeyG') this.togglePlacing('trap');
      else if (code === 'KeyX') this.tryExecute();
    }
  }

  selectSlot(slot: number) {
    const p = this.player;
    if (this.phase !== 'play') return;
    if (!this.unlocked(slot)) {
      this.lockedHint(slot);
      return;
    }
    if (p.slot !== slot) {
      p.slot = slot;
      this.audio.click();
    }
  }

  lockedHint(slot: number) {
    const p = this.player;
    this.numbers.push({
      x: p.x,
      y: p.y - 44,
      vy: -18,
      life: 0.8,
      max: 0.8,
      text: `${this.unlockNeed(slot)} 击杀解锁${SLOT_NAMES[slot]}`,
      color: '#9aa0a6',
    });
  }

  rightClick() {
    if (this.phase !== 'play') return;
    if (!this.unlocked(1)) {
      this.lockedHint(1);
      return;
    }
    this.shoot();
  }

  click() {
    this.audio.unlock();
    this.music.start();
    const mx = this.mouseX();
    const my = this.mouseY();
    if (this.phase === 'menu') {
      if (Math.abs(mx - 404) <= 26 && Math.abs(my - 20) <= 14) {
        this.toggleBoard();
        return;
      }
      if (this.lbOpen) {
        this.lbOpen = false;
        return;
      }
      // 点难度那一行切换难度
      if (Math.abs(my - 211) <= 10) {
        this.cycleDifficulty();
        return;
      }
      // 两个模式按钮
      if (Math.abs(my - 233) <= 11) {
        if (Math.abs(mx - (VIEW_W / 2 - 70)) <= 62) {
          this.dailyMode = false;
          this.phase = 'map';
          return;
        }
        if (Math.abs(mx - (VIEW_W / 2 + 70)) <= 62) {
          this.dailyMode = true;
          this.daily = loadDaily();
          this.diffIdx = DIFFICULTIES.length - 1;
          this.phase = 'map';
          return;
        }
      }
      // 右上角信封
      if (Math.abs(mx - 452) <= 18 && Math.abs(my - 20) <= 14) {
        this.letterOpen = !this.letterOpen;
        return;
      }
      if (this.letterOpen) {
        this.letterOpen = false;
        return;
      }
    } else if (this.phase === 'map') {
      for (let i = 0; i < MAPS.length; i++) {
        const cx = VIEW_W / 2 + (i - (MAPS.length - 1) / 2) * 92;
        if (Math.abs(mx - cx) <= 42 && Math.abs(my - 128) <= 52) {
          this.mapIdx = i;
          return;
        }
      }
      // 鼠标点职业格：直接选中该职业
      for (let i = 0; i < JOBS.length; i++) {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const cx = VIEW_W / 2 + (col - 1.5) * 112;
        const cy = 208 + row * 19;
        if (Math.abs(mx - cx) <= 52 && Math.abs(my - cy) <= 9) {
          this.pickJob(JOBS[i].id);
          return;
        }
      }
      if (Math.abs(my - 257) <= 11 && Math.abs(mx - VIEW_W / 2) <= 66) {
        this.start(false, MAPS[this.mapIdx].id);
        return;
      }
    } else if (this.phase === 'grow') {
      // 点击三张成长卡之一
      const W = VIEW_W;
      for (let i = 0; i < 3; i++) {
        const cx = W / 2 + (i - 1) * 104;
        if (Math.abs(mx - cx) <= 48 && Math.abs(my - 128) <= 33) {
          this.growthSel = i;
          return;
        }
      }
    } else if (this.phase === 'bless') {
      // 点击三张祝福卡之一
      const W = VIEW_W;
      for (let i = 0; i < 3; i++) {
        const cx = W / 2 + (i - 1) * 104;
        const rx = 96;
        const ry = 66;
        const dx = Math.abs(mx - cx);
        const dy = Math.abs(my - 128);
        if (dx <= rx / 2 && dy <= ry / 2) {
          this.beginRun(i);
          return;
        }
      }
      if (Math.abs(my - 194) <= 10 && Math.abs(mx - VIEW_W / 2) <= 110) this.phase = 'map';
    } else if (this.phase === 'over') {
      if (Math.abs(my - 226) <= 10) {
        this.toMenu();
        return;
      }
      if (this.overT > 0.7) this.start();
    } else if (this.phase === 'pause') {
      if (Math.abs(my - 216) <= 12) {
        if (Math.abs(mx - (VIEW_W / 2 - 120)) <= 42) this.phase = 'play';
        else if (Math.abs(mx - VIEW_W / 2) <= 46) this.start(this.dailyMode);
        else if (Math.abs(mx - (VIEW_W / 2 + 120)) <= 46) this.toMenu();
      }
    } else if (this.phase === 'play') {
      if (this.tradeMenu) {
        if (Math.abs(my - 230) <= 10 && Math.abs(mx - VIEW_W / 2) <= 56) this.tradeMenu = false;
        return;
      }
      if (this.craftMenu) {
        if (Math.abs(my - 248) <= 10 && Math.abs(mx - VIEW_W / 2) <= 56) this.craftMenu = false;
        return;
      }
      if (Math.abs(mx - (VIEW_W - 16)) <= 11 && Math.abs(my - 12) <= 9) {
        this.phase = 'pause';
      }
    }
  }

  private mouseX() {
    return this.inputRef?.mouseX ?? 0;
  }

  private mouseY() {
    return this.inputRef?.mouseY ?? 0;
  }

  // ===== 波次生成 (sys/waves) =====

  nextWave() {
    waves.nextWave(this);
  }

  buildWave(w: number): string[] {
    return waves.buildWave(this, w);
  }

  spawnZombie(kind: string, near?: { x: number; y: number }, minD?: number, maxD?: number) {
    waves.spawnZombie(this, kind, near, minD, maxD);
  }

  pushZombie(kind: string, x: number, y: number) {
    waves.pushZombie(this, kind, x, y);
  }

  updateSpawning(dt: number) {
    waves.updateSpawning(this, dt);
  }

  checkWave(dt: number) {
    waves.checkWave(this, dt);
  }

  // ===== 战斗 (sys/combat) =====

  burst(x: number, y: number, n: number, colors: string[], spd: number, grav: number, size = 2) {
    combat.burst(this, x, y, n, colors, spd, grav, size);
  }

  damageMul() {
    return combat.damageMul(this);
  }

  trySpin() {
    combat.trySpin(this);
  }

  updateSpin(dt: number) {
    combat.updateSpin(this, dt);
  }

  shoot() {
    combat.shoot(this);
  }

  swing(kind: 'sword' | 'axe', heavy = false) {
    combat.swing(this, kind, heavy);
  }

  parryArrows(range: number, arcHalf: number) {
    combat.parryArrows(this, range, arcHalf);
  }

  castRod() {
    combat.castRod(this);
  }

  updateHooks(dt: number) {
    combat.updateHooks(this, dt);
  }

  throwTnt() {
    combat.throwTnt(this);
  }

  updateTnts(dt: number) {
    combat.updateTnts(this, dt);
  }

  throwFireball() {
    // 火法·燃烧光环：投出火焰弹后自己烧起来 4 秒
    if (this.growthLvl('fireAura') > 0) this.player.burnAuraT = 4;
    combat.throwFireball(this);
  }

  updateFireballs(dt: number) {
    combat.updateFireballs(this, dt);
  }

  explodeAt(x: number, y: number, radius: number, dmg: number, playerDmg: number) {
    combat.explodeAt(this, x, y, radius, dmg, playerDmg);
  }

  updateArrows(dt: number) {
    combat.updateArrows(this, dt);
  }

  updatePotions(dt: number) {
    combat.updatePotions(this, dt);
  }

  splashPotion(o: PotionState) {
    combat.splashPotion(this, o);
  }

  hurtPlayer(dmg: number) {
    combat.hurtPlayer(this, dmg);
  }

  tryExecute() {
    combat.tryExecute(this);
  }

  // ===== 僵尸 AI (sys/zombies) =====

  updateZombies(dt: number) {
    zombies.updateZombies(this, dt);
  }

  updateFangs(dt: number) {
    zombies.updateFangs(this, dt);
  }

  updateBoss(z: ZombieState, dt: number, d: number) {
    zombies.updateBoss(this, z, dt, d);
  }

  steerFlow(z: ZombieState): { dx: number; dy: number } | null {
    return zombies.steerFlow(this, z);
  }

  teleportEnderman(z: ZombieState) {
    zombies.teleportEnderman(this, z);
  }

  skeletonFire(z: ZombieState) {
    zombies.skeletonFire(this, z);
  }

  witchThrow(z: ZombieState) {
    zombies.witchThrow(this, z);
  }

  damageZombie(z: ZombieState, dmg: number, angle: number) {
    zombies.damageZombie(this, z, dmg, angle);
  }

  alertPigmen(origin: ZombieState) {
    zombies.alertPigmen(this, origin);
  }

  killZombie(z: ZombieState) {
    zombies.killZombie(this, z);
  }

  levelUp(idx: number) {
    zombies.levelUp(this, idx);
  }

  // ===== 天气与特效 (sys/weather) =====

  updateWeather(dt: number) {
    weather.updateWeather(this, dt);
  }

  updateDomain(dt: number) {
    domain.updateDomain(this, dt);
  }

  enterDomain(kind: 'dragon' | 'warden', px: number, py: number) {
    domain.enterDomain(this, kind, px, py);
  }

  exitDomain() {
    domain.exitDomain(this);
  }

  hitCrystal(i: number, dmg: number) {
    domain.hitCrystal(this, i, dmg);
  }

  blastCrystals(x: number, y: number, radius: number) {
    domain.blastCrystals(this, x, y, radius);
  }

  // ===== 成长三选一（每 10 波） =====
  growthLvl(id: string): number {
    return this.growth[id] ?? 0;
  }

  openGrowth(atBoundary = false) {
    this.growthSel = 0;
    this.growthAtBoundary = atBoundary;
    const pool = GROWTHS.filter((d) => d.max === 0 || this.growthLvl(d.id) < d.max);
    const picks: string[] = [];
    // 保证每次三选一里至少有一张改变打法的牌
    const behavior = pool.filter((d) => d.max === 1);
    if (behavior.length > 0) picks.push(behavior[Math.floor(this.rnd() * behavior.length)].id);
    const bag = pool.filter((d) => !picks.includes(d.id));
    while (picks.length < 3 && bag.length > 0) {
      const k = Math.floor(this.rnd() * bag.length);
      picks.push(bag[k].id);
      bag.splice(k, 1);
    }
    this.growthChoices = picks;
    this.phase = 'grow';
    this.waveActive = false;
    this.banner = { title: '成长 · 三选一', sub: '按 1 / 2 / 3 或点击卡片', t: 2, max: 2 };
    this.audio.bless();
  }

  chooseGrowth(i: number) {
    const id = this.growthChoices[i];
    if (!id) return;
    this.grantGrowth(id);
    this.growthChoices = [];
    this.phase = 'play';
    this.waveActive = true;
    this.audio.levelup();
    // 波次边界给的成长：选完进下一波；击杀数给的成长：继续打当前波
    if (this.growthAtBoundary) this.nextWave();
    this.growthAtBoundary = false;
  }

  /** 应用一个成长（三选一、商人抽奖都用它） */
  grantGrowth(id: string) {
    const def = GROWTHS.find((d) => d.id === id);
    if (!def) return;
    this.growth[id] = this.growthLvl(id) + 1;
    if (id === 'hp') {
      this.player.maxHp += 6;
      this.player.hp = this.player.maxHp;
    }
    this.numbers.push({
      x: this.player.x,
      y: this.player.y - 54,
      vy: -18,
      life: 1.4,
      max: 1.4,
      text: `获得成长 · ${def.name}`,
      color: def.color,
      big: true,
    });
    this.burst(this.player.x, this.player.y - 18, 10, [def.color, '#ffffff'], 90, -30, 2);
  }

  /** 商人抽奖：随机给一个成长 */
  grantRandomGrowth() {
    const pool = GROWTHS.filter((d) => d.max === 0 || this.growthLvl(d.id) < d.max);
    if (pool.length === 0) return;
    this.grantGrowth(pool[Math.floor(this.rnd() * pool.length)].id);
  }

  updateClouds(dt: number) {
    weather.updateClouds(this, dt);
  }

  updateFx(dt: number) {
    weather.updateFx(this, dt);
  }

  // ===== 采集/道具/合成/商人/建筑 (sys/items) =====

  updateChests() {
    items.updateChests(this);
  }

  openChest(c: ChestState) {
    items.openChest(this, c);
  }

  updateSupplies(dt: number) {
    items.updateSupplies(this, dt);
  }

  updateTraps(dt: number) {
    items.updateTraps(this, dt);
  }

  updateDrops(dt: number) {
    items.updateDrops(this, dt);
  }

  updateCampfires(dt: number) {
    items.updateCampfires(this, dt);
  }

  updateGolems(dt: number) {
    items.updateGolems(this, dt);
  }

  updateTrader(dt: number) {
    items.updateTrader(this, dt);
  }

  spawnTrader() {
    items.spawnTrader(this);
  }

  nearTrader(): boolean {
    return items.nearTrader(this);
  }

  doTrade(i: number) {
    items.doTrade(this, i);
  }

  hitNode(n: ResourceNode) {
    items.hitNode(this, n);
  }

  spawnNodes() {
    items.spawnNodes(this);
  }

  tryEat() {
    items.tryEat(this);
  }

  tryTeleportEye() {
    items.tryTeleportEye(this);
  }

  drinkPotion() {
    if (this.player.potion === 'strength') {
      this.player.critT = Math.max(this.player.critT, 12);
      this.player.potion = '';
      this.audio.potion();
      this.numbers.push({ x: this.player.x, y: this.player.y - 50, vy: -16, life: 1.2, max: 1.2, text: '力量! 12 秒', color: '#ff6a6a', big: true });
      return;
    }
    items.drinkPotion(this);
  }

  applyEnchant() {
    items.applyEnchant(this);
  }

  applyDisc(id: string) {
    items.applyDisc(this, id);
  }

  craftWall() {
    items.craftWall(this);
  }

  craftTnt() {
    items.craftTnt(this);
  }

  craftRecipe(n: number) {
    items.craftRecipe(this, n);
  }

  togglePlacing(kind: 'wall' | 'trap') {
    items.togglePlacing(this, kind);
  }

  updatePlacing(input: Input) {
    items.updatePlacing(this, input);
  }

  tryPlaceWall(input: Input) {
    items.tryPlaceWall(this, input);
  }

  destroyWallsNear(x: number, y: number, radius: number) {
    items.destroyWallsNear(this, x, y, radius);
  }


  /** 结算时上传每日挑战成绩（只有每日挑战才进榜） */
  private async submitScore() {
    if (!this.dailyMode || this.lbSent || !LB_READY) return;
    this.lbSent = true;
    const seconds = Math.max(1, Math.round((Date.now() - this.runStart) / 1000));
    const ok = await lbSubmit({
      name: this.myName,
      wave: this.wave,
      kills: Math.round(this.kills),
      seconds,
      day: weekKey(),
      job: this.job,
      seed: this.seed,
    });
    this.lbMsg = ok ? '成绩已上传' : '成绩上传失败';
  }

  /** 打开/关闭排行榜，打开时拉当天前 20 */
  toggleBoard() {
    this.lbOpen = !this.lbOpen;
    if (!this.lbOpen) return;
    this.lbRows = null;
    this.lbMsg = LB_READY ? '加载中…' : '排行榜未配置（需要填 Supabase）';
    if (!LB_READY) return;
    lbTop(weekKey(), 20).then((rows) => {
      this.lbRows = rows;
      this.lbMsg = rows && rows.length > 0 ? '' : '本周还没有人上榜，来做第一个';
    });
  }
  // ===== 玩家 =====

  /** 驯兽师：吹哨召唤一只苦力怕伙伴（12 秒，帮你打怪） */
  private tryWhistle() {
    const p = this.player;
    if (this.job !== 'beastmaster') {
      this.numbers.push({ x: p.x, y: p.y - 46, vy: -16, life: 0.8, max: 0.8, text: '只有驯兽师能吹哨', color: '#9aa0a6' });
      return;
    }
    if (p.teleCd > 0) {
      this.numbers.push({ x: p.x, y: p.y - 46, vy: -16, life: 0.6, max: 0.6, text: `哨子冷却 ${p.teleCd.toFixed(1)}s`, color: '#9aa0a6' });
      return;
    }
    p.teleCd = 12;
    const spot = world.findSpawn(p.x, p.y, 26, 50, 12);
    this.golems.push({ x: spot.x, y: spot.y, hp: 22, maxHp: 22, anim: 0, swingT: 0, targetId: 0, flash: 0 });
    this.burst(spot.x, spot.y - 12, 18, ['#8ef06a', '#4a9a2a'], 130, 40, 3);
    this.audio.summon();
    this.numbers.push({ x: p.x, y: p.y - 50, vy: -16, life: 1.4, max: 1.4, text: '苦力怕伙伴出战!', color: '#8ef06a', big: true });
  }

  private tryBlink() {
    const p = this.player;
    if (this.job !== 'enderman') {
      this.numbers.push({ x: p.x, y: p.y - 46, vy: -16, life: 0.8, max: 0.8, text: '只有末影人职业能瞬移', color: '#9aa0a6' });
      return;
    }
    if (p.teleCd > 0) {
      this.numbers.push({ x: p.x, y: p.y - 46, vy: -16, life: 0.6, max: 0.6, text: `冷却 ${p.teleCd.toFixed(1)}s`, color: '#9aa0a6' });
      return;
    }
    p.teleCd = 3;
    const dist = 84;
    p.x += Math.cos(p.aim) * dist;
    p.y += Math.sin(p.aim) * dist;
    p.x = clamp(p.x, 16, WORLD.w - 16);
    p.y = clamp(p.y, 16, WORLD.h - 16);
    p.invuln = Math.max(p.invuln, 0.25);
    this.burst(p.x, p.y - 14, 16, ['#d06cff', '#8a3ac0'], 130, 30, 3);
    this.audio.teleport();
    this.numbers.push({ x: p.x, y: p.y - 48, vy: -16, life: 0.8, max: 0.8, text: '瞬移!', color: '#d06cff' });
  }

  private tryDash() {
    const p = this.player;
    if (this.rootT > 0) return;
    if (p.dashCd > 0 || p.dashT > 0) return;
    let dx = this.lastMove.x;
    let dy = this.lastMove.y;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(p.aim);
      dy = Math.sin(p.aim);
    }
    p.dashDx = dx;
    p.dashDy = dy;
    p.dashT = PLAYER.dashTime;
    p.dashCd = PLAYER.dashCd * (1 - 0.1 * this.metaLvl('dash')) * (1 - 0.25 * Math.min(2, this.growthLvl('dash')));
    this.audio.dash();
    this.addNoise(WARDEN.noiseDash);
    if (this.growthLvl('gale') > 0) p.speedT = Math.max(p.speedT, 2);
    // 火焰冲刺：冲刺起步时点燃身边的敌人
    if (this.growthLvl('dashFire') > 0) {
      for (const z of this.zombies) {
        if (z.dead) continue;
        if (Math.hypot(z.x - p.x, z.y - p.y) < 56) {
          z.burnT = Math.max(z.burnT, 2.2);
          this.damageZombie(z, 3, Math.atan2(z.y - p.y, z.x - p.x));
        }
      }
      this.burst(p.x, p.y - 14, 14, ['#ff7a30', '#ffd76b'], 140, 20, 2);
      this.shake = Math.max(this.shake, 3);
    }
  }

  /** 声音：监守者靠它锁定你。所有"发出动静"的动作都会推高噪音 */
  addNoise(n: number) {
    this.noise = Math.min(3.4, this.noise + n);
  }

  private checkUnlockNotice() {
    for (let s = 1; s <= 8; s++) {
      if (!this.unlockSeen[s] && this.unlocked(s)) {
        this.unlockSeen[s] = true;
        const sk = SKILLS[s];
        this.banner = {
          title: `解锁 ${s + 1} 号栏 · ${SLOT_NAMES[s]}`,
          sub: sk ? `R 技能：${sk.name} — ${sk.desc}` : '',
          t: 2.2,
          max: 2.2,
        };
        this.audio.levelup();
        this.numbers.push({ x: this.player.x, y: this.player.y - 56, vy: -14, life: 1.4, max: 1.4, text: `新武器：${SLOT_NAMES[s]}`, color: '#ffd76b', big: true });
      }
    }
  }

  private updatePlayer(dt: number, input: Input) {
    this.checkUnlockNotice();
    this.rootT = Math.max(0, this.rootT - dt);
    // 龙息地火：站在紫色区域里持续掉血
    for (const zn of this.breathZones) {
      zn.t -= dt;
      zn.tick -= dt;
      if (zn.tick <= 0 && Math.abs(this.player.x - zn.x) < 32 && Math.abs(this.player.y - zn.y) < 32) {
        zn.tick = 0.5;
        this.hurtPlayer(1);
      }
    }
    this.breathZones = this.breathZones.filter((zn) => zn.t > 0);
    // 燃烧光环：近身敌人持续被烧
    if (this.player.burnAuraT > 0) {
      this.player.burnAuraT -= dt;
      this.auraTick = (this.auraTick ?? 0) - dt;
      if (this.auraTick <= 0) {
        this.auraTick = 0.35;
        for (const z of this.zombies) {
          if (z.dead) continue;
          if (Math.hypot(z.x - this.player.x, z.y - this.player.y) < 52) {
            z.burnT = Math.max(z.burnT, 1.2);
            this.damageZombie(z, 3, Math.atan2(z.y - this.player.y, z.x - this.player.x));
          }
        }
        this.burst(this.player.x, this.player.y - 12, 4, ['#ff7a30', '#ffd76b'], 60, -30, 2);
      }
    }
    const p = this.player;
    p.aim = Math.atan2(this.cam.y + input.mouseY - (p.y - 14), this.cam.x + input.mouseX - p.x);
    // 触屏：始终面向最近的敌人（近战挥砍、远程射击都用这个朝向）
    if (input.touchMode && input.aimOverride !== null) p.aim = input.aimOverride;
    const c = Math.cos(p.aim);
    if (Math.abs(c) > 0.18) p.facing = c > 0 ? 1 : -1;

    p.invuln = Math.max(0, p.invuln - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.swingCd = Math.max(0, p.swingCd - dt);
    p.swingT = Math.max(0, p.swingT - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.bowCd = Math.max(0, p.bowCd - dt);
    p.axeCd = Math.max(0, p.axeCd - dt);
    p.rodCd = Math.max(0, p.rodCd - dt);
    p.tntCd = Math.max(0, p.tntCd - dt);
    p.buffT = Math.max(0, p.buffT - dt);
    p.slowT = Math.max(0, p.slowT - dt);
    p.speedT = Math.max(0, p.speedT - dt);
    p.strT = Math.max(0, p.strT - dt);
    p.weakT = Math.max(0, p.weakT - dt);
    p.skillCd = Math.max(0, p.skillCd - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    if (p.witherT > 0) {
      p.witherT -= dt;
      p.witherTick -= dt;
      if (p.witherTick <= 0) {
        p.witherTick = WITHER_SKEL.witherTick;
        p.hp = Math.max(0, p.hp - WITHER_SKEL.witherDmg);
        for (let i = 0; i < 5; i++) {
          this.particles.push({
            x: p.x + this.rndRange(-5, 5),
            y: p.y - this.rndRange(6, 22),
            vx: this.rndRange(-14, 14),
            vy: this.rndRange(-44, -12),
            life: 0.55,
            max: 0.55,
            color: '#1a1a1a',
            size: 2,
            grav: -20,
          });
        }
        this.audio.witherTick();
        if (p.hp <= 0) this.gameOver();
      }
    }
    p.eatCd = Math.max(0, p.eatCd - dt);
    p.teleCd = Math.max(0, p.teleCd - dt);
    this.updatePlacing(input);
    if (p.comboT > 0) {
      p.comboT -= dt;
      if (p.comboT <= 0) p.combo = 0;
    }

    const mv = this.rootT > 0 ? { x: 0, y: 0 } : input.moveVector();
    this.lastMove = mv;
    const slowMul = p.slowT > 0 ? 0.55 : 1;
    const potionMul = p.speedT > 0 ? POTION_EFFECTS.speedMul : 1;

    if (p.dashT > 0) {
      p.dashT -= dt;
      world.moveCircle(p, p.dashDx * PLAYER.dashSpeed * dt, p.dashDy * PLAYER.dashSpeed * dt, 7);
      if (this.rnd() < 0.35) {
        this.dashGhosts.push({ x: p.x, y: p.y - 16, t: 0.28, max: 0.28 });
      }
      if (this.rnd() < 0.7) {
        this.particles.push({
          x: p.x + this.rndRange(-6, 6),
          y: p.y - this.rndRange(0, 4),
          vx: this.rndRange(-20, 20),
          vy: this.rndRange(-30, -5),
          life: 0.3,
          max: 0.3,
          color: 'rgba(220,235,255,0.85)',
          size: 2,
          grav: 0,
        });
      }
    } else {
      world.moveCircle(p, mv.x * PLAYER.speed * this.speedMul() * slowMul * potionMul * dt, mv.y * PLAYER.speed * this.speedMul() * slowMul * potionMul * dt, 7);
      p.moving = mv.x !== 0 || mv.y !== 0;
    }
    if (p.moving) p.walkT += dt;
    // 领域：玩家不能走出去（杂兵可以进来）
    if (this.domain) {
      const c = domain.clampToDomain(this, p.x, p.y, 8);
      p.x = c.x;
      p.y = c.y;
    }
    // 噪音衰减 + 走路持续发声
    this.noise = Math.max(0, this.noise - WARDEN.noiseDecay * dt);
    if (p.moving && p.dashT <= 0) this.noise = Math.min(3.4, this.noise + WARDEN.noiseMove * dt);
    // 脚步声
    if (p.moving && p.dashT <= 0) {
      this.audio.lastFoot -= dt;
      if (this.audio.lastFoot <= 0) {
        this.audio.lastFoot = 0.24;
        this.audio.foot();
        // 走路扬尘
        this.particles.push({
          x: p.x + this.rndRange(-4, 4),
          y: p.y + 2,
          vx: this.rndRange(-14, 14),
          vy: this.rndRange(-18, -6),
          life: 0.3,
          max: 0.3,
          color: 'rgba(190,180,160,0.5)',
          size: 1.6,
          grav: 0,
        });
      }
    }

    if (input.mouseDown) {
      if (p.placing) {
        this.tryPlaceWall(input);
      } else if (p.spinT > 0) {
        // 旋转中无法使用其他武器
      } else if (p.slot === 0 && p.swingCd <= 0) {
        // 蓄力：按住积攒，松开释放
        if (!this.wasMouseDown) {
          p.charge = 0;
          this.audio.chargeUp();
        }
        p.charge = Math.min(1, p.charge + dt / CHARGE.time);
      } else if (p.slot === 1) this.shoot();
      else if (p.slot === 2) {
        if (p.swingCd <= 0) this.swing('axe');
      } else if (p.slot === 3) this.castRod();
      else if (p.slot === 4) this.throwTnt();
      else if (p.slot === 5) this.throwFireball();
      else if (p.slot === 6) this.throwTrident();
      else if (p.slot === 7) this.fireCrossbow();
      else if (p.slot === 8) {
        if (p.swingCd <= 0) this.swingMace();
      }
    }
    if (
      !input.mouseDown &&
      this.wasMouseDown &&
      p.slot === 0 &&
      !p.placing &&
      p.spinT <= 0 &&
      p.swingCd <= 0 &&
      p.charge > 0
    ) {
      if (p.charge >= 1) this.swing('sword', true);
      else this.swing('sword');
    }
    if (p.slot !== 0 || !input.mouseDown) p.charge = 0;
    this.wasMouseDown = input.mouseDown;
    if (input.rightDown && this.unlocked(1)) this.shoot();
  }

  // ===== 主循环 =====

  update(dt: number, input: Input) {
    this.time += dt;
    this.inputRef = input;

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.updateFx(dt * 0.2);
      return;
    }

    if (this.slowmo > 0) {
      this.slowmo -= dt;
      dt *= SLOWMO.scale;
    }

    if (this.phase === 'menu' || this.phase === 'map') {
      this.music.setScene('menu', this.weather);
      this.music.setIntensity(0.08);
      this.updateFx(dt);
      return;
    }
    if (this.phase === 'bless' || this.phase === 'grow') {
      this.music.setScene('menu', this.weather);
      this.music.setIntensity(0.1);
      this.updateFx(dt);
      return;
    }
    if (this.phase === 'pause') {
      this.music.setScene('pause', this.weather);
      this.music.setIntensity(0.05);
      return;
    }
    if (this.phase === 'over') {
      this.overT += dt;
      this.music.setScene('menu', this.weather);
      this.music.setIntensity(0.05);
      this.updateFx(dt);
      return;
    }

    const bossAlive = this.zombies.some((z) => z.kind.startsWith('boss') && !z.dead);
    this.music.setScene('play', this.weather);
    this.music.setIntensity(clamp(0.12 + this.zombies.length * 0.018 + (bossAlive ? 0.28 : 0) + (this.waveActive ? 0.06 : 0), 0, 1));

    const darkTarget =
      this.phase === 'play' && this.waveActive && (this.isDarkWave() || this.domain?.kind === 'warden') ? 1 : 0;
    this.darkK += (darkTarget - this.darkK) * Math.min(1, dt * 0.8);

    this.runTime += dt;
    world.updateFlow(this.player.x, this.player.y);
    this.updatePlayer(dt, input);
    this.updateSpin(dt);
    this.updateHooks(dt);
    this.updateTnts(dt);
    this.updateFireballs(dt);
    this.updatePotions(dt);
    this.updateZombies(dt);
    this.updateFangs(dt);
    this.music.setBoss(this.zombies.some((z) => !z.dead && (z.kind.startsWith('boss') || z.kind === 'wither')));
    this.music.setWave(this.wave);
    // 延迟爆炸：倒计时结束就炸
    for (const b of this.pendingBlasts) {
      b.t -= dt;
      if (b.t <= 0) {
        this.explodeAt(b.x, b.y, 150, 26, 8);
        b.t = 999;
      }
    }
    this.pendingBlasts = this.pendingBlasts.filter((b) => b.t < 900);
    this.updateArrows(dt);
    this.updateSpawning(dt);
    this.updateDrops(dt);
    this.updateChests();
    this.updateGolems(dt);
    this.updateCampfires(dt);
    this.updateTrader(dt);
    this.updateSupplies(dt);
    this.updateTraps(dt);
    this.updateClouds(dt);
    this.updateFx(dt);
    this.updateWeather(dt);
    this.updateDomain(dt);
    this.updateTutorial();
    this.updateAchToast(dt);
    this.zoomT = Math.max(0, this.zoomT - dt * 1.4);
    this.cleanup();
    this.checkWave(dt);

    const tx = clamp(this.player.x - VIEW_W / 2, 0, WORLD.w - VIEW_W);
    const ty = clamp(this.player.y - VIEW_H / 2, 0, WORLD.h - VIEW_H);
    const k = Math.min(1, dt * 10);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  }

  private updateTutorial() {
    if (this.tutDone) return;
    const p = this.player;
    const s = this.tutStep;
    if (s === 0 && p.moving) this.tutStep = 1;
    else if (s === 1 && this.kills >= 1) this.tutStep = 2;
    else if (s === 2 && (this.gathered.stone > 0 || this.gathered.apples > 0)) this.tutStep = 3;
    else if (s === 3 && this.eatenCount > 0) this.tutStep = 4;
    else if (s === 4 && this.placedWallCount > 0) {
      this.tutStep = 5;
      this.tutDone = true;
    }
  }

  wallCost(): number {
    return this.hasRelic('builder') ? 3 : GATHER.wallCost;
  }

  wallHp(): number {
    const base = this.hasRelic('builder') ? 5 : 1;
    return base + (this.job === 'engineer' ? 2 : 0);
  }

  isDarkWave() {
    return this.wave >= DARK_WAVE.startWave && (this.wave - DARK_WAVE.startWave) % DARK_WAVE.every === 0;
  }

  gameOver() {
    const p = this.player;
    // 不死图腾：每局一次原地复活
    if (this.hasRelic('totem') && !this.totemUsed) {
      this.totemUsed = true;
      p.hp = Math.max(1, Math.round(p.maxHp * 0.5));
      p.invuln = 3;
      p.witherT = 0;
      this.audio.bless();
      this.burst(p.x, p.y - 16, 24, ['#f5d327', '#ffffff', '#6ee86e'], 150, -60, 4);
      this.banner = { title: '不死图腾发动!', sub: '原地复活 · 50% 生命', t: 1.6, max: 1.6 };
      this.numbers.push({ x: p.x, y: p.y - 56, vy: -20, life: 1.6, max: 1.6, text: '复活!', color: '#f5d327', big: true });
      return;
    }
    this.phase = 'over';
    this.submitScore();
    this.overT = 0;
    this.shake = Math.max(this.shake, 8);
    const best: Best = {
      wave: Math.max(this.best.wave, this.wave),
      kills: Math.max(this.best.kills, this.kills),
    };
    const newBest = best.wave !== this.best.wave || best.kills !== this.best.kills;
    if (newBest) {
      this.best = best;
      saveBest(best);
    }
    const earned = Math.round(this.runEmeralds * (1 + 0.25 * this.metaLvl('emerald')) * this.diffDef().emeraldMul);
    this.meta.emeralds += earned;
    // 每日挑战纪录
    if (this.dailyMode) {
      const dk = dailyKey();
      if (this.wave > this.daily.wave || (this.wave === this.daily.wave && this.kills > this.daily.kills)) {
        this.daily = { day: dk, wave: this.wave, kills: this.kills };
        saveDaily(this.daily);
      }
    }
    // 成就结算
    this.unlockAch('rich', this.meta.emeralds >= 100);
    this.unlockAch('kill100', this.metaKills() >= 100);
    this.unlockAch('kill500', this.metaKills() >= 500);
    this.unlockAch('wave10', this.best.wave >= 10);
    this.unlockAch('wave20', this.best.wave >= 20);
    this.unlockAch('hard10', this.diffDef().id === 'hard' && this.wave >= 10);
    saveMeta(this.meta);
    this.lastRun = {
      wave: this.wave,
      kills: this.kills,
      time: this.runTime,
      stone: this.gathered.stone,
      apples: this.gathered.apples,
      powder: this.gathered.powder,
      eyes: this.gathered.eyes,
      emeralds: earned,
      chests: this.runChests,
      executed: this.runExecuted,
      heavyHits: this.runHeavy,
      dmg: this.runDmg,
      crits: this.runCrits,
      supplies: this.runSupplies,
      newBest,
    };
    if (earned > 0) this.audio.emerald();
  }

  private cleanup() {
    this.zombies = this.zombies.filter((z) => !z.dead);
  }
}
