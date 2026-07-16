import { Scene } from "phaser";

import { UI } from "../art/keys";
import { CSS, DEPTH, FONT, PALETTE, TEXT } from "../config/theme";
import { loadCoins } from "../config/wallet";
import { makeButton } from "./UIKit";

export type HudMode = "infinite" | "level";

export interface HudOpts {
  mode: HudMode;
  lives: number;
  /** Level display name (level modes). */
  title?: string;
  /** Climb target in px (level modes) — drives the progress bar. */
  goal?: number;
  /** Callback for when the pause button is pressed */
  onPause?: () => void;
}

/**
 * The in-run overlay.
 *
 * Design-system typography, hearts, a combo pill, a power-up timer and — in the
 * level modes — a title and a goal bar. Everything is pinned to the camera and
 * drawn on the HUD depth band, well above the world.
 */
export class HUD {
  private scene: Scene;
  private mode: HudMode = "infinite";

  private score = 0;
  private sessionCoins = 0;
  private lives = 0;

  private scoreText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  private hearts: Phaser.GameObjects.Image[] = [];

  private comboPill!: Phaser.GameObjects.Container;
  private comboLabel!: Phaser.GameObjects.Text;

  private titleText?: Phaser.GameObjects.Text;
  private barBg?: Phaser.GameObjects.Rectangle;
  private barFill?: Phaser.GameObjects.Rectangle;
  private barW = 300;

  private puPill!: Phaser.GameObjects.Container;
  private puLabel!: Phaser.GameObjects.Text;
  private puFill!: Phaser.GameObjects.Rectangle;
  private puTween?: Phaser.Tweens.Tween;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  create(opts: HudOpts): void {
    const { width } = this.scene.scale;
    this.mode = opts.mode;
    this.lives = opts.lives;

    const topY = this.mode === "level" ? 84 : 40;

    // Center Score Layout
    this.scene.add.text(width / 2, topY - 18, "SCORE", TEXT.label(18, CSS.textFaint)).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.hud);
    
    // Hollow cartouche frame behind the score — thin corner brackets, not a solid ink block.
    this.scene.add.image(width / 2, topY + 12, UI.scoreFrame).setDisplaySize(160, 48).setScrollFactor(0).setDepth(DEPTH.hud - 1);
    
    this.scoreText = this.scene.add
      .text(width / 2, topY + 14, "0", TEXT.score(36))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    // Coins — top-right.
    this.coinIcon = this.scene.add
      .image(width - 80, topY, UI.coinIcon)
      .setDisplaySize(20, 20)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
    this.coinText = this.scene.add
      .text(width - 22, topY, "0 G", { ...TEXT.score(18), color: CSS.white })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
    this.updateCoinDisplay();

    // Lives — top-left.
    this.scene.add.text(26, topY - 15, "LIFE:", TEXT.label(18, CSS.white)).setScrollFactor(0).setDepth(DEPTH.hud);
    this.buildHearts(topY + 12, opts.lives);

    // Level chrome — title + goal bar across the top.
    if (this.mode === "level") this.buildLevelChrome(opts.title ?? "");

    this.buildComboPill(this.mode === "level" ? 132 : 60);
    this.buildPowerUpPill();

