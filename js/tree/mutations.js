// Rare traits rolled on top of a species. Each has its own random stream, so
// odds are independent; only the rarest colour-changing mutation is kept.

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const rank = (id) => RARITIES.indexOf(MUTATIONS[id].rarity);

const sampleTone = (rng, [h, s, l, a]) => {
  const v = (x) => (Array.isArray(x) ? rng.range(x[0], x[1]) : x);
  const t = { h: v(h), s: v(s), l: v(l) };
  if (a != null) t.a = a;
  return t;
};

const hasLeaves = (g) => g.foliage.some((l) => l.type === 'clusters' || l.type === 'scatter');
const has = (g, tag) => g.tags.includes(tag);

function recolour(g, rng, ranges) {
  if (!g.foliage.length) {
    const { a, ...opaque } = sampleTone(rng, ranges[0]);
    Object.assign(g.bark, opaque);
    return;
  }
  for (const layer of g.foliage) layer.tones = ranges.map((r) => sampleTone(rng, r));
}

const sparkle = (rng) => ({ type: 'sparkle', count: rng.int(8, 14), size: rng.range(1.6, 2.4) });

export const MUTATIONS = {
  autumnal: {
    label: 'Autumnal', rarity: 'uncommon', chance: 0.1, colour: true,
    when: (g) => has(g, 'deciduous') && !has(g, 'autumn'),
    apply(g, rng) {
      recolour(g, rng, [[[2, 10], [65, 80], [42, 50]], [[18, 28], [75, 90], [50, 56]], [[38, 46], [80, 90], [52, 60]]]);
      g.extras.fallen = true;
    },
  },
  blooming: {
    label: 'Blooming', rarity: 'uncommon', chance: 0.08,
    when: (g) => hasLeaves(g) && !has(g, 'blossom') && !has(g, 'fantasy') && !has(g, 'grass'),
    apply(g, rng) {
      const [petal, centre] = rng.pick([
        [[0, 0, 97], [48, 90, 55]], [[340, 80, 88], [340, 60, 55]],
        [[52, 95, 70], [30, 90, 50]], [[280, 55, 82], [280, 45, 50]],
      ]);
      g.accents.push({ type: 'blossom', count: rng.int(22, 40), size: rng.range(1.2, 1.7),
        tones: [sampleTone(rng, petal)], centre: sampleTone(rng, centre) });
    },
  },
  fruiting: {
    label: 'Fruiting', rarity: 'uncommon', chance: 0.07,
    when: (g) => hasLeaves(g) && has(g, 'broadleaf') && !g.accents.some((a) => a.type === 'fruit'),
    apply(g, rng) {
      const fruit = rng.pick([[[0, 6], [70, 80], [44, 50]], [[18, 24], [75, 85], [62, 68]], [[280, 290], [35, 45], [32, 38]], [[348, 355], [75, 85], [36, 42]]]);
      g.accents.push({ type: 'fruit', count: rng.int(8, 14), size: rng.range(1.7, 2.4), tones: [sampleTone(rng, fruit)] });
    },
  },
  snowy: {
    label: 'Snowy', rarity: 'uncommon', chance: 0.07,
    when: (g) => !has(g, 'tropical') && !has(g, 'desert') && !has(g, 'fantasy'),
    apply(g) { g.extras.snow = true; g.ground = 'snow'; },
  },
  twisted: {
    label: 'Twisted', rarity: 'rare', chance: 0.035,
    when: (g) => (g.rule === 'fork' || g.rule === 'leader') && !has(g, 'grass'),
    apply(g, rng) {
      g.genes.curl = (g.genes.curl ?? 0) + rng.range(1.5, 2.8);
      g.genes.wobble = (g.genes.wobble ?? 3) * 1.6;
      // Extra lift stops curling branches spiralling down into the ground.
      g.genes.photo = (g.genes.photo ?? 0) + rng.range(0.6, 1);
      // Curled branches bunch their tips together, so thin the leaves out and
      // keep them off the lower trunk, or the canopy smothers the twisted shapes.
      for (const layer of g.foliage) {
        if (layer.density != null) layer.density *= 0.5;
        if (layer.type === 'clusters') layer.size *= 0.85;
        layer.minHeight = Math.max(layer.minHeight ?? 0, 0.35);
      }
    },
  },
  giant: {
    label: 'Giant', rarity: 'rare', chance: 0.03,
    when: () => true,
    apply(g) { g.sizeScale *= 1.25; },
  },
  bonsai: {
    label: 'Bonsai', rarity: 'epic', chance: 0.012, excludes: ['giant'],
    when: (g) => (g.rule === 'fork' || g.rule === 'leader') && !has(g, 'grass'),
    apply(g, rng) {
      // A miniature of the same species: half the height, a stouter trunk and
      // a windswept lean. Leaf pads scale by sqrt(size), so they stay chunky.
      g.sizeScale *= 0.5;
      g.genes.trunkWidth *= 1.15;
      g.genes.lean = (g.genes.lean ?? 0) + rng.signed(14);
      g.genes.wobble = (g.genes.wobble ?? 3) * 1.4;
      for (const layer of g.foliage) if (layer.type === 'sprays') layer.size *= 0.7;
      // Planted in a pot (extras.pot), with moss on the soil instead of ground clutter.
      for (const k of ['grass', 'flowers', 'mushrooms', 'rocks', 'fallen', 'swing', 'nest']) g.extras[k] = false;
      g.extras.moss = true;
      g.extras.pot = true;
    },
  },
  variegated: {
    label: 'Variegated', rarity: 'rare', chance: 0.03,
    when: hasLeaves,
    apply(g, rng) {
      for (const layer of g.foliage) {
        layer.tones.push(sampleTone(rng, [[50, 60], [40, 55], [78, 84]]), sampleTone(rng, [[65, 75], [30, 40], [70, 76]]));
      }
    },
  },
  bioluminescent: {
    label: 'Bioluminescent', rarity: 'epic', chance: 0.012, colour: true,
    when: () => true,
    apply(g, rng) {
      recolour(g, rng, [[[165, 185], [60, 75], [40, 50], 0.9], [[185, 200], [70, 85], [55, 65], 0.9]]);
      g.accents.push({ type: 'glow', count: rng.int(12, 20), size: rng.range(1, 1.4), tones: [{ h: 180, s: 90, l: 72 }] });
      g.extras.fireflies = true;
      g.bark.l *= 0.75;
    },
  },
  ghost: {
    label: 'Ghost', rarity: 'epic', chance: 0.01, colour: true,
    when: () => true,
    apply(g, rng) {
      recolour(g, rng, [[[200, 220], [10, 25], [88, 95], 0.7], [[200, 220], [10, 20], [80, 88], 0.7]]);
      Object.assign(g.bark, { h: 220, s: 8, l: 78 });
    },
  },
  crystal: {
    label: 'Crystal', rarity: 'legendary', chance: 0.005, colour: true,
    when: (g) => !has(g, 'mineral'),
    apply(g, rng) {
      recolour(g, rng, [[[180, 200], [60, 80], [70, 80], 0.75], [[260, 280], [50, 70], [78, 86], 0.75]]);
      Object.assign(g.bark, { h: 200, s: 25, l: 60 });
      g.accents.push(sparkle(rng));
    },
  },
  golden: {
    label: 'Golden', rarity: 'legendary', chance: 0.005, colour: true,
    when: () => true,
    apply(g, rng) {
      recolour(g, rng, [[[42, 48], [85, 95], [52, 58]], [[38, 44], [80, 90], [45, 50]], [[50, 55], [90, 100], [65, 72]]]);
      Object.assign(g.bark, { h: 32, s: 45, l: 38 });
      g.accents.push(sparkle(rng));
    },
  },
};

export function applyMutations(g, rng, forced) {
  const rolled = Object.keys(MUTATIONS).filter((id) => {
    const m = MUTATIONS[id];
    if (!m.when(g)) return false;
    return forced ? forced.includes(id) : rng.fork(id).chance(m.chance);
  });
  // Some traits contradict each other (a bonsai can't be giant).
  const ids = rolled.filter((id) => !rolled.some((o) => MUTATIONS[o].excludes?.includes(id)));
  const colour = ids.filter((id) => MUTATIONS[id].colour).sort((a, b) => rank(b) - rank(a));
  const chosen = ids.filter((id) => !MUTATIONS[id].colour).concat(colour.slice(0, 1));

  for (const id of chosen) MUTATIONS[id].apply(g, rng.fork(`${id}:apply`));
  g.mutations = chosen;
  g.rarity = RARITIES[Math.max(0, ...chosen.map(rank))];
}
