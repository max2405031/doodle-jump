/**
 * Parallax backdrops for the six altitude biomes.
 *
 * Every layer is a 500x800 canvas shown in a vertically scrolling TileSprite, so
 * everything painted here must TILE ON Y: the top edge has to join the bottom
 * edge. Two rules make that work and they are load-bearing:
 *
 *  1. Anything that can reach a horizontal edge is drawn through `tileY`, which
 *     repaints it on the far side of the seam.
 *  2. A wrapped draw MUST re-seed its RNG inside the callback. Consuming a
 *     shared `rand()` across both copies would desynchronise them and split the
 *     element in half at the seam.
 *
 * Layer 0 (sky) is opaque and uses a gradient whose first and last colour stops
 * are identical, so the band repeats without a hard line. Layers 1 and 2 stay
 * transparent. Atmospheric perspective: layer 0 is pale, desaturated and low
 * contrast; layer 2 is near-black and reads as a cut-out silhouette.
 */

import type { Scene } from "phaser";
import {
  blob,
  circle,
  clipped,
  darken,
  ellipse,
  glow,
  grain,
  hex,
  lighten,
  linGrad,
  mix,
  radGrad,
  rng,
  roundRect,
  type Ctx,
  type Stop,
} from "./paint";
import { defineFlat, type DrawFn } from "./registry";
import { BG_LAYERS, BIOMES, bgKey, menuBgKey, type Biome } from "./keys";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { PALETTE } from "../config/theme";

/* ============================================================ seam handling */

/**
 * Draw `fn` at `y`, plus a copy across the seam when the element (which extends
 * `reach` pixels around `y`) would be clipped by an edge.
 */
function tileY(h: number, y: number, reach: number, fn: (y: number) => void): void {
  fn(y);
  if (y - reach < 0) fn(y + h);
  if (y + reach > h) fn(y - h);
}

/* ================================================================= skies/air */

/** Opaque sky. `stops` must open and close on the same colour or the seam shows. */
function skyBand(ctx: Ctx, w: number, h: number, stops: Stop[]): void {
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, h, stops);
  ctx.fillRect(0, 0, w, h);
}

/** Soft volumetric puff — the building block of every fog bank and haze veil. */
function fogBlob(
  ctx: Ctx,
  h: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: number,
  alpha: number
): void {
  tileY(h, y, ry * 1.25, (yy) => {
    ctx.save();
    ctx.translate(x, yy);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = radGrad(ctx, 0, 0, rx, [
      [0, color, alpha],
      [0.45, color, alpha * 0.45],
      [1, color, 0],
    ]);
    circle(ctx, 0, 0, rx);
    ctx.fill();
    ctx.restore();
  });
}

/** A drifting bank of fog blobs. */
function mist(
  ctx: Ctx,
  w: number,
  h: number,
  seed: number,
  color: number,
  alpha: number,
  count: number,
  scale = 1
): void {
  const rand = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const rx = (70 + rand() * 150) * scale;
    fogBlob(ctx, h, x, y, rx, rx * (0.25 + rand() * 0.25), color, alpha * (0.5 + rand() * 0.6));
  }
}

function starField(
  ctx: Ctx,
  w: number,
  h: number,
  count: number,
  seed: number,
  color: number,
  maxR = 1.5
): void {
  const rand = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.35 + rand() * maxR;
    const a = 0.2 + rand() * 0.8;
    const t = rand();
    const c = t < 0.14 ? mix(color, 0xffd7a0, 0.65) : t < 0.3 ? mix(color, 0x9ec8ff, 0.55) : color;
    const halo = r * 5;
    tileY(h, y, halo * 1.2, (yy) => {
      ctx.fillStyle = radGrad(ctx, x, yy, halo, [
        [0, c, a * 0.55],
        [0.28, c, a * 0.2],
        [1, c, 0],
      ]);
      circle(ctx, x, yy, halo);
      ctx.fill();
      ctx.fillStyle = hex(mix(c, 0xffffff, 0.6), Math.min(1, a + 0.2));
      circle(ctx, x, yy, r);
      ctx.fill();
    });
  }
}

