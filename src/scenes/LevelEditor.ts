import { Scene } from "phaser";

import {
  BIOMES,
  ENEMY_KEYS,
  ENEMY_SIZE,
  PLATFORM_KEYS,
  PLAT_H,
  PLAT_W,
  POWERUP_KEYS,
  UI,
  bgKey,
  enemyKey,
  platKey,
  powerUpKey,
  type EnemyKind,
  type PlatformKind,
  type PowerUpKind,
} from "../art/keys";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { CSS, DEPTH, FONT, PALETTE, TEXT } from "../config/theme";
import {
  getCustomLevel,
  makeDraftLevel,
  upsertCustomLevel,
  type CustomLevel,
  type PlacedItem,
} from "../config/levels";
import { recordPublish } from "../config/stats";
import { AudioManager } from "../systems/Audio";
import { loadPlayerName } from "./Levels";
import {
  fadeIn,
  makeButton,
  makePrompt,
  makeToast,
  transitionTo,
  type Button,
} from "../ui/UIKit";

type Brush =
  | { cat: "platform"; kind: PlatformKind }
  | { cat: "enemy"; kind: EnemyKind }
  | { cat: "coin" }
  | { cat: "powerup"; kind: PowerUpKind }
  | { cat: "eraser" };

type Category = "platform" | "enemy" | "item" | "eraser";

const FLOOR_Y = GAME_HEIGHT - 26;
const GRID = 20;
const CANVAS_TOP = 58;
const CANVAS_BOTTOM = 622;
const LIVES_CYCLE = [1, 3, 5];

const PLATFORM_LABEL: Record<PlatformKind, string> = {
  toro: "Pierre",
  bamboo: "Bambou",
  kumo: "Nuage",
  lotus: "Lotus",
  glace: "Glace",
  cursed: "Maudit",
};

/** Short biome names — the fancy titles overflow the little chip. */
const SHORT_BIOME: Record<string, string> = {
  village: "Village",
  forest: "Forêt",
  mountain: "Montagne",
  clouds: "Nuages",
  storm: "Orage",
  cosmos: "Cosmos",
};

/**
 * The level editor.
 *
 * You paint platforms, yokai, coins and power-ups onto a vertical strip, set the
 * biome and lives, then hit *Tester*. Publishing stays locked until you have
 * actually climbed your own creation to the finish — a level nobody can beat can
 * never reach the community list.
 */
export class LevelEditor extends Scene {
  private level!: CustomLevel;
  private brush: Brush = { cat: "platform", kind: "toro" };
  private category: Category = "platform";

  private placed: { item: PlacedItem; obj: Phaser.GameObjects.GameObject }[] = [];
  private scroll = 0;
  private minScroll = 0;
  private maxScroll = 0;

  private bgLayer!: Phaser.GameObjects.TileSprite;
  private world!: Phaser.GameObjects.Container;
  private guides!: Phaser.GameObjects.Container;

  private statusText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private biomeText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private brushText!: Phaser.GameObjects.Text;
  private publishBtn!: Button;

  private chipRow: Phaser.GameObjects.GameObject[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super("LevelEditor");
  }

  init(data: { levelId?: string; justValidated?: boolean }): void {
    const existing = data?.levelId ? getCustomLevel(data.levelId) : undefined;
    this.level = existing ?? makeDraftLevel(loadPlayerName());
    if (data?.justValidated) {
      this.level.validated = true;
      upsertCustomLevel(this.level);
    }
    this.placed = [];
    // Scroll is measured so screenY = worldY − scroll: max shows the start floor
    // near the canvas bottom, min lifts the finish gate near the canvas top.
    this.maxScroll = FLOOR_Y - CANVAS_BOTTOM + 60;
    this.minScroll = FLOOR_Y - this.level.height - CANVAS_TOP - 60;
    this.scroll = this.maxScroll;
    this.brush = { cat: "platform", kind: "toro" };
    this.category = "platform";
  }

