import { Scene } from "phaser";

import { UI } from "../art/keys";
import { CSS, DEPTH, FONT, PALETTE, TEXT } from "../config/theme";
import {
  CAMPAIGN,
  loadCampaignProgress,
  loadCustomLevels,
  makeDraftLevel,
  upsertCustomLevel,
  type CustomLevel,
} from "../config/levels";
import { AudioManager } from "../systems/Audio";
import {
  fadeIn,
  makeBackButton,
  makeButton,
  makeHeader,
  makePanel,
  makeSceneBackdrop,
  makeToast,
  transitionTo,
} from "../ui/UIKit";

type Tab = "campaign" | "creations";

const PLAYER_NAME_KEY = "yokaijump.playerName";

export function loadPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) || "Anonyme";
  } catch {
    return "Anonyme";
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name.slice(0, 12) || "Anonyme");
  } catch {
    /* private mode */
  }
}

/**
 * The levels hub: a twelve-stage campaign that ramps through every biome, and a
 * "Créations" tab for playing and building custom levels. Infinite mode lives on
 * its own button in the main menu; only that mode feeds the leaderboard.
 */
export class Levels extends Scene {
  private tab: Tab = "campaign";
  private content!: Phaser.GameObjects.Container;
  private tabButtons: Record<Tab, ReturnType<typeof makeButton>> = {} as never;

  constructor() {
    super("Levels");
  }

  init(data: { tab?: Tab }): void {
    this.tab = data?.tab === "creations" ? "creations" : "campaign";
  }

  create(): void {
    makeSceneBackdrop(this, PALETTE.gold);
    makeHeader(this, "NIVEAUX", "La campagne, ou tes propres créations");
    fadeIn(this);

    this.buildTabs();
    this.content = this.add.container(0, 0).setDepth(DEPTH.hud);
    this.render();

    makeBackButton(this, () => transitionTo(this, "MainMenu"));
    this.input.keyboard?.once("keydown-ESC", () => transitionTo(this, "MainMenu"));
    this.input.once("pointerdown", () => AudioManager.init());
  }

  private buildTabs(): void {
    const { width } = this.scale;
    this.tabButtons.campaign = makeButton(this, width / 2 - 108, 128, "CAMPAGNE", () => this.switchTab("campaign"), {
      width: 200,
      height: 44,
      fontSize: 17,
      variant: this.tab === "campaign" ? "primary" : "ghost",
    });
    this.tabButtons.creations = makeButton(this, width / 2 + 108, 128, "CRÉATIONS", () => this.switchTab("creations"), {
      width: 200,
      height: 44,
      fontSize: 17,
      variant: this.tab === "creations" ? "primary" : "ghost",
    });
  }

  private switchTab(tab: Tab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    // The button helper has no "set variant", so the cheapest correct thing is to
    // rebuild the two chips with the new active state.
    this.tabButtons.campaign.destroy();
    this.tabButtons.creations.destroy();
    this.buildTabs();
    this.render();
  }

  private render(): void {
    this.content.removeAll(true);
    if (this.tab === "campaign") this.buildCampaign();
    else this.buildCreations();
  }

  /* ------------------------------------------------------------------ */
  /* Campaign grid                                                       */
  /* ------------------------------------------------------------------ */

  private buildCampaign(): void {
    const { width } = this.scale;
    const prog = loadCampaignProgress();

    const cols = 3;
    const cardW = 138;
    const cardH = 106;
    const gapX = 14;
    const gapY = 14;
    const startX = width / 2 - ((cols - 1) * (cardW + gapX)) / 2;
    const startY = 208;

    CAMPAIGN.forEach((lvl, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      const unlocked = lvl.index <= prog.unlocked;
      const stars = prog.stars[lvl.id] ?? 0;
      this.buildCampaignCard(x, y, cardW, cardH, lvl.index + 1, lvl.name, unlocked, stars, () =>
        transitionTo(this, "Game", { mode: "campaign", levelId: lvl.id })
      );
    });
  }