/** God-ray / moonbeam: a soft tapered shaft that fades out at both tips. */
function beam(
  ctx: Ctx,
  h: number,
  x: number,
  y: number,
  len: number,
  width: number,
  angle: number,
  color: number,
  alpha: number
): void {
  tileY(h, y, len, (yy) => {
    ctx.save();
    ctx.translate(x, yy);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = linGrad(ctx, 0, -len / 2, 0, len / 2, [
      [0, color, 0],
      [0.32, color, alpha],
      [0.62, color, alpha * 0.55],
      [1, color, 0],
    ]);
    ctx.beginPath();
    ctx.moveTo(-width * 0.26, -len / 2);
    ctx.lineTo(width * 0.26, -len / 2);
    ctx.lineTo(width * 0.6, len / 2);
    ctx.lineTo(-width * 0.6, len / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

/** Veiled moon: wide halo, cratered disc, then thin cloud bands laid over it. */
function moonDisc(ctx: Ctx, h: number, cx: number, cy: number, r: number, disc: number, halo: number): void {
  tileY(h, cy, r * 4.2, (yy) => {
    const rand = rng(404);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = radGrad(ctx, cx, yy, r * 4, [
      [0, halo, 0.4],
      [0.16, halo, 0.16],
      [0.45, halo, 0.05],
      [1, halo, 0],
    ]);
    circle(ctx, cx, yy, r * 4);
    ctx.fill();
    ctx.restore();

    glow(ctx, halo, r * 0.8, 2, () => {
      ctx.fillStyle = radGrad(ctx, cx - r * 0.25, yy - r * 0.3, r * 1.35, [
        [0, lighten(disc, 0.35), 1],
        [0.55, disc, 1],
        [1, darken(disc, 0.28), 1],
      ]);
      circle(ctx, cx, yy, r);
      ctx.fill();
    });

    clipped(
      ctx,
      () => circle(ctx, cx, yy, r),
      () => {
        for (let i = 0; i < 7; i++) {
          const a = rand() * Math.PI * 2;
          const d = rand() * r * 0.75;
          const cr = r * (0.07 + rand() * 0.16);
          ctx.fillStyle = hex(darken(disc, 0.16), 0.5);
          circle(ctx, cx + Math.cos(a) * d, yy + Math.sin(a) * d, cr);
          ctx.fill();
        }
      }
    );

    // The veil: cloud bands crossing the disc, wider than it so they read as sky.
    for (let i = 0; i < 3; i++) {
      const by = yy - r * 0.5 + i * r * 0.62;
      const bh = r * (0.12 + rand() * 0.14);
      ctx.fillStyle = linGrad(ctx, cx - r * 3, by, cx + r * 3, by, [
        [0, 0x1a1533, 0],
        [0.25, 0x1a1533, 0.55],
        [0.6, 0x241d44, 0.5],
        [1, 0x1a1533, 0],
      ]);
      ellipse(ctx, cx + (rand() - 0.5) * r, by, r * 2.4, bh);
      ctx.fill();
    }
  });
}

/* ============================================================== architecture */

/** Curved kawara roof with flicked-up eaves. Path only. */
function roofPath(ctx: Ctx, cx: number, y: number, w: number, hh: number): void {
  const half = w / 2;
  const tip = hh * 0.24;
  ctx.beginPath();
  ctx.moveTo(cx - half, y - tip);
  ctx.quadraticCurveTo(cx - half * 0.42, y - hh * 0.22, cx, y - hh);
  ctx.quadraticCurveTo(cx + half * 0.42, y - hh * 0.22, cx + half, y - tip);
  ctx.lineTo(cx + half * 0.93, y + hh * 0.12);
  ctx.quadraticCurveTo(cx, y - hh * 0.14, cx - half * 0.93, y + hh * 0.12);
  ctx.closePath();
}

/** Tiered pagoda, filled as a flat silhouette (tiers overlap, so alpha must be 1). */
function pagoda(ctx: Ctx, cx: number, baseY: number, w: number, tiers: number, color: number): void {
  ctx.fillStyle = hex(color, 1);
  const tierH = w * 0.44;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const tw = w * (1 - t * 0.44);
    const y = baseY - i * tierH;
    ctx.fillRect(cx - tw * 0.28, y - tierH * 0.78, tw * 0.56, tierH * 0.8);
    roofPath(ctx, cx, y - tierH * 0.66, tw, tierH * 0.52);
    ctx.fill();
  }
  const topY = baseY - tiers * tierH + tierH * 0.34;
  ctx.fillRect(cx - w * 0.02, topY - w * 0.24, w * 0.04, w * 0.26);
  circle(ctx, cx, topY - w * 0.27, w * 0.05);
  ctx.fill();
  circle(ctx, cx, topY - w * 0.14, w * 0.035);
  ctx.fill();
}

/** Torii gate — pillars, nuki, gakuzuka, upswept kasagi. Path only. */
function toriiShape(ctx: Ctx, x: number, y: number, w: number, hh: number): void {
  const pw = w * 0.075;
  const lean = w * 0.028;
  const top = y - hh;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2 + lean, top + hh * 0.14);
  ctx.lineTo(x - w / 2 + lean + pw, top + hh * 0.14);
  ctx.lineTo(x - w / 2 + pw, y);
  ctx.closePath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2 - lean, top + hh * 0.14);
  ctx.lineTo(x + w / 2 - lean - pw, top + hh * 0.14);
  ctx.lineTo(x + w / 2 - pw, y);
  ctx.closePath();
  ctx.rect(x - w * 0.46, top + hh * 0.21, w * 0.92, hh * 0.05);
  ctx.rect(x - w * 0.028, top + hh * 0.09, w * 0.056, hh * 0.13);
  ctx.rect(x - w * 0.5, top + hh * 0.115, w, hh * 0.045);
  ctx.moveTo(x - w * 0.58, top + hh * 0.075);
  ctx.quadraticCurveTo(x, top - hh * 0.025, x + w * 0.58, top + hh * 0.075);
  ctx.lineTo(x + w * 0.58, top + hh * 0.115);
  ctx.quadraticCurveTo(x, top + hh * 0.02, x - w * 0.58, top + hh * 0.115);
  ctx.closePath();
}

/** Sagging cable — power line, lantern string, shimenawa core. */
function wire(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sag: number,
  color: number,
  width: number,
  alpha: number
): void {
  ctx.strokeStyle = hex(color, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1);
  ctx.stroke();
}

/** Sacred rope with hanging shide, marking the haunted ground of the forest. */
function shimenawa(
  ctx: Ctx,
  x0: number,
  x1: number,
  y: number,
  sag: number,
  rope: number,
  paper: number
): void {
  const at = (t: number): number => {
    const mt = 1 - t;
    return mt * mt * y + 2 * mt * t * (y + sag) + t * t * y;
  };
  wire(ctx, x0, y, x1, y, sag, darken(rope, 0.5), 13, 0.95);
  wire(ctx, x0, y, x1, y, sag, rope, 9, 0.9);
  wire(ctx, x0, y, x1, y, sag - 3, lighten(rope, 0.22), 2.4, 0.35);

  const rand = rng(77);
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const x = x0 + (x1 - x0) * t;
    const yy = at(t) + 4;
    const len = 26 + rand() * 16;
    ctx.fillStyle = hex(paper, 0.9);
    ctx.beginPath();
    ctx.moveTo(x - 5, yy);
    ctx.lineTo(x + 5, yy);
    ctx.lineTo(x + 5, yy + len * 0.34);
    ctx.lineTo(x - 2, yy + len * 0.4);
    ctx.lineTo(x - 2, yy + len * 0.72);
    ctx.lineTo(x + 6, yy + len * 0.78);
    ctx.lineTo(x + 6, yy + len);
    ctx.lineTo(x - 5, yy + len * 0.92);
    ctx.closePath();
    ctx.fill();
  }
}

