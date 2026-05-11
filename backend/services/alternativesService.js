/**
 * Suggests greener alternatives based on detected category/keywords.
 * Uses a curated mock catalog — replace with a real source later.
 */
const CATALOG = {
  fashion: [
    { name: "Organic Cotton Tee — Patagonia",     reason: "GOTS certified, fair trade." },
    { name: "Recycled Polyester Jacket — Tentree", reason: "Made from rPET bottles." },
    { name: "Hemp Blend Jeans — Outerknown",       reason: "Lower water footprint." },
  ],
  electronics: [
    { name: "Fairphone 5",            reason: "Modular, repairable, ethical sourcing." },
    { name: "Framework Laptop",       reason: "User-upgradable, long lifespan." },
  ],
  home: [
    { name: "Bamboo Toothbrush Set",   reason: "Biodegradable handle." },
    { name: "Beeswax Food Wraps",      reason: "Replaces single-use plastic wrap." },
    { name: "Recycled Glass Tumblers", reason: "Closed-loop materials." },
  ],
  beauty: [
    { name: "Solid Shampoo Bar — Lush", reason: "Plastic-free packaging." },
    { name: "Refillable Deodorant — Wild", reason: "Reusable case." },
  ],
  default: [
    { name: "Locally-sourced equivalent", reason: "Lower transport emissions." },
    { name: "Second-hand version",        reason: "Extends lifecycle, zero new resources." },
  ],
};

function detectCategory(product) {
  const t = `${product.title} ${product.category}`.toLowerCase();
  if (/shirt|jeans|dress|jacket|shoe|kurta|saree|fashion|apparel/.test(t)) return "fashion";
  if (/phone|laptop|tv|earbud|headphone|tablet|camera/.test(t))            return "electronics";
  if (/kitchen|bottle|cup|bedding|towel|home/.test(t))                     return "home";
  if (/shampoo|cream|lotion|makeup|deodorant|skincare/.test(t))            return "beauty";
  return "default";
}

function suggest(product, scored) {
  const cat = detectCategory(product);
  // Only suggest if score isn't already excellent
  if (scored.score >= 85) return [];
  return CATALOG[cat].slice(0, 3);
}

module.exports = { suggest, detectCategory };
