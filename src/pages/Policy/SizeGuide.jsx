import PolicyPage from "./PolicyPage";

const sections = [
  {
    heading: "Standard Saree Measurements",
    body: [
      "Unless a listing states otherwise, our sarees follow these measurements:",
      [
        "Saree length: 5.5 metres (approximately 6.3 yards)",
        "Saree width: 44–47 inches",
        "Blouse piece: 0.8 metres, unstitched, attached to the saree",
        "Total length with blouse piece: 6.3 metres",
      ],
      "Hand weaving means a variation of up to two inches in either direction is normal.",
    ],
  },
  {
    heading: "Sarees Are One Size",
    body: [
      "A saree is draped rather than fitted, so it does not carry a size. The standard 5.5 metre length suits most heights and drape styles, and the pleats absorb the difference.",
      "If you are above 5'8\" or prefer a longer pallu, look for pieces listed at 6.3 metres without the blouse piece — the extra length gives more room across the shoulder.",
    ],
  },
  {
    heading: "Blouse Piece and Stitching",
    body: [
      "The blouse piece supplied is unstitched fabric, not a ready blouse. It is cut from the same weave as the saree so the two match exactly.",
      "0.8 metres is enough for a standard short-sleeved blouse. For longer sleeves, a deeper back, or a padded lining, your tailor may need additional fabric — tell them the piece is handloom silk so it is cut with the grain.",
    ],
  },
  {
    heading: "Taking Your Blouse Measurements",
    body: [
      "Measure over a well-fitting garment, keeping the tape snug but not tight. Your tailor will normally want:",
      [
        "Bust — around the fullest part",
        "Waist — at the narrowest point above the navel",
        "Shoulder — across the back, from one shoulder point to the other",
        "Sleeve length — from the shoulder point to where the sleeve should end",
        "Blouse length — from the shoulder point to the desired hem",
        "Armhole — around the arm, close to the underarm",
      ],
    ],
  },
  {
    heading: "Still Unsure?",
    body: [
      "If you need the exact measurements of a specific saree before ordering, email support@banarasikala.com with the product name and we will measure that piece for you.",
      "Measurement queries are usually answered within one business day.",
    ],
  },
];

const SizeGuide = () => (
  <PolicyPage
    title="Size Guide"
    subtitle="Lengths, widths and blouse measurements for every Banarasi Kala saree."
    sections={sections}
  />
);

export default SizeGuide;
