import PolicyPage from "./PolicyPage";

const sections = [
  {
    heading: "Handloom Variation",
    body: [
      "Every saree sold on Banarasi Kala is woven by hand. Slight irregularities in the weave, motif placement, zari density, or finish are inherent to handloom work — they are marks of authenticity, not manufacturing defects, and are not treated as grounds for return.",
      "Because each piece is made individually, no two sarees are ever perfectly identical, even within the same design.",
    ],
  },
  {
    heading: "Colour and Image Accuracy",
    body: [
      "We photograph every saree in natural light and edit as little as possible. Even so, the colour you see depends on your screen, its brightness and colour profile, and the light you are viewing it in.",
      "Minor differences between the photograph and the saree you receive are expected. A substantial colour mismatch is a different matter — contact us and we will make it right.",
    ],
  },
  {
    heading: "Product Information",
    body: [
      "Fabric composition, measurements, and weights are provided as accurately as we can state them. Dimensions may vary by up to two inches, and weights by a small margin, because of the nature of hand weaving and finishing.",
      "Blouse pieces, where included, are unstitched unless the listing explicitly says otherwise.",
    ],
  },
  {
    heading: "Pricing and Availability",
    body: [
      "Prices, offers and stock levels are subject to change without notice. Despite our checks, a listing may occasionally carry an incorrect price or show an item that has just sold out.",
      "Where this happens we reserve the right to cancel the affected order and refund it in full. We will contact you before doing so.",
    ],
  },
  {
    heading: "Care and Suitability",
    body: [
      "Guidance in our Care Instructions is offered in good faith as general advice for handloom silk. Banarasi Kala is not responsible for damage arising from washing, dry cleaning, ironing, storage, or alteration carried out after delivery.",
      "For anything valuable or delicate, please use a dry cleaner experienced with handloom silk and zari.",
    ],
  },
  {
    heading: "External Links",
    body: [
      "This site links to third-party services — payment gateways, courier tracking, and our storefronts on other marketplaces. Their content and policies are their own, and we do not control or take responsibility for them.",
      "Purchases made through a third-party marketplace are governed by that marketplace's terms, not ours.",
    ],
  },
];

const Disclaimer = () => (
  <PolicyPage
    title="Disclaimer"
    subtitle="What to expect from a handwoven product, stated plainly."
    sections={sections}
  />
);

export default Disclaimer;
