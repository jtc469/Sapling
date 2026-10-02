// App state, persisted to localStorage. All writes go through update() so
// every view re-renders from the same source of truth.

import { SPECIES_IDS } from '../tree/index.js';

const KEY = 'sapling.data.v1';
export const COLOUR_SLOTS = 8;

const blank = () => ({
  version: 1,
  modules: [],   // { id, name, colour (1-8), species | 'mixed', createdAt, archived }
  sessions: [],  // see session.js finish()
  active: null,  // the running session, so a reload doesn't lose it
  settings: { strict: true, graceSec: 10, lastMinutes: 25, lastModuleId: null },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...blank(), ...saved, settings: { ...blank().settings, ...saved.settings } };
    }
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return blank();
}

let data = load();
const listeners = new Set();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota or private mode */ }
}

export const store = {
  get: () => data,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  update(mutate) {
    mutate(data);
    persist();
    for (const fn of listeners) fn(data);
  },
  // Persist without re-rendering (e.g. the running session's heartbeat).
  quietly(mutate) {
    mutate(data);
    persist();
  },
  replace(next) {
    data = { ...blank(), ...next, settings: { ...blank().settings, ...next.settings } };
    persist();
    for (const fn of listeners) fn(data);
  },
};

// Another tab changed the data: adopt it.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return;
  try { store.replace(JSON.parse(e.newValue)); } catch { /* ignore malformed */ }
});

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

export const moduleById = (id) => data.modules.find((m) => m.id === id);

// New modules get a random species, preferring ones no active module uses
// so each module's trees stay recognisable in the forest.
export function nextSpecies() {
  const used = new Set(data.modules.filter((m) => !m.archived).map((m) => m.species));
  const free = SPECIES_IDS.filter((s) => !used.has(s));
  const pool = free.length ? free : SPECIES_IDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Colours follow the module, never its rank: a new module takes the lowest
// slot not used by an active module, so existing modules never repaint.
function freeColour() {
  const used = new Set(data.modules.filter((m) => !m.archived).map((m) => m.colour));
  for (let c = 1; c <= COLOUR_SLOTS; c++) if (!used.has(c)) return c;
  return (data.modules.length % COLOUR_SLOTS) + 1;
}

export const actions = {
  addModule({ name }) {
    const m = { id: uid(), name: name.trim(), colour: freeColour(), species: nextSpecies(), createdAt: Date.now(), archived: false };
    store.update((d) => {
      d.modules.push(m);
      d.settings.lastModuleId ??= m.id;
    });
    return m;
  },
  updateModule(id, patch) {
    store.update((d) => Object.assign(d.modules.find((m) => m.id === id), patch));
  },
  // Modules with history are archived so their sessions keep a name and colour.
  removeModule(id) {
    store.update((d) => {
      const used = d.sessions.some((s) => s.moduleId === id) || d.active?.moduleId === id;
      if (used) d.modules.find((m) => m.id === id).archived = true;
      else d.modules = d.modules.filter((m) => m.id !== id);
      if (d.settings.lastModuleId === id) d.settings.lastModuleId = d.modules.find((m) => !m.archived)?.id ?? null;
    });
  },
  setNote(sessionId, note) {
    store.update((d) => { d.sessions.find((s) => s.id === sessionId).note = note.trim(); });
  },
  deleteSession(id) {
    store.update((d) => { d.sessions = d.sessions.filter((s) => s.id !== id); });
  },
  updateSettings(patch) {
    store.update((d) => Object.assign(d.settings, patch));
  },
};
