import { Scene } from "phaser";

import { SKINS, type SkinDef, type SkinPalette } from "../config/skins";
import { CHAR_FRAME, CHAR_H, CHAR_W, charKey } from "./keys";
import {
  ao,
  aura,
  circle,
  clipped,
  contactShadow,
  darken,
  ellipse,
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
  type Ctx,
} from "./paint";
import { defineSheet, type DrawFn } from "./registry";

/**
 * The player: a small bipedal yokai-ninja, painted frame by frame.
 *
 * Every skin is a different creature rather than a recolour — headwear, tails,
 * a worn mask, horns, flames, ghost dissolve and a halo reshape a shared
 * humanoid base, and the palette drives the shading so a nine-tailed kitsune
 * and a drowned yurei come out of the same painter.
 */

/* ------------------------------------------------------------------ */
/* Anchors — fixed rig the pose table offsets from                    */
/* ------------------------------------------------------------------ */

const HEAD_X = 24;
const HEAD_Y = 15.5;
const HEAD_R = 8.3;
const SHOULDER_Y = 25.5;
const SHOULDER_DX = 7.4;
const HIP_Y = 39.5;
const HIP_DX = 3.6;

/* ------------------------------------------------------------------ */
/* Pose                                                                */
/* ------------------------------------------------------------------ */

type Expr = "open" | "determined" | "worried" | "hurt";

/** One limb segment: overall direction from its joint, a bend bulge for the
 *  knee/elbow, length and base width. `ang` is measured from straight down
 *  (0), positive rotating toward +x. */
interface LimbSpec {
  ang: number;
  bend: number;
  len: number;
  wid: number;
}

interface Pose {
  headTilt: number;
  /** Shoulder-line x offset from the hip — leans the torso. */
  torsoLean: number;
  legL: LimbSpec;
  legR: LimbSpec;
  armL: LimbSpec;
  armR: LimbSpec;
  scarfKick: number;
  /** Outward tilt added to each ear/fin, per side [left, right]. */
  earDrop: [number, number];
  /** Added to every tail's angular offset from vertical (+ = swept back/down). */
  tailSweep: number;
  /** Whole-body rotation, radians, pivoted near the feet. */
  tilt: number;
  expr: Expr;
  /** 0 = eyes wide, 1 = shut. */
  lid: number;
  stars: boolean;
  ruffle: number;
}

const POSES: Record<number, Pose> = {
  [CHAR_FRAME.idle]: {
    headTilt: 0, torsoLean: 0,
    legL: { ang: -0.16, bend: 0.5, len: 15, wid: 4.4 },
    legR: { ang: 0.2, bend: -0.55, len: 15, wid: 4.4 },
    armL: { ang: -0.46, bend: 0.4, len: 12.6, wid: 3.5 },
    armR: { ang: 0.42, bend: -0.3, len: 12.6, wid: 3.5 },
    scarfKick: 0.15,
    earDrop: [0, 0], tailSweep: 0,
    tilt: 0, expr: "open", lid: 0.06, stars: false, ruffle: 0,
  },
  [CHAR_FRAME.idleAlt]: {
    headTilt: 0.02, torsoLean: 0.3,
    legL: { ang: -0.12, bend: 0.55, len: 15, wid: 4.4 },
    legR: { ang: 0.24, bend: -0.5, len: 15, wid: 4.4 },
    armL: { ang: -0.42, bend: 0.44, len: 12.6, wid: 3.5 },
    armR: { ang: 0.46, bend: -0.24, len: 12.6, wid: 3.5 },
    scarfKick: 0.2,
    earDrop: [0.11, 0.06], tailSweep: -0.07,
    tilt: 0, expr: "open", lid: 0.46, stars: false, ruffle: 0,
  },
  [CHAR_FRAME.rise]: {
    headTilt: -0.05, torsoLean: -1.6,
    legL: { ang: -0.82, bend: 1.25, len: 12, wid: 4.6 },
    legR: { ang: -0.5, bend: 1.55, len: 11, wid: 4.6 },
    armL: { ang: -0.95, bend: -0.3, len: 12, wid: 3.6 },
    armR: { ang: -1.15, bend: 0.22, len: 11, wid: 3.6 },
    scarfKick: -0.9,
    earDrop: [1.32, 1.32], tailSweep: 0.42,
    tilt: 0, expr: "determined", lid: 0.3, stars: false, ruffle: 0,
  },
  [CHAR_FRAME.fall]: {
    headTilt: 0.06, torsoLean: 1.3,
    legL: { ang: 0.55, bend: -0.2, len: 16, wid: 4.3 },
    legR: { ang: 0.12, bend: 0.35, len: 15, wid: 4.3 },
    armL: { ang: 0.95, bend: 0.2, len: 13, wid: 3.5 },
    armR: { ang: -0.78, bend: -0.3, len: 13, wid: 3.5 },
    scarfKick: 0.85,
    earDrop: [-0.16, -0.16], tailSweep: -0.3,
    tilt: 0, expr: "worried", lid: 0, stars: false, ruffle: 0,
  },
  [CHAR_FRAME.hurt]: {
    headTilt: 0.12, torsoLean: 0.6,
    legL: { ang: 0.6, bend: 0.7, len: 14, wid: 4.3 },
    legR: { ang: -0.35, bend: -0.5, len: 15, wid: 4.3 },
    armL: { ang: 1.3, bend: 0.4, len: 12, wid: 3.5 },
    armR: { ang: -1.2, bend: -0.4, len: 12, wid: 3.5 },
    scarfKick: -0.4,
    earDrop: [0.15, 0.85], tailSweep: 0.16,
    tilt: 0.22, expr: "hurt", lid: 1, stars: true, ruffle: 1,
  },
};

/* ------------------------------------------------------------------ */
/* Colour utilities                                                    */
/* ------------------------------------------------------------------ */

const INK = 0x0b0716;

