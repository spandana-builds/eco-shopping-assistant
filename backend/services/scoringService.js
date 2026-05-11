/**
 * Rule-based sustainability scoring engine.
 * Combines keyword detection across title + description + category.
 */
const { RULES, BASE_SCORE } = require("../utils/keywords");
const { ratingFromScore, generateExplanation, generateTips } = require("../utils/ecoText");

function scoreProduct(product) {
  const haystack = `${product.title || ""} ${product.description || ""} ${product.category || ""}`.toLowerCase();
  const matched = [];
  let score = BASE_SCORE;

  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) {
      score += rule.weight;
      matched.push(rule);
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const rating = ratingFromScore(score);

  return {
    score,
    rating,
    matched: matched.map((m) => ({ keyword: m.keyword, weight: m.weight })),
    explanation: generateExplanation(product, matched, score),
    tips: generateTips(matched, score),
    carbonEstimateKg: estimateCarbon(product, score),
  };
}

function estimateCarbon(product, score) {
  // Simple inverse heuristic: lower score → higher footprint.
  const base = 5; // kg CO2e baseline
  return +(base + (100 - score) * 0.12).toFixed(2);
}

module.exports = { scoreProduct };
