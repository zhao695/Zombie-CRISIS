import {
  AXE,
  BLAZE,
  BOSS_CREEPER,
  BOSS_PHASE,
  BOW,
  CHARGED,
  COMBO,
  COMBAT,
  CREEPER_DASH,
  DISCS,
  DOMAIN,
  DRAGON,
  DROWNED,
  ELITES,
  ENDER,
  EVOKER,
  GUARDIAN,
  GOLEM,
  HORDE,
  PAL,
  PHANTOM,
  PIGMAN,
  PILLAGER,
  PLAYER,
  POTION_DROPS,
  RAVAGER,
  REDSTONE,
  ROD,
  SILVERFISH,
  SKELETON,
  SLIME,
  SLOWMO,
  SKY,
  SPIDER,
  SPIDER_WEB,
  STRAY,
  TILE,
  TNT,
  TRIPLE_SHOT,
  WARDEN,
  WAVE,
  WEAPONS,
  WEATHER,
  WITCH,
  WITHER,
  WITHER_SKEL,
  WORLD,
  ZOMBIES,
  clamp,
} from '../config';
import type { ZombieDef } from '../config';
import type { Game } from '../game';
import type { GolemState, PlayerState, ZombieState } from '../types';
import { world } from '../world';
import { burst } from './combat';
import * as domain from './domain';
import { TAU, scaleEnemyDmg } from './util';

/* ---------- AI 处理器注册表：每种怪物注册一个处理器，新增怪物只需注册 ---------- */

export interface AiOut {
  flee: boolean;
  stop: boolean;
  /** 与 stop 同时使用时将 mvx/mvy 置零（原 stopMove+mvx=0 分支，如烈焰人/凋灵蓄力） */
  done: boolean;
  /** 非 0 时绕玩家侧移保持距离（远程怪保距走位），±1 为方向 */
  strafe: number;
}

export interface AiCtx {
  g: Game;
  z: ZombieState;
  def: ZombieDef;
  p: PlayerState;
  dt: number;
  d: number;
  dx: number;
  dy: number;
  /** 速度箱（可变引用）：处理器内改写 spd.v 会传导到主循环移动计算 */
  spd: { v: number };
  out: AiOut;
}

export type AiHandler = (c: AiCtx) => void;

const HANDLERS: Record<string, AiHandler> = {};

export function registerAi(kind: string, fn: AiHandler) {
  HANDLERS[kind] = fn;
}

export function aiKinds(): string[] {
  return Object.keys(HANDLERS);
}

/** 远程怪保距走位方向：缓慢左右换向，避免站桩 */
/** BOSS 卡墙计时（按 id 存，避免动 ZombieState 结构） */
const bossStuck = new Map<number, number>();
const wallAtk = new Map<number, number>();

function strafeDir(z: ZombieState) {
  return Math.sin(z.anim * 0.55 + z.x * 0.013 + z.y * 0.017) >= 0 ? 1 : -1;
}

registerAi('skeleton', (c) => {
  const { g, z, dt, d, out } = c;
  z.shootCd -= dt;
  if (z.silenced > 0) {
    z.shootCd = Math.max(z.shootCd, 1.0);
    z.windup = 0;
  }
  if (z.windup > 0) {
    out.stop = true;
    z.windup -= dt;
    if (z.windup <= 0) skeletonFire(g, z);
  } else if (z.silenced <= 0 && z.shootCd <= 0 && d < SKELETON.range) {
    z.windup = SKELETON.windup;
    z.shootCd = g.rndRange(SKELETON.cdMin, SKELETON.cdMax);
    g.audio.bowDraw();
    g.numbers.push({
      x: z.x,
      y: z.y - 38,
      vy: -10,
      life: 0.5,
      max: 0.5,
      text: '!',
      color: '#ff5252',
    });
  } else if (d < SKELETON.retreat) {
    out.flee = true;
  } else if (d < SKELETON.hold) {
    out.strafe = strafeDir(z);
  }
});

registerAi('witch', (c) => {
  const { g, z, dt, d, out } = c;
  z.abilCd -= dt;
  if (z.silenced > 0) {
    z.abilCd = Math.max(z.abilCd, 1.2);
    z.windup = 0;
  }
  if (z.windup > 0) {
    out.stop = true;
    z.windup -= dt;
    if (z.windup <= 0) witchThrow(g, z);
  } else if (z.silenced <= 0 && z.abilCd <= 0 && d < WITCH.range) {
    z.windup = WITCH.windup;
    z.abilCd = g.rndRange(WITCH.throwCdMin, WITCH.throwCdMax);
    z.tx = clamp(g.player.x + g.rndRange(-40, 40), 8, WORLD.w - 8);
    z.ty = clamp(g.player.y + g.rndRange(-40, 40), 8, WORLD.h - 8);
    g.numbers.push({
      x: z.x,
      y: z.y - 36,
      vy: -10,
      life: 0.5,
      max: 0.5,
      text: '!',
      color: '#c98af0',
    });
  } else if (d < WITCH.retreat) {
    out.flee = true;
  } else if (d < WITCH.hold) {
    out.strafe = strafeDir(z);
  }
});

registerAi('spider', (c) => {
  const { g, z, def, p, dt, d, dx, dy, out } = c;
  if (z.stateT > 0) {
    z.stateT -= dt;
    world.moveCircle(z, z.vx * dt, z.vy * dt, Math.max(3, z.r * 0.7));
    const nd = Math.hypot(p.x - z.x, p.y - z.y);
    if (nd < z.r * 0.85 + PLAYER.radius && p.invuln <= 0 && p.dashT <= 0) {
      g.hurtPlayer(scaleEnemyDmg(g, def.dmg));
      // 扑击命中附带蛛网：减速玩家
      p.slowT = Math.max(p.slowT, SPIDER_WEB.slowT);
      burst(g, p.x, p.y - 10, 6, ['#e8e8ee', '#a8a8b8'], 50, -10, 1);
    }
    if (z.stateT <= 0) {
      z.vx *= 0.3;
      z.vy *= 0.3;
    }
    out.done = true;
    return;
  }
  if (z.crouch > 0) {
    z.crouch -= dt;
    out.stop = true;
    if (z.crouch <= 0) {
      z.vx = dx * SPIDER.lungeSpeed;
      z.vy = dy * SPIDER.lungeSpeed;
      z.stateT = SPIDER.lungeTime;
      g.audio.spider();
      burst(g, z.x, z.y - 6, 4, ['#3a3a44', '#26262e'], 60, 0, 2);
    }
  } else {
    z.abilCd -= dt;
    if (z.silenced <= 0 && z.abilCd <= 0 && d < SPIDER.lungeRange) {
      z.crouch = SPIDER.crouch;
      z.abilCd = g.rndRange(SPIDER.lungeCdMin, SPIDER.lungeCdMax);
    }
  }
});

registerAi('enderman', (c) => {
  const { g, z, dt, d } = c;
  z.abilCd -= dt;
  if (z.silenced <= 0 && z.abilCd <= 0) {
    if (d > ENDER.teleportMin) teleportEnderman(g, z);
    else z.abilCd = 0.5;
  }
});

registerAi('slime', (c) => {
  const { g, z, def, p, dt, d, dx, dy, out } = c;
  if (z.stateT > 0) {
    z.stateT -= dt;
    world.moveCircle(z, z.vx * dt, z.vy * dt, Math.max(3, z.r * 0.7));
    z.vx *= 0.94;
    z.vy *= 0.94;
    if (d < z.r * 0.85 + PLAYER.radius && p.invuln <= 0 && p.dashT <= 0) {
      g.hurtPlayer(scaleEnemyDmg(g, def.dmg * SLIME.dmgMul[z.size]));
    }
    out.done = true;
    return;
  }
  z.stateT = SLIME.hopTime;
  z.vx = dx * SLIME.hopSpeed;
  z.vy = dy * SLIME.hopSpeed;
  z.anim = 0;
  g.audio.slime();
  out.done = true;
});

registerAi('blaze', (c) => {
  const { g, z, p, dt, d, out } = c;
  z.hoverT += dt * BLAZE.bobSpeed;
  if (z.windup > 0) {
    z.windup -= dt;
    out.stop = true;
    if (z.windup <= 0) {
      const a = Math.atan2(p.y - z.y, p.x - z.x);
      g.fireballs.push({
        x: z.x,
        y: z.y - 12,
        vx: Math.cos(a) * BLAZE.fireballSpeed,
        vy: Math.sin(a) * BLAZE.fireballSpeed,
        life: 2.6,
        dmg: BLAZE.fireballDmg,
        fromPlayer: false,
        skull: false,
        r: 3,
      });
      g.audio.blaze();
    }
  } else if (z.silenced <= 0 && d < 340 && z.shootCd <= 0) {
    z.windup = BLAZE.windup;
    z.shootCd = g.rndRange(BLAZE.shootCdMin, BLAZE.shootCdMax);
    g.numbers.push({ x: z.x, y: z.y - 30, vy: -10, life: 0.5, max: 0.5, text: '!', color: '#ff8a30' });
  }
  if (!out.stop) {
    if (d > BLAZE.hoverDist + 30) {
      // 默认直追
    } else if (d < BLAZE.hoverDist - 30) {
      out.flee = true;
    } else {
      out.strafe = strafeDir(z);
    }
  }
});

registerAi('phantom', (c) => {
  const { g, z, def, p, dt, d, dx, dy, out } = c;
  if (z.stateT > 0) {
    z.stateT -= dt;
    z.x += z.vx * dt;
    z.y += z.vy * dt;
    const nd = Math.hypot(p.x - z.x, p.y - z.y);
    if (nd < z.r * 0.85 + PLAYER.radius && p.invuln <= 0 && p.dashT <= 0) {
      g.hurtPlayer(scaleEnemyDmg(g, def.dmg));
    }
    if (z.stateT <= 0) z.abilCd = g.rndRange(PHANTOM.diveCdMin, PHANTOM.diveCdMax);
    out.done = true;
    return;
  }
  z.hoverT += dt * PHANTOM.orbitSpeed;
  const ox2 = p.x + Math.cos(z.hoverT) * PHANTOM.orbitR;
  const oy2 = p.y + Math.sin(z.hoverT) * PHANTOM.orbitR * 0.7;
  const odx = ox2 - z.x;
  const ody = oy2 - z.y;
  const od = Math.hypot(odx, ody) || 1;
  z.vx = (odx / od) * 90 + odx * 2.2;
  z.vy = (ody / od) * 90 + ody * 2.2;
  const sp2 = Math.hypot(z.vx, z.vy);
  if (sp2 > 190) {
    z.vx *= 190 / sp2;
    z.vy *= 190 / sp2;
  }
  z.x = clamp(z.x + z.vx * dt, 10, WORLD.w - 10);
  z.y = clamp(z.y + z.vy * dt, 10, WORLD.h - 10);
  z.abilCd -= dt;
  if (z.silenced <= 0 && z.abilCd <= 0 && d < 320) {
    z.stateT = PHANTOM.diveTime;
    z.vx = dx * PHANTOM.diveSpeed;
    z.vy = dy * PHANTOM.diveSpeed;
    z.abilCd = 0;
    g.audio.phantom();
  }
  out.done = true;
});

registerAi('pigman', (c) => {
  const { g, z, dt, d, out } = c;
  if (!z.enraged) {
    z.stateT -= dt;
    if (z.stateT <= 0) {
      z.stateT = g.rndRange(1.5, 3);
      z.vx = g.rndRange(-1, 1) * PIGMAN.calmWander;
      z.vy = g.rndRange(-1, 1) * PIGMAN.calmWander;
    }
    if (d < 80) alertPigmen(g, z);
    world.moveCircle(z, z.vx * dt, z.vy * dt, Math.max(3, z.r * 0.7));
    out.done = true;
    return;
  }
  c.spd.v = PIGMAN.frenzySpeed;
});

