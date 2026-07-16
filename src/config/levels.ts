import type { Biome, EnemyKind, PlatformKind, PowerUpKind } from "../art/keys";

/**
 * The level system.
 *
 * Two flavours share one runner (see scenes/Game):
 *  - **Campaign** levels are procedural — a `LevelParams` recipe the managers
 *    generate from, with a fixed goal height instead of the endless score ramp.
 *    Twelve of them climb through every biome, tightening as they go.
 *  - **Custom** levels are authored — an explicit list of hand-placed items the
 *    creator lays down in the editor. A creation can only be published once its
 *    author has actually climbed it end to end (see `validated`).
 *
 * Infinite mode uses neither: it keeps the original score-driven curve and is the
 * only mode that feeds the leaderboard.
 */

/* ------------------------------------------------------------------ */
/* Shared difficulty recipe                                            */
/* ------------------------------------------------------------------ */

export interface LevelParams {
  /** Pixels to climb from the start floor to the finish gate. */
  goal: number;
  /** Mistakes allowed before the run fails. */
  lives: number;
  /** Fixed biome — no crossfade, the whole level lives in one place. */
  biome: Biome;
  /** Vertical gap band between generated platforms. */
  gapMin: number;
  gapMax: number;
  /** Relative frequency of each platform kind (normalised at spawn). */
  platformWeights: Partial<Record<PlatformKind, number>>;
  /** Species allowed to spawn; empty means a calm, enemy-free climb. */
  enemyKinds: EnemyKind[];
  /** Vertical spacing between enemy spawns — smaller is deadlier. */
  enemySpacing: number;
  powerUps: boolean;
  coins: boolean;
}

export interface CampaignLevel {
  id: string;
  /** 0-based position in the campaign, also the unlock order. */
  index: number;
  name: string;
  subtitle: string;
  params: LevelParams;
}

/* ------------------------------------------------------------------ */
/* The campaign                                                        */
/* ------------------------------------------------------------------ */

/** Compact constructor so the table below reads as a difficulty curve. */
function lvl(
  index: number,
  name: string,
  subtitle: string,
  params: LevelParams
): CampaignLevel {
  return { id: `c${index + 1}`, index, name, subtitle, params };
}

