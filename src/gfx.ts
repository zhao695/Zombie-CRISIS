import { PAL, TILE, WEAPONS } from './config';
import type {
  ArrowState,
  CampfireState,
  DropState,
  FireballState,
  GolemState,
  PlayerState,
  PotionState,
  TntState,
  TraderState,
  ZombieState,
} from './types';
import { world } from './world';

type C = CanvasRenderingContext2D;

const OUT = 'rgba(10,10,14,0.55)';
const TAU2 = Math.PI * 2;

export function rect(g: C, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function box(g: C, x: number, y: number, w: number, h: number, fill: string, outline = OUT) {
  if (outline) rect(g, x - 1, y - 1, w + 2, h + 2, outline);
  rect(g, x, y, w, h, fill);
}

function thash(tx: number, ty: number) {
  let h = (tx * 374761393 + ty * 668265263) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function drawBuildingTile(g: C, px: number, py: number, tx: number, ty: number) {
  const tcols = world.tcols;
  const above = ty > 0 ? world.tiles[(ty - 1) * tcols + tx] : 1;
  const below = ty < world.trows - 1 ? world.tiles[(ty + 1) * tcols + tx] : 1;
  const h = thash(tx, ty);
  rect(g, px, py, TILE, TILE, '#6f6f6f');
  rect(g, px, py, TILE, TILE, h % 3 === 0 ? '#6b6b6b' : '#737373');
  for (let i = 0; i < 2; i++) rect(g, px + i * 8, py, 1, TILE, 'rgba(0,0,0,0.25)');
  for (let i = 0; i < 2; i++) rect(g, px + ((h >> 2) & 1) * 4, py + i * 8 + 4, 8, 1, 'rgba(0,0,0,0.25)');
  if (above === 0) rect(g, px, py, TILE, 3, '#8d8d8d');
  if (below === 0) rect(g, px, py + TILE - 2, TILE, 2, '#4a4a4a');
  if (h % 7 === 0) {
    rect(g, px + (h % 8) + 2, py + ((h >> 3) % 8) + 2, 2, 1, '#555555');
    rect(g, px + (h % 8) + 2, py + ((h >> 3) % 8) + 3, 1, 2, '#555555');
  }
  if (above === 0 && h % 5 === 0) {
    rect(g, px + 5, py + 4, 4, 4, 'rgba(20,20,30,0.5)');
    rect(g, px + 6, py + 5, 2, 2, 'rgba(140,180,220,0.35)');
  }
}

function drawStreetTile(g: C, px: number, py: number, tx: number, ty: number) {
  const h = thash(tx, ty);
  rect(g, px, py, TILE, TILE, h % 3 === 0 ? PAL.street : PAL.street2);
  const n = (h >> 3) % 4;
  for (let i = 0; i < n; i++) {
    const sx = px + ((h >> (i * 4)) % 12);
    const sy = py + ((h >> (i * 4 + 2)) % 12);
    rect(g, sx, sy, 3, 3, h % 2 === 0 ? PAL.street3 : PAL.street2);
    rect(g, sx, sy, 3, 1, 'rgba(255,255,255,0.12)');
  }
  if (h % 11 === 0) rect(g, px + 2, py + 5, 12, 1, 'rgba(0,0,0,0.18)');
}

function drawGrassTile(g: C, px: number, py: number, tx: number, ty: number) {
  const h = thash(tx, ty);
  rect(g, px, py, TILE, TILE, h % 3 === 0 ? PAL.grass : h % 3 === 1 ? PAL.grass2 : PAL.grass3);
  const k = h % 5;
  if (k === 0) {
    rect(g, px + (h % 12), py + ((h >> 4) % 12), 1, 3, '#5f9a2c');
    rect(g, px + 2 + (h % 12), py + 1 + ((h >> 4) % 12), 1, 2, '#6aa832');
  } else if (k === 1) {
    rect(g, px + (h % 11), py + ((h >> 4) % 11), 3, 2, 'rgba(0,0,0,0.1)');
  } else if (k === 2) {
    rect(g, px + (h % 12), py + ((h >> 4) % 12), 2, 2, h % 2 === 0 ? '#e8e04a' : '#e04a4a');
  }
}

/** 低频值噪声：给地面做"分区材质"的有机过渡 */
function vnoise(x: number, y: number, period: number) {
  const fx = x / period;
  const fy = y / period;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const h = (a: number, b: number) => {
    let n = (a * 374761393 + b * 668265263) | 0;
    n = ((n ^ (n >> 13)) * 1274126177) | 0;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  };
  const s = (t: number) => t * t * (3 - 2 * t);
  const u = s(tx);
  const v = s(ty);
  const a = h(x0, y0);
  const b = h(x0 + 1, y0);
  const c = h(x0, y0 + 1);
  const d = h(x0 + 1, y0 + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/** 地面分区色调：苔绿 / 土黄 / 石青 三色混合，让大片地面不再是一块纯色 */
function groundTint(tx: number, ty: number) {
  const n = vnoise(tx, ty, 11) * 0.72 + vnoise(tx + 37, ty + 91, 4) * 0.28;
  const moss = [58, 118, 52];
  const dirt = [146, 108, 62];
  const slate = [72, 84, 96];
  let r: number;
  let g: number;
  let b: number;
  if (n < 0.42) {
    const k = n / 0.42;
    r = moss[0] + (dirt[0] - moss[0]) * k;
    g = moss[1] + (dirt[1] - moss[1]) * k;
    b = moss[2] + (dirt[2] - moss[2]) * k;
  } else {
    const k = (n - 0.42) / 0.58;
    r = dirt[0] + (slate[0] - dirt[0]) * k;
    g = dirt[1] + (slate[1] - dirt[1]) * k;
    b = dirt[2] + (slate[2] - dirt[2]) * k;
  }
  return `rgba(${r | 0},${g | 0},${b | 0},0.16)`;
}

export function drawTiles(g: C, x0: number, y0: number, x1: number, y1: number) {
  const tx0 = Math.max(0, Math.floor(x0 / TILE));
  const ty0 = Math.max(0, Math.floor(y0 / TILE));
  const tx1 = Math.min(world.tcols - 1, Math.ceil(x1 / TILE));
  const ty1 = Math.min(world.trows - 1, Math.ceil(y1 / TILE));
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const px = tx * TILE;
      const py = ty * TILE;
      const ti = ty * world.tcols + tx;
      if (world.tiles[ti] === 1) {
        drawBuildingTile(g, px, py, tx, ty);
      } else {
        if (world.cellKind[Math.floor(ty / 4) * world.cols + Math.floor(tx / 4)] === 2) drawGrassTile(g, px, py, tx, ty);
        else drawStreetTile(g, px, py, tx, ty);
        // 分区材质：叠一层低饱和色，形成苔绿/土黄/石青的地面过渡
        rect(g, px, py, TILE, TILE, groundTint(tx, ty));
      }
      const whp = world.walls.get(ti);
      if (whp !== undefined && !world.domainWalls.has(ti)) drawWallTile(g, px, py, whp);
    }
  }
}

function drawWallTile(g: C, px: number, py: number, hp: number) {
  rect(g, px, py, TILE, TILE, '#6b4f28');
  rect(g, px, py, TILE, 2, '#9a7440');
  rect(g, px, py + TILE - 3, TILE, 3, '#4a3418');
  rect(g, px, py + 2, TILE, TILE - 5, '#7a5c30');
  rect(g, px + 1, py + 3, TILE - 2, 2, '#8a6a3a');
  rect(g, px + 1, py + TILE - 5, TILE - 2, 2, '#5f4520');
  rect(g, px + 3, py + 6, 2, TILE - 12, '#5f4520');
  rect(g, px + 11, py + 6, 2, TILE - 12, '#5f4520');
  rect(g, px + 1, py + 1, 3, 3, 'rgba(255,255,255,0.16)');
  if (hp <= 1) {
    rect(g, px + 6, py + 3, 1, 5, 'rgba(20,14,8,0.8)');
    rect(g, px + 8, py + 9, 2, 1, 'rgba(20,14,8,0.8)');
    rect(g, px + 4, py + 12, 1, 3, 'rgba(20,14,8,0.8)');
  }
  rect(g, px + 7, py + 7, 2, 2, 'rgba(255,255,255,0.1)');
}

export function drawStoneNode(g: C, x: number, y: number, hp: number, maxHp: number, shake: number) {
  const sx = shake > 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
  const k = hp / maxHp;
  const px = Math.round(x) + sx;
  const py = Math.round(y);
  // 影子（比旧版大一圈）
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(px, py, 15, 5, 0, 0, TAU2);
  g.fill();
  // 三层堆叠的碎石块（参考图：浅灰顶面 + 深灰侧面 + 苔藓点）
  const block = (bx: number, by: number, w: number, h: number, top: string, side: string, edge: string) => {
    rect(g, bx, by, w, h, side);
    rect(g, bx, by, w, 3, top);
    rect(g, bx, by + h - 2, w, 2, edge);
    rect(g, bx + w - 2, by, 2, h, edge);
    rect(g, bx + 1, by + 1, 1, 1, '#ffffff');
  };
  // 底层
  block(px - 12, py - 8, 12, 9, '#d6d6d0', '#a8a8a2', '#7a7a74');
  block(px + 1, py - 7, 11, 8, '#cfcfc9', '#9e9e98', '#727270');
  // 中层
  block(px - 9, py - 16, 11, 9, '#dcdcd6', '#b2b2ac', '#82827c');
  block(px + 3, py - 14, 8, 7, '#d0d0ca', '#a4a49e', '#767670');
  // 顶层
  block(px - 6, py - 23, 10, 8, '#e4e4de', '#bcbcb6', '#8a8a84');
  // 苔藓
  rect(g, px - 10, py - 8, 2, 1, '#4a7a34');
  rect(g, px + 6, py - 14, 2, 1, '#4a7a34');
  rect(g, px - 3, py - 23, 2, 1, '#568a3c');
  // 裂纹随血量加深
  if (k <= 0.66) {
    rect(g, px - 6, py - 20, 1, 5, '#5a5a5a');
    rect(g, px - 5, py - 15, 3, 1, '#5a5a5a');
    rect(g, px + 4, py - 12, 1, 4, '#5a5a5a');
  }
  if (k <= 0.33) {
    rect(g, px - 11, py - 4, 4, 1, '#4a4a4a');
    rect(g, px + 6, py - 5, 3, 1, '#4a4a4a');
    rect(g, px - 2, py - 9, 1, 3, '#4a4a4a');
  }
}

export function drawRedstoneNode(g: C, x: number, y: number, hp: number, maxHp: number, shake: number) {
  const sx = shake > 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
  const k = hp / maxHp;
  const px = Math.round(x) + sx;
  const py = Math.round(y);
  // 红色辉光（参考图：晶体周围有光晕）
  g.globalAlpha = 0.2 + Math.sin(performance.now() / 420) * 0.05;
  g.fillStyle = '#ff2a2a';
  g.beginPath();
  g.arc(px, py - 10, 20, 0, TAU2);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(0,0,0,0.32)';
  g.beginPath();
  g.ellipse(px, py, 13, 5, 0, 0, TAU2);
  g.fill();
  // 深色岩块堆
  const rock = (bx: number, by: number, w: number, h: number) => {
    rect(g, bx, by, w, h, '#3a1a1a');
    rect(g, bx, by, w, 2, '#52262a');
    rect(g, bx, by + h - 2, w, 2, '#241010');
  };
  rock(px - 12, py - 9, 12, 10);
  rock(px + 1, py - 8, 12, 9);
  rock(px - 8, py - 17, 10, 9);
  rock(px + 3, py - 15, 8, 8);
  // 亮红矿脉
  const vein = (bx: number, by: number, w: number, h: number) => {
    rect(g, bx, by, w, h, '#e02a2a');
    rect(g, bx, by, Math.max(1, w - 1), 1, '#ff6a6a');
  };
  vein(px - 10, py - 6, 6, 2);
  vein(px - 6, py - 3, 4, 3);
  vein(px + 3, py - 6, 5, 2);
  vein(px + 6, py - 3, 3, 3);
  vein(px - 5, py - 14, 5, 2);
  vein(px + 4, py - 12, 4, 2);
  rect(g, px - 1, py - 11, 2, 3, '#ff9a9a');
  // 破血裂纹
  if (k <= 0.66) {
    rect(g, px - 3, py - 10, 1, 4, '#1a0606');
    rect(g, px + 2, py - 7, 1, 4, '#1a0606');
  }
  if (k <= 0.33) {
    rect(g, px - 11, py - 4, 4, 1, '#1a0606');
    rect(g, px + 7, py - 5, 3, 1, '#1a0606');
  }
}

export function drawSupply(g: C, x: number, y: number, landed: boolean, anim: number) {
  if (!landed) {
    // 降落伞
    g.strokeStyle = 'rgba(230,240,255,0.9)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(Math.round(x), Math.round(y) - 30, 12, Math.PI, 0);
    g.stroke();
    g.beginPath();
    g.moveTo(Math.round(x) - 12, Math.round(y) - 30);
    g.lineTo(Math.round(x) - 5, Math.round(y) - 12);
    g.moveTo(Math.round(x) + 12, Math.round(y) - 30);
    g.lineTo(Math.round(x) + 5, Math.round(y) - 12);
    g.stroke();
    g.fillStyle = 'rgba(230,240,255,0.45)';
    g.beginPath();
    g.moveTo(Math.round(x), Math.round(y) - 30);
    g.lineTo(Math.round(x) - 12, Math.round(y) - 30);
    g.lineTo(Math.round(x) - 5, Math.round(y) - 12);
    g.lineTo(Math.round(x) + 5, Math.round(y) - 12);
    g.lineTo(Math.round(x) + 12, Math.round(y) - 30);
    g.closePath();
    g.fill();
  }
  const bob = landed ? Math.round(Math.sin(anim * 4) * 1) : 0;
  const bx = Math.round(x);
  const by = Math.round(y) + bob;
  // 金色光晕：空投箱在战场里要显眼
  if (landed) {
    g.globalAlpha = 0.18 + Math.sin(anim * 3) * 0.05;
    g.fillStyle = '#ffd24a';
    g.beginPath();
    g.arc(bx, by - 8, 22, 0, TAU2);
    g.fill();
    g.globalAlpha = 1;
  }
  g.fillStyle = 'rgba(0,0,0,0.32)';
  g.beginPath();
  g.ellipse(bx, by + 5, 14, 4.5, 0, 0, TAU2);
  g.fill();
  // 木箱主体（参考图：斜向木纹 + 铁角 + 绳提手）
  rect(g, bx - 12, by - 16, 24, 20, '#8a6a3a');
  rect(g, bx - 12, by - 16, 24, 3, '#c9a26b');
  rect(g, bx - 12, by - 1, 24, 4, '#5a4520');
  for (let i = 0; i < 4; i++) rect(g, bx - 10 + i * 6, by - 13, 2, 12, '#9a7a46');
  // 铁角
  for (const [cx2, cy2] of [
    [-12, -16],
    [9, -16],
    [-12, -2],
    [9, -2],
  ]) {
    rect(g, bx + cx2, by + cy2, 3, 3, '#b8b8b2');
    rect(g, bx + cx2, by + cy2, 1, 1, '#e8e8e2');
  }
  // 绳提手
  rect(g, bx - 3, by - 20, 6, 2, '#d9b673');
  rect(g, bx - 3, by - 20, 1, 4, '#d9b673');
  rect(g, bx + 2, by - 20, 1, 4, '#d9b673');
  // 锁扣
  rect(g, bx - 1, by - 9, 3, 3, '#f5d327');
}

export function drawTrap(g: C, x: number, y: number, armed: boolean, anim: number) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y) + 3, 8, 3, 0, 0, TAU2);
  g.fill();
  rect(g, Math.round(x) - 7, Math.round(y) - 1, 14, 4, '#5a5a5a');
  rect(g, Math.round(x) - 7, Math.round(y) - 1, 14, 1, '#8a8a8a');
  if (armed) {
    const pulse = 0.5 + Math.sin(anim * 8) * 0.5;
    rect(g, Math.round(x) - 3, Math.round(y) - 3, 6, 2, '#3a3a3a');
    rect(g, Math.round(x) - 2, Math.round(y) - 2, 4, 1, `rgba(255,80,80,${0.4 + pulse * 0.6})`);
    rect(g, Math.round(x) + 3, Math.round(y) - 2, 3, 3, '#7a1010');
    rect(g, Math.round(x) + 4, Math.round(y) - 1, 1, 1, '#e04040');
  } else {
    rect(g, Math.round(x) - 1, Math.round(y) - 4, 2, 4, '#e04040');
    rect(g, Math.round(x) - 1, Math.round(y) - 5, 2, 2, '#ff8080');
  }
}

