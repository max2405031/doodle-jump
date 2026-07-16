import { Scene } from "phaser";

import {
  COIN_ANIM,
  COIN_FRAME_COUNT,
  COIN_KEY,
  FX,
  PLATFORM_KEYS,
  PLAT_H,
  PLAT_W,
  POWERUP_KEYS,
  platCrackedKey,
  platKey,
  powerUpKey,
  type PlatformKind,
  type PowerUpKind,
} from "./keys";
import { defineSheet, defineTexture, type DrawFn } from "./registry";
import { PALETTE } from "../config/theme";
import {
  ao,
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
  roundRect,
  type Ctx,
} from "./paint";

/**
 * Platforms, pickups and particles.
 *
 * Platforms carry visible thickness — a lit top face and a shaded front edge —
 * because a flat bar reads as a UI element, not as something you land on.
 */

const INK = 0x08060e;

/** Top face + front edge. Every platform is built on this slab. */
function slab(
  ctx: Ctx,
  w: number,
  h: number,
  top: number,
  body: number,
  bottom: number,
  radius = 7
): { topH: number } {
  const topH = h * 0.38;

  contactShadow(ctx, w / 2, h - 1, w * 0.4, 3, 0.35);

  const shape = (): void => roundRect(ctx, 2, 1, w - 4, h - 3, radius);
  outline(ctx, shape, INK, 2.4, 0.9);

  ctx.fillStyle = linGrad(ctx, 0, 1, 0, h - 2, [
    [0, lighten(top, 0.2)],
    [topH / h, top],
    [(topH + 1) / h, body],
    [0.85, darken(body, 0.25)],
    [1, bottom],
  ]);
  shape();
  ctx.fill();

  clipped(ctx, shape, () => {
    // Lit top face.
    ctx.fillStyle = linGrad(ctx, 0, 0, 0, topH, [
      [0, lighten(top, 0.4), 0.85],
      [1, top, 0],
    ]);
    ctx.fillRect(0, 0, w, topH);
    ao(ctx, w / 2, h, w * 0.6, h * 0.9, 0.4);
  });

  return { topH };
}

/* ============================================================== platforms */

/** Stone slab from a shrine lantern — mossy, chipped, dependable. */
const toro: DrawFn = (ctx, w, h) => {
  const stone = PALETTE.stoneLight;
  slab(ctx, w, h, stone, PALETTE.stone, darken(PALETTE.stone, 0.3));

  const shape = (): void => roundRect(ctx, 2, 1, w - 4, h - 3, 7);
  clipped(ctx, shape, () => {
    const rand = rng(4);
    // Mineral speckle.
    for (let i = 0; i < 34; i++) {
      const x = rand() * w;
      const y = rand() * h;
      ctx.fillStyle = hex(rand() < 0.5 ? lighten(PALETTE.stoneLight, 0.2) : darken(PALETTE.stone, 0.35), 0.35);
      circle(ctx, x, y, 0.5 + rand() * 1.2);
      ctx.fill();
    }
    // Fissures.
    ctx.strokeStyle = hex(darken(PALETTE.stone, 0.45), 0.6);
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 3; i++) {
      let px = 10 + rand() * (w - 20);
      let py = h * 0.4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let j = 0; j < 3; j++) {
        px += (rand() - 0.5) * 12;
        py += 2 + rand() * 3;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Moss — vivid and high-contrast, in broad patches with drips, not a
    // subtle shadow along the edge.
    for (let i = 0; i < 20; i++) {
      const x = rand() * w;
      const y = h * 0.55 + rand() * h * 0.4;
      ctx.fillStyle = hex(mix(PALETTE.moss, PALETTE.mossDeep, rand() * 0.5), 0.75 + rand() * 0.2);
      ellipse(ctx, x, y, 2.4 + rand() * 4.5, 1.6 + rand() * 2.2);
      ctx.fill();
    }
    ctx.strokeStyle = hex(PALETTE.mossDeep, 0.6);
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const x = rand() * w;
      const len = 3 + rand() * 6;
      ctx.beginPath();
      ctx.moveTo(x, h - 5);
      ctx.lineTo(x + (rand() - 0.5) * 2, h - 5 + len);
      ctx.stroke();
    }
    // Worn engraved mark.
    ctx.strokeStyle = hex(darken(PALETTE.stone, 0.5), 0.45);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 6, h * 0.42);
    ctx.lineTo(w / 2 + 6, h * 0.42);
    ctx.moveTo(w / 2, h * 0.34);
    ctx.lineTo(w / 2, h * 0.62);
    ctx.stroke();
  });

  rimLight(ctx, shape, lighten(PALETTE.stoneLight, 0.3), 1.2, 0.35);
  grain(ctx, w, h, 0.07, 1);
};

/**
 * Bound bamboo — two dried tan/khaki culms lashed with rope, open between
 * them rather than a solid painted bar. Green is reserved for a small tuft
 * of leaves at one end; the wood itself never reads as "alive and green".
 */
