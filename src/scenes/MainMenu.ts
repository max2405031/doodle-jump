import { Scene } from "phaser";

import { BG_LAYERS, CHAR_H, CHAR_W, FX, UI, charKey, menuBgKey } from "../art/keys";
import { charAnim } from "../art/characters";
import { CSS, DEPTH, FONT, PALETTE, TEXT } from "../config/theme";
import { equippedSkin } from "../config/skins";
import { loadCoins } from "../config/wallet";
import { loadSettings } from "../config/settings";
import { AudioManager } from "../systems/Audio";
import { fadeIn, makeButton, makeCoinBadge, transitionTo } from "../ui/UIKit";

/** The front door: real parallax, the equipped yokai, and the title. */
export class MainMenu extends Scene {
  private layers: Phaser.GameObjects.TileSprite[] = [];

  constructor() {
    super("MainMenu");
  }

  create(): void {
    const { width, height } = this.scale;

    this.layers = [];
    AudioManager.refreshFromSettings();

    this.buildParallax(width, height);
    this.buildTitle(width, height);
    this.buildHero(width, height);
    this.buildMenu(width, height);
    this.buildFooter(width, height);

    this.add
      .image(width / 2, height / 2, UI.vignette)
      .setDisplaySize(width, height)
      .setDepth(DEPTH.fx);

    fadeIn(this);

    this.input.keyboard?.once("keydown-ENTER", () => transitionTo(this, "Game"));
    // WebAudio can only start after a gesture.
    this.input.once("pointerdown", () => {
      AudioManager.init();
      if (!this.sound.get("bgm") || !this.sound.get("bgm")?.isPlaying) {
        const s = loadSettings();
        const v = s.sfxEnabled ? s.sfxVolume : 0;
        this.sound.volume = v;
        this.sound.play("bgm", { loop: true });
      }
    });
  }

  update(_time: number, delta: number): void {
    // Slow ambient drift so the menu is never a still image.
    this.layers.forEach((layer, i) => {
      layer.tilePositionX += (delta / 1000) * (2 + i * 5);
    });
  }

  private buildParallax(w: number, h: number): void {
    const depths = [DEPTH.bgFar, DEPTH.bgMid, DEPTH.bgNear];
    for (let i = 0; i < BG_LAYERS; i++) {
      const layer = this.add.tileSprite(w / 2, h / 2, w, h, menuBgKey(i));
      layer.setDepth(depths[i]);
      this.layers.push(layer);
    }

    this.add.particles(0, 0, FX.sakura, {
      x: { min: 0, max: w },
      y: -12,
      lifespan: { min: 7000, max: 12000 },
      speedY: { min: 16, max: 42 },
      speedX: { min: -20, max: 20 },
      rotate: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0.5 },
      alpha: { start: 0.7, end: 0 },
      frequency: 420,
      quantity: 1,
    }).setDepth(DEPTH.weather);

    // Fireflies rising through the village.
    this.add.particles(0, 0, FX.spark, {
      x: { min: 0, max: w },
      y: h + 10,
      lifespan: { min: 5000, max: 9000 },
      speedY: { min: -30, max: -10 },
      speedX: { min: -14, max: 14 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: PALETTE.goldGlow,
      frequency: 700,
      quantity: 1,
    }).setDepth(DEPTH.props);
  }