/** Hanging paper lantern — an emissive body with a real halo. */
function lantern(ctx: Ctx, h: number, x: number, y: number, s: number, body: number, light: number): void {
  tileY(h, y, s * 3.2, (yy) => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = radGrad(ctx, x, yy, s * 2.8, [
      [0, light, 0.32],
      [0.3, light, 0.12],
      [1, light, 0],
    ]);
    circle(ctx, x, yy, s * 2.8);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = hex(0x0d0913, 0.95);
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(x, yy - s * 1.05);
    ctx.lineTo(x, yy - s * 0.64);
    ctx.stroke();

    ctx.fillStyle = hex(0x14101c, 1);
    roundRect(ctx, x - s * 0.3, yy - s * 0.7, s * 0.6, s * 0.13, s * 0.04);
    ctx.fill();

    const bodyShape = (): void => ellipse(ctx, x, yy, s * 0.52, s * 0.63);
    ctx.fillStyle = radGrad(ctx, x - s * 0.16, yy - s * 0.14, s * 0.95, [
      [0, lighten(light, 0.55), 1],
      [0.4, body, 1],
      [1, darken(body, 0.5), 1],
    ]);
    bodyShape();
    ctx.fill();
    glow(ctx, light, s * 1.1, 2, () => {
      bodyShape();
      ctx.fill();
    });

    clipped(ctx, bodyShape, () => {
      ctx.strokeStyle = hex(darken(body, 0.6), 0.45);
      ctx.lineWidth = s * 0.04;
      for (let i = -2; i <= 2; i++) {
        const ry = yy + i * s * 0.21;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.6, ry);
        ctx.quadraticCurveTo(x, ry + s * 0.04, x + s * 0.6, ry);
        ctx.stroke();
      }
      ctx.fillStyle = hex(darken(body, 0.75), 0.55);
      ctx.fillRect(x - s * 0.14, yy - s * 0.26, s * 0.28, s * 0.5);
    });

    ctx.fillStyle = hex(0x14101c, 1);
    roundRect(ctx, x - s * 0.24, yy + s * 0.57, s * 0.48, s * 0.11, s * 0.04);
    ctx.fill();
    ctx.fillStyle = hex(0x0d0913, 0.9);
    ctx.fillRect(x - s * 0.03, yy + s * 0.66, s * 0.06, s * 0.2);
  });
}

/** Blurred neon sign — the tourist economy eating the old town. */
function neonSign(ctx: Ctx, h: number, x: number, y: number, w: number, hh: number, color: number, a: number): void {
  tileY(h, y, hh * 4, (yy) => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = radGrad(ctx, x + w / 2, yy + hh / 2, Math.max(w, hh) * 2.2, [
      [0, color, a * 0.55],
      [0.35, color, a * 0.2],
      [1, color, 0],
    ]);
    circle(ctx, x + w / 2, yy + hh / 2, Math.max(w, hh) * 2.2);
    ctx.fill();
    glow(ctx, color, 9, 2, () => {
      ctx.fillStyle = hex(lighten(color, 0.55), Math.min(1, a * 1.6));
      roundRect(ctx, x, yy, w, hh, Math.min(w, hh) * 0.35);
      ctx.fill();
    });
    ctx.restore();
  });
}

/** Tiny tourist silhouette: selfie stick, camera, or sun hat + backpack. */
function tourist(ctx: Ctx, x: number, y: number, s: number, color: number, variant: number): void {
  ctx.fillStyle = hex(color, 1);
  ctx.strokeStyle = hex(color, 1);
  const hy = y - s * 0.84;
  ctx.lineWidth = s * 0.11;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.44);
  ctx.lineTo(x - s * 0.13, y);
  ctx.moveTo(x, y - s * 0.44);
  ctx.lineTo(x + s * 0.14, y);
  ctx.stroke();
  roundRect(ctx, x - s * 0.16, y - s * 0.72, s * 0.32, s * 0.34, s * 0.09);
  ctx.fill();
  circle(ctx, x, hy, s * 0.16);
  ctx.fill();

  if (variant === 0) {
    ctx.lineWidth = s * 0.055;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.1, y - s * 0.6);
    ctx.lineTo(x + s * 0.5, y - s * 1.12);
    ctx.stroke();
    ctx.fillRect(x + s * 0.42, y - s * 1.3, s * 0.18, s * 0.12);
  } else if (variant === 1) {
    ctx.fillRect(x - s * 0.22, y - s * 0.96, s * 0.44, s * 0.21);
    circle(ctx, x, y - s * 0.855, s * 0.1);
    ctx.fill();
    ctx.fillRect(x + s * 0.16, y - s * 1.02, s * 0.1, s * 0.08);
  } else {
    ellipse(ctx, x, hy - s * 0.1, s * 0.34, s * 0.07);
    ctx.fill();
    roundRect(ctx, x - s * 0.29, y - s * 0.68, s * 0.15, s * 0.28, s * 0.05);
    ctx.fill();
  }
}

/* ============================================================ extra scenery */

/** Bamboo culm — segmented, fibrous, catching a cold highlight on one side. */
function bamboo(ctx: Ctx, h: number, x: number, w: number, color: number, alpha: number): void {
  const rand = rng((x * 31) | 0);
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = linGrad(ctx, x - w / 2, 0, x + w / 2, 0, [
    [0, darken(color, 0.45)],
    [0.35, color],
    [0.6, lighten(color, 0.25)],
    [1, darken(color, 0.3)],
  ]);
  ctx.fillRect(x - w / 2, 0, w, h);

  // Nodes. Spaced irregularly so the stalks don't line up into a grid.
  let y = rand() * 60;
  while (y < h) {
    ctx.fillStyle = hex(darken(color, 0.55), 0.9);
    ctx.fillRect(x - w / 2 - 1, y, w + 2, 2.5);
    ctx.fillStyle = hex(lighten(color, 0.3), 0.5);
    ctx.fillRect(x - w / 2 - 1, y + 2.5, w + 2, 1);
    y += 55 + rand() * 55;
  }
  ctx.restore();
}

