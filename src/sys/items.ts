import {
  ARMOR,
  CAMPFIRE,
  DISCS,
  EAPPLE,
  ENCHANT_DEFS,
  FIREBALL,
  GATHER,
  GOLEM,
  POTION_DROPS,
  POTION_EFFECTS,
  REDSTONE,
  SUPPLY,
  TILE,
  TNT,
  TRADER,
  clamp,
} from '../config';
import type { Game } from '../game';
import type { ChestState, DropState, ResourceNode } from '../types';
import { world } from '../world';
import { burst } from './combat';
import { TAU, weaponFor } from './util';

export function updateChests(g: Game) {
  const p = g.player;
  for (const c of g.chests) {
    if (c.opened) continue;
    if (Math.hypot(c.x - p.x, c.y - p.y) < 18) openChest(g, c);
  }
}

export function openChest(g: Game, c: ChestState) {
  c.opened = true;
  c.anim = 1;
  g.runChests++;
  g.audio.chestOpen();
  // 幸运四叶草：稀有掉落概率大幅提升
  let r = g.rnd();
  if (g.hasRelic('luck')) r -= 0.14;
  let kind: DropState['kind'] = 'emerald';
  let n = 1;
  if (r < 0.3) {
    const pick = g.rndInt(0, 3);
    if (pick === 0) {
      kind = 'iron';
      n = g.rndInt(1, 2);
    } else if (pick === 1) {
      kind = 'apple';
      n = 2;
    } else if (pick === 2) {
      kind = 'gunpowder';
      n = 2;
    } else {
      kind = 'eye';
      n = 1;
    }
  } else if (r < 0.52) {
    kind = 'emerald';
    n = g.rndInt(2, 4);
  } else if (r < 0.66) {
    kind = 'eye';
    n = 1;
  } else if (r < 0.78) {
    kind = 'heart';
    n = 1;
  } else if (r < 0.9) {
    kind = 'gold';
    n = 1;
  } else if (r < 0.93) {
    kind = 'enchant';
    n = 1;
  } else if (r < 0.96) {
    kind = 'eapple';
    n = 1;
  } else {
    kind = 'diamond';
    n = 1;
  }
  for (let i = 0; i < n; i++) {
    g.drops.push({ x: c.x + g.rndRange(-8, 8), y: c.y + g.rndRange(-6, 6), life: 40, bob: i, kind });
  }
  burst(g, c.x, c.y - 8, 12, ['#ffd76b', '#fff3a0'], 90, 240, 2);
  g.numbers.push({ x: c.x, y: c.y - 24, vy: -18, life: 1, max: 1, text: '宝箱!', color: '#ffd76b' });
}

export function updateSupplies(g: Game, dt: number) {
  const p = g.player;
  if (g.waveActive) {
    g.supplyTimer -= dt;
    if (g.supplyTimer <= 0) {
      g.supplyTimer = SUPPLY.every;
      const s = world.findSpawn(p.x, p.y, 240, 420, 26);
      g.supplies.push({ x: s.x, y: s.y, fallT: SUPPLY.fallTime, landed: false, life: SUPPLY.lifetime, opened: false });
      g.audio.airdrop();
      g.banner = { title: '空投支援!', sub: '补给箱正在降落 · 靠近拾取', t: 1.6, max: 1.6 };
      for (let i = 0; i < 8; i++) {
        g.numbers.push({
          x: p.x,
          y: p.y - 60 - i * 4,
          vy: -26 - i * 2,
          life: 0.8,
          max: 0.8,
          text: '▼',
          color: '#4ac9b0',
        });
      }
    }
  }
  for (const s of g.supplies) {
    if (!s.landed) {
      s.fallT -= dt;
      if (s.fallT > 0) {
        s.y += 26 * dt;
        continue;
      }
      s.landed = true;
      g.shake = Math.max(g.shake, 4);
      burst(g, s.x, s.y, 12, ['#4ac9b0', '#8a6a3a'], 110, 220, 3);
      g.audio.place();
      continue;
    }
    s.life -= dt;
    if (s.life <= 0 || s.opened) continue;
    if (Math.hypot(p.x - s.x, p.y - s.y) < 26) {
      s.opened = true;
      g.runSupplies++;
      g.audio.chestOpen();
      let r = g.rnd();
      if (g.hasRelic('luck')) r -= 0.2;
      const loot: { kind: DropState['kind']; n: number }[] = [{ kind: 'emerald', n: g.rndInt(2, 4) }];
      if (r < SUPPLY.enchantChance) loot.push({ kind: 'enchant', n: 1 });
      else if (r < SUPPLY.enchantChance + SUPPLY.eappleChance) loot.push({ kind: 'eapple', n: 1 });
      else if (r < SUPPLY.enchantChance + SUPPLY.eappleChance + SUPPLY.emeraldChance)
        loot.push({ kind: 'emerald', n: g.rndInt(1, 2) });
      else loot.push({ kind: 'apple', n: 2 });
      for (const l of loot) {
        for (let i = 0; i < l.n; i++) {
          g.drops.push({ x: s.x + g.rndRange(-14, 14), y: s.y + g.rndRange(-8, 8), life: 60, bob: i, kind: l.kind });
        }
      }
      burst(g, s.x, s.y - 8, 14, ['#ffd76b', '#fff3a0'], 100, 240, 2);
      g.numbers.push({ x: p.x, y: p.y - 50, vy: -18, life: 1.2, max: 1.2, text: '空投补给已领取!', color: '#4ac9b0', big: true });
    }
  }
  g.supplies = g.supplies.filter((s) => s.life > 0 && !s.opened);
}

