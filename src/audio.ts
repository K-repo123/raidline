/** Procedural Web Audio — original stingers, no sampled brands. */
export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  private footT = 0;

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
  }

  private out(): { ctx: AudioContext; master: GainNode } | null {
    if (this.muted || !this.ctx || !this.master) return null;
    return { ctx: this.ctx, master: this.master };
  }

  tone(freq: number, dur: number, type: OscillatorType, gain: number, at = 0): void {
    const io = this.out();
    if (!io) return;
    const t = io.ctx.currentTime + at;
    const osc = io.ctx.createOscillator();
    const g = io.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(g);
    g.connect(io.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur: number, gain: number, hp: number, lp: number, at = 0): void {
    const io = this.out();
    if (!io) return;
    const t = io.ctx.currentTime + at;
    const n = Math.floor(io.ctx.sampleRate * dur);
    const buf = io.ctx.createBuffer(1, n, io.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = io.ctx.createBufferSource();
    src.buffer = buf;
    const high = io.ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = hp;
    const low = io.ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = lp;
    const g = io.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(high);
    high.connect(low);
    low.connect(g);
    g.connect(io.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  gun(kind: string): void {
    switch (kind) {
      case "dart":
        this.noise(0.05, 0.28, 800, 4200);
        this.tone(420, 0.06, "square", 0.08);
        break;
      case "anvil":
        this.noise(0.09, 0.4, 200, 1800);
        this.tone(140, 0.1, "sawtooth", 0.14);
        break;
      case "stitch":
        this.noise(0.04, 0.22, 1200, 5000);
        this.tone(680, 0.04, "square", 0.05);
        break;
      case "ridge":
        this.noise(0.07, 0.36, 400, 2800);
        this.tone(190, 0.08, "sawtooth", 0.1);
        this.tone(90, 0.1, "sine", 0.08);
        break;
      case "quarrel":
        this.noise(0.08, 0.38, 350, 2400);
        this.tone(160, 0.09, "triangle", 0.12);
        break;
      case "longline":
        this.noise(0.16, 0.5, 150, 1400);
        this.tone(90, 0.2, "sawtooth", 0.16);
        this.tone(720, 0.08, "sine", 0.06);
        break;
      case "hatch":
        this.noise(0.12, 0.42, 180, 1600);
        this.tone(70, 0.12, "square", 0.1);
        break;
      default:
        this.noise(0.06, 0.3, 400, 3000);
    }
  }

  footstep(rate: number): void {
    this.footT += rate;
    if (this.footT < 1) return;
    this.footT = 0;
    this.noise(0.045, 0.09, 80, 500);
    this.tone(70 + Math.random() * 20, 0.04, "sine", 0.04);
  }

  jump(): void {
    this.noise(0.06, 0.1, 100, 600);
  }

  land(): void {
    this.noise(0.08, 0.14, 60, 400);
  }

  reload(): void {
    this.tone(220, 0.05, "square", 0.05);
    this.tone(180, 0.06, "square", 0.04, 0.12);
    this.tone(260, 0.05, "triangle", 0.05, 0.28);
  }

  hit(head: boolean): void {
    if (head) {
      this.tone(880, 0.07, "square", 0.1);
      this.tone(1320, 0.05, "sine", 0.07);
    } else {
      this.tone(220, 0.05, "sine", 0.07);
    }
  }

  hurt(): void {
    this.tone(90, 0.12, "sawtooth", 0.08);
  }

  buy(): void {
    this.tone(520, 0.05, "square", 0.06);
    this.tone(690, 0.06, "square", 0.05, 0.04);
  }

  deny(): void {
    this.tone(140, 0.1, "square", 0.06);
  }

  plantTick(): void {
    this.tone(640, 0.05, "square", 0.08);
  }

  bombBeep(urgency: number): void {
    this.tone(880 + urgency * 200, 0.04, "square", 0.07);
  }

  defuse(): void {
    this.noise(0.04, 0.08, 400, 2000);
  }

  roundStart(): void {
    this.tone(196, 0.12, "triangle", 0.09);
    this.tone(247, 0.14, "triangle", 0.08, 0.1);
    this.tone(330, 0.2, "triangle", 0.08, 0.22);
  }

  win(): void {
    this.tone(330, 0.15, "triangle", 0.1);
    this.tone(392, 0.15, "triangle", 0.09, 0.12);
    this.tone(523, 0.28, "triangle", 0.1, 0.24);
  }

  lose(): void {
    this.tone(196, 0.2, "sine", 0.1);
    this.tone(147, 0.28, "sine", 0.08, 0.16);
  }

  flash(): void {
    this.noise(0.2, 0.35, 2000, 8000);
  }

  explode(): void {
    this.noise(0.45, 0.55, 40, 700);
    this.tone(55, 0.4, "sawtooth", 0.16);
  }
}
