import { Scene } from "phaser";

import { ENEMY_SIZE, FX, UI, enemyAnim, enemyKey, type EnemyKind } from "../art/keys";
import { CSS, DEPTH, FONT, PALETTE, TEXT } from "../config/theme";
import { AudioManager } from "../systems/Audio";
import {
  fadeIn,
  makeBackButton,
  makeButton,
  makeHeader,
  makePanel,
  makeSceneBackdrop,
  transitionTo,
} from "../ui/UIKit";

/* ------------------------------------------------------------------ */
/* Shared mini-game plumbing                                           */
/* ------------------------------------------------------------------ */

/**
 * Texture keys the mini-games paint for themselves.
 *
 * src/art/keys.ts owns every texture the main game shares; these three props
 * (torii gate, pit, garden plate) exist only inside the mini-games, so they are
 * declared here rather than polluting the global key list — but they are still
 * declared *once*, never as inline strings.
 */
export const MINI_ART = {
  pillar: "mg_torii_pillar",
  lintel: "mg_torii_lintel",
  path: "mg_path",
  hole: "mg_hole",
  holeLip: "mg_hole_lip",
  yard: "mg_yard",
} as const;

export const BEST_KEY = {
  flappy: "yokaijump.mini.flappy.best",
  whack: "yokaijump.mini.whack.best",
} as const;