export function drawAppleTree(g: C, x: number, y: number, hp: number, shake: number) {
  const sx = shake > 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
  const xx = Math.round(x) + sx;
  const yy = Math.round(y);
  // 影子放大
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(xx, yy, 14, 5, 0, 0, TAU2);
  g.fill();
  // 粗树干（带竖纹）
  rect(g, xx - 4, yy - 14, 8, 15, '#5a3a20');
  rect(g, xx - 4, yy - 14, 2, 15, '#7a5230');
  rect(g, xx + 2, yy - 14, 2, 15, '#452a16');
  rect(g, xx - 1, yy - 12, 1, 11, '#6b4423');
  // 树根
  rect(g, xx - 7, yy - 2, 4, 2, '#4e3218');
  rect(g, xx + 4, yy - 2, 4, 2, '#4e3218');
  // 方块状树冠（三层，参考图）
  const canopy = (bx: number, by: number, w: number, h: number) => {
    rect(g, bx, by, w, h, '#4a9a2a');
    rect(g, bx, by, w, 3, '#5fae38');
    rect(g, bx, by + h - 2, w, 2, '#356e1c');
  };
  canopy(xx - 13, yy - 24, 26, 11);
  canopy(xx - 10, yy - 29, 20, 6);
  canopy(xx - 6, yy - 33, 12, 5);
  // 冠层暗块（让体积更明显）
  rect(g, xx - 11, yy - 20, 4, 3, '#3a7a20');
  rect(g, xx + 6, yy - 18, 4, 3, '#3a7a20');
  rect(g, xx - 2, yy - 26, 3, 2, '#3a7a20');
  // 苹果（参考图：3 颗挂在冠层上）
  const apple = (ax: number, ay: number) => {
    rect(g, ax - 1, ay, 4, 4, '#e04a4a');
    rect(g, ax - 1, ay, 3, 1, '#ff8080');
    rect(g, ax + 2, ay + 2, 1, 2, '#a02020');
    rect(g, ax, ay - 1, 1, 1, '#5a3a20');
  };
  if (hp >= 2) {
    apple(xx - 8, yy - 19);
    apple(xx + 4, yy - 21);
    apple(xx - 1, yy - 15);
  } else {
    apple(xx + 4, yy - 21);
  }
}

const HEART_BITMAP = [
  '.##...##.',
  '#########',
  '#########',
  '#########',
  '.#######.',
  '..#####..',
  '...###...',
  '....#....',
];

export function makeHeart(mode: 'full' | 'half' | 'empty'): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 9;
  cv.height = 8;
  const g = cv.getContext('2d')!;
  for (let y = 0; y < HEART_BITMAP.length; y++) {
    for (let x = 0; x < 9; x++) {
      if (HEART_BITMAP[y][x] !== '#') continue;
      if (mode === 'empty') rect(g, x, y, 1, 1, '#3a1414');
      else if (mode === 'half' && x > 4) rect(g, x, y, 1, 1, '#3a1414');
      else rect(g, x, y, 1, 1, PAL.heart);
    }
  }
  if (mode !== 'empty') {
    rect(g, 2, 1, 2, 1, '#ff8080');
  }
  return cv;
}

export function makeSlot(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 20;
  cv.height = 20;
  const g = cv.getContext('2d')!;
  rect(g, 0, 0, 20, 20, '#141414');
  rect(g, 1, 1, 18, 18, '#8b8b8b');
  rect(g, 1, 1, 18, 2, '#c9c9c9');
  rect(g, 1, 1, 2, 18, '#b5b5b5');
  rect(g, 1, 17, 18, 2, '#5a5a5a');
  rect(g, 17, 1, 2, 18, '#6e6e6e');
  return cv;
}

export function drawWeaponIcon(g: C, idx: number, ox: number, oy: number) {
  // 拳头：画一个握紧的拳头剪影，避免首格变成空槽
  if (idx === 0) {
    const skin = '#cfab7c';
    const skinD = '#a27b52';
    const skinL = '#e6c69a';
    // 袖口
    rect(g, ox + 2, oy + 14, 12, 5, PAL.shirtDark);
    rect(g, ox + 2, oy + 14, 12, 1, PAL.shirt);
    rect(g, ox + 2, oy + 18, 12, 1, '#0f3f3f');
    // 拳面
    rect(g, ox + 3, oy + 4, 11, 10, skin);
    rect(g, ox + 4, oy + 3, 9, 1, skinL);
    rect(g, ox + 4, oy + 4, 9, 1, skinL);
    rect(g, ox + 4, oy + 13, 10, 1, skinD);
    // 指缝
    rect(g, ox + 6, oy + 5, 1, 6, skinD);
    rect(g, ox + 9, oy + 5, 1, 6, skinD);
    rect(g, ox + 12, oy + 6, 1, 6, skinD);
    // 拇指
    rect(g, ox + 2, oy + 8, 2, 5, skinD);
    rect(g, ox + 2, oy + 8, 1, 4, skin);
    // 轮廓
    rect(g, ox + 3, oy + 3, 1, 11, '#5a3a20');
    rect(g, ox + 14, oy + 5, 1, 9, '#5a3a20');
    return;
  }
  const blade = WEAPONS[idx].blade;
  rect(g, ox + 2, oy + 12, 3, 3, '#5a3a20');
  rect(g, ox + 4, oy + 10, 3, 3, '#5a3a20');
  rect(g, ox + 3, oy + 8, 7, 2, '#3a3a3a');
  for (let i = 0; i < 8; i++) {
    rect(g, ox + 5 + i, oy + 8 - i, 3, 3, blade);
  }
  for (let i = 0; i < 8; i++) {
    rect(g, ox + 5 + i, oy + 8 - i, 1, 1, 'rgba(255,255,255,0.6)');
  }
}

export function drawBowIcon(g: C, ox: number, oy: number) {
  rect(g, ox + 1, oy + 2, 1, 17, '#ded6c4');
  rect(g, ox + 2, oy + 2, 2, 2, '#8a5a2b');
  rect(g, ox + 3, oy + 4, 2, 3, '#8a5a2b');
  rect(g, ox + 3, oy + 7, 2, 2, '#8a5a2b');
  rect(g, ox + 4, oy + 8, 2, 4, '#6b4423');
  rect(g, ox + 3, oy + 12, 2, 2, '#8a5a2b');
  rect(g, ox + 3, oy + 13, 2, 3, '#8a5a2b');
  rect(g, ox + 2, oy + 16, 2, 2, '#8a5a2b');
  rect(g, ox + 5, oy + 9, 8, 1, '#c9a26b');
  rect(g, ox + 13, oy + 8, 2, 3, '#ecece4');
  rect(g, ox + 4, oy + 8, 1, 3, '#f0f0e6');
}

export function drawAxeIcon(g: C, ox: number, oy: number) {
  rect(g, ox + 2, oy + 12, 2, 5, '#8a5a2b');
  rect(g, ox + 4, oy + 10, 2, 4, '#8a5a2b');
  rect(g, ox + 6, oy + 8, 2, 3, '#8a5a2b');
  rect(g, ox + 8, oy + 2, 2, 10, '#9a9a9a');
  rect(g, ox + 10, oy + 2, 2, 10, '#c9c9c9');
  rect(g, ox + 8, oy + 2, 4, 1, '#e8e8e8');
  rect(g, ox + 10, oy + 11, 3, 3, '#c9c9c9');
  rect(g, ox + 8, oy + 12, 2, 1, '#7a7a7a');
}

export function drawRodIcon(g: C, ox: number, oy: number) {
  rect(g, ox + 2, oy + 12, 2, 6, '#8a5a2b');
  rect(g, ox + 4, oy + 10, 2, 6, '#8a5a2b');
  rect(g, ox + 6, oy + 8, 2, 6, '#8a5a2b');
  rect(g, ox + 8, oy + 6, 1, 8, '#e8e8e0');
  rect(g, ox + 9, oy + 4, 3, 2, '#b0b0b0');
}

export function drawTntIcon(g: C, ox: number, oy: number) {
  rect(g, ox + 3, oy + 4, 12, 10, '#c23b2a');
  rect(g, ox + 3, oy + 7, 12, 4, '#e8e0d0');
  rect(g, ox + 5, oy + 8, 2, 2, '#101010');
  rect(g, ox + 8, oy + 8, 2, 2, '#101010');
  rect(g, ox + 11, oy + 8, 2, 2, '#101010');
  rect(g, ox + 3, oy + 4, 12, 1, '#e04a2a');
}

export function drawFireIcon(g: C, ox: number, oy: number) {
  rect(g, ox + 5, oy + 4, 9, 11, '#ff9a3c');
  rect(g, ox + 6, oy + 2, 7, 5, '#ffd76b');
  rect(g, ox + 8, oy, 3, 4, '#fff3a0');
  rect(g, ox + 5, oy + 13, 9, 2, '#8a5a10');
}

/** 三叉戟图标 */
export function drawTridentIcon(g: C, ox: number, oy: number) {
  rect(g, ox + 8, oy + 6, 2, 13, '#8a6a3a');
  rect(g, ox + 6, oy + 2, 2, 7, '#4ae0d0');
  rect(g, ox + 10, oy + 2, 2, 7, '#4ae0d0');
  rect(g, ox + 8, oy, 2, 6, '#9ff0e4');
  rect(g, ox + 6, oy + 8, 6, 2, '#4ae0d0');
  rect(g, ox + 9, oy + 19, 3, 2, '#5a4520');
}

/** 弩图标 */
/** 重锤图标 */
export function drawMaceIcon(g: C, ox: number, oy: number) {
  rect(g, ox + 8, oy + 6, 3, 13, '#6b4a2e');
  rect(g, ox + 8, oy + 6, 1, 13, '#8a6238');
  rect(g, ox + 4, oy + 1, 11, 6, '#9aa0a6');
  rect(g, ox + 4, oy + 1, 11, 2, '#d0d6dc');
  rect(g, ox + 4, oy + 6, 11, 1, '#6a7076');
  rect(g, ox + 6, oy + 2, 2, 2, '#eef2f6');
  rect(g, ox + 7, oy + 19, 5, 2, '#5a4028');
}
export function drawCrossbowIcon(g: C, ox: number, oy: number) {
  rect(g, ox + 2, oy + 8, 16, 3, '#6b4f28');
  rect(g, ox + 8, oy + 4, 3, 15, '#8a6a3a');
  rect(g, ox + 2, oy + 5, 3, 3, '#c9c9c0');
  rect(g, ox + 15, oy + 5, 3, 3, '#c9c9c0');
  rect(g, ox + 4, oy + 3, 12, 1, '#ded6c4');
  rect(g, ox + 9, oy + 1, 1, 4, '#f0f0e6');
}

export function drawShadow(g: C, x: number, y: number, rx: number) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y), rx, Math.max(2, rx * 0.38), 0, 0, Math.PI * 2);
  g.fill();
}

export function drawSteve(g: C, s: PlayerState) {
  const x = Math.round(s.x);
  const y = Math.round(s.y);
  const step = s.moving ? Math.round(Math.sin(s.walkT * 16)) : 0;
  const bob = s.moving && Math.sin(s.walkT * 16) > 0 ? -1 : 0;
  const flash = s.hurtT > 0 && Math.floor(s.hurtT * 34) % 2 === 0;

  const skin = flash ? '#ffffff' : PAL.skin;
  const skinD = flash ? '#ffffff' : PAL.skinDark;
  const shirt = flash ? '#ffffff' : PAL.shirt;
  const pants = flash ? '#ffffff' : PAL.pants;
  const hair = flash ? '#ffffff' : PAL.hair;

  box(g, x - 7 + step, y - 8, 5, 8, pants);
  box(g, x + 2 - step, y - 8, 5, 8, pants);
  box(g, x - 7 + step, y - 2, 5, 2, PAL.shoe);
  box(g, x + 2 - step, y - 2, 5, 2, PAL.shoe);

  const by = y - 20 + bob;
  box(g, x - 7, by, 14, 12, shirt);
  rect(g, x - 7, by + 10, 14, 2, PAL.shirtDark);
  rect(g, x + 5, by, 2, 10, 'rgba(0,0,0,0.14)');

  const asw = s.moving ? -step : 0;
  box(g, x - 11 + asw, by + 1, 4, 9, skin);
  box(g, x + 7 - asw, by + 1, 4, 9, skin);
  rect(g, x - 11 + asw, by + 7, 4, 1, PAL.shirtDark);
  rect(g, x + 7 - asw, by + 7, 4, 1, PAL.shirtDark);

  const hy = by - 13;
  box(g, x - 9, hy, 18, 14, skin);
  rect(g, x - 9, hy, 18, 4, hair);
  rect(g, x - 9, hy, 2, 7, hair);
  rect(g, x + 7, hy, 2, 7, hair);
  rect(g, x + 6, hy + 4, 2, 9, 'rgba(0,0,0,0.13)');

  const look = s.facing > 0 ? 1 : 0;
  rect(g, x - 5 + look, hy + 6, 2, 2, '#f2f2f2');
  rect(g, x + 3 + look, hy + 6, 2, 2, '#f2f2f2');
  rect(g, x - 4 + look, hy + 7, 1, 1, '#3a3a7a');
  rect(g, x + 4 + look, hy + 7, 1, 1, '#3a3a7a');
  rect(g, x - 3, hy + 11, 6, 1, '#8a5a3a');
  rect(g, x - 4, hy + 10, 1, 1, skinD);

  if (s.armor > 0) {
    const ac = s.armor === 1 ? '#e2e2e2' : s.armor === 2 ? '#f5d327' : '#4aedd9';
    const ad = s.armor === 1 ? '#9aa0a8' : s.armor === 2 ? '#c69a12' : '#2a9a8a';
    rect(g, x - 6, by + 1, 12, 8, ac);
    rect(g, x - 6, by + 1, 12, 1, '#ffffff');
    rect(g, x - 1, by + 3, 2, 6, ad);
    rect(g, x - 7, hy + 4, 16, 3, ac);
    rect(g, x - 7, hy + 4, 16, 1, '#ffffff');
  }
}

function swingAngle(s: PlayerState): number {
  if (s.swingT <= 0) return s.aim;
  const prog = s.swingMax > 0 ? 1 - s.swingT / s.swingMax : 0;
  const e = 1 - Math.pow(1 - prog, 3);
  return s.swingFrom + (s.swingTo - s.swingFrom) * e;
}

