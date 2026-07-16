import type { Rarity } from "./theme";

/**
 * Skins are real characters, not tints: each one carries its own palette *and*
 * anatomy traits, and the character painter (src/art/characters.ts) builds a
 * distinct sprite from them. Buying one visibly changes who you play.
 */

export interface SkinPalette {
  body: number;
  bodyDark: number;
  belly: number;
  accent: number;
  eye: number;
  aura: number;
}

export interface SkinTraits {
  ears: "fox" | "cat" | "oni" | "leaf" | "none";
  tails: number;
  mask: boolean;
  horns: boolean;
  flames: boolean;
  ghost: boolean;
  halo: boolean;
  /** Bioluminescent axolotl gills + fin-tail + cylindrical torso treatment. */
  gills: boolean;
}

export interface SkinDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  cost: number;
  palette: SkinPalette;
  traits: SkinTraits;
}

const T = (t: Partial<SkinTraits>): SkinTraits => ({
  ears: "fox",
  tails: 1,
  mask: false,
  horns: false,
  flames: false,
  ghost: false,
  halo: false,
  gills: false,
  ...t,
});

export const SKINS: SkinDef[] = [
  {
    id: "sakura",
    name: "Sakura",
    desc: "Le petit yokai gardien des temples.",
    rarity: "common",
    cost: 0,
    palette: {
      body: 0xffb7c5,
      bodyDark: 0xd97a95,
      belly: 0xfff2f6,
      accent: 0xff6f91,
      eye: 0x3b1f5e,
      aura: 0xff9ec4,
    },
    traits: T({ ears: "fox", tails: 1 }),
  },
  {
    id: "shinobi",
    name: "Shinobi",
    desc: "Silencieux. Personne ne le voit venir.",
    rarity: "common",
    cost: 60,
    palette: {
      body: 0x3a3f5c,
      bodyDark: 0x1d2033,
      belly: 0x5a6285,
      accent: 0xd11f3a,
      eye: 0xff4d6d,
      aura: 0x6c74a8,
    },
    traits: T({ ears: "cat", tails: 1, mask: true }),
  },
  {
    id: "bushi",
    name: "Bushi",
    desc: "Armure laquée, honneur intact.",
    rarity: "rare",
    cost: 180,
    palette: {
      body: 0xb33a3a,
      bodyDark: 0x6e1c1c,
      belly: 0xf0d9a8,
      accent: 0xffc94d,
      eye: 0xffe9a8,
      aura: 0xff5a3c,
    },
    traits: T({ ears: "oni", tails: 1, horns: true }),
  },
  {
    id: "tanuki",
    name: "Tanuki",
    desc: "Farceur, gourmand, étonnamment agile.",
    rarity: "rare",
    cost: 240,
    palette: {
      body: 0x9c7a55,
      bodyDark: 0x5d4630,
      belly: 0xf3e4cd,
      accent: 0x3f2f20,
      eye: 0x2b1a0f,
      aura: 0xd6b98c,
    },
    traits: T({ ears: "cat", tails: 1 }),
  },
  {
    id: "yurei",
    name: "Yūrei",
    desc: "Une âme qui n'a jamais trouvé le repos.",
    rarity: "epic",
    cost: 420,
    palette: {
      body: 0xbfe9ff,
      bodyDark: 0x5a8fb0,
      belly: 0xeafaff,
      accent: 0x5ee7ff,
      eye: 0x0d3b4f,
      aura: 0x5ee7ff,
    },
    traits: T({ ears: "none", tails: 0, ghost: true, flames: true }),
  },
  {
    id: "oni",
    name: "Oni",
    desc: "La colère des montagnes, en petit format.",
    rarity: "epic",
    cost: 520,
    palette: {
      body: 0xff5a3c,
      bodyDark: 0x8f2412,
      belly: 0xffc9a8,
      accent: 0xffc94d,
      eye: 0xffe14d,
      aura: 0xff5a3c,
    },
    traits: T({ ears: "oni", tails: 1, horns: true, mask: true }),
  },
  {
    id: "hannya",
    name: "Hannya",
    desc: "La jalousie devenue démon. Ne la regarde pas trop longtemps.",
    rarity: "legendary",
    cost: 800,
    palette: {
      body: 0x7b2d5e,
      bodyDark: 0x3d1430,
      belly: 0xf5e2c8,
      accent: 0xd11f3a,
      eye: 0xffc94d,
      aura: 0x9d4edd,
    },
    traits: T({ ears: "oni", tails: 1, horns: true, mask: true, flames: true }),
  },
  {
    id: "kitsune",
    name: "Kitsune à 9 queues",
    desc: "Mille ans de vie. Neuf queues. Zéro patience.",
    rarity: "legendary",
    cost: 1100,
    palette: {
      body: 0xffa040,
      bodyDark: 0xb85c14,
      belly: 0xfff4e0,
      accent: 0xffffff,
      eye: 0x5ee7ff,
      aura: 0xffc94d,
    },
    traits: T({ ears: "fox", tails: 9, mask: true, flames: true, halo: true }),
  },
  {
    id: "ryujin",
    name: "Ryūjin",
    desc: "Le dragon des mers. Le ciel lui appartient déjà.",
    rarity: "mythic",
    cost: 1800,
    palette: {
      body: 0x2ec4b6,
      bodyDark: 0x0d5c58,
      belly: 0xd7fff9,
      accent: 0xffc94d,
      eye: 0xffc94d,
      aura: 0x5ee7ff,
    },
    traits: T({ ears: "leaf", tails: 3, horns: true, halo: true, flames: true }),
  },
  {
    id: "amaterasu",
    name: "Amaterasu",
    desc: "L'aube elle-même. Débloquée par les plus tenaces.",
    rarity: "mythic",
    cost: 2600,
    palette: {
      body: 0xfff2c4,
      bodyDark: 0xd99a1a,
      belly: 0xffffff,
      accent: 0xff9ec4,
      eye: 0xff5a3c,
      aura: 0xffe9a8,
    },
    traits: T({ ears: "fox", tails: 5, mask: true, halo: true, flames: true }),
  },
  {
    id: "mizuneko",
    name: "Mizuneko",
    desc: "Ni tout à fait chat, ni tout à fait axolotl. Juste bioluminescent.",
    rarity: "epic",
    cost: 460,
    palette: {
      body: 0xffa8c9,
      bodyDark: 0xd1608f,
      belly: 0xfff1f7,
      // A cyan-jade blend — echoes PALETTE.spirit/jade so its glow reads as
      // part of the game's own light vocabulary rather than an invented hue.
      accent: 0x4ee2cd,
      eye: 0x5ee7ff,
      aura: 0x5ee7ff,
    },
    traits: T({ ears: "cat", tails: 1, gills: true }),
  },
];

