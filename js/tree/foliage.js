// Foliage layer types. Each takes the built skeleton and emits primitives.
// A species can stack several layers (e.g. willow = clusters + strands).
//
// Primitive z-order: 10-15 behind bark, 20-22 bark, 30-33 foliage, 34+ in front.

import { hsl } from './color.js';
import { DEG } from './builder.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Keeps roughly `target` anchors so dense trees don't explode in primitive count.
function thin(anchors, target, rng) {
  return anchors.length <= target ? anchors : anchors.filter(() => rng.chance(target / anchors.length));
}

// Puffy blobs: shadow, body and highlight per blob. aspect > 1 gives flat pads.
function clusters(B, L, rng) {
  const all = B.anchors(L.reach ?? 1, L.minHeight ?? 0);
  if (!all.length) return;
  const target = 260 * (L.density ?? 1);
  const anchors = thin(all, target, rng);
  const per = clamp(Math.round(target / anchors.length), 1, 5);
  const aspect = L.aspect ?? 1;
  const sizeK = Math.sqrt(B.g.sizeScale);

  for (const a of anchors) {
    const r0 = L.size * sizeK * rng.range(0.7, 1.15) * (a.tip ? 1 : 0.85);
    const tone = rng.pick(L.tones);
    for (let k = 0; k < per; k++) {
      const r = r0 * rng.range(0.55, 1);
      const x = a.x + rng.signed(r0 * 0.8) * aspect;
      const y = a.y + rng.signed(r0 * 0.5) + r0 * (L.lift ?? 0.2);
      const rx = r * aspect;
      const base = { shape: 'ellipse', kind: 'foliage', d: a.d };
      B.add({ ...base, x: x + r * 0.12, y: y - r * 0.22, rx: rx * 1.02, ry: r * 1.02, fill: hsl(tone, -9), z: 30 });
      B.add({ ...base, x, y, rx, ry: r, fill: hsl(tone), z: 31 });
      if (rng.chance(L.highlight ?? 0.55)) {
        B.add({ ...base, x: x - rx * 0.22, y: y + r * 0.28, rx: rx * 0.5, ry: r * 0.5, fill: hsl(tone, 8), z: 32 });
      }
      B.spots.push({ x, y, rx, ry: r, d: a.d });
    }
  }
}

// Many small individual leaves (birch, bamboo).
function scatter(B, L, rng) {
  const all = B.anchors(L.reach ?? 1, L.minHeight ?? 0);
  if (!all.length) return;
  const target = 700 * (L.density ?? 1);
  const anchors = thin(all, target / 3, rng);
  const per = clamp(Math.round(target / anchors.length), 1, 10);
  const spread = (L.spread ?? 7) * Math.sqrt(B.g.sizeScale);

  for (const a of anchors) {
    for (let k = 0; k < per; k++) {
      const tone = rng.pick(L.tones);
      const rx = L.size * rng.range(0.7, 1.2);
      const ry = rx / (L.aspect ?? 2);
      let rot, x, y;
      if (L.rot != null) {
        // Hanging leaves fanning out to either side of the stem.
        const flip = rng.chance(0.5);
        rot = (flip ? 180 - L.rot : L.rot) + rng.signed(L.rotJitter ?? 10);
        x = a.x + Math.cos(rot * DEG) * rx * 0.9;
        y = a.y + Math.sin(rot * DEG) * rx * 0.9 + rng.signed(spread * 0.5);
      } else {
        const ang = rng.range(0, Math.PI * 2);
        const dist = rng.range(0, spread);
        rot = rng.range(0, 180);
        x = a.x + Math.cos(ang) * dist;
        y = a.y + Math.sin(ang) * dist * 0.8 + spread * 0.25;
      }
      const layer = rng.float();
      const [z, dl] = layer < 0.3 ? [30, -8] : layer < 0.75 ? [31, 0] : [32, 7];
      B.add({ shape: 'ellipse', x, y, rx, ry, rot, fill: hsl(tone, dl), z, kind: 'foliage', d: a.d });
      if (k === 0) B.spots.push({ x, y, rx: spread * 0.6, ry: spread * 0.5, d: a.d });
    }
  }
}

