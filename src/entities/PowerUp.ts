import { Scene } from "phaser";
import {
  GAME_HEIGHT,
  POWERUP_MIN_SPACING,
  POWERUP_PLATFORM_CHANCE,
  POWERUP_WEIGHT,
} from "../config/constants";
import { type PowerUpKind, powerUpKey } from "../art/keys";
import { type PlatformSpawn } from "./Platform";
import { DEPTH } from "../config/theme";

export interface PowerUpData {
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: PowerUpKind;
}

export class PowerUpManager {
  private powerUps: Phaser.Physics.Arcade.Group;
  private dataList: PowerUpData[] = [];
  private lastSpawnY = 0;

  constructor(scene: Scene) {
    this.powerUps = scene.physics.add.group({
      allowGravity: false,
      immovable: true,
    });
  }

  getGroup(): Phaser.Physics.Arcade.Group {
    return this.powerUps;
  }

  spawnFromPlatforms(platforms: PlatformSpawn[]): void {
    platforms.forEach((p) => {
      if (!p.solid) return;
      if (Math.abs(p.y - this.lastSpawnY) < POWERUP_MIN_SPACING) return;
      if (Math.random() < POWERUP_PLATFORM_CHANCE) {
        this.spawn(p.x, p.y - 30);
        this.lastSpawnY = p.y;
      }
    });
  }

  private spawn(x: number, y: number): void {
    const keys = Object.keys(POWERUP_WEIGHT) as PowerUpKind[];
    let totalWeight = 0;
    keys.forEach((k) => (totalWeight += POWERUP_WEIGHT[k]));
    let roll = Math.random() * totalWeight;
    let kind: PowerUpKind = keys[0];
    for (const k of keys) {
      roll -= POWERUP_WEIGHT[k];
      if (roll <= 0) {
        kind = k;
        break;
      }
    }
    this.placePowerUp(x, y, kind);
  }

  /** Drops a specific power-up at a world coordinate (authored levels). */
  placePowerUp(x: number, y: number, kind: PowerUpKind): void {
    const sprite = this.powerUps.create(x, y, powerUpKey(kind)) as Phaser.Physics.Arcade.Sprite;
    sprite.setDepth(DEPTH.pickup);
    sprite.refreshBody();

    const scene = this.powerUps.scene;
    scene.tweens.add({
      targets: sprite,
      y: sprite.y - 6,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.dataList.push({ sprite, kind });
  }

  update(cameraY: number): void {
    const toRemove: PowerUpData[] = [];
    this.dataList.forEach((data) => {
      if (!data.sprite.active) {
        toRemove.push(data);
        return;
      }
      if (data.sprite.y > cameraY + GAME_HEIGHT + 200) {
        data.sprite.destroy();
        toRemove.push(data);
      }
    });
    toRemove.forEach((d) => {
      const idx = this.dataList.indexOf(d);
      if (idx >= 0) this.dataList.splice(idx, 1);
    });
  }

  getKind(sprite: Phaser.GameObjects.Sprite): PowerUpKind | undefined {
    const data = this.dataList.find((d) => d.sprite === sprite);
    return data?.kind;
  }

  destroy(): void {
    this.dataList = [];
    this.powerUps.clear(true, true);
  }
}