function lum(c: number): number {
  const r = ((c >> 16) & 0xff) / 255;
  const g = ((c >> 8) & 0xff) / 255;
  const b = (c & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function seedOf(id: string): number {
  let s = 2166136261;
  for (let i = 0; i < id.length; i++) {
    s ^= id.charCodeAt(i);
    s = Math.imul(s, 16777619);
  }
  return s >>> 0;
}

/* ------------------------------------------------------------------ */
/* Shared shapes                                                       */
/* ------------------------------------------------------------------ */

function headPath(ctx: Ctx, hx: number, hy: number, grow: number): void {
  circle(ctx, hx, hy, HEAD_R + grow);
}

/**
 * Kimono/gi torso: a soft, rounded silhouette — domed shoulders, a gentle
 * waist taper, a rounded hem — with no straight edges anywhere, so it reads
 * as a body wrapped in cloth rather than a geometric trapezoid.
 */
function torsoPath(ctx: Ctx, shX: number, hipX: number, grow: number): void {
  const top = SHOULDER_Y - 4.2 - grow;
  const hem = HIP_Y + 4.4 + grow;
  const shW = SHOULDER_DX * 0.94 + grow;
  const waW = 5.4 + grow;
  const hipW = HIP_DX + 3.6 + grow;
  const midY = (SHOULDER_Y + HIP_Y) / 2 + 1;

  ctx.beginPath();
  ctx.moveTo(shX, top);
  ctx.quadraticCurveTo(shX - shW * 1.15, top - grow * 0.2, shX - shW, SHOULDER_Y + 1 - grow);
  ctx.quadraticCurveTo(shX - waW - grow * 0.4, midY, hipX - hipW, hem - 2.4);
  ctx.quadraticCurveTo(hipX - hipW * 0.7, hem + 2, hipX, hem + 2.4 + grow);
  ctx.quadraticCurveTo(hipX + hipW * 0.7, hem + 2, hipX + hipW, hem - 2.4);
  ctx.quadraticCurveTo(shX + waW + grow * 0.4, midY, shX + shW, SHOULDER_Y + 1 - grow);
  ctx.quadraticCurveTo(shX + shW * 1.15, top - grow * 0.2, shX, top);
  ctx.closePath();
}

/**
 * Bean/cylinder torso for gills-trait skins — a single convex curve from
 * collar to tail-base with no waist pinch, widest at the belly rather than
 * the shoulders. A separate path from torsoPath() rather than a parameter
 * on it, so reshaping this one creature never re-shades the other nine.
 */
function cylinderTorsoPath(ctx: Ctx, shX: number, hipX: number, grow: number): void {
  const top = SHOULDER_Y - 3.5 - grow;
  const shW = SHOULDER_DX * 0.78 + grow;
  const bellyY = HIP_Y - 1;
  const bellyW = HIP_DX + 4.6 + grow;
  const hem = HIP_Y + 4.2 + grow;
  const hemW = HIP_DX + 2.8 + grow;

  ctx.beginPath();
  ctx.moveTo(shX, top);
  ctx.quadraticCurveTo(shX - shW * 1.1, top + 2, shX - shW, SHOULDER_Y + 3 - grow);
  ctx.quadraticCurveTo(hipX - bellyW * 1.05, bellyY - 6, hipX - bellyW, bellyY);
  ctx.quadraticCurveTo(hipX - bellyW * 0.9, hem - 1, hipX - hemW, hem);
  ctx.quadraticCurveTo(hipX, hem + 2.6 + grow, hipX + hemW, hem);
  ctx.quadraticCurveTo(hipX + bellyW * 0.9, hem - 1, hipX + bellyW, bellyY);
  ctx.quadraticCurveTo(hipX + bellyW * 1.05, bellyY - 6, shX + shW, SHOULDER_Y + 3 - grow);
  ctx.quadraticCurveTo(shX + shW * 1.1, top + 2, shX, top);
  ctx.closePath();
}

/**
 * One bent limb segment as a tapered ribbon — reuses the same bezier-offset
 * technique as the tail so a knee/elbow "bend" reads as a bulge along a
 * single smooth path instead of needing true two-bone IK.
 */
function limbPath(ctx: Ctx, x0: number, y0: number, s: LimbSpec, grow: number): { tx: number; ty: number } {
  const dx = Math.sin(s.ang);
  const dy = Math.cos(s.ang);
  const px = dy;
  const py = -dx;
  const w = s.wid + grow;
  const tx = x0 + dx * s.len + px * s.bend * 0.4;
  const ty = y0 + dy * s.len + py * s.bend * 0.4;
  const mx = x0 + dx * s.len * 0.5 + px * s.bend;
  const my = y0 + dy * s.len * 0.5 + py * s.bend;

  ctx.beginPath();
  ctx.moveTo(x0 + px * w * 0.85, y0 + py * w * 0.85);
  ctx.quadraticCurveTo(mx + px * w * 0.8, my + py * w * 0.8, tx + px * w * 0.5, ty + py * w * 0.5);
  ctx.quadraticCurveTo(tx + dx * w * 0.6, ty + dy * w * 0.6, tx - px * w * 0.5, ty - py * w * 0.5);
  ctx.quadraticCurveTo(mx - px * w * 0.8, my - py * w * 0.8, x0 - px * w * 0.85, y0 - py * w * 0.85);
  ctx.closePath();
  return { tx, ty };
}

/**
 * Ink contour for a limb that stops short of the joint end — an *open* path
 * tracing only the two long edges and the rounded tip, never the base cross
 * edge. A full closed-loop outline at the shoulder/hip reads as a seam where
 * a separate part was glued on; leaving the base unstroked lets the limb's
 * fill blend straight into the torso the way a sleeve grows out of a body.
 */
function limbOutline(ctx: Ctx, x0: number, y0: number, s: LimbSpec, color: number, width: number): void {
  const dx = Math.sin(s.ang);
  const dy = Math.cos(s.ang);
  const px = dy;
  const py = -dx;
  const w = s.wid;
  const tx = x0 + dx * s.len + px * s.bend * 0.4;
  const ty = y0 + dy * s.len + py * s.bend * 0.4;
  const mx = x0 + dx * s.len * 0.5 + px * s.bend;
  const my = y0 + dy * s.len * 0.5 + py * s.bend;

  ctx.save();
  ctx.strokeStyle = hex(color, 0.9);
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0 + px * w * 0.75, y0 + py * w * 0.75);
  ctx.quadraticCurveTo(mx + px * w * 0.8, my + py * w * 0.8, tx + px * w * 0.5, ty + py * w * 0.5);
  ctx.quadraticCurveTo(tx + dx * w * 0.6, ty + dy * w * 0.6, tx - px * w * 0.5, ty - py * w * 0.5);
  ctx.quadraticCurveTo(mx - px * w * 0.8, my - py * w * 0.8, x0 - px * w * 0.75, y0 - py * w * 0.75);
  ctx.stroke();
  ctx.restore();
}

/** Soft rounded pad at a limb's root, bridging it into the torso silhouette. */
function jointCap(ctx: Ctx, x: number, y: number, r: number, body: number, bodyDark: number): void {
  ctx.fillStyle = radGrad(ctx, x, y, r * 1.3, [
    [0, lighten(body, 0.16)],
    [0.6, body],
    [1, bodyDark],
  ]);
  circle(ctx, x, y, r);
  ctx.fill();
}

/**
 * A hand/foot tip as one continuous path — a pad with two toe lobes fused
 * into its rim, not three separate circles stacked together. Three small
 * circles read as loose beads at this canvas size; one path with two
 * generous lobes reads as a paw. Local space: origin at the pad's centre,
 * toes point toward +y (rotate the context to the limb's own tip direction
 * before calling).
 */
function pawShape(ctx: Ctx, w: number): void {
  const rx = w * 0.82;
  const ry = w * 0.62;
  ctx.beginPath();
  ctx.moveTo(-rx, -ry * 0.3);
  ctx.quadraticCurveTo(-rx, ry * 0.6, -rx * 0.35, ry * 0.95);
  ctx.quadraticCurveTo(-rx * 0.18, ry * 1.35, 0, ry * 1.05);
  ctx.quadraticCurveTo(rx * 0.18, ry * 1.35, rx * 0.35, ry * 0.95);
  ctx.quadraticCurveTo(rx, ry * 0.6, rx, -ry * 0.3);
  ctx.quadraticCurveTo(rx * 0.5, -ry * 1.1, 0, -ry);
  ctx.quadraticCurveTo(-rx * 0.5, -ry * 1.1, -rx, -ry * 0.3);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Tails                                                               */
/* ------------------------------------------------------------------ */

interface TailSpec {
  ang: number;
  len: number;
  wid: number;
  bend: number;
}

/**
 * Tails hang and trail from behind the hip like a real tail at rest, fanning
 * out sideways rather than swooping up past the waist — `back` (pointing
 * down) is the resting reference instead of straight up.
 */
function tailSpecs(n: number, sweep: number): TailSpec[] {
  if (n <= 0) return [];
  const back = Math.PI / 2;

  if (n === 1) {
    const o = Math.min(1.1, Math.max(0.25, 0.55 + sweep * 0.6));
    return [{ ang: back + o, len: 14, wid: 4.6, bend: 2.6 }];
  }

  const len = n <= 3 ? 13.5 : n <= 5 ? 12.6 : 11.4;
  const wid = n <= 3 ? 4.2 : n <= 5 ? 3.7 : 3.1;
  const right = Math.ceil(n / 2);
  const left = n - right;
  const out: TailSpec[] = [];

  const side = (count: number, sign: number): void => {
    for (let j = 0; j < count; j++) {
      const base = count === 1 ? 0.65 : 0.35 + (0.75 * j) / (count - 1);
      const o = Math.min(1.25, Math.max(0.2, base + sweep * 0.6));
      const l = len * (1 - 0.08 * (base / 0.75));
      out.push({ ang: back + sign * o, len: l, wid, bend: sign * l * 0.22 });
    }
  };
  side(left, -1);
  side(right, 1);
  return out;
}

function tailPath(ctx: Ctx, x0: number, y0: number, t: TailSpec, grow: number): void {
  const cx = Math.cos(t.ang);
  const cy = Math.sin(t.ang);
  const px = -cy;
  const py = cx;
  const w = t.wid + grow;
  const tx = x0 + cx * t.len + px * t.bend * 0.35;
  const ty = y0 + cy * t.len + py * t.bend * 0.35;
  const mx = x0 + cx * t.len * 0.5 + px * t.bend;
  const my = y0 + cy * t.len * 0.5 + py * t.bend;

  ctx.beginPath();
  ctx.moveTo(x0 + px * w * 0.9, y0 + py * w * 0.9);
  ctx.quadraticCurveTo(mx + px * w * 1.3, my + py * w * 1.3, tx + px * w * 0.28, ty + py * w * 0.28);
  ctx.quadraticCurveTo(tx + cx * w * 1.05, ty + cy * w * 1.05, tx - px * w * 0.28, ty - py * w * 0.28);
  ctx.quadraticCurveTo(mx - px * w * 1.05, my - py * w * 1.05, x0 - px * w * 0.9, y0 - py * w * 0.9);
  ctx.closePath();
}

/**
 * A translucent fin membrane over the distal half of a tail — light as
 * matter rather than a coat of paint over cartilage, the way an axolotl's
 * own tail fin reads. Traces the same centreline as tailPath() but doesn't
 * need to match it exactly: it's soft-edged and half-transparent, so a
 * loose follow of the curve still reads as "glowing membrane," not "mask
 * slightly off the tail."
 */
function paintTailFin(ctx: Ctx, x0: number, y0: number, t: TailSpec, pal: SkinPalette): void {
  const cx = Math.cos(t.ang);
  const cy = Math.sin(t.ang);
  const px = -cy;
  const py = cx;

  const along = (u: number): { x: number; y: number } => ({
    x: x0 + cx * t.len * u + px * t.bend * u * u * 0.6,
    y: y0 + cy * t.len * u + py * t.bend * u * u * 0.6,
  });
  const widthAt = (u: number): number => t.wid * (1.4 - ((u - 0.35) / 0.65) * 0.9);

  const a = along(0.35);
  const mid = along(0.68);
  const b = along(1);
  const aw = widthAt(0.35);
  const midw = widthAt(0.68);
  const bw = widthAt(1);

  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(a.x + px * aw, a.y + py * aw);
    ctx.quadraticCurveTo(mid.x + px * midw, mid.y + py * midw, b.x + px * bw, b.y + py * bw);
    ctx.quadraticCurveTo(mid.x, mid.y, b.x - px * bw, b.y - py * bw);
    ctx.quadraticCurveTo(mid.x - px * midw, mid.y - py * midw, a.x - px * aw, a.y - py * aw);
    ctx.closePath();
  };
  ctx.fillStyle = radGrad(ctx, mid.x, mid.y, t.len * 0.5, [
    [0, pal.accent, 0.65],
    [1, pal.aura, 0],
  ]);
  shape();
  ctx.fill();
  rimLight(ctx, shape, pal.aura, 1.2, 0.6);
}

function paintTails(ctx: Ctx, p: Pose, sk: SkinDef, seed: number, hipX: number): void {
  const pal = sk.palette;
  const specs = tailSpecs(sk.traits.tails, p.tailSweep);
  if (specs.length === 0) return;

  const x0 = hipX;
  const y0 = HIP_Y + 1;
  const rand = rng(seed ^ 0x5ab1);

  specs.forEach((t, i) => {
    const cx = Math.cos(t.ang);
    const cy = Math.sin(t.ang);
    const tx = x0 + cx * t.len + -cy * t.bend * 0.35;
    const ty = y0 + cy * t.len + cx * t.bend * 0.35;
    const path = (): void => tailPath(ctx, x0, y0, t, 0);

    outline(ctx, path, INK, 2.1, 0.9);
    ctx.fillStyle = linGrad(ctx, x0, y0, tx, ty, [
      [0, darken(pal.bodyDark, 0.2)],
      [0.35, pal.bodyDark],
      [0.72, pal.body],
      [1, lighten(pal.body, 0.15)],
    ]);
    path();
    ctx.fill();

    clipped(ctx, path, () => {
      ctx.fillStyle = radGrad(ctx, tx, ty, t.len * 0.46, [
        [0, lighten(pal.accent, 0.35), 1],
        [0.5, pal.accent, 0.85],
        [1, pal.accent, 0],
      ]);
      circle(ctx, tx, ty, t.len * 0.46);
      ctx.fill();

      ctx.strokeStyle = hex(darken(pal.bodyDark, 0.25), 0.3);
      ctx.lineWidth = 0.9;
      for (let s = 0; s < 3; s++) {
        const off = (s - 1) * t.wid * 0.55;
        ctx.beginPath();
        ctx.moveTo(x0 - cy * off, y0 + cx * off);
        ctx.quadraticCurveTo(
          x0 + cx * t.len * 0.55 - cy * (off + t.bend * 0.9),
          y0 + cy * t.len * 0.55 + cx * (off + t.bend * 0.9),
          tx - cy * off * 0.3,
          ty + cx * off * 0.3
        );
        ctx.stroke();
      }

      ao(ctx, x0, y0, t.len * 0.5, t.len * 0.5, 0.3);
    });

    ctx.strokeStyle = hex(lighten(pal.accent, 0.2), 0.55);
    ctx.lineWidth = 0.8;
    for (let s = 0; s < 2; s++) {
      const a = t.ang + (rand() - 0.5) * 0.9;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + Math.cos(a) * (1.6 + rand() * 1.6), ty + Math.sin(a) * (1.6 + rand() * 1.6));
      ctx.stroke();
    }

    if (sk.traits.gills) paintTailFin(ctx, x0, y0, t, pal);

    if (i === 0) rand();
  });
}

