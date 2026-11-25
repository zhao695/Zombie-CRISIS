import {
  bossArmorMax,
  CLEAR_REWARD,
  DARK_WAVE,
  ELITES,
  EVENT_WAVES,
  GROWTH_WAVES,
  HORDE,
  SILVERFISH,
  SKY,
  SPAWN,
  STALL,
  THEME_WAVES,
  TILE,
  TRADER,
  WAVE,
  WORLD,
  ZOMBIES,
  clamp,
} from '../config';
import type { Game } from '../game';
import { saveMeta } from '../meta';
import { world } from '../world';
import * as domain from './domain';

/** BOSS 轮换：每 5 波一只，5 种循环（5 巨型僵尸 → 10 苦力怕王 → 15 凋灵 → 20 监守者 → 25 末影龙） */
export function bossForWave(w: number): string {
  switch (Math.floor(w / 5) % 5) {
    case 1:
      return 'boss';
    case 2:
      return 'bossCreeper';
    case 3:
      return 'wither';
    case 4:
      return 'bossWarden';
    default:
      return 'bossDragon';
  }
}

const BOSS_LABELS: Record<string, string> = {
  boss: '巨型僵尸',
  bossCreeper: '高压苦力怕王',
  wither: '凋灵',
  bossWarden: '监守者',
  bossDragon: '末影龙',
};

export function nextWave(g: Game) {
  g.wave++;
  g.spawnNodes();
  g.waveActive = true;
  // 上一波没来得及生成的敌人保留在队列里，与新一波合并（僵尸狂潮越囤越多）
  g.spawnQueue.push(...buildWave(g, g.wave));
  if (g.spawnQueue.length > WAVE.maxQueued) g.spawnQueue.splice(0, g.spawnQueue.length - WAVE.maxQueued);
  g.spawnTimer = 0.45;
  g.waveT = WAVE.duration;
  g.clearRewarded = false;
  g.stallTimer = 0;
  // 商人不在翻波时被清掉（新版"清场立刻翻波"时，商人刚刷出来就会被抹掉），最多留 3 个
  if (g.traders.length > 3) g.traders = g.traders.slice(-3);
  // 狂潮波 / 特殊天象
  g.horde = g.wave % HORDE.every === 0;
  g.sky = 'none';
  if (g.wave >= 4 && g.wave % SKY.every === 0 && g.rnd() < SKY.chance) {
    const roll = g.rnd();
    g.sky = roll < 0.34 ? 'fog' : roll < 0.67 ? 'sand' : 'blood';
  }
  const theme = THEME_WAVES[g.wave];
  const ev = EVENT_WAVES[g.wave];
  const bossKind = bossForWave(g.wave);
  g.banner = {
    title: theme ? theme.name : ev ? ev.name : g.horde ? '僵尸狂潮!' : g.isDarkWave() ? '黑暗来袭' : `第 ${g.wave} 波`,
    sub: ev
      ? '特殊事件波 · 怪物大量来袭'
      : g.wave % 5 === 0
        ? `${BOSS_LABELS[bossKind]} 来袭`
        : g.horde
          ? '全图怪物成倍涌来 · 移速提升'
          : g.isDarkWave()
            ? `WAVE ${g.wave} · 敌人潜伏在黑暗中`
            : `WAVE ${g.wave}`,
    t: 1.6,
    max: 1.6,
  };
  g.audio.waveStart();
  if (g.wave % 5 === 0) g.audio.boss();
  // 天象提示优先给"没有更重要横幅"的波次（Boss/事件/主题波不抢）
  if (g.sky !== 'none' && !theme && !ev && g.wave % 5 !== 0) {
    g.banner = {
      title: SKY.names[g.sky],
      sub:
        g.sky === 'fog'
          ? '视野受限 · 靠小地图与火把认路'
          : g.sky === 'sand'
            ? '移速下降 · 远程更难打准'
            : '怪物狂暴 · 掉落更丰厚',
      t: 2.2,
      max: 2.2,
    };
  }
}

