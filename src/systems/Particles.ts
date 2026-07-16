import { Scene } from "phaser";

import { FX } from "../art/keys";
import { DEPTH } from "../config/theme";

/** One-shot burst emitters plus the ambient weather layer. */
export class ParticleManager {
  private scene: Scene;
  private ambient?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  createSakura(): void {
    this.ambient = this.scene.add.particles(0, 0, FX.sakura, {
      x: { min: 0, max: this.scene.scale.width },
      y: -12,
      lifespan: { min: 5000, max: 9000 },
      speedY: { min: 18, max: 48 },
      speedX: { min: -22, max: 22 },
      scale: { start: 0.9, end: 0.4 },
      alpha: { start: 0.75, end: 0 },
      rotate: { min: 0, max: 360 },
      frequency: 380,
      quantity: 1,
    });
    this.ambient.setDepth(DEPTH.weather);
    this.ambient.setScrollFactor(0);
  }

  /** Fire-and-forget burst that cleans itself up. */
  private burst(
    x: number,
    y: number,
    texture: string,
    config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
    ttl: number
  ): void {
    const emitter = this.scene.add.particles(x, y, texture, config);
    emitter.setDepth(DEPTH.fx);
    this.scene.time.delayedCall(ttl, () => emitter.destroy());
  }

  emitJump(x: number, y: number): void {
    this.burst(
      x,
      y,
      FX.jump,
      {
        speed: { min: 40, max: 110 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.9, end: 0 },
        lifespan: 380,
        quantity: 6,
        maxParticles: 6,
      },
      500
    );
    this.burst(
      x,
      y,
      FX.dust,
      {
        speed: { min: 20, max: 60 },
        angle: { min: 160, max: 380 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 420,
        quantity: 4,
        maxParticles: 4,
      },
      550
    );
  }

  emitBreak(x: number, y: number): void {
    this.burst(
      x,
      y,
      FX.break,
      {
        speed: { min: 60, max: 150 },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0.3 },
        rotate: { min: 0, max: 360 },
        lifespan: 620,
        quantity: 10,
        maxParticles: 10,
        gravityY: 320,
      },
      750
    );
  }

  emitEnemyDeath(x: number, y: number): void {
    this.burst(
      x,
      y,
      FX.death,
      {
        speed: { min: 70, max: 200 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.2, end: 0 },
        lifespan: 520,
        quantity: 12,
        maxParticles: 12,
      },
      650
    );
    this.burst(
      x,
      y,
      FX.smoke,
      {
        speed: { min: 20, max: 70 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.6, end: 1.4 },
        alpha: { start: 0.55, end: 0 },
        lifespan: 700,
        quantity: 6,
        maxParticles: 6,
      },
      850
    );
  }

  emitCoinCollect(x: number, y: number): void {
    this.burst(
      x,
      y,
      FX.coin,
      {
        speed: { min: 50, max: 130 },
        angle: { min: 200, max: 340 },
        scale: { start: 1, end: 0 },
        rotate: { min: -60, max: 60 },
        lifespan: 450,
        quantity: 7,
        maxParticles: 7,
      },
      600
    );
  }

  emitStomp(x: number, y: number): void {
    this.burst(
      x,
      y,
      FX.shockwave,
      {
        scale: { start: 0.2, end: 1.6 },
        alpha: { start: 0.9, end: 0 },
        lifespan: 320,
        quantity: 1,
        maxParticles: 1,
      },
      420
    );
    this.burst(
      x,
      y,
      FX.spark,
      {
        speed: { min: 80, max: 190 },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0 },
        lifespan: 300,
        quantity: 10,
        maxParticles: 10,
      },
      420
    );
  }

  destroy(): void {
    this.ambient?.destroy();
    this.ambient = undefined;
  }
}