/* ------------------------------------------------------------------ */
/* Scarf                                                               */
/* ------------------------------------------------------------------ */

/**
 * A short cloth ribbon draping down from the collar — every skin wears one.
 * It hangs mostly straight down at rest and only streams sideways/up when
 * `scarfKick` picks up during a jump, so it reads as fabric responding to
 * motion rather than a pair of wings flanking the torso.
 */
function paintScarf(ctx: Ctx, p: Pose, sk: SkinDef, shX: number, seed: number): void {
  const pal = sk.palette;
  const rand = rng(seed ^ 0x2c4);
  const x0 = shX;
  const y0 = SHOULDER_Y - 2.4;

  for (let i = 0; i < 2; i++) {
    const spread = i === 0 ? -1 : 1;
    const spec: TailSpec = {
      ang: Math.PI / 2 + spread * 0.3 - p.scarfKick * 0.65,
      len: 9 + i * 1.6 + rand() * 1.2,
      wid: 2.2 - i * 0.4,
      bend: spread * (2.2 + p.scarfKick * 3.4),
    };
    const path = (): void => tailPath(ctx, x0, y0, spec, 0);
    outline(ctx, path, INK, 1.4, 0.7);
    ctx.fillStyle = linGrad(
      ctx,
      x0,
      y0,
      x0 + Math.cos(spec.ang) * spec.len,
      y0 + Math.sin(spec.ang) * spec.len,
      [
        [0, lighten(pal.accent, 0.1)],
        [0.5, pal.accent],
        [1, darken(pal.accent, 0.35)],
      ]
    );
    path();
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Limbs                                                               */
/* ------------------------------------------------------------------ */

function paintLeg(ctx: Ctx, p: Pose, sk: SkinDef, side: -1 | 1, hipX: number): void {
  const pal = sk.palette;
  const spec = side < 0 ? p.legL : p.legR;
  const x0 = hipX + side * HIP_DX * 0.7;
  const y0 = HIP_Y;
  const path = (): { tx: number; ty: number } => limbPath(ctx, x0, y0, spec, 0);

  jointCap(ctx, x0, y0, spec.wid * 0.7, pal.body, pal.bodyDark);
  ctx.fillStyle = linGrad(ctx, x0, y0, x0 + Math.sin(spec.ang) * spec.len, y0 + Math.cos(spec.ang) * spec.len, [
    [0, pal.bodyDark],
    [0.55, pal.body],
    [1, darken(pal.bodyDark, 0.15)],
  ]);
  const { tx, ty } = path();
  ctx.fill();

  clipped(ctx, () => path(), () => {
    ao(ctx, x0, y0, spec.wid * 1.6, spec.len * 0.6, 0.3);
    keyLight(ctx, x0 - spec.wid * 2, y0 - spec.len * 0.4, spec.wid * 4, spec.len, 0.16);
  });
  limbOutline(ctx, x0, y0, spec, INK, 2.1);
  rimLight(ctx, () => path(), pal.aura, 1.4, 0.5);

  // Boot/foot pad at the tip.
  const foot = (): void => {
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(spec.ang);
    pawShape(ctx, spec.wid * 0.95);
    ctx.restore();
  };
  outline(ctx, foot, INK, 1.8, 0.9);
  ctx.fillStyle = radGrad(ctx, tx - 1, ty, spec.wid * 1.1, [
    [0, lighten(pal.bodyDark, 0.05)],
    [1, darken(pal.bodyDark, 0.4)],
  ]);
  foot();
  ctx.fill();
}

function paintArm(ctx: Ctx, p: Pose, sk: SkinDef, side: -1 | 1, shX: number): void {
  const pal = sk.palette;
  const spec = side < 0 ? p.armL : p.armR;
  // Anchored just inside the shoulder edge, not deep in the torso's centre —
  // deep overlap put the arm's own outline running down through the middle
  // of the torso fill, reading as a stray construction line across it.
  const x0 = shX + side * SHOULDER_DX * 0.94;
  const y0 = SHOULDER_Y - 0.5;
  const path = (): { tx: number; ty: number } => limbPath(ctx, x0, y0, spec, 0);

  jointCap(ctx, x0, y0, spec.wid * 0.65, pal.body, pal.bodyDark);
  ctx.fillStyle = linGrad(ctx, x0, y0, x0 + Math.sin(spec.ang) * spec.len, y0 + Math.cos(spec.ang) * spec.len, [
    [0, pal.body],
    [0.6, pal.bodyDark],
    [1, darken(pal.bodyDark, 0.2)],
  ]);
  const { tx, ty } = path();
  ctx.fill();

  clipped(ctx, () => path(), () => {
    ao(ctx, x0, y0, spec.wid * 1.5, spec.len * 0.6, 0.35);
  });
  limbOutline(ctx, x0, y0, spec, INK, 1.9);
  rimLight(ctx, () => path(), pal.aura, 1.2, 0.48);

  // Mitt/paw at the tip.
  const hand = (): void => {
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(spec.ang);
    pawShape(ctx, spec.wid * 0.85);
    ctx.restore();
  };
  outline(ctx, hand, INK, 1.6, 0.9);
  ctx.fillStyle = radGrad(ctx, tx - 1, ty - 1, spec.wid * 1.1, [
    [0, lighten(pal.body, 0.12)],
    [1, pal.bodyDark],
  ]);
  hand();
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/* Torso                                                               */
/* ------------------------------------------------------------------ */

function paintTorso(ctx: Ctx, sk: SkinDef, shX: number, hipX: number): void {
  const pal = sk.palette;
  const path = (grow = 0): void => torsoPath(ctx, shX, hipX, grow);

  outline(ctx, () => path(), INK, 2.4, 0.92);
  // A vertical gradient, not a radial one — the torso is a tall tube, not a
  // disc, and a circular gradient center reads as a coin floating inside it
  // instead of light wrapping down a cylinder.
  ctx.fillStyle = linGrad(ctx, shX, SHOULDER_Y - 4, shX, HIP_Y + 6, [
    [0, lighten(pal.body, 0.22)],
    [0.32, pal.body],
    [0.72, pal.bodyDark],
    [1, darken(pal.bodyDark, 0.3)],
  ]);
  path();
  ctx.fill();

  // Collar V — a lighter inner-lining wedge at the neckline.
  const cy = SHOULDER_Y + 1;
  ctx.fillStyle = radGrad(ctx, hipX, cy + 2, SHOULDER_DX * 0.85, [
    [0, lighten(pal.belly, 0.14)],
    [0.62, pal.belly],
    [1, mix(pal.belly, pal.bodyDark, 0.5)],
  ]);
  ctx.beginPath();
  ctx.moveTo(hipX - 3.2, cy - 2.4);
  ctx.lineTo(hipX + 3.2, cy - 2.4);
  ctx.lineTo(hipX, cy + 6.4);
  ctx.closePath();
  ctx.fill();

  clipped(ctx, () => path(), () => {
    ao(ctx, hipX, HIP_Y - 2, SHOULDER_DX * 1.1, 12, 0.42);
    keyLight(ctx, shX - SHOULDER_DX * 1.6, SHOULDER_Y - 4, SHOULDER_DX * 3.2, 24, 0.24);
  });
  rimLight(ctx, () => path(), pal.aura, 2, 0.5);
}

/**
 * Cylinder torso for gills-trait skins: a dome ambient pass (same technique
 * as paintTorso) plus a wrap-shading band — symmetric dark edges with a lit
 * band offset toward the key-light side, the way light reads on a turning
 * tube rather than a lit dome. Reuses the shared keyLight()/ao() axis so it
 * still agrees with the rest of the body under the same implied light.
 */
function paintCylinderTorso(ctx: Ctx, sk: SkinDef, shX: number, hipX: number): void {
  const pal = sk.palette;
  const path = (grow = 0): void => cylinderTorsoPath(ctx, shX, hipX, grow);

  outline(ctx, () => path(), INK, 2.4, 0.92);
  ctx.fillStyle = radGrad(ctx, shX - 3, SHOULDER_Y + 6, HIP_DX + 10, [
    [0, lighten(pal.body, 0.24)],
    [0.45, pal.body],
    [0.85, pal.bodyDark],
    [1, darken(pal.bodyDark, 0.28)],
  ]);
  path();
  ctx.fill();

  // Belly patch — the lighter amphibian underside, echoing the collar-V's
  // lighter-inner-lining idea but centred on the belly instead of the neck.
  ctx.fillStyle = radGrad(ctx, hipX, HIP_Y - 3, HIP_DX + 5, [
    [0, lighten(pal.belly, 0.1)],
    [0.6, pal.belly],
    [1, mix(pal.belly, pal.bodyDark, 0.4)],
  ]);
  ellipse(ctx, hipX, HIP_Y + 1, HIP_DX + 2.6, 7.4);
  ctx.fill();

  clipped(ctx, () => path(), () => {
    const bandColor = mix(darken(pal.bodyDark, 0.3), pal.aura, 0.18);
    ctx.fillStyle = linGrad(ctx, hipX - (HIP_DX + 10), 0, hipX + (HIP_DX + 10), 0, [
      [0, bandColor, 0.55],
      [0.3, pal.body, 0],
      [0.64, lighten(pal.body, 0.2), 0.3],
      [1, bandColor, 0.5],
    ]);
    ctx.fillRect(0, 0, CHAR_W, CHAR_H);

    ao(ctx, hipX, HIP_Y + 1, HIP_DX + 3, 8, 0.3);
    keyLight(ctx, shX - (HIP_DX + 8), SHOULDER_Y - 2, (HIP_DX + 8) * 1.6, 20, 0.2);
  });
  rimLight(ctx, () => path(), pal.aura, 2, 0.55);
}

/* ------------------------------------------------------------------ */
/* Headwear — hood ears / fins, horns, headband                       */
/* ------------------------------------------------------------------ */

function earOutline(ctx: Ctx, kind: "fox" | "cat" | "oni", hw: number, len: number): void {
  ctx.beginPath();
  if (kind === "cat") {
    ctx.moveTo(-hw, 3);
    ctx.quadraticCurveTo(-hw * 1.05, -len * 0.45, -hw * 0.1, -len);
    ctx.quadraticCurveTo(hw * 0.9, -len * 0.5, hw, 3);
    ctx.quadraticCurveTo(0, 5.6, -hw, 3);
  } else if (kind === "oni") {
    ctx.moveTo(-hw, 3);
    ctx.lineTo(-hw * 0.62, -len * 0.7);
    ctx.lineTo(hw * 0.15, -len);
    ctx.lineTo(hw * 0.5, -len * 0.42);
    ctx.lineTo(hw, 2.6);
    ctx.quadraticCurveTo(0, 5.4, -hw, 3);
  } else {
    ctx.moveTo(-hw, 3);
    ctx.quadraticCurveTo(-hw * 0.98, -len * 0.5, -hw * 0.06, -len);
    ctx.quadraticCurveTo(hw * 0.98, -len * 0.48, hw, 3);
    ctx.quadraticCurveTo(0, 5.8, -hw, 3);
  }
  ctx.closePath();
}

function paintEar(ctx: Ctx, p: Pose, sk: SkinDef, side: -1 | 1, seed: number): void {
  const t = sk.traits.ears;
  if (t === "none" || t === "leaf") return;
  const pal = sk.palette;
  const kind = t;
  const hw = kind === "fox" ? 3.4 : kind === "cat" ? 4 : 3.8;
  const len = kind === "fox" ? 8.6 : kind === "cat" ? 6.2 : 5.9;
  const drop = side < 0 ? p.earDrop[0] : p.earDrop[1];

  ctx.save();
  ctx.translate(HEAD_X + side * 5.4, HEAD_Y - HEAD_R * 0.78);
  ctx.rotate(side * (0.36 + drop));

  const shape = (): void => earOutline(ctx, kind, hw, len);
  outline(ctx, shape, INK, 2, 0.92);
  ctx.fillStyle = linGrad(ctx, 0, 4, 0, -len, [
    [0, darken(pal.bodyDark, 0.2)],
    [0.42, pal.bodyDark],
    [0.85, pal.body],
    [1, lighten(pal.body, 0.22)],
  ]);
  shape();
  ctx.fill();

  clipped(ctx, shape, () => {
    const inner = mix(pal.accent, pal.belly, 0.45);
    ctx.fillStyle = radGrad(ctx, 0, -len * 0.3, len * 0.6, [
      [0, lighten(inner, 0.2)],
      [0.6, inner],
      [1, darken(inner, 0.45)],
    ]);
    ctx.beginPath();
    ctx.moveTo(-hw * 0.56, 1.6);
    ctx.quadraticCurveTo(-hw * 0.5, -len * 0.45, 0, -len * 0.7);
    ctx.quadraticCurveTo(hw * 0.5, -len * 0.45, hw * 0.56, 1.6);
    ctx.closePath();
    ctx.fill();

    const rand = rng(seed ^ (side < 0 ? 0x9 : 0x17));
    ctx.strokeStyle = hex(lighten(pal.belly, 0.1), 0.6);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const x = -hw * 0.6 + rand() * hw * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.lineTo(x + (rand() - 0.5) * 1.6, 2 - (1.6 + rand() * 1.8));
      ctx.stroke();
    }
    ao(ctx, 0, -len * 0.1, hw * 1.6, len, 0.3);
  });

  rimLight(ctx, shape, pal.aura, 1.1, 0.45);
  ctx.restore();
}

/**
 * External gill fronds, anchored at the jaw rather than the skull — cat ears
 * already claim the top of the head, so a crown of fronds there would fight
 * them for silhouette space. Three per side, the one nearest the eye longest.
 */
function paintGills(ctx: Ctx, sk: SkinDef): void {
  const pal = sk.palette;

  for (const side of [-1, 1] as const) {
    for (let j = 0; j < 3; j++) {
      const len = 7.2 - j * 1.1;
      const hw = 1.3 - j * 0.15;
      const ax = HEAD_X + side * (HEAD_R * 0.88 + j * 0.35);
      const ay = HEAD_Y + HEAD_R * 0.15 + j * 1.8;

      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(side * (0.95 + j * 0.2));

      const shape = (): void => {
        ctx.beginPath();
        ctx.moveTo(-hw, 1.4);
        ctx.quadraticCurveTo(-hw * 1.3, -len * 0.5, 0, -len);
        ctx.quadraticCurveTo(hw * 1.3, -len * 0.5, hw, 1.4);
        ctx.closePath();
      };
      outline(ctx, shape, INK, 1.1, 0.85);
      ctx.fillStyle = linGrad(ctx, 0, 1, 0, -len, [
        [0, pal.bodyDark],
        [1, pal.accent],
      ]);
      shape();
      ctx.fill();

      if (j === 0) {
        glow(ctx, pal.accent, 2.4, 2, () => {
          ctx.fillStyle = hex(lighten(pal.accent, 0.3), 0.6);
          circle(ctx, 0, -len * 0.85, hw * 0.7);
          ctx.fill();
        });
      }
      ctx.restore();
    }
  }
}

/** Ryūjin's dorsal fins: membranes instead of ears, plus a spined crest. */
function paintFins(ctx: Ctx, p: Pose, sk: SkinDef): void {
  const pal = sk.palette;

  for (const side of [-1, 1] as const) {
    const drop = side < 0 ? p.earDrop[0] : p.earDrop[1];
    for (let j = 0; j < 3; j++) {
      const len = 8.6 - j * 2.1;
      const hw = 2.9 - j * 0.4;
      ctx.save();
      ctx.translate(HEAD_X + side * (HEAD_R * 0.62 + j * 0.3), HEAD_Y - HEAD_R * 0.6 + j * 2.7);
      ctx.rotate(side * (0.95 + j * 0.2 + drop * 0.6));

      const shape = (): void => {
        ctx.beginPath();
        ctx.moveTo(-hw, 2);
        ctx.lineTo(-hw * 0.3, -len);
        ctx.lineTo(hw * 0.35, -len * 0.55);
        ctx.lineTo(hw, 1.6);
        ctx.closePath();
      };
      outline(ctx, shape, INK, 1.7, 0.9);
      ctx.fillStyle = linGrad(ctx, 0, 2, 0, -len, [
        [0, pal.bodyDark],
        [0.5, pal.body],
        [1, lighten(pal.accent, 0.2)],
      ]);
      shape();
      ctx.fill();

      clipped(ctx, shape, () => {
        ctx.strokeStyle = hex(darken(pal.bodyDark, 0.4), 0.5);
        ctx.lineWidth = 0.7;
        for (let r = -1; r <= 1; r++) {
          ctx.beginPath();
          ctx.moveTo(r * 0.9, 2);
          ctx.lineTo(r * 0.4 - 0.5, -len * 0.85);
          ctx.stroke();
        }
      });
      rimLight(ctx, shape, pal.aura, 1, 0.5);
      ctx.restore();
    }
  }

  for (let i = -1; i <= 1; i++) {
    const x = HEAD_X + i * 2.6;
    const h = 3.8 - Math.abs(i) * 1;
    const spike = (): void => {
      ctx.beginPath();
      ctx.moveTo(x - 1.6, HEAD_Y - HEAD_R * 0.94);
      ctx.lineTo(x, HEAD_Y - HEAD_R - h);
      ctx.lineTo(x + 1.6, HEAD_Y - HEAD_R * 0.94);
      ctx.closePath();
    };
    outline(ctx, spike, INK, 1.4, 0.9);
    ctx.fillStyle = linGrad(ctx, x, HEAD_Y - HEAD_R, x, HEAD_Y - HEAD_R - h, [
      [0, pal.bodyDark],
      [1, lighten(pal.accent, 0.25)],
    ]);
    spike();
    ctx.fill();
  }
}

function paintHorns(ctx: Ctx, sk: SkinDef): void {
  const pal = sk.palette;
  const bone = mix(pal.belly, 0xfff6e2, 0.55);

  for (const side of [-1, 1] as const) {
    const bx = HEAD_X + side * 4.2;
    const by = HEAD_Y - HEAD_R * 0.76;
    const len = 7;
    const w = 1.7;
    const tx = bx + side * 3;
    const ty = by - len;

    ctx.fillStyle = hex(darken(pal.bodyDark, 0.45), 0.55);
    ellipse(ctx, bx, by + 0.4, w * 1.5, w * 0.9, side * 0.2);
    ctx.fill();

    const shape = (): void => {
      ctx.beginPath();
      ctx.moveTo(bx - side * w, by + 1);
      ctx.quadraticCurveTo(bx + side * w * 0.1, by - len * 0.6, tx, ty);
      ctx.quadraticCurveTo(bx + side * w * 2.1, by - len * 0.35, bx + side * w, by + 1.4);
      ctx.closePath();
    };
    outline(ctx, shape, INK, 1.8, 0.92);
    ctx.fillStyle = linGrad(ctx, bx, by, tx, ty, [
      [0, darken(bone, 0.45)],
      [0.4, darken(bone, 0.15)],
      [1, lighten(bone, 0.25)],
    ]);
    shape();
    ctx.fill();

    clipped(ctx, shape, () => {
      ctx.strokeStyle = hex(darken(bone, 0.5), 0.4);
      ctx.lineWidth = 0.7;
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        const x = bx + (tx - bx) * t;
        const y = by + (ty - by) * t;
        ctx.beginPath();
        ctx.moveTo(x - side * 1.9, y + 0.7);
        ctx.quadraticCurveTo(x, y - 0.35, x + side * 1.9, y + 0.5);
        ctx.stroke();
      }
      ao(ctx, bx, by, w * 2.4, len * 0.8, 0.45);
    });
  }
}

/**
 * Headband + trailing ribbon, worn under any hood ears — the "bandana"
 * every skin has across the forehead, matching the reference pose.
 */
function paintHeadband(ctx: Ctx, sk: SkinDef): void {
  const pal = sk.palette;
  const by = HEAD_Y - HEAD_R * 0.32;

  clipped(ctx, () => headPath(ctx, HEAD_X, HEAD_Y, 0.15), () => {
    ctx.fillStyle = linGrad(ctx, HEAD_X, by - 1.6, HEAD_X, by + 1.9, [
      [0, lighten(pal.accent, 0.3)],
      [0.5, pal.accent],
      [1, darken(pal.accent, 0.4)],
    ]);
    ctx.fillRect(HEAD_X - HEAD_R * 1.05, by - 1.6, HEAD_R * 2.1, 3.4);
  });

  const x0 = HEAD_X + HEAD_R * 0.92;
  const y0 = by + 0.2;
  const tail = (dy: number, len: number): void => {
    const path = (): void => {
      ctx.beginPath();
      ctx.moveTo(x0, y0 - 1.2);
      ctx.quadraticCurveTo(x0 + len * 0.6, y0 + dy * 0.5, x0 + len, y0 + dy);
      ctx.quadraticCurveTo(x0 + len * 0.55, y0 + dy * 0.5 + 1.7, x0, y0 + 1.2);
      ctx.closePath();
    };
    outline(ctx, path, INK, 1.3, 0.8);
    ctx.fillStyle = linGrad(ctx, x0, y0, x0 + len, y0 + dy, [
      [0, pal.accent],
      [1, darken(pal.accent, 0.45)],
    ]);
    path();
    ctx.fill();
  };
  tail(4, 6.4);
  tail(1, 4.6);
}

/* ------------------------------------------------------------------ */
/* Head                                                                */
/* ------------------------------------------------------------------ */

function paintHead(ctx: Ctx, sk: SkinDef): void {
  const pal = sk.palette;

  outline(ctx, () => headPath(ctx, HEAD_X, HEAD_Y, 0), INK, 2.3, 0.92);
  ctx.fillStyle = radGrad(
    ctx,
    HEAD_X - HEAD_R * 0.34,
    HEAD_Y - HEAD_R * 0.48,
    HEAD_R * 1.9,
    [
      [0, lighten(pal.body, 0.3)],
      [0.4, pal.body],
      [0.84, pal.bodyDark],
      [1, darken(pal.bodyDark, 0.25)],
    ]
  );
  headPath(ctx, HEAD_X, HEAD_Y, 0);
  ctx.fill();

  clipped(
    ctx,
    () => headPath(ctx, HEAD_X, HEAD_Y, 0),
    () => {
      ao(ctx, HEAD_X, HEAD_Y + HEAD_R * 0.2, HEAD_R * 1.2, HEAD_R * 1.2, 0.38);
      keyLight(ctx, HEAD_X - HEAD_R * 1.5, HEAD_Y - HEAD_R * 1.7, HEAD_R * 3, HEAD_R * 3, 0.28);
    }
  );
  rimLight(ctx, () => headPath(ctx, HEAD_X, HEAD_Y, 0), pal.aura, 1.7, 0.55);
}

/* ------------------------------------------------------------------ */
/* Face                                                                */
/* ------------------------------------------------------------------ */

function eyeGeom(): { dx: number; y: number; r: number } {
  return { dx: HEAD_R * 0.42, y: HEAD_Y + HEAD_R * 0.05, r: 2.7 };
}

function paintEye(ctx: Ctx, p: Pose, sk: SkinDef, side: -1 | 1): void {
  const pal = sk.palette;
  const g = eyeGeom();
  const cx = HEAD_X + side * g.dx;
  const cy = g.y;
  const r = g.r;

  if (p.expr === "hurt") {
    ctx.strokeStyle = hex(darken(pal.bodyDark, 0.5), 0.95);
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.75, cy - r * 0.75);
    ctx.lineTo(cx + r * 0.75, cy + r * 0.75);
    ctx.moveTo(cx + r * 0.75, cy - r * 0.75);
    ctx.lineTo(cx - r * 0.75, cy + r * 0.75);
    ctx.stroke();
    return;
  }

  const ry = r * (p.expr === "determined" ? 0.82 : p.expr === "worried" ? 1.06 : 1);
  const eye = (): void => ellipse(ctx, cx, cy, r, ry);

  ctx.fillStyle = hex(darken(pal.bodyDark, 0.55), 0.4);
  ellipse(ctx, cx, cy + 0.4, r * 1.2, ry * 1.16);
  ctx.fill();

  ctx.fillStyle = radGrad(ctx, cx, cy - r * 0.25, r * 1.25, [
    [0, 0xffffff],
    [0.62, mix(0xffffff, pal.belly, 0.5)],
    [1, mix(pal.belly, pal.bodyDark, 0.55)],
  ]);
  eye();
  ctx.fill();

  const ix = cx + side * 0.3;
  const iy = cy + (p.expr === "worried" ? 0.4 : 0.25);
  const ir = r * 0.72;
  const bright = lum(pal.eye) > 0.55;

  clipped(ctx, eye, () => {
    const iris = (): void => {
      ctx.fillStyle = radGrad(ctx, ix, iy - ir * 0.3, ir * 1.05, [
        [0, lighten(pal.eye, 0.5)],
        [0.52, pal.eye],
        [1, darken(pal.eye, 0.55)],
      ]);
      circle(ctx, ix, iy, ir);
      ctx.fill();
    };
    if (bright) glow(ctx, pal.eye, 2.6, 2, iris);
    else iris();

    ctx.fillStyle = hex(darken(pal.eye, 0.85), 0.95);
    if (sk.traits.gills) ellipse(ctx, ix, iy + 0.2, ir * 0.34, ir * 0.85);
    else circle(ctx, ix, iy + 0.2, ir * 0.48);
    ctx.fill();

    const innerX = cx - side * r * 1.5;
    const outerX = cx + side * r * 1.5;
    const base = cy - ry + p.lid * 2 * ry;
    const innerOff =
      p.expr === "determined" ? ry * 0.45 : p.expr === "worried" ? -ry * 0.38 : ry * 0.05;
    const outerOff =
      p.expr === "determined" ? -ry * 0.32 : p.expr === "worried" ? ry * 0.28 : -ry * 0.05;

    ctx.fillStyle = hex(mix(pal.body, pal.bodyDark, 0.62), 1);
    ctx.beginPath();
    ctx.moveTo(innerX, base + innerOff);
    ctx.lineTo(outerX, base + outerOff);
    ctx.lineTo(outerX, cy - ry * 2.4);
    ctx.lineTo(innerX, cy - ry * 2.4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = hex(darken(pal.bodyDark, 0.4), 0.8);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(innerX, base + innerOff);
    ctx.lineTo(outerX, base + outerOff);
    ctx.stroke();

    ctx.fillStyle = hex(0xffffff, 0.95);
    circle(ctx, ix - ir * 0.44, iy - ir * 0.5, r * 0.3);
    ctx.fill();
    // Secondary catchlight — tinted with the creature's own aura on
    // bioluminescent skins, so its ambient glow visibly reflects in its eye
    // rather than a second plain white highlight.
    ctx.fillStyle = hex(sk.traits.gills ? pal.aura : 0xffffff, 0.5);
    circle(ctx, ix + ir * 0.42, iy + ir * 0.46, r * 0.14);
    ctx.fill();
  });

  outline(ctx, eye, darken(pal.bodyDark, 0.55), 1, 0.8);
}

function paintBrows(ctx: Ctx, p: Pose, sk: SkinDef): void {
  if (p.expr === "hurt") return;
  const pal = sk.palette;
  const g = eyeGeom();
  const reach = sk.traits.gills ? 0.85 : 1.1;
  ctx.strokeStyle = hex(darken(pal.bodyDark, 0.3), 0.8);
  ctx.lineWidth = sk.traits.gills ? 1.3 : 1.1;
  ctx.lineCap = "round";

  for (const side of [-1, 1] as const) {
    const cx = HEAD_X + side * g.dx;
    const y = g.y - g.r * 1.8;
    const inner = cx - side * g.r * reach;
    const outer = cx + side * g.r * reach;
    ctx.beginPath();
    if (p.expr === "determined") {
      ctx.moveTo(inner, y + 1.6);
      ctx.quadraticCurveTo(cx, y - 0.2, outer, y - 0.3);
    } else if (p.expr === "worried") {
      ctx.moveTo(inner, y - 0.9);
      ctx.quadraticCurveTo(cx, y + 0.5, outer, y + 1.3);
    } else {
      ctx.moveTo(inner, y + 0.5);
      ctx.quadraticCurveTo(cx, y - 0.8, outer, y + 0.3);
    }
    ctx.stroke();
  }
}

function paintEyes(ctx: Ctx, p: Pose, sk: SkinDef): void {
  paintEye(ctx, p, sk, -1);
  paintEye(ctx, p, sk, 1);
  paintBrows(ctx, p, sk);
}

function paintFace(ctx: Ctx, p: Pose, sk: SkinDef): void {
  const pal = sk.palette;
  const nx = HEAD_X;
  const ny = HEAD_Y + HEAD_R * 0.42;
  const nr = 1.4;

  const nose = (): void => {
    ctx.beginPath();
    ctx.moveTo(nx - nr, ny - nr * 0.5);
    ctx.quadraticCurveTo(nx, ny - nr * 1.05, nx + nr, ny - nr * 0.5);
    ctx.quadraticCurveTo(nx + nr * 0.55, ny + nr * 0.95, nx, ny + nr);
    ctx.quadraticCurveTo(nx - nr * 0.55, ny + nr * 0.95, nx - nr, ny - nr * 0.5);
    ctx.closePath();
  };
  ctx.fillStyle = radGrad(ctx, nx - 0.4, ny - 0.6, nr * 1.6, [
    [0, mix(pal.accent, 0x000000, 0.35)],
    [1, darken(pal.bodyDark, 0.72)],
  ]);
  nose();
  ctx.fill();

  ctx.strokeStyle = hex(darken(pal.bodyDark, 0.6), 0.85);
  ctx.lineWidth = 0.95;
  ctx.lineCap = "round";
  const my = ny + nr + 0.5;
  if (p.expr === "worried") {
    ctx.fillStyle = hex(darken(pal.bodyDark, 0.7), 0.9);
    ellipse(ctx, nx, my + 1.2, 1.3, 1.5);
    ctx.fill();
  } else if (p.expr === "hurt") {
    ctx.beginPath();
    ctx.moveTo(nx - 2.6, my + 0.5);
    ctx.lineTo(nx - 1.3, my + 1.5);
    ctx.lineTo(nx, my + 0.5);
    ctx.lineTo(nx + 1.3, my + 1.5);
    ctx.lineTo(nx + 2.6, my + 0.5);
    ctx.stroke();
  } else if (p.expr === "determined") {
    ctx.beginPath();
    ctx.moveTo(nx - 2.2, my);
    ctx.quadraticCurveTo(nx, my + 2, nx + 2.2, my);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(nx - 2.4, my - 0.15);
    ctx.quadraticCurveTo(nx - 1.2, my + 1.3, nx, my);
    ctx.quadraticCurveTo(nx + 1.2, my + 1.3, nx + 2.4, my - 0.15);
    ctx.stroke();
  }

  // Cheek dimples — free volume from a localised shadow, no new geometry.
  if (sk.traits.gills) {
    for (const side of [-1, 1] as const) {
      ao(ctx, HEAD_X + side * HEAD_R * 0.62, HEAD_Y + HEAD_R * 0.35, 1.2, 1.2, 0.15);
    }
  }

  // Whiskers — long and flowing on the dragon, luminous-tipped on the
  // bioluminescent axolotl-cat.
  const dragon = sk.traits.ears === "leaf";
  const glowTip = sk.traits.gills;
  const wl = dragon ? 9.5 : 5;
  ctx.strokeStyle = hex(0xffffff, dragon ? 0.55 : glowTip ? 0.45 : 0.3);
  ctx.lineWidth = dragon ? 0.9 : 0.7;
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 2; i++) {
      const y0 = ny + 0.3 + i * 1.6;
      const x0 = HEAD_X + side * (HEAD_R * 0.5);
      const tipX = x0 + side * wl;
      const tipY = y0 + (dragon ? 2 + i * 1.6 : i * 1.3 - 0.5);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + side * wl * 0.6, y0 - 1.1 + i * 1.3, tipX, tipY);
      ctx.stroke();
      if (glowTip) {
        glow(ctx, pal.aura, 1.6, 2, () => {
          ctx.fillStyle = hex(lighten(pal.aura, 0.3), 0.7);
          circle(ctx, tipX, tipY, 0.5);
          ctx.fill();
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Masks                                                               */
/* ------------------------------------------------------------------ */

type MaskStyle = "cloth" | "fox" | "demon";

function maskStyle(id: string): MaskStyle {
  if (id === "shinobi") return "cloth";
  if (id === "oni" || id === "hannya") return "demon";
  return "fox";
}

/**
 * Cloth wrap covering the whole lower face, knotted at the side — the
 * shinobi look. Eyes stay visible through the gap at the top.
 */
function paintClothMask(ctx: Ctx, p: Pose, sk: SkinDef): void {
  const pal = sk.palette;
  const cloth = darken(pal.bodyDark, 0.25);

  clipped(ctx, () => headPath(ctx, HEAD_X, HEAD_Y, -0.1), () => {
    const shape = (): void => {
      ctx.beginPath();
      ctx.moveTo(HEAD_X - HEAD_R * 1.05, HEAD_Y - HEAD_R * 0.05);
      ctx.quadraticCurveTo(HEAD_X, HEAD_Y + HEAD_R * 0.28, HEAD_X + HEAD_R * 1.05, HEAD_Y - HEAD_R * 0.05);
      ctx.lineTo(HEAD_X + HEAD_R * 1.05, HEAD_Y + HEAD_R * 1.15);
      ctx.lineTo(HEAD_X - HEAD_R * 1.05, HEAD_Y + HEAD_R * 1.15);
      ctx.closePath();
    };
    ctx.fillStyle = linGrad(ctx, HEAD_X, HEAD_Y, HEAD_X, HEAD_Y + HEAD_R, [
      [0, lighten(cloth, 0.18)],
      [0.5, cloth],
      [1, darken(cloth, 0.4)],
    ]);
    shape();
    ctx.fill();

    ctx.strokeStyle = hex(lighten(cloth, 0.35), 0.6);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(HEAD_X - HEAD_R, HEAD_Y - HEAD_R * 0.02);
    ctx.quadraticCurveTo(HEAD_X, HEAD_Y + HEAD_R * 0.3, HEAD_X + HEAD_R, HEAD_Y - HEAD_R * 0.02);
    ctx.stroke();

    ctx.strokeStyle = hex(darken(cloth, 0.5), 0.5);
    ctx.lineWidth = 0.7;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(HEAD_X + i * 2.6, HEAD_Y + HEAD_R * 0.4);
      ctx.quadraticCurveTo(HEAD_X + i * 3.2, HEAD_Y + HEAD_R * 0.68, HEAD_X + i * 2.3, HEAD_Y + HEAD_R * 0.92);
      ctx.stroke();
    }
  });

  ctx.fillStyle = hex(pal.accent, 1);
  circle(ctx, HEAD_X + HEAD_R * 0.9, HEAD_Y + HEAD_R * 0.3, 1.7);
  ctx.fill();
  ctx.strokeStyle = hex(pal.accent, 0.9);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(HEAD_X + HEAD_R * 0.92, HEAD_Y + HEAD_R * 0.32);
  ctx.quadraticCurveTo(HEAD_X + HEAD_R * 1.5, HEAD_Y + HEAD_R * 0.5, HEAD_X + HEAD_R * 1.35, HEAD_Y + HEAD_R * 0.95);
  ctx.stroke();

  paintEyes(ctx, p, sk);
}

/**
 * Full kitsune/oni mask plate worn over the whole face — graphic black
 * markings on a pale plate, cut with eye holes so the underlying eyes still
 * read through. Matches the iconographic look of the reference art rather
 * than the old tonal upper-face plate.
 */
function paintFaceMask(ctx: Ctx, p: Pose, sk: SkinDef): void {
  const pal = sk.palette;
  const style = maskStyle(sk.id);
  const plate = mix(pal.belly, 0xfffaf0, style === "fox" ? 0.75 : 0.35);
  const shape = (): void => headPath(ctx, HEAD_X, HEAD_Y, 0.35);
  const g = eyeGeom();

  outline(ctx, shape, INK, 2, 0.9);
  ctx.fillStyle = radGrad(ctx, HEAD_X - 2, HEAD_Y - HEAD_R * 0.3, HEAD_R * 1.9, [
    [0, lighten(plate, 0.25)],
    [0.55, plate],
    [1, darken(plate, 0.3)],
  ]);
  shape();
  ctx.fill();

  clipped(ctx, shape, () => {
    // Eye holes — cut back to nothing so the real eyes underneath show.
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    for (const side of [-1, 1] as const) {
      const cx = HEAD_X + side * g.dx;
      ctx.fillStyle = hex(0x000000, 0.92);
      ellipse(ctx, cx, g.y, g.r * 1.35, g.r * 1.55);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = hex(darken(INK, -0.2), 0.95);
    ctx.lineCap = "round";

    if (style === "fox") {
      // Bold triangular markings around each eye — the graphic kitsune look.
      ctx.lineWidth = 1.5;
      for (const side of [-1, 1] as const) {
        const cx = HEAD_X + side * g.dx;
        ctx.beginPath();
        ctx.moveTo(cx - side * g.r * 1.7, g.y - g.r * 2.3);
        ctx.lineTo(cx + side * g.r * 0.3, g.y - g.r * 0.5);
        ctx.lineTo(cx - side * g.r * 0.2, g.y + g.r * 1.9);
        ctx.stroke();
      }
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(HEAD_X, HEAD_Y + HEAD_R * 0.24);
      ctx.lineTo(HEAD_X, HEAD_Y + HEAD_R * 0.62);
      ctx.stroke();
      // Forehead accent disc.
      ctx.fillStyle = hex(pal.accent, 0.9);
      circle(ctx, HEAD_X, HEAD_Y - HEAD_R * 0.62, 1.8);
      ctx.fill();
      // Whisker dots.
      ctx.fillStyle = hex(darken(plate, 0.55), 0.8);
      for (const side of [-1, 1] as const) {
        for (let i = 0; i < 3; i++) {
          circle(ctx, HEAD_X + side * (g.r * 2 + i * 1.6), HEAD_Y + HEAD_R * 0.55 + i * 0.4, 0.5);
          ctx.fill();
        }
      }
    } else {
      // Demon: heavy angry brows + cheek war-paint slashes.
      ctx.lineWidth = 2;
      for (const side of [-1, 1] as const) {
        const cx = HEAD_X + side * g.dx;
        ctx.beginPath();
        ctx.moveTo(cx - side * g.r * 1.4, g.y - g.r * 1.05);
        ctx.lineTo(cx + side * g.r * 1.45, g.y - g.r * 2.1);
        ctx.stroke();
      }
      ctx.strokeStyle = hex(darken(pal.accent, 0.25), 0.75);
      ctx.lineWidth = 1;
      for (const side of [-1, 1] as const) {
        const cx = HEAD_X + side * (HEAD_R * 0.7);
        ctx.beginPath();
        ctx.moveTo(cx, HEAD_Y - HEAD_R * 0.45);
        ctx.lineTo(cx - side * 1.2, HEAD_Y + HEAD_R * 0.1);
        ctx.stroke();
      }
      ctx.strokeStyle = hex(darken(INK, -0.2), 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(HEAD_X - 1.6, HEAD_Y + HEAD_R * 0.62);
      ctx.lineTo(HEAD_X + 1.6, HEAD_Y + HEAD_R * 0.62);
      ctx.stroke();
    }

    keyLight(ctx, HEAD_X - HEAD_R, HEAD_Y - HEAD_R * 1.1, HEAD_R * 2, HEAD_R * 2, 0.28);
    ao(ctx, HEAD_X, HEAD_Y + HEAD_R * 0.5, HEAD_R, HEAD_R * 0.7, 0.25);
  });

  rimLight(ctx, shape, lighten(pal.accent, 0.4), 1, 0.5);

  // Re-paint the eyes on top so they sit inside the cut-outs, then the mask's
  // own thin outline around each hole finishes the read.
  paintEyes(ctx, p, sk);
  for (const side of [-1, 1] as const) {
    const cx = HEAD_X + side * g.dx;
    ctx.strokeStyle = hex(INK, 0.5);
    ctx.lineWidth = 0.8;
    ellipse(ctx, cx, g.y, g.r * 1.35, g.r * 1.55);
    ctx.stroke();
  }
}

/* ------------------------------------------------------------------ */
/* Spirit dressing                                                     */
/* ------------------------------------------------------------------ */

function paintHalo(ctx: Ctx, sk: SkinDef): void {
  const pal = sk.palette;
  const cx = HEAD_X;
  const cy = HEAD_Y - 1.5;
  const r = HEAD_R + 3.4;

  ctx.fillStyle = radGrad(ctx, cx, cy, r * 1.15, [
    [0, pal.aura, 0],
    [0.7, pal.aura, 0.1],
    [0.9, pal.aura, 0.3],
    [1, pal.aura, 0],
  ]);
  circle(ctx, cx, cy, r * 1.15);
  ctx.fill();

  glow(ctx, pal.aura, 6, 3, () => {
    ctx.strokeStyle = hex(lighten(pal.aura, 0.35), 0.9);
    ctx.lineWidth = 1.4;
    circle(ctx, cx, cy, r);
    ctx.stroke();
  });
}

function soulFlame(ctx: Ctx, cx: number, cy: number, r: number, color: number): void {
  const draw = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.quadraticCurveTo(cx - r * 0.95, cy - r * 1.5, cx - r * 0.15, cy - r * 2.7);
    ctx.quadraticCurveTo(cx + r * 0.55, cy - r * 1.4, cx + r, cy);
    ctx.quadraticCurveTo(cx + r * 1.05, cy + r * 1.3, cx, cy + r * 1.3);
    ctx.quadraticCurveTo(cx - r * 1.05, cy + r * 1.3, cx - r, cy);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = radGrad(ctx, cx, cy, r * 1.7, [
    [0, 0xffffff, 0.95],
    [0.34, lighten(color, 0.45), 0.9],
    [0.75, color, 0.6],
    [1, color, 0.1],
  ]);
  glow(ctx, color, 5, 3, draw);
}

function paintFlames(ctx: Ctx, sk: SkinDef, frame: number): void {
  const pal = sk.palette;
  const spots: Array<[number, number, number]> = [
    [7.5, 15, 2.7],
    [40.5, 24, 2.3],
    [37, 45, 1.9],
  ];
  spots.forEach(([x, y, r], i) => {
    const ox = Math.sin((frame + i * 2) * 1.7) * 1.2;
    const oy = Math.cos((frame + i * 3) * 1.3) * 1.4;
    soulFlame(ctx, x + ox, y + oy, r, pal.aura);
  });
}

function star4(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.16, cy - r * 0.16, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * 0.16, cy + r * 0.16, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.16, cy + r * 0.16, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * 0.16, cy - r * 0.16, cx, cy - r);
  ctx.closePath();
}

function paintStars(ctx: Ctx, sk: SkinDef): void {
  const c = lighten(sk.palette.accent, 0.35);
  const spots: Array<[number, number, number]> = [
    [10, 5, 2.6],
    [37, 4, 2.1],
    [26, 1, 1.7],
  ];
  for (const [x, y, r] of spots) {
    glow(ctx, c, 4.5, 2, () => {
      ctx.fillStyle = hex(lighten(c, 0.5), 0.95);
      star4(ctx, x, y, r);
      ctx.fill();
    });
  }
}

/** Ghost skins have no legs: the torso frays into smoke below the hip. */
function dissolve(ctx: Ctx, sk: SkinDef, w: number, h: number, seed: number): void {
  const pal = sk.palette;
  const top = HIP_Y + 2;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "destination-out";
  const g = ctx.createLinearGradient(0, top, 0, h - 1);
  g.addColorStop(0, hex(0x000000, 0));
  g.addColorStop(0.5, hex(0x000000, 0.5));
  g.addColorStop(1, hex(0x000000, 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, h - top);
  ctx.restore();

  const rand = rng(seed ^ 0x77);
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const x0 = HEAD_X + (rand() - 0.5) * 12;
    const y0 = top + 2 + rand() * 4;
    const len = 5 + rand() * 7;
    const curl = (rand() - 0.5) * 8;
    ctx.strokeStyle = hex(mix(pal.body, pal.aura, 0.5), 0.22 + rand() * 0.18);
    ctx.lineWidth = 1.4 + rand();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + curl, y0 + len * 0.6, x0 + curl * 1.6, y0 + len);
    ctx.stroke();
  }
  ctx.restore();
}

/** Yūrei's forehead triangle — the hitaikakushi worn by the restless dead. */
function paintHitaikakushi(ctx: Ctx): void {
  const cx = HEAD_X;
  const cy = HEAD_Y - HEAD_R * 0.6;
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - 3.4, cy + 2.1);
    ctx.lineTo(cx, cy - 2.9);
    ctx.lineTo(cx + 3.4, cy + 2.1);
    ctx.closePath();
  };
  outline(ctx, shape, INK, 1.3, 0.7);
  ctx.fillStyle = linGrad(ctx, cx, cy - 2.9, cx, cy + 2.1, [
    [0, 0xffffff],
    [1, 0xc8d8e4],
  ]);
  shape();
  ctx.fill();
  ctx.strokeStyle = hex(0x6f678e, 0.6);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx - 3.4, cy + 2.1);
  ctx.lineTo(cx + 3.4, cy + 2.1);
  ctx.stroke();
}