export function updateTraps(g: Game, dt: number) {
  for (let i = g.traps.length - 1; i >= 0; i--) {
    const t = g.traps[i];
    t.t += dt;
    if (!t.armed && t.t >= 0.8) t.armed = true;
    if (t.t >= t.max) {
      g.traps.splice(i, 1);
      continue;
    }
    if (!t.armed) continue;
    let triggered = false;
    for (const z of g.zombies) {
      if (z.dead) continue;
      const trapR = REDSTONE.trapRadius * 1.5 * (g.growthLvl('trapMaster') > 0 ? 1.3 : 1);
      if (Math.hypot(z.x - t.x, z.y - t.y) > trapR + z.r) continue;
      triggered = true;
      // 陷阱：对小怪是大范围爆炸，对 BOSS 大幅削弱
      const isBossT = z.kind.startsWith('boss') || z.kind === 'wither';
      const trapMul = (isBossT ? 0.35 : 3) * (g.growthLvl('trapMaster') > 0 ? 1.5 : 1);
      g.damageZombie(z, REDSTONE.trapDmg * trapMul, Math.atan2(z.y - t.y, z.x - t.x));
      if (!isBossT) {
        z.vx += Math.cos(Math.atan2(z.y - t.y, z.x - t.x)) * 160;
        z.vy += Math.sin(Math.atan2(z.y - t.y, z.x - t.x)) * 160;
      }
      z.slowT = Math.max(z.slowT, REDSTONE.trapSlow);
    }
    if (triggered) {
      g.audio.explode();
      burst(g, t.x, t.y, 16, ['#e04040', '#ff6a6a'], 120, 260, 3);
      g.shake = Math.max(g.shake, 4);
      g.traps.splice(i, 1);
    }
  }
}

export function hitNode(g: Game, n: ResourceNode) {
  n.hp--;
  n.shake = 0.18;
  g.audio.mine();
  if (n.kind === 'stone') {
    burst(g, n.x, n.y - 6, 5, ['#9a9a90', '#6a6a68'], 80, 200, 2);
  } else if (n.kind === 'redstone') {
    burst(g, n.x, n.y - 6, 5, ['#e04040', '#8a1a1a'], 80, 200, 2);
  } else {
    burst(g, n.x, n.y - 14, 5, ['#4a9a2a', '#7cbd3a'], 70, 160, 2);
  }
  if (n.hp <= 0) {
    const p = g.player;
    const stormMul = g.weather >= 3.6 ? 2 : 1;
    const relicAdd = g.hasRelic('harvest') ? 1 : 0;
    if (n.kind === 'stone') {
      const gain = GATHER.stonePerNode * stormMul + relicAdd;
      p.stone += gain;
      g.gathered.stone += gain;
      g.audio.pickup();
      burst(g, n.x, n.y - 6, 14, ['#9a9a90', '#c9c9c0'], 110, 220, 3);
      g.numbers.push({
        x: p.x,
        y: p.y - 48,
        vy: -18,
        life: 1.1,
        max: 1.1,
        text: `石头 +${gain}${stormMul > 1 ? ' (雷暴双倍)' : ''}`,
        color: '#c9c9c0',
      });
    } else if (n.kind === 'redstone') {
      const gain = REDSTONE.perNode * stormMul + relicAdd;
      p.redstone += gain;
      g.audio.pickup();
      burst(g, n.x, n.y - 6, 12, ['#e04040', '#8a1a1a'], 100, 220, 3);
      g.numbers.push({
        x: p.x,
        y: p.y - 48,
        vy: -18,
        life: 1.1,
        max: 1.1,
        text: `红石 +${gain}${stormMul > 1 ? ' (雷暴双倍)' : ''}`,
        color: '#ff6a6a',
      });
    } else {
      const gain = 1 * stormMul + relicAdd;
      p.apples += gain;
      g.gathered.apples += gain;
      g.audio.apple();
      burst(g, n.x, n.y - 16, 12, ['#ffd76b', '#8fd14f'], 90, 180, 2);
      g.numbers.push({
        x: p.x,
        y: p.y - 48,
        vy: -18,
        life: 1.1,
        max: 1.1,
        text: `苹果 +${gain}${stormMul > 1 ? ' (雷暴双倍)' : ''}`,
        color: '#ffd76b',
      });
    }
  } else {
    g.numbers.push({
      x: n.x,
      y: n.y - (n.kind === 'stone' ? 12 : 26),
      vy: -10,
      life: 0.4,
      max: 0.4,
      text: `${n.hp}`,
      color: '#9aa0a6',
    });
  }
}

export function spawnNodes(g: Game) {
  g.nodes = [];
  let placed = 0;
  for (let t = 0; t < 500 && placed < GATHER.stoneNodes; t++) {
    const w = world.walkable[(g.rnd() * world.walkable.length) | 0];
    const tx = Math.floor(w.x / TILE);
    const ty = Math.floor(w.y / TILE);
    let nearWall = false;
    if (ty > 0 && world.tiles[(ty - 1) * world.tcols + tx] === 1) nearWall = true;
    else if (ty < world.trows - 1 && world.tiles[(ty + 1) * world.tcols + tx] === 1) nearWall = true;
    else if (tx > 0 && world.tiles[ty * world.tcols + tx - 1] === 1) nearWall = true;
    else if (tx < world.tcols - 1 && world.tiles[ty * world.tcols + tx + 1] === 1) nearWall = true;
    if (!nearWall) continue;
    if (Math.hypot(w.x - world.start.x, w.y - world.start.y) < 150) continue;
    placed++;
    g.nodes.push({ kind: 'stone', x: w.x, y: w.y, hp: GATHER.stoneHp, maxHp: GATHER.stoneHp, shake: 0 });
  }
  placed = 0;
  for (let t = 0; t < 400 && placed < GATHER.treeNodes; t++) {
    const w = world.walkable[(g.rnd() * world.walkable.length) | 0];
    const tx = Math.floor(w.x / TILE);
    const ty = Math.floor(w.y / TILE);
    if (world.cellKind[Math.floor(ty / 4) * world.cols + Math.floor(tx / 4)] !== 2) continue;
    if (Math.hypot(w.x - world.start.x, w.y - world.start.y) < 130) continue;
    if (g.nodes.some((n) => Math.hypot(n.x - w.x, n.y - w.y) < 36)) continue;
    placed++;
    g.nodes.push({ kind: 'tree', x: w.x, y: w.y, hp: GATHER.treeHp, maxHp: GATHER.treeHp, shake: 0 });
  }
  placed = 0;
  for (let t = 0; t < 300 && placed < REDSTONE.nodes; t++) {
    const w = world.walkable[(g.rnd() * world.walkable.length) | 0];
    const tx = Math.floor(w.x / TILE);
    const ty = Math.floor(w.y / TILE);
    if (world.cellKind[Math.floor(ty / 4) * world.cols + Math.floor(tx / 4)] === 1) continue;
    if (Math.hypot(w.x - world.start.x, w.y - world.start.y) < 160) continue;
    if (g.nodes.some((n) => Math.hypot(n.x - w.x, n.y - w.y) < 46)) continue;
    placed++;
    g.nodes.push({
      kind: 'redstone',
      x: w.x,
      y: w.y,
      hp: REDSTONE.nodeHp,
      maxHp: REDSTONE.nodeHp,
      shake: 0,
    });
  }
}

