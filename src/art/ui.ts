/**
 * Interface textures: the lacquered-and-gilt chrome every menu is built from.
 *
 * Painted once into the global TextureManager, then composed by src/ui/UIKit.ts.
 * Nothing here knows about scenes or layout — it only paints.
 */

import { Scene } from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { PALETTE } from "../config/theme";
import { UI } from "./keys";
import {
  circle,
  clipped,
  contactShadow,
  cornerBracketFrame,
  darken,
  ellipse,
  glow,
  grain,
  hex,
  lighten,
  linGrad,
  mix,
  outline,
  radGrad,
  rng,
  roundRect,
  withShadow,
} from "./paint";
import type { Ctx, Stop } from "./paint";
import { defineFlat, defineTexture } from "./registry";

/**
 * Textures the UI needs beyond the public key list: capsules and keycaps whose
 * corner radius has to survive being resized, plus the animated backdrop pieces.
 * Exported so UIKit never hardcodes a texture string either.
 */
export const UI_EXTRA = {
  pill: "ui_pill",
  keycap: "ui_keycap",
  mist: "ui_mist",
  dust: "ui_dust",
} as const;

/* ------------------------------------------------------------------ */
/* Local helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * grain() addresses raw device pixels while the registry paints through a scaled
 * transform, so it must be handed the real canvas size, not the logical one.
 */
function noise(ctx: Ctx, amount: number, seed: number): void {
  grain(ctx, ctx.canvas.width, ctx.canvas.height, amount, seed);
}

/** Faint paper fibres — what makes a dark rectangle read as washi instead of fill. */
function washi(ctx: Ctx, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  ctx.save();
  for (let i = 0; i < 80; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 10 + rand() * 55;
    const pale = rand() > 0.5;
    ctx.strokeStyle = hex(pale ? PALETTE.white : PALETTE.black, 0.018 + rand() * 0.03);
    ctx.lineWidth = 0.5 + rand() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * 0.5, y + (rand() - 0.5) * 4, x + len, y + (rand() - 0.5) * 6);
    ctx.stroke();
  }
  ctx.restore();
}

/** Gilt corner bracket + lozenge. `sx`/`sy` mirror it into the four corners. */
function cornerOrnament(ctx: Ctx, x: number, y: number, sx: number, sy: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);

  withShadow(ctx, PALETTE.goldGlow, 5, 0, 0, 0.5, () => {
    ctx.strokeStyle = hex(PALETTE.gold, 0.85);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.lineTo(0, 9);
    ctx.quadraticCurveTo(0, 0, 9, 0);
    ctx.lineTo(28, 0);
    ctx.stroke();

    ctx.strokeStyle = hex(PALETTE.goldGlow, 0.45);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(6, 22);
    ctx.lineTo(6, 13);
    ctx.quadraticCurveTo(6, 6, 13, 6);
    ctx.lineTo(23, 6);
    ctx.stroke();
  });

  ctx.save();
  ctx.translate(13, 13);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = hex(PALETTE.gold, 0.9);
  ctx.fillRect(-2.6, -2.6, 5.2, 5.2);
  ctx.fillStyle = hex(PALETTE.goldGlow, 0.7);
  ctx.fillRect(-1.1, -1.1, 2.2, 2.2);
  ctx.restore();

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */

function drawPanel(ctx: Ctx, w: number, h: number, inset: boolean): void {
  const pad = 5;
  const r = 16;
  const shape = (): void => roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, r);
  const base = inset ? PALETTE.bgDeep : PALETTE.surface;

  withShadow(ctx, PALETTE.black, 14, 0, 6, 0.6, () => {
    ctx.fillStyle = hex(darken(base, 0.45), 1);
    shape();
    ctx.fill();
  });

  const body: Stop[] = inset
    ? [
        [0, darken(base, 0.4)],
        [0.4, base],
        [1, mix(base, PALETTE.void, 0.35)],
      ]
    : [
        [0, lighten(base, 0.14)],
        [0.45, base],
        [1, darken(base, 0.32)],
      ];
  ctx.fillStyle = linGrad(ctx, 0, pad, 0, h - pad, body);
  shape();
  ctx.fill();

  clipped(ctx, shape, () => {
    washi(ctx, w, h, inset ? 404 : 101);

    // Centre stays neutral: scenes stretch this texture to arbitrary sizes, so
    // all the character has to live in the border and the corners.
    const vig: Stop[] = [
      [0, PALETTE.void, 0],
      [0.55, PALETTE.void, 0.05],
      [1, PALETTE.void, inset ? 0.5 : 0.42],
    ];
    ctx.fillStyle = radGrad(ctx, w / 2, h / 2, Math.max(w, h) * 0.68, vig);
    ctx.fillRect(0, 0, w, h);

    if (inset) {
      const top: Stop[] = [
        [0, PALETTE.black, 0.55],
        [1, PALETTE.black, 0],
      ];
      ctx.fillStyle = linGrad(ctx, 0, pad, 0, pad + h * 0.22, top);
      ctx.fillRect(0, 0, w, h * 0.5);
    } else {
      const sheen: Stop[] = [
        [0, PALETTE.white, 0.07],
        [1, PALETTE.white, 0],
      ];
      ctx.fillStyle = linGrad(ctx, 0, pad, 0, h * 0.4, sheen);
      ctx.fillRect(0, 0, w, h * 0.4);
    }
  });

  ctx.strokeStyle = hex(PALETTE.void, 0.9);
  ctx.lineWidth = 3;
  shape();
  ctx.stroke();

  if (inset) {
    ctx.strokeStyle = hex(PALETTE.border, 0.85);
    ctx.lineWidth = 1.4;
    shape();
    ctx.stroke();
  } else {
    const gilt: Stop[] = [
      [0, PALETTE.goldGlow],
      [0.45, PALETTE.gold],
      [1, PALETTE.goldDeep],
    ];
    ctx.strokeStyle = linGrad(ctx, 0, pad, 0, h - pad, gilt);
    ctx.lineWidth = 1.8;
    shape();
    ctx.stroke();

    ctx.strokeStyle = hex(PALETTE.borderHi, 0.3);
    ctx.lineWidth = 1;
    roundRect(ctx, pad + 7, pad + 7, w - pad * 2 - 14, h - pad * 2 - 14, r - 7);
    ctx.stroke();

    const o = pad + 10;
    cornerOrnament(ctx, o, o, 1, 1);
    cornerOrnament(ctx, w - o, o, -1, 1);
    cornerOrnament(ctx, o, h - o, 1, -1);
    cornerOrnament(ctx, w - o, h - o, -1, -1);
  }

  noise(ctx, 0.05, inset ? 77 : 33);
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type BtnState = "idle" | "hover" | "disabled";

