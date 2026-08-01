import { useEffect } from "react";
import PreLoader from "../PreLoader/PreLoader";
import "./RouteFallback.css";

/**
 * What <Suspense> shows while a route's chunk downloads.
 *
 * Every page is lazy(), so ANY navigation to a chunk the browser has not cached suspends. The
 * fallback used to be the full-screen brand splash for all of them, which is right exactly once
 * — on a cold start, where the alternative is a blank tab — and wrong every time after. Going
 * from My Orders to an order wiped the page the reader was on and flashed a logo and a tagline
 * at them for a few hundred milliseconds. It looked like the app had restarted, which is also
 * why it seemed to happen "sometimes": a chunk already in cache never suspends at all, so it
 * only struck on the first visit to each page.
 *
 * After the first route has rendered, a suspension is a page CHANGE, not a launch, so it gets a
 * quiet placeholder that keeps the header and the page's own background in place.
 *
 * The flag is module-level rather than state because it has to survive the fallback unmounting
 * — which is the very event that marks the boot as finished.
 */
let hasBooted = false;

export default function RouteFallback() {
  // Read before the effect can change it, so the first fallback renders as the splash.
  const isColdStart = !hasBooted;

  useEffect(() => () => {
    // Unmounting means the chunk arrived and a real page took over. Anything that suspends
    // from here on is a navigation within a running app.
    hasBooted = true;
  }, []);

  if (isColdStart) return <PreLoader />;

  return (
    <div className="bk-route-fallback" role="status" aria-label="Loading">
      <span className="bk-route-fallback-spinner" />
    </div>
  );
}