/** Ridge line built from a seeded random walk — mountains, cloud tops, rubble. */
/**
 * Wide, rolling silhouette instead of a jagged saw-tooth: few large humps
 * (long `step`) traced with smoothed curves through each point rather than
 * straight segments, and 2 faint offset copies underneath to fake the soft,
 * out-of-focus edge distant mountains actually have.
 */
function ridge(
  ctx: Ctx,
  w: number,
  h: number,
  baseY: number,
  amp: number,
  step: number,
  seed: number,
  fill: CanvasGradient | string,
  softAlpha = 0.35
): void {
  const rand = rng(seed);
  const pts: Array<[number, number]> = [];
  for (let x = -step; x <= w + step; x += step) {
    pts.push([x, baseY - (rand() - 0.3) * amp]);
  }

  const trace = (dx: number, dy: number): void => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + dx, h);
    ctx.lineTo(pts[0][0] + dx, pts[0][1] + dy);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      ctx.quadraticCurveTo(x0 + dx, y0 + dy, mx + dx, my + dy);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0] + dx, h);
    ctx.closePath();
  };

  ctx.save();
  ctx.globalAlpha = softAlpha;
  ctx.fillStyle = fill;
  trace(-3, 3);
  ctx.fill();
  trace(3, 5);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = fill;
  trace(0, 0);
  ctx.fill();
}

/** Billowing cloud mass — stacked puffs, lit from below. */
function cloudBank(
  ctx: Ctx,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  top: number,
  bottom: number,
  alpha: number
): void {
  const rand = rng(seed);
  tileY(h, cy, ry * 2.2, (yy) => {
    for (let i = 0; i < 9; i++) {
      const px = cx + (rand() - 0.5) * rx * 1.7;
      const py = yy + (rand() - 0.5) * ry * 0.9;
      const pr = rx * (0.28 + rand() * 0.36);
      ctx.fillStyle = radGrad(ctx, px, py - pr * 0.35, pr, [
        [0, top, alpha],
        [0.6, mix(top, bottom, 0.6), alpha * 0.85],
        [1, bottom, 0],
      ]);
      circle(ctx, px, py, pr);
      ctx.fill();
    }
  });
}

/** Branching lightning bolt, frozen mid-strike. */
function bolt(ctx: Ctx, h: number, x: number, y: number, len: number, seed: number, color: number): void {
  const rand = rng(seed);
  const path = (sx: number, sy: number, l: number, spread: number, width: number): void => {
    let px = sx;
    let py = sy;
    ctx.beginPath();
    ctx.moveTo(px, py);
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      px += (rand() - 0.5) * spread;
      py += l / segs;
      ctx.lineTo(px, py);
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = hex(color, 0.95);
    ctx.stroke();
  };

  tileY(h, y, len * 1.2, (yy) => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, color, 16, 3, () => path(x, yy, len, 34, 2.4));
    ctx.strokeStyle = hex(0xffffff, 1);
    path(x, yy, len, 30, 1.2);
    path(x + 6, yy + len * 0.35, len * 0.4, 22, 0.8);
    ctx.restore();
  });
}

/** Spiral galaxy seen face-on. */
function galaxy(ctx: Ctx, h: number, cx: number, cy: number, r: number, seed: number): void {
  const rand = rng(seed);
  tileY(h, cy, r * 1.4, (yy) => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    ctx.fillStyle = radGrad(ctx, cx, yy, r, [
      [0, 0xfff2c4, 0.5],
      [0.25, PALETTE.cursed, 0.28],
      [0.7, PALETTE.spiritDeep, 0.12],
      [1, 0x000000, 0],
    ]);
    circle(ctx, cx, yy, r);
    ctx.fill();

    // Two logarithmic arms of scattered stars.
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < 90; i++) {
        const t = i / 90;
        const a = t * Math.PI * 2.4 + arm * Math.PI + rand() * 0.25;
        const rr = t * r * 0.92;
        const px = cx + Math.cos(a) * rr;
        const py = yy + Math.sin(a) * rr * 0.42;
        const s = 0.4 + rand() * 1.1;
        ctx.fillStyle = hex(mix(0xffffff, PALETTE.cursedGlow, rand()), 0.35 + rand() * 0.5);
        circle(ctx, px, py, s);
        ctx.fill();
      }
    }
    ctx.restore();
  });
}

/* ============================================================ biome styling */

export interface BiomeStyle {
  skyTop: number;
  skyBottom: number;
  fog: number;
  tint: number;
  particle: "sakura" | "leaf" | "snow" | "rain" | "star" | "ember";
}

const STYLES: Record<Biome, BiomeStyle> = {
  village: {
    skyTop: 0x120f26,
    skyBottom: 0x2a1f3d,
    fog: 0x3a2a4e,
    tint: 0xffffff,
    particle: "sakura",
  },
  forest: {
    skyTop: 0x08160f,
    skyBottom: 0x14301f,
    fog: 0x2f6b45,
    tint: 0xdff5e6,
    particle: "leaf",
  },
  mountain: {
    skyTop: 0x0d1b33,
    skyBottom: 0x3b5878,
    fog: 0x9dc0dd,
    tint: 0xe8f4ff,
    particle: "snow",
  },
  clouds: {
    skyTop: 0x2b1e4a,
    skyBottom: 0xffa25c,
    fog: 0xffd9a0,
    tint: 0xfff0dc,
    particle: "ember",
  },
  storm: {
    skyTop: 0x0a0714,
    skyBottom: 0x241a3d,
    fog: 0x4a3a6b,
    tint: 0xc9c0e8,
    particle: "rain",
  },
  cosmos: {
    skyTop: 0x03020a,
    skyBottom: 0x150b2e,
    fog: 0x3d1f66,
    tint: 0xd8c8ff,
    particle: "star",
  },
};

