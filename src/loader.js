// The HTML loader in index.html (Thomas, 2026-11-25): the cassette plays its
// loop, centred, while the game loads. When all is loaded it cuts to the
// splash, no fade, as a C64 does; the splash holds 3 s, then the loader
// fades away and the game fades in.

// The loader's fade, ms: the same as its transition in style.css.
const FADE_MS = 500;

// The splash's hold, ms (Thomas).
const SPLASH_MS = 3000;

// Cuts from the tape to the splash, holds it, then calls done.
export function showSplash(done) {
    const tape = document.getElementById("loader-tape");
    const splash = document.getElementById("loader-splash");

    if (!splash) {
        done();
        return;
    }

    const cut = () => {
        if (tape) {
            tape.hidden = true;
        }

        splash.hidden = false;
        setTimeout(done, SPLASH_MS);
    };

    // Waits for the splash picture, so the cut never lands on an empty
    // screen. A picture that fails to load still moves on.
    if (splash.complete) {
        cut();
    } else {
        splash.addEventListener("load", cut, { once: true });
        splash.addEventListener("error", cut, { once: true });
    }
}

// Fades the loader away and removes it, then calls done.
export function fadeOutLoader(done) {
    const loader = document.getElementById("loader");

    if (!loader) {
        done();
        return;
    }

    loader.classList.add("gone");

    setTimeout(() => {
        loader.remove();
        done();
    }, FADE_MS);
}
