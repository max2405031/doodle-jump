/**
 * The climb, staged.
 *
 * Six biomes are painted in `art/backgrounds` as three vertically-tileable
 * layers each. This driver turns them into a moving world:
 *
 *  - Three TileSprites scroll at different fractions of the camera, so the
 *    village roofs slide past while the moon barely moves (motion parallax).
 *  - Everything is doubled: one set shows the current biome, the other the one
 *    being climbed into. `biomeProgress` drives a crossfade between them, and
 *    when the fade completes the sets swap roles without a reload.
 *  - Sky gradient, atmospheric haze and weather are all interpolated with the
 *    same `t`, so a biome change is a slow dissolve, never a cut.
 *
 * Cost model: `update` runs on every frame but only touches numbers. The one
 * block that rebuilds state (tints, alphas, emitter starts) is gated on the
 * score actually changing — while the player is falling or idling it does not
 * run at all. Nothing is allocated, tweened or recreated per frame.
 */

import { Scene } from "phaser";

import { biomeProgress, biomeStyle, type BiomeStyle } from "../art/backgrounds";
import { BG_LAYERS, FX, UI, bgKey, type Biome } from "../art/keys";
import { defineFlat, hdImage } from "../art/registry";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { DEPTH } from "../config/theme";

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
type Weather = BiomeStyle["particle"];

/** Fraction of the camera's travel each layer echoes. Far barely moves. */
const PARALLAX = [0.05, 0.15, 0.35] as const;

/** Slow lateral drift (px per ms) so the sky breathes even when standing still. */
const DRIFT = [0.0018, 0.0045, 0.0095] as const;

/** Depth per layer, straight from the design tokens. */
const LAYER_DEPTH = [DEPTH.bgFar, DEPTH.bgMid, DEPTH.bgNear] as const;

/**
 * The incoming set is interleaved just above its outgoing counterpart, so a
 * half-faded near layer still sits in front of a fully-faded mid layer.
 */
const FADE_OFFSET = 0.5;

const WEATHER: readonly Weather[] = ["sakura", "leaf", "snow", "rain", "star", "ember"] as const;

/** Below this the emitter is invisible anyway, so stop spawning. */
const WEATHER_CUTOFF = 0.02;

/**
 * Flat white, used purely as a tint carrier: a quad tinted per-corner gives a
 * real interpolated gradient for free. Not an art asset, so it has no business
 * in `art/keys` — it is an implementation detail of this file.
 */
const TINT_QUAD = "sys_bg_tint_quad";

/**
 * Integer colour lerp. `Phaser.Display.Color.Interpolate.ColorWithColor` returns
 * a fresh object on every call; this returns a packed int and allocates nothing.
 */
