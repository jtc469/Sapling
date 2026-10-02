// Ground and ambient decorations. `at` is the growth progress (0-1) at which
// an extra appears; `ground` extras ignore the tree's growth scaling.
// `dead` controls what happens when the session was abandoned:
//   'hide' (default) | 'keep' | a replacement fill/stroke colour.

import { hsl } from './color.js';

const GRASS = {
  lush: { h: 100, s: 40, l: 40 },
  dry: { h: 48, s: 40, l: 55 },
  sand: { h: 75, s: 30, l: 45 },
  snow: { h: 110, s: 20, l: 45 },
  stone: { h: 80, s: 20, l: 42 },
};
const STRAW = hsl({ h: 40, s: 30, l: 52 });
const FLOWER_COLOURS = [{ h: 0, s: 0, l: 97 }, { h: 50, s: 95, l: 60 }, { h: 330, s: 70, l: 70 }, { h: 270, s: 50, l: 70 }, { h: 200, s: 70, l: 65 }];

function crownBox(B) {
  const points = B.spots.length ? B.spots : [...B.tips, ...B.crowns].map((t) => ({ ...t, rx: 4, ry: 4 }));
  const src = points.length ? points : B.branches.flatMap((b) => b.pts).map((p) => ({ ...p, rx: p.w / 2, ry: 0 }));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of src) {
    minX = Math.min(minX, s.x - s.rx); maxX = Math.max(maxX, s.x + s.rx);
    minY = Math.min(minY, s.y - s.ry); maxY = Math.max(maxY, s.y + s.ry);
  }
  return { minX, maxX, minY, maxY };
}

function grass(B, rng) {
  const tone = GRASS[B.g.ground] ?? GRASS.lush;
  const segs = [];
  for (let i = 0, n = rng.int(4, 8); i < n; i++) {
    const x = rng.signed(40);
    for (let k = 0, blades = rng.int(3, 5); k < blades; k++) {
      const bx = x + rng.signed(1.5), h = rng.range(2.5, 5.5);
      segs.push([bx, 0.5, bx + rng.signed(2.2), 0.5 + h]);
    }
  }
  B.add({ shape: 'lines', segs, stroke: hsl(tone, rng.signed(5)), sw: 1, z: 50, kind: 'extra', at: 0, ground: true, dead: { stroke: STRAW } });
}

function flowers(B, rng) {
  for (let i = 0, n = rng.int(2, 5); i < n; i++) {
    const x = rng.signed(40) || 10, h = rng.range(3, 6);
    const lean = rng.signed(1);
    const at = rng.range(0.4, 0.8);
    B.add({ shape: 'lines', segs: [[x, 0.5, x + lean, h]], stroke: hsl(GRASS.lush, -5), sw: 0.7, z: 50, kind: 'extra', at, ground: true });
    B.add({ shape: 'ellipse', x: x + lean, y: h, rx: 1.3, ry: 1.3, ax: x, ay: 0, fill: hsl(rng.pick(FLOWER_COLOURS)), z: 51, kind: 'extra', at, ground: true });
  }
}

function mushrooms(B, rng) {
  const red = rng.chance(0.5);
  const trunkW = B.branches[0]?.pts[0].w ?? 6;
  for (let i = 0, n = rng.int(1, 3); i < n; i++) {
    const side = rng.chance(0.5) ? 1 : -1;
    const x = side * (trunkW / 2 + rng.range(1, 9));
    const h = rng.range(1.8, 3.2), r = rng.range(1.8, 2.8);
    const cap = [];
    for (let k = 0; k <= 8; k++) {
      const a = (Math.PI * k) / 8;
      cap.push([x + Math.cos(a) * r, h + Math.sin(a) * r * 0.8]);
    }
    const base = { kind: 'extra', at: 0.65, ground: true, ax: x, ay: 0, dead: 'keep' };
    B.add({ ...base, shape: 'poly', pts: [[x - r * 0.3, 0.3], [x + r * 0.3, 0.3], [x + r * 0.25, h], [x - r * 0.25, h]], fill: hsl({ h: 40, s: 30, l: 88 }), z: 52 });
    B.add({ ...base, shape: 'poly', pts: cap, fill: red ? hsl({ h: 4, s: 75, l: 48 }) : hsl({ h: 28, s: 45, l: 40 }), z: 53 });
    if (red) for (let k = 0; k < 3; k++) {
      B.add({ ...base, shape: 'ellipse', x: x + rng.signed(r * 0.6), y: h + rng.range(0.3, 0.6) * r, rx: 0.4, ry: 0.4, fill: '#fff', z: 54 });
    }
  }
}

