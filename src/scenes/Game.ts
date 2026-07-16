import { Scene } from "phaser";

// Removed MobileControls
import {
  BIOME_BONUS_COINS,
  BIOME_LABELS,
  BIOME_SUBTITLES,
  COMBO_BREAK_FALL,
  DARUMA_DURATION,
  GAME_HEIGHT,
  GAME_WIDTH,
  GRAVITY,
  JUMP_FORCE,
  KATANA_DURATION,
  KOI_DURATION,
  LOTUS_JUMP_MULTIPLIER,
  MANEKI_DURATION,
  ONIBI_DURATION,
  PLAYER_START_Y,
  RESPAWN_INVULN_MS,
  STOMP_BOUNCE,
  TUTORIAL_KEY,
  comboMultiplier,
} from "../config/constants";
import { addCoins } from "../config/wallet";
import { loadSettings } from "../config/settings";
import { recordRun } from "../config/stats";
import {
  CAMPAIGN,
  completeCampaignLevel,
  getCampaignLevel,
  upsertCustomLevel,
  type CampaignLevel,
  type CustomLevel,
} from "../config/levels";
import { biomeAt } from "../art/backgrounds";
import { BIOMES, FX, UI, type Biome, type PowerUpKind } from "../art/keys";
import { CSS, DEPTH, FONT, PALETTE, TEXT } from "../config/theme";
import { Player } from "../entities/Player";
import { PlatformManager } from "../entities/Platform";
import { EnemyManager, type EnemyData } from "../entities/Enemy";
import { PowerUpManager } from "../entities/PowerUp";
import { CoinManager } from "../entities/Coin";
import { ShurikenManager } from "../entities/ShurikenManager";
import { ParticleManager } from "../systems/Particles";
import { BackgroundManager } from "../systems/Background";
import { Juice } from "../systems/Juice";
import { AudioManager } from "../systems/Audio";
import { HUD } from "../ui/HUD";
import { makeButton, makePanel, transitionTo } from "../ui/UIKit";

type GameMode = "infinite" | "campaign" | "custom";

export interface GameConfig {
  mode?: GameMode;
  levelId?: string;
  level?: CustomLevel;
  /** Custom run launched from the editor to earn the right to publish. */
  validating?: boolean;
}

const POWERUP_COLOR: Record<PowerUpKind, number> = {
  katana: PALETTE.spirit,
  daruma: PALETTE.ember,
  koi_nobori: PALETTE.sakura,
  maneki_neko: PALETTE.gold,
  omamori: PALETTE.jade,
  onibi: PALETTE.cursed,
};

const POWERUP_TITLE: Record<PowerUpKind, string> = {
  katana: "KATANA",
  daruma: "DARUMA",
  koi_nobori: "KOI NOBORI",
  maneki_neko: "MANEKI NEKO",
  omamori: "OMAMORI",
  onibi: "ONIBI",
};

export class Game extends Scene {
  private config: GameConfig = {};
  private mode: GameMode = "infinite";
  private campaignLevel?: CampaignLevel;
  private customLevel?: CustomLevel;
  private validating = false;

  private player!: Player;
  private platformManager!: PlatformManager;
  private coinManager!: CoinManager;
  private enemyManager!: EnemyManager;
  private powerUpManager!: PowerUpManager;
  private particleManager!: ParticleManager;
  private backgroundManager!: BackgroundManager;
  private shurikenManager!: ShurikenManager;
  private hud!: HUD;
  private juice!: Juice;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private isMobile = false;
  private tiltX = 0;

  private gameOver = false;
  private finished = false;
  private ending = false;
  private tutorialActive = false;

  private goalClimb = 0;
  private finishWorldY = 0;
  private startY = PLAYER_START_Y;
  private spawnCoins = true;
  private spawnPowerUps = true;

  private scoreHeightOffset = 0;
  private highestReached = 0;

  private livesLeft = 3;
  private livesLost = 0;

  private combo = 0;
  private bestMult = 1;
  private lastBounceY = PLAYER_START_Y;

  private jumps = 0;
  private stomps = 0;
  private maxBiomeIdx = 0;
  private lastBannerIdx = 0;

  private hasManekiNeko = false;
  private manekiTimer?: Phaser.Time.TimerEvent;
  private startTime = 0;

  constructor() {
    super("Game");
  }

