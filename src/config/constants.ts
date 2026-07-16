import type { Biome, EnemyKind, PlatformKind, PowerUpKind } from "../art/keys";

/**
 * Tuning for the whole run: physics, difficulty curve, spawn budgets, scoring.
 *
 * Everything the game *feels* like lives here rather than being sprinkled through
 * the entities, so the curve can be read (and fixed) in one place.
 */

export const GAME_WIDTH = 500;
export const GAME_HEIGHT = 800;

/* ------------------------------------------------------------------ player */

export const GRAVITY = 900;
export const JUMP_FORCE = -620;
export const FALL_GRAVITY_MULT = 1.25;
export const PLAYER_SPEED = 250;
export const PLAYER_START_X = GAME_WIDTH / 2;
export const PLAYER_START_Y = GAME_HEIGHT - 65;

/** Apex of a plain jump, in pixels: v² / 2g. Every gap is tuned against this. */
export const JUMP_APEX = (JUMP_FORCE * JUMP_FORCE) / (2 * GRAVITY);

/** Fraction of the screen height the player rides at while climbing. */
export const CAMERA_ANCHOR = 0.44;

/* -------------------------------------------------------------- difficulty */

/** Score at which the curve is fully ramped. Everything below interpolates on t. */
export const DIFFICULTY_SPAN = 14000;

/** 0 at the start of a run, 1 once the curve has topped out. */
export function difficultyAt(score: number): number {
  return Math.max(0, Math.min(1, score / DIFFICULTY_SPAN));
}

/** Linear interpolation used by every curve below. */
export function ramp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/* --------------------------------------------------------------- platforms */

/** Vertical gap between platforms — always comfortably under JUMP_APEX (213px). */
export const GAP_MIN_EASY = 66;
export const GAP_MIN_HARD = 92;
export const GAP_MAX_EASY = 116;
export const GAP_MAX_HARD = 168;

/** How far a platform may drift horizontally from the previous one. */
export const PLATFORM_MAX_DX = 210;
export const PLATFORM_EDGE_MARGIN = 34;

/** Platforms are generated this far above the top of the view. */
export const PLATFORM_LOOKAHEAD = 260;
/** …and recycled this far below the bottom of it. */
export const CULL_MARGIN = 220;

export const LOTUS_JUMP_MULTIPLIER = 1.8;
export const KUMO_DISSOLVE_DELAY = 240;
export const BAMBOO_SPEED = 62;

/** Body is a touch smaller than the art, which carries shadow and glow margin. */
export const PLATFORM_BODY_W = 1.0;
export const PLATFORM_BODY_H = 0.68;

/** Relative frequency of each platform kind, from start of run to full difficulty. */
export const PLATFORM_WEIGHTS: Record<PlatformKind, [number, number]> = {
  toro: [70, 24],
  bamboo: [10, 20],
  lotus: [8, 7],
  kumo: [2, 15],
  glace: [0, 18],
  cursed: [0, 16],
};

/** A kind cannot appear at all below this score. Keeps the opening readable. */
export const PLATFORM_UNLOCK: Record<PlatformKind, number> = {
  toro: 0,
  bamboo: 300,
  lotus: 0,
  kumo: 900,
  glace: 1800,
  cursed: 4200,
};

/** Kinds that vanish under the player. Never two in a row — that is a death trap. */
export const FRAGILE_KINDS: PlatformKind[] = ["glace", "cursed", "kumo"];

/* ----------------------------------------------------------------- enemies */

/** Hard ceiling on how many yokai may share the screen. No swarms, ever. */
export const ENEMY_MAX_ACTIVE = 4;

/** Vertical distance between two spawns, from the calm opening to full pressure. */
export const ENEMY_SPACING_EASY = 900;
export const ENEMY_SPACING_HARD = 420;

/** Nothing hunts the player before this score. */
export const ENEMY_FIRST_SCORE = 260;

/** Altitude gate per species — the bestiary reveals itself as you climb. */
export const ENEMY_UNLOCK: Record<EnemyKind, number> = {
  kappa: 0,
  karakasa: 0,
  tengu: 1400,
  oni: 3600,
  yurei: 6200,
  jorogumo: 7400,
  gashadokuro: 12000,
};

export const ENEMY_WEIGHT: Record<EnemyKind, number> = {
  kappa: 26,
  karakasa: 22,
  tengu: 20,
  oni: 14,
  yurei: 12,
  jorogumo: 10,
  gashadokuro: 3,
};

/** Stomps needed to kill. The oni shrugs off the first one. */
export const ENEMY_HP: Record<EnemyKind, number> = {
  kappa: 1,
  karakasa: 1,
  tengu: 1,
  oni: 2,
  yurei: 1,
  jorogumo: 1,
  gashadokuro: 1,
};