// Evenly spaced points along a polyline, for smooth serrated outlines.
function resample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    const seg = Math.hypot(q.x - p.x, q.y - p.y);
    let s = step - carry;
    while (s <= seg) {
      const t = s / seg;
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, d: p.d + (q.d - p.d) * t });
      s += step;
    }
    carry = seg - (s - step);
  }
  const last = pts[pts.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

// Drooping needle sprays along every lateral (fir/spruce silhouettes).
function sprays(B, L, rng) {
  const laterals = B.branches.filter((b) => b.depth >= 1);
  const maxLen = Math.max(1, ...laterals.map((b) => b.length));

  for (const b of laterals) {
    const pts = resample(b.pts, 2.2);
    if (pts.length < 2) continue;
    const hw0 = L.size * (b.depth === 1 ? 1 : 0.7) * (0.55 + 0.45 * (b.length / maxLen));
    const upper = [], lower = [], band = [];
    pts.forEach((p, i) => {
      const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
      let nx = -(q.y - o.y), ny = q.x - o.x;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      if (ny < 0) { nx = -nx; ny = -ny; }
      const t = i / (pts.length - 1);
      const hw = hw0 * (1 - t * 0.85);
      const serr = i % 2 ? 1 : 0.6;
      upper.push([p.x + nx * hw * 0.55, p.y + ny * hw * 0.55]);
      lower.push([p.x - nx * hw * serr, p.y - ny * hw * serr - hw * 0.25]);
      band.push([p.x + nx * hw * 0.05, p.y + ny * hw * 0.05]);
    });
    const tone = rng.pick(L.tones);
    const end = b.pts[b.pts.length - 1];
    const base = { shape: 'poly', kind: 'foliage', d: end.d, ax: b.pts[0].x, ay: b.pts[0].y };
    B.add({ ...base, pts: [...upper, ...lower.reverse()], fill: hsl(tone, -5), z: 30 });
    B.add({ ...base, pts: [...upper, ...band.reverse()], fill: hsl(tone, 6), z: 31 });
    const mid = pts[Math.floor(pts.length / 2)];
    B.spots.push({ x: mid.x, y: mid.y, rx: hw0, ry: hw0 * 0.6, d: end.d, edge: upper });
  }

  // Pointed spire on top of the leader.
  const trunk = B.branches[0];
  const top = B.endOf(trunk);
  const s = L.size * Math.sqrt(B.g.sizeScale);
  const tone = L.tones[0];
  const base = { shape: 'poly', kind: 'foliage', d: top.d, ax: top.x, ay: top.y };
  B.add({ ...base, pts: [[top.x, top.y + s * 0.9], [top.x - s * 1.2, top.y - s * 2.6], [top.x + s * 1.2, top.y - s * 2.6]], fill: hsl(tone, -5), z: 30 });
  B.add({ ...base, pts: [[top.x, top.y + s * 0.9], [top.x - s * 1.2, top.y - s * 2.6], [top.x, top.y - s * 2.2]], fill: hsl(tone, 6), z: 31 });
}

// Hanging willow strands, drawn as dashed strokes that read as leaf beads.
// They only hang from the outer part of the crown, forming a curtain that
// leaves the trunk visible, and start growing late (from `L.from` progress).
function strands(B, L, rng) {
  const all = B.anchors(L.reach ?? 1, 0);
  const cx = B.endOf(B.branches[0]).x;
  const span = Math.max(1, ...all.map((a) => Math.abs(a.x - cx)));
  const outer = all.filter((a) => Math.abs(a.x - cx) >= span * (L.inner ?? 0));
  const anchors = thin(outer, 160 * (L.density ?? 1), rng);
  for (const a of anchors) {
    const n = rng.int(1, 2);
    const side = a.x >= cx ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const len = Math.min(L.length * B.g.sizeScale * rng.range(0.5, 1.15), a.y - 4);
      if (len < 4) continue;
      const tone = rng.pick(L.tones);
      const back = rng.chance(0.4);
      const sway = rng.signed(len * 0.08) + side * len * 0.06;
      const out = side * len * 0.1;
      B.add({
        shape: 'quad', p: [a.x, a.y, a.x + sway * 0.2 + out, a.y - len * 0.5, a.x + sway, a.y - len],
        ax: a.x, ay: a.y, stroke: hsl(tone, back ? -9 : 0), sw: L.width ?? 2.5, dash: [1.6, 1.4],
        z: back ? 15 : 33, kind: 'foliage', d: a.d, from: L.from,
      });
    }
  }
}

