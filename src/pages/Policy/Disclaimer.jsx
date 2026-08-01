import PolicyPage from "./PolicyPage";

/**
 * Grounded in how the site presents products: specificationRows drops empty values, stock is
 * tracked per colour in color_stocks, and OrderController reserves the right to cancel and
 * refund in full.
 */
const sections = [
  {
    heading: "Variation Between Pieces",
    body: [
      "Our sarees are woven on powerlooms in Varanasi, which keeps the weave even and the finish consistent from piece to piece. Some variation remains and is normal: zari catches the light differently across a roll, motif alignment shifts slightly where a design repeats, finished length and weight move by a few inches or grams, and dye lots differ a little between batches. Loose threads on the reverse are trimmed, not woven flaws.",
      "None of the above is a defect. A genuine fault is different: damage, a manufacturing defect or the wrong item are listed return reasons, with 7 days from delivery to raise one.",
    ],
  },
  {
    heading: "Colour and Images",
    body: [
      "We photograph in natural light and edit as little as possible, but colour depends on your screen and the light you view it in. Minor difference is expected; a substantial mismatch is not — tell us and we will put it right.",
      "Each colour has its own photographs. What you see when a colour is selected is that colour, not a recoloured version of another.",
    ],
  },
  {
    heading: "Product Information and Availability",
    body: [
      "Length, weight, fabric, pattern and whether a blouse piece is included are published per saree and are as accurate as we can state them. Expect small variation given hand weaving. Where a specification is not shown, we have not recorded it for that piece — ask and we will measure it.",
      "Stock is tracked per colour, so a saree can be available in one colour and sold out in another, and a colour can sell out between adding it to your cart and checking out. Where that happens we contact you and refund in full rather than substituting anything.",
    ],
  },
  {
    heading: "Pricing",
    body: [
      "Prices and offers change without notice, and a listing may occasionally carry an incorrect price. Where a genuine error has occurred we may cancel the order and refund in full, telling you first. We do not use this to walk away from a price merely because it turned out generous.",
    ],
  },
  {
    heading: "Delivery Estimates",
    body: [
      "Delivery dates are estimates built from the courier's timeline for your pin code plus our processing time. Weather, festivals, strikes and courier backlogs move them and are outside our control.",
    ],
  },
  {
    heading: "Care",
    body: [
      "Care guidance is general advice for Banarasi silk, and each listing carries care written for that piece. We are not responsible for damage from washing, dry cleaning, ironing, storage or alteration after delivery. For anything delicate, use a cleaner experienced with Banarasi silk and zari.",
    ],
  },
  {
    heading: "The Chat Assistant, Links and Reviews",
    body: [
      "Our assistant answers from live catalogue and order data but is automated and can be wrong. Where it conflicts with a product page, your order record or these policies, those prevail — no price, date or eligibility it quotes is binding on its own.",
      "We link to third-party services and to our storefronts on other marketplaces. Their content and policies are their own, and a purchase made through another marketplace is governed by that marketplace's terms, not ours.",
      "Reviews are written by customers who received the product and reflect their experience, not ours. We moderate for abuse and relevance; we do not remove genuine reviews for being unfavourable, and we do not pay for reviews.",
    ],
  },
];

const Disclaimer = () => (
  <PolicyPage
    title="Disclaimer"
    subtitle="What to expect from a woven silk product, and the limits of what we can promise."
    sections={sections}
    downloadable
  />
);

export default Disclaimer;
