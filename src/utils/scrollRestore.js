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

/**
 * Send the page to the top and hold it there for a few frames.
 *
 * One scrollTo() is not enough, for two independent reasons:
 *
 *   - it does NOTHING while the body is scroll-locked, and a couple of dozen places set
 *     `document.body.style.overflow = "hidden"` (menus, bottom sheets, the lightbox).
 *     Those release the lock in a PASSIVE effect cleanup, which React runs after layout
 *     effects and after the paint — and releasing one hands back the offset the browser
 *     was holding.
 *   - the incoming panel is still settling: fonts land, a background image decodes, a
 *     taller form replaces a shorter one. Any of those can move the offset afterwards.
 *
 * So it re-asserts until the scroll actually holds, then stops. In the ordinary case —
 * nothing locked, layout stable — that is one extra check on the next frame.
 *
 * Call from a LAYOUT effect: the first call then lands before the browser paints, so the
 * reader never sees the new content at the old offset and never watches it jump.
 *
 * @param {object}   [options]
 * @param {number}   [options.maxFrames=6]  Frames to keep re-asserting before giving up.
 * @param {Function} [options.onDone]       Run once, when it settles or is cancelled.
 * @returns {Function} cancel — safe to call more than once.
 */
export const scrollWindowToTop = ({ maxFrames = 6, onDone } = {}) => {
  let frames = 0;
  let rafId = 0;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener("wheel", finish);
    window.removeEventListener("touchmove", finish);
    onDone?.();
  };

  const step = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    // Some pages put their own scroller on the page element rather than the viewport
    // (an `overflow-x: hidden` block computes `overflow-y: auto`), so clear those too.
    if (document.documentElement.scrollTop) document.documentElement.scrollTop = 0;
    if (document.body.scrollTop) document.body.scrollTop = 0;

    if ((window.scrollY === 0 && frames > 0) || frames >= maxFrames) {
      finish();
      return;
    }
    frames += 1;
    rafId = requestAnimationFrame(step);
  };

  step();

  // A deliberate gesture means the reader has taken over — stop immediately.
  window.addEventListener("wheel", finish, { passive: true, once: true });
  window.addEventListener("touchmove", finish, { passive: true, once: true });

  return finish;
};
