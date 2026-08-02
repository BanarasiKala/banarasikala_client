/**
 * The logo to draw for a marketplace, and how to draw it.
 *
 * A mark is either an Iconify id ("simple-icons:amazon") or an image path ("/image.png") —
 * both, because that is what the marketplaces table stores. A slash or dot without a colon
 * means it is a file.
 */
export const isImageMark = (icon) => Boolean(icon) && /[/.]/.test(icon) && !icon.includes(":");

/**
 * Files in /public that win over whatever the marketplaces row holds, keyed by slug.
 *
 * The Iconify glyphs are single flat shapes, so they read as grey blobs at badge size. The
 * real brand logos are shipped in /public instead.
 *
 * Case matters, and the filenames genuinely differ from each other — "Amazon.PNG" against
 * "flipkart.PNG". The origin this is served from is case-sensitive even though Windows is
 * not, so a tidied-up "/amazon.png" would 404 in production while working perfectly in
 * local dev. Each value below matches its file exactly; check before changing one.
 */
const LOCAL_MARKS = {
  amazon: "/Amazon.PNG",
  flipkart: "/flipkart.PNG",
};

/** The icon to render for a marketplace — the local override if there is one, else the row's. */
export const markFor = (market = {}) => LOCAL_MARKS[market.slug] || market.icon;
