// Stats: headline numbers, time per module, the last 7 days, and history.

import { store, actions, moduleById } from '../store.js';
import { treeFor } from '../trees.js';
import { esc, moduleLabel, speciesName, rarityChip, confirmDialog } from '../ui.js';
import { RANGES, inRange, startOfDay, addDays, streak, formatMinutes, formatDay, formatTime, shortWeekday } from '../time.js';

const view = { range: 'week' };
let root = null;

export const statsView = {
  title: 'Stats',
  mount(el) {
    root = el;
    root.addEventListener('click', onClick);
  },
  unmount() {
    root.removeEventListener('click', onClick);
    root = null;
  },
  render(el, data) {
    const sessions = inRange(data.sessions, view.range);
    const minutes = sessions.reduce((t, s) => t + s.elapsedMin, 0);
    const grown = sessions.filter((s) => s.completed).length;
    const withered = sessions.length - grown;
    const days = streak(data.sessions);

    el.innerHTML = `
      <section class="page">
        <header class="page-head">
          <h1 class="display">Stats</h1>
        </header>
        <div class="filters">
          <div class="segmented" role="radiogroup" aria-label="Time range">
            ${Object.entries(RANGES).map(([k, r]) => `<button type="button" role="radio" aria-checked="${k === view.range}" data-range="${k}">${r.label}</button>`).join('')}
          </div>
        </div>
        <div class="kpis">
          ${kpi('Focused', formatMinutes(minutes))}
          ${kpi('Trees grown', grown)}
          ${kpi('Withered', withered, sessions.length ? `${Math.round((grown / sessions.length) * 100)}% success` : '')}
          ${kpi('Day streak', days, days === 1 ? 'day' : 'days')}
        </div>
        <div class="cards">
          <section class="card-panel">
            <h2>Time by module <span class="muted">· ${RANGES[view.range].label.toLowerCase()}</span></h2>
            ${moduleBars(data, sessions)}
          </section>
          <section class="card-panel">
            <h2>Last 7 days</h2>
            ${weekChart(data)}
          </section>
        </div>
        <section class="card-panel">
          <h2>History <span class="muted">· ${RANGES[view.range].label.toLowerCase()}</span></h2>
          ${history(sessions)}
        </section>
      </section>`;
  },
};

