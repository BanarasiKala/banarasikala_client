import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../../config/api";
// The trimmed Amazon mockup, not assets/amazon_phone.PNG: the original is a 198x400
// device floating in a 450x439 canvas, so sizing it alongside the tightly-cropped
// Flipkart shot rendered it about half the size. Trimmed to the device, the two match.
import amazonPhone from "../../../assets/amazon_phone_trimmed.PNG";
import flipkartPhone from "../../../assets/flipkart_phone.PNG";
import "./MarketplacePresence.css";

// Matched to a channel by slug — same convention as the full Marketplace page's
// assets/<slug>_phone.PNG, just static-imported here since only these two exist today.
const PHONE_SHOTS = { amazon: amazonPhone, flipkart: flipkartPhone };

// The mark is either an Iconify id ("simple-icons:amazon") or an image path — both,
// because that is what the marketplaces table already stores.
const isImageMark = (icon) => Boolean(icon) && /[/.]/.test(icon) && !icon.includes(":");

const Mark = ({ market, className }) =>
  isImageMark(market.icon) ? (
    <img src={market.icon} alt="" className={className} />
  ) : (
    <Icon icon={market.icon || "lucide:store"} className={className} style={{ color: market.accent_color }} />
  );

const CHANNEL_FEATURES = {
  amazon: ["Fast & Reliable Delivery", "100% Original Products", "Easy Returns", "Secure Payments"],
  flipkart: ["Quick Delivery", "Genuine Quality", "Hassle-free Returns", "Secure Payments"],
};
const FEATURE_ICONS = ["lucide:truck", "lucide:badge-check", "lucide:refresh-cw", "lucide:shield-check"];
const featuresFor = (slug) =>
  CHANNEL_FEATURES[slug] || ["Fast Delivery", "Genuine Products", "Easy Returns", "Secure Payments"];

const Channel = ({ market }) => (
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

    {market.storefront_url ? (
      <a
        className="bk-mktpres-btn"
        href={market.storefront_url}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
      >
        Shop on {market.name}
        <Icon icon="lucide:arrow-right" />
      </a>
    ) : (
      <span className="bk-mktpres-btn bk-mktpres-btn--muted">Browse {market.name} listings soon</span>
    )}
  </div>
);

const MarketplacePresence = () => {
  const [marketplaces, setMarketplaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    // limit=1 — only the channel list is needed here, not the bestseller rail.
    fetch(`${API_ENDPOINTS.marketplaces}/showcase?limit=1`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setMarketplaces((data?.marketplaces || []).filter((m) => m.status === "live")))
      .catch((err) => {
        if (err.name !== "AbortError") setMarketplaces([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

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
          <div className="bk-mktpres-divider" aria-hidden="true">
            <i /><span>&#9670;</span><i />
          </div>
          <p>
            We are proudly listed on India&apos;s leading marketplaces.
            <br />
            Discover our exclusive Banarasi sarees on {heading}.
          </p>
        </div>

        {loading ? (
          <div className="bk-mktpres-panel bk-mktpres-panel--skeleton" aria-hidden="true">
            <span className="bk-mktpres-sk bk-mktpres-sk-phone" />
            <div className="bk-mktpres-stack">
              {[0, 1].map((i) => (
                <div className="bk-mktpres-channel" key={i}>
                  <span className="bk-mktpres-sk bk-mktpres-sk-title" />
                  <span className="bk-mktpres-sk bk-mktpres-sk-line" />
                  <span className="bk-mktpres-sk bk-mktpres-sk-line" />
                  <span className="bk-mktpres-sk bk-mktpres-sk-btn" />
                </div>
              ))}
            </div>
            <span className="bk-mktpres-sk bk-mktpres-sk-phone" />
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
      </div>
    </section>
  );
};

export default MarketplacePresence;