export function buildWave(g: Game, w: number): string[] {
  const darkMul = g.isDarkWave() ? DARK_WAVE.extraMobs : 1;
  const hordeMul = w % HORDE.every === 0 ? HORDE.countMul : 1;
  const theme = THEME_WAVES[w];
  if (theme) {
    const list: string[] = [];
    // 主题波怪种更强，数量略少于普通波
    const n = Math.min(WAVE.maxPerWave, Math.round((5 + w * 2.2) * 0.85 * darkMul * hordeMul));
    for (let i = 0; i < n; i++) list.push(theme.kinds[i % theme.kinds.length]);
    return list;
  }
  const ev = EVENT_WAVES[w];
  if (ev) {
    const list: string[] = [];
    const n = Math.min(WAVE.maxPerWave, Math.round((6 + w) * ev.mul * darkMul * hordeMul));
    for (let i = 0; i < n; i++) list.push(ev.kinds[i % ev.kinds.length]);
    return list;
  }
  const list: string[] = [];
  // 中后期数量增长更快：从 8 波起每波多给 1.5 只
  const growth = 5 + w * 2.2 + Math.max(0, w - 8) * 1.5;
  const n = Math.min(WAVE.maxPerWave, Math.round(growth * darkMul * hordeMul));
  const witch = w >= 5 ? Math.min(0.06, (w - 4) * 0.02) : 0;
  const ender = w >= 7 ? Math.min(0.07, (w - 6) * 0.025) : 0;
  const skel = w >= 4 ? Math.min(0.12, (w - 3) * 0.03) : 0;
  const spider = w >= 2 ? Math.min(0.1, (w - 1) * 0.02) : 0;
  const creep = w >= 5 ? Math.min(0.07, (w - 4) * 0.02) : 0;
  const charged = g.weather >= 3.6 && w >= 6 ? Math.min(0.05, (w - 5) * 0.015) : 0;
  const fast = w >= 3 ? Math.min(0.08, (w - 2) * 0.03) : 0;
  const gold = w >= 9 ? Math.min(0.14, (w - 8) * 0.04) : 0;
  const iron = w >= 6 ? Math.min(0.14, (w - 5) * 0.035) : 0;
  const leather = w >= 3 ? Math.min(0.18, (w - 2) * 0.04) : 0;
  const slime = w >= 2 ? Math.min(0.1, (w - 1) * 0.025) : 0;
  const witherSkel = w >= 5 ? Math.min(0.08, (w - 4) * 0.02) : 0;
  const blaze = w >= 6 ? Math.min(0.07, (w - 5) * 0.02) : 0;
  const phantom = w >= 7 ? Math.min(0.06, (w - 6) * 0.02) : 0;
  const drowned = w >= 5 ? Math.min(0.07, (w - 4) * 0.02) : 0;
  const pigman = w >= 4 ? Math.min(0.06, (w - 3) * 0.02) : 0;
  const silver = w >= 3 ? Math.min(0.1, (w - 2) * 0.025) : 0;
  const stray = w >= 6 ? Math.min(0.09, (w - 5) * 0.025) : 0;
  const pillager = w >= 7 ? Math.min(0.08, (w - 6) * 0.025) : 0;
  const guardian = w >= 8 ? Math.min(0.06, (w - 7) * 0.02) : 0;
  const evoker = w >= 9 ? Math.min(0.05, (w - 8) * 0.02) : 0;
  const ravager = w >= 10 ? Math.min(0.04, (w - 9) * 0.015) : 0;
  const chicken = w >= 5 ? Math.min(0.07, (w - 4) * 0.02) : 0;
  const jockey = w >= 7 ? Math.min(0.06, (w - 6) * 0.02) : 0;

  for (let i = 0; i < n; i++) {
    const r = g.rnd();
    let acc = witch;
    if (r < acc) {
      list.push('witch');
      continue;
    }
    acc += ender;
    if (r < acc) {
      list.push('enderman');
      continue;
    }
    acc += skel;
    if (r < acc) {
      list.push('skeleton');
      continue;
    }
    acc += spider;
    if (r < acc) {
      list.push('spider');
      continue;
    }
    acc += creep;
    if (r < acc) {
      list.push('creeper');
      continue;
    }
    acc += charged;
    if (r < acc) {
      list.push('charged');
      continue;
    }
    acc += fast;
    if (r < acc) {
      list.push('fast');
      continue;
    }
    acc += gold;
    if (r < acc) {
      list.push('gold');
      continue;
    }
    acc += iron;
    if (r < acc) {
      list.push('iron');
      continue;
    }
    acc += leather;
    if (r < acc) {
      list.push('leather');
      continue;
    }
    acc += slime;
    if (r < acc) {
      list.push('slime');
      continue;
    }
    acc += witherSkel;
    if (r < acc) {
      list.push('witherSkel');
      continue;
    }
    acc += blaze;
    if (r < acc) {
      list.push('blaze');
      continue;
    }
    acc += phantom;
    if (r < acc) {
      list.push('phantom');
      continue;
    }
    acc += drowned;
    if (r < acc) {
      list.push('drowned');
      continue;
    }
    acc += pigman;
    if (r < acc) {
      list.push('pigman');
      continue;
    }
    acc += silver;
    if (r < acc) {
      list.push('silverpack');
      continue;
    }
    acc += stray;
    if (r < acc) {
      list.push('stray');
      continue;
    }
    acc += pillager;
    if (r < acc) {
      list.push('pillager');
      continue;
    }
    acc += guardian;
    if (r < acc) {
      list.push('guardian');
      continue;
    }
    acc += evoker;
    if (r < acc) {
      list.push('evoker');
      continue;
    }
    acc += ravager;
    if (r < acc) {
      list.push('ravager');
      continue;
    }
    acc += jockey;
    if (r < acc) {
      list.push('spiderJockey');
      continue;
    }
    acc += chicken;
    if (r < acc) {
      list.push('chickenJockey');
      continue;
    }
    list.push('normal');
  }
  if (w % 5 === 0) {
    const bossKind = bossForWave(w);
    list.splice(Math.floor(list.length / 2), 0, bossKind);
  }
  return list;
}

