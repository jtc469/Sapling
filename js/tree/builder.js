// Shared state while a tree is being built: the skeleton (branches), the
// attachment points foliage hangs off (tips, crowns, forks), and the flat list
// of drawing primitives the renderer consumes.

export const DEG = Math.PI / 180;
const BRANCH_BUDGET = 520;

export class Builder {
  constructor(genome, rng) {
    this.g = genome;
    this.G = genome.genes;
    this.rng = rng;
    this.branches = [];
    this.tips = [];
    this.crowns = [];
    this.forks = [];
    this.spots = []; // foliage blobs, reused by accents and snow
    this.prims = [];
  }

  get full() { return this.branches.length >= BRANCH_BUDGET; }

  // Grows one branch as a polyline. Each step bends the heading by random
  // wobble, a steady curl, and a vertical pull (photo up, gravity down).
  branch({ x, y, angle, length, width, widthEnd, depth, d0 = 0, parent = null, gravity = 0, photo = 0, wobble = 0, curl = 0, flare = 0, kind = 'branch' }) {
    const n = Math.max(2, Math.ceil(length / Math.max(2.5, Math.min(6, length / 6))));
    const step = length / n;
    let dx = Math.cos(angle), dy = Math.sin(angle);
    const pts = [{ x, y, w: width * (1 + flare), d: d0 }];

    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const a = Math.atan2(dy, dx) + this.rng.signed(wobble) + curl * step;
      dx = Math.cos(a);
      dy = Math.sin(a) + (photo - gravity) * step * 0.02;
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      x += dx * step;
      y = Math.max(1.5, y + dy * step);
      const flareK = flare && t < 0.2 ? 1 + flare * (1 - t / 0.2) ** 2 : 1;
      pts.push({ x, y, w: (width + (widthEnd - width) * t) * flareK, d: d0 + step * i });
    }

    const b = { id: this.branches.length, depth, parent, pts, kind, length };
    this.branches.push(b);
    return b;
  }

  // Position, width and heading at fraction f of a branch's length.
  pointAt(b, f) {
    const pts = b.pts;
    const target = pts[0].d + f * (pts[pts.length - 1].d - pts[0].d);
    let i = 1;
    while (i < pts.length - 1 && pts[i].d < target) i++;
    const p = pts[i - 1], q = pts[i];
    const t = q.d === p.d ? 0 : Math.min(1, Math.max(0, (target - p.d) / (q.d - p.d)));
    return {
      x: p.x + (q.x - p.x) * t,
      y: p.y + (q.y - p.y) * t,
      w: p.w + (q.w - p.w) * t,
      d: target,
      angle: Math.atan2(q.y - p.y, q.x - p.x),
    };
  }

  endOf(b) { return this.pointAt(b, 1); }

  tip(b) {
    const e = this.endOf(b);
    this.tips.push({ ...e, depth: b.depth, branch: b.id, tip: true });
  }

  // Points foliage can grow from: every tip, plus points spaced along the
  // outermost `reach` levels of branches.
  anchors(reach = 1, minHeight = 0) {
    const maxDepth = Math.max(...this.branches.map((b) => b.depth));
    const top = this.top();
    const minDepth = maxDepth - reach;
    const out = [...this.tips];
    for (const b of this.branches) {
      if (b.depth < minDepth) continue;
      for (let s = b.length * 0.3; s < b.length - 2; s += 6) out.push({ ...this.pointAt(b, s / b.length), depth: b.depth, tip: false });
    }
    return out.filter((a) => a.y >= minHeight * top);
  }

  top() {
    let top = 0;
    for (const b of this.branches) for (const p of b.pts) top = Math.max(top, p.y);
    return top;
  }

  add(prim) { this.prims.push(prim); }
}

// Recursive splitting, processed breadth-first so the branch budget trims the
// outermost layer evenly instead of starving one side of the tree.
// Used by the fork rule for the whole crown and by the leader rule for laterals.
export function forkGrow(B, roots, P) {
  const { rng } = B;
  const queue = [...roots];
  while (queue.length) {
    const b = queue.shift();
    const end = B.endOf(b);
    if (b.depth >= P.maxDepth || B.full) {
      B.tip(b);
      continue;
    }

    const n = Math.max(1, rng.count(P.count));
    const leader = P.apical > 0 ? rng.int(0, n - 1) : -1;
    let spawned = 0;

    for (let i = 0; i < n; i++) {
      if (b.depth >= 1 && n > 1 && rng.chance(P.skip)) continue;
      let off = n === 1 ? rng.signed(P.angle * 0.4) : -P.angle + (2 * P.angle * i) / (n - 1);
      off += rng.signed(P.jitter);
      let lenK = P.decay * (1 + rng.signed(P.lengthJitter));
      if (i === leader) {
        off *= 1 - P.apical;
        lenK *= 1 + P.apical * 0.25;
      }
      const len = b.length * lenK;
      if (len < 2.5) continue;
      const w = Math.max(0.6, end.w * (1 / n) ** 0.4 * (i === leader ? 1.05 : 0.95));
      queue.push(child(B, b, end, end.angle + off * DEG, len, w, P, i));
      spawned++;
    }

    // An occasional side shoot from partway along the branch.
    if (P.lateral && b.depth + 1 < P.maxDepth && !B.full && rng.chance(P.lateral)) {
      const at = B.pointAt(b, rng.range(0.35, 0.75));
      const side = rng.chance(0.5) ? 1 : -1;
      const w = Math.max(0.6, at.w * 0.6);
      queue.push(child(B, b, at, at.angle + side * (P.angle + rng.range(5, 20)) * DEG, b.length * P.decay * 0.6, w, P, side > 0 ? 1 : 0));
      spawned++;
    }

    if (spawned) B.forks.push({ x: end.x, y: end.y, depth: b.depth, d: end.d, branch: b.id });
    else B.tip(b);
  }
}

function child(B, parent, at, angle, length, width, P, i) {
  const depth = parent.depth + 1;
  const df = depth / Math.max(1, P.maxDepth);
  return B.branch({
    x: at.x, y: at.y, angle, length, width,
    widthEnd: Math.max(0.4, width * P.taper),
    depth, d0: at.d, parent: parent.id,
    gravity: P.gravity * df ** 1.2,
    photo: P.photo * (1 - df * 0.5),
    wobble: P.wobble * DEG,
    curl: P.curl * DEG * (i % 2 ? 1 : -1) * (1 + depth * 0.15),
  });
}
