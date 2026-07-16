import { Scene } from "phaser";

import { registerBackgrounds } from "../art/backgrounds";
import { registerCharacters } from "../art/characters";
import { registerMonsters } from "../art/monsters";
import { registerProps } from "../art/props";
import { registerUI } from "../art/ui";
import { CSS, FONT, PALETTE, TEXT } from "../config/theme";
import { circle, glow, hex, linGrad, radGrad, rng } from "../art/paint";

interface Step {
  label: string;
  run: () => void;
}

/**
 * Generates every texture in the game.
 *
 * All art is procedural, so "loading" is really "painting": tens of
 * supersampled canvases. That work is chunked one step per frame — doing it in
 * a single blocking pass freezes the tab and the progress bar never draws.
 */
export class Preloader extends Scene {
  private steps: Step[] = [];
  private index = 0;
  private fill!: Phaser.GameObjects.Rectangle;
  private sweep!: Phaser.GameObjects.Rectangle;
  private status!: Phaser.GameObjects.Text;
  private barX = 0;
  private barW = 0;
  private ready = false;

  constructor() {
    super("Preloader");
  }

  preload(): void {
    this.load.audio("bgm", "assets/audio/bgm.ogg");
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(PALETTE.void);

    this.paintBackdrop(width, height);
    this.paintTorii(width, height);

    this.add.text(width / 2, height * 0.34, "YOKAI JUMP", TEXT.title(46)).setOrigin(0.5);



    this.buildBar(width, height);
    this.buildSteps();

    // Phaser measures text with whatever font is resolved at creation time, so
    // the queue must not start until the webfonts are actually in.
    const start = (): void => {
      this.ready = true;
    };
    if (document.fonts?.ready) {
      document.fonts.ready.then(start).catch(start);
    } else {
      start();
    }
  }

  update(): void {
    if (!this.ready) return;

    if (this.index >= this.steps.length) {
      this.ready = false;
      this.status.setText("Prêt.");
      this.cameras.main.fadeOut(320, 7, 6, 15);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("MainMenu"));
      return;
    }

    const step = this.steps[this.index];
    this.status.setText(step.label);
    step.run();
    this.index++;

    const t = this.index / this.steps.length;
    this.fill.width = Math.max(1, (this.barW - 4) * t);
    this.sweep.x = this.barX + 2 + this.fill.width;
  }

  private buildSteps(): void {
    this.steps = [
      { label: "Forge des sceaux…", run: () => registerUI(this) },
      { label: "Taille des lanternes de pierre…", run: () => registerProps(this) },
      { label: "Invocation des yokai gardiens…", run: () => registerCharacters(this) },
      { label: "Réveil de ce qui dort…", run: () => registerMonsters(this) },
      { label: "Peinture des sanctuaires…", run: () => registerBackgrounds(this) },
    ];
  }

  private buildBar(width: number, height: number): void {
    this.barW = 300;
    this.barX = width / 2 - this.barW / 2;
    const barY = height * 0.6;

    this.add
      .rectangle(width / 2, barY, this.barW, 16)
      .setStrokeStyle(2, PALETTE.goldDeep, 0.9)
      .setFillStyle(PALETTE.void, 0.7);

    this.fill = this.add.rectangle(this.barX + 2, barY, 0, 10, PALETTE.gold).setOrigin(0, 0.5);

    // A brighter head on the bar so it reads as molten rather than a flat block.
    this.sweep = this.add
      .rectangle(this.barX + 2, barY, 6, 10, PALETTE.goldGlow)
      .setOrigin(0.5, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.status = this.add
      .text(width / 2, barY + 30, "…", {
        fontFamily: FONT.body,
        fontSize: "15px",
        color: CSS.textDim,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: this.sweep,
      alpha: { from: 1, to: 0.35 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
  }

  private paintBackdrop(w: number, h: number): void {
    const g = this.add.graphics();
    g.fillGradientStyle(PALETTE.bgDeep, PALETTE.bgDeep, PALETTE.void, PALETTE.void, 1);
    g.fillRect(0, 0, w, h);

    const rand = rng(7);
    for (let i = 0; i < 70; i++) {
      g.fillStyle(PALETTE.white, 0.1 + rand() * 0.4);
      g.fillCircle(rand() * w, rand() * h, 0.4 + rand() * 1.2);
    }

    // Drifting petals, so the load screen isn't dead air.
    for (let i = 0; i < 12; i++) {
      const petal = this.add.rectangle(rand() * w, rand() * h, 5, 3, PALETTE.sakura, 0.5);
      petal.setAngle(rand() * 360);
      this.tweens.add({
        targets: petal,
        y: h + 20,
        x: petal.x + (rand() - 0.5) * 90,
        angle: petal.angle + 220,
        duration: 6000 + rand() * 5000,
        repeat: -1,
        delay: i * 260,
        onRepeat: () => {
          petal.y = -10;
          petal.x = Math.random() * w;
        },
      });
    }
  }

  /** Torii behind the title, hand-painted: the UI atlas isn't generated yet. */
  private paintTorii(w: number, h: number): void {
    const key = "preloader_torii";
    if (this.textures.exists(key)) this.textures.remove(key);

    const tex = this.textures.createCanvas(key, 220, 190);
    if (!tex) return;
    const ctx = tex.getContext();
    const cx = 110;

    glow(ctx, PALETTE.blood, 16, 2, () => {
      ctx.fillStyle = hex(0x7a1420, 0.9);
      ctx.fillRect(cx - 70, 34, 140, 12);
    });

    ctx.fillStyle = linGrad(ctx, cx - 80, 0, cx + 80, 0, [
      [0, 0x5c0f18],
      [0.5, 0xa8262f],
      [1, 0x5c0f18],
    ]);
    // Lintel with upswept ends.
    ctx.beginPath();
    ctx.moveTo(cx - 84, 30);
    ctx.quadraticCurveTo(cx, 20, cx + 84, 30);
    ctx.lineTo(cx + 84, 42);
    ctx.quadraticCurveTo(cx, 34, cx - 84, 42);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - 62, 52, 124, 9);
    ctx.fillRect(cx - 52, 42, 13, 130);
    ctx.fillRect(cx + 39, 42, 13, 130);

    ctx.fillStyle = radGrad(ctx, cx, 56, 60, [
      [0, PALETTE.goldGlow, 0.25],
      [1, PALETTE.gold, 0],
    ]);
    circle(ctx, cx, 56, 60);
    ctx.fill();

    tex.refresh();

    this.add.image(w / 2, h * 0.36, key).setAlpha(0.35).setScale(1.5).setDepth(-1);
  }
}
