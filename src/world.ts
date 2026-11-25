import { GATHER, TILE, WORLD } from './config';
import { mulberry32 } from './sys/rng';
import type { Rng } from './sys/rng';

const CELL = 4;

export class World {
  cols: number;
  rows: number;
  tcols: number;
  trows: number;
  tiles = new Uint8Array(0);
  cellKind = new Uint8Array(0);
  walkable: { x: number; y: number }[] = [];
  decor: { x: number; y: number; kind: number }[] = [];
  walls = new Map<number, number>();
  /** 领域生成的能量墙：渲染时不画成木板墙 */
  domainWalls = new Set<number>();
  start = { x: WORLD.w / 2, y: WORLD.h / 2 };
  seed = 0;

  flowParent = new Int8Array(0);
  flowDist = new Int32Array(0);
  private flowX = Infinity;
  private flowY = Infinity;
  private rng: Rng = Math.random;

  constructor() {
    this.cols = Math.floor(WORLD.w / (TILE * CELL));
    this.rows = Math.floor(WORLD.h / (TILE * CELL));
    this.tcols = this.cols * CELL;
    this.trows = this.rows * CELL;
    this.generate(20261117);
  }

  /** 以新种子重新生成整张地图（迷宫/广场/瓦片/可行走列表），mapId 决定布局风格 */
  generate(seed: number, mapId = 'maze') {
    this.seed = seed;
    this.walls.clear();
    this.domainWalls.clear();
    this.walkable = [];
    this.invalidateFlow();
    // 独立随机流：同一种子迷宫/装饰逐字节一致，且不受 Game 逻辑随机数干扰
    this.rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);

    const cells = new Uint8Array(this.cols * this.rows);
    const kind = new Uint8Array(this.cols * this.rows);
    const idx = (c: number, r: number) => r * this.cols + c;
    const rnd = mulberry32(seed);

