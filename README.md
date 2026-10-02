# Sapling

A stripped-down study timer in the spirit of the Forest app: focus on a module, grow a tree.

Phase 1 (done): procedural tree engine + **Tree Lab** playground for tuning it.
Phase 2 (next): modules, focus timer, session log, your forest.

## Run

```bash
python serve.py
```

Then open http://localhost:5173/playground.html. (ES modules need a server; `serve.py` disables caching so edits show on reload.)

## Tree engine (`js/tree/`)

Every tree is a pure function of `(species, seed, size)`, so a session only needs to store its seed.

```
seed + species ─► genome ─► builder + rule ─► foliage / accents / extras ─► primitives ─► renderer (SVG)
```

| File | Role |
| --- | --- |
| `species.js` | Species as data: gene ranges + which parts they use |
| `genome.js` | Samples a species' ranges from the seed |
| `mutations.js` | Rare traits (autumnal, snowy, golden, crystal...) and rarity tiers |
| `rules.js` | Skeleton growth: `fork`, `leader`, `palm`, `cactus` |
| `foliage.js` | Leaf layers: `clusters`, `scatter`, `sprays`, `strands`, `fronds` |
| `accents.js` | Fruit, blossom, glow, sparkle, cones, cactus flowers, coconuts |
| `extras.js` | Grass, flowers, mushrooms, rocks, fallen leaves, snow, fireflies, nest, swing, moss |
| `renderer.js` | SVG output for any growth `progress` (0-1) and the `dead` state |

```js
import { growTree, renderTree } from './js/tree/index.js';

const tree = growTree({ species: 'oak', seed: 1234, size: 0.6 }); // size ~ session length
el.innerHTML = renderTree(tree, { progress: 0.4 });               // live growth
el.innerHTML = renderTree(tree, { progress: 0.4, dead: true });   // gave up at 40%
```

### Adding a species

Add an entry to `SPECIES` in `species.js`: pick a `rule`, a bark `style`, one or more `foliage` layers, optional `accents`, and `extras` chances. Any `[lo, hi]` pair is sampled per tree. Each value draws from its own seeded stream, so adding genes never changes existing trees.
