import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../config/api";
import { imgUrl } from "../../utils/cloudinary";
import brandBanner from "../../assets/story/banaras-weave.png";
import "./Marketplace.css";

/**
 * "Our marketplace presence" — one page for every channel we sell on.
 *
 * There used to be a page per marketplace (/store/amazon, /store/flipkart …). One page
 * instead, because a product listed on two channels was otherwise a card on two separate
 * pages; here it appears once, carrying a badge per marketplace it is on.
 *
 * Everything is data: the channel cards, their feature lists and the badges under each
 * product all come from the marketplaces table, so adding one is still an admin row.
 */

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

/**
 * Phone mockups, matched to a channel by slug — assets/<slug>_phone.PNG.
 *
 * Loaded through import.meta.glob rather than a static import so a channel without a
 * mockup simply renders without one, instead of failing the build. Adding Myntra means
 * dropping myntra_phone.png in beside these two.
 */
const PHONE_SHOTS = import.meta.glob("../../assets/*_phone.{png,PNG,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
});
const phoneFor = (slug) => {
  const hit = Object.entries(PHONE_SHOTS).find(([path]) =>
    path.toLowerCase().includes(`/${slug.toLowerCase()}_phone.`)
  );
  return hit?.[1] || null;
};

// The mark is either an Iconify id ("simple-icons:amazon") or an image path ("/image.png") —
// both, because that is what the footer already had. A slash without a colon means a file.
const isImageMark = (icon) => Boolean(icon) && /[/.]/.test(icon) && !icon.includes(":");

const Mark = ({ market, className }) =>
  isImageMark(market.icon) ? (
    <img src={market.icon} alt="" className={className} />
  ) : (
    <Icon icon={market.icon || "lucide:store"} className={className} style={{ color: market.accent_color }} />
  );

/**
 * The four reassurances under each channel card.
 *
 * Per-channel because the promises differ — Prime is Amazon's, not Flipkart's — and
 * generic for anything added later, so a new marketplace still renders a complete card
 * before anyone writes copy for it.
 */
const CHANNEL_FEATURES = {
  amazon: ["Fast & Reliable Delivery", "100% Original Products", "Easy Returns", "Secure Payments"],
  flipkart: ["Quick Delivery", "Genuine Quality", "Hassle-free Returns", "Secure Payments"],
};
const FEATURE_ICONS = ["lucide:truck", "lucide:badge-check", "lucide:refresh-cw", "lucide:shield-check"];
const featuresFor = (slug) =>
  CHANNEL_FEATURES[slug] || ["Fast Delivery", "Genuine Products", "Easy Returns", "Secure Payments"];

const PAGE_SIZE = 60;

