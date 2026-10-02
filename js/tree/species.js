// Species are pure data. Any [lo, hi] pair is a range that each individual
// tree samples from its seed, so every oak is an oak but no two are alike.
// Angles are in degrees, lengths in world units (ground at y = 0, ~200 tall).
//
// A species picks one part from each slot:
//   rule     how the skeleton grows    (fork | leader | palm | cactus)
//   bark     colour + texture style    (plain | gnarled | birch | rings | ribs | nodes)
//   foliage  one or more layers        (clusters | scatter | sprays | strands | fronds)
//   accents  optional decorations      (fruit | blossom | glow | cones | flowers | coconuts)
//   extras   chance of ground/ambient  (grass, flowers, mushrooms, rocks, fallen, ...)

const tone = (h, s, l, a) => (a == null ? { h, s, l } : { h, s, l, a });

export const SPECIES = {
  oak: {
    name: 'Oak',
    tags: ['deciduous', 'broadleaf'],
    rule: 'fork',
    genes: {
      trunks: 1, trunkLength: [26, 36], trunkWidth: [8, 11], taper: [0.6, 0.7], flare: 0.35,
      lean: [-6, 6], wobble: [3, 7], photo: [0.2, 0.6], gravity: [0.3, 0.8],
      branchCount: [2.2, 2.7], branchAngle: [30, 44], angleJitter: [8, 16],
      lengthDecay: [0.72, 0.8], lengthJitter: [0.1, 0.2], maxDepth: [5, 6.4],
      skip: [0.05, 0.15], apical: [0, 0.2], lateral: [0.15, 0.35],
    },
    bark: { style: 'plain', h: [20, 32], s: [22, 35], l: [24, 32] },
    foliage: [{
      type: 'clusters', size: [10, 13], density: [0.9, 1.05], reach: 1, lift: 0.15,
      tones: [tone([95, 115], [35, 50], [30, 38]), tone([100, 125], [35, 50], [34, 42]), tone([85, 105], [40, 55], [36, 44])],
    }],
    accents: [{ type: 'fruit', chance: 0.12, count: [4, 8], size: [1.5, 2], tones: [tone([25, 35], [45, 60], [33, 40])] }],
    extras: { grass: 0.9, flowers: 0.35, mushrooms: 0.2, rocks: 0.3, swing: 0.07, nest: 0.08, moss: 0.25 },
    ground: 'lush',
  },

  maple: {
    name: 'Maple',
    tags: ['deciduous', 'broadleaf', 'autumn'],
    rule: 'fork',
    genes: {
      trunks: 1, trunkLength: [28, 38], trunkWidth: [6, 8], taper: [0.62, 0.72], flare: 0.3,
      lean: [-5, 5], wobble: [3, 6], photo: [0.6, 1], gravity: [0.1, 0.4],
      branchCount: [2, 2.5], branchAngle: [24, 36], angleJitter: [6, 12],
      lengthDecay: [0.74, 0.8], lengthJitter: [0.1, 0.18], maxDepth: [6, 7.4],
      skip: [0.05, 0.15], apical: [0.2, 0.5], lateral: [0.1, 0.25],
    },
    bark: { style: 'plain', h: [15, 25], s: [15, 25], l: [28, 34] },
    foliage: [{
      type: 'clusters', size: [9, 12], density: [0.9, 1.05], reach: 1, lift: 0.15,
      tones: [tone([2, 10], [65, 80], [42, 50]), tone([18, 28], [75, 90], [50, 56]), tone([38, 46], [80, 90], [52, 60]), tone([350, 358], [55, 70], [35, 42])],
    }],
    extras: { grass: 0.8, fallen: 0.9, mushrooms: 0.25, rocks: 0.3, swing: 0.05, nest: 0.05 },
    ground: 'lush',
  },

  sakura: {
    name: 'Sakura',
    tags: ['deciduous', 'broadleaf', 'blossom'],
    rule: 'fork',
    genes: {
      trunks: 1, trunkLength: [22, 30], trunkWidth: [7, 10], taper: [0.6, 0.7], flare: 0.4,
      lean: [-10, 10], wobble: [6, 11], photo: [0.7, 1.1], gravity: [0.15, 0.45],
      branchCount: [2, 2.4], branchAngle: [32, 46], angleJitter: [8, 16],
      lengthDecay: [0.74, 0.8], lengthJitter: [0.12, 0.2], maxDepth: [6, 7.4],
      skip: [0.1, 0.2], apical: [0, 0.2], lateral: [0.2, 0.4],
    },
    bark: { style: 'plain', h: [5, 15], s: [20, 30], l: [25, 32] },
    foliage: [{
      type: 'clusters', size: [7, 10], density: [0.85, 1], reach: 1, lift: 0.15, highlight: 0.6,
      tones: [tone([335, 350], [60, 80], [80, 86]), tone([340, 355], [55, 75], [72, 80]), tone([330, 345], [50, 70], [86, 90])],
    }],
    accents: [{ type: 'blossom', count: [30, 50], size: [1.3, 1.8], tones: [tone(345, [70, 90], [91, 95])], centre: tone(340, 60, 58) }],
    extras: { grass: 0.8, fallen: 0.95, rocks: 0.3, flowers: 0.2 },
    ground: 'lush',
  },

  pine: {
    name: 'Pine',
    tags: ['conifer', 'evergreen'],
    rule: 'leader',
    genes: {
      trunkLength: [80, 110], trunkWidth: [6, 8], taper: [0.35, 0.45], flare: 0.3, lean: [-5, 5], wobble: [3, 6],
      whorlStart: [0.5, 0.65], whorlSpacing: [7, 10], pairs: [0, 0.4],
      lateralAngle: [55, 80], angleJitter: [8, 15], lateralLength: [20, 30], profile: 'ovoid',
      lateralDepth: [1, 2.4], subCount: [1.6, 2.2], subAngle: [25, 40], subDecay: [0.6, 0.72],
      gravity: [0.2, 0.5], photo: [0.4, 0.8], skip: [0.1, 0.25],
    },
    bark: { style: 'gnarled', h: [18, 26], s: [35, 45], l: [34, 42] },
    foliage: [{
      type: 'clusters', aspect: [1.7, 2.2], size: [7, 9], density: [0.8, 1], reach: 1, lift: 0.35,
      tones: [tone([130, 150], [25, 40], [24, 30]), tone([120, 140], [25, 40], [30, 36])],
    }],
    accents: [{ type: 'cones', chance: 0.35, count: [3, 7] }],
    extras: { grass: 0.6, rocks: 0.4, mushrooms: 0.2 },
    ground: 'lush',
  },

  fir: {
    name: 'Fir',
    tags: ['conifer', 'evergreen'],
    rule: 'leader',
    genes: {
      trunkLength: [80, 115], trunkWidth: [5, 7], taper: [0.15, 0.25], flare: 0.3, lean: [-3, 3], wobble: [1, 3],
      whorlStart: [0.08, 0.16], whorlSpacing: [4.5, 6.5], pairs: 1,
      lateralAngle: [70, 95], angleJitter: [4, 10], lateralLength: [28, 40], profile: 'cone',
      lateralDepth: [0, 1.4], subCount: [1.5, 2], subAngle: [30, 45], subDecay: [0.5, 0.6],
      gravity: [0.6, 1.2], photo: [0.1, 0.3], skip: [0, 0.12],
    },
    bark: { style: 'plain', h: [15, 25], s: [20, 30], l: [22, 28] },
    foliage: [{
      type: 'sprays', size: [5, 7],
      tones: [tone([140, 165], [25, 40], [22, 28]), tone([145, 170], [25, 40], [28, 34])],
    }],
    accents: [{ type: 'cones', chance: 0.4, count: [4, 9] }],
    extras: { grass: 0.5, rocks: 0.4, mushrooms: 0.25 },
    ground: 'lush',
  },

  birch: {
    name: 'Birch',
    tags: ['deciduous', 'broadleaf'],
    rule: 'leader',
    genes: {
      trunkLength: [85, 110], trunkWidth: [4.5, 6], taper: [0.3, 0.4], flare: 0.2, lean: [-6, 6], wobble: [2, 5],
      whorlStart: [0.3, 0.4], whorlSpacing: [6, 9], pairs: [0, 0.3],
      lateralAngle: [30, 50], angleJitter: [8, 15], lateralLength: [26, 36], profile: 'ovoid',
      lateralDepth: [2, 3.4], subCount: [1.8, 2.3], subAngle: [25, 40], subDecay: [0.65, 0.75],
      gravity: [0.4, 0.9], photo: [0.3, 0.6], skip: [0.1, 0.2],
    },
    bark: { style: 'birch', h: [40, 50], s: [10, 20], l: [88, 93] },
    foliage: [{
      type: 'scatter', size: [2.2, 3], aspect: 1.8, density: [0.9, 1.1], spread: [6, 9], reach: 1.5,
      tones: [tone([70, 85], [45, 60], [45, 52]), tone([80, 95], [40, 55], [38, 45]), tone([60, 72], [55, 70], [55, 62])],
    }],
    extras: { grass: 0.9, flowers: 0.4, mushrooms: 0.3, rocks: 0.2, fallen: 0.3 },
    ground: 'lush',
  },

  willow: {
    name: 'Willow',
    tags: ['deciduous', 'broadleaf'],
    rule: 'fork',
    genes: {
      trunks: 1, trunkLength: [26, 34], trunkWidth: [9, 12], taper: [0.55, 0.65], flare: 0.35,
      lean: [-6, 6], wobble: [4, 8], photo: [0.8, 1.4], gravity: [1, 1.8],
      branchCount: [2.2, 2.7], branchAngle: [28, 40], angleJitter: [8, 14],
      lengthDecay: [0.74, 0.8], lengthJitter: 0.15, maxDepth: [5, 6.4],
      skip: [0.05, 0.15], apical: [0, 0.2], lateral: [0.1, 0.25],
    },
    bark: { style: 'gnarled', h: [30, 40], s: [15, 25], l: [30, 36] },
    foliage: [
      { type: 'clusters', size: [5, 6.5], density: [0.35, 0.45], reach: 1, lift: 0.1, tones: [tone([75, 95], [35, 50], [36, 44])] },
      { type: 'strands', length: [35, 55], density: [0.8, 1], width: 2.6, reach: 1.5, inner: 0.4, from: 0.7, tones: [tone([75, 95], [35, 50], [40, 48]), tone([65, 85], [40, 55], [48, 56])] },
    ],
    extras: { grass: 0.9, rocks: 0.4, flowers: 0.3 },
    ground: 'lush',
  },

  palm: {
    name: 'Palm',
    tags: ['tropical'],
    rule: 'palm',
    genes: { trunks: [1, 1.7], trunkLength: [70, 100], trunkWidth: [5, 7], taper: [0.7, 0.8], flare: 0.15, lean: [10, 25], wobble: [1, 3], photo: [0.7, 1.3] },
    bark: { style: 'rings', h: [30, 38], s: [25, 35], l: [42, 50] },
    foliage: [{
      type: 'fronds', count: [9, 13], length: [40, 55], droop: [1, 1.8], leaflet: [9, 12], width: 1.7,
      tones: [tone([95, 115], [45, 60], [32, 40]), tone([85, 105], [50, 65], [40, 46])],
    }],
    accents: [{ type: 'coconuts', chance: 0.5, count: [2, 4] }],
    extras: { grass: 0.4, rocks: 0.3 },
    ground: 'sand',
  },

  baobab: {
    name: 'Baobab',
    tags: ['tropical', 'dry'],
    rule: 'fork',
    genes: {
      trunks: 1, trunkLength: [34, 44], trunkWidth: [22, 30], taper: [0.5, 0.6], flare: 0.15,
      lean: [-2, 2], wobble: [1, 3], photo: [1, 1.5], gravity: [0, 0.2],
      branchCount: [3, 4], branchAngle: [45, 65], angleJitter: [10, 18],
      lengthDecay: [0.5, 0.58], lengthJitter: 0.2, maxDepth: [3, 4.4], skip: [0, 0.1], apical: 0, lateral: 0,
    },
    bark: { style: 'plain', h: [20, 30], s: [12, 20], l: [45, 52] },
    foliage: [{ type: 'clusters', size: [5, 7], density: [0.35, 0.5], reach: 0.5, lift: 0.2, tones: [tone([80, 100], [25, 40], [35, 42])] }],
    accents: [{ type: 'fruit', chance: 0.25, count: [3, 6], size: [1.6, 2], tones: [tone([38, 45], [15, 25], [66, 72])] }],
    extras: { grass: 0.5, rocks: 0.5 },
    ground: 'dry',
  },

  saguaro: {
    name: 'Saguaro',
    tags: ['desert'],
    rule: 'cactus',
    genes: { trunkLength: [55, 85], trunkWidth: [11, 14], lean: [-3, 3], arms: [0, 4.4], armLow: [0.3, 0.4], armHigh: [0.55, 0.7], armLength: [0.35, 0.55] },
    bark: { style: 'ribs', h: [95, 120], s: [25, 40], l: [32, 40] },
    foliage: [],
    accents: [{ type: 'flowers', chance: 0.4, toneSets: [[tone(50, 90, 92)], [tone(48, 95, 62)], [tone(330, 75, 72)]] }],
    extras: { rocks: 0.8, grass: 0.3, flowers: 0.15 },
    ground: 'sand',
  },

  jacaranda: {
    name: 'Jacaranda',
    tags: ['deciduous', 'broadleaf', 'blossom', 'tropical'],
    rule: 'fork',
    genes: {
      trunks: 1, trunkLength: [24, 34], trunkWidth: [6, 8], taper: [0.6, 0.7], flare: 0.3,
      lean: [-8, 8], wobble: [5, 9], photo: [0.5, 0.9], gravity: [0.3, 0.6],
      branchCount: [2.2, 2.6], branchAngle: [32, 48], angleJitter: [10, 16],
      lengthDecay: [0.76, 0.82], lengthJitter: 0.15, maxDepth: [6, 7.4], skip: [0.1, 0.2], apical: [0, 0.2], lateral: [0.1, 0.25],
    },
    bark: { style: 'plain', h: [20, 30], s: [10, 20], l: [30, 36] },
    foliage: [{
      type: 'clusters', size: [8, 11], density: [0.9, 1], reach: 1, lift: 0.15,
      tones: [tone([255, 270], [45, 65], [62, 70]), tone([265, 280], [40, 60], [70, 78]), tone([250, 262], [40, 55], [55, 62])],
    }],
    accents: [{ type: 'blossom', chance: 0.7, count: [25, 40], size: [1.2, 1.6], tones: [tone(270, 60, 84)], centre: tone(275, 50, 50) }],
    extras: { grass: 0.8, fallen: 0.8, rocks: 0.2 },
    ground: 'lush',
  },

  citrus: {
    name: 'Citrus',
    tags: ['broadleaf', 'evergreen'],
    rule: 'fork',
    genes: {
      trunks: 1, trunkLength: [14, 20], trunkWidth: [5, 7], taper: [0.6, 0.7], flare: 0.3,
      lean: [-5, 5], wobble: [4, 8], photo: [0.8, 1.2], gravity: [0.2, 0.5],
      branchCount: [2.2, 2.6], branchAngle: [30, 42], angleJitter: [8, 14],
      lengthDecay: [0.72, 0.78], lengthJitter: 0.15, maxDepth: [5, 6.4], skip: 0.1, apical: [0, 0.2], lateral: 0.2,
    },
    bark: { style: 'plain', h: [25, 35], s: [15, 25], l: [32, 38] },
    foliage: [{
      type: 'clusters', size: [8, 10], density: [1, 1.15], reach: 1, lift: 0.1,
      tones: [tone([110, 130], [40, 55], [24, 30]), tone([115, 135], [40, 55], [30, 36])],
    }],
    accents: [{ type: 'fruit', count: [10, 18], size: [2.2, 2.8], toneSets: [[tone([28, 34], [90, 100], [52, 58])], [tone([50, 56], [90, 100], [58, 64])], [tone([12, 20], [80, 95], [55, 62])]] }],
    extras: { grass: 0.9, flowers: 0.5, rocks: 0.2 },
    ground: 'lush',
  },

  acacia: {
    name: 'Acacia',
    tags: ['tropical', 'dry', 'broadleaf'],
    rule: 'fork',
    genes: {
      trunks: [1, 1.8], trunkSpread: [10, 20], trunkLength: [30, 42], trunkWidth: [5, 7], taper: [0.6, 0.7], flare: 0.25,
      lean: [-10, 10], wobble: [4, 8], photo: [1.3, 2], gravity: [0, 0.2],
      branchCount: [2, 2.5], branchAngle: [30, 45], angleJitter: [8, 14],
      lengthDecay: [0.68, 0.75], lengthJitter: 0.15, maxDepth: [4, 5.4], skip: 0.1, apical: 0, lateral: 0,
    },
    bark: { style: 'gnarled', h: [25, 35], s: [15, 25], l: [30, 38] },
    foliage: [{
      type: 'clusters', aspect: [2.4, 3.2], size: [6, 8], density: [0.7, 0.9], reach: 0.5, lift: 0.5,
      tones: [tone([75, 95], [30, 45], [34, 42]), tone([80, 100], [30, 45], [40, 46])],
    }],
    extras: { grass: 0.8, rocks: 0.5 },
    ground: 'dry',
  },

  juniper: {
    name: 'Juniper',
    tags: ['conifer', 'evergreen'],
    rule: 'fork',
    genes: {
      trunks: 1, trunkLength: [18, 26], trunkWidth: [8, 11], taper: [0.5, 0.6], flare: 0.4,
      lean: [-25, 25], wobble: [12, 20], photo: [0.3, 0.7], gravity: [0.3, 0.8],
      branchCount: [2, 2.4], branchAngle: [45, 70], angleJitter: [12, 20],
      lengthDecay: [0.68, 0.76], lengthJitter: 0.2, maxDepth: [4, 5.4], skip: [0.15, 0.25], apical: 0.3, lateral: 0.2,
    },
    bark: { style: 'gnarled', h: [15, 25], s: [15, 25], l: [38, 48] },
    foliage: [{
      type: 'clusters', aspect: [1.6, 2.1], size: [8, 11], density: [0.7, 0.85], reach: 1, lift: 0.3,
      tones: [tone([135, 155], [30, 45], [26, 32]), tone([130, 150], [30, 45], [32, 38])],
    }],
    extras: { rocks: 0.7, grass: 0.5, moss: 0.5 },
    ground: 'lush',
  },

  wisp: {
    name: 'Wisp',
    tags: ['fantasy'],
    rule: 'fork',
    genes: {
      trunks: 1, trunkLength: [32, 42], trunkWidth: [6, 8], taper: [0.55, 0.65], flare: 0.35,
      lean: [-5, 5], wobble: [2, 5], photo: [0.9, 1.3], gravity: [0.1, 0.3],
      branchCount: [2, 2.3], branchAngle: [22, 34], angleJitter: [5, 10],
      lengthDecay: [0.74, 0.8], lengthJitter: 0.12, maxDepth: [6, 7.4], skip: [0.05, 0.15], apical: 0, lateral: 0.1,
      curl: [2, 3.5],
    },
    bark: { style: 'plain', h: [260, 280], s: [15, 25], l: [28, 35] },
    foliage: [{
      type: 'scatter', size: [1.8, 2.4], aspect: 1.3, density: [0.5, 0.65], spread: [4, 6], reach: 1,
      tones: [tone([175, 195], [55, 70], [55, 65], 0.9), tone([260, 285], [45, 60], [65, 72], 0.9)],
    }],
    accents: [{ type: 'glow', count: [10, 18], size: [1, 1.4], tones: [tone([170, 190], 90, 70)] }],
    extras: { fireflies: 0.9, mushrooms: 0.5, grass: 0.6 },
    ground: 'lush',
  },

  bamboo: {
    name: 'Bamboo',
    tags: ['tropical', 'grass'],
    rule: 'fork',
    genes: {
      trunks: [3, 6.4], trunkSpread: [8, 16], trunkGap: [6, 10], trunkLength: [70, 105], trunkWidth: [3, 4], taper: [0.75, 0.85], flare: 0,
      lean: [-4, 4], wobble: [1, 2], photo: [0.2, 0.4], gravity: 0, branchCount: 1, branchAngle: 0, maxDepth: 0,
    },
    bark: { style: 'nodes', h: [80, 95], s: [35, 50], l: [40, 48] },
    foliage: [{
      type: 'scatter', size: [4, 5.5], aspect: [3.5, 4.5], density: [0.55, 0.75], spread: [3, 6], reach: 0, minHeight: 0.4,
      rot: [-30, -15], rotJitter: 15,
      tones: [tone([85, 105], [40, 55], [35, 42]), tone([90, 110], [40, 55], [42, 48])],
    }],
    extras: { grass: 0.7, rocks: 0.4 },
    ground: 'lush',
  },
};

export const SPECIES_IDS = Object.keys(SPECIES);