/* ------------------------------------------------------------------ */
/* Public painter                                                      */
/* ------------------------------------------------------------------ */

export function paintCharacter(ctx: Ctx, w: number, h: number, skin: SkinDef, frame: number): void {
  const p = POSES[frame] ?? POSES[CHAR_FRAME.idle];
  const t = skin.traits;
  const pal = skin.palette;
  const seed = seedOf(skin.id) ^ (frame * 0x9e37);

  const shX = HEAD_X + p.torsoLean * 0.4;
  const hipX = HEAD_X;

  if (t.flames && !t.ghost) aura(ctx, w / 2, h * 0.58, 20, pal.aura, seed, 8);
  if (!t.ghost) contactShadow(ctx, w / 2, 55, 10, 2.2, 0.4);

  ctx.save();
  if (p.tilt !== 0) {
    ctx.translate(24, 48);
    ctx.rotate(p.tilt);
    ctx.translate(-24, -48);
  }
  if (t.ghost) ctx.globalAlpha = 0.78;

  paintScarf(ctx, p, skin, shX, seed);
  paintTails(ctx, p, skin, seed, hipX);
  if (t.halo) paintHalo(ctx, skin);
  if (!t.ghost) {
    paintLeg(ctx, p, skin, -1, hipX);
    paintLeg(ctx, p, skin, 1, hipX);
  }
  if (t.gills) paintCylinderTorso(ctx, skin, shX, hipX);
  else paintTorso(ctx, skin, shX, hipX);
  if (!t.ghost) {
    paintArm(ctx, p, skin, -1, shX);
    paintArm(ctx, p, skin, 1, shX);
  }

  if (t.ears === "leaf") paintFins(ctx, p, skin);
  else {
    paintEar(ctx, p, skin, -1, seed);
    paintEar(ctx, p, skin, 1, seed);
  }
  if (t.gills) paintGills(ctx, skin);

  paintHead(ctx, skin);
  paintHeadband(ctx, skin);
  if (t.horns) paintHorns(ctx, skin);

  // Small contact-shadow patches only — HIP_DX+3/ry=6 here used to reach a
  // radius of ~9.9 (max(rx,ry)*1.5), bleeding all the way up past the
  // shoulder and reading as an unexplained dark band across the torso.
  ao(ctx, hipX, HIP_Y + 4, HIP_DX + 1, 3, 0.32);
  ao(ctx, HEAD_X, HEAD_Y + 2, HEAD_R, HEAD_R, 0.28);

  if (t.mask) {
    if (maskStyle(skin.id) === "cloth") paintClothMask(ctx, p, skin);
    else paintFaceMask(ctx, p, skin);
  } else {
    paintFace(ctx, p, skin);
    paintEyes(ctx, p, skin);
  }
  if (t.ghost) paintHitaikakushi(ctx);

  keyLight(ctx, 3, 2, 42, 46, 0.22);

  if (t.ghost) dissolve(ctx, skin, w, h, seed);
  ctx.restore();

  if (t.ghost && t.flames) aura(ctx, w / 2, h * 0.46, 18, pal.aura, seed, 8);
  if (t.flames) paintFlames(ctx, skin, frame);
  if (p.stars) paintStars(ctx, skin);

  // getImageData ignores the supersampling transform, so grain works in device px.
  grain(ctx, ctx.canvas.width, ctx.canvas.height, 0.05, seed);
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

export function charAnim(skinId: string): string {
  return `char_${skinId}_idle`;
}

export function registerCharacters(scene: Scene): void {
  for (const skin of SKINS) {
    const key = charKey(skin.id);
    const frames: DrawFn[] = [
      CHAR_FRAME.idle,
      CHAR_FRAME.idleAlt,
      CHAR_FRAME.rise,
      CHAR_FRAME.fall,
      CHAR_FRAME.hurt,
    ].map((f): DrawFn => (ctx, w, h) => paintCharacter(ctx, w, h, skin, f));

    defineSheet(scene, key, CHAR_W, CHAR_H, frames);

    const anim = charAnim(skin.id);
    if (!scene.anims.exists(anim)) {
      scene.anims.create({
        key: anim,
        frames: scene.anims.generateFrameNumbers(key, {
          frames: [CHAR_FRAME.idle, CHAR_FRAME.idleAlt],
        }),
        frameRate: 3,
        repeat: -1,
      });
    }
  }
}
