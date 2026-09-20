import { Scene } from "phaser";
import { Player } from "../gameobjects/Player";
import { BlueEnemy } from "../gameobjects/BlueEnemy";
import { GalaxyBackground } from "../gameobjects/GalaxyBackground";
import { StarField } from "../gameobjects/StarField";

export class MainScene extends Scene {
    galaxy_background = null;
    star_field = null;
    player = null;
    enemy_blue = null;
    cursors = null;

    points = 0;
    game_over_timeout = 20;

    constructor() {
        super("MainScene");
    }

    init() {
        this.cameras.main.fadeIn(1000, 0, 0, 0);
        this.scene.launch("MenuScene");

        // Reset points
        this.points = 0;
        this.game_over_timeout = 20;
    }

    create() {
        // Scrolling parallax starfield
        this.galaxy_background = new GalaxyBackground(this);
        this.star_field = new StarField(this);

        // Builds one animation per Aseprite frameTag: level, bank-up,
        // bank-down. Must run before the Player, which holds "level" from
        // its constructor.
        this.anims.createFromAseprite("ship");

        // Player
        this.player = new Player({ scene: this });

        // Enemy
        this.enemy_blue = new BlueEnemy(this);

        // Autofire is polled in update() rather than driven by key events, so
        // holding the button keeps shots coming on the cooldown.
        this.cursors = this.input.keyboard.createCursorKeys();

        // Overlap player with enemy bullets
        this.physics.add.overlap(this.enemy_blue.bullets, this.player, (player, bullet) => {
            bullet.destroyBullet();
            this.cameras.main.shake(100, 0.01);
            // Flash the color white for 300ms
            this.cameras.main.flash(300, 255, 10, 10, false,);
            this.points -= 10;
            this.scene.get("HudScene")
                .update_points(this.points);
        });

        // This event comes from MenuScene
        this.game.events.on("start-game", () => {
            this.scene.stop("MenuScene");
            this.scene.launch("HudScene", { remaining_time: this.game_over_timeout });
            this.player.start();
            this.enemy_blue.start();

            // Game Over timeout
            this.time.addEvent({
                delay: 1000,
                loop: true,
                callback: () => {
                    if (this.game_over_timeout === 0) {
                        // You need remove the event listener to avoid duplicate events.
                        this.game.events.removeListener("start-game");
                        // It is necessary to stop the scenes launched in parallel.
                        this.scene.stop("HudScene");
                        this.scene.start("GameOverScene", { points: this.points });
                    } else {
                        this.game_over_timeout--;
                        this.scene.get("HudScene").update_timeout(this.game_over_timeout);
                    }
                }
            });
        });
    }

    update(time, delta) {
        this.galaxy_background.update(time, delta);
        this.star_field.update(time, delta);
        this.player.update(time, delta);
        this.enemy_blue.update();

        // The mouse steers the ship, so a click cannot also aim -- the ship is
        // already at the cursor. Bullets always travel right.
        if (this.input.activePointer.isDown || this.cursors.space.isDown) {
            this.player.fire(time);
        }

        this.player.bullets.update(time, delta);

        // Player bullets are Blitter Bobs with no physics body, so the hit
        // test is done by hand rather than through physics.add.overlap.
        this.player.bullets.collide(this.enemy_blue, () => {
            this.enemy_blue.damage(this.player.x, this.player.y);
            this.points += 10;
            this.scene.get("HudScene").update_points(this.points);
        });
    }
}