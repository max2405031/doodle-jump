import { Scene } from "phaser";

import { FX, UI } from "../art/keys";
import { UI_EXTRA, registerBackdrop } from "../art/ui";
import { CSS, DEPTH, FONT, PALETTE, TEXT } from "../config/theme";
import { AudioManager } from "../systems/Audio";

/**
 * The shared design system.
 *
 * Every screen used to hand-roll its own flat rectangles, which is why the
 * menus, shop and game-over looked like three different games. Scenes assemble
 * from these pieces instead.
 */

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export interface ButtonOpts {
  width?: number;
  height?: number;
  fontSize?: number;
  icon?: string;
  enabled?: boolean;
  variant?: ButtonVariant;
}

const VARIANT_TINT: Record<ButtonVariant, number> = {
  primary: 0xffffff,
  secondary: 0x9fb4ff,
  danger: 0xff8a7a,
  ghost: 0x8a86a8,
};

export interface Button extends Phaser.GameObjects.Container {
  setEnabled(v: boolean): void;
  setLabel(text: string): void;
}

export function makeButton(
  scene: Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {}
): Button {
  const {
    width = 260,
    height = 56,
    fontSize = 22,
    icon,
    variant = "primary",
    enabled = true,
  } = opts;

  const container = scene.add.container(x, y) as Button;

  const bg = scene.add.image(0, 0, UI.btn);
  bg.setDisplaySize(width, height);
  bg.setTint(VARIANT_TINT[variant]);

  const text = scene.add.text(icon ? 12 : 0, 0, label, TEXT.button(fontSize)).setOrigin(0.5);

  const parts: Phaser.GameObjects.GameObject[] = [bg, text];
  let iconImg: Phaser.GameObjects.Image | undefined;
  if (icon) {
    iconImg = scene.add.image(-text.width / 2 - 6, 0, icon);
    iconImg.setDisplaySize(24, 24);
    parts.unshift(iconImg);
  }
  container.add(parts);

  let isEnabled = enabled;

  const applyState = (state: "idle" | "hover" | "disabled"): void => {
    if (state === "disabled") {
      bg.setTexture(UI.btnDisabled);
      bg.setTint(0x8f8aa8);
      text.setAlpha(0.55);
    } else {
      bg.setTexture(state === "hover" ? UI.btnHover : UI.btn);
      bg.setTint(VARIANT_TINT[variant]);
      text.setAlpha(1);
    }
    bg.setDisplaySize(width, height);
  };

  bg.setInteractive({ useHandCursor: true });

  bg.on("pointerover", () => {
    if (!isEnabled) return;
    applyState("hover");
    scene.tweens.add({ targets: container, scale: 1.04, duration: 110, ease: "Quad.easeOut" });
    AudioManager.play("hover");
  });
  bg.on("pointerout", () => {
    if (!isEnabled) return;
    applyState("idle");
    scene.tweens.add({ targets: container, scale: 1, duration: 110 });
  });
  bg.on("pointerdown", () => {
    if (!isEnabled) {
      AudioManager.play("denied");
      scene.tweens.add({ targets: container, x: x + 4, duration: 45, yoyo: true, repeat: 2 });
      return;
    }
    AudioManager.play("click");
    scene.tweens.add({
      targets: container,
      scale: 0.96,
      duration: 70,
      yoyo: true,
      onComplete: () => onClick(),
    });
  });

  container.setEnabled = (v: boolean): void => {
    isEnabled = v;
    applyState(v ? "idle" : "disabled");
    if (v) bg.setInteractive({ useHandCursor: true });
    else bg.disableInteractive();
  };
  container.setLabel = (t: string): void => {
    text.setText(t);
  };

  applyState(enabled ? "idle" : "disabled");
  
  // Ensure the button and its hit area remain fixed to the camera
  container.setScrollFactor(0);
  parts.forEach(p => (p as any).setScrollFactor?.(0));

  return container;
}

export function makePanel(
  scene: Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { inset?: boolean } = {}
): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, opts.inset ? UI.panelInset : UI.panel);
  img.setDisplaySize(w, h);
  return img;
}

