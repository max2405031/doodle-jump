import { Scene } from "phaser";

import {
  PLATFORM_KEYS,
  PLAT_H,
  PLAT_W,
  platCrackedKey,
  platKey,
  type PlatformKind,
} from "../art/keys";
import {
  BAMBOO_SPEED,
  CULL_MARGIN,
  FRAGILE_KINDS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GAP_MAX_EASY,
  GAP_MAX_HARD,
  GAP_MIN_EASY,
  GAP_MIN_HARD,
  KUMO_DISSOLVE_DELAY,
  PLATFORM_BODY_H,
  PLATFORM_BODY_W,
  PLATFORM_EDGE_MARGIN,
  PLATFORM_LOOKAHEAD,
  PLATFORM_MAX_DX,
  PLATFORM_UNLOCK,
  PLATFORM_WEIGHTS,
  PLAYER_START_Y,
  difficultyAt,
  ramp,
} from "../config/constants";
import { DEPTH } from "../config/theme";

/** Which platforms can shatter into a cracked variant. */
const CRACKABLE: PlatformKind[] = ["toro", "glace", "cursed"];

/**
 * A fixed generation recipe for a campaign level: no score ramp, no altitude
 * unlocks — just this gap band and this weighting, all the way up.
 */
export interface PlatformPlan {
  gapMin: number;
  gapMax: number;
  weights: Partial<Record<PlatformKind, number>>;
}

export interface PlatformOpts {
  /** Campaign recipe. Omitted → the endless score-driven curve. */
  plan?: PlatformPlan;
  /** False for authored levels, where every platform is placed by hand. */
  generate?: boolean;
}

export interface PlatformData {
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: PlatformKind;
  /** Horizontal direction for bamboo. */
  dir: number;
  /** Already spent — it no longer bounces anyone. */
  broken: boolean;
  timer?: Phaser.Time.TimerEvent;
}

/** What a bounce off a platform actually did, so the scene can score and sing it. */
export interface BounceResult {
  kind: PlatformKind;
  /** Velocity to hand to the player. */
  force: number;
  /** True for the lotus — worth a different sound and a bigger pop. */
  boosted: boolean;
  /** The platform is now dying under the player's feet. */
  breaking: boolean;
}

/** A platform the manager has just created, offered up for decoration. */
export interface PlatformSpawn {
  x: number;
  y: number;
  kind: PlatformKind;
  /** Solid enough to safely carry a coin or a power-up. */
  solid: boolean;
}

/**
 * The endless ladder.
 *
 * Generation walks upward from the highest platform, so gaps are exact rather
 * than emergent — the old build scattered platforms at random heights and could
 * produce a jump the player physically could not make.
 */
export class PlatformManager {
  private scene: Scene;
  private group: Phaser.Physics.Arcade.StaticGroup;
  private data = new Map<Phaser.GameObjects.GameObject, PlatformData>();

  private highestY = 0;
  private lastX = GAME_WIDTH / 2;
  private lastKind: PlatformKind = "toro";

  private plan?: PlatformPlan;
  private generate: boolean;

  constructor(scene: Scene, opts: PlatformOpts = {}) {
    this.scene = scene;
    this.group = scene.physics.add.staticGroup();
    this.plan = opts.plan;
    this.generate = opts.generate ?? true;
  }

  getGroup(): Phaser.Physics.Arcade.StaticGroup {
    return this.group;
  }

  getData(sprite: Phaser.GameObjects.GameObject): PlatformData | undefined {
    return this.data.get(sprite);
  }

  /**
   * A single row of solid ground at the bottom of the world. Both the endless
   * opening and every authored level stand on it. Returns the ground's y.
   */
  spawnGround(): number {
    const groundY = GAME_HEIGHT - 26;

    // The ground is a row of overlapping stone slabs rather than one stretched
    // sprite — stretching a 92px texture across 500px smears the whole detail.
    const step = PLAT_W - 8;
    for (let x = step / 2 - 6; x < GAME_WIDTH + step; x += step) {
      this.create(x, groundY, "toro");
    }

    this.highestY = groundY;
    this.lastX = GAME_WIDTH / 2;
    this.lastKind = "toro";
    return groundY;
  }

  /** Ground + a short, gentle staircase, all solid: the first seconds must be safe. */
  spawnInitial(): void {
    let y = this.spawnGround();
    while (y > -PLATFORM_LOOKAHEAD) {
      y -= Phaser.Math.Between(78, 108);
      const x = this.pickX();
      this.create(x, y, "toro");
      this.lastX = x;
      this.highestY = y;
    }
  }

  /** Drops one authored platform at a world coordinate (custom levels). */
  placePlatform(x: number, y: number, kind: PlatformKind): void {
    this.create(x, y, kind);
    if (y < this.highestY) this.highestY = y;
  }