export function biomeStyle(biome: Biome): BiomeStyle {
  return STYLES[biome];
}

/** Altitude at which each biome ends. The last one runs forever. */
const BIOME_END: Record<Biome, number> = {
  village: 1500,
  forest: 4000,
  mountain: 8000,
  clouds: 14000,
  storm: 22000,
  cosmos: Number.POSITIVE_INFINITY,
};

/** How many score points the crossfade into the next biome spans. */
const FADE = 800;

export function biomeAt(score: number): Biome {
  for (const b of BIOMES) {
    if (score < BIOME_END[b]) return b;
  }
  return "cosmos";
}

/**
 * The current biome plus the one being faded into. `t` climbs 0 -> 1 across the
 * last FADE points so the background system can crossfade instead of popping.
 */
export function biomeProgress(score: number): { current: Biome; next: Biome; t: number } {
  const current = biomeAt(score);
  const idx = BIOMES.indexOf(current);
  const next = BIOMES[Math.min(idx + 1, BIOMES.length - 1)];
  const end = BIOME_END[current];

  if (!Number.isFinite(end) || next === current) return { current, next, t: 0 };

  const t = Math.max(0, Math.min(1, (score - (end - FADE)) / FADE));
  return { current, next, t };
}

/* ============================================================ biome painters */

const W = GAME_WIDTH;
const H = GAME_HEIGHT;

/* ---- village: a shrine town at night, already half-eaten by neon ---- */

const villageFar: DrawFn = (ctx, w, h) => {
  skyBand(ctx, w, h, [
    [0, 0x120f26],
    [0.45, 0x1d1636],
    [0.8, 0x2a1f3d],
    [1, 0x120f26],
  ]);
  starField(ctx, w, h, 90, 11, 0xffffff, 1.2);
  moonDisc(ctx, h, w * 0.78, h * 0.2, 42, 0xfff6dc, 0xffd9a0);
  mist(ctx, w, h, 21, 0x4a3a6b, 0.16, 7, 1.3);
};

const villageMid: DrawFn = (ctx, w, h) => {
  const rand = rng(77);
  const silhouette = darken(0x2a1f3d, 0.55);

  // Rooftops marching across, repeated up the strip.
  for (let band = 0; band < 3; band++) {
    const baseY = (h / 3) * band + 120;
    tileY(h, baseY, 90, (yy) => {
      let x = -20;
      while (x < w + 20) {
        const rw = 60 + rand() * 60;
        ctx.fillStyle = hex(silhouette, 0.9);
        roofPath(ctx, x + rw / 2, yy, rw, 22);
        ctx.fill();
        ctx.fillRect(x + rw * 0.12, yy, rw * 0.76, 40);
        x += rw + 8 + rand() * 26;
      }
    });
  }

  tileY(h, h * 0.55, 120, (yy) => pagoda(ctx, w * 0.2, yy, 74, 4, silhouette));

  // Power lines — the modern intrusion.
  tileY(h, h * 0.3, 40, (yy) => {
    wire(ctx, 0, yy, w, yy + 14, 26, 0x0a0812, 1.6, 0.75);
    wire(ctx, 0, yy + 30, w, yy + 40, 20, 0x0a0812, 1.2, 0.6);
  });

  neonSign(ctx, h, w * 0.62, h * 0.42, 30, 12, PALETTE.sakura, 0.55);
  neonSign(ctx, h, w * 0.12, h * 0.72, 22, 10, PALETTE.spirit, 0.5);
  neonSign(ctx, h, w * 0.85, h * 0.86, 26, 11, PALETTE.cursedGlow, 0.45);
};

const villageNear: DrawFn = (ctx, w, h) => {
  const rand = rng(303);
  for (let i = 0; i < 5; i++) {
    const x = 20 + rand() * (w - 40);
    const y = rand() * h;
    lantern(ctx, h, x, y, 0.8 + rand() * 0.5, PALETTE.blood, PALETTE.goldGlow);
  }

  // Sakura branch intruding from the left edge.
  tileY(h, h * 0.25, 90, (yy) => {
    ctx.strokeStyle = hex(0x1b1020, 0.95);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-10, yy - 40);
    ctx.quadraticCurveTo(w * 0.22, yy - 10, w * 0.42, yy + 26);
    ctx.stroke();

    const r2 = rng(9);
    for (let i = 0; i < 26; i++) {
      const t = r2();
      const bx = -10 + (w * 0.42 + 10) * t + (r2() - 0.5) * 22;
      const by = yy - 40 + (66 * t) + (r2() - 0.5) * 26;
      ctx.fillStyle = hex(mix(PALETTE.sakura, 0xffffff, r2() * 0.5), 0.5 + r2() * 0.4);
      circle(ctx, bx, by, 2 + r2() * 3);
      ctx.fill();
    }
  });

  // Tiny tourist silhouettes on a rooftop, phones raised.
  tileY(h, h * 0.78, 30, (yy) => {
    tourist(ctx, w * 0.3, yy, 1, 0x090610, 0);
    tourist(ctx, w * 0.38, yy + 3, 0.9, 0x090610, 1);
    tourist(ctx, w * 0.47, yy - 2, 1.05, 0x090610, 2);
  });
};

/*
 * ---- menu: the title screen's own quiet backdrop ----
 * Ink-black sky, mist that coils rather than sits flat, and bamboo in
 * silhouette around the lantern — no rooftops, neon or tourists. Reuses
 * villageFar's sky/stars/moon (already clean) and forestMid's bamboo().
 */

const menuFar: DrawFn = villageFar;

