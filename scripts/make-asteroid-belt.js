// Writes the Osiris Belt, level 3's asteroid belt, as a fixed list:
// src/gameobjects/asteroid-belt.js. The game only reads that list, so the
// belt is the same every game and can be learnt.
//
// Run with: node scripts/make-asteroid-belt.js
//
// The same SEED always makes the same belt. Change it for a new belt to try.
// The written list can also be edited by hand afterwards -- but running this
// again overwrites it.

import { writeFileSync } from "node:fs";

const SEED = 1;

// Belt length, screen px: about 90s at the belt's speed, 477 px/s.
const LENGTH = 43000;

// Playfield height, screen px (the canvas less the 40px HUD band).
const HEIGHT = 760;

// Painted size of each rock, native px, from the PNGs in enviro/asteroid/.
// Measure again if a rock is repainted.
const ROCKS = {
    1: { w: 22, h: 21 },
    2: { w: 16, h: 16 },
    3: { w: 27, h: 27 }
};

// Drawn at 3x in game.
const SCALE = 3;

// Average space between one rock and the next along the belt, screen px:
// THIN at the start and the end, THICK in the middle.
const THIN = 164;
const THICK = 73;

// Each space is the average, give or take this share of it.
const JITTER = 0.4;

// Smallest clear space between two rocks' painted edges, screen px.
const CLEARANCE = 6;

// Spin, degrees per second: slow, comet-like. Each rock gets its own,
// somewhere between these, half of them turning the other way.
const SPIN_MIN = 10;
const SPIN_MAX = 30;

// Tries to find a free height for a rock before it is left out.
const TRIES = 20;

// mulberry32: a small seeded random, 0 to 1.
function seeded(seed) {
    let a = seed >>> 0;

    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const random = seeded(SEED);
const kinds = Object.keys(ROCKS).map(Number);

// Half the painted size, screen px: rocks are treated as circles here.
const radius = (rock) => (Math.max(ROCKS[rock].w, ROCKS[rock].h) / 2) * SCALE;

const belt = [];
let x = 0;

while (x <= LENGTH) {
    const rock = kinds[Math.floor(random() * kinds.length)];
    const r = radius(rock);

    for (let i = 0; i < TRIES; i++) {
        const y = Math.round(r + random() * (HEIGHT - 2 * r));

        const free = belt.every((other) => {
            const reach = r + radius(other.rock) + CLEARANCE;
            return Math.hypot(x - other.x, y - other.y) >= reach;
        });

        if (free) {
            const turn = random() < 0.5 ? -1 : 1;
            const spin = turn * Math.round(SPIN_MIN + random() * (SPIN_MAX - SPIN_MIN));

            belt.push({ x, y, rock, spin });
            break;
        }
    }

    const along = x / LENGTH;
    const average = THIN - (THIN - THICK) * Math.sin(Math.PI * along);
    x += Math.round(average * (1 - JITTER + random() * 2 * JITTER));
}

const lines = belt.map(({ x, y, rock, spin }) => `    { x: ${x}, y: ${y}, rock: ${rock}, spin: ${spin} },`);

writeFileSync(
    new URL("../src/gameobjects/asteroid-belt.js", import.meta.url),
    `// The Osiris Belt, level 3: every rock, in order along the belt. Written by
// scripts/make-asteroid-belt.js (seed ${SEED}); edit by hand or run it again.
//
// x: distance along the belt, screen px -- the rock comes in at the right
//    edge once the belt has travelled this far.
// y: height in the playfield, screen px from the top, to the rock's centre.
// rock: which painting, asteroid-1, -2 or -3.
// spin: degrees per second, clockwise; negative turns the other way.
export const ASTEROID_BELT = [
${lines.join("\n")}
];
`
);

console.log(`${belt.length} rocks over ${LENGTH} px`);