  create(): void {
    const { width, height } = this.scale;

    // Dim biome backdrop for flavour; the grid lives on top of it.
    this.bgLayer = this.add
      .tileSprite(width / 2, height / 2, width, height, bgKey(this.level.biome, 0))
      .setScrollFactor(0)
      .setAlpha(0.5)
      .setDepth(DEPTH.bgFar);
    this.add
      .rectangle(width / 2, height / 2, width, height, PALETTE.void, 0.45)
      .setScrollFactor(0)
      .setDepth(DEPTH.bgFar);

    this.world = this.add.container(0, 0).setDepth(DEPTH.platform);
    this.guides = this.add.container(0, 0).setDepth(DEPTH.props);

    this.buildGuides();
    this.renderExisting();

    this.buildTopBar();
    this.buildPalette();
    this.buildActions();

    // Placement surface: an interactive zone under the toolbars catches taps.
    const zone = this.add
      .zone(width / 2, (CANVAS_TOP + CANVAS_BOTTOM) / 2, width, CANVAS_BOTTOM - CANVAS_TOP)
      .setScrollFactor(0)
      .setInteractive();
    zone.on("pointerdown", (p: Phaser.Input.Pointer) => this.onCanvasTap(p));

    this.buildScrollButtons();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollBy(dy * 0.6));
    this.input.keyboard?.on("keydown-ESC", () => this.saveAndExit());

    this.applyScroll();
    fadeIn(this);
    this.input.once("pointerdown", () => AudioManager.init());