function rocks(B, rng) {
  for (let i = 0, n = rng.int(1, 2); i < n; i++) {
    const x = (rng.chance(0.5) ? 1 : -1) * rng.range(14, 40);
    const rx = rng.range(3.5, 7), ry = rx * rng.range(0.45, 0.65);
    const l = rng.range(55, 68);
    const base = { shape: 'ellipse', kind: 'extra', at: 0, ground: true, dead: 'keep' };
    B.add({ ...base, x, y: ry * 0.4, rx, ry, fill: hsl({ h: 210, s: 6, l }), z: 49 });
    B.add({ ...base, x: x - rx * 0.25, y: ry * 0.75, rx: rx * 0.45, ry: ry * 0.35, fill: hsl({ h: 210, s: 6, l: l + 10 }), z: 49 });
  }
}

function fallen(B, rng) {
  const tones = B.g.foliage[0]?.tones;
  if (!tones) return;
  const box = crownBox(B);
  for (let i = 0, n = rng.int(7, 13); i < n; i++) {
    const airborne = i < 4;
    const x = rng.range(box.minX, box.maxX);
    const y = airborne ? rng.range(4, Math.max(6, box.minY - 2)) : rng.range(0.4, 1.6);
    B.add({
      shape: 'ellipse', x, y, rx: 1.6, ry: 0.8, rot: rng.range(0, 180), fill: hsl(rng.pick(tones)),
      z: airborne ? 60 : 55, kind: 'extra', at: 0.88, ground: !airborne,
    });
  }
}

function snow(B, rng) {
  for (const s of B.spots) {
    if (!rng.chance(0.7)) continue;
    if (s.edge) {
      // A ridge of snow riding the top of a conifer spray.
      const pts = s.edge.map(([x, y]) => [x, y + 0.9]);
      const under = s.edge.map(([x, y]) => [x, y - 0.4]).reverse();
      B.add({ shape: 'poly', pts: [...pts, ...under], ax: s.edge[0][0], ay: s.edge[0][1], fill: 'hsl(210,40%,97%)', z: 35, kind: 'foliage', d: s.d });
    } else {
      B.add({ shape: 'ellipse', x: s.x, y: s.y + s.ry * 0.6, rx: s.rx * 0.7, ry: s.ry * 0.32, fill: 'hsl(210,40%,97%)', z: 35, kind: 'foliage', d: s.d });
    }
  }
}

function fireflies(B, rng) {
  const box = crownBox(B);
  for (let i = 0, n = rng.int(6, 12); i < n; i++) {
    const x = rng.range(box.minX - 8, box.maxX + 8), y = rng.range(Math.max(4, box.minY - 10), box.maxY + 6);
    const base = { shape: 'ellipse', x, y, kind: 'ambient', at: 0.9 };
    B.add({ ...base, rx: 2.4, ry: 2.4, fill: 'hsla(55,100%,70%,0.25)', z: 60 });
    B.add({ ...base, rx: 0.7, ry: 0.7, fill: 'hsl(55,100%,85%)', z: 61 });
  }
}

function nest(B, rng) {
  const forks = B.forks.filter((f) => f.depth >= 1 && f.depth <= 2);
  if (!forks.length) return;
  const f = rng.pick(forks);
  const base = { kind: 'extra', at: 0.95, ax: f.x, ay: f.y };
  const bowl = [];
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI + (Math.PI * k) / 10;
    bowl.push([f.x + Math.cos(a) * 4.5, f.y + 1 + Math.sin(a) * 2.6]);
  }
  B.add({ ...base, shape: 'ellipse', x: f.x - 1.2, y: f.y + 1.6, rx: 1.1, ry: 1.4, fill: 'hsl(190,55%,78%)', z: 45 });
  B.add({ ...base, shape: 'ellipse', x: f.x + 1.1, y: f.y + 1.5, rx: 1.1, ry: 1.4, fill: 'hsl(190,55%,72%)', z: 45 });
  B.add({ ...base, shape: 'poly', pts: bowl, fill: hsl({ h: 30, s: 40, l: 32 }), z: 46, dead: 'keep' });
  const twigs = [];
  for (let k = 0; k < 5; k++) {
    const y = f.y + rng.range(-1.2, 0.6);
    twigs.push([f.x - 4 + rng.range(0, 2), y, f.x + 2 + rng.range(0, 2.5), y + rng.signed(0.6)]);
  }
  B.add({ ...base, shape: 'lines', segs: twigs, stroke: hsl({ h: 32, s: 40, l: 45 }), sw: 0.5, z: 47, dead: 'keep' });
}

