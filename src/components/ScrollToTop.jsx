import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { scrollPositions, persistScrollPositions as persist } from "../utils/scrollRestore";

// Restores scroll position on back/forward (POP) navigation so the user returns
// to exactly where they were, while forward navigation (product click, nav links)
// still starts at the top. The shared store lives in utils/scrollRestore so that
// deferred sections (e.g. the home page) can render eagerly during a restore.
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

    // The tricky part: after mount the real data + images stream in asynchronously
    // (skeletons get swapped for taller/shorter content), which shifts the layout
    // *after* the first paint. A fixed frame/time loop stops too early — the page
    // looks stable during the skeleton phase, then the real data lands and moves
    // everything. So instead we re-assert the saved offset whenever the document
    // height actually changes (ResizeObserver), and only give up once the layout
    // has stopped changing for a beat — or the user scrolls themselves.
    let cancelled = false;
    let settleTimer = 0;
    const startTime = performance.now();

    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      window.clearTimeout(settleTimer);
      resizeObserver.disconnect();
      window.removeEventListener("wheel", onUserScroll);
      window.removeEventListener("touchmove", onUserScroll);
      window.removeEventListener("keydown", onUserScroll);
      suppressRef.current = false;
    };

    // A genuine user gesture means "stop fighting me" — hand control back.
    function onUserScroll() {
      finish();
    }

    // Settle 350ms after the last layout change, with a 4s hard cap so a page
    // that keeps mutating (e.g. an animation) can never pin the scroll forever.
    const scheduleSettle = () => {
      window.clearTimeout(settleTimer);
      const remaining = 4000 - (performance.now() - startTime);
      settleTimer = window.setTimeout(finish, Math.max(0, Math.min(350, remaining)));
    };

    const resizeObserver = new ResizeObserver(() => {
      if (cancelled) return;
      applyScroll();
      scheduleSettle();
    });
    resizeObserver.observe(document.documentElement);

    window.addEventListener("wheel", onUserScroll, { passive: true });
    window.addEventListener("touchmove", onUserScroll, { passive: true });
    window.addEventListener("keydown", onUserScroll);

    // Re-assert on the next frame too, in case the first layout settles before the
    // observer is wired up, then arm the settle timer.
    requestAnimationFrame(() => {
      if (!cancelled) applyScroll();
    });
    scheduleSettle();

    return () => finish();
  }, [pathname, search, hash, key, navType, state?.refreshKey]);

  return null;
};

export default ScrollToTop;
