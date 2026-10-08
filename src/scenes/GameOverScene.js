import { Scene } from "phaser";

// How long GAME OVER holds before cutting back to the intro.
const HOLD_MS = 3000;

// Drawn over the still-running level (MainScene launches it rather than
// starting it), so there is no black: no fade in, no fade out.
export class GameOverScene extends Scene {
    constructor() {
        super("GameOverScene");
    }

    create() {
        // Small font at 16, the same size as the intro's PLAYER ONE /
        // CLICK TO START.
        this.add.bitmapText(
            this.scale.width / 2,
            this.scale.height / 2,
            "main-font",
            "GAME OVER",
            27
        ).setOrigin(0.5, 0.5);

        // No restart prompt: hold, then cut straight to the intro. start()
        // restarts MainScene -- which launches MenuScene from its init() --
        // and shuts this scene down.
        this.time.delayedCall(HOLD_MS, () => {
            this.scene.start("MainScene", { cut: true });
        });
    }
}
