import {
  APPLE,
  ARMOR,
  AXE,
  BLAZE,
  BOW,
  CHARGE,
  MACE,
  COMBAT,
  COMBO,
  CROSSBOW,
  EXECUTE,
  FIREBALL,
  PLAYER,
  POTION_EFFECTS,
  ROD,
  SKILLS,
  STRAY,
  TILE,
  TNT,
  TRIDENT,
  WEAPONS,
  WITCH,
  WITCH_WEAK,
  WITHER,
  WITHER_SKEL,
} from '../config';
import type { Game } from '../game';
import type { PotionState, ZombieState } from '../types';
import { world } from '../world';
import { TAU, normAngle, scaleEnemyDmg } from './util';

export function burst(
  g: Game,
  x: number,
  y: number,
  n: number,
  colors: string[],
  spd: number,
  grav: number,
  size = 2,
) {
  for (let i = 0; i < n; i++) {
    const a = g.rnd() * TAU;
    const s = g.rndRange(spd * 0.3, spd);
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: g.rndRange(0.3, 0.75),
      max: 0.75,
      color: colors[g.rndInt(0, colors.length - 1)],
      size,
      grav,
    });
  }
}

export function damageMul(g: Game) {
  const p = g.player;
  const comboBuff = p.combo >= COMBAT.comboBuffAt ? COMBAT.comboDmgMul : 1;
  return (
    (1 + Math.min(p.combo, COMBO.max) * COMBO.perKill) *
    (p.buffT > 0 ? APPLE.mul : 1) *
    (p.strT > 0 ? POTION_EFFECTS.strMul : 1) *
    (g.hasRelic('power') ? 1.25 : 1) *
    (g.enchants.includes('sharp') ? 1.25 : 1) *
    (p.weakT > 0 ? WITCH_WEAK.dmgMul : 1) *
    (1 + 0.15 * g.growthLvl('atk')) *
    (1 + 0.05 * g.metaLvl('atk')) *
    (g.growthLvl('rage') > 0 && p.hp / p.maxHp <= 0.3 ? 1.35 : 1) *
    (1 + 0.01 * (g.beastStacks ?? 0)) *
    comboBuff
  );
}

export function trySpin(g: Game) {
  const p = g.player;
  if (!g.unlocked(2)) {
    g.lockedHint(2);
    return;
  }
  if (p.axeCd > 0 || p.spinT > 0) return;
  p.spinT = AXE.spinTime;
  p.spinTick = 0;
  p.spinAngle = p.aim;
  g.audio.spin();
  g.numbers.push({
    x: p.x,
    y: p.y - 48,
    vy: -14,
    life: 0.8,
    max: 0.8,
    text: '旋转飞斧!',
    color: '#ffb040',
  });
}

export function updateSpin(g: Game, dt: number) {
  const p = g.player;
  if (p.spinT <= 0) return;
  p.spinT -= dt;
  p.spinAngle += dt * 12;
  p.spinTick -= dt;
  if (p.spinTick <= 0) {
    p.spinTick = 0.12;
    const dmg = Math.max(1, Math.round(AXE.spinDmg * damageMul(g)));
    for (const z of g.zombies) {
      if (z.dead) continue;
      if (Math.hypot(z.x - p.x, z.y - p.y) > AXE.spinRadius + z.r) continue;
      g.damageZombie(z, dmg, Math.atan2(z.y - p.y, z.x - p.x));
    }
    g.audio.axe();
  }
  if (p.spinT <= 0) p.axeCd = AXE.spinCd;
}

export function shoot(g: Game) {
  const p = g.player;
  if (p.bowCd > 0 || !g.unlocked(1)) return;
  g.dmgSrc = 1;
  p.bowCd = (g.hasRelic('archer') ? BOW.cd * 0.8 : BOW.cd) * (g.growthLvl('rapidShot') > 0 ? 0.65 : 1) * g.weaponCdMul(1) * (g.growthLvl('wpnBow') > 0 ? 0.9 : 1);
  const ang = p.aim + g.rndRange(-0.03, 0.03);
  const sx = p.x + Math.cos(ang) * 12;
  const sy = p.y - 16 + Math.sin(ang) * 12;
  const spd = BOW.speed * (g.growthLvl('arrowSpeed') > 0 ? 1.25 : 1);
  const arrowDmg =
    (g.hasRelic('archer') ? BOW.dmg * 1.5 : BOW.dmg) *
    (g.enchants.includes('power') ? 1.3 : 1) *
    (g.job === 'ranger' ? 1.35 : 1);
  const shot = (a: number) => {
    g.arrows.push({
      x: sx,
      y: sy,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life: BOW.life,
      pierce: 1 + (g.growthLvl('pierceShot') > 0 ? 2 : 0) + (g.growthLvl('arrowSpeed') > 0 ? 1 : 0),
      slow: g.growthLvl('frostArrow') > 0,
      burn: g.growthLvl('fireArrow') > 0,
      dmg: arrowDmg,
      fromPlayer: true,
      angle: a,
    });
  };
  shot(ang);
  // 双发：再补一箭偏一点的
  if (g.growthLvl('doubleShot') > 0) shot(ang + 0.1);
  g.audio.bow();
  g.shake = Math.max(g.shake, 1);
  burst(g, sx, sy, 3, ['#e8e0d0', '#c9a26b'], 50, 20, 2);
}

