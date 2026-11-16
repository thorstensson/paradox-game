// The hiscore table, kept in Supabase (project paradox, table scores): the
// top 10 for the intro's TOP SCORES, and a new score after the game ends.
//
// Plain web requests to Supabase's REST address, no supabase-js. The address
// and the public key come from .env.local (VITE_SUPABASE_URL,
// VITE_SUPABASE_KEY). The key can only read the table and add to it.
//
// Every call gives null (or false) rather than failing: no network, no
// .env.local, Supabase down. The game then goes without the table -- the
// intro alone, no name entry.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_KEY;

// Rows on the table.
export const TOP = 10;

// A request that takes longer than this counts as failed, ms.
const TIMEOUT_MS = 5000;

function request(path, options = {}) {
    if (!SUPABASE_URL || !KEY) {
        return Promise.reject(new Error("No Supabase address or key in .env.local"));
    }

    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: { apikey: KEY, ...options.headers },
        signal: AbortSignal.timeout(TIMEOUT_MS)
    }).then((response) => {
        if (!response.ok) {
            throw new Error(`Supabase ${response.status}`);
        }

        return response;
    });
}

// The top 10, best first, as [{ name, score }]. A tie goes to whoever got
// there first. null if the table can't be reached.
export function fetchTopScores() {
    return request(`scores?select=name,score&order=score.desc,created_at.asc&limit=${TOP}`)
        .then((response) => response.json())
        .catch((error) => {
            console.warn("Hiscores:", error.message);
            return null;
        });
}

// Adds one score. true once it is saved, false if it wasn't.
export function addScore(name, score) {
    return request("scores", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ name, score })
    })
        .then(() => true)
        .catch((error) => {
            console.warn("Hiscores:", error.message);
            return false;
        });
}

// The end of the game (GAME OVER, or the outro): what the name entry needs,
// { points, rank }, if the score goes on the table -- it beats 10th place, or
// the table isn't full yet. null if it doesn't, or the table can't be
// reached. rank is 1 for the top; a tie goes below the score already there.
export function entryFor(points) {
    return fetchTopScores().then((scores) => {
        if (!scores) {
            return null;
        }

        if (scores.length >= TOP && points <= scores[TOP - 1].score) {
            return null;
        }

        const rank = scores.filter((row) => row.score >= points).length + 1;

        return { points, rank };
    });
}
