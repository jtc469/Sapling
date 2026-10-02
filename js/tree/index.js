// Public API.
//   const tree = growTree({ species: 'oak', seed: 1234, size: 0.6 });
//   el.innerHTML = renderTree(tree, { progress: 0.5, dead: false });

import { Rng } from './rng.js';
import { createGenome } from './genome.js';
import { Builder } from './builder.js';
import { RULES } from './rules.js';
import { FOLIAGE } from './foliage.js';
import { ACCENTS } from './accents.js';
import { addExtras } from './extras.js';

export { createGenome } from './genome.js';
export { renderTree } from './renderer.js';
export { SPECIES, SPECIES_IDS } from './species.js';
export { MUTATIONS, RARITIES } from './mutations.js';

// Visible area above ground, in world units. Bigger trees are scaled to fit.
const MAX_HEIGHT = 152;
const MAX_HALF_WIDTH = 68;

export function growTree({ species, seed, size = 0.5, mutations }) {
  const genome = createGenome(species, seed, { size, mutations });
  const rng = new Rng(seed).fork('build');
  const B = new Builder(genome, rng.fork('skeleton'));

  RULES[genome.rule](B);
  genome.foliage.forEach((layer, i) => FOLIAGE[layer.type](B, layer, rng.fork(`foliage${i}`)));
  genome.accents.forEach((a, i) => ACCENTS[a.type]?.(B, a, rng.fork(`accent${i}`)));
  addExtras(B, rng.fork('extras'));

  const maxD = Math.max(1, ...B.branches.flatMap((b) => b.pts.map((p) => p.d)));
  const bounds = measure(B);
  // A potted tree is drawn raised by the pot's height (see renderer).
  const pot = B.pot ?? null;
  const lift = pot?.h ?? 0;
  const fit = Math.min(1, MAX_HEIGHT / (bounds.top + lift), MAX_HALF_WIDTH / Math.max(bounds.right, -bounds.left, 1));

  return { genome, branches: B.branches, prims: B.prims, maxD, bounds, fit, pot, lift };
}

function measure(B) {
  let left = 0, right = 0, top = 1;
  const grow = (x, y, r = 0) => {
    left = Math.min(left, x - r);
    right = Math.max(right, x + r);
    top = Math.max(top, y + r);
  };
  for (const b of B.branches) for (const p of b.pts) grow(p.x, p.y, p.w / 2);
  for (const pr of B.prims) {
    if (pr.ground) continue;
    if (pr.shape === 'ellipse') grow(pr.x, pr.y, Math.max(pr.rx, pr.ry));
    else if (pr.shape === 'poly' || pr.shape === 'polyline') pr.pts.forEach(([x, y]) => grow(x, y));
    else if (pr.shape === 'lines') pr.segs.forEach(([x1, y1, x2, y2]) => { grow(x1, y1); grow(x2, y2); });
    else if (pr.shape === 'quad') { grow(pr.p[0], pr.p[1]); grow(pr.p[4], pr.p[5]); }
  }
  return { left, right, top };
}