/** Page header: torii ornament, title, optional subtitle. */
export function makeHeader(
  scene: Scene,
  title: string,
  subtitle?: string
): Phaser.GameObjects.Container {
  const { width } = scene.scale;
  const c = scene.add.container(width / 2, 62);

  const torii = scene.add.image(0, 2, UI.torii);
  torii.setDisplaySize(150, 125);
  torii.setAlpha(0.28);

  // The display face runs wide: shrink long titles rather than letting them
  // run under the coin badge that most screens park in the top-right corner.
  const size = title.length > 9 ? 28 : title.length > 6 ? 32 : 38;
  const t = scene.add.text(0, -6, title, TEXT.title(size)).setOrigin(0.5);

  const parts: Phaser.GameObjects.GameObject[] = [torii, t];
  if (subtitle) {
    const s = scene.add
      .text(0, 26, subtitle, TEXT.label(14, CSS.textFaint))
      .setOrigin(0.5);
    parts.push(s);
  }
  c.add(parts);
  c.setDepth(DEPTH.hud);
  return c;
}

export interface CoinBadge extends Phaser.GameObjects.Container {
  setAmount(v: number): void;
}

export function makeCoinBadge(scene: Scene, x: number, y: number, amount: number): CoinBadge {
  const c = scene.add.container(x, y) as CoinBadge;

  const pill = scene.add.image(0, 0, UI_EXTRA.pill);
  pill.setDisplaySize(128, 40);

  const icon = scene.add.image(-38, 0, UI.coinIcon);
  icon.setDisplaySize(24, 24);

  const text = scene.add
    .text(-18, 0, String(amount), {
      fontFamily: FONT.ui,
      fontSize: "20px",
      color: CSS.gold,
      stroke: CSS.ink,
      strokeThickness: 3,
    })
    .setOrigin(0, 0.5);

  c.add([pill, icon, text]);
  c.setDepth(DEPTH.hud);

  c.setAmount = (v: number): void => {
    text.setText(String(v));
    scene.tweens.add({ targets: [icon, text], scale: 1.25, duration: 130, yoyo: true });
  };
  return c;
}

export function makeBackButton(scene: Scene, onClick: () => void): Button {
  const { width, height } = scene.scale;
  return makeButton(scene, width / 2, height - 52, "RETOUR", onClick, {
    width: 200,
    height: 50,
    fontSize: 18,
    variant: "ghost",
  });
}

/**
 * The shared menu backdrop: painted plate, drifting mist, motes, vignette.
 * This is what makes every non-gameplay screen feel like the same place.
 */
export function makeSceneBackdrop(scene: Scene, accent: number = PALETTE.sakura): void {
  const { width, height } = scene.scale;

  const key = registerBackdrop(scene, accent);
  scene.add.image(width / 2, height / 2, key).setDepth(DEPTH.bgFar);

  // Two mist banks sliding at different speeds.
  for (let i = 0; i < 2; i++) {
    const mist = scene.add.tileSprite(width / 2, height * (0.3 + i * 0.4), width, 300, UI_EXTRA.mist);
    mist.setAlpha(0.14 + i * 0.06);
    mist.setTint(accent);
    mist.setDepth(DEPTH.bgMid);
    scene.tweens.add({
      targets: mist,
      tilePositionX: 512,
      duration: 26000 + i * 12000,
      repeat: -1,
    });
  }

  const motes = scene.add.particles(0, 0, FX.spark, {
    x: { min: 0, max: width },
    y: height + 10,
    lifespan: { min: 6000, max: 11000 },
    speedY: { min: -26, max: -8 },
    speedX: { min: -12, max: 12 },
    scale: { start: 0.5, end: 0 },
    alpha: { start: 0.5, end: 0 },
    frequency: 500,
    quantity: 1,
    tint: accent,
  });
  motes.setDepth(DEPTH.bgNear);

  const petals = scene.add.particles(0, 0, FX.sakura, {
    x: { min: 0, max: width },
    y: -12,
    lifespan: { min: 7000, max: 12000 },
    speedY: { min: 14, max: 36 },
    speedX: { min: -18, max: 18 },
    rotate: { min: 0, max: 360 },
    scale: { start: 0.8, end: 0.5 },
    alpha: { start: 0.5, end: 0 },
    frequency: 900,
    quantity: 1,
  });
  petals.setDepth(DEPTH.bgNear);

  scene.add
    .image(width / 2, height / 2, UI.vignette)
    .setDisplaySize(width, height)
    .setDepth(DEPTH.fx);
}

