/**
 * Eco Shopping Assistant — Backend
 * --------------------------------
 * Express server providing sustainability scoring + alternatives.
 * Run: `npm install && npm start`  (listens on :5050)
 */
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const productRoutes = require("./routes/productRoutes");
const errorHandler = require("./middleware/errorHandler");
const config = require("./config/config");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) =>
  res.json({ status: "ok", service: "eco-assistant", time: Date.now() })
);

app.use("/", productRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🌿 Eco backend running on http://localhost:${config.port}`);
});
