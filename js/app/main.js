import { store, moduleById } from './store.js';
import * as session from './session.js';
import { focusView } from './views/focus.js';
import { forestView } from './views/forest.js';
import { statsView } from './views/stats.js';
import { modulesView } from './views/modules.js';
import { formatClock } from './time.js';

const VIEWS = { focus: focusView, forest: forestView, stats: statsView, modules: modulesView };
const root = document.getElementById('view');
const pill = document.getElementById('livePill');
let current = null;
let currentName = null;

function route() {
  const name = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'focus';
  if (name !== currentName) {
    current?.unmount();
    current = VIEWS[name];
    currentName = name;
    current.mount(root);
    window.scrollTo(0, 0);
  }
  current.render(root, store.get());
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  updateChrome(session.status());
}

// The header pill keeps a running session visible from every other view.
function updateChrome(s) {
  const showPill = s && currentName !== 'focus';
  pill.hidden = !showPill;
  if (showPill) {
    const m = moduleById(s.active.moduleId);
    pill.innerHTML = `<span class="dot" style="--c: var(--series-${m?.colour ?? 0})" aria-hidden="true"></span>${formatClock(s.remaining)} left`;
  }
  document.title = s ? `${formatClock(s.remaining)} · Sapling` : `${current.title} · Sapling`;
}

store.subscribe((data) => {
  current.render(root, data);
  updateChrome(session.status());
});
session.onTick(updateChrome);
window.addEventListener('hashchange', route);

// Recovery can finish a session and notify subscribers synchronously.
// Mount the initial view before those subscribers try to render it.
route();
session.resume();