export function tryEat(g: Game) {
  const p = g.player;
  if (p.eatCd > 0) return;
  if (p.eapples > 0) {
    p.eapples--;
    p.eatCd = GATHER.eatCd;
    p.hp = p.maxHp;
    p.maxHp += EAPPLE.maxHpAdd;
    p.strT = EAPPLE.buffT;
    g.audio.eat();
    g.audio.bless();
    burst(g, p.x, p.y - 16, 18, ['#f5d327', '#ffffff', '#ffd76b'], 110, -50, 3);
    g.numbers.push({
      x: p.x,
      y: p.y - 50,
      vy: -20,
      life: 1.4,
      max: 1.4,
      text: `附魔金苹果! 上限+${EAPPLE.maxHpAdd} · ${EAPPLE.buffT}秒力量`,
      color: '#f5d327',
      big: true,
    });
    return;
  }
  const golden = p.goldApples > 0 && p.hp < p.maxHp;
  if (!golden) {
    if (p.apples <= 0) {
      g.numbers.push({
        x: p.x,
        y: p.y - 44,
        vy: -18,
        life: 0.8,
        max: 0.8,
        text: '没有食物! (挥击采集苹果树)',
        color: '#ff8a30',
      });
      return;
    }
    if (p.hp >= p.maxHp) {
      g.numbers.push({ x: p.x, y: p.y - 44, vy: -18, life: 0.8, max: 0.8, text: '生命值已满', color: '#9aa0a6' });
      return;
    }
  }
  g.eatenCount++;
  if (golden) {
    p.goldApples--;
    p.eatCd = GATHER.eatCd;
    p.hp = p.maxHp;
    p.buffT = ARMOR.goldenBuffT;
    p.invuln = Math.max(p.invuln, ARMOR.goldenInvuln);
    g.audio.heal();
    g.audio.bless();
    burst(g, p.x, p.y - 16, 16, ['#f5d327', '#fff3a0'], 90, -40, 2);
    g.numbers.push({
      x: p.x,
      y: p.y - 48,
      vy: -20,
      life: 1.2,
      max: 1.2,
      text: '金苹果! 全满 + 力量',
      color: '#f5d327',
      big: true,
    });
    return;
  }
  const heal = GATHER.eatHeal + (g.hasRelic('stomach') ? 3 : 0);
  p.apples--;
  p.eatCd = GATHER.eatCd;
  p.hp = Math.min(p.maxHp, p.hp + heal);
  g.audio.eat();
  g.audio.heal();
  burst(g, p.x, p.y - 16, 8, ['#ff5a5a', '#ffd0d0'], 50, -50, 2);
  g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: `+${heal} HP`, color: '#6ee86e' });
}

export function craftWall(g: Game) {
  const p = g.player;
  const cost = g.wallCost();
  if (p.stone < cost) {
    g.numbers.push({
      x: p.x,
      y: p.y - 44,
      vy: -18,
      life: 0.9,
      max: 0.9,
      text: `需要 ${cost} 石头 · 挥击矿点采集`,
      color: '#9aa0a6',
    });
    return;
  }
  // 1 石直接换成 10 块墙体方块（不设上限）
  const add = GATHER.wallsPerStone;
  p.stone -= cost;
  p.walls += add;
  g.audio.craft();
  burst(g, p.x, p.y - 16, 10, ['#8a6a3a', '#c9a26b'], 90, -30, 2);
  g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: `墙体 +${add} (Q 放置)`, color: '#c9a26b' });
}

export function craftTnt(g: Game) {
  const p = g.player;
  if (p.gunpowder < GATHER.tntCraftCost) {
    g.numbers.push({
      x: p.x,
      y: p.y - 44,
      vy: -18,
      life: 0.9,
      max: 0.9,
      text: `需要 ${GATHER.tntCraftCost} 火药 · 苦力怕掉落`,
      color: '#9aa0a6',
    });
    return;
  }
  if (p.tntAmmo >= TNT.maxAmmo) {
    // 上限已取消：这里保留分支只为兼容旧配置，maxAmmo 已设成很大
  }
  p.gunpowder -= GATHER.tntCraftCost;
  p.tntAmmo += g.job === 'alchemist' ? 2 : 1;
  g.audio.craft();
  burst(g, p.x, p.y - 16, 10, ['#ff8a30', '#ffd76b'], 90, -30, 2);
  g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: 'TNT +1', color: '#ff8a30' });
}