const bambooPlat: DrawFn = (ctx, w, h) => {
  const tan = PALETTE.bambooTan;
  const tanDeep = PALETTE.bambooTanDeep;
  const poleH = h * 0.4;
  const gap = h * 0.16;
  const poleYs = [h * 0.18, h * 0.18 + poleH + gap];

  contactShadow(ctx, w / 2, h - 1, w * 0.4, 3, 0.3);

  poleYs.forEach((py) => {
    const shape = (): void => roundRect(ctx, 3, py, w - 6, poleH, poleH * 0.42);
    outline(ctx, shape, INK, 2.2, 0.9);
    ctx.fillStyle = linGrad(ctx, 0, py, 0, py + poleH, [
      [0, lighten(tan, 0.32)],
      [0.42, tan],
      [1, darken(tanDeep, 0.2)],
    ]);
    shape();
    ctx.fill();

    clipped(ctx, shape, () => {
      // Node rings perpendicular to the culm's axis.
      const rings = 4;
      for (let i = 1; i < rings; i++) {
        const x = (w / rings) * i;
        ctx.strokeStyle = hex(darken(tanDeep, 0.35), 0.7);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.lineTo(x, py + poleH);
        ctx.stroke();
        ctx.strokeStyle = hex(lighten(tan, 0.3), 0.35);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x + 2, py);
        ctx.lineTo(x + 2, py + poleH);
        ctx.stroke();
      }
      ctx.fillStyle = linGrad(ctx, 0, py, 0, py + poleH * 0.5, [
        [0, 0xfff2cf, 0.4],
        [1, 0xfff2cf, 0],
      ]);
      ctx.fillRect(0, py, w, poleH * 0.5);
      ao(ctx, w / 2, py + poleH, w * 0.5, poleH * 0.7, 0.3);
    });
    rimLight(ctx, shape, 0xffe9b8, 1, 0.35);
  });

  // Rope lashing binding both culms together near each end.
  [w * 0.16, w * 0.84].forEach((x) => {
    const shape = (): void => roundRect(ctx, x - 4, poleYs[0], 8, poleYs[1] + poleH - poleYs[0], 3);
    outline(ctx, shape, INK, 1.6, 0.85);
    ctx.fillStyle = linGrad(ctx, x - 4, 0, x + 4, 0, [
      [0, 0x8a6a34],
      [0.5, 0xc9a45e],
      [1, 0x6b4f24],
    ]);
    shape();
    ctx.fill();
    ctx.strokeStyle = hex(0x5a4220, 0.7);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 4, poleYs[0] + 2 + i * 4);
      ctx.lineTo(x + 4, poleYs[0] + 4 + i * 4);
      ctx.stroke();
    }
  });

  // A rope swag hanging in a V beneath the lower culm.
  ctx.strokeStyle = hex(0x6b4f24, 0.85);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(w * 0.16, poleYs[1] + poleH);
  ctx.quadraticCurveTo(w / 2, poleYs[1] + poleH + h * 0.18, w * 0.84, poleYs[1] + poleH);
  ctx.stroke();

  // A small tuft of leaves at one end — the only green on the whole prop.
  const leafX = w * 0.9;
  const leafY = poleYs[0] + poleH * 0.4;
  for (const [dx, dy, rot] of [
    [0, -6, -0.3],
    [3, -3, 0.15],
    [-2, -5, -0.7],
  ] as const) {
    ctx.save();
    ctx.translate(leafX + dx, leafY + dy);
    ctx.rotate(rot);
    const leaf = (): void => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(2.4, -4, 0, -9);
      ctx.quadraticCurveTo(-2.4, -4, 0, 0);
      ctx.closePath();
    };
    outline(ctx, leaf, INK, 1, 0.8);
    ctx.fillStyle = hex(mix(PALETTE.moss, PALETTE.mossDeep, 0.25), 0.95);
    leaf();
    ctx.fill();
    ctx.restore();
  }

  grain(ctx, w, h, 0.05, 2);
};

/** Spirit cloud — soft, luminous, obviously not solid. */
const kumo: DrawFn = (ctx, w, h) => {
  const rand = rng(12);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 12; i++) {
    const x = 10 + rand() * (w - 20);
    const y = h * 0.3 + rand() * h * 0.4;
    const r = 8 + rand() * 14;
    ctx.fillStyle = radGrad(ctx, x, y, r, [
      [0, 0xdff2ff, 0.5],
      [0.5, 0x9ec8e8, 0.3],
      [1, 0x6f9dc4, 0],
    ]);
    circle(ctx, x, y, r);
    ctx.fill();
  }
  ctx.restore();

  // Luminous core.
  ctx.fillStyle = radGrad(ctx, w / 2, h / 2, w * 0.42, [
    [0, 0xffffff, 0.45],
    [0.4, 0xcfe8ff, 0.22],
    [1, 0x8fb8dd, 0],
  ]);
  ellipse(ctx, w / 2, h / 2, w * 0.44, h * 0.5);
  ctx.fill();

  // Motes drifting inside it.
  for (let i = 0; i < 6; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillStyle = hex(0xffffff, 0.5 + rand() * 0.4);
    circle(ctx, x, y, 0.6 + rand() * 0.9);
    ctx.fill();
  }
};

/** Lotus — the trampoline. It should look like stored energy. */
const lotus: DrawFn = (ctx, w, h) => {
  contactShadow(ctx, w / 2, h - 1, w * 0.34, 3, 0.3);

  const petal = (cx: number, cy: number, rx: number, ry: number, rot: number, c: number): void => {
    const shape = (): void => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.quadraticCurveTo(-rx, ry * 0.1, 0, -ry);
      ctx.quadraticCurveTo(rx, ry * 0.1, 0, ry);
      ctx.closePath();
      ctx.restore();
    };
    outline(ctx, shape, 0x7a2d4a, 1.4, 0.6);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = linGrad(ctx, 0, -ry, 0, ry, [
      [0, lighten(c, 0.45)],
      [0.55, c],
      [1, darken(c, 0.3)],
    ]);
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.quadraticCurveTo(-rx, ry * 0.1, 0, -ry);
    ctx.quadraticCurveTo(rx, ry * 0.1, 0, ry);
    ctx.closePath();
    ctx.fill();
    // Central vein.
    ctx.strokeStyle = hex(darken(c, 0.35), 0.5);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, ry * 0.8);
    ctx.lineTo(0, -ry * 0.8);
    ctx.stroke();
    ctx.restore();
  };

  const cy = h * 0.62;
  // Back row.
  for (let i = 0; i < 7; i++) {
    const x = 10 + (i * (w - 20)) / 6;
    petal(x, cy, 8, 12, (i - 3) * 0.22, 0xe86a9b);
  }
  // Front row.
  for (let i = 0; i < 6; i++) {
    const x = 16 + (i * (w - 32)) / 5;
    petal(x, cy + 2, 9, 10, (i - 2.5) * 0.16, 0xffb0cf);
  }

  // Glowing golden heart — the spring.
  glow(ctx, PALETTE.gold, 12, 3, () => {
    ctx.fillStyle = radGrad(ctx, w / 2, cy - 1, 9, [
      [0, 0xfff6d0],
      [0.5, PALETTE.gold],
      [1, PALETTE.goldDeep],
    ]);
    ellipse(ctx, w / 2, cy - 1, 9, 5.5);
    ctx.fill();
  });
  // Stamens.
  const rand = rng(20);
  ctx.strokeStyle = hex(0xfff0b0, 0.85);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + rand() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(w / 2, cy - 1);
    ctx.lineTo(w / 2 + Math.cos(a) * 7, cy - 1 + Math.sin(a) * 4);
    ctx.stroke();
  }
  grain(ctx, w, h, 0.04, 3);
};

