/** Procedural Web Audio — original stingers, no sampled brands. */
export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.58;
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

  gun(kind: string, gain = 1): void {
    const g = gain;
    switch (kind) {
      case "dart":
        this.noise(0.07, 0.42 * g, 700, 4500);
        this.tone(400, 0.08, "square", 0.12 * g);
        break;
      case "anvil":
        this.noise(0.22, 0.98 * g, 100, 1900);
        this.tone(105, 0.24, "sawtooth", 0.42 * g);
        this.tone(52, 0.26, "sine", 0.28 * g);
        break;
      case "stitch":
        this.noise(0.07, 0.48 * g, 900, 6200);
        this.tone(640, 0.07, "square", 0.14 * g);
        this.tone(180, 0.05, "triangle", 0.08 * g);
        break;
      case "ridge":
        this.noise(0.1, 0.55 * g, 350, 2800);
        this.tone(190, 0.1, "sawtooth", 0.16 * g);
        this.tone(90, 0.12, "sine", 0.12 * g);
        break;
      case "quarrel":
        this.noise(0.11, 0.58 * g, 300, 2400);
        this.tone(160, 0.11, "triangle", 0.18 * g);
        break;
      case "longline":
        this.noise(0.2, 0.7 * g, 120, 1400);
        this.tone(90, 0.22, "sawtooth", 0.22 * g);
        this.tone(720, 0.1, "sine", 0.1 * g);
        break;
      case "hatch":
        this.noise(0.15, 0.62 * g, 140, 1600);
        this.tone(70, 0.14, "square", 0.16 * g);
        break;
      default:
        this.noise(0.08, 0.42 * g, 400, 3000);
    }
  }

  impact(): void {
    this.noise(0.05, 0.22, 400, 2800);
    this.tone(180, 0.04, "square", 0.06);
  }

  footstep(quiet = false, distGain = 1): void {
    const g = (quiet ? 0.035 : 0.14) * distGain;
    this.noise(0.05, g, 80, 520);
    this.tone(70 + Math.random() * 20, 0.045, "sine", (quiet ? 0.014 : 0.055) * distGain);
  }

  jump(): void {
    this.noise(0.06, 0.1, 100, 600);
  }

  land(): void {
    this.noise(0.08, 0.14, 60, 400);
  }

  reload(): void {
    this.tone(210, 0.07, "square", 0.1);
    this.tone(160, 0.08, "square", 0.08, 0.14);
    this.tone(280, 0.07, "triangle", 0.1, 0.32);
    this.noise(0.04, 0.08, 400, 1800, 0.2);
  }

  hit(head: boolean): void {
    if (head) {
      this.tone(1100, 0.16, "square", 0.36);
      this.tone(1600, 0.12, "sine", 0.26);
      this.noise(0.07, 0.28, 1600, 7500);
    } else {
      this.tone(280, 0.12, "sine", 0.3);
      this.tone(190, 0.1, "square", 0.16);
      this.noise(0.06, 0.24, 500, 3400);
    }
  }

  hurt(): void {
    this.tone(85, 0.16, "sawtooth", 0.16);
    this.noise(0.08, 0.14, 80, 500);
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