/** 合成菜单：1 墙体 · 2 TNT · 3-5 三阶护甲 · 6 金苹果 · 7 营火 · 8 铁傀儡 · 9 红石陷阱 */
export function craftRecipe(g: Game, n: number) {
  const p = g.player;
  if (n === 9) {
    // 陷阱：3 石 + 1 红石
    if (p.stone < 3 || p.redstone < 1) {
      g.numbers.push({ x: p.x, y: p.y - 44, vy: -18, life: 0.9, max: 0.9, text: '需要 3 石 + 1 红石', color: '#9aa0a6' });
      return;
    }
    p.stone -= 3;
    p.redstone -= 1;
    p.traps += 1;
    g.audio.craft();
    g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: '陷阱 +1 (G 放置)', color: '#ff6a6a' });
    return;
  }
  if (n === 1) {
    craftWall(g);
    return;
  }
  if (n === 2) {
    craftTnt(g);
    return;
  }
  if (n >= 3 && n <= 5) {
    const tier = ARMOR.tiers[n - 3];
    const resName = n === 3 ? '铁' : n === 4 ? '金' : '钻石';
    const have = n === 3 ? p.iron : n === 4 ? p.gold : p.diamond;
    // 已经穿着同一档、但耐久没满 → 花同样的材料补满
    if (p.armor === n - 2 && p.armorDur < p.armorMax) {
      p.iron -= 0;
      p.armorDur = p.armorMax;
      g.audio.craft();
      g.numbers.push({ x: p.x, y: p.y - 48, vy: -18, life: 1.2, max: 1.2, text: `${tier.name} 耐久已补满`, color: tier.color, big: true });
      return;
    }
    if (p.armor >= n - 2 && p.armorDur >= p.armorMax) {
      g.numbers.push({
        x: p.x,
        y: p.y - 46,
        vy: -18,
        life: 0.9,
        max: 0.9,
        text: `已装备${tier.name}或更高级护甲`,
        color: '#9aa0a6',
      });
      return;
    }
    if (have < tier.cost) {
      g.numbers.push({
        x: p.x,
        y: p.y - 46,
        vy: -18,
        life: 0.9,
        max: 0.9,
        text: `需要 ${tier.cost} ${resName} · 击败${resName}甲僵尸掉落`,
        color: '#9aa0a6',
      });
      return;
    }
    if (n === 3) p.iron -= tier.cost;
    else if (n === 4) p.gold -= tier.cost;
    else p.diamond -= tier.cost;
    p.armor = n - 2;
    p.armorMax = tier.dur ?? 20;
    p.armorDur = p.armorMax;
    g.audio.craft();
    burst(g, p.x, p.y - 16, 12, [tier.color, '#ffffff'], 90, -40, 2);
    g.numbers.push({
      x: p.x,
      y: p.y - 48,
      vy: -18,
      life: 1.2,
      max: 1.2,
      text: `${tier.name}装备! 减伤${Math.round(tier.red * 100)}%`,
      color: tier.color,
      big: true,
    });
    return;
  }
  if (n === 6) {
    if (p.gold < ARMOR.goldenAppleCost) {
      g.numbers.push({
        x: p.x,
        y: p.y - 46,
        vy: -18,
        life: 0.9,
        max: 0.9,
        text: `需要 ${ARMOR.goldenAppleCost} 金 · 击败黄金僵尸掉落`,
        color: '#9aa0a6',
      });
      return;
    }
    p.gold -= ARMOR.goldenAppleCost;
    p.goldApples++;
    g.audio.craft();
    burst(g, p.x, p.y - 16, 12, ['#f5d327', '#fff3a0'], 90, -40, 2);
    g.numbers.push({
      x: p.x,
      y: p.y - 48,
      vy: -18,
      life: 1.2,
      max: 1.2,
      text: '金苹果 +1 (F 食用全满回血)',
      color: '#f5d327',
      big: true,
    });
    return;
  }
  if (n === 7) {
    if (p.coal < CAMPFIRE.coalCost || p.stone < CAMPFIRE.stoneCost) {
      g.numbers.push({
        x: p.x,
        y: p.y - 46,
        vy: -18,
        life: 0.9,
        max: 0.9,
        text: `需要 ${CAMPFIRE.coalCost} 煤炭 + ${CAMPFIRE.stoneCost} 石头 · 凋灵骷髅掉煤`,
        color: '#9aa0a6',
      });
      return;
    }
    p.coal -= CAMPFIRE.coalCost;
    p.stone -= CAMPFIRE.stoneCost;
    g.campfires.push({ x: p.x + 26, y: p.y - 10, t: 0, max: CAMPFIRE.duration, heal: 0 });
    g.audio.craft();
    g.audio.place();
    burst(g, p.x + 26, p.y - 16, 14, ['#ff8a30', '#ffd76b'], 90, -40, 2);
    g.numbers.push({ x: p.x, y: p.y - 48, vy: -18, life: 1.2, max: 1.2, text: `营火已放置 · ${CAMPFIRE.duration}秒范围回血`, color: '#ff9a3c', big: true });
    return;
  }
  if (n === 8) {
    if (p.iron < GOLEM.ironCost) {
      g.numbers.push({
        x: p.x,
        y: p.y - 46,
        vy: -18,
        life: 0.9,
        max: 0.9,
        text: `需要 ${GOLEM.ironCost} 铁 · 击败铁甲僵尸掉落`,
        color: '#9aa0a6',
      });
      return;
    }
    p.iron -= GOLEM.ironCost;
    const golemHp = Math.round(GOLEM.hp * (g.growthLvl('golemMaster') > 0 ? 1.5 : 1));
    // 找个能站的位置召唤，避免直接生成在墙里
    const spot = world.findSpawn(p.x, p.y, 26, 46, 10);
    g.golems.push({ x: spot.x, y: spot.y, hp: golemHp, maxHp: golemHp, anim: 0, swingT: 0, targetId: 0, flash: 0 });
    g.audio.summon();
    burst(g, spot.x, spot.y - 16, 18, ['#e2e2e2', '#8a5a3a'], 110, -50, 3);
    g.numbers.push({ x: p.x, y: p.y - 50, vy: -18, life: 1.4, max: 1.4, text: '铁傀儡已苏醒! 为你而战', color: '#e2e2e2', big: true });
    return;
  }
  if (n === 9) {
    if (p.redstone < REDSTONE.trapCost || p.stone < REDSTONE.trapStoneCost) {
      g.numbers.push({
        x: p.x,
        y: p.y - 46,
        vy: -18,
        life: 0.9,
        max: 0.9,
        text: `需要 ${REDSTONE.trapCost} 红石 + ${REDSTONE.trapStoneCost} 石头 · 挥击红石矿采集`,
        color: '#9aa0a6',
      });
      return;
    }
    p.redstone -= REDSTONE.trapCost;
    p.stone -= REDSTONE.trapStoneCost;
    p.traps++;
    g.audio.craft();
    burst(g, p.x, p.y - 16, 10, ['#e04040', '#ff6a6a'], 90, -30, 2);
    g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: '红石陷阱 +1 (G 放置)', color: '#ff6a6a' });
  }
}