/** Cracked ice — translucent, sharp, about to give way. */
const glace: DrawFn = (ctx, w, h) => {
  contactShadow(ctx, w / 2, h - 1, w * 0.38, 3, 0.28);

  const shape = (): void => roundRect(ctx, 2, 1, w - 4, h - 3, 5);
  outline(ctx, shape, 0x2f5c78, 2, 0.7);

  ctx.fillStyle = linGrad(ctx, 0, 0, w * 0.4, h, [
    [0, 0xe6f8ff, 0.9],
    [0.45, 0x9fd6ef, 0.8],
    [1, 0x4d8fb5, 0.85],
  ]);
  shape();
  ctx.fill();

  clipped(ctx, shape, () => {
    const rand = rng(31);
    // Internal fractures.
    ctx.strokeStyle = hex(0xffffff, 0.6);
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      let px = rand() * w;
      let py = rand() * h;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let j = 0; j < 3; j++) {
        px += (rand() - 0.5) * 22;
        py += (rand() - 0.5) * 12;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Trapped bubbles.
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = hex(0xffffff, 0.4);
      circle(ctx, rand() * w, rand() * h, 0.7 + rand() * 1.4);
      ctx.fill();
    }
    // Specular sweep.
    ctx.fillStyle = linGrad(ctx, 0, 0, w, h, [
      [0, 0xffffff, 0],
      [0.35, 0xffffff, 0.55],
      [0.45, 0xffffff, 0],
      [1, 0xffffff, 0],
    ]);
    ctx.fillRect(0, 0, w, h);
    keyLight(ctx, 0, 0, w, h, 0.3);
  });

  // Frost along the rim.
  const fr = rng(77);
  ctx.strokeStyle = hex(0xffffff, 0.7);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 14; i++) {
    const x = 4 + fr() * (w - 8);
    const up = fr() < 0.5;
    const y = up ? 2 : h - 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (fr() - 0.5) * 3, y + (up ? 3 : -3));
    ctx.stroke();
  }
  rimLight(ctx, shape, 0xffffff, 1.2, 0.5);
};

