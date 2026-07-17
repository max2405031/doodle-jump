import { Scene } from "phaser";

import {
  FALL_GRAVITY_MULT,
  GAME_WIDTH,
  GRAVITY,
  JUMP_FORCE,
  ONIBI_DURATION,
  ONIBI_VELOCITY,
  PLAYER_SPEED,
  PLAYER_START_X,
  PLAYER_START_Y,
} from "../config/constants";
import { CHAR_FRAME, CHAR_H, CHAR_W, charKey, FX } from "../art/keys";
import { charAnim } from "../art/characters";
import { equippedSkin, getSkin } from "../config/skins";
import { DEPTH } from "../config/theme";

/** Contact-bounce lockout: land (max squash) then crouch (anticipation) before rise takes over. */
const BOUNCE_DURATION_MS = 130;
const BOUNCE_LAND_MS = 50;
const LAND_SQUASH_W = 1.15;
const LAND_SQUASH_H = 0.8;
const CROUCH_SQUASH_W = 1.05;
const CROUCH_SQUASH_H = 0.93;

/** Apex float: a slow ping-pong sway through three baked-tilt frames. */
const HOVER_FRAME_MS = 125;
const HOVER_FRAMES = [CHAR_FRAME.hoverA, CHAR_FRAME.hoverB, CHAR_FRAME.hoverC, CHAR_FRAME.hoverB];

/** Idle-loop eye blink: a brief interrupt on a random cadence. */
const BLINK_MIN_MS = 2500;
const BLINK_MAX_MS = 5500;
const BLINK_HOLD_MIN_MS = 100;
const BLINK_HOLD_MAX_MS = 120;

/** Onibi launch: one 360 spin, native sprite rotation rather than baked frames. */
const FLIP_DURATION_MS = 450;

/**
 * The player.
 *
 * The sprite comes from whichever skin the shop has equipped. The old build
 * always drew one hardcoded "player" texture, so buying a skin changed nothing.
 */
