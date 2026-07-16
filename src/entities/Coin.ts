import { Scene } from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  COIN_PLATFORM_CHANCE,
  COIN_ARC_CHANCE,
  COIN_ARC_COUNT,
  COIN_VALUE,
  COIN_MAGNET_SPEED,
} from "../config/constants";
import { type PlatformSpawn } from "./Platform";
import { UI } from "../art/keys";
import { DEPTH } from "../config/theme";

export interface CoinData {
  sprite: Phaser.Physics.Arcade.Sprite;
  collected: boolean;
}

export class CoinManager {
  private coins: Phaser.Physics.Arcade.Group;
  private dataList: CoinData[] = [];
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
    this.coins = scene.physics.add.group({
      allowGravity: false,
      immovable: true,
    });
  }

  getGroup(): Phaser.Physics.Arcade.Group {
    return this.coins;
  }

  spawnFromPlatforms(platforms: PlatformSpawn[]): void {
    platforms.forEach((p) => {
      if (!p.solid) return;
      if (Math.random() < COIN_ARC_CHANCE) {
        this.spawnArc(p.x, p.y);
      } else if (Math.random() < COIN_PLATFORM_CHANCE) {
        this.spawnAt(p.x, p.y - 30);
      }
    });
  }

  private spawnArc(startX: number, baseY: number): void {
    const dir = startX < GAME_WIDTH / 2 ? 1 : -1;
    for (let i = 0; i < COIN_ARC_COUNT; i++) {
      const x = startX + dir * i * 35;
      const y = baseY - 50 - Math.sin((i / (COIN_ARC_COUNT - 1)) * Math.PI) * 60;
      this.spawnAt(x, y);
    }
  }

  spawnAt(x: number, y: number): void {
    const sprite = this.coins.create(x, y, UI.coinIcon) as Phaser.Physics.Arcade.Sprite;
    sprite.setDisplaySize(18, 18);
    sprite.setDepth(DEPTH.pickup);
    sprite.refreshBody();

    this.scene.tweens.add({
      targets: sprite,
      y: sprite.y - 5,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.scene.tweens.add({
      targets: sprite,
      alpha: { from: 0.85, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.dataList.push({ sprite, collected: false });
  }

  attractToPlayer(playerX: number, playerY: number, radius: number): void {
    this.dataList.forEach((data) => {
      if (data.collected || !data.sprite.active) return;
      const dx = playerX - data.sprite.x;
      const dy = playerY - data.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius && dist > 10) {
        const body = data.sprite.body as Phaser.Physics.Arcade.Body;
        body.setVelocityX((dx / dist) * COIN_MAGNET_SPEED);
        body.setVelocityY((dy / dist) * COIN_MAGNET_SPEED);
      }
    });
  }

  collect(sprite: Phaser.GameObjects.Sprite): number {
    const data = this.dataList.find((d) => d.sprite === sprite);
    if (!data || data.collected) return 0;
    data.collected = true;
    sprite.destroy();
    return COIN_VALUE;
  }

  update(cameraY: number): void {
    const toRemove: CoinData[] = [];
    this.dataList.forEach((data) => {
      if (!data.sprite.active || data.collected) {
        toRemove.push(data);
        return;
      }
      if (data.sprite.y > cameraY + GAME_HEIGHT + 100) {
        data.sprite.destroy();
        toRemove.push(data);
      }
    });
    toRemove.forEach((d) => {
      const idx = this.dataList.indexOf(d);
      if (idx >= 0) this.dataList.splice(idx, 1);
    });
  }

  destroy(): void {
    this.dataList = [];
    this.coins.clear(true, true);
  }
}
