// Colours are stored as tone objects {h, s, l, a?} and turned into CSS strings
// late, so shading and recolouring stay simple arithmetic.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function hsl(t, dl = 0, ds = 0) {
  const h = ((Math.round(t.h) % 360) + 360) % 360;
  const s = Math.round(clamp(t.s + ds, 0, 100));
  const l = Math.round(clamp(t.l + dl, 0, 100));
  return t.a != null && t.a < 1 ? `hsla(${h},${s}%,${l}%,${t.a})` : `hsl(${h},${s}%,${l}%)`;
}

export function deadTone(t) {
  // Dry, brown-grey wood regardless of the living colour.
  return { h: 30, s: 8 + t.s * 0.12, l: t.l + (44 - t.l) * 0.6 };
}
