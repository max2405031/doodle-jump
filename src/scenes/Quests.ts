import { Scene } from "phaser";

import { UI } from "../art/keys";
import { BIOMES } from "../art/keys";
import { CSS, DEPTH, FONT, PALETTE, TEXT } from "../config/theme";
import { loadStats } from "../config/stats";
import { addCoins, loadCoins } from "../config/wallet";
import { AudioManager } from "../systems/Audio";
import {
  fadeIn,
  makeBackButton,
  makeButton,
  makeCoinBadge,
  makeHeader,
  makePanel,
  makeSceneBackdrop,
  makeToast,
  transitionTo,
  type CoinBadge,
} from "../ui/UIKit";

interface QuestDef {
  id: string;
  name: string;
  desc: string;
  target: number;
  reward: number;
  value: () => number;
}

const CLAIM_KEY = "yokaijump.quests.v1";

function loadClaimed(): Set<string> {
  try {
    const raw = localStorage.getItem(CLAIM_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveClaimed(set: Set<string>): void {
  try {
    localStorage.setItem(CLAIM_KEY, JSON.stringify([...set]));
  } catch {
    /* private mode */
  }
}

/**
 * Quests read straight from the lifetime stats and the leaderboard. A quest is
 * claimable once its bar fills; claiming pays real coins into the wallet and can
 * only happen once. This is the payoff loop the old screen never had — it drew
 * progress but never paid anything out.
 */
export class Quests extends Scene {
  private claimed = new Set<string>();
  private list!: Phaser.GameObjects.Container;
  private badge!: CoinBadge;

  constructor() {
    super("Quests");
  }

  private quests(): QuestDef[] {
    const s = loadStats();
    const best = Number(localStorage.getItem("yokaijump.bestScore") ?? 0);
    const mountainIdx = Math.max(0, BIOMES.indexOf("mountain"));
    return [
      { id: "climb1", name: "Premiers Pas", desc: "Atteins 1000 en partie infinie", target: 1000, reward: 30, value: () => best },
      { id: "climb2", name: "Grimpeur Aguerri", desc: "Atteins 4000 en partie infinie", target: 4000, reward: 80, value: () => best },
      { id: "coins", name: "Collectionneur", desc: "Ramasse 150 pièces au total", target: 150, reward: 60, value: () => s.totalCoins },
      { id: "stomp", name: "Chasseur de Yokai", desc: "Écrase 30 yokai", target: 30, reward: 70, value: () => s.enemiesStomped },
      { id: "combo", name: "Enchaîneur", desc: "Réalise un combo ×4", target: 4, reward: 60, value: () => s.bestCombo },
      { id: "levels", name: "Aventurier", desc: "Termine 3 niveaux de campagne", target: 3, reward: 100, value: () => s.levelsCompleted },
      { id: "biome", name: "Explorateur", desc: "Atteins la Montagne Gelée", target: mountainIdx, reward: 80, value: () => s.biomeReached },
      { id: "creator", name: "Créateur", desc: "Publie un de tes niveaux", target: 1, reward: 120, value: () => s.levelsPublished },
    ];
  }

  create(): void {
    makeSceneBackdrop(this, PALETTE.jade);
    makeHeader(this, "QUÊTES", "Progresse, réclame tes récompenses");
    fadeIn(this);

    this.claimed = loadClaimed();
    this.badge = makeCoinBadge(this, this.scale.width - 84, 34, loadCoins());

    this.list = this.add.container(0, 0).setDepth(DEPTH.hud);
    this.renderList();

    makeBackButton(this, () => transitionTo(this, "MainMenu"));
    this.input.keyboard?.once("keydown-ESC", () => transitionTo(this, "MainMenu"));
    this.input.once("pointerdown", () => AudioManager.init());
  }

  private renderList(): void {
    this.list.removeAll(true);
    const startY = 138;
    const rowH = 68;
    this.quests().forEach((q, i) => this.buildRow(q, startY + i * rowH));
  }

  private buildRow(q: QuestDef, y: number): void {
    const { width } = this.scale;
    const cx = width / 2;
    const value = q.value();
    const complete = value >= q.target;
    const claimed = this.claimed.has(q.id);
    const claimable = complete && !claimed;

    const panel = makePanel(this, cx, y, 456, 60, { inset: true });
    if (claimed) panel.setTint(0x8fd9b8);
    else if (claimable) panel.setTint(0xfff0b8);
    this.list.add(panel);

    const name = this.add
      .text(cx - 212, y - 16, q.name, { ...TEXT.button(16), color: claimed ? CSS.jade : CSS.text })
      .setOrigin(0, 0.5);
    const desc = this.add.text(cx - 212, y + 2, q.desc, TEXT.label(12, CSS.textDim)).setOrigin(0, 0.5);
    this.list.add([name, desc]);

    // Progress bar.
    const barW = 250;
    const barX = cx - 212;
    const barY = y + 20;
    const p = Math.max(0, Math.min(1, value / q.target));
    const track = this.add.rectangle(barX, barY, barW, 6, PALETTE.surface, 0.9).setOrigin(0, 0.5);
    track.setStrokeStyle(1, PALETTE.border, 0.8);
    const fill = this.add
      .rectangle(barX + 1, barY, Math.max(2, (barW - 2) * p), 4, complete ? PALETTE.jade : PALETTE.spirit)
      .setOrigin(0, 0.5);
    const pct = this.add
      .text(barX + barW + 10, barY, `${Math.min(100, Math.floor(p * 100))}%`, TEXT.label(11, CSS.textFaint))
      .setOrigin(0, 0.5);
    this.list.add([track, fill, pct]);

    // Right-hand action.
    if (claimed) {
      const done = this.add.image(cx + 196, y - 12, UI.check).setDisplaySize(24, 24);
      const label = this.add.text(cx + 196, y + 12, "REÇU", TEXT.label(12, CSS.jade)).setOrigin(0.5);
      this.list.add([done, label]);
    } else if (claimable) {
      const btn = makeButton(this, cx + 178, y, "RÉCLAMER", () => this.claim(q), {
        width: 116,
        height: 44,
        fontSize: 15,
      });
      // Gentle pulse to draw the eye.
      this.tweens.add({ targets: btn, scale: { from: 1, to: 1.05 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.list.add(btn);
    } else {
      const icon = this.add.image(cx + 150, y, UI.coinIcon).setDisplaySize(18, 18);
      const reward = this.add
        .text(cx + 164, y, `+${q.reward}`, { fontFamily: FONT.ui, fontSize: "16px", color: CSS.gold })
        .setOrigin(0, 0.5);
      this.list.add([icon, reward]);
    }
  }

  private claim(q: QuestDef): void {
    if (this.claimed.has(q.id)) return;
    this.claimed.add(q.id);
    saveClaimed(this.claimed);
    const total = addCoins(q.reward);
    this.badge.setAmount(total);
    AudioManager.play("questComplete");
    makeToast(this, `Quête « ${q.name} » — +${q.reward} pièces`, "success");
    this.cameras.main.flash(180, 90, 220, 150);
    this.renderList();
  }
}
