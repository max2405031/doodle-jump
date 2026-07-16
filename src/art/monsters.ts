import { Scene } from "phaser";

import {
  ENEMY_FRAME_COUNT,
  ENEMY_KEYS,
  ENEMY_SIZE,
  enemyAnim,
  enemyKey,
  type EnemyKind,
} from "./keys";
import { defineSheet, type DrawFn } from "./registry";
import { PALETTE } from "../config/theme";
import {
  ao,
  aura,
  blob,
  circle,
  clipped,
  contactShadow,
  darken,
  ellipse,
  evilEye,
  fangs,
  glow,
  grain,
  hex,
  keyLight,
  lighten,
  linGrad,
  mix,
  outline,
  radGrad,
  rimLight,
  rng,
  shift,
  type Ctx,
} from "./paint";

/**
 * The bestiary.
 *
 * These are meant to be frightening, not charming — the player character is the
 * cute one and the contrast is the whole point. Purely mythological: no modern
 * props, nothing anachronistic — every threat reads as something out of Edo-
 * period folklore, matching the rest of the game's period setting.
 *
 * Each monster is four frames of a looping menace animation. The motion is
 * deliberately *wrong* — heavy breathing, twitching limbs, asynchronous blinks,
 * pulsing light — rather than a friendly bounce.
 */

const INK = 0x08060e;

/** Frame phase in [0,1). Drives every cyclic motion below. */
const phase = (frame: number): number => frame / ENEMY_FRAME_COUNT;

/** Smooth 0..1..0 over the loop — breathing, pulsing. */
const pulse = (t: number, offset = 0): number => (Math.sin((t + offset) * Math.PI * 2) + 1) / 2;

/** Wet, oily sheen streak across a shape. */
function sheen(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, alpha: number): void {
  ctx.fillStyle = radGrad(ctx, cx, cy, Math.max(rx, ry), [
    [0, 0xffffff, alpha],
    [0.5, 0xffffff, alpha * 0.3],
    [1, 0xffffff, 0],
  ]);
  ellipse(ctx, cx, cy, rx, ry, -0.4);
  ctx.fill();
}

/** Blotchy discoloration — diseased skin, mould, bruising. */
function blotches(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: number,
  count: number,
  seed: number,
  alpha = 0.3
): void {
  const rand = rng(seed);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand();
    const x = cx + Math.cos(a) * rx * d * 0.85;
    const y = cy + Math.sin(a) * ry * d * 0.85;
    const r = 1.4 + rand() * 3.4;
    ctx.fillStyle = hex(color, alpha * (0.4 + rand() * 0.6));
    blob(ctx, x, y, r, r * (0.6 + rand() * 0.5), 0.5, (seed + i * 7) | 0, 8);
    ctx.fill();
  }
}

/** Viscous drip hanging off an edge. */
function drip(ctx: Ctx, x: number, y: number, len: number, color: number, alpha: number): void {
  ctx.fillStyle = hex(color, alpha);
  ctx.beginPath();
  ctx.moveTo(x - 1.1, y);
  ctx.quadraticCurveTo(x - 1.4, y + len * 0.7, x, y + len);
  ctx.quadraticCurveTo(x + 1.4, y + len * 0.7, x + 1.1, y);
  ctx.closePath();
  ctx.fill();
  circle(ctx, x, y + len, 1.3);
  ctx.fill();
}

/* ================================================================== kappa */

/**
 * The drowned kappa. Bloated, waterlogged, the skull-dish now an open wound of
 * black water.
 */