function lerpHex(from: number, to: number, t: number): number {
  const r = ((from >> 16) & 0xff) + (((to >> 16) & 0xff) - ((from >> 16) & 0xff)) * t;
  const g = ((from >> 8) & 0xff) + (((to >> 8) & 0xff) - ((from >> 8) & 0xff)) * t;
  const b = (from & 0xff) + ((to & 0xff) - (from & 0xff)) * t;
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export class BackgroundManager {
  private scene: Scene;

  private sky!: Phaser.GameObjects.Image;
  private haze!: Phaser.GameObjects.Image;
  private vignette!: Phaser.GameObjects.Image;

  /** Outgoing (current biome) and incoming (next biome) parallax stacks. */
  private setA: Phaser.GameObjects.TileSprite[] = [];
  private setB: Phaser.GameObjects.TileSprite[] = [];

  /** Parallel to WEATHER — one persistent emitter per particle type. */
  private weather: Emitter[] = [];

  private current: Biome = "village";
  private next: Biome = "village";
  private lastScore = Number.NaN;

  /** When set, the climb never changes biome — used by campaign & custom levels. */
  private pinned?: Biome;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  create(): void {
    const w = GAME_WIDTH;
    const h = GAME_HEIGHT;

    defineFlat(this.scene, TINT_QUAD, 4, 4, (ctx, cw, ch) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
    });

    // Sky sits under everything: the biome art is opaque, so this is both the
    // colour bed and the guarantee that no gap ever shows through.
    this.sky = this.scene.add.image(w / 2, h / 2, TINT_QUAD);
    this.sky.setDisplaySize(w, h);
    this.sky.setScrollFactor(0);
    this.sky.setDepth(DEPTH.bgFar - 1);

    const start = biomeProgress(0);
    this.current = start.current;
    this.next = start.next;

    for (let i = 0; i < BG_LAYERS; i++) {
      this.setA.push(this.makeLayer(bgKey(this.current, i), LAYER_DEPTH[i], 1));
      this.setB.push(this.makeLayer(bgKey(this.next, i), LAYER_DEPTH[i] + FADE_OFFSET, 0));
    }

    // Aerial perspective: a wash of the biome's fog colour laid over the far and
    // mid layers, pushing the near silhouettes forward.
    this.haze = this.scene.add.image(w / 2, h / 2, TINT_QUAD);
    this.haze.setDisplaySize(w, h);
    this.haze.setScrollFactor(0);
    this.haze.setDepth(DEPTH.bgMid + 0.75);
    this.haze.setBlendMode(Phaser.BlendModes.ADD);
    this.haze.setAlpha(0.1);

    for (let i = 0; i < WEATHER.length; i++) {
      this.weather.push(this.makeWeather(WEATHER[i]));
    }

    this.vignette = hdImage(this.scene, w / 2, h / 2, UI.vignette);
    this.vignette.setScrollFactor(0);
    this.vignette.setDepth(DEPTH.bgNear + 1);

    this.applyProgress(0);
    this.lastScore = 0;
  }

  private makeLayer(key: string, depth: number, alpha: number): Phaser.GameObjects.TileSprite {
    const layer = this.scene.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      key
    );
    layer.setScrollFactor(0);
    layer.setDepth(depth);
    layer.setAlpha(alpha);
    return layer;
  }

  /**
   * Locks the whole climb to one biome (no crossfade). Campaign and custom
   * levels each live in a single place rather than scrolling through the range.
   */
  pinBiome(biome: Biome): void {
    this.pinned = biome;
    this.current = biome;
    this.next = biome;
    for (let i = 0; i < BG_LAYERS; i++) {
      this.setA[i].setTexture(bgKey(biome, i));
      this.setB[i].setTexture(bgKey(biome, i));
    }
    this.grade(biome, biome, 0);
  }

  update(cameraY: number, score: number): void {
    // Tints, alphas and emitter state are pure functions of the score.
    if (!this.pinned && score !== this.lastScore) {
      this.lastScore = score;
      this.applyProgress(score);
    }

    const now = this.scene.time.now;
    for (let i = 0; i < BG_LAYERS; i++) {
      // scrollY goes negative on the way up, so the layers slide down. The far
      // layer lags hardest, which is what sells the depth.
      const y = cameraY * PARALLAX[i];
      const x = now * DRIFT[i];
      const a = this.setA[i];
      const b = this.setB[i];
      a.tilePositionY = y;
      a.tilePositionX = x;
      b.tilePositionY = y;
      b.tilePositionX = x;
    }
  }

  /** Re-point the stacks, crossfade them, and re-grade sky, haze and weather. */
  private applyProgress(score: number): void {
    const p = biomeProgress(score);

    if (p.current !== this.current) {
      this.current = p.current;
      for (let i = 0; i < BG_LAYERS; i++) this.setA[i].setTexture(bgKey(this.current, i));
    }
    if (p.next !== this.next) {
      this.next = p.next;
      for (let i = 0; i < BG_LAYERS; i++) this.setB[i].setTexture(bgKey(this.next, i));
    }

    this.grade(this.current, this.next, p.t);
  }

  /** Alphas, sky, haze and weather for a given crossfade state. */
  private grade(current: Biome, next: Biome, t: number): void {
    // Layer 0 is an opaque sky: the incoming one simply covers the outgoing one.
    // Dimming both would flash the bare gradient at the midpoint of the fade.
    this.setA[0].setAlpha(1);
    this.setB[0].setAlpha(t);
    for (let i = 1; i < BG_LAYERS; i++) {
      this.setA[i].setAlpha(1 - t);
      this.setB[i].setAlpha(t);
    }

    const cur = biomeStyle(current);
    const nxt = biomeStyle(next);

    const top = lerpHex(cur.skyTop, nxt.skyTop, t);
    const bottom = lerpHex(cur.skyBottom, nxt.skyBottom, t);
    this.sky.setTint(top, top, bottom, bottom);

    const fog = lerpHex(cur.fog, nxt.fog, t);
    const fogTop = lerpHex(fog, 0x000000, 0.65);
    this.haze.setTint(fogTop, fogTop, fog, fog);

    for (let i = 0; i < WEATHER.length; i++) {
      const kind = WEATHER[i];
      let alpha = 0;
      if (kind === cur.particle) alpha += 1 - t;
      if (kind === nxt.particle) alpha += t;

      const emitter = this.weather[i];
      emitter.setAlpha(alpha);

      // Emitter alpha multiplies particle alpha, so the swap is a dissolve. Cut
      // the spawn once it is invisible; particles already in the air live out
      // their lifespan instead of popping.
      if (alpha > WEATHER_CUTOFF) {
        if (!emitter.emitting) emitter.start();
      } else if (emitter.emitting) {
        emitter.stop();
      }
    }
  }

  private makeWeather(kind: Weather): Emitter {
    const spec = this.weatherSpec(kind);
    const emitter = this.scene.add.particles(0, 0, spec.texture, spec.config);
    emitter.setDepth(DEPTH.weather);
    emitter.setScrollFactor(0);
    emitter.setAlpha(0);
    return emitter;
  }

  private weatherSpec(kind: Weather): { texture: string; config: EmitterConfig } {
    const w = GAME_WIDTH;
    const h = GAME_HEIGHT;

    switch (kind) {
      // Petals: slow, weightless, tumbling.
      case "sakura":
        return {
          texture: FX.sakura,
          config: {
            emitting: false,
            x: { min: -24, max: w + 24 },
            y: -24,
            lifespan: { min: 6000, max: 10000 },
            speedY: { min: 22, max: 58 },
            speedX: { min: -30, max: 30 },
            scale: { min: 0.45, max: 0.85 },
            alpha: { start: 0.75, end: 0.2 },
            rotate: { min: 0, max: 360 },
            blendMode: "ADD",
            frequency: 260,
            quantity: 1,
          },
        };

      // Same silhouette, recoloured and heavier: dead leaves off the bamboo.
      case "leaf":
        return {
          texture: FX.sakura,
          config: {
            emitting: false,
            x: { min: -24, max: w + 24 },
            y: -24,
            lifespan: { min: 5000, max: 8500 },
            speedY: { min: 40, max: 85 },
            speedX: { min: -45, max: 45 },
            scale: { min: 0.5, max: 0.95 },
            alpha: { start: 0.8, end: 0.2 },
            rotate: { start: 0, end: 360 },
            tint: [0x7bbf8a, 0x4f9e68, 0xa8d98f, 0xc8b26a],
            frequency: 220,
            quantity: 1,
          },
        };

      case "snow":
        return {
          texture: FX.snow,
          config: {
            emitting: false,
            x: { min: -24, max: w + 24 },
            y: -20,
            lifespan: { min: 5200, max: 8200 },
            speedY: { min: 38, max: 80 },
            speedX: { min: -22, max: 22 },
            scale: { min: 0.35, max: 0.9 },
            alpha: { start: 0.9, end: 0.4 },
            rotate: { min: 0, max: 360 },
            frequency: 130,
            quantity: 1,
          },
        };

      // Driven rain: fast, oblique, and rotated to lie along its own velocity.
      case "rain":
        return {
          texture: FX.rain,
          config: {
            emitting: false,
            x: { min: -80, max: w + 40 },
            y: -30,
            lifespan: { min: 900, max: 1400 },
            speedY: { min: 640, max: 860 },
            speedX: { min: -190, max: -140 },
            scale: { min: 0.7, max: 1.15 },
            alpha: { start: 0.55, end: 0.25 },
            rotate: -12,
            frequency: 26,
            quantity: 2,
          },
        };

      // Not falling weather: a field of spirit lights blinking in and out.
      case "star":
        return {
          texture: FX.star,
          config: {
            emitting: false,
            x: { min: 0, max: w },
            y: { min: 0, max: h },
            lifespan: { min: 1400, max: 2900 },
            speedY: { min: -8, max: 8 },
            speedX: { min: -8, max: 8 },
            scale: { start: 0.75, end: 0.15 },
            alpha: { start: 0.95, end: 0 },
            tint: [0xffffff, 0xc77dff, 0x5ee7ff, 0xffe9a8],
            blendMode: "ADD",
            frequency: 90,
            quantity: 1,
          },
        };

      // Updraft from the burning cloud sea below.
      case "ember":
        return {
          texture: FX.ember,
          config: {
            emitting: false,
            x: { min: -24, max: w + 24 },
            y: h + 20,
            lifespan: { min: 2600, max: 4800 },
            speedY: { min: -140, max: -60 },
            speedX: { min: -30, max: 30 },
            scale: { start: 0.9, end: 0.1 },
            alpha: { start: 0.95, end: 0 },
            rotate: { min: 0, max: 360 },
            blendMode: "ADD",
            frequency: 100,
            quantity: 1,
          },
        };
    }
  }

  destroy(): void {
    for (let i = 0; i < this.setA.length; i++) this.setA[i].destroy();
    for (let i = 0; i < this.setB.length; i++) this.setB[i].destroy();
    for (let i = 0; i < this.weather.length; i++) this.weather[i].destroy();
    this.setA = [];
    this.setB = [];
    this.weather = [];

    this.sky?.destroy();
    this.haze?.destroy();
    this.vignette?.destroy();
  }
}
