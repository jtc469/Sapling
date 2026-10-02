// Forest: every session's tree, grouped by day, filterable by range and module.

import { store, moduleById } from '../store.js';
import { treeFor, sessionSvg } from '../trees.js';
import { MUTATIONS } from '../../tree/index.js';
import { esc, dot, cap } from '../ui.js';
import { RANGES, inRange, startOfDay, formatDay, formatMinutes, formatTime } from '../time.js';

const view = { range: 'week', moduleId: 'all' };
let root = null;
let observer = null;
let byId = new Map();

export const forestView = {
  title: 'Forest',
  mount(el) {
    root = el;
    root.addEventListener('click', onClick);
    // Trees are only rendered when their tile scrolls into view.
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const art = entry.target;
        const s = byId.get(art.dataset.art);
        if (s) art.innerHTML = sessionSvg(s);
        observer.unobserve(art);
      }
    }, { rootMargin: '200px' });
  },
  unmount() {
    root.removeEventListener('click', onClick);
    observer.disconnect();
    root = null;
  },
  render(el, data) {
    const modules = data.modules.filter((m) => !m.archived || data.sessions.some((s) => s.moduleId === m.id));
    if (view.moduleId !== 'all' && !modules.some((m) => m.id === view.moduleId)) view.moduleId = 'all';
    const sessions = inRange(data.sessions, view.range)
      .filter((s) => view.moduleId === 'all' || s.moduleId === view.moduleId)
      .sort((a, b) => b.start - a.start);
    byId = new Map(sessions.map((s) => [s.id, s]));

    const grown = sessions.filter((s) => s.completed).length;
    const minutes = sessions.reduce((t, s) => t + s.elapsedMin, 0);

    el.innerHTML = `
      <section class="page">
        <header class="page-head">
          <h1 class="display">Your forest</h1>
          <p class="lede">${grown} ${grown === 1 ? 'tree' : 'trees'} grown · ${formatMinutes(minutes)} focused</p>
        </header>
        <div class="filters">
          <div class="segmented" role="radiogroup" aria-label="Time range">
            ${Object.entries(RANGES).map(([k, r]) => `<button type="button" role="radio" aria-checked="${k === view.range}" data-range="${k}">${r.label}</button>`).join('')}
          </div>
          <div class="picks compact" role="radiogroup" aria-label="Module">
            <button type="button" class="pick" role="radio" aria-checked="${view.moduleId === 'all'}" data-module="all">All modules</button>
            ${modules.map((m) => `<button type="button" class="pick" role="radio" aria-checked="${view.moduleId === m.id}" data-module="${m.id}">${dot(m.colour)}<span>${esc(m.name)}</span></button>`).join('')}
          </div>
        </div>
        ${sessions.length ? groves(sessions) : empty(data)}
      </section>`;

    for (const art of el.querySelectorAll('[data-art]')) observer.observe(art);
  },
};

function groves(sessions) {
  const days = new Map();
  for (const s of sessions) {
    const day = startOfDay(s.start);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(s);
  }
  return [...days].map(([day, list]) => {
    const grown = list.filter((s) => s.completed).length;
    const minutes = list.reduce((t, s) => t + s.elapsedMin, 0);
    return `
      <section class="day">
        <h2>${formatDay(day)} <span class="muted">· ${grown} grown${list.length > grown ? `, ${list.length - grown} withered` : ''} · ${formatMinutes(minutes)}</span></h2>
        <div class="tiles">${list.map(tile).join('')}</div>
      </section>`;
  }).join('');
}

function tile(s) {
  const g = treeFor(s).genome;
  const m = moduleById(s.moduleId);
  const name = s.completed
    ? [...g.mutations.map((id) => MUTATIONS[id].label), g.name].join(' ')
    : `Withered ${g.name}`;
  const rarity = s.completed && g.rarity !== 'common' ? ` · ${cap(g.rarity)}` : '';
  const tip = [
    `<strong>${esc(name)}</strong>${rarity}`,
    `${m ? esc(m.name) : 'Deleted module'} · ${formatMinutes(s.elapsedMin)} · ${formatTime(s.start)}`,
    s.note ? `<em>${esc(s.note)}</em>` : '',
  ].filter(Boolean).join('<br>');
  const cls = s.completed ? `rarity-${g.rarity}` : 'withered';
  return `
    <figure class="tile ${cls}" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(name)}, ${esc(m?.name ?? '')}, ${formatMinutes(s.elapsedMin)}">
      <div class="art" data-art="${s.id}"></div>
      <figcaption>${m ? dot(m.colour) : ''}<span>${formatMinutes(s.elapsedMin)}</span></figcaption>
    </figure>`;
}

function empty(data) {
  const any = data.sessions.length > 0;
  return `
    <div class="empty-state">
      <p>${any ? 'No trees in this range yet.' : 'No trees yet. Your first focus session plants one.'}</p>
      <a class="button primary" href="#focus">Start focusing</a>
    </div>`;
}

function onClick(e) {
  const range = e.target.closest('[data-range]');
  const mod = e.target.closest('[data-module]');
  if (range) view.range = range.dataset.range;
  else if (mod) view.moduleId = mod.dataset.module;
  else return;
  forestView.render(root, store.get());
}
