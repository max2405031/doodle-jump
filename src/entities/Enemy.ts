import { Scene } from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  ENEMY_SPACING_EASY,
  ENEMY_SPACING_HARD,
  ENEMY_FIRST_SCORE,
  ENEMY_MAX_ACTIVE,
  ENEMY_UNLOCK,
  ENEMY_WEIGHT,
  ENEMY_HP,
  ENEMY_STOMPABLE,
  ENEMY_BODY_W,
  ENEMY_BODY_H,
  difficultyAt,
  ramp,
} from "../config/constants";
import { enemyKey, enemyAnim, type EnemyKind, ENEMY_SIZE } from "../art/keys";
import { DEPTH } from "../config/theme";

export interface EnemyData {
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: EnemyKind;
  hp: number;
  stompable: boolean;
  moveTimer: number;
  moveDir: number;
  baseY: number;
  baseX: number;
}

/** Fixed campaign roster: these species, at this spacing, whatever the score. */
export interface EnemyPlan {
  kinds: EnemyKind[];
  spacing: number;
}

export interface EnemyOpts {
  plan?: EnemyPlan;
  /** False for authored levels, where every yokai is placed by hand. */
  generate?: boolean;
}

export class EnemyManager {
  private enemies: Phaser.Physics.Arcade.Group;
  private dataList: EnemyData[] = [];
  private lastSpawnY = 0;

  private plan?: EnemyPlan;
  private generate: boolean;

  constructor(scene: Scene, opts: EnemyOpts = {}) {
    this.enemies = scene.physics.add.group({
      allowGravity: false,
      immovable: true,
    });
    this.plan = opts.plan;
    this.generate = opts.generate ?? true;
  }

  getGroup(): Phaser.Physics.Arcade.Group {
    return this.enemies;
  }

  update(delta: number, cameraY: number, score: number): void {
    if (this.generate) this.spawnIfReady(cameraY, score);

    const toRemove: EnemyData[] = [];

    this.dataList.forEach((data) => {
      const body = data.sprite.body as Phaser.Physics.Arcade.Body;
      if (!data.sprite.active) {
        toRemove.push(data);
        return;
      }

      data.moveTimer += delta;

      switch (data.kind) {
        case "kappa":
          body.setVelocityX(50 * data.moveDir);
          if (data.sprite.x < 30 && data.moveDir < 0) {
            data.moveDir = 1;
            data.sprite.setFlipX(true);
          } else if (data.sprite.x > GAME_WIDTH - 30 && data.moveDir > 0) {
            data.moveDir = -1;
            data.sprite.setFlipX(false);
          }
          break;
        case "tengu":
          data.sprite.x = data.baseX + Math.sin(data.moveTimer / 600) * 80;
          break;
        case "karakasa":
          if (data.sprite.y > data.baseY + 50) {
            body.setVelocityY(-70);
          } else if (data.sprite.y < data.baseY - 50) {
            body.setVelocityY(70);
          }
          break;
        case "oni":
          body.setVelocityX(35 * data.moveDir);
          if (data.sprite.x < 40 && data.moveDir < 0) {
            data.moveDir = 1;
            data.sprite.setFlipX(false);
          } else if (data.sprite.x > GAME_WIDTH - 40 && data.moveDir > 0) {
            data.moveDir = -1;
            data.sprite.setFlipX(true);
          }
          break;
        case "yurei":
          data.sprite.x = data.baseX + Math.cos(data.moveTimer / 800) * 100;
          data.sprite.y = data.baseY + Math.sin(data.moveTimer / 500) * 30;
          break;
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

  private spawnIfReady(cameraY: number, score: number): void {
    if (this.dataList.length >= ENEMY_MAX_ACTIVE) return;

    let spacing: number;
    if (this.plan) {
      spacing = this.plan.spacing;
    } else {
      if (score < ENEMY_FIRST_SCORE) return;
      const t = difficultyAt(score);
      spacing = ramp(ENEMY_SPACING_EASY, ENEMY_SPACING_HARD, t);
    }
    if (!Number.isFinite(spacing)) return;

    const spawnY = cameraY - 150;
    if (Math.abs(spawnY - this.lastSpawnY) < spacing) return;

    const kind = this.pickKind(score);
    if (!kind) return;
    this.place(Phaser.Math.Between(40, GAME_WIDTH - 40), spawnY, kind);
    this.lastSpawnY = spawnY;
  }

  /** Weighted draw from the active roster — the plan's list, or the score gate. */
  private pickKind(score: number): EnemyKind | undefined {
    const pool: { kind: EnemyKind; weight: number }[] = [];
    let total = 0;

    if (this.plan) {
      for (const k of this.plan.kinds) {
        pool.push({ kind: k, weight: ENEMY_WEIGHT[k] });
        total += ENEMY_WEIGHT[k];
      }
    } else {
      for (const k of Object.keys(ENEMY_WEIGHT) as EnemyKind[]) {
        if (score < ENEMY_UNLOCK[k]) continue;
        pool.push({ kind: k, weight: ENEMY_WEIGHT[k] });
        total += ENEMY_WEIGHT[k];
      }
    }
    if (pool.length === 0) return undefined;

    let roll = Math.random() * total;
    for (const p of pool) {
      roll -= p.weight;
      if (roll <= 0) return p.kind;
    }
    return pool[pool.length - 1].kind;
  }

  /** Creates one yokai at a world coordinate — used by both spawners and authors. */
  place(x: number, y: number, kind: EnemyKind): void {
    const sprite = this.enemies.create(x, y, enemyKey(kind)) as Phaser.Physics.Arcade.Sprite;
    const size = ENEMY_SIZE[kind];
    sprite.setDisplaySize(size.w, size.h);
    sprite.setDepth(DEPTH.enemy);
    sprite.play(enemyAnim(kind));

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(size.w * ENEMY_BODY_W, size.h * ENEMY_BODY_H);

    const moveDir = Math.random() < 0.5 ? -1 : 1;
    if (kind === "oni") sprite.setFlipX(moveDir < 0);
    else sprite.setFlipX(moveDir > 0);

    const data: EnemyData = {
      sprite,
      kind,
      hp: ENEMY_HP[kind] || 1,
      stompable: ENEMY_STOMPABLE[kind],
      moveTimer: 0,
      moveDir,
      baseY: y,
      baseX: x,
    };

    if (kind === "karakasa") body.setVelocityY(70);

    this.dataList.push(data);
  }

  getData(sprite: Phaser.GameObjects.GameObject): EnemyData | undefined {
    return this.dataList.find(d => d.sprite === sprite);
  }

  removeEnemy(data: EnemyData): void {
    data.sprite.destroy();
    const idx = this.dataList.indexOf(data);
    if (idx >= 0) this.dataList.splice(idx, 1);
  }

  destroy(): void {
    this.dataList = [];
    this.enemies.clear(true, true);
  }
}
