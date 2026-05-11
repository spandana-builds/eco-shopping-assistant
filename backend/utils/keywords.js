// Keyword ruleset for sustainability scoring.
const BASE_SCORE = 55;

const RULES = [
  { keyword: "organic",        pattern: /\borganic\b/,            weight:  25 },
  { keyword: "recycled",       pattern: /\brecycle[ds]?\b/,       weight:  20 },
  { keyword: "bamboo",         pattern: /\bbamboo\b/,             weight:  30 },
  { keyword: "biodegradable",  pattern: /\bbiodegradable\b/,      weight:  20 },
  { keyword: "compostable",    pattern: /\bcompostable\b/,        weight:  18 },
  { keyword: "fair trade",     pattern: /\bfair[\s-]?trade\b/,    weight:  15 },
  { keyword: "vegan",          pattern: /\bvegan\b/,              weight:  10 },
  { keyword: "natural",        pattern: /\bnatural\b/,            weight:   8 },
  { keyword: "hemp",           pattern: /\bhemp\b/,               weight:  18 },
  { keyword: "linen",          pattern: /\blinen\b/,              weight:  12 },

  { keyword: "plastic",        pattern: /\bplastic\b/,            weight: -20 },
  { keyword: "polyester",      pattern: /\bpolyester\b/,          weight: -10 },
  { keyword: "synthetic",      pattern: /\bsynthetic\b/,          weight:  -8 },
  { keyword: "leather",        pattern: /\bleather\b/,            weight: -10 },
  { keyword: "fast fashion",   pattern: /\bfast[\s-]?fashion\b/,  weight: -25 },
  { keyword: "single-use",     pattern: /\bsingle[\s-]?use\b/,    weight: -20 },
  { keyword: "disposable",     pattern: /\bdisposable\b/,         weight: -15 },
  { keyword: "excess packaging", pattern: /\bexcess(ive)? packag/, weight: -15 },
];

module.exports = { RULES, BASE_SCORE };
