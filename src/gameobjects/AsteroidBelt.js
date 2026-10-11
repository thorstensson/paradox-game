import { Geom } from "phaser";
import { ASTEROID_BELT } from "./asteroid-belt";
import { paintedBox } from "./FirecometTrack";

// Level 3, the Osiris Belt: the whole level is one asteroid belt sweeping
// right to left, to be blasted through. Not a wave: like the firecomets it
// runs on its own, and a lost ship does not restart it -- the belt flies on.
//
// Every rock comes from the fixed list in asteroid-belt.js, so the belt is
// the same every game and can be learnt. Each rock turns slowly at its own
// spin from the list; Phaser turns the painted image. The ship's hit box does
// not turn with it (first pass).

// 32x32 native, drawn at 3x like every alien.
const ROCK_SCALE = 3;

// Belt speed, px/s, right to left: Regular (477), the neutron's speed, plus
// 10% -- it should be hard.
const SPEED = 524.7;

// Bullets a rock soaks up before it blows. No sign of the hits before then,
// as with the firering.
const HITS = 3;

// Score for shooting one down.
const POINTS = 100;

const ROCK_KEYS = { 1: "asteroid-1", 2: "asteroid-2", 3: "asteroid-3" };

export class AsteroidBelt {

    scene = null;
    rocks = [];

    // Per painting: the painted box, native px from the centre (what kills
    // the ship), and the circle round it, screen px (what the shots hit).
    shapes = {};

    // Screen px the belt has travelled, and the next list entry due.
    travelled = 0;
    next = 0;

    constructor(scene) {
        this.scene = scene;

        for (const [ rock, key ] of Object.entries(ROCK_KEYS)) {
            const box = paintedBox(scene, key);
            const radius = (Math.max(box.w, box.h) / 2) * ROCK_SCALE;

            this.shapes[rock] = { key, box, radius };
        }

        // Spawned and dropped half a sprite past each edge.
        const margin = 16 * ROCK_SCALE;
        this.start_x = scene.scale.width + margin;
        this.end_x = -margin;
    }

    // Every rock in the list has come in and gone, shot or flown off.
    get done() {
        return this.next >= ASTEROID_BELT.length && this.rocks.length === 0;
    }

    // True if any rock touches the ship. The rock flies on.
    hits(player) {
        const box = new Geom.Rectangle();

        return this.rocks.some((rock) => {
            const { box: painted } = this.shapes[rock.kind];

            box.setTo(
                rock.x + painted.x * ROCK_SCALE,
                rock.y + painted.y * ROCK_SCALE,
                painted.w * ROCK_SCALE,
                painted.h * ROCK_SCALE
            );

            return player.touches(box);
        });
    }

    update(_time, delta, bullets, explosions) {
        const step = delta / 1000;
        const dx = SPEED * step;
        this.travelled += dx;

        for (const rock of this.rocks) {
            rock.x -= dx;
            rock.angle += rock.spin * step;
        }

        // Rocks whose place on the belt has reached the right edge. Placed
        // by how far past it they are, so the spacing stays exact.
        while (this.next < ASTEROID_BELT.length && ASTEROID_BELT[this.next].x <= this.travelled) {
            const { x, y, rock: kind, spin } = ASTEROID_BELT[this.next++];

            const rock = this.scene.add.image(
                this.start_x - (this.travelled - x), y, this.shapes[kind].key
            );
            rock.setScale(ROCK_SCALE);
            rock.kind = kind;
            rock.spin = spin;
            rock.hits = HITS;

            this.rocks.push(rock);
        }

        this.rocks = this.rocks.filter((rock) => {
            if (rock.x < this.end_x) {
                rock.destroy();
                return false;
            }

            const radius = this.shapes[rock.kind].radius;

            // Each bullet that touches is used up, whether the rock
            // survives it or not.
            bullets.collideCircle(rock.x, rock.y, radius, () => {
                rock.hits--;
            });

            // Meeting a spinning shield ring blows the rock, as a bullet
            // would be stopped.
            if (this.scene.player.shieldBlocksCircle(rock.x, rock.y, radius)) {
                rock.hits = 0;
            }

            if (rock.hits <= 0) {
                explosions.spawn(rock.x, rock.y);
                this.scene.addPoints(POINTS);
                rock.destroy();
                return false;
            }

            return true;
        });
    }

}
