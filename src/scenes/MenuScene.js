import { Scene } from "phaser";
import { COLOUR_SHINE } from "../fx/ColourShine";

export class MenuScene extends Scene {
    constructor() {
        super("MenuScene");
    }

    init() {
        this.cameras.main.fadeIn(1000, 0, 0, 0);
    }

    create() {
        // Logo. Images are centre-origin already, so no setOrigin needed.
        // 123x13 at 8x is 984px wide: 148px either side.
        const logo_game = this.add.image(
            this.scale.width / 2,
            this.scale.height / 2,
            "title-logo"
        ).setScale(8);

        // Knocked slightly off pure white so the shine has headroom to
        // brighten into -- a white highlight over white is invisible.
        logo_game.setTint(0xe4e8f0);
        // Phaser's shine, but sweeping in #b9bffb (see ColourShine.js).
        logo_game.setPostPipeline(COLOUR_SHINE);

        const start_msg = this.add.bitmapText(
            this.scale.width / 2,
            this.scale.height / 2 + 120,
            "main-font",
            "PLAYER ONE\nCLICK TO START",
            24
        ).setOrigin(0.5, 0.5);

        // setOrigin centres the block; this centres the lines within it.
        start_msg.setCenterAlign();

        // The font's own line gap is one brick (2px); 6px more makes it
        // four bricks, so the two lines don't touch.
        start_msg.setLineSpacing(9);

        // The year in Roman numerals above the logo, as Delta has it. Same
        // gap above the logo as PLAYER ONE sits below it, measured from the
        // drawn text rather than set by hand.
        const logo_bounds = logo_game.getBounds();
        const gap = start_msg.getBounds().top - logo_bounds.bottom;

        this.add.bitmapText(
            this.scale.width / 2,
            logo_bounds.top - gap,
            "main-font",
            "MMXXVI",
            24
        ).setOrigin(0.5, 1);

        // Byline, centred along the bottom of the screen, in the HI score's
        // lilac (hud-font; Thomas, 2026-11-09).
        this.add.bitmapText(
            this.scale.width / 2,
            this.scale.height - 40,
            "hud-font",
            "BY THOMAS THORSTENSSON",
            24
        ).setOrigin(0.5, 1);


        // Tween to blink the text
        this.tweens.add({
            targets: start_msg,
            alpha: 0,
            duration: 800,
            ease: (value) => Math.abs(Math.round(value)),
            yoyo: true,
            repeat: -1
        });

        // Send start-game event when user clicks. The same click locks the
        // mouse to the game -- browsers only allow that in answer to a click.
        this.input.on("pointerdown", () => {
            this.input.mouse.requestPointerLock();
            this.game.events.emit("start-game");
        });
    }
}