    // 递归回溯迷宫：道路是通道，其余是建筑
    const visited = new Set<number>();
    const stack: [number, number][] = [[1, 1]];
    visited.add(idx(1, 1));
    cells[idx(1, 1)] = 1;
    kind[idx(1, 1)] = 1;
    while (stack.length) {
      const [c, r] = stack[stack.length - 1];
      // 用 Fisher-Yates 洗牌：sort(() => rnd()-0.5) 的比较器不满足排序一致性，
      // V8 换排序实现（JIT 后）会得到不同结果，导致同种子地图不可复现
      const dirs = [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
      ];
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = (rnd() * (i + 1)) | 0;
        const tmp = dirs[i];
        dirs[i] = dirs[j];
        dirs[j] = tmp;
      }
      let moved = false;
      for (const [dc, dr] of dirs) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc <= 0 || nr <= 0 || nc >= this.cols - 1 || nr >= this.rows - 1) continue;
        if (visited.has(idx(nc, nr))) continue;
        visited.add(idx(nc, nr));
        cells[idx(nc, nr)] = 1;
        kind[idx(nc, nr)] = 1;
        cells[idx(c + dc / 2, r + dr / 2)] = 1;
        kind[idx(c + dc / 2, r + dr / 2)] = 1;
        stack.push([nc, nr]);
        moved = true;
        break;
      }
      if (!moved) stack.pop();
    }

    // 空地（草地广场）
    let placed = 0;
    const plazas: { c: number; r: number }[] = [];
    for (let t = 0; t < 500 && placed < 9; t++) {
      const c = 2 + Math.floor(rnd() * (this.cols - 4));
      const r = 2 + Math.floor(rnd() * (this.rows - 4));
      if (cells[idx(c, r)] !== 1) continue;
      placed++;
      plazas.push({ c, r });
      for (let dc = -2; dc <= 2; dc++) {
        for (let dr = -2; dr <= 2; dr++) {
          const x = c + dc;
          const y = r + dr;
          if (x <= 0 || y <= 0 || x >= this.cols - 1 || y >= this.rows - 1) continue;
          cells[idx(x, y)] = 1;
          kind[idx(x, y)] = 2;
        }
      }
    }

    // 中央广场（玩家出生点）
    const cc = Math.floor(this.cols / 2);
    const cr = Math.floor(this.rows / 2);
    for (let dc = -3; dc <= 3; dc++) {
      for (let dr = -3; dr <= 3; dr++) {
        cells[idx(cc + dc, cr + dr)] = 1;
        kind[idx(cc + dc, cr + dr)] = 2;
      }
    }

    // 地图风格改造（只拆除/增建连通结构，保证中央广场可达）
    const carve = (c: number, r: number) => {
      if (c <= 0 || r <= 0 || c >= this.cols - 1 || r >= this.rows - 1) return;
      cells[idx(c, r)] = 1;
    };
    if (mapId === 'plains') {
      // 开阔平原：拆掉大部分建筑，只留零星残垣
      for (let r = 1; r < this.rows - 1; r++) {
        for (let c = 1; c < this.cols - 1; c++) {
          if (cells[idx(c, r)] === 0 && rnd() < 0.82) carve(c, r);
        }
      }
      for (let t = 0; t < 16; t++) {
        const c = 3 + Math.floor(rnd() * (this.cols - 8));
        const r = 3 + Math.floor(rnd() * (this.rows - 8));
        if (Math.abs(c - cc) <= 5 && Math.abs(r - cr) <= 5) continue;
        for (let dc = 0; dc <= 1; dc++) {
          for (let dr = 0; dr <= 1; dr++) {
            if (c + dc <= 0 || r + dr <= 0 || c + dc >= this.cols - 1 || r + dr >= this.rows - 1) continue;
            cells[idx(c + dc, r + dr)] = 0;
            kind[idx(c + dc, r + dr)] = 0;
          }
        }
      }
    } else if (mapId === 'fortress') {
      // 废弃要塞：规整街区，每 4 格开一条直街
      for (let c = 2; c < this.cols - 1; c += 4) {
        for (let r = 1; r < this.rows - 1; r++) carve(c, r);
      }
      for (let r = 2; r < this.rows - 1; r += 4) {
        for (let c = 1; c < this.cols - 1; c++) carve(c, r);
      }
    } else if (mapId === 'arena') {
      // 环形竞技场：全开阔 + 三层同心环墙，各留 3 个缺口
      for (let r = 1; r < this.rows - 1; r++) {
        for (let c = 1; c < this.cols - 1; c++) carve(c, r);
      }
      const gapsPerRing = 3;
      for (const rad of [4, 8, 12]) {
        const gaps: number[] = [];
        for (let i = 0; i < gapsPerRing; i++) gaps.push(rnd() * Math.PI * 2);
        for (let r = 1; r < this.rows - 1; r++) {
          for (let c = 1; c < this.cols - 1; c++) {
            const dr = r - cr;
            const dc = c - cc;
            const dd = Math.hypot(dc, dr);
            if (dd < rad - 0.5 || dd > rad + 0.5) continue;
            const ang = Math.atan2(dr, dc);
            let inGap = false;
            for (const ga of gaps) {
              const diff = Math.abs(((ang - ga + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
              if (diff < 0.34) inGap = true;
            }
            if (inGap) continue;
            cells[idx(c, r)] = 0;
            kind[idx(c, r)] = 0;
          }
        }
      }
    } else if (mapId === 'forest') {
      // 枯木密林：保留迷宫骨架，随机打通少量捷径形成林间空地
      for (let r = 1; r < this.rows - 1; r++) {
        for (let c = 1; c < this.cols - 1; c++) {
          if (cells[idx(c, r)] === 0 && rnd() < 0.08) carve(c, r);
        }
      }
    }

    // ── 地标结构：广场里的废墟，给空旷区域一点"场景" ──
    // 只在远离出生广场的空地上建，且保证有缺口互通
    const marks: { c: number; r: number; kind: number }[] = [];
    const setSolid = (x: number, y: number) => {
      if (x <= 1 || y <= 1 || x >= this.cols - 2 || y >= this.rows - 2) return;
      cells[idx(x, y)] = 0;
      kind[idx(x, y)] = 0;
    };
    const setOpen = (x: number, y: number) => {
      if (x <= 1 || y <= 1 || x >= this.cols - 2 || y >= this.rows - 2) return;
      cells[idx(x, y)] = 1;
      kind[idx(x, y)] = 2;
    };
    let markCount = 0;
    const countOpen = () => {
      let n = 0;
      for (let i = 0; i < cells.length; i++) if (cells[i] === 1) n++;
      return n;
    };
    const reachableFromStart = () => {
      const seen = new Uint8Array(cells.length);
      const q = [idx(cc, cr)];
      if (cells[q[0]] !== 1) return 0;
      seen[q[0]] = 1;
      let n = 0;
      while (q.length) {
        const cur = q.pop()!;
        n++;
        const cx = cur % this.cols;
        const cy = (cur / this.cols) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 1 || ny < 1 || nx >= this.cols - 1 || ny >= this.rows - 1) continue;
          const ni = idx(nx, ny);
          if (seen[ni] || cells[ni] !== 1) continue;
          seen[ni] = 1;
          q.push(ni);
        }
      }
      return n;
    };
    for (const pl of plazas) {
      if (markCount >= 3) break;
      // 环形竞技场本身就是结构化场地，再塞地标会把环道堵乱
      if (mapId === 'arena') break;
      if (Math.abs(pl.c - cc) <= 5 && Math.abs(pl.r - cr) <= 5) continue;
      const kindId = markCount % 3;
      const cellBackup = cells.slice();
      const kindBackup = kind.slice();
      if (kindId === 0) {
        // 倒塌塔：5x5 空心塔基，两个缺口 + 一角塌掉
        for (let dc = -2; dc <= 2; dc++) {
          for (let dr = -2; dr <= 2; dr++) {
            if (Math.abs(dc) !== 2 && Math.abs(dr) !== 2) continue;
            setSolid(pl.c + dc, pl.r + dr);
          }
        }
        setOpen(pl.c - 2, pl.r);
        setOpen(pl.c + 1, pl.r + 2);
        setOpen(pl.c + 2, pl.r - 1);
        setOpen(pl.c + 2, pl.r - 2);
      } else if (kindId === 1) {
        // 残柱阵：四根断柱围出一个中庭
        for (const [dc, dr] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) setSolid(pl.c + dc, pl.r + dr);
        setSolid(pl.c, pl.r - 2);
      } else {
        // 路障阵：两道带缺口的短墙
        for (let dc = -2; dc <= 2; dc++) {
          if (dc === 1) continue;
          setSolid(pl.c + dc, pl.r - 2);
        }
        for (let dc = -2; dc <= 2; dc++) {
          if (dc === -1) continue;
          setSolid(pl.c + dc, pl.r + 2);
        }
      }
      // 加了结构后如果地图被切断（有区域不可达），整个地标回滚
      if (reachableFromStart() !== countOpen()) {
        cells.set(cellBackup);
        kind.set(kindBackup);
        continue;
      }
      marks.push({ c: pl.c, r: pl.r, kind: kindId });
      markCount++;
    }

    this.cellKind = kind;
    this.tiles = new Uint8Array(this.tcols * this.trows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (cells[idx(c, r)] === 1) continue;
        for (let dy = 0; dy < CELL; dy++) {
          for (let dx = 0; dx < CELL; dx++) {
            this.tiles[(r * CELL + dy) * this.tcols + (c * CELL + dx)] = 1;
          }
        }
      }
    }

    for (let ty = 1; ty < this.trows - 1; ty++) {
      for (let tx = 1; tx < this.tcols - 1; tx++) {
        if (!this.tiles[ty * this.tcols + tx]) {
          this.walkable.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
        }
      }
    }

    // ── 地面装饰：草簇 / 小花 / 鹅卵石 / 碎石堆 / 血迹 / 裂缝 / 木桶 / 路障 / 火把 / 蘑菇 ──
    this.decor = [];
    const decorMax = mapId === 'forest' ? 300 : mapId === 'plains' ? 210 : mapId === 'arena' ? 160 : 400;
    const maxTries = decorMax * 9;
    for (let t = 0; t < maxTries && this.decor.length < decorMax; t++) {
      const w = this.walkable[(rnd() * this.walkable.length) | 0];
      if (!w) break;
      if (Math.hypot(w.x - this.start.x, w.y - this.start.y) < 40) continue;
      const nearOther = this.decor.some((d) => Math.hypot(d.x - w.x, d.y - w.y) < 22);
      if (nearOther) continue;
      const roll = rnd();
      let kd: number;
      if (mapId === 'forest') {
        kd = roll < 0.46 ? 3 : roll < 0.6 ? 0 : roll < 0.7 ? 9 : roll < 0.85 ? 4 : 10;
      } else {
        kd =
          roll < 0.28 ? 0 // 草簇
            : roll < 0.4 ? 1 // 小花
              : roll < 0.52 ? 2 // 鹅卵石
                : roll < 0.66 ? 4 // 碎石堆
                  : roll < 0.74 ? 10 // 地面裂缝
                    : roll < 0.82 ? 5 // 血迹
                      : roll < 0.89 ? 8 // 木桶
                        : roll < 0.96 ? 6 // 路障
                          : 7; // 火把
      }
      this.decor.push({ x: w.x, y: w.y, kind: kd });
    }
    // 地标周围撒碎石/血迹，让废墟看起来真的塌了
    for (const m of marks) {
      const cx = m.c * CELL * TILE + (CELL * TILE) / 2;
      const cy = m.r * CELL * TILE + (CELL * TILE) / 2;
      for (let i = 0; i < 28; i++) {
        const a = rnd() * Math.PI * 2;
        const rr = 14 + rnd() * 84;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (this.solidAt(x, y)) continue;
        const pick = rnd();
        this.decor.push({ x, y, kind: pick < 0.6 ? 4 : pick < 0.82 ? 5 : 10 });
      }
    }
  }

  tileAt(px: number, py: number): number {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= this.tcols || ty >= this.trows) return 1;
    return this.tiles[ty * this.tcols + tx];
  }

  solidAt(px: number, py: number): boolean {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= this.tcols || ty >= this.trows) return true;
    const ti = ty * this.tcols + tx;
    return this.tiles[ti] === 1 || this.walls.has(ti);
  }

  wallHpAt(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= this.tcols || ty >= this.trows) return 0;
    return this.walls.get(ty * this.tcols + tx) ?? 0;
  }

  canPlaceWall(tx: number, ty: number): boolean {
    if (tx < 1 || ty < 1 || tx >= this.tcols - 1 || ty >= this.trows - 1) return false;
    const ti = ty * this.tcols + tx;
    return this.tiles[ti] === 0 && !this.walls.has(ti);
  }

  addWall(tx: number, ty: number, hp = GATHER.wallHp) {
    this.walls.set(ty * this.tcols + tx, hp);
  }

  damageWall(tx: number, ty: number, dmg: number): boolean {
    const ti = ty * this.tcols + tx;
    const hp = this.walls.get(ti);
    if (hp === undefined) return false;
    const nhp = hp - dmg;
    if (nhp <= 0) {
      this.walls.delete(ti);
      return true;
    }
    this.walls.set(ti, nhp);
    return false;
  }

  removeWall(tx: number, ty: number) {
    this.walls.delete(ty * this.tcols + tx);
  }

  clearWalls() {
    this.walls.clear();
  }

  invalidateFlow() {
    this.flowX = Infinity;
    this.flowY = Infinity;
  }

  circleBlocked(x: number, y: number, r: number): boolean {
    return this.solidAt(x - r, y - r) || this.solidAt(x + r, y - r) || this.solidAt(x - r, y + r) || this.solidAt(x + r, y + r);
  }

  walkablePoint(x: number, y: number, r = 6): boolean {
    return !this.circleBlocked(x, y, r);
  }

  moveCircle(o: { x: number; y: number }, dx: number, dy: number, r: number) {
    o.x += dx;
    if (this.circleBlocked(o.x, o.y, r)) o.x -= dx;
    o.y += dy;
    if (this.circleBlocked(o.x, o.y, r)) o.y -= dy;
  }

  /** 只挡建筑、不挡玩家放的墙（飞行怪 / 末影人用） */
  moveCircleLoose(o: { x: number; y: number }, dx: number, dy: number, r: number) {
    const solid = (x: number, y: number) => {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (tx < 0 || ty < 0 || tx >= this.tcols || ty >= this.trows) return true;
      return this.tiles[ty * this.tcols + tx] === 1;
    };
    const blocked = (x: number, y: number) =>
      solid(x - r, y - r) || solid(x + r, y - r) || solid(x - r, y + r) || solid(x + r, y + r);
    o.x += dx;
    if (blocked(o.x, o.y)) o.x -= dx;
    o.y += dy;
    if (blocked(o.x, o.y)) o.y -= dy;
  }

  findSpawn(px: number, py: number, minD: number, maxD: number, attempts = 26): { x: number; y: number } {
    const open = (w: { x: number; y: number }) =>
      !this.walls.has(Math.floor(w.y / TILE) * this.tcols + Math.floor(w.x / TILE));
    for (let i = 0; i < attempts; i++) {
      const w = this.walkable[(this.rng() * this.walkable.length) | 0];
      if (!open(w)) continue;
      const d = Math.hypot(w.x - px, w.y - py);
      if (d >= minD && d <= maxD) return { x: w.x, y: w.y };
    }
    const ring: { x: number; y: number }[] = [];
    for (const w of this.walkable) {
      if (!open(w)) continue;
      const d = Math.hypot(w.x - px, w.y - py);
      if (d >= minD && d <= maxD) ring.push(w);
    }
    if (ring.length) return ring[(this.rng() * ring.length) | 0];
    let best = this.walkable[0];
    let bd = Infinity;
    for (const w of this.walkable) {
      if (!open(w)) continue;
      const d = Math.hypot(w.x - px, w.y - py);
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    return { x: best.x, y: best.y };
  }

  updateFlow(px: number, py: number) {
    if (this.flowParent.length && Math.hypot(px - this.flowX, py - this.flowY) < 16) return;
    const n = this.tcols * this.trows;
    const parent = new Int8Array(n).fill(-1);
    const dist = new Int32Array(n).fill(-1);
    let si = Math.floor(py / TILE) * this.tcols + Math.floor(px / TILE);
    if (this.tiles[si] === 1 || this.walls.has(si)) {
      let bd = Infinity;
      for (let d = 0; d < 4; d++) {
        const nx = Math.floor(px / TILE) + FLOW[d].dx;
        const ny = Math.floor(py / TILE) + FLOW[d].dy;
        if (nx < 1 || ny < 1 || nx >= this.tcols - 1 || ny >= this.trows - 1) continue;
        const nxt = ny * this.tcols + nx;
        if (this.tiles[nxt] === 1 || this.walls.has(nxt)) continue;
        const dd = Math.hypot(nx * TILE + 8 - px, ny * TILE + 8 - py);
        if (dd < bd) {
          bd = dd;
          si = nxt;
        }
      }
      if (this.tiles[si] === 1 || this.walls.has(si)) return;
    }
    dist[si] = 0;
    parent[si] = -2; // 起点哨兵：防止被邻格 BFS 覆盖
    const queue: number[] = [si];
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      const cx = cur % this.tcols;
      const cy = (cur / this.tcols) | 0;
      for (let i = 0; i < 4; i++) {
        const nx = cx + FLOW[i].dx;
        const ny = cy + FLOW[i].dy;
        if (nx < 1 || ny < 1 || nx >= this.tcols - 1 || ny >= this.trows - 1) continue;
        const nxt = ny * this.tcols + nx;
        if (this.tiles[nxt] === 1 || this.walls.has(nxt) || parent[nxt] !== -1) continue;
        parent[nxt] = i;
        dist[nxt] = dist[cur] + 1;
        queue.push(nxt);
      }
    }
    this.flowParent = parent;
    this.flowDist = dist;
    this.flowX = px;
    this.flowY = py;
  }

  flowDir(x: number, y: number): { dx: number; dy: number; dist: number } | null {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.tcols || ty >= this.trows) return null;
    const i = ty * this.tcols + tx;
    const pd = this.flowParent[i];
    if (pd < 0) return null;
    // parent[nxt]=i 记录的是"从父格到子格"的方向，返回时需取反
    const f = FLOW[pd ^ 1];
    return { dx: f.dx, dy: f.dy, dist: this.flowDist[i] };
  }

  fleeDir(x: number, y: number): { dx: number; dy: number } | null {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 1 || ty < 1 || tx >= this.tcols - 1 || ty >= this.trows - 1) return null;
    const i = ty * this.tcols + tx;
    const mine = this.flowDist[i];
    if (mine < 0) return null;
    let best = -1;
    let bd = mine;
    for (let d = 0; d < 4; d++) {
      const nxt = i + [1, -1, this.tcols, -this.tcols][d];
      const dd = this.flowDist[nxt];
      if (dd > bd) {
        bd = dd;
        best = d;
      }
    }
    if (best < 0) return null;
    const f = FLOW[best];
    return { dx: f.dx, dy: f.dy };
  }
}

const FLOW = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

export const world = new World();