function drawButton(ctx: Ctx, w: number, h: number, state: BtnState): void {
  const pad = 6;
  const r = 8;
  const shape = (): void => roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, r);
  const hot = state === "hover";
  const off = state === "disabled";

  let bg = off ? mix(PALETTE.bgDeep, PALETTE.surface, 0.5) : PALETTE.void;

  withShadow(ctx, PALETTE.sakura, off ? 0 : (hot ? 15 : 8), 0, 0, hot ? 0.8 : 0.4, () => {
    ctx.fillStyle = hex(bg, 0.9);
    shape();
    ctx.fill();
  });

  clipped(ctx, shape, () => {
    const glowStop: Stop[] = [
      [0, PALETTE.sakuraDeep, off ? 0 : (hot ? 0.4 : 0.2)],
      [1, PALETTE.void, 0.9]
    ];
    ctx.fillStyle = radGrad(ctx, w / 2, h / 2, w * 0.6, glowStop);
    ctx.fillRect(0, 0, w, h);
    
    // Seigaiha (wave) pattern
    ctx.strokeStyle = hex(PALETTE.sakuraDeep, 0.15);
    ctx.lineWidth = 1;
    const waveR = 12;
    for (let wy = -waveR; wy < h + waveR; wy += waveR) {
      const offset = (Math.floor(wy / waveR) % 2) * waveR;
      for (let wx = -waveR * 2; wx < w + waveR * 2; wx += waveR * 2) {
        const cx = wx + offset;
        const cy = wy;
        ctx.beginPath();
        ctx.arc(cx, cy, waveR, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, waveR - 3, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, waveR - 6, Math.PI, 0);
        ctx.stroke();
      }
    }
    
    washi(ctx, w, h, 88);
  });

  ctx.strokeStyle = hex(PALETTE.black, 0.8);
  ctx.lineWidth = 6;
  shape();
  ctx.stroke();

  // Bamboo pole frame: a warm tan/olive tube (never violet — that's reserved
  // for the outer glow), with joint rings standing in for culm nodes and a
  // rounded cap at each corner so the four poles read as one bound frame.
  const drawBamboo = (x1: number, y1: number, x2: number, y2: number): void => {
    const isHoriz = Math.abs(x1 - x2) > Math.abs(y1 - y2);

    ctx.strokeStyle = hex(darken(PALETTE.bambooTanDeep, 0.3), 0.95);
    ctx.lineWidth = 6.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const grad = linGrad(ctx, isHoriz ? x1 : x1 - 3, isHoriz ? y1 - 3 : y1, isHoriz ? x1 : x1 + 3, isHoriz ? y1 + 3 : y1, [
      [0, lighten(PALETTE.bambooTan, 0.3)],
      [0.5, PALETTE.bambooTan],
      [1, darken(PALETTE.bambooTanDeep, 0.2)],
    ]);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Joint rings — thin ellipses girdling the pole, not tick marks.
    const len = isHoriz ? Math.abs(x1 - x2) : Math.abs(y1 - y2);
    const segs = Math.max(1, Math.floor(len / 22));
    ctx.strokeStyle = hex(darken(PALETTE.bambooTanDeep, 0.35), 0.8);
    ctx.lineWidth = 1.3;
    for (let i = 1; i < segs; i++) {
      const p = i / segs;
      const px = x1 + (x2 - x1) * p;
      const py = y1 + (y2 - y1) * p;
      ctx.beginPath();
      if (isHoriz) ctx.ellipse(px, py, 1.5, 3.4, 0, 0, Math.PI * 2);
      else ctx.ellipse(px, py, 3.4, 1.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  drawBamboo(pad - 2, pad, w - pad + 2, pad);
  drawBamboo(pad - 2, h - pad, w - pad + 2, h - pad);
  drawBamboo(pad, pad - 2, pad, h - pad + 2);
  drawBamboo(w - pad, pad - 2, w - pad, h - pad + 2);

  // Rounded corner caps bind the four poles into one frame.
  ctx.fillStyle = hex(PALETTE.bambooTan, 0.95);
  for (const [cx, cy] of [
    [pad, pad],
    [w - pad, pad],
    [pad, h - pad],
    [w - pad, h - pad],
  ]) {
    circle(ctx, cx, cy, 3.6);
    ctx.fill();
    ctx.strokeStyle = hex(darken(PALETTE.bambooTanDeep, 0.35), 0.7);
    ctx.lineWidth = 1;
    circle(ctx, cx, cy, 3.6);
    ctx.stroke();
  }

  const rim = off ? PALETTE.textFaint : PALETTE.sakuraGlow;
  ctx.strokeStyle = hex(rim, off ? 0.3 : (hot ? 0.9 : 0.6));
  ctx.lineWidth = 1.5;
  shape();
  ctx.stroke();

  noise(ctx, 0.04, 11);
}

/** Capsule for coin badges and toasts — a pill survives non-uniform stretching. */
function drawPill(ctx: Ctx, w: number, h: number): void {
  const pad = 4;
  const r = (h - pad * 2) / 2;
  const shape = (): void => roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, r);

  withShadow(ctx, PALETTE.black, 10, 0, 4, 0.55, () => {
    ctx.fillStyle = hex(darken(PALETTE.bgDeep, 0.2), 1);
    shape();
    ctx.fill();
  });

  const body: Stop[] = [
    [0, darken(PALETTE.bgDeep, 0.25)],
    [0.5, PALETTE.bgDeep],
    [1, mix(PALETTE.surface, PALETTE.void, 0.3)],
  ];
  ctx.fillStyle = linGrad(ctx, 0, pad, 0, h - pad, body);
  shape();
  ctx.fill();

  clipped(ctx, shape, () => {
    const top: Stop[] = [
      [0, PALETTE.black, 0.5],
      [1, PALETTE.black, 0],
    ];
    ctx.fillStyle = linGrad(ctx, 0, pad, 0, pad + h * 0.35, top);
    ctx.fillRect(0, 0, w, h);
    washi(ctx, w, h, 55);
  });

  ctx.strokeStyle = hex(PALETTE.void, 0.9);
  ctx.lineWidth = 2.4;
  shape();
  ctx.stroke();
  ctx.strokeStyle = hex(PALETTE.border, 0.9);
  ctx.lineWidth = 1.2;
  shape();
  ctx.stroke();

  const lift: Stop[] = [
    [0, PALETTE.white, 0.18],
    [1, PALETTE.white, 0],
  ];
  ctx.strokeStyle = linGrad(ctx, 0, pad, 0, h * 0.5, lift);
  ctx.lineWidth = 1;
  roundRect(ctx, pad + 1.2, pad + 1.2, w - pad * 2 - 2.4, h - pad * 2 - 2.4, r - 1.2);
  ctx.stroke();

  noise(ctx, 0.04, 91);
}

/** Keycap for the on-screen initials keypad. */
function drawKeycap(ctx: Ctx, w: number, h: number): void {
  const pad = 3;
  const r = 8;
  const shape = (): void => roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, r);

  withShadow(ctx, PALETTE.black, 6, 0, 3, 0.6, () => {
    ctx.fillStyle = hex(darken(PALETTE.surface, 0.3), 1);
    shape();
    ctx.fill();
  });

  const body: Stop[] = [
    [0, mix(PALETTE.surfaceHi, PALETTE.borderHi, 0.28)],
    [1, darken(PALETTE.surface, 0.3)],
  ];
  ctx.fillStyle = linGrad(ctx, 0, pad, 0, h - pad, body);
  shape();
  ctx.fill();

  clipped(ctx, shape, () => {
    const gloss: Stop[] = [
      [0, PALETTE.white, 0.2],
      [1, PALETTE.white, 0],
    ];
    ctx.fillStyle = linGrad(ctx, 0, pad, 0, h * 0.55, gloss);
    ctx.fillRect(0, 0, w, h);
  });

  ctx.strokeStyle = hex(PALETTE.void, 0.85);
  ctx.lineWidth = 2;
  shape();
  ctx.stroke();
  ctx.strokeStyle = hex(PALETTE.goldDeep, 0.55);
  ctx.lineWidth = 1;
  shape();
  ctx.stroke();

  noise(ctx, 0.04, 61);
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function drawCoin(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2 - 3;

  glow(ctx, PALETTE.gold, 7, 2, () => {
    ctx.fillStyle = hex(PALETTE.gold, 0.85);
    circle(ctx, cx, cy, r);
    ctx.fill();
  });

  const face: Stop[] = [
    [0, PALETTE.goldGlow],
    [0.45, PALETTE.gold],
    [0.86, PALETTE.goldDeep],
    [1, darken(PALETTE.goldDeep, 0.4)],
  ];
  ctx.fillStyle = radGrad(ctx, cx, cy, r, face, cx - r * 0.35, cy - r * 0.4);
  circle(ctx, cx, cy, r);
  ctx.fill();

  ctx.strokeStyle = hex(darken(PALETTE.goldDeep, 0.45), 0.7);
  ctx.lineWidth = 1.2;
  circle(ctx, cx, cy, r - 2.4);
  ctx.stroke();
  ctx.strokeStyle = hex(PALETTE.goldGlow, 0.5);
  ctx.lineWidth = 0.7;
  circle(ctx, cx, cy, r - 3.6);
  ctx.stroke();

  // Engraved bars around the square hole: a mon, not a poker chip.
  ctx.fillStyle = hex(darken(PALETTE.goldDeep, 0.35), 0.5);
  ctx.fillRect(cx - 0.7, cy - 8.4, 1.4, 2.8);
  ctx.fillRect(cx - 0.7, cy + 5.6, 1.4, 2.8);
  ctx.fillRect(cx - 8.4, cy - 0.7, 2.8, 1.4);
  ctx.fillRect(cx + 5.6, cy - 0.7, 2.8, 1.4);

  const hole = (): void => roundRect(ctx, cx - 3.4, cy - 3.4, 6.8, 6.8, 1.2);
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = hex(PALETTE.black, 1);
  hole();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = hex(darken(PALETTE.goldDeep, 0.5), 0.9);
  ctx.lineWidth = 1;
  hole();
  ctx.stroke();

  ctx.strokeStyle = hex(darken(PALETTE.goldDeep, 0.55), 0.9);
  ctx.lineWidth = 1.4;
  circle(ctx, cx, cy, r);
  ctx.stroke();

  ctx.fillStyle = hex(PALETTE.white, 0.55);
  ellipse(ctx, cx - r * 0.38, cy - r * 0.44, r * 0.3, r * 0.15, -0.6);
  ctx.fill();

  noise(ctx, 0.05, 21);
}

function heartPath(ctx: Ctx, cx: number, cy: number, hw: number, hh: number): void {
  const r = Math.min(hw, hh) + 2;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5 - Math.PI / 2;
    const cp1X = cx + Math.cos(angle - 0.4) * r * 1.4;
    const cp1Y = cy + Math.sin(angle - 0.4) * r * 1.4;
    const cp2X = cx + Math.cos(angle + 0.4) * r * 1.4;
    const cp2Y = cy + Math.sin(angle + 0.4) * r * 1.4;
    
    if (i === 0) ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, cx, cy);
  }
  ctx.closePath();
}

