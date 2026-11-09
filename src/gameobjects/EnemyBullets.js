import { Geom } from "phaser";
import { paintedBox } from "./FirecometTrack";

// Aliens' bullets, as in Delta: small, slow, blinking (bullet-enemy-blink).
// Fired straight at where the ship is at that moment and never steered after,
// so the ship can slip out of the way; each flies on in a straight line until
// it leaves the playfield. The player's shots pass through them.
//
// One per wave that fires; the wave moves and checks them with its aliens.
//
// The defaults are the grey round bullet above. A wave can give another
// image, its own tag or none, and its own speed: Station X's enforcer fires
// the red dash (bullet-red-enemy, one frame) straight ahead with fireLeft().

// 6x6 native, drawn at 3x like every alien.
const BULLET_SCALE = 3;

// px/s, along the line it was fired on: slow, like Delta.
const SPEED = 240;

export class EnemyBullets {

    scene = null;
    bullets = [];
    hit_box = null;

    constructor(scene, { key = "bullet-enemy", anim = "bullet-enemy-blink", speed = SPEED } = {}) {
        this.scene = scene;
        this.key = key;
        this.anim = anim;
        this.speed = speed;
        this.hit_box = paintedBox(scene, key);

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

        this.add(x, y, Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    }

    // Straight to the left, level, not aimed: its front painted pixel at x,
    // its bottom painted row level with the row above y (screen px), so it
    // sits on the same 3 px grid as the pixel it leaves from.
    fireLeft(x, y) {
        const box = this.hit_box;

        this.add(x - box.x * BULLET_SCALE, y - (box.y + box.h) * BULLET_SCALE, -this.speed, 0);
    }

    add(x, y, vx, vy) {
        const bullet = this.scene.add.sprite(x, y, this.key);
        bullet.setScale(BULLET_SCALE);
        bullet.vx = vx;
        bullet.vy = vy;

        if (this.anim) {
            bullet.play({ key: this.anim, repeat: -1 });
        }

        this.bullets.push(bullet);
    }

    // The bullets the given test picks out are gone at once.
    removeWhere(test) {
        this.bullets = this.bullets.filter((bullet) => {
            if (test(bullet)) {
                bullet.destroy();
                return false;
            }

            return true;
        });
    }

    // Every bullet in flight is gone.
    clear() {
        this.removeWhere(() => true);
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

            // Stopped by the ship's shield, if it is on.
            if (gone || this.scene.player.shieldBlocks(bullet.x, bullet.y)) {
                bullet.destroy();
                return false;
            }

            return true;
        });
    }

}
