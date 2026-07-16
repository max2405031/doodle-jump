import { loadSettings } from "../config/settings";

export type Sfx =
  | "jump"
  | "superJump"
  | "land"
  | "coin"
  | "powerup"
  | "hurt"
  | "death"
  | "break"
  | "ice"
  | "click"
  | "hover"
  | "purchase"
  | "denied"
  | "questComplete"
  | "slash"
  | "enemyDeath"
  | "shield"
  | "milestone"
  | "flap"
  | "whack";

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

interface LegacyWindow {
  webkitAudioContext?: AudioContextCtor;
}

/** exponentialRampToValueAtTime refuses to touch zero, so silence is a tiny epsilon. */
const MIN_GAIN = 0.0001;
/** Headroom under the user volume so a full stack of voices still cannot clip. */
const HEADROOM = 0.55;
const MAX_VOICES = 14;
const DEFAULT_THROTTLE_MS = 35;

/** A same-sound retrigger inside this window is dropped, so spam stays musical. */
const THROTTLE_MS: Partial<Record<Sfx, number>> = {
  hover: 70,
  click: 45,
  coin: 22,
  jump: 45,
  break: 28,
  hurt: 120,
  milestone: 500,
  death: 400,
  questComplete: 400,
  purchase: 250,
};

let noiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noiseBuffer = buffer;
  }
  return noiseBuffer;
}

const curveCache = new Map<number, Float32Array<ArrayBuffer>>();

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const cached = curveCache.get(amount);
  if (cached) {
    return cached;
  }
  // Odd length, and index -> input mapped as 2i/(N-1) - 1, which is what WebAudio
  // actually does. Get this wrong and silence maps to a non-zero sample: the shaper
  // is stateless, so it then emits that DC offset forever.
  const samples = 1025;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  curveCache.set(amount, curve);
  return curve;
}

/**
 * One playback of one sound effect. Owns every node it creates so the whole
 * graph can be torn down in a single call once the tail has rung out.
 */
class Voice {
  readonly ctx: AudioContext;
  readonly bus: GainNode;
  readonly t0: number;

  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private endTime: number;

  constructor(ctx: AudioContext, bus: GainNode, t0: number) {
    this.ctx = ctx;
    this.bus = bus;
    this.t0 = t0;
    this.endTime = t0;
  }

  get end(): number {
    return this.endTime;
  }

  gain(initial = MIN_GAIN): GainNode {
    const node = this.ctx.createGain();
    node.gain.setValueAtTime(Math.max(initial, MIN_GAIN), this.t0);
    this.nodes.push(node);
    return node;
  }

  osc(type: OscillatorType, freq: number, detune = 0): OscillatorNode {
    const node = this.ctx.createOscillator();
    node.type = type;
    node.frequency.setValueAtTime(freq, this.t0);
    node.detune.setValueAtTime(detune, this.t0);
    this.nodes.push(node);
    return node;
  }

  noise(): AudioBufferSourceNode {
    const node = this.ctx.createBufferSource();
    node.buffer = getNoiseBuffer(this.ctx);
    node.loop = true;
    this.nodes.push(node);
    return node;
  }

  filter(type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
    const node = this.ctx.createBiquadFilter();
    node.type = type;
    node.frequency.setValueAtTime(freq, this.t0);
    node.Q.setValueAtTime(q, this.t0);
    this.nodes.push(node);
    return node;
  }

  shaper(amount = 50): WaveShaperNode {
    const node = this.ctx.createWaveShaper();
    node.curve = distortionCurve(amount);
    node.oversample = "2x";
    this.nodes.push(node);
    return node;
  }

  /** Percussive envelope: snap to peak, then exponential fall to silence. */
  percussive(param: AudioParam, peak: number, attack: number, decay: number, at = this.t0): number {
    const top = Math.max(peak, MIN_GAIN * 2);
    param.setValueAtTime(MIN_GAIN, at);
    param.exponentialRampToValueAtTime(top, at + attack);
    param.exponentialRampToValueAtTime(MIN_GAIN, at + attack + decay);
    return at + attack + decay;
  }

  /** Attack, hold at level, then release. */
  sustained(
    param: AudioParam,
    peak: number,
    attack: number,
    hold: number,
    release: number,
    at = this.t0,
  ): number {
    const top = Math.max(peak, MIN_GAIN * 2);
    param.setValueAtTime(MIN_GAIN, at);
    param.exponentialRampToValueAtTime(top, at + attack);
    param.setValueAtTime(top, at + attack + hold);
    param.exponentialRampToValueAtTime(MIN_GAIN, at + attack + hold + release);
    return at + attack + hold + release;
  }

