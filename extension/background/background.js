// Service worker — tracks shopping streaks and lifecycle events.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ active: true, history: [], streak: 1, lastSeen: Date.now() });
  console.log("Eco Shopping Assistant installed 🌿");
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get({ lastSeen: 0, streak: 0 }, ({ lastSeen, streak }) => {
    const day = 24 * 60 * 60 * 1000;
    const diff = Date.now() - lastSeen;
    let next = streak;
    if (diff > day && diff < 2 * day) next = streak + 1;
    else if (diff >= 2 * day) next = 1;
    chrome.storage.local.set({ lastSeen: Date.now(), streak: next });
  });
});
