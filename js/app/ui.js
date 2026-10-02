// Small shared UI helpers.

import { SPECIES } from '../tree/index.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const cap = (s) => s[0].toUpperCase() + s.slice(1);

export const speciesName = (id) => (id === 'mixed' ? 'Mixed' : SPECIES[id]?.name ?? id);

// What a module grows, as a plural: "Oak trees", "Geodes", "surprise trees".
export function speciesNoun(id) {
  if (id === 'mixed') return 'surprise trees';
  const sp = SPECIES[id];
  return sp?.tags.includes('mineral') ? `${sp.name}s` : `${speciesName(id)} trees`;
}

export const dot = (colour) => `<span class="dot" style="--c: var(--series-${colour})" aria-hidden="true"></span>`;

export function moduleLabel(m) {
  if (!m) return `<span class="module-label">${dot(0)}<span>Deleted module</span></span>`;
  return `<span class="module-label">${dot(m.colour)}<span>${esc(m.name)}</span></span>`;
}

export function rarityChip(g) {
  return g.rarity === 'common' ? '' : `<span class="chip r-${g.rarity}">${cap(g.rarity)}</span>`;
}

// One floating tooltip for any element with data-tip (HTML allowed, pre-escaped).
const tip = document.createElement('div');
tip.className = 'tooltip';
tip.setAttribute('role', 'tooltip');
document.body.appendChild(tip);

function placeTip(target) {
  const r = target.getBoundingClientRect();
  tip.innerHTML = target.dataset.tip;
  tip.classList.add('show');
  const t = tip.getBoundingClientRect();
  const x = Math.min(window.innerWidth - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2));
  const above = r.top - t.height - 8;
  tip.style.left = `${x}px`;
  tip.style.top = `${above > 8 ? above : r.bottom + 8}px`;
}

document.addEventListener('pointerover', (e) => {
  const target = e.target.closest?.('[data-tip]');
  if (target) placeTip(target);
  else tip.classList.remove('show');
});
document.addEventListener('focusin', (e) => {
  const target = e.target.closest?.('[data-tip]');
  if (target) placeTip(target);
});
document.addEventListener('focusout', () => tip.classList.remove('show'));
document.addEventListener('scroll', () => tip.classList.remove('show'), true);

// Promise-based confirm using the shared <dialog id="confirm">.
export function confirmDialog({ title, body, confirm = 'Confirm', danger = false }) {
  const dlg = document.getElementById('confirm');
  dlg.querySelector('h2').textContent = title;
  dlg.querySelector('p').textContent = body;
  const ok = dlg.querySelector('[value="ok"]');
  ok.textContent = confirm;
  ok.classList.toggle('danger', danger);
  const form = dlg.querySelector('form');
  dlg.returnValue = '';
  dlg.showModal();
  // Resolve on submit (fires synchronously with the button press) rather than
  // only on 'close', which can be deferred; 'close' still covers Escape.
  return new Promise((resolve) => {
    const done = (ok) => {
      form.removeEventListener('submit', onSubmit);
      dlg.removeEventListener('close', onClose);
      resolve(ok);
    };
    const onSubmit = (e) => done(e.submitter?.value === 'ok');
    const onClose = () => done(dlg.returnValue === 'ok');
    form.addEventListener('submit', onSubmit);
    dlg.addEventListener('close', onClose);
  });
}

export function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}
