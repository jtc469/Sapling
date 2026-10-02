// Accents: small decorations layered over foliage or skeleton.

import { hsl } from './color.js';

const WHITE_GLOSS = 'hsla(0,0%,100%,0.55)';

function fruit(B, A, rng) {
  if (!B.spots.length) return;
  for (let i = 0; i < Math.round(A.count); i++) {
    const s = rng.pick(B.spots);
    const r = A.size * rng.range(0.85, 1.15);
    const x = s.x + rng.signed(s.rx * 0.6), y = s.y + rng.signed(s.ry * 0.5);
    const base = { shape: 'ellipse', kind: 'accent', d: s.d, ax: x, ay: y };
    B.add({ ...base, x, y, rx: r, ry: r, fill: hsl(rng.pick(A.tones)), z: 40 });
    B.add({ ...base, x: x - r * 0.35, y: y + r * 0.35, rx: r * 0.35, ry: r * 0.35, fill: WHITE_GLOSS, z: 41 });
  }
}

function blossom(B, A, rng) {
  if (!B.spots.length) return;
  for (let i = 0; i < Math.round(A.count); i++) {
    const s = rng.pick(B.spots);
    const r = A.size * rng.range(0.8, 1.2);
    const x = s.x + rng.signed(s.rx * 0.8), y = s.y + rng.signed(s.ry * 0.7);
    const spin = rng.range(0, Math.PI * 2);
    const fill = hsl(rng.pick(A.tones));
    for (let k = 0; k < 5; k++) {
      const a = spin + (k * Math.PI * 2) / 5;
      B.add({ shape: 'ellipse', x: x + Math.cos(a) * r * 0.75, y: y + Math.sin(a) * r * 0.75, rx: r * 0.6, ry: r * 0.6, fill, z: 40, kind: 'accent', d: s.d, ax: x, ay: y });
    }
    B.add({ shape: 'ellipse', x, y, rx: r * 0.35, ry: r * 0.35, fill: hsl(A.centre ?? { h: 50, s: 80, l: 55 }), z: 41, kind: 'accent', d: s.d });
  }
}

function glow(B, A, rng) {
  const spots = B.spots.length ? B.spots : [...B.tips, ...B.crowns].map((t) => ({ ...t, rx: 4, ry: 4 }));
  if (!spots.length) return;
  for (let i = 0; i < Math.round(A.count); i++) {
    const s = rng.pick(spots);
    const r = A.size * rng.range(0.8, 1.3);
    const x = s.x + rng.signed(s.rx), y = s.y + rng.signed(s.ry) - s.ry * 0.3;
    const t = rng.pick(A.tones);
    const base = { shape: 'ellipse', kind: 'accent', d: s.d, x, y, ax: x, ay: y };
    B.add({ ...base, rx: r * 2.8, ry: r * 2.8, fill: hsl({ ...t, a: 0.22 }), z: 42 });
    B.add({ ...base, rx: r, ry: r, fill: hsl(t, 15), z: 43 });
  }
}

function sparkle(B, A, rng) {
  const spots = B.spots.length ? B.spots : [...B.tips, ...B.crowns].map((t) => ({ ...t, rx: 6, ry: 6 }));
  if (!spots.length) return;
  for (let i = 0; i < Math.round(A.count); i++) {
    const s = rng.pick(spots);
    const x = s.x + rng.signed(s.rx * 1.2), y = s.y + rng.signed(s.ry * 1.2);
    const r = A.size * rng.range(0.6, 1.2), w = r * 0.28;
    B.add({
      shape: 'poly', pts: [[x, y + r], [x + w, y + w], [x + r, y], [x + w, y - w], [x, y - r], [x - w, y - w], [x - r, y], [x - w, y + w]],
      ax: x, ay: y, fill: 'hsla(55,100%,97%,0.95)', z: 44, kind: 'accent', d: s.d,
    });
  }
}

// Cones hang beneath laterals of conifers.
function cones(B, A, rng) {
  const laterals = B.branches.filter((b) => b.depth >= 1);
  if (!laterals.length) return;
  for (let i = 0; i < Math.round(A.count); i++) {
    const b = rng.pick(laterals);
    const p = B.pointAt(b, rng.range(0.4, 0.9));
    const r = rng.range(1, 1.4);
    const x = p.x, y = p.y - r * 2.2;
    const base = { shape: 'ellipse', kind: 'accent', d: b.pts[b.pts.length - 1].d, ax: p.x, ay: p.y };
    B.add({ ...base, x, y, rx: r, ry: r * 2, fill: hsl({ h: 25, s: 45, l: 30 }), z: 34 });
    B.add({ ...base, x: x - r * 0.3, y: y + r * 0.4, rx: r * 0.4, ry: r * 1.1, fill: hsl({ h: 28, s: 45, l: 42 }), z: 34 });
  }
}

// Flowers crowning cactus tops.
function flowers(B, A, rng) {
  for (const c of B.crowns) {
    if (!rng.chance(0.75)) continue;
    const n = rng.int(1, 3);
    for (let k = 0; k < n; k++) {
      const x = c.x + rng.signed(c.w * 0.35), y = c.y + c.w * 0.45;
      const r = rng.range(1.6, 2.2);
      const fill = hsl(rng.pick(A.tones));
      for (let j = 0; j < 5; j++) {
        const a = (j * Math.PI * 2) / 5 + rng.signed(0.3);
        B.add({ shape: 'ellipse', x: x + Math.cos(a) * r * 0.7, y: y + Math.sin(a) * r * 0.7, rx: r * 0.6, ry: r * 0.6, fill, z: 40, kind: 'accent', d: c.d, ax: x, ay: y });
      }
      B.add({ shape: 'ellipse', x, y, rx: r * 0.35, ry: r * 0.35, fill: hsl({ h: 45, s: 90, l: 50 }), z: 41, kind: 'accent', d: c.d });
    }
  }
}

function coconuts(B, A, rng) {
  for (const c of B.crowns) {
    for (let i = 0; i < Math.round(A.count); i++) {
      const x = c.x + rng.signed(3), y = c.y - rng.range(1.5, 3.5);
      const base = { shape: 'ellipse', kind: 'accent', d: c.d, ax: c.x, ay: c.y };
      B.add({ ...base, x, y, rx: 2.3, ry: 2.3, fill: hsl({ h: 30, s: 45, l: 28 }), z: 34 });
      B.add({ ...base, x: x - 0.7, y: y + 0.7, rx: 0.8, ry: 0.8, fill: 'hsla(0,0%,100%,0.25)', z: 34 });
    }
  }
}

export const ACCENTS = { fruit, blossom, glow, sparkle, cones, flowers, coconuts };
