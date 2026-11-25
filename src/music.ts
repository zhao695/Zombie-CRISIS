/** 真实音频 BGM：菜单曲 + 三首随天气（晴 / 雨 / 雷暴）切换的战斗曲，交叉淡化 */
import type { AudioSys } from './audio';
import battleClearUrl from './assets/bgm/battle_clear.mp3';
import battleRainUrl from './assets/bgm/battle_rain.mp3';
import battleStormUrl from './assets/bgm/battle_storm.mp3';
import battleExtra1Url from './assets/bgm/battle_extra1.mp3';
import battleExtra2Url from './assets/bgm/battle_extra2.mp3';
import menuUrl from './assets/bgm/menu.mp3';

type Scene = 'menu' | 'play' | 'pause';
type TrackId = 'menu' | 'clear' | 'rain' | 'storm' | 'extra1' | 'extra2';

const URLS: Record<TrackId, string> = {
  menu: menuUrl,
  clear: battleClearUrl,
  rain: battleRainUrl,
  storm: battleStormUrl,
  extra1: battleExtra1Url,
  extra2: battleExtra2Url,
};

/** 音频文件已归一化到 -16 LUFS，这里再抬一点让 BGM 与音效平衡 */
const BASE_GAIN = 1.6;
const FADE_TC = 0.4;
const DUCK = 0.35;

interface Track {
  el: HTMLAudioElement;
  gain: GainNode;
}

export class Music {
  private audio: AudioSys;
  private tracks = new Map<TrackId, Track>();
  private running = false;
  private timer: number | null = null;
  private current: TrackId | null = null;
  private scene: Scene = 'menu';
  private style = 'default';
  private weather = 0;
  /** 天气档位（0 晴 1 雨 2 雷暴），带滞回避免临界处反复切歌 */
  private level = 0;
  private intensity = 0.1;

  constructor(audio: AudioSys) {
    this.audio = audio;
  }

  /** 唱片切换 BGM 风格，default 时随天气切换 */
  setStyle(s: string) {
    if (s !== this.style) this.style = s;
  }

  /** 由主循环按阶段驱动：菜单/结束用菜单曲，战斗按天气选曲，暂停压低音量 */
  setScene(scene: Scene, weather: number) {
    this.scene = scene;
    this.weather = weather;
  }

  setIntensity(i: number) {
    this.intensity = i;
  }

  start() {
    if (!this.audio.ctx || !this.audio.musicOut) return;
    if (!this.running) {
      this.running = true;
      this.current = this.pick();
      this.play(this.current);
    }
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 100);
  }

  private boss = false;
  private rot = 0;
  private wave = 1;

  /** BOSS 在场时切到 BOSS 曲 */
  setBoss(on: boolean) {
    this.boss = on;
  }

  setWave(w: number) {
    this.wave = w;
  }

  private pick(): TrackId {
    if (this.scene === 'pause' && this.current) return this.current;
    const w = this.weather;
    if (this.level === 0 && w > 1.45) this.level = 1;
    else if (this.level === 1 && w < 1.25) this.level = 0;
    else if (this.level === 1 && w > 3.45) this.level = 2;
    else if (this.level === 2 && w < 3.0) this.level = 1;
    if (this.scene === 'menu') return 'menu';
    if (this.style === 'chill') return 'menu';
    if (this.style === 'rain') return 'rain';
    if (this.style === 'battle') return 'storm';
    // BOSS 战：固定 BOSS 曲
    if (this.boss) return 'storm';
    // 天气驱动：暴雨→storm，中雨→rain，其余晴天三首轮换
    if (w >= 3.4) return 'storm';
    if (w >= 1.4) return 'rain';
    // 用波数挑歌：同一波内不变，避免每 100ms 换歌导致多首叠在一起
    const pool: TrackId[] = ['clear', 'extra1', 'extra2'];
    return pool[Math.max(0, this.wave) % pool.length];
  }

  private play(id: TrackId) {
    const ctx = this.audio.ctx;
    const out = this.audio.musicOut;
    if (!ctx || !out) return;
    let t = this.tracks.get(id);
    if (!t) {
      const el = new Audio(URLS[id]);
      el.loop = true;
      el.preload = 'auto';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain);
      gain.connect(out);
      t = { el, gain };
      this.tracks.set(id, t);
    }
    void t.el.play().catch(() => {
      /* 等待下一次用户手势后的 tick 重试 */
    });
  }

  private tick() {
    const ctx = this.audio.ctx;
    if (!ctx || !this.running) return;
    const want = this.pick();
    if (want !== this.current) {
      const old = this.current;
      this.current = want;
      this.play(want);
      const prev = old ? this.tracks.get(old) : undefined;
      if (prev) {
        window.setTimeout(() => {
          if (this.current !== old) prev.el.pause();
        }, 1500);
      }
    }
    const trim = 0.9 + 0.1 * Math.min(1, Math.max(0, this.intensity));
    const base = (this.scene === 'pause' ? DUCK : 1) * BASE_GAIN * trim;
    for (const [id, t] of this.tracks) {
      t.gain.gain.setTargetAtTime(id === this.current ? base : 0, ctx.currentTime, FADE_TC);
    }
    const cur = this.current ? this.tracks.get(this.current) : null;
    if (cur && cur.el.paused && ctx.state === 'running') {
      void cur.el.play().catch(() => {
        /* 忽略：下个 tick 继续尝试 */
      });
    }
  }
}
