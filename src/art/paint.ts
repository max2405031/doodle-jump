/**
 * Painting toolkit for high-fidelity procedural art on a 2D canvas.
 *
 * Everything the game renders is authored here rather than shipped as image
 * files: it keeps the bundle tiny, stays 100% original (no licensing), and lets
 * every sprite be recoloured/reshaped from data. The helpers below are the
 * vocabulary the art modules paint with — gradients, glows, rim light, grain,
 * organic silhouettes.
 */

export type Ctx = CanvasRenderingContext2D;

/** RGBA string from a 0xRRGGBB int. */
export function hex(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function lighten(color: number, amount: number): number {
  return mix(color, 0xffffff, amount);
}

export function darken(color: number, amount: number): number {
  return mix(color, 0x000000, amount);
}

/** Rotate hue / tweak saturation-value, for deriving skin variants from a base. */
export function shift(color: number, hueDeg: number, satMul = 1, valMul = 1): number {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + hueDeg + 360) % 360;
  const s = Math.min(1, (max === 0 ? 0 : d / max) * satMul);
  const v = Math.min(1, max * valMul);

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rr = 0;
  let gg = 0;
  let bb = 0;
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];

  return (
    (Math.round((rr + m) * 255) << 16) |
    (Math.round((gg + m) * 255) << 8) |
    Math.round((bb + m) * 255)
  );
}

/** Deterministic RNG — art must be identical on every load, no reload flicker. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Stop = [number, number, number?]; // [offset, color, alpha?]

export function linGrad(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: Stop[]
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c, a]) => g.addColorStop(o, hex(c, a ?? 1)));
  return g;
}

export function radGrad(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  stops: Stop[],
  fx?: number,
  fy?: number
): CanvasGradient {
  const g = ctx.createRadialGradient(fx ?? cx, fy ?? cy, 0, cx, cy, r);
  stops.forEach(([o, c, a]) => g.addColorStop(o, hex(c, a ?? 1)));
  return g;
}

/** Run `fn` with a drop shadow applied, then restore. */
export function withShadow(
  ctx: Ctx,
  color: number,
  blur: number,
  offsetX: number,
  offsetY: number,
  alpha: number,
  fn: () => void
): void {
  ctx.save();
  ctx.shadowColor = hex(color, alpha);
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = offsetX;
  ctx.shadowOffsetY = offsetY;
  fn();
  ctx.restore();
}

/**
 * Emissive glow: repaint the same shape several times with a coloured shadow so
 * light bleeds outward. This is what sells "cursed glowing eyes" and power-ups.
 */
export function glow(ctx: Ctx, color: number, radius: number, passes: number, fn: () => void): void {
  ctx.save();
  ctx.shadowColor = hex(color, 1);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  for (let i = 0; i < passes; i++) {
    ctx.shadowBlur = radius * (1 + i * 0.6);
    fn();
  }
  ctx.restore();
}

/** Clip subsequent painting to a shape — used for shading inside a silhouette. */
export function clipped(ctx: Ctx, shape: () => void, fn: () => void): void {
  ctx.save();
  ctx.beginPath();
  shape();
  ctx.clip();
  fn();
  ctx.restore();
}

/**
 * Film-grain / material noise. Only perturbs pixels that already have alpha, so
 * it textures the sprite without spraying dots over the transparent background.
 */
export function grain(ctx: Ctx, _w: number, _h: number, amount: number, seed = 7): void {
  // getImageData works in device pixels and ignores the active transform, so it
  // must be given the real canvas size — passing the logical w/h would only
  // grain the top-left 1/SS² of a supersampled sprite.
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  if (cw === 0 || ch === 0) return;

  const img = ctx.getImageData(0, 0, cw, ch);
  const d = img.data;
  const rand = rng(seed);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const n = (rand() - 0.5) * amount * 255;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

/** Rounded-rect path (no fill/stroke — caller decides). */
export function roundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/**
 * Organic closed silhouette — a wobbled ellipse. Straight ellipses read as
 * "programmer art"; irregular edges read as drawn.
 */
export function blob(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  wobble = 0.08,
  seed = 1,
  points = 18
): void {
  const rand = rng(seed);
  const offsets: number[] = [];
  for (let i = 0; i < points; i++) offsets.push(1 + (rand() - 0.5) * wobble * 2);

  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const idx = i % points;
    const next = (i + 1) % points;
    const a = (i / points) * Math.PI * 2;
    const aNext = ((i + 1) / points) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx * offsets[idx];
    const y = cy + Math.sin(a) * ry * offsets[idx];
    const xNext = cx + Math.cos(aNext) * rx * offsets[next];
    const yNext = cy + Math.sin(aNext) * ry * offsets[next];
    if (i === 0) ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x, y, (x + xNext) / 2, (y + yNext) / 2);
  }
  ctx.closePath();
}