export function swing(g: Game, kind: 'sword' | 'axe', heavy = false) {
  const p = g.player;
  const base =
    kind === 'axe'
      ? {
        dmg: AXE.dmg * (g.growthLvl('wpnAxe') > 0 ? 1.25 : 1),
        cd: AXE.cd,
        range: AXE.range * (g.growthLvl('wpnAxe') > 0 ? 1.15 : 1),
        arc: AXE.arc,
        t: AXE.swingT,
      }
      : { dmg: WEAPONS[p.weapon].dmg, cd: WEAPONS[p.weapon].cd, range: WEAPONS[p.weapon].range, arc: WEAPONS[p.weapon].arc, t: 0.16 };
  const mul = heavy ? CHARGE.mul : 1;
  const range = base.range * (heavy ? CHARGE.rangeMul : 1);
  const arc = base.arc * (heavy ? CHARGE.arcMul : 1);
  const t = heavy ? 0.28 : base.t;
  p.swingKind = kind;
  p.swingCd =
    (heavy ? base.cd * 1.35 : base.cd) *
    (1 - 0.1 * Math.min(3, g.growthLvl('cdr'))) *
    (1 - 0.04 * g.metaLvl('cdr')) *
    (g.growthLvl('berserk') > 0 && p.hp / p.maxHp < 0.4 ? 0.65 : 1);
  p.swingT = t;
  p.swingMax = t;
  p.swingFrom = p.aim - 1.15 * p.facing;
  p.swingTo = p.aim + 1.15 * p.facing;

  g.slashes.push({
    x: p.x,
    y: p.y - 16,
    angle: p.aim,
    arc: (arc * Math.PI) / 180,
    range: range + 6,
    t: 0,
    max: t + 0.02,
    color: heavy ? '#ffd24a' : g.enchants.length > 0 ? '#c06cff' : undefined,
  });
  if (kind === 'axe') g.audio.axe();
  else if (heavy) {
    g.audio.heavy();
    g.shake = Math.max(g.shake, 5);
    g.zoomT = Math.max(g.zoomT, 0.32);
    g.runHeavy++;
  } else g.audio.swing();
  // 挥击有动静：监守者会被你听见
  g.addNoise(heavy ? 3.0 : 1.6);

  const arcHalf = ((arc * Math.PI) / 180) / 2;
  const jobMul = kind === 'sword' && g.job === 'warrior' ? 1.25 : 1;
  const fdmg = Math.max(1, Math.round(base.dmg * mul * damageMul(g) * jobMul));
  const fire = kind === 'sword' && g.enchants.includes('fire');
  const knock = g.enchants.includes('knock');
  let hits = 0;
  for (const z of g.zombies) {
    if (z.dead) continue;
    const dx = z.x - p.x;
    const dy = z.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range + z.r) continue;
    const a = Math.atan2(dy, dx);
    if (Math.abs(normAngle(a - p.aim)) > arcHalf) continue;
    // 背刺：敌人背对玩家（正在逃离/被击退）时伤害提升
    const zsp = Math.hypot(z.vx, z.vy);
    let zdmg = fdmg;
    if (zsp > 24) {
      const dot = (z.vx / zsp) * (-dx / dist) + (z.vy / zsp) * (-dy / dist);
      if (dot < COMBAT.backstabDot) {
        zdmg = Math.round(fdmg * COMBAT.backstabMul);
        g.numbers.push({
          x: z.x,
          y: z.y - 42,
          vy: -22,
          life: 0.7,
          max: 0.7,
          text: '背刺!',
          color: '#b8a8ff',
        });
      }
    }
    g.damageZombie(z, zdmg, a);
    hits++;
    // 命中火花：沿挥击方向溅出，强化"砍中了"的反馈
    for (let i = 0; i < 3; i++) {
      g.particles.push({
        x: z.x - Math.cos(a) * 4,
        y: z.y - 14 - Math.sin(a) * 4,
        vx: Math.cos(a) * 95 + g.rndRange(-40, 40),
        vy: Math.sin(a) * 95 + g.rndRange(-50, 20),
        life: 0.18,
        max: 0.18,
        color: '#fff6d0',
        size: 2,
        grav: 0,
      });
    }
    if (fire && !z.kind.startsWith('boss')) z.burnT = 3;
    if (knock) {
      z.vx += Math.cos(a) * 150;
      z.vy += Math.sin(a) * 150;
    }
  }

  // 末影水晶：可以被近战砍碎
  for (let i = 0; i < g.crystals.length; i++) {
    const c = g.crystals[i];
    if (c.dead) continue;
    const dx = c.x - p.x;
    const dy = c.y - 16 - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range + 14) continue;
    if (Math.abs(normAngle(Math.atan2(dy, dx) - p.aim)) > arcHalf + 0.12) continue;
    g.hitCrystal(i, fdmg);
    hits++;
  }

  // 手感：命中越多，顿帧与震屏越明显（上限 3 帧，避免卡顿）
  if (hits > 0) {
    g.hitStop = Math.max(g.hitStop, Math.min(0.055, 0.018 + hits * 0.012) * (heavy ? 1.7 : 1));
    g.shake = Math.max(g.shake, (heavy ? 4.5 : 2.4) + Math.min(2.4, hits * 0.6));
    if (heavy) g.zoomT = Math.max(g.zoomT, 0.2);
  }

  parryArrows(g, range, arcHalf);

  for (const n of g.nodes) {
    const dxn = n.x - p.x;
    const dyn = n.y - p.y;
    const dn = Math.hypot(dxn, dyn);
    if (dn > range + 12) continue;
    if (Math.abs(normAngle(Math.atan2(dyn, dxn) - p.aim)) > arcHalf + 0.2) continue;
    g.hitNode(n);
  }

  const wtx = Math.floor((p.x + Math.cos(p.aim) * 22) / TILE);
  const wty = Math.floor((p.y - 16 + Math.sin(p.aim) * 22) / TILE);
  if (world.wallHpAt(wtx, wty) > 0) {
    if (world.damageWall(wtx, wty, 1)) {
      p.walls++;
      g.wallDirty = true;
      world.invalidateFlow();
      g.numbers.push({
        x: wtx * TILE + 8,
        y: wty * TILE + 8 - 12,
        vy: -14,
        life: 0.8,
        max: 0.8,
        text: '墙体回收 +1',
        color: '#c9a26b',
      });
      g.audio.axe();
    } else {
      g.audio.mine();
      burst(g, wtx * TILE + 8, wty * TILE + 8, 4, ['#8a6a3a', '#5a4520'], 60, 200, 2);
    }
  }
}