  play(source: AudioScheduledSourceNode, start: number, stop: number): void {
    const off = Math.max(stop, start + 0.01) + 0.02;
    source.start(start);
    source.stop(off);
    this.sources.push(source);
    if (off > this.endTime) {
      this.endTime = off;
    }
  }

  dispose(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Already finished — stopping twice is harmless.
      }
    }
    for (const node of this.nodes) {
      node.disconnect();
    }
    this.bus.disconnect();
  }
}

/** Oscillator + percussive envelope, the workhorse of most recipes. */
function tone(
  v: Voice,
  type: OscillatorType,
  freq: number,
  at: number,
  attack: number,
  decay: number,
  peak: number,
  dest?: AudioNode,
): OscillatorNode {
  const g = v.gain();
  const o = v.osc(type, freq);
  const end = v.percussive(g.gain, peak, attack, decay, at);
  o.connect(g).connect(dest ?? v.bus);
  v.play(o, at, end);
  return o;
}

/** Filtered white-noise burst. Returns the filter so callers can sweep it. */
function noiseBurst(
  v: Voice,
  type: BiquadFilterType,
  freq: number,
  q: number,
  peak: number,
  attack: number,
  decay: number,
  at = v.t0,
  dest?: AudioNode,
): BiquadFilterNode {
  const n = v.noise();
  const f = v.filter(type, freq, q);
  const g = v.gain();
  const end = v.percussive(g.gain, peak, attack, decay, at);
  n.connect(f).connect(g).connect(dest ?? v.bus);
  v.play(n, at, end);
  return f;
}

