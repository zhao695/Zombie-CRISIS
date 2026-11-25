import { JOBS, SLOT_ORDER, VIEW_H, VIEW_W } from './config';
import { Game } from './game';
import { Input } from './input';
import { Renderer } from './render';
import { drawOverlay } from './ui';
import { world } from './world';

const view = document.getElementById('view') as HTMLCanvasElement;
const vctx = view.getContext('2d')!;
const input = new Input();
const game = new Game();
const renderer = new Renderer();

let unit = 1;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  // 手机端：按屏幕等比缩放，宁可小于 1 也不裁切
  const raw = Math.min(window.innerWidth / VIEW_W, (window.innerHeight - 8) / VIEW_H);
  // 手机横屏：允许小数倍缩放，铺满屏幕；大屏才用整数倍保持像素锐利
  const s = raw >= 2 ? Math.floor(raw) : Math.max(0.4, raw);
  unit = s * dpr;
  view.width = Math.round(VIEW_W * unit);
  view.height = Math.round(VIEW_H * unit);
  view.style.width = `${VIEW_W * s}px`;
  view.style.height = `${VIEW_H * s}px`;
  vctx.imageSmoothingEnabled = false;
}

window.addEventListener('resize', resize);
resize();

function toLogical(clientX: number, clientY: number) {
  const r = view.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * VIEW_W,
    y: ((clientY - r.top) / r.height) * VIEW_H,
  };
}

window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  const p = toLogical(e.clientX, e.clientY);
  input.mouseX = p.x;
  input.mouseY = p.y;
});

window.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') return;
  const p = toLogical(e.clientX, e.clientY);
  input.mouseX = p.x;
  input.mouseY = p.y;
  if (e.button === 2) {
    input.rightDown = true;
    game.rightClick();
    return;
  }
  input.mouseDown = true;
  game.click();
});

window.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'touch') return;
  if (e.button === 2) input.rightDown = false;
  else input.mouseDown = false;
});

window.addEventListener('pointercancel', () => {
  input.mouseDown = false;
  input.rightDown = false;
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  // ESC：部分浏览器/全屏状态下会被浏览器自己吞掉，这里显式拦下来并兼容 'Esc'
  const isEsc = e.code === 'Escape' || e.code === 'Esc' || e.key === 'Escape' || e.key === 'Esc';
  if (isEsc) {
    e.preventDefault();
    e.stopPropagation();
    input.keys.add('Escape');
    if (!e.repeat) game.key('Escape');
    return;
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
    e.preventDefault();
  }
  input.keys.add(e.code);
  if (!e.repeat) game.key(e.code);
});

window.addEventListener('keyup', (e) => {
  input.keys.delete(e.code);
});

window.addEventListener('blur', () => {
  input.keys.clear();
  input.mouseDown = false;
  input.rightDown = false;
  if (game.phase === 'play') game.phase = 'pause';
});

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;

function frame(now: number) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;

  let guard = 0;
  while (acc >= STEP && guard < 6) {
    game.update(STEP, input);
    acc -= STEP;
    guard++;
  }
  if (guard >= 6) acc = 0;

  renderer.draw(game);

  vctx.setTransform(1, 0, 0, 1, 0, 0);
  vctx.imageSmoothingEnabled = false;
  vctx.drawImage(renderer.fb, 0, 0, view.width, view.height);
  drawOverlay(vctx, unit, game, input);
  drawTouchControls();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__dbg = { game, input, renderer, world };
}


