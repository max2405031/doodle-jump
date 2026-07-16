import { Scene } from "phaser";

import { CHAR_H, CHAR_W, FX, UI, charKey } from "../art/keys";
import { charAnim } from "../art/characters";
import { CSS, DEPTH, FONT, PALETTE, RARITY, TEXT } from "../config/theme";
import { SKINS, equipSkin, equippedSkinId, isOwned, unlockSkin, type SkinDef } from "../config/skins";
import { loadCoins, spendCoins } from "../config/wallet";
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
  type Button,
  type CoinBadge,
} from "../ui/UIKit";

/**
 * The skin gallery.
 *
 * The old shop showed a coloured circle with two dots as a "preview", and the
 * skin you bought was never applied to the player at all. Here you see the
 * actual in-game sprite, animated, and equipping it actually changes who you
 * play as.
 */
export class Shop extends Scene {
  private selected = 0;
  private coinBadge!: CoinBadge;
  private actionBtn!: Button;

  private preview!: Phaser.GameObjects.Sprite;
  private halo!: Phaser.GameObjects.Image;
  private lockIcon!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.Text;
  private rarityText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private priceText!: Phaser.GameObjects.Text;
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;

  private thumbs: Array<{
    container: Phaser.GameObjects.Container;
    frame: Phaser.GameObjects.Image;
    sprite: Phaser.GameObjects.Sprite;
    lock: Phaser.GameObjects.Image;
    check: Phaser.GameObjects.Image;
  }> = [];

  private strip!: Phaser.GameObjects.Container;

  constructor() {
    super("Shop");
  }

  create(): void {
    const { width } = this.scale;
    this.thumbs = [];

    this.selected = Math.max(0, SKINS.findIndex((s) => s.id === equippedSkinId()));

    makeSceneBackdrop(this, PALETTE.gold);
    makeHeader(this, "BOUTIQUE", "Choisis ton yokai");
    fadeIn(this);

    this.coinBadge = makeCoinBadge(this, width - 84, 40, loadCoins());

    this.buildStage();
    this.buildStrip();
    this.buildAction();

    makeBackButton(this, () => transitionTo(this, "MainMenu"));

    this.input.keyboard?.on("keydown-LEFT", () => this.step(-1));
    this.input.keyboard?.on("keydown-RIGHT", () => this.step(1));
    this.input.keyboard?.on("keydown-ESC", () => transitionTo(this, "MainMenu"));

    this.refresh();
  }

