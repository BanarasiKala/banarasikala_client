import PolicyPage from "./PolicyPage";

/**
 * The authoritative care text is per-product and free-form (Product.care_instructions, shown
 * as the "Care" row in ProductDetail's specification panel, and returned by the chat
 * assistant's get_product_details). The row is filtered out when empty, so absence is covered
 * too. Everything after the first section is general Banarasi silk guidance, not stored anywhere.
 */
const sections = [
  {
    heading: "Every Saree Carries Its Own Instructions",
    body: [
      "Care is recorded against each individual saree — a heavy zari tissue and a lighter silk do not want the same handling. Open any product, scroll to the Material & Specifications panel, and the Care row there is written for that piece. Where it differs from the general guidance below, the product page wins.",
      "If a listing shows no Care row we have not recorded instructions for it. Treat it as Banarasi silk and follow the guidance below, or ask us. You can also ask the assistant on any page — it reads the same care text.",
      "Unless a listing says otherwise, our standard is simple: dry clean only, stored folded in a muslin cloth, kept out of direct sunlight.",
    ],
  },
  {
    heading: "Cleaning",
    body: [
      "Dry clean only. Banarasi silk and real zari do not tolerate water, detergent or machine agitation — one home wash can dull the zari permanently and shrink the weave unevenly. Use a cleaner who handles Banarasi silk regularly and point out the zari so it is not pressed flat or treated with harsh solvents.",
      "For a small fresh stain, blot gently with a dry cloth and take it in soon. Do not rub, and do not apply water or stain remover yourself. Some colour may lift during the first dry clean — that is normal for naturally dyed silk, so tell your cleaner it is a first clean.",
    ],
  },
  {
    heading: "Ironing",
    body: [
      "Iron on the lowest silk setting, always on the reverse, with a thin cotton cloth between the iron and the fabric. Never iron directly over zari or mirror work — the metal threads flatten and lose their shine, and that cannot be undone. Avoid steaming the weave directly, and let the saree cool before folding.",
    ],
  },
  {
    heading: "Storage",
    body: [
      "Wrap in soft cotton or muslin rather than plastic; silk needs to breathe, and plastic traps moisture and yellows the fabric. Store flat, cool and out of direct sunlight — daylight and tube light both fade natural dyes.",
      "Refold along different lines every three to four months, because zari cracks and silk weakens wherever a fold sits for years. Keep naphthalene balls in the cupboard rather than against the fabric.",
    ],
  },
  {
    heading: "Wearing",
    body: [
      "Apply perfume, deodorant and hairspray before draping and let them dry — alcohol and oils stain silk and tarnish zari on contact. Pin through the pleats rather than the pallu and use as few pins as you can, since pins leave permanent holes in a fine weave. Watch for rough jewellery edges, embroidered bag straps and velcro, which snag surface threads.",
    ],
  },
  {
    heading: "What Is Normal, and What Is Not",
    body: [
      "Small variation in motif alignment, in how the zari catches the light, and in finished length or weight between pieces is normal and not a fault — our Disclaimer explains why.",
      "Damage caused after delivery by washing, dry cleaning, ironing, storage or alteration is not something we can cover. A genuine fault is different: if a saree arrives damaged or defective, that is a listed return reason and you have 7 days from delivery to raise it.",
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