/** The two you cannot land on: they must be avoided outright. */
export const ENEMY_STOMPABLE: Record<EnemyKind, boolean> = {
  kappa: true,
  karakasa: true,
  tengu: true,
  oni: true,
  yurei: true,
  jorogumo: false,
  gashadokuro: false,
};

export const ENEMY_SCORE: Record<EnemyKind, number> = {
  kappa: 50,
  karakasa: 60,
  tengu: 80,
  oni: 140,
  yurei: 110,
  jorogumo: 0,
  gashadokuro: 0,
};

/** Body is 62% of the sprite: the art carries a lot of aura that must not hurt. */
export const ENEMY_BODY_W = 0.62;
export const ENEMY_BODY_H = 0.66;

/** Bounce given back to the player for a successful stomp. */
export const STOMP_BOUNCE = JUMP_FORCE * 0.9;

/* ------------------------------------------------------------------- coins */

export const COIN_VALUE = 1;
/** Chance a freshly generated platform carries a coin. */
export const COIN_PLATFORM_CHANCE = 0.14;
/** …and the rarer chance it carries a whole arc of them. */
export const COIN_ARC_CHANCE = 0.05;
export const COIN_ARC_COUNT = 5;
export const COIN_MAGNET_RADIUS = 150;
export const COIN_MAGNET_SPEED = 460;

/* ---------------------------------------------------------------- powerups */

export const POWERUP_PLATFORM_CHANCE = 0.045;
/** Minimum climb between two power-ups, so they never cluster. */
export const POWERUP_MIN_SPACING = 900;

export const POWERUP_WEIGHT: Record<PowerUpKind, number> = {
  katana: 18,
  daruma: 16,
  koi_nobori: 18,
  maneki_neko: 16,
  omamori: 18,
  onibi: 14,
};

export const MANEKI_DURATION = 6000;
export const ONIBI_DURATION = 2000;
export const ONIBI_VELOCITY = -560;
/** Mirrors the timers baked into Player, so the HUD gauge tells the truth. */
export const KATANA_DURATION = 5000;
export const DARUMA_DURATION = 3000;
export const KOI_DURATION = 4000;

export const POWERUP_LABELS: Record<PowerUpKind, string> = {
  katana: "KATANA",
  daruma: "DARUMA",
  koi_nobori: "KOI NOBORI",
  maneki_neko: "MANEKI NEKO",
  omamori: "OMAMORI",
  onibi: "ONIBI",
};

/* ------------------------------------------------------------------- combo */

/** Bounces per multiplier step. */
export const COMBO_STEP = 4;
export const COMBO_MAX_MULT = 6;
/** Falling this far without touching anything breaks the chain. */
export const COMBO_BREAK_FALL = 300;

export function comboMultiplier(combo: number): number {
  return Math.min(COMBO_MAX_MULT, 1 + Math.floor(combo / COMBO_STEP));
}

/* ------------------------------------------------------------------ damage */

export const HURT_INVULN_MS = 1600;
export const SHIELD_INVULN_MS = 1200;
export const RESPAWN_INVULN_MS = 1900;
export const HURT_KNOCKBACK_X = 240;
export const HURT_KNOCKBACK_Y = JUMP_FORCE * 0.62;

/* ------------------------------------------------------------------ biomes */

export const BIOME_LABELS: Record<Biome, string> = {
  village: "Le Village",
  forest: "La Forêt des Lucioles",
  mountain: "La Montagne Gelée",
  clouds: "La Mer de Nuages",
  storm: "L'Orage",
  cosmos: "Le Cosmos",
};

export const BIOME_SUBTITLES: Record<Biome, string> = {
  village: "Les néons dévorent le sanctuaire",
  forest: "Les torii ne mènent plus nulle part",
  mountain: "Au-dessus des arbres, l'air est mince",
  clouds: "La mer de nuages, éclairée par en dessous",
  storm: "Le ciel se défend",
  cosmos: "Au-delà du ciel",
};

/** Coins awarded when a biome milestone is crossed. */
export const BIOME_BONUS_COINS = 25;

/* ----------------------------------------------------------------- storage */

export const BEST_SCORE_KEY = "yokaijump.bestScore";
export const TUTORIAL_KEY = "yokaijump.tutorial.v2";
export const STATS_KEY = "yokaijump.stats.v1";

/* ------------------------------------------------------------------ legacy */

/**
 * Kept for the screens that have not been reskinned yet. New code pulls colours
 * from `config/theme` instead.
 */
export const COLORS = {
  sakuraPink: 0xffb7c5,
  sakuraDark: 0xe8909f,
  indigo: 0x264653,
  bambooGreen: 0x2a9d8f,
  bambooLight: 0x52c4a0,
  cream: 0xf4f1de,
  deepRed: 0xd32f2f,
  gold: 0xffd700,
  white: 0xffffff,
  black: 0x000000,
  skyBlue: 0x87ceeb,
  darkBg: 0x0f0e17,
  nightSky: 0x1a1a2e,
} as const;