  private buildCampaignCard(
    x: number,
    y: number,
    w: number,
    h: number,
    number: number,
    name: string,
    unlocked: boolean,
    stars: number,
    onPlay: () => void
  ): void {
    const card = this.add.container(x, y);
    this.content.add(card);

    const panel = makePanel(this, 0, 0, w, h, { inset: true });
    if (!unlocked) panel.setTint(0x6a6480);

    const num = this.add
      .text(0, -22, String(number), { ...TEXT.title(34), color: unlocked ? CSS.goldGlow : CSS.textFaint })
      .setOrigin(0.5);

    const label = this.add
      .text(0, 14, name, {
        ...TEXT.label(12, unlocked ? CSS.text : CSS.textFaint),
        align: "center",
        wordWrap: { width: w - 16 },
      })
      .setOrigin(0.5);

    card.add([panel, num, label]);

    if (unlocked) {
      for (let s = 0; s < 3; s++) {
        const star = this.add.image((s - 1) * 20, 38, UI.star).setDisplaySize(15, 15);
        star.setTint(s < stars ? PALETTE.gold : PALETTE.surfaceHi);
        card.add(star);
      }
      card.setSize(w, h);
      panel.setInteractive({ useHandCursor: true });
      panel.on("pointerover", () => {
        AudioManager.play("hover");
        panel.setTint(PALETTE.gold);
        this.tweens.add({ targets: card, scale: 1.05, duration: 120 });
      });
      panel.on("pointerout", () => {
        panel.clearTint();
        this.tweens.add({ targets: card, scale: 1, duration: 120 });
      });
      panel.on("pointerdown", () => {
        AudioManager.play("click");
        this.tweens.add({ targets: card, scale: 0.95, duration: 80, yoyo: true, onComplete: onPlay });
      });
    } else {
      const lock = this.add.image(0, 34, UI.lock).setDisplaySize(20, 24).setAlpha(0.9);
      card.add(lock);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Creations list                                                      */
  /* ------------------------------------------------------------------ */

  private buildCreations(): void {
    const { width } = this.scale;

    const create = makeButton(this, width / 2, 190, "＋  CRÉER UN NIVEAU", () => this.startNewLevel(), {
      width: 300,
      height: 52,
      fontSize: 19,
    });
    this.content.add(create);

    const levels = loadCustomLevels().sort((a, b) => Number(b.published) - Number(a.published));

    if (levels.length === 0) {
      const empty = this.add
        .text(
          width / 2,
          420,
          "Aucune création pour l'instant.\nConçois un niveau, termine-le,\npuis publie-le pour le partager.",
          { ...TEXT.label(15, CSS.textFaint), align: "center", lineSpacing: 6 }
        )
        .setOrigin(0.5);
      this.content.add(empty);
      return;
    }

    const rowH = 74;
    const maxRows = 5;
    const startY = 250;
    levels.slice(0, maxRows).forEach((lvl, i) => this.buildCreationRow(lvl, startY + i * rowH));

    if (levels.length > maxRows) {
      const more = this.add
        .text(width / 2, startY + maxRows * rowH, `+ ${levels.length - maxRows} autres`, TEXT.label(13, CSS.textFaint))
        .setOrigin(0.5);
      this.content.add(more);
    }
  }

  private buildCreationRow(lvl: CustomLevel, y: number): void {
    const { width } = this.scale;
    const cx = width / 2;

    const panel = makePanel(this, cx, y, 452, 64, { inset: true });
    this.content.add(panel);

    const name = this.add.text(cx - 206, y - 14, lvl.name, TEXT.button(17)).setOrigin(0, 0.5);
    const author = this.add
      .text(cx - 206, y + 12, `par ${lvl.author}`, TEXT.label(12, CSS.textFaint))
      .setOrigin(0, 0.5);
    this.content.add([name, author]);

    const badge = lvl.published
      ? { t: "PUBLIÉ", c: PALETTE.jade }
      : lvl.validated
        ? { t: "VALIDÉ", c: PALETTE.spirit }
        : { t: "BROUILLON", c: PALETTE.textFaint };
    const chip = this.add
      .text(cx + 44, y - 14, badge.t, {
        fontFamily: FONT.ui,
        fontSize: "12px",
        color: `#${badge.c.toString(16).padStart(6, "0")}`,
        stroke: CSS.ink,
        strokeThickness: 2,
      })
      .setOrigin(0, 0.5);
    this.content.add(chip);

    const play = makeButton(this, cx + 148, y, "JOUER", () => transitionTo(this, "Game", { mode: "custom", level: lvl, validating: false }), {
      width: 96,
      height: 40,
      fontSize: 15,
      variant: "secondary",
    });
    const edit = makeButton(this, cx + 208, y, "✎", () => transitionTo(this, "LevelEditor", { levelId: lvl.id }), {
      width: 40,
      height: 40,
      fontSize: 18,
      variant: "ghost",
    });
    this.content.add(play);
    this.content.add(edit);
  }

  private startNewLevel(): void {
    const draft = makeDraftLevel(loadPlayerName());
    upsertCustomLevel(draft);
    makeToast(this, "Nouveau niveau créé", "success");
    transitionTo(this, "LevelEditor", { levelId: draft.id });
  }
}