export const CAMPAIGN: CampaignLevel[] = [
  lvl(0, "Premiers Pas", "Apprends à grimper", {
    goal: 1200,
    lives: 3,
    biome: "village",
    gapMin: 68,
    gapMax: 108,
    platformWeights: { toro: 80, lotus: 12, bamboo: 8 },
    enemyKinds: [],
    enemySpacing: Infinity,
    powerUps: false,
    coins: true,
  }),
  lvl(1, "Le Sanctuaire", "Les premiers yokai rôdent", {
    goal: 1500,
    lives: 3,
    biome: "village",
    gapMin: 74,
    gapMax: 120,
    platformWeights: { toro: 64, lotus: 12, bamboo: 18, kumo: 6 },
    enemyKinds: ["kappa"],
    enemySpacing: 900,
    powerUps: true,
    coins: true,
  }),
  lvl(2, "La Forêt des Torii", "Les portails ne mènent nulle part", {
    goal: 1800,
    lives: 3,
    biome: "forest",
    gapMin: 80,
    gapMax: 126,
    platformWeights: { toro: 54, bamboo: 22, lotus: 10, kumo: 14 },
    enemyKinds: ["kappa", "karakasa"],
    enemySpacing: 800,
    powerUps: true,
    coins: true,
  }),
  lvl(3, "Chant des Lucioles", "Quelque chose vole dans le noir", {
    goal: 2000,
    lives: 3,
    biome: "forest",
    gapMin: 84,
    gapMax: 132,
    platformWeights: { toro: 46, bamboo: 24, lotus: 10, kumo: 20 },
    enemyKinds: ["kappa", "karakasa", "tengu"],
    enemySpacing: 720,
    powerUps: true,
    coins: true,
  }),
  lvl(4, "L'Ascension Gelée", "L'air se fait mince et froid", {
    goal: 2200,
    lives: 3,
    biome: "mountain",
    gapMin: 90,
    gapMax: 138,
    platformWeights: { toro: 44, bamboo: 18, glace: 22, kumo: 16 },
    enemyKinds: ["kappa", "karakasa", "tengu"],
    enemySpacing: 680,
    powerUps: true,
    coins: true,
  }),
  lvl(5, "Cœur de Givre", "La glace se dérobe sous les pieds", {
    goal: 2500,
    lives: 3,
    biome: "mountain",
    gapMin: 94,
    gapMax: 142,
    platformWeights: { toro: 34, glace: 34, bamboo: 16, kumo: 16 },
    enemyKinds: ["kappa", "tengu", "oni"],
    enemySpacing: 640,
    powerUps: true,
    coins: true,
  }),
  lvl(6, "Mer de Nuages", "Éclairée par en dessous", {
    goal: 2700,
    lives: 3,
    biome: "clouds",
    gapMin: 96,
    gapMax: 146,
    platformWeights: { toro: 28, kumo: 40, lotus: 12, glace: 20 },
    enemyKinds: ["tengu", "karakasa", "yurei"],
    enemySpacing: 600,
    powerUps: true,
    coins: true,
  }),
  lvl(7, "Le Grand Vide", "Le sol est un souvenir", {
    goal: 3000,
    lives: 2,
    biome: "clouds",
    gapMin: 100,
    gapMax: 152,
    platformWeights: { toro: 24, kumo: 42, glace: 22, cursed: 12 },
    enemyKinds: ["tengu", "oni", "yurei", "jorogumo"],
    enemySpacing: 560,
    powerUps: true,
    coins: true,
  }),
  lvl(8, "L'Orage Éternel", "Le ciel se défend", {
    goal: 3200,
    lives: 2,
    biome: "storm",
    gapMin: 100,
    gapMax: 156,
    platformWeights: { toro: 22, kumo: 30, glace: 24, cursed: 24 },
    enemyKinds: ["kappa", "tengu", "oni", "yurei"],
    enemySpacing: 520,
    powerUps: true,
    coins: true,
  }),
  lvl(9, "Fracas du Tonnerre", "Chaque pierre est maudite", {
    goal: 3500,
    lives: 2,
    biome: "storm",
    gapMin: 105,
    gapMax: 160,
    platformWeights: { toro: 18, cursed: 40, glace: 22, kumo: 20 },
    enemyKinds: ["tengu", "oni", "yurei", "jorogumo"],
    enemySpacing: 480,
    powerUps: true,
    coins: true,
  }),
  lvl(10, "Seuil du Cosmos", "Au-delà du dernier nuage", {
    goal: 3800,
    lives: 2,
    biome: "cosmos",
    gapMin: 105,
    gapMax: 165,
    platformWeights: { toro: 18, cursed: 34, kumo: 26, lotus: 10, glace: 12 },
    enemyKinds: ["tengu", "oni", "yurei", "jorogumo"],
    enemySpacing: 440,
    powerUps: true,
    coins: true,
  }),
  lvl(11, "Au-delà du Ciel", "Le grand squelette t'attend", {
    goal: 4200,
    lives: 1,
    biome: "cosmos",
    gapMin: 110,
    gapMax: 175,
    platformWeights: { toro: 14, cursed: 38, kumo: 26, glace: 22 },
    enemyKinds: ["oni", "yurei", "jorogumo", "gashadokuro"],
    enemySpacing: 400,
    powerUps: true,
    coins: true,
  }),
];

export function getCampaignLevel(id: string): CampaignLevel | undefined {
  return CAMPAIGN.find((l) => l.id === id);
}

/* ------------------------------------------------------------------ */
/* Campaign progress                                                   */
/* ------------------------------------------------------------------ */

const CAMPAIGN_KEY = "yokaijump.campaign.v1";

export interface CampaignProgress {
  /** Highest 0-based index the player may enter (0 = only the first level). */
  unlocked: number;
  /** Best star rating (1–3) earned per level id. */
  stars: Record<string, number>;
}

export function loadCampaignProgress(): CampaignProgress {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    if (!raw) return { unlocked: 0, stars: {} };
    const parsed = JSON.parse(raw) as Partial<CampaignProgress>;
    return {
      unlocked: typeof parsed.unlocked === "number" ? parsed.unlocked : 0,
      stars: parsed.stars && typeof parsed.stars === "object" ? parsed.stars : {},
    };
  } catch {
    return { unlocked: 0, stars: {} };
  }
}