export function drawHeld(g: C, s: PlayerState) {
  // 空手不画手臂/拳头，避免贴图突兀
  if (s.slot === 0 && s.weapon <= 0) return;
  const ang = swingAngle(s);
  const skin = s.hurtT > 0 && Math.floor(s.hurtT * 34) % 2 === 0 ? '#ffffff' : PAL.skin;
  const armLen = s.slot === 1 ? 12 : 9;

  for (let i = 3; i <= armLen; i += 2) {
    rect(g, s.x + Math.cos(ang) * i - 2, s.y - 16 + Math.sin(ang) * i - 2, 4, 4, skin);
  }

  const radius = s.slot === 1 ? 14 : 10;
  g.save();
  g.translate(s.x + Math.cos(ang) * radius, s.y - 16 + Math.sin(ang) * radius);
  g.rotate(ang);

  if (s.slot === 1) {
    const draw = s.bowCd > 0.24 ? 1 : 0;
    const limbs: [number, number, number, number][] = [
      [-6, -11, 2, 2],
      [-6, -9, 3, 3],
      [-5, -6, 3, 4],
      [-5, -2, 4, 4],
      [-5, 2, 3, 4],
      [-6, 6, 3, 3],
      [-6, 9, 2, 2],
    ];
    for (const [x, y, w, h] of limbs) rect(g, x, y, w, h, '#6b4423');
    rect(g, -5, -8, 1, 16, '#a06a2a');
    rect(g, -4, -1, 1, 2, '#c98a44');
    rect(g, -7, -11, 1, 22, '#e8e2d0');
    if (draw) {
      rect(g, 0, -1, 6, 2, '#8a6a3a');
    } else {
      rect(g, 0, -1, 11, 2, '#8a6a3a');
      rect(g, 0, -1, 11, 1, '#a8894f');
      rect(g, 10, -2, 3, 4, '#dcdcd2');
      rect(g, -1, -2, 2, 4, '#f0f0e6');
    }
  } else if (s.slot === 2) {
    rect(g, -4, -2, 4, 4, '#6b4423');
    rect(g, 0, -3, 2, 6, '#8a5a2b');
    box(g, 2, -5, 6, 10, '#c9c9c9');
    rect(g, 2, -5, 6, 2, '#e8e8e8');
    rect(g, 2, -5, 1, 10, '#e8e8e8');
    rect(g, 6, -5, 2, 10, '#9a9a9a');
    rect(g, 8, -4, 1, 8, '#7a7a7a');
  } else if (s.slot === 3) {
    rect(g, -3, -2, 3, 4, '#6b4423');
    rect(g, 0, -1, 13, 2, '#b08a54');
    rect(g, 12, -2, 2, 4, '#e8e8e0');
    rect(g, 0, -1, 13, 1, '#c9a26b');
  } else if (s.slot === 4) {
    box(g, -2, -4, 8, 8, '#c23b2a');
    rect(g, -2, -2, 8, 4, '#e8e0d0');
  } else if (s.slot === 6) {
    // 三叉戟
    rect(g, -6, -1, 18, 2, '#8a6a3a');
    rect(g, -6, -1, 18, 1, '#c9a26b');
    for (const d of [-4, 0, 4]) rect(g, 12, d - 1, 3, 2, '#4ae0d0');
    rect(g, 14, -3, 3, 6, '#4ae0d0');
    rect(g, 15, -5, 2, 4, '#9ff0e4');
  } else if (s.slot === 7) {
    // 弩
    rect(g, -4, -2, 20, 4, '#6b4f28');
    rect(g, -4, -2, 20, 1, '#8a6a3a');
    rect(g, 2, -8, 3, 16, '#c9c9c0');
    rect(g, 14, -1, 5, 2, '#e8e8e0');
  } else if (s.slot === 8) {
    // 重锤：粗木柄 + 方块状铁锤头（带铆钉与打击面）
    rect(g, -6, -2, 18, 4, '#6b4a2e');
    rect(g, -6, -2, 18, 1, '#8a6238');
    rect(g, -6, 1, 18, 1, '#4a3120');
    rect(g, 10, -3, 3, 6, '#8a9098');
    box(g, 9, -9, 15, 17, '#9aa0a6');
    rect(g, 9, -9, 15, 3, '#d0d6dc');
    rect(g, 9, 5, 15, 3, '#6a7076');
    rect(g, 22, -9, 2, 17, '#5a6066');
    rect(g, 11, -6, 2, 2, '#eef2f6');
    rect(g, 16, -6, 2, 2, '#eef2f6');
    rect(g, 11, 1, 2, 2, '#eef2f6');
    rect(g, 16, 1, 2, 2, '#eef2f6');
    rect(g, 9, -9, 15, 1, '#ffffff');
    rect(g, -8, -3, 3, 6, '#4a3120');
  } else if (s.slot === 5) {
    // 火焰弹：手里握着一颗发光火球
    g.globalAlpha = 0.35;
    g.fillStyle = '#ff9a3c';
    g.beginPath();
    g.arc(4, 0, 7, 0, TAU2);
    g.fill();
    g.globalAlpha = 1;
    rect(g, 1, -4, 6, 8, '#ff9a3c');
    rect(g, 2, -5, 4, 10, '#ffd76b');
    rect(g, 3, -3, 2, 4, '#fff3a0');
    rect(g, -3, -1, 5, 2, '#6b4423');
  } else if (s.weapon > 0) {
    const blade = WEAPONS[s.weapon].blade;
    rect(g, -5, -1, 8, 2, '#6b4423');
    rect(g, 2, -4, 2, 8, '#2e2e2e');
    rect(g, 4, -2, 12, 4, blade);
    rect(g, 16, -1, 2, 2, blade);
    rect(g, 4, -2, 12, 1, 'rgba(255,255,255,0.55)');
  }
  g.restore();
}

function drawCreeperBody(g: C, mode: 'normal' | 'flash' | 'blaze') {
  const c = mode === 'flash' ? '#ffffff' : mode === 'blaze' ? '#f08080' : PAL.creeper;
  const d = mode === 'flash' ? '#ffffff' : mode === 'blaze' ? '#b04a4a' : PAL.creeperDark;
  box(g, -8, -5, 6, 5, d);
  box(g, 2, -5, 6, 5, d);
  box(g, -7, -26, 14, 21, c);
  rect(g, -7, -26, 14, 2, mode === 'flash' ? '#ffffff' : '#6cc45b');
  rect(g, -7, -22, 5, 3, d);
  rect(g, 2, -17, 3, 4, d);
  rect(g, -4, -12, 4, 3, d);
  rect(g, -5, -23, 3, 3, '#0e150e');
  rect(g, 2, -23, 3, 3, '#0e150e');
  rect(g, -2, -18, 4, 5, '#0e150e');
  rect(g, -3, -17, 1, 2, '#0e150e');
  rect(g, 2, -17, 1, 2, '#0e150e');
  rect(g, -1, -14, 2, 1, '#0e150e');
}

function tierColors(tier: 'leather' | 'iron' | 'gold') {
  if (tier === 'leather') return ['#a8712f', '#c78d45', '#5e3a1a'];
  if (tier === 'iron') return ['#b8bec4', '#e4e9ee', '#667077'];
  return ['#e0b520', '#ffe066', '#8a6208'];
}

function drawSkeleton(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const bone = flash ? '#ffffff' : PAL.bone;
  const dark = flash ? '#ffffff' : PAL.boneDark;
  const aiming = z.windup > 0;

  box(g, -6, -8, 3, 8, bone);
  box(g, 3, -8, 3, 8, bone);
  rect(g, -6, -12, 12, 3, dark);

  box(g, -6, -23, 12, 11, bone);
  rect(g, -5, -21, 10, 1, dark);
  rect(g, -5, -18, 10, 1, dark);
  rect(g, -5, -15, 10, 1, dark);
  rect(g, -1, -23, 2, 11, dark);

  box(g, -9, -22, 3, 11, bone);
  box(g, 6, -22, 3, 11, bone);
  rect(g, -9, -12, 3, 1, dark);
  rect(g, 6, -12, 3, 1, dark);

  box(g, -7, -35, 14, 12, bone);
  rect(g, -5, -31, 3, 3, aiming ? '#ff3020' : '#101014');
  rect(g, 2, -31, 3, 3, aiming ? '#ff3020' : '#101014');
  rect(g, -1, -28, 2, 2, dark);
  rect(g, -3, -25, 6, 1, dark);
  rect(g, -2, -24, 1, 1, bone);
  rect(g, 1, -24, 1, 1, bone);
  rect(g, -4, -27, 1, 1, 'rgba(255,255,255,0.35)');
  rect(g, 3, -27, 1, 1, 'rgba(255,255,255,0.35)');

  if (aiming) {
    g.strokeStyle = '#8a5a2b';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(7, -18, 6, -1.2, 1.2);
    g.stroke();
    rect(g, 2, -19, 9, 2, '#c9a26b');
    rect(g, 0, -20, 2, 4, '#f0f0e6');
    rect(g, 10, -20, 2, 4, '#eceae0');
  }
}

function drawSpiderBody(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const body = flash ? '#ffffff' : PAL.spider;
  const dark = flash ? '#ffffff' : PAL.spiderDark;
  const crouch = z.crouch > 0;

  for (let i = 0; i < 4; i++) {
    const off = -0.9 + i * 0.6 + (crouch ? 0.3 : 0) + Math.sin(z.anim * 14 + i * 1.7) * 0.09;
    for (const s of [-1, 1]) {
      const a = s < 0 ? Math.PI - off : off;
      g.save();
      g.translate(s * 4, crouch ? 1 : 0);
      g.rotate(a);
      rect(g, 0, -1, 9, 2, dark);
      rect(g, 8, -1, 2, 2, dark);
      g.restore();
    }
  }
  if (crouch) g.save(), g.translate(0, 1), g.scale(1, 0.82), g.translate(0, -1);
  box(g, -5, -3, 10, 6, body);
  rect(g, -5, -3, 10, 1, flash ? '#ffffff' : '#3a3a44');
  rect(g, 3, -2, 3, 4, dark);
  rect(g, 4, -2, 1, 2, '#ff3030');
  rect(g, 4, 1, 1, 2, '#ff3030');
  rect(g, 5, -2, 1, 2, 'rgba(255,60,60,0.55)');
  rect(g, 5, 1, 1, 2, 'rgba(255,60,60,0.55)');
  if (crouch) g.restore();
}

function drawEnderman(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const body = flash ? '#ffffff' : PAL.ender;
  box(g, -5, -9, 3, 9, body, OUT);
  box(g, 2, -9, 3, 9, body, OUT);
  box(g, -5, -22, 10, 13, body, OUT);
  box(g, -8, -21, 3, 12, body, OUT);
  box(g, 5, -21, 3, 12, body, OUT);
  box(g, -4, -28, 8, 7, body, OUT);
  rect(g, -3, -26, 2, 3, flash ? '#101010' : PAL.enderEye);
  rect(g, 1, -26, 2, 3, flash ? '#101010' : PAL.enderEye);
  rect(g, -3, -25, 1, 1, '#f0b8ff');
  rect(g, 1, -25, 1, 1, '#f0b8ff');
  rect(g, -2, -22, 4, 1, flash ? '#e8e8e8' : '#241a38');
  rect(g, -5, -22, 10, 1, 'rgba(120,60,200,0.25)');
}

function drawWitch(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const robe = flash ? '#ffffff' : PAL.witch;
  const robeD = flash ? '#ffffff' : PAL.witchDark;
  const aiming = z.windup > 0;

  box(g, -4, -3, 3, 3, robeD);
  box(g, 1, -3, 3, 3, robeD);
  box(g, -6, -21, 12, 18, robe, OUT);
  rect(g, -7, -8, 14, 5, robeD);
  rect(g, -6, -12, 12, 1, '#2a1230');
  rect(g, -1, -13, 2, 3, PAL.gold);

  box(g, -9, -20, 3, 9, robe, OUT);
  box(g, 6, -20, 3, 9, robe, OUT);
  rect(g, -9, -12, 3, 2, PAL.zSkin);
  rect(g, 6, -12, 3, 2, PAL.zSkin);
  if (aiming) {
    rect(g, 7, -26, 3, 6, robe);
    rect(g, 8, -28, 3, 4, PAL.potion);
    rect(g, 9, -28, 1, 1, '#c98af0');
    rect(g, 8, -30, 3, 1, '#7a5a3a');
  }

  box(g, -5, -31, 10, 10, PAL.zSkin, OUT);
  rect(g, -4, -28, 2, 2, '#202020');
  rect(g, 1, -28, 2, 2, '#202020');
  rect(g, 2, -26, 3, 3, PAL.zSkin);
  rect(g, 3, -25, 1, 1, '#7a3a20');

  box(g, -7, -33, 14, 3, '#2a1a3a', OUT);
  rect(g, -4, -39, 8, 7, '#3a2350');
  rect(g, -2, -40, 4, 2, '#4a2a66');
  rect(g, -4, -33, 8, 1, PAL.gold);
}

function drawSlime(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const body = flash ? '#ffffff' : '#6ee86e';
  const dark = flash ? '#ffffff' : '#3fae3f';
  const wob = Math.sin(z.anim * 9) * 1;
  box(g, -9, -6, 18, 12, dark);
  rect(g, -8, -5, 16, 10, body);
  rect(g, -8, -5, 16, 3, flash ? '#ffffff' : '#8ef08e');
  rect(g, -3 + wob, -3, 2, 2, '#101010');
  rect(g, 2 - wob, -3, 2, 2, '#101010');
  rect(g, -1 + wob, 0, 3, 2, '#2a6a2a');
  rect(g, -5 + wob, 1, 1, 1, '#2a6a2a');
  rect(g, 4 - wob, 2, 1, 1, '#2a6a2a');
  rect(g, -2, -5, 4, 1, 'rgba(255,255,255,0.4)');
}

function drawBlaze(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const rod = flash ? '#ffffff' : '#f5a623';
  const rodD = flash ? '#ffffff' : '#8a5a10';
  const bob = Math.sin(z.anim * 3) * 2;
  const wind = z.windup > 0;
  for (let i = 0; i < 3; i++) {
    const sx = -8 + i * 7;
    const sy = 3 + Math.round(Math.sin(z.anim * 6 + i * 2) * 1);
    rect(g, sx, sy, 4, 4, 'rgba(120,120,130,0.35)');
  }
  box(g, -6, -13 + bob, 12, 9, rodD);
  rect(g, -5, -12 + bob, 10, 7, rod);
  rect(g, -5, -12 + bob, 10, 2, '#ffd76b');
  rect(g, -3, -9 + bob, 2, 2, wind ? '#ffd76b' : '#101010');
  rect(g, 2, -9 + bob, 2, 2, wind ? '#ffd76b' : '#101010');
  for (let i = 0; i < 4; i++) {
    const a = z.anim * 3 + (i / 4) * Math.PI * 2;
    const rx = Math.round(Math.cos(a) * 7);
    const ry = -6 + Math.round(Math.sin(a) * 3);
    rect(g, rx - 1, ry, 2, 7, rod);
    rect(g, rx - 1, ry, 2, 1, '#ffd76b');
  }
}

function drawPhantom(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const body = flash ? '#ffffff' : '#3a4a7a';
  const dark = flash ? '#ffffff' : '#20293f';
  const wing = Math.round(Math.sin(z.anim * 10) * 2);
  for (const s of [-1, 1]) {
    g.save();
    g.scale(s, 1);
    rect(g, 4, -8 - wing, 10, 2, dark);
    rect(g, 6, -6 - wing, 9, 2, dark);
    rect(g, 8, -4 - wing, 7, 2, dark);
    g.restore();
  }
  box(g, -8, -6, 16, 10, dark);
  rect(g, -7, -5, 14, 8, body);
  rect(g, -7, -5, 14, 2, flash ? '#ffffff' : '#5a6aa0');
  rect(g, -3, -2, 2, 2, '#101014');
  rect(g, 2, -2, 2, 2, '#101014');
  rect(g, -1, 1, 3, 2, '#101014');
  rect(g, 0, 4, 2, 4, dark);
}