/** Cursed plank — rotten, sealed with failing talismans, and it hates you. */
const cursed: DrawFn = (ctx, w, h) => {
  const wood = 0x2a2028;
  slab(ctx, w, h, wood, 0x1a1320, 0x0a0610, 4);

  const shape = (): void => roundRect(ctx, 2, 1, w - 4, h - 3, 4);
  clipped(ctx, shape, () => {
    const rand = rng(66);
    // Grain of rotten wood.
    ctx.strokeStyle = hex(0x0d0812, 0.7);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 16; i++) {
      const y = rand() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(w / 2, y + (rand() - 0.5) * 4, w, y + (rand() - 0.5) * 3);
      ctx.stroke();
    }

    // Pulsing violet veins.
    glow(ctx, PALETTE.cursed, 6, 2, () => {
      ctx.strokeStyle = hex(PALETTE.cursedGlow, 0.85);
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 3; i++) {
        let px = 8 + rand() * (w - 16);
        let py = h * 0.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (let j = 0; j < 4; j++) {
          px += (rand() - 0.5) * 16;
          py += (rand() - 0.5) * 7;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    });

    // Faces screaming in the grain — barely there, which is the point.
    for (let i = 0; i < 2; i++) {
      const fx = 18 + i * (w - 40) + rand() * 10;
      const fy = h * 0.5;
      ctx.strokeStyle = hex(0x6a4a7a, 0.5);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(fx - 2.4, fy - 1.5, 1.3, 0, Math.PI * 2);
      ctx.arc(fx + 2.4, fy - 1.5, 1.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(fx, fy + 3, 2.2, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ao(ctx, w / 2, h, w * 0.6, h, 0.5);
  });

  // Ofuda talismans, peeling off.
  [w * 0.28, w * 0.72].forEach((x, i) => {
    ctx.save();
    ctx.translate(x, h * 0.42);
    ctx.rotate(i === 0 ? -0.22 : 0.16);
    ctx.fillStyle = linGrad(ctx, 0, -8, 0, 8, [
      [0, 0xe8e0c8],
      [1, 0xb5a988],
    ]);
    ctx.fillRect(-4.5, -9, 9, 18);
    ctx.strokeStyle = hex(0x8a1f2a, 0.85);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.moveTo(-2.5, -3);
    ctx.lineTo(2.5, -3);
    ctx.moveTo(-2.5, 2);
    ctx.lineTo(2.5, 2);
    ctx.stroke();
    // Torn corner.
    ctx.fillStyle = hex(INK, 0.8);
    ctx.beginPath();
    ctx.moveTo(4.5, 9);
    ctx.lineTo(0, 9);
    ctx.lineTo(4.5, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // Shadow smoke leaking off the underside.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const sr = rng(5);
  for (let i = 0; i < 6; i++) {
    const x = sr() * w;
    ctx.fillStyle = radGrad(ctx, x, h - 1, 8, [
      [0, PALETTE.cursed, 0.2],
      [1, PALETTE.cursed, 0],
    ]);
    circle(ctx, x, h - 1, 8);
    ctx.fill();
  }
  ctx.restore();

  grain(ctx, w, h, 0.09, 9);
};

/** Broken variant — the slab split in two, halves tipping apart. */
function crackedOf(base: DrawFn): DrawFn {
  return (ctx, w, h) => {
    const gap = 5;
    // Left half.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w / 2 - gap / 2, h);
    ctx.clip();
    ctx.translate(-3, 1);
    ctx.rotate(-0.06);
    base(ctx, w, h);
    ctx.restore();

    // Right half.
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2 + gap / 2, 0, w / 2, h);
    ctx.clip();
    ctx.translate(3, 1);
    ctx.rotate(0.06);
    base(ctx, w, h);
    ctx.restore();

    // Shards in the gap.
    const rand = rng(13);
    ctx.fillStyle = hex(0x9a9384, 0.8);
    for (let i = 0; i < 5; i++) {
      const x = w / 2 - 4 + rand() * 8;
      const y = 2 + rand() * (h - 6);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2 + rand() * 2, y + 1);
      ctx.lineTo(x + 1, y + 3 + rand() * 2);
      ctx.closePath();
      ctx.fill();
    }
  };
}

const PLATFORM_PAINTERS: Record<PlatformKind, DrawFn> = {
  toro,
  bamboo: bambooPlat,
  kumo,
  lotus,
  glace,
  cursed,
};

/* =============================================================== power-ups */

const PU_W = 30;
const PU_H = 36;

/** Halo every power-up sits in, so it magnetises the eye in a dark scene. */
function pickupHalo(ctx: Ctx, w: number, h: number, color: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = radGrad(ctx, w / 2, h / 2, w * 0.62, [
    [0, color, 0.42],
    [0.45, color, 0.18],
    [1, color, 0],
  ]);
  circle(ctx, w / 2, h / 2, w * 0.62);
  ctx.fill();
  ctx.restore();
}

const katana: DrawFn = (ctx, w, h) => {
  pickupHalo(ctx, w, h, PALETTE.spirit);
  const cx = w / 2;

  // Curved blade.
  const blade = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - 2.6, h - 12);
    ctx.quadraticCurveTo(cx - 4.2, h * 0.4, cx - 1.6, 3);
    ctx.lineTo(cx + 1.6, 2);
    ctx.quadraticCurveTo(cx + 1.4, h * 0.42, cx + 2.6, h - 12);
    ctx.closePath();
  };
  outline(ctx, blade, INK, 1.4, 0.8);
  ctx.fillStyle = linGrad(ctx, cx - 3, 0, cx + 3, 0, [
    [0, 0x8fa5b8],
    [0.35, 0xf2f7fb],
    [0.6, 0xd6e3ee],
    [1, 0x6d8496],
  ]);
  blade();
  ctx.fill();

  // Hamon — the temper line, wavy, the mark of a real blade.
  ctx.save();
  ctx.beginPath();
  blade();
  ctx.clip();
  ctx.strokeStyle = hex(0xffffff, 0.75);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 1.6, h - 12);
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const y = h - 12 - t * (h - 15);
    ctx.quadraticCurveTo(cx + (i % 2 ? 0.2 : 2.4), y - 2, cx + 1.4, y - 4);
  }
  ctx.stroke();
  ctx.restore();

  glow(ctx, PALETTE.spirit, 8, 2, () => {
    ctx.strokeStyle = hex(0xdff6ff, 0.9);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + 1.4, 3);
    ctx.quadraticCurveTo(cx + 1.6, h * 0.5, cx + 2.4, h - 13);
    ctx.stroke();
  });

  // Tsuba.
  ctx.fillStyle = radGrad(ctx, cx, h - 12, 8, [
    [0, PALETTE.goldGlow],
    [0.6, PALETTE.gold],
    [1, PALETTE.goldDeep],
  ]);
  ellipse(ctx, cx, h - 12, 7.5, 2.6);
  ctx.fill();
  outline(ctx, () => ellipse(ctx, cx, h - 12, 7.5, 2.6), INK, 1.1, 0.8);

  // Wrapped grip.
  ctx.fillStyle = linGrad(ctx, cx - 3, 0, cx + 3, 0, [
    [0, 0x2a1a12],
    [0.5, 0x4a2f1e],
    [1, 0x1c1109],
  ]);
  roundRect(ctx, cx - 3, h - 11, 6, 10, 1.6);
  ctx.fill();
  ctx.strokeStyle = hex(0xd8c9a8, 0.6);
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 3, h - 10 + i * 2.4);
    ctx.lineTo(cx + 3, h - 9 + i * 2.4);
    ctx.stroke();
  }
};

const daruma: DrawFn = (ctx, w, h) => {
  pickupHalo(ctx, w, h, PALETTE.ember);
  const cx = w / 2;
  const cy = h * 0.55;

  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy + 11);
    ctx.quadraticCurveTo(cx - 13, cy - 6, cx - 6, cy - 11);
    ctx.quadraticCurveTo(cx, cy - 14, cx + 6, cy - 11);
    ctx.quadraticCurveTo(cx + 13, cy - 6, cx + 11, cy + 11);
    ctx.quadraticCurveTo(cx, cy + 15, cx - 11, cy + 11);
    ctx.closePath();
  };
  outline(ctx, body, INK, 2, 0.9);
  ctx.fillStyle = radGrad(ctx, cx - 4, cy - 5, 16, [
    [0, 0xf2543c],
    [0.55, 0xc42a1c],
    [1, 0x6b0f08],
  ]);
  body();
  ctx.fill();
  clipped(ctx, body, () => {
    ao(ctx, cx, cy + 4, 13, 14, 0.45);
    keyLight(ctx, cx - 14, cy - 16, 28, 30, 0.3);
  });

  // Gold trim + brow.
  ctx.strokeStyle = hex(PALETTE.gold, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 9.5, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  // Face patch.
  ctx.fillStyle = hex(0xf5e4c4, 1);
  ellipse(ctx, cx, cy - 3, 7, 6);
  ctx.fill();

  // One eye painted in, one left blank — the wish not yet granted.
  ctx.fillStyle = hex(0x120a08, 1);
  circle(ctx, cx - 3, cy - 4, 2.4);
  ctx.fill();
  ctx.strokeStyle = hex(0x3a2a1a, 0.9);
  ctx.lineWidth = 1;
  circle(ctx, cx + 3, cy - 4, 2.4);
  ctx.stroke();

  // Brows / moustache strokes.
  ctx.strokeStyle = hex(0x2a1a10, 0.8);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 7.5);
  ctx.quadraticCurveTo(cx - 3, cy - 9, cx - 1, cy - 7.5);
  ctx.moveTo(cx + 6, cy - 7.5);
  ctx.quadraticCurveTo(cx + 3, cy - 9, cx + 1, cy - 7.5);
  ctx.stroke();

  rimLight(ctx, body, 0xff9a7a, 1.4, 0.5);
  grain(ctx, w, h, 0.05, 6);
};

