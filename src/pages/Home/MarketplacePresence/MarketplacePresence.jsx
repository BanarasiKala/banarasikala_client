import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../../config/api";
import { imgUrl } from "../../../utils/cloudinary";
import { getProductCoverImage } from "../../../utils/productMedia";
import { storefrontFor } from "../../../utils/marketplaceStorefront";
import { isImageMark, markFor } from "../../../utils/marketplaceMark";
import brandBanner from "../../../assets/story/banaras-weave.webp";
// The trimmed Amazon mockup, not assets/amazon_phone.webp: the original is a 198x400
// device floating in a 450x439 canvas, so sizing it alongside the tightly-cropped
// Flipkart shot rendered it about half the size. Trimmed to the device, the two match.
import amazonPhone from "../../../assets/amazon_phone_trimmed.webp";
import flipkartPhone from "../../../assets/flipkart_phone.webp";
import "./MarketplacePresence.css";

// Matched to a channel by slug — same convention as the full Marketplace page's
// assets/<slug>_phone.PNG, just static-imported here since only these two exist today.
const PHONE_SHOTS = { amazon: amazonPhone, flipkart: flipkartPhone };

const Mark = ({ market, className }) => {
  const icon = markFor(market);
  return isImageMark(icon) ? (
    <img src={icon} alt="" className={className} />
  ) : (
    <Icon icon={icon || "lucide:store"} className={className} style={{ color: market.accent_color }} />
  );
};

/**
 * Where each channel's button sends people, resolved in three steps:
 * environment override, then the built-in link, then the marketplaces row.
 *
 * The env vars are read directly rather than through requiredEnv because they are
 * optional — a missing one has to fall through to the next step instead of
 * throwing and taking the whole section down with it.
 *
 * The built-in links are the deep links to our own storefront on each channel. They
 * sit in front of the database because the marketplaces row still holds the generic
 * amazon.in homepage, and a button landing there is worse than no button at all. The
 * row is still the last resort, which is what keeps a channel added later working
 * before anyone sets an env var for it.
 */
// Moved to utils/marketplaceStorefront so the footer resolves the same link this does —
// see that file for why env wins over the built-in link, and the built-in over the row.

const CHANNEL_FEATURES = {
  amazon: ["Fast & Reliable Delivery", "100% Original Products", "Easy Returns", "Secure Payments"],
  flipkart: ["Quick Delivery", "Genuine Quality", "Hassle-free Returns", "Secure Payments"],
};
const FEATURE_ICONS = ["lucide:truck", "lucide:badge-check", "lucide:refresh-cw", "lucide:shield-check"];
const featuresFor = (slug) =>
  CHANNEL_FEATURES[slug] || ["Fast Delivery", "Genuine Products", "Easy Returns", "Secure Payments"];

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

// Enough to fill the rail and give it something to scroll, without pulling the full
// /marketplace catalogue into the home page payload.
const RAIL_LIMIT = 12;

const Channel = ({ market }) => {
  const storefront = storefrontFor(market);

  return (
  <div className="bk-mktpres-channel" style={{ "--mktpres-accent": market.accent_color || "#800020" }}>
    <header className="bk-mktpres-channel-head">
      <span className="bk-mktpres-channel-logo">
        <Mark market={market} className="bk-mktpres-channel-mark" />
      </span>
      <span className="bk-mktpres-channel-title">
        <small>Available on</small>
        <strong>{market.name}</strong>
      </span>
    </header>

    <ul className="bk-mktpres-features">
      {featuresFor(market.slug).map((feature, i) => (
        <li key={feature}>
          <Icon icon={FEATURE_ICONS[i % FEATURE_ICONS.length]} />
          {feature}
        </li>
      ))}
    </ul>

    {storefront ? (
      <a
        className="bk-mktpres-btn"
        href={storefront}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
      >
        Shop on {market.name}
        <Icon icon="lucide:arrow-right" />
      </a>
    ) : (
      // Kept short deliberately: a longer label wraps to two lines in the centre
      // column on a phone, which pushes the stack taller than the mockups.
      <span className="bk-mktpres-btn bk-mktpres-btn--muted">Listings coming soon</span>
    )}
  </div>
  );
};

