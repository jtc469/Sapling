// Turns a built tree into an SVG string at a given growth progress.
// Primitives sharing a z-level and style are merged into one <path>, so even
// a dense tree is only a few dozen DOM nodes.

import { hsl, deadTone } from './color.js';
import { Rng, hashString } from './rng.js';

const DEG = Math.PI / 180;
const VIEWBOX = '-75 -160 150 170'; // screen space: ground at y = 0, y points down
const LIGHT_AWAY = { x: 0.6, y: 0.8 }; // light comes from the upper left

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeOutBack = (t) => 1 + 2.6 * (t - 1) ** 3 + 1.6 * (t - 1) ** 2;
const f1 = (n) => Math.round(n * 10) / 10;
const r1 = (n) => Math.max(0.1, f1(n));

const TILE = { lush: { h: 95, s: 35, l: 68 }, dry: { h: 45, s: 40, l: 74 }, sand: { h: 40, s: 45, l: 80 }, snow: { h: 210, s: 30, l: 94 }, stone: { h: 30, s: 10, l: 70 } };
const DEAD_TILE = { h: 30, s: 18, l: 62 };

// `lift` raises everything except ground-fixed paths, so a potted tree
// grows from the pot's soil while the pot and ground stay put.
class Layers {
  constructor(lift = 0) {
    this.groups = new Map();
    this.shift = lift ? ` transform="translate(0 ${f1(-lift)})"` : '';
  }
  add(z, attrs, d, fixed = false) {
    if (!fixed) attrs += this.shift;
    const key = `${z}|${attrs}`;
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { z, attrs, d: [], order: this.groups.size }));
    g.d.push(d);
  }
  toString() {
    return [...this.groups.values()]
      .sort((a, b) => a.z - b.z || a.order - b.order)
      .map((g) => `<path ${g.attrs} d="${g.d.join('')}"/>`)
      .join('');
  }
}

const fill = (c) => `fill="${c}"`;
const stroke = (c, w, dash) =>
  `fill="none" stroke="${c}" stroke-width="${r1(w)}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}`;

// All filled shapes are wound counter-clockwise so overlapping subpaths in one
// <path> union together under the nonzero fill rule instead of cutting holes.
function ellipsePath(cx, cy, rx, ry, rot = 0) {
  if (!rot) return `M${f1(cx - rx)} ${f1(cy)}a${r1(rx)} ${r1(ry)} 0 1 0 ${f1(2 * rx)} 0a${r1(rx)} ${r1(ry)} 0 1 0 ${f1(-2 * rx)} 0z`;
  const c = Math.cos(rot * DEG) * rx, s = Math.sin(rot * DEG) * rx;
  const a = `${r1(rx)} ${r1(ry)} ${f1(rot)} 1 0`;
  return `M${f1(cx - c)} ${f1(cy - s)}A${a} ${f1(cx + c)} ${f1(cy + s)}A${a} ${f1(cx - c)} ${f1(cy - s)}z`;
}

function polyPath(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  const ordered = area > 0 ? [...pts].reverse() : pts;
  return `M${ordered.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}z`;
}