// ===== 触屏控制 =====
// 只有"粗指针"（手指）设备才算手机/平板；带触摸屏的笔记本仍有精确鼠标，保持键鼠操作
const coarsePointer = window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(hover: none)').matches;
const isTouchDevice =
  coarsePointer && ((navigator.maxTouchPoints || 0) > 0 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
if (isTouchDevice) input.touchMode = true;

let fsAsked = false;
function enterLandscapeFullscreen() {
  if (fsAsked) return;
  fsAsked = true;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  try {
    if (!document.fullscreenElement) (el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el))?.();
  } catch { /* ignore */ }
  try {
    (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape')?.catch(() => undefined);
  } catch { /* ignore */ }
}
function logicalFromPoint(clientX: number, clientY: number) {
  return toLogical(clientX, clientY);
}

const JOY = { x: 60, y: VIEW_H - 44, r: 44 };
let moreOpen = false;
/** 手机上不便按的键：收进「更多」面板 */
const MORE_BTNS: { x: number; y: number; label: string; act: () => void }[] = [
  { x: 156, y: 118, label: '射箭', act: () => { input.rightDown = true; game.rightClick(); window.setTimeout(() => { input.rightDown = false; }, 240); } },
  { x: 240, y: 118, label: '吃', act: () => game.key('KeyF') },
  { x: 324, y: 118, label: '处决', act: () => game.key('KeyX') },
  { x: 156, y: 160, label: '传送', act: () => game.key('KeyT') },
  { x: 240, y: 160, label: '职业技能', act: () => game.key(game.job === 'enderman' ? 'KeyH' : game.job === 'beastmaster' ? 'KeyJ' : 'KeyR') },
  { x: 324, y: 160, label: '静音', act: () => game.key('KeyM') },
];

function handleMoreTap(x: number, y: number): boolean {
  if (!moreOpen) return false;
  for (const b of MORE_BTNS) {
    if (Math.hypot(x - b.x, y - b.y) <= 26) {
      b.act();
      moreOpen = false;
      return true;
    }
  }
  moreOpen = false;
  return true;
}
const LS = { active: false, id: -1, ox: 0, oy: 0 };

function touchButtonAt(x: number, y: number): string | null {
  const near = (bx: number, by: number, r: number) => Math.hypot(x - bx, y - by) <= r;
  // 攻击：右下角最大的一颗，手指顺手就能按住
  if (near(VIEW_W - 42, VIEW_H - 96, 32)) return 'attack';
  if (near(VIEW_W - 42, VIEW_H - 160, 20)) return 'skill';
  if (near(VIEW_W - 112, VIEW_H - 96, 20)) return 'dash';
  if (near(VIEW_W - 112, VIEW_H - 160, 16)) return 'swap';
  if (near(452, 20, 20) && game.phase !== 'menu' && game.phase !== 'map') return 'pause';
  // 合成/建造/商店：挪到左侧竖排，避免和攻击键抢位置
  if (near(VIEW_W - 178, VIEW_H - 152, 16)) return 'more';
  if (near(24, 66, 14)) return 'craft';
  if (near(24, 94, 14)) return 'wall';
  if (near(24, 122, 14)) return 'trap';
  if (near(24, 150, 14)) return 'shop';
  return null;
}

// 触摸监听无条件注册：真机首次触摸才切到触屏模式，电脑端不会触发
{
  view.style.touchAction = 'none';
  view.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      // 真的用手指碰了才切到触屏模式（鼠标模拟的 touch 不算，避免电脑端变手机操作）
      input.touchMode = true;
      game.touchUI = true;
      enterLandscapeFullscreen();
      for (const touch of Array.from(e.changedTouches)) {
        const p = logicalFromPoint(touch.clientX, touch.clientY);
        input.mouseX = p.x;
        input.mouseY = p.y;
        if ((game.phase === 'menu' || game.phase === 'map') && p.x < 96 && p.y < 34) {
          fsAsked = false;
          enterLandscapeFullscreen();
          continue;
        }
        if (Math.abs(p.x - VIEW_W / 2) < 30 && p.y < 30 && game.phase !== 'menu') {
          game.key(game.phase === 'map' ? 'Escape' : 'KeyP');
          continue;
        }
        if (game.phase === 'map') {
          // 点职业格：直接选中该职业
          if (p.y > 198 && p.y < 240) {
            const col = Math.round((p.x - VIEW_W / 2) / 112 + 1.5);
            const row = p.y < 218 ? 0 : 1;
            const idx = row * 4 + col;
            const j = JOBS[idx];
            if (j && Math.abs(p.x - (VIEW_W / 2 + (col - 1.5) * 112)) < 54) {
              game.pickJob(j.id);
              continue;
            }
          }
          // 点「开始游戏」
          if (Math.abs(p.x - VIEW_W / 2) < 84 && p.y > 238 && p.y < 270) {
            game.start(false, undefined);
            continue;
          }
        }
        if (game.phase === 'grow' && Math.abs(p.x - VIEW_W / 2) < 60 && Math.abs(p.y - (VIEW_H - 44)) < 18) {
          game.key('Enter');
          continue;
        }
        // 主菜单右上角：排行 / 信（触摸直接处理，避免与暂停键混淆）
        if (game.phase === 'menu') {
          if (Math.abs(p.x - 404) <= 26 && Math.abs(p.y - 20) <= 15) {
            if (game.letterOpen) game.letterOpen = false;
            game.toggleBoard();
            continue;
          }
          if (Math.abs(p.x - 452) <= 20 && Math.abs(p.y - 20) <= 15) {
            if (game.lbOpen) game.lbOpen = false;
            game.letterOpen = !game.letterOpen;
            continue;
          }
        }
        // 菜单行（合成/商店）与物品栏点击：优先处理
        if (handleMenuTap(p.x, p.y)) continue;
        if (handleHotbarTap(p.x, p.y)) continue;
        const btn = touchButtonAt(p.x, p.y);
        if (btn === 'attack') {
          input.mouseDown = true;
          game.click();
          continue;
        }
        if (btn === 'dash') {
          game.key('Space');
          continue;
        }
        if (btn === 'skill') {
          game.key('KeyR');
          continue;
        }
        if (btn === 'swap') {
          const cur = SLOT_ORDER.indexOf(game.player.slot);
          for (let k = 1; k <= SLOT_ORDER.length; k++) {
            const cand = SLOT_ORDER[(cur + k) % SLOT_ORDER.length];
            if (cand === 0 || game.unlocked(cand)) {
              game.selectSlot(cand);
              break;
            }
          }
          continue;
        }
        if (btn === 'pause') {
          game.key('KeyP');
          continue;
        }
        if (btn === 'more') {
          moreOpen = !moreOpen;
          continue;
        }
        if (btn === 'eat' || btn === 'eat2') {
          game.key('KeyF');
          continue;
        }
        if (btn === 'fire') {
          game.selectSlot(5);
          continue;
        }
        if (btn === 'tp') {
          game.key('KeyT');
          continue;
        }
        if (btn === 'craft') {
          game.key('KeyC');
          continue;
        }
        if (btn === 'wall') {
          game.key('KeyQ');
          continue;
        }
        if (btn === 'trap') {
          game.key('KeyG');
          continue;
        }
        if (btn === 'shop') {
          game.key('KeyE');
          continue;
        }
        // 左下角摇杆区：圆心固定，按在左半边任意位置都算推摇杆
        if (p.x < VIEW_W * 0.46 && !LS.active) {
          LS.active = true;
          LS.id = touch.identifier;
          LS.ox = JOY.x;
          LS.oy = JOY.y;
          continue;
        }
        game.click();
        input.mouseDown = true;
      }
    },
    { passive: false },
  );

  view.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier !== LS.id) continue;
        const p = logicalFromPoint(touch.clientX, touch.clientY);
        const dx = p.x - JOY.x;
        const dy = p.y - JOY.y;
        const len = Math.hypot(dx, dy);
        const max = JOY.r - 14;
        if (len > max) {
          input.stickX = dx / len;
          input.stickY = dy / len;
        } else {
          input.stickX = dx / max;
          input.stickY = dy / max;
        }
        // 摇杆推得越大，角色移动越快；也用于自动瞄准朝向
        input.mouseX = p.x;
        input.mouseY = p.y;
      }
    },
    { passive: false },
  );

  const endTouch = (e: TouchEvent) => {
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === LS.id) {
        LS.active = false;
        LS.id = -1;
        input.stickX = 0;
        input.stickY = 0;
      }
    }
    input.mouseDown = false;
  };
  view.addEventListener('touchend', endTouch, { passive: false });
  view.addEventListener('touchcancel', endTouch, { passive: false });

  // 自动索敌：始终朝向最近的敌人（近战与远程共用）
  setInterval(() => {
    if (!input.touchMode) return;
    if (game.phase !== 'play') {
      input.aimOverride = null;
      return;
    }
    const p = game.player;
    let best: { x: number; y: number; d: number } | null = null;
    for (const z of game.zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      if (!best || d < best.d) best = { x: z.x, y: z.y, d };
    }
    input.aimOverride = best ? Math.atan2(best.y - p.y, best.x - p.x) : null;
  }, 40);
}

