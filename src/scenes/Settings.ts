import { Scene } from "phaser";

import { UI } from "../art/keys";
import { UI_EXTRA } from "../art/ui";
import { CSS, DEPTH, FONT, PALETTE, TEXT } from "../config/theme";
import {
  LIVES_OPTIONS,
  formatVolume,
  loadSettings,
  nextLivesOption,
  nextVolumeOption,
  saveSettings,
  type GameSettings,
} from "../config/settings";
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

/* Layout — shared with Leaderboard and PauseMenu so the three screens line up. */
const PANEL_W = 444;
const ROW_H = 64;
const ROW_TOP = 140;
const ROW_GAP = 68;
const LABEL_X = 48;
const VALUE_X = 300;
const CTRL_X = 385;
const BTN_W = 280;
const BTN_H = 52;


/** Every game key lives under this prefix — the reset sweeps them by prefix so
 *  progression added later (quests, stats) is wiped too, without a hardcoded list. */
const KEY_PREFIX = "yokaijump.";

interface Switch {
  set(value: boolean): void;
}

/**
 * Settings.
 *
 * Doubles as an overlay: the pause menu launches it with `{ from: "PauseMenu" }`
 * over the still-paused Game, so tweaking the volume mid-run never costs you the
 * run. In that mode "back" hands control straight back to the pause overlay.
 */
export class Settings extends Scene {
  private settings!: GameSettings;
  private from = "MainMenu";
  private busy = false;

  /** Volume steps, derived from nextVolumeOption so the ladder is defined once. */
  private steps: number[] = [];

  private sfxSwitch!: Switch;
  private sfxValue!: Phaser.GameObjects.Text;

  private musicSwitch!: Switch;
  private musicValue!: Phaser.GameObjects.Text;

  private wrapSwitch!: Switch;
  private wrapValue!: Phaser.GameObjects.Text;

  private volumeGroup: Phaser.GameObjects.GameObject[] = [];
  private volumeBars: Phaser.GameObjects.Rectangle[] = [];
  private volumeValue!: Phaser.GameObjects.Text;

  private musicGroup: Phaser.GameObjects.GameObject[] = [];
  private musicBars: Phaser.GameObjects.Rectangle[] = [];
  private musicVolumeValue!: Phaser.GameObjects.Text;

  private hearts: Phaser.GameObjects.Image[] = [];
  private infinity!: Phaser.GameObjects.Text;
  private livesValue!: Phaser.GameObjects.Text;

  private modal?: Phaser.GameObjects.Container;

  constructor() {
    super("Settings");
  }

  init(data: { from?: string }): void {
    this.from = data?.from === "PauseMenu" ? "PauseMenu" : "MainMenu";
    this.busy = false;
    this.modal = undefined;
    this.volumeGroup = [];
    this.volumeBars = [];
    this.musicGroup = [];
    this.musicBars = [];
    this.hearts = [];
  }

  create(): void {
    const { width, height } = this.scale;

    this.settings = loadSettings();
    this.steps = this.volumeSteps();
    AudioManager.refreshFromSettings();

    // Launched over the paused Game: the scene list puts Settings below Game, so
    // without this it would render *behind* the frozen gameplay.
    if (this.overlay()) this.scene.bringToTop();

    makeSceneBackdrop(this, PALETTE.sakura);
    makeHeader(this, "RÉGLAGES", "Ajuste ton expérience");
    fadeIn(this);

    this.buildToggleRow(
      0,
      "Effets sonores",
      "Sons de saut, pièces, combat",
      () => this.settings.sfxEnabled,
      (v) => {
        this.settings.sfxEnabled = v;
        AudioManager.setEnabled(v);
        this.sound.volume = v ? this.settings.sfxVolume : 0;
        this.persist();
        if (v) AudioManager.play("click");
        this.refresh();
      },
      (s, t) => {
        this.sfxSwitch = s;
        this.sfxValue = t;
      }
    );

    this.buildVolumeRow(1);

    this.buildToggleRow(
      2,
      "Musique d'ambiance",
      "Musique de fond apaisante",
      () => this.settings.musicEnabled,
      (v) => {
        this.settings.musicEnabled = v;
        this.sound.volume = v ? this.settings.musicVolume : 0;
        this.persist();
        if (v) AudioManager.play("click");
        this.refresh();
      },
      (s, t) => {
        this.musicSwitch = s;
        this.musicValue = t;
      }
    );

    this.buildMusicVolumeRow(3);

    this.buildToggleRow(
      4,
      "Bords traversants",
      "Sortir par un bord te fait revenir de l'autre",
      () => this.settings.edgeWrapEnabled,
      (v) => {
        this.settings.edgeWrapEnabled = v;
        this.persist();
        AudioManager.play("click");
        this.refresh();
      },
      (s, t) => {
        this.wrapSwitch = s;
        this.wrapValue = t;
      }
    );

    this.buildLivesRow(5);
    this.buildDangerZone();

    this.add
      .text(width / 2, 700, this.overlay() ? "ÉCHAP — retour à la pause" : "ÉCHAP — retour", {
        fontFamily: FONT.ui,
        fontSize: "12px",
        color: CSS.textFaint,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    makeBackButton(this, () => this.back());

    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.modal) this.closeModal();
      else this.back();
    });
    this.input.once("pointerdown", () => AudioManager.init());

