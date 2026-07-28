import PolicyPage from "./PolicyPage";

/**
 * Describes what the site actually publishes — the specification panel on the product page
 * (ProductDetail.jsx, specificationRows) reading Product.length / weight / blouse_piece. Rows
 * with no recorded value are filtered out there, so this page has to explain absence too.
 */
const sections = [
  {
    heading: "Sarees Are One Size",
    body: [
      "A saree is draped, not fitted, so there is no size to choose — you will not find a size selector anywhere on this site. The only choice a listing asks for is colour, and the pleats absorb differences in height and build.",
      "What varies between our sarees is length, weight and fabric, and all three are published on every listing.",
    ],
  },
  {
    heading: "Where to Find a Saree's Measurements",
    body: [
      "Open any product and scroll to the Material & Specifications panel. For that exact piece it lists the SKU and colour, pattern and fabric, occasion, saree length in metres, weight in grams, whether a blouse piece is included, and care instructions.",
      "These are per-product values, not category defaults — two sarees in the same weave can legitimately differ. A row only appears when we hold a value for it, so a missing length or weight means we have not recorded it for that piece rather than that it is zero. Ask us and we will measure it.",
    ],
  },
  {
    heading: "Length and Weight",
    body: [
      "Length is published in metres. Most of our sarees are listed at 6.5 metres, the standard length for a saree supplied with its blouse piece — roughly 5.5 metres of saree plus the piece at the end, as one run of fabric before your tailor separates it.",
      "Weight is published in grams and is worth reading: a heavier piece usually means denser zari and a more structured drape, a lighter one is easier to wear all day. Both vary by a few inches or grams between individual pieces, because each one is cut and finished separately.",
    ],
  },
  {
    heading: "Blouse Piece",
    body: [
      "Each listing states plainly whether a blouse piece is Included or Not Included. Where included, it is unstitched fabric attached to the end of the saree, cut from the same weave — not a ready-made blouse, and we do not offer stitching.",
      "We do not publish a separate blouse-piece length; the figure shown as Saree Length covers the whole run of fabric including it. Tell your tailor it is Banarasi silk so it is cut with the grain, and ask them to check the piece is sufficient before cutting if you want long sleeves or a lining.",
    ],
  },
  {
    heading: "What We Do Not Publish, and What If It Is Wrong",
    body: [
      "We do not publish saree width or blouse-piece dimensions. Rather than print a nominal figure that may not hold for a specific piece, we would rather measure the actual saree — email support@banarasikala.com with the product name or SKU.",
      "Every delivered order carries a 7-day return and exchange window, so you can check a saree against your own measurements once it arrives. Size or fit issue is a listed reason on both flows, and an exchange is an even swap for any saree at the same price. See our Return & Exchange Policy.",
    ],
  },
];

const SizeGuide = () => (
  <PolicyPage
    title="Size Guide"
    subtitle="Sarees are one size. What varies is length, weight and fabric — all published on every listing."
    sections={sections}
    downloadable
  />
);

export default SizeGuide;
