import { growTree, renderTree, createGenome, SPECIES, SPECIES_IDS, MUTATIONS, RARITIES } from './tree/index.js';
import { hashString } from './tree/rng.js';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'sapling.treelab';
const MAX_ATTEMPTS = 6000;

const state = {
  species: 'all',
  mutation: 'natural',
  rarity: 'common',
  count: 24,
  seed: 1,
  size: 0.5,
  progress: 1,
  dead: false,
};

try { Object.assign(state, JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}')); } catch { /* storage unavailable */ }
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ } };

let cards = []; // { tree, art }
let selected = null;

const rarityRank = (r) => RARITIES.indexOf(r);

function setupControls() {
  $('species').innerHTML = `<option value="all">All species</option>` +
    SPECIES_IDS.map((id) => `<option value="${id}">${SPECIES[id].name}</option>`).join('');
  $('mutation').innerHTML = `<option value="natural">Natural odds</option><option value="none">None</option>` +
    Object.entries(MUTATIONS).map(([id, m]) => `<option value="${id}">${m.label} (${m.rarity})</option>`).join('');
  $('rarity').innerHTML = RARITIES.map((r, i) => `<option value="${r}">${i === 0 ? 'Any' : `${cap(r)}+`}</option>`).join('');

  for (const id of ['species', 'mutation', 'rarity']) $(id).value = state[id];
  $('count').value = String(state.count);
  $('seed').value = state.seed;
  $('size').value = state.size;
  $('progress').value = state.progress;
  $('dead').checked = state.dead;
  updateOutputs();

  const rebuildOn = (id, key, parse = (v) => v) => $(id).addEventListener('change', (e) => {
    state[key] = parse(e.target.value);
    save();
    build();
  });
  rebuildOn('species', 'species');
  rebuildOn('mutation', 'mutation');
  rebuildOn('rarity', 'rarity');
  rebuildOn('count', 'count', Number);
  rebuildOn('seed', 'seed', (v) => Math.max(0, Math.floor(Number(v) || 0)));

  $('size').addEventListener('input', (e) => { state.size = Number(e.target.value); updateOutputs(); });
  $('size').addEventListener('change', () => { save(); build(); });
  $('progress').addEventListener('input', (e) => { stopPlay(); state.progress = Number(e.target.value); updateOutputs(); renderAll(); });
  $('progress').addEventListener('change', save);
  $('dead').addEventListener('change', (e) => { state.dead = e.target.checked; save(); renderAll(); });
  $('reroll').addEventListener('click', reroll);
  $('play').addEventListener('click', () => (playing ? stopPlay() : startPlay()));

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || $('detail').open) return;
    if (e.key === 'r' || e.key === 'R') reroll();
    if (e.key === ' ') { e.preventDefault(); playing ? stopPlay() : startPlay(); }
  });

  $('detailClose').addEventListener('click', () => $('detail').close());
  $('detail').addEventListener('click', (e) => { if (e.target === $('detail')) $('detail').close(); });
  $('detail').addEventListener('close', () => { selected = null; });
}

function cap(s) { return s[0].toUpperCase() + s.slice(1); }

function updateOutputs() {
  const minutes = Math.round(10 + state.size * 110);
  $('sizeOut').textContent = `${minutes} min`;
  $('progressOut').textContent = `${Math.round(state.progress * 100)}%`;
}

function reroll() {
  state.seed = Math.floor(Math.random() * 1e6);
  $('seed').value = state.seed;
  save();
  build();
}

// Walk seeds from the base seed, skipping any that miss the rarity filter.
// Genomes are cheap, so filtering happens before the full build.
function pickSeeds() {
  const picks = [];
  const forced = state.mutation === 'natural' ? undefined : state.mutation === 'none' ? [] : [state.mutation];
  const min = rarityRank(state.rarity);
  for (let i = 0; picks.length < state.count && i < MAX_ATTEMPTS; i++) {
    const seed = hashString(`${state.seed}:${i}`);
    const species = state.species === 'all' ? SPECIES_IDS[i % SPECIES_IDS.length] : state.species;
    if (min > 0 && rarityRank(createGenome(species, seed, { size: state.size, mutations: forced }).rarity) < min) continue;
    picks.push({ species, seed, mutations: forced });
  }
  return picks;
}

function build() {
  const picks = pickSeeds();
  const grid = $('grid');
  grid.innerHTML = '';
  cards = picks.map(({ species, seed, mutations }) => {
    const tree = growTree({ species, seed, size: state.size, mutations });
    const g = tree.genome;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'card';
    el.dataset.rarity = g.rarity;
    el.innerHTML = `
      <div class="art"></div>
      <div class="meta">
        <div class="name">${g.name}<span class="seed">#${seed % 100000}</span></div>
        <div class="chips">${chips(g)}</div>
      </div>`;
    el.addEventListener('click', () => openDetail(tree));
    grid.appendChild(el);
    return { tree, art: el.querySelector('.art') };
  });
  if (!cards.length) grid.innerHTML = `<p class="empty">No trees matched within ${MAX_ATTEMPTS} seeds. Try a lower rarity filter.</p>`;
  renderAll();
  renderSummary();
}

function chips(g) {
  const rarity = g.rarity === 'common' ? '' : `<span class="chip r-${g.rarity}">${cap(g.rarity)}</span>`;
  return rarity + g.mutations.map((m) => `<span class="chip">${MUTATIONS[m].label}</span>`).join('');
}

function renderAll() {
  const opts = { progress: state.progress, dead: state.dead };
  for (const c of cards) c.art.innerHTML = renderTree(c.tree, opts);
  if (selected) $('detailTree').innerHTML = renderTree(selected, opts);
}

function renderSummary() {
  const counts = {};
  for (const c of cards) counts[c.tree.genome.rarity] = (counts[c.tree.genome.rarity] ?? 0) + 1;
  $('summary').innerHTML = RARITIES.filter((r) => counts[r])
    .map((r) => `<span class="chip ${r === 'common' ? '' : `r-${r}`}">${counts[r]} ${r}</span>`).join('');
}

function openDetail(tree) {
  selected = tree;
  const g = tree.genome;
  $('detailName').textContent = `${g.name} · #${g.seed}`;
  $('detailTags').innerHTML = chips(g) + g.tags.map((t) => `<span class="chip">${t}</span>`).join('');
  const { genes, bark, foliage, accents, extras, sizeScale, rule } = g;
  const round = (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
  $('detailGenome').textContent = JSON.stringify({ rule, sizeScale, genes, bark, foliage, accents, extras }, round, 2);
  $('detailTree').innerHTML = renderTree(tree, { progress: state.progress, dead: state.dead });
  $('detail').showModal();
}

// Growth animation, throttled so big grids stay responsive.
let playing = false;
function startPlay() {
  playing = true;
  $('play').textContent = 'Pause';
  const start = performance.now() - state.progress * 4000 * (state.progress < 1 ? 1 : 0);
  let last = 0;
  const tick = (now) => {
    if (!playing) return;
    state.progress = Math.min(1, (now - start) / 4000);
    if (now - last > 45 || state.progress === 1) {
      last = now;
      $('progress').value = state.progress;
      updateOutputs();
      renderAll();
    }
    if (state.progress < 1) requestAnimationFrame(tick);
    else stopPlay();
  };
  requestAnimationFrame(tick);
}

function stopPlay() {
  playing = false;
  $('play').textContent = 'Play';
  save();
}

setupControls();
build();
