import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../config/api";
import "./MarketplaceBadges.css";

/**
 * The marketplaces a product is listed on, as a row of brand marks for a product card.
 *
 * Drop it into any card with just a product id — there is no per-page wiring, because
 * every mounted badge registers its id in a shared queue that is flushed as one request
 * a tick later. A grid of thirty cards therefore costs one call, not thirty, and the
 * result is cached for the session so navigating back to a grid costs nothing.
 *
 * Renders nothing at all for a product with no links, which is most of the catalogue —
 * so it is safe to place unconditionally in a card's markup.
 */

// A mark is either an Iconify id ("simple-icons:amazon") or an image path ("/image.png") —
// both, because that is what the marketplaces table stores. A slash or dot without a
// colon means it is a file.
const isImageMark = (icon) => Boolean(icon) && /[/.]/.test(icon) && !icon.includes(":");

const cache = new Map(); // productId -> links[]
const waiting = new Map(); // productId -> Set<setState>
let queued = new Set();
let timer = null;

// Matches the server's per-request id cap.
const MAX_IDS = 100;

const flush = async () => {
  timer = null;
  const ids = [...queued];
  queued = new Set();

  for (let i = 0; i < ids.length; i += MAX_IDS) {
    const batch = ids.slice(i, i + MAX_IDS);
    let map = {};
    try {
      const res = await fetch(`${API_ENDPOINTS.marketplaces}/links?productIds=${batch.join(",")}`);
      if (res.ok) map = (await res.json())?.links || {};
    } catch {
      // Badges are decorative next to the product itself: a failure leaves the cards
      // exactly as they were rather than surfacing an error over a row of logos.
    }
    batch.forEach((id) => {
      const links = map[id] || [];
      cache.set(id, links);
      waiting.get(id)?.forEach((notify) => notify(links));
      waiting.delete(id);
    });
  }
};

const subscribe = (id, notify) => {
  if (!waiting.has(id)) waiting.set(id, new Set());
  waiting.get(id).add(notify);
  queued.add(id);
  // A timer rather than a microtask: a grid's cards mount across several frames as
  // images and data settle, and 40ms is long enough to collect them into one request.
  if (!timer) timer = setTimeout(flush, 40);
  return () => waiting.get(id)?.delete(notify);
};

const MarketplaceBadges = ({ productId, className = "" }) => {
  const id = Number(productId);
  const [links, setLinks] = useState(() => cache.get(id) || null);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) return undefined;
    if (cache.has(id)) {
      setLinks(cache.get(id));
      return undefined;
    }
    return subscribe(id, setLinks);
  }, [id]);

  if (!links || links.length === 0) return null;

  return (
    <span className={`bk-mkt-badges ${className}`.trim()}>
      {links.map((link) => (
        /*
         * A button rather than an anchor: these sit inside cards that are themselves a
         * <Link>, and an <a> inside an <a> is invalid markup that browsers recover from
         * by splitting the element. window.open keeps the new-tab behaviour, and the
         * card's own navigation is suppressed so tapping a logo never opens the product.
         */
        <button
          key={link.slug}
          type="button"
          className="bk-mkt-badge-chip"
          title={`Buy on ${link.name}`}
          aria-label={`Buy on ${link.name}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            window.open(link.url, "_blank", "noopener,noreferrer");
          }}
        >
          {isImageMark(link.icon) ? (
            <img src={link.icon} alt="" />
          ) : (
            <Icon icon={link.icon || "lucide:store"} style={{ color: link.accent_color }} />
          )}
        </button>
      ))}
    </span>
  );
};

export default MarketplaceBadges;