export function spawnZombie(
  g: Game,
  kind: string,
  near?: { x: number; y: number },
  minD = SPAWN.minD,
  maxD = SPAWN.maxD,
) {
  const p = g.player;
  if (kind === 'silverpack') {
    const s = world.findSpawn(near ? near.x : p.x, near ? near.y : p.y, minD, maxD, 26);
    const n = g.rndInt(SILVERFISH.packMin, SILVERFISH.packMax);
    for (let i = 0; i < n; i++) {
      const pos =
        i === 0
          ? s
          : world.findSpawn(
              s.x + g.rndRange(-SILVERFISH.spawnGap, SILVERFISH.spawnGap),
              s.y + g.rndRange(-SILVERFISH.spawnGap, SILVERFISH.spawnGap),
              0,
              SILVERFISH.spawnGap,
              8,
            );
      pushZombie(g, 'silverfish', pos.x, pos.y);
    }
    return;
  }
  const s =
    kind.startsWith('boss') && !near
      ? world.findSpawn(p.x, p.y, 200, 320, 26)
      : world.findSpawn(near ? near.x : p.x, near ? near.y : p.y, minD, maxD, 26);
  pushZombie(g, kind, s.x, s.y);
}

export function pushZombie(g: Game, kind: string, x: number, y: number) {
  const def = ZOMBIES[kind];
  const dMul = g.diffDef().hpMul;
  const hpMul = WAVE.hpBase + Math.max(0, g.wave - 1) * WAVE.hpPerWave;
  const hp = kind.startsWith('boss') || kind === 'wither'
    ? Math.round(def.hp * (1 + (g.wave - 1) * WAVE.bossHpPerWave) * dMul)
    : Math.round(def.hp * hpMul * dMul * 10) / 10;
  let abilCd = 0;
  if (kind === 'spider') abilCd = g.rndRange(1.2, 2.2);
  else if (kind === 'enderman') abilCd = g.rndRange(2, 3.2);
  else if (kind === 'witch') abilCd = g.rndRange(2, 3.5);
  else if (kind === 'guardian') abilCd = g.rndRange(1.6, 2.8);
  else if (kind === 'evoker') abilCd = g.rndRange(2.2, 3.4);
  else if (kind === 'ravager') abilCd = g.rndRange(2.5, 4);

  // 精英词缀（BOSS 不参与）
  let affix = '';
  const eliteChance = clamp(0.04 + (g.wave - 1) * 0.025, 0, 0.3);
  if (!kind.startsWith('boss') && kind !== 'wither' && g.rnd() < eliteChance) {
    affix = ELITES[(g.rnd() * ELITES.length) | 0].id;
  }

  let finalHp = hp;
  let scale = def.scale;
  if (affix) {
    const e = ELITES.find((el) => el.id === affix)!;
    finalHp = Math.round(hp * e.hpMul * 10) / 10;
    scale *= e.scaleMul;
  }

  g.zombies.push({
    id: g.nextId++,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: finalHp,
    maxHp: finalHp,
    r: def.r,
    scale,
    flash: 0,
    fuse: 0,
    anim: g.rnd() * 10,
    shootCd: kind.startsWith('boss') || kind === 'wither' ? 0.3 : g.rndRange(0.6, 1.8),
    windup: 0,
    abilCd,
    crouch: 0,
    stateT: 0,
    silenced: 0,
    tx: 0,
    ty: 0,
    dead: false,
    affix,
    chargeT: 0,
    chargeDx: 0,
    chargeDy: 0,
    enraged: false,
    size: 0,
    burnT: 0,
    hoverT: g.rnd() * Math.PI * 2,
    slowT: 0,
    beamT: 0,
    beamA: 0,
    beamTick: 0,
    rockT: 0,
    slamT: 0,
    slamCd: 0,
    spiralT: 0,
    spiralCd: kind === 'wither' ? 1.2 : 0,
    stuckT: 0,
    phase: 0,
    stunT: 0,
    armorHp: kind === 'boss' ? bossArmorMax(g.wave) : 0,
    exposeT: 0,
    headsLeft: kind === 'wither' ? 3 : 0,
    diveT: 0,
    breathT: 0,
    roarT: 0,
    lockT: 0,
    atkT: 0,
  });

  if (kind.startsWith('boss') || kind === 'wither') {
    g.banner = { title: `${def.label} 现身!`, sub: '它正向你逼近', t: 1.8, max: 1.8 };
    g.audio.bossSpawn();
    g.shake = Math.max(g.shake, 7);
    // BOSS 领域：只有末影龙 / 监守者有专属场地，其余 BOSS 照旧混在狂潮里打
    const dk = kind === 'bossDragon' ? 'dragon' : kind === 'bossWarden' ? 'warden' : null;
    if (dk && g.waveActive) {
      domain.enterDomain(g, dk, g.player.x, g.player.y);
      // BOSS 直接刷在场内，别让它卡在墙外
      const d = g.domain;
      if (d) {
        const tx = clamp(d.cx + Math.round(d.halfW * 0.55), 2, world.tcols - 3);
        const ty = clamp(d.cy, 2, world.trows - 3);
        const z = g.zombies[g.zombies.length - 1];
        if (z) {
          z.x = tx * TILE + TILE / 2;
          z.y = ty * TILE + TILE / 2;
        }
      }
    }
  }
}
export function updateSpawning(g: Game, dt: number) {
  if (!g.waveActive) return;
  if (g.spawnQueue.length === 0) return;
  if (g.zombies.length >= WAVE.maxOnScreen) return;
  g.spawnTimer -= dt;
  if (g.spawnTimer <= 0) {
    const kind = g.spawnQueue.shift();
    if (kind) spawnZombie(g, kind);
    g.spawnTimer = Math.max(WAVE.spawnMin, WAVE.spawnBase - g.wave * 0.012);
  }
}