registerAi('drowned', (c) => {
  const { g, z, p, dt, d, out } = c;
  z.shootCd -= dt;
  if (z.silenced > 0) {
    z.shootCd = Math.max(z.shootCd, 1.0);
    z.windup = 0;
  }
  if (z.windup > 0) {
    out.stop = true;
    z.windup -= dt;
    if (z.windup <= 0) {
      const a = Math.atan2(p.y - z.y, p.x - z.x);
      g.arrows.push({
        x: z.x,
        y: z.y - 12,
        vx: Math.cos(a) * DROWNED.tridentSpeed,
        vy: Math.sin(a) * DROWNED.tridentSpeed,
        life: 3,
        dmg: DROWNED.tridentDmg,
        fromPlayer: false,
        angle: a,
        trident: true,
      });
      g.audio.arrowShot();
    }
  } else if (z.silenced <= 0 && z.shootCd <= 0 && d < DROWNED.range) {
    z.windup = DROWNED.windup;
    z.shootCd = g.rndRange(DROWNED.cdMin, DROWNED.cdMax);
    g.numbers.push({ x: z.x, y: z.y - 32, vy: -10, life: 0.5, max: 0.5, text: '!', color: '#4ac9b0' });
  } else if (d < DROWNED.retreat) {
    out.flee = true;
  } else if (d < DROWNED.hold) {
    out.strafe = strafeDir(z);
  }
});

registerAi('witherSkel', (c) => {
  const { g, z, p, dt, d, out } = c;
  z.shootCd -= dt;
  if (z.silenced > 0) {
    z.shootCd = Math.max(z.shootCd, 1.0);
    z.windup = 0;
  }
  if (z.windup > 0) {
    out.stop = true;
    z.windup -= dt;
    if (z.windup <= 0) {
      const a = Math.atan2(p.y - z.y, p.x - z.x);
      g.arrows.push({
        x: z.x,
        y: z.y - 14,
        vx: Math.cos(a) * WITHER_SKEL.arrowSpeed,
        vy: Math.sin(a) * WITHER_SKEL.arrowSpeed,
        life: 3,
        dmg: WITHER_SKEL.arrowDmg,
        fromPlayer: false,
        angle: a,
        wither: true,
      });
      g.audio.arrowShot();
    }
  } else if (z.silenced <= 0 && z.shootCd <= 0 && d < 360) {
    z.windup = SKELETON.windup;
    z.shootCd = g.rndRange(WITHER_SKEL.cdMin, WITHER_SKEL.cdMax);
    g.numbers.push({ x: z.x, y: z.y - 36, vy: -10, life: 0.5, max: 0.5, text: '!', color: '#3a3a44' });
  } else if (d < WITHER_SKEL.retreat) {
    out.flee = true;
  } else if (d < WITHER_SKEL.hold) {
    out.strafe = strafeDir(z);
  }
});

registerAi('wither', (c) => {
  const { g, z, p, dt, d, out } = c;
  z.hoverT += dt;
  const enr = z.hp / z.maxHp <= WITHER.rageAt;
  if (!z.enraged && enr) {
    z.enraged = true;
    g.audio.roar();
    g.banner = { title: '凋灵暴怒!', sub: '弹幕更加密集', t: 1.4, max: 1.4 };
    burst(g, z.x, z.y - 20, 20, ['#2a2a34', '#4a4a5a'], 160, 200, 3);
  }
  if (z.windup > 0) {
    z.windup -= dt;
    out.stop = true;
    if (z.windup <= 0) {
      // 每掉一颗头，齐射就少一发
      const baseVolley = z.enraged ? WITHER.rageVolley : WITHER.volley;
      const volley = Math.max(1, Math.round(baseVolley * (z.headsLeft / 3)));
      for (let i = 0; i < volley; i++) {
        const a = Math.atan2(p.y - z.y, p.x - z.x) + g.rndRange(-0.4, 0.4);
        g.fireballs.push({
          x: z.x,
          y: z.y - 14,
          vx: Math.cos(a) * WITHER.skullSpeed,
          vy: Math.sin(a) * WITHER.skullSpeed,
          life: 3.5,
          dmg: WITHER.skullDmg,
          fromPlayer: false,
          skull: true,
          r: 5,
        });
      }
      g.audio.blaze();
      g.shake = Math.max(g.shake, 2);
    }
  } else if (z.spiralT > 0) {
    // 螺旋弹幕：以自身为中心均匀撒一圈骷髅
    z.spiralT -= dt;
    out.stop = true;
    if (z.spiralT <= 0) {
      const n = Math.round((z.enraged ? WITHER.spiralN + 4 : WITHER.spiralN) * (z.headsLeft / 3));
      const base = z.hoverT * 1.7;
      for (let i = 0; i < n; i++) {
        const a = base + (i / n) * TAU;
        g.fireballs.push({
          x: z.x + Math.cos(a) * 14,
          y: z.y - 14 + Math.sin(a) * 8,
          vx: Math.cos(a) * WITHER.skullSpeed * 0.85,
          vy: Math.sin(a) * WITHER.skullSpeed * 0.85,
          life: 4,
          dmg: WITHER.skullDmg,
          fromPlayer: false,
          skull: true,
          r: 5,
        });
      }
      g.audio.witherSpiral();
      g.shake = Math.max(g.shake, 4);
      burst(g, z.x, z.y - 14, 12, ['#2a2a34', '#5a5a6e'], 120, 200, 3);
    }
  } else {
    z.shootCd -= dt;
    z.spiralCd -= dt;
    if (z.spiralCd <= 0 && z.headsLeft >= 2) {
      z.spiralT = WITHER.spiralWindup;
      z.spiralCd = WITHER.spiralCd;
      g.numbers.push({ x: z.x, y: z.y - 44, vy: -12, life: 0.6, max: 0.6, text: '弹幕!', color: '#7a6aff', big: true });
      g.audio.chargeUp();
    } else if (z.shootCd <= 0) {
      z.windup = 0.7;
      z.shootCd = g.rndRange(WITHER.volleyCdMin, WITHER.volleyCdMax);
    }
  }
  if (!out.stop) {
    if (d > WITHER.hoverD + 40) {
      // 默认直追
    } else if (d < WITHER.hoverD - 40) {
      out.flee = true;
    } else {
      out.strafe = strafeDir(z);
    }
  }
});

registerAi('boss', (c) => {
  const { g, z, dt, d, dx, dy, out } = c;
  const wtx = Math.floor((z.x + dx * 20) / TILE);
  const wty = Math.floor((z.y + dy * 20) / TILE);
  if (world.wallHpAt(wtx, wty) > 0) {
    out.stop = true;
    z.stateT -= dt;
    if (z.stateT <= 0) {
      z.stateT = 0.4;
      const destroyed = world.damageWall(wtx, wty, 1);
      g.audio.axe();
      burst(g, wtx * TILE + 8, wty * TILE + 8, 6, ['#8a6a3a', '#5a4520'], 80, 200, 2);
      if (destroyed) {
        g.wallDirty = true;
        world.invalidateFlow();
        burst(g, wtx * TILE + 8, wty * TILE + 8, 10, ['#8a6a3a', '#c9a26b'], 110, 240, 3);
      }
    }
  }
  // 主动攻击：远程投石 + 近身震地
  if (z.rockT > 0) {
    z.rockT -= dt;
    out.stop = true;
    if (z.rockT <= 0) bossRock(g, z);
  } else if (z.slamT > 0) {
    z.slamT -= dt;
    out.stop = true;
    if (z.slamT <= 0) bossSlam(g, z);
  } else if (z.chargeT <= 0 && z.crouch <= 0) {
    z.shootCd -= dt;
    z.slamCd -= dt;
    if (d < BOSS_PHASE.slamRange && z.slamCd <= 0) {
      z.slamT = BOSS_PHASE.slamWindup;
      z.slamCd = z.phase >= 2 ? BOSS_PHASE.slamCd * 0.6 : BOSS_PHASE.slamCd;
      g.audio.chargeUp();
      g.numbers.push({ x: z.x, y: z.y - 58, vy: -12, life: 0.6, max: 0.6, text: '震地!', color: '#ffb040', big: true });
    } else if (d > 120 && d < 560 && z.shootCd <= 0) {
      z.rockT = BOSS_PHASE.rockWindup;
      z.shootCd = g.rndRange(BOSS_PHASE.rockCdMin, BOSS_PHASE.rockCdMax) * (z.phase >= 2 ? 0.65 : 1);
      g.numbers.push({ x: z.x, y: z.y - 58, vy: -10, life: 0.5, max: 0.5, text: '!', color: '#c9a26b' });
    }
  }
  c.spd.v *= z.enraged ? 1.35 : 1;
  updateBoss(g, z, dt, d);
});

// ───────── 末影龙：飞行 BOSS，俯冲 + 龙息扇形 + 召唤蠹虫 ─────────
function dragonBreath(g: Game, z: ZombieState) {
  const p = g.player;
  const base = Math.atan2(p.y - 14 - (z.y - 12), p.x - z.x);
  for (let i = 0; i < DRAGON.breathN; i++) {
    const a = base + (i - (DRAGON.breathN - 1) / 2) * 0.16 + g.rndRange(-0.03, 0.03);
    g.fireballs.push({
      x: z.x + Math.cos(a) * 16,
      y: z.y - 12 + Math.sin(a) * 16,
      vx: Math.cos(a) * DRAGON.breathSpeed,
      vy: Math.sin(a) * DRAGON.breathSpeed,
      life: 3.2,
      dmg: DRAGON.breathDmg,
      fromPlayer: false,
      skull: false,
      r: 5,
    });
  }
  g.audio.blaze();
  g.shake = Math.max(g.shake, 3);
  burst(g, z.x, z.y - 14, 12, ['#d06cff', '#6a3ac0'], 120, 40, 2);
}

registerAi('bossDragon', (c) => {
  const { g, z, p, dt, d, dx, dy, out } = c;

  // 血量掉到节点：振翅飞到场地另一头
  if (domain.maybeReposition(g, z)) {
    out.done = true;
    return;
  }

  // 俯冲中：直线高速冲刺（无视墙体，撞到玩家就停）
  if (z.diveT > 0) {
    z.diveT -= dt;
    z.x = clamp(z.x + z.chargeDx * DRAGON.diveSpeed * dt, 12, WORLD.w - 12);
    z.y = clamp(z.y + z.chargeDy * DRAGON.diveSpeed * dt, 12, WORLD.h - 12);
    g.particles.push({
      x: z.x + g.rndRange(-10, 10),
      y: z.y - 6,
      vx: g.rndRange(-30, 30),
      vy: g.rndRange(-20, 10),
      life: 0.3,
      max: 0.3,
      color: '#b06cff',
      size: 3,
      grav: 0,
    });
    if (Math.hypot(p.x - z.x, p.y - 14 - z.y) < z.r + PLAYER.radius + 6 && p.invuln <= 0 && p.dashT <= 0) {
      g.hurtPlayer(scaleEnemyDmg(g, DRAGON.diveDmg));
      z.diveT = 0;
      g.shake = Math.max(g.shake, 9);
      g.hitStop = Math.max(g.hitStop, 0.05);
    }
    out.done = true;
    return;
  }

  // 血量过半：召唤末影螨（只一次）
  if (!z.enraged && z.hp / z.maxHp <= DRAGON.summonAt) {
    z.enraged = true;
    for (let i = 0; i < DRAGON.summonN; i++) {
      const a = (i / DRAGON.summonN) * TAU;
      g.spawnZombie('silverfish', { x: z.x + Math.cos(a) * 46, y: z.y + Math.sin(a) * 46 }, 0, 34);
    }
    g.banner = { title: '末影龙 · 召唤末影螨', sub: '小心脚下的小东西', t: 1.4, max: 1.4 };
    g.audio.summon();
    g.shake = Math.max(g.shake, 6);
    burst(g, z.x, z.y - 14, 26, ['#6a3ac0', '#d06cff'], 150, 60, 3);
  }

  // 俯冲蓄力
  if (z.crouch > 0) {
    z.crouch -= dt;
    out.stop = true;
    if (z.crouch <= 0) {
      z.diveT = DRAGON.diveTime;
      z.chargeDx = dx;
      z.chargeDy = dy;
      g.audio.rockThrow();
      g.shake = Math.max(g.shake, 4);
    }
    return;
  }
  // 龙息蓄力
  if (z.breathT > 0) {
    z.breathT -= dt;
    out.stop = true;
    if (z.breathT <= 0) {
      // 龙息改为地面喷洒：4x4 格紫色区域，持续 4 秒
      g.breathZones.push({ x: g.player.x, y: g.player.y, t: 4, tick: 0.3 });
      g.shake = Math.max(g.shake, 5);
      g.audio.roar();
      burst(g, g.player.x, g.player.y, 18, ['#c06cff', '#8a3ac0'], 90, -40, 3);
    }
    return;
  }

  z.abilCd -= dt;
  z.shootCd -= dt;
  // 末影水晶还活着时，龙的技能转得更快（拆水晶 = 削弱它）
  const crystalMul = g.crystals.some((c) => !c.dead) ? DOMAIN.crystalBuffMul : 1;
  if (z.abilCd <= 0 && d < 460) {
    z.crouch = DRAGON.diveWindup;
    z.abilCd = g.rndRange(DRAGON.diveCdMin, DRAGON.diveCdMax) * (z.phase >= 1 ? 0.7 : 1) * crystalMul;
    g.numbers.push({ x: z.x, y: z.y - 54, vy: -12, life: 0.6, max: 0.6, text: '俯冲!', color: '#d06cff', big: true });
    g.audio.chargeUp();
  } else if (z.shootCd <= 0) {
    z.breathT = DRAGON.breathWindup;
    z.shootCd = g.rndRange(DRAGON.breathCdMin, DRAGON.breathCdMax) * crystalMul;
    g.numbers.push({ x: z.x, y: z.y - 54, vy: -12, life: 0.6, max: 0.6, text: '龙息!', color: '#c8a0ff', big: true });
  }

  // 保持悬停距离
  if (d < DRAGON.hoverD - 50) out.flee = true;
  else if (d < DRAGON.hoverD + 70) out.strafe = strafeDir(z);
});