export function loadBest(key: string): number {
  const raw = Number(localStorage.getItem(key) ?? 0);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/** Stores `score` when it beats the record. Returns true if it did. */
export function saveBest(key: string, score: number): boolean {
  const record = Math.floor(score) > loadBest(key);
  if (record) {
    try {
      localStorage.setItem(key, String(Math.floor(score)));
    } catch {
      /* private mode — the run was still a record, it just won't survive a reload */
    }
  }
  return record;
}

export interface MiniGameOverOpts {
  title: string;
  score: number;
  best: number;
  record: boolean;
  verdict?: string;
  onReplay: () => void;
}

/**
 * The end-of-run panel both mini-games share, so a lost flight and a finished
 * whack round settle in exactly the same way.
 */
export function showMiniGameOver(scene: Scene, opts: MiniGameOverOpts): void {
  const { width, height } = scene.scale;

  const shade = scene.add
    .rectangle(width / 2, height / 2, width, height, PALETTE.void, 0.8)
    .setDepth(DEPTH.overlay)
    .setAlpha(0)
    .setInteractive();
  scene.tweens.add({ targets: shade, alpha: 1, duration: 240 });

  const layer = scene.add.container(width / 2, height / 2);
  layer.setDepth(DEPTH.overlay + 1);

  const parts: Phaser.GameObjects.GameObject[] = [
    makePanel(scene, 0, 0, 386, 424),
    scene.add.text(0, -152, opts.title, TEXT.title(30)).setOrigin(0.5),
  ];

  if (opts.verdict) {
    parts.push(
      scene.add
        .text(0, -110, opts.verdict, {
          ...TEXT.label(15, CSS.textDim),
          align: "center",
          wordWrap: { width: 310 },
        })
        .setOrigin(0.5)
    );
  }

  parts.push(
    scene.add
      .text(0, -64, "SCORE", { fontFamily: FONT.ui, fontSize: "15px", color: CSS.textFaint })
      .setOrigin(0.5),
    scene.add.text(0, -22, String(opts.score), { ...TEXT.score(56), color: CSS.gold }).setOrigin(0.5)
  );

  const best = Math.max(opts.best, opts.score);
  const bestText = scene.add
    .text(0, 36, `MEILLEUR — ${best}`, {
      fontFamily: FONT.ui,
      fontSize: "16px",
      color: CSS.textDim,
      stroke: CSS.ink,
      strokeThickness: 3,
    })
    .setOrigin(0, 0.5);
  const star = scene.add.image(0, 36, UI.star).setDisplaySize(18, 18);
  const rowW = 18 + 8 + bestText.width;
  star.x = -rowW / 2 + 9;
  bestText.x = -rowW / 2 + 26;
  parts.push(star, bestText);

  if (opts.record) {
    const banner = scene.add.container(0, -198);
    const ribbon = scene.add.image(0, 0, UI.ribbon).setDisplaySize(252, 42);
    const label = scene.add
      .text(0, 0, "NOUVEAU RECORD", {
        fontFamily: FONT.ui,
        fontSize: "17px",
        color: CSS.goldGlow,
        stroke: CSS.ink,
        strokeThickness: 3,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    banner.add([ribbon, label]);
    parts.push(banner);

    scene.tweens.add({
      targets: banner,
      scale: { from: 0.94, to: 1.06 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const burst = scene.add.particles(width / 2, height / 2 - 198, FX.star, {
      speed: { min: 90, max: 240 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      lifespan: 900,
      quantity: 22,
      maxParticles: 22,
      gravityY: 140,
    });
    burst.setDepth(DEPTH.overlay + 2);
    scene.time.delayedCall(1400, () => burst.destroy());

    AudioManager.play("milestone");
  }

  parts.push(
    makeButton(scene, 0, 100, "REJOUER", () => opts.onReplay(), {
      width: 250,
      height: 54,
      fontSize: 20,
    }),
    makeButton(scene, 0, 166, "RETOUR", () => transitionTo(scene, "MiniGames"), {
      width: 250,
      height: 48,
      fontSize: 18,
      variant: "ghost",
    })
  );

  layer.add(parts);
  layer.setScale(0.86);
  layer.setAlpha(0);
  scene.tweens.add({
    targets: layer,
    scale: 1,
    alpha: 1,
    duration: 340,
    ease: "Back.easeOut",
  });

  scene.input.keyboard?.once("keydown-R", () => opts.onReplay());
  scene.input.keyboard?.once("keydown-ESC", () => transitionTo(scene, "MiniGames"));
}

/* ------------------------------------------------------------------ */
/* The menu                                                            */
/* ------------------------------------------------------------------ */

interface CardDef {
  target: string;
  title: string;
  desc: string;
  kind: EnemyKind;
  accent: number;
  bestKey: string;
  spriteScale: number;
}

const CARDS: CardDef[] = [
  {
    target: "FlappyTengu",
    title: "FLAPPY TENGU",
    desc: "Bats des ailes et faufile-toi entre les torii du sanctuaire. Un seul contact et le vol s'arrête.",
    kind: "tengu",
    accent: PALETTE.spirit,
    bestKey: BEST_KEY.flappy,
    spriteScale: 1.5,
  },
  {
    target: "WhackAKappa",
    title: "WHACK-A-KAPPA",
    desc: "Les kappa surgissent des trous. Frappe vite, enchaîne les combos avant la fin du temps.",
    kind: "kappa",
    accent: PALETTE.jade,
    bestKey: BEST_KEY.whack,
    spriteScale: 1.7,
  },
];

const toCss = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/** Two illustrated cards — the real yokai sprite, the pitch, and your record. */
export class MiniGames extends Scene {
  constructor() {
    super("MiniGames");
  }

  create(): void {
    const { width, height } = this.scale;

    makeSceneBackdrop(this, PALETTE.spirit);
    makeHeader(this, "MINI-JEUX", "Deux défis avant l'ascension");
    fadeIn(this);

    CARDS.forEach((card, i) => this.buildCard(card, 268 + i * 202, i));

    this.add
      .text(width / 2, height - 132, "Tes records sont conservés d'une partie à l'autre.", TEXT.label(13, CSS.textFaint))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    makeBackButton(this, () => transitionTo(this, "MainMenu"));
    this.input.keyboard?.once("keydown-ESC", () => transitionTo(this, "MainMenu"));
  }

  private buildCard(def: CardDef, y: number, index: number): void {
    const { width } = this.scale;
    const card = this.add.container(width / 2, y);
    card.setDepth(DEPTH.hud);

    const panel = makePanel(this, 0, 0, 440, 176);

    const halo = this.add.image(-134, 2, UI.rarityGlow);
    halo.setDisplaySize(160, 160);
    halo.setTint(def.accent);
    halo.setAlpha(0.4);
    halo.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.25, to: 0.5 },
      duration: 1700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const size = ENEMY_SIZE[def.kind];
    const sprite = this.add.sprite(-134, 4, enemyKey(def.kind));
    sprite.setDisplaySize(size.w * def.spriteScale, size.h * def.spriteScale);
    sprite.play(enemyAnim(def.kind));
    this.tweens.add({
      targets: sprite,
      y: -6,
      duration: 2000 + index * 300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const title = this.add
      .text(-70, -54, def.title, { ...TEXT.heading(22), color: toCss(def.accent) })
      .setOrigin(0, 0.5);

    const desc = this.add
      .text(-70, -34, def.desc, {
        ...TEXT.label(13, CSS.textDim),
        wordWrap: { width: 252 },
        lineSpacing: 3,
      })
      .setOrigin(0, 0);

    const star = this.add.image(-62, 58, UI.star).setDisplaySize(18, 18);
    const best = this.add
      .text(-46, 58, `MEILLEUR — ${loadBest(def.bestKey)}`, {
        fontFamily: FONT.ui,
        fontSize: "15px",
        color: CSS.gold,
        stroke: CSS.ink,
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5);

    const chevron = this.add.image(196, 0, UI.chevron).setDisplaySize(22, 22);
    this.tweens.add({
      targets: chevron,
      x: 202,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    card.add([panel, halo, sprite, title, desc, star, best, chevron]);

    card.setSize(440, 176);
    panel.setInteractive({ useHandCursor: true });
    this.input.setDefaultCursor("default");

    panel.on("pointerover", () => {
      AudioManager.play("hover");
      panel.setTint(def.accent);
      chevron.setTint(def.accent);
      this.tweens.add({ targets: card, scale: 1.03, duration: 130, ease: "Quad.easeOut" });
    });
    panel.on("pointerout", () => {
      panel.clearTint();
      chevron.clearTint();
      this.tweens.add({ targets: card, scale: 1, duration: 130 });
    });
    panel.on("pointerdown", () => {
      AudioManager.play("click");
      this.tweens.add({
        targets: card,
        scale: 0.95,
        duration: 90,
        yoyo: true,
        onComplete: () => transitionTo(this, def.target),
      });
    });

    // Cascade in.
    card.setAlpha(0);
    card.y = y + 34;
    this.tweens.add({
      targets: card,
      y,
      alpha: 1,
      duration: 460,
      delay: 120 + index * 110,
      ease: "Back.easeOut",
    });
  }
}