/** Jagged fang row. `dir` = 1 points down, -1 points up. */
export function fangs(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  count: number,
  len: number,
  dir: 1 | -1,
  jitter = 0.35,
  seed = 3
): void {
  const rand = rng(seed);
  const step = w / count;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const x0 = x + i * step;
    const l = len * (1 - jitter / 2 + rand() * jitter);
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + step / 2, y + l * dir);
    ctx.lineTo(x0 + step, y);
    ctx.closePath();
  }
}

/** Ellipse path helper. */
export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  ctx.closePath();
}

export function circle(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

/**
 * A menacing eye: emissive iris, dark slit pupil, wet specular highlight.
 * The single strongest "this monster is alive and hates you" signal.
 */
export function evilEye(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  color: number,
  opts: { slit?: boolean; glowRadius?: number; look?: number } = {}
): void {
  const { slit = true, glowRadius = r * 2.2, look = 0 } = opts;

  glow(ctx, color, glowRadius, 3, () => {
    ctx.fillStyle = hex(color, 0.9);
    circle(ctx, cx, cy, r);
    ctx.fill();
  });

  ctx.fillStyle = radGrad(ctx, cx, cy, r, [
    [0, lighten(color, 0.75), 1],
    [0.45, color, 1],
    [1, darken(color, 0.5), 1],
  ]);
  circle(ctx, cx, cy, r);
  ctx.fill();

  ctx.fillStyle = hex(0x05010a, 0.95);
  if (slit) {
    ellipse(ctx, cx + look * r * 0.3, cy, r * 0.3, r * 0.82);
  } else {
    circle(ctx, cx + look * r * 0.3, cy, r * 0.45);
  }
  ctx.fill();

  ctx.fillStyle = hex(0xffffff, 0.9);
  circle(ctx, cx - r * 0.32, cy - r * 0.35, r * 0.22);
  ctx.fill();
}

/**
 * Ambient occlusion: darken the lower/inner edge of a shape so it has volume
 * instead of reading as a flat sticker.
 */
export function ao(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, strength = 0.4): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = radGrad(
    ctx,
    cx,
    cy - ry * 0.35,
    Math.max(rx, ry) * 1.5,
    [
      [0, 0x000000, 0],
      [0.55, 0x000000, 0],
      [1, 0x000000, strength],
    ]
  );
  ctx.fillRect(cx - rx * 2, cy - ry * 2, rx * 4, ry * 4);
  ctx.restore();
}

/** Top-left key light across whatever is already painted. */
export function keyLight(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  strength = 0.28
): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = linGrad(ctx, x, y, x + w * 0.6, y + h, [
    [0, 0xffffff, strength],
    [0.5, 0xffffff, strength * 0.15],
    [1, 0xffffff, 0],
  ]);
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Coloured rim along one edge — separates a sprite from a dark background. */
export function rimLight(
  ctx: Ctx,
  shape: () => void,
  color: number,
  width: number,
  alpha = 0.75
): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.strokeStyle = hex(color, alpha);
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  shape();
  ctx.stroke();
  ctx.restore();
}

/** Dark contour so sprites stay legible against busy parallax backgrounds. */
export function outline(
  ctx: Ctx,
  shape: () => void,
  color = 0x0a0612,
  width = 3,
  alpha = 0.9
): void {
  ctx.save();
  ctx.strokeStyle = hex(color, alpha);
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  shape();
  ctx.stroke();
  ctx.restore();
}

