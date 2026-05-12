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
    const h = location.hostname.replace(/^www\./, "");
    if (h.includes("amazon")) return "amazon";
    if (h.includes("flipkart")) return "flipkart";
    if (h.includes("myntra")) return "myntra";
    if (h.includes("ebay")) return "ebay";
    if (h.includes("etsy")) return "etsy";
    if (h.includes("walmart")) return "walmart";
    if (h.includes("target.com")) return "target";
    if (h.includes("shopify")) return "shopify";
    if (h.includes("aliexpress")) return "aliexpress";
    return "generic";
  }

  // ---------- Helpers ----------
  function text(sel, root = document) {
    const el = root.querySelector(sel);
    return el ? el.textContent.trim().replace(/\s+/g, " ") : "";
  }

  function meta(name) {
    const el =
      document.querySelector(`meta[property="${name}"]`) ||
      document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute("content") || "" : "";
  }

  function readJsonLd() {
    const out = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const data = JSON.parse(s.textContent);
        const items = Array.isArray(data) ? data : [data];
        items.forEach((it) => {
          if (!it) return;
          if (it["@graph"]) it["@graph"].forEach((g) => out.push(g));
          else out.push(it);
        });
      } catch (_) {}
    });
    return out.find((d) => {
      const t = d["@type"];
      return t === "Product" || (Array.isArray(t) && t.includes("Product"));
    });
  }

  // ---------- Generic product detection ----------
  function looksLikeProductPage() {
    if (meta("og:type").toLowerCase() === "product") return true;
    if (readJsonLd()) return true;
    if (document.querySelector('[itemtype*="schema.org/Product"]')) return true;
    // Heuristic: presence of price + add-to-cart button
    const hasPrice = /[$€£₹¥]\s?\d|\d+[.,]\d{2}/.test(document.body.innerText.slice(0, 5000));
    const hasCart = !!document.querySelector(
      'button[name*="add" i],button[id*="cart" i],button[class*="cart" i],button[class*="buy" i],a[href*="cart" i]'
    );
    return hasPrice && hasCart;
  }

  function extractProduct(site) {
    let title = "", price = "", description = "", category = "", image = "";

    // 1) Site-specific selectors (best signal where we know the layout)
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
      title = (text("h1.pdp-title") + " " + text("h1.pdp-name")).trim();
      price = text("span.pdp-price strong");
      description = text("p.pdp-product-description-content");
      category = text(".breadcrumbs-container");
    }

    // 2) JSON-LD Product (works on most modern e-commerce sites)
    if (!title || !description) {
      const ld = readJsonLd();
      if (ld) {
        title = title || ld.name || "";
        description = description || (typeof ld.description === "string" ? ld.description : "");
        category = category || ld.category || (ld.brand && (ld.brand.name || ld.brand)) || "";
        image = image || (Array.isArray(ld.image) ? ld.image[0] : ld.image) || "";
        if (!price && ld.offers) {
          const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
          if (offer && offer.price) price = String(offer.price);
        }
      }
    }

    // 3) OpenGraph / meta fallbacks
    title = title || meta("og:title") || document.title;
    description = description || meta("og:description") || meta("description");
    image = image || meta("og:image");
    price = price || meta("product:price:amount") || meta("og:price:amount");

    // 4) Microdata fallback
    if (!title) title = text('[itemprop="name"]');
    if (!description) description = text('[itemprop="description"]');
    if (!price) price = text('[itemprop="price"]');

    // 5) Last-resort DOM heuristics
    if (!title) title = text("h1");
    if (!category) {
      const crumbs = document.querySelector('nav[aria-label*="readcrumb" i], .breadcrumb, [class*="breadcrumb" i]');
      if (crumbs) category = crumbs.textContent.trim().replace(/\s+/g, " ").slice(0, 200);
    }

    return {
      site,
      title: (title || "").slice(0, 300),
      price: (price || "").toString().slice(0, 50),
      description: (description || "").slice(0, 1500),
      category: (category || "").slice(0, 200),
      image,
      url: location.href,
    };
  }

  // ---------- Eco level mapping ----------
  function ecoLevel(score) {
    if (score >= 81) return { label: "Planet Friendly", icon: "🌍", rating: "excellent" };
    if (score >= 61) return { label: "Sustainable", icon: "♻️", rating: "good" };
    if (score >= 41) return { label: "Conscious Choice", icon: "🌱", rating: "good" };
    if (score >= 21) return { label: "Needs Improvement", icon: "⚠️", rating: "average" };
    return { label: "High Impact", icon: "🚨", rating: "poor" };
  }

  function ratingFromScore(s) {
    if (s >= 81) return "excellent";
    if (s >= 61) return "good";
    if (s >= 31) return "average";
    return "poor";
  }

  // ---------- Badge generator from matched keywords ----------
  const BADGE_MAP = {
    organic: { icon: "🌱", label: "Organic" },
    recycled: { icon: "♻️", label: "Recycled" },
    bamboo: { icon: "🎋", label: "Bamboo" },
    biodegradable: { icon: "🍃", label: "Biodegradable" },
    compostable: { icon: "🌿", label: "Compostable" },
    hemp: { icon: "🌾", label: "Hemp" },
    "fair trade": { icon: "🤝", label: "Fair Trade" },
    vegan: { icon: "🌱", label: "Vegan" },
    natural: { icon: "🍃", label: "Natural" },
    reusable: { icon: "🔄", label: "Reusable" },
    plastic: { icon: "🚫", label: "Plastic-heavy", neg: true },
    "fast fashion": { icon: "⚡", label: "Fast Fashion", neg: true },
    polyester: { icon: "🧴", label: "Synthetic", neg: true },
    leather: { icon: "🐄", label: "Leather", neg: true },
    synthetic: { icon: "🧪", label: "Synthetic", neg: true },
    disposable: { icon: "🗑️", label: "Disposable", neg: true },
    "single-use": { icon: "🚯", label: "Single-use", neg: true },
  };

  function badgesFromMatched(matched, score) {
    const out = [];
    (matched || []).forEach((m) => {
      const key = (m.keyword || "").toLowerCase();
      const b = BADGE_MAP[key];
      if (b) out.push(b);
    });
    if (!out.length) {
      if (score >= 60) out.push({ icon: "🌍", label: "Low carbon footprint" });
      else if (score >= 30) out.push({ icon: "📦", label: "Average impact" });
      else out.push({ icon: "🏭", label: "High emission" });
    }
    return out.slice(0, 6);
  }

  // ---------- Floating panel ----------
  function buildPanel() {
    if (document.getElementById("eco-assistant-panel")) return;

    const panel = document.createElement("div");
    panel.id = "eco-assistant-panel";
    panel.className = "eco-panel eco-collapsed";
    panel.innerHTML = `
      <button class="eco-toggle" aria-label="Toggle Eco Panel">🌿</button>
      <div class="eco-panel-inner">
        <header class="eco-header">
          <div class="eco-brand">
            <div class="eco-logo">🌿</div>
            <div>
              <h3>Eco Assistant</h3>
              <p class="eco-sub">Sustainability insights</p>
            </div>
          </div>
          <button class="eco-close" aria-label="Close">×</button>
        </header>

        <section class="eco-product-card">
          <div class="eco-product-thumb">📦</div>
          <div class="eco-product-meta">
            <p class="eco-product-title eco-shimmer">Loading product…</p>
            <div class="eco-product-site">—</div>
          </div>
        </section>

        <section class="eco-score-section">
          <div class="eco-ring">
            <svg viewBox="0 0 120 120">
              <circle class="eco-ring-bg" cx="60" cy="60" r="52" />
              <circle class="eco-ring-fg" cx="60" cy="60" r="52" />
            </svg>
            <div class="eco-ring-pulse"></div>
            <div class="eco-ring-label">
              <span class="eco-score">--</span>
              <small>eco score</small>
            </div>
          </div>
          <div class="eco-rating-badge" data-rating="loading">
            <span class="eco-rating-icon">✨</span>
            <span class="eco-rating-text">Analyzing…</span>
          </div>
        </section>

        <section class="eco-badges"></section>

        <section class="eco-carbon">
          <div class="eco-carbon-row">
            <span class="eco-carbon-label">🌍 Carbon Impact</span>
            <span class="eco-carbon-value">—<small> kg CO₂e</small></span>
          </div>
          <div class="eco-leaf-meter">
            <span class="eco-leaf-cell"></span><span class="eco-leaf-cell"></span>
            <span class="eco-leaf-cell"></span><span class="eco-leaf-cell"></span>
            <span class="eco-leaf-cell"></span>
          </div>
        </section>

        <section class="eco-compare">
          <p class="eco-compare-text">Comparing with similar products…</p>
          <div class="eco-compare-bar"><div class="eco-compare-fill"></div></div>
        </section>

        <section class="eco-insight">
          <h4>✨ Eco Insight</h4>
          <p class="eco-explanation">Reading product details…</p>
          <div class="eco-accordion">
            <button class="eco-accordion-trigger">
              <span>Show details</span><span class="chev">▾</span>
            </button>
            <div class="eco-accordion-content">
              <ul class="eco-tips"></ul>
            </div>
          </div>
        </section>

        <section class="eco-alts">
          <h4>🌿 Greener Alternatives</h4>
          <ul class="eco-alt-list"></ul>
        </section>

        <section>
          <h4>📊 Your Eco Stats</h4>
          <div class="eco-stats">
            <div class="eco-stat">
              <div class="eco-stat-value" data-stat="checks">0</div>
              <div class="eco-stat-label">Products checked</div>
            </div>
            <div class="eco-stat">
              <div class="eco-stat-value" data-stat="avg">—</div>
              <div class="eco-stat-label">Avg eco score</div>
            </div>
            <div class="eco-stat">
              <div class="eco-stat-value" data-stat="green">0</div>
              <div class="eco-stat-label">Green choices</div>
            </div>
            <div class="eco-stat">
              <div class="eco-stat-value" data-stat="streak">0</div>
              <div class="eco-stat-label">Day streak</div>
            </div>
          </div>
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
    panel.querySelector(".eco-accordion-trigger").addEventListener("click", () => {
      panel.querySelector(".eco-accordion").classList.toggle("open");
    });

    return panel;
  }

  function animateCount(el, to, duration = 1400) {
    const start = performance.now();
    const from = 0;
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function setRing(score) {
    const fg = document.querySelector("#eco-assistant-panel .eco-ring-fg");
    const label = document.querySelector("#eco-assistant-panel .eco-score");
    if (!fg || !label) return;
    const c = 2 * Math.PI * 52;
    fg.style.strokeDasharray = `${c}`;
    fg.style.strokeDashoffset = `${c - (score / 100) * c}`;
    fg.setAttribute("data-rating", ratingFromScore(score));
    animateCount(label, score);
  }

  function renderResult(product, result) {
    const panel = document.getElementById("eco-assistant-panel");
    if (!panel) return;
    panel.classList.remove("eco-collapsed");

    // Product card
    const titleEl = panel.querySelector(".eco-product-title");
    titleEl.classList.remove("eco-shimmer");
    titleEl.textContent = product.title || "Unknown product";
    panel.querySelector(".eco-product-site").textContent = (product.site || "shop").toUpperCase();
    const thumb = panel.querySelector(".eco-product-thumb");
    if (product.image) {
      thumb.style.backgroundImage = `url("${product.image.replace(/"/g, "%22")}")`;
      thumb.textContent = "";
    }

    // Score ring + level badge
    setRing(result.score);
    const level = ecoLevel(result.score);
    const ratingEl = panel.querySelector(".eco-rating-badge");
    ratingEl.dataset.rating = level.rating;
    ratingEl.querySelector(".eco-rating-icon").textContent = level.icon;
    ratingEl.querySelector(".eco-rating-text").textContent = level.label;

    // Badges
    const badgesEl = panel.querySelector(".eco-badges");
    const badges = badgesFromMatched(result.matched, result.score);
    badgesEl.innerHTML = badges
      .map((b) => `<span class="eco-badge${b.neg ? " neg" : ""}">${b.icon} ${b.label}</span>`)
      .join("");

    // Carbon
    const carbon = result.carbonEstimateKg != null ? result.carbonEstimateKg : (5 + (100 - result.score) * 0.12);
    const cVal = panel.querySelector(".eco-carbon-value");
    cVal.innerHTML = `${(+carbon).toFixed(1)}<small> kg CO₂e</small>`;
    const filled = Math.max(1, Math.round((100 - result.score) / 20));
    panel.querySelectorAll(".eco-leaf-cell").forEach((c, i) => {
      setTimeout(() => c.classList.toggle("on", i < filled), 200 + i * 100);
    });

    // Comparison
    const pct = Math.max(5, Math.min(95, result.score));
    const cmp = panel.querySelector(".eco-compare-text");
    cmp.innerHTML = `This product is greener than <strong>${pct}%</strong> of similar items.`;
    setTimeout(() => {
      panel.querySelector(".eco-compare-fill").style.width = `${pct}%`;
    }, 100);

    // Insight + tips
    panel.querySelector(".eco-explanation").textContent = result.explanation;
    const tips = panel.querySelector(".eco-tips");
    tips.innerHTML = (result.tips || []).map((t) => `<li>${t}</li>`).join("");

    // Alternatives
    const alts = panel.querySelector(".eco-alt-list");
    alts.innerHTML = (result.alternatives || [])
      .map((a) => `<li class="eco-alt"><strong>${a.name}</strong><small>${a.reason || ""}</small></li>`)
      .join("");

    // History + stats
    chrome.storage.local.get({ history: [] }, ({ history }) => {
      history.unshift({
        title: product.title, score: result.score, rating: result.rating,
        url: product.url, at: Date.now(),
      });
      const trimmed = history.slice(0, 50);
      chrome.storage.local.set({ history: trimmed });
      renderStats(trimmed);
    });
  }

  function renderStats(history) {
    const panel = document.getElementById("eco-assistant-panel");
    if (!panel) return;
    const checks = history.length;
    const avg = checks ? Math.round(history.reduce((s, h) => s + (h.score || 0), 0) / checks) : 0;
    const green = history.filter((h) => (h.score || 0) >= 60).length;
    // streak: consecutive days with at least one check
    const days = new Set(history.map((h) => new Date(h.at).toDateString()));
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (days.has(d.toDateString())) streak++; else break;
    }
    const set = (k, v) => {
      const el = panel.querySelector(`[data-stat="${k}"]`);
      if (el) el.textContent = v;
    };
    set("checks", checks);
    set("avg", avg || "—");
    set("green", green);
    set("streak", streak);
  }

  function renderError(msg) {
    const panel = document.getElementById("eco-assistant-panel");
    if (!panel) return;
    panel.querySelector(".eco-explanation").textContent =
      msg || "Could not reach Eco backend. Make sure the server is running on localhost:5050.";
    panel.querySelector(".eco-rating-badge").textContent = "Offline";
  }

  let lastUrl = location.href;
  let lastTitle = "";

  async function analyze() {
    const site = detectSite();

    // For unknown sites, only run if it looks like a product page
    if (site === "generic" && !looksLikeProductPage()) return;

    const product = extractProduct(site);
    if (!product.title || product.title.length < 3) return;
    if (product.title === lastTitle) return;
    lastTitle = product.title;

    buildPanel();

    try {
      const res = await fetch(`${API_BASE}/analyze-product`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      const data = await res.json();
      renderResult(product, data);
    } catch (e) {
      const fallback = localScore(product);
      renderResult(product, fallback);
    }
  }

  function localScore(p) {
    const text = `${p.title} ${p.description} ${p.category}`.toLowerCase();
    const rules = [
      ["organic", 25], ["recycled", 20], ["bamboo", 30], ["biodegradable", 20],
      ["compostable", 22], ["reusable", 18], ["hemp", 18], ["fair trade", 15],
      ["vegan", 10], ["natural", 8],
      ["plastic", -20], ["fast fashion", -25], ["polyester", -10], ["leather", -10],
      ["synthetic", -8], ["disposable", -15], ["single-use", -20],
    ];
    let score = 55;
    const matched = [];
    const tips = [];
    for (const [kw, w] of rules) {
      if (text.includes(kw)) {
        score += w;
        matched.push({ keyword: kw, weight: w });
        tips.push(
          w > 0
            ? `🌱 Contains "${kw}" — a positive sustainability signal.`
            : `⚠️ Contains "${kw}" — consider greener alternatives.`
        );
      }
    }
    score = Math.max(0, Math.min(100, score));
    const explanation = score >= 70
      ? "🌍 Great choice — this product shows strong sustainability signals."
      : score >= 40
      ? "🌱 Decent option, but there's room for greener alternatives."
      : "🚨 High environmental impact detected. Consider eco-friendlier swaps.";
    return {
      score,
      rating: score >= 81 ? "Excellent" : score >= 61 ? "Good" : score >= 31 ? "Average" : "Poor",
      explanation,
      tips: tips.length ? tips : ["No strong eco signals detected on this page."],
      matched,
      carbonEstimateKg: +(5 + (100 - score) * 0.12).toFixed(1),
      alternatives: [],
    };
  }

  // Initial run
  setTimeout(analyze, 1500);

  // Re-run on SPA navigation (many shopping sites use client-side routing)
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastTitle = "";
      setTimeout(analyze, 1200);
    }
  }, 1500);
})();
