import { Geom } from "phaser";

// Level 1, wave kind A (notes.md -> Wave structure).
//
// Two chains of four neutrons enter from the right, one high and one low,
// mirrored about the middle of the screen. Both dip toward the centre and
// rise again as they cross, so the chains pinch together and pull apart --
// the order and motion of Delta level 2's opening wave, not its art.
//
// Every neutron flies the same path, a SPACING apart in time, which is what
// strings a chain out along the curve. The numbers are a first pass, to be
// tuned by eye.

// 32x32 native, drawn at 3x like the player ship.
const NEUTRON_SCALE = 3;

const CHAIN_LENGTH = 4;

// Score for shooting one down.
const POINTS = 100;

// The odd-coloured neutron: shooting it takes points away (Delta's idea).
const ODD_POINTS = -100;

// What kills the ship on contact, in native pixels from the centre: the
// band the ring covers at every angle of its spin (x 3-28, y 12-20), so it
// never kills through empty space. Bullets still hit the whole sprite.
const HIT_BOX = { x: -13, y: -4, w: 26, h: 9 };

// Horizontal speed, px/s, right to left. Three 20% steps up from the first
// pass of 240 (240 -> 288 -> 346 -> 415), then 15% (-> 477): Delta is hard
// because it is fast.
const SPEED = 477;

// Time between neutrons in a chain, ms, worked out from SPEED so the gap
// between their centres stays one neutron width (96px) at any speed.
const SPACING = (32 * NEUTRON_SCALE) / SPEED * 1000;

// Distance of each chain from the middle of the screen as it enters and
// exits, and how far it dips toward the middle at the halfway point. At
// 300 / 200 the chains are closest mid-screen, 100px either side of centre.
const EDGE_OFFSET = 300;
const DIP = 200;

export class NeutronWave {

    scene = null;
    neutrons = [];

    // Neutrons per chain still to come.
    to_spawn = CHAIN_LENGTH;

    // sides: which chains fly, -1 for the top and 1 for the bottom.
    // odd: position in the chain (from 1) of the odd-coloured neutron, or
    // null for none.
    // inverted: level 1's motion mirrored -- the chains fly in from the
    // centre and spread out, instead of dipping in (level 2).
    // drop: kind of power-up dropped when every neutron is shot, out of the
    // last one's explosion, or null for none.
    constructor(scene, sides = [-1, 1], odd = null, inverted = false, drop = null) {
        this.scene = scene;
        this.inverted = inverted;
        this.drop = drop;
        this.to_shoot = CHAIN_LENGTH * sides.length;

        // Neutrons spawn and despawn fully off-screen, half a sprite past
        // each edge.
        const margin = 16 * NEUTRON_SCALE;
        this.start_x = scene.scale.width + margin;
        this.end_x = -margin;

        // One neutron per chain at a time, so two chains stay exact mirrors
        // of each other.
        for (let i = 0; i < CHAIN_LENGTH; i++) {
            scene.time.delayedCall(i * SPACING, () => {
                sides.forEach((side) => this.spawn(side, i + 1 === odd));
                this.to_spawn--;
            });
        }
    }

    // Every neutron has spawned and every one is gone, shot or flown off.
    get done() {
        return this.to_spawn === 0 && this.neutrons.length === 0;
    }

    // side: -1 for the top chain, 1 for the bottom.
    // odd: true for the odd-coloured neutron.
    spawn(side, odd = false) {
        const neutron = this.scene.add.sprite(
            this.start_x, 0, odd ? "neutron-odd" : "neutron"
        );
        neutron.setScale(NEUTRON_SCALE);
        neutron.side = side;
        neutron.points = odd ? ODD_POINTS : POINTS;
        neutron.y = this.pathY(neutron.x, side);
        neutron.play({ key: odd ? "neutron-odd-spin" : "spin", repeat: -1 });

        this.neutrons.push(neutron);
    }

    // Height is a function of x alone, so every neutron that passes a given
    // x is at the same height there: the chain traces one curve.
    pathY(x, side) {
        const t = (this.start_x - x) / (this.start_x - this.end_x);
        const offset = this.inverted
            ? EDGE_OFFSET - DIP + DIP * Math.sin(Math.PI * t)
            : EDGE_OFFSET - DIP * Math.sin(Math.PI * t);

        return this.scene.cameras.main.height / 2 + side * offset;
    }

    // True if any neutron touches the ship. The neutron is left alone -- it
    // flies on through the wreck.
    hits(player) {
        const box = new Geom.Rectangle();

        return this.neutrons.some((neutron) => {
            box.setTo(
                neutron.x + HIT_BOX.x * NEUTRON_SCALE,
                neutron.y + HIT_BOX.y * NEUTRON_SCALE,
                HIT_BOX.w * NEUTRON_SCALE,
                HIT_BOX.h * NEUTRON_SCALE
            );

            return player.touches(box);
        });
    }

    // One bullet kills a neutron: it is removed and an explosion plays where
    // it was. The hit box is the whole 96x96 sprite, not the ring itself --
    // generous, and a first pass.
    update(time, delta, bullets, explosions) {
        const step = delta / 1000;

        this.neutrons = this.neutrons.filter((neutron) => {
            neutron.x -= SPEED * step;

            if (neutron.x < this.end_x) {
                neutron.destroy();
                return false;
            }

            neutron.y = this.pathY(neutron.x, neutron.side);

            // collide() reports every bullet overlapping this frame, so a
            // second bullet can land after the first has already killed it.
            let hit = false;

            bullets.collide(neutron, () => {
                hit = true;
            });

            if (hit) {
                explosions.spawn(neutron.x, neutron.y);
                this.scene.addPoints(neutron.points);

                this.to_shoot--;

                if (this.drop && this.to_shoot === 0) {
                    this.scene.powerups.spawn(neutron.x, neutron.y, this.drop);
                }
                neutron.destroy();
                return false;
            }

            return true;
        });
    }

}

// Level 1, waves 2 and 3 -- still kind A, a new movement.
//
// One chain of four enters from the right, low for wave 2 (side 1) and high
// for wave 3 (side -1), the same path mirrored. It swings further out, curves
// back in to the centre line, then flies straight along it at the ship.

// Distance from the middle of the screen as the chain enters, and how much
// further out it swings before curving back in.
const DIVE_EDGE_OFFSET = 150;
const DIVE_SWING = 150;

// Fraction of the crossing at which the chain reaches the centre line.
const DIVE_LEVEL_AT = 0.45;

export class NeutronDiveWave extends NeutronWave {

    constructor(scene, side, odd = null, inverted = false, drop = null) {
        super(scene, [side], odd, inverted, drop);
    }

    // The half-cosine carries the chain from the edge offset in to the
    // centre, the squared sine adds the swing out; both are flat at each
    // end, so the chain enters level and meets the centre line without a
    // kink.
    //
    // Inverted (level 2): the same path mirrored -- the chain enters along
    // the centre line, swings out and curves away to its edge.
    pathY(x, side) {
        let t = (this.start_x - x) / (this.start_x - this.end_x);

        if (this.inverted) {
            t = 1 - t;
        }

        const u = Math.min(t / DIVE_LEVEL_AT, 1);
        const offset = DIVE_EDGE_OFFSET * (1 + Math.cos(Math.PI * u)) / 2
            + DIVE_SWING * Math.sin(Math.PI * u) ** 2;

        return this.scene.cameras.main.height / 2 + side * offset;
    }

}