function drawHeart(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const hw = w / 2 - 4;
  const hh = h / 2 - 4;
  const shape = (): void => heartPath(ctx, cx, cy, hw, hh);

  glow(ctx, PALETTE.sakuraGlow, 8, 3, () => {
    ctx.fillStyle = hex(PALETTE.sakuraDeep, 0.9);
    shape();
    ctx.fill();
  });

  const flesh: Stop[] = [
    [0, PALETTE.white],
    [0.4, PALETTE.sakuraGlow],
    [1, PALETTE.sakuraDeep],
  ];
  ctx.fillStyle = radGrad(ctx, cx, cy, hh * 1.5, flesh, cx, cy);
  shape();
  ctx.fill();

  outline(ctx, shape, darken(PALETTE.sakuraDeep, 0.4), 1.5, 0.9);
  
  // Center dot
  ctx.fillStyle = hex(PALETTE.gold, 0.9);
  circle(ctx, cx, cy, 2);
  ctx.fill();

  noise(ctx, 0.05, 31);
}

function drawLock(ctx: Ctx, w: number, h: number): void {
  const iron = 0x8790a6;
  const ironDark = 0x2b2f3d;
  const bodyY = h * 0.4;
  const bodyH = h - bodyY - 2;
  const bodyX = 2.5;
  const bodyW = w - 5;
  const cx = w / 2;

  // Shackle
  const shackle = (): void => {
    ctx.beginPath();
    ctx.arc(cx, bodyY + 1, w * 0.26, Math.PI, 0);
  };
  ctx.strokeStyle = hex(darken(ironDark, 0.5), 0.95);
  ctx.lineWidth = 5.4;
  shackle();
  ctx.stroke();
  const bar: Stop[] = [
    [0, lighten(iron, 0.25)],
    [0.5, iron],
    [1, darken(ironDark, 0.1)],
  ];
  ctx.strokeStyle = linGrad(ctx, 0, 0, w, 0, bar);
  ctx.lineWidth = 3.6;
  shackle();
  ctx.stroke();
  ctx.strokeStyle = hex(PALETTE.white, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, bodyY + 1, w * 0.26, Math.PI * 1.12, Math.PI * 1.45);
  ctx.stroke();

  // Body
  const shape = (): void => roundRect(ctx, bodyX, bodyY, bodyW, bodyH, 3.5);
  const face: Stop[] = [
    [0, lighten(iron, 0.2)],
    [0.35, iron],
    [0.75, darken(iron, 0.35)],
    [1, ironDark],
  ];
  ctx.fillStyle = linGrad(ctx, bodyX, bodyY, bodyX + bodyW * 0.4, bodyY + bodyH, face);
  shape();
  ctx.fill();

  clipped(ctx, shape, () => {
    // Patina: this padlock has hung on the shrine gate for a century.
    const rand = rng(17);
    for (let i = 0; i < 26; i++) {
      const x = bodyX + rand() * bodyW;
      const y = bodyY + rand() * bodyH;
      ctx.fillStyle = hex(rand() > 0.55 ? 0x4e6b58 : darken(ironDark, 0.3), 0.1 + rand() * 0.2);
      circle(ctx, x, y, 0.6 + rand() * 1.8);
      ctx.fill();
    }
    const edge: Stop[] = [
      [0, PALETTE.black, 0],
      [1, PALETTE.black, 0.5],
    ];
    ctx.fillStyle = linGrad(ctx, 0, bodyY + bodyH * 0.45, 0, bodyY + bodyH, edge);
    ctx.fillRect(0, 0, w, h);
  });

  // Rivets
  const rivets: Array<[number, number]> = [
    [bodyX + 3, bodyY + 3],
    [bodyX + bodyW - 3, bodyY + 3],
    [bodyX + 3, bodyY + bodyH - 3],
    [bodyX + bodyW - 3, bodyY + bodyH - 3],
  ];
  rivets.forEach(([rx, ry]) => {
    ctx.fillStyle = radGrad(ctx, rx, ry, 1.9, [
      [0, lighten(iron, 0.5)],
      [1, darken(ironDark, 0.2)],
    ]);
    circle(ctx, rx, ry, 1.9);
    ctx.fill();
  });

  // Keyhole, punched clean through
  const keyhole = (): void => {
    ctx.beginPath();
    ctx.arc(cx, bodyY + bodyH * 0.42, 2.4, 0, Math.PI * 2);
    ctx.moveTo(cx - 1.3, bodyY + bodyH * 0.42);
    ctx.lineTo(cx - 2.1, bodyY + bodyH * 0.85);
    ctx.lineTo(cx + 2.1, bodyY + bodyH * 0.85);
    ctx.lineTo(cx + 1.3, bodyY + bodyH * 0.42);
    ctx.closePath();
  };
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = hex(PALETTE.black, 1);
  keyhole();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = hex(darken(ironDark, 0.4), 0.9);
  ctx.lineWidth = 0.9;
  keyhole();
  ctx.stroke();

  outline(ctx, shape, PALETTE.void, 1.6, 0.9);
  noise(ctx, 0.06, 41);
}

