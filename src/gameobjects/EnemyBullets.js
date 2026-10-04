import { Geom } from "phaser";
import { paintedBox } from "./FirecometTrack";

// Aliens' bullets, as in Delta: small, slow, blinking (bullet-enemy-blink).
// Fired straight at where the ship is at that moment and never steered after,
// so the ship can slip out of the way; each flies on in a straight line until
// it leaves the playfield. The player's shots pass through them.
//
// One per wave that fires; the wave moves and checks them with its aliens.

// 6x6 native, drawn at 3x like every alien.
const BULLET_SCALE = 3;

// px/s, along the line it was fired on: slow, like Delta.
const SPEED = 240;

export class EnemyBullets {

    scene = null;
    bullets = [];
    hit_box = null;

    constructor(scene) {
        this.scene = scene;
        this.hit_box = paintedBox(scene, "bullet-enemy");

        // Dropped once fully outside the playfield, half a bullet past an
        // edge.
        this.margin = 3 * BULLET_SCALE;
        this.width = scene.scale.width;
        this.height = scene.cameras.main.height;
    }

    // Nothing in flight.
    get empty() {
        return this.bullets.length === 0;
    }

    // From (x, y) toward the point (target_x, target_y), the ship's position
    // as the shot is fired.
    fire(x, y, target_x, target_y) {
        const angle = Math.atan2(target_y - y, target_x - x);

        const bullet = this.scene.add.sprite(x, y, "bullet-enemy");
        bullet.setScale(BULLET_SCALE);
        bullet.vx = Math.cos(angle) * SPEED;
        bullet.vy = Math.sin(angle) * SPEED;
        bullet.play({ key: "bullet-enemy-blink", repeat: -1 });

        this.bullets.push(bullet);
    }

    // True if any bullet touches the ship. The bullet flies on.
    hits(player) {
        const box = new Geom.Rectangle();

        return this.bullets.some((bullet) => {
            box.setTo(
                bullet.x + this.hit_box.x * BULLET_SCALE,
                bullet.y + this.hit_box.y * BULLET_SCALE,
                this.hit_box.w * BULLET_SCALE,
                this.hit_box.h * BULLET_SCALE
            );

            return player.touches(box);
        });
    }

    update(delta) {
        const step = delta / 1000;

        this.bullets = this.bullets.filter((bullet) => {
            bullet.x += bullet.vx * step;
            bullet.y += bullet.vy * step;

            const gone = bullet.x < -this.margin
                || bullet.x > this.width + this.margin
                || bullet.y < -this.margin
                || bullet.y > this.height + this.margin;

            if (gone) {
                bullet.destroy();
                return false;
            }

            return true;
        });
    }

}