const kappa: DrawFn = (ctx, w, h) => {
  const t = phase(currentFrame);
  const cx = w / 2;
  const cy = h * 0.55;
  const breath = pulse(t) * 0.9;

  contactShadow(ctx, cx, h - 3, 15, 4, 0.4);
  aura(ctx, cx, cy, 22, 0x1d4a33, 3, 7);

  const skin = shift(0x5f8f4e, 0, 0.75, 1);
  const skinDark = shift(0x24401f, 0, 0.75, 1);

  // Shell behind the body.
  const shell = (): void => blob(ctx, cx, cy + 5, 17, 15, 0.14, 12);
  outline(ctx, shell, INK, 2.4, 0.9);
  ctx.fillStyle = radGrad(ctx, cx - 4, cy, 20, [
    [0, 0x6d5a3a],
    [0.6, 0x4a3b23],
    [1, 0x241c10],
  ]);
  shell();
  ctx.fill();
  rimLight(ctx, shell, 0x9fe8b0, 1.4, 0.4);
  // Cracks across the carapace.
  ctx.strokeStyle = hex(INK, 0.7);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + 1);
  ctx.lineTo(cx - 3, cy + 7);
  ctx.lineTo(cx + 9, cy + 3);
  ctx.moveTo(cx - 2, cy + 7);
  ctx.lineTo(cx - 5, cy + 17);
  ctx.stroke();

  // Body.
  const body = (): void => blob(ctx, cx, cy, 15, 16, 0.16, 5);
  outline(ctx, body, INK, 2.6, 0.95);
  ctx.fillStyle = radGrad(ctx, cx - 5, cy - 6, 20, [
    [0, lighten(skin, 0.25)],
    [0.5, skin],
    [1, skinDark],
  ]);
  body();
  ctx.fill();

  clipped(ctx, body, () => {
    blotches(ctx, cx, cy, 15, 16, 0x1a3316, 12, 21, 0.45);
    blotches(ctx, cx, cy, 15, 16, 0x8fae57, 6, 44, 0.25);
    ao(ctx, cx, cy + 3, 17, 18, 0.5);
    keyLight(ctx, cx - 20, cy - 22, 40, 44, 0.22);
    sheen(ctx, cx - 5, cy - 7, 7, 4, 0.35);
  });
  rimLight(ctx, body, 0x9fe8b0, 1.6, 0.5);

  // The sara: an open wound brimming with black water.
  const dishY = cy - 12;
  const dish = (): void => ellipse(ctx, cx, dishY, 10.5, 4.6);
  outline(ctx, dish, INK, 2, 0.9);
  ctx.fillStyle = radGrad(ctx, cx, dishY, 11, [
    [0, 0x0a1a14],
    [0.7, 0x04100c],
    [1, 0x000000],
  ]);
  dish();
  ctx.fill();
  // Water surface ripples with the loop.
  ctx.strokeStyle = hex(0x3f8f6a, 0.5 + breath * 0.3);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(cx, dishY + 0.4, 6 + breath * 2.2, 2.2 + breath * 0.8, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Bubbles rising out of it.
  const br = rng(9);
  for (let i = 0; i < 3; i++) {
    const bx = cx - 5 + br() * 10;
    const rise = ((t + i * 0.33) % 1) * 8;
    ctx.fillStyle = hex(0x8fd9b0, 0.55 * (1 - rise / 8));
    circle(ctx, bx, dishY - rise, 0.9 + br() * 0.6);
    ctx.fill();
  }

  // Lidless eyes.
  const blink = t > 0.5 && t < 0.62 ? 0.35 : 1;
  evilEye(ctx, cx - 6, cy - 3, 4.4 * blink, 0xd7e04a, { slit: true, glowRadius: 9 });
  evilEye(ctx, cx + 6, cy - 3, 4.4, 0xd7e04a, { slit: true, glowRadius: 9 });

  // Horned beak, split and toothed.
  const beak = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - 5.5, cy + 4);
    ctx.lineTo(cx + 5.5, cy + 4);
    ctx.lineTo(cx, cy + 11.5);
    ctx.closePath();
  };
  outline(ctx, beak, INK, 1.6, 0.9);
  ctx.fillStyle = linGrad(ctx, cx, cy + 4, cx, cy + 12, [
    [0, 0xd9a441],
    [1, 0x7c5416],
  ]);
  beak();
  ctx.fill();
  rimLight(ctx, beak, 0xf2d68a, 1, 0.4);
  ctx.fillStyle = hex(0xf2f0e0, 0.9);
  fangs(ctx, cx - 4.5, cy + 5.4, 9, 4, 2.4, 1, 0.5, 6);
  ctx.fill();

  // Algae hanging off the jaw.
  ctx.strokeStyle = hex(0x2c5a2a, 0.8);
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 3; i++) {
    const sx = cx - 9 + i * 9;
    ctx.beginPath();
    ctx.moveTo(sx, cy + 9);
    ctx.quadraticCurveTo(sx + 1.5 + breath, cy + 14, sx - 1, cy + 18 + breath * 1.5);
    ctx.stroke();
  }

  drip(ctx, cx - 12, cy + 12, 3 + breath * 2, 0x2f5f45, 0.6);
  grain(ctx, w, h, 0.07, 3);
};

/* ================================================================== tengu */

/** Crow tengu: raptor build, oily feathers, a hooked beak and a hunter's eyes. */
const tengu: DrawFn = (ctx, w, h) => {
  const t = phase(currentFrame);
  const cx = w * 0.46;
  const cy = h * 0.52;
  const flap = Math.sin(t * Math.PI * 2);

  aura(ctx, cx, cy, 24, 0x1a1030, 7, 8);

  const feather = 0x1b1a24;

  // Wings — they beat across the loop.
  const wing = (dir: number): void => {
    const spread = 20 + flap * dir * 4;
    ctx.save();
    ctx.translate(cx, cy - 4);
    ctx.rotate(dir * (0.3 + flap * 0.28) * -1);
    const shape = (): void => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(dir * spread * 0.7, -12, dir * spread, -2);
      ctx.quadraticCurveTo(dir * spread * 0.8, 8, dir * spread * 0.35, 11);
      ctx.quadraticCurveTo(dir * spread * 0.2, 5, 0, 6);
      ctx.closePath();
    };
    outline(ctx, shape, INK, 2, 0.9);
    ctx.fillStyle = linGrad(ctx, 0, -10, 0, 10, [
      [0, lighten(feather, 0.2)],
      [0.5, feather],
      [1, darken(feather, 0.5)],
    ]);
    shape();
    ctx.fill();
    // Flight feather separations.
    ctx.strokeStyle = hex(0x000000, 0.55);
    ctx.lineWidth = 0.8;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(dir * spread * 0.2 * i, 2);
      ctx.lineTo(dir * spread * (0.25 * i + 0.2), -6 + i * 3);
      ctx.stroke();
    }
    rimLight(ctx, shape, 0x6f6bd8, 1.3, 0.5);
    ctx.restore();
  };
  wing(-1);
  wing(1);

  // Body.
  const body = (): void => blob(ctx, cx, cy + 2, 12, 15, 0.18, 3);
  outline(ctx, body, INK, 2.5, 0.95);
  ctx.fillStyle = radGrad(ctx, cx - 3, cy - 4, 17, [
    [0, 0x3a3852],
    [0.55, feather],
    [1, 0x0c0b12],
  ]);
  body();
  ctx.fill();
  clipped(ctx, body, () => {
    // Ruffled plumage.
    const fr = rng(17);
    for (let i = 0; i < 22; i++) {
      const px = cx - 12 + fr() * 24;
      const py = cy - 10 + fr() * 24;
      ctx.strokeStyle = hex(fr() < 0.5 ? 0x4a4766 : 0x000000, 0.4);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + 2, py + 2, px + 1, py + 4.5);
      ctx.stroke();
    }
    ao(ctx, cx, cy + 4, 14, 17, 0.5);
    sheen(ctx, cx - 4, cy - 6, 5, 3.5, 0.3);
  });
  rimLight(ctx, body, 0x6f6bd8, 1.6, 0.55);

  // Head + hooked beak.
  const head = (): void => blob(ctx, cx, cy - 12, 9.5, 8.5, 0.12, 8);
  outline(ctx, head, INK, 2.2, 0.95);
  ctx.fillStyle = radGrad(ctx, cx - 3, cy - 15, 12, [
    [0, 0x35334a],
    [0.6, feather],
    [1, 0x0a0910],
  ]);
  head();
  ctx.fill();
  rimLight(ctx, head, 0x6f6bd8, 1.3, 0.5);

  // The long red nose — a blunt threat.
  const nose = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy - 15);
    ctx.quadraticCurveTo(cx + 16, cy - 12, cx + 21, cy - 4);
    ctx.quadraticCurveTo(cx + 13, cy - 6, cx + 2, cy - 8);
    ctx.closePath();
  };
  outline(ctx, nose, INK, 1.8, 0.9);
  ctx.fillStyle = linGrad(ctx, cx, cy - 16, cx + 20, cy - 2, [
    [0, 0xc03535],
    [0.6, 0x8e1f1f],
    [1, 0x4a0d0d],
  ]);
  nose();
  ctx.fill();
  rimLight(ctx, nose, 0xff6b6b, 1, 0.4);

  // Hooked beak below it, tongue showing.
  ctx.fillStyle = hex(0x2a2118, 1);
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 10);
  ctx.lineTo(cx - 1, cy - 9);
  ctx.lineTo(cx - 5, cy - 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hex(0x8e2b3a, 0.9);
  ellipse(ctx, cx - 5, cy - 6, 1.4, 2.2, 0.3);
  ctx.fill();

  evilEye(ctx, cx - 4.5, cy - 14, 3.6, 0xff2f2f, { slit: true, glowRadius: 9, look: 0.3 });
  evilEye(ctx, cx + 3.5, cy - 14.5, 3.2, 0xff2f2f, { slit: true, glowRadius: 8, look: 0.3 });

  // A taloned claw reaching out, echoing the wing's angle.
  const angle = -0.5 + flap * 0.06;
  ctx.save();
  ctx.translate(cx + 8, cy + 4);
  ctx.rotate(angle);
  ctx.strokeStyle = hex(0x9aa0b0, 0.95);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(15, 0);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const a = -0.5 + i * 0.5;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(15 + Math.cos(a) * 6, Math.sin(a) * 6);
    ctx.stroke();
  }
  ctx.restore();

  grain(ctx, w, h, 0.06, 12);
};