    if (opts.onPause) {
      const { height } = this.scene.scale;
      const pauseBtn = makeButton(this.scene, width - 36, height - 36, "II", opts.onPause, {
        width: 48,
        height: 48,
        fontSize: 22,
      });
      pauseBtn.setDepth(DEPTH.hud);
      pauseBtn.setScrollFactor(0);
      pauseBtn.list.forEach(child => (child as any).setScrollFactor?.(0));
    }
  }

  private buildHearts(y: number, count: number): void {
    this.hearts.forEach((h) => h.destroy());
    this.hearts = [];
    
    // Add life count text next to "LIFE: "
    const lifeText = this.scene.add.text(70, y - 27, String(Math.max(0, count)), TEXT.label(18, CSS.white)).setScrollFactor(0).setDepth(DEPTH.hud);
    this.hearts.push(lifeText as unknown as Phaser.GameObjects.Image);

    if (count < 0) {
      // Unlimited lives
      const inf = this.scene.add
        .text(28, y - 2, "∞", { fontFamily: FONT.ui, fontSize: "26px", color: CSS.sakura })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud);
      this.hearts.push(inf as unknown as Phaser.GameObjects.Image);
      return;
    }
    for (let i = 0; i < count; i++) {
      const heart = this.scene.add
        .image(28 + i * 20, y, UI.heart)
        .setDisplaySize(18, 18)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud);
      this.hearts.push(heart);
    }
  }

  private buildLevelChrome(title: string): void {
    const { width } = this.scene.scale;

    this.titleText = this.scene.add
      .text(width / 2, 26, title, TEXT.heading(19))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    this.barBg = this.scene.add
      .rectangle(width / 2, 54, this.barW, 10, PALETTE.surface, 0.9)
      .setStrokeStyle(1, PALETTE.borderHi, 0.8)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
    this.barFill = this.scene.add
      .rectangle(width / 2 - this.barW / 2 + 1, 54, 2, 6, PALETTE.jade)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    // A tiny torii marks the summit at the right end of the bar.
    this.scene.add
      .image(width / 2 + this.barW / 2 + 12, 54, UI.torii)
      .setDisplaySize(22, 18)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
  }

  private buildComboPill(y: number): void {
    const { width } = this.scene.scale;
    this.comboPill = this.scene.add.container(width / 2, y).setScrollFactor(0).setDepth(DEPTH.hud);
    const bg = this.scene.add.image(0, 0, UI.ribbon).setDisplaySize(128, 34).setTint(PALETTE.ember);
    this.comboLabel = this.scene.add
      .text(0, -1, "COMBO ×2", { ...TEXT.button(16), color: CSS.goldGlow })
      .setOrigin(0.5);
    this.comboPill.add([bg, this.comboLabel]);
    this.comboPill.setAlpha(0);
  }

  private buildPowerUpPill(): void {
    const { width, height } = this.scene.scale;
    this.puPill = this.scene.add
      .container(width / 2, height - 30)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
    const bg = this.scene.add.image(0, 0, UI.ribbon).setDisplaySize(180, 30).setTint(PALETTE.cursed);
    this.puLabel = this.scene.add
      .text(0, -6, "", { ...TEXT.button(13), color: CSS.text })
      .setOrigin(0.5);
    this.puFill = this.scene.add.rectangle(-78, 8, 156, 4, PALETTE.spirit).setOrigin(0, 0.5);
    this.puPill.add([bg, this.puLabel, this.puFill]);
    this.puPill.setAlpha(0);
  }

  /** Altitude climbed, in whole units. Only ever climbs. */
  setScore(value: number): void {
    const v = Math.floor(value);
    if (v <= this.score) return;
    this.score = v;
    this.scoreText.setText(v.toLocaleString("en-US"));
    this.scene.tweens.add({ targets: this.scoreText, scale: { from: 1.18, to: 1 }, duration: 110 });
  }

  /** Fraction of the climb to the summit, 0–1 (level modes). */
  setProgress(p: number): void {
    if (!this.barFill) return;
    const clamped = Math.max(0, Math.min(1, p));
    this.barFill.width = Math.max(2, (this.barW - 2) * clamped);
    this.barFill.setFillStyle(clamped > 0.85 ? PALETTE.gold : PALETTE.jade);
  }

  getScore(): number {
    return this.score;
  }

  setLives(count: number): void {
    if (count === this.lives) return;
    this.lives = count;
    const y = (this.mode === "level" ? 84 : 40) + 10;
    this.buildHearts(y, count);
  }

  addCoins(amount: number): void {
    this.sessionCoins += amount;
    this.updateCoinDisplay();
    this.scene.tweens.add({
      targets: [this.coinText, this.coinIcon],
      scale: { from: 1.3, to: 1 },
      duration: 180,
      ease: "Back.easeOut",
    });
  }

  private updateCoinDisplay(): void {
    this.coinText.setText(String(loadCoins() + this.sessionCoins) + " G");
  }

  getSessionCoins(): number {
    return this.sessionCoins;
  }

  /** Multiplier ≥2 shows the pill; 1 hides it. */
  setCombo(mult: number): void {
    if (mult >= 2) {
      this.comboLabel.setText(`COMBO ×${mult}`);
      if (this.comboPill.alpha < 1) {
        this.scene.tweens.add({ targets: this.comboPill, alpha: 1, duration: 140 });
      }
      this.scene.tweens.add({
        targets: this.comboPill,
        scale: { from: 1.15, to: 1 },
        duration: 150,
        ease: "Back.easeOut",
      });
    } else if (this.comboPill.alpha > 0) {
      this.scene.tweens.add({ targets: this.comboPill, alpha: 0, duration: 180 });
    }
  }

  /** Shows the power-up gauge and depletes it over `durationMs`. */
  showPowerUp(label: string, color: number, durationMs: number): void {
    this.puLabel.setText(label);
    (this.puPill.getAt(0) as Phaser.GameObjects.Image).setTint(color);
    this.puFill.setFillStyle(color);
    this.puFill.width = 156;
    this.puPill.setAlpha(1);

    this.puTween?.stop();
    this.puTween = this.scene.tweens.add({
      targets: this.puFill,
      width: 0,
      duration: durationMs,
      ease: "Linear",
      onComplete: () => {
        this.scene.tweens.add({ targets: this.puPill, alpha: 0, duration: 200 });
      },
    });
  }

  destroy(): void {
    this.puTween?.stop();
    this.scoreText?.destroy();
    this.coinText?.destroy();
    this.coinIcon?.destroy();
    this.hearts.forEach((h) => h.destroy());
    this.comboPill?.destroy();
    this.titleText?.destroy();
    this.barBg?.destroy();
    this.barFill?.destroy();
    this.puPill?.destroy();
  }
}
