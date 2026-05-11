/**
 * Eco Shopping Assistant — Content Script
 * --------------------------------------
 * Runs on supported shopping pages, scrapes product info from the DOM,
 * sends it to the backend, and injects a floating eco panel with the result.
 */

// NOTE: Chrome MV3 content scripts cannot use ES module imports directly.
// All helpers are inlined below for compatibility.

(function () {
  "use strict";

  const API_BASE = "http://localhost:5050";

  // ---------- Site detection ----------
  function detectSite() {
    const h = location.hostname;
    if (h.includes("amazon")) return "amazon";
    if (h.includes("flipkart")) return "flipkart";
    if (h.includes("myntra")) return "myntra";
    return null;
  }

  // ---------- Product extraction ----------
  function text(sel) {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : "";
  }

  function extractProduct(site) {
    let title = "", price = "", description = "", category = "";

    if (site === "amazon") {
      title = text("#productTitle");
      price = text(".a-price .a-offscreen") || text("#priceblock_ourprice");
      description = [...document.querySelectorAll("#feature-bullets li")]
        .map((li) => li.textContent.trim()).join(" ");
      category = text("#wayfinding-breadcrumbs_feature_div");
    } else if (site === "flipkart") {
      title = text("span.B_NuCI") || text("h1 span");
      price = text("div._30jeq3");
      description = text("div._1mXcCf") || text("div._1AN87F");
      category = text("div._3GIHBu");
    } else if (site === "myntra") {
      title = text("h1.pdp-title") + " " + text("h1.pdp-name");
      price = text("span.pdp-price strong");
      description = text("p.pdp-product-description-content");
      category = text(".breadcrumbs-container");
    }

    return {
      site,
      title: title || document.title,
      price,
      description,
      category,
      url: location.href,
    };
  }

  // ---------- Floating panel ----------
  function buildPanel() {
    if (document.getElementById("eco-assistant-panel")) return;

    const panel = document.createElement("div");
    panel.id = "eco-assistant-panel";
    panel.className = "eco-panel eco-collapsed";
    panel.innerHTML = `
      <button class="eco-toggle" aria-label="Toggle Eco Panel">
        <span class="eco-leaf">🌿</span>
      </button>
      <div class="eco-panel-inner">
        <header class="eco-header">
          <div class="eco-brand">
            <span class="eco-leaf-lg">🌿</span>
            <div>
              <h3>Eco Assistant</h3>
              <p class="eco-sub">Sustainability insights</p>
            </div>
          </div>
          <button class="eco-close" aria-label="Close">×</button>
        </header>

        <section class="eco-score-section">
          <div class="eco-ring">
            <svg viewBox="0 0 120 120">
              <circle class="eco-ring-bg" cx="60" cy="60" r="52" />
              <circle class="eco-ring-fg" cx="60" cy="60" r="52" />
            </svg>
            <div class="eco-ring-label">
              <span class="eco-score">--</span>
              <small>/100</small>
            </div>
          </div>
          <div class="eco-rating-badge" data-rating="loading">Analyzing…</div>
        </section>

        <section class="eco-product">
          <p class="eco-product-title">—</p>
        </section>

        <section class="eco-insights">
          <h4>Eco Insights</h4>
          <p class="eco-explanation">Reading product details…</p>
          <ul class="eco-tips"></ul>
        </section>

        <section class="eco-alts">
          <h4>Greener Alternatives</h4>
          <ul class="eco-alt-list"></ul>
        </section>

        <footer class="eco-footer">
          <span>Powered by Eco Assistant</span>
        </footer>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector(".eco-toggle").addEventListener("click", () => {
      panel.classList.toggle("eco-collapsed");
    });
    panel.querySelector(".eco-close").addEventListener("click", () => {
      panel.classList.add("eco-collapsed");
    });

    return panel;
  }

  function setRing(score) {
    const fg = document.querySelector("#eco-assistant-panel .eco-ring-fg");
    const label = document.querySelector("#eco-assistant-panel .eco-score");
    if (!fg || !label) return;
    const c = 2 * Math.PI * 52;
    fg.style.strokeDasharray = `${c}`;
    fg.style.strokeDashoffset = `${c - (score / 100) * c}`;
    label.textContent = score;
    fg.setAttribute("data-rating", ratingFromScore(score));
  }

  function ratingFromScore(s) {
    if (s >= 81) return "excellent";
    if (s >= 61) return "good";
    if (s >= 31) return "average";
    return "poor";
  }

  function renderResult(product, result) {
    const panel = document.getElementById("eco-assistant-panel");
    if (!panel) return;
    setRing(result.score);

    const ratingEl = panel.querySelector(".eco-rating-badge");
    ratingEl.textContent = result.rating;
    ratingEl.dataset.rating = ratingFromScore(result.score);

    panel.querySelector(".eco-product-title").textContent = product.title || "Unknown product";
    panel.querySelector(".eco-explanation").textContent = result.explanation;

    const tips = panel.querySelector(".eco-tips");
    tips.innerHTML = result.tips.map((t) => `<li>✓ ${t}</li>`).join("");

    const alts = panel.querySelector(".eco-alt-list");
    alts.innerHTML = (result.alternatives || [])
      .map(
        (a) => `
        <li class="eco-alt">
          <strong>${a.name}</strong>
          <small>${a.reason}</small>
        </li>`
      )
      .join("");

    // Save to history
    chrome.storage.local.get({ history: [] }, ({ history }) => {
      history.unshift({
        title: product.title,
        score: result.score,
        rating: result.rating,
        url: product.url,
        at: Date.now(),
      });
      chrome.storage.local.set({ history: history.slice(0, 50) });
    });
  }

  function renderError(msg) {
    const panel = document.getElementById("eco-assistant-panel");
    if (!panel) return;
    panel.querySelector(".eco-explanation").textContent =
      msg || "Could not reach Eco backend. Make sure the server is running on localhost:5050.";
    panel.querySelector(".eco-rating-badge").textContent = "Offline";
  }

  async function analyze() {
    const site = detectSite();
    if (!site) return;

    buildPanel();
    const product = extractProduct(site);
    if (!product.title) return;

    try {
      const res = await fetch(`${API_BASE}/analyze-product`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      const data = await res.json();
      renderResult(product, data);
    } catch (e) {
      // Fallback local scoring if backend unavailable
      const fallback = localScore(product);
      renderResult(product, fallback);
    }
  }

  // Lightweight local fallback so the panel still works without backend
  function localScore(p) {
    const text = `${p.title} ${p.description}`.toLowerCase();
    const rules = [
      ["organic", 25], ["recycled", 20], ["bamboo", 30], ["biodegradable", 20],
      ["plastic", -20], ["fast fashion", -25], ["polyester", -10], ["leather", -10],
    ];
    let score = 55;
    const tips = [];
    for (const [kw, w] of rules) {
      if (text.includes(kw)) {
        score += w;
        tips.push(`${w > 0 ? "Positive" : "Negative"}: contains "${kw}"`);
      }
    }
    score = Math.max(0, Math.min(100, score));
    const rating = score >= 81 ? "Excellent" : score >= 61 ? "Good" : score >= 31 ? "Average" : "Poor";
    return {
      score,
      rating,
      explanation: "Local heuristic analysis (backend offline).",
      tips: tips.length ? tips : ["No strong eco signals detected."],
      alternatives: [],
    };
  }

  // Run after page settles
  setTimeout(analyze, 1500);
})();