const MarketplacePresence = () => {
  const [marketplaces, setMarketplaces] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const railRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_ENDPOINTS.marketplaces}/showcase?limit=${RAIL_LIMIT}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setMarketplaces((data?.marketplaces || []).filter((m) => m.status === "live"));
        setProducts(data?.products || []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setMarketplaces([]);
          setProducts([]);
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  // Scrolls by exactly one card. Both the card width and the gap are measured off the
  // rail rather than hardcoded, because both scale continuously with the viewport.
  const nudge = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector(".bk-mktpres-card");
    if (!card) return;
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    rail.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
  };

  const channelNames = marketplaces.map((m) => m.name);
  const heading =
    channelNames.length > 1
      ? `${channelNames.slice(0, -1).join(", ")} & ${channelNames[channelNames.length - 1]}`
      : channelNames[0] || "Marketplaces";

  // Nothing live and nothing loading: no empty panel on the home page.
  if (!loading && marketplaces.length === 0) return null;

  // The mockups flank the whole panel rather than belonging to a row, so they are
  // picked by position: first channel on the left, second on the right.
  const withPhones = marketplaces.filter((m) => PHONE_SHOTS[m.slug]);
  const leftPhone = withPhones[0];
  const rightPhone = withPhones[1];

  return (
    <section className="bk-mktpres-section">
      <div className="bk-mktpres-shell">
        <div className="bk-mktpres-heading">
          <span>Our Marketplace Presence</span>
          <h2>
            Shop Banarasi Kala on <em>{heading}</em>
          </h2>
          <p>
            We are proudly listed on India&apos;s leading marketplaces.
            <br />
            Discover our exclusive Banarasi sarees on {heading}.
          </p>
        </div>

        {loading ? (
          /* The placeholder reuses the real panel's own wrappers — .bk-mktpres-phone--left /
             --right and .bk-mktpres-stack — rather than standing bare spans in the grid.
             Those wrappers carry the explicit grid-column assignments; without them the
             row-spanning phones fell to auto-placement, landed in the wrong columns and blew
             the panel out to 936px against the real 585px. Sharing the wrappers means the two
             states cannot drift apart again.
             Four feature lines, not two, because that is what a Channel actually renders. */
          <div className="bk-mktpres-panel bk-mktpres-panel--skeleton" aria-hidden="true">
            <div className="bk-mktpres-phone bk-mktpres-phone--left">
              <span className="bk-mktpres-sk bk-mktpres-sk-phone" />
            </div>
            <div className="bk-mktpres-stack">
              {[0, 1].map((i) => (
                <div className="bk-mktpres-channel" key={i}>
                  <span className="bk-mktpres-sk bk-mktpres-sk-title" />
                  <span className="bk-mktpres-sk bk-mktpres-sk-line" />
                  <span className="bk-mktpres-sk bk-mktpres-sk-line" />
                  <span className="bk-mktpres-sk bk-mktpres-sk-line" />
                  <span className="bk-mktpres-sk bk-mktpres-sk-line" />
                  <span className="bk-mktpres-sk bk-mktpres-sk-btn" />
                </div>
              ))}
            </div>
            <div className="bk-mktpres-phone bk-mktpres-phone--right">
              <span className="bk-mktpres-sk bk-mktpres-sk-phone" />
            </div>
          </div>
        ) : (
          <div className="bk-mktpres-panel">
            {leftPhone && (
              <div className="bk-mktpres-phone bk-mktpres-phone--left" aria-hidden="true">
                <img src={PHONE_SHOTS[leftPhone.slug]} alt="" loading="lazy" />
              </div>
            )}

            <div className="bk-mktpres-stack">
              {marketplaces.map((market) => (
                <Channel market={market} key={market.slug} />
              ))}
            </div>

            {rightPhone && (
              <div className="bk-mktpres-phone bk-mktpres-phone--right" aria-hidden="true">
                <img src={PHONE_SHOTS[rightPhone.slug]} alt="" loading="lazy" />
              </div>
            )}
          </div>
        )}

        {/* The rail had no placeholder at all, so a 474px block of product cards appeared
            out of nothing once the request landed and shoved the brand banner down the page.
            Four cards is what fits the rail before it scrolls. */}
        {loading && (
          <div className="bk-mktpres-best bk-mktpres-best--skeleton" aria-hidden="true">
            <span className="bk-mktpres-sk bk-mktpres-sk-railhead" />
            <div className="bk-mktpres-rail">
              {[0, 1, 2, 3].map((i) => (
                <article className="bk-mktpres-card" key={i}>
                  <span className="bk-mktpres-sk bk-mktpres-sk-cardmedia" />
                  <span className="bk-mktpres-sk bk-mktpres-sk-cardline" />
                  <span className="bk-mktpres-sk bk-mktpres-sk-cardprice" />
                </article>
              ))}
            </div>
          </div>
        )}

        {/* ── Bestsellers, each badged with the channels it is on ── */}
        {!loading && products.length > 0 && (
          <div className="bk-mktpres-best">
            <h3>Our Bestsellers on Marketplaces</h3>

            <div className="bk-mktpres-rail-wrap">
              <button
                type="button"
                className="bk-mktpres-arrow"
                onClick={() => nudge(-1)}
                aria-label="Previous products"
              >
                <Icon icon="lucide:arrow-left" />
              </button>

              <div className="bk-mktpres-rail" ref={railRef}>
                {products.map((product) => {
                  const mrp = Number(product.mrp_price || 0);
                  const sell = Number(product.selling_price || 0);
                  // Read off the images array via the shared helper, not a flat `image` field:
                  // /showcase returns the same product shape every other card on the site gets.
                  const cover = getProductCoverImage(product);
                  return (
                    <article className="bk-mktpres-card" key={product.id}>
                      <Link
                        to={`/product/${product.slug}`}
                        className="bk-mktpres-card-media"
                        aria-label={product.name}
                      >
                        {cover ? (
                          <img src={imgUrl(cover, 600)} alt={product.name} loading="lazy" />
                        ) : (
                          <span className="bk-mktpres-card-noimg">
                            <Icon icon="lucide:image-off" />
                          </span>
                        )}
                      </Link>
                      <h4>{product.name}</h4>
                      <div className="bk-mktpres-card-price">
                        <strong>{formatMoney(sell)}</strong>
                        {mrp > sell && <s>{formatMoney(mrp)}</s>}
                      </div>
                      {/* One tile per marketplace this saree is actually listed on, so the
                          reader sees at a glance where they can buy it. */}
                      <div className="bk-mktpres-card-badges">
                        {(product.links || []).map((link) => (
                          <a
                            key={link.slug}
                            href={link.url}
                            target="_blank"
                            rel="nofollow sponsored noopener noreferrer"
                            className="bk-mktpres-badge"
                            title={`Buy on ${link.name}`}
                            aria-label={`Buy ${product.name} on ${link.name}`}
                          >
                            <Mark market={link} className="bk-mktpres-badge-mark" />
                          </a>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>

              <button
                type="button"
                className="bk-mktpres-arrow"
                onClick={() => nudge(1)}
                aria-label="Next products"
              >
                <Icon icon="lucide:arrow-right" />
              </button>
            </div>
          </div>
        )}

        {/* ── Brand banner ── */}
        <div className="bk-mktpres-banner" style={{ "--mktpres-banner": `url(${brandBanner})` }}>
          <div className="bk-mktpres-banner-copy">
            <span className="bk-mktpres-banner-kicker">
              <Icon icon="lucide:sparkle" /> One Brand. Everywhere.
            </span>
            <h3>
              Banarasi <em>Kala</em>
            </h3>
            <p>Trusted quality. Loved by thousands.</p>
            {/* /marketplace, not /collection: this banner sits under the marketplace
                rail, so "all products" means every saree listed on a channel. */}
            <Link to="/marketplace" className="bk-mktpres-banner-btn">
              Explore All Products
              <Icon icon="lucide:arrow-right" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketplacePresence;