export function getSkin(id: string): SkinDef {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const KEY = "yokaijump.skins.v2";
const LEGACY_KEY = "yokaijump.shop.v1";

interface SkinSave {
  owned: string[];
  equipped: string;
}

function readSave(): SkinSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SkinSave>;
      const owned = Array.isArray(parsed.owned) ? parsed.owned.filter((id) => SKINS.some((s) => s.id === id)) : [];
      if (!owned.includes("sakura")) owned.push("sakura");
      const equipped = typeof parsed.equipped === "string" && owned.includes(parsed.equipped) ? parsed.equipped : "sakura";
      return { owned, equipped };
    }
    return migrateLegacy();
  } catch {
    return { owned: ["sakura"], equipped: "sakura" };
  }
}

/**
 * The v1 shop stored an array of items whose only effect was a tint that the
 * game never applied. Honour anything already paid for by granting the skin at
 * the same catalog position.
 */
function migrateLegacy(): SkinSave {
  const save: SkinSave = { owned: ["sakura"], equipped: "sakura" };
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return save;
    const data = JSON.parse(raw) as { items?: Array<{ owned?: boolean }> };
    data.items?.forEach((item, i) => {
      const skin = SKINS[i];
      if (item?.owned && skin && !save.owned.includes(skin.id)) save.owned.push(skin.id);
    });
    writeSave(save);
  } catch {
    /* corrupt legacy data — start fresh */
  }
  return save;
}

function writeSave(save: SkinSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage unavailable (private mode) — skins simply won't persist */
  }
}

export function ownedSkins(): string[] {
  return readSave().owned;
}

export function isOwned(id: string): boolean {
  return readSave().owned.includes(id);
}

export function equippedSkinId(): string {
  return readSave().equipped;
}

export function equippedSkin(): SkinDef {
  return getSkin(equippedSkinId());
}

export function unlockSkin(id: string): void {
  const save = readSave();
  if (!save.owned.includes(id)) save.owned.push(id);
  writeSave(save);
}

export function equipSkin(id: string): void {
  const save = readSave();
  if (!save.owned.includes(id)) return;
  save.equipped = id;
  writeSave(save);
}
