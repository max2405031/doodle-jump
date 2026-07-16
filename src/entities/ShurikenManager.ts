import { Scene } from "phaser";
import { FX } from "../art/keys";
import { GAME_HEIGHT } from "../config/constants";
import { DEPTH } from "../config/theme";

export class ShurikenManager {
  private shurikens: Phaser.Physics.Arcade.Group;
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
    this.shurikens = scene.physics.add.group({
      allowGravity: false,
    });
  }

  getGroup(): Phaser.Physics.Arcade.Group {
    return this.shurikens;
  }

  shoot(x: number, y: number): void {
    // Only 3 shurikens on screen at a time
    if (this.shurikens.countActive(true) >= 3) return;

    const shuriken = this.shurikens.create(x, y - 20, FX.star) as Phaser.Physics.Arcade.Sprite;
    shuriken.setDisplaySize(24, 24);
    shuriken.setDepth(DEPTH.player - 1);
    
    // Make the body smaller for more precise hits
    const body = shuriken.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 12);
    
    // Shoot straight up
    body.setVelocityY(-800);

    // Spin animation
    this.scene.tweens.add({
      targets: shuriken,
      angle: 360,
      duration: 300,
      repeat: -1,
    });
  }

  update(cameraY: number): void {
    this.shurikens.getChildren().forEach((child) => {
      const shuriken = child as Phaser.Physics.Arcade.Sprite;
      if (shuriken.y < cameraY - 100 || shuriken.y > cameraY + GAME_HEIGHT + 100) {
        shuriken.destroy();
      }
    });
  }

  destroy(): void {
    this.shurikens.clear(true, true);
  }
}
