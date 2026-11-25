import { VIEW_H, VIEW_W, WEATHER, WORLD, clamp } from '../config';
import type { Game } from '../game';
import { world } from '../world';
import { TAU } from './util';

export function updateWeather(g: Game, dt: number) {
  let target = clamp((g.wave - 1) / WEATHER.stageEvery, 0, 4);
  if (g.zombies.some((z) => z.kind.startsWith('boss'))) target = 4;
  if (!g.waveActive) target = Math.max(0, target - 1.6);
  g.weather += (target - g.weather) * Math.min(1, dt * 0.4);

  if (g.weather >= 3.6) {
    g.lightningTimer -= dt;
    if (g.lightningTimer <= 0) {
      g.lightningTimer = g.rndRange(WEATHER.strikeMin, WEATHER.strikeMax);
      const a = g.rnd() * TAU;
      const dd = g.rndRange(70, 200);
      const x = clamp(g.player.x + Math.cos(a) * dd, 30, WORLD.w - 30);
      const y = clamp(g.player.y + Math.sin(a) * dd, 30, WORLD.h - 30);
      if (!world.circleBlocked(x, y, 12)) {
        // 开阔地带更容易被雷劈；有墙体遮挡的地方相对安全（逼玩家学会看地形）
        const sheltered = world.circleBlocked(x, y, 26);
        if (!sheltered || g.rnd() < 0.3) {
          g.lightning.push({ x, y, t: WEATHER.telegraph, max: WEATHER.telegraph, struck: false });
        }
      }
    }
  }

  // 雨天地面涟漪
  if (g.weather >= 2 && g.rnd() < dt * 16) {
    const rx = g.player.x + g.rndRange(-VIEW_W / 2, VIEW_W / 2);
    const ry = g.player.y + g.rndRange(-VIEW_H / 2, VIEW_H / 2);
    if (!world.solidAt(rx, ry)) {
      g.ripples.push({ x: rx, y: ry, t: 0, max: 0.5 });
      if (g.ripples.length > 60) g.ripples.shift();
    }
  }

  const p = g.player;
  for (const s of g.lightning) {
    s.t -= dt;
    if (!s.struck && s.t <= 0) {
      s.struck = true;
      s.t = 0.3;
      g.audio.thunder();
      g.flash = Math.max(g.flash, 0.95);
      g.shake = Math.max(g.shake, 9);
      g.hitStop = Math.max(g.hitStop, 0.05);
      g.explosions.push({ x: s.x, y: s.y, r: WEATHER.strikeRadius * 0.55, t: 0, max: 0.35 });
      g.scorches.push({ x: s.x, y: s.y, r: WEATHER.strikeRadius * 0.45, t: 0, max: 10 });
      for (let i = 0; i < 18; i++) {
        const a = g.rnd() * TAU;
        const sp = g.rndRange(40, 200);
        g.particles.push({
          x: s.x,
          y: s.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: g.rndRange(0.15, 0.4),
          max: 0.4,
          color: i % 2 === 0 ? '#cfe4ff' : '#ffffff',
          size: 2,
          grav: 0,
        });
      }
      if (Math.hypot(p.x - s.x, p.y - s.y) < WEATHER.strikeRadius && p.invuln <= 0 && p.dashT <= 0) {
        g.hurtPlayer(WEATHER.strikeDmg);
      }
      for (const z of g.zombies) {
        if (z.dead) continue;
        if (Math.hypot(z.x - s.x, z.y - s.y) < WEATHER.strikeRadius + z.r) {
          g.damageZombie(z, WEATHER.strikeZombieDmg, Math.atan2(z.y - s.y, z.x - s.x));
        }
      }
      g.destroyWallsNear(s.x, s.y, WEATHER.strikeRadius);
    }
  }
  g.lightning = g.lightning.filter((s) => s.t > -0.1);
}

export function updateClouds(g: Game, dt: number) {
  for (const cl of g.clouds) {
    cl.x += cl.vx * dt;
    if (cl.x - cl.r > WORLD.w) cl.x = -cl.r;
  }
}

export function updateFx(g: Game, dt: number) {
  for (const p of g.particles) {
    p.life -= dt;
    p.vy += p.grav * dt;
    p.vx *= 0.985;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  g.particles = g.particles.filter((p) => p.life > 0);
  if (g.particles.length > 420) g.particles.splice(0, g.particles.length - 420);

  for (const n of g.numbers) {
    n.life -= dt;
    n.vy += 46 * dt;
    n.y += n.vy * dt;
  }
  g.numbers = g.numbers.filter((n) => n.life > 0);

  for (const s of g.slashes) s.t += dt;
  g.slashes = g.slashes.filter((s) => s.t < s.max);

  for (const e of g.explosions) e.t += dt;
  g.explosions = g.explosions.filter((e) => e.t < e.max);

  for (const s of g.scorches) s.t += dt;
  g.scorches = g.scorches.filter((s) => s.t < s.max);

  for (const n of g.nodes) n.shake = Math.max(0, n.shake - dt);
  g.nodes = g.nodes.filter((n) => n.hp > 0);

  for (const d of g.dashGhosts) d.t -= dt;
  g.dashGhosts = g.dashGhosts.filter((d) => d.t > 0);

  for (const r of g.ripples) r.t += dt;
  g.ripples = g.ripples.filter((r) => r.t < r.max);

  if (g.banner.t > 0) g.banner.t -= dt;
  g.flash = Math.max(0, g.flash - dt * 2.2);
  g.shake = Math.max(0, g.shake - dt * 26);
}