const RECIPES: Record<Sfx, (v: Voice) => void> = {
  flap: (v) => {
    // A soft, low-frequency feathery woosh.
    noiseBurst(v, "lowpass", 200, 0.5, 0.35, 0.05, 0.15);
    const body = tone(v, "sine", 120, v.t0, 0.02, 0.15, 0.3);
    body.frequency.exponentialRampToValueAtTime(60, v.t0 + 0.15);
  },

  whack: (v) => {
    // High-pitched hollow bonk
    const body = tone(v, "sine", 600, v.t0, 0.005, 0.12, 0.7);
    body.frequency.exponentialRampToValueAtTime(120, v.t0 + 0.12);
    noiseBurst(v, "bandpass", 1500, 2, 0.4, 0.002, 0.05);
  },

  jump: (v) => {
    const t = v.t0;
    const body = tone(v, "triangle", 360, t, 0.004, 0.11, 0.42);
    body.frequency.exponentialRampToValueAtTime(760, t + 0.075);
    const bright = tone(v, "square", 720, t, 0.003, 0.055, 0.07);
    bright.frequency.exponentialRampToValueAtTime(1500, t + 0.07);
  },

  superJump: (v) => {
    const t = v.t0;
    const sweep = v.filter("lowpass", 700, 7);
    sweep.frequency.exponentialRampToValueAtTime(6500, t + 0.3);
    sweep.frequency.exponentialRampToValueAtTime(2200, t + 0.5);
    sweep.connect(v.bus);

    for (const detune of [-8, 9]) {
      const g = v.gain();
      const o = v.osc("sawtooth", 250, detune);
      o.frequency.exponentialRampToValueAtTime(1560, t + 0.36);
      const end = v.sustained(g.gain, 0.3, 0.014, 0.16, 0.2);
      o.connect(g).connect(sweep);
      v.play(o, t, end);
    }
    tone(v, "sine", 500, t, 0.01, 0.42, 0.16).frequency.exponentialRampToValueAtTime(
      3120,
      t + 0.36,
    );
    noiseBurst(v, "highpass", 4200, 0.9, 0.05, 0.02, 0.34);
  },

  land: (v) => {
    const t = v.t0;
    const thud = tone(v, "sine", 195, t, 0.003, 0.14, 0.36);
    thud.frequency.exponentialRampToValueAtTime(62, t + 0.11);
    noiseBurst(v, "lowpass", 520, 1, 0.15, 0.002, 0.07);
  },

  coin: (v) => {
    const t = v.t0;
    tone(v, "triangle", 1318.5, t, 0.002, 0.13, 0.3);
    tone(v, "sine", 2637, t, 0.002, 0.08, 0.1);
    tone(v, "triangle", 1975.5, t + 0.068, 0.002, 0.19, 0.3);
    tone(v, "sine", 3951, t + 0.068, 0.002, 0.1, 0.09);
    noiseBurst(v, "highpass", 7000, 1, 0.03, 0.001, 0.05);
  },

  powerup: (v) => {
    const t = v.t0;
    const warm = v.filter("lowpass", 900, 4);
    warm.frequency.exponentialRampToValueAtTime(4400, t + 0.4);
    warm.connect(v.bus);
    const chord = [440, 554.4, 659.3, 880];
    chord.forEach((freq, i) => {
      const at = t + i * 0.052;
      tone(v, "triangle", freq, at, 0.018, 0.44 - i * 0.03, 0.2, warm);
      tone(v, "sine", freq * 2, at, 0.018, 0.28, 0.055, warm);
    });
  },

  hurt: (v) => {
    const t = v.t0;
    const muffle = v.filter("lowpass", 760, 4);
    muffle.connect(v.bus);
    // Two near-unison saws beat against each other: cheap, reliable dissonance.
    for (const base of [147, 156]) {
      const g = v.gain();
      const o = v.osc("sawtooth", base);
      o.frequency.exponentialRampToValueAtTime(base * 0.62, t + 0.2);
      const end = v.percussive(g.gain, 0.28, 0.004, 0.22);
      o.connect(g).connect(muffle);
      v.play(o, t, end);
    }
    noiseBurst(v, "bandpass", 1200, 1.4, 0.16, 0.002, 0.09);
  },

  death: (v) => {
    const t = v.t0;
    const dark = v.filter("lowpass", 1400, 2);
    dark.frequency.exponentialRampToValueAtTime(140, t + 0.9);
    dark.connect(v.bus);

    const g = v.gain();
    const o = v.osc("sawtooth", 240);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.95);
    const end = v.sustained(g.gain, 0.32, 0.012, 0.22, 0.72);
    o.connect(g).connect(dark);
    v.play(o, t, end);

    const sub = tone(v, "sine", 120, t, 0.02, 0.9, 0.24, dark);
    sub.frequency.exponentialRampToValueAtTime(34, t + 0.9);

    const hiss = noiseBurst(v, "lowpass", 1800, 1, 0.2, 0.01, 0.85);
    hiss.frequency.exponentialRampToValueAtTime(180, t + 0.9);
  },

  break: (v) => {
    const t = v.t0;
    // Four staggered grains read as splintering wood rather than one flat hit.
    // Gains run high because a resonant bandpass throws away most of the noise energy.
    for (let i = 0; i < 4; i++) {
      const at = t + i * 0.017;
      noiseBurst(v, "bandpass", 1400 + i * 850, 3 + i, 0.85 - i * 0.16, 0.001, 0.05 + i * 0.012, at);
    }
    const body = tone(v, "triangle", 190, t, 0.002, 0.1, 0.24);
    body.frequency.exponentialRampToValueAtTime(70, t + 0.09);
    noiseBurst(v, "lowpass", 700, 0.8, 0.36, 0.001, 0.12);
  },

  ice: (v) => {
    const t = v.t0;
    const partials = [2637, 3520, 4699, 5274];
    partials.forEach((freq, i) => {
      tone(v, "sine", freq, t + i * 0.011, 0.002, 0.46 - i * 0.08, 0.16 / (i + 1));
    });
    noiseBurst(v, "highpass", 6200, 1, 0.06, 0.001, 0.07);
  },

  click: (v) => {
    tone(v, "square", 880, v.t0, 0.001, 0.03, 0.12);
    noiseBurst(v, "highpass", 3200, 1, 0.05, 0.001, 0.022);
  },

  hover: (v) => {
    tone(v, "sine", 1520, v.t0, 0.002, 0.05, 0.17);
  },

  purchase: (v) => {
    const t = v.t0;
    const shine = v.filter("lowpass", 2600, 1);
    shine.frequency.exponentialRampToValueAtTime(5200, t + 0.3);
    shine.connect(v.bus);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const at = t + i * 0.072;
      const last = i === notes.length - 1;
      tone(v, "triangle", freq, at, 0.006, last ? 0.5 : 0.17, 0.22, shine);
      tone(v, "sawtooth", freq, at, 0.006, last ? 0.34 : 0.12, 0.05, shine);
      tone(v, "sine", freq * 2, at, 0.006, 0.13, 0.045, shine);
    });
  },

  denied: (v) => {
    const t = v.t0;
    const muffle = v.filter("lowpass", 420, 6);
    muffle.connect(v.bus);

    // Tremolo lives on its own node so the LFO never fights the amp envelope.
    const trem = v.gain(0.7);
    trem.connect(muffle);
    const lfo = v.osc("square", 24);
    const depth = v.gain(0.3);
    lfo.connect(depth).connect(trem.gain);

    const g = v.gain();
    const o = v.osc("square", 98);
    o.frequency.linearRampToValueAtTime(70, t + 0.26);
    const end = v.sustained(g.gain, 0.26, 0.006, 0.16, 0.1);
    o.connect(g).connect(trem);
    v.play(o, t, end);
    v.play(lfo, t, end);
  },

  questComplete: (v) => {
    const t = v.t0;
    const notes = [659.25, 783.99, 987.77, 1318.5];
    notes.forEach((freq, i) => {
      const at = t + i * 0.058;
      const last = i === notes.length - 1;
      tone(v, "triangle", freq, at, 0.003, last ? 0.56 : 0.2, 0.24);
      tone(v, "sine", freq * 2.01, at, 0.003, last ? 0.4 : 0.16, 0.06);
    });
    noiseBurst(v, "highpass", 7000, 1, 0.04, 0.002, 0.12, t + 0.17);
  },

  slash: (v) => {
    const t = v.t0;
    const sweep = noiseBurst(v, "bandpass", 500, 5, 1.05, 0.012, 0.24);
    sweep.frequency.exponentialRampToValueAtTime(4800, t + 0.11);
    sweep.frequency.exponentialRampToValueAtTime(900, t + 0.26);
    tone(v, "sine", 3200, t + 0.05, 0.002, 0.1, 0.07);
  },

  enemyDeath: (v) => {
    const t = v.t0;
    const grit = v.shaper(60);
    const muffle = v.filter("lowpass", 2600, 2);
    grit.connect(muffle).connect(v.bus);

    const g = v.gain();
    const o = v.osc("sawtooth", 660);
    o.frequency.exponentialRampToValueAtTime(105, t + 0.34);
    const end = v.percussive(g.gain, 0.3, 0.005, 0.38);
    o.connect(g).connect(grit);

    const vibrato = v.osc("sine", 27);
    const depth = v.gain(220); // cents
    vibrato.connect(depth).connect(o.detune);

    v.play(o, t, end);
    v.play(vibrato, t, end);

    const growl = noiseBurst(v, "bandpass", 900, 2, 0.16, 0.005, 0.3, t, muffle);
    growl.frequency.exponentialRampToValueAtTime(220, t + 0.32);
  },

  shield: (v) => {
    const t = v.t0;
    const ring = v.filter("bandpass", 1100, 1.1);
    ring.connect(v.bus);
    // Inharmonic partials = metal. Harmonic ones would sound like a flute.
    const partials = [523, 787, 1179, 1580, 2103];
    partials.forEach((freq, i) => {
      tone(v, "sine", freq, t + i * 0.008, 0.006, 0.58 - i * 0.07, 0.14 / (1 + i * 0.5), ring);
    });
    const rise = tone(v, "triangle", 420, t, 0.05, 0.4, 0.1, ring);
    rise.frequency.exponentialRampToValueAtTime(1240, t + 0.3);
    noiseBurst(v, "bandpass", 2600, 2.5, 0.12, 0.001, 0.08, t, ring);
  },

  milestone: (v) => {
    const t = v.t0;
    const body = v.filter("lowpass", 5200, 1);
    body.connect(v.bus);
    const base = 174;
    // Ratio / level / decay: a struck-bronze spectrum, deliberately inharmonic.
    const partials: Array<[number, number, number]> = [
      [1, 0.34, 2.6],
      [2.0, 0.16, 2.0],
      [2.76, 0.12, 1.7],
      [4.07, 0.08, 1.2],
      [5.43, 0.05, 0.9],
      [6.79, 0.035, 0.7],
      [8.21, 0.02, 0.5],
    ];
    partials.forEach(([ratio, level, decay], i) => {
      tone(v, "sine", base * ratio, t + i * 0.004, 0.005, decay, level, body);
    });
    // Slightly detuned twin of the octave: the slow beating that makes a bell breathe.
    tone(v, "sine", base * 2.008, t, 0.006, 1.8, 0.06, body);
    tone(v, "sine", base * 0.5, t, 0.012, 1.4, 0.13, body);
    noiseBurst(v, "bandpass", 2400, 2, 0.16, 0.001, 0.1, t, body);
  },
};