const linePath = (pts) => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}`;

// Branch points up to growth distance F, cutting the last segment mid-way.
function visible(pts, F) {
  if (pts[0].d >= F) return null;
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.d <= F) { out.push(p); continue; }
    const q = pts[i - 1], t = (F - q.d) / (p.d - q.d);
    out.push({ x: q.x + (p.x - q.x) * t, y: q.y + (p.y - q.y) * t, w: q.w + (p.w - q.w) * t, d: F });
    break;
  }
  return out.length >= 2 ? out : null;
}

// Screen-space points with unit normals (pointing away from the light).
function frame(pts, K, half) {
  const sp = pts.map((p) => ({ x: p.x * K, y: -p.y * K, d: p.d }));
  const n = sp.length;
  let sx = 0, sy = 0;
  sp.forEach((p, i) => {
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    p.dx = (b.x - a.x) / len;
    p.dy = (b.y - a.y) / len;
    p.nx = -p.dy;
    p.ny = p.dx;
    p.h = half(pts[i]);
    sx += p.nx; sy += p.ny;
  });
  const flip = sx * LIGHT_AWAY.x + sy * LIGHT_AWAY.y < 0 ? -1 : 1;
  for (const p of sp) { p.nx *= flip; p.ny *= flip; }
  return sp;
}

function ribbon(sp, startCap) {
  const a = sp.map((p) => [p.x - p.nx * p.h, p.y - p.ny * p.h]);
  const b = sp.map((p) => [p.x + p.nx * p.h, p.y + p.ny * p.h]).reverse();
  const end = sp[sp.length - 1];
  let d = polyPath([...a, ...b]) + ellipsePath(end.x, end.y, end.h, end.h);
  if (startCap) d += ellipsePath(sp[0].x, sp[0].y, sp[0].h, sp[0].h);
  return d;
}

function shadeRibbon(sp) {
  const a = sp.map((p) => [p.x + p.nx * p.h * 0.2, p.y + p.ny * p.h * 0.2]);
  const b = sp.map((p) => [p.x + p.nx * p.h, p.y + p.ny * p.h]).reverse();
  return polyPath([...a, ...b]);
}

// Bark texture. Positions come from the full branch so marks stay put as it grows.
function barkMarks(out, b, full, style, colour, K, F, seed) {
  const rng = new Rng(hashString(`${seed}:bark:${b.id}`));
  const segs = [];
  const shown = (p) => p.d < F - 1.5;

  if (style === 'plain' || style === 'gnarled') {
    if (full[0].h < 1.1) return;
    const rate = style === 'gnarled' ? 0.55 : 0.3;
    for (const p of full) {
      if (!rng.chance(rate) || !shown(p)) continue;
      const u = rng.signed(p.h * 0.55), len = rng.range(2, 5) * K;
      const x = p.x + p.nx * u, y = p.y + p.ny * u;
      segs.push([x, y, x + p.dx * len + p.nx * rng.signed(0.5), y + p.dy * len + p.ny * rng.signed(0.5)]);
    }
    if (segs.length) out.add(22, stroke(colour, 0.45 * K), segs.map((s) => linePath([s.slice(0, 2), s.slice(2)])).join(''));
  } else if (style === 'birch') {
    if (full[0].h < 0.5) return;
    for (const p of full) {
      if (!shown(p)) continue;
      for (const side of [1, -1]) {
        if (!rng.chance(0.55)) continue;
        const depth = rng.range(0.25, 0.75);
        segs.push([p.x + p.nx * side * p.h, p.y + p.ny * side * p.h, p.x + p.nx * side * p.h * (1 - depth), p.y + p.ny * side * p.h * (1 - depth) + rng.signed(0.6)]);
      }
    }
    if (segs.length) out.add(22, stroke(colour, 0.9 * K), segs.map((s) => linePath([s.slice(0, 2), s.slice(2)])).join(''));
  } else if (style === 'rings' || style === 'nodes') {
    const spacing = style === 'rings' ? 3.2 : rng.range(9, 12);
    let next = full[0].d + spacing;
    for (let i = 1; i < full.length; i++) {
      const p = full[i - 1], q = full[i];
      while (next <= q.d && next < F - 1) {
        const t = (next - p.d) / (q.d - p.d || 1);
        const x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t, h = (p.h + (q.h - p.h) * t) * 0.95;
        segs.push([x - p.nx * h, y - p.ny * h, x + p.nx * h, y + p.ny * h]);
        next += spacing;
      }
    }
    if (segs.length) out.add(22, stroke(colour, (style === 'rings' ? 0.5 : 0.9) * K), segs.map((s) => linePath([s.slice(0, 2), s.slice(2)])).join(''));
  } else if (style === 'ribs') {
    const vis = full.filter(shown);
    if (vis.length < 2) return;
    const d = [-0.5, 0, 0.5].map((u) => linePath(vis.map((p) => [p.x + p.nx * p.h * u, p.y + p.ny * p.h * u]))).join('');
    out.add(22, stroke(colour, 0.5 * K), d);
  }
}

function prunedForDeath(tree) {
  if (tree._pruned) return tree._pruned;
  const set = new Set();
  const rng = new Rng(hashString(`${tree.genome.seed}:dead`));
  for (const b of tree.branches) {
    if ((b.parent != null && set.has(b.parent)) || (b.depth >= 2 && rng.chance(0.28))) set.add(b.id);
  }
  return (tree._pruned = set);
}

function drawBark(out, tree, T, F, dead) {
  const g = tree.genome;
  const bark = dead ? deadTone(g.bark) : g.bark;
  const isBirch = g.bark.style === 'birch' && !dead;
  const base = fill(hsl(bark));
  const shade = fill(hsl(bark, isBirch ? -12 : -9));
  const mark = isBirch ? 'hsl(30,10%,18%)' : hsl(bark, -16);
  const removed = dead ? prunedForDeath(tree) : null;

  for (const b of tree.branches) {
    if (removed?.has(b.id)) continue;
    const vis = visible(b.pts, F);
    if (!vis) continue;
    // Growing tips taper to a point just behind the growth front.
    const sp = frame(vis, T, (p) => Math.max(0.2, (p.w * T) / 2 * Math.min(1, 0.35 + (F - p.d) / 10)));
    out.add(20, base, ribbon(sp, b.depth > 0));
    if (sp[0].h > 0.7) out.add(21, shade, shadeRibbon(sp));
    barkMarks(out, b, frame(b.pts, T, (p) => (p.w * T) / 2), g.bark.style, mark, T, F, g.seed);
  }
}

function appearance(pr, p, dn) {
  if (pr.kind === 'foliage') {
    const a = clamp01((p * 1.3 - dn) / 0.3);
    return pr.from ? Math.min(a, clamp01((p - pr.from) / (1 - pr.from))) : a;
  }
  if (pr.kind === 'accent') return clamp01((p - 0.72 - 0.15 * dn) / 0.13);
  if (!pr.at) return 1;
  return clamp01((p - pr.at) / Math.max(0.01, Math.min(0.12, 1 - pr.at)));
}

function drawPrims(out, tree, p, S, T, dead) {
  for (const pr of tree.prims) {
    let fc = pr.fill, sc = pr.stroke;
    if (dead) {
      if (!pr.dead || pr.dead === 'hide') continue;
      if (typeof pr.dead === 'object') { fc = pr.dead.fill ?? fc; sc = pr.dead.stroke ?? sc; }
    } else if (pr.deadOnly) continue;
    const a = appearance(pr, p, (pr.d ?? 0) / tree.maxD);
    if (a <= 0.01) continue;
    const s = pr.ground ? a : easeOutBack(a);
    const K = pr.ground ? S : T;
    const ax = pr.ax ?? pr.x ?? 0, ay = pr.ay ?? pr.y ?? 0;
    const P = (x, y) => [(ax + (x - ax) * s) * K, -(ay + (y - ay) * s) * K];
    const attrs = fc ? fill(fc) : stroke(sc, pr.sw * K, pr.dash?.map((v) => f1(v * K)).join(' '));

    switch (pr.shape) {
      case 'ellipse': {
        const [x, y] = P(pr.x, pr.y);
        out.add(pr.z, attrs, ellipsePath(x, y, pr.rx * s * K, pr.ry * s * K, -(pr.rot ?? 0)), pr.ground);
        break;
      }
      case 'poly': out.add(pr.z, attrs, polyPath(pr.pts.map(([x, y]) => P(x, y))), pr.ground); break;
      case 'polyline': out.add(pr.z, attrs, linePath(pr.pts.map(([x, y]) => P(x, y))), pr.ground); break;
      case 'lines':
        out.add(pr.z, attrs, pr.segs.map(([x1, y1, x2, y2]) => linePath([P(x1, y1), P(x2, y2)])).join(''), pr.ground);
        break;
      case 'quad': {
        const [x0, y0, cx, cy, x1, y1] = pr.p;
        const [a0, b0] = P(x0, y0), [ac, bc] = P(cx, cy), [a1, b1] = P(x1, y1);
        out.add(pr.z, attrs, `M${f1(a0)} ${f1(b0)}Q${f1(ac)} ${f1(bc)} ${f1(a1)} ${f1(b1)}`, pr.ground);
        break;
      }
    }
  }
}

function drawGround(out, g, dead) {
  const t = dead ? DEAD_TILE : TILE[g.ground] ?? TILE.lush;
  out.add(0, fill(hsl(t)), ellipsePath(0, 2, 64, 8.5), true);
  out.add(1, fill(hsl(t, -10, -5)), ellipsePath(0, 0.8, 15, 3), true);
}

// Seed and first two leaves, fading out as the real tree takes over.
// Minerals (no branches) start from a grey stone instead and sprout nothing.
function drawSprout(out, tree, p, S, T, F) {
  if (p >= 0.3) return;
  const bare = !tree.branches.length;
  if (p < 0.04) out.add(2, fill(bare ? 'hsl(220,8%,55%)' : 'hsl(28,40%,32%)'), ellipsePath(0, -0.6, 2.4, 1.6));
  if (bare) return;
  const vis = visible(tree.branches[0].pts, F);
  const tip = vis ? vis[vis.length - 1] : { x: 0, y: 0 };
  const x = tip.x * T, y = -tip.y * T;
  const k = 3.4 * S * (0.5 + p * 2);
  const leaf = fill(`hsla(100,50%,45%,${f1(1 - p / 0.3)})`);
  out.add(36, leaf, ellipsePath(x + k * 0.9, y - k * 0.3, k, k * 0.42, -30));
  out.add(36, leaf, ellipsePath(x - k * 0.9, y - k * 0.3, k, k * 0.42, 30));
}

// Leaf tufts on the still-growing branch ends, so a sapling looks alive
// before the real canopy (anchored at the final tips) fills in.
function drawTufts(out, tree, p, T, F) {
  const tone = tree.genome.foliage[0]?.tones[0];
  const fade = 1 - clamp01((p - 0.6) / 0.3);
  if (!tone || fade <= 0 || p < 0.08 || !tree.branches.length) return;
  const r = (2.4 + 2.8 * Math.min(1, p * 2)) * T;
  const body = [], shade = [];
  for (const b of tree.branches) {
    const end = b.pts[b.pts.length - 1].d;
    if (b.pts[0].d >= F || end <= F) continue;
    const tip = visible(b.pts, F).at(-1);
    const x = tip.x * T, y = -tip.y * T;
    shade.push(ellipsePath(x + r * 0.2, y + r * 0.1, r, r * 0.8));
    body.push(ellipsePath(x - r * 0.5, y - r * 0.3, r * 0.8, r * 0.65), ellipsePath(x + r * 0.5, y - r * 0.4, r * 0.75, r * 0.6));
  }
  const a = f1(fade * (tone.a ?? 1));
  out.add(29, fill(hsl({ ...tone, a }, -8)), shade.join(''));
  out.add(29.5, fill(hsl({ ...tone, a }, 4)), body.join(''));
}

// Brown leaf litter under a tree that died with foliage (on the soil, if potted).
function drawLitter(out, tree, S) {
  if (!tree.genome.foliage.length || !tree.branches.length) return;
  const rng = new Rng(hashString(`${tree.genome.seed}:litter`));
  const spread = tree.pot ? tree.pot.w * 0.4 : 32;
  const d = [];
  for (let i = 0; i < 9; i++) d.push(ellipsePath(rng.signed(spread) * S, -rng.range(0.3, 1.8) * S, 1.7 * S, 0.8 * S, rng.range(0, 180)));
  out.add(55, fill('hsl(30,35%,38%)'), d.join(''));
}

export function renderTree(tree, { progress = 1, dead = false, ground = true, className = '' } = {}) {
  const p = clamp01(progress);
  const S = tree.fit;
  const T = S * (0.28 + 0.72 * easeOutCubic(p));
  const F = Math.min(1, p * 1.18) * (tree.maxD + 12);
  const out = new Layers((tree.lift ?? 0) * S);

  if (ground) drawGround(out, tree.genome, dead);
  drawBark(out, tree, T, F, dead);
  drawPrims(out, tree, p, S, T, dead);
  if (dead) drawLitter(out, tree, S);
  else {
    drawSprout(out, tree, p, S, T, F);
    drawTufts(out, tree, p, T, F);
  }

  const cls = className ? ` class="${className}"` : '';
  return `<svg${cls} viewBox="${VIEWBOX}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${tree.genome.name}">${out}</svg>`;
}