export function togglePlacing(g: Game, kind: 'wall' | 'trap') {
  const p = g.player;
  if (p.placing && p.placingKind === kind) {
    p.placing = false;
    g.audio.click();
    return;
  }
  p.placing = true;
  p.placingKind = kind;
  g.audio.click();
  if (kind === 'wall' && p.walls <= 0) {
    g.numbers.push({
      x: p.x,
      y: p.y - 44,
      vy: -18,
      life: 0.9,
      max: 0.9,
      text: `没有墙体 · C 合成 (${g.wallCost()} 石头)`,
      color: '#c9a26b',
    });
  } else if (kind === 'trap' && p.traps <= 0) {
    g.numbers.push({
      x: p.x,
      y: p.y - 44,
      vy: -18,
      life: 0.9,
      max: 0.9,
      text: '没有陷阱 · C 合成 (3 红石 + 2 石头)',
      color: '#ff6a6a',
    });
  }
}

export function updatePlacing(g: Game, input: { mouseX: number; mouseY: number }) {
  const p = g.player;
  if (!p.placing) {
    g.placeTarget.active = false;
    return;
  }
  const wx = g.cam.x + input.mouseX;
  const wy = g.cam.y + input.mouseY;
  const tx = Math.floor(wx / TILE);
  const ty = Math.floor(wy / TILE);
  const inRange = Math.hypot(wx - p.x, wy - p.y) <= 140;
  const cx = tx * TILE + 8;
  const cy = ty * TILE + 8;
  const nearPlayer = Math.hypot(cx - p.x, cy - p.y) < 26;
  const onNode = g.nodes.some((n) => n.hp > 0 && Math.floor(n.x / TILE) === tx && Math.floor(n.y / TILE) === ty);
  let ok = inRange && !nearPlayer && !onNode;
  if (p.placingKind === 'wall') ok = ok && world.canPlaceWall(tx, ty);
  else ok = ok && !world.circleBlocked(cx, cy, 6) && !g.traps.some((t) => Math.hypot(t.x - cx, t.y - cy) < 20);
  g.placeTarget = { tx, ty, ok, active: true };
}

export function tryPlaceWall(g: Game, input: { mouseX: number; mouseY: number }) {
  const p = g.player;
  updatePlacing(g, input);
  const t = g.placeTarget;
  if (p.placingKind === 'trap') {
    if (p.traps <= 0) {
      g.numbers.push({ x: p.x, y: p.y - 44, vy: -18, life: 0.8, max: 0.8, text: '没有陷阱了!', color: '#ff8a30' });
      p.placing = false;
      return;
    }
    if (!t.active || !t.ok) {
      g.numbers.push({ x: p.x, y: p.y - 44, vy: -18, life: 0.7, max: 0.7, text: '这里不能放', color: '#ff8a30' });
      return;
    }
    p.traps--;
    g.traps.push({ x: t.tx * TILE + 8, y: t.ty * TILE + 8, t: 0, max: REDSTONE.trapLife, armed: false });
    g.audio.place();
    burst(g, t.tx * TILE + 8, t.ty * TILE + 8, 8, ['#e04040', '#8a1a1a'], 70, 200, 2);
    return;
  }
  if (p.walls <= 0) {
    g.numbers.push({ x: p.x, y: p.y - 44, vy: -18, life: 0.8, max: 0.8, text: '没有墙体了!', color: '#ff8a30' });
    p.placing = false;
    return;
  }
  if (!t.active || !t.ok) {
    g.numbers.push({ x: p.x, y: p.y - 44, vy: -18, life: 0.7, max: 0.7, text: '这里不能放', color: '#ff8a30' });
    return;
  }
  p.walls--;
  world.addWall(t.tx, t.ty, g.wallHp());
  g.wallDirty = true;
  world.invalidateFlow();
  world.updateFlow(p.x, p.y);
  g.audio.place();
  g.placedWallCount++;
  burst(g, t.tx * TILE + 8, t.ty * TILE + 8, 8, ['#8a6a3a', '#c9a26b'], 70, 200, 2);
}

export function tryTeleportEye(g: Game) {
  const p = g.player;
  if (p.teleCd > 0) return;
  if (p.eyes <= 0) {
    g.numbers.push({ x: p.x, y: p.y - 44, vy: -18, life: 0.8, max: 0.8, text: '没有末影之眼!', color: '#d06cff' });
    return;
  }
  const okPoint = (px: number, py: number) =>
    Math.hypot(p.x - px, p.y - py) <= GATHER.eyeRange + 60 && !world.circleBlocked(px, py, 8);
  let tx = p.x + Math.cos(p.aim) * GATHER.eyeRange;
  let ty = p.y - 14 + Math.sin(p.aim) * GATHER.eyeRange;
  let found = okPoint(tx, ty);
  for (let ring = 1; ring <= 4 && !found; ring++) {
    const rr = ring * 26;
    for (let k = 0; k < 8 && !found; k++) {
      const a2 = (k / 8) * TAU;
      const cx = tx + Math.cos(a2) * rr;
      const cy = ty + Math.sin(a2) * rr;
      if (okPoint(cx, cy)) {
        tx = cx;
        ty = cy;
        found = true;
      }
    }
  }
  if (!found) {
    g.numbers.push({ x: p.x, y: p.y - 44, vy: -18, life: 0.8, max: 0.8, text: '目标位置无法到达', color: '#d06cff' });
    return;
  }
  p.eyes--;
  p.teleCd = GATHER.eyeCd;
  burst(g, p.x, p.y - 14, 12, ['#d06cff', '#8a3ac0'], 80, -20, 2);
  p.x = tx;
  p.y = ty;
  p.invuln = Math.max(p.invuln, 0.5);
  burst(g, p.x, p.y - 14, 12, ['#d06cff', '#8a3ac0'], 80, -20, 2);
  g.audio.teleport();
}