function drawCheck(ctx: Ctx, w: number, h: number): void {
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.52);
    ctx.lineTo(w * 0.42, h * 0.74);
    ctx.lineTo(w * 0.82, h * 0.24);
  };

  glow(ctx, PALETTE.jade, 8, 3, () => {
    ctx.strokeStyle = hex(PALETTE.jade, 0.9);
    ctx.lineWidth = 4.4;
    path();
    ctx.stroke();
  });

  ctx.strokeStyle = hex(darken(PALETTE.jadeDeep, 0.6), 0.85);
  ctx.lineWidth = 6.4;
  path();
  ctx.stroke();

  const blade: Stop[] = [
    [0, lighten(PALETTE.jade, 0.35)],
    [0.6, PALETTE.jade],
    [1, PALETTE.jadeDeep],
  ];
  ctx.strokeStyle = linGrad(ctx, 0, 0, w, h, blade);
  ctx.lineWidth = 4.4;
  path();
  ctx.stroke();

  ctx.strokeStyle = hex(PALETTE.white, 0.5);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.48);
  ctx.lineTo(w * 0.42, h * 0.69);
  ctx.lineTo(w * 0.8, h * 0.21);
  ctx.stroke();

  noise(ctx, 0.04, 51);
}

function starPath(ctx: Ctx, cx: number, cy: number, rOut: number, rIn: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? rOut : rIn;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawStar(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2 + 0.5;
  const rOut = w / 2 - 2.5;
  const rIn = rOut * 0.44;
  const shape = (): void => starPath(ctx, cx, cy, rOut, rIn);

  glow(ctx, PALETTE.gold, 8, 3, () => {
    ctx.fillStyle = hex(PALETTE.gold, 0.85);
    shape();
    ctx.fill();
  });

  const face: Stop[] = [
    [0, PALETTE.goldGlow],
    [0.5, PALETTE.gold],
    [1, PALETTE.goldDeep],
  ];
  ctx.fillStyle = radGrad(ctx, cx, cy, rOut, face, cx - rOut * 0.3, cy - rOut * 0.35);
  shape();
  ctx.fill();

  // Facets: each arm split into a lit and a shaded half so it reads as bevelled metal.
  clipped(ctx, shape, () => {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const px = cx + Math.cos(a) * rOut;
      const py = cy + Math.sin(a) * rOut;
      const aL = a - Math.PI / 5;
      const aR = a + Math.PI / 5;
      const lx = cx + Math.cos(aL) * rIn;
      const ly = cy + Math.sin(aL) * rIn;
      const rx = cx + Math.cos(aR) * rIn;
      const ry = cy + Math.sin(aR) * rIn;

      ctx.fillStyle = hex(PALETTE.white, 0.16);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.lineTo(lx, ly);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = hex(PALETTE.black, 0.2);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.lineTo(rx, ry);
      ctx.closePath();
      ctx.fill();
    }
  });

  outline(ctx, shape, darken(PALETTE.goldDeep, 0.6), 1.5, 0.9);

  ctx.fillStyle = hex(PALETTE.white, 0.75);
  circle(ctx, cx - rOut * 0.18, cy - rOut * 0.42, 1.4);
  ctx.fill();

  noise(ctx, 0.05, 71);
}

/* ------------------------------------------------------------------ */
/* Bottom nav icons — flat ink silhouette + a thin bright rim, matching  */
/* the reference art's pictogram language (not tinted colour icons).    */
/* ------------------------------------------------------------------ */

function iconGlowFill(ctx: Ctx, shape: () => void): void {
  glow(ctx, PALETTE.white, 4, 2, () => {
    ctx.strokeStyle = hex(PALETTE.white, 0.85);
    ctx.lineWidth = 1.5;
    shape();
    ctx.stroke();
  });
  ctx.fillStyle = hex(PALETTE.void, 0.95);
  shape();
  ctx.fill();
}

function drawShopIcon(ctx: Ctx, w: number, h: number): void {
  const awning = (): void => {
    ctx.beginPath();
    const top = h * 0.2;
    const scallops = 4;
    const x0 = w * 0.1;
    const segW = (w * 0.8) / scallops;
    ctx.moveTo(x0, top);
    for (let i = 0; i < scallops; i++) {
      const xa = x0 + i * segW;
      const xb = xa + segW;
      ctx.quadraticCurveTo((xa + xb) / 2, top + h * 0.16, xb, top);
    }
    ctx.lineTo(w * 0.9, h * 0.08);
    ctx.lineTo(w * 0.1, h * 0.08);
    ctx.closePath();
  };
  const body = (): void => {
    ctx.beginPath();
    ctx.rect(w * 0.16, h * 0.38, w * 0.68, h * 0.48);
  };
  iconGlowFill(ctx, awning);
  iconGlowFill(ctx, body);

  ctx.strokeStyle = hex(PALETTE.white, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.54);
  ctx.lineTo(w * 0.5, h * 0.82);
  ctx.stroke();
  for (let i = 1; i < 4; i++) {
    const x = w * 0.1 + (i * (w * 0.8)) / 4;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.1);
    ctx.lineTo(x, h * 0.2);
    ctx.stroke();
  }
  noise(ctx, 0.04, 141);
}

function drawGearIcon(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const rOut = w * 0.3;
  const rIn = rOut * 0.62;
  const teeth = 8;
  const shape = (): void => {
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2) / teeth / 2.4;
      const a2 = a0 + (Math.PI * 2) / teeth;
      const p0 = { x: cx + Math.cos(a0) * rIn, y: cy + Math.sin(a0) * rIn };
      const p1 = { x: cx + Math.cos(a0) * rOut, y: cy + Math.sin(a0) * rOut };
      const p2 = { x: cx + Math.cos(a1) * rOut, y: cy + Math.sin(a1) * rOut };
      const p3 = { x: cx + Math.cos(a1) * rIn, y: cy + Math.sin(a1) * rIn };
      const p4 = { x: cx + Math.cos(a2) * rIn, y: cy + Math.sin(a2) * rIn };
      if (i === 0) ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
    }
    ctx.closePath();
  };
  iconGlowFill(ctx, shape);

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = hex(PALETTE.black, 1);
  circle(ctx, cx, cy, rIn * 0.5);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = hex(PALETTE.white, 0.4);
  ctx.lineWidth = 0.8;
  circle(ctx, cx, cy, rIn * 0.5);
  ctx.stroke();

  noise(ctx, 0.04, 151);
}

function drawCrownIcon(ctx: Ctx, w: number, h: number): void {
  const top = h * 0.22;
  const base = h * 0.62;
  const bandH = h * 0.16;
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(w * 0.12, base);
    ctx.lineTo(w * 0.12, h * 0.42);
    ctx.lineTo(w * 0.28, base - h * 0.06);
    ctx.lineTo(w * 0.42, h * 0.3);
    ctx.lineTo(w * 0.5, top);
    ctx.lineTo(w * 0.58, h * 0.3);
    ctx.lineTo(w * 0.72, base - h * 0.06);
    ctx.lineTo(w * 0.88, h * 0.42);
    ctx.lineTo(w * 0.88, base);
    ctx.closePath();
  };
  const band = (): void => {
    ctx.beginPath();
    ctx.rect(w * 0.12, base, w * 0.76, bandH);
  };
  iconGlowFill(ctx, shape);
  iconGlowFill(ctx, band);

  // A single jewel at the centre peak — reads as "rank 1" without a digit glyph.
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = hex(PALETTE.black, 1);
  circle(ctx, w * 0.5, base + bandH * 0.5, 1.6);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = hex(PALETTE.white, 0.5);
  ctx.lineWidth = 0.7;
  circle(ctx, w * 0.5, base + bandH * 0.5, 1.6);
  ctx.stroke();

  noise(ctx, 0.04, 161);
}