/* =============================================================== karakasa */

/** One-eyed umbrella. Torn, leering, dragging a wet tongue. */
const karakasa: DrawFn = (ctx, w, h) => {
  const t = phase(currentFrame);
  const cx = w / 2;
  const topY = h * 0.3;
  const sway = Math.sin(t * Math.PI * 2) * 1.6;

  contactShadow(ctx, cx + sway, h - 3, 8, 3, 0.4);
  aura(ctx, cx, topY, 20, 0x3a1f4a, 11, 7);

  // Canopy, ripped into flaps.
  const canopy = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx, topY - 16);
    const ribs = 6;
    for (let i = 0; i <= ribs; i++) {
      const a = Math.PI + (i / ribs) * Math.PI;
      // Wide and shallow — an umbrella, not a party hat.
      const rx = 24;
      const ry = 13;
      const px = cx + Math.cos(a) * rx;
      const py = topY + Math.sin(a) * ry + 10;
      // Torn scallops sagging between the ribs.
      if (i > 0) {
        const prevA = Math.PI + ((i - 1) / ribs) * Math.PI;
        const mx = cx + Math.cos((a + prevA) / 2) * rx * 1.04;
        const my = topY + Math.sin((a + prevA) / 2) * ry + 10 + (i % 2 ? 8 : 4);
        ctx.quadraticCurveTo(mx, my, px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
  };

  outline(ctx, canopy, INK, 2.6, 0.95);
  ctx.fillStyle = radGrad(ctx, cx - 5, topY - 8, 26, [
    [0, shift(0x8c5aa8, 0, 0.75, 1)],
    [0.5, shift(0x5c2f75, 0, 0.75, 1)],
    [1, shift(0x2a1237, 0, 0.75, 1)],
  ]);
  canopy();
  ctx.fill();

  clipped(ctx, canopy, () => {
    // Ribs poking through like broken bones.
    ctx.strokeStyle = hex(0xd9cfa8, 0.55);
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, topY - 14);
      ctx.lineTo(cx + Math.cos(a) * 25, topY + Math.sin(a) * 14 + 10);
      ctx.stroke();
    }
    // Faded, filthy holiday print.
    const fr = rng(31);
    for (let i = 0; i < 7; i++) {
      const px = cx - 15 + fr() * 30;
      const py = topY - 8 + fr() * 16;
      ctx.fillStyle = hex(fr() < 0.5 ? 0xd98cae : 0xd9c05a, 0.22);
      circle(ctx, px, py, 1.6 + fr() * 1.8);
      ctx.fill();
    }
    blotches(ctx, cx, topY, 18, 15, 0x180a20, 9, 77, 0.4);
    ao(ctx, cx, topY + 4, 20, 18, 0.45);
  });
  rimLight(ctx, canopy, 0xc77dff, 1.6, 0.5);

  // The eye — huge, bloodshot, lidless. It tracks across the loop.
  const look = Math.sin(t * Math.PI * 2) * 0.7;
  const eyeY = topY + 2;
  ctx.fillStyle = hex(0xf3ece0, 1);
  circle(ctx, cx, eyeY, 8);
  ctx.fill();
  outline(ctx, () => circle(ctx, cx, eyeY, 8), INK, 1.8, 0.9);
  // Veins.
  ctx.strokeStyle = hex(0xb02a2a, 0.6);
  ctx.lineWidth = 0.6;
  const vr = rng(42);
  for (let i = 0; i < 7; i++) {
    const a = vr() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 7.6, eyeY + Math.sin(a) * 7.6);
    ctx.quadraticCurveTo(
      cx + Math.cos(a) * 4.5 + 1,
      eyeY + Math.sin(a) * 4.5,
      cx + Math.cos(a) * 2.6,
      eyeY + Math.sin(a) * 2.6
    );
    ctx.stroke();
  }
  evilEye(ctx, cx + look * 2.6, eyeY, 4.6, 0xffc94d, { slit: true, glowRadius: 10, look });

  // Handle: one spindly leg with a hooked foot.
  ctx.strokeStyle = hex(0x6b4a1e, 1);
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(cx, topY + 14);
  ctx.quadraticCurveTo(cx + sway, h * 0.75, cx + sway * 1.4, h - 8);
  ctx.stroke();
  ctx.strokeStyle = hex(0x8f6a30, 0.7);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Hooked foot.
  ctx.strokeStyle = hex(0x6b4a1e, 1);
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx + sway * 1.4, h - 8);
  ctx.quadraticCurveTo(cx + sway * 1.4 + 6, h - 5, cx + sway * 1.4 + 3, h - 1);
  ctx.stroke();

  // Lolling tongue, swinging.
  const tongueSwing = Math.sin(t * Math.PI * 2 + 1) * 2.4;
  ctx.fillStyle = linGrad(ctx, cx, topY + 12, cx, topY + 30, [
    [0, 0xc0455e],
    [1, 0x6b1730],
  ]);
  ctx.beginPath();
  ctx.moveTo(cx - 3.4, topY + 11);
  ctx.quadraticCurveTo(cx + tongueSwing, topY + 22, cx + tongueSwing * 1.3, topY + 29);
  ctx.quadraticCurveTo(cx + tongueSwing + 3, topY + 21, cx + 3.4, topY + 11);
  ctx.closePath();
  ctx.fill();
  outline(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - 3.4, topY + 11);
      ctx.quadraticCurveTo(cx + tongueSwing, topY + 22, cx + tongueSwing * 1.3, topY + 29);
      ctx.quadraticCurveTo(cx + tongueSwing + 3, topY + 21, cx + 3.4, topY + 11);
      ctx.closePath();
    },
    INK,
    1.2,
    0.7
  );
  drip(ctx, cx + tongueSwing * 1.3, topY + 29, 2.5 + pulse(t) * 2, 0xc0455e, 0.55);

  grain(ctx, w, h, 0.06, 21);
};

