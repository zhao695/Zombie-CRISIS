import { ARMOR, AXE, MACE, bossArmorMax, BOSS_CREEPER, BOSS_PHASE, BOW, COMBAT, CROSSBOW, DARK_WAVE, DROWNED, ELITES, ENCHANT_DEFS, FIREBALL, GOLEM, GUARDIAN, PILLAGER, PLAYER, POTION_DROPS, RAVAGER, ROD, SKELETON, SKILLS, SLOT_ORDER, SKY, STRAY, TILE, TNT, TRIDENT, VIEW_H, VIEW_W, WEAPONS, WEATHER, WITCH, clamp, rand } from './config';
import {
  drawArrow,
  drawAppleTree,
  drawAxeIcon,
  drawBowIcon,
  drawCampfire,
  drawChest,
  drawCrossbowIcon,
  drawMaceIcon,
  drawCrystal,
  drawDecor,
  drawDrop,
  drawFang,
  drawFireIcon,
  drawFireball,
  drawGolem,
  drawHeld,
  drawHook,
  drawPotion,
  drawRedstoneNode,
  drawResIcon,
  drawRodIcon,
  drawShadow,
  drawShrieker,
  drawSpinAxe,
  drawSteve,
  drawStoneNode,
  drawSupply,
  drawTiles,
  drawTntEntity,
  drawTntIcon,
  drawTrader,
  drawTrap,
  drawTridentIcon,
  drawWeaponIcon,
  drawZombie,
  makeHeart,
  makeSlot,
  rect,
} from './gfx';
import type { Game } from './game';
import type { GolemState, PlayerState, TraderState, ZombieState } from './types';
import { world } from './world';

interface Ent {
  y: number;
  z?: ZombieState;
  p?: PlayerState;
  go?: GolemState;
  tr?: TraderState;
}

const DANGER = '#ffb040';
const WEATHER_COLORS = ['#9fe8ff', '#a9b8d0', '#8fb0e0', '#6a8fd8', '#ffd24a'];

/** HUD 文本宽度估算（等宽英文 0.6em，中文 1em） */
function hudTextW(s: string, size: number) {
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) > 0x2e80 ? size : size * 0.6;
  return Math.ceil(w);
}

/** HUD 深色底衬：保证在草地上也读得清 */
function hudPlate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(8,10,16,0.58)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, y, 1, h);
}

