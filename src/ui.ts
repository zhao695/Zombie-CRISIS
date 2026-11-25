import { ARMOR, CAMPFIRE, GATHER, GOLEM, GROWTHS, JOBS, MAPS, POTION_DROPS, REDSTONE, TRADER, TUTORIAL, VIEW_H, VIEW_W, ZOMBIES } from './config';
import { ACHIEVEMENTS, RELICS, UPGRADES, upgradeCost } from './meta';
import { dailyKey, weekKey } from './save';
import type { Game } from './game';
import type { Input } from './input';

function setFont(ctx: CanvasRenderingContext2D, sizePx: number, weight = '800') {
  ctx.font = `${weight} ${Math.round(sizePx)}px "PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif`;
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'left',
  outline = 0,
) {
  setFont(ctx, size);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (outline > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillText(text, x - outline, y);
    ctx.fillText(text, x + outline, y);
    ctx.fillText(text, x, y - outline);
    ctx.fillText(text, x, y + outline);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(text, x + size * 0.05, y + size * 0.06);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function drawMapPreview(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(158,168,190,0.55)';
  ctx.fillStyle = 'rgba(158,168,190,0.28)';
  const X = (t: number) => x + t * w;
  const Y = (t: number) => y + t * h;
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(X(x1), Y(y1));
    ctx.lineTo(X(x2), Y(y2));
    ctx.stroke();
  };
  const box = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.rect(X(x1), Y(y1), (x2 - x1) * w, (y2 - y1) * h);
    ctx.stroke();
  };
  if (id === 'plains') {
    box(0.12, 0.25, 0.24, 0.45);
    box(0.62, 0.18, 0.72, 0.34);
    box(0.4, 0.62, 0.52, 0.78);
    ctx.beginPath();
    ctx.arc(X(0.83), Y(0.7), w * 0.045, 0, Math.PI * 2);
    ctx.stroke();
  } else if (id === 'fortress') {
    for (let i = 1; i < 4; i++) line(i / 4, 0, i / 4, 1);
    line(0, 0.5, 1, 0.5);
    ctx.fillRect(X(0.05), Y(0.08), w * 0.13, h * 0.3);
    ctx.fillRect(X(0.55), Y(0.1), w * 0.16, h * 0.26);
    ctx.fillRect(X(0.3), Y(0.62), w * 0.15, h * 0.28);
  } else if (id === 'forest') {
    const pts: [number, number][] = [
      [0.15, 0.2], [0.35, 0.15], [0.55, 0.3], [0.75, 0.18], [0.25, 0.55], [0.5, 0.6], [0.7, 0.5], [0.87, 0.68],
      [0.18, 0.82], [0.4, 0.78], [0.62, 0.85], [0.78, 0.77], [0.32, 0.4], [0.47, 0.42], [0.66, 0.36],
    ];
    for (const [px, py] of pts) {
      ctx.beginPath();
      ctx.moveTo(X(px), Y(py) - h * 0.06);
      ctx.lineTo(X(px) - w * 0.035, Y(py) + h * 0.06);
      ctx.lineTo(X(px) + w * 0.035, Y(py) + h * 0.06);
      ctx.closePath();
      ctx.stroke();
    }
  } else if (id === 'arena') {
    for (let r = 1; r <= 3; r++) {
      const rr = Math.min(w, h) * (0.13 * r + 0.03);
      const a0 = 0.4 + r * 0.85;
      ctx.beginPath();
      ctx.arc(X(0.5), Y(0.5), rr, a0, a0 + Math.PI * 1.45);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(X(0.5), Y(0.5), w * 0.03, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    line(0.1, 0, 0.1, 0.62);
    line(0.1, 0.62, 0.4, 0.62);
    line(0.4, 0, 0.4, 0.3);
    line(0.4, 0.3, 0.62, 0.3);
    line(0.62, 0.3, 0.62, 1);
    line(0.12, 0.62, 0.12, 1);
    line(0.35, 0.62, 0.35, 1);
    line(0.62, 0.55, 0.88, 0.55);
    line(0.88, 0, 0.88, 0.55);
    line(0.62, 0.78, 0.9, 0.78);
  }
  ctx.restore();
}

function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, cross: boolean) {
  if (cross) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(2, u * 0.55);
    const gap = 5 * u;
    const len = 8 * u;
    ctx.beginPath();
    ctx.moveTo(x - gap - len, y);
    ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y);
    ctx.lineTo(x + gap + len, y);
    ctx.moveTo(x, y - gap - len);
    ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap);
    ctx.lineTo(x, y + gap + len);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(Math.round(x - u), Math.round(y - u), Math.round(u * 2), Math.round(u * 2));
  } else {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 9 * u);
    ctx.lineTo(2.4 * u, 7 * u);
    ctx.lineTo(4.2 * u, 10.5 * u);
    ctx.lineTo(6 * u, 9.6 * u);
    ctx.lineTo(4.2 * u, 6.4 * u);
    ctx.lineTo(7.4 * u, 6.4 * u);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
}