const koiNobori: DrawFn = (ctx, w, h) => {
  pickupHalo(ctx, w, h, PALETTE.sakura);
  const cy = h / 2;

  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(4, cy);
    ctx.quadraticCurveTo(8, cy - 9, 18, cy - 7);
    ctx.quadraticCurveTo(24, cy - 5, 22, cy);
    ctx.quadraticCurveTo(24, cy + 5, 18, cy + 7);
    ctx.quadraticCurveTo(8, cy + 9, 4, cy);
    ctx.closePath();
  };
  outline(ctx, body, INK, 1.6, 0.85);
  ctx.fillStyle = linGrad(ctx, 4, cy - 8, 22, cy + 8, [
    [0, 0xffd0e2],
    [0.4, 0xff6fa8],
    [1, 0xc2246a],
  ]);
  body();
  ctx.fill();

  clipped(ctx, body, () => {
    // Iridescent scales.
    const rand = rng(18);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const x = 6 + col * 3.2;
        const y = cy - 5 + row * 3;
        ctx.strokeStyle = hex(mix(0xffffff, PALETTE.gold, rand()), 0.4);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(x, y, 1.8, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
    }
    keyLight(ctx, 0, 0, w, h, 0.25);
  });

  // Eye.
  ctx.fillStyle = hex(0xffffff, 1);
  circle(ctx, 8, cy - 2, 2.4);
  ctx.fill();
  ctx.fillStyle = hex(0x14060e, 1);
  circle(ctx, 7.4, cy - 2, 1.2);
  ctx.fill();

  // Streaming tail fins.
  ctx.fillStyle = linGrad(ctx, 22, cy, w - 1, cy, [
    [0, 0xff6fa8],
    [1, 0xffd0e2, 0.35],
  ]);
  ctx.beginPath();
  ctx.moveTo(21, cy - 5);
  ctx.quadraticCurveTo(w - 2, cy - 11, w - 1, cy - 2);
  ctx.quadraticCurveTo(w - 4, cy, w - 1, cy + 2);
  ctx.quadraticCurveTo(w - 2, cy + 11, 21, cy + 5);
  ctx.closePath();
  ctx.fill();
  rimLight(ctx, body, 0xffd0e2, 1.2, 0.5);
};

const manekiNeko: DrawFn = (ctx, w, h) => {
  pickupHalo(ctx, w, h, PALETTE.gold);
  const cx = w / 2;
  const cy = h * 0.6;

  const body = (): void => roundRect(ctx, cx - 9, cy - 6, 18, 16, 6);
  outline(ctx, body, INK, 1.8, 0.9);
  ctx.fillStyle = linGrad(ctx, cx - 9, cy - 6, cx + 9, cy + 10, [
    [0, PALETTE.goldGlow],
    [0.5, PALETTE.gold],
    [1, PALETTE.goldDeep],
  ]);
  body();
  ctx.fill();

  const head = (): void => circle(ctx, cx, cy - 9, 8.5);
  outline(ctx, head, INK, 1.8, 0.9);
  ctx.fillStyle = radGrad(ctx, cx - 3, cy - 12, 11, [
    [0, 0xfffdf5],
    [0.6, 0xf3e6c8],
    [1, 0xc9ab74],
  ]);
  head();
  ctx.fill();

  // Ears.
  [-1, 1].forEach((d) => {
    ctx.fillStyle = hex(PALETTE.gold, 1);
    ctx.beginPath();
    ctx.moveTo(cx + d * 4, cy - 15);
    ctx.lineTo(cx + d * 8, cy - 20);
    ctx.lineTo(cx + d * 8.5, cy - 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(PALETTE.sakura, 0.7);
    ctx.beginPath();
    ctx.moveTo(cx + d * 5.5, cy - 15);
    ctx.lineTo(cx + d * 7.4, cy - 18);
    ctx.lineTo(cx + d * 7.6, cy - 14);
    ctx.closePath();
    ctx.fill();
  });

  // Face.
  ctx.fillStyle = hex(0x1a1208, 1);
  circle(ctx, cx - 3, cy - 10, 1.4);
  ctx.fill();
  circle(ctx, cx + 3, cy - 10, 1.4);
  ctx.fill();
  ctx.fillStyle = hex(PALETTE.sakura, 1);
  circle(ctx, cx, cy - 7, 1.2);
  ctx.fill();
  ctx.strokeStyle = hex(0x6b5a3a, 0.7);
  ctx.lineWidth = 0.6;
  [-1, 1].forEach((d) => {
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + d * 5, cy - 8 + i * 2);
      ctx.lineTo(cx + d * 11, cy - 10 + i * 3);
      ctx.stroke();
    }
  });

  // Raised beckoning paw.
  ctx.fillStyle = hex(0xfffdf5, 1);
  roundRect(ctx, cx - 15, cy - 12, 6, 10, 3);
  ctx.fill();
  outline(ctx, () => roundRect(ctx, cx - 15, cy - 12, 6, 10, 3), INK, 1.2, 0.8);

  // Collar and bell.
  ctx.fillStyle = hex(PALETTE.blood, 1);
  roundRect(ctx, cx - 8, cy - 3, 16, 3, 1.5);
  ctx.fill();
  glow(ctx, PALETTE.gold, 6, 2, () => {
    ctx.fillStyle = radGrad(ctx, cx, cy, 3.4, [
      [0, 0xfff3c0],
      [1, PALETTE.goldDeep],
    ]);
    circle(ctx, cx, cy, 3.2);
    ctx.fill();
  });
  grain(ctx, w, h, 0.04, 7);
};