function drawBookIcon(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const top = h * 0.22;
  const bottom = h * 0.8;
  const pageL = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx, top + h * 0.06);
    ctx.quadraticCurveTo(w * 0.14, top, w * 0.1, top + h * 0.08);
    ctx.lineTo(w * 0.1, bottom - h * 0.02);
    ctx.quadraticCurveTo(w * 0.14, bottom - h * 0.08, cx, bottom);
    ctx.closePath();
  };
  const pageR = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx, top + h * 0.06);
    ctx.quadraticCurveTo(w * 0.86, top, w * 0.9, top + h * 0.08);
    ctx.lineTo(w * 0.9, bottom - h * 0.02);
    ctx.quadraticCurveTo(w * 0.86, bottom - h * 0.08, cx, bottom);
    ctx.closePath();
  };
  iconGlowFill(ctx, pageL);
  iconGlowFill(ctx, pageR);

  ctx.strokeStyle = hex(PALETTE.white, 0.55);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, top + h * 0.06);
  ctx.lineTo(cx, bottom);
  ctx.stroke();

  // Tomoe swirl on the cover — two comma shapes chasing each other.
  const r = h * 0.13;
  const tx = cx;
  const ty = top + h * 0.32;
  for (const sign of [-1, 1] as const) {
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(sign > 0 ? Math.PI : 0);
    ctx.fillStyle = hex(PALETTE.white, 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, Math.PI * 1.5, Math.PI * 0.5, false);
    ctx.arc(0, -r * 0.28, r * 0.28, Math.PI * 0.5, Math.PI * 1.5, true);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  noise(ctx, 0.04, 171);
}

/* ------------------------------------------------------------------ */
/* Menu lantern — a stone toro in three tiers, tall rather than a       */
/* stretched gameplay platform, for the hero to stand on.               */
/* ------------------------------------------------------------------ */

function drawLantern(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const rand = rng(303);

  // Pedestal.
  const baseTop = h * 0.75;
  const base = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.16, h - 4);
    ctx.lineTo(cx + w * 0.16, h - 4);
    ctx.lineTo(cx + w * 0.22, baseTop);
    ctx.lineTo(cx - w * 0.22, baseTop);
    ctx.closePath();
  };
  outline(ctx, base, PALETTE.void, 2.2, 0.85);
  ctx.fillStyle = linGrad(ctx, cx, baseTop, cx, h, [
    [0, lighten(PALETTE.stoneLight, 0.1)],
    [1, darken(PALETTE.stone, 0.3)],
  ]);
  base();
  ctx.fill();

  // Body — a windowed box.
  const bodyTop = h * 0.41;
  const bodyBottom = baseTop;
  const bodyHW = w * 0.27;
  const body = (): void => {
    roundRect(ctx, cx - bodyHW, bodyTop, bodyHW * 2, bodyBottom - bodyTop, 4);
  };
  outline(ctx, body, PALETTE.void, 2.4, 0.9);
  ctx.fillStyle = radGrad(ctx, cx - bodyHW * 0.3, bodyTop + 6, bodyHW * 2.4, [
    [0, lighten(PALETTE.stoneLight, 0.14)],
    [0.55, PALETTE.stoneLight],
    [1, darken(PALETTE.stone, 0.2)],
  ]);
  body();
  ctx.fill();

  clipped(ctx, body, () => {
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = hex(rand() > 0.5 ? lighten(PALETTE.stoneLight, 0.2) : darken(PALETTE.stone, 0.3), 0.12 + rand() * 0.14);
      circle(ctx, cx - bodyHW + rand() * bodyHW * 2, bodyTop + rand() * (bodyBottom - bodyTop), 0.6 + rand() * 1.6);
      ctx.fill();
    }
  });

  // Windows — the lantern's fire-holes, dark.
  const winW = bodyHW * 0.62;
  const winH = (bodyBottom - bodyTop) * 0.42;
  const winY = bodyTop + (bodyBottom - bodyTop) * 0.24;
  for (const side of [-1, 1] as const) {
    const wx = cx + side * bodyHW * 0.52 - winW / 2;
    ctx.fillStyle = hex(PALETTE.void, 0.88);
    roundRect(ctx, wx, winY, winW, winH, 2);
    ctx.fill();
    ctx.strokeStyle = hex(darken(PALETTE.stone, 0.5), 0.7);
    ctx.lineWidth = 1.4;
    roundRect(ctx, wx, winY, winW, winH, 2);
    ctx.stroke();
  }

  // Roof — a wide pagoda cap with upswept corners, like the torii lintel.
  const roofY = h * 0.32;
  const roofHW = w * 0.46;
  const roof = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - roofHW, roofY + 10);
    ctx.quadraticCurveTo(cx - roofHW * 1.05, roofY - 6, cx - roofHW * 0.62, roofY - 2);
    ctx.quadraticCurveTo(cx, roofY - 12, cx + roofHW * 0.62, roofY - 2);
    ctx.quadraticCurveTo(cx + roofHW * 1.05, roofY - 6, cx + roofHW, roofY + 10);
    ctx.lineTo(cx + roofHW * 0.72, roofY + 16);
    ctx.lineTo(cx - roofHW * 0.72, roofY + 16);
    ctx.closePath();
  };
  outline(ctx, roof, PALETTE.void, 2.4, 0.9);
  ctx.fillStyle = linGrad(ctx, cx, roofY - 12, cx, roofY + 16, [
    [0, lighten(PALETTE.stoneLight, 0.16)],
    [0.6, PALETTE.stoneLight],
    [1, darken(PALETTE.stone, 0.3)],
  ]);
  roof();
  ctx.fill();

  // Finial stack — short and butted right against the roof peak, not a
  // floating dot, so a standing figure reads as perched on the roof itself.
  const finialY = roofY - 11;
  const finial = (): void => {
    ctx.beginPath();
    ctx.ellipse(cx, finialY, w * 0.075, h * 0.026, 0, 0, Math.PI * 2);
  };
  outline(ctx, finial, PALETTE.void, 1.8, 0.85);
  ctx.fillStyle = hex(PALETTE.stoneLight, 1);
  finial();
  ctx.fill();
  ctx.fillStyle = hex(darken(PALETTE.stone, 0.2), 0.9);
  circle(ctx, cx, finialY - h * 0.032, w * 0.045);
  ctx.fill();

  // Moss — vivid, high-contrast patches under the roof and dripping down.
  clipped(ctx, roof, () => {
    for (let i = 0; i < 10; i++) {
      const mx = cx - roofHW * 0.7 + rand() * roofHW * 1.4;
      const my = roofY + 6 + rand() * 8;
      ctx.fillStyle = hex(mix(PALETTE.moss, PALETTE.mossDeep, rand() * 0.5), 0.55 + rand() * 0.3);
      ellipse(ctx, mx, my, 4 + rand() * 5, 2.4 + rand() * 2.6, rand() * 0.6);
      ctx.fill();
    }
  });
  ctx.strokeStyle = hex(PALETTE.mossDeep, 0.6);
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const mx = cx - roofHW * 0.55 + rand() * roofHW * 1.1;
    const len = 6 + rand() * 12;
    ctx.beginPath();
    ctx.moveTo(mx, roofY + 15);
    ctx.quadraticCurveTo(mx + (rand() - 0.5) * 3, roofY + 15 + len * 0.6, mx + (rand() - 0.5) * 4, roofY + 15 + len);
    ctx.stroke();
  }

  clipped(ctx, body, () => {
    ctx.fillStyle = hex(darken(PALETTE.stone, 0.35), 0.5);
    ctx.beginPath();
    ctx.moveTo(cx - bodyHW, bodyBottom);
    ctx.lineTo(cx - bodyHW, bodyBottom - 10);
    ctx.lineTo(cx - bodyHW + 10, bodyBottom);
    ctx.closePath();
    ctx.fill();
  });

  noise(ctx, 0.05, 313);
}

