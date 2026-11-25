import { DOMAIN, TILE } from '../config';
import type { Game } from '../game';
import { world } from '../world';
import { burst } from './combat';

/** 开一块 BOSS 战场：不砌墙，只用边界约束玩家和 BOSS，杂兵可以自由涌入 */
export function enterDomain(g: Game, kind: 'dragon' | 'warden', px: number, py: number) {
  exitDomain(g);
  const cx = Math.floor(px / TILE);
  const cy = Math.floor(py / TILE);
  g.domain = {
    kind,
    cx,
    cy,
    halfW: DOMAIN.halfW,
    halfH: DOMAIN.halfH,
    walls: [],
    t: 0,
  };
  g.crystals = [];
  g.shriekers = [];
  g.noise = 0;

  if (kind === 'dragon') {
    const ox = DOMAIN.crystalOffset;
    for (const [dx, dy] of [
      [-ox, -ox + 3],
      [ox, -ox + 3],
      [-ox, ox - 3],
      [ox, ox - 3],
    ]) {
      const tx = cx + dx;
      const ty = cy + dy;
      if (tx < 1 || ty < 1 || tx >= world.tcols - 1 || ty >= world.trows - 1) continue;
      g.crystals.push({
        x: tx * TILE + TILE / 2,
        y: ty * TILE + TILE / 2,
        hp: DOMAIN.crystalHp,
        maxHp: DOMAIN.crystalHp,
        flash: 0,
        dead: false,
      });
    }
  } else {
    for (const [dx, dy] of [
      [-6, -4],
      [6, 4],
      [6, -4],
      [-6, 4],
    ]) {
      const tx = cx + dx;
      const ty = cy + dy;
      g.shriekers.push({
        x: tx * TILE + TILE / 2,
        y: ty * TILE + TILE / 2,
        cd: DOMAIN.shriekCd,
        pulse: 0,
        anim: 0,
      });
    }
  }

  g.audio.bossSpawn();
  g.shake = Math.max(g.shake, 8);
  g.banner = {
    title: kind === 'dragon' ? '末地 · 领域展开' : '深暗 · 领域展开',
    sub:
      kind === 'dragon'
        ? '打破四颗末影水晶才能让龙露出破绽 · 杂兵会从外面涌进来'
        : '尖啸体会暴露你的位置 · 站住别动，杂兵会从外面涌进来',
    t: 1.8,
    max: 1.8,
  };
}

export function exitDomain(g: Game) {
  const d = g.domain;
  if (!d) return;
  for (const ti of d.walls) {
    world.walls.delete(ti);
    world.domainWalls.delete(ti);
  }
  g.domain = null;
  g.crystals = [];
  g.shriekers = [];
}

/** 玩家 / BOSS 被限制在领域内；普通小怪不受限（可以冲进来） */
export function clampToDomain(g: Game, x: number, y: number, pad = 6) {
  const d = g.domain;
  if (!d) return { x, y };
  const x0 = (d.cx - d.halfW) * TILE + pad;
  const x1 = (d.cx + d.halfW + 1) * TILE - pad;
  const y0 = (d.cy - d.halfH) * TILE + pad;
  const y1 = (d.cy + d.halfH + 1) * TILE - pad;
  return { x: Math.min(x1, Math.max(x0, x)), y: Math.min(y1, Math.max(y0, y)) };
}

export function insideDomain(g: Game, x: number, y: number) {
  const d = g.domain;
  if (!d) return true;
  const tx = x / TILE;
  const ty = y / TILE;
  return Math.abs(tx - d.cx) <= d.halfW && Math.abs(ty - d.cy) <= d.halfH;
}

/** BOSS 掉到某个血量节点时换位：监守者遁地、末影龙飞走 */
export function maybeReposition(g: Game, z: { kind: string; hp: number; maxHp: number; x: number; y: number; phase: number; stunT: number; diveT: number; crouch: number; roarT: number; breathT: number }) {
  const d = g.domain;
  if (!d) return false;
  const frac = z.hp / z.maxHp;
  const node = z.phase === 0 && frac <= DOMAIN.repositionAt[0] ? 0 : z.phase === 1 && frac <= DOMAIN.repositionAt[1] ? 1 : -1;
  if (node < 0) return false;
  z.phase = node + 1;
  // 清掉所有正在进行的动作
  z.diveT = 0;
  z.crouch = 0;
  z.roarT = 0;
  z.breathT = 0;
  z.stunT = Math.max(z.stunT, DOMAIN.repositionInvuln);
  const cx = (d.cx + 0.5) * TILE;
  const cy = (d.cy + 0.5) * TILE;
  let bestX = z.x;
  let bestY = z.y;
  let bestD = -1;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = DOMAIN.repositionGap;
    const nx = cx + Math.cos(a) * r;
    const ny = cy + Math.sin(a) * r;
    if (world.circleBlocked(nx, ny, 10)) continue;
    const dd = Math.hypot(nx - z.x, ny - z.y);
    if (dd > bestD) {
      bestD = dd;
      bestX = nx;
      bestY = ny;
    }
  }
  burst(g, z.x, z.y - 14, 18, z.kind === 'bossDragon' ? ['#c06cff', '#6a3ac0'] : ['#7ad8ff', '#1e2e33'], 150, 60, 3);
  z.x = bestX;
  z.y = bestY;
  burst(g, z.x, z.y - 14, 18, z.kind === 'bossDragon' ? ['#c06cff', '#6a3ac0'] : ['#7ad8ff', '#1e2e33'], 150, 60, 3);
  g.shake = Math.max(g.shake, 9);
  g.hitStop = Math.max(g.hitStop, 0.06);
  g.audio.teleport();
  g.banner = {
    title: z.kind === 'bossDragon' ? '末影龙 · 振翅脱战' : '监守者 · 潜地换位',
    sub: z.kind === 'bossDragon' ? '它飞到场地另一头了，跟上去' : '它从地下换了个位置，注意脚下的声音',
    t: 1.4,
    max: 1.4,
  };
  return true;
}