// ───────── 监守者：失明，靠"声音"锁定你 ─────────
function wardenRoar(g: Game, z: ZombieState) {
  const p = g.player;
  const a = Math.atan2(p.y - 14 - (z.y - 14), p.x - z.x);
  g.slashes.push({ x: z.x, y: z.y - 14, angle: a, arc: 0.3, range: WARDEN.roarLen, t: 0, max: 0.4, color: '#7ad8ff' });
  const vx = Math.cos(a);
  const vy = Math.sin(a);
  const rx = p.x - z.x;
  const ry = p.y - 14 - (z.y - 14);
  const proj = rx * vx + ry * vy;
  const perp = Math.abs(-rx * vy + ry * vx);
  if (proj > 0 && proj < WARDEN.roarLen && perp < WARDEN.roarHalf + PLAYER.radius * 0.5) {
    g.hurtPlayer(scaleEnemyDmg(g, WARDEN.roarDmg));
  }
  // 怒吼命中：玩家被震慑定身 0.9 秒，期间不能移动、不能冲刺
  g.rootT = Math.max(g.rootT, 0.9);
  g.numbers.push({ x: p.x, y: p.y - 54, vy: -14, life: 1, max: 1, text: '震慑! 无法移动', color: '#7ad8ff', big: true });
  g.audio.roar();
  g.shake = Math.max(g.shake, 7);
  burst(g, z.x + vx * 20, z.y - 14 + vy * 20, 14, ['#7ad8ff', '#cfe4ff'], 150, 0, 2);
}

function wardenSlam(g: Game, z: ZombieState) {
  const p = g.player;
  g.explosions.push({ x: z.x, y: z.y, r: WARDEN.slamR, t: 0, max: 0.4 });
  g.scorches.push({ x: z.x, y: z.y, r: WARDEN.slamR * 0.5, t: 0, max: 4 });
  g.shake = Math.max(g.shake, 11);
  g.hitStop = Math.max(g.hitStop, 0.05);
  g.audio.quake();
  burst(g, z.x, z.y, 20, ['#2a2a30', '#5a5a66'], 170, 240, 3);
  // 震地后是破绽窗口：这时候才能削它的外骨骼
  z.exposeT = 2.2;
  if (Math.hypot(p.x - z.x, p.y - z.y) < WARDEN.slamR + PLAYER.radius && p.invuln <= 0 && p.dashT <= 0) {
    g.hurtPlayer(scaleEnemyDmg(g, WARDEN.slamDmg));
  }
}

registerAi('bossWarden', (c) => {
  const { g, z, p, dt, d, out } = c;
  // 血量掉到节点：潜地换位
  if (domain.maybeReposition(g, z)) {
    out.done = true;
    return;
  }
  // 失明：噪音足够大才锁定；停下不动它就失去目标
  if (g.noise >= WARDEN.lockAt) z.lockT = WARDEN.forgetAfter;
  else z.lockT = Math.max(0, z.lockT - dt);
  const locked = z.lockT > 0;

  if (z.roarT > 0) {
    z.roarT -= dt;
    out.stop = true;
    if (z.roarT <= 0) wardenRoar(g, z);
    return;
  }
  if (z.crouch > 0) {
    z.crouch -= dt;
    out.stop = true;
    if (z.crouch <= 0) wardenSlam(g, z);
    return;
  }
  if (!locked) {
    // 没听见动静：原地缓慢游荡，不追你
    out.strafe = strafeDir(z) * 0.5;
    c.spd.v *= 0.3;
    return;
  }
  z.abilCd -= dt;
  if (z.abilCd <= 0 && d < WARDEN.slamRange) {
    z.crouch = 0.45;
    z.abilCd = WARDEN.slamCd;
    g.numbers.push({ x: z.x, y: z.y - 46, vy: -12, life: 0.6, max: 0.6, text: '震地!', color: '#ffb040', big: true });
    g.audio.chargeUp();
  } else if (z.abilCd <= 0 && d >= WARDEN.slamRange && d < WARDEN.roarLen && g.rootT <= 0) {
    z.roarT = WARDEN.roarWindup;
    // 噪音越高越暴怒：怒吼冷却按噪音缩短，最多快一倍
    const rage = 1 - Math.min(0.5, g.noise * 0.18);
    z.abilCd = g.rndRange(WARDEN.roarCdMin, WARDEN.roarCdMax) * rage;
    g.numbers.push({ x: z.x, y: z.y - 46, vy: -12, life: 0.6, max: 0.6, text: '声波!', color: '#7ad8ff', big: true });
    g.audio.chargeUp();
  }
});

// ───────── 坐骑精英：蜘蛛骑士 / 鸡骑士 ─────────
registerAi('spiderJockey', (c) => {
  const { g, z, dt, d, out } = c;
  z.shootCd -= dt;
  if (z.silenced > 0) z.windup = 0;
  if (z.windup > 0) {
    z.windup -= dt;
    out.stop = true;
    if (z.windup <= 0) {
      const p = g.player;
      const ang = Math.atan2(p.y - 14 - (z.y - 16), p.x - z.x) + g.rndRange(-0.08, 0.08);
      g.arrows.push({
        x: z.x,
        y: z.y - 16,
        vx: Math.cos(ang) * SKELETON.arrowSpeed,
        vy: Math.sin(ang) * SKELETON.arrowSpeed,
        life: 2.2,
        dmg: SKELETON.arrowDmg,
        fromPlayer: false,
        angle: ang,
      });
      g.audio.arrowShot();
    }
  } else if (z.silenced <= 0 && z.shootCd <= 0 && d < 330) {
    z.windup = 0.4;
    z.shootCd = g.rndRange(1.8, 2.9);
  }
  if (d < 56) out.strafe = strafeDir(z) * 1.4;
});

registerAi('chickenJockey', (c) => {
  const { g, z, dt, d, dx, dy, out } = c;
  if (z.stateT > 0) {
    z.stateT -= dt;
    world.moveCircle(z, z.vx * dt, z.vy * dt, Math.max(3, z.r * 0.7));
    if (z.stateT <= 0) {
      z.vx *= 0.2;
      z.vy *= 0.2;
    }
    out.done = true;
    return;
  }
  z.abilCd -= dt;
  if (z.abilCd <= 0 && d < 150 && d > 42) {
    z.abilCd = g.rndRange(2.0, 3.0);
    z.stateT = 0.2;
    z.vx = dx * 320;
    z.vy = dy * 320;
    burst(g, z.x, z.y - 4, 4, ['#f0f0e0', '#c8b070'], 60, 10, 1);
  }
});

registerAi('bossCreeper', (c) => {
  const { g, z, dt, d, out } = c;
  if (d < BOSS_CREEPER.fuseRange) {
    z.fuse += dt;
    // 二段引信：第一场爆炸后进入余烬状态（不死、加速），2 秒后再炸才真死
    const emberDone = ((z.headsLeft || 0) & 8) !== 0;
    if (z.fuse >= BOSS_CREEPER.fuseTime) {
      if (!emberDone) {
        z.headsLeft = (z.headsLeft || 0) | 8;
        g.explodeAt(z.x, z.y, BOSS_CREEPER.explodeRadius, BOSS_CREEPER.explodeDmg, BOSS_CREEPER.playerDmg);
        z.fuse = 0;
        z.stunT = 0;
        z.hp = Math.max(z.hp, Math.round(z.maxHp * 0.18));
        g.banner = { title: '苦力怕王 · 余烬!', sub: '它没死，而且更快了 — 2 秒后再炸', t: 1.6, max: 1.6 };
        g.audio.bossPhase();
        g.shake = Math.max(g.shake, 9);
        burst(g, z.x, z.y - 16, 24, ['#ff9a3c', '#c23b2a', '#ffd76b'], 170, 90, 3);
        out.done = true;
        return;
      }
      killZombie(g, z);
      g.explodeAt(z.x, z.y, BOSS_CREEPER.explodeRadius * 1.35, BOSS_CREEPER.explodeDmg * 1.5, BOSS_CREEPER.playerDmg);
      out.done = true;
      return;
    }
  } else {
    z.fuse = Math.max(0, z.fuse - dt * 2);
  }
  z.abilCd -= dt;
  if (z.hp / z.maxHp <= BOSS_CREEPER.summonAt && z.abilCd <= 0 && g.zombies.length < WAVE.maxOnScreen) {
    z.abilCd = BOSS_PHASE.summonCd;
    g.audio.summon();
    for (let i = 0; i < BOSS_CREEPER.minis; i++) g.spawnZombie('creeper', z, 60, 140);
    g.numbers.push({ x: z.x, y: z.y - 52, vy: -12, life: 0.9, max: 0.9, text: '召唤!', color: '#4aa8ff', big: true });
  }
  if (z.fuse > 0) c.spd.v *= 0.45;
});

/* ---------- 袭击系：流浪者 / 掠夺者 / 守卫者 / 唤魔者 / 劫掠兽 ---------- */

registerAi('stray', (c) => {
  const { g, z, p, dt, d, out } = c;
  z.shootCd -= dt;
  if (z.silenced > 0) {
    z.shootCd = Math.max(z.shootCd, 1.0);
    z.windup = 0;
  }
  if (z.windup > 0) {
    out.stop = true;
    z.windup -= dt;
    if (z.windup <= 0) {
      const a = Math.atan2(p.y - 14 - (z.y - 14), p.x - z.x) + g.rndRange(-0.05, 0.05);
      g.arrows.push({
        x: z.x,
        y: z.y - 14,
        vx: Math.cos(a) * STRAY.arrowSpeed,
        vy: Math.sin(a) * STRAY.arrowSpeed,
        life: 2.6,
        dmg: STRAY.arrowDmg,
        fromPlayer: false,
        angle: a,
        slow: true,
      });
      g.audio.arrowShot();
    }
  } else if (z.silenced <= 0 && z.shootCd <= 0 && d < STRAY.range) {
    z.windup = STRAY.windup;
    z.shootCd = g.rndRange(STRAY.cdMin, STRAY.cdMax);
    g.audio.bowDraw();
    g.numbers.push({ x: z.x, y: z.y - 34, vy: -10, life: 0.5, max: 0.5, text: '!', color: '#9fd8ff' });
  } else if (d < STRAY.retreat) {
    out.flee = true;
  } else if (d < STRAY.hold) {
    out.strafe = strafeDir(z);
  }
});

