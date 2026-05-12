const scoringService = require("../services/scoringService");
const alternativesService = require("../services/alternativesService");

exports.analyzeProduct = async (req, res, next) => {
  try {
    const product = req.body || {};
    if (!product.title) {
      return res.status(400).json({ error: "Missing product title" });
    }

    const scored = scoringService.scoreProduct(product);
    const alternatives = alternativesService.suggest(product, scored);

    res.json({ ...scored, alternatives });
  } catch (e) {
    next(e);
  }
};

exports.suggestAlternatives = async (req, res, next) => {
  try {
    const product = req.body || {};
    res.json({ alternatives: alternativesService.suggest(product, { score: 50 }) });
  } catch (e) {
    next(e);
  }
};