const menuMid: DrawFn = (ctx, w, h) => {
  mist(ctx, w, h, 15, 0x1c1830, 0.22, 7, 1.7);

  // A slow spiral stroke on top of each blob's fill — the classic sumi-e
  // ink-swirl motif, not just a photographic blur.
  const rand = rng(505);
  for (let i = 0; i < 5; i++) {
    const cx = rand() * w;
    const cy = rand() * h;
    const r0 = 10 + rand() * 14;
    tileY(h, cy, r0 * 1.6, (yy) => {
      ctx.strokeStyle = hex(0xcfc9e6, 0.1 + rand() * 0.06);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      let a = rand() * Math.PI * 2;
      let r = 2;
      ctx.moveTo(cx + Math.cos(a) * r, yy + Math.sin(a) * r);
      for (let s = 0; s < 26; s++) {
        a += 0.55;
        r += r0 / 26;
        ctx.lineTo(cx + Math.cos(a) * r, yy + Math.sin(a) * r);
      }
      ctx.stroke();
    });
  }

  // A handful of thin stalks framing the sides — never a curtain across the
  // whole width, and clear of the centre third where the hero/lantern sit.
  for (let i = 0; i < 4; i++) {
    const x = i < 2 ? rand() * w * 0.16 : w * 0.84 + rand() * w * 0.16;
    const bw = 3 + rand() * 4;
    bamboo(ctx, h, x, bw, mix(0x14100f, 0x2b2417, rand() * 0.4), 0.16 + rand() * 0.1);
  }
};

const menuNear: DrawFn = (ctx, w, h) => {
  const rand = rng(606);
  // A few stalks each side, framing the scene rather than curtaining it —
  // the centre third stays clear for the hero, lantern and PLAY button.
  for (let i = 0; i < 5; i++) {
    const left = i < 3;
    const x = left ? rand() * w * 0.14 : w - rand() * w * 0.14;
    const bw = 5 + rand() * 9;
    bamboo(ctx, h, x, bw, mix(0x1b3419, 0x3c7038, rand() * 0.3), 0.28 + rand() * 0.16);
  }

  // A few scattered embers of light, well clear of the hero/lantern zone.
  const er = rng(707);
  for (let i = 0; i < 10; i++) {
    const x = er() * w;
    const y = er() * h * 0.4 + h * 0.55;
    tileY(h, y, 6, (yy) => {
      ctx.fillStyle = radGrad(ctx, x, yy, 5, [
        [0, PALETTE.sakuraGlow, 0.5],
        [1, PALETTE.sakura, 0],
      ]);
      circle(ctx, x, yy, 5);
      ctx.fill();
    });
  }
};

/* ---- forest: the Fushimi Inari path, gone wrong ---- */

const forestFar: DrawFn = (ctx, w, h) => {
  skyBand(ctx, w, h, [
    [0, 0x08160f],
    [0.5, 0x0f2618],
    [0.85, 0x14301f],
    [1, 0x08160f],
  ]);
  mist(ctx, w, h, 5, 0x2f6b45, 0.2, 9, 1.5);
  for (let i = 0; i < 4; i++) {
    beam(ctx, h, w * (0.15 + i * 0.25), h * (0.15 + i * 0.22), 340, 90, 0.16, 0xbdf5d0, 0.1);
  }
};

const forestMid: DrawFn = (ctx, w, h) => {
  const rand = rng(1234);
  for (let i = 0; i < 16; i++) {
    const x = rand() * w;
    const bw = 8 + rand() * 12;
    bamboo(ctx, h, x, bw, mix(0x2f6b45, 0x7bbf8a, rand() * 0.5), 0.55 + rand() * 0.3);
  }

  // Torii receding into the fog — the shrine path.
  const toriiY = [0.18, 0.45, 0.72];
  toriiY.forEach((ty, i) => {
    tileY(h, h * ty, 120, (yy) => {
      ctx.save();
      ctx.globalAlpha = 0.5 + i * 0.16;
      ctx.fillStyle = hex(mix(0x8c1f1f, 0x14301f, 0.35 - i * 0.1), 1);
      toriiShape(ctx, w / 2, yy, 150 + i * 45, 110 + i * 30);
      ctx.fill();
      ctx.restore();
    });
  });

  // Fireflies.
  const fr = rng(88);
  for (let i = 0; i < 22; i++) {
    const x = fr() * w;
    const y = fr() * h;
    const c = 0xc8ff88;
    tileY(h, y, 12, (yy) => {
      ctx.fillStyle = radGrad(ctx, x, yy, 9, [
        [0, c, 0.5],
        [1, c, 0],
      ]);
      circle(ctx, x, yy, 9);
      ctx.fill();
      ctx.fillStyle = hex(0xf2ffd0, 0.95);
      circle(ctx, x, yy, 1.2);
      ctx.fill();
    });
  }
};

const forestNear: DrawFn = (ctx, w, h) => {
  const ink = 0x061009;

  tileY(h, h * 0.4, 60, (yy) => shimenawa(ctx, -10, w + 10, yy, 34, 0x6b5335, 0xf2ead6));

  // Kitsune statues flanking the path, eyes lit.
  const statue = (sx: number, sy: number, flip: number): void => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(flip, 1);
    ctx.fillStyle = hex(ink, 0.96);
    blob(ctx, 0, 0, 15, 20, 0.12, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-11, -12);
    ctx.lineTo(-14, -30);
    ctx.lineTo(-2, -16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, -14);
    ctx.lineTo(13, -31);
    ctx.lineTo(1, -17);
    ctx.closePath();
    ctx.fill();
    glow(ctx, 0xffb03a, 7, 2, () => {
      ctx.fillStyle = hex(0xffd76b, 1);
      circle(ctx, -5, -6, 1.7);
      ctx.fill();
      circle(ctx, 4, -6, 1.7);
      ctx.fill();
    });
    ctx.restore();
  };

  tileY(h, h * 0.68, 45, (yy) => {
    statue(26, yy, 1);
    statue(w - 26, yy, -1);
  });

  // Foreground canopy: dark leaf mass at both vertical edges of the tile.
  const lr = rng(55);
  for (let i = 0; i < 30; i++) {
    const x = lr() * w;
    const y = lr() * h;
    ctx.fillStyle = hex(ink, 0.5 + lr() * 0.4);
    tileY(h, y, 20, (yy) => {
      blob(ctx, x, yy, 10 + lr() * 16, 6 + lr() * 10, 0.4, (i * 7) | 0);
      ctx.fill();
    });
  }
};

