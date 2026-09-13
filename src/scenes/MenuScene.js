import { Scene } from "phaser";

export class MenuScene extends Scene {
    constructor() {
        super("MenuScene");
    }

    init() {
        this.cameras.main.fadeIn(1000, 0, 0, 0);
    }

    create() {
        // Logo. Images are centre-origin already, so no setOrigin needed.
        const logo_game = this.add.image(
            this.scale.width / 2,
            this.scale.height / 2,
            "title-logo"
        ).setScale(4);

        // Knocked slightly off pure white so the shine has headroom to
        // brighten into -- a white highlight over white is invisible.
        logo_game.setTint(0xc8d0e0);
        logo_game.postFX.addShine();

        const start_msg = this.add.bitmapText(
            this.scale.width / 2,
            this.scale.height / 2 + 120,
            "pixelfont",
            "PLAYER ONE\nCLICK TO START",
            24
        ).setOrigin(0.5, 0.5);

        // setOrigin centres the block; this centres the lines within it.
        start_msg.setCenterAlign();
        

        // Tween to blink the text
        this.tweens.add({
            targets: start_msg,
            alpha: 0,
            duration: 800,
            ease: (value) => Math.abs(Math.round(value)),
            yoyo: true,
            repeat: -1
        });

        // Send start-game event when user clicks
        this.input.on("pointerdown", () => {
            this.game.events.emit("start-game");
        });
    }
}