export function makeToast(
  scene: Scene,
  message: string,
  tone: "info" | "success" | "error" = "info"
): void {
  const { width } = scene.scale;
  const color =
    tone === "success" ? PALETTE.jade : tone === "error" ? PALETTE.ember : PALETTE.spirit;

  const c = scene.add.container(width / 2, -40);
  c.setDepth(DEPTH.modal);

  const pill = scene.add.image(0, 0, UI_EXTRA.pill);
  const text = scene.add.text(0, 0, message, TEXT.button(17)).setOrigin(0.5);
  pill.setDisplaySize(Math.max(200, text.width + 56), 44);
  pill.setTint(color);

  c.add([pill, text]);

  scene.tweens.add({
    targets: c,
    y: 74,
    duration: 340,
    ease: "Back.easeOut",
    onComplete: () => {
      scene.time.delayedCall(1500, () => {
        scene.tweens.add({
          targets: c,
          y: -50,
          alpha: 0,
          duration: 300,
          ease: "Quad.easeIn",
          onComplete: () => c.destroy(),
        });
      });
    },
  });
}

/**
 * Keyboard text prompt.
 *
 * Replaces the native `window.prompt()` the old game-over used for initials —
 * it broke immersion and was close to unusable on mobile.
 */
export function makePrompt(
  scene: Scene,
  title: string,
  opts: { maxLength?: number; onConfirm: (value: string) => void; onCancel?: () => void }
): void {
  const { width, height } = scene.scale;
  const maxLength = opts.maxLength ?? 3;

  const layer = scene.add.container(0, 0);
  layer.setDepth(DEPTH.modal);

  const shade = scene.add
    .rectangle(width / 2, height / 2, width, height, PALETTE.void, 0.82)
    .setInteractive();

  const panel = makePanel(scene, width / 2, height / 2, 360, 250);
  const heading = scene.add
    .text(width / 2, height / 2 - 82, title, TEXT.heading(24))
    .setOrigin(0.5);

  let value = "";
  const slots: Phaser.GameObjects.Image[] = [];
  const chars: Phaser.GameObjects.Text[] = [];
  const slotW = 54;
  const startX = width / 2 - ((maxLength - 1) * slotW) / 2;

  for (let i = 0; i < maxLength; i++) {
    const slot = scene.add.image(startX + i * slotW, height / 2 - 14, UI_EXTRA.keycap);
    slot.setDisplaySize(46, 52);
    slots.push(slot);
    chars.push(
      scene.add
        .text(startX + i * slotW, height / 2 - 14, "", TEXT.heading(28))
        .setOrigin(0.5)
    );
  }

  const caret = scene.add.rectangle(startX, height / 2 + 6, 22, 3, PALETTE.gold);
  scene.tweens.add({ targets: caret, alpha: 0.2, duration: 480, yoyo: true, repeat: -1 });

  const redraw = (): void => {
    chars.forEach((c, i) => c.setText(value[i] ?? ""));
    slots.forEach((s, i) => s.setTint(i === value.length ? PALETTE.gold : 0xffffff));
    caret.x = startX + Math.min(value.length, maxLength - 1) * slotW;
    caret.setVisible(value.length < maxLength);
  };

  const cleanup = (): void => {
    scene.input.keyboard?.off("keydown", onKey);
    layer.destroy();
  };

  const confirm = (): void => {
    const final = value || "AAA";
    cleanup();
    opts.onConfirm(final);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Backspace") {
      value = value.slice(0, -1);
      redraw();
      return;
    }
    if (e.key === "Enter") {
      confirm();
      return;
    }
    if (e.key === "Escape") {
      cleanup();
      opts.onCancel?.();
      return;
    }
    if (value.length >= maxLength) return;
    const ch = e.key.toUpperCase();
    if (/^[A-Z0-9]$/.test(ch)) {
      value += ch;
      AudioManager.play("click");
      redraw();
    }
  };

  scene.input.keyboard?.on("keydown", onKey);

  const ok = makeButton(scene, width / 2, height / 2 + 66, "VALIDER", confirm, {
    width: 200,
    height: 48,
    fontSize: 18,
  });

  layer.add([shade, panel, heading, ...slots, ...chars, caret, ok]);
  redraw();

  // Entrance.
  layer.setAlpha(0);
  scene.tweens.add({ targets: layer, alpha: 1, duration: 200 });
}

export function fadeIn(scene: Scene): void {
  scene.cameras.main.fadeIn(260, 7, 6, 15);
}

export function transitionTo(scene: Scene, target: string, data?: object): void {
  scene.cameras.main.fadeOut(220, 7, 6, 15);
  scene.cameras.main.once("camerafadeoutcomplete", () => scene.scene.start(target, data));
}
