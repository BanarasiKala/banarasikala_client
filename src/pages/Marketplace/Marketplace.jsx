import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../config/api";
import { imgUrl } from "../../utils/cloudinary";
import "./Marketplace.css";

/**
 * "Banarasi Kala on <marketplace>" — one page per channel, all from one route.
 *
 * /store/amazon, /store/flipkart and /store/myntra are this component with different
 * data. Adding a channel is a row in the admin, not another page: see the marketplaces
 * table. A slug that is unknown or retired renders the not-found state.
 */

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

// The mark is either an Iconify id ("simple-icons:amazon") or an image path ("/image.png").
// Both, because that is what the footer already had — Amazon and Flipkart have Iconify
// marks and Myntra does not — and a slash is the thing that tells them apart.
const isImageMark = (icon) => Boolean(icon) && /[/.]/.test(icon) && !icon.includes(":");

const MarketplaceMark = ({ marketplace, className }) =>
  isImageMark(marketplace.icon) ? (
    <img src={marketplace.icon} alt="" className={className} />
  ) : (
    <Icon icon={marketplace.icon || "lucide:store"} className={className} style={{ color: marketplace.accent_color }} />
  );

const PAGE_SIZE = 60;

const Marketplace = () => {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    try {
      const res = await fetch(`${API_ENDPOINTS.marketplaces}/${slug}?limit=${PAGE_SIZE}`, { signal });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData(await res.json());
    } catch (err) {
      if (err?.name === "AbortError") return;
      setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const loadMore = async () => {
    if (!data?.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `${API_ENDPOINTS.marketplaces}/${slug}?limit=${PAGE_SIZE}&offset=${data.products.length}`
      );
      if (!res.ok) throw new Error();
      const next = await res.json();
      setData((current) => ({ ...next, products: [...current.products, ...next.products] }));
    } catch {
      // Silent: the products already on screen are unaffected, and the button stays
      // there to try again. An error banner for a failed "show more" reads as though
      // the whole page broke.
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <main className="bk-market-page" aria-busy="true">
        <section className="bk-market-hero bk-market-hero--skeleton">
          <span className="bk-sk bk-market-sk-mark" />
          <span className="bk-sk bk-market-sk-title" />
          <span className="bk-sk bk-market-sk-line" />
        </section>
        <div className="bk-market-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <article className="bk-market-card bk-market-card--skeleton" key={i} aria-hidden="true">
              <div className="bk-sk bk-market-sk-image" />
              <div className="bk-market-card-body">
                <span className="bk-sk bk-market-sk-name" />
                <span className="bk-sk bk-market-sk-name short" />
                <span className="bk-sk bk-market-sk-price" />
                <span className="bk-sk bk-market-sk-btn" />
              </div>
            </article>
          ))}
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="bk-market-page">
        <section className="bk-market-empty">
          <Icon icon="lucide:store" />
          <h1>We are not on that marketplace</h1>
          <p>Check the address, or browse everything on our own store.</p>
          <Link to="/collection" className="bk-market-btn">Shop the collection</Link>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="bk-market-page">
        <section className="bk-market-empty">
          <Icon icon="lucide:wifi-off" />
          <h1>Could not load this page</h1>
          <p>Check your connection and try again.</p>
          <button type="button" className="bk-market-btn" onClick={() => load()}>
            <Icon icon="lucide:rotate-cw" /> Try again
          </button>
        </section>
      </main>
    );
  }

  const { marketplace, products, hasMore } = data;
  const accent = marketplace.accent_color || "#800020";
  const isComingSoon = marketplace.status === "coming_soon";

  return (
    <main className="bk-market-page" style={{ "--market-accent": accent }}>
      <section className="bk-market-hero">
        <span className="bk-market-hero-mark">
          <MarketplaceMark marketplace={marketplace} className="bk-market-hero-icon" />
        </span>
        <h1>Banarasi Kala on {marketplace.name}</h1>
        {marketplace.tagline && <p className="bk-market-hero-tagline">{marketplace.tagline}</p>}

        {/* Only where there is a real storefront to send people to. The shop has one on
            Amazon and not on Flipkart, and a button that landed on a marketplace's generic
            homepage would be worse than no button at all. */}
        {!isComingSoon && marketplace.storefront_url && (
          <div className="bk-market-storefront">
            {marketplace.storefront_note && <p>{marketplace.storefront_note}</p>}
            <a
              className="bk-market-btn bk-market-btn--solid"
              href={marketplace.storefront_url}
              target="_blank"
              // nofollow + sponsored because these are commercial outbound links;
              // noopener because target="_blank" otherwise hands the opened tab a
              // handle back onto this window.
              rel="nofollow sponsored noopener noreferrer"
            >
              See all our products on {marketplace.name}
              <Icon icon="lucide:external-link" />
            </a>
          </div>
        )}
      </section>

      {isComingSoon ? (
        <section className="bk-market-soon">
          <span className="bk-market-soon-badge">Coming soon</span>
          <h2>We are opening on {marketplace.name}</h2>
          <p>
            Our handwoven Banarasi sarees are on their way to {marketplace.name}. Until then,
            you can buy the full collection on our own store — or find us on the marketplaces
            we are already on.
          </p>
          <div className="bk-market-soon-actions">
            <Link to="/collection" className="bk-market-btn bk-market-btn--solid">Shop the collection</Link>
            <Link to="/" className="bk-market-btn">Back to home</Link>
          </div>
        </section>
      ) : products.length === 0 ? (
        <section className="bk-market-empty">
          <Icon icon="lucide:package-search" />
          <h2>Nothing listed here yet</h2>
          <p>We are still adding our sarees to {marketplace.name}. Everything is available on our own store today.</p>
          <Link to="/collection" className="bk-market-btn">Shop the collection</Link>
        </section>
      ) : (
        <>
          <div className="bk-market-count">
            {data.total} {data.total === 1 ? "saree" : "sarees"} available on {marketplace.name}
          </div>

          <div className="bk-market-grid">
            {products.map((product) => {
              const mrp = Number(product.mrp_price || 0);
              const sell = Number(product.selling_price || 0);
              const hasDiscount = mrp > sell && sell > 0;
              return (
                /* The whole card is the outbound link: on a marketplace page the only
                   thing a card can do is take you to that listing, so making just the
                   button clickable would leave most of the card dead to the touch. */
                <a
                  key={product.id}
                  className="bk-market-card"
                  href={product.url}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                >
                  <div className="bk-market-card-image">
                    {product.image ? (
                      <img src={imgUrl(product.image, 600)} alt={product.name} loading="lazy" />
                    ) : (
                      <span className="bk-market-card-noimg"><Icon icon="lucide:image-off" /></span>
                    )}
                  </div>
                  <div className="bk-market-card-body">
                    <h3>{product.name}</h3>
                    <div className="bk-market-card-price">
                      <strong>{formatMoney(sell)}</strong>
                      {hasDiscount && <s>{formatMoney(mrp)}</s>}
                    </div>
                    {/* Prices are ours; the marketplace sets its own. Saying so once per
                        card is what stops this reading as a promise. */}
                    <span className="bk-market-card-note">Price on {marketplace.name} may differ</span>
                    <span className="bk-market-card-cta">
                      View on {marketplace.name}
                      <Icon icon="lucide:external-link" />
                    </span>
                  </div>
                </a>
              );
            })}
          </div>

          {hasMore && (
            <div className="bk-market-more">
              <button type="button" className="bk-market-btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Show more"}
              </button>
            </div>
          )}
        </>
      )}

      <section className="bk-market-foot">
        <p>
          Buying direct from us gets you the same saree with our own delivery, returns and support.
        </p>
        <Link to="/collection" className="bk-market-btn bk-market-btn--ghost">Shop on banarasikala.com</Link>
      </section>
    </main>
  );
};

export default Marketplace;
