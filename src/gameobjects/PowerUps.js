import { Geom } from "phaser";
import { paintedBox } from "./FirecometTrack";

// Power drops (NOTES.md -> Enemies & Waves -> Power drops). Only a wave shot
// down in full drops one, out of the explosion of its last alien. A drop
// drifts left at a steady pace and never up or down, so the ship has to fly
// to it; missed, it drifts off the left edge. The player's shots pass
// through it.
//
// Three kinds, alike in every way but the icon and what catching one does:
// "bullets" switches on double bullets (Player.startDouble), "shield" the
// spinning shield (Player.startShield), "speed" a faster mouse
// (Player.startSpeed).
const KINDS = {
    bullets: { key: "powerup-bullets", tag: "powerup-bullet-spin", start: "startDouble" },
    shield: { key: "powerup-shield", tag: "powerup-shield-spin", start: "startShield" },
    speed: { key: "powerup-speed", tag: "powerup-speed-spin", start: "startSpeed" }
};

// 24x24 native, drawn at 3x like everything else: 72px on screen.
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
        this.end_x = -12 * POWERUP_SCALE;
    }

    // A drop appears at (x, y), where the wave's last alien blew up.
    spawn(x, y, kind = "bullets") {
        const { key, tag } = KINDS[kind];
        const drop = this.scene.add.sprite(x, y, key);
        drop.setScale(POWERUP_SCALE);
        drop.play({ key: tag, repeat: -1 });
        drop.kind = kind;

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

            // Caught.
            if (player.touches(box)) {
                player[KINDS[drop.kind].start]();
                drop.destroy();
                return false;
            }

            return true;
        });
    }

}