/* ==================================================================== oni */

/** The mountain oni: obese, cracked red hide, a mouth full of broken fangs. */
const oni: DrawFn = (ctx, w, h) => {
  const t = phase(currentFrame);
  const cx = w / 2;
  const cy = h * 0.55;
  const breath = pulse(t);

  contactShadow(ctx, cx, h - 3, 24, 5, 0.45);
  aura(ctx, cx, cy, 30, 0x5a1408, 5, 8);

  // Torso — it swells with each breath.
  const bw = 21 + breath * 1.2;
  const bh = 20 + breath * 0.8;
  const body = (): void => blob(ctx, cx, cy + 3, bw, bh, 0.14, 2);
  outline(ctx, body, INK, 3, 0.95);
  ctx.fillStyle = radGrad(ctx, cx - 7, cy - 6, 27, [
    [0, shift(0xff7a52, 0, 0.78, 1)],
    [0.45, shift(0xd23a20, 0, 0.78, 1)],
    [0.85, shift(0x8a1c0c, 0, 0.78, 1)],
    [1, shift(0x4a0d05, 0, 0.78, 1)],
  ]);
  body();
  ctx.fill();

  clipped(ctx, body, () => {
    // Cracked hide.
    ctx.strokeStyle = hex(0x3d0a04, 0.55);
    ctx.lineWidth = 0.9;
    const cr = rng(64);
    for (let i = 0; i < 9; i++) {
      let px = cx - bw + cr() * bw * 2;
      let py = cy - bh + cr() * bh * 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let j = 0; j < 3; j++) {
        px += (cr() - 0.5) * 9;
        py += (cr() - 0.5) * 9;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Black veins.
    blotches(ctx, cx, cy, bw, bh, 0x2b0703, 10, 91, 0.35);
    // Gut.
    ctx.fillStyle = hex(0xffb08c, 0.22);
    ellipse(ctx, cx, cy + 9, 13, 9);
    ctx.fill();
    ao(ctx, cx, cy + 5, bw + 2, bh + 2, 0.5);
    keyLight(ctx, cx - 28, cy - 30, 56, 60, 0.22);
  });
  rimLight(ctx, body, 0xffb08c, 2, 0.5);

  // Horns — yellowed, chipped.
  const horn = (dir: number): void => {
    const shape = (): void => {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 9, cy - 16);
      ctx.quadraticCurveTo(cx + dir * 15, cy - 26, cx + dir * 11, cy - 34);
      ctx.quadraticCurveTo(cx + dir * 8, cy - 26, cx + dir * 4, cy - 15);
      ctx.closePath();
    };
    outline(ctx, shape, INK, 1.8, 0.9);
    ctx.fillStyle = linGrad(ctx, cx, cy - 34, cx, cy - 15, [
      [0, 0xf2e3a8],
      [0.6, 0xc9ae63],
      [1, 0x8a7433],
    ]);
    shape();
    ctx.fill();
    // Chip out of the tip.
    ctx.fillStyle = hex(INK, 0.5);
    circle(ctx, cx + dir * 11, cy - 33, 1.5);
    ctx.fill();
    rimLight(ctx, shape, 0xffe9a8, 1, 0.4);
  };
  horn(-1);
  horn(1);

  // Sunken hateful eyes — they blink out of sync, which is what makes it wrong.
  const blinkL = t > 0.5 && t < 0.6 ? 0.25 : 1;
  const blinkR = t > 0.72 && t < 0.82 ? 0.25 : 1;
  evilEye(ctx, cx - 8, cy - 7, 3.6 * blinkL, 0xffd23b, { slit: false, glowRadius: 9 });
  evilEye(ctx, cx + 8, cy - 7, 3.6 * blinkR, 0xffd23b, { slit: false, glowRadius: 9 });
  // Heavy brow.
  ctx.strokeStyle = hex(0x3d0a04, 0.9);
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - 12);
  ctx.lineTo(cx - 3, cy - 9);
  ctx.moveTo(cx + 14, cy - 12);
  ctx.lineTo(cx + 3, cy - 9);
  ctx.stroke();

  // Maw, jaw twitching open.
  const jaw = 1 + breath * 0.5;
  const maw = (): void => ellipse(ctx, cx, cy + 6, 11, 5.5 * jaw);
  outline(ctx, maw, INK, 1.8, 0.95);
  ctx.fillStyle = radGrad(ctx, cx, cy + 7, 11, [
    [0, 0x521018],
    [1, 0x150307],
  ]);
  maw();
  ctx.fill();
  rimLight(ctx, maw, 0xff8a5c, 1, 0.35);
  ctx.fillStyle = hex(0xf2ecd8, 0.95);
  fangs(ctx, cx - 10, cy + 1.5, 20, 6, 4 * jaw, 1, 0.55, 8);
  ctx.fill();
  fangs(ctx, cx - 10, cy + 11 * jaw, 20, 5, 3.4 * jaw, -1, 0.5, 14);
  ctx.fill();
  drip(ctx, cx + 4, cy + 10 * jaw, 3 + breath * 2.5, 0xd8c9a0, 0.5);

  grain(ctx, w, h, 0.08, 33);
};