/**
 * Every sound in the game is synthesised on the fly — there is not a single
 * audio asset on disk. Safe to call before any user gesture: it simply stays
 * silent until the browser lets an AudioContext run.
 */
export class AudioManager {
  private static ctx: AudioContext | null = null;
  private static master: GainNode | null = null;
  private static unsupported = false;
  private static armed = false;
  private static enabled = true;
  private static volume = 0.8;
  private static voices = 0;
  private static lastPlayed: Partial<Record<Sfx, number>> = {};

  static init(): void {
    this.refreshFromSettings();
    this.ensure();
  }

  static play(sfx: Sfx): void {
    if (!this.enabled || this.volume <= 0) {
      return;
    }
    const ctx = this.ensure();
    const master = this.master;
    // Scheduling while suspended piles every sound onto the same timestamp and
    // they all detonate at once on resume. Better to drop them.
    if (!ctx || !master || ctx.state !== "running") {
      return;
    }
    if (this.voices >= MAX_VOICES) {
      return;
    }

    const now = Date.now();
    const gap = THROTTLE_MS[sfx] ?? DEFAULT_THROTTLE_MS;
    const last = this.lastPlayed[sfx];
    if (last !== undefined && now - last < gap) {
      return;
    }
    this.lastPlayed[sfx] = now;

    try {
      const bus = ctx.createGain();
      bus.gain.setValueAtTime(1, ctx.currentTime);
      bus.connect(master);

      const voice = new Voice(ctx, bus, ctx.currentTime + 0.005);
      RECIPES[sfx](voice);

      this.voices++;
      const lifetimeMs = Math.max(0, (voice.end - ctx.currentTime) * 1000) + 90;
      window.setTimeout(() => {
        voice.dispose();
        this.voices = Math.max(0, this.voices - 1);
      }, lifetimeMs);
    } catch {
      // A failed SFX must never take the game down with it.
    }
  }