export function parryArrows(g: Game, range: number, arcHalf: number) {
  const p = g.player;
  const px = p.x;
  const py = p.y - 16;
  for (const a of g.arrows) {
    if (a.fromPlayer || a.life <= 0) continue;
    const dx = a.x - px;
    const dy = a.y - py;
    if (Math.hypot(dx, dy) > range + 14) continue;
    const ang = Math.atan2(dy, dx);
    if (Math.abs(normAngle(ang - p.aim)) > arcHalf + 0.18) continue;
    a.life = -1;
    g.audio.parry();
    // 箭矢反弹：30% 概率把这一箭射回去
    if (g.growthLvl('parryReflect') > 0 && g.rnd() < 0.3) {
      const backA = Math.atan2(-a.vy, -a.vx);
      g.arrows.push({
        x: a.x,
        y: a.y,
        vx: Math.cos(backA) * BOW.speed * 1.1,
        vy: Math.sin(backA) * BOW.speed * 1.1,
        life: 1.6,
        dmg: BOW.dmg * damageMul(g),
        fromPlayer: true,
        angle: backA,
        pierce: 1,
      });
      g.numbers.push({ x: a.x, y: a.y - 20, vy: -22, life: 0.8, max: 0.8, text: '反弹!', color: '#ffe066' });
    }
    burst(g, a.x, a.y, 9, ['#ffffff', '#ffe066', '#8fd8ff'], 120, 20, 2);
    g.numbers.push({
      x: a.x,
      y: a.y - 6,
      vy: -26,
      life: 0.8,
      max: 0.8,
      text: '格挡',
      color: '#8fd8ff',
    });
    p.combo++;
    p.comboT = 3;
    g.shake = Math.max(g.shake, 3);
    g.hitStop = Math.max(g.hitStop, 0.03);
  }
}

export function castRod(g: Game) {
  const p = g.player;
  if (!g.unlocked(3)) {
    g.lockedHint(3);
    return;
  }
  if (p.rodCd > 0) return;
  g.dmgSrc = 3;
  p.rodCd = ROD.cd * g.weaponCdMul(3);
  const ang = p.aim;
  g.hooks.push({
    x: p.x + Math.cos(ang) * 10,
    y: p.y - 16 + Math.sin(ang) * 10,
    vx: Math.cos(ang) * ROD.hookSpeed,
    vy: Math.sin(ang) * ROD.hookSpeed,
    state: 'fly',
    targetId: 0,
    t: 0,
  });
  g.audio.cast();
}

export function updateHooks(g: Game, dt: number) {
  const p = g.player;
  const alive: typeof g.hooks = [];
  for (const h of g.hooks) {
    h.t += dt;
    if (h.state === 'fly') {
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      if (world.solidAt(h.x, h.y) || h.t > ROD.range / ROD.hookSpeed + 0.4) {
        h.state = 'return';
      } else {
        for (const z of g.zombies) {
          if (z.dead) continue;
          if (Math.hypot(z.x - h.x, z.y - 14 - h.y) < z.r + 4) {
            h.state = 'pull';
            h.targetId = z.id;
            h.t = 0;
            // 钩住即眩晕：整个拉拽过程 + 之后一段时间它都不能出手，
            // 否则拉到位的那一帧就会被贴脸反打（原来就是这个 bug）
            if (!z.kind.startsWith('boss') && z.kind !== 'wither') {
              const rodMul = g.growthLvl('wpnRod') > 0 ? 1.4 : 1;
  z.stunT = Math.max(z.stunT, ROD.pullTime + ROD.stun * rodMul);
            }
            g.audio.hookHit();
            g.audio.pull();
            break;
          }
        }
      }
      alive.push(h);
    } else if (h.state === 'pull') {
      const z = g.zombies.find((o) => o.id === h.targetId);
      if (!z || z.dead) {
        h.state = 'return';
        continue;
      }
      h.x = z.x;
      h.y = z.y - 14;
      const k = Math.min(1, dt * 7);
      const ox = z.x;
      const oy = z.y;
      z.x += (p.x - z.x) * k;
      z.y += (p.y - z.y) * k;
      if (world.circleBlocked(z.x, z.y, Math.max(3, z.r * 0.7))) {
        z.x = ox;
        z.y = oy;
      }
      if (h.t >= ROD.pullTime) {
        if (Math.hypot(p.x - z.x, p.y - z.y) < 46) {
          z.silenced = ROD.silence;
          // 拉到位后眩晕：给玩家一个稳定的收割窗口，而不是拉到脸上就被反打
          if (!z.kind.startsWith('boss') && z.kind !== 'wither') z.stunT = ROD.stun * (g.growthLvl('wpnRod') > 0 ? 1.4 : 1);
          g.damageZombie(z, Math.max(1, Math.round(ROD.dmg * damageMul(g))), Math.atan2(z.y - p.y, z.x - p.x));
          burst(g, z.x, z.y - 18, 10, ['#ffe066', '#ffd24a', '#fff6d0'], 90, -20, 2);
          g.shake = Math.max(g.shake, 3);
          g.hitStop = Math.max(g.hitStop, 0.04);
          g.numbers.push({
            x: z.x,
            y: z.y - 42,
            vy: -16,
            life: 0.9,
            max: 0.9,
            text: z.stunT > 0 ? '钩中 · 眩晕!' : '沉默!',
            color: '#ffe066',
          });
        }
        h.state = 'return';
      }
      alive.push(h);
    } else {
      const dx = p.x - h.x;
      const dy = p.y - 16 - h.y;
      const d = Math.hypot(dx, dy);
      if (d < 14) {
        if (p.rodCd > 1.2) p.rodCd = 1.2;
        continue;
      }
      h.x += (dx / d) * 700 * dt;
      h.y += (dy / d) * 700 * dt;
      alive.push(h);
    }
  }
  g.hooks = alive;
}