export function checkWave(g: Game, dt: number) {
  // 清场奖励：场上与队列都空时发放，每波一次；发完也不会停下波次推进
  if (g.waveActive && !g.clearRewarded && g.spawnQueue.length === 0 && g.zombies.length === 0) {
    g.clearRewarded = true;
    g.stallTimer = 0;
    const s = world.findSpawn(g.player.x, g.player.y, 20, 50, 8);
    g.drops.push({ x: s.x, y: s.y, life: 30, bob: 0, kind: 'apple' });
    // 波次清场奖励
    const p = g.player;
    const cr = CLEAR_REWARD;
    p.stone += cr.stone;
    g.gathered.stone += cr.stone;
    if (g.wave % cr.emeraldEvery === 0) g.runEmeralds += cr.emeraldN;
    // 狂潮波额外奖励
    if (g.horde) g.runEmeralds += HORDE.emeraldN;
    if (g.metaLvl('rest') > 0) {
      const heal = g.metaLvl('rest');
      p.hp = Math.min(p.maxHp, p.hp + heal);
    }
    // 再生成长：每次清场额外回血
    const rg = g.growthLvl('regen');
    if (rg > 0) p.hp = Math.min(p.maxHp, p.hp + 2 * rg);
    g.audio.pickup();
    g.numbers.push({
      x: p.x,
      y: p.y - 62,
      vy: -18,
      life: 1.2,
      max: 1.2,
      text: `清场奖励 石头+${cr.stone}${g.wave % cr.emeraldEvery === 0 ? ` 绿宝石+${cr.emeraldN}` : ''}`,
      color: '#c9c9c0',
    });
    if (g.hasRelic('spring')) {
      const heal = 2;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      g.audio.heal();
      g.numbers.push({
        x: p.x,
        y: p.y - 48,
        vy: -18,
        life: 1.1,
        max: 1.1,
        text: `生命之泉 +${heal} HP`,
        color: '#6ee86e',
      });
    }
    g.unlockAch('wave10', g.wave >= 10);
    g.unlockAch('wave20', g.wave >= 20);
    g.unlockAch('hard10', g.diffDef().id === 'hard' && g.wave >= 10);
    g.unlockAch('exec10', g.runExecuted >= 10);
    saveMeta(g.meta);
    if (g.rnd() < TRADER.appearChance) g.spawnTrader();
  }
  if (!g.waveActive) return;
  const alive = g.zombies.reduce((n, z) => (z.dead ? n : n + 1), 0);
  const queued = g.spawnQueue.length > 0;
  // 波次推进规则：
  //  ① 场上和队列都清空 → 立刻进入下一波（不用干等）
  //  ② 队列已空、只剩不到 5 只 → 最多再等 10 秒
  //  ③ 其他情况 → 计时到 36 秒，残留怪留场堆积
  if (!queued && alive === 0) {
    advanceWave(g);
    return;
  }
  if (!queued && alive < WAVE.fastAdvance) {
    g.waveT = Math.min(g.waveT, WAVE.fastAdvanceT);
  }
  g.waveT -= dt;
  // 反软锁：只剩极少数敌人却迟迟不被击杀时，把它们传送到玩家附近，再不行直接处死
  if (!queued && g.zombies.length > 0 && g.zombies.length <= STALL.fewLeft) {
    g.stallTimer += dt;
    if (g.stallTimer >= STALL.arrowAfter && g.stallTimer < STALL.arrowAfter + 1) {
      for (const z of g.zombies) {
        if (z.dead) continue;
        const s = world.findSpawn(g.player.x, g.player.y, 110, 210, 20);
        g.burst(z.x, z.y - 12, 10, ['#ff5a4a', '#ffd0a0'], 70, -20, 2);
        z.x = s.x;
        z.y = s.y;
        g.burst(z.x, z.y - 12, 10, ['#ff5a4a', '#ffd0a0'], 70, -20, 2);
      }
      g.numbers.push({
        x: g.player.x,
        y: g.player.y - 48,
        vy: -18,
        life: 1.2,
        max: 1.2,
        text: '剩余敌人被吸引过来了!',
        color: '#ff5a4a',
        big: true,
      });
      g.stallTimer = STALL.arrowAfter + 1;
    } else if (g.stallTimer >= STALL.teleportAfter) {
      for (const z of g.zombies) g.killZombie(z);
      g.stallTimer = 0;
    }
  } else {
    g.stallTimer = 0;
  }
  if (g.waveT <= 0) {
    advanceWave(g);
  }
}

/** 进入下一波（每 10 波先插一次成长三选一） */
function advanceWave(g: Game) {
  if ((g.wave + 1) % GROWTH_WAVES === 0 && g.phase === 'play') {
    g.openGrowth(true);
    return;
  }
  nextWave(g);
}