export function drawOverlay(ctx: CanvasRenderingContext2D, u: number, g: Game, input: Input) {
  const W = VIEW_W * u;
  const H = VIEW_H * u;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;

  const blink = 0.55 + 0.45 * Math.sin(performance.now() / 260);

  if (g.phase === 'play' || g.phase === 'pause' || g.phase === 'over') {
    label(ctx, `第 ${g.wave} 波`, W / 2, 24 * u, 10 * u, '#f4f4f4', 'center', Math.max(1, u * 0.5));
    label(ctx, `经验 ${g.kills}`, W - 12 * u, 24 * u, 8.5 * u, '#ffd76b', 'right');
    if (g.phase !== 'over') {
      label(ctx, `${g.dailyMode ? '每日 · ' : ''}种子 ${g.seed} · ${g.diffDef().name}`, W - 12 * u, 38 * u, 7 * u, '#8a8a9a', 'right');
    }

    if (g.phase === 'play' && g.waveActive && g.waveT > 0 && g.waveT <= 11) {
      const left = g.zombies.reduce((n, z) => (z.dead ? n : n + 1), 0);
      const txt = left > 0 ? `剩 ${left} 只 · 下一波 ${Math.ceil(g.waveT)}` : `下一波 ${Math.ceil(g.waveT)}`;
      label(ctx, txt, W / 2, 38 * u, 8 * u, '#9fe8ff', 'center');
    }

    if (g.phase === 'play' && !g.craftMenu && !g.tradeMenu) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(W - 26 * u, 5 * u, 18 * u, 13 * u);
      ctx.strokeStyle = 'rgba(159,232,255,0.6)';
      ctx.lineWidth = Math.max(1, u * 0.6);
      ctx.strokeRect(W - 26 * u, 5 * u, 18 * u, 13 * u);
      label(ctx, 'Ⅱ', W - 17 * u, 15 * u, 7 * u, '#9fe8ff', 'center');
    }

    // 临时提示（反软锁 / 放置模式）：统一用深色底条，避免直接压在世界画面上看不清
    const drawHint = (text: string, color: string) => {
      setFont(ctx, 8 * u, '700');
      const tw = ctx.measureText(text).width;
      const bx = W / 2 - tw / 2 - 8 * u;
      ctx.fillStyle = 'rgba(6,10,18,0.72)';
      ctx.fillRect(bx, 50 * u, tw + 16 * u, 15 * u);
      ctx.fillStyle = color;
      ctx.fillRect(bx, 50 * u, 2 * u, 15 * u);
      label(ctx, text, W / 2, 61 * u, 8 * u, color, 'center');
    };

    if (g.phase === 'play' && g.stallTimer > 2) {
      drawHint(`还有 ${g.zombies.length} 个敌人没找到 · 已标出方向`, '#ff7a6a');
    }

    if (g.phase === 'play' && g.player.placing) {
      const isWall = g.player.placingKind === 'wall';
      drawHint(
        isWall
          ? `放置模式 · 左键放墙 (${g.wallCost()}石) · Q/G 切换 · 右键退出`
          : '放置模式 · 左键放红石陷阱 · Q/G 切换 · 右键退出',
        isWall ? '#e0b060' : '#ff7a6a',
      );
    }

    if (g.phase === 'play' && !g.tutDone && !g.craftMenu && !g.tradeMenu) {
      const step = g.tutStep < TUTORIAL.steps.length ? TUTORIAL.steps[g.tutStep] : '';
      if (step) {
        // 挪到左下角，避开顶部波次横幅与 HUD
        const tw = Math.max(96 * u, step.length * 7.4 * u);
        ctx.fillStyle = 'rgba(6,10,18,0.72)';
        ctx.fillRect(8 * u, 212 * u, tw + 14 * u, 14 * u);
        ctx.fillStyle = 'rgba(120,200,230,0.5)';
        ctx.fillRect(8 * u, 212 * u, 2 * u, 14 * u);
        label(ctx, step, 14 * u, 222 * u, 7.2 * u, '#8fd6ff', 'left');
      }
    }

    const boss = g.zombies.find((z) => z.kind.startsWith('boss') || z.kind === 'wither');
    if (boss && g.phase === 'play') {
      const bw = 210 * u;
      const bx = (W - bw) / 2;
      const by = 204 * u;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx - u, by - u, bw + 2 * u, 8 * u);
      const p = Math.max(0, boss.hp / boss.maxHp);
      ctx.fillStyle = '#c62828';
      ctx.fillRect(bx, by, bw * p, 6 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(bx, by, bw * p, 2 * u);
      if (boss.enraged) {
        ctx.globalAlpha = 0.35 + 0.3 * Math.sin(performance.now() / 90);
        ctx.strokeStyle = '#ff4a5a';
        ctx.lineWidth = Math.max(1, u * 0.8);
        ctx.strokeRect(bx - 2 * u, by - 2 * u, bw + 4 * u, 10 * u);
        ctx.globalAlpha = 1;
      }
      const bossName = ZOMBIES[boss.kind]?.label ?? 'BOSS';
      const phaseTag = boss.phase >= 2 ? ' · 终焉' : boss.phase === 1 ? ' · 二阶段' : '';
      label(ctx, bossName + phaseTag, W / 2, by - 2 * u, 6 * u, '#ff8a80', 'center');
    }

    if (g.phase === 'play' && g.craftMenu) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      label(ctx, '合成菜单 · 按数字键选择 · C 或 P 关闭', W / 2, 40 * u, 9 * u, '#ffffff', 'center');
      const pl = g.player;
      const arm = pl.armor > 0 ? ARMOR.tiers[pl.armor - 1].name : '无';
      const rows: [string, string, boolean][] = [
        [`1 墙体 ${g.wallCost()}石 (HP ${g.wallHp()})`, `持有 ${pl.walls} · 石头 ${pl.stone}`, pl.stone >= g.wallCost()],
        [`2 TNT ${GATHER.tntCraftCost}火药`, `持有 ${pl.tntAmmo} · 火药 ${pl.gunpowder}`, pl.gunpowder >= GATHER.tntCraftCost],
        [`3 铁甲 ${ARMOR.tiers[0].cost}铁 (减伤20%)`, `铁 ${pl.iron} · 护甲 ${arm}`, pl.iron >= ARMOR.tiers[0].cost],
        [`4 金甲 ${ARMOR.tiers[1].cost}金 (减伤35%)`, `金 ${pl.gold}`, pl.gold >= ARMOR.tiers[1].cost],
        [`5 钻石甲 ${ARMOR.tiers[2].cost}钻 (减伤50%)`, `钻石 ${pl.diamond}`, pl.diamond >= ARMOR.tiers[2].cost],
        [`6 金苹果 ${ARMOR.goldenAppleCost}金 (全满+力量)`, `金苹果 ${pl.goldApples}`, pl.gold >= ARMOR.goldenAppleCost],
        [`7 营火 ${CAMPFIRE.coalCost}煤+${CAMPFIRE.stoneCost}石 (40秒范围回血)`, `煤 ${pl.coal}`, pl.coal >= CAMPFIRE.coalCost && pl.stone >= CAMPFIRE.stoneCost],
        [`8 铁傀儡 ${GOLEM.ironCost}铁 (为你而战)`, `铁 ${pl.iron}`, pl.iron >= GOLEM.ironCost],
        [
          `9 红石陷阱 ${REDSTONE.trapCost}红石+${REDSTONE.trapStoneCost}石 (减速+伤害)`,
          `红石 ${pl.redstone} · 陷阱 ${pl.traps}`,
          pl.redstone >= REDSTONE.trapCost && pl.stone >= REDSTONE.trapStoneCost,
        ],
      ];
      for (let i = 0; i < rows.length; i++) {
        label(ctx, rows[i][0], W / 2 - 30 * u, (66 + i * 20) * u, 8 * u, rows[i][2] ? '#ffffff' : '#6a6a6a');
        label(ctx, rows[i][1], W / 2 + 66 * u, (66 + i * 20) * u, 6.5 * u, '#9a9a9a');
      }
      ctx.fillStyle = 'rgba(20,26,40,0.95)';
      ctx.fillRect(W / 2 - 56 * u, 240 * u, 112 * u, 16 * u);
      ctx.strokeStyle = '#9fe8ff';
      ctx.lineWidth = Math.max(1, u * 0.7);
      ctx.strokeRect(W / 2 - 56 * u, 240 * u, 112 * u, 16 * u);
      label(ctx, '关闭 (C / P)', W / 2, 251 * u, 7 * u, '#9fe8ff', 'center');
    }

    if (g.phase === 'play' && g.tradeMenu) {
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(0, 0, W, H);
      label(ctx, '流浪商人 · 数字键交易 · E 或 P 离开', W / 2, 56 * u, 10 * u, '#c98af0', 'center');
      label(ctx, `持有：石 ${g.player.stone} · 金 ${g.player.gold} · 铁 ${g.player.iron} · 火药 ${g.player.gunpowder} · 绿宝石 ${g.runEmeralds}`, W / 2, 70 * u, 7 * u, '#9a9a9a', 'center');
      for (let i = 0; i < TRADER.offers.length; i++) {
        const y = (88 + i * 20) * u;
        ctx.fillStyle = 'rgba(20,26,40,0.92)';
        ctx.fillRect(W / 2 - 116 * u, y - 9 * u, 232 * u, 17 * u);
        ctx.strokeStyle = '#8a3ac0';
        ctx.lineWidth = Math.max(1, u * 0.6);
        ctx.strokeRect(W / 2 - 116 * u, y - 9 * u, 232 * u, 17 * u);
        label(ctx, `${i + 1}`, W / 2 - 108 * u, y + 4 * u, 7.5 * u, '#ffd76b');
        label(ctx, TRADER.offers[i].label, W / 2 - 94 * u, y + 4 * u, 7.5 * u, '#ffffff');
      }
      label(ctx, '交易成功后商人会离开', W / 2, 208 * u, 7 * u, '#9a9a9a', 'center');
      ctx.fillStyle = 'rgba(20,26,40,0.95)';
      ctx.fillRect(W / 2 - 56 * u, 222 * u, 112 * u, 16 * u);
      ctx.strokeStyle = '#c98af0';
      ctx.lineWidth = Math.max(1, u * 0.7);
      ctx.strokeRect(W / 2 - 56 * u, 222 * u, 112 * u, 16 * u);
      label(ctx, '离开 (E / P)', W / 2, 233 * u, 7 * u, '#c98af0', 'center');
    }

    if (g.phase === 'play' && g.player.potion) {
      const potName = POTION_DROPS.find((o) => o.id === g.player.potion)?.name ?? '药水';
      label(ctx, `E 饮用${potName}`, W - 12 * u, 52 * u, 7 * u, '#c98af0', 'right');
    }

    if (g.banner.t > 0) {
      const k = 1 - g.banner.t / g.banner.max;
      const alpha = Math.min(1, g.banner.t * 4) * Math.min(1, k * 8 + 0.15);
      const pop = 1 + Math.max(0, 0.22 - k) * 3;
      ctx.globalAlpha = alpha;
      label(ctx, g.banner.title, W / 2, 92 * u, 22 * u * pop, '#ffffff', 'center', Math.max(1, u * 0.6));
      label(ctx, g.banner.sub, W / 2, 106 * u, 9 * u, '#ffd76b', 'center', Math.max(1, u * 0.5));
      ctx.globalAlpha = 1;
    }

    if (g.achToast && g.phase === 'play') {
      const a = g.achToast;
      const k = a.t / a.max;
      const slideIn = Math.min(1, a.t * 5);
      const fade = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
      ctx.globalAlpha = fade;
      const tw = 168 * u;
      const tx = W - tw - 10 * u - (1 - slideIn) * 30 * u;
      const ty = 8 * u;
      ctx.fillStyle = 'rgba(24,20,10,0.92)';
      ctx.fillRect(tx, ty, tw, 26 * u);
      ctx.strokeStyle = '#ffd76b';
      ctx.lineWidth = Math.max(1, u * 0.6);
      ctx.strokeRect(tx, ty, tw, 26 * u);
      label(ctx, a.title, tx + 8 * u, ty + 10 * u, 8 * u, '#ffd76b');
      label(ctx, a.sub, tx + 8 * u, ty + 20 * u, 6 * u, '#e8e0c8');
      ctx.globalAlpha = 1;
    }
  }

  if (g.phase === 'grow') {
    ctx.fillStyle = 'rgba(6,8,14,0.7)';
    ctx.fillRect(0, 0, W, H);
    label(ctx, `第 ${g.wave + 1} 波 · 成长三选一`, W / 2, 60 * u, 16 * u, '#ffffff', 'center', Math.max(1, u * 0.7));
    label(ctx, '选一个永久增益，这一局都会跟着你', W / 2, 76 * u, 7.5 * u, '#9fe8ff', 'center');
    for (let i = 0; i < 3; i++) {
      const id = g.growthChoices[i];
      const d = GROWTHS.find((gr) => gr.id === id);
      if (!d) continue;
      const cx = W / 2 + (i - 1) * 104 * u;
      const cy = 128 * u;
      const lv = g.growthLvl(id);
      const picked = g.growthSel === i;
      ctx.fillStyle = picked ? 'rgba(34,44,66,0.98)' : 'rgba(18,22,34,0.94)';
      ctx.fillRect(cx - 48 * u, cy - 33 * u, 96 * u, 66 * u);
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(cx - 48 * u, cy - 33 * u, 96 * u, 3 * u);
      ctx.globalAlpha = 1;
      if (picked) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(4, u * 2.4);
        ctx.globalAlpha = 0.35;
        ctx.strokeRect(cx - 50 * u, cy - 35 * u, 100 * u, 70 * u);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = d.color;
      ctx.lineWidth = Math.max(1, u * 0.7);
      ctx.strokeRect(cx - 48 * u, cy - 33 * u, 96 * u, 66 * u);
      label(ctx, `${i + 1}`, cx - 40 * u, cy - 19 * u, 7 * u, '#ffd76b');
      label(ctx, d.name + (lv > 0 ? ` Lv.${lv + 1}` : ''), cx, cy - 2 * u, 11 * u, d.color, 'center');
      label(ctx, d.desc, cx, cy + 14 * u, 6.2 * u, '#d8d8d8', 'center');
    }
    label(ctx, '← → 或 1/2/3 选择 · Enter 确认', W / 2, 194 * u, 8 * u, '#9fe8ff', 'center');
  }

  if (g.phase === 'bless') {
    ctx.fillStyle = 'rgba(6,8,14,0.62)';
    ctx.fillRect(0, 0, W, H);
    label(ctx, '选择一件开局圣物', W / 2, 60 * u, 16 * u, '#ffffff', 'center', Math.max(1, u * 0.7));
    for (let i = 0; i < 3; i++) {
      const id = g.blessing[i];
      const r = RELICS.find((rl) => rl.id === id);
      if (!r) continue;
      const cx = W / 2 + (i - 1) * 104 * u;
      const cy = 128 * u;
      ctx.fillStyle = 'rgba(20,26,40,0.92)';
      ctx.fillRect(cx - 48 * u, cy - 33 * u, 96 * u, 66 * u);
      ctx.strokeStyle = '#ffd76b';
      ctx.lineWidth = Math.max(1, u * 0.7);
      ctx.strokeRect(cx - 48 * u, cy - 33 * u, 96 * u, 66 * u);
      label(ctx, `${i + 1}`, cx - 40 * u, cy - 19 * u, 7 * u, '#ffd76b');
      label(ctx, r.icon, cx, cy - 15 * u, 15 * u, '#ffffff', 'center');
      label(ctx, r.name, cx, cy + 4 * u, 8 * u, '#ffffff', 'center');
      label(ctx, r.desc, cx, cy + 15 * u, 6 * u, '#c9c9c9', 'center');
    }
    label(ctx, '按 1 / 2 / 3 或点击卡片选择 · P 返回选图', W / 2, 194 * u, 8 * u, '#9fe8ff', 'center');
  }

  if (g.phase === 'map') {
    ctx.fillStyle = 'rgba(6,8,14,0.66)';
    ctx.fillRect(0, 0, W, H);
    label(ctx, '选择地图', W / 2, 42 * u, 18 * u, '#ffffff', 'center', Math.max(1, u * 0.7));
    label(ctx, '每种地图布局不同，出生点都在中央广场', W / 2, 58 * u, 7.5 * u, '#9a9a9a', 'center');
    const n = MAPS.length;
    for (let i = 0; i < n; i++) {
      const m = MAPS[i];
      const cx = W / 2 + (i - (n - 1) / 2) * 92 * u;
      const cy = 128 * u;
      const sel = i === g.mapIdx;
      ctx.fillStyle = sel ? 'rgba(34,44,66,0.97)' : 'rgba(16,20,32,0.94)';
      ctx.fillRect(cx - 42 * u, cy - 52 * u, 84 * u, 104 * u);
      ctx.fillStyle = m.color;
      ctx.fillRect(cx - 42 * u, cy - 52 * u, 84 * u, 20 * u);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000000';
      ctx.fillRect(cx - 42 * u, cy - 32 * u, 84 * u, 6 * u);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = sel ? '#ffd76b' : '#3a4252';
      ctx.lineWidth = Math.max(1, u * (sel ? 1.4 : 0.7));
      ctx.strokeRect(cx - 42 * u, cy - 52 * u, 84 * u, 104 * u);
      label(ctx, `${i + 1}`, cx - 34 * u, cy - 38 * u, 8 * u, '#0c1010');
      label(ctx, m.name, cx, cy - 38 * u, 8.5 * u, '#0c1010', 'center');
      ctx.globalAlpha = sel ? 0.95 : 0.7;
      drawMapPreview(ctx, m.id, cx - 32 * u, cy - 26 * u, 64 * u, 34 * u);
      ctx.globalAlpha = 1;
      label(ctx, m.sub, cx, cy + 17 * u, 7 * u, '#e8e8e8', 'center');
      label(ctx, sel ? '已选择' : '', cx, cy + 38 * u, 6.5 * u, '#ffd76b', 'center');
    }
    const cur = MAPS[g.mapIdx];
    label(ctx, cur.desc, W / 2, 196 * u, 8.5 * u, '#c9c9c9', 'center');
    // 职业选择
    // 两行四列，保证 8 个职业全部显示
    for (let i = 0; i < JOBS.length; i++) {
      const j = JOBS[i];
      const row = Math.floor(i / 4);
      const col = i % 4;
      const cx = W / 2 + (col - 1.5) * 112 * u;
      const cy = (208 + row * 19) * u;
      const bw = 104 * u;
      const bh = 16 * u;
      const sel = j.id === g.job;
      ctx.fillStyle = sel ? 'rgba(34,44,66,0.97)' : 'rgba(16,20,32,0.9)';
      ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
      ctx.strokeStyle = sel ? '#ffd76b' : '#3a4252';
      ctx.lineWidth = Math.max(1, u * (sel ? 1.2 : 0.6));
      ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
      label(ctx, `${j.name}·${j.tag}`, cx, cy + 0.5 * u, 7 * u, sel ? '#ffd76b' : '#c9c9c9', 'center');
    }
    label(ctx, JOBS.find((j) => j.id === g.job)?.desc ?? '', W / 2, 242 * u, 6.5 * u, '#8fd6ff', 'center');
    ctx.globalAlpha = blink;
    ctx.fillStyle = 'rgba(40,90,50,0.95)';
    ctx.fillRect(W / 2 - 66 * u, 246 * u, 132 * u, 22 * u);
    ctx.strokeStyle = '#8fd14f';
    ctx.lineWidth = Math.max(1, u);
    ctx.strokeRect(W / 2 - 66 * u, 246 * u, 132 * u, 22 * u);
    label(ctx, '开始游戏 (Enter)', W / 2, 256 * u, 10 * u, '#d8f5c0', 'center');
    ctx.globalAlpha = 1;
  }

  if (g.phase === 'menu') {
    ctx.fillStyle = 'rgba(6,8,14,0.55)';
    ctx.fillRect(0, 0, W, H);

    // 右上角信封（点开是作者的信）
    ctx.fillStyle = g.letterOpen ? 'rgba(255,231,160,0.95)' : 'rgba(30,38,54,0.9)';
    ctx.fillRect(452 * u - 18 * u, 20 * u - 14 * u, 36 * u, 28 * u);
    ctx.strokeStyle = g.letterOpen ? '#ffd76b' : '#9fe8ff';
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.strokeRect(452 * u - 18 * u, 20 * u - 14 * u, 36 * u, 28 * u);
    ctx.strokeStyle = g.letterOpen ? '#8a6a20' : '#9fe8ff';
    ctx.beginPath();
    ctx.moveTo(452 * u - 16 * u, 21 * u - 12 * u);
    ctx.lineTo(452 * u, 20 * u + 2 * u);
    ctx.lineTo(452 * u + 16 * u, 21 * u - 12 * u);
    ctx.stroke();
    label(ctx, '信', 452 * u, 20 * u + 2 * u, 9 * u, g.letterOpen ? '#3a2a10' : '#9fe8ff', 'center');

    label(ctx, '方块末日', W / 2, 92 * u, 34 * u, '#f6f6f6', 'center', Math.max(2, u * 1.2));
    label(ctx, 'Z O M B I E   C R I S I S', W / 2, 110 * u, 9 * u, '#8fd14f', 'center', Math.max(1, u * 0.5));
    const bestTxt = g.best.wave > 0 ? ` · 最高纪录 第 ${g.best.wave} 波` : '';
    label(ctx, `绿宝石 ${g.meta.emeralds}${bestTxt}`, W / 2, 124 * u, 8.5 * u, '#6ee86e', 'center');

    for (let i = 0; i < UPGRADES.length; i++) {
      const u2 = UPGRADES[i];
      const lvl = g.meta.lvls[u2.id] ?? 0;
      const maxed = lvl >= u2.maxLvl;
      const cost = upgradeCost(u2, lvl);
      const canBuy = !maxed && g.meta.emeralds >= cost;
      const tag = maxed ? '[MAX]' : `[${cost}绿]`;
      const col = maxed ? '#6ee86e' : canBuy ? '#ffffff' : '#8a8a8a';
      const keyTag = i === 9 ? '0' : i === 10 ? '-' : i === 11 ? '=' : `${i + 1}`;
      const colX = i < 6 ? W / 2 - 165 * u : W / 2 + 15 * u;
      const colY = (135 + (i % 6) * 12.5) * u;
      label(ctx, `${keyTag} ${u2.name} Lv.${lvl} ${u2.desc} ${tag}`, colX, colY, 6.8 * u, col, 'center');
    }

    const df = g.diffDef();
    const dailyToday = g.daily.day === dailyKey();
    label(ctx, `难度 [${df.name}] · D 切换`, W / 2, 211 * u, 6.8 * u, '#9fe8ff', 'center');
    // 两个模式按钮（底部横排，避免压住强化列表）
    const btnMode = (cx: number, title: string, active: boolean, color: string) => {
      ctx.fillStyle = active ? 'rgba(30,64,42,0.97)' : 'rgba(20,26,40,0.95)';
      ctx.fillRect(cx - 74 * u, 224 * u, 148 * u, 18 * u);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, u * (active ? 1.6 : 0.8));
      ctx.strokeRect(cx - 74 * u, 224 * u, 148 * u, 18 * u);
      label(ctx, title, cx, 233 * u, 9 * u, color, 'center');
    };
    btnMode(W / 2 - 78 * u, '普通挑战', !g.dailyMode, '#8fd14f');
    btnMode(W / 2 + 78 * u, '每周挑战', g.dailyMode, '#ffd76b');
    label(ctx, dailyToday ? `本周纪录 第${g.daily.wave}波` : '每周挑战：固定种子 · 困难', W / 2, 273 * u, 5.8 * u, '#9aa6b8', 'center');

    ctx.globalAlpha = blink;

    ctx.globalAlpha = 1;

    label(ctx, 'WASD 移动 · 左键攻击/蓄力 · 右键射箭 · 空格冲刺 · F 吃 · X 处决', W / 2, 261 * u, 6.5 * u, '#cfcfcf', 'center');
    label(ctx, '1-6 切武器 · C 合成 · Q 放墙 · G 放陷阱 · T 传送 · P 暂停 · M 静音', W / 2, 268 * u, 6.5 * u, '#a8d06a', 'center');
    // 右上角「排行榜」按钮
    ctx.fillStyle = g.lbOpen ? 'rgba(255,231,160,0.95)' : 'rgba(30,38,54,0.9)';
    ctx.fillRect(404 * u - 24 * u, 20 * u - 13 * u, 48 * u, 26 * u);
    ctx.strokeStyle = g.lbOpen ? '#ffd76b' : '#9fe8ff';
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.strokeRect(404 * u - 24 * u, 20 * u - 13 * u, 48 * u, 26 * u);
    label(ctx, '排行', 404 * u, 20 * u, 8 * u, g.lbOpen ? '#3a2a10' : '#9fe8ff', 'center');

    // 排行榜面板
    if (g.lbOpen) {
      ctx.fillStyle = 'rgba(6,8,14,0.85)';
      ctx.fillRect(0, 0, W, H);
      const px = 40 * u;
      const py = 26 * u;
      const pw = (VIEW_W - 80) * u;
      const ph = (VIEW_H - 52) * u;
      ctx.fillStyle = 'rgba(16,22,34,0.97)';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#9fe8ff';
      ctx.lineWidth = Math.max(1, u * 0.8);
      ctx.strokeRect(px, py, pw, ph);
      label(ctx, '每周挑战 · 全球排行', px + pw / 2, py + 10 * u, 12 * u, '#ffd76b', 'center');
      label(ctx, weekKey() + ' · 这一周所有人同一张地图', px + pw / 2, py + 24 * u, 7 * u, '#8a94a6', 'center');
      const cols = ['#', '昵称', '职业', '波数', '击杀', '用时'];
      const xs = [px + 14 * u, px + 44 * u, px + 150 * u, px + 214 * u, px + 268 * u, px + 330 * u];
      for (let i = 0; i < cols.length; i++) label(ctx, cols[i], xs[i], py + 38 * u, 7.5 * u, '#7f8b9e');
      const rows = g.lbRows;
      if (rows && rows.length > 0) {
        for (let i = 0; i < Math.min(rows.length, 12); i++) {
          const r = rows[i];
          const y = py + 52 * u + i * 13 * u;
          const color = i === 0 ? '#ffd76b' : i === 1 ? '#d8dce2' : i === 2 ? '#c9a26b' : '#aab4c4';
          label(ctx, `${i + 1}`, xs[0], y, 7.5 * u, color);
          label(ctx, r.name, xs[1], y, 7.5 * u, color);
          label(ctx, `${r.wave}`, xs[2], y, 7.5 * u, color);
          label(ctx, `${r.kills}`, xs[3], y, 7.5 * u, color);
          const m = Math.floor(r.seconds / 60);
          const s = r.seconds % 60;
          label(ctx, `${m}:${String(s).padStart(2, '0')}`, xs[4], y, 7.5 * u, color);
        }
      } else if (g.lbMsg) {
        label(ctx, g.lbMsg, px + pw / 2, py + 80 * u, 8 * u, '#8a94a6', 'center');
      }
      label(ctx, '点任意处 / K 关闭', px + pw / 2, py + ph - 10 * u, 7 * u, '#5f6b7e', 'center');
    }
    if (g.letterOpen) {
      ctx.fillStyle = 'rgba(6,8,14,0.82)';
      ctx.fillRect(0, 0, W, H);
      const lx = 34 * u;
      const ly = 26 * u;
      const lw = 300 * u;
      const lh = (VIEW_H - 52) * u;
      ctx.fillStyle = 'rgba(246,240,224,0.97)';
      ctx.fillRect(lx, ly, lw, lh);
      ctx.strokeStyle = '#c9a26b';
      ctx.lineWidth = Math.max(1, u * 0.8);
      ctx.strokeRect(lx, ly, lw, lh);
      label(ctx, '致 玩家', lx + 14 * u, ly + 10 * u, 11 * u, '#5a4520');
      const lines = [
        '非常感谢你的游玩。',
        '这是一款 AI 制作的非商业 MC 二创游戏。',
        '真的很荣幸，能把小时候的奇思妙想',
        '注入到这个游戏当中——',
        '它实际参考了我小时候玩过的一款',
        '网页游戏《僵尸危机》。',
        '',
        '我的专业知识非常浅薄，',
        '希望以后能好好摸索，',
        '直至真的能一行行地创作出',
        '属于自己的一方天地。',
        '',
        '最后，感谢 Qoder 对创作者的大力支持，',
        '也感谢你的游玩。',
      ];
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i]) continue;
        label(ctx, lines[i], lx + 14 * u, ly + 26 * u + i * 11 * u, 7.5 * u, '#3a2f1a');
      }
      label(ctx, 'BY  zhao', lx + lw - 78 * u, ly + lh - 16 * u, 8 * u, '#5a4520');
      label(ctx, '点任意处 / L 关闭', lx + lw / 2, ly + lh - 8 * u, 6.5 * u, '#8a7a52', 'center');
    }

    label(ctx, '成就', W / 2 + 150 * u, 40 * u, 9 * u, '#ffd76b', 'center');
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const a = ACHIEVEMENTS[i];
      const got = !!g.meta.ach[a.id];
      const y = (56 + i * 13.5) * u;
      label(ctx, `${got ? a.icon : '·'} ${a.name}`, W / 2 + 150 * u, y, 6.5 * u, got ? '#ffd76b' : '#6a6a72', 'center');
    }
    const gotN = ACHIEVEMENTS.filter((a) => g.meta.ach[a.id]).length;
    label(ctx, `${gotN}/${ACHIEVEMENTS.length}`, W / 2 + 150 * u, (56 + ACHIEVEMENTS.length * 13.5) * u, 6.5 * u, '#c9c9c9', 'center');
  }

  if (g.phase === 'pause') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    label(ctx, '已暂停', W / 2, 122 * u, 20 * u, '#ffffff', 'center', Math.max(1, u * 0.6));
    label(ctx, '按 P 继续', W / 2, 144 * u, 9 * u, '#cfcfcf', 'center');
    label(ctx, `音乐 ${Math.round(g.audio.musicVol * 100)}% (1/2) · 音效 ${Math.round(g.audio.sfxVol * 100)}% (3/4)`, W / 2, 164 * u, 7 * u, '#c9c9c9', 'center');
    label(ctx, '5 重新开始 · 6 返回标题 · M 静音', W / 2, 176 * u, 7 * u, '#9a9a9a', 'center');
    label(ctx, `难度 ${g.diffDef().name}${g.dailyMode ? ' · 每日挑战' : ''} · 种子 ${g.seed}`, W / 2, 190 * u, 6.5 * u, '#9fe8ff', 'center');
    label(ctx, `本局输出 ${g.runDmg} · 暴击 ${g.runCrits} · 空投 ${g.runSupplies} · 绿宝石 ${g.runEmeralds}`, W / 2, 200 * u, 6.5 * u, '#c9c9c9', 'center');
    const btns: [string, number, number, string][] = [
      ['继续', VIEW_W / 2 - 120, 76, '#9fe8ff'],
      ['重新开始', VIEW_W / 2, 84, '#ffd76b'],
      ['返回标题', VIEW_W / 2 + 120, 84, '#c9c9c9'],
    ];
    for (const [txt, cx, bw, col] of btns) {
      ctx.fillStyle = 'rgba(20,26,40,0.95)';
      ctx.fillRect((cx - bw / 2) * u, 208 * u, bw * u, 16 * u);
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1, u * 0.7);
      ctx.strokeRect((cx - bw / 2) * u, 208 * u, bw * u, 16 * u);
      label(ctx, txt, cx * u, 219 * u, 7 * u, col, 'center');
    }
  }

  if (g.phase === 'over') {
    ctx.fillStyle = 'rgba(26,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);
    label(ctx, 'GAME OVER', W / 2, 74 * u, 22 * u, '#ff5252', 'center', Math.max(2, u * 0.9));
    const r = g.lastRun;
    if (r) {
      label(ctx, `存活到第 ${r.wave} 波 · 击杀 ${r.kills} · 用时 ${fmtTime(r.time)}`, W / 2, 96 * u, 8 * u, '#ffffff', 'center');
      label(ctx, `采集 石${r.stone} 果${r.apples} 药${r.powder} 眼${r.eyes} · 宝箱 ${r.chests}`, W / 2, 108 * u, 7 * u, '#c9c9c9', 'center');
      label(ctx, `处决 ${r.executed} · 蓄力重击 ${r.heavyHits} · 输出 ${r.dmg} · 暴击 ${r.crits} · 空投 ${r.supplies}`, W / 2, 118 * u, 7 * u, '#c9c9c9', 'center');
      if (g.dailyMode) label(ctx, `每日挑战 · 种子 ${g.seed}`, W / 2, 128 * u, 7 * u, '#ffd76b', 'center');
      if (r.emeralds > 0) {
        label(ctx, `结算 +${r.emeralds} 绿宝石`, W / 2, 138 * u, 14 * u, '#6ee86e', 'center', Math.max(1, u * 0.6));
      } else {
        label(ctx, '本局没有获得绿宝石 (击败精英/Boss)', W / 2, 138 * u, 8 * u, '#8a8a8a', 'center');
      }
      label(ctx, `绿宝石余额 ${g.meta.emeralds} · 返回标题购买强化`, W / 2, 154 * u, 7 * u, '#a8d06a', 'center');
      if (r.newBest) label(ctx, '新纪录!', W / 2, 172 * u, 11 * u, '#ffd76b', 'center');
    }
    if (g.overT > 0.7) {
      ctx.globalAlpha = blink;
      label(ctx, '按 R 再来一局', W / 2, 208 * u, 11 * u, '#ffffff', 'center');
      ctx.globalAlpha = 1;
    }
    label(ctx, 'P 返回标题', W / 2, 226 * u, 7 * u, '#9a9a9a', 'center');
  }

  if (input.mouseDown && g.phase === 'play') {
    // keep crosshair visible while firing
  }
  drawCursor(ctx, input.mouseX * u, input.mouseY * u, u, g.phase === 'play' || g.phase === 'pause');
}