/* ---- mountain: above the treeline, cold and thin ---- */

const mountainFar: DrawFn = (ctx, w, h) => {
  skyBand(ctx, w, h, [
    [0, 0x0d1b33],
    [0.5, 0x24405e],
    [0.85, 0x3b5878],
    [1, 0x0d1b33],
  ]);
  starField(ctx, w, h, 50, 33, 0xdfeeff, 1);
  // Pale aurora.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    beam(ctx, h, w * (0.25 + i * 0.25), h * 0.3, 420, 130, 0.05 + i * 0.04, 0x7de8c8, 0.09);
  }
  ctx.restore();
  mist(ctx, w, h, 91, 0x9dc0dd, 0.12, 6, 1.6);
};

const mountainMid: DrawFn = (ctx, w, h) => {
  // Two or three broad masses, not a fine sawtooth — each band a single
  // hazy tone close to the fog colour rather than a lit ridge-line edge.
  for (let band = 0; band < 3; band++) {
    const baseY = (h / 3) * band + 60;
    tileY(h, baseY, 150, (yy) => {
      ridge(
        ctx,
        w,
        h,
        yy,
        110,
        w * 0.42,
        200 + band,
        linGrad(ctx, 0, yy - 60, 0, yy + 90, [
          [0, mix(0x40608a, 0x9dc0dd, 0.25 - band * 0.05), 0.55],
          [1, 0x1c2c46, 0.9],
        ])
      );
    });
  }

  // Frozen waterfall.
  tileY(h, h * 0.5, 200, (yy) => {
    ctx.fillStyle = linGrad(ctx, 0, yy - 160, 0, yy + 160, [
      [0, 0xcfeaff, 0],
      [0.4, 0xcfeaff, 0.35],
      [1, 0xcfeaff, 0],
    ]);
    ctx.fillRect(w * 0.72, yy - 160, 26, 320);
  });
};

const mountainNear: DrawFn = (ctx, w, h) => {
  const ink = 0x101a2b;
  const rand = rng(707);

  // Rocks jutting from both sides.
  for (let i = 0; i < 7; i++) {
    const left = i % 2 === 0;
    const x = left ? -10 + rand() * 40 : w + 10 - rand() * 40;
    const y = rand() * h;
    tileY(h, y, 60, (yy) => {
      ctx.fillStyle = hex(ink, 0.95);
      blob(ctx, x, yy, 36 + rand() * 30, 26 + rand() * 24, 0.35, (i * 13) | 0);
      ctx.fill();
      // Snow cap catching the light.
      ctx.fillStyle = hex(0xe8f4ff, 0.5);
      ctx.beginPath();
      ctx.ellipse(x, yy - 18, 26, 7, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    });
  }

  // A lone torii at the edge of the void.
  tileY(h, h * 0.3, 90, (yy) => {
    ctx.fillStyle = hex(0x7a1a1a, 0.85);
    toriiShape(ctx, w * 0.5, yy, 96, 78);
    ctx.fill();
    ctx.fillStyle = hex(0xe8f4ff, 0.35);
    ctx.fillRect(w * 0.5 - 52, yy - 78, 104, 4);
  });
};

/* ---- clouds: the sea of cloud, lit from below ---- */

const cloudsFar: DrawFn = (ctx, w, h) => {
  skyBand(ctx, w, h, [
    [0, 0x2b1e4a],
    [0.35, 0x7a3f6e],
    [0.62, 0xd96a54],
    [0.82, 0xffa25c],
    [1, 0x2b1e4a],
  ]);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = radGrad(ctx, w * 0.5, h * 0.8, 260, [
    [0, 0xfff0c4, 0.4],
    [1, 0xffa25c, 0],
  ]);
  circle(ctx, w * 0.5, h * 0.8, 260);
  ctx.fill();
  ctx.restore();
};

const cloudsMid: DrawFn = (ctx, w, h) => {
  const rand = rng(4242);
  for (let i = 0; i < 7; i++) {
    cloudBank(
      ctx,
      h,
      rand() * w,
      rand() * h,
      90 + rand() * 90,
      36 + rand() * 30,
      (i * 17) | 0,
      0xffe6c4,
      0xb56a8a,
      0.5
    );
  }
  // Cranes in flight.
  const cr = rng(6);
  for (let i = 0; i < 5; i++) {
    const x = cr() * w;
    const y = cr() * h;
    const s = 4 + cr() * 4;
    tileY(h, y, 12, (yy) => {
      ctx.strokeStyle = hex(0x2b1e4a, 0.75);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - s, yy);
      ctx.quadraticCurveTo(x - s * 0.4, yy - s * 0.7, x, yy);
      ctx.quadraticCurveTo(x + s * 0.4, yy - s * 0.7, x + s, yy);
      ctx.stroke();
    });
  }
};

const cloudsNear: DrawFn = (ctx, w, h) => {
  const rand = rng(31337);
  for (let i = 0; i < 5; i++) {
    cloudBank(
      ctx,
      h,
      rand() * w,
      rand() * h,
      120 + rand() * 110,
      44 + rand() * 34,
      (i * 29) | 0,
      0xfff6e0,
      0xff9a6a,
      0.75
    );
  }
  // A pagoda roof piercing the cloud sea.
  tileY(h, h * 0.62, 80, (yy) => {
    ctx.fillStyle = hex(0x2b1a2e, 0.9);
    roofPath(ctx, w * 0.24, yy, 84, 26);
    ctx.fill();
    ctx.fillRect(w * 0.24 - 10, yy, 20, 40);
    ctx.fillStyle = hex(PALETTE.gold, 0.8);
    ctx.fillRect(w * 0.24 - 1.5, yy - 42, 3, 18);
  });
};

/* ---- storm: the sky fights back ---- */