  /** The pedestal: rarity halo, the animated skin, rising sparks. */
  private buildStage(): void {
    const { width } = this.scale;
    const cx = width / 2;
    const cy = 250;

    makePanel(this, cx, cy + 6, width - 60, 260, { inset: true }).setDepth(DEPTH.props);

    this.halo = this.add.image(cx, cy - 14, UI.rarityGlow);
    this.halo.setDisplaySize(210, 210);
    this.halo.setBlendMode(Phaser.BlendModes.ADD);
    this.halo.setDepth(DEPTH.props + 1);
    this.tweens.add({ targets: this.halo, angle: 360, duration: 22000, repeat: -1 });
    this.tweens.add({
      targets: this.halo,
      scale: { from: 0.92, to: 1.05 },
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.sparkles = this.add.particles(cx, cy + 60, FX.spark, {
      x: { min: -60, max: 60 },
      lifespan: { min: 900, max: 1700 },
      speedY: { min: -60, max: -22 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.8, end: 0 },
      frequency: 130,
      quantity: 1,
    });
    this.sparkles.setDepth(DEPTH.props + 1);

    // The sprite is shown at 2.6x — the art is supersampled, so it stays sharp.
    this.preview = this.add.sprite(cx, cy - 20, charKey(SKINS[0].id));
    this.preview.setDisplaySize(CHAR_W * 2.6, CHAR_H * 2.6);
    this.preview.setDepth(DEPTH.pickup);
    this.tweens.add({
      targets: this.preview,
      y: cy - 30,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.lockIcon = this.add.image(cx, cy - 20, UI.lock);
    this.lockIcon.setDisplaySize(52, 60);
    this.lockIcon.setDepth(DEPTH.enemy);

    this.nameText = this.add.text(cx, cy + 92, "", TEXT.heading(28)).setOrigin(0.5).setDepth(DEPTH.hud);
    this.rarityText = this.add
      .text(cx, cy + 118, "", { fontFamily: FONT.ui, fontSize: "14px", color: CSS.textDim })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.descText = this.add
      .text(cx, cy + 144, "", {
        ...TEXT.label(14, CSS.textDim),
        align: "center",
        wordWrap: { width: this.scale.width - 110 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
  }

  /** Scrolling row of thumbnails, one per skin. */
  private buildStrip(): void {
    const { width } = this.scale;
    const y = 470;

    this.strip = this.add.container(0, y);
    this.strip.setDepth(DEPTH.hud);

    SKINS.forEach((skin, i) => {
      const c = this.add.container(0, 0);

      const frame = this.add.image(0, 0, UI.panelInset);
      frame.setDisplaySize(74, 84);

      const sprite = this.add.sprite(0, -4, charKey(skin.id));
      sprite.setDisplaySize(CHAR_W * 0.92, CHAR_H * 0.92);

      const lock = this.add.image(0, 0, UI.lock);
      lock.setDisplaySize(24, 28);

      const check = this.add.image(24, -28, UI.check);
      check.setDisplaySize(20, 20);

      c.add([frame, sprite, lock, check]);
      c.setSize(74, 84);
      frame.setInteractive({ useHandCursor: true });
      frame.on("pointerdown", () => this.select(i));
      frame.on("pointerover", () => AudioManager.play("hover"));

      this.strip.add(c);
      this.thumbs.push({ container: c, frame, sprite, lock, check });
    });

    // Chevrons.
    const left = this.add.image(26, y, UI.chevron).setDisplaySize(26, 26).setFlipX(true);
    const right = this.add.image(width - 26, y, UI.chevron).setDisplaySize(26, 26);
    [left, right].forEach((ch, i) => {
      ch.setDepth(DEPTH.hud);
      ch.setInteractive({ cursor: "pointer" });
      ch.on("pointerdown", () => this.step(i === 0 ? -1 : 1));
      ch.on("pointerover", () => ch.setTint(PALETTE.gold));
      ch.on("pointerout", () => ch.clearTint());
    });
  }

  private buildAction(): void {
    const { width } = this.scale;
    this.priceText = this.add
      .text(width / 2, 542, "", { fontFamily: FONT.ui, fontSize: "16px", color: CSS.gold })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    this.actionBtn = makeButton(this, width / 2, 594, "", () => this.act(), {
      width: 280,
      height: 58,
      fontSize: 20,
    });
    this.actionBtn.setDepth(DEPTH.hud);
  }

  private step(dir: number): void {
    this.select(Phaser.Math.Wrap(this.selected + dir, 0, SKINS.length));
  }

  private select(i: number): void {
    if (i === this.selected) return;
    this.selected = i;
    AudioManager.play("click");
    this.refresh();
  }

  private current(): SkinDef {
    return SKINS[this.selected];
  }

  /** Repaints every stateful bit in place — restarting the scene killed the tweens. */
  private refresh(): void {
    const skin = this.current();
    const owned = isOwned(skin.id);
    const equipped = equippedSkinId() === skin.id;
    const rarity = RARITY[skin.rarity];
    const coins = loadCoins();

    this.preview.setTexture(charKey(skin.id));
    this.preview.setDisplaySize(CHAR_W * 2.6, CHAR_H * 2.6);

    if (owned) {
      this.preview.clearTint();
      this.preview.play(charAnim(skin.id), true);
      this.lockIcon.setVisible(false);
    } else {
      // Locked: you see the silhouette and the shape, never the colours.
      this.preview.anims.stop();
      this.preview.setFrame(0);
      this.preview.setTint(0x120c22);
      this.lockIcon.setVisible(true);
    }

    this.halo.setTint(rarity.glow);
    this.halo.setAlpha(owned ? 0.85 : 0.35);
    this.sparkles.setParticleTint(rarity.glow);

    this.nameText.setText(skin.name);
    this.nameText.setColor(`#${rarity.color.toString(16).padStart(6, "0")}`);
    this.rarityText.setText(rarity.label);
    this.rarityText.setColor(`#${rarity.glow.toString(16).padStart(6, "0")}`);
    this.descText.setText(skin.desc);

    this.thumbs.forEach((t, i) => {
      const s = SKINS[i];
      const o = isOwned(s.id);
      const e = equippedSkinId() === s.id;
      const r = RARITY[s.rarity];

      t.frame.setTint(i === this.selected ? PALETTE.gold : r.color);
      t.frame.setAlpha(i === this.selected ? 1 : 0.65);
      t.sprite.setTint(o ? 0xffffff : 0x120c22);
      if (o) t.sprite.clearTint();
      t.lock.setVisible(!o);
      t.check.setVisible(e);
      t.container.setScale(i === this.selected ? 1.1 : 0.92);
    });

    this.layoutStrip();

    if (equipped) {
      this.priceText.setText("");
      this.actionBtn.setLabel("ÉQUIPÉ");
      this.actionBtn.setEnabled(false);
    } else if (owned) {
      this.priceText.setText("");
      this.actionBtn.setLabel("ÉQUIPER");
      this.actionBtn.setEnabled(true);
    } else if (coins >= skin.cost) {
      this.priceText.setText(`${skin.cost} pièces`);
      this.actionBtn.setLabel(`ACHETER — ${skin.cost}`);
      this.actionBtn.setEnabled(true);
    } else {
      this.priceText.setText(`Il te manque ${skin.cost - coins} pièces`);
      this.actionBtn.setLabel("PIÈCES INSUFFISANTES");
      this.actionBtn.setEnabled(false);
    }
  }

  /** Slide the strip so the selection stays centred. */
  private layoutStrip(): void {
    const { width } = this.scale;
    const gap = 84;
    this.thumbs.forEach((t, i) => {
      t.container.x = width / 2 + (i - this.selected) * gap;
    });
    this.thumbs.forEach((t) => {
      const d = Math.abs(t.container.x - width / 2);
      t.container.setAlpha(d > width / 2 - 20 ? 0 : 1);
    });
  }

  private act(): void {
    const skin = this.current();

    if (isOwned(skin.id)) {
      equipSkin(skin.id);
      AudioManager.play("powerup");
      makeToast(this, `${skin.name} équipé !`, "success");
      this.refresh();
      return;
    }

    if (!spendCoins(skin.cost)) {
      AudioManager.play("denied");
      makeToast(this, "Pièces insuffisantes", "error");
      return;
    }

    unlockSkin(skin.id);
    equipSkin(skin.id);
    AudioManager.play("purchase");

    this.coinBadge.setAmount(loadCoins());
    this.celebrate();
    makeToast(this, `${skin.name} débloqué et équipé !`, "success");
    this.refresh();
  }

  private celebrate(): void {
    const { width } = this.scale;
    this.cameras.main.flash(240, 255, 220, 140);

    const burst = this.add.particles(width / 2, 230, FX.coin, {
      speed: { min: 120, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0 },
      lifespan: 800,
      quantity: 26,
      maxParticles: 26,
      gravityY: 180,
    });
    burst.setDepth(DEPTH.overlay);
    this.time.delayedCall(1000, () => burst.destroy());

    this.tweens.add({
      targets: this.preview,
      scale: { from: this.preview.scale * 1.25, to: this.preview.scale },
      duration: 420,
      ease: "Back.easeOut",
    });
  }
}