export function throwTnt(g: Game) {
  const p = g.player;
  if (!g.unlocked(4)) {
    g.lockedHint(4);
    return;
  }
  if (p.tntCd > 0) return;
  if (p.tntAmmo <= 0) {
    g.numbers.push({
      x: p.x,
      y: p.y - 44,
      vy: -18,
      life: 0.8,
      max: 0.8,
      text: '没有 TNT 了!',
      color: '#ff8a30',
    });
    return;
  }
  p.tntAmmo--;
  g.dmgSrc = 4;
  p.tntCd = TNT.cd * g.weaponCdMul(4);
  const ang = p.aim;
  g.tnts.push({
    x: p.x + Math.cos(ang) * 12,
    y: p.y - 16 + Math.sin(ang) * 12,
    vx: Math.cos(ang) * TNT.throwSpeed,
    vy: Math.sin(ang) * TNT.throwSpeed,
    fuse: TNT.fuse,
  });
  // 爆破赠礼：投出后脚下额外留一个红石陷阱
  if (g.growthLvl('wpnBlastGift') > 0) {
    const tx2 = Math.floor(p.x / TILE);
    const ty2 = Math.floor(p.y / TILE);
    g.traps.push({ x: tx2 * TILE + TILE / 2, y: ty2 * TILE + TILE / 2, t: 0, max: 22, armed: true });
    g.audio.click();
    g.numbers.push({ x: p.x, y: p.y - 52, vy: -16, life: 0.9, max: 0.9, text: '留下陷阱!', color: '#ff6a6a' });
  }
  g.audio.tntThrow();
}

export function updateTnts(g: Game, dt: number) {
  for (const t of g.tnts) {
    if (t.fuse > 0.35 && t.fuse - dt <= 0.35) g.audio.hiss();
    t.fuse -= dt;
    if (t.fuse <= 0) {
      g.dmgSrc = 4;
      explodeAt(g, t.x, t.y, TNT.radius * (1 + 0.25 * g.growthLvl('blastMaster')) * (g.growthLvl('wpnBlast') > 0 ? 1.15 : 1), TNT.dmg * (1 + 0.25 * g.growthLvl('blastMaster')) * g.weaponMul(4) * (g.growthLvl('wpnBlast') > 0 ? 1.25 : 1), TNT.playerDmg);
      continue;
    }
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.vx *= 0.985;
    t.vy *= 0.985;
    if (world.circleBlocked(t.x, t.y, 4)) {
      t.x -= t.vx * dt;
      t.y -= t.vy * dt;
      t.vx *= -0.55;
      t.vy *= -0.55;
    }
    for (const z of g.zombies) {
      if (z.dead) continue;
      if (Math.hypot(z.x - t.x, z.y - 14 - t.y) < z.r + 7) {
        g.dmgSrc = 4;
      explodeAt(g, t.x, t.y, TNT.radius * (1 + 0.25 * g.growthLvl('blastMaster')) * (g.growthLvl('wpnBlast') > 0 ? 1.15 : 1), TNT.dmg * (1 + 0.25 * g.growthLvl('blastMaster')) * g.weaponMul(4) * (g.growthLvl('wpnBlast') > 0 ? 1.25 : 1), TNT.playerDmg);
        t.fuse = 0;
        break;
      }
    }
  }
  g.tnts = g.tnts.filter((t) => t.fuse > 0);
}

export function throwFireball(g: Game) {
  const p = g.player;
  if (p.fireCd > 0 || p.fireballs <= 0 || !g.unlocked(5)) return;
  p.fireballs--;
  g.dmgSrc = 5;
  p.fireCd = FIREBALL.cd * g.weaponCdMul(5);
  const ang = p.aim;
  g.fireballs.push({
    x: p.x + Math.cos(ang) * 12,
    y: p.y - 16 + Math.sin(ang) * 12,
    vx: Math.cos(ang) * FIREBALL.speed,
    vy: Math.sin(ang) * FIREBALL.speed,
    life: FIREBALL.life,
    dmg: FIREBALL.dmg,
    fromPlayer: true,
    skull: false,
    r: 4,
  });
  g.audio.fireball();
  burst(g, p.x + Math.cos(ang) * 12, p.y - 16 + Math.sin(ang) * 12, 4, ['#ff8a30', '#ffd76b'], 60, -20, 2);
}

export function updateFireballs(g: Game, dt: number) {
  const p = g.player;
  for (const f of g.fireballs) {
    f.life -= dt;
    const mx = f.vx * dt;
    const my = f.vy * dt;
    if (!f.skull && world.circleBlocked(f.x + mx, f.y + my, 2)) {
      f.life = -1;
      burst(g, f.x, f.y, 6, ['#ff8a30', '#ffd76b'], 80, 160, 2);
      continue;
    }
    if (g.rnd() < 0.85) {
      g.particles.push({
        x: f.x + g.rndRange(-2, 2),
        y: f.y + g.rndRange(-2, 2),
        vx: g.rndRange(-14, 14),
        vy: g.rndRange(-14, 14),
        life: 0.32,
        max: 0.32,
        color: f.skull ? '#2a2a34' : '#ff8a30',
        size: 2,
        grav: 0,
      });
    }
    f.x += mx;
    f.y += my;
    if (f.fromPlayer) {
      for (const z of g.zombies) {
        if (z.dead) continue;
        if (Math.hypot(z.x - f.x, z.y - f.y) < z.r + f.r + 2) {
          f.life = -1;
          explodeAt(g, f.x, f.y, FIREBALL.radius, FIREBALL.dmg, FIREBALL.playerDmg);
          break;
        }
      }
    } else if (Math.hypot(p.x - f.x, p.y - 14 - f.y) < PLAYER.radius + f.r + 3) {
      f.life = -1;
      if (f.skull) {
        g.explosions.push({ x: f.x, y: f.y, r: WITHER.explodeRadius, t: 0, max: 0.32 });
        burst(g, f.x, f.y, 10, ['#2a2a34', '#1a1a22'], 110, 180, 2);
        if (p.invuln <= 0 && p.dashT <= 0) {
          hurtPlayer(g, scaleEnemyDmg(g, WITHER.skullDmg));
          p.witherT = Math.max(p.witherT, WITHER.witherTime);
        }
      } else {
        burst(g, f.x, f.y, 8, ['#ff8a30', '#ffd76b'], 90, 140, 2);
        if (p.invuln <= 0 && p.dashT <= 0) hurtPlayer(g, scaleEnemyDmg(g, BLAZE.fireballDmg));
      }
    }
  }
  g.fireballs = g.fireballs.filter((f) => f.life > 0);
}