  static setEnabled(value: boolean): void {
    this.enabled = value;
    this.applyGain();
  }

  static setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.applyGain();
  }

  static refreshFromSettings(): void {
    const settings = loadSettings();
    this.enabled = settings.sfxEnabled;
    this.volume = Math.max(0, Math.min(1, settings.sfxVolume));
    this.applyGain();
  }

  private static applyGain(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) {
      return;
    }
    const target = this.enabled ? this.volume * HEADROOM : 0;
    // Short glide instead of a step: a hard gain jump clicks.
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.02);
  }

  private static ensure(): AudioContext | null {
    if (this.unsupported || typeof window === "undefined") {
      return null;
    }
    if (!this.ctx) {
      try {
        const legacy = window as unknown as LegacyWindow;
        const Ctor: AudioContextCtor | undefined = window.AudioContext ?? legacy.webkitAudioContext;
        if (!Ctor) {
          this.unsupported = true;
          return null;
        }
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.gain.setValueAtTime(this.enabled ? this.volume * HEADROOM : 0, ctx.currentTime);

        // Catches the peaks when a coin, a jump and a break all land on the same frame.
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-14, ctx.currentTime);
        compressor.knee.setValueAtTime(24, ctx.currentTime);
        compressor.ratio.setValueAtTime(8, ctx.currentTime);
        compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        compressor.release.setValueAtTime(0.2, ctx.currentTime);

        master.connect(compressor).connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
      } catch {
        this.unsupported = true;
        return null;
      }
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => undefined);
    }
    this.arm();
    return this.ctx;
  }

  /** Autoplay policy: the context can only leave "suspended" inside a user gesture. */
  private static arm(): void {
    if (this.armed || typeof window === "undefined") {
      return;
    }
    this.armed = true;
    const unlock = (): void => {
      const ctx = this.ctx;
      if (ctx && ctx.state === "suspended") {
        void ctx.resume().catch(() => undefined);
      }
    };
    for (const event of ["pointerdown", "touchstart", "keydown", "mousedown"]) {
      window.addEventListener(event, unlock, { passive: true });
    }
  }
}