const stormFar: DrawFn = (ctx, w, h) => {
  skyBand(ctx, w, h, [
    [0, 0x0a0714],
    [0.5, 0x1a1230],
    [0.85, 0x241a3d],
    [1, 0x0a0714],
  ]);
  mist(ctx, w, h, 13, 0x4a3a6b, 0.28, 10, 1.8);
};

const stormMid: DrawFn = (ctx, w, h) => {
  const rand = rng(999);
  for (let i = 0; i < 6; i++) {
    cloudBank(
      ctx,
      h,
      rand() * w,
      rand() * h,
      110 + rand() * 100,
      50 + rand() * 36,
      (i * 23) | 0,
      0x6a5b96,
      0x120c22,
      0.85
    );
  }
  bolt(ctx, h, w * 0.3, h * 0.18, 200, 3, 0xdff0ff);
  bolt(ctx, h, w * 0.74, h * 0.62, 240, 8, 0xbfe4ff);
};

const stormNear: DrawFn = (ctx, w, h) => {
  const rand = rng(2468);
  for (let i = 0; i < 4; i++) {
    cloudBank(
      ctx,
      h,
      rand() * w,
      rand() * h,
      140 + rand() * 120,
      54 + rand() * 40,
      (i * 41) | 0,
      0x2a2044,
      0x08050f,
      0.9
    );
  }

  // Slanted rain streaks.
  ctx.save();
  ctx.strokeStyle = hex(0xbfd4ff, 0.28);
  ctx.lineWidth = 1.1;
  const rr = rng(5150);
  for (let i = 0; i < 90; i++) {
    const x = rr() * w;
    const y = rr() * h;
    const l = 14 + rr() * 22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - l * 0.32, y + l);
    ctx.stroke();
  }
  ctx.restore();
};

/* ---- cosmos: past the sky ---- */

const cosmosFar: DrawFn = (ctx, w, h) => {
  skyBand(ctx, w, h, [
    [0, 0x03020a],
    [0.5, 0x0d0720],
    [0.85, 0x150b2e],
    [1, 0x03020a],
  ]);
  // Nebula.
  const rand = rng(70707);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 8; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 100 + rand() * 130;
    const c = i % 2 === 0 ? PALETTE.cursed : PALETTE.spiritDeep;
    fogBlob(ctx, h, x, y, r, r * 0.7, c, 0.14);
  }
  ctx.restore();
  starField(ctx, w, h, 240, 4242, 0xffffff, 1.6);
};

const cosmosMid: DrawFn = (ctx, w, h) => {
  galaxy(ctx, h, w * 0.72, h * 0.24, 90, 616);

  // Floating torii adrift in the void.
  const rand = rng(818);
  for (let i = 0; i < 3; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const s = 70 + rand() * 60;
    tileY(h, y, s, (yy) => {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.rotate(0);
      ctx.fillStyle = hex(mix(0x8c1f1f, PALETTE.cursed, 0.35), 1);
      toriiShape(ctx, x, yy, s, s * 0.8);
      ctx.fill();
      ctx.restore();
    });
  }

  // Constellation lines.
  const cr = rng(313);
  ctx.strokeStyle = hex(PALETTE.spirit, 0.2);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    let px = cr() * w;
    let py = cr() * h;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let j = 0; j < 3; j++) {
      px += (cr() - 0.5) * 120;
      py += (cr() - 0.5) * 120;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
};

const cosmosNear: DrawFn = (ctx, w, h) => {
  const rand = rng(5150);

  // Drifting spirit motes.
  for (let i = 0; i < 14; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 2 + rand() * 3;
    const c = rand() < 0.5 ? PALETTE.spirit : PALETTE.cursedGlow;
    tileY(h, y, r * 8, (yy) => {
      ctx.fillStyle = radGrad(ctx, x, yy, r * 7, [
        [0, c, 0.5],
        [1, c, 0],
      ]);
      circle(ctx, x, yy, r * 7);
      ctx.fill();
      ctx.fillStyle = hex(0xffffff, 0.9);
      circle(ctx, x, yy, r * 0.5);
      ctx.fill();
    });
  }

  // Asteroids.
  for (let i = 0; i < 6; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 8 + rand() * 16;
    tileY(h, y, r * 1.4, (yy) => {
      ctx.fillStyle = hex(0x120d1f, 0.95);
      blob(ctx, x, yy, r, r * 0.75, 0.35, (i * 3) | 0);
      ctx.fill();
      ctx.fillStyle = hex(PALETTE.cursed, 0.25);
      blob(ctx, x - r * 0.2, yy - r * 0.25, r * 0.5, r * 0.35, 0.4, (i * 5) | 0);
      ctx.fill();
    });
  }
};

/* ============================================================ registration */

const PAINTERS: Record<Biome, DrawFn[]> = {
  village: [villageFar, villageMid, villageNear],
  forest: [forestFar, forestMid, forestNear],
  mountain: [mountainFar, mountainMid, mountainNear],
  clouds: [cloudsFar, cloudsMid, cloudsNear],
  storm: [stormFar, stormMid, stormNear],
  cosmos: [cosmosFar, cosmosMid, cosmosNear],
};

export function registerBackgrounds(scene: Scene): void {
  BIOMES.forEach((biome) => {
    const layers = PAINTERS[biome];
    for (let i = 0; i < BG_LAYERS; i++) {
      const painter = layers[i];
      defineFlat(scene, bgKey(biome, i), W, H, (ctx, w, h) => {
        painter(ctx, w, h);
        // A touch of grain unifies the layers and kills gradient banding.
        if (i === 0) grain(ctx, w, h, 0.035, 1000 + i);
      });
    }
  });

  const menuLayers = [menuFar, menuMid, menuNear];
  for (let i = 0; i < BG_LAYERS; i++) {
    const painter = menuLayers[i];
    defineFlat(scene, menuBgKey(i), W, H, (ctx, w, h) => {
      painter(ctx, w, h);
      if (i === 0) grain(ctx, w, h, 0.035, 1000 + i);
    });
  }
}
