import { Animations } from "phaser";

// From a free Aseprite pack: 64x64, nine frames under one tag, Animation,
// played once where the enemy died. Drawn at 3x, the same scale as the
// enemies.
const EXPLOSION_SCALE = 3;

const TEXTURE = "explosion";
const ANIMATION = "Animation";

// Fixed size, like the bullet pool. A spent explosion goes invisible and
// waits to be reused -- creating and destroying sprites mid-wave stutters.
// 16 covers a whole wave dying at once with room to spare.
const POOL_SIZE = 16;

export class Explosions {

    sprites = [];

    constructor(scene) {
        for (let i = 0; i < POOL_SIZE; i++) {
            const sprite = scene.add.sprite(0, 0, TEXTURE)
                .setScale(EXPLOSION_SCALE)
                .setActive(false)
                .setVisible(false);

            // The tag carries no repeat, so the animation completes after
            // its last frame and the sprite goes back to the pool.
            sprite.on(Animations.Events.ANIMATION_COMPLETE, () => {
                sprite.setActive(false).setVisible(false);
            });

            this.sprites.push(sprite);
        }
    }

    // Silently does nothing if the pool is dry.
    spawn(x, y) {
        const sprite = this.sprites.find((s) => !s.active);

        if (!sprite) {
            return;
        }

        sprite.setPosition(x, y).setActive(true).setVisible(true);
        sprite.play(ANIMATION);
    }

}