// Palm fronds: a drooping rib with leaflets down both sides.
function fronds(B, L, rng) {
  for (const c of B.crowns) {
    const n = Math.round(L.count);
    for (let i = 0; i < n; i++) {
      const ang = (-15 + (210 * (i + 0.5)) / n + rng.signed(10)) * DEG;
      const len = L.length * B.g.sizeScale * rng.range(0.75, 1.1) * (1 - 0.3 * Math.max(0, Math.sin(ang)));
      let dx = Math.cos(ang), dy = Math.sin(ang);
      let x = c.x, y = c.y;
      const rib = [[x, y]], segs = [];
      const step = 2.5;
      for (let s = step; s <= len; s += step) {
        const t = s / len;
        dy -= L.droop * 0.05 * t;
        const m = Math.hypot(dx, dy);
        dx /= m; dy /= m;
        x += dx * step;
        y += dy * step;
        rib.push([x, y]);
        if (t < 0.12) continue;
        const ll = L.leaflet * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.7;
        for (const side of [1, -1]) {
          const a = Math.atan2(dy, dx) + side * 55 * DEG;
          let lx = Math.cos(a), ly = Math.sin(a) - 0.6;
          const lm = Math.hypot(lx, ly);
          lx /= lm; ly /= lm;
          segs.push([x, y, x + lx * ll, y + ly * ll]);
        }
      }
      const tone = rng.pick(L.tones);
      const back = rng.chance(0.45);
      const base = { ax: c.x, ay: c.y, z: back ? 12 : 33, kind: 'foliage', d: c.d };
      B.add({ ...base, shape: 'lines', segs, stroke: hsl(tone, back ? -10 : 0), sw: L.width ?? 1.5 });
      B.add({ ...base, shape: 'polyline', pts: rib, stroke: hsl(tone, back ? -16 : -6), sw: 1.3 });
      B.spots.push({ x: c.x + dx * len * 0.5, y: c.y, rx: 4, ry: 3, d: c.d });
    }
  }
}

// ---------- Minerals (rule: mineral) ----------
// Mineral prims keep a dull grey `dead` fill, so a withered crystal reads as
// clouded rather than vanishing, and `deadOnly` cracks appear across it.

const DEAD_STONE = { h: 220, s: 6, l: 55 };
const CRACK = 'hsl(220,8%,30%)';