/** 领域内每帧：水晶闪白衰减、尖啸体计时 */
export function updateDomain(g: Game, dt: number) {
  const d = g.domain;
  if (!d) return;
  d.t += dt;
  for (const c of g.crystals) {
    if (c.dead) continue;
    c.flash = Math.max(0, c.flash - dt);
    c.hp = Math.min(c.maxHp, c.hp + dt * 0.6);
  }
  for (const s of g.shriekers) {
    s.anim += dt;
    s.pulse = Math.max(0, s.pulse - dt);
    s.cd -= dt;
    if (s.cd <= 0) {
      s.cd = DOMAIN.shriekCd;
      s.pulse = DOMAIN.shriekPulse;
      g.noise = Math.max(g.noise, DOMAIN.shriekNoise);
      // 领域沉默：尖啸让玩家定身 3 秒
      g.rootT = Math.max(g.rootT, 3);
      g.numbers.push({ x: g.player.x, y: g.player.y - 56, vy: -12, life: 1.4, max: 1.4, text: '领域沉默! 3 秒无法移动', color: '#7ad8ff', big: true });
      g.shake = Math.max(g.shake, 5);
      g.audio.witherTick();
      burst(g, s.x, s.y - 6, 14, ['#7ad8ff', '#cfe4ff'], 90, -30, 2);
      g.numbers.push({ x: s.x, y: s.y - 30, vy: -14, life: 0.9, max: 0.9, text: '尖啸!', color: '#7ad8ff' });
    }
  }
}

/** 水晶被打碎：龙短暂硬直 */
export function hitCrystal(g: Game, ci: number, dmg: number) {
  const c = g.crystals[ci];
  if (!c || c.dead) return;
  c.hp -= dmg;
  c.flash = 0.12;
  burst(g, c.x, c.y - 8, 6, ['#d06cff', '#8a3ac0'], 80, 60, 2);
  g.audio.hit();
  if (c.hp <= 0) {
    c.dead = true;
    c.hp = 0;
    burst(g, c.x, c.y - 8, 22, ['#d06cff', '#6a3ac0', '#ffffff'], 160, 80, 3);
    g.shake = Math.max(g.shake, 9);
    g.hitStop = Math.max(g.hitStop, 0.06);
    g.explosions.push({ x: c.x, y: c.y, r: 34, t: 0, max: 0.4 });
    g.audio.explode();
    for (const z of g.zombies) {
      if (z.kind === 'bossDragon' && !z.dead) {
        z.stunT = Math.max(z.stunT, DOMAIN.crystalStagger);
        z.diveT = 0;
        z.crouch = 0;
        z.breathT = 0;
        g.numbers.push({ x: z.x, y: z.y - 60, vy: -14, life: 1.1, max: 1.1, text: '水晶破碎 · 硬直!', color: '#d06cff', big: true });
      }
    }
    const left = g.crystals.filter((o) => !o.dead).length;
    g.numbers.push({
      x: g.player.x,
      y: g.player.y - 52,
      vy: -16,
      life: 1.2,
      max: 1.2,
      text: left > 0 ? `水晶 ${4 - left}/4 破碎` : '全部水晶破碎 · 全力进攻!',
      color: '#c8a0ff',
      big: true,
    });
  }
}

/** 爆炸也能炸碎水晶（TNT / 苦力怕） */
export function blastCrystals(g: Game, x: number, y: number, radius: number) {
  for (let i = 0; i < g.crystals.length; i++) {
    const c = g.crystals[i];
    if (c.dead) continue;
    if (Math.hypot(c.x - x, c.y - y) < radius + 10) hitCrystal(g, i, DOMAIN.crystalHp * 0.45);
  }
}
