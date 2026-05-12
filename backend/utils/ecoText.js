function ratingFromScore(s) {
  if (s >= 81) return "Excellent";
  if (s >= 61) return "Good";
  if (s >= 31) return "Average";
  return "Poor";
}

function generateExplanation(product, matched, score) {
  if (!matched.length) {
    return `We couldn't detect strong sustainability signals for "${truncate(product.title, 60)}". The score reflects an industry-average baseline.`;
  }
  const positives = matched.filter((m) => m.weight > 0).map((m) => m.keyword);
  const negatives = matched.filter((m) => m.weight < 0).map((m) => m.keyword);

  const parts = [];
  if (positives.length) parts.push(`Positive signals: ${positives.join(", ")}.`);
  if (negatives.length) parts.push(`Concerns: ${negatives.join(", ")}.`);

  const verdict =
    score >= 81 ? "An excellent eco choice."
    : score >= 61 ? "A solid, reasonably sustainable pick."
    : score >= 31 ? "Has trade-offs — consider greener alternatives below."
    : "Significant environmental concerns. Greener options are recommended.";

  return `${parts.join(" ")} ${verdict}`;
}

function generateTips(matched, score) {
  const tips = [];
  if (matched.some((m) => m.keyword === "plastic"))
    tips.push("Look for plastic-free packaging when possible.");
  if (matched.some((m) => m.keyword === "polyester" || m.keyword === "synthetic"))
    tips.push("Prefer natural fibres like cotton, hemp, or linen.");
  if (matched.some((m) => m.keyword === "fast fashion"))
    tips.push("Buying second-hand cuts the footprint by ~80%.");
  if (score >= 81) tips.push("Great pick — share it with friends to amplify impact.");
  if (!tips.length) tips.push("Check the brand's sustainability report for transparency.");
  if (score < 60) tips.push("Consider buying second-hand or refurbished alternatives.");
  return tips.slice(0, 4);
}

function truncate(s = "", n) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

module.exports = { ratingFromScore, generateExplanation, generateTips };