export function explodeAt(g: Game, x: number, y: number, radius: number, dmg: number, playerDmg: number) {
  g.explosions.push({ x, y, r: radius, t: 0, max: 0.55 });
  g.scorches.push({ x, y, r: radius * 0.7, t: 0, max: 12 });
  g.blastCrystals(x, y, radius);
  g.flash = Math.max(g.flash, 0.85);
  g.shake = Math.max(g.shake, 13);
  g.hitStop = Math.max(g.hitStop, 0.11);
  g.audio.boom();
  for (let i = 0; i < 34; i++) {
    const a = g.rnd() * TAU;
    const s = g.rndRange(30, 260);
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 30,
      life: g.rndRange(0.3, 0.8),
      max: 0.8,
      color: ['#ffd76b', '#ff8a30', '#ff5030', '#ffdf80'][i % 4],
      size: g.rndInt(2, 3),
      grav: -60,
    });
  }
  for (let i = 0; i < 14; i++) {
    const a = g.rnd() * TAU;
    const s = g.rndRange(60, 220);
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 60,
      life: g.rndRange(0.4, 0.9),
      max: 0.9,
      color: i % 2 === 0 ? '#5a5a60' : '#3a3a40',
      size: 2,
      grav: 340,
    });
  }
  for (let i = 0; i < 10; i++) {
    const a = g.rnd() * TAU;
    const s = g.rndRange(10, 60);
    g.particles.push({
      x: x + g.rndRange(-8, 8),
      y: y + g.rndRange(-8, 8),
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 20,
      life: g.rndRange(0.6, 1.2),
      max: 1.2,
      color: 'rgba(60,58,64,0.8)',
      size: 3,
      grav: -25,
    });
  }

  const p = g.player;
  if (Math.hypot(p.x - x, p.y - y) < radius * 0.75 && p.invuln <= 0 && p.dashT <= 0) {
    hurtPlayer(g, scaleEnemyDmg(g, playerDmg) * (g.growthLvl('blastResist') > 0 ? 0.3 : 1));
  }
  for (const z of g.zombies) {
    if (z.dead) continue;
    const d = Math.hypot(z.x - x, z.y - y) - z.r * 0.5;
    if (d < radius) {
      const k = 1 - d / radius;
      const falloff = Math.max(1, Math.round(dmg * (1 - k * 0.6)));
      const ang = Math.atan2(z.y - y, z.x - x) + g.rndRange(-0.2, 0.2);
      g.damageZombie(z, falloff, ang);
      z.vx += Math.cos(ang) * 260 * k;
      z.vy += Math.sin(ang) * 260 * k;
    }
  }
  for (const a of g.arrows) {
    if (!a.fromPlayer && Math.hypot(a.x - x, a.y - y) < radius) a.life = -1;
  }
  g.destroyWallsNear(x, y, radius);
}