// One faceted column: three side faces and their pointed terminations,
// lit from the upper left. Positive `v` is the side facing the light.
function prism(B, c, tone, z, d, rng) {
  const ux = Math.cos(c.angle), uy = Math.sin(c.angle);
  const at = (s, v) => [c.x + ux * s - uy * v, c.y + uy * s + ux * v];
  const L = c.length, h = c.width / 2;
  const tip = Math.min(L * 0.4, c.width * 1.1);
  const shoulder = (v) => L - tip * (0.6 + (0.4 * Math.abs(v)) / h);
  const apex = at(L, rng.signed(h * 0.15));
  const edges = [h, h * 0.3, -h * 0.3, -h];
  const base = { shape: 'poly', kind: 'foliage', d, ax: c.x, ay: c.y, z };

  [[10, 16], [0, 7], [-12, -5]].forEach(([side, top], i) => {
    const v0 = edges[i], v1 = edges[i + 1];
    const s0 = at(shoulder(v0), v0), s1 = at(shoulder(v1), v1);
    B.add({ ...base, pts: [at(-3, v0), s0, s1, at(-3, v1)], fill: hsl(tone, side), dead: { fill: hsl(DEAD_STONE, side * 0.6) } });
    B.add({ ...base, pts: [s0, apex, s1], fill: hsl(tone, top), dead: { fill: hsl(DEAD_STONE, top * 0.6) } });
  });
  B.add({ ...base, shape: 'polyline', pts: [at(L * 0.12, h * 0.72), at(shoulder(h) - 1.5, h * 0.72)], stroke: hsl({ ...tone, a: 0.7 }, 25), sw: 0.7, z: z + 0.05 });
  const m = L * rng.range(0.35, 0.6);
  B.add({ ...base, shape: 'polyline', pts: [at(m, h * 0.9), at(m + 3, h * 0.1), at(m - 1, -h * 0.4), at(m + 2, -h * 0.9)], stroke: CRACK, sw: 0.5, z: z + 0.06, dead: 'keep', deadOnly: true });
  B.crowns.push({ x: apex[0], y: apex[1], d, w: c.width });
}

// A cluster of crystal columns fanning out of a lump of host rock.
function crystals(B, L, rng) {
  const { G, g } = B;
  const k = g.sizeScale;
  const tone = rng.pick(L.tones);
  const n = Math.max(3, Math.round(G.count));
  const cols = [];
  for (let i = 0; i < n; i++) {
    // u runs -1..1 across the cluster: tall upright columns in the middle,
    // shorter ones leaning further out at the edges.
    const u = clamp((i / (n - 1)) * 2 - 1 + rng.signed(0.2), -1, 1);
    const out = Math.abs(u);
    cols.push({
      x: u * G.spread * k, y: 1,
      angle: (90 + G.lean - u * G.fan + rng.signed(6)) * DEG,
      length: G.height * k * (1 - out * 0.5) * rng.range(0.7, 1.05),
      width: G.width * Math.sqrt(k) * (1 - out * 0.3) * rng.range(0.8, 1.15),
    });
  }
  // Tallest first: they grow first and sit behind the shorter ones.
  cols.sort((a, b) => b.length - a.length);
  cols.forEach((c, i) => prism(B, c, { ...tone, l: tone.l + rng.signed(5) }, 30 + i * 0.1, (i / n) * 0.7, rng));

  // The rock they grow from hides their roots.
  const rx = G.spread * k + G.width * 0.4, ry = 9 * Math.sqrt(k);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = (Math.PI * i) / 12;
    const r = 1 + rng.signed(0.12);
    pts.push([Math.cos(a) * rx * r, Math.max(-0.5, Math.sin(a) * ry * r - 0.5)]);
  }
  const base = { kind: 'foliage', d: 0, ax: 0, ay: 0, dead: 'keep' };
  B.add({ ...base, shape: 'poly', pts, fill: hsl(g.bark), z: 33.8 });
  B.add({ ...base, shape: 'ellipse', x: -rx * 0.3, y: ry * 0.5, rx: rx * 0.3, ry: ry * 0.28, fill: hsl(g.bark, 8), z: 33.9 });
}

