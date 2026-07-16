import { Scene } from "phaser";

import { CHAR_FRAME, CHAR_H, CHAR_W, FX, UI, charKey, type Biome } from "../art/keys";
import { biomeAt } from "../art/backgrounds";
import { addLeaderboardScore, loadLeaderboard, type ScoreEntry } from "../config/leaderboard";
import { equippedSkin } from "../config/skins";
import { CSS, DEPTH, FONT, PALETTE, TEXT } from "../config/theme";
import { loadCoins } from "../config/wallet";
import { AudioManager } from "../systems/Audio";
import {
  fadeIn,
  makeButton,
  makeCoinBadge,
  makePanel,
  makePrompt,
  makeSceneBackdrop,
  makeToast,
  transitionTo,
} from "../ui/UIKit";

/**
 * The death screen.
 *
 * The old one popped a native `window.prompt()` for initials after *every*
 * single run — unusable on a phone, and immersion-breaking on desktop. Initials
 * are now asked through the in-game modal (UIKit.makePrompt), and only when the
 * score actually earns a place in the top ten.
 */

/** Mirrors the slice inside addLeaderboardScore(). */
const BOARD_SIZE = 10;

const BIOME_LABELS: Record<Biome, string> = {
  village: "Village hanté",
  forest: "Forêt des torii",
  mountain: "Montagne gelée",
  clouds: "Mer de nuages",
  storm: "Orage éternel",
  cosmos: "Cosmos",
};

/** Vertical rhythm of the screen, in pixels. */
const Y = {
  title: 76,
  hero: 176,
  panel: 362,
  scoreLabel: 280,
  score: 316,
  record: 362,
  divider: 392,
  coins: 420,
  biome: 450,
  boardLabel: 498,
  board: 554,
  rows: [526, 554, 582],
  replay: 650,
  shop: 710,
  menu: 764,
} as const;

export class GameOver extends Scene {
  private finalScore = 0;
  private bestScore = 0;
  private coinsEarned = 0;
  private newRecord = false;

  /** True while the initials modal owns the keyboard. */
  private modalOpen = false;

  private boardRows: Phaser.GameObjects.Text[] = [];
  private boardEmpty!: Phaser.GameObjects.Text;

  constructor() {
    super("GameOver");
  }

  create(): void {
    const { width } = this.scale;

    this.finalScore = this.readRegistry("lastScore");
    this.bestScore = this.readRegistry("bestScore");
    this.coinsEarned = this.readRegistry("lastCoins");
    // Game.ts already folded the run into the best score, so "record" means the
    // run is the one holding the crown.
    this.newRecord = this.finalScore > 0 && this.finalScore >= this.bestScore;
    this.boardRows = [];
    this.modalOpen = false;

    makeSceneBackdrop(this, PALETTE.sakura);
    fadeIn(this);

    this.buildTitle(width);
    this.buildFallenHero(width);
    this.buildResults(width);
    this.buildBoard(width);
    this.buildActions(width);

    makeCoinBadge(this, width - 84, 36, loadCoins());

    AudioManager.play("death");
    this.cameras.main.shake(320, 0.006);
    if (this.newRecord) this.time.delayedCall(760, () => AudioManager.play("milestone"));

    this.time.delayedCall(1250, () => this.maybeAskInitials());

    this.input.keyboard?.on("keydown-ENTER", () => {
      if (!this.modalOpen) transitionTo(this, "Game");
    });
    this.input.keyboard?.on("keydown-ESC", () => {
      if (!this.modalOpen) transitionTo(this, "MainMenu");
    });
  }

  private readRegistry(key: string): number {
    const raw = Number(this.registry.get(key) ?? 0);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  }

  /* ------------------------------------------------------------------ */
  /* Title                                                               */
  /* ------------------------------------------------------------------ */