const Marketplace = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const railRef = useRef(null);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_ENDPOINTS.marketplaces}/showcase?limit=${PAGE_SIZE}`, { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData(await res.json());
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

  // Scrolls by one card. Both the card width and the gap are measured off the rail rather
  // than hardcoded, because both scale continuously with the viewport.
  const nudge = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector(".bk-mkt-card");
    if (!card) {
      rail.scrollBy({ left: direction * rail.clientWidth * 0.8, behavior: "smooth" });
      return;
    }
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    rail.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
  };

  const marketplaces = data?.marketplaces || [];
  const liveChannels = marketplaces.filter((m) => m.status === "live");
  const products = data?.products || [];
  // "Amazon & Flipkart" in the heading, built from whatever is live.
  const channelNames = liveChannels.map((m) => m.name);
  const heading =
    channelNames.length > 1
      ? `${channelNames.slice(0, -1).join(", ")} & ${channelNames[channelNames.length - 1]}`
      : channelNames[0] || "Marketplaces";

  return (
    <main className="bk-mkt-page">
      {/* ── Hero ── */}
      <section className="bk-mkt-hero">
        <span className="bk-mkt-eyebrow">Our Marketplace Presence</span>
        <h1>
          Shop Banarasi Kala on
          <em>{heading}</em>
        </h1>
        <div className="bk-mkt-divider" aria-hidden="true"><i /><span>◆</span><i /></div>
        <p className="bk-mkt-sub">
          We are proudly listed on India&apos;s leading marketplaces.
          <br />
          Discover our exclusive Banarasi sarees on {heading}.
        </p>
      </section>

      {error ? (
        <section className="bk-mkt-empty">
          <Icon icon="lucide:wifi-off" />
          <h2>Could not load this page</h2>
          <p>Check your connection and try again.</p>
          <button type="button" className="bk-mkt-btn" onClick={() => load()}>
            <Icon icon="lucide:rotate-cw" /> Try again
          </button>
        </section>
      ) : (
        <>
          {/* ── One card per channel ── */}
          <section className="bk-mkt-channels">
            {(loading ? [{ id: "s1" }, { id: "s2" }] : marketplaces).map((market) =>
              loading ? (
                <article className="bk-mkt-channel bk-mkt-channel--skeleton" key={market.id} aria-hidden="true">
                  <span className="bk-sk bk-mkt-sk-logo" />
                  <span className="bk-sk bk-mkt-sk-title" />
                  <span className="bk-sk bk-mkt-sk-line" />
                  <span className="bk-sk bk-mkt-sk-line" />
                  <span className="bk-sk bk-mkt-sk-line" />
                  <span className="bk-sk bk-mkt-sk-btn" />
                </article>
              ) : (
                <article
                  className={`bk-mkt-channel${market.status === "coming_soon" ? " is-soon" : ""}`}
                  key={market.slug}
                  id={market.slug}
                  style={{ "--mkt-accent": market.accent_color || "#800020" }}
                >
                  <div className="bk-mkt-channel-body">
                    <header className="bk-mkt-channel-head">
                      <span className="bk-mkt-channel-logo">
                        <Mark market={market} className="bk-mkt-channel-mark" />
                      </span>
                      <span className="bk-mkt-channel-title">
                        <small>{market.status === "coming_soon" ? "Coming soon to" : "Available on"}</small>
                        <strong>{market.name}</strong>
                      </span>
                    </header>

                    <ul className="bk-mkt-features">
                      {featuresFor(market.slug).map((feature, i) => (
                        <li key={feature}>
                          <Icon icon={FEATURE_ICONS[i % FEATURE_ICONS.length]} />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Only where there is a real storefront to send people to. A button
                        landing on a marketplace's generic homepage is worse than none. */}
                    {market.status === "live" && market.storefront_url ? (
                      <a
                        className="bk-mkt-btn bk-mkt-btn--solid"
                        href={market.storefront_url}
                        target="_blank"
                        rel="nofollow sponsored noopener noreferrer"
                      >
                        Shop on {market.name}
                        <Icon icon="lucide:arrow-right" />
                      </a>
                    ) : (
                      <span className="bk-mkt-btn bk-mkt-btn--muted">
                        {market.status === "coming_soon" ? "Launching soon" : `Browse ${market.name} listings below`}
                      </span>
                    )}
                  </div>

                  {/* Renders only when assets/<slug>_phone.PNG exists, so a channel
                      without artwork keeps a complete card. */}
                  {phoneFor(market.slug) && (
                    <div className="bk-mkt-phone" aria-hidden="true">
                      <img src={phoneFor(market.slug)} alt="" loading="lazy" />
                    </div>
                  )}
                </article>
              )
            )}
          </section>

          {/* ── Products, each badged with the channels it is on ── */}
          <section className="bk-mkt-best">
            <h2>Our Bestsellers on Marketplaces</h2>
            <div className="bk-mkt-divider" aria-hidden="true"><i /><span>◆</span><i /></div>

            {loading ? (
              <div className="bk-mkt-rail">
                {Array.from({ length: 4 }).map((_, i) => (
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
              <div className="bk-mkt-rail-wrap">
                <button type="button" className="bk-mkt-arrow" onClick={() => nudge(-1)} aria-label="Previous products">
                  <Icon icon="lucide:arrow-left" />
                </button>

                <div className="bk-mkt-rail" ref={railRef}>
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

                <button type="button" className="bk-mkt-arrow" onClick={() => nudge(1)} aria-label="Next products">
                  <Icon icon="lucide:arrow-right" />
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Brand banner ── */}
      <section className="bk-mkt-banner" style={{ "--mkt-banner": `url(${brandBanner})` }}>
        <div className="bk-mkt-banner-copy">
          <span className="bk-mkt-banner-kicker">
            <Icon icon="lucide:sparkle" /> One Brand. Everywhere.
          </span>
          <h2>Banarasi Kala</h2>
          <p>Trusted quality. Loved by thousands.</p>
          <Link to="/collection" className="bk-mkt-btn bk-mkt-btn--gold">
            Explore All Products
            <Icon icon="lucide:arrow-right" />
          </Link>
        </div>
      </section>
    </main>
  );
};

export default Marketplace;
