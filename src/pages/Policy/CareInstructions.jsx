import PolicyPage from "./PolicyPage";

/**
 * The authoritative care text is per-product and free-form, entered by us against each saree:
 *   server/src/models/Product.js                     — care_instructions (TEXT, nullable)
 *   client/src/pages/ProductDetail/ProductDetail.jsx — the "Care" row in specificationRows
 *   server/src/services/ChatToolHandlers.js          — returned by get_product_details
 * The row is filtered out when empty, so this page also has to cover its absence. Everything
 * below the first two sections is general handloom guidance, not a value stored anywhere.
 */
const sections = [
  {
    heading: "Every Saree Carries Its Own Instructions",
    body: [
      "Care is recorded against each individual saree rather than applied as a blanket rule, because a heavy zari tissue and a lighter silk do not want the same handling.",
      "Open any product and scroll to the Material & Specifications panel. The Care row there is written for that specific piece, and it is the instruction to follow. Where it differs from the general guidance further down this page, the product page wins.",
      "If a listing shows no Care row, we have not recorded instructions for that piece. Treat it as handloom silk and follow the general guidance below, or ask us and we will confirm for that saree.",
      "You can also ask the assistant on any page about a specific saree — it reads the same care text from the listing.",
    ],
  },
  {
    heading: "Our House Standard",
    body: [
      "Unless a listing says otherwise, our sarees are cared for the same way: dry clean only, stored folded in a muslin cloth, kept away from direct sunlight.",
      "Those three lines cover most of what matters. The sections below explain why, and what else helps a handwoven saree last.",
    ],
  },
  {
    heading: "Cleaning",
    body: [
      "Dry clean only. Handloom silk and real zari do not tolerate water, detergent or machine agitation — a single home wash can dull the zari permanently and shrink the weave unevenly.",
      "Use a dry cleaner who handles Banarasi silk regularly, and point out the zari so it is not pressed flat or treated with harsh solvents.",
      "For a small fresh stain, blot gently with a dry cloth and take the saree in as soon as you can. Do not rub, and do not apply water or a stain remover yourself.",
      "Some colour may lift during the first dry clean. That is normal for naturally dyed silk — tell your cleaner it is a first clean so the piece is handled separately.",
    ],
  },
  {
    heading: "Ironing",
    body: [
      "Iron on the lowest silk setting, always on the reverse, with a thin cotton cloth between the iron and the fabric.",
      "Never iron directly over zari or mirror work. The metal threads flatten and lose their shine, and that cannot be undone.",
      "Avoid steaming the weave directly, and let the saree cool completely before folding it.",
    ],
  },
  {
    heading: "Storage",
    body: [
      "Wrap the saree in a soft cotton or muslin cloth rather than a plastic cover. Silk needs to breathe; plastic traps moisture and yellows the fabric over time.",
      "Store flat, in a cool dry place, out of direct sunlight — both daylight and tube light fade natural dyes.",
      "Refold along different lines every three to four months. Zari cracks and silk weakens wherever a fold sits in the same place for years.",
      "Keep naphthalene balls in the cupboard rather than in contact with the fabric.",
    ],
  },
  {
    heading: "Wearing",
    body: [
      "Apply perfume, deodorant and hairspray before draping, and let them dry. Alcohol and oils stain silk and tarnish zari on contact.",
      "Pin through the pleats rather than the pallu, and use as few pins as you can. Pins leave permanent holes in a fine weave.",
      "Watch for rough jewellery edges, embroidered bag straps and velcro, all of which snag surface threads.",
    ],
  },
  {
    heading: "What Is Normal, and What Is Not",
    body: [
      "Slight irregularity in the weave, small variation in motif spacing, and loose threads on the reverse are characteristic of handloom work. They are not faults, and our Disclaimer explains why.",
      "Damage caused after delivery by washing, dry cleaning, ironing, storage or alteration is not something we can cover.",
      "A genuine fault is different. If a saree arrives damaged or defective, that is a listed reason on the return and exchange flows and you have 7 days from delivery to raise it — see our Return & Exchange Policy.",
    ],
  },
];

const CareInstructions = () => (
  <PolicyPage
    title="Care Instructions"
    subtitle="Each listing carries care written for that saree. This is the general guidance behind it."
    sections={sections}
    downloadable
  />
);

export default CareInstructions;