  /**
   * Generates whatever is missing above the view and culls what has fallen out
   * of it. Returns the platforms created this frame so the scene can hang coins,
   * power-ups and yokai off them.
   */
  update(cameraY: number, delta: number, score: number): PlatformSpawn[] {
    const spawned: PlatformSpawn[] = [];

    if (this.generate) {
      const t = difficultyAt(score);
      const gapLo = this.plan ? this.plan.gapMin : ramp(GAP_MIN_EASY, GAP_MIN_HARD, t);
      const gapHi = this.plan ? this.plan.gapMax : ramp(GAP_MAX_EASY, GAP_MAX_HARD, t);

      while (this.highestY > cameraY - PLATFORM_LOOKAHEAD) {
        const gap = Phaser.Math.Between(Math.round(gapLo), Math.round(gapHi));
        const y = this.highestY - gap;
        const x = this.pickX();
        const kind = this.pickKind(t, score);

        this.create(x, y, kind);
        this.highestY = y;
        this.lastX = x;
        this.lastKind = kind;

        spawned.push({ x, y, kind, solid: !FRAGILE_KINDS.includes(kind) });
      }
    }

    this.moveBamboo(delta);
    this.cull(cameraY);

    return spawned;
  }

  /**
   * Called when the player lands. Decides the bounce and starts whatever the
   * platform does next — shatter, dissolve, or simply hold.
   */
  bounce(sprite: Phaser.GameObjects.GameObject, jumpForce: number, lotusMultiplier: number): BounceResult | undefined {
    const data = this.data.get(sprite);
    if (!data || data.broken) return undefined;

    const kind = data.kind;
    let force = jumpForce;
    let boosted = false;
    let breaking = false;

    if (kind === "lotus") {
      force = jumpForce * lotusMultiplier;
      boosted = true;
      this.scene.tweens.add({
        targets: data.sprite,
        scaleY: data.sprite.scaleY * 0.6,
        duration: 90,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    } else if (kind === "glace" || kind === "cursed") {
      breaking = true;
      this.shatter(data);
    } else if (kind === "kumo") {
      breaking = true;
      data.broken = true;
      data.timer = this.scene.time.delayedCall(KUMO_DISSOLVE_DELAY, () => this.dissolve(data));
    } else {
      this.scene.tweens.add({
        targets: data.sprite,
        scaleY: data.sprite.scaleY * 0.82,
        duration: 70,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    }

    return { kind, force, boosted, breaking };
  }

  /** Emergency platform conjured under a player who just lost a life mid-fall. */
  spawnRescue(x: number, y: number): void {
    const clamped = Phaser.Math.Clamp(
      x,
      PLATFORM_EDGE_MARGIN + PLAT_W / 2,
      GAME_WIDTH - PLATFORM_EDGE_MARGIN - PLAT_W / 2
    );
    const sprite = this.create(clamped, y, "toro");
    sprite.setAlpha(0);
    this.scene.tweens.add({ targets: sprite, alpha: 1, duration: 220 });
  }

  destroy(): void {
    this.data.forEach((d) => d.timer?.remove(false));
    this.data.clear();
    this.group.clear(true, true);
  }

  /* ----------------------------------------------------------- generation */

  private pickX(): number {
    const min = PLATFORM_EDGE_MARGIN + PLAT_W / 2;
    const max = GAME_WIDTH - PLATFORM_EDGE_MARGIN - PLAT_W / 2;
    // Keep the next platform inside horizontal reach of the last one: a perfect
    // vertical gap is still unplayable if it sits on the far side of the screen.
    const lo = Math.max(min, this.lastX - PLATFORM_MAX_DX);
    const hi = Math.min(max, this.lastX + PLATFORM_MAX_DX);
    return Phaser.Math.Between(Math.round(lo), Math.round(hi));
  }

  private pickKind(t: number, score: number): PlatformKind {
    // Two disappearing platforms back to back is a guaranteed death, not a
    // challenge. After a fragile one, the next is always solid ground.
    const forceSolid = FRAGILE_KINDS.includes(this.lastKind);

    const pool: Array<[PlatformKind, number]> = [];
    let total = 0;
    for (const kind of PLATFORM_KEYS) {
      if (forceSolid && FRAGILE_KINDS.includes(kind)) continue;

      let weight: number;
      if (this.plan) {
        // Fixed campaign recipe: the weight table is the whole story.
        weight = this.plan.weights[kind] ?? 0;
      } else {
        if (score < PLATFORM_UNLOCK[kind]) continue;
        const [easy, hard] = PLATFORM_WEIGHTS[kind];
        weight = ramp(easy, hard, t);
      }
      if (weight <= 0) continue;
      pool.push([kind, weight]);
      total += weight;
    }
    if (pool.length === 0) return "toro";

    let roll = Math.random() * total;
    for (const [kind, weight] of pool) {
      roll -= weight;
      if (roll <= 0) return kind;
    }
    return pool[pool.length - 1][0];
  }

  private create(x: number, y: number, kind: PlatformKind): Phaser.Physics.Arcade.Sprite {
    const sprite = this.group.create(x, y, platKey(kind)) as Phaser.Physics.Arcade.Sprite;
    sprite.setDisplaySize(PLAT_W, PLAT_H);
    sprite.setDepth(DEPTH.platform);
    sprite.refreshBody();

    // Static bodies are sized in world pixels. Trim the art's shadow margin so
    // the player lands where the stone actually is.
    const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
    const bodyW = PLAT_W;
    const bodyH = PLAT_H * 0.4; // Only the top face is solid
    body.setSize(bodyW, bodyH, false).setOffset(0, 2);
    body.updateFromGameObject();
    body.checkCollision.left = false;
    body.checkCollision.right = false;
    body.checkCollision.down = false; // Allow passing through from below
    body.checkCollision.up = true; // Only collide from top

    const data: PlatformData = {
      sprite,
      kind,
      dir: Math.random() < 0.5 ? -1 : 1,
      broken: false,
    };

    if (kind === "kumo") {
      sprite.setAlpha(0.85);
      this.scene.tweens.add({
        targets: sprite,
        alpha: { from: 0.85, to: 0.6 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    if (kind === "lotus") {
      // A slow breath, so the trampoline reads as stored energy.
      this.scene.tweens.add({
        targets: sprite,
        scaleX: sprite.scaleX * 1.05,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    if (kind === "cursed") {
      this.scene.tweens.add({
        targets: sprite,
        alpha: { from: 1, to: 0.78 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    this.data.set(sprite, data);
    return sprite;
  }

  /* -------------------------------------------------------------- destroy */

  private shatter(data: PlatformData): void {
    if (data.broken) return;
    data.broken = true;

    const sprite = data.sprite;
    if (CRACKABLE.includes(data.kind)) {
      sprite.setTexture(platCrackedKey(data.kind));
      sprite.setDisplaySize(PLAT_W, PLAT_H);
    }
    (sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;

    this.scene.tweens.add({
      targets: sprite,
      y: sprite.y + 90,
      alpha: 0,
      angle: Phaser.Math.Between(-14, 14),
      duration: 420,
      ease: "Quad.easeIn",
      onComplete: () => this.remove(data),
    });
  }

  private dissolve(data: PlatformData): void {
    const sprite = data.sprite;
    if (!sprite.active) return;
    (sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.scene.tweens.add({
      targets: sprite,
      alpha: 0,
      scaleX: sprite.scaleX * 1.3,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => this.remove(data),
    });
  }

  private remove(data: PlatformData): void {
    data.timer?.remove(false);
    this.data.delete(data.sprite);
    data.sprite.destroy();
  }

  /* --------------------------------------------------------------- update */

  private moveBamboo(delta: number): void {
    const dt = delta / 1000;
    this.data.forEach((data) => {
      if (data.kind !== "bamboo" || data.broken) return;
      const sprite = data.sprite;
      sprite.x += BAMBOO_SPEED * data.dir * dt;

      const min = PLAT_W / 2 + 8;
      const max = GAME_WIDTH - PLAT_W / 2 - 8;
      if (sprite.x <= min) {
        sprite.x = min;
        data.dir = 1;
      } else if (sprite.x >= max) {
        sprite.x = max;
        data.dir = -1;
      }
      (sprite.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
      // updateFromGameObject resets the body to the display box, so the trimmed
      // size has to be reapplied every step.
      (sprite.body as Phaser.Physics.Arcade.StaticBody).setSize(
        PLAT_W * PLATFORM_BODY_W,
        PLAT_H * PLATFORM_BODY_H
      );
    });
  }

  private cull(cameraY: number): void {
    const limit = cameraY + GAME_HEIGHT + CULL_MARGIN;
    const dead: PlatformData[] = [];
    this.data.forEach((data) => {
      if (data.sprite.y > limit) dead.push(data);
    });
    dead.forEach((data) => {
      this.scene.tweens.killTweensOf(data.sprite);
      this.remove(data);
    });
  }

  /** Height of the highest platform generated so far — the ceiling of the world. */
  get ceiling(): number {
    return this.highestY;
  }

  /** Where the first platform of a fresh run sits. */
  static get startY(): number {
    return PLAYER_START_Y;
  }
}