export function destroyWallsNear(g: Game, x: number, y: number, radius: number) {
  const radTiles = Math.ceil(radius / TILE);
  const cx = Math.floor(x / TILE);
  const cy = Math.floor(y / TILE);
  let any = false;
  for (let ty = cy - radTiles; ty <= cy + radTiles; ty++) {
    for (let tx = cx - radTiles; tx <= cx + radTiles; tx++) {
      if (world.wallHpAt(tx, ty) <= 0) continue;
      const ddx = tx * TILE + 8 - x;
      const ddy = ty * TILE + 8 - y;
      if (ddx * ddx + ddy * ddy < radius * radius * 0.8) {
        world.removeWall(tx, ty);
        any = true;
        burst(g, tx * TILE + 8, ty * TILE + 8, 6, ['#8a6a3a', '#5a4520'], 100, 240, 2);
      }
    }
  }
  if (any) {
    g.wallDirty = true;
    world.invalidateFlow();
  }
}

function unstickDrop(d: DropState) {
  if (!world.solidAt(d.x, d.y)) return;
  // 从近到远做环形搜索，距离放大到 160px（飞行怪死后可能掉在建筑深处）
  for (let r = 6; r <= 160; r += 6) {
    const n = r < 48 ? 8 : 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r * 0.37;
      const nx = d.x + Math.cos(a) * r;
      const ny = d.y + Math.sin(a) * r;
      if (!world.solidAt(nx, ny) && !world.circleBlocked(nx, ny, 4)) {
        d.x = nx;
        d.y = ny;
        return;
      }
    }
  }
  // 实在找不到空地（理论上不会发生）：保持原位，让磁吸/下一帧再试
}

export function updateDrops(g: Game, dt: number) {
  const p = g.player;
  for (const d of g.drops) {
    d.life -= dt;
    d.bob += dt;
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    const dist = Math.hypot(dx, dy) || 1;
    // 磁吸范围内的经验球可以穿墙飞过来，避免卡在墙里永远捡不到
    const magnet = d.kind === 'xp' && dist < g.magnetRange();
    if (!magnet) unstickDrop(d);
    if (magnet) {
      d.x += (dx / dist) * 260 * dt;
      d.y += (dy / dist) * 260 * dt;
    }
    if (dist >= 16) continue;
    if (d.kind === 'heart') {
      if (p.hp >= p.maxHp) continue;
      d.life = -1;
      p.hp = Math.min(p.maxHp, p.hp + 2);
      g.audio.heal();
      burst(g, d.x, d.y - 6, 8, ['#ff5a5a', '#ffd0d0'], 60, -40, 2);
    } else if (d.kind === 'apple') {
      d.life = -1;
      p.apples++;
      g.audio.pickup();
      burst(g, d.x, d.y - 6, 8, ['#ffd76b', '#8fd14f'], 60, -40, 2);
      g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: '苹果 +1 (F 食用)', color: '#ffd76b' });
    } else if (d.kind === 'gunpowder') {
      d.life = -1;
      p.gunpowder++;
      g.gathered.powder++;
      g.audio.pickup();
      burst(g, d.x, d.y - 6, 8, ['#9a9a90', '#5a5a60'], 60, -40, 2);
      g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: '火药 +1 (V 合成TNT)', color: '#b0b0a8' });
    } else if (d.kind === 'eye') {
      d.life = -1;
      p.eyes++;
      g.gathered.eyes++;
      g.audio.pickup();
      burst(g, d.x, d.y - 6, 10, ['#d06cff', '#8a3ac0'], 60, -40, 2);
      g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: '末影之眼 +1 (T 传送)', color: '#d06cff' });
    } else if (d.kind === 'emerald') {
      d.life = -1;
      g.runEmeralds += Math.max(1, Math.round(1 + 0.3 * g.growthLvl('emerald')));
      g.audio.emerald();
      burst(g, d.x, d.y - 6, 10, ['#6ee86e', '#c8ffc8'], 70, -40, 2);
      g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: '绿宝石 +1 (死亡结算)', color: '#6ee86e' });
    } else if (d.kind === 'iron' || d.kind === 'gold' || d.kind === 'diamond') {
      d.life = -1;
      if (d.kind === 'iron') p.iron++;
      else if (d.kind === 'gold') p.gold++;
      else p.diamond++;
      g.audio.pickup();
      const col = d.kind === 'iron' ? '#e2e2e2' : d.kind === 'gold' ? '#f5d327' : '#4aedd9';
      const label = d.kind === 'iron' ? '铁' : d.kind === 'gold' ? '金' : '钻石';
      burst(g, d.x, d.y - 6, 8, [col, '#ffffff'], 60, -40, 2);
      g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: `${label} +1 (C 合成)`, color: col });
    } else if (d.kind === 'xp') {
      d.life = -1;
      g.kills++;
      g.audio.pickup();
      burst(g, d.x, d.y - 4, 5, ['#6ee86e', '#d8ffa0'], 50, -20, 2);
      const idx = weaponFor(g.kills);
      if (idx > p.weapon) g.levelUp(idx);
    } else if (d.kind === 'coal') {
      d.life = -1;
      p.coal++;
      g.audio.pickup();
      burst(g, d.x, d.y - 6, 8, ['#3a3a44', '#7a7a88'], 60, -40, 2);
      g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: '煤炭 +1 (C 营火)', color: '#8a8a96' });
    } else if (d.kind === 'fireball') {
      d.life = -1;
      p.fireballs += 2;
      g.audio.pickup();
      burst(g, d.x, d.y - 6, 10, ['#ff9a3c', '#ffd76b'], 70, -40, 2);
      g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: '火焰弹 +2 (6 投掷)', color: '#ff9a3c' });
    } else if (d.kind === 'potion') {
      if (p.potion) continue;
      d.life = -1;
      p.potion = d.sub || 'heal';
      g.audio.potion();
      const pot = POTION_DROPS.find((o) => o.id === p.potion);
      burst(g, d.x, d.y - 6, 10, ['#c98af0', '#ffd0f0'], 70, -40, 2);
      g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: `${pot ? pot.name : '药水'} (E 饮用)`, color: '#c98af0' });
    } else if (d.kind === 'enchant') {
      d.life = -1;
      applyEnchant(g);
    } else if (d.kind === 'disc') {
      d.life = -1;
      const id = d.sub || 'chill';
      if (!g.discs.includes(id)) g.discs.push(id);
      applyDisc(g, id);
      g.unlockAch('dj', g.discs.length >= 3);
      g.audio.disc();
      const dd = DISCS.find((o) => o.id === id);
      g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: `获得${dd ? dd.name : '唱片'} · BGM已切换`, color: '#ffd76b' });
    } else if (d.kind === 'eapple') {
      d.life = -1;
      p.eapples++;
      g.audio.chestOpen();
      burst(g, d.x, d.y - 6, 12, ['#f5d327', '#ffffff'], 80, -40, 2);
      g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: '附魔金苹果 +1 (F 优先食用)', color: '#f5d327' });
    }
  }
  g.drops = g.drops.filter((d) => d.life > 0);
}

