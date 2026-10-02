// Focus: pick a module and duration, watch the tree grow, or give up.

import { store, actions, moduleById, nextSpecies } from '../store.js';
import * as session from '../session.js';
import { treeFor, sessionSvg } from '../trees.js';
import { renderTree, MUTATIONS } from '../../tree/index.js';
import { hashString } from '../../tree/rng.js';
import { esc, dot, speciesName, rarityChip, confirmDialog, toast } from '../ui.js';
import { formatClock, formatMinutes } from '../time.js';

const PRESETS = [15, 25, 45, 60, 90];
const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

let root = null;
let liveTree = null;
let lastRendered = -1;
const draft = { moduleId: null, minutes: null };

export const focusView = {
  title: 'Focus',
  mount(el) {
    root = el;
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('submit', onSubmit);
    this.untick = session.onTick(onTick);
  },
  unmount() {
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    root.removeEventListener('submit', onSubmit);
    this.untick();
    root = null;
  },
  render(el, data) {
    const modules = data.modules.filter((m) => !m.archived);
    if (data.active) el.innerHTML = activeHtml(data.active);
    else if (session.result()) el.innerHTML = resultHtml(session.result());
    else if (!modules.length) el.innerHTML = onboardHtml();
    else el.innerHTML = idleHtml(data, modules);
    if (data.active) onTick(session.status());
  },
};

const rerender = () => root && focusView.render(root, store.get());

function stage(inner, extra = '') {
  return `<div class="stage ${extra}">${inner}</div>`;
}

function onboardHtml() {
  const demo = renderTree(treeFor({ species: 'oak', seed: 7, minutes: 60 }));
  return `
    <section class="focus">
      ${stage(demo)}
      <div class="panel">
        <h1 class="display">Welcome to Sapling</h1>
        <p class="lede">Add the modules you're revising. Every focus session grows a tree for that module, and giving up kills it.</p>
        <form class="inline-form" data-form="first-module">
          <label class="sr-only" for="firstModule">Module name</label>
          <input id="firstModule" name="name" placeholder="e.g. Quantum Mechanics" maxlength="40" required autocomplete="off">
          <button class="primary" type="submit">Add module</button>
        </form>
      </div>
    </section>`;
}

function idleHtml(data, modules) {
  const { settings } = data;
  const m = moduleById(draft.moduleId) && !moduleById(draft.moduleId).archived
    ? moduleById(draft.moduleId)
    : moduleById(settings.lastModuleId) && !moduleById(settings.lastModuleId).archived ? moduleById(settings.lastModuleId) : modules[0];
  draft.moduleId = m.id;
  const minutes = draft.minutes ?? settings.lastMinutes;
  draft.minutes = minutes;

  // A faint glimpse of the kind of tree this module grows, behind the seed.
  const ghost = m.species === 'mixed' ? '' : `<div class="ghost">${renderTree(treeFor({ species: m.species, seed: hashString(m.id), minutes }), { ground: false })}</div>`;
  const seed = renderTree(treeFor({ species: m.species === 'mixed' ? 'oak' : m.species, seed: 1, minutes }), { progress: 0 });

  const picks = modules.map((mod) => `
    <button type="button" class="pick" role="radio" aria-checked="${mod.id === m.id}" data-module="${mod.id}">
      ${dot(mod.colour)}<span>${esc(mod.name)}</span>
    </button>`).join('');
  const custom = !PRESETS.includes(minutes);
  const durations = PRESETS.map((n) => `
    <button type="button" class="pick" role="radio" aria-checked="${n === minutes}" data-minutes="${n}">${formatMinutes(n)}</button>`).join('');

  const speciesText = m.species === 'mixed' ? 'a surprise tree' : `${article(speciesName(m.species))} <strong>${speciesName(m.species)}</strong>`;
  return `
    <section class="focus">
      ${stage(ghost + seed)}
      <div class="panel">
        <h1 class="display">What are you revising?</h1>
        <div class="picks" role="radiogroup" aria-label="Module">${picks}</div>
        <h2 class="label">For how long?</h2>
        <div class="picks" role="radiogroup" aria-label="Duration">
          ${durations}
          <label class="custom ${custom ? 'on' : ''}">
            <span class="sr-only">Custom minutes</span>
            <input type="number" min="1" max="240" step="1" inputmode="numeric" data-custom value="${custom ? minutes : ''}" placeholder="Custom">
            <span aria-hidden="true">min</span>
          </label>
        </div>
        <p class="hint">You'll plant ${speciesText}. Longer sessions grow bigger trees.</p>
        <button class="primary big" type="button" data-action="start">Start focusing</button>
        <p class="fine">${settings.strict
          ? `Strict mode is on: leaving this tab for more than ${settings.graceSec}s kills your tree.`
          : 'Strict mode is off: you can leave this tab while you focus.'} <a href="#modules">Change</a></p>
      </div>
    </section>`;
}