/* ------------------------------------------------------------------ */
/* HUD score frame — a hollow cartouche, not a solid ink block          */
/* ------------------------------------------------------------------ */

function drawScoreFrame(ctx: Ctx, w: number, h: number): void {
  const pad = 6;

  ctx.fillStyle = hex(PALETTE.void, 0.32);
  roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, 5);
  ctx.fill();
  ctx.strokeStyle = hex(PALETTE.void, 0.55);
  ctx.lineWidth = 1.3;
  roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, 5);
  ctx.stroke();

  ctx.strokeStyle = hex(PALETTE.text, 0.85);
  glow(ctx, PALETTE.white, 3, 2, () => {
    cornerBracketFrame(ctx, pad + 3, pad + 3, w - pad * 2 - 6, h - pad * 2 - 6, 8, 1.6, 0.32);
  });

  noise(ctx, 0.03, 181);
}

function drawChevron(ctx: Ctx, w: number, h: number): void {
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.2);
    ctx.lineTo(w * 0.7, h * 0.5);
    ctx.lineTo(w * 0.36, h * 0.8);
  };

  ctx.strokeStyle = hex(PALETTE.void, 0.85);
  ctx.lineWidth = 4.4;
  path();
  ctx.stroke();

  glow(ctx, PALETTE.spirit, 4, 1, () => {
    ctx.strokeStyle = hex(PALETTE.text, 0.95);
    ctx.lineWidth = 2.6;
    path();
    ctx.stroke();
  });

  ctx.strokeStyle = hex(PALETTE.white, 0.9);
  ctx.lineWidth = 2.6;
  path();
  ctx.stroke();
}

/* ------------------------------------------------------------------ */
/* Ornaments                                                           */
/* ------------------------------------------------------------------ */

function drawScroll(ctx: Ctx, w: number, h: number): void {
  const rodW = 15;
  const px = rodW + 3;
  const pw = w - px * 2;

  const paper = (): void => {
    ctx.beginPath();
    ctx.moveTo(px, 12);
    ctx.quadraticCurveTo(w / 2, 6, px + pw, 12);
    ctx.lineTo(px + pw, h - 12);
    ctx.quadraticCurveTo(w / 2, h - 6, px, h - 12);
    ctx.closePath();
  };

  withShadow(ctx, PALETTE.black, 10, 0, 4, 0.5, () => {
    ctx.fillStyle = hex(0xd8c69e, 1);
    paper();
    ctx.fill();
  });

  const sheet: Stop[] = [
    [0, 0xf7edd6],
    [0.45, 0xe9d9b6],
    [1, 0xcdb88d],
  ];
  ctx.fillStyle = linGrad(ctx, 0, 8, 0, h - 8, sheet);
  paper();
  ctx.fill();

  clipped(ctx, paper, () => {
    const rand = rng(23);
    for (let i = 0; i < 16; i++) {
      const x = px + rand() * pw;
      const y = 10 + rand() * (h - 20);
      const r = 4 + rand() * 16;
      ctx.fillStyle = radGrad(ctx, x, y, r, [
        [0, 0x8a6a3a, 0.09 + rand() * 0.06],
        [1, 0x8a6a3a, 0],
      ]);
      circle(ctx, x, y, r);
      ctx.fill();
    }
    // Sepia burn towards the edges.
    ctx.fillStyle = radGrad(ctx, w / 2, h / 2, Math.max(w, h) * 0.6, [
      [0, 0x8a6a3a, 0],
      [0.6, 0x8a6a3a, 0.05],
      [1, 0x6b4a22, 0.4],
    ]);
    ctx.fillRect(0, 0, w, h);

    // The sheet curls where it leaves the rods.
    const curlL: Stop[] = [
      [0, PALETTE.black, 0.35],
      [1, PALETTE.black, 0],
    ];
    ctx.fillStyle = linGrad(ctx, px, 0, px + 22, 0, curlL);
    ctx.fillRect(px, 0, 22, h);
    const curlR: Stop[] = [
      [0, PALETTE.black, 0],
      [1, PALETTE.black, 0.35],
    ];
    ctx.fillStyle = linGrad(ctx, px + pw - 22, 0, px + pw, 0, curlR);
    ctx.fillRect(px + pw - 22, 0, 22, h);
  });

  outline(ctx, paper, 0x6b4a22, 1.2, 0.5);

  const rod = (x: number): void => {
    const shape = (): void => roundRect(ctx, x, 3, rodW, h - 6, rodW / 2);
    withShadow(ctx, PALETTE.black, 8, 0, 3, 0.55, () => {
      ctx.fillStyle = hex(0x3a2716, 1);
      shape();
      ctx.fill();
    });
    const wood: Stop[] = [
      [0, 0x8a6440],
      [0.35, 0x5f4128],
      [1, 0x2a1c10],
    ];
    ctx.fillStyle = linGrad(ctx, x, 0, x + rodW, 0, wood);
    shape();
    ctx.fill();

    ctx.strokeStyle = hex(PALETTE.goldGlow, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 3.5, 8);
    ctx.lineTo(x + 3.5, h - 8);
    ctx.stroke();

    // Gilt end caps.
    const cap: Stop[] = [
      [0, PALETTE.goldGlow],
      [0.5, PALETTE.gold],
      [1, PALETTE.goldDeep],
    ];
    ctx.fillStyle = linGrad(ctx, x, 0, x + rodW, 0, cap);
    roundRect(ctx, x - 1, 1, rodW + 2, 7, 3);
    ctx.fill();
    roundRect(ctx, x - 1, h - 8, rodW + 2, 7, 3);
    ctx.fill();

    outline(ctx, shape, PALETTE.void, 1.4, 0.85);
  };
  rod(1);
  rod(w - rodW - 1);

  noise(ctx, 0.06, 83);
}