  private buildTitle(w: number): void {
    const title = this.add
      .text(w / 2, Y.title, "GAME OVER", {
        ...TEXT.title(46),
        shadow: { offsetX: 0, offsetY: 0, color: CSS.sakuraDeep, blur: 26, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    title.setAlpha(0);
    this.tweens.add({
      targets: title,
      scale: { from: 1.5, to: 1 },
      alpha: { from: 0, to: 1 },
      duration: 420,
      ease: "Back.easeOut",
    });

    // The tremble: the title lands hard, then shivers.
    this.tweens.add({
      targets: title,
      x: { from: w / 2 - 5, to: w / 2 + 5 },
      duration: 52,
      delay: 380,
      yoyo: true,
      repeat: 7,
      onComplete: () => title.setX(w / 2),
    });

    this.add
      .text(w / 2, Y.title + 34, "LES YOKAI ONT GAGNÉ… CETTE FOIS", TEXT.label(12, CSS.textFaint))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
  }

  /* ------------------------------------------------------------------ */
  /* The fallen yokai                                                    */
  /* ------------------------------------------------------------------ */

  /** The skin you actually play, in its hurt frame, collapsed on the ground. */
  private buildFallenHero(w: number): void {
    const skin = equippedSkin();

    const halo = this.add
      .image(w / 2, Y.hero + 12, UI.rarityGlow)
      .setDisplaySize(180, 180)
      .setTint(skin.palette.aura)
      .setAlpha(0.22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.props);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.1, to: 0.3 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const hero = this.add.sprite(w / 2, Y.hero - 56, charKey(skin.id)).setDepth(DEPTH.player);
    hero.setFrame(CHAR_FRAME.hurt);
    hero.setDisplaySize(CHAR_W * 1.9, CHAR_H * 1.9);
    hero.setAngle(-10);

    // He drops, bounces once and stays down, lying on his side.
    this.tweens.add({
      targets: hero,
      y: Y.hero,
      angle: 76,
      duration: 560,
      ease: "Bounce.easeOut",
    });
    this.tweens.add({
      targets: hero,
      y: Y.hero - 4,
      duration: 2300,
      delay: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Impact.
    this.time.delayedCall(560, () => {
      this.cameras.main.shake(150, 0.004);
      const dust = this.add.particles(w / 2, Y.hero + 26, FX.dust, {
        speed: { min: 30, max: 95 },
        angle: { min: 190, max: 350 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.55, end: 0 },
        lifespan: 720,
        quantity: 14,
        maxParticles: 14,
      });
      dust.setDepth(DEPTH.fx);
      this.time.delayedCall(1100, () => dust.destroy());
    });
  }

  /* ------------------------------------------------------------------ */
  /* Results card                                                        */
  /* ------------------------------------------------------------------ */

  private buildResults(w: number): void {
    const cx = w / 2;

    makePanel(this, cx, Y.panel, w - 56, 226).setDepth(DEPTH.props);

    this.add
      .text(cx, Y.scoreLabel, "SCORE FINAL", TEXT.label(13, CSS.textFaint))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    const score = this.add
      .text(cx, Y.score, "0", TEXT.score(46))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    // The score counts up — a still number reads as a receipt, a climbing one
    // reads as a result.
    this.tweens.addCounter({
      from: 0,
      to: this.finalScore,
      duration: 1000,
      delay: 340,
      ease: "Cubic.easeOut",
      onUpdate: (tw) => score.setText(String(Math.floor(tw.getValue() ?? 0))),
      onComplete: () => {
        score.setText(String(this.finalScore));
        this.tweens.add({
          targets: score,
          scale: { from: 1.2, to: 1 },
          duration: 280,
          ease: "Back.easeOut",
        });
      },
    });

    if (this.newRecord) this.buildRecordBadge(cx);
    else {
      this.add
        .text(cx, Y.record, `MEILLEUR — ${this.bestScore}`, TEXT.label(16, CSS.textDim))
        .setOrigin(0.5)
        .setDepth(DEPTH.hud);
    }

    this.add
      .rectangle(cx, Y.divider, w - 120, 1, PALETTE.border, 0.7)
      .setDepth(DEPTH.props);

    this.buildCoinsRow(cx);

    this.add
      .text(
        cx,
        Y.biome,
        `Biome atteint — ${BIOME_LABELS[biomeAt(this.finalScore)]}`,
        TEXT.label(14, CSS.spirit)
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
  }

  /** Ribbon + label live in a container: tweening `scale` on an image would
   *  fight the setDisplaySize() that gave it its size. */
  private buildRecordBadge(cx: number): void {
    const badge = this.add.container(cx, Y.record).setDepth(DEPTH.hud);

    const ribbon = this.add.image(0, 0, UI.ribbon);
    ribbon.setDisplaySize(258, 48);
    ribbon.setTint(PALETTE.gold);

    const label = this.add
      .text(0, -1, "NOUVEAU RECORD !", { ...TEXT.button(17), color: "#fff6dc" })
      .setOrigin(0.5);

    badge.add([ribbon, label]);

    badge.setScale(0);
    this.tweens.add({
      targets: badge,
      scale: 1,
      duration: 460,
      delay: 900,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: badge,
          scale: { from: 1, to: 1.06 },
          duration: 780,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      },
    });

    const sparks = this.add.particles(cx, Y.record, FX.star, {
      x: { min: -120, max: 120 },
      y: { min: -18, max: 18 },
      lifespan: { min: 700, max: 1300 },
      speedY: { min: -34, max: -10 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: PALETTE.goldGlow,
      frequency: 220,
      quantity: 1,
    });
    sparks.setDepth(DEPTH.props);
  }

  private buildCoinsRow(cx: number): void {
    if (this.coinsEarned <= 0) {
      this.add
        .text(cx, Y.coins, "Aucune pièce ramassée", TEXT.label(15, CSS.textFaint))
        .setOrigin(0.5)
        .setDepth(DEPTH.hud);
      return;
    }

    const text = this.add
      .text(cx + 14, Y.coins, `+${this.coinsEarned} pièces`, { ...TEXT.button(19), color: CSS.gold })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    const icon = this.add
      .image(cx + 14 - text.width / 2 - 17, Y.coins, UI.coinIcon)
      .setDisplaySize(26, 26)
      .setDepth(DEPTH.hud);

    [icon, text].forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: [icon, text], alpha: 1, duration: 320, delay: 1000 });
    this.tweens.add({
      targets: icon,
      angle: 360,
      duration: 2600,
      delay: 1000,
      repeat: -1,
      ease: "Linear",
    });
  }

  /* ------------------------------------------------------------------ */
  /* Leaderboard preview                                                 */
  /* ------------------------------------------------------------------ */

  private buildBoard(w: number): void {
    const cx = w / 2;

    this.add
      .text(cx, Y.boardLabel, "CLASSEMENT — TOP 3", TEXT.label(13, CSS.textFaint))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    makePanel(this, cx, Y.board, w - 56, 96, { inset: true }).setDepth(DEPTH.props);

    this.boardEmpty = this.add
      .text(cx, Y.board, "Aucun score enregistré", TEXT.label(15, CSS.textFaint))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    this.renderBoard(this.sortedBoard());
  }

  private sortedBoard(): ScoreEntry[] {
    return loadLeaderboard().sort((a, b) => b.score - a.score);
  }

  private renderBoard(entries: ScoreEntry[]): void {
    const cx = this.scale.width / 2;

    this.boardRows.forEach((row) => row.destroy());
    this.boardRows = [];

    const top = entries.slice(0, 3);
    this.boardEmpty.setVisible(top.length === 0);

    const colors = [CSS.gold, CSS.text, CSS.textDim];

    top.forEach((entry, i) => {
      const initials = entry.initials.slice(0, 3).padEnd(3, " ");
      const line = `${i + 1}.  ${initials}   ${String(entry.score).padStart(6, " ")}`;

      const row = this.add
        .text(cx, Y.rows[i], line, {
          fontFamily: FONT.mono,
          fontSize: "17px",
          color: colors[i],
          stroke: CSS.ink,
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.hud);

      row.setAlpha(0);
      this.tweens.add({ targets: row, alpha: 1, duration: 260, delay: 300 + i * 90 });
      this.boardRows.push(row);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  private buildActions(w: number): void {
    const buttons = [
      makeButton(this, w / 2, Y.replay, "REJOUER", () => transitionTo(this, "Game"), {
        width: 264,
        height: 56,
        fontSize: 22,
      }),
      makeButton(this, w / 2, Y.shop, "BOUTIQUE", () => transitionTo(this, "Shop"), {
        width: 232,
        height: 46,
        fontSize: 18,
        variant: "secondary",
      }),
      makeButton(this, w / 2, Y.menu, "MENU PRINCIPAL", () => transitionTo(this, "MainMenu"), {
        width: 232,
        height: 44,
        fontSize: 16,
        variant: "ghost",
      }),
    ];

    buttons.forEach((btn, i) => {
      btn.setDepth(DEPTH.hud);
      btn.setAlpha(0);
      this.tweens.add({
        targets: btn,
        alpha: 1,
        y: { from: btn.y + 22, to: btn.y },
        duration: 380,
        delay: 620 + i * 90,
        ease: "Quad.easeOut",
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Initials — only when the score really lands in the top ten          */
  /* ------------------------------------------------------------------ */

  private maybeAskInitials(): void {
    if (this.finalScore <= 0) return;

    const board = this.sortedBoard();
    const worst = board.length > 0 ? board[board.length - 1].score : 0;
    const qualifies = board.length < BOARD_SIZE || this.finalScore > worst;
    if (!qualifies) return;

    this.modalOpen = true;

    // The modal's shade sits on the same layer as a toast, so the "you made the
    // top ten" news is delivered on the way out, not on the way in.
    makePrompt(this, "TES INITIALES", {
      maxLength: 3,
      onConfirm: (value) => {
        this.closeModal();
        const initials = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "AAA";
        this.renderBoard(addLeaderboardScore(initials, this.finalScore));
        AudioManager.play("questComplete");
        makeToast(this, `TOP 10 — score enregistré (${initials})`, "success");
      },
      onCancel: () => this.closeModal(),
    });
  }

  /**
   * Phaser fires the generic `keydown` (which the modal listens to) before the
   * key-specific `keydown-ENTER`/`keydown-ESC`. Dropping the flag on the next
   * tick keeps the key that closed the modal from also restarting the game.
   */
  private closeModal(): void {
    this.time.delayedCall(60, () => {
      this.modalOpen = false;
    });
  }
}
