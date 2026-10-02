// Builds and caches trees for sessions. A finished session's tree never
// changes, so its SVG is rendered once and reused.

import { growTree, renderTree } from '../tree/index.js';
import { sizeFor } from './session.js';

const trees = new Map();
const svgs = new Map();

export function treeFor({ species, seed, minutes }) {
  const key = `${species}:${seed}:${minutes}`;
  let t = trees.get(key);
  if (!t) trees.set(key, (t = growTree({ species, seed, size: sizeFor(minutes) })));
  return t;
}

export function sessionSvg(s, opts = {}) {
  const dead = !s.completed;
  const key = `${s.id}:${dead}:${opts.ground !== false}`;
  let svg = svgs.get(key);
  if (!svg) svgs.set(key, (svg = renderTree(treeFor(s), { progress: dead ? s.progress : 1, dead, ...opts })));
  return svg;
}