  init(data: GameConfig): void {
    this.config = data ?? {};
    this.mode = this.config.mode ?? "infinite";
    this.validating = Boolean(this.config.validating);
    this.campaignLevel = undefined;
    this.customLevel = undefined;

    this.gameOver = false;
    this.finished = false;
    this.ending = false;
    this.tutorialActive = false;
    this.scoreHeightOffset = 0;
    this.highestReached = 0;
    this.combo = 0;
    this.bestMult = 1;
    this.jumps = 0;
    this.stomps = 0;
    this.maxBiomeIdx = 0;
    this.lastBannerIdx = 0;
    this.livesLost = 0;
    this.hasManekiNeko = false;
  }

  create(): void {
    this.physics.resume();
    this.cameras.main.scrollY = 0;
    this.physics.world.gravity.y = GRAVITY;
    this.registry.set("gameConfig", this.config);

    this.resolveMode();

    this.backgroundManager = new BackgroundManager(this);
    this.backgroundManager.create();
    const biome = this.levelBiome();
    if (biome) this.backgroundManager.pinBiome(biome);

    this.buildWorld();

    this.player = new Player(this);
    this.lastBounceY = this.player.sprite.y;
    this.shurikenManager = new ShurikenManager(this);

    this.particleManager = new ParticleManager(this);
    this.particleManager.createSakura();
    this.juice = new Juice(this);

    if (this.mode !== "infinite") this.buildFinishGate();

    this.hud = new HUD(this);
    this.hud.create({
      mode: this.mode === "infinite" ? "infinite" : "level",
      lives: this.livesLeft,
      title: this.levelTitle(),
      goal: this.goalClimb,
      onPause: () => this.togglePause(),
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.keyboard!.on("keydown-ESC", () => this.togglePause());

    this.isMobile = this.sys.game.device.input.touch;
    if (this.isMobile) {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const initGyro = () => {
          (DeviceOrientationEvent as any).requestPermission()
            .then((permissionState: string) => {
              if (permissionState === 'granted') {
                window.addEventListener('deviceorientation', this.handleDeviceOrientation);
              }
            })
            .catch(console.error);
          document.body.removeEventListener('click', initGyro, true);
          document.body.removeEventListener('touchend', initGyro, true);
        };
        document.body.addEventListener('click', initGyro, true);
        document.body.addEventListener('touchend', initGyro, true);
      } else {
        window.addEventListener('deviceorientation', this.handleDeviceOrientation);
      }
      // Allow shooting by tapping the screen
      this.input.on("pointerdown", (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        // Only shoot if we didn't click a UI element like the pause button
        if (currentlyOver.length === 0) {
          this.handleShoot();
        }
      });
      this.events.once("shutdown", () => {
        window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
      });
    }

    this.setupCollisions();
    this.startTime = this.time.now;

    if (this.mode === "infinite") this.maybeShowTutorial();
    this.input.once("pointerdown", () => AudioManager.init());
  }

  private handleDeviceOrientation = (event: DeviceOrientationEvent): void => {
    // gamma is the left-to-right tilt in degrees, where right is positive
    this.tiltX = event.gamma || 0;
  };

  /* ------------------------------------------------------------------ */
  /* Mode & world set-up                                                 */
  /* ------------------------------------------------------------------ */

  private resolveMode(): void {
    const settings = loadSettings();

    if (this.mode === "campaign") {
      this.campaignLevel = getCampaignLevel(this.config.levelId ?? "c1") ?? CAMPAIGN[0];
      const p = this.campaignLevel.params;
      this.goalClimb = p.goal;
      this.livesLeft = p.lives;
      this.startY = PLAYER_START_Y;
      this.finishWorldY = PLAYER_START_Y - p.goal;
      this.spawnCoins = p.coins;
      this.spawnPowerUps = p.powerUps;
    } else if (this.mode === "custom" && this.config.level) {
      this.customLevel = this.config.level;
      this.goalClimb = this.customLevel.height;
      this.livesLeft = this.customLevel.lives;
      this.startY = GAME_HEIGHT - 26;
      this.finishWorldY = GAME_HEIGHT - 26 - this.customLevel.height;
      this.spawnCoins = false;
      this.spawnPowerUps = false;
    } else {
      this.mode = "infinite";
      this.livesLeft = settings.startingLives;
      this.goalClimb = 0;
      this.startY = PLAYER_START_Y;
      this.spawnCoins = true;
      this.spawnPowerUps = true;
    }
  }

  private levelBiome(): Biome | undefined {
    if (this.mode === "campaign") return this.campaignLevel?.params.biome;
    if (this.mode === "custom") return this.customLevel?.biome;
    return undefined;
  }

  private levelTitle(): string {
    if (this.mode === "campaign" && this.campaignLevel) {
      return `${this.campaignLevel.index + 1}. ${this.campaignLevel.name}`;
    }
    if (this.mode === "custom" && this.customLevel) return this.customLevel.name;
    return "";
  }

  private buildWorld(): void {
    if (this.mode === "campaign" && this.campaignLevel) {
      const p = this.campaignLevel.params;
      this.platformManager = new PlatformManager(this, {
        plan: { gapMin: p.gapMin, gapMax: p.gapMax, weights: p.platformWeights },
      });
      this.platformManager.spawnInitial();
      this.enemyManager = new EnemyManager(this, {
        plan: { kinds: p.enemyKinds, spacing: p.enemyKinds.length ? p.enemySpacing : Infinity },
      });
      this.powerUpManager = new PowerUpManager(this);
      this.coinManager = new CoinManager(this);
      return;
    }

    if (this.mode === "custom" && this.customLevel) {
      this.platformManager = new PlatformManager(this, { generate: false });
      this.platformManager.spawnGround();
      this.enemyManager = new EnemyManager(this, { generate: false });
      this.powerUpManager = new PowerUpManager(this);
      this.coinManager = new CoinManager(this);
      this.placeAuthored(this.customLevel);
      return;
    }

    this.platformManager = new PlatformManager(this);
    this.platformManager.spawnInitial();
    this.enemyManager = new EnemyManager(this);
    this.powerUpManager = new PowerUpManager(this);
    this.coinManager = new CoinManager(this);
  }

  /** Instantiates a hand-authored level at world coordinates. */
  private placeAuthored(level: CustomLevel): void {
    const floorY = GAME_HEIGHT - 26;
    // Summit ledge, so the finish gate is always something you can land on.
    for (let x = GAME_WIDTH / 2 - 84; x <= GAME_WIDTH / 2 + 84; x += 84) {
      this.platformManager.placePlatform(x, this.finishWorldY, "toro");
    }
    level.items.forEach((it) => {
      const y = floorY - it.y;
      switch (it.type) {
        case "platform":
          this.platformManager.placePlatform(it.x, y, it.kind);
          break;
        case "enemy":
          this.enemyManager.place(it.x, y, it.kind);
          break;
        case "coin":
          this.coinManager.spawnAt(it.x, y);
          break;
        case "powerup":
          this.powerUpManager.placePowerUp(it.x, y, it.kind);
          break;
      }
    });
  }

  private buildFinishGate(): void {
    const w = GAME_WIDTH;
    const y = this.finishWorldY;

    const glow = this.add
      .rectangle(w / 2, y + 8, w, 60, PALETTE.jade, 0.18)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.props);
    this.tweens.add({ targets: glow, alpha: { from: 0.1, to: 0.28 }, duration: 1200, yoyo: true, repeat: -1 });

    const gate = this.add.image(w / 2, y - 20, UI.torii).setDisplaySize(230, 190).setDepth(DEPTH.props);
    this.tweens.add({ targets: gate, scaleX: gate.scaleX * 1.04, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    this.add
      .text(w / 2, y - 96, "ARRIVÉE", { ...TEXT.heading(22), color: CSS.jade })
      .setOrigin(0.5)
      .setDepth(DEPTH.props);

    this.add.particles(w / 2, y, FX.star, {
      x: { min: -w / 2, max: w / 2 },
      y: { min: -10, max: 10 },
      lifespan: { min: 900, max: 1600 },
      speedY: { min: -18, max: -4 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: PALETTE.jadeDeep,
      frequency: 180,
      quantity: 1,
    }).setDepth(DEPTH.props);
  }

  /* ------------------------------------------------------------------ */
  /* Collisions                                                          */
  /* ------------------------------------------------------------------ */

  private setupCollisions(): void {
    this.physics.add.collider(
      this.player.sprite,
      this.platformManager.getGroup(),
      (_player, plat) => {
        const platSprite = plat as Phaser.Physics.Arcade.Sprite;
        const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
        if (playerBody.touching.down) {
          const result = this.platformManager.bounce(platSprite, JUMP_FORCE, LOTUS_JUMP_MULTIPLIER);
          if (!result) return;
          this.player.autoJump(result.force);
          this.registerBounce(result.boosted);
          this.particleManager.emitJump(this.player.sprite.x, this.player.sprite.y + 20);
          if (result.breaking) this.particleManager.emitBreak(platSprite.x, platSprite.y);
        }
      },
      undefined,
      this
    );

    this.physics.add.overlap(
      this.player.sprite,
      this.enemyManager.getGroup(),
      (_player, enemy) => this.onEnemyOverlap(enemy as Phaser.Physics.Arcade.Sprite)
    );

    this.physics.add.overlap(
      this.shurikenManager.getGroup(),
      this.enemyManager.getGroup(),
      (shuriken, enemy) => {
        const enemyData = this.enemyManager.getData(enemy as Phaser.Physics.Arcade.Sprite);
        if (enemyData) {
          enemyData.hp -= 1;
          if (enemyData.hp <= 0) this.killEnemy(enemyData);
        }
        shuriken.destroy();
      }
    );

    this.physics.add.overlap(
      this.player.sprite,
      this.powerUpManager.getGroup(),
      (_player, powerUp) => {
        const puSprite = powerUp as Phaser.Physics.Arcade.Sprite;
        const puKind = this.powerUpManager.getKind(puSprite);
        if (!puKind) return;
        this.applyPowerUp(puKind);
        this.particleManager.emitCoinCollect(puSprite.x, puSprite.y);
        puSprite.destroy();
      }
    );

    this.physics.add.overlap(
      this.player.sprite,
      this.coinManager.getGroup(),
      (_player, coin) => {
        const coinSprite = coin as Phaser.Physics.Arcade.Sprite;
        const value = this.coinManager.collect(coinSprite);
        if (value <= 0) return;
        const gain = value * comboMultiplier(this.combo);
        this.hud.addCoins(gain);
        AudioManager.play("coin");
        this.particleManager.emitCoinCollect(coinSprite.x, coinSprite.y);
      }
    );
  }

  private onEnemyOverlap(enemySprite: Phaser.Physics.Arcade.Sprite): void {
    if (this.gameOver || this.finished) return;
    const data = this.enemyManager.getData(enemySprite);
    if (!data) return;

    if (this.player.getHasKatana()) {
      this.killEnemy(data);
      return;
    }

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const onTop =
      body.velocity.y > 0 &&
      this.player.sprite.y + this.player.sprite.displayHeight / 2 < enemySprite.y + 12;

    if (onTop && data.stompable) {
      this.player.autoJump(STOMP_BOUNCE);
      this.registerBounce(true);
      this.juice.hitstop(45);
      this.particleManager.emitStomp(enemySprite.x, enemySprite.y);
      data.hp -= 1;
      if (data.hp <= 0) this.killEnemy(data);
      else AudioManager.play("land");
      return;
    }

    if (this.player.getInvincible()) return;

    if (this.player.consumeShield()) {
      AudioManager.play("shield");
      this.juice.flash(PALETTE.jade, 0.4, 160);
      this.player.autoJump(JUMP_FORCE * 0.7);
      return;
    }

    this.loseLife(false);
  }

  private killEnemy(data: EnemyData): void {
    this.stomps += 1;
    this.particleManager.emitEnemyDeath(data.sprite.x, data.sprite.y);
    AudioManager.play("enemyDeath");
    this.hud.addCoins(2);
    this.juice.popText(data.sprite.x, data.sprite.y - 14, "+2", PALETTE.gold);
    this.enemyManager.removeEnemy(data);
  }

  /* ------------------------------------------------------------------ */
  /* Combo & scoring                                                     */
  /* ------------------------------------------------------------------ */

  private registerBounce(boosted: boolean): void {
    this.jumps += 1;
    this.combo += 1;
    this.lastBounceY = this.player.sprite.y;

    const mult = comboMultiplier(this.combo);
    if (mult > this.bestMult) {
      this.bestMult = mult;
      if (mult > 1) this.juice.popText(this.player.sprite.x, this.player.sprite.y - 30, `×${mult}`, PALETTE.gold);
    }
    this.hud.setCombo(mult);
    AudioManager.play(boosted ? "superJump" : "jump");
  }

  private breakCombo(): void {
    if (this.combo === 0) return;
    this.combo = 0;
    this.hud.setCombo(1);
  }

  /* ------------------------------------------------------------------ */
  /* Update                                                              */
  /* ------------------------------------------------------------------ */

  update(_time: number, delta: number): void {
    if (this.gameOver || this.finished || this.tutorialActive) return;

    if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) this.handleShoot();

    const isLeft = this.cursors.left.isDown || this.tiltX < -8;
    const isRight = this.cursors.right.isDown || this.tiltX > 8;
    this.player.update(isLeft, isRight);

    const playerY = this.player.sprite.y;
    const cameraY = this.cameras.main.scrollY;

    const targetScroll = playerY - GAME_HEIGHT * 0.4;
    if (targetScroll < cameraY) this.cameras.main.scrollY = targetScroll;

    const climbed = Math.max(0, GAME_HEIGHT - 120 - playerY);
    if (climbed > this.highestReached) {
      this.highestReached = climbed;
      this.scoreHeightOffset = climbed;
      this.hud.setScore(Math.floor(climbed));
    }

    if (this.mode !== "infinite") {
      const p = (this.startY - playerY) / (this.startY - this.finishWorldY);
      this.hud.setProgress(p);
    }

    const spawned = this.platformManager.update(this.cameras.main.scrollY, delta, this.scoreHeightOffset);
    this.enemyManager.update(delta, this.cameras.main.scrollY, this.scoreHeightOffset);
    this.powerUpManager.update(this.cameras.main.scrollY);
    this.coinManager.update(this.cameras.main.scrollY);
    this.shurikenManager.update(this.cameras.main.scrollY);

    if (this.spawnPowerUps) this.powerUpManager.spawnFromPlatforms(spawned);
    if (this.spawnCoins) this.coinManager.spawnFromPlatforms(spawned);

    if (this.hasManekiNeko) {
      this.coinManager.attractToPlayer(this.player.sprite.x, this.player.sprite.y, 130);
    }

    if (playerY > this.lastBounceY + COMBO_BREAK_FALL) this.breakCombo();

    if (this.mode === "infinite") this.updateBiomeBanner();
    this.backgroundManager.update(this.cameras.main.scrollY, this.scoreHeightOffset);

    if (this.mode !== "infinite" && playerY <= this.finishWorldY) {
      this.win();
      return;
    }

    if (playerY > this.cameras.main.scrollY + GAME_HEIGHT + 80) this.loseLife(true);

    this.cameras.main.scrollY = Math.min(0, this.cameras.main.scrollY);
  }

  private updateBiomeBanner(): void {
    const idx = Math.max(0, BIOMES.indexOf(biomeAt(this.scoreHeightOffset)));
    if (idx > this.maxBiomeIdx) this.maxBiomeIdx = idx;
    if (idx <= this.lastBannerIdx) return;
    this.lastBannerIdx = idx;
    this.showBiomeBanner(BIOMES[idx]);
    this.hud.addCoins(BIOME_BONUS_COINS);
    AudioManager.play("milestone");
  }

  private showBiomeBanner(biome: Biome): void {
    const { width } = this.scale;
    const c = this.add.container(width / 2, 150).setScrollFactor(0).setDepth(DEPTH.overlay);

    const ribbon = this.add.image(0, 0, UI.ribbon).setDisplaySize(360, 66).setTint(PALETTE.cursed);
    const name = this.add.text(0, -10, BIOME_LABELS[biome], { ...TEXT.heading(22), color: CSS.goldGlow }).setOrigin(0.5);
    const sub = this.add.text(0, 16, BIOME_SUBTITLES[biome], TEXT.label(12, CSS.text)).setOrigin(0.5);
    c.add([ribbon, name, sub]);

    c.setScale(0.7);
    c.setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 360, ease: "Back.easeOut" });
    this.tweens.add({
      targets: c,
      alpha: 0,
      y: 120,
      delay: 2200,
      duration: 500,
      onComplete: () => c.destroy(),
    });
  }

