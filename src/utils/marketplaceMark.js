/**
 * The logo to draw for a marketplace, and how to draw it.
 *
 * A mark is either an Iconify id ("simple-icons:amazon") or an image path ("/image.webp") —
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
 * These point at the *-mark.png files, NOT the Amazon.webp / flipkart.webp they were cut from.
 * Those originals are 1024x1024 with the logo floating in the middle — Amazon's filled only
 * 34% of its canvas against Flipkart's 86%, so at badge size, where object-fit fits the
 * whitespace rather than the artwork, Amazon rendered about two and a half times smaller.
 *
 * The marks here are cropped to the logo's exact bounds and kept at their natural aspect
 * ratio — no square canvas, no margin. The badge tile is what frames them, so any padding
 * baked in here would show up as a gap the CSS cannot remove. They are also ~40 KB rather
 * than ~1.2 MB each.
 *
 * Re-cutting one means cropping it just as tightly, or it will sit smaller than the other.
 */
const LOCAL_MARKS = {
  amazon: "/amazon-mark.webp",
  flipkart: "/flipkart-mark.webp",
};

/** The icon to render for a marketplace — the local override if there is one, else the row's. */
export const markFor = (market = {}) => LOCAL_MARKS[market.slug] || market.icon;
