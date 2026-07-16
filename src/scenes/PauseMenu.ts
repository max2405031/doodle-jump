import { Scene } from "phaser";

import { DEPTH, PALETTE, TEXT } from "../config/theme";
import { AudioManager } from "../systems/Audio";
import { makeButton, makePanel } from "../ui/UIKit";
import type { GameConfig } from "./Game";

/**
 * The pause overlay, drawn on top of the frozen Game. "Recommencer" reads the
 * run's config from the registry so it restarts the *same* level — infinite,
 * campaign or a custom creation — rather than always dropping into infinite mode.
 */
export class PauseMenu extends Scene {
  constructor() {
    super("PauseMenu");
  }

  create(): void {
    const { width, height } = this.scale;

    const layer = this.add.container(0, 0).setDepth(DEPTH.modal);
    const shade = this.add
      .rectangle(width / 2, height / 2, width, height, PALETTE.void, 0.78)
      .setInteractive();
    const panel = makePanel(this, width / 2, height / 2, 360, 400);
    const title = this.add.text(width / 2, height / 2 - 150, "PAUSE", TEXT.title(40)).setOrigin(0.5);

    layer.add([shade, panel, title]);

    const config = (this.registry.get("gameConfig") as GameConfig) ?? {};

    const buttons = [
      makeButton(this, width / 2, height / 2 - 66, "REPRENDRE", () => this.resume(), {
        width: 260,
        height: 54,
        fontSize: 20,
      }),
      makeButton(this, width / 2, height / 2, "RECOMMENCER", () => this.restart(config), {
        width: 260,
        height: 50,
        fontSize: 18,
        variant: "secondary",
      }),
      makeButton(this, width / 2, height / 2 + 62, "RÉGLAGES", () => this.openSettings(), {
        width: 260,
        height: 50,
        fontSize: 18,
        variant: "secondary",
      }),
      makeButton(this, width / 2, height / 2 + 128, "QUITTER", () => this.quit(config), {
        width: 260,
        height: 48,
        fontSize: 17,
        variant: "ghost",
      }),
    ];
    layer.add(buttons);

    layer.setAlpha(0);
    panel.setScale(0.94);
    this.tweens.add({ targets: layer, alpha: 1, duration: 180 });
    this.tweens.add({ targets: panel, scale: 1, duration: 260, ease: "Back.easeOut" });

    this.input.keyboard?.once("keydown-ESC", () => this.resume());
  }

  private resume(): void {
    AudioManager.play("click");
    this.scene.stop("PauseMenu");
    this.scene.resume("Game");
  }

  private restart(config: GameConfig): void {
    this.scene.stop("PauseMenu");
    this.scene.stop("Game");
    this.scene.start("Game", config);
  }

  private openSettings(): void {
    this.scene.stop("PauseMenu");
    this.scene.launch("Settings", { from: "PauseMenu" });
  }

  private quit(config: GameConfig): void {
    this.scene.stop("PauseMenu");
    this.scene.stop("Game");
    // Level modes return to the levels hub; infinite returns to the main menu.
    const target = config.mode === "campaign" || config.mode === "custom" ? "Levels" : "MainMenu";
    this.scene.start(target);
  }
}