/** Soft ground/contact shadow under a standing sprite. */
export function contactShadow(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha = 0.35
): void {
  ctx.save();
  ctx.fillStyle = radGrad(ctx, cx, cy, Math.max(rx, ry), [
    [0, 0x000000, alpha],
    [0.6, 0x000000, alpha * 0.45],
    [1, 0x000000, 0],
  ]);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.translate(-cx, -cy);
  circle(ctx, cx, cy, rx);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/**
 * Tapered calligraphic stroke: a ribbon whose width swells at the middle and
 * thins at both ends, wobbled along its length, instead of a constant-width
 * line. This is what separates a "brush" mark from a vector outline — used
 * for the title wordmark, ink swirls and bamboo-frame edges.
 */
export function brushStroke(
  ctx: Ctx,
  pts: Array<[number, number]>,
  width: number,
  seed = 1,
  jitter = 0.18
): void {
  if (pts.length < 2) return;
  const rand = rng(seed);
  const samples = Math.max(pts.length * 8, 24);

  // Catmull-Rom through the control points so the ribbon follows a smooth
  // curve rather than a polyline, then offset perpendicular to the tangent.
  const at = (t: number): [number, number] => {
    const n = pts.length - 1;
    const seg = Math.min(Math.floor(t * n), n - 1);
    const localT = t * n - seg;
    const p0 = pts[Math.max(0, seg - 1)];
    const p1 = pts[seg];
    const p2 = pts[Math.min(n, seg + 1)];
    const p3 = pts[Math.min(n, seg + 2)];
    const t2 = localT * localT;
    const t3 = t2 * localT;
    const x =
      0.5 *
      (2 * p1[0] +
        (-p0[0] + p2[0]) * localT +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
    const y =
      0.5 *
      (2 * p1[1] +
        (-p0[1] + p2[1]) * localT +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
    return [x, y];
  };

  const centreline: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) centreline.push(at(i / samples));

  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    // Thin at the ends, thickest a little past the middle — a brush lifting
    // off the page reads narrower at the tail than at the entry stroke.
    const taper = Math.sin(Math.PI * Math.pow(t, 0.85)) ** 0.7;
    const w = Math.max(0.4, width * taper * (0.82 + rand() * jitter));

    const [cx, cy] = centreline[i];
    const [px, py] = centreline[Math.max(0, i - 1)];
    const [nx, ny] = centreline[Math.min(samples, i + 1)];
    let dx = nx - px;
    let dy = ny - py;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const ox = -dy * w * 0.5;
    const oy = dx * w * 0.5;
    left.push([cx + ox, cy + oy]);
    right.push([cx - ox, cy - oy]);
  }

  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const [x, y] of left.slice(1)) ctx.lineTo(x, y);
  for (const [x, y] of right.slice().reverse()) ctx.lineTo(x, y);
  ctx.closePath();
}

/** One L-shaped corner bracket with a small hooked flourish at its tip. */
export function cornerBracket(
  ctx: Ctx,
  cx: number,
  cy: number,
  size: number,
  rotation: number,
  width = 2.5,
  hook = 0.28
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(0, 0);
  ctx.lineTo(0, size);
  // Small curl at the vertical arm's tip, like a seal-frame flourish.
  ctx.quadraticCurveTo(0, size + size * hook, size * hook, size + size * hook * 0.6);
  ctx.stroke();
  ctx.restore();
}

/**
 * Four corner brackets around a rect — a hollow cartouche frame instead of a
 * filled panel, for HUD readouts (score) that need the backdrop to show
 * through the middle.
 */
export function cornerBracketFrame(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
  width = 2.5,
  hook = 0.28
): void {
  cornerBracket(ctx, x, y, size, 0, width, hook);
  cornerBracket(ctx, x + w, y, size, Math.PI / 2, width, hook);
  cornerBracket(ctx, x + w, y + h, size, Math.PI, width, hook);
  cornerBracket(ctx, x, y + h, size, -Math.PI / 2, width, hook);
}

/** Wispy smoke/aura tendrils — the ghostly dread layer around a monster. */
export function aura(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  color: number,
  seed = 5,
  wisps = 7
): void {
  const rand = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // A base halo that is fully transparent by `r`. Additive wisps alone used to
  // pile up to full opacity and left every monster sitting on a solid colour
  // rectangle, because none of them reached zero before the sprite edge.
  ctx.fillStyle = radGrad(ctx, cx, cy, r, [
    [0, color, 0.12],
    [0.45, color, 0.06],
    [1, color, 0],
  ]);
  circle(ctx, cx, cy, r);
  ctx.fill();

  for (let i = 0; i < wisps; i++) {
    const a = (i / wisps) * Math.PI * 2 + rand() * 0.6;
    const dist = r * (0.3 + rand() * 0.25);
    const len = r * (0.22 + rand() * 0.28);
    const x = cx + Math.cos(a) * dist;
    const y = cy + Math.sin(a) * dist;
    ctx.fillStyle = radGrad(ctx, x, y, len, [
      [0, color, 0.07],
      [1, color, 0],
    ]);
    circle(ctx, x, y, len);
    ctx.fill();
  }
  ctx.restore();
}
