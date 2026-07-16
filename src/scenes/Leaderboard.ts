import { Scene } from "phaser";

import { UI } from "../art/keys";
import { CSS, DEPTH, FONT, PALETTE, TEXT } from "../config/theme";
import { loadLeaderboard } from "../config/leaderboard";
import { AudioManager } from "../systems/Audio";
import {
  fadeIn,
  makeBackButton,
  makeHeader,
  makePanel,
  makeSceneBackdrop,
  transitionTo,
} from "../ui/UIKit";

const MEDAL = [PALETTE.gold, 0xd8dced, 0xcd8b52];

/**
 * The hall of fame — only the endless "partie infinie" writes here, which is why
 * the campaign and custom levels keep their own progress instead. Ten slots,
 * medals for the podium.
 */
export class Leaderboard extends Scene {
  constructor() {
    super("Leaderboard");
  }

  create(): void {
    const { width } = this.scale;

    makeSceneBackdrop(this, PALETTE.gold);
    makeHeader(this, "CLASSEMENT", "Les meilleures ascensions — mode infini");
    fadeIn(this);

    const entries = loadLeaderboard().sort((a, b) => b.score - a.score).slice(0, 10);

    if (entries.length === 0) {
      makePanel(this, width / 2, 360, 420, 200, { inset: true }).setDepth(DEPTH.props);
      this.add
        .text(
          width / 2,
          360,
          "Aucun score pour l'instant.\nLance une partie infinie\net grave ton nom ici.",
          { ...TEXT.label(16, CSS.textDim), align: "center", lineSpacing: 8 }
        )
        .setOrigin(0.5)
        .setDepth(DEPTH.hud);
    } else {
      const startY = 176;
      const rowH = 52;
      entries.forEach((entry, i) => this.buildRow(i, entry.initials, entry.score, startY + i * rowH));
    }

    makeBackButton(this, () => transitionTo(this, "MainMenu"));
    this.input.keyboard?.once("keydown-ESC", () => transitionTo(this, "MainMenu"));
    this.input.keyboard?.once("keydown-ENTER", () => transitionTo(this, "MainMenu"));
    this.input.once("pointerdown", () => AudioManager.init());
  }

  private buildRow(rank: number, initials: string, score: number, y: number): void {
    const { width } = this.scale;
    const cx = width / 2;
    const podium = rank < 3;
    const color = podium ? MEDAL[rank] : PALETTE.surfaceHi;
    const cssColor = podium ? `#${MEDAL[rank].toString(16).padStart(6, "0")}` : CSS.text;

    const panel = makePanel(this, cx, y, 456, 46, { inset: true }).setDepth(DEPTH.props);
    if (podium) panel.setTint(color);

    const badge = this.add.circle(cx - 196, y, 15, podium ? color : PALETTE.surface).setDepth(DEPTH.hud);
    badge.setStrokeStyle(2, PALETTE.borderHi, 0.8);
    this.add
      .text(cx - 196, y, String(rank + 1), { fontFamily: FONT.ui, fontSize: "16px", color: podium ? "#1a1330" : CSS.text, fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 1);

    this.add
      .text(cx - 150, y, initials.slice(0, 3).padEnd(3, " "), {
        fontFamily: FONT.mono,
        fontSize: "22px",
        color: cssColor,
        stroke: CSS.ink,
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud);

    if (rank === 0) {
      this.add.image(cx + 150, y, UI.star).setDisplaySize(20, 20).setDepth(DEPTH.hud);
    }

    this.add
      .text(cx + 200, y, String(score), { ...TEXT.score(22), color: cssColor })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud);
  }
}
