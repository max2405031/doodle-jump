import { Scene } from "phaser";

import { ENEMY_SIZE, FX, enemyAnim, enemyKey } from "../art/keys";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { CSS, DEPTH, FONT, PALETTE, TEXT } from "../config/theme";
import { AudioManager } from "../systems/Audio";
import { BEST_KEY, loadBest, saveBest, showMiniGameOver } from "./MiniGames";
import { fadeIn, makeButton, makeSceneBackdrop, transitionTo } from "../ui/UIKit";

interface Hole {
  x: number;
  y: number;
  busy: boolean;
  bad: boolean;
  sprite?: Phaser.GameObjects.Sprite;
  timer?: Phaser.Time.TimerEvent;
}

const ROUND_SECONDS = 30;
const STREAK_MAX = 5;

/**
 * Whack-a-Kappa — the tourist kappa surface from their burrows; smack them for
 * points and chain streaks. But the oni is off-limits: hit one and it costs you
 * precious seconds. Real sprites, carved mounds, French, shared result panel.
 */
export class WhackAKappa extends Scene {
  private holes: Hole[] = [];
  private score = 0;
  private streak = 0;
  private timeLeft = ROUND_SECONDS;
  private gameOver = false;

  private scoreText!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private clock?: Phaser.Time.TimerEvent;

  constructor() {
    super("WhackAKappa");
  }

