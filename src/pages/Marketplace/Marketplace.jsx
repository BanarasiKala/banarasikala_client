import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../config/api";
import { imgUrl } from "../../utils/cloudinary";
import brandBanner from "../../assets/story/banaras-weave.png";
import "./Marketplace.css";

/**
 * Our marketplace listings — every saree we sell on another channel, on one page.
 *
 * There used to be a page per marketplace (/store/amazon, /store/flipkart …). One page
 * instead, because a product listed on two channels was otherwise a card on two separate
 * pages; here it appears once, carrying a badge per marketplace it is on.
 *
 * Everything is data: the products and the badges under each of them come from the
 * marketplaces table, so adding a channel is still just an admin row.
 */

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

// The mark is either an Iconify id ("simple-icons:amazon") or an image path ("/image.png") —
// both, because that is what the footer already had. A slash without a colon means a file.
const isImageMark = (icon) => Boolean(icon) && /[/.]/.test(icon) && !icon.includes(":");

const Mark = ({ market, className }) =>
  isImageMark(market.icon) ? (
    <img src={market.icon} alt="" className={className} />
  ) : (
    <Icon icon={market.icon || "lucide:store"} className={className} style={{ color: market.accent_color }} />
  );

const PAGE_SIZE = 60;

const Marketplace = () => {
  const [data, setData] = useState(null);
  // Products are held apart from `data` because paging appends to them while the
  // channel list stays whatever the first response returned.
  const [products, setProducts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_ENDPOINTS.marketplaces}/showcase?limit=${PAGE_SIZE}`, { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      setData(json);
      setProducts(json.products || []);
      setHasMore(Boolean(json.hasMore));
    } catch (err) {
      if (err?.name === "AbortError") return;
      setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Appends the next page. The offset is the number of cards already held rather than a
  // page counter, so a failed-and-retried request cannot skip or duplicate a row.
  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `${API_ENDPOINTS.marketplaces}/showcase?limit=${PAGE_SIZE}&offset=${products.length}`
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      setProducts((prev) => [...prev, ...(json.products || [])]);
      setHasMore(Boolean(json.hasMore));
    } catch {
      // hasMore is left alone so the button stays and the reader can try again.
    } finally {
      setLoadingMore(false);
    }
  };

  const marketplaces = data?.marketplaces || [];
  const liveChannels = marketplaces.filter((m) => m.status === "live");
  const total = data?.total || 0;
  // "Amazon & Flipkart" in the heading, built from whatever is live.
  const channelNames = liveChannels.map((m) => m.name);
  const heading =
    channelNames.length > 1
      ? `${channelNames.slice(0, -1).join(", ")} & ${channelNames[channelNames.length - 1]}`
      : channelNames[0] || "Marketplaces";

  return (
    <main className="bk-mkt-page">
      {error ? (
        <section className="bk-mkt-empty">
          <Icon icon="lucide:wifi-off" />
          <h1>Could not load this page</h1>
          <p>Check your connection and try again.</p>
          <button type="button" className="bk-mkt-btn" onClick={() => load()}>
            <Icon icon="lucide:rotate-cw" /> Try again
          </button>
        </section>
      ) : (
        <>
          {/* ── Every listing, each badged with the channels it is on ── */}
          <section className="bk-mkt-best">
            {/* The page's h1 now that the hero is gone — it must keep one. */}
            <h1>All Our Marketplace Listings</h1>
            <div className="bk-mkt-divider" aria-hidden="true"><i /><span>◆</span><i /></div>
            {!loading && total > 0 && (
              <p className="bk-mkt-count">Sarees listed on {heading}</p>
            )}

            {loading ? (
              <div className="bk-mkt-grid">
                {Array.from({ length: 10 }).map((_, i) => (
                  <article className="bk-mkt-card bk-mkt-card--skeleton" key={i} aria-hidden="true">
                    <div className="bk-sk bk-mkt-sk-image" />
                    <span className="bk-sk bk-mkt-sk-name" />
                    <span className="bk-sk bk-mkt-sk-name short" />
                    <span className="bk-sk bk-mkt-sk-price" />
                  </article>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bk-mkt-empty">
                <Icon icon="lucide:package-search" />
                <h3>Nothing listed yet</h3>
                <p>We are still adding our sarees to these marketplaces. Everything is available on our own store today.</p>
                <Link to="/collection" className="bk-mkt-btn">Shop the collection</Link>
              </div>
            ) : (
              <>
                <div className="bk-mkt-grid">
                  {products.map((product) => {
                    const mrp = Number(product.mrp_price || 0);
                    const sell = Number(product.selling_price || 0);
                    return (
                      <article className="bk-mkt-card" key={product.id}>
                        <Link to={`/product/${product.slug}`} className="bk-mkt-card-media" aria-label={product.name}>
                          {product.image ? (
                            <img src={imgUrl(product.image, 600)} alt={product.name} loading="lazy" />
                          ) : (
                            <span className="bk-mkt-card-noimg"><Icon icon="lucide:image-off" /></span>
                          )}
                        </Link>
                        <h3>{product.name}</h3>
                        <div className="bk-mkt-card-price">
                          <strong>{formatMoney(sell)}</strong>
                          {mrp > sell && <s>{formatMoney(mrp)}</s>}
                        </div>
                        {/* One badge per marketplace this saree is actually listed on —
                            which is the whole point of a single page: the reader sees at a
                            glance where they can buy it, and each badge is that listing. */}
                        <div className="bk-mkt-card-badges">
                          {product.links.map((link) => (
                            <a
                              key={link.slug}
                              href={link.url}
                              target="_blank"
                              rel="nofollow sponsored noopener noreferrer"
                              className="bk-mkt-badge"
                              title={`Buy on ${link.name}`}
                              aria-label={`Buy ${product.name} on ${link.name}`}
                            >
                              <Mark market={link} className="bk-mkt-badge-mark" />
                            </a>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {hasMore && (
                  <button
                    type="button"
                    className="bk-mkt-btn bk-mkt-more"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Icon icon="lucide:loader-2" className="bk-mkt-spin" /> Loading…
                      </>
                    ) : (
                      <>
                        Show more listings <Icon icon="lucide:chevron-down" />
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}

      {/* ── Brand banner ──
          Deliberately worded away from the home page's copy of this banner, and without
          its button: the reader is already on the page that button leads to. */}
      <section className="bk-mkt-banner" style={{ "--mkt-banner": `url(${brandBanner})` }}>
        <div className="bk-mkt-banner-copy">
          <span className="bk-mkt-banner-kicker">
            <Icon icon="lucide:sparkle" /> Woven in Banaras. Sold everywhere.
          </span>
          <h2>Banarasi Kala</h2>
          <p>Every listing here comes off our own looms — the same weave, whichever channel you shop from.</p>
        </div>
      </section>
    </main>
  );
};

export default Marketplace;