export function updateArrows(g: Game, dt: number) {
  const p = g.player;
  for (const a of g.arrows) {
    if (a.life <= 0) continue;
    a.life -= dt;
    // 回旋三叉戟：飞到头会掉头飞回来，返程照打
    if (a.boomerang && !a.returned && a.life <= 0.45) {
      a.returned = true;
      a.vx *= -1;
      a.vy *= -1;
      a.life = 0.95;
      a.pierce = 2;
      burst(g, a.x, a.y, 6, ['#4ae0d0', '#ffffff'], 80, 0, 2);
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (world.solidAt(a.x, a.y)) {
      // 回旋投掷物撞墙：掉头飞回，不要消失
      if (a.boomerang) {
        a.returned = true;
        a.vx *= -1;
        a.vy *= -1;
        a.x += a.vx * dt * 3;
        a.y += a.vy * dt * 3;
        a.life = Math.max(a.life, 0.9);
        a.pierce = 4;
        burst(g, a.x, a.y, 6, ['#4ae0d0', '#ffffff'], 80, 0, 2);
        continue;
      }
      a.life = -1;
      burst(g, a.x, a.y, 4, ['#9a9a90', '#6a6a60'], 40, 100, 1);
      continue;
    }
    if (a.fromPlayer) {
      for (const z of g.zombies) {
        if (z.dead) continue;
        if (Math.hypot(z.x - a.x, z.y - 14 - a.y) < z.r + 4) {
          // 末影人：远程打不中，被箭瞄到就当场瞬移走
          if (z.kind === 'enderman') {
            g.teleportEnderman(z);
            a.life = -1;
            g.numbers.push({ x: z.x, y: z.y - 44, vy: -14, life: 0.8, max: 0.8, text: '闪避!', color: '#d06cff' });
            break;
          }
          g.damageZombie(z, Math.max(1, Math.round(a.dmg * damageMul(g))), Math.atan2(a.vy, a.vx));
          if (a.burn) z.burnT = Math.max(z.burnT, 3);
          // 贯穿箭：还能再穿 2 个，每次穿透伤害递减
          if ((a.pierce ?? 0) > 0) {
            a.pierce = (a.pierce ?? 0) - 1;
            a.dmg *= 0.85;
            break;
          }
          a.life = -1;
          break;
        }
      }
    } else if (Math.hypot(p.x - a.x, p.y - 14 - a.y) < 12) {
      if (a.slow) {
        p.slowT = Math.max(p.slowT, STRAY.slowT);
        g.numbers.push({ x: p.x, y: p.y - 50, vy: -16, life: 0.8, max: 0.8, text: '冰缓!', color: '#9fd8ff' });
      }
      if (p.invuln <= 0 && p.dashT <= 0) {
        hurtPlayer(g, scaleEnemyDmg(g, a.dmg) * (g.growthLvl('shieldParry') > 0 ? 0.7 : 1));
        if (a.wither) {
          p.witherT = Math.max(p.witherT, WITHER_SKEL.witherTime);
          g.numbers.push({ x: p.x, y: p.y - 50, vy: -16, life: 1, max: 1, text: '凋零!', color: '#3a3a44' });
        }
      }
      a.life = -1;
      burst(g, a.x, a.y, 5, ['#f0f0e0', '#c0c0b0'], 60, 120, 2);
    }
  }
  g.arrows = g.arrows.filter((a) => a.life > 0);
}

/** 重锤挥击：慢、范围大、击退强 */
export function swingMace(g: Game) {
  const p = g.player;
  const def = MACE;
  g.dmgSrc = 8;
  p.swingCd = def.cd * (1 - 0.1 * Math.min(3, g.growthLvl('cdr'))) * (1 - 0.04 * g.metaLvl('cdr')) * g.weaponCdMul(8);
  p.swingT = 0.22;
  p.swingKind = 'axe';
  const range = def.range * (g.job === 'warrior' ? 1.1 : 1);
  const arc = (def.arc * Math.PI) / 180;
  const base = def.dmg * damageMul(g) * (g.job === 'warrior' ? 1.25 : 1) * g.weaponMul(8) * (g.growthLvl('wpnMace') > 0 ? 1.25 : 1);
  let hits = 0;
  for (const z of g.zombies) {
    if (z.dead) continue;
    const d = Math.hypot(z.x - p.x, z.y - p.y);
    if (d > range + z.r) continue;
    const a = Math.atan2(z.y - p.y, z.x - p.x);
    if (Math.abs(normAngle(a - p.aim)) > arc / 2) continue;
    g.damageZombie(z, Math.max(1, Math.round(base)), a);
    const ang = Math.atan2(z.y - p.y, z.x - p.x);
    const knockMul = g.growthLvl('wpnMace') > 0 ? 1.4 : 1;
    z.vx += Math.cos(ang) * def.knock * knockMul;
    z.vy += Math.sin(ang) * def.knock * knockMul;
    hits++;
  }
  if (hits > 0) {
    g.hitStop = Math.max(g.hitStop, 0.07);
    g.shake = Math.max(g.shake, 5);
    g.audio.hit();
  } else {
    g.audio.swing();
  }
  g.slashes.push({ x: p.x, y: p.y - 16, angle: p.aim, arc: arc, range, t: 0, max: 0.22, color: '#d8d8d0' });
  burst(g, p.x + Math.cos(p.aim) * 26, p.y - 16 + Math.sin(p.aim) * 26, 8, ['#c9c9c0', '#8a8a84'], 90, 40, 2);
}
/** 三叉戟：投掷穿透 */
export function throwTrident(g: Game) {
  const p = g.player;
  if (!g.unlocked(6)) {
    g.lockedHint(6);
    return;
  }
  if (p.bowCd > 0) return;
  g.dmgSrc = 6;
  p.bowCd = TRIDENT.cd * g.weaponCdMul(6);
  const ang = p.aim;
  g.arrows.push({
    x: p.x + Math.cos(ang) * 12,
    y: p.y - 16 + Math.sin(ang) * 12,
    vx: Math.cos(ang) * TRIDENT.speed,
    vy: Math.sin(ang) * TRIDENT.speed,
    life: 1.6,
    dmg: TRIDENT.dmg * damageMul(g) * g.weaponMul(6) * (g.growthLvl('wpnTrident') > 0 ? 1.3 : 1),
    fromPlayer: true,
    angle: ang,
    trident: true,
    pierce: TRIDENT.pierce + (g.growthLvl('wpnTrident') > 0 ? 1 : 0),
    boomerang: g.growthLvl('wpnReturn') > 0,
  });
  g.audio.bow();
  g.shake = Math.max(g.shake, 2);
  burst(g, p.x + Math.cos(ang) * 14, p.y - 16 + Math.sin(ang) * 14, 4, ['#4ae0d0', '#ffffff'], 70, 20, 2);
}

/** 弩：三连发 */
export function fireCrossbow(g: Game) {
  const p = g.player;
  if (!g.unlocked(7)) {
    g.lockedHint(7);
    return;
  }
  if (p.bowCd > 0) return;
  g.dmgSrc = 7;
  p.bowCd = CROSSBOW.cd * g.weaponCdMul(7);
  const bolts = CROSSBOW.bolts + (g.growthLvl('wpnCross') > 0 ? 1 : 0);
  for (let i = 0; i < bolts; i++) {
    const ang = p.aim + (i - (CROSSBOW.bolts - 1) / 2) * CROSSBOW.spread;
    g.arrows.push({
      x: p.x + Math.cos(ang) * 10,
      y: p.y - 16 + Math.sin(ang) * 10,
      vx: Math.cos(ang) * CROSSBOW.speed,
      vy: Math.sin(ang) * CROSSBOW.speed,
      life: 1.4,
      pierce: 3,
      dmg: CROSSBOW.dmg * damageMul(g) * g.weaponMul(7) * (g.growthLvl('wpnCross') > 0 ? 1.25 : 1),
      fromPlayer: true,
      angle: ang,
    });
  }
  g.audio.bow();
  g.shake = Math.max(g.shake, 2);
}

/** 武器技能：每个槽位一个（R 键） */
export function useSkill(g: Game) {
  const p = g.player;
  if (p.skillCd > 0) return;
  const def = SKILLS[p.slot];
  if (!def) return;
  // 技能只属于当前这把武器：空手（还没拿到剑）不能放剑气，未解锁的槽位也不行
  if (p.slot === 0 && p.weapon < 1) {
    g.numbers.push({ x: p.x, y: p.y - 44, vy: -16, life: 0.8, max: 0.8, text: '先拿到剑才能放剑气', color: '#9aa0a6' });
    return;
  }
  if (p.slot > 0 && !g.unlocked(p.slot)) {
    g.lockedHint(p.slot);
    return;
  }
  p.skillCd = def.cd;
  g.audio.bossPhase();
  g.shake = Math.max(g.shake, 5);
  g.numbers.push({ x: p.x, y: p.y - 56, vy: -18, life: 1, max: 1, text: def.name, color: '#ffd76b', big: true });

  switch (p.slot) {
    case 0: {
      // 剑气斩：一条穿透的飞行剑气（每个目标只吃一次，避免重叠段数叠伤）
      const hit = new Set<number>();
      const slashDmg = Math.max(2, Math.round(9 * damageMul(g)));
      for (let i = 0; i < 12; i++) {
        const a = p.aim;
        const d = 24 + i * 10;
        const x = p.x + Math.cos(a) * d;
        const y = p.y + Math.sin(a) * d;
        for (const z of g.zombies) {
          if (z.dead || hit.has(z.id)) continue;
          if (Math.hypot(z.x - x, z.y - 14 - y) < 24) {
            hit.add(z.id);
            g.damageZombie(z, slashDmg, a);
          }
        }
      }
      g.slashes.push({ x: p.x, y: p.y - 16, angle: p.aim, arc: 0.5, range: 150, t: 0, max: 0.35, color: '#9fe8ff' });
      break;
    }
    case 1: {
      // 箭雨：扇形 5 箭
      for (let i = 0; i < 5; i++) {
        const ang = p.aim + (i - 2) * 0.16;
        g.arrows.push({
          x: p.x + Math.cos(ang) * 12,
          y: p.y - 16 + Math.sin(ang) * 12,
          vx: Math.cos(ang) * BOW.speed,
          vy: Math.sin(ang) * BOW.speed,
          life: BOW.life,
          dmg: BOW.dmg * damageMul(g),
          fromPlayer: true,
          angle: ang,
        });
      }
      g.audio.bow();
      break;
    }
    case 2: {
      // 震地斩：范围爆发 + 击退
      for (const z of g.zombies) {
        if (z.dead) continue;
        if (Math.hypot(z.x - p.x, z.y - p.y) < 110) {
          const a = Math.atan2(z.y - p.y, z.x - p.x);
          g.damageZombie(z, Math.max(3, Math.round(16 * damageMul(g))), a);
          z.vx += Math.cos(a) * 220;
          z.vy += Math.sin(a) * 220;
        }
      }
      g.explosions.push({ x: p.x, y: p.y, r: 110, t: 0, max: 0.4 });
      g.shake = Math.max(g.shake, 10);
      g.audio.quake();
      break;
    }
    case 3: {
      // 强钩：把周围敌人全部定身
      for (const z of g.zombies) {
        if (z.dead || z.kind.startsWith('boss')) continue;
        if (Math.hypot(z.x - p.x, z.y - p.y) < 190) {
          z.stunT = Math.max(z.stunT, 2.2);
          burst(g, z.x, z.y - 12, 6, ['#ffe066', '#ffd24a'], 70, -20, 2);
        }
      }
      g.audio.pull();
      break;
    }
    case 4: {
      // 三连爆破
      for (let i = 0; i < 3; i++) {
        const ang = p.aim + (i - 1) * 0.22;
        g.tnts.push({
          x: p.x + Math.cos(ang) * 12,
          y: p.y - 16 + Math.sin(ang) * 12,
          vx: Math.cos(ang) * TNT.throwSpeed,
          vy: Math.sin(ang) * TNT.throwSpeed,
          fuse: TNT.fuse,
        });
      }
      g.audio.tntThrow();
      break;
    }
    case 5: {
      // 火墙
      for (let i = 0; i < 5; i++) {
        const ang = p.aim + (i - 2) * 0.14;
        g.fireballs.push({
          x: p.x + Math.cos(ang) * 14,
          y: p.y - 16 + Math.sin(ang) * 14,
          vx: Math.cos(ang) * FIREBALL.speed,
          vy: Math.sin(ang) * FIREBALL.speed,
          life: FIREBALL.life,
          dmg: FIREBALL.dmg * g.weaponMul(5) * (g.growthLvl('wpnFire') > 0 ? 1.3 : 1) * (g.job === 'alchemist' ? 1.25 : 1),
          fromPlayer: true,
          skull: false,
          r: 5,
        });
      }
      g.audio.blaze();
      break;
    }
    case 6: {
      // 落雷：在瞄准点召唤 3 道
      const tx = p.x + Math.cos(p.aim) * 150;
      const ty = p.y + Math.sin(p.aim) * 150;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        g.lightning.push({ x: tx + Math.cos(a) * 36, y: ty + Math.sin(a) * 36, t: 0.55, max: 0.55, struck: false });
      }
      g.audio.thunder();
      break;
    }
    default: {
      // 穿透齐射
      for (let i = 0; i < 5; i++) {
        const ang = p.aim + (i - 2) * 0.1;
        g.arrows.push({
          x: p.x + Math.cos(ang) * 10,
          y: p.y - 16 + Math.sin(ang) * 10,
          vx: Math.cos(ang) * CROSSBOW.speed,
          vy: Math.sin(ang) * CROSSBOW.speed,
          life: 1.5,
          dmg: CROSSBOW.dmg * damageMul(g),
          fromPlayer: true,
          angle: ang,
          pierce: 3,
        });
      }
      g.audio.crossbow();
      break;
    }
  }
}

