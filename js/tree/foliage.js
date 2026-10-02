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

export const FOLIAGE = { clusters, scatter, sprays, strands, fronds };