function kpi(label, value, sub = '') {
  return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`;
}

function totalsByModule(sessions) {
  const totals = new Map();
  for (const s of sessions) totals.set(s.moduleId, (totals.get(s.moduleId) ?? 0) + s.elapsedMin);
  return totals;
}

function moduleBars(data, sessions) {
  const totals = [...totalsByModule(sessions)].sort((a, b) => b[1] - a[1]);
  if (!totals.length) return `<p class="muted">No focus time in this range yet.</p>`;
  const max = totals[0][1];
  return `<div class="bars">${totals.map(([id, min]) => {
    const m = moduleById(id);
    const count = sessions.filter((s) => s.moduleId === id).length;
    const tip = `<strong>${esc(m?.name ?? 'Deleted module')}</strong><br>${formatMinutes(min)} · ${count} ${count === 1 ? 'session' : 'sessions'}`;
    return `
      <div class="bar-row">
        <div class="bar-label">${moduleLabel(m)}</div>
        <div class="bar-track">
          <div class="bar" style="width: ${Math.max(1.5, (min / max) * 100)}%; --c: var(--series-${m?.colour ?? 0})" data-tip="${esc(tip)}"></div>
          <span class="bar-value">${formatMinutes(min)}</span>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// Axis step that gives 2-4 clean gridlines.
function niceStep(maxMin) {
  for (const step of [15, 30, 60, 120, 180, 240]) if (maxMin / step <= 4) return step;
  return 360;
}

function weekChart(data) {
  const today = startOfDay(Date.now());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const order = data.modules.map((m) => m.id); // fixed order: colour and stack position follow the module
  const cells = days.map((day) => {
    const next = addDays(day, 1);
    const totals = totalsByModule(data.sessions.filter((s) => s.start >= day && s.start < next));
    return { day, totals, sum: [...totals.values()].reduce((a, b) => a + b, 0) };
  });
  const present = order.filter((id) => cells.some((c) => c.totals.get(id)));
  if (!present.length) return `<p class="muted">Nothing in the last 7 days yet.</p>`;

  const maxSum = Math.max(...cells.map((c) => c.sum));
  const step = niceStep(maxSum);
  const top = Math.max(step, Math.ceil(maxSum / step) * step);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  const legend = present.map((id) => moduleLabel(moduleById(id))).join('');
  const grid = ticks.map((t) => `<div class="tick" style="bottom: ${(t / top) * 100}%"><span>${t ? formatMinutes(t) : '0'}</span></div>`).join('');
  const cols = cells.map((c) => {
    const segs = present.filter((id) => c.totals.get(id)).map((id) => {
      const m = moduleById(id), min = c.totals.get(id);
      const tip = `<strong>${formatDay(c.day)}</strong><br>${esc(m?.name ?? 'Deleted module')} · ${formatMinutes(min)}`;
      return `<div class="seg" style="flex-grow: ${min}; --c: var(--series-${m?.colour ?? 0})" data-tip="${esc(tip)}"></div>`;
    }).join('');
    return `
      <div class="col">
        <div class="col-plot">
          ${c.sum ? `<div class="stack" style="height: ${(c.sum / top) * 100}%"><span class="cap">${formatMinutes(c.sum)}</span>${segs}</div>` : ''}
        </div>
        <div class="col-label ${c.day === today ? 'today' : ''}">${c.day === today ? 'Today' : shortWeekday(c.day)}</div>
      </div>`;
  }).join('');

  const table = `
    <details class="table-view">
      <summary>Show as table</summary>
      <div class="table-scroll"><table>
        <thead><tr><th scope="col">Module</th>${days.map((d) => `<th scope="col">${shortWeekday(d)}</th>`).join('')}</tr></thead>
        <tbody>${present.map((id) => `<tr><th scope="row">${esc(moduleById(id)?.name ?? 'Deleted module')}</th>${cells.map((c) => `<td>${c.totals.get(id) ? formatMinutes(c.totals.get(id)) : '–'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>
    </details>`;

  return `
    <div class="legend">${legend}</div>
    <div class="week-chart">
      <div class="grid">${grid}</div>
      <div class="cols">${cols}</div>
    </div>
    ${table}`;
}

function history(sessions) {
  if (!sessions.length) return `<p class="muted">No sessions in this range yet.</p>`;
  const rows = [...sessions].sort((a, b) => b.start - a.start).map((s) => {
    const g = treeFor(s).genome;
    return `
      <tr>
        <td><span class="nowrap">${formatDay(s.start)}</span> <span class="muted nowrap">${formatTime(s.start)}</span></td>
        <td>${moduleLabel(moduleById(s.moduleId))}</td>
        <td><span class="nowrap">${speciesName(g.species)}</span> ${s.completed ? rarityChip(g) : ''}</td>
        <td class="num">${formatMinutes(s.elapsedMin)}</td>
        <td>${s.completed ? '<span class="status good">✓ Grown</span>' : `<span class="status bad">✕ Withered</span>`}</td>
        <td class="note">${esc(s.note)}</td>
        <td><button type="button" class="icon-button" data-delete="${s.id}" aria-label="Delete session" title="Delete session">×</button></td>
      </tr>`;
  }).join('');
  return `
    <div class="table-scroll">
      <table class="history">
        <thead><tr><th scope="col">When</th><th scope="col">Module</th><th scope="col">Tree</th><th scope="col" class="num">Time</th><th scope="col">Result</th><th scope="col">Note</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function onClick(e) {
  const range = e.target.closest('[data-range]');
  if (range) {
    view.range = range.dataset.range;
    return statsView.render(root, store.get());
  }
  const del = e.target.closest('[data-delete]');
  if (del) {
    const ok = await confirmDialog({ title: 'Delete this session?', body: 'Its tree and time will be removed from your forest and stats.', confirm: 'Delete', danger: true });
    if (ok) actions.deleteSession(del.dataset.delete);
  }
}