const omamori: DrawFn = (ctx, w, h) => {
  pickupHalo(ctx, w, h, PALETTE.jade);
  const cx = w / 2;
  const cy = h * 0.58;

  // Protective bubble — this is the shield, so it must read as a barrier.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = hex(PALETTE.jade, 0.5);
  ctx.lineWidth = 1.2;
  circle(ctx, cx, cy - 2, 13);
  ctx.stroke();
  ctx.fillStyle = radGrad(ctx, cx, cy - 2, 13, [
    [0, PALETTE.jade, 0.05],
    [0.75, PALETTE.jade, 0.12],
    [1, PALETTE.jade, 0],
  ]);
  circle(ctx, cx, cy - 2, 13);
  ctx.fill();
  ctx.restore();

  const pouch = (): void => roundRect(ctx, cx - 7, cy - 8, 14, 18, 2.4);
  outline(ctx, pouch, INK, 1.8, 0.9);
  ctx.fillStyle = linGrad(ctx, cx - 7, cy - 8, cx + 7, cy + 10, [
    [0, 0x6ad6a8],
    [0.5, 0x2f9d72],
    [1, 0x145a41],
  ]);
  pouch();
  ctx.fill();

  clipped(ctx, pouch, () => {
    // Brocade weave.
    ctx.strokeStyle = hex(PALETTE.gold, 0.35);
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 7 + i * 3);
      ctx.lineTo(cx + 7, cy - 8 + i * 3);
      ctx.stroke();
    }
    keyLight(ctx, cx - 8, cy - 10, 16, 22, 0.28);
    ao(ctx, cx, cy + 6, 9, 12, 0.4);
  });

  // Embroidered mark.
  ctx.strokeStyle = hex(PALETTE.goldGlow, 0.95);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 3.5, cy - 2);
  ctx.lineTo(cx + 3.5, cy - 2);
  ctx.moveTo(cx, cy - 5);
  ctx.lineTo(cx, cy + 5);
  ctx.moveTo(cx - 2.5, cy + 4);
  ctx.lineTo(cx + 2.5, cy + 4);
  ctx.stroke();

  // Cord and knot.
  ctx.strokeStyle = hex(PALETTE.goldDeep, 1);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 8);
  ctx.quadraticCurveTo(cx, cy - 16, cx + 5, cy - 8);
  ctx.stroke();
  ctx.fillStyle = hex(PALETTE.gold, 1);
  circle(ctx, cx, cy - 9, 2.2);
  ctx.fill();
  rimLight(ctx, pouch, 0x9df5cc, 1.2, 0.5);
};

const onibi: DrawFn = (ctx, w, h) => {
  const cx = w / 2;
  const cy = h / 2;

  // Outer soul-fire.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = radGrad(ctx, cx, cy, 15, [
    [0, PALETTE.cursedGlow, 0.55],
    [0.4, PALETTE.cursed, 0.3],
    [1, PALETTE.cursed, 0],
  ]);
  circle(ctx, cx, cy, 15);
  ctx.fill();
  ctx.restore();

  // Tongues of flame licking upward.
  const rand = rng(23);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 2.4;
    const len = 7 + rand() * 8;
    const tipX = cx + Math.cos(a) * len;
    const tipY = cy + Math.sin(a) * len;
    ctx.fillStyle = linGrad(ctx, cx, cy, tipX, tipY, [
      [0, PALETTE.spirit, 0.7],
      [0.6, PALETTE.cursed, 0.35],
      [1, PALETTE.cursed, 0],
    ]);
    ctx.beginPath();
    ctx.moveTo(cx - Math.sin(a) * 3, cy + Math.cos(a) * 3);
    ctx.quadraticCurveTo(cx + Math.cos(a) * len * 0.6, cy + Math.sin(a) * len * 0.6, tipX, tipY);
    ctx.quadraticCurveTo(
      cx + Math.cos(a) * len * 0.5,
      cy + Math.sin(a) * len * 0.5,
      cx + Math.sin(a) * 3,
      cy - Math.cos(a) * 3
    );
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Incandescent white core.
  glow(ctx, 0xffffff, 10, 3, () => {
    ctx.fillStyle = radGrad(ctx, cx, cy, 6, [
      [0, 0xffffff],
      [0.45, 0xd8f4ff],
      [1, PALETTE.spirit, 0.2],
    ]);
    circle(ctx, cx, cy, 5.5);
    ctx.fill();
  });

  // Motes shed by the flame.
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const d = 8 + rand() * 6;
    ctx.fillStyle = hex(PALETTE.cursedGlow, 0.5 + rand() * 0.4);
    circle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.6 + rand());
    ctx.fill();
  }
};

const POWERUP_PAINTERS: Record<PowerUpKind, DrawFn> = {
  katana,
  daruma,
  koi_nobori: koiNobori,
  maneki_neko: manekiNeko,
  omamori,
  onibi,
};

export function paintPowerUp(ctx: Ctx, w: number, h: number, kind: PowerUpKind): void {
  POWERUP_PAINTERS[kind](ctx, w, h);
}

/* ==================================================================== coin */

/**
 * Spinning mon. The coin squashes horizontally through the loop and shows its
 * milled edge as it passes side-on.
 */