  private handleShoot(): void {
    if (this.gameOver || this.finished) return;
    this.shurikenManager.shoot(this.player.sprite.x, this.player.sprite.y);
  }

  /* ------------------------------------------------------------------ */
  /* Power-ups                                                           */
  /* ------------------------------------------------------------------ */

  private applyPowerUp(kind: PowerUpKind): void {
    AudioManager.play("powerup");
    const color = POWERUP_COLOR[kind];

    switch (kind) {
      case "katana":
        this.player.activateKatana();
        this.hud.showPowerUp(POWERUP_TITLE[kind], color, KATANA_DURATION);
        break;
      case "daruma":
        this.player.activateDaruma();
        this.hud.showPowerUp(POWERUP_TITLE[kind], color, DARUMA_DURATION);
        break;
      case "koi_nobori":
        this.player.activateKoiNobori();
        this.hud.showPowerUp(POWERUP_TITLE[kind], color, KOI_DURATION);
        break;
      case "maneki_neko":
        this.hasManekiNeko = true;
        this.player.sprite.setTint(0xffd700);
        this.hud.showPowerUp(POWERUP_TITLE[kind], color, MANEKI_DURATION);
        this.manekiTimer?.remove(false);
        this.manekiTimer = this.time.delayedCall(MANEKI_DURATION, () => {
          this.hasManekiNeko = false;
          if (!this.player.getHasKatana() && !this.player.getHasShield()) this.player.sprite.clearTint();
        });
        break;
      case "omamori":
        this.player.activateOmamori();
        this.juice.popText(this.player.sprite.x, this.player.sprite.y - 30, "BOUCLIER", PALETTE.jade);
        break;
      case "onibi":
        this.player.activateOnibi();
        this.hud.showPowerUp(POWERUP_TITLE[kind], color, ONIBI_DURATION);
        this.juice.shake(0.01, 240);
        this.juice.trail(this.player.sprite, PALETTE.cursedGlow);
        this.time.delayedCall(ONIBI_DURATION, () => this.juice.stopTrail());
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Life, death & victory                                               */
  /* ------------------------------------------------------------------ */

  private loseLife(fell: boolean): void {
    if (this.finished || this.gameOver || this.ending) return;
    if (this.player.getInvincible()) return;

    this.livesLost += 1;
    this.breakCombo();
    AudioManager.play("hurt");
    this.juice.shake(0.02, 240);
    this.juice.flash(PALETTE.blood, 0.32, 160);

    const unlimited = this.livesLeft < 0;
    if (!unlimited) {
      this.livesLeft -= 1;
      this.hud.setLives(this.livesLeft);
    }

    if (!unlimited && this.livesLeft <= 0) {
      this.player.showHurt(600);
      this.endRun();
      return;
    }

    this.player.showHurt(700);
    if (fell) {
      this.rescue();
    } else {
      this.player.setTemporaryInvincible(RESPAWN_INVULN_MS);
      this.player.autoJump(JUMP_FORCE * 0.82);
    }
  }

  /** Conjures a platform under a player who fell, and sets them back on it. */
  private rescue(): void {
    const camY = this.cameras.main.scrollY;
    const y = camY + GAME_HEIGHT - 150;
    const x = Phaser.Math.Clamp(this.player.sprite.x, 60, GAME_WIDTH - 60);
    this.platformManager.spawnRescue(x, y);
    this.player.sprite.setPosition(x, y - 44);
    (this.player.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, JUMP_FORCE);
    this.player.setTemporaryInvincible(RESPAWN_INVULN_MS);
    this.lastBounceY = y;
  }

  private win(): void {
    if (this.finished || this.gameOver) return;
    this.finished = true;
    this.juice.stopTrail();
    this.physics.pause();

    AudioManager.play("questComplete");
    this.juice.flash(PALETTE.gold, 0.4, 260);
    this.juice.shake(0.006, 260);
    this.cameras.main.flash(200, 255, 240, 180);

    this.commitStats(true);

    if (this.mode === "campaign" && this.campaignLevel) {
      const stars = this.livesLost === 0 ? 3 : this.livesLost === 1 ? 2 : 1;
      completeCampaignLevel(this.campaignLevel.index, stars);
      this.time.delayedCall(700, () => this.showOutcome(true, stars));
      return;
    }

    if (this.mode === "custom" && this.customLevel) {
      const elapsed = Math.round(this.time.now - this.startTime);
      this.customLevel.validated = true;
      if (!this.customLevel.bestTimeMs || elapsed < this.customLevel.bestTimeMs) {
        this.customLevel.bestTimeMs = elapsed;
      }
      upsertCustomLevel(this.customLevel);
      this.time.delayedCall(700, () => this.showOutcome(true));
    }
  }

  private endRun(): void {
    if (this.ending) return;
    this.ending = true;
    this.gameOver = true;
    this.juice.stopTrail();
    this.cameras.main.shake(300, 0.015);

    this.commitStats(false);

    if (this.mode === "infinite") {
      this.time.delayedCall(600, () => {
        const finalScore = Math.floor(this.scoreHeightOffset);
        const bestScore = Number(localStorage.getItem("yokaijump.bestScore") ?? 0);
        const nextBest = Math.max(bestScore, finalScore);
        localStorage.setItem("yokaijump.bestScore", String(nextBest));
        this.registry.set("lastScore", finalScore);
        this.registry.set("bestScore", nextBest);
        this.registry.set("lastCoins", this.hud.getSessionCoins());
        transitionTo(this, "GameOver");
      });
      return;
    }

    this.physics.pause();
    this.time.delayedCall(600, () => this.showOutcome(false));
  }

  private commitStats(won: boolean): void {
    const sessionCoins = this.hud.getSessionCoins();
    if (sessionCoins > 0) addCoins(sessionCoins);
    recordRun({
      coins: sessionCoins,
      jumps: this.jumps,
      stomps: this.stomps,
      combo: this.bestMult,
      score: this.mode === "infinite" ? Math.floor(this.scoreHeightOffset) : 0,
      biome: this.mode === "infinite" ? this.maxBiomeIdx : this.biomeIndexOfLevel(),
      levelCompleted: won && this.mode === "campaign",
    });
  }

  private biomeIndexOfLevel(): number {
    const b = this.levelBiome();
    return b ? Math.max(0, BIOMES.indexOf(b)) : 0;
  }

  /* ------------------------------------------------------------------ */
  /* Outcome overlay (level modes)                                       */
  /* ------------------------------------------------------------------ */

  private showOutcome(won: boolean, stars = 0): void {
    const { width, height } = this.scale;

    const shade = this.add
      .rectangle(width / 2, height / 2, width, height, PALETTE.void, 0.82)
      .setScrollFactor(0)
      .setDepth(DEPTH.overlay)
      .setAlpha(0);
    this.tweens.add({ targets: shade, alpha: 1, duration: 240 });

    const layer = this.add.container(width / 2, height / 2).setScrollFactor(0).setDepth(DEPTH.overlay + 1);
    const parts: Phaser.GameObjects.GameObject[] = [makePanel(this, 0, 0, 400, 470)];

    const title = won ? this.winTitle() : this.loseTitle();
    parts.push(
      this.add.text(0, -186, title.main, { ...TEXT.title(30), color: won ? CSS.jade : CSS.ember }).setOrigin(0.5)
    );
    parts.push(
      this.add
        .text(0, -146, title.sub, { ...TEXT.label(14, CSS.textDim), align: "center", wordWrap: { width: 320 } })
        .setOrigin(0.5)
    );

    if (won && this.mode === "campaign") parts.push(...this.buildStars(stars));

    // Session summary.
    const coins = this.hud.getSessionCoins();
    parts.push(
      this.add.text(0, -46, `Sauts ${this.jumps}   •   Yokai ${this.stomps}   •   Combo ×${this.bestMult}`, TEXT.label(13, CSS.textFaint)).setOrigin(0.5)
    );
    if (coins > 0) {
      const coinLabel = this.add.text(8, -20, `+${coins} pièces`, { ...TEXT.button(18), color: CSS.gold }).setOrigin(0, 0.5);
      const coinIcon = this.add.image(-8 - 0, -20, UI.coinIcon).setDisplaySize(22, 22);
      coinIcon.x = -coinLabel.width / 2 - 4;
      coinLabel.x = -coinLabel.width / 2 + 18;
      parts.push(coinIcon, coinLabel);
    }

    layer.add(parts);
    this.buildOutcomeButtons(layer, won);

    layer.setScale(0.86);
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, scale: 1, alpha: 1, duration: 340, ease: "Back.easeOut" });
  }