function drawWitherSkel(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const bone = flash ? '#ffffff' : '#2e2e36';
  const dark = flash ? '#ffffff' : '#1a1a20';
  const aiming = z.windup > 0;

  box(g, -6, -8, 3, 8, bone);
  box(g, 3, -8, 3, 8, bone);
  rect(g, -6, -12, 12, 3, dark);

  box(g, -6, -23, 12, 11, bone);
  rect(g, -5, -21, 10, 1, dark);
  rect(g, -5, -18, 10, 1, dark);
  rect(g, -1, -23, 2, 11, dark);

  box(g, -9, -22, 3, 11, bone);
  box(g, 6, -22, 3, 11, bone);
  rect(g, -9, -12, 3, 1, dark);
  rect(g, 6, -12, 3, 1, dark);

  box(g, -7, -35, 14, 12, bone);
  rect(g, -5, -31, 3, 3, aiming ? '#b0e0ff' : '#101014');
  rect(g, 2, -31, 3, 3, aiming ? '#b0e0ff' : '#101014');
  rect(g, -1, -28, 2, 2, dark);
  rect(g, -3, -25, 6, 1, dark);

  rect(g, 8, -29, 2, 12, '#6a6a72');
  rect(g, 9, -30, 1, 14, '#8a8a92');
  rect(g, 7, -19, 4, 4, '#3a3a44');
  rect(g, 8, -29, 1, 1, 'rgba(255,255,255,0.4)');

  if (aiming) {
    g.strokeStyle = '#4a4a54';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(7, -18, 6, -1.2, 1.2);
    g.stroke();
    rect(g, 2, -19, 9, 2, '#8a8a92');
    rect(g, 0, -20, 2, 4, '#c0c0c8');
    rect(g, 10, -20, 2, 4, '#b0b0b8');
  }
}

function drawWither(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const body = flash ? '#ffffff' : '#2a2a34';
  const dark = flash ? '#ffffff' : '#14141a';
  const bob = Math.round(Math.sin(z.anim * 2.2) * 2);
  const angry = z.enraged;

  box(g, -7, -16 + bob, 14, 20, dark);
  rect(g, -6, -15 + bob, 12, 18, body);
  rect(g, -6, -15 + bob, 12, 2, flash ? '#ffffff' : '#3a3a44');
  rect(g, -5, -12 + bob, 10, 1, dark);
  rect(g, -5, -9 + bob, 10, 1, dark);
  rect(g, -5, -6 + bob, 10, 1, dark);
  rect(g, -6, -1 + bob, 12, 3, dark);

  for (const hx of [-9, 0, 9]) {
    const hy = -25 + (hx === 0 ? 0 : 4) + bob;
    box(g, hx - 4, hy - 9, 8, 9, dark);
    rect(g, hx - 3, hy - 8, 6, 7, body);
    rect(g, hx - 2, hy - 5, 2, 2, angry ? '#ff3020' : '#d0d0ff');
    rect(g, hx + 1, hy - 5, 2, 2, angry ? '#ff3020' : '#d0d0ff');
  }
}

function drawPigman(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const skin = flash ? '#ffffff' : '#f7b4d8';
  const skinD = flash ? '#ffffff' : '#d890ba';
  const gold = flash ? '#ffffff' : '#c69a12';
  const goldD = flash ? '#ffffff' : '#8a6a08';
  const sway = Math.round(Math.sin(z.anim * 7));
  const angry = z.enraged;

  box(g, -7 + sway, -8, 4, 8, '#4a3a52');
  box(g, 3 - sway, -8, 4, 8, '#4a3a52');
  box(g, -7, -20, 14, 12, skin);
  rect(g, -7, -9, 14, 1, skinD);
  rect(g, -8 + sway, -8, 2, 2, skin);
  rect(g, 2, -8, 3, 2, skin);
  box(g, -11, -19, 4, 9, skin);
  rect(g, -11, -11, 4, 1, skinD);
  box(g, 7, -19, 4, 10, skin);
  rect(g, 7, -9, 4, 2, skinD);
  // 猪头
  box(g, -9, -33, 18, 13, skin);
  rect(g, -9, -33, 18, 2, skinD);
  rect(g, 7, -33, 2, 4, skinD);
  rect(g, -6 + sway, -27, 3, 2, angry ? '#c04030' : '#2a1414');
  rect(g, 3 + sway, -27, 3, 2, angry ? '#c04030' : '#2a1414');
  rect(g, -1, -24, 2, 2, '#8a4a5a');
  box(g, -7, -37, 14, 4, skinD);
  rect(g, -6, -38, 3, 2, skin);
  rect(g, 3, -38, 3, 2, skin);
  // 金剑
  box(g, 9, -26, 2, 12, '#6b4423');
  rect(g, 7, -32, 7, 2, gold);
  rect(g, 6, -32, 2, 4, gold);
  rect(g, 12, -33, 2, 4, goldD);
  rect(g, 8, -31, 4, 1, '#ffe9a0');
  if (angry) {
    box(g, -3, -40, 6, 2, '#ff5a3c');
    box(g, -1, -40, 2, 2, '#ffd0a0');
  }
}

function drawSilverfish(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const body = flash ? '#ffffff' : '#9aa0a6';
  const dark = flash ? '#ffffff' : '#6a7076';
  const wig = Math.sin(z.anim * 22) * 1.5;
  g.save();
  g.rotate(wig * 0.08);
  rect(g, -9, -2, 4, 4, dark);
  rect(g, -6, -3, 12, 6, body);
  rect(g, 6, -3, 3, 6, dark);
  rect(g, 8, -2, 2, 3, dark);
  rect(g, -5, -3, 10, 2, '#b8bec4');
  rect(g, -3, 1, 8, 1, dark);
  rect(g, -4, -1, 1, 1, '#1a1a1a');
  rect(g, -2, -1, 1, 1, '#1a1a1a');
  g.restore();
}

function drawDrowned(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const skin = flash ? '#ffffff' : '#4a9a8a';
  const skinD = flash ? '#ffffff' : '#2e6e60';
  const shirt = flash ? '#ffffff' : '#2a5a6a';
  const shirtD = flash ? '#ffffff' : '#1a3a4a';
  const sway = Math.round(Math.sin(z.anim * 7));
  const windup = z.windup > 0;

  box(g, -7 + sway, -8, 4, 8, '#1a2a4a');
  box(g, 3 - sway, -8, 4, 8, '#1a2a4a');
  box(g, -7, -20, 14, 12, shirt);
  rect(g, -7, -9, 14, 1, shirtD);
  rect(g, -8 + sway, -8, 2, 2, skin);
  rect(g, 2, -8, 3, 2, skin);
  box(g, -11, -19, 4, 9, shirt);
  rect(g, -11, -11, 4, 1, shirtD);
  box(g, 7, -19, 4, 10, skin);
  rect(g, 7, -9, 4, 2, skinD);
  box(g, -9, -34, 18, 14, skin);
  rect(g, -9, -34, 18, 3, skinD);
  rect(g, -6 + sway, -28, 3, 3, '#30e0d0');
  rect(g, 3 + sway, -28, 3, 3, '#30e0d0');
  rect(g, -4, -24, 8, 2, '#1a3a3a');
  rect(g, -2, -24, 1, 2, '#d8d8c8');
  // 三叉戟
  if (windup) {
    box(g, 8, -30, 2, 14, '#6b4423');
    rect(g, 4, -33, 10, 2, '#c9c9c9');
    rect(g, 4, -33, 2, 6, '#c9c9c9');
    rect(g, 9, -33, 2, 6, '#c9c9c9');
    rect(g, 13, -33, 2, 6, '#9a9a9a');
  } else {
    box(g, 9, -28, 2, 12, '#6b4423');
    rect(g, 5, -35, 8, 2, '#c9c9c9');
    rect(g, 5, -35, 2, 7, '#c9c9c9');
    rect(g, 9, -35, 2, 7, '#c9c9c9');
    rect(g, 12, -35, 2, 7, '#9a9a9a');
  }
}

function drawStray(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const bone = flash ? '#ffffff' : '#cfd8da';
  const dark = flash ? '#ffffff' : '#8fa0a8';
  const cloth = flash ? '#ffffff' : '#5a6a72';
  const aiming = z.windup > 0;

  box(g, -6, -8, 3, 8, bone);
  box(g, 3, -8, 3, 8, bone);
  rect(g, -6, -12, 12, 3, dark);
  // 破布披风
  box(g, -7, -24, 14, 8, cloth);
  rect(g, -7, -23, 14, 1, '#7a8a92');
  rect(g, -7, -17, 14, 1, '#3a4a52');
  rect(g, -1, -24, 2, 8, dark);

  box(g, -9, -22, 3, 11, bone);
  box(g, 6, -22, 3, 11, bone);
  rect(g, -9, -12, 3, 1, dark);
  rect(g, 6, -12, 3, 1, dark);

  box(g, -7, -35, 14, 12, bone);
  rect(g, -7, -35, 14, 3, cloth);
  rect(g, -5, -31, 3, 3, aiming ? '#4ae0ff' : '#0e1a20');
  rect(g, 2, -31, 3, 3, aiming ? '#4ae0ff' : '#0e1a20');
  rect(g, -3, -25, 6, 1, dark);
  rect(g, -1, -24, 1, 1, bone);
  rect(g, 1, -24, 1, 1, bone);

  if (aiming) {
    g.strokeStyle = '#4a5a62';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(7, -18, 6, -1.2, 1.2);
    g.stroke();
    rect(g, 2, -19, 9, 2, '#9fd8ff');
    rect(g, 0, -20, 2, 4, '#e8f8ff');
    rect(g, 10, -20, 2, 4, '#bfe8ff');
  }
}

function drawPillager(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const skin = flash ? '#ffffff' : '#8a9a8a';
  const skinD = flash ? '#ffffff' : '#5e6e5e';
  const coat = flash ? '#ffffff' : '#4a4a3e';
  const coatD = flash ? '#ffffff' : '#33332a';
  const sway = Math.round(Math.sin(z.anim * 7));
  const windup = z.windup > 0;

  box(g, -7 + sway, -8, 4, 8, '#2a2a22');
  box(g, 3 - sway, -8, 4, 8, '#2a2a22');
  box(g, -7, -21, 14, 13, coat);
  rect(g, -7, -9, 14, 1, coatD);
  rect(g, -7, -16, 14, 2, '#6a6a58');
  box(g, -11, -19, 4, 9, coat);
  box(g, 7, -19, 4, 10, skin);

  box(g, -8, -34, 16, 13, skin);
  rect(g, -8, -34, 16, 3, skinD);
  // 眉骨与眉纹
  rect(g, -8, -30, 16, 2, coatD);
  rect(g, -5 + sway, -28, 3, 2, '#c02020');
  rect(g, 2 + sway, -28, 3, 2, '#c02020');
  rect(g, -3, -24, 6, 1, '#3a3a30');
  rect(g, -1, -24, 1, 1, '#1a1a14');
  rect(g, 2, -24, 1, 1, '#1a1a14');

  if (windup) {
    // 举弩
    box(g, 6, -30, 12, 4, '#6b4423');
    rect(g, 8, -32, 2, 8, '#3a3a30');
    rect(g, 4, -31, 14, 2, '#b8b8a8');
  } else {
    box(g, 9, -26, 3, 10, '#6b4423');
    rect(g, 6, -28, 10, 2, '#9a9a8a');
  }
}

function drawGuardian(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const body = flash ? '#ffffff' : '#4a9a9a';
  const bodyD = flash ? '#ffffff' : '#2c6e6e';
  const fin = flash ? '#ffffff' : '#7ad8d0';
  const bob = Math.sin(z.anim * 4) * 1.5;
  const charging = z.windup > 0;
  const firing = z.beamT > 0;
  g.save();
  g.translate(0, bob);
  // 鳍
  rect(g, -14, -16, 4, 8, fin);
  rect(g, 10, -16, 4, 8, fin);
  rect(g, -2, -30, 4, 5, fin);
  // 身体
  box(g, -12, -26, 24, 20, body);
  rect(g, -12, -12, 24, 6, bodyD);
  rect(g, -12, -26, 24, 2, '#8ee8e0');
  // 尖刺
  for (let i = 0; i < 4; i++) rect(g, -10 + i * 6, -29, 3, 4, bodyD);
  // 独眼
  rect(g, -5, -22, 10, 8, '#0e2a2a');
  rect(g, -3, -20, 6, 4, charging ? '#bffaff' : '#5ad8ff');
  if (firing) rect(g, -3, -20, 6, 4, '#ffffff');
  // 尾
  g.fillStyle = bodyD;
  g.beginPath();
  g.moveTo(8, -8);
  g.lineTo(18, -12 + Math.sin(z.anim * 6) * 2);
  g.lineTo(18, -4 + Math.sin(z.anim * 6) * 2);
  g.closePath();
  g.fill();
  g.restore();
}

function drawEvoker(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const skin = flash ? '#ffffff' : '#8a8a92';
  const skinD = flash ? '#ffffff' : '#5e5e66';
  const robe = flash ? '#ffffff' : '#4a4458';
  const robeD = flash ? '#ffffff' : '#332e40';
  const sway = Math.round(Math.sin(z.anim * 6));
  const cast = z.windup > 0;

  box(g, -7, -8, 14, 12, robe);
  rect(g, -7, -3, 14, 2, robeD);
  rect(g, -7, -8, 14, 1, robeD);
  // 双手发光
  box(g, -12, -20, 4, 8, robe);
  box(g, 8, -20, 4, 8, robe);
  rect(g, -13, -14, 3, 3, cast ? '#c8a0ff' : skin);
  rect(g, 10, -14, 3, 3, cast ? '#c8a0ff' : skin);
  // 兜帽头
  box(g, -8, -32, 16, 13, robe);
  rect(g, -6 + sway, -28, 12, 9, skin);
  rect(g, -6 + sway, -28, 12, 2, skinD);
  rect(g, -4 + sway, -25, 2, 2, cast ? '#c8a0ff' : '#1a1a22');
  rect(g, 2 + sway, -25, 2, 2, cast ? '#c8a0ff' : '#1a1a22');
  rect(g, -8, -33, 16, 2, robeD);
  // 尖帽
  g.fillStyle = robeD;
  g.beginPath();
  g.moveTo(-8, -32);
  g.lineTo(0, -44);
  g.lineTo(8, -32);
  g.closePath();
  g.fill();
  rect(g, -1, -44, 2, 3, '#c8a0ff');
}

function drawRavager(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const hide = flash ? '#ffffff' : '#4a4a52';
  const hideD = flash ? '#ffffff' : '#2e2e36';
  const horn = flash ? '#ffffff' : '#c9c4b0';
  const charging = z.chargeT > 0 || z.crouch > 0;
  const legShift = Math.round(Math.sin(z.anim * (charging ? 20 : 8)) * 2);

  // 四条粗腿
  box(g, -11, -10, 5, 10, hideD);
  box(g, -4, -10, 5, 10, hideD);
  box(g, 3, -10, 5, 10, hideD);
  box(g, 10, -10, 5, 10, hideD);
  rect(g, -11, -2 + legShift, 5, 2, '#1a1a1e');
  rect(g, 3, -2 - legShift, 5, 2, '#1a1a1e');
  // 身体
  box(g, -15, -30, 30, 21, hide);
  rect(g, -15, -30, 30, 3, '#6a6a74');
  rect(g, -15, -12, 30, 3, hideD);
  // 背刺
  for (let i = 0; i < 5; i++) {
    rect(g, -12 + i * 5, -33, 3, 4, hideD);
  }
  // 头
  box(g, -9, -25, 18, 12, hide);
  rect(g, -9, -25, 18, 2, '#6a6a74');
  // 角
  rect(g, -10, -29, 3, 6, horn);
  rect(g, 7, -29, 3, 6, horn);
  rect(g, -11, -33, 3, 5, horn);
  rect(g, 8, -33, 3, 5, horn);
  // 眼睛 / 口
  rect(g, -6, -20, 4, 2, charging ? '#ff8030' : '#ff3020');
  rect(g, 2, -20, 4, 2, charging ? '#ff8030' : '#ff3020');
  rect(g, -4, -15, 8, 2, '#1a1a1e');
  rect(g, -4, -15, 2, 3, horn);
  rect(g, 2, -15, 2, 3, horn);
  if (charging) {
    g.fillStyle = 'rgba(255,120,40,0.25)';
    g.beginPath();
    g.ellipse(0, -18, 20, 16, 0, 0, TAU2);
    g.fill();
  }
}