registerAi('pillager', (c) => {
  const { g, z, p, dt, d, out } = c;
  z.shootCd -= dt;
  if (z.silenced > 0) {
    z.shootCd = Math.max(z.shootCd, 1.0);
    z.windup = 0;
  }
  if (z.windup > 0) {
    out.stop = true;
    z.windup -= dt;
    if (z.windup <= 0) {
      const spread = g.sky === 'sand' ? 0.1 : 0.03;
      const a = Math.atan2(p.y - 14 - (z.y - 14), p.x - z.x) + g.rndRange(-spread, spread);
      g.arrows.push({
        x: z.x,
        y: z.y - 14,
        vx: Math.cos(a) * PILLAGER.boltSpeed,
        vy: Math.sin(a) * PILLAGER.boltSpeed,
        life: 2,
        dmg: PILLAGER.boltDmg,
        fromPlayer: false,
        angle: a,
      });
      g.audio.crossbow();
    }
  } else if (z.silenced <= 0 && z.shootCd <= 0 && d < PILLAGER.range) {
    z.windup = PILLAGER.windup;
    z.shootCd = g.rndRange(PILLAGER.cdMin, PILLAGER.cdMax);
    g.audio.bowDraw();
    g.numbers.push({ x: z.x, y: z.y - 34, vy: -10, life: 0.5, max: 0.5, text: '!', color: '#b8b8a8' });
  } else if (d < PILLAGER.retreat) {
    out.flee = true;
  } else if (d < PILLAGER.hold) {
    out.strafe = strafeDir(z);
  }
});

