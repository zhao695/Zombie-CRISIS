/**
 * 全球排行榜（每日挑战）。
 *
 * 用的是 Supabase 的 REST 接口（PostgREST），不需要装 SDK。
 *
 * 用法：
 *  1. 注册 https://supabase.com → New project（免费）
 *  2. SQL Editor 里执行 docs/supabase.sql 建表
 *  3. Project Settings → API 里复制 Project URL 和 anon public key
 *  4. 填到下面两个常量里，重新构建
 *
 * 没填的话排行榜会显示“未配置”，游戏其它功能不受影响。
 */

export const SUPABASE_URL = 'https://qtyvcgqhakexizhqfxe.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_ogSqj3wFVVUvSp7BU0jpRw_q6X51U2R';

const TABLE = 'scores';

export interface LbRow {
  name: string;
  wave: number;
  kills: number;
  seconds: number;
  day: string;
  seed: number;
  job: string;
}

export const LB_READY = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * 新版 Supabase 用 sb_publishable_ 开头的 key，只放 apikey 头即可；
 * 旧版 eyJ 开头的 JWT 还需要 Authorization。两种都带上，失败再退回只有 apikey。
 */
function headers(withAuth: boolean, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    ...extra,
  };
  if (withAuth) h.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  return h;
}

/** 先带 Authorization 请求，401/403 就退回只带 apikey 重试一次 */
async function req(url: string, init: RequestInit): Promise<Response> {
  const first = await fetch(url, { ...init, headers: headers(true, (init.headers as Record<string, string>) ?? {}) });
  if (first.status !== 401 && first.status !== 403) return first;
  return fetch(url, { ...init, headers: headers(false, (init.headers as Record<string, string>) ?? {}) });
}

/** 本地昵称：没有就生成一个，之后可在结算界面按 N 改 */
export function loadName(): string {
  try {
    const v = localStorage.getItem('zc_name_v1');
    if (v && v.trim()) return v.trim().slice(0, 12);
  } catch {
    /* ignore */
  }
  const name = '幸存者' + Math.floor(Math.random() * 900 + 100);
  try {
    localStorage.setItem('zc_name_v1', name);
  } catch {
    /* ignore */
  }
  return name;
}

export function saveName(n: string) {
  const clean = n.trim().slice(0, 12);
  if (!clean) return;
  try {
    localStorage.setItem('zc_name_v1', clean);
  } catch {
    /* ignore */
  }
}

/** 提交成绩。返回 false 表示没配置或失败（不影响游戏） */
export async function lbSubmit(row: LbRow): Promise<boolean> {
  if (!LB_READY) return false;
  // 基本合理性校验：明显离谱的数据不提交
  if (row.wave < 1 || row.wave > 80) return false;
  if (row.seconds < 20 || row.seconds > 60 * 60 * 5) return false;
  if (row.kills > row.wave * 120 + 200) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** 拉取当天前 N 名 */
export async function lbTop(day: string, limit = 20): Promise<LbRow[] | null> {
  if (!LB_READY) return null;
  try {
    const q =
      `select=name,wave,kills,seconds,day,seed,job` +
      `&day=eq.${encodeURIComponent(day)}` +
      `&order=wave.desc,kills.desc,seconds.asc` +
      `&limit=${limit}`;
    const r = await req(`${SUPABASE_URL}/rest/v1/${TABLE}?${q}`, { headers: {} });
    if (!r.ok) return null;
    const rows = (await r.json()) as LbRow[];
    return rows;
  } catch {
    return null;
  }
}
