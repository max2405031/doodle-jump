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
import { CHAR_FRAME, CHAR_H, CHAR_W, charKey } from "../art/keys";
import { charAnim } from "../art/characters";
import { equippedSkin } from "../config/skins";
import { DEPTH } from "../config/theme";

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
  private koiTimer?: Phaser.Time.TimerEvent;
  private katanaTimer?: Phaser.Time.TimerEvent;
  private invincibleTimer?: Phaser.Time.TimerEvent;
  private blinkTween?: Phaser.Tweens.Tween;

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

  /** Squash-and-stretch plus the rise/fall frames. */
  private updatePose(): void {
    if (this.scene.time.now < this.hurtUntil) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const vy = body.velocity.y;

    if (vy < -80) {
      this.sprite.anims.stop();
      this.sprite.setFrame(CHAR_FRAME.rise);
      const stretch = Math.min(0.16, Math.abs(vy) / 6000);
      this.sprite.setDisplaySize(CHAR_W * (1 - stretch), CHAR_H * (1 + stretch));
    } else if (vy > 120) {
      this.sprite.anims.stop();
      this.sprite.setFrame(CHAR_FRAME.fall);
      const squash = Math.min(0.14, vy / 7000);
      this.sprite.setDisplaySize(CHAR_W * (1 + squash), CHAR_H * (1 - squash));
    } else {
      if (!this.sprite.anims.isPlaying) this.sprite.play(charAnim(this.skinId));
      this.sprite.setDisplaySize(CHAR_W, CHAR_H);
    }

    this.sprite.setFlipX(body.velocity.x < -20);
  }

  autoJump(force?: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const jump = force ?? JUMP_FORCE;
    body.setVelocityY(this.hasKoiNobori ? jump * 1.3 : jump);
  }

  /** Hold the hurt frame for a beat; updatePose treats it as a lockout. */
  showHurt(duration = 500): void {
    this.hurtUntil = this.scene.time.now + duration;
    this.sprite.anims.stop();
    this.sprite.setFrame(CHAR_FRAME.hurt);
    this.sprite.setDisplaySize(CHAR_W, CHAR_H);
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
    this.sprite.destroy();
  }
}