export function saveCampaignProgress(p: CampaignProgress): void {
  try {
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

export function isLevelUnlocked(index: number): boolean {
  return index <= loadCampaignProgress().unlocked;
}

export function levelStars(id: string): number {
  return loadCampaignProgress().stars[id] ?? 0;
}

/**
 * Records a clear: keeps the best star count and unlocks the next level. Returns
 * true when this clear opened a level that was previously locked.
 */
export function completeCampaignLevel(index: number, stars: number): boolean {
  const p = loadCampaignProgress();
  const level = CAMPAIGN[index];
  if (level) {
    p.stars[level.id] = Math.max(p.stars[level.id] ?? 0, stars);
  }
  const opened = index + 1 <= CAMPAIGN.length - 1 && index + 1 > p.unlocked;
  p.unlocked = Math.max(p.unlocked, Math.min(index + 1, CAMPAIGN.length - 1));
  saveCampaignProgress(p);
  return opened;
}

/* ------------------------------------------------------------------ */
/* Custom levels — authored, hand-placed                               */
/* ------------------------------------------------------------------ */

export type PlacedItem =
  | { type: "platform"; x: number; y: number; kind: PlatformKind }
  | { type: "enemy"; x: number; y: number; kind: EnemyKind }
  | { type: "coin"; x: number; y: number }
  | { type: "powerup"; x: number; y: number; kind: PowerUpKind };

export interface CustomLevel {
  id: string;
  name: string;
  author: string;
  biome: Biome;
  /** Total climb, in pixels, from the start floor to the finish gate. */
  height: number;
  lives: number;
  /** `y` is altitude from the start floor (0) up to `height` (the finish). */
  items: PlacedItem[];
  /** The author has climbed it end to end at least once. */
  validated: boolean;
  /** Visible to everyone in the community list. Implies `validated`. */
  published: boolean;
  createdAt: string;
  bestTimeMs?: number;
}

const CUSTOM_KEY = "yokaijump.levels.custom.v1";

/** Heights the editor offers — short, standard, tall. */
export const LEVEL_HEIGHTS = [1800, 2600, 3600] as const;
export const DEFAULT_LEVEL_HEIGHT = 2600;

export function loadCustomLevels(): CustomLevel[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomLevel[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((l) => l && typeof l.id === "string" && Array.isArray(l.items));
  } catch {
    return [];
  }
}

export function saveCustomLevels(levels: CustomLevel[]): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(levels));
  } catch {
    /* private mode */
  }
}

export function getCustomLevel(id: string): CustomLevel | undefined {
  return loadCustomLevels().find((l) => l.id === id);
}

/** Inserts or replaces a level by id, returning the full updated list. */
export function upsertCustomLevel(level: CustomLevel): CustomLevel[] {
  const list = loadCustomLevels();
  const idx = list.findIndex((l) => l.id === level.id);
  if (idx >= 0) list[idx] = level;
  else list.push(level);
  saveCustomLevels(list);
  return list;
}

export function deleteCustomLevel(id: string): CustomLevel[] {
  const list = loadCustomLevels().filter((l) => l.id !== id);
  saveCustomLevels(list);
  return list;
}

export function publishedCustomLevels(): CustomLevel[] {
  return loadCustomLevels().filter((l) => l.published);
}

/** Levels the player has started but not yet published. */
export function draftCustomLevels(): CustomLevel[] {
  return loadCustomLevels().filter((l) => !l.published);
}

let idCounter = 0;

/** Best-effort unique id without leaning on crypto in a browser build. */
export function newLevelId(): string {
  idCounter += 1;
  return `u${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function makeDraftLevel(author: string, height = DEFAULT_LEVEL_HEIGHT): CustomLevel {
  return {
    id: newLevelId(),
    name: "Nouveau niveau",
    author: author || "Anonyme",
    biome: "village",
    height,
    lives: 3,
    items: [],
    validated: false,
    published: false,
    createdAt: new Date().toISOString(),
  };
}