  create(): void {
    this.holes = [];
    this.score = 0;
    this.streak = 0;
    this.timeLeft = ROUND_SECONDS;
    this.gameOver = false;

    makeSceneBackdrop(this, PALETTE.jade);
    this.buildHud();

    const cols = 3;
    const rows = 3;
    const startX = GAME_WIDTH / 2 - 150;
    const startY = 250;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.buildHole(startX + c * 150, startY + r * 150);
      }
    }

    this.spawnTimer = this.time.addEvent({ delay: 780, callback: this.spawn, callbackScope: this, loop: true });
    this.clock = this.time.addEvent({ delay: 1000, callback: this.tick, callbackScope: this, loop: true });

    makeButton(this, 60, GAME_HEIGHT - 34, "RETOUR", () => this.leave(), {
      width: 108,
      height: 40,
      fontSize: 15,
      variant: "ghost",
    }).setDepth(DEPTH.hud);
    this.input.keyboard?.once("keydown-ESC", () => this.leave());

    fadeIn(this);
    this.input.once("pointerdown", () => AudioManager.init());
  }

  private buildHud(): void {
    this.add.text(GAME_WIDTH / 2, 70, "WHACK-A-KAPPA", TEXT.title(30)).setOrigin(0.5).setDepth(DEPTH.hud);

    this.scoreText = this.add.text(24, 116, "0", { ...TEXT.score(30), color: CSS.gold }).setDepth(DEPTH.hud);
    this.streakText = this.add
      .text(24, 152, "", { fontFamily: FONT.ui, fontSize: "16px", color: CSS.ember })
      .setDepth(DEPTH.hud);

    this.timeText = this.add
      .text(GAME_WIDTH - 24, 116, `${this.timeLeft}s`, { ...TEXT.score(30), color: CSS.spirit })
      .setOrigin(1, 0)
      .setDepth(DEPTH.hud);
  }

  private buildHole(x: number, y: number): void {
    const back = this.add.graphics().setDepth(DEPTH.props);
    back.fillStyle(0x3f7a38, 1);
    back.fillEllipse(x, y + 16, 118, 48);
    back.fillStyle(0x2c5a28, 1);
    back.fillEllipse(x, y + 18, 100, 36);
    back.fillStyle(0x14240f, 1);
    back.fillEllipse(x, y + 6, 84, 30);
    back.fillStyle(0x081106, 1);
    back.fillEllipse(x, y + 8, 64, 22);

    // Front lip, drawn above the creature so it appears to rise from the hole.
    const lip = this.add.graphics().setDepth(DEPTH.player + 1);
    lip.fillStyle(0x4a8d42, 1);
    lip.fillEllipse(x, y + 20, 118, 22);
    lip.fillStyle(0x5fa653, 0.6);
    lip.fillEllipse(x, y + 16, 118, 12);

    this.holes.push({ x, y, busy: false, bad: false });
  }

  private spawn(): void {
    if (this.gameOver) return;
    const free = this.holes.filter((h) => !h.busy);
    if (free.length === 0) return;

    const hole = free[Math.floor(Math.random() * free.length)];
    hole.busy = true;
    hole.bad = Math.random() < 0.22;

    const kind = hole.bad ? "oni" : "kappa";
    const size = ENEMY_SIZE[kind];
    const scale = hole.bad ? 1.05 : 1.35;
    const sprite = this.add
      .sprite(hole.x, hole.y + 30, enemyKey(kind))
      .setDisplaySize(size.w * scale, size.h * scale)
      .setDepth(DEPTH.player);
    sprite.play(enemyAnim(kind));
    hole.sprite = sprite;

    sprite.setInteractive({ cursor: "pointer" });
    sprite.on("pointerdown", () => this.hit(hole));

    this.tweens.add({ targets: sprite, y: hole.y - 16, duration: 150, ease: "Back.easeOut" });

    const upFor = hole.bad ? 1100 : Math.max(650, 1200 - this.score * 4);
    hole.timer = this.time.delayedCall(upFor, () => this.retract(hole, false));
  }

  private hit(hole: Hole): void {
    if (!hole.busy || this.gameOver || !hole.sprite) return;

    if (hole.bad) {
      // Struck an oni — it costs time and breaks the streak.
      this.streak = 0;
      this.timeLeft = Math.max(0, this.timeLeft - 3);
      this.timeText.setText(`${this.timeLeft}s`);
      this.updateStreak();
      AudioManager.play("denied");
      this.cameras.main.shake(160, 0.01);
      this.cameras.main.flash(180, 200, 40, 40);
      this.popText(hole.x, hole.y - 40, "-3s", PALETTE.blood);
      this.retract(hole, true);
      return;
    }

    this.streak = Math.min(STREAK_MAX, this.streak + 1);
    const gain = 10 * this.streak;
    this.score += gain;
    this.scoreText.setText(String(this.score));
    this.updateStreak();

    AudioManager.play("whack");
    this.cameras.main.shake(90, 0.006);
    this.popText(hole.x, hole.y - 40, `+${gain}`, PALETTE.gold);
    this.add.particles(hole.x, hole.y - 10, FX.slash, {
      speed: { min: 60, max: 160 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.7, end: 0 },
      lifespan: 420,
      quantity: 8,
      maxParticles: 8,
    }).setDepth(DEPTH.fx);

    this.retract(hole, true);
  }

  private retract(hole: Hole, hit: boolean): void {
    hole.timer?.remove(false);
    hole.timer = undefined;
    const sprite = hole.sprite;
    hole.sprite = undefined;
    hole.busy = false;

    if (!hit && !hole.bad) {
      // A kappa that escaped resets the streak — no penalty, just lost momentum.
      this.streak = 0;
      this.updateStreak();
    }

    if (!sprite) return;
    if (hit) {
      this.tweens.add({
        targets: sprite,
        y: hole.y + 30,
        scaleX: sprite.scaleX * 1.2,
        scaleY: sprite.scaleY * 0.7,
        alpha: 0,
        duration: 160,
        onComplete: () => sprite.destroy(),
      });
    } else {
      this.tweens.add({
        targets: sprite,
        y: hole.y + 34,
        duration: 220,
        ease: "Cubic.easeIn",
        onComplete: () => sprite.destroy(),
      });
    }
  }

  private updateStreak(): void {
    this.streakText.setText(this.streak >= 2 ? `SÉRIE ×${this.streak}` : "");
  }

  private popText(x: number, y: number, text: string, color: number): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: FONT.ui,
        fontSize: "26px",
        color: `#${color.toString(16).padStart(6, "0")}`,
        stroke: CSS.ink,
        strokeThickness: 4,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 620, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  }

  private tick(): void {
    if (this.gameOver) return;
    this.timeLeft -= 1;
    this.timeText.setText(`${Math.max(0, this.timeLeft)}s`);
    if (this.timeLeft <= 5) {
      this.timeText.setColor(CSS.ember);
      this.tweens.add({ targets: this.timeText, scale: { from: 1.2, to: 1 }, duration: 200 });
    }
    if (this.timeLeft <= 0) this.endRound();
  }

  private endRound(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.spawnTimer?.remove();
    this.clock?.remove();
    this.holes.forEach((h) => this.retract(h, false));

    const best = loadBest(BEST_KEY.whack);
    const record = saveBest(BEST_KEY.whack, this.score);
    const verdict =
      this.score >= 300 ? "Sugoi ! Réflexes de yokai." : this.score >= 180 ? "Kakkoii !" : this.score >= 80 ? "Yatta !" : "Ganbare !";

    this.time.delayedCall(400, () =>
      showMiniGameOver(this, {
        title: "TEMPS ÉCOULÉ",
        score: this.score,
        best,
        record,
        verdict,
        onReplay: () => this.scene.restart(),
      })
    );
  }

  private leave(): void {
    this.spawnTimer?.remove();
    this.clock?.remove();
    transitionTo(this, "MiniGames");
  }
}