  private winTitle(): { main: string; sub: string } {
    if (this.mode === "custom" && this.validating) {
      return { main: "NIVEAU VALIDÉ", sub: "Tu l'as terminé ! Retourne à l'éditeur pour le publier." };
    }
    if (this.mode === "custom") {
      const t = this.customLevel?.bestTimeMs ? `Meilleur temps — ${(this.customLevel.bestTimeMs / 1000).toFixed(1)}s` : "";
      return { main: "TERMINÉ !", sub: t };
    }
    return { main: "NIVEAU TERMINÉ", sub: this.campaignLevel?.subtitle ?? "" };
  }

  private loseTitle(): { main: string; sub: string } {
    if (this.mode === "custom" && this.validating) {
      return { main: "PAS ENCORE", sub: "Tu dois terminer ton propre niveau pour pouvoir le publier." };
    }
    return { main: "NIVEAU ÉCHOUÉ", sub: "Les yokai t'ont eu. Réessaie !" };
  }

  private buildStars(stars: number): Phaser.GameObjects.GameObject[] {
    const out: Phaser.GameObjects.GameObject[] = [];
    for (let i = 0; i < 3; i++) {
      const lit = i < stars;
      const s = this.add.image((i - 1) * 56, -104, UI.star).setDisplaySize(lit ? 46 : 38, lit ? 46 : 38);
      s.setTint(lit ? PALETTE.gold : PALETTE.surfaceHi);
      if (lit) {
        s.setScale(0);
        this.tweens.add({ targets: s, scale: (46 / 38) * 1, duration: 320, delay: 200 + i * 160, ease: "Back.easeOut" });
      }
      out.push(s);
    }
    return out;
  }