/** 末影龙：黑紫色身躯 + 双翼扇动 + 紫色龙瞳 */
function drawDragon(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const body = flash ? '#ffffff' : '#3a2a56';
  const bodyL = flash ? '#ffffff' : '#5a3f80';
  const bodyD = flash ? '#ffffff' : '#231a34';
  const wing = flash ? '#ffffff' : '#2a1e40';
  const wingEdge = flash ? '#ffffff' : '#7a4ab0';
  const eye = flash ? '#ffffff' : '#e06cff';
  const flap = Math.sin(z.anim * (z.diveT > 0 ? 22 : 6));
  const wy = Math.round(flap * 4);

  // 双翼（半透明膜 + 骨线）
  for (const s of [-1, 1]) {
    g.fillStyle = wing;
    g.beginPath();
    g.moveTo(5 * s, -30);
    g.lineTo(26 * s, -42 + wy);
    g.lineTo(24 * s, -22 + wy);
    g.lineTo(14 * s, -18);
    g.lineTo(6 * s, -18);
    g.closePath();
    g.fill();
    g.strokeStyle = wingEdge;
    g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(6 * s, -28);
      g.lineTo((24 - i * 6) * s, -40 + wy + i * 7);
      g.stroke();
    }
  }

  // 躯干
  box(g, -9, -34, 18, 20, body);
  rect(g, -9, -34, 18, 3, bodyL);
  rect(g, -8, -32, 4, 12, 'rgba(255,255,255,0.10)');
  rect(g, -7, -16, 14, 3, bodyD);
  // 尾
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(0, -15);
  g.lineTo(-5, -1);
  g.lineTo(5, -1);
  g.closePath();
  g.fill();
  // 颈 + 头
  box(g, -5, -45, 10, 12, body);
  rect(g, -5, -45, 10, 2, bodyL);
  // 龙角
  rect(g, -7, -52, 2, 7, bodyD);
  rect(g, 5, -52, 2, 7, bodyD);
  // 眼睛（发光）
  g.fillStyle = eye;
  g.fillRect(-4, -41, 3, 2);
  g.fillRect(1, -41, 3, 2);
  g.globalAlpha = 0.35;
  g.beginPath();
  g.ellipse(0, -41, 8, 4, 0, 0, TAU2);
  g.fill();
  g.globalAlpha = 1;
  // 龙息蓄力：口部紫光
  if (z.breathT > 0) {
    g.fillStyle = 'rgba(208,108,255,0.4)';
    g.beginPath();
    g.ellipse(0, -38, 11, 7, 0, 0, TAU2);
    g.fill();
  }
  // 俯冲残影
  if (z.diveT > 0) {
    g.globalAlpha = 0.4;
    g.fillStyle = '#b06cff';
    g.beginPath();
    g.ellipse(0, -24, 14, 11, 0, 0, TAU2);
    g.fill();
    g.globalAlpha = 1;
  }
}

/** 监守者：高大的深色身躯 + 胸口青色核心 + 头顶角 */
function drawWarden(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const body = flash ? '#ffffff' : '#33454b';
  const bodyD = flash ? '#ffffff' : '#1e2c30';
  const bodyL = flash ? '#ffffff' : '#4c6469';
  const glow = flash ? '#ffffff' : '#57e0d0';
  const locked = z.lockT > 0;
  const sway = Math.round(Math.sin(z.anim * 4) * 1.5);

  // 腿
  box(g, -8, -14, 6, 14, bodyD);
  box(g, 2, -14, 6, 14, bodyD);
  // 躯干
  box(g, -10, -40, 20, 27, body);
  rect(g, -10, -40, 20, 3, bodyL);
  rect(g, -10, -16, 20, 2, bodyD);
  // 胸口核心
  g.fillStyle = glow;
  g.globalAlpha = locked ? 0.95 : 0.5;
  g.fillRect(-3, -32, 6, 8);
  g.globalAlpha = 0.35;
  g.beginPath();
  g.ellipse(0, -28, 11, 12, 0, 0, TAU2);
  g.fill();
  g.globalAlpha = 1;
  // 头（无眼，只有发光的角）
  box(g, -7 + sway, -52, 14, 13, body);
  rect(g, -7 + sway, -52, 14, 2, bodyL);
  rect(g, -5 + sway, -56, 3, 5, bodyD);
  rect(g, 2 + sway, -56, 3, 5, bodyD);
  // 触须（听觉触角）
  g.strokeStyle = bodyL;
  g.lineWidth = 1;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(4 * s + sway, -44);
    g.lineTo(11 * s, -40);
    g.lineTo(13 * s, -32 + Math.round(Math.sin(z.anim * 6 + s) * 2));
    g.stroke();
  }
  // 锁定状态：青色描边脉冲
  if (locked) {
    g.strokeStyle = 'rgba(87,224,208,0.55)';
    g.lineWidth = 1;
    g.strokeRect(-11, -41, 22, 29);
  }
}

/** 蜘蛛骑士：骷髅骑在蜘蛛上 */
function drawSpiderJockey(g: C, z: ZombieState) {
  // 蜘蛛底盘
  drawSpiderBody(g, z);
  // 骷髅骑士（缩小版，坐在蜘蛛背上）
  const flash = z.flash > 0;
  const bone = flash ? '#ffffff' : '#e8e6dc';
  const boneD = flash ? '#ffffff' : '#a8a69a';
  const bob = Math.round(Math.sin(z.anim * 8) * 1);
  g.save();
  g.translate(0, -14 + bob);
  // 躯干（细骨架）
  box(g, -3, -11, 7, 9, bone);
  for (let i = 0; i < 3; i++) rect(g, -2, -9 + i * 3, 5, 1, boneD);
  // 头骨
  box(g, -4, -20, 9, 9, bone);
  rect(g, -4, -20, 9, 1, boneD);
  // 眼窝
  rect(g, -3, -17, 2, 2, '#1a1a1a');
  rect(g, 2, -17, 2, 2, '#1a1a1a');
  // 下颌
  rect(g, -3, -13, 7, 1, boneD);
  // 弓
  g.strokeStyle = '#8a5a2b';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(7, -6, 5, -1.3, 1.3);
  g.stroke();
  g.strokeStyle = '#e8e0d0';
  g.beginPath();
  g.moveTo(8, -11);
  g.lineTo(8, -1);
  g.stroke();
  g.restore();
}

/** 鸡骑士：小僵尸骑鸡 */
function drawChickenJockey(g: C, z: ZombieState) {
  const flash = z.flash > 0;
  const feather = flash ? '#ffffff' : '#f2f0e4';
  const featherD = flash ? '#ffffff' : '#c8c2a8';
  const leg = flash ? '#ffffff' : '#e0a02a';
  const bob = Math.round(Math.sin(z.anim * 14) * 1.5);
  // 鸡腿
  rect(g, -4, -4, 2, 4, leg);
  rect(g, 2, -4, 2, 4, leg);
  // 鸡身
  box(g, -6, -14, 12, 11, feather);
  rect(g, -6, -14, 12, 2, featherD);
  // 翅膀
  rect(g, -9, -12, 3, 6, featherD);
  rect(g, 6, -12, 3, 6, featherD);
  // 鸡头+喙+鸡冠
  box(g, 2, -20, 7, 7, feather);
  rect(g, 9, -17, 3, 2, leg);
  rect(g, 3, -23, 2, 3, '#d02020');
  rect(g, 6, -23, 2, 2, '#d02020');
  // 小僵尸
  g.save();
  g.translate(-1, -20 + bob);
  const skin = flash ? '#ffffff' : '#5b945b';
  const shirt = flash ? '#ffffff' : '#2e5f63';
  box(g, -4, -9, 8, 8, shirt);
  box(g, -4, -16, 8, 7, skin);
  rect(g, -3, -14, 2, 2, '#101010');
  rect(g, 1, -14, 2, 2, '#101010');
  // 举起的小手
  rect(g, -6, -12, 2, 3, skin);
  rect(g, 4, -12, 2, 3, skin);
  g.restore();
}

/** 末影水晶：悬浮的紫色晶体 + 光柱 */
export function drawCrystal(g: C, c: { x: number; y: number; hp: number; maxHp: number; flash: number }) {
  const flash = c.flash > 0;
  const k = Math.max(0, c.hp / c.maxHp);
  const bob = Math.sin(performance.now() / 520 + c.x * 0.05) * 2;
  g.save();
  g.translate(0, 0);
  // 光柱
  g.globalAlpha = 0.16 + (flash ? 0.3 : 0) + k * 0.05;
  const grad = g.createLinearGradient(0, c.y - 70, 0, c.y);
  grad.addColorStop(0, 'rgba(208,108,255,0)');
  grad.addColorStop(1, 'rgba(208,108,255,0.85)');
  g.fillStyle = grad;
  g.fillRect(c.x - 5, c.y - 70, 10, 70);
  g.globalAlpha = 1;
  // 底座
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.beginPath();
  g.ellipse(c.x, c.y + 4, 10, 4, 0, 0, TAU2);
  g.fill();
  g.fillStyle = '#3a2a56';
  g.fillRect(c.x - 9, c.y + 2, 18, 4);
  // 晶体
  const cy = c.y - 16 + bob;
  g.fillStyle = flash ? '#ffffff' : '#c06cff';
  g.beginPath();
  g.moveTo(c.x, cy - 12);
  g.lineTo(c.x + 8, cy);
  g.lineTo(c.x, cy + 12);
  g.lineTo(c.x - 8, cy);
  g.closePath();
  g.fill();
  g.fillStyle = flash ? '#ffffff' : '#f0d0ff';
  g.beginPath();
  g.moveTo(c.x, cy - 10);
  g.lineTo(c.x + 3, cy);
  g.lineTo(c.x, cy + 6);
  g.lineTo(c.x - 3, cy);
  g.closePath();
  g.fill();
  // 血条
  if (k < 0.999) {
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(c.x - 12, cy - 20, 24, 3);
    g.fillStyle = '#d06cff';
    g.fillRect(c.x - 12, cy - 20, 24 * k, 3);
  }
  g.restore();
}

/** 幽匿尖啸体：暗色方块 + 青眼，尖啸时脉冲扩散 */
export function drawShrieker(g: C, s: { x: number; y: number; pulse: number; anim: number }, time: number) {
  const puls = s.pulse > 0 ? s.pulse / 0.7 : 0;
  // 脉冲环
  if (puls > 0) {
    g.globalAlpha = 0.5 * puls;
    g.strokeStyle = '#7ad8ff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(s.x, s.y - 6, 10 + (1 - puls) * 70, 0, TAU2);
    g.stroke();
    g.globalAlpha = 1;
  }
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.beginPath();
  g.ellipse(s.x, s.y + 4, 11, 4, 0, 0, TAU2);
  g.fill();
  // 本体
  g.fillStyle = '#1e2e33';
  g.fillRect(s.x - 9, s.y - 16, 18, 20);
  g.fillStyle = '#2b4247';
  g.fillRect(s.x - 9, s.y - 16, 18, 3);
  // 纹理（幽匿脉络）
  g.fillStyle = '#3f6b70';
  for (let i = 0; i < 3; i++) {
    g.fillRect(s.x - 7 + i * 6, s.y - 11 + ((i * 7) % 9), 2, 5);
  }
  // 眼
  const blink = puls > 0 ? 1 : 0.6 + Math.sin(time * 3 + s.x) * 0.2;
  g.globalAlpha = blink;
  g.fillStyle = '#7ad8ff';
  g.fillRect(s.x - 5, s.y - 8, 3, 3);
  g.fillRect(s.x + 2, s.y - 8, 3, 3);
  g.globalAlpha = 1;
}

