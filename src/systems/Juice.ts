import { Scene } from "phaser";
import { DEPTH, FONT, PALETTE } from "../config/theme";

/** Scene clock factor during a hitstop. 1 = normal, 0.05 = 20x slower. */
const HITSTOP_CLOCK = 0.05;
const TRAIL_INTERVAL_MS = 42;
const TRAIL_MAX_GHOSTS = 12;

function toCss(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, "0")}`;
}

/**
 * Game feel: screen shake, hitstop, flashes, zoom punch, pop text and motion
 * trails. Every method is a no-op rather than a crash when the scene is gone or
 * the renderer has no post-processing.
 */
export class Juice {
  private scene: Scene;
  private destroyed = false;

  private zoomTween?: Phaser.Tweens.Tween;
  private baseZoom = 1;

  private hitstopHandle?: number;
  private savedClockScale = 1;
  private savedPhysicsScale = 1;

  private trailTarget?: Phaser.GameObjects.Sprite;
  private trailTint: number = PALETTE.white;
  private trailTimer?: Phaser.Time.TimerEvent;
  private ghosts: Phaser.GameObjects.Image[] = [];

  private popped: Phaser.GameObjects.Text[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
    this.baseZoom = scene.cameras.main ? scene.cameras.main.zoom : 1;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  shake(intensity = 0.008, duration = 140): void {
    const cam = this.camera();
    if (!cam) {
      return;
    }
    cam.shake(duration, intensity, true);
  }

  /**
   * Freezes the world for `ms` of *wall clock* time. The scene clock is what we
   * are slowing down, so its own delayedCall would come back 20x late — the
   * restore has to ride on a real timer.
   */
  hitstop(ms = 55): void {
    if (this.destroyed || ms <= 0) {
      return;
    }
    const clock = this.scene.time;
    const world = this.world();

    if (this.hitstopHandle === undefined) {
      this.savedClockScale = clock.timeScale;
      this.savedPhysicsScale = world ? world.timeScale : 1;
    } else {
      window.clearTimeout(this.hitstopHandle);
    }

    clock.timeScale = HITSTOP_CLOCK;
    if (world) {
      // Arcade's timeScale is inverted from the Clock's: 1 = normal, 2 = half
      // speed. Slowing physics means scaling *up*, not down.
      world.timeScale = this.savedPhysicsScale / HITSTOP_CLOCK;
    }

    this.hitstopHandle = window.setTimeout(() => {
      this.hitstopHandle = undefined;
      this.restoreTime();
    }, ms);
  }

  flash(color: number = PALETTE.white, alpha = 0.4, duration = 140): void {
    const cam = this.camera();
    if (!cam) {
      return;
    }
    const rgb = Phaser.Display.Color.IntegerToRGB(color);
    // Flash snapshots `alpha` when it starts, so it has to be set first.
    cam.flashEffect.alpha = Phaser.Math.Clamp(alpha, 0, 1);
    cam.flash(duration, rgb.r, rgb.g, rgb.b, true);
  }

  zoomPunch(amount = 0.05, duration = 220): void {
    const cam = this.camera();
    if (!cam) {
      return;
    }
    if (this.zoomTween) {
      this.zoomTween.stop();
      this.zoomTween = undefined;
      cam.setZoom(this.baseZoom);
    } else {
      this.baseZoom = cam.zoom;
    }
    const base = this.baseZoom;
    this.zoomTween = this.scene.tweens.add({
      targets: cam,
      zoom: base + amount,
      duration: Math.max(1, duration * 0.4),
      ease: "Quad.easeOut",
      yoyo: true,
      onComplete: () => {
        cam.setZoom(base);
        this.zoomTween = undefined;
      },
    });
  }

  /** Brief hue/saturation glitch. Falls back to a soft flash without WebGL. */
  chromaticPulse(): void {
    const cam = this.camera();
    if (!cam) {
      return;
    }
    if (!this.supportsFX() || !cam.postFX) {
      this.flash(PALETTE.spirit, 0.16, 90);
      return;
    }

    const matrix = cam.postFX.addColorMatrix();
    const state = { t: 0 };
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: 260,
      ease: "Quad.easeOut",
      onUpdate: () => {
        const k = 1 - state.t;
        matrix.reset();
        matrix.hue(24 * k);
        matrix.saturate(0.7 * k, true);
      },
      onComplete: () => {
        // Phaser types declare FX.ColorMatrix as a Display.ColorMatrix rather than
        // an FX.Controller, which is what `remove` wants. It is one at runtime.
        cam.postFX?.remove(matrix as unknown as Phaser.FX.Controller);
      },
    });
  }

  popText(x: number, y: number, text: string, color: number = PALETTE.gold): void {
    if (this.destroyed) {
      return;
    }
    const label = this.scene.add.text(x, y, text, {
      fontFamily: FONT.ui,
      fontSize: "26px",
      color: toCss(color),
      stroke: toCss(PALETTE.void),
      strokeThickness: 5,
      fontStyle: "bold",
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(DEPTH.fx);
    label.setScale(0.35);
    label.setShadow(0, 3, "#000000", 10, false, true);

    this.popped.push(label);

    this.scene.tweens.add({
      targets: label,
      scale: 1.1,
      duration: 150,
      ease: "Back.easeOut",
    });
    this.scene.tweens.add({
      targets: label,
      y: y - 56,
      alpha: 0,
      duration: 620,
      delay: 170,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.forget(this.popped, label);
        label.destroy();
      },
    });
  }

  /** Ghost-image speed trail. Only one target at a time; starting a new one replaces it. */
  trail(target: Phaser.GameObjects.Sprite, tint: number = PALETTE.spirit): void {
    if (this.destroyed) {
      return;
    }
    this.stopTrail();
    this.trailTarget = target;
    this.trailTint = tint;
    this.trailTimer = this.scene.time.addEvent({
      delay: TRAIL_INTERVAL_MS,
      loop: true,
      callback: this.spawnGhost,
      callbackScope: this,
    });
  }

  stopTrail(): void {
    if (this.trailTimer) {
      this.trailTimer.remove(false);
      this.trailTimer = undefined;
    }
    this.trailTarget = undefined;
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;

    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);

    if (this.hitstopHandle !== undefined) {
      window.clearTimeout(this.hitstopHandle);
      this.hitstopHandle = undefined;
    }
    this.restoreTime();

    this.stopTrail();
    for (const ghost of this.ghosts) {
      this.scene.tweens.killTweensOf(ghost);
      ghost.destroy();
    }
    this.ghosts.length = 0;

    for (const label of this.popped) {
      this.scene.tweens.killTweensOf(label);
      label.destroy();
    }
    this.popped.length = 0;

    if (this.zoomTween) {
      this.zoomTween.stop();
      this.zoomTween = undefined;
    }
  }

  private spawnGhost(): void {
    const target = this.trailTarget;
    if (!target || !target.active || !target.visible || this.destroyed) {
      return;
    }
    if (this.ghosts.length >= TRAIL_MAX_GHOSTS) {
      return;
    }

    const ghost = this.scene.add.image(target.x, target.y, target.texture.key, target.frame.name);
    ghost.setOrigin(target.originX, target.originY);
    ghost.setScale(target.scaleX, target.scaleY);
    ghost.setFlip(target.flipX, target.flipY);
    ghost.setRotation(target.rotation);
    ghost.setScrollFactor(target.scrollFactorX, target.scrollFactorY);
    ghost.setDepth(target.depth - 1);
    ghost.setTint(this.trailTint);
    ghost.setBlendMode(Phaser.BlendModes.ADD);
    ghost.setAlpha(0.42);

    this.ghosts.push(ghost);

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: target.scaleX * 0.82,
      scaleY: target.scaleY * 0.82,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.forget(this.ghosts, ghost);
        ghost.destroy();
      },
    });
  }

  private restoreTime(): void {
    this.scene.time.timeScale = this.savedClockScale;
    const world = this.world();
    if (world) {
      world.timeScale = this.savedPhysicsScale;
    }
  }

  private camera(): Phaser.Cameras.Scene2D.Camera | undefined {
    if (this.destroyed || !this.scene.cameras) {
      return undefined;
    }
    return this.scene.cameras.main ?? undefined;
  }

  /** A scene can be booted without Arcade physics — never assume it is there. */
  private world(): Phaser.Physics.Arcade.World | undefined {
    const physics = this.scene.physics as Phaser.Physics.Arcade.ArcadePhysics | undefined;
    return physics?.world;
  }

  private supportsFX(): boolean {
    const renderer = this.scene.renderer as
      | Phaser.Renderer.Canvas.CanvasRenderer
      | Phaser.Renderer.WebGL.WebGLRenderer
      | undefined;
    return !!renderer && renderer.type === Phaser.WEBGL;
  }

  private forget<T>(list: T[], item: T): void {
    const index = list.indexOf(item);
    if (index >= 0) {
      list.splice(index, 1);
    }
  }
}