// A split geode: a lumpy rind around agate bands and a cavity lined with
// crystal points. It fills in from the rind towards the centre.
function geode(B, L, rng) {
  const { G, g } = B;
  const k = g.sizeScale;
  const tone = rng.pick(L.tones);
  const rx = (G.width / 2) * k, ry = rx * G.aspect;
  const cy = ry - 2; // sunk a little into the ground
  const ph1 = rng.range(0, 7), ph2 = rng.range(0, 7);
  const lump = (a) => 1 + G.lump * (Math.sin(a * 3 + ph1) * 0.6 + Math.sin(a * 5 + ph2) * 0.4);
  // Every layer follows the same lumpy outline, inset from the rind.
  const wall = (a, inset) => [Math.cos(a) * lump(a) * (rx - inset), cy + Math.sin(a) * lump(a) * (ry - inset)];
  const ring = (inset, from = 0, to = Math.PI * 2, n = 32) => Array.from({ length: n }, (_, i) => wall(from + ((to - from) * i) / n, inset));
  const centre = { ax: 0, ay: cy };
  const base = { shape: 'poly', kind: 'foliage' };

  // Rind: it rises out of the ground first.
  B.add({ ...base, d: 0, ax: 0, ay: 0, pts: ring(0).map(([x, y]) => [x + 1, y - 1]), fill: hsl(g.bark, -10), z: 30, dead: 'keep' });
  B.add({ ...base, d: 0, ax: 0, ay: 0, pts: ring(0), fill: hsl(g.bark), z: 30.1, dead: 'keep' });
  B.add({ ...base, shape: 'polyline', d: 0, ax: 0, ay: 0, pts: ring(0.9, 1.9, 2.9, 8), stroke: hsl(g.bark, 12), sw: 1.1, z: 30.15, dead: 'keep' });

  // Agate bands, alternating milky chalcedony and a pale wash of the crystal colour.
  const R = G.rind * Math.sqrt(k), bw = 2.3 * Math.sqrt(k), nb = Math.round(G.bands);
  const bands = [{ h: tone.h, s: 12, l: 90 }, { h: tone.h, s: tone.s * 0.5, l: Math.min(92, tone.l + 18) }];
  for (let j = 0; j < nb; j++) {
    B.add({ ...base, ...centre, d: 0.15 + j * 0.06, pts: ring(R + j * bw), fill: hsl(bands[j % 2]), z: 30.2 + j * 0.01, dead: { fill: hsl(DEAD_STONE, 18 - j * 4) } });
  }
  const inset = R + nb * bw;
  B.add({ ...base, ...centre, d: 0.35, pts: ring(inset), fill: hsl(tone, -22), z: 30.4, dead: { fill: hsl(DEAD_STONE, -20) } });

  // Crystal points growing from the cavity wall towards the middle, each
  // split into a lit and a shaded facet.
  const n = Math.round(G.points);
  const da = (Math.PI / n) * 1.15;
  for (let i = 0; i < n; i++) {
    const a = ((i + rng.range(0, 0.6)) / n) * Math.PI * 2;
    const [mx, my] = wall(a, inset - 0.6);
    const reach = rng.range(0.22, 0.45);
    const apex = [mx * (1 - reach), my + (cy - my) * reach];
    const shade = rng.pick([0, 6]);
    const pt = { ...base, d: 0.45 + rng.range(0, 0.5), ax: mx, ay: my, z: 30.5 };
    B.add({ ...pt, pts: [wall(a - da, inset - 0.6), [mx, my], apex], fill: hsl(tone, 8 + shade), dead: { fill: hsl(DEAD_STONE, 4) } });
    B.add({ ...pt, pts: [[mx, my], wall(a + da, inset - 0.6), apex], fill: hsl(tone, -6 + shade), dead: { fill: hsl(DEAD_STONE, -6) } });
    if (i % 6 === 0) B.crowns.push({ x: apex[0], y: apex[1], d: pt.d, w: 4 });
  }

  const top = wall(Math.PI * 0.45, 0), mid = wall(Math.PI * 1.4, inset);
  B.add({ ...base, shape: 'polyline', d: 0, ax: 0, ay: 0, pts: [top, [top[0] + 3, cy + ry * 0.4], [-2, cy + 2], mid], stroke: CRACK, sw: 0.7, z: 30.6, dead: 'keep', deadOnly: true });
}

export const FOLIAGE = { clusters, scatter, sprays, strands, fronds, crystals, geode };
