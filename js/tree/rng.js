// Deterministic randomness. Every tree is a pure function of its seed, so we
// only ever need to store the seed, never the geometry.

export function hashString(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.seed = typeof seed === 'number' ? seed >>> 0 : hashString(String(seed));
    this.next = mulberry32(this.seed);
  }

  // An independent stream keyed by label. Adding new draws to one stream never
  // shifts the values of another, so new genes don't reshuffle existing trees.
  fork(label) { return new Rng(hashString(`${this.seed}:${label}`)); }

  float() { return this.next(); }
  range(lo, hi) { return lo + this.next() * (hi - lo); }
  int(lo, hi) { return Math.floor(this.range(lo, hi + 1)); }
  signed(m = 1) { return (this.next() * 2 - 1) * m; }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  // Rounds a float count stochastically: 2.3 -> 2 (70%) or 3 (30%).
  count(x) { return Math.floor(x) + (this.next() < x % 1 ? 1 : 0); }
}
