// Popup logic: stats, settings, history
const $ = (sel) => document.querySelector(sel);

function loadState() {
  chrome.storage.local.get(
    { active: true, dark: false, history: [], streak: 0 },
    ({ active, dark, history, streak }) => {
      $("#toggleActive").checked = active;
      $("#toggleDark").checked = dark;
      document.body.classList.toggle("dark", dark);

      $("#productsAnalyzed").textContent = history.length;
      const avg = history.length
        ? Math.round(history.reduce((s, h) => s + (h.score || 0), 0) / history.length)
        : "—";
      $("#avgScore").textContent = avg;
      $("#streak").textContent = streak;

      const list = $("#history");
      list.innerHTML = history.slice(0, 6).map(
        (h) =>
          `<li><span>${(h.title || "Untitled").slice(0, 38)}</span><span>${h.score}</span></li>`
      ).join("") || `<li><span>No history yet</span></li>`;
    }
  );
}

$("#toggleActive").addEventListener("change", (e) => {
  chrome.storage.local.set({ active: e.target.checked });
});
$("#toggleDark").addEventListener("change", (e) => {
  chrome.storage.local.set({ dark: e.target.checked });
  document.body.classList.toggle("dark", e.target.checked);
});

loadState();
