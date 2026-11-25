export class AudioSys {
  ctx: AudioContext | null = null;
  musicOut: GainNode | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  muted = false;
  sfxVol = 0.22;
  musicVol = 0.16;
  lastFoot = 0;

  constructor() {
    try {
      const raw = localStorage.getItem('zc_audio_v1');
      if (raw) {
        const a = JSON.parse(raw) as { muted?: boolean; sfx?: number; music?: number };
        this.muted = !!a.muted;
        if (typeof a.sfx === 'number') this.sfxVol = a.sfx;
        if (typeof a.music === 'number') this.musicVol = a.music;
      }
    } catch {
      /* ignore */
    }
  }

  private persist() {
    try {
      localStorage.setItem('zc_audio_v1', JSON.stringify({ muted: this.muted, sfx: this.sfxVol, music: this.musicVol }));
    } catch {
      /* ignore */
    }
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.sfxVol;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.muted ? 0 : this.musicVol;
      this.musicGain.connect(this.ctx.destination);
      this.musicOut = this.musicGain;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    const v = this.muted ? 0 : 1;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v * this.sfxVol, this.ctx.currentTime, 0.02);
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(v * this.musicVol, this.ctx.currentTime, 0.02);
    this.persist();
    return this.muted;
  }

  setSfxVol(v: number) {
    this.sfxVol = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.02);
    this.persist();
  }

  setMusicVol(v: number) {
    this.musicVol = v;
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.02);
    this.persist();
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
    delay = 0,
  ) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, gain: number, filterFreq: number, type: BiquadFilterType = 'lowpass', delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, filterFreq * 0.35), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  swing() {
    this.noise(0.09, 0.25, 2600, 'bandpass');
  }

  hit() {
    this.tone(190, 0.08, 'square', 0.12, 90);
    this.noise(0.05, 0.18, 1400, 'bandpass');
  }

  kill() {
    this.noise(0.16, 0.22, 900);
    this.tone(140, 0.14, 'square', 0.1, 55);
  }

  hurt() {
    this.tone(170, 0.26, 'sawtooth', 0.18, 62);
  }

  levelup() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this.tone(n, 0.1, 'square', 0.12, undefined, i * 0.075));
  }

  waveStart() {
    this.tone(330, 0.12, 'triangle', 0.14);
    this.tone(440, 0.16, 'triangle', 0.14, undefined, 0.12);
  }

  boss() {
    this.tone(90, 1.1, 'sine', 0.28, 38);
    this.noise(0.9, 0.16, 420);
  }

  explode() {
    this.noise(0.4, 0.34, 700);
    this.tone(110, 0.34, 'sawtooth', 0.16, 40);
  }

  dash() {
    this.noise(0.12, 0.16, 1800, 'highpass');
  }

  heal() {
    this.tone(620, 0.1, 'sine', 0.12, 900);
  }

  bow() {
    this.tone(240, 0.12, 'sawtooth', 0.1, 90);
    this.noise(0.1, 0.12, 3200, 'bandpass');
  }

  bowDraw() {
    this.noise(0.2, 0.08, 700, 'bandpass');
  }

  arrowShot() {
    this.tone(320, 0.1, 'triangle', 0.08, 140);
    this.noise(0.08, 0.1, 2600, 'bandpass');
  }

  parry() {
    this.tone(1250, 0.12, 'square', 0.14);
    this.tone(1860, 0.09, 'square', 0.09, undefined, 0.02);
    this.noise(0.06, 0.14, 4000, 'highpass');
  }

  combo() {
    this.tone(784, 0.08, 'square', 0.1);
    this.tone(1046, 0.1, 'square', 0.1, undefined, 0.07);
  }

  apple() {
    [660, 880, 1100].forEach((n, i) => this.tone(n, 0.09, 'sine', 0.11, undefined, i * 0.05));
  }

  bowUnlock() {
    [392, 523, 659, 880, 1046].forEach((n, i) => this.tone(n, 0.12, 'square', 0.1, undefined, i * 0.07));
  }

  click() {
    this.tone(520, 0.05, 'square', 0.06);
  }

  axe() {
    this.tone(160, 0.1, 'sawtooth', 0.2, 70);
    this.noise(0.07, 0.16, 900);
  }

  spin() {
    this.noise(0.5, 0.14, 700, 'bandpass');
    this.tone(300, 0.4, 'sine', 0.08, 500);
  }

  cast() {
    this.noise(0.12, 0.12, 2400, 'bandpass');
    this.tone(240, 0.08, 'triangle', 0.06, 480);
  }

  hookHit() {
    this.tone(700, 0.06, 'square', 0.12, 900);
    this.noise(0.04, 0.1, 3000, 'highpass');
  }

  pull() {
    this.tone(200, 0.3, 'sawtooth', 0.08, 90);
  }

  tntThrow() {
    this.noise(0.1, 0.1, 1500, 'highpass');
  }

  hiss() {
    this.noise(0.5, 0.2, 3800, 'highpass');
  }

  boom() {
    this.tone(60, 0.7, 'sine', 0.5, 26);
    this.noise(0.55, 0.4, 900);
    this.noise(0.25, 0.3, 2600, 'highpass');
  }

  teleport() {
    this.tone(880, 0.16, 'sine', 0.1, 180);
    this.tone(440, 0.12, 'sine', 0.06, 880, 0.06);
  }

  potion() {
    this.tone(500, 0.18, 'sine', 0.08, 250);
    this.noise(0.12, 0.08, 1800, 'bandpass');
  }

  splash() {
    this.noise(0.2, 0.16, 1500, 'bandpass');
    this.tone(300, 0.16, 'triangle', 0.08, 150);
  }

  pickup() {
    this.tone(700, 0.06, 'square', 0.08, 1000);
  }

  spider() {
    this.noise(0.12, 0.1, 5000, 'highpass');
  }

  thunder() {
    this.noise(0.9, 0.45, 240);
    this.tone(52, 1.0, 'sine', 0.36, 26);
  }

  mine() {
    this.noise(0.06, 0.16, 900, 'bandpass');
    this.tone(220, 0.05, 'square', 0.05, 140);
  }

  eat() {
    this.noise(0.08, 0.12, 1200, 'highpass');
    this.tone(300, 0.06, 'sine', 0.08, 200);
  }

  craft() {
    this.tone(500, 0.06, 'square', 0.08);
    this.tone(750, 0.08, 'square', 0.08, undefined, 0.06);
  }

  place() {
    this.noise(0.08, 0.14, 700);
    this.tone(180, 0.07, 'square', 0.08, 110);
  }

  chestOpen() {
    this.tone(392, 0.1, 'square', 0.1, 520);
    this.tone(523, 0.14, 'square', 0.1, 660, 0.09);
    this.noise(0.08, 0.1, 2400, 'bandpass');
  }

  execute() {
    this.noise(0.12, 0.3, 1200, 'bandpass');
    this.tone(90, 0.18, 'sawtooth', 0.2, 45);
    this.tone(700, 0.1, 'square', 0.1, 1100, 0.04);
  }

  chargeUp() {
    this.tone(160, 0.4, 'sawtooth', 0.08, 420);
  }

  heavy() {
    this.noise(0.16, 0.3, 900);
    this.tone(120, 0.2, 'sawtooth', 0.22, 50);
  }

  roar() {
    this.tone(70, 0.8, 'sawtooth', 0.3, 30);
    this.noise(0.6, 0.22, 500);
  }

  bossSpawn() {
    this.tone(55, 1.0, 'sawtooth', 0.3, 28);
    this.tone(110, 0.8, 'square', 0.08, 55, 0.1);
    this.noise(0.8, 0.22, 420);
  }

  bossPhase() {
    this.tone(70, 0.7, 'sawtooth', 0.22, 34);
    this.tone(140, 0.5, 'triangle', 0.12, 70, 0.05);
    this.tone(1180, 0.25, 'sine', 0.06, 620, 0.02);
    this.noise(0.5, 0.18, 600);
  }

  quake() {
    this.tone(46, 0.55, 'sine', 0.5, 20);
    this.tone(80, 0.35, 'triangle', 0.18, 30);
    this.noise(0.5, 0.32, 500);
  }

  rockThrow() {
    this.noise(0.22, 0.14, 1600, 'highpass');
    this.tone(190, 0.22, 'triangle', 0.12, 60);
  }

  witherSpiral() {
    this.tone(300, 0.6, 'sawtooth', 0.14, 70);
    this.tone(150, 0.6, 'sine', 0.12, 45, 0.04);
    this.noise(0.5, 0.14, 1200, 'bandpass');
  }

  summon() {
    this.tone(200, 0.3, 'sine', 0.12, 60);
    this.noise(0.2, 0.1, 800, 'bandpass', 0.1);
  }

  buy() {
    this.tone(880, 0.08, 'square', 0.1);
    this.tone(1320, 0.12, 'square', 0.1, undefined, 0.07);
  }

  bless() {
    [523, 659, 784, 1046, 1318].forEach((n, i) => this.tone(n, 0.14, 'sine', 0.1, undefined, i * 0.08));
  }

  emerald() {
    this.tone(1046, 0.07, 'square', 0.08, 1568);
    this.tone(1568, 0.1, 'square', 0.06, undefined, 0.05);
  }

  slime() {
    this.tone(120, 0.14, 'sine', 0.1, 60);
  }

  blaze() {
    this.tone(400, 0.3, 'sawtooth', 0.1, 200);
    this.noise(0.2, 0.1, 2000, 'bandpass');
  }

  phantom() {
    this.tone(900, 0.5, 'sine', 0.08, 300);
  }

  enchant() {
    [660, 880, 1320, 1760].forEach((n, i) => this.tone(n, 0.14, 'triangle', 0.08, undefined, i * 0.05));
  }

  witherTick() {
    this.tone(60, 0.2, 'sawtooth', 0.12, 40);
  }

  disc() {
    this.tone(523, 0.12, 'sine', 0.1, 660);
    this.tone(784, 0.16, 'sine', 0.1, undefined, 0.1);
  }

  fireball() {
    this.tone(220, 0.16, 'sawtooth', 0.1, 80);
    this.noise(0.14, 0.1, 1800, 'bandpass');
  }

  crit() {
    this.tone(1200, 0.06, 'square', 0.12, 1800);
    this.tone(1600, 0.08, 'square', 0.1, undefined, 0.03);
  }

  ach() {
    [659, 784, 988, 1318, 1568].forEach((n, i) => this.tone(n, 0.16, 'triangle', 0.12, undefined, i * 0.09));
  }

  airdrop() {
    this.tone(220, 0.5, 'sine', 0.1, 110);
    this.tone(330, 0.4, 'sine', 0.08, 165, 0.15);
  }

  foot() {
    this.noise(0.04, 0.06, 700, 'lowpass');
  }

  beam() {
    this.tone(880, 0.7, 'sawtooth', 0.12, 320);
    this.noise(0.6, 0.12, 2600, 'bandpass');
  }

  fang() {
    this.tone(140, 0.18, 'sawtooth', 0.16, 60);
    this.noise(0.2, 0.14, 1200, 'bandpass');
    this.tone(220, 0.1, 'square', 0.08, 90, 0.06);
  }

  crossbow() {
    this.tone(180, 0.08, 'square', 0.14, 90);
    this.noise(0.06, 0.16, 3000, 'bandpass');
  }
}