/* =========================================================== gashadokuro */

/** The starving giant skeleton. The one that should stop you dead. */
const gashadokuro: DrawFn = (ctx, w, h) => {
  const t = phase(currentFrame);
  const cx = w / 2;
  const skullY = h * 0.36;
  const glowPulse = 0.55 + pulse(t) * 0.45;
  const clack = t > 0.5 ? 1.6 : 0; // the jaw snaps shut halfway through

  aura(ctx, cx, skullY, 40, PALETTE.cursed, 6, 11);

  const bone = 0xd9cfae;
  const boneDark = 0x6e6449;

  // The dark of the chest cavity — kept inside the ribs, not a slab behind them.
  ctx.fillStyle = radGrad(ctx, cx, h * 0.78, 20, [
    [0, 0x0a0612, 0.85],
    [1, 0x0a0612, 0],
  ]);
  ellipse(ctx, cx, h * 0.78, 17, 20);
  ctx.fill();

  ctx.strokeStyle = hex(bone, 0.9);
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 4; i++) {
    const ry = h * 0.64 + i * 7;
    const rw = 17 - i * 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - rw, ry);
    ctx.quadraticCurveTo(cx, ry + 6, cx + rw, ry);
    ctx.stroke();
  }
  // Spine.
  ctx.strokeStyle = hex(boneDark, 0.9);
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.6);
  ctx.lineTo(cx, h * 0.97);
  ctx.stroke();

  // Grasping hands reaching toward the player, fingers flexing.
  const flex = pulse(t, 0.3);
  const hand = (dir: number): void => {
    const hx = cx + dir * 28;
    const hy = h * 0.58;
    const forearm = (): void => {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 14, h * 0.62);
      ctx.lineTo(hx, hy);
    };
    ctx.strokeStyle = hex(bone, 0.95);
    ctx.lineWidth = 3;
    forearm();
    ctx.stroke();
    rimLight(ctx, forearm, PALETTE.cursedGlow, 1.2, 0.4);

    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.45 + flex * 0.25;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      const mx = hx + dir * Math.cos(a) * 7;
      const my = hy + Math.sin(a) * 7 + 3;
      ctx.lineTo(mx, my);
      ctx.lineTo(mx + dir * 3, my + 5 - flex * 2);
      ctx.stroke();
    }
  };
  hand(-1);
  hand(1);

  // The skull. Narrow cranium, heavy brow, cheekbones cut back hard to a small
  // jaw — a round skull with big eyes reads as a mascot, not a famine spirit.
  const skull = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - 19, skullY - 2);
    ctx.quadraticCurveTo(cx - 21, skullY - 24, cx, skullY - 27);
    ctx.quadraticCurveTo(cx + 21, skullY - 24, cx + 19, skullY - 2);
    // Brow ridge juts out over the sockets.
    ctx.lineTo(cx + 20, skullY + 1);
    ctx.quadraticCurveTo(cx + 16, skullY + 4, cx + 13, skullY + 4);
    // Cheekbone in to the jaw.
    ctx.quadraticCurveTo(cx + 11, skullY + 12, cx + 8, skullY + 15);
    ctx.lineTo(cx - 8, skullY + 15);
    ctx.quadraticCurveTo(cx - 11, skullY + 12, cx - 13, skullY + 4);
    ctx.quadraticCurveTo(cx - 16, skullY + 4, cx - 20, skullY + 1);
    ctx.closePath();
  };
  outline(ctx, skull, INK, 3, 0.95);
  ctx.fillStyle = radGrad(ctx, cx - 7, skullY - 12, 30, [
    [0, lighten(bone, 0.2)],
    [0.5, bone],
    [0.85, boneDark],
    [1, 0x3f3826],
  ]);
  skull();
  ctx.fill();

  clipped(ctx, skull, () => {
    // The crack across the cranium.
    ctx.strokeStyle = hex(0x2b2415, 0.8);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 12, skullY - 22);
    ctx.lineTo(cx - 6, skullY - 12);
    ctx.lineTo(cx - 10, skullY - 4);
    ctx.lineTo(cx - 2, skullY + 2);
    ctx.stroke();
    blotches(ctx, cx, skullY, 22, 20, 0x4a4028, 12, 55, 0.35);
    ao(ctx, cx, skullY + 2, 24, 22, 0.45);
    keyLight(ctx, cx - 30, skullY - 30, 60, 56, 0.25);
  });
  rimLight(ctx, skull, PALETTE.cursedGlow, 2, 0.6);

  // Sockets: bottomless, leaking violet light and smoke. Angled inward, which
  // is what makes a skull look angry instead of surprised.
  const socket = (dx: number): void => {
    const sx = cx + dx;
    const sy = skullY - 4;
    const tilt = dx > 0 ? -0.3 : 0.3;
    const shape = (): void => {
      // Teardrop: wide and deep at the outer top, tapering in toward the nose.
      ctx.beginPath();
      ctx.moveTo(sx + dx * 0.55, sy - 6);
      ctx.quadraticCurveTo(sx + dx * 0.75, sy + 3, sx + dx * 0.1, sy + 5.5);
      ctx.quadraticCurveTo(sx - dx * 0.6, sy + 2, sx - dx * 0.35, sy - 5);
      ctx.quadraticCurveTo(sx, sy - 7.5, sx + dx * 0.55, sy - 6);
      ctx.closePath();
    };
    void tilt;

    ctx.fillStyle = radGrad(ctx, sx, sy, 7, [
      [0, 0x000000],
      [0.7, 0x030106],
      [1, 0x120820],
    ]);
    shape();
    ctx.fill();
    outline(ctx, shape, 0x2b2415, 1.3, 0.85);

    // The light stays *inside* the socket — a hollow with something burning at
    // the bottom of it. Letting it spill out made two friendly purple discs.
    clipped(ctx, shape, () => {
      glow(ctx, PALETTE.cursed, 4 * glowPulse, 2, () => {
        ctx.fillStyle = hex(PALETTE.cursedGlow, 0.95 * glowPulse);
        circle(ctx, sx, sy + 2, 1.3 * glowPulse);
        ctx.fill();
      });
    });

    // Smoke curling up out of the socket.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const rise = ((t + i * 0.33) % 1) * 12;
      ctx.fillStyle = radGrad(ctx, sx + Math.sin(rise * 0.4) * 3, sy - 4 - rise, 5, [
        [0, PALETTE.cursed, 0.22 * (1 - rise / 12)],
        [1, PALETTE.cursed, 0],
      ]);
      circle(ctx, sx + Math.sin(rise * 0.4) * 3, sy - 4 - rise, 5);
      ctx.fill();
    }
    ctx.restore();
  };
  socket(-10);
  socket(10);

  // Nasal cavity.
  ctx.fillStyle = hex(0x0a0510, 0.95);
  ctx.beginPath();
  ctx.moveTo(cx, skullY + 1);
  ctx.lineTo(cx - 3.4, skullY + 7);
  ctx.lineTo(cx + 3.4, skullY + 7);
  ctx.closePath();
  ctx.fill();

  // Unhinged jaw, hanging and snapping.
  const jawY = skullY + 15 + 6 - clack;
  ctx.save();
  ctx.translate(cx, jawY);
  const jaw = (): void => {
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.quadraticCurveTo(0, 12, 14, -4);
    ctx.lineTo(11, -7);
    ctx.lineTo(-11, -7);
    ctx.closePath();
  };
  outline(ctx, jaw, INK, 2.2, 0.95);
  ctx.fillStyle = linGrad(ctx, 0, -7, 0, 10, [
    [0, bone],
    [1, boneDark],
  ]);
  jaw();
  ctx.fill();
  rimLight(ctx, jaw, PALETTE.cursedGlow, 1.4, 0.45);
  ctx.restore();

  // Teeth: upper fixed, lower riding the jaw.
  ctx.fillStyle = hex(0xf0e9d2, 0.95);
  fangs(ctx, cx - 12, skullY + 12, 24, 7, 4.5, 1, 0.6, 19);
  ctx.fill();
  ctx.fillStyle = hex(0xe3d9bd, 0.95);
  fangs(ctx, cx - 11, jawY - 5, 22, 6, 4, -1, 0.6, 23);
  ctx.fill();

  grain(ctx, w, h, 0.09, 66);
};