    // Nothing below the header should ever sit under the back button.
    void height;
    this.refresh();
  }

  /* ------------------------------------------------------------------ */
  /* Rows                                                                */
  /* ------------------------------------------------------------------ */

  private rowY(index: number): number {
    return ROW_TOP + index * ROW_GAP;
  }

  private buildRowFrame(index: number, label: string, hint: string): number {
    const cx = this.scale.width / 2;
    const cy = this.rowY(index);

    makePanel(this, cx, cy, PANEL_W, ROW_H, { inset: true }).setDepth(DEPTH.props);

    this.add
      .text(LABEL_X, cy - 11, label, TEXT.button(17))
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud);
    this.add
      .text(LABEL_X, cy + 12, hint, { fontFamily: FONT.body, fontSize: "12px", color: CSS.textFaint })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud);

    return cy;
  }

  private buildToggleRow(
    index: number,
    label: string,
    hint: string,
    get: () => boolean,
    set: (value: boolean) => void,
    assign: (sw: Switch, value: Phaser.GameObjects.Text) => void
  ): void {
    const cy = this.buildRowFrame(index, label, hint);

    const value = this.add
      .text(VALUE_X, cy, "", TEXT.label(15, CSS.textDim))
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud);

    const sw = this.makeSwitch(CTRL_X, cy, () => set(!get()));
    assign(sw, value);
  }

  /** Pill track + sliding knob. Reads as a switch, not as a mystery rectangle. */
  private makeSwitch(x: number, y: number, onToggle: () => void): Switch {
    const track = this.add.image(x, y, UI_EXTRA.pill);
    track.setDisplaySize(72, 30);
    track.setDepth(DEPTH.hud);

    const knob = this.add.circle(x - 17, y, 11, PALETTE.text);
    knob.setDepth(DEPTH.hud + 1);

    const hit = this.add.zone(x, y, 96, 46);
    hit.setInteractive({ cursor: "pointer" });
    hit.setDepth(DEPTH.hud + 2);
    hit.on("pointerdown", () => onToggle());
    hit.on("pointerover", () => {
      AudioManager.play("hover");
      this.tweens.add({ targets: track, scaleX: track.scaleX * 1.04, duration: 100, yoyo: true });
    });

    let last: boolean | undefined;

    return {
      set: (value: boolean): void => {
        const animate = last !== undefined && last !== value;
        last = value;

        track.setTint(value ? PALETTE.sakura : PALETTE.border);
        knob.setFillStyle(value ? PALETTE.text : PALETTE.textFaint);

        const targetX = x + (value ? 17 : -17);
        this.tweens.killTweensOf(knob);
        if (animate) {
          this.tweens.add({ targets: knob, x: targetX, duration: 160, ease: "Back.easeOut" });
        } else {
          knob.x = targetX;
        }
      },
    };
  }

  /**
   * The volume ladder is whatever `nextVolumeOption` cycles through — walking it
   * once means the bar count and the chevrons can never drift from the config.
   */
  private volumeSteps(): number[] {
    const steps: number[] = [];
    let v = 0;
    do {
      steps.push(v);
      v = nextVolumeOption(v);
    } while (v !== 0 && steps.length < 12);
    return steps;
  }

  private stepIndex(volume: number): number {
    const i = this.steps.findIndex((s) => Math.abs(s - volume) < 0.001);
    return i < 0 ? 0 : i;
  }

  private buildVolumeRow(index: number): void {
    const cy = this.buildRowFrame(index, "Volume", "Aperçu sonore à chaque réglage");

    this.volumeValue = this.add
      .text(VALUE_X, cy, "", { fontFamily: FONT.ui, fontSize: "16px", color: CSS.gold })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud);

    const count = this.steps.length - 1;
    const barW = 16;
    const gap = 8;
    const total = count * barW + (count - 1) * gap;
    const startX = CTRL_X - total / 2 + barW / 2;

    for (let i = 0; i < count; i++) {
      const bar = this.add.rectangle(startX + i * (barW + gap), cy, barW, 24, PALETTE.surfaceHi);
      bar.setDepth(DEPTH.hud);
      bar.setInteractive({ cursor: "pointer" });
      bar.on("pointerover", () => AudioManager.play("hover"));
      bar.on("pointerdown", () => {
        // Clicking the last lit bar snuffs it — that is the mute gesture.
        const target = this.steps[i + 1];
        const isTop = Math.abs(this.settings.sfxVolume - target) < 0.001;
        this.setVolume(isTop ? this.steps[i] : target);
      });
      this.volumeBars.push(bar);
      this.volumeGroup.push(bar);
    }

    const left = this.chevron(CTRL_X - 67, cy, true, () => {
      const i = this.stepIndex(this.settings.sfxVolume);
      this.setVolume(this.steps[(i - 1 + this.steps.length) % this.steps.length]);
    });
    const right = this.chevron(CTRL_X + 67, cy, false, () => {
      this.setVolume(nextVolumeOption(this.settings.sfxVolume));
    });

    this.volumeGroup.push(left, right, this.volumeValue);
  }

  private setVolume(value: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, value));
    this.persist();
    // Preview: apply first, *then* click — you hear exactly what you picked.
    AudioManager.setVolume(this.settings.sfxVolume);
    AudioManager.play("click");
    this.refresh();
  }

  private buildMusicVolumeRow(index: number): void {
    const cy = this.buildRowFrame(index, "Volume Musique", "Volume de la musique de fond");

    this.musicVolumeValue = this.add
      .text(VALUE_X, cy, "", { fontFamily: FONT.ui, fontSize: "16px", color: CSS.gold })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud);

    const count = this.steps.length - 1;
    const barW = 16;
    const gap = 8;
    const total = count * barW + (count - 1) * gap;
    const startX = CTRL_X - total / 2 + barW / 2;

    for (let i = 0; i < count; i++) {
      const bar = this.add.rectangle(startX + i * (barW + gap), cy, barW, 24, PALETTE.surfaceHi);
      bar.setDepth(DEPTH.hud);
      bar.setInteractive({ cursor: "pointer" });
      bar.on("pointerover", () => AudioManager.play("hover"));
      bar.on("pointerdown", () => {
        const target = this.steps[i + 1];
        const isTop = Math.abs(this.settings.musicVolume - target) < 0.001;
        this.setMusicVolume(isTop ? this.steps[i] : target);
      });
      this.musicBars.push(bar);
      this.musicGroup.push(bar);
    }

    const left = this.chevron(CTRL_X - 67, cy, true, () => {
      const i = this.stepIndex(this.settings.musicVolume);
      this.setMusicVolume(this.steps[(i - 1 + this.steps.length) % this.steps.length]);
    });
    const right = this.chevron(CTRL_X + 67, cy, false, () => {
      this.setMusicVolume(nextVolumeOption(this.settings.musicVolume));
    });

    this.musicGroup.push(left, right, this.musicVolumeValue);
  }

  private setMusicVolume(value: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, value));
    this.persist();
    if (this.settings.musicEnabled) {
      this.sound.volume = this.settings.musicVolume;
    }
    AudioManager.play("click");
    this.refresh();
  }

  private buildLivesRow(index: number): void {
    const cy = this.buildRowFrame(index, "Vies de départ", "Combien de fautes avant la chute");

    this.livesValue = this.add
      .text(VALUE_X, cy, "", TEXT.label(15, CSS.textDim))
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud);

    const maxHearts = Math.max(...LIVES_OPTIONS.filter((v) => v > 0));
    for (let i = 0; i < maxHearts; i++) {
      const heart = this.add.image(CTRL_X + (i - (maxHearts - 1) / 2) * 21, cy, UI.heart);
      heart.setDisplaySize(18, 16);
      heart.setDepth(DEPTH.hud);
      this.hearts.push(heart);
    }

    this.infinity = this.add
      .text(CTRL_X, cy - 2, "∞", { fontFamily: FONT.ui, fontSize: "30px", color: CSS.gold })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    this.chevron(CTRL_X - 67, cy, true, () => {
      const i = LIVES_OPTIONS.indexOf(this.settings.startingLives as (typeof LIVES_OPTIONS)[number]);
      const prev = LIVES_OPTIONS[(i <= 0 ? LIVES_OPTIONS.length : i) - 1];
      this.setLives(prev);
    });
    this.chevron(CTRL_X + 67, cy, false, () => {
      this.setLives(nextLivesOption(this.settings.startingLives));
    });
  }

  private setLives(value: number): void {
    this.settings.startingLives = value;
    this.persist();
    AudioManager.play("click");
    this.refresh();
    this.hearts.forEach((h, i) =>
      this.tweens.add({ targets: h, scale: h.scale * 1.3, duration: 120, delay: i * 30, yoyo: true })
    );
  }

  private chevron(
    x: number,
    y: number,
    flip: boolean,
    onClick: () => void
  ): Phaser.GameObjects.Image {
    const ch = this.add.image(x, y, UI.chevron);
    ch.setDisplaySize(22, 22);
    ch.setFlipX(flip);
    ch.setDepth(DEPTH.hud);
    ch.setInteractive({ cursor: "pointer" });
    ch.on("pointerover", () => ch.setTint(PALETTE.gold));
    ch.on("pointerout", () => ch.clearTint());
    ch.on("pointerdown", () => {
      this.tweens.add({ targets: ch, scale: ch.scale * 0.82, duration: 80, yoyo: true });
      onClick();
    });
    return ch;
  }

  /* ------------------------------------------------------------------ */
  /* Danger zone                                                         */
  /* ------------------------------------------------------------------ */

  private buildDangerZone(): void {
    const cx = this.scale.width / 2;
    const cy = 600;

    const panel = makePanel(this, cx, cy, PANEL_W, 140, { inset: true });
    panel.setTint(0xffb3d4);
    panel.setDepth(DEPTH.props);

    this.add
      .text(cx, cy - 45, "ZONE DANGEREUSE", {
        fontFamily: FONT.ui,
        fontSize: "15px",
        color: CSS.sakuraDeep,
        stroke: CSS.ink,
        strokeThickness: 3,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    this.add
      .text(
        cx,
        cy - 20,
        "Efface scores, pièces, yokai débloqués, quêtes et stats.\nTes réglages sont conservés.",
        {
          ...TEXT.label(12, CSS.textFaint),
          align: "center",
          wordWrap: { width: PANEL_W - 60 },
        }
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    makeButton(this, cx, cy + 27, "RÉINITIALISER", () => this.confirmStepOne(), {
      width: BTN_W,
      height: BTN_H - 6,
      fontSize: 17,
      variant: "danger",
    }).setDepth(DEPTH.hud);
  }

  private confirmStepOne(): void {
    this.openModal({
      title: "RÉINITIALISER ?",
      body:
        "Tu es sur le point d'effacer TOUTE ta progression :\n\n" +
        "•  meilleur score et classement\n" +
        "•  pièces et yokai débloqués\n" +
        "•  quêtes, statistiques et tutoriel\n\n" +
        "Tes réglages, eux, sont conservés.",
      confirmLabel: "CONTINUER",
      onConfirm: () => {
        this.closeModal();
        this.confirmStepTwo();
      },
    });
  }

  private confirmStepTwo(): void {
    this.openModal({
      title: "DERNIER AVERTISSEMENT",
      body:
        "Cette action est DÉFINITIVE.\n" +
        "Rien ne pourra être récupéré.\n\n" +
        "Effacer toute ta progression ?",
      confirmLabel: "EFFACER TOUT",
      armMs: 3000,
      onConfirm: () => {
        this.closeModal();
        this.wipeProgress();
      },
    });
  }

  /**
   * Sweeps every `yokaijump.*` key, then puts the settings back. Prefix-based on
   * purpose: progression added later gets wiped too, and this screen never has to
   * know the name of every save key in the game.
   */
  private wipeProgress(): void {
    const keep = loadSettings();

    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(KEY_PREFIX)) doomed.push(key);
      }
      doomed.forEach((key) => localStorage.removeItem(key));
      saveSettings(keep);
    } catch {
      AudioManager.play("denied");
      makeToast(this, "Stockage indisponible", "error");
      return;
    }

    this.registry.set("bestScore", 0);
    this.registry.set("lastScore", 0);
    this.registry.set("lastCoins", 0);
    this.registry.set("settings", keep);

    this.settings = keep;
    AudioManager.refreshFromSettings();
    AudioManager.play("break");

    this.cameras.main.flash(260, 255, 90, 60);
    this.cameras.main.shake(180, 0.006);
    makeToast(this, "Progression réinitialisée", "success");
    this.refresh();
  }

  /* ------------------------------------------------------------------ */
  /* Modal                                                               */
  /* ------------------------------------------------------------------ */

  private openModal(opts: {
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
    armMs?: number;
  }): void {
    if (this.modal) return;

    const { width, height } = this.scale;
    const layer = this.add.container(0, 0);
    layer.setDepth(DEPTH.modal);
    this.modal = layer;

    // Eats every click aimed at the screen behind it.
    const shade = this.add
      .rectangle(width / 2, height / 2, width, height, PALETTE.void, 0.84)
      .setInteractive();

    const panel = makePanel(this, width / 2, height / 2, 400, 320);
    panel.setTint(0xffc9e0);

    const title = this.add
      .text(width / 2, height / 2 - 118, opts.title, {
        ...TEXT.heading(24),
        color: CSS.sakuraDeep,
      })
      .setOrigin(0.5);

    const body = this.add
      .text(width / 2, height / 2 - 22, opts.body, {
        ...TEXT.label(15, CSS.textDim),
        align: "center",
        lineSpacing: 4,
        wordWrap: { width: 330 },
      })
      .setOrigin(0.5);

    const cancel = makeButton(this, width / 2 - 88, height / 2 + 108, "ANNULER", () => this.closeModal(), {
      width: 156,
      height: 48,
      fontSize: 16,
      variant: "ghost",
    });

    const armed = opts.armMs === undefined;
    const confirm = makeButton(
      this,
      width / 2 + 88,
      height / 2 + 108,
      armed ? opts.confirmLabel : `${opts.confirmLabel} (${Math.ceil(opts.armMs! / 1000)})`,
      () => opts.onConfirm(),
      { width: 156, height: 48, fontSize: 16, variant: "danger", enabled: armed }
    );

    // A destructive button you can reach by double-clicking isn't a confirmation.
    // Arm it on a countdown so the last click has to be deliberate.
    if (!armed) {
      let left = Math.ceil(opts.armMs! / 1000);
      this.time.addEvent({
        delay: 1000,
        repeat: left - 1,
        callback: () => {
          left -= 1;
          if (!this.modal) return;
          if (left > 0) {
            confirm.setLabel(`${opts.confirmLabel} (${left})`);
          } else {
            confirm.setLabel(opts.confirmLabel);
            confirm.setEnabled(true);
          }
        },
      });
    }

    layer.add([shade, panel, title, body, cancel, confirm]);

    layer.setAlpha(0);
    panel.setScale(0.94);
    this.tweens.add({ targets: layer, alpha: 1, duration: 180 });
    this.tweens.add({ targets: panel, scale: 1, duration: 260, ease: "Back.easeOut" });
  }

  private closeModal(): void {
    if (!this.modal) return;
    const layer = this.modal;
    this.modal = undefined;
    AudioManager.play("click");
    this.tweens.add({
      targets: layer,
      alpha: 0,
      duration: 140,
      onComplete: () => layer.destroy(),
    });
  }

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  private refresh(): void {
    const s = this.settings;

    this.sfxSwitch.set(s.sfxEnabled);
    this.sfxValue.setText(s.sfxEnabled ? "Activé" : "Désactivé");
    this.sfxValue.setColor(s.sfxEnabled ? CSS.jade : CSS.textFaint);

    this.musicSwitch.set(s.musicEnabled);
    this.musicValue.setText(s.musicEnabled ? "Activé" : "Désactivé");
    this.musicValue.setColor(s.musicEnabled ? CSS.jade : CSS.textFaint);

    this.wrapSwitch.set(s.edgeWrapEnabled);
    this.wrapValue.setText(s.edgeWrapEnabled ? "Activé" : "Désactivé");
    this.wrapValue.setColor(s.edgeWrapEnabled ? CSS.jade : CSS.textFaint);

    const lit = this.stepIndex(s.sfxVolume);
    this.volumeBars.forEach((bar, i) => {
      bar.setFillStyle(i < lit ? PALETTE.sakura : PALETTE.surfaceHi);
      bar.setAlpha(i < lit ? 1 : 0.5);
      bar.setDisplaySize(16, i < lit ? 28 : 20);
    });
    this.volumeValue.setText(formatVolume(s.sfxVolume));
    this.volumeValue.setColor(s.sfxVolume > 0 ? CSS.gold : CSS.textFaint);

    const dim = s.sfxEnabled ? 1 : 0.45;
    this.volumeGroup.forEach((o) => {
      const obj = o as Phaser.GameObjects.Image;
      obj.setAlpha(obj === (this.volumeValue as unknown as Phaser.GameObjects.Image) ? dim : obj.alpha * dim);
    });
    this.volumeBars.forEach((bar, i) => bar.setAlpha((i < lit ? 1 : 0.5) * dim));
    this.volumeValue.setAlpha(dim);

    const litMusic = this.stepIndex(s.musicVolume);
    this.musicBars.forEach((bar, i) => {
      bar.setFillStyle(i < litMusic ? PALETTE.sakura : PALETTE.surfaceHi);
      bar.setAlpha(i < litMusic ? 1 : 0.5);
      bar.setDisplaySize(16, i < litMusic ? 28 : 20);
    });
    this.musicVolumeValue.setText(formatVolume(s.musicVolume));
    this.musicVolumeValue.setColor(s.musicVolume > 0 ? CSS.gold : CSS.textFaint);

    const dimMusic = s.musicEnabled ? 1 : 0.45;
    this.musicGroup.forEach((o) => {
      const obj = o as Phaser.GameObjects.Image;
      obj.setAlpha(obj === (this.musicVolumeValue as unknown as Phaser.GameObjects.Image) ? dimMusic : obj.alpha * dimMusic);
    });
    this.musicBars.forEach((bar, i) => bar.setAlpha((i < litMusic ? 1 : 0.5) * dimMusic));
    this.musicVolumeValue.setAlpha(dimMusic);

    const lives = s.startingLives;
    const unlimited = lives < 0;
    this.hearts.forEach((h, i) => {
      h.setVisible(!unlimited && i < lives);
      h.setTint(PALETTE.sakura);
    });
    this.infinity.setVisible(unlimited);
    this.livesValue.setText(unlimited ? "Illimitées" : lives === 1 ? "1 vie" : `${lives} vies`);
    this.livesValue.setColor(unlimited ? CSS.gold : CSS.textDim);
  }

  private persist(): void {
    saveSettings(this.settings);
    this.registry.set("settings", this.settings);
  }

  private overlay(): boolean {
    return this.from === "PauseMenu";
  }

  /** Overlay mode hands the run back to the pause screen; the Game stays paused. */
  private back(): void {
    if (this.busy) return;
    this.busy = true;

    if (!this.overlay()) {
      transitionTo(this, "MainMenu");
      return;
    }

    this.cameras.main.fadeOut(160, 7, 6, 15);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.launch("PauseMenu");
      this.scene.stop();
    });
  }
}
