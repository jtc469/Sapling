// The focus-session engine. Runs regardless of which view is open: it ticks
// the timer, completes sessions, and (in strict mode) kills the tree when you
// leave the tab for longer than the grace period.

import { store, uid, moduleById } from './store.js';
import { SPECIES_IDS } from '../tree/index.js';

// Dev aid: ?speed=60 makes a minute pass every second.
const SPEED = Math.max(1, Number(new URLSearchParams(location.search).get('speed')) || 1);
const HEARTBEAT_MS = 5000;

const tickers = new Set();
let timer = null;
let hiddenAt = null;
let lastHeartbeat = 0;
let lastResult = null;

export const sizeFor = (minutes) => Math.max(0, Math.min(1, (minutes - 10) / 110));

export function onTick(fn) {
  tickers.add(fn);
  return () => tickers.delete(fn);
}

export function status(now = Date.now()) {
  const a = store.get().active;
  if (!a) return null;
  const total = a.minutes * 60000;
  const elapsed = Math.min(total, (now - a.start) * SPEED);
  return { active: a, elapsed, total, remaining: total - elapsed, progress: elapsed / total, hidden: hiddenAt != null };
}

// The most recent finished session, shown on the focus screen until dismissed.
export const result = () => lastResult;
export const dismissResult = () => { lastResult = null; };

export function start(moduleId, minutes) {
  const m = moduleById(moduleId);
  const species = m.species === 'mixed' ? SPECIES_IDS[Math.floor(Math.random() * SPECIES_IDS.length)] : m.species;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  lastResult = null;
  store.update((d) => {
    d.active = { id: uid(), moduleId, species, seed, minutes, start: Date.now(), lastSeen: Date.now() };
    d.settings.lastMinutes = minutes;
    d.settings.lastModuleId = moduleId;
  });
}

export const giveUp = () => finish(false);

function finish(completed, at = Date.now()) {
  const s = status(at);
  if (!s) return;
  const a = s.active;
  lastResult = {
    id: a.id,
    moduleId: a.moduleId,
    species: a.species,
    seed: a.seed,
    minutes: a.minutes,
    start: a.start,
    end: at,
    elapsedMin: completed ? a.minutes : s.elapsed / 60000,
    progress: completed ? 1 : s.progress,
    completed,
    note: '',
  };
  hiddenAt = null;
  store.update((d) => {
    d.sessions.push(lastResult);
    d.active = null;
  });
}

function tick() {
  const now = Date.now();
  const s = status(now);
  if (!s) return stop();
  const { strict, graceSec } = store.get().settings;

  // Whichever came first wins: the timer finishing or the grace period running out.
  const endAt = s.active.start + s.total / SPEED;
  const killAt = strict && hiddenAt != null ? hiddenAt + graceSec * 1000 : Infinity;
  if (Math.min(endAt, killAt) <= now) return endAt <= killAt ? finish(true, endAt) : finish(false, killAt);

  if (now - lastHeartbeat > HEARTBEAT_MS) {
    lastHeartbeat = now;
    store.quietly((d) => { if (d.active) d.active.lastSeen = now; });
  }
  for (const fn of tickers) fn(s);
}

function run() {
  if (!timer) timer = setInterval(tick, 250);
  tick();
}

function stop() {
  clearInterval(timer);
  timer = null;
}

// Called once at startup. In strict mode a session whose page was closed
// for longer than the grace period withered while you were away.
export function resume() {
  const a = store.get().active;
  if (!a) return;
  const { strict, graceSec } = store.get().settings;
  const lastSeen = a.lastSeen ?? a.start;
  // Treat the closed page like a hidden tab; tick() then decides whether the
  // timer finished or the grace period ran out first.
  if (strict && Date.now() - lastSeen > graceSec * 1000 + HEARTBEAT_MS) hiddenAt = lastSeen;
  run();
}

document.addEventListener('visibilitychange', () => {
  if (!store.get().active) return;
  if (document.hidden) hiddenAt = Date.now();
  else {
    tick(); // may kill the session if the grace period has passed
    hiddenAt = null;
  }
});

store.subscribe((d) => (d.active ? run() : stop()));
