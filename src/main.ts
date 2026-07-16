import { Boot } from "./scenes/Boot";
import { Game } from "./scenes/Game";
import { GameOver } from "./scenes/GameOver";
import { Leaderboard } from "./scenes/Leaderboard";
import { MainMenu } from "./scenes/MainMenu";
import { Preloader } from "./scenes/Preloader";
import { Settings } from "./scenes/Settings";
import { PauseMenu } from "./scenes/PauseMenu";
import { Shop } from "./scenes/Shop";
import { Quests } from "./scenes/Quests";
import { Levels } from "./scenes/Levels";
import { LevelEditor } from "./scenes/LevelEditor";
import { MiniGames } from "./scenes/MiniGames";
import { FlappyTengu } from "./scenes/FlappyTengu";
import { WhackAKappa } from "./scenes/WhackAKappa";
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY } from "./config/constants";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  backgroundColor: "#07060f",
  // Art is painted supersampled then downsampled, so it wants smooth filtering.
  // `pixelArt: true` forced NEAREST and made every curve and glow crunchy.
  render: {
    antialias: true,
    antialiasGL: true,
    roundPixels: false,
    powerPreference: "high-performance",
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: GRAVITY },
      debug: false,
    },
  },
  scene: [
    Boot,
    Preloader,
    MainMenu,
    Leaderboard,
    Shop,
    Quests,
    Levels,
    LevelEditor,
    MiniGames,
    FlappyTengu,
    WhackAKappa,
    Settings,
    Game,
    PauseMenu,
    GameOver,
  ],
};

const game = new Phaser.Game(config);

// Dev-only handle so the screenshot harness can drive scenes and dump textures.
if (process.env.NODE_ENV !== "production") {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

export default game;