function drawTorii(ctx: Ctx, w: number, h: number): void {
  // Weathered stone, not lacquered red — the mockups' vocabulary is moss-stone
  // and bamboo, never a warm red/orange structure.
  const red = PALETTE.stoneLight;
  const redLo = darken(PALETTE.stone, 0.4);
  const redHi = lighten(PALETTE.stoneLight, 0.25);

  contactShadow(ctx, w / 2, h - 3, w * 0.42, 5, 0.45);

  const paint = (shape: () => void): void => {
    const body: Stop[] = [
      [0, redHi],
      [0.35, red],
      [1, redLo],
    ];
    ctx.fillStyle = linGrad(ctx, 0, 0, 0, h, body);
    shape();
    ctx.fill();
    outline(ctx, shape, darken(redLo, 0.55), 1.8, 0.9);
  };

  // Pillars, slightly splayed like the real thing.
  const pillar = (x: number): void => {
    const shape = (): void => {
      ctx.beginPath();
      ctx.moveTo(x - 5, 22);
      ctx.lineTo(x + 5, 22);
      ctx.lineTo(x + 7.5, h - 4);
      ctx.lineTo(x - 7.5, h - 4);
      ctx.closePath();
    };
    paint(shape);
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = linGrad(ctx, x - 7, 0, x + 7, 0, [
      [0, PALETTE.white, 0.22],
      [0.45, PALETTE.white, 0],
      [1, PALETTE.black, 0.3],
    ]);
    ctx.fillRect(x - 9, 20, 18, h);
    ctx.restore();
  };
  pillar(w * 0.22);
  pillar(w * 0.78);

  // Nuki (lower beam)
  const nuki = (): void => roundRect(ctx, w * 0.11, 40, w * 0.78, 8, 2);
  paint(nuki);

  // Gakuzuka (central plaque)
  const plaque = (): void => roundRect(ctx, w / 2 - 7, 22, 14, 19, 2);
  paint(plaque);
  ctx.fillStyle = hex(PALETTE.goldGlow, 0.5);
  ctx.fillRect(w / 2 - 3.5, 27, 7, 1.5);
  ctx.fillRect(w / 2 - 3.5, 31, 7, 1.5);
  ctx.fillRect(w / 2 - 3.5, 35, 7, 1.5);

  // Shimaki (second lintel)
  const shimaki = (): void => roundRect(ctx, w * 0.08, 20, w * 0.84, 7, 2);
  paint(shimaki);

  // Kasagi (top lintel) — swept up at both ends.
  const kasagi = (): void => {
    ctx.beginPath();
    ctx.moveTo(2, 16);
    ctx.quadraticCurveTo(w / 2, 4, w - 2, 16);
    ctx.lineTo(w - 2, 21);
    ctx.quadraticCurveTo(w / 2, 11, 2, 21);
    ctx.closePath();
  };
  paint(kasagi);

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, h, [
    [0, PALETTE.white, 0.2],
    [0.25, PALETTE.white, 0],
    [1, PALETTE.black, 0.25],
  ]);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  glow(ctx, red, 10, 1, () => {
    ctx.strokeStyle = hex(redHi, 0.35);
    ctx.lineWidth = 1;
    kasagi();
    ctx.stroke();
  });

  noise(ctx, 0.06, 13);
}

function drawRibbon(ctx: Ctx, w: number, h: number): void {
  const notch = 15;
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(1, 5);
    ctx.lineTo(w - notch - 1, 5);
    ctx.lineTo(w - 1, h / 2);
    ctx.lineTo(w - notch - 1, h - 5);
    ctx.lineTo(1, h - 5);
    ctx.lineTo(notch + 1, h / 2);
    ctx.closePath();
  };

  withShadow(ctx, PALETTE.black, 10, 0, 4, 0.6, () => {
    ctx.fillStyle = hex(darken(PALETTE.blood, 0.5), 1);
    shape();
    ctx.fill();
  });

  const silk: Stop[] = [
    [0, lighten(PALETTE.blood, 0.25)],
    [0.35, PALETTE.blood],
    [0.75, darken(PALETTE.blood, 0.35)],
    [1, darken(PALETTE.blood, 0.6)],
  ];
  ctx.fillStyle = linGrad(ctx, 0, 5, 0, h - 5, silk);
  shape();
  ctx.fill();

  clipped(ctx, shape, () => {
    const fold: Stop[] = [
      [0, PALETTE.black, 0.45],
      [0.12, PALETTE.black, 0],
      [0.88, PALETTE.black, 0],
      [1, PALETTE.black, 0.45],
    ];
    ctx.fillStyle = linGrad(ctx, 0, 0, w, 0, fold);
    ctx.fillRect(0, 0, w, h);
    washi(ctx, w, h, 303);
  });

  ctx.strokeStyle = hex(PALETTE.void, 0.85);
  ctx.lineWidth = 2.2;
  shape();
  ctx.stroke();

  const gilt: Stop[] = [
    [0, PALETTE.goldGlow],
    [0.5, PALETTE.gold],
    [1, PALETTE.goldDeep],
  ];
  ctx.strokeStyle = linGrad(ctx, 0, 0, 0, h, gilt);
  ctx.lineWidth = 1.3;
  shape();
  ctx.stroke();

  ctx.strokeStyle = hex(PALETTE.gold, 0.4);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(notch + 6, 9);
  ctx.lineTo(w - notch - 6, 9);
  ctx.moveTo(notch + 6, h - 9);
  ctx.lineTo(w - notch - 6, h - 9);
  ctx.stroke();

  noise(ctx, 0.05, 63);
}

/* ------------------------------------------------------------------ */
/* Full-screen / additive helpers                                      */
/* ------------------------------------------------------------------ */

/** Pure white halo — scenes tint it per rarity, so it must carry no hue. */
function drawRarityGlow(ctx: Ctx, w: number, h: number): void {
  const stops: Stop[] = [
    [0, PALETTE.white, 1],
    [0.16, PALETTE.white, 0.8],
    [0.36, PALETTE.white, 0.42],
    [0.6, PALETTE.white, 0.15],
    [0.82, PALETTE.white, 0.035],
    [1, PALETTE.white, 0],
  ];
  ctx.fillStyle = radGrad(ctx, w / 2, h / 2, w / 2, stops);
  ctx.fillRect(0, 0, w, h);
}

function drawVignette(ctx: Ctx, w: number, h: number): void {
  const stops: Stop[] = [
    [0, PALETTE.black, 0],
    [0.45, PALETTE.black, 0],
    [0.68, PALETTE.black, 0.16],
    [0.85, PALETTE.black, 0.42],
    [1, PALETTE.black, 0.78],
  ];
  ctx.fillStyle = radGrad(ctx, w / 2, h / 2, Math.hypot(w, h) / 2, stops);
  ctx.fillRect(0, 0, w, h);

  const top: Stop[] = [
    [0, PALETTE.void, 0.35],
    [1, PALETTE.void, 0],
  ];
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, h * 0.12, top);
  ctx.fillRect(0, 0, w, h * 0.12);

  const bottom: Stop[] = [
    [0, PALETTE.void, 0],
    [1, PALETTE.void, 0.4],
  ];
  ctx.fillStyle = linGrad(ctx, 0, h * 0.86, 0, h, bottom);
  ctx.fillRect(0, h * 0.86, w, h * 0.14);

  // Dark gradients band badly on cheap panels; a whisper of noise breaks it up.
  noise(ctx, 0.03, 5);
}

/** Seamless-edged fog band, drifted across the menus by UIKit. */
function drawMist(ctx: Ctx, w: number, h: number): void {
  const rand = rng(1234);
  for (let i = 0; i < 34; i++) {
    const x = rand() * w;
    const y = h * 0.25 + rand() * h * 0.5;
    const r = 30 + rand() * 95;
    ctx.fillStyle = radGrad(ctx, x, y, r, [
      [0, mix(PALETTE.white, PALETTE.spirit, 0.35), 0.09],
      [0.6, mix(PALETTE.white, PALETTE.spirit, 0.35), 0.03],
      [1, PALETTE.white, 0],
    ]);
    circle(ctx, x, y, r);
    ctx.fill();
  }

  // Fade every edge so the band can drift without a visible seam.
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = linGrad(ctx, 0, 0, w, 0, [
    [0, PALETTE.white, 0],
    [0.2, PALETTE.white, 1],
    [0.8, PALETTE.white, 1],
    [1, PALETTE.white, 0],
  ]);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, h, [
    [0, PALETTE.white, 0],
    [0.35, PALETTE.white, 1],
    [0.65, PALETTE.white, 1],
    [1, PALETTE.white, 0],
  ]);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Soft dot: fallback particle when the FX atlas isn't registered yet. */
function drawDust(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = radGrad(ctx, w / 2, h / 2, w / 2, [
    [0, PALETTE.white, 1],
    [0.4, PALETTE.white, 0.5],
    [1, PALETTE.white, 0],
  ]);
  ctx.fillRect(0, 0, w, h);
}

/* ------------------------------------------------------------------ */
/* Menu backdrop                                                       */
/* ------------------------------------------------------------------ */