function activeHtml(a) {
  const m = moduleById(a.moduleId);
  const { strict, graceSec } = store.get().settings;
  liveTree = treeFor(a);
  lastRendered = -1;
  return `
    <section class="focus running">
      ${stage('', 'live')}
      <div class="panel">
        <div class="eyebrow">${m ? `${dot(m.colour)} ${esc(m.name)}` : ''}</div>
        <div class="clock" data-clock aria-live="off">--:--</div>
        <div class="meter" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="100" data-meter><span></span></div>
        <p class="hint">Growing ${article(speciesName(a.species))} ${speciesName(a.species)} · ${formatMinutes(a.minutes)} session</p>
        <div class="row">
          <button type="button" data-action="cancel" hidden>Cancel</button>
          <button class="ghost danger" type="button" data-action="give-up">Give up</button>
          <span class="fine" data-cancel-note hidden></span>
        </div>
        <p class="fine">${strict ? `Stay on this tab. Leaving for more than ${graceSec}s kills your tree.` : 'Strict mode is off.'}</p>
      </div>
    </section>`;
}

function resultHtml(r) {
  const tree = treeFor(r);
  const g = tree.genome;
  const m = moduleById(r.moduleId);
  const name = g.mutations.length ? `${g.mutations.map((id) => MUTATIONS[id].label).join(' ')} ${g.name}` : g.name;
  const chips = rarityChip(g);
  const pct = Math.round(r.progress * 100);
  const where = m ? `${dot(m.colour)} ${esc(m.name)}` : 'your forest';
  return `
    <section class="focus result ${r.completed ? `rarity-${g.rarity}` : 'withered'}">
      ${stage(sessionSvg(r))}
      <div class="panel">
        <div class="eyebrow">${r.completed ? 'Session complete' : 'Session abandoned'}</div>
        <h1 class="display">${r.completed ? `You grew ${article(name)} ${esc(name)}!` : `Your ${esc(g.name)} withered`}</h1>
        ${chips ? `<div class="chips">${chips}</div>` : ''}
        <p class="lede">${r.completed
          ? `${formatMinutes(r.elapsedMin)} added to ${where}.`
          : `You gave up after ${formatMinutes(r.elapsedMin)} (${pct}%). That time still counts towards ${where}.`}</p>
        <form class="note-form" data-form="note">
          <label for="note">What did you cover? <span class="muted">(optional)</span></label>
          <textarea id="note" name="note" rows="2" maxlength="200" placeholder="e.g. 2019 paper, Q1–3">${esc(r.note)}</textarea>
          <button type="submit">Save note</button>
        </form>
        <button class="primary big" type="button" data-action="again">${r.completed ? 'Plant another' : 'Try again'}</button>
      </div>
    </section>`;
}

function onTick(s) {
  if (!root || !s) return;
  const clock = root.querySelector('[data-clock]');
  if (!clock) return;
  clock.textContent = formatClock(s.remaining);
  const meter = root.querySelector('[data-meter]');
  meter.firstElementChild.style.width = `${s.progress * 100}%`;
  meter.setAttribute('aria-valuenow', Math.round(s.progress * 100));
  // First minute: a free Cancel instead of Give up.
  root.querySelector('[data-action="cancel"]').hidden = !s.cancellable;
  root.querySelector('[data-action="give-up"]').hidden = s.cancellable;
  const note = root.querySelector('[data-cancel-note]');
  note.hidden = !s.cancellable;
  note.textContent = `Free to cancel for ${Math.ceil(s.cancelLeft / 1000)}s`;
  if (Math.abs(s.progress - lastRendered) >= 0.0015 && liveTree) {
    lastRendered = s.progress;
    root.querySelector('.stage.live').innerHTML = renderTree(liveTree, { progress: s.progress });
  }
}

async function onClick(e) {
  const pickModule = e.target.closest('[data-module]');
  if (pickModule) { draft.moduleId = pickModule.dataset.module; return rerender(); }
  const pickMinutes = e.target.closest('[data-minutes]');
  if (pickMinutes) { draft.minutes = Number(pickMinutes.dataset.minutes); return rerender(); }

  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'start') session.start(draft.moduleId, draft.minutes);
  if (action === 'again') { session.dismissResult(); rerender(); }
  if (action === 'cancel') {
    if (session.cancel()) toast('Session cancelled. No tree was planted.');
    else toast("The free minute is over. Use Give up instead.");
  }
  if (action === 'give-up') {
    const ok = await confirmDialog({ title: 'Give up?', body: 'Your tree will wither. The time so far still counts.', confirm: 'Give up', danger: true });
    if (ok) session.giveUp();
  }
}

function onInput(e) {
  if (!e.target.matches('[data-custom]')) return;
  const n = Math.round(Number(e.target.value));
  if (n >= 1 && n <= 240) {
    draft.minutes = n;
    root.querySelectorAll('[data-minutes]').forEach((b) => b.setAttribute('aria-checked', 'false'));
    e.target.closest('.custom').classList.add('on');
  }
}

function onSubmit(e) {
  e.preventDefault();
  const form = e.target.dataset.form;
  const value = new FormData(e.target).get(form === 'note' ? 'note' : 'name');
  if (form === 'first-module' && value.trim()) {
    const m = actions.addModule({ name: value, species: nextSpecies() });
    draft.moduleId = m.id;
    toast(`Added ${m.name}. It grows ${speciesName(m.species)} trees.`);
  }
  if (form === 'note') {
    actions.setNote(session.result().id, value);
    toast('Note saved');
  }
}
