// Branching rules: each one grows a skeleton into the Builder from genes.

import { DEG, forkGrow } from './builder.js';

// Sympodial / deciduous: trunk(s) that repeatedly split into children.
function fork(B) {
  const { G, g, rng } = B;
  const trunks = Math.max(1, Math.round(G.trunks ?? 1));
  const spread = G.trunkSpread ?? 12;
  const gap = G.trunkGap ?? G.trunkWidth * 0.8;
  const roots = [];

  for (let k = 0; k < trunks; k++) {
    const u = trunks === 1 ? 0 : k / (trunks - 1) - 0.5;
    const w = G.trunkWidth / Math.sqrt(trunks);
    roots.push(B.branch({
      x: u * gap * (trunks - 1), y: 0,
      angle: (90 + G.lean - u * 2 * spread + rng.signed(3)) * DEG,
      length: G.trunkLength * g.sizeScale * (trunks === 1 ? 1 : rng.range(0.7, 1)),
      width: w, widthEnd: w * G.taper, depth: 0,
      photo: G.photo, wobble: (G.wobble ?? 0) * DEG, curl: (G.curl ?? 0) * DEG * 0.3,
      flare: G.flare ?? 0, kind: 'trunk',
    }));
  }

  const maxDepth = Math.max(0, Math.round(G.maxDepth + (g.size - 0.5) * 1.2));
  forkGrow(B, roots, {
    count: G.branchCount, angle: G.branchAngle, jitter: G.angleJitter ?? 0,
    decay: G.lengthDecay ?? 0.75, lengthJitter: G.lengthJitter ?? 0.1, maxDepth,
    gravity: G.gravity ?? 0, photo: G.photo ?? 0, wobble: G.wobble ?? 0, curl: G.curl ?? 0,
    skip: G.skip ?? 0, apical: G.apical ?? 0, lateral: G.lateral ?? 0, taper: G.taper,
  });
}

// Length of a lateral at normalised height t through the crown.
function profile(kind, t) {
  if (kind === 'cone') return 1 - t * 0.88;
  if (kind === 'ovoid') return 0.25 + 0.75 * Math.sin(Math.PI * (0.12 + 0.88 * t)) ** 0.8;
  return 0.7 + 0.3 * (1 - t);
}

// Monopodial / excurrent: a central leader with laterals along it (conifers, birch).
function leader(B) {
  const { G, g, rng } = B;
  const L = G.trunkLength * g.sizeScale;
  const trunk = B.branch({
    x: 0, y: 0, angle: (90 + G.lean) * DEG, length: L,
    width: G.trunkWidth, widthEnd: Math.max(0.6, G.trunkWidth * G.taper), depth: 0,
    photo: 0.6, wobble: G.wobble * DEG, curl: (G.curl ?? 0) * DEG * 0.3, flare: G.flare ?? 0, kind: 'trunk',
  });

  const laterals = [];
  let side = rng.chance(0.5) ? 1 : -1;
  for (let s = L * G.whorlStart; s < L * 0.96; s += G.whorlSpacing * g.sizeScale * rng.range(0.75, 1.25)) {
    const f = s / L;
    const prof = profile(G.profile, (f - G.whorlStart) / (1 - G.whorlStart));
    const p = B.pointAt(trunk, f);
    const sides = rng.chance(G.pairs) ? [1, -1] : [side];
    side = -side;
    for (const sd of sides) {
      if (rng.chance(G.skip)) continue;
      const len = G.lateralLength * g.sizeScale * prof * (1 + rng.signed(0.18));
      if (len < 3) continue;
      const w = Math.max(0.7, Math.min(p.w * 0.6, len * 0.09));
      laterals.push(B.branch({
        x: p.x, y: p.y, angle: p.angle - sd * (G.lateralAngle + rng.signed(G.angleJitter)) * DEG,
        length: len, width: w, widthEnd: Math.max(0.4, w * 0.45), depth: 1, d0: p.d, parent: trunk.id,
        gravity: G.gravity, photo: G.photo, wobble: G.wobble * DEG * 0.6, curl: (G.curl ?? 0) * DEG * sd,
      }));
    }
  }
  B.tip(trunk);

  forkGrow(B, laterals, {
    count: G.subCount, angle: G.subAngle, jitter: G.angleJitter, decay: G.subDecay, lengthJitter: 0.2,
    maxDepth: 1 + Math.round(G.lateralDepth), gravity: G.gravity, photo: G.photo, wobble: G.wobble * 0.6,
    curl: G.curl ?? 0, skip: 0.25, apical: 0.5, lateral: 0, taper: 0.5,
  });
}

// One or more curved bare trunks, each ending in a crown for fronds.
function palm(B) {
  const { G, g, rng } = B;
  const n = Math.max(1, Math.round(G.trunks));
  for (let k = 0; k < n; k++) {
    const side = n === 1 ? (rng.chance(0.5) ? 1 : -1) : k % 2 ? 1 : -1;
    const trunk = B.branch({
      x: (k - (n - 1) / 2) * 4, y: 0,
      angle: (90 + G.lean * side * rng.range(0.6, 1.1)) * DEG,
      length: G.trunkLength * g.sizeScale * (k === 0 ? 1 : rng.range(0.6, 0.85)),
      width: G.trunkWidth, widthEnd: G.trunkWidth * G.taper, depth: 0,
      photo: G.photo, wobble: G.wobble * DEG, flare: G.flare, kind: 'trunk',
    });
    const e = B.endOf(trunk);
    B.crowns.push({ ...e, branch: trunk.id });
  }
}

// Saguaro: a ribbed column with arms that elbow out and turn upward.
function cactus(B) {
  const { G, g, rng } = B;
  const L = G.trunkLength * g.sizeScale;
  const W = G.trunkWidth;
  const trunk = B.branch({ x: 0, y: 0, angle: (90 + G.lean) * DEG, length: L, width: W, widthEnd: W * 0.9, depth: 0, wobble: DEG, photo: 2, kind: 'trunk' });
  B.crowns.push({ ...B.endOf(trunk), branch: trunk.id });

  const used = [];
  let side = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < Math.round(G.arms); i++) {
    const f = rng.range(G.armLow, G.armHigh);
    if (used.some((u) => u.side === side && Math.abs(u.f - f) < 0.12)) continue;
    used.push({ f, side });
    const p = B.pointAt(trunk, f);
    const aw = W * rng.range(0.6, 0.75);
    const stub = B.branch({ x: p.x, y: p.y, angle: (90 - side * rng.range(78, 92)) * DEG, length: W * rng.range(0.9, 1.4), width: aw, widthEnd: aw, depth: 1, d0: p.d, parent: trunk.id });
    const e = B.endOf(stub);
    const up = B.branch({ x: e.x, y: e.y, angle: (90 - side * rng.range(-4, 8)) * DEG, length: L * G.armLength * rng.range(0.6, 1.1) * (1 - f * 0.5), width: aw, widthEnd: aw * 0.92, depth: 2, d0: e.d, parent: stub.id, photo: 1 });
    B.crowns.push({ ...B.endOf(up), branch: up.id });
    side = -side;
  }
}

export const RULES = { fork, leader, palm, cactus };