  private buildOutcomeButtons(layer: Phaser.GameObjects.Container, won: boolean): void {
    const specs: Array<{ label: string; variant: "primary" | "secondary" | "ghost"; act: () => void }> = [];

    if (this.mode === "campaign" && this.campaignLevel) {
      const next = CAMPAIGN[this.campaignLevel.index + 1];
      if (won && next) {
        specs.push({ label: "NIVEAU SUIVANT", variant: "primary", act: () => transitionTo(this, "Game", { mode: "campaign", levelId: next.id }) });
      }
      specs.push({ label: won ? "REJOUER" : "RÉESSAYER", variant: won && next ? "secondary" : "primary", act: () => transitionTo(this, "Game", { mode: "campaign", levelId: this.campaignLevel!.id }) });
      specs.push({ label: "NIVEAUX", variant: "ghost", act: () => transitionTo(this, "Levels") });
    } else if (this.mode === "custom") {
      if (this.validating) {
        specs.push({ label: "RETOUR À L'ÉDITEUR", variant: "primary", act: () => transitionTo(this, "LevelEditor", { levelId: this.customLevel?.id, justValidated: won }) });
        if (!won) specs.push({ label: "RÉESSAYER", variant: "secondary", act: () => transitionTo(this, "Game", this.config) });
      } else {
        specs.push({ label: won ? "REJOUER" : "RÉESSAYER", variant: "primary", act: () => transitionTo(this, "Game", this.config) });
        specs.push({ label: "NIVEAUX", variant: "ghost", act: () => transitionTo(this, "Levels") });
      }
    }

    const startY = 78;
    specs.forEach((spec, i) => {
      const btn = makeButton(this, 0, startY + i * 60, spec.label, spec.act, {
        width: 280,
        height: 50,
        fontSize: 18,
        variant: spec.variant,
      });
      layer.add(btn);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Tutorial & pause                                                    */
  /* ------------------------------------------------------------------ */

  private maybeShowTutorial(): void {
    if (localStorage.getItem(TUTORIAL_KEY)) return;
    localStorage.setItem(TUTORIAL_KEY, "1");

    this.tutorialActive = true;
    this.physics.pause();

    const { width, height } = this.scale;
    const layer = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.modal);

    const shade = this.add.rectangle(width / 2, height / 2, width, height, PALETTE.void, 0.72).setInteractive();
    const panel = makePanel(this, width / 2, height / 2, 400, 340);
    const title = this.add.text(width / 2, height / 2 - 128, "COMMENT JOUER", TEXT.heading(26)).setOrigin(0.5);

    const lines = [
      "◄ ►  ou incline l'appareil pour te déplacer",
      "Le saut est automatique sur les plateformes",
      "ESPACE ou tape l'écran pour lancer un shuriken",
      "Saute SUR les yokai pour les écraser",
      "Ramasse les pièces et les pouvoirs",
      "Ne tombe pas dans le vide !",
    ];
    const body = this.add
      .text(width / 2, height / 2 - 6, lines.join("\n"), {
        ...TEXT.label(15, CSS.text),
        align: "center",
        lineSpacing: 9,
      })
      .setOrigin(0.5);

    const tap = this.add
      .text(width / 2, height / 2 + 132, "Appuie pour commencer", { fontFamily: FONT.ui, fontSize: "15px", color: CSS.spirit })
      .setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: { from: 0.4, to: 1 }, duration: 620, yoyo: true, repeat: -1 });

    layer.add([shade, panel, title, body, tap]);

    const dismiss = (): void => {
      this.tutorialActive = false;
      this.physics.resume();
      this.tweens.add({ targets: layer, alpha: 0, duration: 240, onComplete: () => layer.destroy() });
      this.input.off("pointerdown", dismiss);
    };
    this.time.delayedCall(350, () => {
      this.input.on("pointerdown", dismiss);
      this.input.keyboard?.once("keydown-SPACE", dismiss);
      this.input.keyboard?.once("keydown-ENTER", dismiss);
    });
  }

  private togglePause(): void {
    if (this.gameOver || this.finished || this.tutorialActive) return;
    this.scene.pause();
    this.scene.launch("PauseMenu");
  }
}
