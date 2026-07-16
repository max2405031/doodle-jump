import { Scene } from "phaser";

import { ENEMY_SIZE, FX, UI, bgKey, enemyAnim, enemyKey } from "../art/keys";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { CSS, DEPTH, FONT, TEXT } from "../config/theme";
import { AudioManager } from "../systems/Audio";
import { BEST_KEY, loadBest, saveBest, showMiniGameOver } from "./MiniGames";
import { fadeIn, makeButton, transitionTo } from "../ui/UIKit";

const PILLAR_KEY = "mg_flappy_pillar";
const BEAM_KEY = "mg_flappy_beam";
const PILLAR_W = 60;
const BEAM_W = 96;
const BEAM_H = 22;
const FLAP_VELOCITY = -360;
const START_GAP = 250;
const MIN_GAP = 175;
const START_SPEED = 190;

/**
 * Flappy Tengu — flap the crow yokai through the torii of the sanctuary. One
 * touch ends the flight. Real sprite, parallax sky, and the shared mini-game
 * result panel with a saved record.
 */
export class FlappyTengu extends Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private decor!: Phaser.Physics.Arcade.Group;
  private layers: Phaser.GameObjects.TileSprite[] = [];
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private gameOver = false;
  private started = false;
  private spawnTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super("FlappyTengu");
  }

  create(): void {
    this.gameOver = false;
    this.started = false;
    this.score = 0;
    this.layers = [];

    this.buildSky();
    this.ensurePillarTexture();

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.decor = this.physics.add.group({ allowGravity: false, immovable: true });

    const size = ENEMY_SIZE.tengu;
    this.player = this.physics.add.sprite(140, GAME_HEIGHT / 2, enemyKey("tengu"));
    this.player.setDisplaySize(size.w * 1.2, size.h * 1.2);
    this.player.setDepth(DEPTH.player);
    this.player.play(enemyAnim("tengu"));
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(size.w * 0.6, size.h * 0.6);
    body.setAllowGravity(false);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 70, "0", { ...TEXT.score(52), color: CSS.goldGlow })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90, "Appuie pour battre des ailes", {
        fontFamily: FONT.ui,
        fontSize: "18px",
        color: CSS.text,
        stroke: CSS.ink,
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.tweens.add({ targets: hint, alpha: { from: 0.4, to: 1 }, duration: 600, yoyo: true, repeat: -1 });

    this.input.on("pointerdown", () => this.flap(hint), this);
    this.input.keyboard?.on("keydown-SPACE", () => this.flap(hint), this);

    this.physics.add.overlap(this.player, this.obstacles, () => this.die(), undefined, this);

    makeButton(this, 60, GAME_HEIGHT - 34, "RETOUR", () => transitionTo(this, "MiniGames"), {
      width: 108,
      height: 40,
      fontSize: 15,
      variant: "ghost",
    }).setDepth(DEPTH.hud);
    this.input.keyboard?.once("keydown-ESC", () => transitionTo(this, "MiniGames"));

    fadeIn(this);
  }

  private buildSky(): void {
    const depths = [DEPTH.bgFar, DEPTH.bgMid, DEPTH.bgNear];
    for (let i = 0; i < 3; i++) {
      const layer = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, bgKey("forest", i));
      layer.setDepth(depths[i]);
      this.layers.push(layer);
    }
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, UI.vignette)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTH.fx);
  }

  /**
   * A vermilion torii post and its crossbeam, baked once. Red against the green
   * bamboo forest reads instantly as a gate — a green pillar just vanished into
   * the background.
   */
  private ensurePillarTexture(): void {
    if (!this.textures.exists(PILLAR_KEY)) {
      const w = PILLAR_W;
      const h = 128;
      const g = this.add.graphics();
      g.fillStyle(0x3a0f0c, 1);
      g.fillRoundedRect(0, 0, w, h, 8);
      g.fillGradientStyle(0xe75437, 0xb5301f, 0xcf3f27, 0x8f2417, 1);
      g.fillRoundedRect(3, 3, w - 6, h - 6, 6);
      g.fillStyle(0xffa184, 0.4);
      g.fillRoundedRect(9, 6, 8, h - 12, 4);
      g.generateTexture(PILLAR_KEY, w, h);
      g.destroy();
    }
    if (!this.textures.exists(BEAM_KEY)) {
      const g = this.add.graphics();
      // Kasagi (top lintel): black cap over a red beam, torii-style.
      g.fillStyle(0x241512, 1);
      g.fillRoundedRect(0, 0, BEAM_W, 9, 4);
      g.fillGradientStyle(0xe75437, 0xb5301f, 0xcf3f27, 0x8f2417, 1);
      g.fillRoundedRect(4, 8, BEAM_W - 8, BEAM_H - 8, 3);
      g.generateTexture(BEAM_KEY, BEAM_W, BEAM_H);
      g.destroy();
    }
  }

  private flap(hint: Phaser.GameObjects.Text): void {
    if (this.gameOver) return;
    if (!this.started) this.start(hint);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(FLAP_VELOCITY);
    this.player.setAngle(-18);
    AudioManager.play("flap");
  }

  private start(hint: Phaser.GameObjects.Text): void {
    this.started = true;
    hint.destroy();
    (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    this.physics.world.gravity.y = 1150;
    this.spawnTimer = this.time.addEvent({ delay: 1450, callback: this.spawnObstacle, callbackScope: this, loop: true });
    this.spawnObstacle();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.layers.forEach((layer, i) => (layer.tilePositionX += dt * (8 + i * 22)));

    if (!this.started || this.gameOver) return;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.player.setAngle(Phaser.Math.Clamp(body.velocity.y / 22, -22, 70));

    if (this.player.y > GAME_HEIGHT - 20 || this.player.y < 10) {
      this.die();
      return;
    }

    this.obstacles.getChildren().forEach((obj) => {
      const pillar = obj as Phaser.GameObjects.TileSprite;
      if (pillar.getData("scorer") && !pillar.getData("counted") && pillar.x + PILLAR_W / 2 < this.player.x) {
        pillar.setData("counted", true);
        this.score += 1;
        this.scoreText.setText(String(this.score));
        this.tweens.add({ targets: this.scoreText, scale: { from: 1.3, to: 1 }, duration: 160 });
        AudioManager.play("coin");
      }
      if (pillar.x < -PILLAR_W) pillar.destroy();
    });
    this.decor.getChildren().forEach((obj) => {
      const beam = obj as Phaser.GameObjects.Image;
      if (beam.x < -BEAM_W) beam.destroy();
    });
  }

  private spawnObstacle(): void {
    if (this.gameOver) return;

    const gap = Math.max(MIN_GAP, START_GAP - this.score * 4);
    const speed = START_SPEED + this.score * 6;
    const margin = 90;
    const gapCenter = Phaser.Math.Between(margin + gap / 2, GAME_HEIGHT - margin - gap / 2 - 30);

    const topH = gapCenter - gap / 2;
    const botH = GAME_HEIGHT - 30 - (gapCenter + gap / 2);
    const x = GAME_WIDTH + PILLAR_W;

    const top = this.makePillar(x, topH / 2, topH, speed);
    top.setData("scorer", true);
    this.makePillar(x, GAME_HEIGHT - 30 - botH / 2, botH, speed);

    // Torii crossbeams frame the gap, so it reads as a gate to fly through.
    this.makeBeam(x, gapCenter - gap / 2, speed);
    this.makeBeam(x, gapCenter + gap / 2, speed, true);
  }

  private makePillar(x: number, y: number, height: number, speed: number): Phaser.GameObjects.TileSprite {
    const pillar = this.add.tileSprite(x, y, PILLAR_W, Math.max(20, height), PILLAR_KEY);
    pillar.setDepth(DEPTH.platform);
    this.obstacles.add(pillar);
    const body = pillar.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setVelocityX(-speed);
    return pillar;
  }

  private makeBeam(x: number, y: number, speed: number, flip = false): void {
    const beam = this.add.image(x, y, BEAM_KEY).setDisplaySize(BEAM_W, BEAM_H).setDepth(DEPTH.platform + 1);
    if (flip) beam.setFlipY(true);
    this.decor.add(beam);
    const body = beam.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityX(-speed);
  }

  private die(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.spawnTimer?.remove();
    this.physics.pause();
    this.player.setTint(0xff6a6a);
    this.cameras.main.shake(240, 0.012);
    AudioManager.play("death");

    this.add.particles(this.player.x, this.player.y, FX.death, {
      speed: { min: 60, max: 180 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 700,
      quantity: 16,
      maxParticles: 16,
    }).setDepth(DEPTH.fx);

    const best = loadBest(BEST_KEY.flappy);
    const record = saveBest(BEST_KEY.flappy, this.score);
    const verdict =
      this.score >= 30 ? "Vol de maître !" : this.score >= 15 ? "Beau vol." : this.score >= 5 ? "Ça vient." : "Rebats des ailes.";

    this.time.delayedCall(650, () =>
      showMiniGameOver(this, {
        title: "VOL TERMINÉ",
        score: this.score,
        best,
        record,
        verdict,
        onReplay: () => this.scene.restart(),
      })
    );
  }
}
