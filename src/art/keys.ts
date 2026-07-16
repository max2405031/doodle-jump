/**
 * Single source of truth for texture keys and animation names.
 *
 * Art modules register these; entities and scenes consume them. Nothing should
 * hardcode a texture string anywhere else — a typo here is a compile error
 * rather than an invisible green box at runtime.
 */

/* ---------------- Characters ---------------- */

/** One animation sheet per skin, frames indexed by CHAR_FRAME. */
export const charKey = (skinId: string): string => `char_${skinId}`;

export const CHAR_FRAME = {
  idle: 0,
  idleAlt: 1,
  rise: 2,
  fall: 3,
  hurt: 4,
} as const;

export const CHAR_FRAME_COUNT = 5;

/** Logical size every character sheet is authored at. */
export const CHAR_W = 48;
export const CHAR_H = 56;

/* ---------------- Enemies ---------------- */

export const ENEMY_KEYS = [
  "kappa",
  "tengu",
  "karakasa",
  "oni",
  "gashadokuro",
  "yurei",
  "jorogumo",
] as const;

export type EnemyKind = (typeof ENEMY_KEYS)[number];

export const enemyKey = (kind: EnemyKind): string => `enemy_${kind}`;
export const enemyAnim = (kind: EnemyKind): string => `enemy_${kind}_idle`;

/** Every enemy sheet has this many frames (looping idle/menace animation). */
export const ENEMY_FRAME_COUNT = 4;

/** Authored logical size per enemy — also used for physics body sizing. */
export const ENEMY_SIZE: Record<EnemyKind, { w: number; h: number }> = {
  kappa: { w: 44, h: 46 },
  tengu: { w: 52, h: 48 },
  karakasa: { w: 40, h: 52 },
  oni: { w: 62, h: 58 },
  gashadokuro: { w: 78, h: 72 },
  yurei: { w: 44, h: 58 },
  jorogumo: { w: 60, h: 50 },
};

/* ---------------- Platforms ---------------- */

export const PLATFORM_KEYS = [
  "toro",
  "bamboo",
  "kumo",
  "lotus",
  "glace",
  "cursed",
] as const;

export type PlatformKind = (typeof PLATFORM_KEYS)[number];

export const platKey = (kind: PlatformKind): string => `plat_${kind}`;

/** Broken-state variant for the cracked ice / shattered stone look. */
export const platCrackedKey = (kind: PlatformKind): string => `plat_${kind}_cracked`;

export const PLAT_W = 92;
export const PLAT_H = 22;

/* ---------------- Power-ups ---------------- */

export const POWERUP_KEYS = [
  "katana",
  "daruma",
  "koi_nobori",
  "maneki_neko",
  "omamori",
  "onibi",
] as const;

export type PowerUpKind = (typeof POWERUP_KEYS)[number];

export const powerUpKey = (kind: PowerUpKind): string => `pu_${kind}`;

/* ---------------- Pickups ---------------- */

/** Spinning coin sheet. */
export const COIN_KEY = "coin";
export const COIN_FRAME_COUNT = 8;
export const COIN_ANIM = "coin_spin";

/* ---------------- Particles / FX ---------------- */

export const FX = {
  jump: "fx_jump",
  dust: "fx_dust",
  break: "fx_break",
  death: "fx_death",
  coin: "fx_coin",
  sakura: "fx_sakura",
  spark: "fx_spark",
  ember: "fx_ember",
  smoke: "fx_smoke",
  star: "fx_star",
  slash: "fx_slash",
  shockwave: "fx_shockwave",
  snow: "fx_snow",
  rain: "fx_rain",
} as const;

/* ---------------- UI ---------------- */

export const UI = {
  panel: "ui_panel",
  panelInset: "ui_panel_inset",
  btn: "ui_btn",
  btnHover: "ui_btn_hover",
  btnDisabled: "ui_btn_disabled",
  coinIcon: "ui_coin",
  heart: "ui_heart",
  lock: "ui_lock",
  check: "ui_check",
  star: "ui_star",
  chevron: "ui_chevron",
  scroll: "ui_scroll",
  torii: "ui_torii",
  ribbon: "ui_ribbon",
  rarityGlow: "ui_rarity_glow",
  vignette: "ui_vignette",
  scoreFrame: "ui_score_frame",
  shopIcon: "ui_nav_shop",
  gearIcon: "ui_nav_gear",
  crownIcon: "ui_nav_crown",
  bookIcon: "ui_nav_book",
  lantern: "ui_lantern",
} as const;

/* ---------------- Backgrounds ---------------- */

/** Altitude biomes, ordered — the run climbs through them in sequence. */
export const BIOMES = [
  "village",
  "forest",
  "mountain",
  "clouds",
  "storm",
  "cosmos",
] as const;

export type Biome = (typeof BIOMES)[number];

export const bgKey = (biome: Biome, layer: number): string => `bg_${biome}_${layer}`;

/** Number of parallax layers authored per biome (0 = farthest). */
export const BG_LAYERS = 3;

/**
 * The title screen's own quiet backdrop — mist and bamboo in silhouette, no
 * neon signs or tourists. Kept separate from BIOMES so it never leaks into
 * (or gets pulled off course by) in-run difficulty progression.
 */
export const menuBgKey = (layer: number): string => `bg_menu_${layer}`;
