import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Scroll positions are keyed by react-router's per-history-entry location.key so
// that back/forward returns the user to exactly where they were, while forward
// navigation (product click, nav links) still starts at the top.
//
// We mirror the live in-memory map into sessionStorage so positions survive a
// reload within the same tab (sessionStorage — not localStorage — because these
// keys are tied to the current browsing session and should be discarded when the
// tab closes rather than accumulating forever).
const STORAGE_KEY = "bk_scroll_positions";

const scrollPositions = (() => {
  try {
    return new Map(Object.entries(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}")));
  } catch {
    return new Map();
  }
})();

const persist = () => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(scrollPositions)));
  } catch {
    /* storage unavailable (private mode / quota) — restoration still works in-memory */
  }
};

const ScrollToTop = () => {
  const { pathname, search, hash, key, state } = useLocation();
  const navType = useNavigationType(); // "POP" (back/forward) | "PUSH" | "REPLACE"
  const keyRef = useRef(key);
  const suppressRef = useRef(false); // ignore scroll events caused by our own scrollTo

  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return undefined;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // Single persistent listener: always record the scroll offset against whichever
  // history entry is currently active (keyRef), and flush to storage on unload.
  useEffect(() => {
    const handleScroll = () => {
      if (suppressRef.current) return;
      scrollPositions.set(keyRef.current, window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", persist);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", persist);
    };
  }, []);

  useLayoutEffect(() => {
    keyRef.current = key; // point the recorder at the new entry before any scroll fires

    if (hash) return undefined; // let in-page anchor scrolling work

    const saved = navType === "POP" ? scrollPositions.get(key) : undefined;

    // Forward navigation (or an entry we never recorded): start at the top.
    if (saved == null) {
      suppressRef.current = true;
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      persist();
      const id = requestAnimationFrame(() => {
        suppressRef.current = false;
      });
      return () => cancelAnimationFrame(id);
    }

    // Back/forward: restore the remembered position.
    //
    // This runs in a layout effect, i.e. BEFORE the browser paints, and the home
    // page's deferred sections reserve their height up front (contain-intrinsic-
    // size), so the document is already tall enough here. Scrolling synchronously
    // now means the very first paint is already parked at the saved offset — the
    // user never sees the page at the top and never watches it auto-scroll down.
    suppressRef.current = true;
    const applyScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.min(saved, Math.max(0, maxScroll)), left: 0, behavior: "instant" });
    };
    applyScroll();

    // Content (real product data, images) then streams in and can shift the
    // layout, so keep re-asserting the offset for a short window until the height
    // stops changing — or the user takes over by scrolling themselves.
    let cancelled = false;
    let rafId = 0;
    let lastHeight = -1;
    let stableFrames = 0;
    const startTime = performance.now();

    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("wheel", onUserScroll);
      window.removeEventListener("touchmove", onUserScroll);
      window.removeEventListener("keydown", onUserScroll);
      suppressRef.current = false;
    };

    // A genuine user gesture means "stop fighting me" — hand control back.
    function onUserScroll() {
      finish();
    }

    const step = () => {
      if (cancelled) return;
      const height = document.documentElement.scrollHeight;
      applyScroll();

      if (height === lastHeight) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }
      lastHeight = height;

      if (stableFrames >= 10 || performance.now() - startTime > 1500) {
        finish();
      } else {
        rafId = requestAnimationFrame(step);
      }
    };

    window.addEventListener("wheel", onUserScroll, { passive: true });
    window.addEventListener("touchmove", onUserScroll, { passive: true });
    window.addEventListener("keydown", onUserScroll);
    rafId = requestAnimationFrame(step);

    return () => finish();
  }, [pathname, search, hash, key, navType, state?.refreshKey]);

  return null;
};

export default ScrollToTop;
