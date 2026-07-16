import { Scene } from "phaser";
import type { Ctx } from "./paint";

/**
 * Two-stage supersampling.
 *
 * Art is painted at SS_PAINT× the logical size (room for soft glows, thin
 * highlights, real curves), then box-filtered down to SS_STORE× on the CPU with
 * high-quality smoothing. The GPU only ever has a 2× downscale left to do,
 * which plain bilinear handles cleanly. Painting straight at 4× and letting the
 * GPU take it to 1× aliases badly — bilinear only samples 2×2 texels.
 */
const SS_PAINT = 4;
const SS_STORE = 2;

/** Kept exported: entity code sizes physics bodies from logical dimensions. */
export const SS = SS_STORE;

const sizes = new Map<string, { w: number; h: number }>();

export type DrawFn = (ctx: Ctx, w: number, h: number) => void;

function paintOffscreen(w: number, h: number, draw: DrawFn): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w * SS_PAINT));
  c.height = Math.max(1, Math.ceil(h * SS_PAINT));
  const ctx = c.getContext("2d") as Ctx;
  ctx.scale(SS_PAINT, SS_PAINT);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  draw(ctx, w, h);
  return c;
}

function blitDown(dst: Ctx, src: HTMLCanvasElement, dx: number, dy: number, dw: number, dh: number): void {
  dst.imageSmoothingEnabled = true;
  dst.imageSmoothingQuality = "high";
  dst.drawImage(src, dx, dy, dw, dh);
}

/**
 * Paint one texture. `w`/`h` are logical pixels and the draw callback works in
 * that coordinate space — supersampling is invisible to it.
 */
export function defineTexture(scene: Scene, key: string, w: number, h: number, draw: DrawFn): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);

  const sw = Math.ceil(w * SS_STORE);
  const sh = Math.ceil(h * SS_STORE);
  const tex = scene.textures.createCanvas(key, sw, sh);
  if (!tex) return;

  const hi = paintOffscreen(w, h, draw);
  blitDown(tex.getContext(), hi, 0, 0, sw, sh);
  tex.refresh();

  sizes.set(key, { w, h });
}

/**
 * Paint an animation strip: N frames laid out horizontally on one canvas, each
 * registered as a Phaser frame (0..N-1) so `anims.create` can play it.
 */
export function defineSheet(scene: Scene, key: string, w: number, h: number, frames: DrawFn[]): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);

  const fw = Math.ceil(w * SS_STORE);
  const fh = Math.ceil(h * SS_STORE);
  const tex = scene.textures.createCanvas(key, fw * frames.length, fh);
  if (!tex) return;

  const ctx = tex.getContext();
  frames.forEach((draw, i) => {
    const hi = paintOffscreen(w, h, draw);
    blitDown(ctx, hi, i * fw, 0, fw, fh);
  });

  frames.forEach((_, i) => tex.add(i, 0, i * fw, 0, fw, fh));
  tex.refresh();

  sizes.set(key, { w, h });
}

/**
 * Wide, non-supersampled texture (backdrops, vignettes). Parallax layers are
 * screen-sized already, so the extra memory of supersampling buys nothing.
 */
export function defineFlat(scene: Scene, key: string, w: number, h: number, draw: DrawFn): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);

  const tex = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
  if (!tex) return;

  const ctx = tex.getContext();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  draw(ctx, w, h);
  tex.refresh();

  sizes.set(key, { w, h });
}

export function logicalSize(key: string): { w: number; h: number } {
  return sizes.get(key) ?? { w: 32, h: 32 };
}

/** Add a sprite scaled back down to its authored logical size. */
export function hdSprite(scene: Scene, x: number, y: number, key: string, scale = 1): Phaser.GameObjects.Sprite {
  const { w, h } = logicalSize(key);
  const s = scene.add.sprite(x, y, key);
  s.setDisplaySize(w * scale, h * scale);
  return s;
}

/** Same, as an image (no animation state). */
export function hdImage(scene: Scene, x: number, y: number, key: string, scale = 1): Phaser.GameObjects.Image {
  const { w, h } = logicalSize(key);
  const img = scene.add.image(x, y, key);
  img.setDisplaySize(w * scale, h * scale);
  return img;
}

/** Resize an existing sprite/image to the authored logical size of its texture. */
export function applyLogicalSize(
  obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  key: string,
  scale = 1
): void {
  const { w, h } = logicalSize(key);
  obj.setDisplaySize(w * scale, h * scale);
}