/** 带描边的 HUD 小字（中文用雅黑/苹方，7px 等宽的中文会糊成一团） */
function hudTextSized(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  mono = false,
) {
  ctx.font = mono
    ? `bold ${size}px monospace`
    : `bold ${size}px "Microsoft YaHei","PingFang SC","Noto Sans SC",system-ui,sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function hudText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  hudTextSized(ctx, text, x, y, 8, color);
}

function hudNum(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 7) {
  hudTextSized(ctx, text, x, y, size, color, true);
}

/** 状态徽章（天气/护甲/狂化/药水），返回右边界 x */
function hudChip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, size = 8) {
  const w = Math.max(24, hudTextW(text, size) + 11);
  hudPlate(ctx, x, y, w, 13);
  // 左侧色条：让当前状态一眼可辨
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(x, y, 2, 13);
  ctx.globalAlpha = 1;
  hudTextSized(ctx, text, x + 5, y + 2, size, color);
  return x + w;
}

export class Renderer {
  fb = document.createElement('canvas');
  ctx: CanvasRenderingContext2D;
  private heartFull: HTMLCanvasElement;
  private heartHalf: HTMLCanvasElement;
  private heartEmpty: HTMLCanvasElement;
  private slot: HTMLCanvasElement;
  private minimap: HTMLCanvasElement;
  private vignette: CanvasGradient;
  private hurtVignette: CanvasGradient;

  constructor() {
    this.fb.width = VIEW_W;
    this.fb.height = VIEW_H;
    this.ctx = this.fb.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.heartFull = makeHeart('full');
    this.heartHalf = makeHeart('half');
    this.heartEmpty = makeHeart('empty');
    this.slot = makeSlot();

    this.minimap = document.createElement('canvas');
    this.minimap.width = world.tcols;
    this.minimap.height = world.trows;
    this.rebuildMinimap();

    this.vignette = this.ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 70, VIEW_W / 2, VIEW_H / 2, 300);
    this.vignette.addColorStop(0, 'rgba(0,0,0,0)');
    this.vignette.addColorStop(1, 'rgba(0,0,0,0.62)');
    this.hurtVignette = this.ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 140, VIEW_W / 2, VIEW_H / 2, 320);
    this.hurtVignette.addColorStop(0, 'rgba(190,0,0,0)');
    this.hurtVignette.addColorStop(1, 'rgba(190,0,0,0.6)');
  }

  rebuildMinimap() {
    const mg = this.minimap.getContext('2d')!;
    const img = mg.createImageData(this.minimap.width, this.minimap.height);
    for (let ty = 0; ty < world.trows; ty++) {
      for (let tx = 0; tx < world.tcols; tx++) {
        const i = (ty * world.tcols + tx) * 4;
        const ti = ty * world.tcols + tx;
        let r = 0x77;
        let gg = 0x77;
        let b = 0x77;
        if (world.walls.has(ti)) {
          r = 0x9a;
          gg = 0x74;
          b = 0x40;
        } else if (world.tiles[ti] === 1) {
          r = 0x3a;
          gg = 0x3a;
          b = 0x3a;
        } else if (world.cellKind[Math.floor(ty / 4) * world.cols + Math.floor(tx / 4)] === 2) {
          r = 0x5a;
          gg = 0x8a;
          b = 0x3a;
        }
        img.data[i] = r;
        img.data[i + 1] = gg;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    mg.putImageData(img, 0, 0);
  }

  draw(g: Game) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b0b10';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const sh = g.shake;
    const ox = Math.round(rand(-sh, sh) * 0.6);
    const oy = Math.round(rand(-sh, sh) * 0.6);
    const camX = Math.round(g.cam.x);
    const camY = Math.round(g.cam.y);
    const inView = (x: number, y: number, m: number) =>
      x > camX - m && x < camX + VIEW_W + m && y > camY - m && y < camY + VIEW_H + m;

    ctx.save();
    const zoom = g.zoomT > 0.01 ? 1 + g.zoomT * 0.05 : 1;
    if (zoom > 1) {
      ctx.translate(VIEW_W / 2, VIEW_H / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
    }
    ctx.translate(-camX + ox, -camY + oy);

    drawTiles(ctx, camX, camY, camX + VIEW_W, camY + VIEW_H);

    for (const d of world.decor) {
      if (!inView(d.x, d.y, 10)) continue;
      drawDecor(ctx, d.x, d.y, d.kind, g.time);
    }

    for (const cl of g.clouds) {
      if (!inView(cl.x, cl.y, cl.r + 40)) continue;
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#dfe8f2';
      ctx.beginPath();
      ctx.ellipse(cl.x, cl.y, cl.r, cl.r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const s of g.scorches) {
      const k = 1 - s.t / s.max;
      ctx.fillStyle = `rgba(24,20,18,${0.38 * k})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(10,8,8,${0.3 * k})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r * 0.6, s.r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const r of g.ripples) {
      if (!inView(r.x, r.y, 16)) continue;
      const k = r.t / r.max;
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.strokeStyle = '#bfe4ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 1.5 + k * 5, (1.5 + k * 5) * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const n of g.nodes) {
      if (!inView(n.x, n.y, 30)) continue;
      // 采集点高亮：地面光圈 + 头顶浮动标记，让矿点在草地里也能一眼看到
      const glowCol = n.kind === 'stone' ? '200,205,210' : n.kind === 'redstone' ? '230,60,60' : '120,220,90';
      const pulse = 0.16 + Math.sin(g.time * 2.4 + n.x * 0.05) * 0.06;
      ctx.fillStyle = `rgba(${glowCol},${pulse})`;
      ctx.beginPath();
      ctx.ellipse(n.x, n.y + 1, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      const my = n.y - 32 - Math.round(Math.sin(g.time * 3 + n.x * 0.07) * 2);
      if (n.kind === 'stone') {
        ctx.fillStyle = '#d8d8d2';
        ctx.fillRect(n.x - 2, my, 4, 3);
        ctx.fillRect(n.x - 1, my + 3, 2, 3);
      } else if (n.kind === 'redstone') {
        ctx.fillStyle = '#ff5a5a';
        ctx.fillRect(n.x - 3, my, 7, 2);
        ctx.fillRect(n.x - 1, my + 2, 3, 2);
      } else {
        ctx.fillStyle = '#7cbd3a';
        ctx.fillRect(n.x - 3, my, 7, 4);
        ctx.fillStyle = '#e8d06a';
        ctx.fillRect(n.x - 1, my + 1, 2, 2);
      }
      ctx.globalAlpha = 1;
      if (n.kind === 'stone') drawStoneNode(ctx, n.x, n.y, n.hp, n.maxHp, n.shake);
      else if (n.kind === 'redstone') drawRedstoneNode(ctx, n.x, n.y, n.hp, n.maxHp, n.shake);
      else drawAppleTree(ctx, n.x, n.y, n.hp, n.shake);
    }

    for (const c of g.chests) {
      if (!inView(c.x, c.y, 30)) continue;
      drawChest(ctx, c);
    }

    for (const cf of g.campfires) {
      if (!inView(cf.x, cf.y, 30)) continue;
      drawCampfire(ctx, cf);
    }

    for (const d of g.drops) {
      if (inView(d.x, d.y, 20)) drawDrop(ctx, d);
    }

    for (const s of g.supplies) {
      if (!inView(s.x, s.y, 50)) continue;
      drawShadow(ctx, s.x, s.y + (s.landed ? 3 : 14), s.landed ? 10 : 7);
      drawSupply(ctx, s.x, s.y, s.landed, s.fallT);
      if (s.landed) {
        const blink = Math.sin(g.time * 6) > 0 ? 1 : 0.3;
        ctx.globalAlpha = blink;
        ctx.strokeStyle = '#ffd24a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 6, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    for (const t of g.traps) {
      if (!inView(t.x, t.y, 26)) continue;
      drawTrap(ctx, t.x, t.y, t.armed, t.t);
    }

    for (const h of g.hooks) {
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#d8d4c8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g.player.x, g.player.y - 16);
      ctx.lineTo(h.x, h.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const t of g.tnts) {
      if (!inView(t.x, t.y, 20)) continue;
      drawShadow(ctx, t.x, t.y, 7);
      drawTntEntity(ctx, t);
    }

    for (const o of g.potions) {
      if (inView(o.tx, o.ty, 30)) {
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = DANGER;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(o.tx, o.ty, WITCH.splashR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if (inView(o.x, o.y, 20)) {
        drawShadow(ctx, o.x, o.y, 4);
        drawPotion(ctx, o);
      }
    }

    for (const h of g.hooks) {
      if (inView(h.x, h.y, 20)) drawHook(ctx, h.x, h.y);
    }

    for (const f of g.fireballs) {
      if (!inView(f.x, f.y, 20)) continue;
      drawFireball(ctx, f);
    }

    for (const dg of g.dashGhosts) {
      if (!inView(dg.x, dg.y, 30)) continue;
      ctx.globalAlpha = 0.4 * clamp(dg.t / dg.max, 0, 1);
      ctx.fillStyle = '#6ee7ff';
      rect(ctx, dg.x - 7, dg.y - 22, 14, 16, '#6ee7ff');
      rect(ctx, dg.x - 5, dg.y - 28, 10, 8, '#6ee7ff');
      ctx.globalAlpha = 1;
    }

    const ents: Ent[] = [];
    for (const f of g.fangs) {
      if (!inView(f.x, f.y, 20)) continue;
      drawFang(ctx, f.x, f.y, f.t / f.max);
    }
    for (const z of g.zombies) {
      if (inView(z.x, z.y, 40)) ents.push({ y: z.y, z });
    }
    for (const go of g.golems) {
      if (inView(go.x, go.y, 40)) ents.push({ y: go.y, go });
    }
    for (const tr of g.traders) {
      if (inView(tr.x, tr.y, 40)) ents.push({ y: tr.y, tr });
    }
    ents.push({ y: g.player.y, p: g.player });
    ents.sort((a, b) => a.y - b.y);

    for (const e of ents) {
      if (e.z) {
        const z = e.z;
        drawShadow(ctx, z.x, z.y, z.kind.startsWith('boss') ? z.r * 1.4 : z.r);
        if (z.affix === 'shimmer') {
          ctx.globalAlpha = 0.62 + Math.sin(g.time * 15 + z.x * 0.13) * 0.26;
          drawZombie(ctx, z);
          ctx.globalAlpha = 1;
        } else {
          drawZombie(ctx, z);
        }
        if (z.affix) {
          const el = ELITES.find((e) => e.id === z.affix);
          if (el) {
            // 头顶词缀符文：30 只怪里也能一眼认出精英
            const ry = z.y - z.r * 2 - (z.kind.startsWith('boss') ? 26 : 14);
            ctx.fillStyle = 'rgba(6,8,14,0.7)';
            ctx.fillRect(z.x - 5, ry - 5, 10, 10);
            ctx.strokeStyle = el.color;
            ctx.lineWidth = 1;
            ctx.strokeRect(z.x - 5.5, ry - 5.5, 11, 11);
            ctx.fillStyle = el.color;
            if (z.affix === 'burn') {
              ctx.fillRect(z.x - 1, ry - 3, 3, 6);
              ctx.fillRect(z.x - 1, ry + 1, 3, 2);
            } else if (z.affix === 'speedy') {
              ctx.fillRect(z.x - 3, ry, 3, 1);
              ctx.fillRect(z.x - 1, ry - 2, 3, 1);
              ctx.fillRect(z.x - 1, ry + 2, 3, 1);
              ctx.fillRect(z.x + 1, ry, 2, 1);
            } else if (z.affix === 'giant') {
              ctx.fillRect(z.x - 3, ry - 3, 7, 7);
              ctx.fillStyle = 'rgba(6,8,14,0.9)';
              ctx.fillRect(z.x - 1, ry - 1, 3, 3);
            } else if (z.affix === 'regen') {
              ctx.fillRect(z.x - 1, ry - 3, 3, 7);
              ctx.fillRect(z.x - 3, ry - 1, 7, 3);
            } else if (z.affix === 'frost') {
              ctx.fillRect(z.x - 1, ry - 3, 2, 7);
              ctx.fillRect(z.x - 3, ry - 1, 7, 2);
            } else if (z.affix === 'shimmer') {
              for (let i = 0; i < 3; i++) ctx.fillRect(z.x - 1, ry - 3 + i * 3, 2, 2);
            } else if (z.affix === 'split') {
              ctx.fillRect(z.x - 3, ry - 2, 3, 3);
              ctx.fillRect(z.x + 1, ry + 1, 3, 3);
            } else if (z.affix === 'vampire') {
              ctx.fillRect(z.x - 2, ry - 3, 4, 4);
              ctx.fillRect(z.x - 1, ry + 1, 2, 2);
            } else {
              // thunder
              ctx.fillRect(z.x - 3, ry - 3, 4, 2);
              ctx.fillRect(z.x - 1, ry - 1, 4, 2);
              ctx.fillRect(z.x - 3, ry + 1, 4, 2);
            }
          }
        }
        if (z.kind === 'bossCreeper' && z.fuse > 0) {
          const k = clamp(z.fuse / BOSS_CREEPER.fuseTime, 0, 1);
          ctx.globalAlpha = 0.2 + k * 0.3;
          ctx.strokeStyle = DANGER;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(z.x, z.y - 14, z.r + 8 + k * 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (z.kind.startsWith('boss') || z.kind === 'wither') {
          const k = clamp(z.hp / z.maxHp, 0, 1);
          // 头顶血条：按体型上移，别糊在大 BOSS 的身体里
          const barY = z.y - Math.max(52, z.r * z.scale * 2.2 + 8);
          rect(ctx, z.x - 20, barY, 40, 3, 'rgba(0,0,0,0.65)');
          rect(ctx, z.x - 20, barY, 40 * k, 3, '#e02626');
          // 巨型僵尸的外骨骼 / 凋灵的剩余头颅
          if (z.kind === 'boss' && z.armorHp > 0) {
            const ak = clamp(z.armorHp / Math.max(1, bossArmorMax(g.wave)), 0, 1);
            rect(ctx, z.x - 20, barY - 5, 40, 2, 'rgba(0,0,0,0.6)');
            rect(ctx, z.x - 20, barY - 5, 40 * ak, 2, z.exposeT > 0 ? '#ffb040' : '#8a9aa8');
          }
          if (z.kind === 'wither') {
            for (let i = 0; i < 3; i++) {
              rect(ctx, z.x - 12 + i * 9, barY - 6, 6, 3, i < z.headsLeft ? '#c06cff' : 'rgba(60,60,70,0.8)');
            }
          }
        }
        if (z.silenced > 0) {
          ctx.font = 'bold 7px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#c98af0';
          ctx.fillText('zZ', Math.round(z.x), Math.round(z.y - 40));
        }
        if (z.stunT > 0) {
          // 眩晕：头顶三颗旋转的小星星
          const t = g.time * 7;
          for (let i = 0; i < 3; i++) {
            const a = t + (i / 3) * Math.PI * 2;
            const sx = z.x + Math.cos(a) * 9;
            const sy = z.y - z.r * 2 - 4 + Math.sin(a) * 3;
            ctx.fillStyle = '#ffe066';
            ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 2, 2);
            ctx.fillStyle = 'rgba(255,255,220,0.8)';
            ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
          }
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
        }
      } else if (e.go) {
        drawShadow(ctx, e.go.x, e.go.y, 13);
        // 苦力怕伙伴（maxHp 22）用专属造型：绿色方块身体 + 四短腿 + 引信
        if (e.go.maxHp === 22) {
          const bx = Math.round(e.go.x);
          const by = Math.round(e.go.y);
          rect(ctx, bx - 8, by - 20, 16, 15, '#5a9a3a');
          rect(ctx, bx - 8, by - 20, 16, 3, '#7abd4a');
          rect(ctx, bx - 8, by - 6, 16, 2, '#3a6a26');
          rect(ctx, bx - 5, by - 16, 3, 3, '#1a2a12');
          rect(ctx, bx + 2, by - 16, 3, 3, '#1a2a12');
          rect(ctx, bx - 3, by - 11, 6, 3, '#1a2a12');
          rect(ctx, bx - 7, by - 5, 4, 5, '#4a8a2e');
          rect(ctx, bx + 3, by - 5, 4, 5, '#4a8a2e');
          const smoke = (Math.sin(e.go.anim * 6) + 1) / 2;
          rect(ctx, bx - 1, by - 24, 2, 4, '#c9c9c0');
          rect(ctx, bx - 1 + Math.round(smoke * 2) - 1, by - 27, 1, 3, 'rgba(220,220,210,0.6)');
        } else {
          drawGolem(ctx, e.go);
        }
        if (e.go.swingT > 0) {
          ctx.strokeStyle = 'rgba(255,240,220,0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(e.go.x, e.go.y - 22, GOLEM.range * 0.8, -0.9, 0.9);
          ctx.stroke();
        }
      } else if (e.tr) {
        drawShadow(ctx, e.tr.x, e.tr.y, 8);
        drawTrader(ctx, e.tr);
        if (Math.hypot(e.tr.x - g.player.x, e.tr.y - g.player.y) < 46) {
          const by = e.tr.y - 44 + Math.sin(g.time * 4) * 2;
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#101010';
          ctx.fillText('E 交易', Math.round(e.tr.x) + 1, Math.round(by) + 1);
          ctx.fillStyle = '#f5d327';
          ctx.fillText('E 交易', Math.round(e.tr.x), Math.round(by));
        }
      } else if (e.p) {
        const p = e.p;
        drawShadow(ctx, p.x, p.y, 9);
        if (p.combo >= COMBAT.comboBuffAt && p.moving) {
          const bx = Math.cos(p.aim);
          const by = Math.sin(p.aim);
          for (let i = 0; i < 3; i++) {
            const off = 11 + i * 5 + Math.sin(g.time * 22 + i * 2.1) * 2;
            const ex = Math.round(p.x - bx * off + rand(-1.5, 1.5));
            const ey = Math.round(p.y - by * off + rand(-1.5, 1.5));
            ctx.globalAlpha = 0.55 - i * 0.16;
            ctx.fillStyle = i === 0 ? '#ffd24a' : i === 1 ? '#ff9a3c' : '#ff5a2a';
            ctx.fillRect(ex - 1, ey - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
        if (p.buffT > 0) {
          const a = 0.35 + Math.sin(g.time * 9) * 0.18;
          ctx.strokeStyle = `rgba(255,214,60,${a})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(Math.round(p.x), Math.round(p.y) - 1, 13, 5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (p.slowT > 0) {
          ctx.strokeStyle = 'rgba(160,80,220,0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(Math.round(p.x), Math.round(p.y) - 1, 12, 5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (p.charge > 0 && p.slot === 0) {
          rect(ctx, p.x - 10, p.y - 32, 20, 3, 'rgba(0,0,0,0.6)');
          rect(ctx, p.x - 10, p.y - 32, 20 * p.charge, 3, p.charge >= 1 ? '#ffd24a' : '#c9a26b');
        }
        if (p.invuln > 0 && Math.floor(g.time * 22) % 2 === 0) ctx.globalAlpha = 0.4;
        const behind = Math.sin(p.aim) < 0;
        if (behind) drawHeld(ctx, p);
        drawSteve(ctx, p);
        if (!behind) drawHeld(ctx, p);
        drawSpinAxe(ctx, p);
        if (p.hurtT > 0) {
          ctx.globalAlpha = Math.min(0.9, p.hurtT * 2.6);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(Math.round(p.x), Math.round(p.y) - 12, 13, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    for (const z of g.zombies) {
      if (!inView(z.x, z.y, 380)) continue;
      if (z.kind === 'skeleton' && z.windup > 0) {
        const k = clamp(1 - z.windup / SKELETON.windup, 0, 1);
        ctx.globalAlpha = 0.1 + k * 0.2;
        ctx.strokeStyle = DANGER;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(z.x, z.y - 16);
        ctx.lineTo(g.player.x, g.player.y - 14);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if (z.kind === 'drowned' && z.windup > 0) {
        const k = clamp(1 - z.windup / DROWNED.windup, 0, 1);
        ctx.globalAlpha = 0.1 + k * 0.2;
        ctx.strokeStyle = DANGER;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(z.x, z.y - 16);
        ctx.lineTo(g.player.x, g.player.y - 14);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if (z.kind === 'witch' && z.windup > 0) {
        const k = clamp(1 - z.windup / WITCH.windup, 0, 1);
        ctx.globalAlpha = 0.15 + k * 0.25;
        ctx.strokeStyle = DANGER;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(z.tx, z.ty, WITCH.splashR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if ((z.kind === 'witherSkel' || z.kind === 'wither') && z.windup > 0) {
        const k = clamp(1 - z.windup / 0.5, 0, 1);
        ctx.globalAlpha = 0.15 + k * 0.3;
        ctx.strokeStyle = DANGER;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(z.x, z.y - 18);
        ctx.lineTo(g.player.x, g.player.y - 14);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if ((z.kind === 'stray' || z.kind === 'pillager') && z.windup > 0) {
        const col = z.kind === 'stray' ? '#9fd8ff' : '#d8c8a0';
        ctx.globalAlpha = 0.15 + Math.sin(g.time * 20) * 0.1;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(z.x, z.y - 16);
        ctx.lineTo(g.player.x, g.player.y - 14);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if (z.kind === 'guardian' && (z.windup > 0 || z.beamT > 0)) {
        const ox = z.x;
        const oy = z.y - 12;
        const rx = Math.cos(z.beamA);
        const ry = Math.sin(z.beamA);
        let len = GUARDIAN.beamLen;
        for (let s = 14; s < GUARDIAN.beamLen; s += 10) {
          if (world.solidAt(ox + rx * s, oy + ry * s)) {
            len = s;
            break;
          }
        }
        if (z.beamT > 0) {
          ctx.globalAlpha = 0.85;
          ctx.strokeStyle = '#5ad8ff';
          ctx.lineWidth = GUARDIAN.beamHalf * 1.4;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + rx * len, oy + ry * len);
          ctx.stroke();
          ctx.globalAlpha = 0.95;
          ctx.strokeStyle = '#e8feff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + rx * len, oy + ry * len);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          const k = clamp(1 - z.windup / GUARDIAN.windup, 0, 1);
          ctx.globalAlpha = 0.15 + k * 0.35;
          ctx.strokeStyle = '#5ad8ff';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 5]);
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + rx * len, oy + ry * len);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }
      if (z.kind === 'ravager' && z.crouch > 0) {
        const a = Math.atan2(g.player.y - z.y, g.player.x - z.x);
        ctx.globalAlpha = 0.18 + Math.sin(g.time * 22) * 0.1;
        ctx.strokeStyle = DANGER;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(z.x, z.y - 12);
        ctx.lineTo(z.x + Math.cos(a) * RAVAGER.chargeSpeed * RAVAGER.chargeTime, z.y - 12 + Math.sin(a) * RAVAGER.chargeSpeed * RAVAGER.chargeTime);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if ((z.kind === 'boss' && z.slamT > 0) || (z.kind === 'bossWarden' && z.crouch > 0)) {
        const k = z.kind === 'boss' ? clamp(1 - z.slamT / BOSS_PHASE.slamWindup, 0, 1) : clamp(1 - z.crouch / 0.45, 0, 1);
        ctx.globalAlpha = 0.25 + k * 0.4;
        ctx.strokeStyle = '#ffb040';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.ellipse(z.x, z.y, BOSS_PHASE.slamRadius, BOSS_PHASE.slamRadius * 0.72, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if (z.kind === 'bossDragon' && z.diveT > 0) {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#c06cff';
        ctx.beginPath();
        ctx.ellipse(z.x, z.y - 10, z.r * 1.2, z.r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (z.kind === 'bossWarden' && z.lockT > 0) {
        ctx.globalAlpha = 0.5 + Math.sin(g.time * 9) * 0.25;
        ctx.strokeStyle = '#7ad8ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(z.x, z.y - 30, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    for (const a of g.arrows) {
      if (!inView(a.x, a.y, 30)) continue;
      for (let i = 2; i >= 1; i--) {
        ctx.globalAlpha = 0.16 * i;
        ctx.strokeStyle = a.fromPlayer ? '#ffd9a0' : a.wither ? '#3a3a44' : a.slow ? '#9fd8ff' : '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x - a.vx * 0.016 * i, a.y - a.vy * 0.016 * i);
        ctx.lineTo(a.x, a.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.shadowColor = a.fromPlayer ? '#ffd76b' : a.wither ? '#b0b0ff' : a.slow ? '#9fd8ff' : '#ffffff';
      ctx.shadowBlur = 5;
      drawArrow(ctx, a);
      ctx.restore();
    }

    for (const s of g.slashes) {
      const k = 1 - s.t / s.max;
      ctx.globalAlpha = k * 0.8;
      ctx.strokeStyle = s.color ?? (g.player.swingKind === 'axe' ? '#ffd0a0' : '#ffffff');
      ctx.lineWidth = g.player.swingKind === 'axe' ? 4 : 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.range * 0.78, s.angle - s.arc / 2, s.angle + s.arc / 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const p of g.particles) {
      if (!inView(p.x, p.y, 10)) continue;
      ctx.globalAlpha = clamp(p.life / 0.25, 0, 1);
      rect(ctx, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.color);
    }
    ctx.globalAlpha = 1;

    // 龙息地火：高亮紫色方块区域（4x4 格 = 64x64）
    for (const zn of g.breathZones) {
      const bx = Math.round(zn.x - 32);
      const by = Math.round(zn.y - 32);
      ctx.globalAlpha = 0.28 + Math.sin(g.time * 9) * 0.08;
      ctx.fillStyle = '#a03fd8';
      ctx.fillRect(bx, by, 64, 64);
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#e0a0ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 0.5, by + 0.5, 63, 63);
      ctx.globalAlpha = 1;
      for (let i = 0; i < 7; i++) {
        const px = bx + 6 + ((i * 23 + Math.floor(g.time * 80)) % 52);
        const py = by + 8 + ((i * 17 + Math.floor(g.time * 46)) % 48);
        ctx.fillStyle = i % 2 === 0 ? '#c86cff' : '#7a2ab0';
        ctx.fillRect(px, py, 3, 3);
      }
    }

    for (const e of g.explosions) {
      if (!inView(e.x, e.y, e.r * 1.5 + 10)) continue;
      const k = e.t / e.max;
      const r = e.r * (0.35 + k * 0.9);
      ctx.save();
      ctx.shadowColor = '#ff8030';
      ctx.shadowBlur = 24 * (1 - k);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath();
      ctx.arc(e.x, e.y, Math.max(1, r * 0.55), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffb040';
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 1.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    for (const s of g.lightning) {
      if (!inView(s.x, s.y, 70)) continue;
      if (!s.struck) {
        const k = clamp(1 - s.t / s.max, 0, 1);
        const r = WEATHER.strikeRadius * (0.35 + 0.65 * k);
        ctx.globalAlpha = 0.3 + 0.45 * (Math.sin(g.time * 18) > 0 ? 0.6 : 0);
        ctx.strokeStyle = '#ffd24a';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      } else if (s.t > 0) {
        const k = clamp(s.t / 0.3, 0, 1);
        ctx.globalAlpha = k;
        ctx.save();
        ctx.shadowColor = '#cfe4ff';
        ctx.shadowBlur = 16;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const a0 = (i / 5) * Math.PI * 2 + 0.3;
          ctx.beginPath();
          let px = s.x;
          let py = s.y;
          ctx.moveTo(px, py);
          for (let seg = 0; seg < 3; seg++) {
            px += Math.cos(a0 + rand(-0.6, 0.6)) * 12;
            py += Math.sin(a0 + rand(-0.6, 0.6)) * 12;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.strokeStyle = '#fff6c8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 9 * k, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    if (g.placeTarget.active) {
      const t = g.placeTarget;
      const gx = t.tx * TILE;
      const gy = t.ty * TILE;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = t.ok ? '#6ee86e' : '#ff5a4a';
      ctx.fillRect(gx, gy, TILE, TILE);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = t.ok ? '#a8ffa8' : '#ff9a8a';
      ctx.lineWidth = 2;
      ctx.strokeRect(gx + 0.5, gy + 0.5, TILE - 1, TILE - 1);
      ctx.globalAlpha = 1;
    }

    // ── BOSS 领域：水晶 / 尖啸体 / 外面压暗 / 边界光墙 ──
    if (g.domain) {
      const d = g.domain;
      const x0 = (d.cx - d.halfW) * TILE;
      const y0 = (d.cy - d.halfH) * TILE;
      const w = (d.halfW * 2 + 1) * TILE;
      const h = (d.halfH * 2 + 1) * TILE;
      for (const c of g.crystals) if (!c.dead) drawCrystal(ctx, c);
      for (const s of g.shriekers) drawShrieker(ctx, s, g.time);
      // 领域外压暗：把注意力锁在战场里
      ctx.fillStyle = 'rgba(6,4,14,0.62)';
      const vx0 = camX;
      const vy0 = camY;
      const vx1 = camX + VIEW_W;
      const vy1 = camY + VIEW_H;
      if (y0 > vy0) ctx.fillRect(vx0, vy0, vx1 - vx0, y0 - vy0);
      if (y0 + h < vy1) ctx.fillRect(vx0, y0 + h, vx1 - vx0, vy1 - (y0 + h));
      if (x0 > vx0) {
        const ty0 = Math.max(vy0, y0);
        const ty1 = Math.min(vy1, y0 + h);
        if (ty1 > ty0) ctx.fillRect(vx0, ty0, x0 - vx0, ty1 - ty0);
      }
      if (x0 + w < vx1) {
        const ty0 = Math.max(vy0, y0);
        const ty1 = Math.min(vy1, y0 + h);
        if (ty1 > ty0) ctx.fillRect(x0 + w, ty0, vx1 - (x0 + w), ty1 - ty0);
      }
      // 边界能量墙
      const pulse = 0.55 + Math.sin(g.time * 4) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = d.kind === 'dragon' ? '#c06cff' : d.kind === 'warden' ? '#7ad8ff' : '#ff8a4a';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.lineDashOffset = -g.time * 26;
      ctx.strokeRect(x0 + 4, y0 + 4, w - 8, h - 8);
      ctx.setLineDash([]);
      ctx.globalAlpha = pulse * 0.22;
      ctx.lineWidth = 6;
      ctx.strokeRect(x0 + 4, y0 + 4, w - 8, h - 8);
      ctx.globalAlpha = 1;
    }

    if (g.numbers.length > 0) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const n of g.numbers) {
        if (!inView(n.x, n.y, 30)) continue;
        ctx.font = n.big ? 'bold 13px monospace' : 'bold 9px monospace';
        ctx.globalAlpha = clamp(n.life / 0.3, 0, 1);
        ctx.fillStyle = '#101010';
        ctx.fillText(n.text, Math.round(n.x) + 1, Math.round(n.y) + 1);
        ctx.fillStyle = n.color;
        ctx.fillText(n.text, Math.round(n.x), Math.round(n.y));
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    const wl = g.weather;
    // 玩家在世界中的屏幕坐标（相机左上角 + 震屏偏移），光斑要跟着小人走
    const lpx = g.player.x - camX + ox;
    const lpy = g.player.y - camY + oy;
    // 压暗层：玩家周围留一圈正常亮度的“光斑”，避免黑夜天气下看不清自己
    const shade = (radius: number, rgb: string, alpha: number, inner = 0.45) => {
      const grad = ctx.createRadialGradient(lpx, lpy, radius * inner, lpx, lpy, radius);
      grad.addColorStop(0, `rgba(${rgb},0)`);
      grad.addColorStop(0.6, `rgba(${rgb},${(alpha * 0.4).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${rgb},${alpha.toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    };
    if (wl > 0.25) shade(150, '26,36,64', Math.min(0.3, (wl - 0.25) * 0.085));
    // 特殊天象：浓雾 / 沙尘暴 / 血月
    if (g.sky === 'fog') {
      shade(SKY.fogRadius, '176,184,192', 0.66);
    } else if (g.sky === 'sand') {
      shade(SKY.sandRadius, '190,158,96', 0.68);
    } else if (g.sky === 'blood') {
      ctx.fillStyle = 'rgba(96,8,16,0.16)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (wl >= 1.2) {
      const it = wl >= 3.4 ? 1 : (wl - 1.2) / 2.2;
      const n = Math.round(22 + it * 66);
      const speed = 320 + wl * 46;
      ctx.strokeStyle = `rgba(165,195,240,${0.22 + it * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x0 = ((i * 61.7 + Math.sin(i * 12.9 + g.time * 1.3) * 26) % (VIEW_W + 60)) - 30;
        const y0 = ((i * 113.3 + g.time * speed) % (VIEW_H + 70)) - 35;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 - 2.4, y0 + 6);
      }
      ctx.stroke();
    }

    // 沙尘暴：横向飞沙
    if (g.sky === 'sand') {
      ctx.strokeStyle = 'rgba(232,206,140,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 46; i++) {
        const x0 = ((i * 73 + g.time * 420) % (VIEW_W + 90)) - 45;
        const y0 = (i * 47.3 + Math.sin(i * 7.1 + g.time * 2) * 14) % VIEW_H;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + 9 + (i % 5), y0 + 1);
      }
      ctx.stroke();
    }
    // 浓雾：缓慢飘动的雾团
    if (g.sky === 'fog') {
      for (let i = 0; i < 5; i++) {
        const fx = ((i * 137 + g.time * 22) % (VIEW_W + 200)) - 100;
        const fy = 40 + ((i * 53) % 190);
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#dfe6ee';
        ctx.beginPath();
        ctx.ellipse(fx, fy, 70, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const dark = clamp((g.wave - 1) * 0.022, 0, 0.4);
    if (dark > 0) shade(145, '10,16,44', dark);
    if (g.darkK > 0.01 && g.phase === 'play') {
      shade(DARK_WAVE.lightRadius, '3,3,12', 0.88 * g.darkK);
    }
    const hpFrac = g.player.hp / g.player.maxHp;
    if (g.phase === 'play' && hpFrac > 0 && hpFrac <= 0.35) {
      const pulse = 0.3 + Math.sin(g.time * 5) * 0.12;
      ctx.globalAlpha = pulse * ((0.35 - hpFrac) / 0.35);
      ctx.fillStyle = this.hurtVignette;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
    if (g.flash > 0) {
      ctx.globalAlpha = Math.min(1, g.flash * 1.2);
      ctx.fillStyle = this.hurtVignette;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }

    if (g.phase === 'play' || g.phase === 'pause') this.drawHud(g);
  }

  private drawHud(g: Game) {
    const ctx = this.ctx;
    const p = g.player;

    if (g.wallDirty) {
      this.rebuildMinimap();
      g.wallDirty = false;
    }

    for (let i = 0; i < 10; i++) {
      const v = p.hp - i * 2;
      const img = v >= 2 ? this.heartFull : v >= 1 ? this.heartHalf : this.heartEmpty;
      ctx.drawImage(img, 10 + i * 10, 8);
    }

    // ── 第一行左：生命 + 天气 + 护甲（靠左，不越过屏幕中线） ──
    let bx = 113;
    const wIdx = Math.round(clamp(g.weather, 0, 4));
    bx = hudChip(ctx, bx, 6, WEATHER.names[wIdx], WEATHER_COLORS[wIdx], 8) + 3;
    if (g.sky !== 'none') {
      const skyColor = g.sky === 'fog' ? '#dfe6ee' : g.sky === 'sand' ? '#e8ce8c' : '#ff6a6a';
      bx = hudChip(ctx, bx, 6, SKY.names[g.sky], skyColor, 8) + 3;
    }
    if (g.horde) bx = hudChip(ctx, bx, 6, '狂潮', '#ff8a4a', 8) + 3;
    if (p.armor > 0) {
      const t = ARMOR.tiers[p.armor - 1];
      bx = hudChip(ctx, bx, 6, `${t.name} ${Math.round(t.red * 100)}%`, t.color) + 3;
    }

    // ── 第一行右：药水 / 狂化 / 附魔，右对齐，避开暂停按钮 ──
    let rx = VIEW_W - 32;
    if (g.enchants.length > 0) {
      for (const id of g.enchants) {
        const def = ENCHANT_DEFS.find((e) => e.id === id);
        if (!def) continue;
        rx -= 15;
        hudPlate(ctx, rx, 5, 13, 13);
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#c06cff';
        ctx.fillText(def.icon, rx + 6, 12);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      rx -= 2;
    }
    const rightBadges: { text: string; color: string }[] = [];
    if (p.buffT > 0) rightBadges.push({ text: `狂化 ${p.buffT.toFixed(1)}s`, color: '#ffd93b' });
    if (p.potion) {
      const pot = POTION_DROPS.find((o) => o.id === p.potion);
      rightBadges.push({ text: pot ? pot.name : '药水', color: pot ? pot.color : '#9fe8ff' });
    }
    for (const b of rightBadges) {
      const w = Math.max(24, hudTextW(b.text, 8) + 11);
      rx -= w + 3;
      hudChip(ctx, rx, 6, b.text, b.color);
    }

    // ── 第二行：资源条（只显示非 0，带按键提示） ──
    type ResKind = Parameters<typeof drawResIcon>[1];
    const allRes: { kind: ResKind; n: number; key?: string; color: string }[] = [
      { kind: 'stone', n: p.stone, key: 'C', color: '#d8d8d4' },
      { kind: 'apple', n: p.apples, key: 'F', color: '#ffd76b' },
      { kind: 'powder', n: p.gunpowder, key: 'V', color: '#c6c6be' },
      { kind: 'eye', n: p.eyes, key: 'T', color: '#d06cff' },
      { kind: 'wall', n: p.walls, key: 'Q', color: '#c9a26b' },
      { kind: 'redstone', n: p.redstone, key: 'G', color: '#ff6a6a' },
      { kind: 'trap', n: p.traps, key: 'G', color: '#ff9a8a' },
      { kind: 'fire', n: p.fireballs, key: '6', color: '#ff9a3c' },
      { kind: 'iron', n: p.iron, color: '#e2e2e2' },
      { kind: 'gold', n: p.gold, color: '#f5d327' },
      { kind: 'diamond', n: p.diamond, color: '#4aedd9' },
      { kind: 'coal', n: p.coal, color: '#a8a8b0' },
      { kind: 'goldapple', n: p.goldApples, color: '#f5d327' },
      { kind: 'eapple', n: p.eapples, color: '#c06cff' },
      { kind: 'emerald', n: g.runEmeralds, color: '#6ee86e' },
    ];
    const res = allRes.filter((r) => r.n > 0);

    if (res.length > 0) {
      const rx0 = 8;
      const ry = 31;
      let sx = rx0 + 5;
      const placed: { r: (typeof res)[number]; x: number; w: number }[] = [];
      for (const r of res) {
        const numW = hudTextW(`${r.n}`, 7);
        const w = 12 + numW + (r.key ? 8 : 0) + 5;
        if (sx + w > VIEW_W - 176) break; // 给右侧「种子·难度」留位
        placed.push({ r, x: sx, w });
        sx += w;
      }
      const more = res.length - placed.length;
      const total = sx - rx0 + (more > 0 ? 16 : 1);
      hudPlate(ctx, rx0, ry, total, 15);
      for (const it of placed) {
        drawResIcon(ctx, it.r.kind, it.x, ry + 3);
        const numW = hudTextW(`${it.r.n}`, 7);
        hudNum(ctx, `${it.r.n}`, it.x + 12, ry + 4, it.r.color);
        if (it.r.key) hudNum(ctx, it.r.key, it.x + 12 + numW + 3, ry + 4, '#8fd6ff', 6.5);
      }
      if (placed.length < res.length) hudNum(ctx, `+${res.length - placed.length}`, sx + 2, ry + 4, '#8a8a92');
    } else if (!g.tutDone) {
      hudPlate(ctx, 8, 31, 148, 15);
      hudText(ctx, '采石头 / 摘苹果后显示资源', 13, 35, '#7f8794');
    }

    // ── 第三行：按键引导（回血 / 建造 / 传送 / 合成 / 技能） ──
    const hints: [string, string][] = [
      ['F', '回血'],
      ['Q', '建墙'],
      ['T', '传送'],
      ['C', '合成'],
      ['R', '技能'],
    ];
    let hx = 8;
    for (const [k, label] of hints) {
      ctx.font = 'bold 7px "Microsoft YaHei","PingFang SC",sans-serif';
      const kw = 8;
      const lw = label.length * 7 + 3;
      hudPlate(ctx, hx, 48, kw + lw, 12);
      ctx.fillStyle = '#9fe8ff';
      ctx.fillRect(hx + 1, 49, kw + 0.5, 9);
      ctx.fillStyle = '#0c1018';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(k, hx + kw / 2 + 0.5, 54);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#d8d8dc';
      ctx.fillText(label, hx + kw + 2, 54.5);
      hx += kw + lw + 3;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // ── 第四行：连击 ──
    if (p.combo >= 3) {
      const mul = 1 + Math.min(p.combo, 40) * 0.0125;
      const hot = mul >= 1.35;
      const txt = `x${mul.toFixed(2)}  连击 ${p.combo}`;
      const w = hudTextW(txt, 8) + 10;
      hudPlate(ctx, 8, 64, w, 14);
      hudText(ctx, txt, 12, 65, hot ? '#ff9a3c' : '#ffd24a');
      const k = clamp(p.comboT / 3, 0, 1);
      rect(ctx, 10, 75, w - 6, 2, 'rgba(0,0,0,0.55)');
      rect(ctx, 10, 75, (w - 6) * k, 2, hot ? '#ff9a3c' : '#ffd24a');
    }

    this.drawMinimap(g);
    this.drawHotbar(g);

    const dp = 1 - p.dashCd / PLAYER.dashCd;
    rect(ctx, 10, VIEW_H - 13, 42, 4, 'rgba(0,0,0,0.6)');
    rect(ctx, 10, VIEW_H - 13, 42 * clamp(dp, 0, 1), 4, dp >= 1 ? '#6ee7ff' : '#2a6f8a');

    if (g.stallTimer > 2 && g.zombies.length > 0) {
      let bz = g.zombies[0];
      let bd = Infinity;
      for (const z of g.zombies) {
        if (z.dead) continue;
        const d = Math.hypot(z.x - p.x, z.y - p.y);
        if (d < bd) {
          bd = d;
          bz = z;
        }
      }
      const a = Math.atan2(bz.y - p.y, bz.x - p.x);
      const ex = clamp(VIEW_W / 2 + Math.cos(a) * 170, 24, VIEW_W - 24);
      const ey = clamp(VIEW_H / 2 + Math.sin(a) * 105, 30, VIEW_H - 30);
      if (Math.sin(g.time * 8) > 0) {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = '#ff5a4a';
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(-4, -5);
        ctx.lineTo(-1, 0);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawMinimap(g: Game) {
    const ctx = this.ctx;
    // 缩放显示：原尺寸会吃掉四分之一屏幕
    const ms = g.touchUI ? 0.4 : 0.55;
    const mw = Math.round(world.tcols * ms);
    const mh = Math.round(world.trows * ms);
    const mx = VIEW_W - mw - 6;
    // 手机端：小地图放右上，避免和右下操作键打架
    const my = g.touchUI ? 4 : VIEW_H - mh - 10;
    ctx.globalAlpha = 0.72;
    ctx.drawImage(this.minimap, mx, my, mw, mh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(8,10,16,0.35)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 0.5, my - 0.5, mw + 1, mh + 1);
    for (const z of g.zombies) {
      const zx = Math.round(mx + (z.x / TILE) * ms);
      const zy = Math.round(my + (z.y / TILE) * ms);
      if (z.kind.startsWith('boss') || z.kind === 'wither') rect(ctx, zx - 1, zy - 1, 3, 3, '#ff8a30');
      else rect(ctx, zx, zy, 1, 1, '#e04040');
    }
    rect(ctx, Math.round(mx + (g.player.x / TILE) * ms), Math.round(my + (g.player.y / TILE) * ms), 2, 2, '#ffffff');
  }

  private drawHotbar(g: Game) {
    const ctx = this.ctx;
    const p = g.player;
    const SLOTS = 9;
    const barW = SLOTS * 24 - 2;
    const x0 = Math.round((VIEW_W - barW) / 2);
    const y0 = VIEW_H - 26;

    const w = WEAPONS[p.weapon];
    const nx = WEAPONS[p.weapon + 1];
    rect(ctx, x0, y0 - 7, barW, 4, 'rgba(0,0,0,0.65)');
    if (nx) {
      const pr = clamp((g.kills - w.kills) / (nx.kills - w.kills), 0, 1);
      rect(ctx, x0, y0 - 7, barW * pr, 4, '#f5d327');
    } else {
      rect(ctx, x0, y0 - 7, barW, 4, '#4aedd9');
    }

    const cds = [
      p.swingCd / WEAPONS[p.weapon].cd,
      p.bowCd / BOW.cd,
      Math.max(p.swingCd / AXE.cd, p.axeCd / AXE.spinCd),
      p.rodCd / ROD.cd,
      p.tntCd / TNT.cd,
      p.fireCd / FIREBALL.cd,
      p.bowCd / TRIDENT.cd,
      p.bowCd / CROSSBOW.cd,
      p.swingCd / MACE.cd,
    ];

    for (let i = 0; i < SLOTS; i++) {
      const si = SLOT_ORDER[i] ?? i;
      const x = x0 + i * 24;
      const y = y0;
      ctx.drawImage(this.slot, x, y);

      if (si === 0) drawWeaponIcon(ctx, p.weapon, x + 2, y + 2);
      else if (si === 1) drawBowIcon(ctx, x + 2, y + 1);
      else if (si === 2) drawAxeIcon(ctx, x + 2, y + 2);
      else if (si === 3) drawRodIcon(ctx, x + 2, y + 2);
      else if (si === 4) drawTntIcon(ctx, x + 2, y + 3);
      else if (si === 5) drawFireIcon(ctx, x + 3, y + 3);
      else if (si === 6) drawTridentIcon(ctx, x + 2, y + 1);
      else if (si === 7) drawCrossbowIcon(ctx, x + 1, y + 2);
      else drawMaceIcon(ctx, x + 1, y + 1);

      if (si === 4 || si === 5) {
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#101010';
        ctx.fillText(`${i === 4 ? p.tntAmmo : p.fireballs}`, x + 19, y + 20);
        ctx.fillStyle = i === 4 ? '#ffb060' : '#ff9a3c';
        ctx.fillText(`${i === 4 ? p.tntAmmo : p.fireballs}`, x + 18, y + 19);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
      }

      if (si > 0 && !g.unlocked(si)) {
        const pr = clamp(g.kills / g.unlockNeed(si), 0, 1);
        rect(ctx, x + 1, y + 19 - 18 * pr, 18, 18 * pr, 'rgba(40,120,140,0.5)');
        rect(ctx, x + 1, y + 1, 18, 18, 'rgba(0,0,0,0.4)');
        ctx.globalAlpha = 0.5;
        rect(ctx, x + 8, y + 7, 4, 5, '#d8d8d8');
        rect(ctx, x + 7, y + 4, 1, 4, '#c9c9c9');
        rect(ctx, x + 12, y + 4, 1, 4, '#c9c9c9');
        rect(ctx, x + 8, y + 3, 4, 1, '#c9c9c9');
        ctx.globalAlpha = 1;
      } else {
        const k = clamp(cds[si] ?? 0, 0, 1);
        if (k > 0.02) rect(ctx, x + 1, y + 19 - 18 * k, 18, 18 * k, 'rgba(0,0,0,0.45)');
      }

      // 武器线等级：右下角小标
      if (si > 0 && g.unlocked(si)) {
        const lv = g.weaponLvl(si);
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(x + 12, y + 14, 7, 6);
        ctx.fillStyle = lv >= 4 ? '#ffd76b' : lv >= 3 ? '#8ef0b0' : '#9fe8ff';
        ctx.fillText(`${lv}`, x + 19, y + 20);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
      }
      if (p.spinT > 0 && si === 2) {
        ctx.strokeStyle = '#ffb040';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 0.5, y + 0.5, 19, 19);
      }
    }

    const sel = x0 + Math.max(0, SLOT_ORDER.indexOf(p.slot)) * 24;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(sel + 1, y0 + 1, 19, 19);

    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(20,20,20,0.85)';
    for (let i = 0; i < SLOTS; i++) {
      ctx.fillText(`${i + 1}`, x0 + i * 24 + 4, y0 + 3);
    }

    // 武器技能（R）：名字 + 冷却条，放在快捷栏正上方
    const sk = SKILLS[p.slot];
    if (sk) {
      const label = p.skillCd > 0 ? `${sk.name}  ${p.skillCd.toFixed(1)}s` : `R  ${sk.name}`;
      const ready = p.skillCd <= 0;
      ctx.font = 'bold 7px "Microsoft YaHei","PingFang SC",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const tw = label.length * 6.4 + 14;
      hudPlate(ctx, VIEW_W / 2 - tw / 2, y0 - 21, tw, 13);
      ctx.fillStyle = ready ? '#ffd76b' : '#8a8a92';
      ctx.fillText(label, VIEW_W / 2, y0 - 17);
      if (!ready) {
        const k = clamp(1 - p.skillCd / sk.cd, 0, 1);
        rect(ctx, VIEW_W / 2 - tw / 2 + 1, y0 - 10, (tw - 2) * k, 1.5, '#ffd76b');
      }
      ctx.textAlign = 'left';
    }
  }
}