/* ================================================================== yurei */

/** The ghost. Hair like a curtain, one white eye behind it, no legs at all. */
const yurei: DrawFn = (ctx, w, h) => {
  const t = phase(currentFrame);
  const cx = w / 2;
  const headY = h * 0.26;
  const drift = Math.sin(t * Math.PI * 2) * 1.6;
  // The eye surfaces and sinks back behind the hair.
  const reveal = Math.max(0, Math.sin(t * Math.PI * 2 - 0.6));

  aura(ctx, cx, h * 0.5, 30, PALETTE.spirit, 8, 9);

  ctx.save();
  ctx.globalAlpha = 0.78;

  // Funeral kimono, dissolving into vapour at the hem.
  const robe = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - 11, headY + 6);
    ctx.quadraticCurveTo(cx - 19, h * 0.55, cx - 14 + drift, h * 0.82);
    ctx.quadraticCurveTo(cx, h * 0.92, cx + 14 + drift, h * 0.82);
    ctx.quadraticCurveTo(cx + 19, h * 0.55, cx + 11, headY + 6);
    ctx.closePath();
  };
  outline(ctx, robe, 0x223a48, 2, 0.55);
  ctx.fillStyle = linGrad(ctx, cx, headY, cx, h * 0.95, [
    [0, 0xf2fbff, 0.95],
    [0.45, 0xc7e6f2, 0.8],
    [0.8, 0x7fb0c4, 0.35],
    [1, 0x5a8fb0, 0],
  ]);
  robe();
  ctx.fill();

  clipped(ctx, robe, () => {
    // Kimono fold + the crossed collar of the dead.
    ctx.strokeStyle = hex(0x6f9db3, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, headY + 8);
    ctx.lineTo(cx, headY + 18);
    ctx.lineTo(cx + 8, headY + 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, headY + 18);
    ctx.lineTo(cx + drift * 0.5, h * 0.8);
    ctx.stroke();
    ao(ctx, cx, h * 0.6, 20, 30, 0.3);
  });

  // Vapour where the legs should be.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const vr = rng(15);
  for (let i = 0; i < 7; i++) {
    const vx = cx - 12 + vr() * 24 + drift;
    const vy = h * 0.82 + vr() * 12;
    const vrad = 5 + vr() * 8;
    ctx.fillStyle = radGrad(ctx, vx, vy, vrad, [
      [0, PALETTE.spirit, 0.16],
      [1, PALETTE.spirit, 0],
    ]);
    circle(ctx, vx, vy, vrad);
    ctx.fill();
  }
  ctx.restore();

  // Limp arms, long fingers.
  ctx.strokeStyle = hex(0xdaf0f8, 0.75);
  ctx.lineWidth = 3;
  [-1, 1].forEach((dir) => {
    const ax = cx + dir * 10;
    ctx.beginPath();
    ctx.moveTo(ax, headY + 10);
    ctx.quadraticCurveTo(ax + dir * 7, h * 0.45, ax + dir * 4 + drift, h * 0.58);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    for (let f = 0; f < 3; f++) {
      ctx.beginPath();
      ctx.moveTo(ax + dir * 4 + drift, h * 0.58);
      ctx.lineTo(ax + dir * (3 + f * 1.6) + drift, h * 0.58 + 7 + f);
      ctx.stroke();
    }
    ctx.lineWidth = 3;
  });

  // Face — pallid, barely there.
  const face = (): void => ellipse(ctx, cx, headY, 9, 11);
  ctx.fillStyle = radGrad(ctx, cx - 2, headY - 3, 12, [
    [0, 0xffffff],
    [0.6, 0xdceff7],
    [1, 0x9dbccb],
  ]);
  face();
  ctx.fill();

  // The eye, surfacing between the strands.
  if (reveal > 0.05) {
    glow(ctx, 0xffffff, 10 * reveal, 2, () => {
      ctx.fillStyle = hex(0xffffff, reveal);
      circle(ctx, cx - 3, headY - 1, 3.2 * reveal);
      ctx.fill();
    });
    ctx.fillStyle = hex(0x0a1a22, 0.9 * reveal);
    circle(ctx, cx - 3, headY - 1, 1.3 * reveal);
    ctx.fill();
  }
  // A mouth open in a soundless scream.
  ctx.fillStyle = hex(0x22323c, 0.55);
  ellipse(ctx, cx + 1, headY + 6, 2.2, 3.4);
  ctx.fill();

  // Black hair: a heavy curtain that swings with the drift.
  ctx.fillStyle = hex(0x0b0a12, 0.97);
  ctx.beginPath();
  ctx.moveTo(cx - 11, headY - 4);
  ctx.quadraticCurveTo(cx, headY - 15, cx + 11, headY - 4);
  ctx.quadraticCurveTo(cx + 13, headY + 14, cx + 8 + drift, h * 0.52);
  ctx.quadraticCurveTo(cx + 3, h * 0.4, cx + 2, headY + 10);
  ctx.quadraticCurveTo(cx, headY + 16, cx - 2, headY + 10);
  ctx.quadraticCurveTo(cx - 3, h * 0.4, cx - 8 + drift, h * 0.52);
  ctx.quadraticCurveTo(cx - 13, headY + 14, cx - 11, headY - 4);
  ctx.closePath();
  ctx.fill();

  // Individual strands catching the spirit light.
  ctx.strokeStyle = hex(0x3a3a52, 0.55);
  ctx.lineWidth = 0.7;
  const hr = rng(88);
  for (let i = 0; i < 10; i++) {
    const sx = cx - 10 + hr() * 20;
    ctx.beginPath();
    ctx.moveTo(sx, headY - 8);
    ctx.quadraticCurveTo(sx + drift, headY + 20, sx + drift * 1.5 - 2 + hr() * 4, h * 0.5);
    ctx.stroke();
  }

  rimLight(ctx, robe, PALETTE.spirit, 1.6, 0.6);
  ctx.restore();

  grain(ctx, w, h, 0.05, 44);
};

