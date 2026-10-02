// Modules: add, rename, recolour, archive. Plus settings and backups.
// Each module's species is picked at random when it's added.

import { store, actions, COLOUR_SLOTS } from '../store.js';
import { esc, dot, speciesName, speciesNoun, confirmDialog, toast } from '../ui.js';
import { formatMinutes } from '../time.js';

let root = null;

export const modulesView = {
  title: 'Modules',
  mount(el) {
    root = el;
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('submit', onSubmit);
  },
  unmount() {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    root.removeEventListener('submit', onSubmit);
    root = null;
  },
  render(el, data) {
    const active = data.modules.filter((m) => !m.archived);
    const archived = data.modules.filter((m) => m.archived);
    const minutes = (id) => data.sessions.filter((s) => s.moduleId === id).reduce((t, s) => t + s.elapsedMin, 0);
    const { settings } = data;

    el.innerHTML = `
      <section class="page narrow">
        <header class="page-head">
          <h1 class="display">Modules</h1>
          <p class="lede">Each module grows its own kind of tree (or crystal), picked at random when you add it, so your forest shows where your revision went.</p>
        </header>

        <form class="card-panel add-module" data-form="add">
          <label class="field grow">Module name
            <input name="name" placeholder="e.g. Complex Analysis" maxlength="40" required autocomplete="off">
          </label>
          <button class="primary" type="submit">Add module</button>
        </form>

        ${active.length ? `<ul class="module-list">${active.map((m) => row(m, minutes(m.id), data)).join('')}</ul>`
          : '<p class="muted center">No modules yet. Add the first one above.</p>'}

        ${archived.length ? `
          <h2 class="section-title">Archived</h2>
          <ul class="module-list archived">${archived.map((m) => `
            <li class="module-row">
              ${dot(m.colour)}
              <span class="module-name static">${esc(m.name)}</span>
              <span class="muted">${formatMinutes(minutes(m.id))}</span>
              <button type="button" data-restore="${m.id}">Restore</button>
            </li>`).join('')}
          </ul>` : ''}

        <h2 class="section-title">Settings</h2>
        <div class="card-panel settings">
          <label class="toggle">
            <input type="checkbox" data-setting="strict" ${settings.strict ? 'checked' : ''}>
            <span><strong>Strict mode</strong><br><span class="muted">Your tree dies if you leave the tab during a session.</span></span>
          </label>
          <label class="field inline">Grace period
            <select data-setting="graceSec" ${settings.strict ? '' : 'disabled'}>
              ${[5, 10, 30, 60].map((n) => `<option value="${n}" ${n === settings.graceSec ? 'selected' : ''}>${n} seconds</option>`).join('')}
            </select>
          </label>
        </div>

        <h2 class="section-title">Your data</h2>
        <div class="card-panel data-actions">
          <p class="muted">Everything is stored in this browser. Export a backup to move it or keep it safe.</p>
          <div class="row">
            <button type="button" data-action="export">Export backup</button>
            <label class="button">Import backup<input type="file" accept="application/json,.json" data-import hidden></label>
          </div>
        </div>
      </section>`;
  },
};

function row(m, min, data) {
  const used = new Set(data.modules.filter((x) => !x.archived && x.id !== m.id).map((x) => x.colour));
  const swatches = Array.from({ length: COLOUR_SLOTS }, (_, i) => i + 1).map((c) => `
    <button type="button" class="swatch ${c === m.colour ? 'on' : ''}" style="--c: var(--series-${c})" data-colour="${c}" data-id="${m.id}"
      aria-label="Colour ${c}${used.has(c) ? ' (used by another module)' : ''}" aria-pressed="${c === m.colour}"></button>`).join('');
  return `
    <li class="module-row">
      <details class="colour-picker">
        <summary aria-label="Change colour">${dot(m.colour)}</summary>
        <div class="swatches">${swatches}</div>
      </details>
      <label class="sr-only" for="name-${m.id}">Module name</label>
      <input class="module-name" id="name-${m.id}" value="${esc(m.name)}" maxlength="40" data-rename="${m.id}">
      <span class="module-species nowrap">${speciesName(m.species)}</span>
      <span class="muted nowrap">${formatMinutes(min)}</span>
      <button type="button" class="icon-button" data-remove="${m.id}" aria-label="Remove ${esc(m.name)}" title="Remove">×</button>
    </li>`;
}

async function onClick(e) {
  const colour = e.target.closest('[data-colour]');
  if (colour) return actions.updateModule(colour.dataset.id, { colour: Number(colour.dataset.colour) });

  const restore = e.target.closest('[data-restore]');
  if (restore) return actions.updateModule(restore.dataset.restore, { archived: false });

  const remove = e.target.closest('[data-remove]');
  if (remove) {
    const id = remove.dataset.remove;
    const m = store.get().modules.find((x) => x.id === id);
    const hasHistory = store.get().sessions.some((s) => s.moduleId === id);
    if (store.get().active?.moduleId === id) return toast('Finish or give up the running session first.');
    const ok = await confirmDialog(hasHistory
      ? { title: `Archive ${m.name}?`, body: 'It disappears from the focus screen but its trees and time stay in your forest and stats.', confirm: 'Archive' }
      : { title: `Delete ${m.name}?`, body: 'It has no sessions yet, so nothing else is affected.', confirm: 'Delete', danger: true });
    if (ok) actions.removeModule(id);
    return;
  }

  if (e.target.closest('[data-action="export"]')) exportBackup();
}

function onChange(e) {
  const t = e.target;
  if (t.dataset.rename) {
    const name = t.value.trim();
    if (name) actions.updateModule(t.dataset.rename, { name });
    else t.value = store.get().modules.find((m) => m.id === t.dataset.rename).name;
  } else if (t.dataset.setting === 'strict') {
    actions.updateSettings({ strict: t.checked });
  } else if (t.dataset.setting === 'graceSec') {
    actions.updateSettings({ graceSec: Number(t.value) });
  } else if (t.matches('[data-import]') && t.files[0]) {
    importBackup(t.files[0]);
    t.value = '';
  }
}

function onSubmit(e) {
  e.preventDefault();
  const form = new FormData(e.target);
  const name = String(form.get('name')).trim();
  if (!name) return;
  const m = actions.addModule({ name });
  toast(`Added ${m.name}. It grows ${speciesNoun(m.species)}.`);
  root.querySelector('[data-form="add"] input[name="name"]')?.focus();
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sapling-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.modules) || !Array.isArray(data.sessions)) throw new Error('not a Sapling backup');
    const ok = await confirmDialog({
      title: 'Replace your data?',
      body: `This backup has ${data.modules.length} modules and ${data.sessions.length} sessions. It replaces everything currently in this browser.`,
      confirm: 'Replace', danger: true,
    });
    if (ok) {
      store.replace({ ...data, active: null });
      toast('Backup imported');
    }
  } catch {
    toast("That file isn't a Sapling backup.");
  }
}
