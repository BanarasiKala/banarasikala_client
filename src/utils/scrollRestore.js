// Shared store for scroll-position restoration on back/forward navigation.
//
// Positions are keyed by react-router's per-history-entry location.key. The map
// is the live source of truth during a session; it is mirrored into
// sessionStorage so positions survive a reload within the same tab (sessionStorage
// rather than localStorage because the keys belong to the current browsing
// session and should not accumulate across tabs/visits).
const STORAGE_KEY = "bk_scroll_positions";

export const scrollPositions = (() => {
  try {
    return new Map(Object.entries(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}")));
  } catch {
    return new Map();
  }
})();

export const persistScrollPositions = () => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(scrollPositions)));
  } catch {
    /* storage unavailable (private mode / quota) — restoration still works in-memory */
  }
};

// Numeric saved offset for a history entry, or 0 if none recorded.
export const getSavedScroll = (key) => {
  const value = scrollPositions.get(key);
  return typeof value === "number" ? value : 0;
};