export function swarmArrows(g: Game, ang: number, n: number) {
  const p = g.player;
  for (let i = 0; i < n; i++) {
    const a = ang + (i - (n - 1) / 2) * 0.12;
    g.arrows.push({
      x: p.x + Math.cos(a) * 12,
      y: p.y - 16 + Math.sin(a) * 12,
      vx: Math.cos(a) * BOW.speed,
      vy: Math.sin(a) * BOW.speed,
      life: BOW.life,
      dmg: BOW.dmg * damageMul(g),
      fromPlayer: true,
      angle: a,
    });
  }
}

export function updatePotions(g: Game, dt: number) {
  for (const o of g.potions) {
    o.life -= dt;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    if (o.life <= 0 || world.solidAt(o.x, o.y)) splashPotion(g, o);
  }
  g.potions = g.potions.filter((o) => o.life > 0);
}

export function splashPotion(g: Game, o: PotionState) {
  o.life = -1;
  burst(g, o.x, o.y, 14, ['#8a3ac0', '#c98af0', '#5a2a6e'], 90, 140, 2);
  g.audio.splash();
  const p = g.player;
  if (Math.hypot(p.x - o.x, p.y - o.y) < WITCH.splashR) {
    hurtPlayer(g, scaleEnemyDmg(g, WITCH.dmg));
    p.slowT = WITCH.slowT;
    // 一半概率是虚弱药水：输出打折，逼玩家先解决女巫
    const weak = g.rnd() < WITCH_WEAK.chance;
    if (weak) p.weakT = WITCH_WEAK.weakT;
    g.numbers.push({
      x: p.x,
      y: p.y - 46,
      vy: -16,
      life: 1,
      max: 1,
      text: weak ? '虚弱! 输出-28%' : '中毒减速!',
      color: weak ? '#ff8a8a' : '#c98af0',
    });
    if (weak) burst(g, p.x, p.y - 16, 10, ['#ff8a8a', '#8a3ac0'], 80, -20, 2);
  }
}