/** 唤魔者尖牙：k 为破土进度 0..1 */
export function drawFang(g: C, x: number, y: number, k: number) {
  const h = Math.max(0, Math.min(1, k));
  g.save();
  g.translate(-1, 0);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(x, y, 8, 3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d8d0c0';
  const hh = 14 * h;
  g.beginPath();
  g.moveTo(x - 6, y);
  g.lineTo(x - 1, y - hh);
  g.lineTo(x + 2, y);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(x + 2, y);
  g.lineTo(x + 6, y - hh * 0.75);
  g.lineTo(x + 8, y);
  g.closePath();
  g.fill();
  g.fillStyle = '#9a9182';
  g.fillRect(x - 6, y - 1, 14, 2);
  g.restore();
}

export function drawSpinAxe(g: C, s: PlayerState) {
  if (s.spinT <= 0) return;
  const x = Math.round(s.x);
  const y = Math.round(s.y - 16);
  g.save();
  g.translate(x, y);
  for (const off of [0, Math.PI]) {
    g.save();
    g.rotate(s.spinAngle + off);
    g.translate(24, 0);
    g.rotate(0.7);
    box(g, -3, -6, 7, 12, '#c9c9c9');
    rect(g, -3, -6, 7, 2, '#e8e8e8');
    rect(g, -3, -6, 2, 12, '#e8e8e8');
    rect(g, 2, -6, 2, 12, '#9a9a9a');
    rect(g, -1, -2, 3, 4, '#6b4423');
    g.restore();
  }
  g.strokeStyle = 'rgba(255,176,64,0.35)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(0, 0, 28, 0, TAU2);
  g.stroke();
  g.restore();
}

export function drawZombie(g: C, z: ZombieState) {
  g.save();
  g.translate(Math.round(z.x), Math.round(z.y));
  if (z.scale !== 1) g.scale(z.scale, z.scale);

  if (z.kind === 'creeper' || z.kind === 'charged' || z.kind === 'bossCreeper') {
    const blaze = z.fuse > 0.28 && Math.sin(z.fuse * 50) > 0;
    drawCreeperBody(g, z.flash > 0 ? 'flash' : blaze ? 'blaze' : 'normal');
    if ((z.kind === 'charged' || z.kind === 'bossCreeper') && z.flash <= 0) {
      g.strokeStyle = 'rgba(130,200,255,0.9)';
      g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const a = z.anim * 10 + i * 2.1;
        const jx = Math.sin(a) * 3;
        g.beginPath();
        g.moveTo(-12 + i * 9 + jx * 0.5, -27);
        g.lineTo(-9 + i * 9 + jx, -21);
        g.lineTo(-12 + i * 9 - jx, -13);
        g.lineTo(-9 + i * 9 + jx * 0.5, -8);
        g.stroke();
      }
      g.fillStyle = 'rgba(120,190,255,0.22)';
      g.beginPath();
      g.ellipse(0, -14, 11, 15, 0, 0, TAU2);
      g.fill();
      if (z.kind === 'bossCreeper') {
        g.strokeStyle = '#4aa8ff';
        g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = z.anim * 8 + (i / 4) * TAU2;
          const jx = Math.sin(a) * 2;
          g.beginPath();
          g.moveTo(-8 + i * 5 + jx, -30);
          g.lineTo(-6 + i * 5 - jx, -26);
          g.lineTo(-8 + i * 5 + jx, -22);
          g.stroke();
        }
        g.fillStyle = 'rgba(74,168,255,0.16)';
        g.beginPath();
        g.ellipse(0, -14, 14, 19, 0, 0, TAU2);
        g.fill();
      }
    }
    g.restore();
    return;
  }
  if (z.kind === 'skeleton') {
    drawSkeleton(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'spider') {
    drawSpiderBody(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'enderman') {
    drawEnderman(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'witch') {
    drawWitch(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'slime') {
    drawSlime(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'blaze') {
    drawBlaze(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'phantom') {
    drawPhantom(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'witherSkel') {
    drawWitherSkel(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'wither') {
    drawWither(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'pigman') {
    drawPigman(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'silverfish') {
    drawSilverfish(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'drowned') {
    drawDrowned(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'stray') {
    drawStray(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'pillager') {
    drawPillager(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'guardian') {
    drawGuardian(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'evoker') {
    drawEvoker(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'ravager') {
    drawRavager(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'bossDragon') {
    drawDragon(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'bossWarden') {
    drawWarden(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'spiderJockey') {
    drawSpiderJockey(g, z);
    g.restore();
    return;
  }
  if (z.kind === 'chickenJockey') {
    drawChickenJockey(g, z);
    g.restore();
    return;
  }

  const tier = z.kind === 'leather' || z.kind === 'iron' || z.kind === 'gold' ? (z.kind as 'leather' | 'iron' | 'gold') : undefined;
  const white = z.flash > 0;

  let skin = PAL.zSkin;
  let skinDark = PAL.zSkinDark;
  let shirt = PAL.zShirt;
  let shirtDark = '#23494c';
  let pants = PAL.zPants;
  let pantsDark = '#2a2a50';
  let eye = '#1a1a1a';
  if (z.kind === 'fast') {
    skin = '#8fae4a';
    skinDark = '#6f8c34';
    shirt = '#4a7a3a';
    shirtDark = '#3a5e2c';
    pants = '#2f2f5a';
  } else if (z.kind === 'leather') {
    shirt = '#7d5228';
    shirtDark = '#5e3a1a';
  } else if (z.kind === 'iron') {
    shirt = '#8a9096';
    shirtDark = '#5f656b';
  } else if (z.kind === 'gold') {
    shirt = '#c69a12';
    shirtDark = '#8a6a08';
  } else if (z.kind === 'boss') {
    skin = '#4f8a3f';
    skinDark = '#356b2a';
    shirt = '#3a2424';
    shirtDark = '#2a1818';
    pants = '#26263a';
    eye = '#ff3020';
  }
  if (white) {
    skin = '#ffffff';
    skinDark = '#ffffff';
    shirt = '#ffffff';
    shirtDark = '#ffffff';
    pants = '#ffffff';
    pantsDark = '#ffffff';
  }

  const sway = Math.round(Math.sin(z.anim * 7));

  box(g, -7 + sway, -8, 4, 8, pants);
  box(g, 3 - sway, -8, 4, 8, pants);
  box(g, -7, -20, 14, 12, shirt);
  rect(g, -7, -9, 14, 1, shirtDark);
  rect(g, -7, -20, 14, 1, 'rgba(255,255,255,0.08)');
  rect(g, -8 + sway, -8, 2, 2, skin);
  rect(g, 2, -8, 3, 2, skin);

  box(g, -11, -19, 4, 9, shirt);
  rect(g, -11, -11, 4, 1, shirtDark);
  box(g, 7, -19, 4, 10, skin);
  rect(g, -11, -10, 4, 2, skin);
  rect(g, 7, -9, 4, 2, skinDark);

  box(g, -9, -34, 18, 14, skin);
  rect(g, -9, -34, 18, 3, skinDark);
  rect(g, -9, -34, 2, 7, skinDark);
  rect(g, 7, -34, 2, 7, skinDark);
  rect(g, -6 + sway, -28, 3, 3, eye);
  rect(g, 3 + sway, -28, 3, 3, eye);
  rect(g, -5 + sway, -28, 1, 1, 'rgba(255,255,255,0.35)');
  rect(g, 4 + sway, -28, 1, 1, 'rgba(255,255,255,0.35)');
  rect(g, -4, -24, 8, 2, '#2a1414');
  rect(g, -2, -24, 1, 2, '#d8d8c8');
  rect(g, 8, -27, 2, 2, '#5a1a1a');

  if (tier) {
    const c = tierColors(tier);
    rect(g, -9, -34, 18, 4, c[0]);
    rect(g, -9, -34, 18, 1, c[1]);
    rect(g, -9, -30, 18, 1, c[2]);
    rect(g, -9, -30, 2, 3, c[0]);
    rect(g, 7, -30, 2, 3, c[0]);
    rect(g, -5, -19, 10, 9, c[0]);
    rect(g, -5, -19, 10, 1, c[1]);
    rect(g, -5, -10, 10, 1, c[2]);
    rect(g, -1, -16, 2, 6, c[2]);
    rect(g, -10, -20, 4, 4, c[0]);
    rect(g, 6, -20, 4, 4, c[0]);
    rect(g, -10, -20, 4, 1, c[1]);
    rect(g, 6, -20, 4, 1, c[1]);
  }

  if (z.kind === 'boss') {
    rect(g, -7, -39, 14, 3, PAL.gold);
    rect(g, -7, -42, 3, 4, PAL.gold);
    rect(g, -2, -42, 4, 5, PAL.gold);
    rect(g, 4, -42, 3, 4, PAL.gold);
    rect(g, -2, -38, 1, 1, '#ff3030');
    rect(g, 3, -38, 1, 1, '#4aedd9');
    rect(g, -6, -20, 12, 4, '#4a1c1c');
  }

  g.restore();
}

export function drawArrow(g: C, a: ArrowState) {
  g.save();
  g.translate(Math.round(a.x), Math.round(a.y));
  g.rotate(a.angle);
  if (a.trident) {
    rect(g, -11, -1, 16, 2, 'rgba(10,10,14,0.5)');
    rect(g, -10, -1, 15, 2, '#c9c9c9');
    rect(g, -12, -2, 3, 4, '#9a9a9a');
    rect(g, -11, -4, 2, 8, '#c9c9c9');
    rect(g, -6, -4, 2, 8, '#c9c9c9');
    rect(g, -12, -4, 8, 2, '#9a9a9a');
    rect(g, 5, -2, 4, 4, '#6b4423');
  } else {
    rect(g, -11, -1, 19, 2, 'rgba(10,10,14,0.5)');
    rect(g, -10, -1, 18, 2, a.fromPlayer ? '#e8c07a' : '#e8e8e0');
    rect(g, -11, -2, 3, 4, a.fromPlayer ? '#c23b2a' : '#8a8a88');
    rect(g, 7, -2, 4, 4, '#f4f4f0');
    rect(g, 9, -1, 2, 2, '#b8b8b0');
  }
  g.restore();
}

export function drawHook(g: C, x: number, y: number) {
  box(g, Math.round(x) - 2, Math.round(y) - 1, 3, 3, '#9aa0a6');
  rect(g, Math.round(x) + 1, Math.round(y) - 2, 1, 1, '#c0c6cc');
  rect(g, Math.round(x) + 2, Math.round(y) - 3, 1, 2, '#c0c6cc');
}

export function drawTntEntity(g: C, t: TntState) {
  const x = Math.round(t.x);
  const y = Math.round(t.y);
  const blink = Math.sin(t.fuse * 34) > 0;
  box(g, x - 6, y - 5, 12, 10, blink ? '#e04a2a' : '#c23b2a');
  rect(g, x - 6, y - 3, 12, 5, blink ? '#ffffff' : '#e8e0d0');
  rect(g, x - 4, y - 2, 2, 2, '#101010');
  rect(g, x - 1, y - 2, 2, 2, '#101010');
  rect(g, x + 2, y - 2, 2, 2, '#101010');
  rect(g, x - 3, y - 6, 6, 1, '#8a5a3a');
}

export function drawPotion(g: C, p: PotionState) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  box(g, x - 3, y - 4, 6, 8, PAL.potion);
  rect(g, x - 2, y - 3, 1, 4, '#b060e0');
  rect(g, x - 2, y - 3, 2, 1, '#c98af0');
  rect(g, x - 2, y - 6, 4, 2, '#7a5a3a');
  rect(g, x - 1, y, 2, 1, '#d8b0f8');
}

export function drawFireball(g: C, f: FireballState) {
  const x = Math.round(f.x);
  const y = Math.round(f.y);
  if (f.skull) {
    g.fillStyle = 'rgba(60,60,80,0.4)';
    g.beginPath();
    g.arc(x, y, 9, 0, TAU2);
    g.fill();
    box(g, x - 4, y - 5, 8, 7, '#2e2e36');
    rect(g, x - 3, y - 4, 6, 5, '#3a3a44');
    rect(g, x - 2, y - 2, 2, 2, '#101014');
    rect(g, x + 1, y - 2, 2, 2, '#101014');
    rect(g, x - 1, y + 1, 2, 1, '#101014');
  } else {
    g.fillStyle = 'rgba(255,150,60,0.35)';
    g.beginPath();
    g.arc(x, y, 7, 0, TAU2);
    g.fill();
    rect(g, x - 3, y - 3, 6, 6, '#ff9a3c');
    rect(g, x - 2, y - 4, 4, 2, '#ffd76b');
    rect(g, x - 1, y - 5, 2, 2, '#fff3a0');
  }
}

export function drawGolem(g: C, go: GolemState) {
  const x = Math.round(go.x);
  const y = Math.round(go.y);
  const flash = go.flash > 0;
  const iron = flash ? '#ffffff' : '#d8dce0';
  const dark = flash ? '#ffffff' : '#9aa0a8';
  const step = Math.round(Math.sin(go.anim * 9));
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(x, y + 1, 11, 4, 0, 0, TAU2);
  g.fill();
  box(g, x - 7 + step, y - 10, 5, 10, dark);
  box(g, x + 2 - step, y - 10, 5, 10, dark);
  rect(g, x - 7 + step, y - 2, 5, 2, '#6a7078');
  rect(g, x + 2 - step, y - 2, 5, 2, '#6a7078');
  box(g, x - 9, y - 26, 18, 16, dark);
  rect(g, x - 8, y - 25, 16, 14, iron);
  rect(g, x - 8, y - 25, 16, 2, '#eef2f6');
  rect(g, x - 2, y - 22, 4, 9, dark);
  const sw = go.swingT > 0 ? 3 : 0;
  box(g, x - 14, y - 24 + sw, 5, 13, iron);
  box(g, x + 9, y - 24 - sw, 5, 13, iron);
  rect(g, x - 14, y - 24 + sw, 5, 2, '#eef2f6');
  rect(g, x + 9, y - 24 - sw, 5, 2, '#eef2f6');
  box(g, x - 6, y - 36, 12, 10, dark);
  rect(g, x - 5, y - 35, 10, 8, iron);
  rect(g, x - 3, y - 33, 2, 3, '#8a3a3a');
  rect(g, x + 2, y - 33, 2, 3, '#8a3a3a');
  rect(g, x - 1, y - 29, 3, 1, dark);
  if (go.hp < go.maxHp) {
    const k = Math.max(0, Math.min(1, go.hp / go.maxHp));
    rect(g, x - 10, y - 45, 20, 2, '#141418');
    rect(g, x - 10, y - 45, Math.max(1, Math.round(20 * k)), 2, k > 0.5 ? '#6ee86e' : k > 0.25 ? '#ffd76b' : '#ff5a4a');
  }
}

export function drawCampfire(g: C, c: CampfireState) {
  const x = Math.round(c.x);
  const y = Math.round(c.y);
  const flick = Math.sin(c.t * 13);
  const k = 1 - Math.min(1, c.t / c.max);
  g.fillStyle = `rgba(255,150,60,${0.16 * k + 0.04})`;
  g.beginPath();
  g.arc(x, y - 6, 18, 0, TAU2);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(x, y + 1, 10, 4, 0, 0, TAU2);
  g.fill();
  rect(g, x - 9, y - 2, 3, 3, '#8f8f8f');
  rect(g, x + 6, y - 2, 3, 3, '#7a7a7a');
  rect(g, x - 3, y - 1, 6, 3, '#6a6a6a');
  rect(g, x - 5, y - 4, 10, 2, '#5a3a20');
  rect(g, x - 2, y - 6, 4, 6, '#6b4423');
  rect(g, x - 3, y - 10 + Math.round(flick), 6, 6, '#ff8a30');
  rect(g, x - 2, y - 12 + Math.round(flick), 4, 5, '#ffd76b');
  rect(g, x - 1, y - 14 + Math.round(flick * 0.7), 2, 3, '#fff3a0');
}

export function drawTrader(g: C, t: TraderState) {
  const x = Math.round(t.x);
  const y = Math.round(t.y);
  const bob = Math.round(Math.sin(t.bob * 3) * 1);
  const top = y - 34 + bob;
  const skirt = '#c8b47c';
  const skirtD = '#a08a52';
  const skirtL = '#dccb97';
  const gold = '#d9a441';
  const leather = '#6b4a2e';
  const leatherD = '#4a3120';
  const skin = '#d9b08c';

  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(x, y + 1, 9, 3, 0, 0, TAU2);
  g.fill();

  // 背包（身后）
  box(g, x + 4, top + 12, 7, 12, leather);
  rect(g, x + 4, top + 12, 7, 2, '#7d5836');
  rect(g, x + 5, top + 15, 5, 4, '#e8dcc0');
  rect(g, x + 5, top + 15, 5, 1, '#f4ecd8');

  // 长袍下摆 + 靴子
  box(g, x - 6, y - 12, 12, 10, skirt);
  rect(g, x - 6, y - 3, 12, 2, skirtD);
  rect(g, x - 5, y - 1, 4, 1, leatherD);
  rect(g, x + 1, y - 1, 4, 1, leatherD);
  // 长袍上身
  box(g, x - 5, top + 14, 11, 9, skirt);
  rect(g, x - 5, top + 14, 11, 1, skirtL);
  // 金色前襟 + 下摆包边
  rect(g, x - 1, top + 14, 2, 9, gold);
  rect(g, x - 6, y - 3, 12, 1, gold);
  // 青色斜挎带
  for (let i = 0; i < 6; i++) rect(g, x - 4 + i, top + 14 + i, 2, 2, '#2f8fa0');
  // 腰带 + 铜扣
  rect(g, x - 5, y - 11, 11, 2, leather);
  rect(g, x - 1, y - 11, 3, 2, gold);
  // 手臂 + 手
  box(g, x - 8, top + 15, 3, 7, skirt);
  box(g, x + 6, top + 15, 3, 7, skirt);
  rect(g, x - 8, top + 22, 3, 2, skin);
  rect(g, x + 6, top + 22, 3, 2, skin);
  // 提灯（暖光）
  g.globalAlpha = 0.22;
  g.fillStyle = '#ffb040';
  g.beginPath();
  g.arc(x + 6, y - 7, 9, 0, TAU2);
  g.fill();
  g.globalAlpha = 1;
  rect(g, x + 5, y - 9, 4, 2, leatherD);
  rect(g, x + 5, y - 7, 4, 5, '#ffcf6b');
  rect(g, x + 6, y - 6, 2, 3, '#fff0b0');
  // 头 + 胡子
  box(g, x - 4, top + 6, 9, 9, skin);
  rect(g, x - 4, top + 6, 9, 1, '#e6c4a4');
  rect(g, x - 3, top + 9, 2, 2, '#2a2a2a');
  rect(g, x + 2, top + 9, 2, 2, '#2a2a2a');
  rect(g, x - 3, top + 13, 7, 2, '#cfcfc8');
  rect(g, x - 2, top + 15, 5, 1, '#e2e2dc');
  // 宽檐帽
  box(g, x - 8, top + 3, 17, 3, '#c9b878');
  rect(g, x - 8, top + 5, 17, 1, '#8f7f48');
  box(g, x - 4, top - 1, 9, 5, '#b9a45e');
  rect(g, x - 4, top + 2, 9, 2, leather);
  rect(g, x - 4, top - 1, 9, 1, '#d3c07d');
  // 木杖
  rect(g, x - 9, top + 8, 2, 26, '#7a5a34');
  rect(g, x - 9, top + 8, 1, 26, '#9a7a44');
  box(g, x - 10, top + 5, 4, 4, '#6b4a2e');
}

export function drawHeartDrop(g: C, x: number, y: number, bob: number) {
  const yy = Math.round(y + Math.sin(bob * 6) * 2);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y) + 1, 5, 2, 0, 0, Math.PI * 2);
  g.fill();
  rect(g, x - 4, yy - 8, 3, 3, '#e83939');
  rect(g, x + 1, yy - 8, 3, 3, '#e83939');
  rect(g, x - 4, yy - 6, 8, 3, '#e83939');
  rect(g, x - 3, yy - 3, 6, 2, '#b01818');
  rect(g, x - 2, yy - 1, 4, 1, '#b01818');
  rect(g, x - 3, yy - 9, 2, 1, '#ff9090');
}

export function drawAppleDrop(g: C, x: number, y: number, bob: number) {
  const yy = Math.round(y + Math.sin(bob * 6) * 2);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y) + 1, 5, 2, 0, 0, Math.PI * 2);
  g.fill();
  rect(g, x - 4, yy - 8, 8, 7, '#f5d327');
  rect(g, x - 3, yy - 1, 6, 2, '#d4a017');
  rect(g, x - 2, yy + 1, 4, 1, '#d4a017');
  rect(g, x - 4, yy - 8, 8, 1, '#ffe680');
  rect(g, x + 2, yy - 4, 2, 2, '#fff6c0');
  rect(g, x, yy - 10, 1, 2, '#5a3a20');
  rect(g, x + 1, yy - 11, 3, 2, '#4a9a2a');
}

export function drawGunpowderDrop(g: C, x: number, y: number, bob: number) {
  const yy = Math.round(y + Math.sin(bob * 6) * 2);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y) + 1, 5, 2, 0, 0, TAU2);
  g.fill();
  rect(g, x - 3, yy - 8, 6, 3, '#8a8a84');
  rect(g, x - 4, yy - 5, 8, 6, '#4a4a48');
  rect(g, x - 4, yy - 5, 8, 1, '#6a6a66');
  rect(g, x - 1, yy - 2, 2, 2, '#2a2a28');
}

export function drawEyeDrop(g: C, x: number, y: number, bob: number) {
  const yy = Math.round(y + Math.sin(bob * 6) * 2);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y) + 1, 5, 2, 0, 0, TAU2);
  g.fill();
  rect(g, x - 4, yy - 8, 8, 7, '#2a5a3a');
  rect(g, x - 4, yy - 8, 8, 2, '#3fae7a');
  rect(g, x - 2, yy - 5, 4, 3, '#d06cff');
  rect(g, x, yy - 5, 2, 3, '#101010');
  rect(g, x - 1, yy - 5, 1, 1, '#f0b8ff');
}

export function drawXpDrop(g: C, x: number, y: number, bob: number) {
  const yy = Math.round(y + Math.sin(bob * 7) * 2);
  g.fillStyle = 'rgba(110,232,110,0.28)';
  g.beginPath();
  g.arc(Math.round(x), yy, 5, 0, TAU2);
  g.fill();
  rect(g, x - 2, yy - 2, 4, 4, '#6ee86e');
  rect(g, x - 1, yy - 3, 2, 2, '#d8ffa0');
  rect(g, x - 1, yy + 1, 1, 1, '#3a9a3a');
}

export function drawEmeraldDrop(g: C, x: number, y: number, bob: number) {
  const yy = Math.round(y + Math.sin(bob * 7) * 2);
  g.fillStyle = 'rgba(110,232,110,0.28)';
  g.beginPath();
  g.arc(Math.round(x), yy, 6, 0, TAU2);
  g.fill();
  rect(g, x - 3, yy - 5, 6, 10, '#2fae5a');
  rect(g, x - 2, yy - 6, 4, 1, '#3fbe6a');
  rect(g, x - 3, yy - 5, 2, 10, '#3fbe6a');
  rect(g, x - 1, yy - 2, 2, 3, '#8ef0b0');
  rect(g, x, yy - 1, 1, 1, '#d8ffe8');
}

export function drawMetalDrop(g: C, x: number, y: number, bob: number, kind: 'iron' | 'gold' | 'diamond') {
  const yy = Math.round(y + Math.sin(bob * 6) * 2);
  const c = kind === 'iron' ? '#d8dce0' : kind === 'gold' ? '#f5d327' : '#4aedd9';
  const cd = kind === 'iron' ? '#9aa0a8' : kind === 'gold' ? '#c69a12' : '#2a9a8a';
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y) + 1, 5, 2, 0, 0, TAU2);
  g.fill();
  rect(g, x - 4, yy - 6, 8, 8, cd);
  rect(g, x - 3, yy - 5, 6, 6, c);
  rect(g, x - 2, yy - 4, 3, 1, '#ffffff');
  rect(g, x - 3, yy + 1, 6, 1, cd);
}

export function drawCoalDrop(g: C, x: number, y: number, bob: number) {
  const yy = Math.round(y + Math.sin(bob * 6) * 2);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y) + 1, 5, 2, 0, 0, TAU2);
  g.fill();
  rect(g, x - 4, yy - 6, 8, 8, '#2a2a30');
  rect(g, x - 3, yy - 5, 6, 6, '#3a3a44');
  rect(g, x - 2, yy - 4, 3, 1, '#6a6a78');
  rect(g, x - 3, yy - 1, 6, 1, '#1a1a20');
}

export function drawPotionDrop(g: C, x: number, y: number, bob: number, color: string) {
  const yy = Math.round(y + Math.sin(bob * 6) * 2);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y) + 1, 5, 2, 0, 0, TAU2);
  g.fill();
  rect(g, x - 3, yy - 7, 6, 9, color);
  rect(g, x - 2, yy - 6, 1, 4, 'rgba(255,255,255,0.4)');
  rect(g, x - 2, yy - 9, 4, 2, '#7a5a3a');
  rect(g, x - 2, yy - 6, 3, 1, 'rgba(255,255,255,0.25)');
}

export function drawBookDrop(g: C, x: number, y: number, bob: number) {
  const yy = Math.round(y + Math.sin(bob * 6) * 2);
  g.fillStyle = 'rgba(192,108,255,0.3)';
  g.beginPath();
  g.arc(Math.round(x), yy - 2, 7, 0, TAU2);
  g.fill();
  rect(g, x - 4, yy - 7, 8, 9, '#8a3ac0');
  rect(g, x - 4, yy - 7, 8, 2, '#a05ae0');
  rect(g, x - 1, yy - 3, 3, 1, '#f0d8ff');
  rect(g, x - 1, yy - 6, 3, 1, '#f0d8ff');
  rect(g, x - 4, yy - 1, 8, 1, '#5a2a70');
}

export function drawDiscDrop(g: C, x: number, y: number, bob: number, color: string) {
  const yy = Math.round(y + Math.sin(bob * 7) * 2);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y) + 1, 6, 2, 0, 0, TAU2);
  g.fill();
  rect(g, x - 6, yy - 10, 12, 12, color);
  rect(g, x - 5, yy - 9, 10, 10, '#1a1a22');
  rect(g, x - 3, yy - 7, 6, 6, color);
  rect(g, x - 1, yy - 5, 2, 2, '#ffffff');
  rect(g, x - 6, yy - 10, 12, 1, 'rgba(255,255,255,0.5)');
}

export function drawFireballDrop(g: C, x: number, y: number, bob: number) {
  const yy = Math.round(y + Math.sin(bob * 7) * 2);
  g.fillStyle = 'rgba(255,150,60,0.3)';
  g.beginPath();
  g.arc(Math.round(x), yy - 2, 7, 0, TAU2);
  g.fill();
  rect(g, x - 3, yy - 5, 6, 6, '#ff9a3c');
  rect(g, x - 2, yy - 6, 4, 2, '#ffd76b');
  rect(g, x - 1, yy - 7, 2, 2, '#fff3a0');
}

export function drawEappleDrop(g: C, x: number, y: number, bob: number) {
  const yy = Math.round(y + Math.sin(bob * 6) * 2);
  g.fillStyle = 'rgba(245,211,39,0.3)';
  g.beginPath();
  g.arc(Math.round(x), yy - 2, 8, 0, TAU2);
  g.fill();
  rect(g, x - 4, yy - 7, 8, 8, '#f5d327');
  rect(g, x - 3, yy - 6, 6, 6, '#ffe680');
  rect(g, x - 2, yy - 5, 3, 2, '#fff6c0');
  rect(g, x - 4, yy - 7, 8, 1, '#ffffff');
  rect(g, x, yy - 9, 1, 2, '#5a3a20');
  rect(g, x + 1, yy - 10, 3, 2, '#4a9a2a');
}

export function drawChest(g: C, c: { x: number; y: number; opened: boolean; anim: number }) {
  const x = Math.round(c.x);
  const y = Math.round(c.y);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(x, y + 7, 11, 4, 0, 0, TAU2);
  g.fill();
  if (c.opened) {
    box(g, x - 10, y - 2, 20, 9, '#5f4520');
    rect(g, x - 10, y - 2, 20, 2, '#6b4f28');
    rect(g, x - 8, y - 1, 4, 8, '#2f2210');
    rect(g, x + 4, y - 1, 4, 8, '#2f2210');
    rect(g, x - 2, y + 4, 4, 2, '#8a6a3a');
    rect(g, x - 8, y - 6, 16, 2, '#7a5a30');
    rect(g, x - 5, y - 8, 10, 2, '#7a5a30');
    g.fillStyle = `rgba(255,220,120,${0.6 + Math.sin(c.anim * 8) * 0.4})`;
    g.beginPath();
    g.arc(x, y - 9, 3 + Math.sin(c.anim * 6) * 1, 0, TAU2);
    g.fill();
    return;
  }
  box(g, x - 10, y - 8, 20, 15, '#8a6a3a');
  rect(g, x - 10, y - 8, 20, 2, '#9a7440');
  rect(g, x - 10, y + 5, 20, 2, '#5f4520');
  rect(g, x - 8, y - 7, 16, 12, '#6b4f28');
  rect(g, x - 8, y - 1, 16, 2, '#4a3618');
  rect(g, x - 3, y - 3, 6, 4, '#d4a017');
  rect(g, x - 2, y - 2, 4, 2, '#f5d327');
  const glint = Math.sin(c.anim * 5) > 0.4;
  if (glint) {
    rect(g, x - 8, y - 7, 2, 12, 'rgba(255,255,255,0.18)');
  }
}

export function drawDrop(g: C, d: DropState) {
  if (d.kind === 'apple') drawAppleDrop(g, d.x, d.y, d.bob);
  else if (d.kind === 'gunpowder') drawGunpowderDrop(g, d.x, d.y, d.bob);
  else if (d.kind === 'eye') drawEyeDrop(g, d.x, d.y, d.bob);
  else if (d.kind === 'xp') drawXpDrop(g, d.x, d.y, d.bob);
  else if (d.kind === 'emerald') drawEmeraldDrop(g, d.x, d.y, d.bob);
  else if (d.kind === 'iron' || d.kind === 'gold' || d.kind === 'diamond') drawMetalDrop(g, d.x, d.y, d.bob, d.kind);
  else if (d.kind === 'coal') drawCoalDrop(g, d.x, d.y, d.bob);
  else if (d.kind === 'potion') {
    const col = d.sub === 'speed' ? '#7ae0ff' : d.sub === 'strength' ? '#ff9a3c' : '#ff5a8a';
    drawPotionDrop(g, d.x, d.y, d.bob, col);
  } else if (d.kind === 'enchant') drawBookDrop(g, d.x, d.y, d.bob);
  else if (d.kind === 'disc') {
    const col = d.sub === 'battle' ? '#ff7a30' : d.sub === 'rain' ? '#c98af0' : '#7ae0ff';
    drawDiscDrop(g, d.x, d.y, d.bob, col);
  } else if (d.kind === 'fireball') drawFireballDrop(g, d.x, d.y, d.bob);
  else if (d.kind === 'eapple') drawEappleDrop(g, d.x, d.y, d.bob);
  else drawHeartDrop(g, d.x, d.y, d.bob);
}

function dhash(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * 地面装饰：0 草簇 1 小花 2 鹅卵石 3 枯树 4 碎石堆
 * 5 血迹 6 路障 7 火把 8 木桶 9 蘑菇 10 裂缝
 */
export function drawDecor(g: C, x: number, y: number, kind: number, time: number) {
  const h = dhash(x, y);
  if (kind === 0) {
    g.fillStyle = 'rgba(84,132,56,0.9)';
    for (const [ox, oy] of [[0, 0], [1, -1], [-1, 0], [0, 1], [2, 0]]) g.fillRect(x + ox, y + oy, 1, 2);
    g.fillStyle = 'rgba(120,168,72,0.8)';
    g.fillRect(x + 1, y - 2, 1, 1);
  } else if (kind === 1) {
    const col = h > 0.66 ? '#e8d06a' : h > 0.33 ? '#e86a8a' : '#cfe8ff';
    g.fillStyle = 'rgba(70,110,50,0.85)';
    g.fillRect(x, y, 1, 3);
    g.fillStyle = col;
    g.fillRect(x - 1, y - 2, 3, 2);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(x, y - 2, 1, 1);
  } else if (kind === 2) {
    g.fillStyle = '#9a9a92';
    g.fillRect(x - 2, y, 4, 2);
    g.fillStyle = '#b8b8ae';
    g.fillRect(x - 1, y - 1, 2, 1);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(x - 2, y + 2, 5, 1);
  } else if (kind === 3) {
    g.fillStyle = 'rgba(40,30,20,0.5)';
    g.fillRect(x - 2, y + 1, 5, 2);
    g.fillStyle = '#4a3423';
    g.fillRect(x - 1, y - 10, 3, 12);
    g.fillStyle = '#5d4430';
    g.fillRect(x - 5, y - 8, 4, 2);
    g.fillRect(x + 2, y - 6, 4, 2);
    g.fillStyle = '#6b6b60';
    g.fillRect(x - 4, y - 11, 3, 2);
    g.fillRect(x + 2, y - 12, 3, 2);
  } else if (kind === 4) {
    // 碎石堆：几块大小不一的残骸 + 投影
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(x - 6, y + 2, 12, 2);
    g.fillStyle = '#8e8e88';
    g.fillRect(x - 5, y - 2, 5, 4);
    g.fillStyle = '#a8a8a0';
    g.fillRect(x - 4, y - 3, 3, 2);
    g.fillStyle = '#767670';
    g.fillRect(x + 1, y - 4, 4, 6);
    g.fillStyle = '#9a9a92';
    g.fillRect(x + 2, y - 5, 2, 2);
    g.fillStyle = '#6b4f28';
    g.fillRect(x - 2, y + 1, 2, 1);
  } else if (kind === 5) {
    // 血迹
    g.fillStyle = `rgba(122,16,22,${0.28 + h * 0.16})`;
    g.beginPath();
    g.ellipse(x, y + 1, 5 + h * 3, 2 + h, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(150,20,26,0.4)';
    g.fillRect(x + 4, y + 2, 1, 1);
    g.fillRect(x - 5, y - 1, 1, 1);
  } else if (kind === 6) {
    // 路障：两根木桩 + 横板（世界里的残骸，不挡路）
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(x - 8, y + 2, 16, 2);
    g.fillStyle = '#5a4028';
    g.fillRect(x - 7, y - 12, 2, 14);
    g.fillRect(x + 5, y - 10, 2, 12);
    g.fillStyle = '#7a5a34';
    g.fillRect(x - 7, y - 12, 1, 14);
    g.fillRect(x + 5, y - 10, 1, 12);
    g.fillStyle = '#8a6a3a';
    g.fillRect(x - 8, y - 9, 16, 3);
    g.fillStyle = '#9a7a44';
    g.fillRect(x - 8, y - 9, 16, 1);
    g.fillStyle = '#3a2a18';
    g.fillRect(x - 2, y - 9, 1, 3);
  } else if (kind === 7) {
    // 火把：木杆 + 火焰 + 呼吸光晕
    const fl = 0.78 + Math.sin(time * 7 + x * 0.6) * 0.22;
    g.globalAlpha = 0.14 * fl;
    g.fillStyle = '#ffb347';
    g.beginPath();
    g.arc(x, y - 11, 15 + fl * 2, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x - 1, y + 1, 4, 2);
    g.fillStyle = '#6b4f28';
    g.fillRect(x, y - 7, 2, 9);
    g.fillStyle = '#8a6a3a';
    g.fillRect(x, y - 7, 1, 9);
    g.fillStyle = '#ff9a3c';
    g.fillRect(x - 1, y - 12, 4, 5);
    g.fillStyle = '#ffd76b';
    g.fillRect(x, y - 13, 2, 4);
    g.fillStyle = '#fff3a0';
    g.fillRect(x, y - 14, 1, 2);
  } else if (kind === 8) {
    // 木桶
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(x - 5, y + 2, 10, 2);
    g.fillStyle = '#6b4f28';
    g.fillRect(x - 4, y - 8, 8, 10);
    g.fillStyle = '#8a6a3a';
    g.fillRect(x - 3, y - 8, 6, 10);
    g.fillStyle = '#4a4a52';
    g.fillRect(x - 4, y - 6, 8, 1);
    g.fillRect(x - 4, y - 2, 8, 1);
    g.fillStyle = '#a88a52';
    g.fillRect(x - 1, y - 8, 1, 10);
  } else if (kind === 9) {
    // 蘑菇
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(x - 3, y + 1, 6, 1);
    g.fillStyle = '#e8e0d0';
    g.fillRect(x - 1, y - 3, 2, 4);
    g.fillStyle = '#c8343a';
    g.fillRect(x - 3, y - 5, 6, 2);
    g.fillStyle = '#f0f0e8';
    g.fillRect(x - 2, y - 5, 1, 1);
    g.fillRect(x + 1, y - 4, 1, 1);
  } else {
    // 裂缝
    g.fillStyle = 'rgba(28,26,22,0.32)';
    g.fillRect(x - 5, y, 4, 1);
    g.fillRect(x - 1, y + 1, 3, 1);
    g.fillRect(x + 2, y, 4, 1);
    g.fillRect(x, y - 1, 1, 1);
  }
}

type ResKind =
  | 'stone'
  | 'apple'
  | 'powder'
  | 'eye'
  | 'wall'
  | 'emerald'
  | 'iron'
  | 'gold'
  | 'diamond'
  | 'coal'
  | 'fire'
  | 'redstone'
  | 'trap'
  | 'goldapple'
  | 'eapple';

/**
 * 资源图标（10x10）：按"顶面高光 / 正面主色 / 底部暗边"三段的体素画法，
 * 参考 ComfyUI 生成的图标参考图，保证和方块世界同一套光影。
 */
export function drawResIcon(g: C, kind: ResKind, x: number, y: number) {
  switch (kind) {
    case 'stone': {
      rect(g, x + 1, y + 2, 9, 7, '#a8a8a2');
      rect(g, x + 1, y + 2, 9, 2, '#d6d6d0');
      rect(g, x + 1, y + 8, 9, 1, '#7a7a74');
      rect(g, x + 1, y + 2, 1, 7, '#c4c4be');
      rect(g, x + 9, y + 2, 1, 6, '#7a7a74');
      rect(g, x + 3, y + 5, 2, 1, '#8e8e88');
      rect(g, x + 6, y + 6, 2, 1, '#8e8e88');
      return;
    }
    case 'apple':
    case 'goldapple':
    case 'eapple': {
      const body = kind === 'apple' ? '#f5d327' : kind === 'goldapple' ? '#f0c020' : '#c06cff';
      const lite = kind === 'apple' ? '#ffe680' : kind === 'goldapple' ? '#ffe680' : '#f0d0ff';
      const dark = kind === 'apple' ? '#c9a012' : kind === 'goldapple' ? '#b8890a' : '#8a3ac0';
      rect(g, x + 2, y + 3, 6, 6, body);
      rect(g, x + 1, y + 4, 1, 4, body);
      rect(g, x + 8, y + 4, 1, 4, dark);
      rect(g, x + 2, y + 2, 5, 1, lite);
      rect(g, x + 2, y + 3, 2, 1, lite);
      rect(g, x + 3, y + 8, 5, 1, dark);
      rect(g, x + 5, y, 1, 2, '#5a3a20');
      rect(g, x + 6, y - 1, 3, 2, '#3f9a2a');
      if (kind !== 'apple') rect(g, x + 2, y + 5, 1, 1, '#ffffff');
      return;
    }
    case 'powder': {
      rect(g, x + 2, y + 2, 6, 6, '#b8b8ae');
      rect(g, x + 1, y + 4, 1, 4, '#b8b8ae');
      rect(g, x + 8, y + 4, 1, 4, '#a0a096');
      rect(g, x + 3, y + 6, 4, 1, '#8a8a80');
      rect(g, x + 3, y + 1, 4, 2, '#8a8a80');
      rect(g, x + 4, y, 2, 2, '#6a6a60');
      rect(g, x + 2, y + 8, 7, 1, '#8a8a80');
      return;
    }
    case 'eye': {
      rect(g, x + 1, y + 2, 8, 6, '#2a5a3a');
      rect(g, x + 1, y + 2, 8, 2, '#3fae7a');
      rect(g, x + 2, y + 1, 6, 1, '#3fae7a');
      rect(g, x + 3, y + 4, 4, 3, '#d06cff');
      rect(g, x + 4, y + 4, 2, 2, '#f0d0ff');
      rect(g, x + 4, y + 5, 1, 1, '#1a1a1a');
      return;
    }
    case 'wall': {
      for (let i = 0; i < 3; i++) {
        const yy = y + 1 + i * 3;
        rect(g, x + 1, yy, 9, 2, i === 0 ? '#c9a26b' : i === 1 ? '#b08a54' : '#9a7440');
        rect(g, x + 1, yy, 9, 1, '#d8b47c');
        rect(g, x + 1, yy + 2, 9, 1, '#6b4f28');
      }
      rect(g, x + 4, y + 1, 1, 3, '#6b4f28');
      rect(g, x + 7, y + 4, 1, 3, '#6b4f28');
      return;
    }
    case 'iron':
    case 'gold':
    case 'diamond': {
      const top = kind === 'iron' ? '#eceff2' : kind === 'gold' ? '#ffe680' : '#d8fffa';
      const body = kind === 'iron' ? '#c0c6cc' : kind === 'gold' ? '#f5d327' : '#4aedd9';
      const dark = kind === 'iron' ? '#868e98' : kind === 'gold' ? '#c9a012' : '#2a9a8a';
      rect(g, x + 2, y + 3, 7, 4, body);
      rect(g, x + 1, y + 3, 1, 2, body);
      rect(g, x + 3, y + 2, 5, 1, top);
      rect(g, x + 2, y + 6, 7, 2, dark);
      rect(g, x + 1, y + 7, 8, 1, '#6a6a72');
      rect(g, x + 3, y + 4, 2, 1, top);
      return;
    }
    case 'coal': {
      rect(g, x + 2, y + 2, 6, 6, '#4a4a52');
      rect(g, x + 1, y + 3, 1, 4, '#4a4a52');
      rect(g, x + 8, y + 3, 1, 4, '#2a2a30');
      rect(g, x + 2, y + 5, 3, 2, '#2a2a30');
      rect(g, x + 3, y + 3, 2, 1, '#6a6a78');
      rect(g, x + 3, y + 8, 5, 1, '#1a1a20');
      return;
    }
    case 'fire': {
      rect(g, x + 3, y + 3, 5, 6, '#ff9a3c');
      rect(g, x + 4, y + 1, 3, 3, '#ffd76b');
      rect(g, x + 4, y + 5, 3, 3, '#ffd76b');
      rect(g, x + 5, y, 1, 3, '#fff3a0');
      rect(g, x + 5, y + 6, 2, 2, '#fff3a0');
      rect(g, x + 3, y + 8, 5, 1, '#c25a10');
      return;
    }
    case 'emerald': {
      rect(g, x + 2, y + 2, 6, 6, '#2fae5a');
      rect(g, x + 3, y + 1, 4, 1, '#3fbe6a');
      rect(g, x + 3, y + 8, 4, 1, '#1a7a3a');
      rect(g, x + 3, y + 3, 2, 3, '#8ef0b0');
      rect(g, x + 6, y + 4, 1, 3, '#1a7a3a');
      return;
    }
    case 'redstone': {
      rect(g, x + 2, y + 4, 6, 4, '#8a1414');
      rect(g, x + 1, y + 5, 1, 2, '#8a1414');
      rect(g, x + 3, y + 3, 2, 2, '#e02a2a');
      rect(g, x + 6, y + 5, 1, 1, '#e02a2a');
      rect(g, x + 3, y + 4, 1, 1, '#ff8080');
      rect(g, x + 2, y + 8, 7, 1, '#5a0a0a');
      return;
    }
    case 'trap': {
      rect(g, x + 1, y + 5, 9, 4, '#c8343a');
      rect(g, x + 1, y + 5, 9, 1, '#e85050');
      rect(g, x + 1, y + 8, 9, 1, '#7a1418');
      for (const sx of [x + 2, x + 5, x + 7]) {
        rect(g, sx, y + 1, 1, 4, '#e8e8e0');
        rect(g, sx, y + 1, 1, 1, '#ffffff');
      }
      return;
    }
    default: {
      rect(g, x + 1, y + 2, 8, 7, '#8a6a3a');
      rect(g, x + 1, y + 2, 8, 2, '#a8845a');
      rect(g, x + 1, y + 8, 8, 1, '#5f4520');
    }
  }
}

/** 旧版图标（保留占位，不再调用） */
function drawResIconLegacy(g: C, kind: ResKind, x: number, y: number) {
  if (kind === 'stone') {
    rect(g, x + 1, y + 2, 4, 4, '#8f8f8f');
    rect(g, x + 4, y + 1, 4, 4, '#7a7a7a');
    rect(g, x + 2, y, 5, 3, '#9c9c9c');
    rect(g, x + 1, y + 2, 1, 1, '#a8a8a8');
  } else if (kind === 'apple') {
    rect(g, x + 2, y + 2, 5, 4, '#f5d327');
    rect(g, x + 3, y + 5, 3, 1, '#d4a017');
    rect(g, x + 2, y + 2, 5, 1, '#ffe680');
    rect(g, x + 6, y + 3, 1, 1, '#fff6c0');
    rect(g, x + 4, y, 1, 2, '#5a3a20');
    rect(g, x + 5, y - 1, 3, 2, '#4a9a2a');
  } else if (kind === 'powder') {
    rect(g, x + 1, y + 1, 6, 3, '#8a8a84');
    rect(g, x + 1, y + 4, 7, 5, '#4a4a48');
    rect(g, x + 3, y + 6, 2, 2, '#2a2a28');
  } else if (kind === 'eye') {
    rect(g, x + 1, y + 1, 7, 6, '#2a5a3a');
    rect(g, x + 1, y + 1, 7, 2, '#3fae7a');
    rect(g, x + 3, y + 4, 3, 3, '#d06cff');
    rect(g, x + 4, y + 4, 1, 2, '#101010');
  } else if (kind === 'emerald') {
    rect(g, x + 2, y, 5, 9, '#2fae5a');
    rect(g, x + 3, y + 1, 3, 2, '#8ef0b0');
    rect(g, x + 3, y - 1, 3, 1, '#3fbe6a');
  } else if (kind === 'iron') {
    rect(g, x + 2, y + 1, 6, 7, '#9aa0a8');
    rect(g, x + 3, y + 2, 4, 5, '#d8dce0');
    rect(g, x + 4, y + 3, 2, 1, '#ffffff');
  } else if (kind === 'gold') {
    rect(g, x + 2, y + 1, 6, 7, '#c69a12');
    rect(g, x + 3, y + 2, 4, 5, '#f5d327');
    rect(g, x + 4, y + 3, 2, 1, '#fff3a0');
  } else if (kind === 'diamond') {
    rect(g, x + 2, y + 1, 6, 7, '#2a9a8a');
    rect(g, x + 3, y + 2, 4, 5, '#4aedd9');
    rect(g, x + 4, y + 3, 2, 1, '#d8fffa');
  } else if (kind === 'coal') {
    rect(g, x + 2, y + 2, 6, 6, '#2a2a30');
    rect(g, x + 3, y + 3, 4, 4, '#3a3a44');
    rect(g, x + 4, y + 4, 2, 1, '#6a6a78');
  } else if (kind === 'fire') {
    rect(g, x + 3, y + 3, 5, 6, '#ff9a3c');
    rect(g, x + 4, y + 1, 3, 3, '#ffd76b');
    rect(g, x + 5, y, 1, 2, '#fff3a0');
  } else if (kind === 'redstone') {
    rect(g, x + 2, y + 3, 7, 6, '#8a1414');
    rect(g, x + 3, y + 4, 5, 3, '#e02a2a');
    rect(g, x + 4, y + 4, 2, 1, '#ff8080');
    rect(g, x + 1, y + 5, 2, 2, '#c02020');
    rect(g, x + 7, y + 2, 2, 2, '#c02020');
  } else if (kind === 'trap') {
    rect(g, x + 1, y + 4, 9, 3, '#7a7a82');
    rect(g, x + 2, y + 3, 2, 1, '#c9c9c0');
    rect(g, x + 5, y + 3, 2, 1, '#c9c9c0');
    rect(g, x + 7, y + 3, 2, 1, '#c9c9c0');
    rect(g, x + 3, y + 1, 1, 2, '#ff5a5a');
    rect(g, x + 6, y + 1, 1, 2, '#ff5a5a');
    rect(g, x + 1, y + 7, 9, 1, '#4a4a52');
  } else if (kind === 'goldapple') {
    rect(g, x + 2, y + 2, 6, 6, '#f5d327');
    rect(g, x + 3, y + 3, 4, 2, '#fff0a0');
    rect(g, x + 3, y + 6, 4, 1, '#c9a012');
    rect(g, x + 5, y, 1, 2, '#5a3a20');
    rect(g, x + 6, y - 1, 3, 2, '#3f9a2a');
  } else if (kind === 'eapple') {
    rect(g, x + 2, y + 2, 6, 6, '#c06cff');
    rect(g, x + 3, y + 3, 4, 2, '#f0d0ff');
    rect(g, x + 3, y + 6, 4, 1, '#8a3ac0');
    rect(g, x + 5, y, 1, 2, '#5a3a20');
    rect(g, x + 6, y - 1, 3, 2, '#3f9a2a');
    rect(g, x + 1, y + 1, 1, 1, '#ffd76b');
    rect(g, x + 8, y + 7, 1, 1, '#ffd76b');
  } else {
    rect(g, x + 1, y, 8, 8, '#8a6a3a');
    rect(g, x + 1, y, 8, 2, '#9a7440');
    rect(g, x + 1, y + 6, 8, 2, '#5f4520');
    rect(g, x + 2, y + 2, 6, 1, '#6b4f28');
    rect(g, x + 2, y + 5, 6, 1, '#6b4f28');
  }
}
