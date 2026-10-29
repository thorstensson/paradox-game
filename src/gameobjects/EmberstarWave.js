import { Geom } from "phaser";
import { EnemyBullets } from "./EnemyBullets";
import { paintedBox } from "./FirecometTrack";

// Level 2, A2 (NOTES.md -> Level 2 Concepts -> Wave sequence), the first wave
// of the fire cave.
//
// Eight emberstars in two blocks of four (2x2), one from the top and one from
// the bottom, mirrored. Each block curves in toward the centre line as in the
// dive, but turns back before reaching it and swings out toward its own
// flames again -- in, out, in, out, as in Armalyte -- while both blocks drift
// slowly left across the screen as one. Every emberstar spins; Phaser turns
// the single painted frame, so there are no spin frames.
//
// Counted 1 to 8, left to right, top to bottom, four of them fire one bullet
// each, straight at where the ship is: the diagonal of the top block and the
// opposite diagonal of the bottom one, so the blocks mirror each other.
//
//    1* 2
//    3  4*
//
//    5  6*
//    7* 8
//
// The numbers are a first pass, to be tuned by eye.

// When each firing emberstar shoots, ms after the wave begins: the outer
// corners (1, 7) first, then the inner ones (4, 6). The blocks are fully on
// screen after about 1.2s. An emberstar shot before its time never fires.
const FIRE_AT = { 1: 2000, 7: 2000, 4: 3000, 6: 3000 };

// 32x32 native, drawn at 3x like every alien.
const EMBERSTAR_SCALE = 3;

// Distance between neighbouring emberstars in a block, screen px: one sprite.
const PITCH = 32 * EMBERSTAR_SCALE;

// Score for shooting one down.
const POINTS = 100;

// Bullets an emberstar soaks up before it blows: 4, since the ship enters
// the fire cave with more power.
const HITS = 4;

// Horizontal drift, px/s, right to left: the firering's speed, the slowest
// in the game, so the blocks swing several times on the way across.
const SPEED = 161;

// One full swing, edge -> centre -> edge, ms.
const SWING = 2000;

// Spin, degrees per second: one turn a second, clockwise.
const SPIN = 360;

// What the player's shots hit, screen px from the centre: a circle through
// the furthest painted pixel (12 native px), the shape the star sweeps as
// it spins, so it is the same at every angle.
const SHOT_RADIUS = 12 * EMBERSTAR_SCALE;

// The tallest flame, screen px: 15 native rows of firecave.png at 5x.
const FLAME_REACH = 75;

// How close a block comes to the flames at the outer end of its swing, and
// to the centre line at the inner end, screen px.
const FLAME_GAP = 10;
const CENTRE_GAP = 10;

export class EmberstarWave {

    scene = null;
    stars = [];
    hit_box = null;

    // The emberstars' shots. They fly on after their emberstar is shot.
    bullets = null;

    // ms since the wave began; drives the swing.
    elapsed = 0;

    constructor(scene) {
        this.scene = scene;
        this.hit_box = paintedBox(scene, "emberstar");
        this.bullets = new EnemyBullets(scene);

        const width = scene.scale.width;
        const height = scene.cameras.main.height;
        const middle = height / 2;

        // Block centre to its outer edge: two sprites wide and tall.
        const half_block = PITCH;

        // How far a block's centre sits from the middle of the screen at
        // each end of its swing.
        this.outer = middle - FLAME_REACH - FLAME_GAP - half_block;
        this.inner = CENTRE_GAP + half_block;
        this.middle = middle;

        // Both blocks start fully off the right edge and are dropped once
        // fully past the left.
        this.x = width + half_block;
        this.end_x = -half_block;

        // side: -1 for the top block, 1 for the bottom.
        for (const side of [ -1, 1 ]) {
            for (const column of [ -0.5, 0.5 ]) {
                for (const row of [ -0.5, 0.5 ]) {
                    const star = scene.add.image(0, 0, "emberstar");
                    star.setScale(EMBERSTAR_SCALE);
                    star.points = POINTS;
                    star.hits = HITS;
                    star.side = side;
                    star.dx = column * PITCH;
                    star.dy = row * PITCH;

                    // 1-4 the top block, 5-8 the bottom, each left to
                    // right, top to bottom.
                    const number = (side === 1 ? 4 : 0)
                        + (row > 0 ? 2 : 0)
                        + (column > 0 ? 1 : 0)
                        + 1;
                    star.fire_at = FIRE_AT[number] ?? null;

                    this.stars.push(star);
                }
            }
        }

        this.place();
    }

    // Every emberstar is gone, shot or flown off, and so is every bullet.
    get done() {
        return this.stars.length === 0 && this.bullets.empty;
    }

    // Puts every emberstar at its spot in its block. The swing starts at the
    // outer end, so the blocks come in curving toward the centre.
    place() {
        const phase = (this.elapsed % SWING) / SWING;
        const pull = (1 - Math.cos(phase * Math.PI * 2)) / 2;
        const distance = this.outer + (this.inner - this.outer) * pull;

        for (const star of this.stars) {
            star.x = this.x + star.dx;
            star.y = this.middle + star.side * distance + star.dy;
        }
    }

    // True if any emberstar or bullet touches the ship. Either flies on.
    hits(player) {
        if (this.bullets.hits(player)) {
            return true;
        }

        const box = new Geom.Rectangle();

        return this.stars.some((star) => {
            box.setTo(
                star.x + this.hit_box.x * EMBERSTAR_SCALE,
                star.y + this.hit_box.y * EMBERSTAR_SCALE,
                this.hit_box.w * EMBERSTAR_SCALE,
                this.hit_box.h * EMBERSTAR_SCALE
            );

            return player.touches(box);
        });
    }

    update(_time, delta, bullets, explosions) {
        const step = delta / 1000;

        this.elapsed += delta;
        this.x -= SPEED * step;
        this.place();
        this.bullets.update(delta);

        const player = this.scene.player;

        this.stars = this.stars.filter((star) => {
            star.angle += SPIN * step;

            // Once, at its time, at where the ship is right now.
            if (star.fire_at !== null && this.elapsed >= star.fire_at) {
                star.fire_at = null;
                this.bullets.fire(star.x, star.y, player.x, player.y);
            }

            if (this.x < this.end_x) {
                star.destroy();
                return false;
            }

            // Each bullet that touches is used up, whether the emberstar
            // survives it or not.
            bullets.collideCircle(star.x, star.y, SHOT_RADIUS, () => {
                star.hits--;
            });

            if (star.hits <= 0) {
                explosions.spawn(star.x, star.y);
                this.scene.addPoints(star.points);
                star.destroy();
                return false;
            }

            return true;
        });
    }

}