  private buildTitle(w: number, h: number): void {
    const titleText = this.add
      .text(w / 2, h * 0.15, "YOKAI JUMP", TEXT.title(64))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    this.tweens.add({
      targets: titleText,
      scale: { from: 1, to: 1.05 },
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /** The equipped skin, standing on a lantern below the title. */
  private buildHero(w: number, h: number): void {
    const skin = equippedSkin();

    // A real three-tier stone toro — not the gameplay platform stretched
    // into a square — tall enough for the hero to stand on the roof ridge.
    const lantern = this.add.image(w / 2, h * 0.6, UI.lantern);
    lantern.setDisplaySize(150, 200);
    lantern.setDepth(DEPTH.props);

    const heroY = h * 0.45;
    const hero = this.add.sprite(w / 2, heroY, charKey(skin.id));
    hero.setDisplaySize(CHAR_W * 2.2, CHAR_H * 2.2);
    hero.setDepth(DEPTH.player);
    hero.play(charAnim(skin.id));

    this.tweens.add({
      targets: hero,
      y: heroY - 15,
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const glow = this.add.image(w / 2, heroY, UI.rarityGlow);
    glow.setDisplaySize(200, 200);
    glow.setTint(skin.palette.aura);
    glow.setAlpha(0.6);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setDepth(DEPTH.enemy);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.3, to: 0.6 },
      duration: 1600,
      yoyo: true,
      repeat: -1,
    });
  }

  private buildMenu(w: number, h: number): void {
    // Main PLAY button
    const playBtn = makeButton(
      this,
      w / 2,
      h * 0.73,
      "PLAY",
      () => transitionTo(this, "Game"),
      { width: 220, height: 75, fontSize: 36, variant: "primary" }
    );
    playBtn.setDepth(DEPTH.hud);
    // Remove Japanese subtitle to the button
    // (removed)

    // 4 bottom icons — flat ink pictograms with a glow rim, white caption,
    // matching the reference art instead of tinted generic icons.
    const iconY = h * 0.9;
    const icons = [
      { label: "BOUTIQUE", scene: "Shop", x: w * 0.2, icon: UI.shopIcon },
      { label: "RÉGLAGES", scene: "Settings", x: w * 0.4, icon: UI.gearIcon },
      { label: "CLASSEMENT", scene: "Leaderboard", x: w * 0.6, icon: UI.crownIcon },
      { label: "YOKAI", scene: "Shop", x: w * 0.8, icon: UI.bookIcon },
    ];

    icons.forEach((entry) => {
      const c = this.add.container(entry.x, iconY).setDepth(DEPTH.hud);

      const iconImg = this.add.image(0, 0, entry.icon)
        .setDisplaySize(36, 36)
        .setInteractive({ useHandCursor: true });

      iconImg.on("pointerdown", () => transitionTo(this, entry.scene));
      iconImg.on("pointerover", () => {
        this.tweens.add({ targets: iconImg, scale: 1.1, duration: 100 });
      });
      iconImg.on("pointerout", () => {
        this.tweens.add({ targets: iconImg, scale: 1, duration: 100 });
      });

      const lbl = this.add.text(0, 35, entry.label, TEXT.label(14, CSS.white)).setOrigin(0.5);

      c.add([iconImg, lbl]);
    });

    // Levels/Quests/Mini-Games tucked into a slim secondary row between PLAY
    // and the icon strip, instead of floating over the hero like the old
    // "ghost" buttons — the mockup's hero zone stays clean.
    const sideY = h * 0.815;
    const sideBtns = [
      { label: "Niveaux", scene: "Levels", x: w * 0.22 },
      { label: "Quêtes", scene: "Quests", x: w * 0.5 },
      { label: "Mini-Jeux", scene: "MiniGames", x: w * 0.78 },
    ];

    sideBtns.forEach((entry) => {
      const b = makeButton(this, entry.x, sideY, entry.label, () => transitionTo(this, entry.scene), { width: 128, height: 32, fontSize: 13, variant: "ghost" });
      b.setDepth(DEPTH.hud);
    });
  }

  private buildFooter(w: number, h: number): void {
    makeCoinBadge(this, w - 84, 34, loadCoins());

    const best = Number(localStorage.getItem("yokaijump.bestScore") ?? 0);
    this.add
      .text(w / 2, h - 30, `MEILLEUR SCORE — ${best}`, {
        fontFamily: FONT.ui,
        fontSize: "15px",
        color: CSS.gold,
        stroke: CSS.ink,
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
  }
}