    if (this.level.validated) this.refreshStatus();
  }

  update(): void {
    if (this.cursors.up.isDown) this.scrollBy(-8);
    else if (this.cursors.down.isDown) this.scrollBy(8);
  }

  /* ------------------------------------------------------------------ */
  /* World rendering                                                     */
  /* ------------------------------------------------------------------ */

  private worldY(altitude: number): number {
    return FLOOR_Y - altitude;
  }

  private buildGuides(): void {
    // Start floor.
    const floor = this.add
      .rectangle(GAME_WIDTH / 2, FLOOR_Y + 12, GAME_WIDTH, 26, PALETTE.surfaceHi, 0.9)
      .setStrokeStyle(2, PALETTE.borderHi);
    const startLabel = this.add.text(12, FLOOR_Y - 6, "DÉPART", TEXT.label(12, CSS.textDim)).setOrigin(0, 1);
    this.guides.add([floor, startLabel]);

    // Altitude guides.
    for (let a = GRID * 10; a < this.level.height; a += 200) {
      const y = this.worldY(a);
      const line = this.add.rectangle(GAME_WIDTH / 2, y, GAME_WIDTH - 20, 1, PALETTE.border, 0.5);
      const tag = this.add.text(12, y - 2, String(a), TEXT.label(10, CSS.textFaint)).setOrigin(0, 1);
      this.guides.add([line, tag]);
    }

    // Finish gate.
    const gy = this.worldY(this.level.height);
    const gate = this.add.image(GAME_WIDTH / 2, gy - 14, UI.torii).setDisplaySize(200, 166).setAlpha(0.92);
    const line = this.add
      .rectangle(GAME_WIDTH / 2, gy, GAME_WIDTH, 3, PALETTE.jade, 0.8)
      .setBlendMode(Phaser.BlendModes.ADD);
    const label = this.add.text(GAME_WIDTH / 2, gy - 92, "ARRIVÉE", { ...TEXT.heading(18), color: CSS.jade }).setOrigin(0.5);
    this.guides.add([gate, line, label]);
  }

  private renderExisting(): void {
    this.level.items.forEach((item) => this.spawnObject(item));
  }

  /** Creates the visual for a placed item and tracks it. */
  private spawnObject(item: PlacedItem): void {
    const y = this.worldY(item.y);
    let obj: Phaser.GameObjects.GameObject;

    switch (item.type) {
      case "platform": {
        const s = this.add.image(item.x, y, platKey(item.kind)).setDisplaySize(PLAT_W, PLAT_H);
        obj = s;
        break;
      }
      case "enemy": {
        const size = ENEMY_SIZE[item.kind];
        obj = this.add.image(item.x, y, enemyKey(item.kind)).setDisplaySize(size.w, size.h);
        break;
      }
      case "coin":
        obj = this.add.image(item.x, y, UI.coinIcon).setDisplaySize(20, 20);
        break;
      case "powerup":
        obj = this.add.image(item.x, y, powerUpKey(item.kind)).setDisplaySize(30, 30);
        break;
    }

    this.world.add(obj);
    this.placed.push({ item, obj });
  }

  /* ------------------------------------------------------------------ */
  /* Placement                                                           */
  /* ------------------------------------------------------------------ */

  private onCanvasTap(p: Phaser.Input.Pointer): void {
    const worldY = p.y + this.scroll;
    const snapX = Phaser.Math.Clamp(Math.round(p.x / GRID) * GRID, 30, GAME_WIDTH - 30);
    const snapWorldY = Math.round(worldY / GRID) * GRID;
    const altitude = Phaser.Math.Clamp(FLOOR_Y - snapWorldY, 40, this.level.height - 40);

    if (this.brush.cat === "eraser") {
      this.eraseNear(snapX, altitude);
      return;
    }

    // One item per cell: clear whatever is already there first.
    this.removeAtCell(snapX, altitude);

    const item = this.makeItem(snapX, altitude);
    this.level.items.push(item);
    this.spawnObject(item);
    AudioManager.play("click");
    this.dirtyValidation();
    this.refreshStatus();
  }

  private makeItem(x: number, y: number): PlacedItem {
    switch (this.brush.cat) {
      case "platform":
        return { type: "platform", x, y, kind: this.brush.kind };
      case "enemy":
        return { type: "enemy", x, y, kind: this.brush.kind };
      case "coin":
        return { type: "coin", x, y };
      case "powerup":
        return { type: "powerup", x, y, kind: this.brush.kind };
      case "eraser":
        return { type: "coin", x, y }; // unreachable; keeps the switch total
    }
  }

  private removeAtCell(x: number, altitude: number): void {
    const hit = this.placed.filter(
      (p) => Math.abs(p.item.x - x) < GRID && Math.abs(p.item.y - altitude) < GRID
    );
    hit.forEach((h) => this.removeEntry(h));
  }

  private eraseNear(x: number, altitude: number): void {
    let best: (typeof this.placed)[number] | undefined;
    let bestD = Infinity;
    for (const p of this.placed) {
      const dx = p.item.x - x;
      const dy = p.item.y - altitude;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best && bestD < 44 * 44) {
      this.removeEntry(best);
      AudioManager.play("break");
      this.dirtyValidation();
      this.refreshStatus();
    }
  }

  private removeEntry(entry: { item: PlacedItem; obj: Phaser.GameObjects.GameObject }): void {
    entry.obj.destroy();
    this.placed = this.placed.filter((p) => p !== entry);
    this.level.items = this.level.items.filter((it) => it !== entry.item);
  }

  /** Editing after a validation invalidates it — the level must be re-beaten. */
  private dirtyValidation(): void {
    if (this.level.validated || this.level.published) {
      this.level.validated = false;
      this.level.published = false;
      this.refreshStatus();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Scrolling                                                           */
  /* ------------------------------------------------------------------ */

  private scrollBy(dy: number): void {
    this.scroll = Phaser.Math.Clamp(this.scroll + dy, this.minScroll, this.maxScroll);
    this.applyScroll();
  }

  private applyScroll(): void {
    this.world.y = -this.scroll;
    this.guides.y = -this.scroll;
    this.bgLayer.tilePositionY = this.scroll * 0.3;
  }

  /* ------------------------------------------------------------------ */
  /* Top bar                                                             */
  /* ------------------------------------------------------------------ */

  private buildTopBar(): void {
    const { width } = this.scale;
    this.add
      .rectangle(width / 2, 28, width, 56, PALETTE.bgDeep, 0.96)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud - 1);

    this.nameText = this.add
      .text(14, 16, this.level.name, TEXT.button(18))
      .setScrollFactor(0)
      .setDepth(DEPTH.hud)
      .setInteractive({ cursor: "pointer" });
    this.nameText.on("pointerdown", () => this.renameLevel());

    this.statusText = this.add
      .text(14, 40, "", TEXT.label(11, CSS.textFaint))
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    this.biomeText = this.chipButton(width - 210, 28, "", () => this.cycleBiome());
    this.livesText = this.chipButton(width - 96, 28, "", () => this.cycleLives());

    this.refreshStatus();
  }

  private chipButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const bg = this.add
      .image(x, y, UI.btn)
      .setDisplaySize(104, 38)
      .setTint(PALETTE.surfaceHi)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
    const t = this.add
      .text(x, y, label, { fontFamily: FONT.ui, fontSize: "13px", color: CSS.text })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1);
    bg.setInteractive({ cursor: "pointer" });
    bg.on("pointerover", () => bg.setTint(PALETTE.borderHi));
    bg.on("pointerout", () => bg.setTint(PALETTE.surfaceHi));
    bg.on("pointerdown", () => {
      AudioManager.play("click");
      onClick();
    });
    return t;
  }

  private refreshStatus(): void {
    const s = this.level;
    const status = s.published ? "PUBLIÉ" : s.validated ? "VALIDÉ — prêt à publier" : "Brouillon — non validé";
    this.statusText.setText(`${status}   •   ${this.placed.length} éléments`);
    this.statusText.setColor(s.published ? CSS.jade : s.validated ? CSS.spirit : CSS.textFaint);
    this.biomeText.setText(SHORT_BIOME[s.biome] ?? s.biome);
    this.livesText.setText(s.lives === 1 ? "1 vie" : `${s.lives} vies`);
    this.nameText.setText(s.name);
    if (this.publishBtn) this.publishBtn.setEnabled(s.validated && !s.published);
  }

  private cycleBiome(): void {
    const i = BIOMES.indexOf(this.level.biome);
    this.level.biome = BIOMES[(i + 1) % BIOMES.length];
    this.bgLayer.setTexture(bgKey(this.level.biome, 0));
    this.dirtyValidation();
    this.refreshStatus();
  }

  private cycleLives(): void {
    const i = LIVES_CYCLE.indexOf(this.level.lives);
    this.level.lives = LIVES_CYCLE[(i + 1) % LIVES_CYCLE.length];
    this.refreshStatus();
  }

  private renameLevel(): void {
    makePrompt(this, "NOM DU NIVEAU", {
      maxLength: 12,
      onConfirm: (v) => {
        this.level.name = v.trim() || "Nouveau niveau";
        this.refreshStatus();
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Palette                                                             */
  /* ------------------------------------------------------------------ */

  private buildPalette(): void {
    const { width } = this.scale;
    this.add
      .rectangle(width / 2, 686, width, 128, PALETTE.bgDeep, 0.96)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud - 1);

    this.brushText = this.add
      .text(width / 2, 638, "", TEXT.label(13, CSS.gold))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    const tabs: { key: Category; label: string }[] = [
      { key: "platform", label: "Plateformes" },
      { key: "enemy", label: "Yokai" },
      { key: "item", label: "Objets" },
      { key: "eraser", label: "Gomme" },
    ];
    const tabW = 116;
    const startX = width / 2 - ((tabs.length - 1) * tabW) / 2;
    tabs.forEach((tab, i) => {
      const t = this.add
        .text(startX + i * tabW, 662, tab.label, TEXT.button(14))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud)
        .setInteractive({ cursor: "pointer" });
      t.setColor(this.category === tab.key ? CSS.gold : CSS.textDim);
      t.on("pointerdown", () => this.selectCategory(tab.key));
      t.setData("cat", tab.key);
    });

    this.selectCategory("platform");
  }

  private selectCategory(cat: Category): void {
    this.category = cat;
    // Recolour tabs.
    this.children.list.forEach((o) => {
      const t = o as Phaser.GameObjects.Text;
      if (t.getData && t.getData("cat")) {
        t.setColor(t.getData("cat") === cat ? CSS.gold : CSS.textDim);
      }
    });

    this.chipRow.forEach((c) => c.destroy());
    this.chipRow = [];

    if (cat === "eraser") {
      this.brush = { cat: "eraser" };
      this.brushText.setText("Gomme — touche un élément pour l'effacer");
      return;
    }

    const brushes = this.brushesFor(cat);
    const chipW = 46;
    const startX = this.scale.width / 2 - ((brushes.length - 1) * chipW) / 2;
    brushes.forEach((b, i) => this.buildChip(startX + i * chipW, 704, b));
    // Default to the first brush of the category, chip highlighted.
    this.setBrush(brushes[0].brush, brushes[0].label);
    if (this.chipRow[0]) this.highlightChip(this.chipRow[0] as Phaser.GameObjects.Image);
  }

  private brushesFor(cat: Category): { brush: Brush; texture: string; label: string; size: number }[] {
    if (cat === "platform") {
      return PLATFORM_KEYS.map((k) => ({
        brush: { cat: "platform", kind: k } as Brush,
        texture: platKey(k),
        label: PLATFORM_LABEL[k],
        size: 38,
      }));
    }
    if (cat === "enemy") {
      return ENEMY_KEYS.map((k) => ({
        brush: { cat: "enemy", kind: k } as Brush,
        texture: enemyKey(k),
        label: k,
        size: 34,
      }));
    }
    // item = coin + power-ups
    const items: { brush: Brush; texture: string; label: string; size: number }[] = [
      { brush: { cat: "coin" }, texture: UI.coinIcon, label: "Pièce", size: 26 },
    ];
    POWERUP_KEYS.forEach((k) => items.push({ brush: { cat: "powerup", kind: k }, texture: powerUpKey(k), label: k, size: 30 }));
    return items;
  }

  private buildChip(x: number, y: number, def: { brush: Brush; texture: string; label: string; size: number }): void {
    const frame = this.add
      .image(x, y, UI.btn)
      .setDisplaySize(42, 42)
      .setTint(PALETTE.surface)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
    const icon = this.add
      .image(x, y, def.texture)
      .setDisplaySize(def.size, def.size)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1);
    frame.setInteractive({ cursor: "pointer" });
    frame.on("pointerdown", () => {
      AudioManager.play("click");
      this.setBrush(def.brush, def.label);
      this.highlightChip(frame);
    });
    frame.setData("chip", true);
    this.chipRow.push(frame, icon);
  }

  private highlightChip(active: Phaser.GameObjects.Image): void {
    this.chipRow.forEach((c) => {
      const img = c as Phaser.GameObjects.Image;
      if (img.getData && img.getData("chip")) img.setTint(img === active ? PALETTE.gold : PALETTE.surface);
    });
  }

  private setBrush(brush: Brush, label: string): void {
    this.brush = brush;
    this.brushText.setText(`Pinceau — ${label}`);
  }

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  private buildActions(): void {
    const { width, height } = this.scale;
    this.add
      .rectangle(width / 2, height - 26, width, 52, PALETTE.void, 0.9)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud - 1);

    makeButton(this, 96, height - 26, "TESTER", () => this.test(), {
      width: 150,
      height: 44,
      fontSize: 17,
    }).setScrollFactor(0).setDepth(DEPTH.hud);

    this.publishBtn = makeButton(this, 258, height - 26, "PUBLIER", () => this.publish(), {
      width: 150,
      height: 44,
      fontSize: 17,
      variant: "secondary",
      enabled: this.level.validated && !this.level.published,
    });
    this.publishBtn.setScrollFactor(0).setDepth(DEPTH.hud);

    makeButton(this, width - 76, height - 26, "RETOUR", () => this.saveAndExit(), {
      width: 120,
      height: 44,
      fontSize: 15,
      variant: "ghost",
    }).setScrollFactor(0).setDepth(DEPTH.hud);
  }

  private test(): void {
    if (this.level.items.length < 3) {
      AudioManager.play("denied");
      makeToast(this, "Place au moins quelques plateformes d'abord", "error");
      return;
    }
    upsertCustomLevel(this.level);
    transitionTo(this, "Game", { mode: "custom", level: this.level, validating: true });
  }

  private publish(): void {
    if (!this.level.validated) {
      AudioManager.play("denied");
      makeToast(this, "Termine ton niveau (Tester) pour le publier", "error");
      return;
    }
    this.level.published = true;
    upsertCustomLevel(this.level);
    recordPublish();
    AudioManager.play("questComplete");
    makeToast(this, "Niveau publié dans la communauté !", "success");
    this.refreshStatus();
  }

  private saveAndExit(): void {
    upsertCustomLevel(this.level);
    transitionTo(this, "Levels", { tab: "creations" });
  }

  /* ------------------------------------------------------------------ */
  /* Scroll buttons                                                      */
  /* ------------------------------------------------------------------ */

  private buildScrollButtons(): void {
    const { width } = this.scale;
    const up = this.add
      .image(width - 30, CANVAS_TOP + 24, UI.chevron)
      .setDisplaySize(30, 30)
      .setAngle(90)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud)
      .setInteractive({ cursor: "pointer" });
    up.on("pointerdown", () => this.scrollBy(-200));

    const down = this.add
      .image(width - 30, CANVAS_BOTTOM - 24, UI.chevron)
      .setDisplaySize(30, 30)
      .setAngle(-90)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud)
      .setInteractive({ cursor: "pointer" });
    down.on("pointerdown", () => this.scrollBy(200));
  }
}
