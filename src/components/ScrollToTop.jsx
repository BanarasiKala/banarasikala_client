import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { scrollPositions, persistScrollPositions as persist, scrollWindowToTop } from "../utils/scrollRestore";

// Restores scroll position on back/forward (POP) navigation so the user returns
// to exactly where they were, while forward navigation (product click, nav links)
// still starts at the top. The shared store lives in utils/scrollRestore so that
// deferred sections (e.g. the home page) can render eagerly during a restore.
// Routes that must always open at the top, even on back/forward. Restoring a scroll offset
// makes sense for a product grid you were browsing; on a form it drops you into the middle of
// it with the heading — and often the error banner — off screen. The auth page is worse still,
// because Login and Create Account are tabs of ONE route: returning to it restores the offset
// from whichever tab you were last on and applies it to whichever tab now renders.
const ALWAYS_TOP_PATHS = new Set(["/login", "/reset-password", "/verify-email"]);

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

    // An always-top route takes the branch below even on POP — and, just as importantly,
    // skips the restore branch's ResizeObserver, which re-asserts the saved offset for up to
    // four seconds and would otherwise undo the page's own scroll-to-top as its layout settles.
    const saved = navType === "POP" && !ALWAYS_TOP_PATHS.has(pathname)
      ? scrollPositions.get(key)
      : undefined;

    // Forward navigation (or an entry we never recorded): start at the top.
    //
    // Asserted repeatedly over the next few frames rather than once, because a single
    // call here is silently lost in a common case:
    //
    //   window.scrollTo() DOES NOTHING while the body is scroll-locked, and ~27 places
    //   set `document.body.style.overflow = "hidden"` — the mobile menu, the filter and
    //   bottom sheets, the lightbox, the invoice viewer. Every one of them releases the
    //   lock in a PASSIVE effect cleanup, and React runs those AFTER this layout effect
    //   and after the paint. Releasing a lock hands back the offset the browser was
    //   holding, so the new page settled part-way down the screen — leaving a link
    //   tapped from an open sheet opening halfway down the page it went to.
    //
    // Re-asserting lands after the lock has gone. It also catches the page growing as
    // late content arrives. It stops the moment it has taken effect, so in the ordinary
    // case (nothing locked) this costs one extra check on the next frame.
    if (saved == null) {
      suppressRef.current = true;
      persist();
      // Same helper the Auth page's tab switch uses, so "open this at the top" behaves
      // identically whether it was a navigation or a panel swap.
      return scrollWindowToTop({ onDone: () => { suppressRef.current = false; } });
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
    //
    // Until the FIRST layout change, though, we wait the full cap instead. A page whose grid
    // arrives over the network changes nothing at all for the first few hundred milliseconds,
    // so the 350ms timer expired and disconnected the observer while the skeletons were still
    // up — and the re-assert that was supposed to fire when the real cards landed never came.
    // Giving up before the page has been seen to change even once was always premature.
    // Measured against the height at mount rather than a "has the observer fired" flag:
    // ResizeObserver invokes its callback once as soon as observation starts, reporting the
    // CURRENT size, so a flag would be set before anything had actually moved.
    let lastHeight = document.documentElement.scrollHeight;
    let sawLayoutChange = false;
    const scheduleSettle = () => {
      window.clearTimeout(settleTimer);
      const remaining = 4000 - (performance.now() - startTime);
      const quiet = sawLayoutChange ? 350 : remaining;
      settleTimer = window.setTimeout(finish, Math.max(0, Math.min(quiet, remaining)));
    };

    const resizeObserver = new ResizeObserver(() => {
      if (cancelled) return;
      const height = document.documentElement.scrollHeight;
      if (height !== lastHeight) {
        lastHeight = height;
        sawLayoutChange = true;
      }
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