function coinFrame(frame: number): DrawFn {
  return (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const a = (frame / COIN_FRAME_COUNT) * Math.PI * 2;
    const squash = Math.cos(a);
    const rx = Math.abs(squash) * 9.5;
    const edge = 1 - Math.abs(squash);

    glow(ctx, PALETTE.gold, 7, 2, () => {
      ctx.fillStyle = hex(PALETTE.gold, 0.35);
      ellipse(ctx, cx, cy, Math.max(rx, 1.6), 9.5);
      ctx.fill();
    });

    // Milled edge, widest when the face is side-on.
    if (edge > 0.05) {
      ctx.fillStyle = linGrad(ctx, cx - 2, cy, cx + 2, cy, [
        [0, PALETTE.goldDeep],
        [0.5, PALETTE.goldGlow],
        [1, 0x8a6410],
      ]);
      roundRect(ctx, cx - 1.6 - edge * 0.8, cy - 9.5, 3.2 + edge * 1.6, 19, 1.4);
      ctx.fill();
    }

    if (rx < 1.4) return;

    const face = (): void => ellipse(ctx, cx, cy, rx, 9.5);
    outline(ctx, face, 0x5a3f08, 1.2, 0.85);
    ctx.fillStyle = linGrad(ctx, cx - rx, cy - 9, cx + rx, cy + 9, [
      [0, 0xfff3c8],
      [0.35, PALETTE.gold],
      [0.7, PALETTE.goldDeep],
      [1, 0x8a6410],
    ]);
    face();
    ctx.fill();

    clipped(ctx, face, () => {
      // Rim ring.
      ctx.strokeStyle = hex(0x8a6410, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.78, 7.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Square hole of a mon.
      if (rx > 4) {
        ctx.fillStyle = hex(0x3a2905, 0.9);
        roundRect(ctx, cx - rx * 0.2, cy - 2.4, rx * 0.4, 4.8, 0.8);
        ctx.fill();
      }
      // Specular sweep tracking the spin.
      ctx.fillStyle = linGrad(ctx, cx - rx, cy - 9, cx + rx, cy + 9, [
        [Math.max(0, 0.5 + squash * 0.4 - 0.18), 0xffffff, 0],
        [Math.max(0.01, 0.5 + squash * 0.4), 0xffffff, 0.65],
        [Math.min(1, 0.5 + squash * 0.4 + 0.18), 0xffffff, 0],
      ]);
      face();
      ctx.fill();
    });
  };
}

/* =============================================================== particles */

const fxJump: DrawFn = (ctx, w, h) => {
  const c = w / 2;
  ctx.fillStyle = radGrad(ctx, c, c, c, [
    [0, 0xd8fff0, 0.95],
    [0.4, PALETTE.jade, 0.7],
    [1, PALETTE.jadeDeep, 0],
  ]);
  circle(ctx, c, h / 2, c);
  ctx.fill();
};

const fxDust: DrawFn = (ctx, w, h) => {
  ctx.fillStyle = radGrad(ctx, w / 2, h / 2, w / 2, [
    [0, 0xb9a98c, 0.7],
    [0.5, 0x8a7a60, 0.35],
    [1, 0x6a5c46, 0],
  ]);
  circle(ctx, w / 2, h / 2, w / 2);
  ctx.fill();
};

const fxBreak: DrawFn = (ctx, w, h) => {
  ctx.fillStyle = linGrad(ctx, 0, 0, w, h, [
    [0, 0xa9a293],
    [0.5, 0x6f6a5d],
    [1, 0x3a362e],
  ]);
  ctx.beginPath();
  ctx.moveTo(1, h * 0.3);
  ctx.lineTo(w * 0.6, 0.5);
  ctx.lineTo(w - 1, h * 0.55);
  ctx.lineTo(w * 0.45, h - 1);
  ctx.closePath();
  ctx.fill();
  outline(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(1, h * 0.3);
      ctx.lineTo(w * 0.6, 0.5);
      ctx.lineTo(w - 1, h * 0.55);
      ctx.lineTo(w * 0.45, h - 1);
      ctx.closePath();
    },
    INK,
    0.8,
    0.6
  );
};

const fxDeath: DrawFn = (ctx, w, h) => {
  ctx.fillStyle = radGrad(ctx, w / 2, h / 2, w / 2, [
    [0, 0xfff3c0, 1],
    [0.3, PALETTE.gold, 0.85],
    [0.6, PALETTE.ember, 0.6],
    [1, PALETTE.emberDeep, 0],
  ]);
  circle(ctx, w / 2, h / 2, w / 2);
  ctx.fill();
};

/** Four-point sparkle. */
function starShape(ctx: Ctx, cx: number, cy: number, r: number, thin: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + thin, cy - thin, cx + r, cy);
  ctx.quadraticCurveTo(cx + thin, cy + thin, cx, cy + r);
  ctx.quadraticCurveTo(cx - thin, cy + thin, cx - r, cy);
  ctx.quadraticCurveTo(cx - thin, cy - thin, cx, cy - r);
  ctx.closePath();
}

const fxCoin: DrawFn = (ctx, w, h) => {
  const c = w / 2;
  glow(ctx, PALETTE.gold, 6, 2, () => {
    ctx.fillStyle = hex(0xfff6d8, 1);
    starShape(ctx, c, h / 2, c - 0.5, 1.6);
    ctx.fill();
  });
};

const fxStar: DrawFn = (ctx, w, h) => {
  const c = w / 2;
  glow(ctx, 0xffffff, 5, 2, () => {
    ctx.fillStyle = hex(0xffffff, 1);
    starShape(ctx, c, h / 2, c - 0.5, 1.3);
    ctx.fill();
  });
};

const fxSpark: DrawFn = (ctx, w, h) => {
  ctx.fillStyle = linGrad(ctx, w / 2, 0, w / 2, h, [
    [0, 0xffffff, 0],
    [0.5, 0xffffff, 1],
    [1, 0xffffff, 0],
  ]);
  roundRect(ctx, w / 2 - 0.9, 0, 1.8, h, 0.9);
  ctx.fill();
};

const fxEmber: DrawFn = (ctx, w, h) => {
  ctx.fillStyle = radGrad(ctx, w / 2, h / 2, w / 2, [
    [0, 0xfff0b0, 1],
    [0.4, PALETTE.gold, 0.8],
    [0.75, PALETTE.ember, 0.4],
    [1, PALETTE.emberDeep, 0],
  ]);
  circle(ctx, w / 2, h / 2, w / 2);
  ctx.fill();
};

