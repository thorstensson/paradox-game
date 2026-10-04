import { Geom } from "phaser";
import { paintedBox } from "./FirecometTrack";

// Power drops (notes.md -> Enemies & Waves -> Power drops). Only a wave shot
// down in full drops one, out of the explosion of its last alien. A drop
// drifts left at a steady pace and never up or down, so the ship has to fly
// to it; missed, it drifts off the left edge. The player's shots pass
// through it.
//
// Catching one switches on double bullets (Player.startDouble).

// 16x16 native, drawn at 3x like everything else: 48px on screen.
const POWERUP_SCALE = 3;

// px/s, right to left: slow and steady.
const SPEED = 140;

export class PowerUps {

    scene = null;
    drops = [];
    hit_box = null;

    constructor(scene) {
        this.scene = scene;
        this.hit_box = paintedBox(scene, "powerup-bullets");

        // Dropped once fully past the left edge.
        this.end_x = -8 * POWERUP_SCALE;
    }

    // A drop appears at (x, y), where the wave's last alien blew up.
    spawn(x, y) {
        const drop = this.scene.add.sprite(x, y, "powerup-bullets");
        drop.setScale(POWERUP_SCALE);
        drop.play({ key: "powerup-blink", repeat: -1 });

        this.drops.push(drop);
    }

    update(delta, player) {
        const step = delta / 1000;
        const box = new Geom.Rectangle();

        this.drops = this.drops.filter((drop) => {
            drop.x -= SPEED * step;

            if (drop.x < this.end_x) {
                drop.destroy();
                return false;
            }

            box.setTo(
                drop.x + this.hit_box.x * POWERUP_SCALE,
                drop.y + this.hit_box.y * POWERUP_SCALE,
                this.hit_box.w * POWERUP_SCALE,
                this.hit_box.h * POWERUP_SCALE
            );

            // Caught: double bullets.
            if (player.touches(box)) {
                player.startDouble();
                drop.destroy();
                return false;
            }

            return true;
        });
    }

}
