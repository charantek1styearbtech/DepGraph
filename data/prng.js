// data/prng.js — deterministic pseudo-random number generator.
//
// Every "random" choice in the seed dataset flows through mulberry32 with a
// FIXED seed, so `npm run seed` produces byte-identical graph data every time.
// This satisfies the assignment rule: never randomly regenerate the graph.

export const DATASET_SEED = 1337;

/** mulberry32 — tiny, fast, deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed = DATASET_SEED) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience helpers layered over mulberry32. */
export function createRng(seed = DATASET_SEED) {
  const next = mulberry32(seed);
  return {
    next,

    /** float in [min, max) */
    float(min, max) {
      return min + next() * (max - min);
    },

    /** integer in [min, max] inclusive */
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },

    pick(array) {
      return array[Math.floor(next() * array.length)];
    },

    /** Fisher-Yates sample WITHOUT mutating the input. */
    sample(array, n) {
      const copy = [...array];
      const out = [];
      while (out.length < n && copy.length > 0) {
        out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]);
      }
      return out;
    },
  };
}