export function drinkPotion(g: Game) {
  const p = g.player;
  const id = p.potion;
  if (!id) return;
  p.potion = '';
  g.audio.potion();
  if (id === 'heal') {
    p.hp = Math.min(p.maxHp, p.hp + POTION_EFFECTS.heal);
    burst(g, p.x, p.y - 16, 14, ['#ff5a8a', '#ffd0e0'], 80, -50, 2);
    g.numbers.push({ x: p.x, y: p.y - 48, vy: -20, life: 1.2, max: 1.2, text: `治疗药水 +${POTION_EFFECTS.heal} HP`, color: '#ff5a8a', big: true });
  } else if (id === 'speed') {
    p.speedT = POTION_EFFECTS.speedT;
    burst(g, p.x, p.y - 16, 14, ['#7ae0ff', '#d0f4ff'], 90, -50, 2);
    g.numbers.push({ x: p.x, y: p.y - 48, vy: -20, life: 1.2, max: 1.2, text: `迅捷药水 ${POTION_EFFECTS.speedT}秒 +25%移速`, color: '#7ae0ff', big: true });
  } else if (id === 'strength') {
    p.strT = POTION_EFFECTS.strT;
    burst(g, p.x, p.y - 16, 14, ['#ff9a3c', '#ffd0a0'], 90, -50, 2);
    g.numbers.push({ x: p.x, y: p.y - 48, vy: -20, life: 1.2, max: 1.2, text: `力量药水 ${POTION_EFFECTS.strT}秒 +30%伤害`, color: '#ff9a3c', big: true });
  }
}

export function applyEnchant(g: Game) {
  const p = g.player;
  const def = ENCHANT_DEFS[g.rndInt(0, ENCHANT_DEFS.length - 1)];
  if (g.enchants.includes(def.id)) {
    g.runEmeralds += 2;
    g.audio.emerald();
    g.numbers.push({ x: p.x, y: p.y - 48, vy: -18, life: 1.2, max: 1.2, text: `已有「${def.name}」→ 转化为 +2绿宝石`, color: '#6ee86e', big: true });
    return;
  }
  g.enchants.push(def.id);
  g.unlockAch('enchanter', g.enchants.length >= 4);
  g.audio.enchant();
  burst(g, p.x, p.y - 16, 16, ['#c06cff', '#ffffff'], 100, -50, 2);
  g.numbers.push({ x: p.x, y: p.y - 50, vy: -20, life: 1.6, max: 1.6, text: `${def.icon} 附魔: ${def.name} — ${def.desc}`, color: '#c06cff', big: true });
}

export function applyDisc(g: Game, id: string) {
  g.discStyle = id;
  g.music.setStyle(id);
}

export function nearTrader(g: Game): boolean {
  const p = g.player;
  return g.traders.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 46);
}

export function spawnTrader(g: Game) {
  const p = g.player;
  const s = world.findSpawn(p.x, p.y, TRADER.minD, TRADER.maxD, 12);
  if (!s) return;
  g.traders.push({ x: s.x, y: s.y, anim: 0, bob: g.rnd() * TAU });
  g.audio.teleport();
  burst(g, s.x, s.y - 12, 12, ['#8a3ac0', '#c98af0'], 80, -30, 2);
  g.numbers.push({ x: p.x, y: p.y - 50, vy: -18, life: 1.2, max: 1.2, text: '流浪商人出现了! (靠近按 E 交易)', color: '#c98af0' });
}

export function updateTrader(g: Game, dt: number) {
  for (const t of g.traders) {
    t.bob += dt;
    t.anim += dt;
  }
}

