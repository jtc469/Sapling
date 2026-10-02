# Sapling

A stripped-down study timer in the spirit of the Forest app: focus on a module, grow a tree. Give up, and it withers.

- **Focus**: pick a module and a duration, then watch a procedurally generated tree grow in real time.
- **Free cancel**: changed your mind? Cancel in the first minute and nothing is recorded.
- **Strict mode**: leave the tab for longer than the grace period and your tree dies.
- **Forest**: every session's tree, grouped by day and filterable by module.
- **Stats**: focused time, trees grown, streaks, time per module, the last 7 days and full history.
- **Modules**: each module gets its own colour and a species picked at random when you add it (trees, crystals or geodes).

Everything is stored in your browser (`localStorage`). Use *Modules > Export backup* to keep a copy.

## Run

```bash
python serve.py
```

| Page | URL |
| --- | --- |
| App | http://localhost:5173/ |
| Tree Lab (tune the generator) | http://localhost:5173/playground.html |

ES modules need a server; `serve.py` disables caching so edits show on reload.
Add `?speed=60` to the app URL to make a minute pass every second while testing.

## App (`js/app/`)

| File | Role |
| --- | --- |
| `store.js` | State and persistence; all writes go through `store.update()` |
| `session.js` | Focus-session engine: timer, completion, strict mode, resume after reload |
| `trees.js` | Builds and caches each session's tree |
| `views/` | `focus`, `forest`, `stats`, `modules` |
| `main.js` | Hash router and app chrome |

## Tree engine (`js/tree/`)

Every tree is a pure function of `(species, seed, size)`, so a session only needs to store its seed.

```
seed + species ─► genome ─► builder + rule ─► foliage / accents / extras ─► primitives ─► renderer (SVG)
```

| File | Role |
| --- | --- |
| `species.js` | Species as data: gene ranges + which parts they use |
| `genome.js` | Samples a species' ranges from the seed |
| `mutations.js` | Rare traits (autumnal, snowy, bonsai, golden, crystal...) and rarity tiers |
| `rules.js` | Skeleton growth: `fork`, `leader`, `palm`, `cactus`, `mineral` (no skeleton) |
| `foliage.js` | Leaf layers: `clusters`, `scatter`, `sprays`, `strands`, `fronds`; mineral forms: `crystals`, `geode` |
| `accents.js` | Fruit, blossom, glow, sparkle, cones, cactus flowers, coconuts |
| `extras.js` | Grass, flowers, mushrooms, rocks, fallen leaves, snow, fireflies, nest, swing, moss, bonsai pot |
| `renderer.js` | SVG output for any growth `progress` (0-1) and the `dead` state |

```js
import { growTree, renderTree } from './js/tree/index.js';

const tree = growTree({ species: 'oak', seed: 1234, size: 0.6 }); // size ~ session length
el.innerHTML = renderTree(tree, { progress: 0.4 });               // live growth
el.innerHTML = renderTree(tree, { progress: 0.4, dead: true });   // gave up at 40%
```

### Adding a species

Add an entry to `SPECIES` in `species.js`: pick a `rule`, a bark `style`, one or more `foliage` layers, optional `accents`, and `extras` chances. Any `[lo, hi]` pair is sampled per tree. Each value draws from its own seeded stream, so adding genes never changes existing trees.

Crystals and geodes use the `mineral` rule: no branches, and a single foliage layer draws the whole form, with `bark` as the host rock colour. A withered one turns grey and cracks instead of dropping leaves.

**Bonsai** (epic) is a mutation, not a species: any `fork` or `leader` tree can roll it. It grows at half size in a glazed pot, and the renderer lifts the tree onto the pot's soil.