export function hurtPlayer(g: Game, dmg: number) {
  const p = g.player;
  if (p.invuln > 0 || p.dashT > 0) return;
  // 护甲耐久：每挨一次伤害扣 1 点，归零就碎
  if (p.armor > 0 && p.armorDur > 0) {
    p.armorDur -= 1;
    if (p.armorDur <= 0) {
      p.armorDur = 0;
      p.armorMax = 0;
      const broken = ARMOR.tiers[p.armor - 1];
      p.armor = 0;
      g.banner = { title: `${broken ? broken.name : '护甲'}破碎!`, sub: '重新合成或找商人修复', t: 1.6, max: 1.6 };
      g.audio.craft();
      burst(g, p.x, p.y - 16, 16, ['#c9c9c0', '#8a8a84'], 120, 60, 3);
    }
  }
  // 背水：低血量时受伤更重
  const berserkPen = g.growthLvl('berserk') > 0 && p.hp / p.maxHp < 0.4 ? 1.15 : 1;
  const real = Math.max(1, Math.round(dmg * (1 - g.armorRed()) * berserkPen));
  // 荆棘：受击反弹
  if (g.growthLvl('thorns') > 0) {
    for (const z of g.zombies) {
      if (z.dead) continue;
      if (Math.hypot(z.x - p.x, z.y - p.y) < 46) g.damageZombie(z, 3, Math.atan2(z.y - p.y, z.x - p.x));
    }
    burst(g, p.x, p.y - 14, 8, ['#8ef0b0', '#ffffff'], 90, 20, 2);
  }
  p.hp = Math.max(0, p.hp - real);
  p.invuln = PLAYER.invuln;
  p.hurtT = 0.32;
  p.combo = 0;
  p.comboT = 0;
  g.flash = Math.max(g.flash, 0.55);
  g.shake = Math.max(g.shake, 6);
  g.audio.hurt();
  burst(g, p.x, p.y - 16, 8, ['#c02020', '#8a1414'], 90, 260, 2);
  g.numbers.push({
    x: p.x,
    y: p.y - 42,
    vy: -22,
    life: 0.8,
    max: 0.8,
    text: `-${real}`,
    color: '#ff5252',
    big: real >= 5,
  });
  if (g.hasRelic('thorn')) {
    for (const z of g.zombies) {
      if (z.dead) continue;
      if (Math.hypot(z.x - p.x, z.y - p.y) < 60) {
        g.damageZombie(z, 2, Math.atan2(z.y - p.y, z.x - p.x));
      }
    }
  }
  if (p.hp <= 0) g.gameOver();
}

/** 处决：低血量敌人靠近按 X */
export function tryExecute(g: Game) {
  const p = g.player;
  let target: ZombieState | null = null;
  let bd = EXECUTE.range;
  for (const z of g.zombies) {
    if (z.dead || z.kind.startsWith('boss')) continue;
    if (z.hp / z.maxHp > EXECUTE.hpFrac) continue;
    const d = Math.hypot(z.x - p.x, z.y - p.y);
    if (d < bd) {
      bd = d;
      target = z;
    }
  }
  if (!target) {
    g.numbers.push({ x: p.x, y: p.y - 44, vy: -18, life: 0.7, max: 0.7, text: '附近没有可处决的敌人', color: '#9aa0a6' });
    return;
  }
  const z = target;
  p.x += (z.x - p.x) * 0.45;
  p.y += (z.y - p.y) * 0.45;
  g.damageZombie(z, z.hp, Math.atan2(z.y - p.y, z.x - p.x));
  g.runExecuted++;
  g.slowmo = EXECUTE.slowmo;
  g.zoomT = Math.max(g.zoomT, 0.3);
  g.hitStop = Math.max(g.hitStop, 0.1);
  g.shake = Math.max(g.shake, 6);
  p.hp = Math.min(p.maxHp, p.hp + EXECUTE.heal + (g.growthLvl('execHeal') > 0 ? 2 : 0));
  p.stone += EXECUTE.stone;
  g.audio.execute();
  burst(g, z.x, z.y - 12, 22, ['#ff2a4a', '#ffffff'], 190, 240, 3);
  // 处决爆裂：处决时顺带炸到周围
  if (g.growthLvl('executeBlast') > 0) {
    for (const o of g.zombies) {
      if (o.dead || o === z) continue;
      if (Math.hypot(o.x - z.x, o.y - z.y) < 76) {
        g.damageZombie(o, Math.max(2, Math.round(z.maxHp * 0.5)), Math.atan2(o.y - z.y, o.x - z.x));
      }
    }
    g.explosions.push({ x: z.x, y: z.y, r: 76, t: 0, max: 0.4 });
    g.shake = Math.max(g.shake, 8);
  }
  g.numbers.push({
    x: z.x,
    y: z.y - 40,
    vy: -20,
    life: 1.2,
    max: 1.2,
    text: `处决! +${EXECUTE.stone}石头`,
    color: '#ff5a6a',
    big: true,
  });
}
