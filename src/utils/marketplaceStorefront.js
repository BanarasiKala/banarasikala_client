/**
 * Where a marketplace badge sends people, resolved in three steps: environment override,
 * then the built-in deep link, then the storefront_url on the marketplaces row.
 *
 * Shared so the footer and the home page's marketplace section cannot drift apart — one of
 * them linking to our brand-filtered Amazon listing while the other went to amazon.in was
 * exactly the kind of split this avoids.
 *
 * The env vars are read directly rather than through requiredEnv because they are optional:
 * a missing one has to fall through to the next step instead of throwing and taking the
 * surrounding UI down with it.
 *
 * The built-in links sit in FRONT of the database because the marketplaces row still holds
 * the generic amazon.in homepage, and a badge landing there is worse than none. The row is
 * still the last resort, which keeps a channel added later working before anyone sets an
 * env var for it.
 */
const STOREFRONT_ENV = {
  amazon: import.meta.env.VITE_AMAZON_STORE_URL,
  flipkart: import.meta.env.VITE_FLIPKART_STORE_URL,
};

const STOREFRONT_FALLBACKS = {
  amazon: "https://www.amazon.in/s?rh=n%3A1571271031%2Cp_4%3ABanarasi%2BKala&ref=bl_sl_s_ap_web_1571271031",
  flipkart: "https://dl.flipkart.com/s/XaTOd_NNNN",
};

export const storefrontFor = (market) =>
  String(STOREFRONT_ENV[market?.slug] || "").trim() ||
  STOREFRONT_FALLBACKS[market?.slug] ||
  market?.storefront_url ||
  "";

// Only a live channel with somewhere real to go leaves the site. A "coming soon" badge keeps
// pointing at our own /marketplace page, which is where its announcement lives.
export const canLeaveForStorefront = (market) =>
  market?.status === "live" && Boolean(storefrontFor(market));

// Attributes every outbound marketplace link carries: a new tab, and rel flags marking it as
// an untrusted commercial destination.
export const STOREFRONT_LINK_PROPS = {
  target: "_blank",
  rel: "nofollow sponsored noopener noreferrer",
};
