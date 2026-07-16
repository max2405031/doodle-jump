/**
 * Design tokens. Every scene pulls colours, type and spacing from here so the
 * menus, HUD and shop read as one product instead of six different screens.
 */

export const PALETTE = {
  // Surfaces — deep, desaturated indigo/violet night
  void: 0x07060f,
  bgDeep: 0x0d0b1a,
  bg: 0x141127,
  surface: 0x1c1836,
  surfaceHi: 0x262047,
  border: 0x3a3268,
  borderHi: 0x574a9e,

  // Brand
  sakura: 0xff9ec4,
  sakuraDeep: 0xe0568f,
  sakuraGlow: 0xffd4e6,
  jade: 0x3ddc9a,
  jadeDeep: 0x1f9d72,
  gold: 0xffc94d,
  goldDeep: 0xd99a1a,
  goldGlow: 0xffe9a8,
  ember: 0xff5a3c,
  emberDeep: 0xc0281a,
  cursed: 0x9d4edd,
  cursedGlow: 0xc77dff,
  spirit: 0x5ee7ff,
  spiritDeep: 0x1f9fc4,
  blood: 0xd11f3a,

  // Text
  text: 0xf4f1ff,
  textDim: 0xa79fc4,
  textFaint: 0x6f678e,
  black: 0x000000,
  white: 0xffffff,

  // Neutral stone/moss/brass — the mockups keep decor (lanterns, cliffs, coins)
  // close to true grey/olive/tan instead of the brand's violet-shifted surfaces.
  stone: 0x22282b,
  stoneLight: 0x4a4a52,
  moss: 0x6fae3a,
  mossDeep: 0x3f5c26,
  brass: 0xb89a68,
  brassDeep: 0x8a6f45,

  // Lighter, near-neutral slate sky for in-run parallax — distinct from the
  // near-black `void` reserved for menus/modal backdrops.
  storm: 0x2f333f,
  stormDeep: 0x535a64,

  // Bamboo wood — warm tan, not the brand violet/pink.
  bambooTan: 0xb8a06a,
  bambooTanDeep: 0x8a7248,
} as const;

export const CSS = {
  sakura: "#ff9ec4",
  sakuraDeep: "#e0568f",
  sakuraGlow: "#ffd4e6",
  gold: "#ffc94d",
  goldGlow: "#ffe9a8",
  jade: "#3ddc9a",
  spirit: "#5ee7ff",
  cursed: "#c77dff",
  ember: "#ff5a3c",
  text: "#f4f1ff",
  textDim: "#a79fc4",
  textFaint: "#6f678e",
  ink: "#07060f",
  white: "#ffffff",
} as const;

/** Rarity drives shop card colours and the aura behind a skin preview. */
export const RARITY = {
  common: { label: "COMMUN", color: 0x8b93b5, glow: 0xb6bdd8 },
  rare: { label: "RARE", color: 0x4aa3ff, glow: 0x9ccfff },
  epic: { label: "ÉPIQUE", color: 0x9d4edd, glow: 0xc77dff },
  legendary: { label: "LÉGENDAIRE", color: 0xffc94d, glow: 0xffe9a8 },
  mythic: { label: "MYTHIQUE", color: 0xff4d6d, glow: 0xff9ec4 },
} as const;

export type Rarity = keyof typeof RARITY;

export const FONT = {
  display: '"Yuji Boku", "Yu Mincho", Georgia, serif',
  ui: '"Rajdhani", "Arial Black", Arial, sans-serif',
  body: '"Rajdhani", Arial, sans-serif',
  mono: '"JetBrains Mono", "Courier New", monospace',
} as const;

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

export const TEXT = {
  /**
   * Inked-brush wordmark: near-black fill with a hairline pale edge, so the
   * pink reads purely as a glow bleeding off the ink rather than an outline.
   */
  title: (size = 54): TextStyle => ({
    fontFamily: FONT.display,
    fontSize: `${size}px`,
    color: CSS.ink,
    stroke: CSS.white,
    strokeThickness: 2,
    shadow: {
      offsetX: 0,
      offsetY: 0,
      color: "rgba(255,158,196,0.55)",
      blur: Math.round(size * 0.22),
      fill: true,
    },
  }),
  heading: (size = 30): TextStyle => ({
    fontFamily: FONT.display,
    fontSize: `${size}px`,
    color: CSS.ink,
    stroke: CSS.white,
    strokeThickness: 1.5,
    shadow: {
      offsetX: 0,
      offsetY: 0,
      color: "rgba(255,158,196,0.55)",
      blur: Math.round(size * 0.22),
      fill: true,
    },
  }),
  button: (size = 22): TextStyle => ({
    fontFamily: FONT.ui,
    fontSize: `${size}px`,
    color: CSS.sakuraGlow,
    stroke: CSS.sakuraDeep,
    strokeThickness: 3,
    fontStyle: "bold",
    shadow: { offsetX: 0, offsetY: 0, color: CSS.sakura, blur: 10, fill: true, stroke: true },
  }),
  label: (size = 16, color: string = CSS.textDim): TextStyle => ({
    fontFamily: FONT.body,
    fontSize: `${size}px`,
    color,
    stroke: CSS.ink,
    strokeThickness: 2,
  }),
  score: (size = 40): TextStyle => ({
    fontFamily: FONT.ui,
    fontSize: `${size}px`,
    color: CSS.white,
    stroke: CSS.ink,
    strokeThickness: 6,
    shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 10, fill: true },
  }),
} as const;

export const SPACING = {
  gutter: 24,
  cardGap: 14,
  radius: 14,
} as const;

export const DEPTH = {
  bgFar: 0,
  bgMid: 1,
  bgNear: 2,
  props: 4,
  platform: 5,
  pickup: 7,
  enemy: 8,
  player: 10,
  fx: 14,
  weather: 16,
  hud: 100,
  overlay: 200,
  modal: 210,
} as const;