registerAi('guardian', (c) => {
  const { g, z, p, dt, d, out } = c;
  if (z.beamT > 0) {
    z.beamT -= dt;
    out.stop = true;
    const target = Math.atan2(p.y - 14 - (z.y - 12), p.x - z.x);
    const diff = ((target - z.beamA + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    z.beamA += clamp(diff, -1.3 * dt, 1.3 * dt);
    guardianBeamDamage(g, z, dt);
    if (z.beamT <= 0) z.abilCd = g.rndRange(GUARDIAN.cdMin, GUARDIAN.cdMax);
    return;
  }
  if (z.windup > 0) {
    z.windup -= dt;
    out.stop = true;
    z.beamA = Math.atan2(p.y - 14 - (z.y - 12), p.x - z.x);
    if (z.windup <= 0) {
      z.beamT = GUARDIAN.beamTime;
      z.beamTick = 0;
      g.audio.beam();
      g.shake = Math.max(g.shake, 2);
    }
    return;
  }
  if (z.silenced > 0) z.abilCd = Math.max(z.abilCd, 1.0);
  z.abilCd -= dt;
  if (z.silenced <= 0 && z.abilCd <= 0 && d < GUARDIAN.range) {
    z.windup = GUARDIAN.windup;
    g.audio.chargeUp();
    g.numbers.push({ x: z.x, y: z.y - 34, vy: -10, life: 0.6, max: 0.6, text: '~', color: '#5ad8ff' });
    return;
  }
  if (d > GUARDIAN.keep + 40) {
    // 默认直追
  } else if (d < GUARDIAN.keep - 40) {
    out.flee = true;
  } else {
    out.strafe = strafeDir(z);
  }
});

registerAi('evoker', (c) => {
  const { g, z, dt, d, out } = c;
  z.abilCd -= dt;
  if (z.silenced > 0) {
    z.abilCd = Math.max(z.abilCd, 1.2);
    z.windup = 0;
  }
  if (z.windup > 0) {
    z.windup -= dt;
    out.stop = true;
    if (z.windup <= 0) evokerFangs(g, z);
    return;
  }
  if (!z.enraged && z.hp / z.maxHp <= EVOKER.summonAt && g.zombies.length < WAVE.maxOnScreen - SILVERFISH.packMax) {
    z.enraged = true;
    g.audio.summon();
    g.spawnZombie('silverpack', z, 40, 90);
    g.numbers.push({ x: z.x, y: z.y - 38, vy: -12, life: 0.9, max: 0.9, text: '召唤!', color: '#b06ce8', big: true });
  }
  if (z.silenced <= 0 && z.abilCd <= 0 && d < EVOKER.range) {
    z.windup = EVOKER.windup;
    z.abilCd = g.rndRange(EVOKER.cdMin, EVOKER.cdMax);
    g.audio.cast();
    g.numbers.push({ x: z.x, y: z.y - 34, vy: -10, life: 0.6, max: 0.6, text: '!', color: '#b06ce8' });
  } else if (d < EVOKER.retreat) {
    out.flee = true;
  } else if (d < EVOKER.hold) {
    out.strafe = strafeDir(z);
  }
});

registerAi('ravager', (c) => {
  const { g, z, dt, d, out } = c;
  if (z.crouch > 0) {
    z.crouch -= dt;
    out.stop = true;
    if (z.crouch <= 0) {
      z.chargeT = RAVAGER.chargeTime;
      const a = Math.atan2(g.player.y - z.y, g.player.x - z.x);
      z.chargeDx = Math.cos(a);
      z.chargeDy = Math.sin(a);
      z.beamTick = 0;
      g.audio.roar();
      g.numbers.push({ x: z.x, y: z.y - 44, vy: -12, life: 0.7, max: 0.7, text: '冲锋!', color: '#ff8a30', big: true });
    }
    return;
  }
  if (z.chargeT > 0) {
    z.chargeT -= dt;
    const p = g.player;
    const hx = z.x + z.chargeDx * (z.r + 8);
    const hy = z.y + z.chargeDy * (z.r + 8);
    const wtx = Math.floor(hx / TILE);
    const wty = Math.floor(hy / TILE);
    if (world.wallHpAt(wtx, wty) > 0) {
      z.beamTick -= dt;
      if (z.beamTick <= 0) {
        z.beamTick = RAVAGER.wallTick;
        const destroyed = world.damageWall(wtx, wty, 2);
        g.audio.axe();
        burst(g, wtx * TILE + 8, wty * TILE + 8, 6, ['#8a6a3a', '#c9a26b'], 90, 220, 2);
        if (destroyed) {
          g.wallDirty = true;
          world.invalidateFlow();
          burst(g, wtx * TILE + 8, wty * TILE + 8, 10, ['#8a6a3a', '#c9a26b'], 120, 260, 3);
        }
      }
    }
    world.moveCircle(z, z.chargeDx * RAVAGER.chargeSpeed * dt, z.chargeDy * RAVAGER.chargeSpeed * dt, Math.max(3, z.r * 0.7));
    if (d < z.r * 0.9 + PLAYER.radius && p.invuln <= 0 && p.dashT <= 0) {
      g.hurtPlayer(scaleEnemyDmg(g, RAVAGER.chargeDmg));
      z.chargeT = 0;
    }
    if (z.chargeT <= 0) {
      z.abilCd = g.rndRange(RAVAGER.chargeCdMin, RAVAGER.chargeCdMax);
      z.vx = z.chargeDx * 60;
      z.vy = z.chargeDy * 60;
    }
    out.done = true;
    return;
  }
  z.abilCd -= dt;
  if (z.silenced > 0) z.abilCd = Math.max(z.abilCd, 1.2);
  if (z.silenced <= 0 && z.abilCd <= 0 && d < RAVAGER.chargeRange && d > 40) {
    z.crouch = RAVAGER.telegraph;
    g.audio.hiss();
    g.numbers.push({ x: z.x, y: z.y - 44, vy: -10, life: 0.6, max: 0.6, text: '!', color: '#ff8a30' });
  }
});

/* ---------- 主更新循环 ---------- */

/** 仇恨半径内最近的铁傀儡：怪物会优先攻击它 */
function nearestGolem(g: Game, z: ZombieState): { go: GolemState; d: number } | null {
  let best: GolemState | null = null;
  let bd = GOLEM.aggroR;
  for (const go of g.golems) {
    if (go.hp <= 0) continue;
    const d = Math.hypot(go.x - z.x, go.y - z.y);
    if (d < bd) {
      bd = d;
      best = go;
    }
  }
  return best ? { go: best, d: bd } : null;
}

export function updateZombies(g: Game, dt: number) {
  const p = g.player;
  for (const z of g.zombies) {    if (z.dead) continue;
    const x0 = z.x;
    const y0 = z.y;
    const def = ZOMBIES[z.kind];
    z.flash = Math.max(0, z.flash - dt);
    z.anim += dt;
    z.silenced = Math.max(0, z.silenced - dt);
    z.stunT = Math.max(0, z.stunT - dt);
    z.exposeT = Math.max(0, z.exposeT - dt);
    z.atkT = Math.max(0, z.atkT - dt);
    const stunned = z.stunT > 0;
    if (stunned && g.rnd() < dt * 6) {
      // 头顶冒星星
      g.particles.push({
        x: z.x + g.rndRange(-8, 8),
        y: z.y - z.r * 2 - 6,
        vx: g.rndRange(-20, 20),
        vy: -26,
        life: 0.5,
        max: 0.5,
        color: '#ffe066',
        size: 2,
        grav: -20,
      });
    }

    let dx = p.x - z.x;
    let dy = p.y - z.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;

    // 铁傀儡在附近时会吸引仇恨：追击目标改为铁傀儡
    const golem = nearestGolem(g, z);
    let gmx = 0;
    let gmy = 0;
    if (golem) {
      const gd = golem.d || 1;
      gmx = (golem.go.x - z.x) / gd;
      gmy = (golem.go.y - z.y) / gd;
    }

    const isCharged = z.kind === 'charged';
    if ((z.kind === 'creeper' || isCharged) && z.silenced <= 0 && !stunned) {
      if (d < (isCharged ? 44 : 38)) {
        z.fuse += dt;
        if (z.fuse >= 0.75 * (g.growthLvl('creeperGentle') > 0 ? 1.35 : 1)) {
          g.explodeAt(
            z.x,
            z.y,
            isCharged ? CHARGED.radius : 52,
            isCharged ? CHARGED.dmg : 6,
            isCharged ? CHARGED.playerDmg : 3,
          );
          // 连锁引爆：爆炸波及附近的苦力怕，一起炸
          for (const o of g.zombies) {
            if (o === z || o.dead) continue;
            if (o.kind !== 'creeper' && o.kind !== 'charged') continue;
            if (Math.hypot(o.x - z.x, o.y - z.y) < 120) {
              o.fuse = Math.max(o.fuse, 1.2);
              o.stunT = 0;
            }
          }
          z.dead = true;
          continue;
        }
      } else {
        z.fuse = Math.max(0, z.fuse - dt * 2);
      }
    }

    let mvx = dx;
    let mvy = dy;
    const spd = { v: def.speed };

    // 苦力怕疾冲：第 6 波起，进入 110px 会先蹲下蓄力再加速扑过来
    if ((z.kind === 'creeper' || isCharged) && z.silenced <= 0 && g.wave >= CREEPER_DASH.fromWave) {
      if (z.chargeT > 0) {
        z.chargeT -= dt;
        spd.v *= CREEPER_DASH.speedMul;
        if (g.rnd() < dt * 22) {
          g.particles.push({
            x: z.x + g.rndRange(-4, 4),
            y: z.y + 2,
            vx: g.rndRange(-20, 20),
            vy: -10,
            life: 0.25,
            max: 0.25,
            color: 'rgba(200,200,190,0.5)',
            size: 2,
            grav: 0,
          });
        }
      } else if (z.crouch > 0) {
        z.crouch -= dt;
        spd.v = 0;
        if (z.crouch <= 0) {
          z.chargeT = CREEPER_DASH.time;
          g.audio.hiss();
        }
      } else if (z.abilCd <= 0 && d < CREEPER_DASH.range && d > 46) {
        z.crouch = CREEPER_DASH.windup;
        z.abilCd = CREEPER_DASH.cd;
        g.numbers.push({ x: z.x, y: z.y - 30, vy: -12, life: 0.5, max: 0.5, text: '!', color: '#8ef06a' });
      }
    }

    const elite = z.affix ? ELITES.find((e) => e.id === z.affix)! : null;
    if (elite) {
      spd.v *= elite.speedMul;
      if (elite.id === 'regen') z.hp = Math.min(z.maxHp, z.hp + dt * 1.5);
      if (elite.id === 'burn' && g.rnd() < dt * 7) {
        g.particles.push({
          x: z.x + g.rndRange(-6, 6),
          y: z.y - 14,
          vx: g.rndRange(-8, 8),
          vy: -40,
          life: 0.35,
          max: 0.35,
          color: '#ff7a30',
          size: 2,
          grav: -30,
        });
      }
    }

    // 红石陷阱减速
    if (z.slowT > 0) {
      z.slowT -= dt;
      spd.v *= REDSTONE.trapSlowMul;
    }
    // 血月：怪物更快、更疼
    if (g.sky === 'blood') spd.v *= SKY.bloodSpeed;
    // 狂潮波：全场提速
    if (g.horde) spd.v *= HORDE.speedMul;

    // 火焰附加：持续燃烧
    if (z.burnT > 0) {
      z.burnT -= dt;
      z.hp -= dt * 2.2;
      if (g.rnd() < dt * 9) {
        g.particles.push({
          x: z.x + g.rndRange(-6, 6),
          y: z.y - 10,
          vx: g.rndRange(-10, 10),
          vy: g.rndRange(-46, -20),
          life: 0.4,
          max: 0.4,
          color: g.rnd() < 0.5 ? '#ff8a30' : '#ffd76b',
          size: 2,
          grav: -30,
        });
      }
      if (z.hp <= 0) {
        killZombie(g, z);
        continue;
      }
    }

    // 雷源词缀：定期在玩家附近引雷
    if (z.affix === 'thunder' && !stunned && g.zombies.length > 0) {
      z.abilCd -= dt;
      if (z.abilCd <= 0 && d < 320) {
        z.abilCd = g.rndRange(3.4, 5.2);
        const tx = clamp(g.player.x + g.rndRange(-46, 46), 24, WORLD.w - 24);
        const ty = clamp(g.player.y + g.rndRange(-46, 46), 24, WORLD.h - 24);
        g.lightning.push({ x: tx, y: ty, t: WEATHER.telegraph, max: WEATHER.telegraph, struck: false });
        g.numbers.push({ x: z.x, y: z.y - 40, vy: -10, life: 0.6, max: 0.6, text: '雷源!', color: '#9fd8ff' });
      }
    }

    const out: AiOut = { flee: false, stop: false, done: false, strafe: 0 };
    const handler = HANDLERS[z.kind];
    if (stunned) {
      // 眩晕：完全停手，不移动不攻击（给玩家稳定的反击窗口）
      out.stop = true;
      spd.v = 0;
    } else if (handler) handler({ g, z, def, p, dt, d, dx, dy, spd, out });
    if (out.done) continue;

    if ((z.kind === 'creeper' || z.kind === 'charged') && z.fuse > 0) spd.v *= 0.3;

    if (out.strafe !== 0 && !out.stop) {
      // 保距走位：沿玩家径向的切线绕圈
      mvx = -dy * out.strafe;
      mvy = dx * out.strafe;
      spd.v *= 0.55;
    } else if (!out.stop) {
      if (golem) {
        mvx = gmx;
        mvy = gmy;
      } else if (out.flee) {
        const f = world.fleeDir(z.x, z.y);
        if (f) {
          mvx = f.dx;
          mvy = f.dy;
        } else {
          mvx = -dx;
          mvy = -dy;
        }
      } else if (d < 90) {
        // 近距离直接追击：避免所有僵尸挤进同一格被分离力卡住
        mvx = dx;
        mvy = dy;
      } else {
        const f = steerFlow(g, z);
        if (f) {
          mvx = f.dx;
          mvy = f.dy;
        } else {
          mvx = dx;
          mvy = dy;
        }
      }
    } else {
      // stop：原地驻足（保留惯性衰减），而不是缓慢逼近玩家
      mvx = 0;
      mvy = 0;
    }

    z.vx += mvx * spd.v * 6 * dt;
    z.vy += mvy * spd.v * 6 * dt;
    z.vx *= 0.9;
    z.vy *= 0.9;
    // 飞行怪与末影人无视玩家放的墙
    const ignoresWalls =
      z.kind === 'blaze' ||
      z.kind === 'phantom' ||
      z.kind === 'wither' ||
      z.kind === 'bossDragon' ||
      z.kind === 'enderman' ||
      z.kind.startsWith('boss') ||
      z.kind === 'bossCreeper' ||
      z.kind === 'bossWarden';
    const isBossBody = z.kind.startsWith('boss') || z.kind === 'wither';
    if (isBossBody || z.kind === 'blaze' || z.kind === 'bossDragon') {
      // 飞行单位：无视建筑与墙
      // 碾着地形走会减速 30%：BOSS 一定能到你面前，但穿越迷宫要付出时间
      const crushMul = isBossBody && world.solidAt(z.x, z.y) ? 0.7 : 1;
      z.x = clamp(z.x + z.vx * dt * crushMul, 10, WORLD.w - 10);
      z.y = clamp(z.y + z.vy * dt * crushMul, 10, WORLD.h - 10);
      if (isBossBody && world.solidAt(z.x, z.y) && Math.random() < 0.3) burst(g, z.x, z.y - 4, 3, ['#8a8a84', '#5a5a54'], 70, 180, 2);
    } else {
      // 大体型 BOSS 的碰撞半径要收窄，否则比一格通道还宽，必定卡墙
      const bodyR = z.kind.startsWith('boss') ? Math.max(4, z.r * 0.42) : Math.max(3, z.r * 0.7);
      if (ignoresWalls) world.moveCircleLoose(z, z.vx * dt, z.vy * dt, bodyR);
      else world.moveCircle(z, z.vx * dt, z.vy * dt, bodyR);
    }
    // BOSS 只能待在领域里（玩家也被限制，杂兵可自由进出）
    if (g.domain && (z.kind.startsWith('boss') || z.kind === 'wither')) {
      const c = domain.clampToDomain(g, z.x, z.y, z.r * 0.8);
      z.x = c.x;
      z.y = c.y;
    }

    if (z.kind === 'boss' && z.chargeT > 0) {
      z.chargeT -= dt;
      world.moveCircle(z, z.chargeDx * BOSS_PHASE.chargeSpeed * dt, z.chargeDy * BOSS_PHASE.chargeSpeed * dt, Math.max(3, z.r * 0.7));
      if (d < z.r * 0.85 + PLAYER.radius && p.invuln <= 0 && p.dashT <= 0) {
        g.hurtPlayer(scaleEnemyDmg(g, BOSS_PHASE.chargeDmg));
        z.chargeT = 0;
      }
    }

    // 防卡死：贴墙/挤团导致原地踏步时给一个侧向冲量脱困
    if (!out.stop && d > 46) {
      const moved = Math.hypot(z.x - x0, z.y - y0);
      if (moved < spd.v * dt * 0.3) z.stuckT = Math.min(z.stuckT + dt, 1);
      else if (z.stuckT > 0) z.stuckT = Math.max(0, z.stuckT - dt * 2);
      if (z.stuckT > 0.8) {
        z.stuckT = -1.2;
        const side = strafeDir(z);
        z.vx += -dy * side * 90;
        z.vy += dx * side * 90;
      }
    }

    // BOSS 过墙：僵尸巨人/苦力怕王会把墙砸碎（墙能拖它一下，但挡不住）
    if (z.kind.startsWith('boss') || z.kind === 'bossCreeper') {
      const btx = Math.floor((z.x + dx * (z.r + 6)) / TILE);
      const bty = Math.floor((z.y + dy * (z.r + 6)) / TILE);
      if (world.wallHpAt(btx, bty) > 0) {
        world.damageWall(btx, bty, 6);
        g.wallDirty = true;
        world.invalidateFlow();
        burst(g, btx * TILE + 8, bty * TILE + 8, 10, ['#8a6a3a', '#c9a26b', '#5a4520'], 120, 260, 3);
        g.shake = Math.max(g.shake, 3);
        g.audio.hit();
      }
    }
    // 普通怪被墙挡住时会主动拆墙（BOSS 3 点 / 精英 2 点 / 小怪 1 点）
    const wa = Math.max(0, (wallAtk.get(z.id) ?? 0) - dt);
    wallAtk.set(z.id, wa);
    if (!ignoresWalls && g.waveActive && d > 26) {
      const ax = z.x + dx * (z.r + 12);
      const ay = z.y + dy * (z.r + 12);
      const wtx = Math.floor(ax / TILE);
      const wty = Math.floor(ay / TILE);
      if (world.wallHpAt(wtx, wty) > 0 && wa <= 0) {
        wallAtk.set(z.id, 0.65);
        const wdmg = z.kind.startsWith('boss') ? 3 : z.affix ? 2 : 1;
        if (world.damageWall(wtx, wty, wdmg)) {
          g.wallDirty = true;
          world.invalidateFlow();
          burst(g, wtx * TILE + 8, wty * TILE + 8, 8, ['#8a6a3a', '#5a4520'], 90, 220, 2);
        } else {
          burst(g, wtx * TILE + 8, wty * TILE + 8, 2, ['#c9a26b'], 40, 160, 1);
        }
      }
    }
    // BOSS 卡墙兜底：地形太窄时直接把 BOSS 拉回玩家附近（苦力怕王最常遇到）
    if (z.kind.startsWith('boss') || z.kind === 'wither') {
      const moved2 = Math.hypot(z.x - x0, z.y - y0);
      const want = Math.max(spd.v, 10) * dt;
      const prev = bossStuck.get(z.id) ?? 0;
      if (d > 70 && moved2 < want * 0.3) {
        const t = prev + dt;
        bossStuck.set(z.id, t);
        if (t > 1.6) {
          bossStuck.set(z.id, 0);
          const s = world.findSpawn(p.x, p.y, 90, 140, 24);
          burst(g, z.x, z.y - 14, 12, ['#ffb040', '#ffffff'], 120, 40, 2);
          z.x = s.x;
          z.y = s.y;
          z.vx = 0;
          z.vy = 0;
          burst(g, z.x, z.y - 14, 16, ['#ffb040', '#ffffff'], 140, 40, 3);
          g.numbers.push({ x: z.x, y: z.y - 50, vy: -12, life: 0.9, max: 0.9, text: '它挣脱了地形!', color: '#ffb040' });
        }
      } else if (prev > 0) {
        bossStuck.set(z.id, Math.max(0, prev - dt * 2));
      }
    }

    bossPhaseFx(g, z);

    // 攻击附近的铁傀儡（怪物主动仇恨）
    let struckGolem = false;
    if (!stunned && golem && golem.d < z.r * 0.9 + 16 && z.atkT <= 0) {
      const go = golem.go;
      z.atkT = GOLEM.hitCd;
      const dmg = scaleEnemyDmg(g, def.dmg * GOLEM.dmgTakenMul);
      go.hp -= dmg;
      go.flash = 0.14;
      const ang = Math.atan2(go.y - z.y, go.x - z.x);
      go.x += Math.cos(ang) * 2;
      go.y += Math.sin(ang) * 2;
      g.audio.hit();
      burst(g, go.x, go.y - 18, 5, ['#c9c9c0', '#8a8a90'], 70, 30, 2);
      g.numbers.push({ x: go.x, y: go.y - 44, vy: -16, life: 0.6, max: 0.6, text: `-${dmg}`, color: '#ff9a8a' });
      struckGolem = true;
    }

    if (!stunned && !struckGolem && d < z.r * 0.85 + PLAYER.radius && p.invuln <= 0 && p.dashT <= 0) {
      const extra =
        (elite ? elite.dmgAdd : 0) +
        (z.kind === 'boss' && z.enraged ? 1 : 0) +
        (g.sky === 'blood' ? SKY.bloodDmgAdd : 0) +
        g.diffDef().dmgAdd;
      const dealt = scaleEnemyDmg(g, def.dmg + extra);
      g.hurtPlayer(dealt);
      if (elite && elite.id === 'frost') p.slowT = Math.max(p.slowT, 2.2);
      // 汲取词缀：打中你就回血
      if (elite && elite.id === 'vampire') {
        z.hp = Math.min(z.maxHp, z.hp + dealt * 1.6);
        g.numbers.push({ x: z.x, y: z.y - 34, vy: -12, life: 0.6, max: 0.6, text: `+${Math.round(dealt * 1.6)}`, color: '#6ee86e' });
      }
    }
  }

  for (let i = 0; i < g.zombies.length; i++) {
    const a = g.zombies[i];
    if (a.dead) continue;
    for (let j = i + 1; j < g.zombies.length; j++) {
      const b = g.zombies[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const md = (a.r + b.r) * 0.95;
      if (d2 > 0.01 && d2 < md * md) {
        const d = Math.sqrt(d2);
        const push = ((md - d) / md) * 110 * dt;
        const nx = dx / d;
        const ny = dy / d;
        a.vx -= nx * push;
        a.vy -= ny * push;
        b.vx += nx * push;
        b.vy += ny * push;
      }
    }
  }
}

export function updateBoss(g: Game, z: ZombieState, dt: number, d: number) {
  const p = g.player;
  const frac = z.hp / z.maxHp;
  if (frac <= BOSS_PHASE.rageAt && !z.enraged) {
    z.enraged = true;
    g.audio.roar();
    g.banner = { title: '暴怒!', sub: '巨型僵尸进入暴怒状态', t: 1.4, max: 1.4 };
    burst(g, z.x, z.y - 20, 20, ['#ff4a5a', '#b0202a'], 160, 200, 3);
  }
  z.abilCd -= dt;
  if (frac <= BOSS_PHASE.enrageAt && z.abilCd <= 0 && g.zombies.length < WAVE.maxOnScreen) {
    z.abilCd = BOSS_PHASE.summonCd;
    g.audio.summon();
    for (let i = 0; i < BOSS_PHASE.summonN; i++) g.spawnZombie('normal', z, 90, 170);
    g.numbers.push({ x: z.x, y: z.y - 52, vy: -12, life: 0.9, max: 0.9, text: '召唤!', color: '#b0202a', big: true });
  }
  if (z.crouch > 0) {
    z.crouch -= dt;
    if (z.crouch <= 0) {
      z.chargeT = BOSS_PHASE.chargeTime;
      const a = Math.atan2(p.y - z.y, p.x - z.x);
      z.chargeDx = Math.cos(a);
      z.chargeDy = Math.sin(a);
      g.audio.chargeUp();
      g.numbers.push({ x: z.x, y: z.y - 52, vy: -12, life: 0.6, max: 0.6, text: '!!', color: '#ff4a5a', big: true });
    }
  } else if (d > 150 && z.chargeT <= 0 && z.windup <= 0 && z.crouch <= 0 && z.rockT <= 0 && z.slamT <= 0) {
    // 冲锋从开局就可用：血越少间隔越短
    const cdMul = frac <= BOSS_PHASE.rageAt ? 0.65 : frac <= BOSS_PHASE.enrageAt ? 0.85 : 1;
    z.windup = g.rndRange(BOSS_PHASE.chargeCdMin, BOSS_PHASE.chargeCdMax) * cdMul;
    z.crouch = BOSS_PHASE.chargeTelegraph;
  }
  z.windup = Math.max(0, z.windup - dt);
}

function bossPhaseFx(g: Game, z: ZombieState) {
  if (!z.kind.startsWith('boss') && z.kind !== 'wither') return;
  const frac = z.hp / z.maxHp;
  if (z.kind === 'boss') {
    if (z.phase < 1 && frac <= 0.72) {
      z.phase = 1;
      g.banner = { title: '阶段 2 · 岩石风暴', sub: '巨型僵尸开始投掷岩石', t: 1.6, max: 1.6 };
      g.audio.bossPhase();
      g.shake = Math.max(g.shake, 5);
    }
    if (z.phase < 2 && frac <= 0.3) {
      z.phase = 2;
      g.banner = { title: '阶段 3 · 背水一战', sub: '震地更频繁，援军将至', t: 1.6, max: 1.6 };
      g.audio.roar();
      g.shake = Math.max(g.shake, 9);
    }
  } else if (z.kind === 'bossCreeper') {
    if (z.phase < 1 && frac <= BOSS_CREEPER.summonAt) {
      z.phase = 1;
      g.banner = { title: '苦力怕王 · 唤起援军', sub: '小心连锁爆炸', t: 1.5, max: 1.5 };
      g.audio.bossPhase();
    }
  } else if (z.kind === 'wither') {
    if (z.phase < 1 && frac <= 0.7) {
      z.phase = 1;
      g.banner = { title: '凋灵 · 二阶段', sub: '骷髅弹幕更加密集', t: 1.5, max: 1.5 };
      g.audio.bossPhase();
    }
    if (z.phase < 2 && frac <= 0.3) {
      z.phase = 2;
      g.banner = { title: '凋灵 · 终焉', sub: '螺旋弹幕全面展开', t: 1.6, max: 1.6 };
      g.audio.witherSpiral();
      g.shake = Math.max(g.shake, 7);
    }
  } else if (z.kind === 'bossDragon') {
    if (z.phase < 1 && frac <= DRAGON.rageAt) {
      z.phase = 1;
      g.banner = { title: '末影龙 · 暴走', sub: '俯冲更频繁，龙息覆盖更广', t: 1.6, max: 1.6 };
      g.audio.bossPhase();
      g.shake = Math.max(g.shake, 8);
    }
  } else if (z.kind === 'bossWarden') {
    if (z.phase < 1 && frac <= 0.6) {
      z.phase = 1;
      g.banner = { title: '监守者 · 听觉强化', sub: '声波攻击更密集', t: 1.6, max: 1.6 };
      g.audio.bossPhase();
      g.shake = Math.max(g.shake, 6);
    }
  }
}

function bossRock(g: Game, z: ZombieState) {
  const p = g.player;
  const a = Math.atan2(p.y - 14 - (z.y - 22), p.x - z.x);
  g.fireballs.push({
    x: z.x + Math.cos(a) * 10,
    y: z.y - 22 + Math.sin(a) * 10,
    vx: Math.cos(a) * BOSS_PHASE.rockSpeed,
    vy: Math.sin(a) * BOSS_PHASE.rockSpeed,
    life: 3.4,
    dmg: BOSS_PHASE.rockDmg + (z.enraged ? 1 : 0),
    fromPlayer: false,
    skull: false,
    r: 6,
  });
  g.audio.rockThrow();
  g.shake = Math.max(g.shake, 2);
  burst(g, z.x + Math.cos(a) * 14, z.y - 22 + Math.sin(a) * 14, 6, ['#8a6a3a', '#c9a26b'], 70, 120, 2);
}

function bossSlam(g: Game, z: ZombieState) {
  const p = g.player;
  g.explosions.push({ x: z.x, y: z.y, r: BOSS_PHASE.slamRadius, t: 0, max: 0.45 });
  g.scorches.push({ x: z.x, y: z.y, r: BOSS_PHASE.slamRadius * 0.5, t: 0, max: 4 });
  g.shake = Math.max(g.shake, 13);
  g.hitStop = Math.max(g.hitStop, 0.06);
  g.audio.quake();
  burst(g, z.x, z.y, 24, ['#8a6a3a', '#c9a26b', '#5a4520'], 190, 260, 3);
  if (
    Math.hypot(p.x - z.x, p.y - z.y) < BOSS_PHASE.slamRadius + PLAYER.radius &&
    p.invuln <= 0 &&
    p.dashT <= 0
  ) {
    g.hurtPlayer(scaleEnemyDmg(g, BOSS_PHASE.slamDmg + (z.enraged ? 1 : 0)));
  }
  // 二阶段起：震地追加一圈地刺，逼玩家离开站桩位
  if (z.phase >= 1) {
    const n = BOSS_PHASE.slamFangs;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + g.rndRange(-0.08, 0.08);
      g.fangs.push({
        x: clamp(p.x + Math.cos(a) * BOSS_PHASE.slamFangR, 12, WORLD.w - 12),
        y: clamp(p.y + Math.sin(a) * BOSS_PHASE.slamFangR, 12, WORLD.h - 12),
        t: -i * BOSS_PHASE.slamFangGap,
        max: 0.42,
        hit: false,
      });
    }
    g.audio.fang();
  }
}

export function steerFlow(g: Game, z: ZombieState): { dx: number; dy: number } | null {
  const f = world.flowDir(z.x, z.y);
  if (!f) return null;
  const tx = Math.floor(z.x / TILE);
  const ty = Math.floor(z.y / TILE);
  const cx = (tx + f.dx + 0.5) * TILE;
  const cy = (ty + f.dy + 0.5) * TILE;
  const ddx = cx - z.x;
  const ddy = cy - z.y;
  const dd = Math.hypot(ddx, ddy) || 1;
  return { dx: ddx / dd, dy: ddy / dd };
}

export function teleportEnderman(g: Game, z: ZombieState) {
  const p = g.player;
  z.abilCd = g.rndRange(ENDER.teleportCdMin, ENDER.teleportCdMax);
  burst(g, z.x, z.y - 12, 12, ['#d06cff', '#8a3ac0'], 70, -30, 2);
  const s = world.findSpawn(p.x, p.y, ENDER.teleportMin, ENDER.teleportMax, 30);
  z.x = s.x;
  z.y = s.y;
  burst(g, z.x, z.y - 12, 12, ['#d06cff', '#8a3ac0'], 70, -30, 2);
  g.audio.teleport();
}

export function skeletonFire(g: Game, z: ZombieState) {
  const p = g.player;
  const base = Math.atan2(p.y - 14 - (z.y - 16), p.x - z.x);
  // 第 8 波起：骷髅学会三连射
  const triple = g.wave >= TRIPLE_SHOT.fromWave;
  const n = triple ? 3 : 1;
  const sandSpread = g.sky === 'sand' ? 0.13 : 0;
  for (let i = 0; i < n; i++) {
    const ang = base + g.rndRange(-0.07 - sandSpread, 0.07 + sandSpread) + (n > 1 ? (i - 1) * 0.11 : 0);
    g.arrows.push({
      x: z.x,
      y: z.y - 16,
      vx: Math.cos(ang) * SKELETON.arrowSpeed,
      vy: Math.sin(ang) * SKELETON.arrowSpeed,
      life: 2.2,
      dmg: SKELETON.arrowDmg,
      fromPlayer: false,
      angle: ang,
    });
  }
  g.audio.arrowShot();
  if (triple) {
    g.numbers.push({ x: z.x, y: z.y - 40, vy: -12, life: 0.6, max: 0.6, text: '三连射!', color: '#ffd76b' });
  }
}

export function witchThrow(g: Game, z: ZombieState) {
  const t = WITCH.potionTime;
  g.potions.push({
    x: z.x,
    y: z.y - 18,
    vx: (z.tx - z.x) / t,
    vy: (z.ty - 14 - (z.y - 18)) / t,
    tx: z.tx,
    ty: z.ty - 14,
    life: t,
  });
  g.audio.potion();
}

/** 守卫者激光：按 tick 结算一次直线灼烧伤害（墙体拦截） */
function guardianBeamDamage(g: Game, z: ZombieState, dt: number) {
  z.beamTick -= dt;
  if (z.beamTick > 0) return;
  z.beamTick = GUARDIAN.beamTick;
  const p = g.player;
  const rx = Math.cos(z.beamA);
  const ry = Math.sin(z.beamA);
  const ox = z.x;
  const oy = z.y - 12;
  const px = p.x - ox;
  const py = p.y - 14 - oy;
  const t = px * rx + py * ry;
  if (t < 0 || t > GUARDIAN.beamLen) return;
  const perp = Math.abs(px * ry - py * rx);
  if (perp > GUARDIAN.beamHalf + PLAYER.radius) return;
  for (let s = 14; s < t - 4; s += 14) {
    if (world.solidAt(ox + rx * s, oy + ry * s)) return;
  }
  g.hurtPlayer(scaleEnemyDmg(g, GUARDIAN.beamDmg));
}

/** 唤魔者尖牙阵：在玩家周围弧形排布，依次破土 */
function evokerFangs(g: Game, z: ZombieState) {
  const p = g.player;
  const a0 = Math.atan2(z.y - p.y, z.x - p.x) + g.rndRange(-0.35, 0.35);
  const r = EVOKER.fangGap * 1.9;
  for (let i = 0; i < EVOKER.fangCount; i++) {
    const a = a0 + (i - (EVOKER.fangCount - 1) / 2) * 0.24;
    g.fangs.push({
      x: clamp(p.x + Math.cos(a) * r, 12, WORLD.w - 12),
      y: clamp(p.y + Math.sin(a) * r, 12, WORLD.h - 12),
      t: -i * EVOKER.fangDelay,
      max: EVOKER.fangRise,
      hit: false,
    });
  }
  g.audio.fang();
}

export function updateFangs(g: Game, dt: number) {
  const p = g.player;
  for (const f of g.fangs) {
    f.t += dt;
    if (!f.hit && f.t >= EVOKER.fangRise * 0.35) {
      f.hit = true;
      if (Math.hypot(p.x - f.x, p.y - 14 - f.y) < EVOKER.fangHitR + PLAYER.radius * 0.4) {
        g.hurtPlayer(scaleEnemyDmg(g, EVOKER.fangDmg));
        g.shake = Math.max(g.shake, 2);
      }
      burst(g, f.x, f.y, 5, ['#d8d0c0', '#8a8070'], 70, 120, 2);
    }
  }
  g.fangs = g.fangs.filter((f) => f.t < f.max + 0.25);
}

export function damageZombie(g: Game, z: ZombieState, dmg: number, angle: number) {
  if (z.dead) return;
  // 暴击判定（面板暴击率 × 连击加成）
  const critChance = clamp(COMBAT.critBase + 0.05 * g.metaLvl('crit') + 0.08 * g.growthLvl('crit') + g.player.combo * 0.005 + (g.job === 'assassin' ? 0.08 : 0), 0, 0.6);
  const isCrit = g.rnd() < critChance;
  const hunterMul = g.growthLvl('hunter') > 0 && ZOMBIES[z.kind]?.ranged ? 1.25 : 1;
  const final = isCrit ? Math.round(dmg * COMBAT.critMul * hunterMul) : Math.round(dmg * hunterMul);

  // ── 巨型僵尸：外骨骼护甲，只有"破绽窗口"内才能削 ──
  if (z.kind === 'boss' && z.armorHp > 0) {
    if (z.exposeT > 0) {
      z.armorHp = Math.max(0, z.armorHp - final);
      if (z.armorHp <= 0) {
        z.stunT = Math.max(z.stunT, 2.5);
        g.banner = { title: '外骨骼破碎!', sub: '它跪下了 · 全力输出', t: 1.6, max: 1.6 };
        g.audio.bossPhase();
        g.shake = Math.max(g.shake, 10);
        burst(g, z.x, z.y - 20, 26, ['#c9c9c0', '#ffb040'], 170, 200, 3);
      }
      g.numbers.push({ x: z.x, y: z.y - 52, vy: -14, life: 0.6, max: 0.6, text: '护甲 -', color: '#c9c9c0' });
    }
    // 护甲未破：伤害压到 35%，等到破绽窗口再打
    z.hp -= Math.round(final * 0.5);
  } else {
    z.hp -= final;
  }

  // ── 苦力怕王：贴着蓄力时挨打够 3 下会斩断引信 ──
  if (z.kind === 'bossCreeper' && z.fuse > 0.1) {
    z.stateT += 1;
    if (z.stateT >= 3) {
      z.stateT = 0;
      z.fuse = 0;
      z.stunT = Math.max(z.stunT, 1.2);
      const ang = Math.atan2(z.y - g.player.y, z.x - g.player.x);
      z.vx += Math.cos(ang) * 260;
      z.vy += Math.sin(ang) * 260;
      g.banner = { title: '引信被斩断!', sub: '把它踢开了 · 别让它再贴上来', t: 1.4, max: 1.4 };
      g.audio.bossPhase();
      g.shake = Math.max(g.shake, 7);
      burst(g, z.x, z.y - 16, 16, ['#8ef06a', '#ffffff'], 150, 80, 3);
    }
  }

  // ── 凋灵：三颗头各自独立，掉头就少一种弹幕 ──
  if (z.kind === 'wither' && z.headsLeft > 1) {
    const frac = (z.hp - final) / z.maxHp;
    const want = frac <= 0.33 ? 1 : frac <= 0.66 ? 2 : 3;
    if (want < z.headsLeft) {
      z.headsLeft = want;
      g.banner = {
        title: `凋灵头颅 ${z.headsLeft}/3`,
        sub: z.headsLeft === 2 ? '螺旋弹幕停了' : '只剩齐射了',
        t: 1.5,
        max: 1.5,
      };
      g.audio.bossPhase();
      g.shake = Math.max(g.shake, 8);
      burst(g, z.x, z.y - 30, 18, ['#2a2a34', '#8a8a9a'], 150, 120, 3);
    }
  }

  z.flash = 0.09;
  z.vx += Math.cos(angle) * (isCrit ? 170 : 120);
  z.vy += Math.sin(angle) * (isCrit ? 170 : 120);
  g.runDmg += final;
  if (z.stunT > 0) {
    // 眩晕中的敌人挨打更疼（钓竿连招的收益）
    z.hp -= Math.round(final * (ROD.stunDmgMul - 1));
  }
  if (isCrit) {
    g.runCrits++;
    g.audio.crit();
    g.particles.push({ x: z.x, y: z.y - 26, vx: 0, vy: -20, life: 0.3, max: 0.3, color: '#ffd24a', size: 5, grav: 0 });
    // 连锁闪电：暴击时对附近两个敌人放电
    if (g.growthLvl('chainBolt') > 0) {
      let n = 0;
      for (const o of g.zombies) {
        if (o.dead || o === z) continue;
        if (Math.hypot(o.x - z.x, o.y - z.y) < 130) {
          g.damageZombie(o, Math.max(1, Math.round(final * 0.45)), Math.atan2(o.y - z.y, o.x - z.x));
          g.lightning.push({ x: o.x, y: o.y, t: 0.12, max: 0.12, struck: true });
          n++;
          if (n >= 2) break;
        }
      }
      if (n > 0) g.audio.crit();
    }
  }
  // 伤害数字合并：同一目标 0.4 秒内的连续命中累加成一个数字，避免同屏数字糊成一片
  const existing = g.numbers.find((n) => n.src === z.id && n.life > 0.4);
  if (existing) {
    existing.acc = (existing.acc ?? 0) + final;
    existing.text = existing.acc >= 1000 ? `${(existing.acc / 1000).toFixed(1)}k` : `${existing.acc}`;
    existing.life = 0.6;
    existing.max = 0.6;
    if (isCrit) {
      existing.big = true;
      existing.color = '#ffd24a';
      existing.text = `${existing.text}!`;
    }
  } else {
    g.numbers.push({
      x: z.x + g.rndRange(-4, 4),
      y: z.y - 30,
      vy: -28,
      life: isCrit ? 0.85 : 0.65,
      max: isCrit ? 0.85 : 0.65,
      text: isCrit ? `${final}!` : `${final}`,
      color: isCrit ? '#ffd24a' : dmg >= 8 ? '#4aedd9' : '#ffffff',
      big: isCrit,
      src: z.id,
      acc: final,
    });
  }
  for (let i = 0; i < 4; i++) {
    g.particles.push({
      x: z.x + g.rndRange(-4, 4),
      y: z.y - g.rndRange(8, 22),
      vx: g.rndRange(-70, 70),
      vy: g.rndRange(-60, 10),
      life: g.rndRange(0.2, 0.45),
      max: 0.45,
      color: z.kind === 'skeleton' ? '#d8d6c8' : z.kind === 'enderman' ? '#8a3ac0' : '#b0202a',
      size: 2,
      grav: 240,
    });
  }
  g.shake = Math.max(g.shake, isCrit ? 3 : 2);
  g.audio.hit();
  if (z.kind === 'pigman') alertPigmen(g, z);
  if (z.hp <= 0) killZombie(g, z);
  else if (z.kind === 'enderman' && z.silenced <= 0 && g.rnd() < ENDER.hitTeleportChance) {
    teleportEnderman(g, z);
  }
}

export function alertPigmen(g: Game, origin: ZombieState) {
  origin.enraged = true;
  g.audio.roar();
  g.numbers.push({ x: origin.x, y: origin.y - 34, vy: -12, life: 0.7, max: 0.7, text: '!', color: '#f7b4d8' });
  for (const o of g.zombies) {
    if (o.dead || o.kind !== 'pigman' || o.enraged) continue;
    if (Math.hypot(o.x - origin.x, o.y - origin.y) < PIGMAN.alertRadius) {
      o.enraged = true;
      g.numbers.push({ x: o.x, y: o.y - 30, vy: -10, life: 0.6, max: 0.6, text: '!', color: '#f7b4d8' });
    }
  }
}

export function killZombie(g: Game, z: ZombieState) {
  if (z.dead) return;
  z.dead = true;

  // 最后一个 BOSS 死了：收起领域
  if ((z.kind.startsWith('boss') || z.kind === 'wither') && g.domain) {
    const left = g.zombies.some((o) => !o.dead && o !== z && (o.kind.startsWith('boss') || o.kind === 'wither'));
    if (!left) domain.exitDomain(g);
  }
  // 蜘蛛骑士阵亡：坐骑脱缰，变成一只蜘蛛继续追
  if (z.kind === 'spiderJockey') {
    g.spawnZombie('spider', { x: z.x, y: z.y }, 6, 16);
    const mount = g.zombies[g.zombies.length - 1];
    if (mount) {
      mount.x = z.x;
      mount.y = z.y;
      mount.maxHp = Math.max(1, Math.round(mount.maxHp * 0.7));
      mount.hp = mount.maxHp;
    }
    burst(g, z.x, z.y - 10, 10, ['#3a3a44', '#26262e', PAL.bone], 100, 80, 2);
  }

  // 苦力怕王：血量掉到 80% / 60% / 40% 各召唤一次援军
  if (z.kind === 'bossCreeper') {
    const frac = z.hp / z.maxHp;
    const marks: [number, number][] = [
      [0.8, 1],
      [0.6, 2],
      [0.4, 4],
    ];
    for (const [f, bit] of marks) {
      if (frac <= f && ((z.headsLeft || 0) & bit) === 0) {
        z.headsLeft = (z.headsLeft || 0) | bit;
        for (let i = 0; i < 3; i++) {
          g.spawnZombie('creeper', { x: z.x, y: z.y }, 6, 16);
          const kid = g.zombies[g.zombies.length - 1];
          if (!kid) continue;
          const a = (i / 3) * Math.PI * 2;
          kid.x = z.x + Math.cos(a) * 26;
          kid.y = z.y + Math.sin(a) * 26;
        }
        g.banner = { title: '苦力怕王 · 召唤援军!', sub: `血量 ${Math.round(frac * 100)}% · 又来了三只`, t: 1.5, max: 1.5 };
        g.audio.bossPhase();
        g.shake = Math.max(g.shake, 6);
        burst(g, z.x, z.y - 14, 16, ['#8ef06a', '#4a9a2a'], 150, 60, 3);
      }
    }
  }
  // 苦力怕王死亡：5 秒后原地大爆炸
  if (z.kind === 'bossCreeper') {
    g.pendingBlasts.push({ x: z.x, y: z.y, t: 5 });
    g.banner = { title: '危险! 苦力怕王 5 秒后爆炸', sub: '立刻离开这片区域', t: 5, max: 5 };
    g.audio.bossPhase();
  }

  // 分裂词缀：死亡时炸成两只小的（小怪不带词缀，避免无限分裂）
  if (z.affix === 'split' && !z.kind.startsWith('boss') && z.kind !== 'wither') {
    for (let i = 0; i < 2; i++) {
      g.spawnZombie(z.kind, { x: z.x, y: z.y }, 8, 20);
      const kid = g.zombies[g.zombies.length - 1];
      if (!kid) continue;
      kid.x = z.x + (i ? 9 : -9);
      kid.y = z.y + (i ? 4 : -2);
      kid.affix = '';
      kid.maxHp = Math.max(1, Math.round(kid.maxHp * 0.35));
      kid.hp = kid.maxHp;
      kid.scale *= 0.72;
      kid.r = Math.max(4, kid.r * 0.72);
    }
    burst(g, z.x, z.y - 10, 12, ['#8ef0b0', '#4fbf74'], 110, 90, 2);
  }

  const p = g.player;
  p.combo++;
  p.comboT = COMBO.window;
  g.meta.kills++;
  g.killCount++;
  // 武器线成长：按最后一击的武器累计
  g.weaponXp[g.dmgSrc] = (g.weaponXp[g.dmgSrc] ?? 0) + 1;
  // 击杀数给成长：每 60 杀给一次三选一（和波次给的混在一起），不会太频繁
  if (g.phase === 'play' && g.killCount >= g.nextGrowthKills) {
    g.nextGrowthKills += 90;
    g.openGrowth();
  }
  // 夺魂成长：击杀回血
  const ls = Math.min(2, g.growthLvl('lifesteal'));
  if (ls > 0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + ls);
    g.particles.push({ x: p.x, y: p.y - 20, vx: 0, vy: -30, life: 0.5, max: 0.5, color: '#c8343a', size: 2, grav: 0 });
  }
  // 幸运：击杀有概率掉绿宝石
  if (g.growthLvl('lucky') > 0 && g.rnd() < 0.08) {
    g.drops.push({ x: z.x + g.rndRange(-8, 8), y: z.y + 8, life: 22, bob: 2, kind: 'emerald' });
  }
  // 兽性：本波每杀一只叠 1% 伤害
  if (g.growthLvl('beast') > 0) g.beastStacks = Math.min(30, g.beastStacks + 1);
  // 拾荒：击杀有概率掉苹果
  if (g.growthLvl('scavenge') > 0 && g.rnd() < 0.3) {
    g.drops.push({ x: z.x + g.rndRange(-6, 6), y: z.y + 6, life: 20, bob: 1, kind: 'apple' });
  }
  g.unlockAch('firstKill');
  g.unlockAch('kill100', g.metaKills() >= 100);
  g.unlockAch('kill500', g.metaKills() >= 500);

  const colors =
    z.kind === 'skeleton'
      ? [PAL.bone, PAL.boneDark]
      : z.kind === 'creeper'
        ? [PAL.creeper, PAL.creeperDark]
        : z.kind === 'charged'
          ? ['#4aa8ff', '#1e5a9a']
          : z.kind === 'enderman'
            ? [PAL.ender, PAL.enderEye]
            : z.kind === 'spider'
              ? [PAL.spider, PAL.spiderDark]
              : z.kind === 'witch'
                ? [PAL.witch, PAL.witchDark]
                : z.kind === 'slime'
                  ? ['#6ee86e', '#3fae3f']
                  : z.kind === 'blaze'
                    ? ['#f5a623', '#8a5a10']
                    : z.kind === 'phantom'
                      ? ['#3a4a7a', '#20293f']
                      : z.kind === 'stray'
                        ? [PAL.bone, '#9fd8ff']
                        : z.kind === 'guardian'
                          ? ['#4aa8a8', '#22585a']
                          : z.kind === 'evoker'
                            ? ['#6a6a72', '#464650']
                            : z.kind === 'pillager'
                              ? ['#6a5a48', '#463a2e']
                              : z.kind === 'ravager'
                                ? ['#4a4a52', '#2a2a30']
                                : z.kind === 'witherSkel' || z.kind === 'wither'
                                  ? ['#2e2e36', '#1a1a20']
                                  : [PAL.zSkin, PAL.zSkinDark];
  burst(g, z.x, z.y - 12, 14, colors, 140, 300, z.kind === 'boss' ? 4 : 3);
  g.shake = Math.max(g.shake, 3);
  g.hitStop = Math.max(g.hitStop, 0.02);
  g.audio.kill();

  if (p.combo > 0 && p.combo % 10 === 0) {
    g.numbers.push({
      x: p.x,
      y: p.y - 50,
      vy: -16,
      life: 1.2,
      max: 1.2,
      text: `${p.combo} 连杀!`,
      color: '#ffd76b',
      big: true,
    });
    burst(g, p.x, p.y - 18, 16, ['#ffd76b', '#fff3a0'], 130, 30, 2);
    g.shake = Math.max(g.shake, 4);
    g.audio.combo();
  } else if (p.combo > 0 && p.combo % SLOWMO.multiKill === 0) {
    g.slowmo = SLOWMO.time;
  }

  if (z.kind.startsWith('boss') || z.kind === 'wither') {
    g.shake = Math.max(g.shake, 11);
    g.hitStop = Math.max(g.hitStop, 0.14);
    g.zoomT = Math.max(g.zoomT, 0.55);
    burst(g, z.x, z.y - 20, 26, ['#b0202a', '#6b2a2a'], 180, 320, 4);
    const debris = ['#7f7f7f', '#5c5c5c', '#9c9c9c'];
    for (let i = 0; i < 12; i++) {
      const a = g.rnd() * TAU;
      const s = g.rndRange(60, 220);
      g.particles.push({
        x: z.x,
        y: z.y - 10,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 70,
        life: g.rndRange(0.5, 1.0),
        max: 1.0,
        color: debris[g.rndInt(0, 2)],
        size: 4,
        grav: 380,
      });
    }
    g.drops.push({ x: z.x - 10, y: z.y, life: 30, bob: 0, kind: 'heart' });
    g.drops.push({ x: z.x + 10, y: z.y, life: 30, bob: 1, kind: 'heart' });
    g.drops.push({ x: z.x, y: z.y + 12, life: 30, bob: 2, kind: 'apple' });
    g.drops.push({ x: z.x - 18, y: z.y + 12, life: 30, bob: 3, kind: 'apple' });
    g.drops.push({ x: z.x + 16, y: z.y + 14, life: 30, bob: 4, kind: 'emerald' });
    g.drops.push({ x: z.x, y: z.y + 22, life: 30, bob: 5, kind: 'xp' });
    g.drops.push({ x: z.x - 8, y: z.y + 22, life: 30, bob: 6, kind: 'xp' });
    g.drops.push({ x: z.x + 20, y: z.y + 24, life: 30, bob: 7, kind: 'diamond' });
    if (z.kind === 'wither') {
      g.drops.push({ x: z.x - 24, y: z.y + 24, life: 30, bob: 8, kind: 'emerald' });
      g.drops.push({ x: z.x + 24, y: z.y + 24, life: 30, bob: 9, kind: 'emerald' });
      g.drops.push({ x: z.x, y: z.y + 34, life: 30, bob: 10, kind: 'disc', sub: DISCS[g.rndInt(0, DISCS.length - 1)].id });
    } else if (z.kind === 'bossDragon') {
      // 末影龙：龙息残留多，给足眼睛与绿宝石，鼓励绕图传送
      for (let i = 0; i < 3; i++) g.drops.push({ x: z.x - 24 + i * 24, y: z.y + 24, life: 30, bob: 8, kind: 'emerald' });
      g.drops.push({ x: z.x, y: z.y + 34, life: 30, bob: 10, kind: 'eye' });
      g.drops.push({ x: z.x + 12, y: z.y + 34, life: 30, bob: 11, kind: 'eapple' });
    } else if (z.kind === 'bossWarden') {
      for (let i = 0; i < 2; i++) {
        g.drops.push({ x: z.x - 20 + i * 40, y: z.y + 24, life: 30, bob: 8, kind: 'iron' });
        g.drops.push({ x: z.x - 20 + i * 40, y: z.y + 30, life: 30, bob: 9, kind: 'gold' });
      }
      g.drops.push({ x: z.x, y: z.y + 36, life: 30, bob: 10, kind: 'enchant' });
    } else if (g.rnd() < 0.25) {
      g.drops.push({ x: z.x + 26, y: z.y + 24, life: 30, bob: 8, kind: 'disc', sub: DISCS[g.rndInt(0, DISCS.length - 1)].id });
    }
  } else {
    if (z.kind === 'slime' && z.size < SLIME.sizes - 1) {
      for (let i = 0; i < 2; i++) {
        g.spawnZombie('slime', { x: z.x, y: z.y }, 12, 26);
        const z2 = g.zombies[g.zombies.length - 1];
        z2.size = z.size + 1;
        const hpMul = SLIME.hpMul[z2.size];
        z2.maxHp = Math.round(z2.maxHp * hpMul * 10) / 10;
        z2.hp = z2.maxHp;
        const sdef = ZOMBIES.slime;
        z2.scale = sdef.scale * SLIME.scaleMul[z2.size];
        z2.r = Math.max(4, sdef.r * SLIME.scaleMul[z2.size]);
      }
      g.audio.slime();
      return;
    }
    const n = z.kind === 'gold' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      g.drops.push({ x: z.x + (i ? 8 : -8), y: z.y + (i ? 4 : 0), life: 14, bob: i, kind: 'xp' });
    }
    if (z.kind === 'creeper') {
      const n2 = g.hasRelic('powder') ? 2 : 1;
      for (let i = 0; i < n2; i++) {
        g.drops.push({ x: z.x + 10 + i * 6, y: z.y + i * 4, life: 25, bob: 1, kind: 'gunpowder' });
      }
    }
    if (z.kind === 'charged') {
      g.drops.push({ x: z.x - 10, y: z.y, life: 25, bob: 1, kind: 'gunpowder' });
      g.drops.push({ x: z.x + 10, y: z.y, life: 25, bob: 2, kind: 'gunpowder' });
    }
    if (z.kind === 'enderman') {
      g.drops.push({ x: z.x, y: z.y + 10, life: 25, bob: 2, kind: 'eye' });
    }
    if (z.kind === 'iron') {
      g.drops.push({ x: z.x, y: z.y + 10, life: 25, bob: 2, kind: 'iron' });
    }
    if (z.kind === 'gold') {
      g.drops.push({ x: z.x + 4, y: z.y + 10, life: 25, bob: 3, kind: 'gold' });
    }
    if (z.kind === 'blaze') {
      g.drops.push({ x: z.x, y: z.y + 10, life: 25, bob: 2, kind: 'fireball' });
    }
    if (z.kind === 'witherSkel') {
      g.drops.push({ x: z.x, y: z.y + 10, life: 25, bob: 2, kind: 'coal' });
    }
    if (z.kind === 'phantom' && g.rnd() < 0.25) {
      g.drops.push({ x: z.x, y: z.y + 10, life: 25, bob: 2, kind: 'iron' });
    }
    if (z.kind === 'witch' && g.rnd() < 0.35) {
      const pot = POTION_DROPS[g.rndInt(0, POTION_DROPS.length - 1)];
      g.drops.push({ x: z.x, y: z.y + 10, life: 25, bob: 2, kind: 'potion', sub: pot.id });
    }
    if (z.kind === 'guardian' && g.rnd() < 0.2) {
      g.drops.push({ x: z.x, y: z.y + 10, life: 25, bob: 2, kind: 'iron' });
    }
    if (z.kind === 'evoker' && g.rnd() < 0.12) {
      g.drops.push({ x: z.x, y: z.y + 10, life: 25, bob: 2, kind: 'enchant' });
    }
    if (z.kind === 'pillager' && g.rnd() < 0.15) {
      g.drops.push({ x: z.x, y: z.y + 10, life: 25, bob: 2, kind: 'emerald' });
    }
    // 血月：怪物身上更容易爆出绿宝石
    if (g.sky === 'blood' && g.rnd() < 0.18) {
      g.drops.push({ x: z.x + g.rndRange(-8, 8), y: z.y + 14, life: 25, bob: 3, kind: 'emerald' });
    }
    if (z.kind === 'ravager') {
      g.drops.push({ x: z.x - 8, y: z.y + 10, life: 25, bob: 2, kind: 'iron' });
      g.drops.push({ x: z.x + 8, y: z.y + 12, life: 25, bob: 3, kind: 'emerald' });
    }
    if (z.affix) {
      g.drops.push({ x: z.x, y: z.y - 12, life: 30, bob: 4, kind: 'emerald' });
      if (g.rnd() < 0.22) {
        g.drops.push({ x: z.x + 12, y: z.y - 16, life: 30, bob: 5, kind: 'enchant' });
      }
      g.numbers.push({
        x: z.x,
        y: z.y - 34,
        vy: -12,
        life: 0.8,
        max: 0.8,
        text: `${ELITES.find((e) => e.id === z.affix)!.name} +1绿宝石`,
        color: '#6ee86e',
      });
    }
  }
}