export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;

  private scene: Scene;
  private skinId: string;
  private isInvincible = false;
  private hasKatana = false;
  private hasKoiNobori = false;
  private hasShield = false;
  private hurtUntil = 0;
  private bounceUntil = 0;
  private eyeBlinkUntil = 0;
  private isFlipping = false;
  private koiTimer?: Phaser.Time.TimerEvent;
  private katanaTimer?: Phaser.Time.TimerEvent;
  private invincibleTimer?: Phaser.Time.TimerEvent;
  private blinkTween?: Phaser.Tweens.Tween;
  private eyeBlinkTimer?: Phaser.Time.TimerEvent;
  private flipTween?: Phaser.Tweens.Tween;
  private flipTrailTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Scene) {
    this.scene = scene;

    const skin = equippedSkin();
    this.skinId = skin.id;

    this.sprite = scene.physics.add.sprite(PLAYER_START_X, PLAYER_START_Y, charKey(skin.id));
    this.sprite.setDisplaySize(CHAR_W, CHAR_H);
    this.sprite.setCollideWorldBounds(false);
    this.sprite.setDepth(DEPTH.player);
    this.sprite.play(charAnim(skin.id));

    // The art carries glow margin; the body must not, or the player collides
    // with platforms they visibly never touched.
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(CHAR_W * 0.52, CHAR_H * 0.72);
    body.setOffset(CHAR_W * 0.24, CHAR_H * 0.24);
    body.setMaxVelocityY(900);
    body.setVelocityY(JUMP_FORCE);

    this.setTemporaryInvincible(1500);
    this.scheduleEyeBlink();
  }

  update(isLeft: boolean, isRight: boolean): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    // Accelerate toward the target instead of snapping to it — binary velocity
    // is what made the old controls feel like dragging a cursor.
    const target = isLeft ? -PLAYER_SPEED : isRight ? PLAYER_SPEED : 0;
    if (target === 0) {
      body.setVelocityX(body.velocity.x * 0.82);
    } else {
      body.setVelocityX(body.velocity.x + (target - body.velocity.x) * 0.28);
    }

    // Asymmetric gravity: rise floaty, fall committed.
    body.setGravityY(body.velocity.y > 0 ? GRAVITY * FALL_GRAVITY_MULT - GRAVITY : 0);

    this.updatePose();
    this.wrapHorizontal();
  }

  /**
   * Squash-and-stretch plus the rise/fall/hover/bounce frames.
   *
   * Lockout priority: hurt > flip > bounce (land->crouch) > rise/fall (vy
   * thresholds) > hover > idle/idleAlt+blink. hurt and flip each own the
   * sprite's frame exclusively while active — hurt wins over flip because
   * showHurt() cancels any in-progress flip outright, not because of the
   * branch order below. Every other tier is just an ordered if/else since
   * none of them holds an external tween on the sprite.
   */
  private updatePose(): void {
    if (this.isFlipping) return;

    const now = this.scene.time.now;
    if (now < this.hurtUntil) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const vy = body.velocity.y;

    if (now < this.bounceUntil) {
      const elapsed = BOUNCE_DURATION_MS - (this.bounceUntil - now);
      this.sprite.anims.stop();
      if (elapsed < BOUNCE_LAND_MS) {
        this.sprite.setFrame(CHAR_FRAME.land);
        this.sprite.setDisplaySize(CHAR_W * LAND_SQUASH_W, CHAR_H * LAND_SQUASH_H);
      } else {
        this.sprite.setFrame(CHAR_FRAME.crouch);
        this.sprite.setDisplaySize(CHAR_W * CROUCH_SQUASH_W, CHAR_H * CROUCH_SQUASH_H);
      }
    } else if (vy < -80) {
      this.sprite.anims.stop();
      this.sprite.setFrame(CHAR_FRAME.rise);
      const stretch = Math.min(0.16, Math.abs(vy) / 6000);
      this.sprite.setDisplaySize(CHAR_W * (1 - stretch), CHAR_H * (1 + stretch));
    } else if (vy > 120) {
      this.sprite.anims.stop();
      this.sprite.setFrame(CHAR_FRAME.fall);
      const squash = Math.min(0.14, vy / 7000);
      this.sprite.setDisplaySize(CHAR_W * (1 + squash), CHAR_H * (1 - squash));
    } else if (Math.abs(vy) <= 80) {
      this.sprite.anims.stop();
      const hoverFrame = HOVER_FRAMES[Math.floor(now / HOVER_FRAME_MS) % HOVER_FRAMES.length];
      this.sprite.setFrame(hoverFrame);
      this.sprite.setDisplaySize(CHAR_W, CHAR_H);
    } else if (now < this.eyeBlinkUntil) {
      this.sprite.anims.stop();
      this.sprite.setFrame(CHAR_FRAME.blink);
      this.sprite.setDisplaySize(CHAR_W, CHAR_H);
    } else {
      if (!this.sprite.anims.isPlaying) this.sprite.play(charAnim(this.skinId));
      this.sprite.setDisplaySize(CHAR_W, CHAR_H);
    }

    this.sprite.setFlipX(body.velocity.x < -20);
  }

  private scheduleEyeBlink(): void {
    const delay = Phaser.Math.Between(BLINK_MIN_MS, BLINK_MAX_MS);
    this.eyeBlinkTimer = this.scene.time.delayedCall(delay, () => {
      this.eyeBlinkUntil = this.scene.time.now + Phaser.Math.Between(BLINK_HOLD_MIN_MS, BLINK_HOLD_MAX_MS);
      this.scheduleEyeBlink();
    });
  }

  autoJump(force?: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const jump = force ?? JUMP_FORCE;
    body.setVelocityY(this.hasKoiNobori ? jump * 1.3 : jump);
  }

  /** Hold the hurt frame for a beat; updatePose treats it as a lockout. */
  showHurt(duration = 500): void {
    this.cancelFlip();
    this.hurtUntil = this.scene.time.now + duration;
    this.sprite.anims.stop();
    this.sprite.setFrame(CHAR_FRAME.hurt);
    this.sprite.setDisplaySize(CHAR_W, CHAR_H);
  }

  /**
   * Hold land->crouch for a beat after a contact bounce (platform, stomp,
   * shield). Callers must invoke this alongside autoJump(), never in place of
   * it or delaying it — only the display is allowed to lag. A no-op on the
   * immediate frame if a flip is in progress: flip outranks bounce, so the
   * timestamp is recorded but the visual stays untouched.
   */
  showBounce(): void {
    this.bounceUntil = this.scene.time.now + BOUNCE_DURATION_MS;
    if (this.isFlipping) return;
    this.sprite.anims.stop();
    this.sprite.setFrame(CHAR_FRAME.land);
    this.sprite.setDisplaySize(CHAR_W * LAND_SQUASH_W, CHAR_H * LAND_SQUASH_H);
  }

  private wrapHorizontal(): void {
    if (this.sprite.x < 0) this.sprite.x = GAME_WIDTH;
    else if (this.sprite.x > GAME_WIDTH) this.sprite.x = 0;
  }

  setTemporaryInvincible(duration: number): void {
    this.isInvincible = true;
    this.invincibleTimer?.remove(false);
    this.blinkTween?.stop();

    this.blinkTween = this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 1, to: 0.35 },
      duration: 110,
      yoyo: true,
      repeat: -1,
    });

    this.invincibleTimer = this.scene.time.delayedCall(duration, () => {
      this.isInvincible = false;
      this.blinkTween?.stop();
      this.blinkTween = undefined;
      this.sprite.setAlpha(1);
    });
  }

  activateKatana(): void {
    this.hasKatana = true;
    this.isInvincible = true;
    this.sprite.setTint(0x8ff0ff);
    this.katanaTimer?.remove(false);
    this.katanaTimer = this.scene.time.delayedCall(5000, () => {
      this.hasKatana = false;
      this.isInvincible = false;
      this.sprite.clearTint();
    });
  }

  activateKoiNobori(): void {
    this.hasKoiNobori = true;
    this.sprite.setTint(0xff9ec4);
    this.autoJump(JUMP_FORCE * 1.5);
    this.koiTimer?.remove(false);
    this.koiTimer = this.scene.time.delayedCall(4000, () => {
      this.hasKoiNobori = false;
      if (!this.hasKatana) this.sprite.clearTint();
    });
  }

  activateDaruma(): void {
    this.setTemporaryInvincible(3000);
    this.sprite.setTint(0xff5a3c);
    this.scene.time.delayedCall(3000, () => {
      if (!this.hasKatana && !this.hasKoiNobori && !this.hasShield) this.sprite.clearTint();
    });
  }

  /** Omamori charm: a one-hit shield that survives until it takes a blow. */
  activateOmamori(): void {
    this.hasShield = true;
    this.sprite.setTint(0x9be7ff);
  }

  /** Spends the shield on a hit that would otherwise cost a life. */
  consumeShield(): boolean {
    if (!this.hasShield) return false;
    this.hasShield = false;
    if (!this.hasKatana && !this.hasKoiNobori) this.sprite.clearTint();
    this.setTemporaryInvincible(900);
    return true;
  }

  /** Onibi wisp: a hard rocket launch straight up, invulnerable while it burns. */
  activateOnibi(): void {
    this.autoJump(ONIBI_VELOCITY);
    this.setTemporaryInvincible(ONIBI_DURATION);
    this.playFlip();
  }

  /** One 360 spin on launch: a fixed "ball" pose, rotated via a native sprite tween. */
  private playFlip(): void {
    this.cancelFlip();
    this.isFlipping = true;
    this.sprite.anims.stop();
    this.sprite.setFrame(CHAR_FRAME.flip);
    this.sprite.setDisplaySize(CHAR_W, CHAR_H);
    this.sprite.rotation = 0;

    const aura = getSkin(this.skinId).palette.aura;
    this.startFlipTrail(aura);

    this.flipTween = this.scene.tweens.add({
      targets: this.sprite,
      rotation: Math.PI * 2,
      duration: FLIP_DURATION_MS,
      ease: "Cubic.easeOut",
      onComplete: () => {
        this.sprite.rotation = 0;
        this.isFlipping = false;
        this.flipTween = undefined;
        this.stopFlipTrail();
        this.burstFlipStars(aura);
      },
    });
  }

  /** Cancels an in-progress flip outright — used when hurt must pre-empt it. */
  private cancelFlip(): void {
    if (this.flipTween) {
      this.flipTween.stop();
      this.flipTween = undefined;
    }
    this.stopFlipTrail();
    if (this.isFlipping) {
      this.isFlipping = false;
      this.sprite.rotation = 0;
    }
  }

  private startFlipTrail(tint: number): void {
    this.flipTrailTimer = this.scene.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        const emitter = this.scene.add.particles(this.sprite.x, this.sprite.y, FX.spark, {
          speed: { min: 15, max: 45 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.6, end: 0 },
          alpha: { start: 0.75, end: 0 },
          lifespan: 240,
          quantity: 2,
          maxParticles: 2,
          tint,
        });
        emitter.setDepth(DEPTH.fx);
        this.scene.time.delayedCall(260, () => emitter.destroy());
      },
    });
  }

  private stopFlipTrail(): void {
    this.flipTrailTimer?.remove(false);
    this.flipTrailTimer = undefined;
  }

  private burstFlipStars(tint: number): void {
    const emitter = this.scene.add.particles(this.sprite.x, this.sprite.y, FX.star, {
      speed: { min: 60, max: 160 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 380,
      quantity: 10,
      maxParticles: 10,
      tint,
    });
    emitter.setDepth(DEPTH.fx);
    this.scene.time.delayedCall(420, () => emitter.destroy());
  }

  get isFalling(): boolean {
    return (this.sprite.body as Phaser.Physics.Arcade.Body).velocity.y > 0;
  }

  getInvincible(): boolean {
    return this.isInvincible;
  }

  getHasKatana(): boolean {
    return this.hasKatana;
  }

  getHasShield(): boolean {
    return this.hasShield;
  }

  destroy(): void {
    this.katanaTimer?.remove(false);
    this.koiTimer?.remove(false);
    this.invincibleTimer?.remove(false);
    this.blinkTween?.stop();
    this.eyeBlinkTimer?.remove(false);
    this.flipTween?.stop();
    this.flipTrailTimer?.remove(false);
    this.sprite.destroy();
  }
}
