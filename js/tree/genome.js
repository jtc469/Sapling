// seed + species -> genome: a plain object of concrete numbers describing one
// individual tree. Cheap to compute, so rarity can be checked without building.

import { Rng } from './rng.js';
import { SPECIES } from './species.js';
import { applyMutations } from './mutations.js';

const isRange = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number';

// Every key gets its own forked stream, so adding a gene to a species later
// doesn't change the values already sampled for existing trees.
function sample(v, rng) {
  if (isRange(v)) return rng.range(v[0], v[1]);
  if (Array.isArray(v)) return v.map((x, i) => sample(x, rng.fork(i)));
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = sample(v[k], rng.fork(k));
    return out;
  }
  return v;
}

export function createGenome(speciesId, seed, { size = 0.5, mutations } = {}) {
  const sp = SPECIES[speciesId];
  if (!sp) throw new Error(`Unknown species: ${speciesId}`);
  const root = new Rng(seed).fork(speciesId);

  const g = {
    species: speciesId,
    name: sp.name,
    seed,
    tags: sp.tags,
    rule: sp.rule,
    genes: sample(sp.genes, root.fork('genes')),
    bark: sample(sp.bark, root.fork('bark')),
    foliage: sample(sp.foliage ?? [], root.fork('foliage')),
    accents: [],
    extras: {},
    ground: sp.ground ?? 'lush',
    size,
    sizeScale: 0.8 + 0.35 * size,
    mutations: [],
    rarity: 'common',
  };

  (sp.accents ?? []).forEach((spec, i) => {
    const r = root.fork(`accent${i}`);
    if (!r.chance(spec.chance ?? 1)) return;
    const a = sample(spec, r.fork('values'));
    if (a.toneSets) {
      a.tones = r.pick(a.toneSets);
      delete a.toneSets;
    }
    g.accents.push(a);
  });

  for (const [k, p] of Object.entries(sp.extras ?? {})) g.extras[k] = root.fork(`extra:${k}`).chance(p);

  applyMutations(g, root.fork('mutations'), mutations);
  return g;
}