function drawBackdrop(ctx: Ctx, w: number, h: number, accent: number): void {
  const sky: Stop[] = [
    [0, PALETTE.void],
    [0.32, PALETTE.bgDeep],
    [0.7, PALETTE.bg],
    [1, mix(PALETTE.bg, accent, 0.16)],
  ];
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, h, sky);
  ctx.fillRect(0, 0, w, h);

  const rand = rng(1337);
  for (let i = 0; i < 120; i++) {
    const x = rand() * w;
    const y = rand() * h * 0.78;
    const r = 0.4 + rand() * 1.2;
    ctx.fillStyle = hex(mix(PALETTE.white, accent, rand() * 0.5), 0.12 + rand() * 0.55);
    circle(ctx, x, y, r);
    ctx.fill();
  }
  for (let i = 0; i < 7; i++) {
    const x = rand() * w;
    const y = rand() * h * 0.5;
    glow(ctx, PALETTE.white, 5, 2, () => {
      ctx.fillStyle = hex(PALETTE.white, 0.9);
      circle(ctx, x, y, 1.2);
      ctx.fill();
    });
  }

  // Moon
  const mx = w * 0.74;
  const my = h * 0.16;
  const mr = 42;
  ctx.fillStyle = radGrad(ctx, mx, my, mr * 3.6, [
    [0, 0xfff3d6, 0.2],
    [0.3, 0xfff3d6, 0.07],
    [1, 0xfff3d6, 0],
  ]);
  circle(ctx, mx, my, mr * 3.6);
  ctx.fill();

  const disc = (): void => circle(ctx, mx, my, mr);
  ctx.fillStyle = radGrad(
    ctx,
    mx,
    my,
    mr,
    [
      [0, 0xfffaf0],
      [0.65, 0xf0e2c2],
      [1, 0xcdb68c],
    ],
    mx - mr * 0.3,
    my - mr * 0.35
  );
  disc();
  ctx.fill();
  clipped(ctx, disc, () => {
    for (let i = 0; i < 9; i++) {
      const cx2 = mx + (rand() - 0.5) * mr * 1.7;
      const cy2 = my + (rand() - 0.5) * mr * 1.7;
      const cr = 2.5 + rand() * 8;
      ctx.fillStyle = hex(0xc4ad83, 0.25 + rand() * 0.2);
      circle(ctx, cx2, cy2, cr);
      ctx.fill();
      ctx.fillStyle = hex(0xfff8e8, 0.12);
      circle(ctx, cx2 - cr * 0.15, cy2 - cr * 0.18, cr * 0.75);
      ctx.fill();
    }
    ctx.fillStyle = radGrad(ctx, mx - mr * 0.35, my - mr * 0.4, mr * 1.7, [
      [0, PALETTE.black, 0],
      [0.65, PALETTE.black, 0.08],
      [1, PALETTE.black, 0.45],
    ]);
    ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  });

  // Distant ridges — the only thing separating "dark screen" from "somewhere".
  const ridge = (baseY: number, amp: number, color: number, alpha: number, seed: number): void => {
    const r2 = rng(seed);
    ctx.beginPath();
    ctx.moveTo(-12, h + 12);
    ctx.lineTo(-12, baseY);
    let x = -12;
    while (x < w + 12) {
      const nx = x + 35 + r2() * 65;
      ctx.lineTo((x + nx) / 2, baseY - r2() * amp);
      ctx.lineTo(nx, baseY - r2() * amp * 0.3);
      x = nx;
    }
    ctx.lineTo(w + 12, h + 12);
    ctx.closePath();
    ctx.fillStyle = hex(color, alpha);
    ctx.fill();
  };
  ridge(h * 0.78, 95, mix(PALETTE.bgDeep, accent, 0.12), 0.9, 21);
  ridge(h * 0.88, 62, darken(PALETTE.bgDeep, 0.5), 0.95, 42);
  ridge(h * 0.96, 34, PALETTE.void, 1, 84);

  // Fog pooling between the ridges.
  ctx.fillStyle = linGrad(ctx, 0, h * 0.72, 0, h * 0.92, [
    [0, PALETTE.white, 0],
    [0.5, PALETTE.white, 0.05],
    [1, PALETTE.white, 0],
  ]);
  ctx.fillRect(0, h * 0.72, w, h * 0.2);

  ctx.fillStyle = radGrad(ctx, w / 2, h * 1.02, w * 0.95, [
    [0, accent, 0.2],
    [0.5, accent, 0.06],
    [1, accent, 0],
  ]);
  ctx.fillRect(0, h * 0.45, w, h * 0.55);

  noise(ctx, 0.05, 9);
}

export function backdropKey(accent: number): string {
  return `ui_backdrop_${accent.toString(16)}`;
}

/** Paint (once per accent colour) the animated-menu background plate. */
export function registerBackdrop(scene: Scene, accent: number): string {
  const key = backdropKey(accent);
  if (scene.textures.exists(key)) return key;
  defineFlat(scene, key, GAME_WIDTH, GAME_HEIGHT, (ctx, w, h) => drawBackdrop(ctx, w, h, accent));
  return key;
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

let registered = false;

/** Idempotent: textures live on the game-wide TextureManager, not per scene. */
export function registerUI(scene: Scene): void {
  if (registered && scene.textures.exists(UI.panel)) return;

  defineTexture(scene, UI.panel, 320, 200, (ctx, w, h) => drawPanel(ctx, w, h, false));
  defineTexture(scene, UI.panelInset, 320, 200, (ctx, w, h) => drawPanel(ctx, w, h, true));

  defineTexture(scene, UI.btn, 220, 56, (ctx, w, h) => drawButton(ctx, w, h, "idle"));
  defineTexture(scene, UI.btnHover, 220, 56, (ctx, w, h) => drawButton(ctx, w, h, "hover"));
  defineTexture(scene, UI.btnDisabled, 220, 56, (ctx, w, h) => drawButton(ctx, w, h, "disabled"));

  defineTexture(scene, UI_EXTRA.pill, 240, 48, drawPill);
  defineTexture(scene, UI_EXTRA.keycap, 48, 40, drawKeycap);

  defineTexture(scene, UI.coinIcon, 28, 28, drawCoin);
  defineTexture(scene, UI.heart, 26, 24, drawHeart);
  defineTexture(scene, UI.lock, 24, 28, drawLock);
  defineTexture(scene, UI.check, 24, 24, drawCheck);
  defineTexture(scene, UI.star, 26, 26, drawStar);
  defineTexture(scene, UI.chevron, 18, 18, drawChevron);

  defineTexture(scene, UI.scroll, 300, 120, drawScroll);
  defineTexture(scene, UI.torii, 120, 100, drawTorii);
  defineTexture(scene, UI.ribbon, 200, 40, drawRibbon);
  defineTexture(scene, UI.scoreFrame, 200, 60, drawScoreFrame);

  defineTexture(scene, UI.shopIcon, 34, 34, drawShopIcon);
  defineTexture(scene, UI.gearIcon, 34, 34, drawGearIcon);
  defineTexture(scene, UI.crownIcon, 34, 34, drawCrownIcon);
  defineTexture(scene, UI.bookIcon, 34, 34, drawBookIcon);

  defineTexture(scene, UI.lantern, 140, 220, drawLantern);

  defineFlat(scene, UI.rarityGlow, 140, 140, drawRarityGlow);
  defineFlat(scene, UI.vignette, GAME_WIDTH, GAME_HEIGHT, drawVignette);
  defineFlat(scene, UI_EXTRA.mist, 512, 256, drawMist);
  defineFlat(scene, UI_EXTRA.dust, 12, 12, drawDust);

  registered = true;
}