function drawTouchControls() {
  if (!input.touchMode) return;
  vctx.save();
  vctx.scale(unit, unit);
  vctx.globalAlpha = 0.55;
  // 摇杆只在战斗中显示
  if (game.phase === 'play') {
  const cx = JOY.x;
  const cy = JOY.y;
  vctx.strokeStyle = 'rgba(255,255,255,0.45)';
  vctx.lineWidth = 2.5;
  vctx.beginPath();
  vctx.arc(cx, cy, JOY.r, 0, Math.PI * 2);
  vctx.stroke();
  vctx.fillStyle = 'rgba(20,26,38,0.35)';
  vctx.beginPath();
  vctx.arc(cx, cy, JOY.r - 1, 0, Math.PI * 2);
  vctx.fill();
  vctx.fillStyle = LS.active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.3)';
  vctx.beginPath();
  vctx.arc(cx + input.stickX * (JOY.r - 16), cy + input.stickY * (JOY.r - 16), 18, 0, Math.PI * 2);
  vctx.fill();
  }
  const btn = (x: number, y: number, r: number, color: string, label: string) => {
    vctx.fillStyle = 'rgba(10,14,22,0.55)';
    vctx.beginPath();
    vctx.arc(x, y, r, 0, Math.PI * 2);
    vctx.fill();
    vctx.strokeStyle = color;
    vctx.lineWidth = 2;
    vctx.stroke();
    vctx.fillStyle = color;
    vctx.font = 'bold 9px "Microsoft YaHei",sans-serif';
    vctx.textAlign = 'center';
    vctx.textBaseline = 'middle';
    vctx.fillText(label, x, y + 0.5);
  };
  if (game.phase === 'play') {
    // 右侧：攻击 / 技能 / 闪 / 换 / 吃 / 交易
    btn(VIEW_W - 42, VIEW_H - 92, 34, '#ff8a7a', '攻击');
    btn(VIEW_W - 42, VIEW_H - 158, 20, '#ffd76b', 'R');
    btn(VIEW_W - 112, VIEW_H - 92, 22, '#9fe8ff', '闪');
    btn(VIEW_W - 112, VIEW_H - 158, 18, '#8ef0b0', '换');
    btn(VIEW_W - 42, VIEW_H - 216, 17, '#ff9a6b', '吃');
    if (game.nearTrader()) btn(VIEW_W - 112, VIEW_H - 216, 17, '#8fd14f', '交易');
    // 左上：HUD 下方的功能列
    btn(30, 76, 14, '#c8b8ff', '合成');
    btn(30, 100, 14, '#c9a26b', '墙');
    btn(30, 124, 14, '#ff9a3c', '火球');
    btn(30, 148, 14, '#ff8a7a', '陷');
    btn(30, 172, 14, '#c8b8ff', '传送');
  }
  // 主菜单/选图：右上角"全屏横屏"按钮
  if (game.phase === 'menu' || game.phase === 'map') {
    vctx.globalAlpha = 0.85;
    vctx.fillStyle = 'rgba(16,22,34,0.85)';
    vctx.fillRect(8, 8, 84, 24);
    vctx.strokeStyle = '#ffd76b';
    vctx.lineWidth = 2;
    vctx.strokeRect(8, 8, 84, 24);
    vctx.fillStyle = '#ffd76b';
    vctx.font = 'bold 10px "Microsoft YaHei",sans-serif';
    vctx.textAlign = 'center';
    vctx.textBaseline = 'middle';
    vctx.fillText('全屏横屏', 50, 20.5);
  }
  if (game.phase !== 'menu') {
    vctx.globalAlpha = 0.85;
    vctx.fillStyle = 'rgba(16,22,34,0.85)';
    vctx.fillRect(VIEW_W / 2 - 22, 4, 44, 22);
    vctx.strokeStyle = '#9fe8ff';
    vctx.lineWidth = 2;
    vctx.strokeRect(VIEW_W / 2 - 22, 4, 44, 22);
    vctx.fillStyle = '#9fe8ff';
    vctx.font = 'bold 11px "Microsoft YaHei",sans-serif';
    vctx.textAlign = 'center';
    vctx.textBaseline = 'middle';
    vctx.fillText('P 暂停', VIEW_W / 2, 15.5);
  }
  if (game.phase === 'grow') {
    vctx.globalAlpha = 0.95;
    vctx.fillStyle = 'rgba(30,40,60,0.95)';
    vctx.fillRect(VIEW_W / 2 - 46, VIEW_H - 58, 92, 26);
    vctx.strokeStyle = '#ffd76b';
    vctx.lineWidth = 2;
    vctx.strokeRect(VIEW_W / 2 - 46, VIEW_H - 58, 92, 26);
    vctx.fillStyle = '#ffd76b';
    vctx.font = 'bold 11px "Microsoft YaHei",sans-serif';
    vctx.textAlign = 'center';
    vctx.textBaseline = 'middle';
    vctx.fillText('ENTER 确认', VIEW_W / 2, VIEW_H - 45);
  }

  vctx.restore();
}
/** 手机端点菜单行：合成 / 商店。返回 true 表示这次点击已被菜单消费 */
function handleMenuTap(x: number, y: number): boolean {
  if (game.craftMenu) {
    for (let i = 0; i < 9; i++) {
      if (Math.abs(y - (66 + i * 20)) <= 10 && Math.abs(x - VIEW_W / 2) < 200) {
        game.craftRecipe(i + 1);
        return true;
      }
    }
    if (y > 238 && y < 258 && Math.abs(x - VIEW_W / 2) < 60) game.craftMenu = false;
    return true;
  }
  if (game.tradeMenu) {
    for (let i = 0; i < 10; i++) {
      if (Math.abs(y - (88 + i * 20)) <= 10 && Math.abs(x - VIEW_W / 2) < 122) {
        game.doTrade(i);
        return true;
      }
    }
    if (y > VIEW_H - 40) game.tradeMenu = false;
    return true;
  }
  return false;
}

/** 点物品栏格子切武器 */
function handleHotbarTap(x: number, y: number): boolean {
  if (game.phase !== 'play' || y < 242 || y > VIEW_H) return false;
  const x0 = Math.round((VIEW_W - (9 * 24 - 2)) / 2);
  if (x < x0 - 2 || x > x0 + 9 * 24) return false;
  const idx = Math.floor((x - x0) / 24);
  const slot = SLOT_ORDER[Math.max(0, Math.min(8, idx))];
  if (slot === undefined) return false;
  game.selectSlot(slot);
  return true;
}