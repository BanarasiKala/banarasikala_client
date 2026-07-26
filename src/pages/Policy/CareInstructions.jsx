import PolicyPage from "./PolicyPage";

const sections = [
  {
    heading: "Cleaning",
    body: [
      "Dry clean only. Handloom silk and real zari do not tolerate water, detergent, or machine agitation — a single wash at home can dull the zari permanently and shrink the weave unevenly.",
      "Use a dry cleaner who handles Banarasi silk regularly, and point out the zari work so it is not pressed flat or treated with harsh solvents.",
      "For a small fresh stain, blot gently with a dry cloth and take the saree in as soon as you can. Never rub, and never apply water or a stain remover yourself.",
    ],
  },
  {
    heading: "Ironing",
    body: [
      "Iron on the lowest silk setting, always on the reverse side, with a thin cotton cloth between the iron and the fabric.",
      "Never iron directly over zari or mirror work. The metal threads flatten and lose their shine, and the damage cannot be undone.",
      "Do not use steam directly on the weave, and let the saree cool completely before folding it.",
    ],
  },
  {
    heading: "Storage",
    body: [
      "Wrap the saree in a soft cotton or muslin cloth rather than a plastic cover. Silk needs to breathe; plastic traps moisture and yellows the fabric over time.",
      "Store flat in a cool, dry, dark place. Direct sunlight and tube light both fade natural dyes.",
      "Refold along different lines every three to four months. Zari cracks and the silk weakens where a fold sits in the same place for years.",
      "Keep naphthalene balls away from direct contact with the fabric — place them in the cupboard, not inside the wrap.",
    ],
  },
  {
    heading: "Wearing",
    body: [
      "Put on perfume, deodorant and hairspray before you drape, and let them dry. Alcohol and oils stain silk and tarnish zari on contact.",
      "Use safety pins sparingly and pin through the pleats rather than the pallu. Pins leave permanent holes in a fine weave.",
      "Avoid rough jewellery edges, embroidered handbag straps, and velcro, all of which snag the surface threads.",
    ],
  },
  {
    heading: "What Is Normal",
    body: [
      "Slight irregularities in the weave, a small variation in motif spacing, or loose threads on the reverse are characteristic of handloom work, not faults.",
      "A little colour transfer during the first dry clean is also normal for naturally dyed silk. Tell your cleaner it is a first clean so the piece is treated separately.",
    ],
  },
];

const CareInstructions = () => (
  <PolicyPage
    title="Care Instructions"
    subtitle="Looked after properly, a Banarasi saree outlives the person who bought it."
    sections={sections}
  />
);

export default CareInstructions;
