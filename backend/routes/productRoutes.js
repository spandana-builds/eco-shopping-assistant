const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/productController");

router.post("/analyze-product", ctrl.analyzeProduct);
router.post("/suggest-alternatives", ctrl.suggestAlternatives);

module.exports = router;