/* ============================================================== jorogumo */

/** Spider-woman. The pretty half is the bait; the six red eyes are the truth. */
const jorogumo: DrawFn = (ctx, w, h) => {
  const t = phase(currentFrame);
  const cx = w / 2;
  const abY = h * 0.62;

  aura(ctx, cx, abY, 28, 0x2a0d1f, 9, 8);

  const chitin = 0x171018;

  // Eight legs. They move in two alternating groups of four — never together.
  const leg = (dir: number, i: number): void => {
    const groupPhase = i % 2 === 0 ? t : (t + 0.5) % 1;
    const lift = Math.sin(groupPhase * Math.PI * 2) * 3;
    const baseA = -0.5 + i * 0.34;
    const kneeX = cx + dir * (16 + i * 5);
    const kneeY = abY - 12 - i * 2 + lift;
    const footX = cx + dir * (26 + i * 6);
    const footY = abY + 12 + i * 3 - lift * 0.5;

    const limb = (): void => {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 8, abY - 2);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
    };
    ctx.strokeStyle = hex(chitin, 0.98);
    ctx.lineCap = "round";
    ctx.lineWidth = 3.2 - i * 0.25;
    limb();
    ctx.stroke();
    rimLight(ctx, limb, 0x8a3a6a, 1, 0.35);

    // Bony joint highlight.
    ctx.fillStyle = hex(0x4a3550, 0.8);
    circle(ctx, kneeX, kneeY, 1.6);
    ctx.fill();

    // Coarse hairs.
    ctx.strokeStyle = hex(0x2e2233, 0.8);
    ctx.lineWidth = 0.7;
    for (let k = 1; k < 4; k++) {
      const hx = kneeX + ((footX - kneeX) * k) / 4;
      const hy = kneeY + ((footY - kneeY) * k) / 4;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + dir * 2.5, hy - 3);
      ctx.stroke();
    }
    ctx.lineWidth = 3.2;
    void baseA;
  };
  for (let i = 0; i < 4; i++) {
    leg(-1, i);
    leg(1, i);
  }

  // Abdomen.
  const abdomen = (): void => blob(ctx, cx, abY + 4, 18, 15, 0.12, 27);
  outline(ctx, abdomen, INK, 2.6, 0.95);
  ctx.fillStyle = radGrad(ctx, cx - 5, abY - 2, 22, [
    [0, 0x3a2338],
    [0.5, chitin],
    [1, 0x07040a],
  ]);
  abdomen();
  ctx.fill();
  clipped(ctx, abdomen, () => {
    // Red hourglass marking.
    ctx.fillStyle = hex(0xb01230, 0.85);
    ctx.beginPath();
    ctx.moveTo(cx - 5, abY - 2);
    ctx.lineTo(cx + 5, abY - 2);
    ctx.lineTo(cx + 1.6, abY + 5);
    ctx.lineTo(cx + 5, abY + 12);
    ctx.lineTo(cx - 5, abY + 12);
    ctx.lineTo(cx - 1.6, abY + 5);
    ctx.closePath();
    ctx.fill();
    ao(ctx, cx, abY + 6, 20, 17, 0.5);
    sheen(ctx, cx - 6, abY - 4, 6, 4, 0.3);
  });
  rimLight(ctx, abdomen, 0x8a3a6a, 1.6, 0.5);

  // The false woman: a pale bust rising off the cephalothorax.
  const bustY = h * 0.3;
  const bust = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - 8, abY - 8);
    ctx.quadraticCurveTo(cx - 10, bustY + 6, cx - 6, bustY + 2);
    ctx.lineTo(cx + 6, bustY + 2);
    ctx.quadraticCurveTo(cx + 10, bustY + 6, cx + 8, abY - 8);
    ctx.closePath();
  };
  outline(ctx, bust, INK, 2, 0.9);
  ctx.fillStyle = linGrad(ctx, cx, bustY, cx, abY, [
    [0, 0xf0dfe2],
    [0.6, 0xd3b6bd],
    [1, 0x6a4a58],
  ]);
  bust();
  ctx.fill();
  rimLight(ctx, bust, 0xd3b6bd, 1, 0.35);

  // Head.
  const head = (): void => ellipse(ctx, cx, bustY - 5, 7.5, 8.5);
  outline(ctx, head, INK, 2, 0.9);
  ctx.fillStyle = radGrad(ctx, cx - 2, bustY - 8, 10, [
    [0, 0xfbeef0],
    [0.65, 0xdcc2c8],
    [1, 0x8d6a76],
  ]);
  head();
  ctx.fill();
  rimLight(ctx, head, 0xf5e0e4, 1, 0.4);

  // Dead, doll-like eyes. No light in them at all.
  ctx.fillStyle = hex(0xf5eef0, 1);
  ellipse(ctx, cx - 2.8, bustY - 6, 2, 1.4);
  ctx.fill();
  ellipse(ctx, cx + 2.8, bustY - 6, 2, 1.4);
  ctx.fill();
  ctx.fillStyle = hex(0x120b12, 1);
  circle(ctx, cx - 2.8, bustY - 6, 1);
  ctx.fill();
  circle(ctx, cx + 2.8, bustY - 6, 1);
  ctx.fill();

  // Long black hair framing it.
  ctx.fillStyle = hex(0x0d0a12, 0.96);
  ctx.beginPath();
  ctx.moveTo(cx - 8, bustY - 9);
  ctx.quadraticCurveTo(cx, bustY - 18, cx + 8, bustY - 9);
  ctx.quadraticCurveTo(cx + 11, bustY + 6, cx + 7, bustY + 12);
  ctx.lineTo(cx + 5, bustY - 2);
  ctx.lineTo(cx - 5, bustY - 2);
  ctx.lineTo(cx - 7, bustY + 12);
  ctx.quadraticCurveTo(cx - 11, bustY + 6, cx - 8, bustY - 9);
  ctx.closePath();
  ctx.fill();

  // SIX spider eyes in an arc above her — they light up in sequence.
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + (i / 5) * Math.PI;
    const ex = cx + Math.cos(a) * 11;
    const ey = bustY - 13 + Math.abs(Math.sin(a)) * -3;
    const seq = (Math.sin((t - i / 6) * Math.PI * 2) + 1) / 2;
    const r = 1.5 + seq * 1.1;
    glow(ctx, 0xff1f3d, 6 * seq + 2, 2, () => {
      ctx.fillStyle = hex(mix(0xff1f3d, 0xffffff, seq * 0.4), 0.6 + seq * 0.4);
      circle(ctx, ex, ey, r);
      ctx.fill();
    });
  }

  // Chelicerae: they come out of her *mouth*, not her waist. That is the reveal
  // — the pretty face opens into a spider's jaw.
  ctx.fillStyle = hex(0x1a1018, 1);
  fangs(ctx, cx - 4, bustY - 2, 8, 3, 4.5, 1, 0.3, 5);
  ctx.fill();
  ctx.strokeStyle = hex(0x0d0810, 0.9);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - 4, bustY - 2);
  ctx.lineTo(cx + 4, bustY - 2);
  ctx.stroke();
  drip(ctx, cx - 2, bustY + 2.5, 2 + pulse(t) * 2, 0x9fd94a, 0.6);
  drip(ctx, cx + 2.4, bustY + 2, 1.6 + pulse(t, 0.4) * 1.8, 0x9fd94a, 0.5);

  // A silk thread swinging from above.
  ctx.strokeStyle = hex(0xdfe6ef, 0.35);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx + 14, 0);
  ctx.quadraticCurveTo(cx + 16 + Math.sin(t * Math.PI * 2) * 2, h * 0.15, cx + 13, bustY - 14);
  ctx.stroke();

  grain(ctx, w, h, 0.07, 99);
};

