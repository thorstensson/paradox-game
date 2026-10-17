// Dev only: level 4's station as one flat painting, to judge its proportions
// against the ship. No collision, no waves -- the ship flies through it.
//
// The painting is one third of the level, so three copies run side by side,
// in from the right edge and off to the left. Plain images, not a TileSprite:
// 4224x240 is not a power of two (see FireCave.js).

// The ship's pixel size, as everything in the game.
const SCALE = 3;

// Screen px per second, the fire cave's speed.
const SPEED = 422;

const COPIES = 3;

export class StationTest {
    parts = [];
    x = 0;
    gone = false;

    constructor(scene) {
        const width = scene.textures.get("station-x").getSourceImage().width * SCALE;

        this.part_width = width;
        this.x = scene.scale.width;

        for (let i = 0; i < COPIES; i++) {
            // Behind the ship and the aliens, in front of the stars.
            const part = scene.add.image(this.x + i * width, 0, "station-x")
                .setOrigin(0, 0).setScale(SCALE).setDepth(-1);

            this.parts.push(part);
        }
    }

    destroy() {
        this.parts.forEach((part) => part.destroy());
        this.parts = [];
        this.gone = true;
    }

    update(_time, delta) {
        if (this.gone) {
            return;
        }

        this.x -= SPEED * delta / 1000;

        this.parts.forEach((part, i) => {
            part.x = Math.round(this.x + i * this.part_width);
        });

        if (this.x <= -this.part_width * COPIES) {
            this.destroy();
        }
    }
}
