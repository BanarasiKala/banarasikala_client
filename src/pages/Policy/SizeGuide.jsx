import PolicyPage from "./PolicyPage";

/**
 * Describes what the site actually publishes, not a generic saree size chart. The source of
 * truth is the specification panel on the product page:
 *   client/src/pages/ProductDetail/ProductDetail.jsx — specificationRows
 *   server/src/models/Product.js                     — length, weight, blouse_piece
 * Rows with no recorded value are filtered out there, so this page has to explain absence too.
 */
const sections = [
  {
    heading: "Sarees Are One Size",
    body: [
      "A saree is draped, not fitted, so there is no size to choose. You will not find a size selector anywhere on this site — the only choice a listing asks you to make is colour.",
      "The pleats absorb differences in height and build, which is why the same piece works across a wide range of wearers. What varies between our sarees is length, weight and fabric, and every one of those is published on the product page.",
    ],
  },
  {
    heading: "Where to Find a Saree's Measurements",
    body: [
      "Open any product and scroll to the Material & Specifications panel. It lists, for that exact piece:",
      [
        "SKU — specific to the colour you have selected",
        "Selected Colour",
        "Pattern — the weave, or patterns where a saree carries more than one",
        "Fabric — or fabrics, for a blend",
        "Occasion",
        "Saree Length, in metres",
        "Weight, in grams",
        "Blouse — Included or Not Included",
        "Care instructions",
      ],
      "These are per-product values entered against that individual saree, not category defaults. Two sarees in the same weave can legitimately differ.",
      "A row only appears when we hold a value for it. If Saree Length or Weight is missing from a listing, it means we have not recorded it for that piece rather than that it is zero — ask us and we will measure it.",
    ],
  },
  {
    heading: "Length",
    body: [
      "Length is published in metres on each product page. Most of our sarees are listed at 6.5 metres, which is the standard length for a saree supplied with its blouse piece — roughly 5.5 metres of saree plus the piece at the end.",
      "That 6.5 metres is the full running length of the fabric as it comes off the loom, before your tailor separates the blouse piece.",
      "Because these are handwoven, a variation of a few inches against the published figure is normal and is not a defect.",
    ],
  },
  {
    heading: "Blouse Piece",
    body: [
      "Each listing states plainly whether a blouse piece is Included or Not Included, in the specification panel and again in the highlights near the top of the page. Most of our sarees include one.",
      "Where included, it is unstitched fabric attached to the end of the saree, cut from the same weave so the two match exactly. It is not a ready-made blouse, and we do not offer stitching — your tailor separates and stitches it.",
      "We do not publish a separate blouse-piece length; the figure shown as Saree Length is the whole run of fabric including it. If you need the piece measured on its own before ordering, ask us and we will measure that saree.",
      "Tell your tailor the fabric is handloom silk so it is cut with the grain. If you want long sleeves, a deeper back, or a lining, ask them to check the piece is sufficient before cutting.",
    ],
  },
  {
    heading: "Weight",
    body: [
      "Weight is published in grams for each saree. It is a genuinely useful figure to read before buying: a heavier piece usually means denser zari and a more structured drape, and a lighter one is easier to carry through a long day.",
      "Weight varies between individual pieces of the same design, because the amount of zari worked into a handloom saree is never identical twice.",
    ],
  },
  {
    heading: "What We Do Not Publish",
    body: [
      "We do not currently publish saree width or blouse-piece dimensions on listings. Rather than print a nominal figure that may not hold for a specific piece, we would rather measure the actual saree for you.",
      "Email support@banarasikala.com with the product name or SKU and tell us what you need measured. We will measure that piece and reply, normally within one business day.",
    ],
  },
  {
    heading: "If the Measurements Are Not Right",
    body: [
      "Every delivered order carries a 7-day return and exchange window, so you can check a saree against your own measurements once it arrives.",
      "Size or fit issue is a listed reason on both the return and the exchange flows. An exchange is an even swap for any saree at the same price with stock available, which is the simplest route if the piece itself was not the problem.",
      "Full details are in our Return & Exchange Policy.",
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
