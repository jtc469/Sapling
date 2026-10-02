// Date ranges and formatting. Weeks start on Monday; everything is local time.

const DAY = 86400000;

export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ts, n) {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function startOfWeek(ts) {
  const d = new Date(startOfDay(ts));
  return addDays(d.getTime(), -((d.getDay() + 6) % 7));
}

export function startOfMonth(ts) {
  const d = new Date(startOfDay(ts));
  d.setDate(1);
  return d.getTime();
}

export const RANGES = {
  today: { label: 'Today', from: (now) => startOfDay(now) },
  week: { label: 'This week', from: (now) => startOfWeek(now) },
  month: { label: 'This month', from: (now) => startOfMonth(now) },
  all: { label: 'All time', from: () => 0 },
};

export const inRange = (sessions, range, now = Date.now()) => {
  const from = RANGES[range].from(now);
  return sessions.filter((s) => s.start >= from);
};

export function formatMinutes(min) {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatDay(ts, now = Date.now()) {
  const diff = Math.round((startOfDay(now) - startOfDay(ts)) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export const formatTime = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const shortWeekday = (ts) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short' });

// Consecutive days with at least one grown tree, counting back from today
// (or from yesterday, so the streak isn't "broken" before you've studied today).
export function streak(sessions, now = Date.now()) {
  const days = new Set(sessions.filter((s) => s.completed).map((s) => startOfDay(s.start)));
  let day = startOfDay(now);
  if (!days.has(day)) day = addDays(day, -1);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}
