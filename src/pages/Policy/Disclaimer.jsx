import PolicyPage from "./PolicyPage";

/**
 * Grounded in how the site actually presents products:
 *   server/src/models/Product.js — length, weight, blouse_piece, care_instructions all nullable
 *   client/src/pages/ProductDetail/ProductDetail.jsx — specificationRows drops empty values
 *   server/src/utils/inventory.js + color_stocks — availability is tracked per colour
 *   server/src/controllers/OrderController.js — our right to cancel and refund in full
 *   server/src/services/AiChatService.js — the assistant, and why it is not authoritative
 */
const sections = [
  {
    heading: "Handloom Variation",
    body: [
      "Every saree we sell is woven by hand. Slight irregularity in the weave, variation in motif placement, differences in zari density, and loose threads on the reverse are inherent to handloom work. They are marks of authenticity, not manufacturing defects, and they are not grounds for return.",
      "Because each piece is made individually, no two sarees are ever perfectly identical — not even two of the same design. The photograph shows the design; the saree you receive is its own object.",
      "A genuine fault is a different matter. Damage, a defect, or the wrong item are all listed return reasons, and you have 7 days from delivery to raise one.",
    ],
  },
  {
    heading: "Colour and Images",
    body: [
      "We photograph every saree in natural light and edit as little as we can. Even so, the colour you see depends on your screen, its brightness and colour profile, and the light you are viewing it in.",
      "Minor difference between the photograph and the saree in your hands is expected. A substantial mismatch is not — tell us and we will put it right.",
      "Each colour of a saree has its own photographs. What you see when a colour is selected is that colour, not a recoloured version of another one.",
    ],
  },
  {
    heading: "Product Information",
    body: [
      "Length, weight, fabric, pattern and whether a blouse piece is included are published per saree, and are as accurate as we can state them. Given hand weaving and finishing, expect small variation against the published figures.",
      "Where a specification is not shown on a listing, it means we have not recorded that value for that piece — not that it is zero or absent. Ask us and we will measure the actual saree.",
      "Blouse pieces, where included, are unstitched fabric. We do not offer stitching, and we do not publish blouse-piece dimensions separately. See the Size Guide.",
    ],
  },
  {
    heading: "Availability",
    body: [
      "Stock is tracked per colour, so a saree can be available in one colour and sold out in another. Availability changes as other customers buy, and a colour can sell out between you adding it to your bag and completing checkout.",
      "Where that happens we contact you and refund in full rather than substituting anything.",
    ],
  },
  {
    heading: "Pricing",
    body: [
      "Prices and offers can change without notice. Despite our checks, a listing may occasionally carry an incorrect price.",
      "Where a genuine pricing error has occurred we may cancel the affected order and refund it in full. We will tell you before doing so. We do not use this to walk away from a price simply because it turned out to be generous.",
    ],
  },
  {
    heading: "Delivery Estimates",
    body: [
      "Delivery dates shown on product pages are estimates. They are built from the courier's own timeline for your pin code plus our processing time for that saree, and they are the best information we have — but they are not guarantees.",
      "Weather, festivals, strikes and courier backlogs move delivery dates and are outside our control. See the Shipping Policy.",
    ],
  },
  {
    heading: "Care and Suitability",
    body: [
      "Care guidance is offered in good faith as general advice for handloom silk, and each listing carries care written for that piece. We are not responsible for damage arising from washing, dry cleaning, ironing, storage or alteration carried out after delivery.",
      "For anything valuable or delicate, use a dry cleaner experienced with handloom silk and zari. See our Care Instructions.",
    ],
  },
  {
    heading: "The Chat Assistant",
    body: [
      "Our chat assistant answers from live catalogue and order data, but it is an automated system and can be wrong or incomplete.",
      "Where it conflicts with a product page, your order record, or these policies, those prevail. Nothing the assistant says creates a commitment we have not made elsewhere, and no price, delivery date or eligibility it quotes is binding on its own.",
    ],
  },
  {
    heading: "External Links and Other Sellers",
    body: [
      "This site connects to third-party services — the payment gateway, courier tracking, and our storefronts on other marketplaces. Their content and policies are their own and we do not control them.",
      "A purchase made through another marketplace is governed by that marketplace's terms, not ours. Our returns, refunds and wallet apply only to orders placed on banarasikala.com.",
    ],
  },
  {
    heading: "Reviews and Content",
    body: [
      "Reviews are written by customers who bought and received the product, and reflect their own experience rather than ours. We moderate for abuse and relevance; we do not remove genuine reviews for being unfavourable, and we do not pay for reviews.",
    ],
  },
];

const Disclaimer = () => (
  <PolicyPage
    title="Disclaimer"
    subtitle="What to expect from a handwoven product, and the limits of what we can promise."
    sections={sections}
    downloadable
  />
);

export default Disclaimer;