function swing(B, rng) {
  const options = B.branches.filter((b) => {
    if (b.depth < 1 || b.depth > 2 || b.length < 12) return false;
    const p = B.pointAt(b, 0.55);
    return Math.abs(Math.cos(p.angle)) > 0.75 && p.y > 28;
  });
  if (!options.length) return;
  const b = rng.pick(options);
  const p1 = B.pointAt(b, 0.45), p2 = B.pointAt(b, 0.65);
  const seat = rng.range(8, 11);
  const [l, r] = p1.x < p2.x ? [p1, p2] : [p2, p1];
  const base = { kind: 'extra', at: 0.95, dead: 'keep', ax: l.x, ay: l.y };
  B.add({ ...base, shape: 'lines', segs: [[l.x, l.y, l.x + 0.5, seat], [r.x, r.y, r.x - 0.5, seat]], stroke: hsl({ h: 35, s: 30, l: 70 }), sw: 0.6, z: 47 });
  B.add({ ...base, shape: 'poly', pts: [[l.x - 1, seat], [r.x + 1, seat], [r.x + 1, seat - 1.4], [l.x - 1, seat - 1.4]], fill: hsl({ h: 25, s: 45, l: 35 }), z: 48 });
}

function moss(B, rng) {
  const trunk = B.branches[0];
  if (!trunk) return;
  const w = trunk.pts[0].w;
  const tone = { h: rng.range(90, 110), s: 45, l: 38 };
  for (let k = 0; k < 6; k++) {
    const y = rng.range(0.5, 9);
    const x = B.pointAt(trunk, Math.min(1, y / trunk.length)).x + rng.signed(w * 0.4);
    B.add({ shape: 'ellipse', x, y, rx: rng.range(1, 2.2), ry: rng.range(0.7, 1.4), fill: hsl(tone, rng.signed(5)), z: 23, kind: 'extra', at: 0.4, dead: 'keep' });
  }
}

const GLAZES = [
  { h: 18, s: 50, l: 45 },  // terracotta
  { h: 205, s: 45, l: 40 }, // cobalt
  { h: 150, s: 22, l: 52 }, // celadon
  { h: 220, s: 8, l: 30 },  // charcoal
  { h: 40, s: 30, l: 78 },  // cream
];

// A shallow bonsai pot sized to the crown. Its rim height is stored as
// B.pot so the renderer can lift the tree onto the soil.
function pot(B, rng) {
  const box = crownBox(B);
  const w = Math.max(30, Math.min(56, (box.maxX - box.minX) * 0.55));
  const h = 7 + w * 0.08;
  B.pot = { w, h };
  const glaze = rng.pick(GLAZES);
  const half = w / 2, foot = 1.4, rim = 1.8;
  const base = { shape: 'poly', kind: 'extra', at: 0, ground: true, dead: 'keep' };
  for (const sx of [-1, 1]) {
    const x0 = sx * half * 0.7, x1 = x0 - sx * 4;
    B.add({ ...base, pts: [[x0, 0], [x1, 0], [x1, foot], [x0, foot]], fill: hsl(glaze, -14), z: 24 });
  }
  B.add({ ...base, pts: [[-half * 0.88, foot], [half * 0.88, foot], [half, h - rim], [-half, h - rim]], fill: hsl(glaze), z: 24.1 });
  B.add({ ...base, pts: [[half * 0.35, foot], [half * 0.88, foot], [half, h - rim], [half * 0.4, h - rim]], fill: hsl(glaze, -8), z: 24.2 });
  B.add({ ...base, pts: [[-half - 1, h - rim], [half + 1, h - rim], [half + 1, h], [-half - 1, h]], fill: hsl(glaze, 6), z: 24.3 });
  // Soil sits behind the trunk; the rim hides its front half.
  B.add({ ...base, shape: 'ellipse', x: 0, y: h, rx: half - 0.5, ry: 1.6, fill: hsl({ h: 28, s: 30, l: 22 }), z: 19 });
}

const EXTRAS = { grass, flowers, mushrooms, rocks, fallen, snow, fireflies, nest, swing, moss, pot };

export function addExtras(B, rng) {
  for (const [id, on] of Object.entries(B.g.extras)) {
    if (on && EXTRAS[id]) EXTRAS[id](B, rng.fork(id));
  }
}
