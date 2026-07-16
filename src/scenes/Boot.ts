import { Scene } from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config/constants";
import { PALETTE } from "../config/theme";

export class Boot extends Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    const g = this.add.graphics();
    g.fillStyle(PALETTE.void, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.destroy();

    this.scene.start("Preloader");
  }
}