export function doTrade(g: Game, i: number) {
  const p = g.player;
  const offer = TRADER.offers[i];
  if (!offer) return;
  const [res, cost] = offer.cost as [string, number];
  const have =
    res === 'stone' ? p.stone : res === 'gold' ? p.gold : res === 'iron' ? p.iron : res === 'gunpowder' ? p.gunpowder : g.runEmeralds;
  if (have < cost) {
    g.audio.click();
    g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 0.9, max: 0.9, text: `资源不足 · ${offer.label}`, color: '#9aa0a6' });
    return;
  }
  const [giveKind, giveN] = offer.give as [string, number];
  if (giveKind === 'potion' && p.potion) {
    g.audio.click();
    g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 0.9, max: 0.9, text: '背包已有药水 · 先按 E 饮用', color: '#9aa0a6' });
    return;
  }
  if (res === 'stone') p.stone -= cost;
  else if (res === 'gold') p.gold -= cost;
  else if (res === 'iron') p.iron -= cost;
  else if (res === 'gunpowder') p.gunpowder -= cost;
  else g.runEmeralds -= cost;
  if (giveKind === 'armorRepair') {
    if (p.armor <= 0) {
      g.numbers.push({ x: p.x, y: p.y - 46, vy: -18, life: 1, max: 1, text: '没有护甲可修 · 先去合成一件', color: '#9aa0a6' });
      g.runEmeralds += cost;
      return;
    }
    p.armorDur = p.armorMax;
    g.numbers.push({ x: p.x, y: p.y - 48, vy: -18, life: 1.2, max: 1.2, text: '护甲耐久已修满', color: '#8ef0b0', big: true });
    g.audio.craft();
    return;
  }
  if (giveKind === 'wall') { p.walls += giveN; g.audio.craft(); return; }
  if (giveKind === 'apple') p.apples += giveN;
  else if (giveKind === 'emerald') g.runEmeralds += giveN;
  else if (giveKind === 'iron') p.iron += giveN;
  else if (giveKind === 'fireball') p.fireballs += giveN;
  else if (giveKind === 'growth') g.grantRandomGrowth();
  else p.potion = 'heal';
  g.audio.buy();
  burst(g, p.x, p.y - 16, 10, ['#f5d327', '#ffffff'], 80, -40, 2);
  g.numbers.push({ x: p.x, y: p.y - 48, vy: -18, life: 1.2, max: 1.2, text: `交易成功 · ${offer.label}`, color: '#f5d327', big: true });
}

export function updateGolems(g: Game, dt: number) {
  const p = g.player;
  for (const go of g.golems) {
    go.anim += dt;
    // 铁傀儡被怪围住时会掉血（伤害略高于打玩家，因为它就是肉盾）
    if (go.flash <= 0) {
      for (const z of g.zombies) {
        if (z.dead || z.stunT > 0) continue;
        if (Math.hypot(z.x - go.x, z.y - go.y) < z.r + 11) {
          go.hp -= Math.round(2.6 * (z.affix ? 1.4 : 1));
          go.flash = 0.5;
          burst(g, go.x, go.y - 12, 5, ['#e2e2e2', '#8a8a84'], 70, 60, 2);
          break;
        }
      }
    }
    go.swingT = Math.max(0, go.swingT - dt);
    go.flash = Math.max(0, go.flash - dt);
    let target: import('../types').ZombieState | null = null;
    let bd = 260;
    for (const z of g.zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - go.x, z.y - go.y);
      if (d < bd) {
        bd = d;
        target = z;
      }
    }
    let dx: number;
    let dy: number;
    let d: number;
    if (target) {
      dx = target.x - go.x;
      dy = target.y - go.y;
    } else {
      dx = p.x - go.x;
      dy = p.y - go.y;
    }
    d = Math.hypot(dx, dy) || 1;
    const move = target ? 1 : d > GOLEM.follow ? 1 : 0;
    if (move) {
      const nx = (dx / d) * GOLEM.speed * dt;
      const ny = (dy / d) * GOLEM.speed * dt;
      if (!world.solidAt(go.x + nx, go.y - 6)) go.x += nx;
      if (!world.solidAt(go.x, go.y - 6 + ny)) go.y += ny;
    }
    if (target && d < GOLEM.range + target.r && go.swingT <= 0) {
      go.swingT = GOLEM.cd;
      const ang = Math.atan2(dy, dx);
      const bossPen = target.kind.startsWith('boss') || target.kind === 'wither' ? 0.7 : 1;
      g.damageZombie(target, GOLEM.dmg * (g.growthLvl('golemMaster') > 0 ? 1.5 : 1) * bossPen, ang);
      target.vx += Math.cos(ang) * GOLEM.knockback;
      target.vy += Math.sin(ang) * GOLEM.knockback;
      g.audio.heavy();
    }
  }
  for (const go of g.golems) {
    if (go.hp > 0) continue;
    burst(g, go.x, go.y - 18, 18, ['#d8dce0', '#9aa0a8', '#6a7078'], 120, 220, 3);
    g.numbers.push({ x: go.x, y: go.y - 42, vy: -16, life: 1.4, max: 1.4, text: '铁傀儡被摧毁', color: '#9aa0a8' });
    g.audio.quake();
  }
  g.golems = g.golems.filter((go) => go.hp > 0);
}

export function updateCampfires(g: Game, dt: number) {
  const p = g.player;
  for (const c of g.campfires) {
    c.t += dt;
    if (g.rnd() < dt * 14) {
      g.particles.push({
        x: c.x + g.rndRange(-5, 5),
        y: c.y + g.rndRange(-2, 2),
        vx: g.rndRange(-6, 6),
        vy: g.rndRange(-44, -20),
        life: g.rndRange(0.4, 0.9),
        max: 0.9,
        color: g.rnd() < 0.5 ? '#ff9a3c' : '#ffd76b',
        size: 2,
        grav: -20,
      });
    }
    if (c.t >= c.max) continue;
    if (Math.hypot(p.x - c.x, p.y - c.y) < CAMPFIRE.radius) {
      c.heal -= dt;
      if (c.heal <= 0 && p.hp < p.maxHp) {
        c.heal = CAMPFIRE.healEvery * (g.growthLvl('campfireMaster') > 0 ? 0.5 : 1);
        p.hp = Math.min(p.maxHp, p.hp + CAMPFIRE.healAmt);
        burst(g, p.x, p.y - 16, 6, ['#6ee86e', '#d8ffa0'], 40, -50, 1);
      }
    }
  }
  g.campfires = g.campfires.filter((c) => c.t < c.max);
}