const fxSmoke: DrawFn = (ctx, w, h) => {
  ctx.fillStyle = radGrad(ctx, w / 2, h / 2, w / 2, [
    [0, 0xd8d2e8, 0.5],
    [0.5, 0x9a92b8, 0.25],
    [1, 0x5a5478, 0],
  ]);
  circle(ctx, w / 2, h / 2, w / 2);
  ctx.fill();
};

/** Sakura petal — notched tip and a centre vein, not an ellipse. */
const fxSakura: DrawFn = (ctx, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + h * 0.42);
    ctx.quadraticCurveTo(cx - w * 0.46, cy + h * 0.1, cx - w * 0.2, cy - h * 0.34);
    // The notch at the tip.
    ctx.quadraticCurveTo(cx - w * 0.06, cy - h * 0.2, cx, cy - h * 0.3);
    ctx.quadraticCurveTo(cx + w * 0.06, cy - h * 0.2, cx + w * 0.2, cy - h * 0.34);
    ctx.quadraticCurveTo(cx + w * 0.46, cy + h * 0.1, cx, cy + h * 0.42);
    ctx.closePath();
  };
  glow(ctx, PALETTE.sakuraGlow, 3, 2, () => {
    ctx.fillStyle = linGrad(ctx, cx, cy - h * 0.4, cx, cy + h * 0.4, [
      [0, 0xfff0f6],
      [0.5, PALETTE.sakura],
      [1, PALETTE.sakuraDeep],
    ]);
    shape();
    ctx.fill();
  });
  ctx.strokeStyle = hex(PALETTE.sakuraDeep, 0.5);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy + h * 0.34);
  ctx.lineTo(cx, cy - h * 0.22);
  ctx.stroke();
};

const fxSlash: DrawFn = (ctx, w, h) => {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = linGrad(ctx, 0, 0, w, h, [
    [0, PALETTE.spirit, 0],
    [0.45, 0xffffff, 1],
    [1, PALETTE.spirit, 0],
  ]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w / 2, h * 1.1, w * 0.62, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = hex(0xffffff, 0.9);
  ctx.stroke();
  ctx.restore();
};

const fxShockwave: DrawFn = (ctx, w, h) => {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = radGrad(ctx, w / 2, h / 2, w / 2, [
    [0, 0xffffff, 0],
    [0.8, 0xffffff, 0.9],
    [1, 0xffffff, 0],
  ]);
  ctx.lineWidth = w * 0.08;
  circle(ctx, w / 2, h / 2, w * 0.42);
  ctx.stroke();
  ctx.restore();
};

const fxSnow: DrawFn = (ctx, w, h) => {
  const c = w / 2;
  ctx.strokeStyle = hex(0xffffff, 0.95);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(c - Math.cos(a) * c * 0.85, h / 2 - Math.sin(a) * c * 0.85);
    ctx.lineTo(c + Math.cos(a) * c * 0.85, h / 2 + Math.sin(a) * c * 0.85);
    ctx.stroke();
  }
  ctx.fillStyle = hex(0xffffff, 0.9);
  circle(ctx, c, h / 2, 1);
  ctx.fill();
};

const fxRain: DrawFn = (ctx, w, h) => {
  ctx.fillStyle = linGrad(ctx, w / 2, 0, w / 2, h, [
    [0, 0xbfd4ff, 0],
    [0.6, 0xbfd4ff, 0.75],
    [1, 0xe8f0ff, 0.9],
  ]);
  roundRect(ctx, w / 2 - 0.8, 0, 1.6, h, 0.8);
  ctx.fill();
};

const FX_PAINTERS: Array<[string, number, number, DrawFn]> = [
  [FX.jump, 12, 12, fxJump],
  [FX.dust, 12, 12, fxDust],
  [FX.break, 8, 8, fxBreak],
  [FX.death, 14, 14, fxDeath],
  [FX.coin, 12, 12, fxCoin],
  [FX.sakura, 12, 10, fxSakura],
  [FX.spark, 4, 14, fxSpark],
  [FX.ember, 10, 10, fxEmber],
  [FX.smoke, 20, 20, fxSmoke],
  [FX.star, 12, 12, fxStar],
  [FX.slash, 34, 24, fxSlash],
  [FX.shockwave, 40, 40, fxShockwave],
  [FX.snow, 10, 10, fxSnow],
  [FX.rain, 4, 16, fxRain],
];

/* ============================================================= registration */

export function registerProps(scene: Scene): void {
  PLATFORM_KEYS.forEach((kind) => {
    const painter = PLATFORM_PAINTERS[kind];
    defineTexture(scene, platKey(kind), PLAT_W, PLAT_H, painter);
  });

  // Only the platforms that can shatter need a broken state.
  (["toro", "glace", "cursed"] as PlatformKind[]).forEach((kind) => {
    defineTexture(scene, platCrackedKey(kind), PLAT_W, PLAT_H, crackedOf(PLATFORM_PAINTERS[kind]));
  });

  POWERUP_KEYS.forEach((kind) => {
    defineTexture(scene, powerUpKey(kind), PU_W, PU_H, POWERUP_PAINTERS[kind]);
  });

  const coinFrames: DrawFn[] = [];
  for (let f = 0; f < COIN_FRAME_COUNT; f++) coinFrames.push(coinFrame(f));
  defineSheet(scene, COIN_KEY, 22, 22, coinFrames);

  if (!scene.anims.exists(COIN_ANIM)) {
    scene.anims.create({
      key: COIN_ANIM,
      frames: scene.anims.generateFrameNumbers(COIN_KEY, { start: 0, end: COIN_FRAME_COUNT - 1 }),
      frameRate: 12,
      repeat: -1,
    });
  }

  FX_PAINTERS.forEach(([key, fw, fh, painter]) => {
    defineTexture(scene, key, fw, fh, painter);
  });
}