/* ============================================================= registration */

/**
 * The painters read the frame index through this module-level slot rather than
 * a parameter, because `defineSheet` hands them a plain DrawFn signature.
 * Painting is synchronous and single-threaded, so this is safe.
 */
let currentFrame = 0;

const PAINTERS: Record<EnemyKind, DrawFn> = {
  kappa,
  tengu,
  karakasa,
  oni,
  gashadokuro,
  yurei,
  jorogumo,
};

export function paintMonster(ctx: Ctx, w: number, h: number, kind: EnemyKind, frame: number): void {
  currentFrame = frame % ENEMY_FRAME_COUNT;
  PAINTERS[kind](ctx, w, h);
  currentFrame = 0;
}

export function registerMonsters(scene: Scene): void {
  ENEMY_KEYS.forEach((kind) => {
    const size = ENEMY_SIZE[kind];
    const frames: DrawFn[] = [];
    for (let f = 0; f < ENEMY_FRAME_COUNT; f++) {
      const frame = f;
      frames.push((ctx, w, h) => {
        currentFrame = frame;
        PAINTERS[kind](ctx, w, h);
        currentFrame = 0;
      });
    }
    defineSheet(scene, enemyKey(kind), size.w, size.h, frames);

    const key = enemyAnim(kind);
    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        // Ping-pong: the menace reads better without a hard loop seam.
        frames: [0, 1, 2, 3, 2, 1].map((i) => ({ key: enemyKey(kind), frame: i })),
        frameRate: kind === "gashadokuro" ? 5 : 7,
        repeat: -1,
      });
    }
  });
}
