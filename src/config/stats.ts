import { STATS_KEY } from "./constants";

/**
 * Lifetime player statistics.
 *
 * Written by the gameplay scenes at the end of a run and read by the quests
 * screen, which turns them into claimable objectives. Everything is additive and
 * monotonic except `bestCombo` / `bestScore`, which keep the maximum ever seen.
 */
export interface Stats {
  /** Coins banked across every run. */
  totalCoins: number;
  /** Platform bounces across every run. */
  totalJumps: number;
  /** Yokai stomped or cut down. */
  enemiesStomped: number;
  /** Runs started, any mode. */
  gamesPlayed: number;
  /** Best combo multiplier reached in a single run. */
  bestCombo: number;
  /** Best infinite-mode score (mirrors the leaderboard headline). */
  bestScore: number;
  /** Campaign levels beaten, counting each completion. */
  levelsCompleted: number;
  /** Highest biome index ever reached (0 = village … 5 = cosmos). */
  biomeReached: number;
  /** Custom levels the player has validated and published. */
  levelsPublished: number;
}

export const DEFAULT_STATS: Stats = {
  totalCoins: 0,
  totalJumps: 0,
  enemiesStomped: 0,
  gamesPlayed: 0,
  bestCombo: 0,
  bestScore: 0,
  levelsCompleted: 0,
  biomeReached: 0,
  levelsPublished: 0,
};

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw) as Partial<Stats>;
    const out = { ...DEFAULT_STATS };
    (Object.keys(DEFAULT_STATS) as Array<keyof Stats>).forEach((k) => {
      const v = parsed[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    });
    return out;
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function saveStats(stats: Stats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* private mode — stats just won't persist */
  }
}

/**
 * Folds a run's contribution into the lifetime record. `bestCombo`, `bestScore`
 * and `biomeReached` keep the max; everything else accumulates.
 */
export function recordRun(delta: {
  coins?: number;
  jumps?: number;
  stomps?: number;
  combo?: number;
  score?: number;
  biome?: number;
  levelCompleted?: boolean;
}): Stats {
  const s = loadStats();
  s.gamesPlayed += 1;
  s.totalCoins += Math.max(0, delta.coins ?? 0);
  s.totalJumps += Math.max(0, delta.jumps ?? 0);
  s.enemiesStomped += Math.max(0, delta.stomps ?? 0);
  if (delta.combo && delta.combo > s.bestCombo) s.bestCombo = delta.combo;
  if (delta.score && delta.score > s.bestScore) s.bestScore = delta.score;
  if (typeof delta.biome === "number" && delta.biome > s.biomeReached) s.biomeReached = delta.biome;
  if (delta.levelCompleted) s.levelsCompleted += 1;
  saveStats(s);
  return s;
}

/** Bump the published-levels counter when a creation goes live. */
export function recordPublish(): Stats {
  const s = loadStats();
  s.levelsPublished += 1;
  saveStats(s);
  return s;
}
