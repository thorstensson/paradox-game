import { Game } from "phaser";
import { Preloader } from "./preloader";
import { GameOverScene } from "./scenes/GameOverScene";
import { HudScene } from "./scenes/HudScene";
import { MainScene } from "./scenes/MainScene";
import { MenuScene } from "./scenes/MenuScene";
import { PauseScene } from "./scenes/PauseScene";

// 4x the C64 playfield (320x200).
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 800;

// Largest whole-number multiple of the canvas that fits the window.
//
// Scale.FIT would stretch the canvas to fill the window at whatever fractional
// ratio that takes (1.35x on a 1080p screen), which makes some texels render a
// screen pixel wider than others. Snapping to an integer keeps every texel the
// same size, at the cost of letterbox borders around the canvas.
function integerZoom() {
    return Math.max(
        1,
        Math.floor(
            Math.min(
                window.innerWidth / GAME_WIDTH,
                window.innerHeight / GAME_HEIGHT,
            ),
        ),
    );
}

// More information about config: https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config = {
    type: Phaser.AUTO,
    parent: "phaser-container",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    // Pure black, framed by the page's #111111.
    backgroundColor: "#000000",
    // Sets antialias false, which also makes Phaser apply
    // `image-rendering: pixelated` to the canvas element itself.
    pixelArt: true,
    scale: {
        // NONE means the canvas is never stretched; `zoom` alone sets its
        // display size, so it can only ever be an exact multiple.
        mode: Phaser.Scale.NONE,
        zoom: integerZoom(),
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
        },
    },
    // PauseScene last, so it draws over everything else.
    scene: [Preloader, MainScene, MenuScene, HudScene, GameOverScene, PauseScene],
};

const game = new Game(config);

// Phaser resolves zoom once at startup, so re-derive it when the window changes.
window.addEventListener("resize", () => {
    game.scale.setZoom(integerZoom());
});

// Exposed for console debugging.
window.game = game;