export function levelUp(g: Game, idx: number) {
  const p = g.player;
  p.weapon = idx;
  const w = WEAPONS[idx];
  let title = w.en;
  let sub = w.name;
  if (g.kills === ROD.unlockKills) {
    title = `${w.en} + 钓竿`;
    sub = '按 4 甩竿 · 钩中敌人拉回并沉默';
  } else if (g.kills === AXE.unlockKills) {
    title = `${w.en} + 斧头`;
    sub = '按 3 挥斧 · E 键旋转飞斧';
  } else if (g.kills === BOW.unlockKills) {
    title = `${w.en} + 弓`;
    sub = '右键射箭 · 按 2 切换';
  } else if (g.kills === TNT.unlockKills) {
    title = `${w.en} + TNT`;
    sub = '按 5 投掷 · 大范围爆炸';
  }
  g.banner = { title, sub, t: 1.7, max: 1.7 };
  g.hitStop = Math.max(g.hitStop, 0.16);
  g.shake = Math.max(g.shake, 5);
  g.audio.levelup();
  g.audio.bowUnlock();
  for (let i = 0; i < 26; i++) {
    const a = g.rnd() * TAU;
    const s = g.rndRange(40, 130);
    g.particles.push({
      x: g.player.x,
      y: g.player.y - 16,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 40,
      life: g.rndRange(0.4, 0.9),
      max: 0.9,
      color: i % 2 === 0 ? PAL.gold : '#fff3a0',
      size: 2,
      grav: 60,
    });
  }
}
