import { Link } from "react-router-dom";
import "./CraftSection.css";

const craftSectionImages = import.meta.glob(
  "../../../assets/craft/*.{png,jpg,jpeg,webp}",
  { eager: true, import: "default" },
);

const getSectionImage = (images, name) => {
  const entry = Object.entries(images).find(([path]) =>
    path.toLowerCase().includes(name),
  );
  return entry?.[1] || "";
};

/**
 * Every saree we sell is woven on a powerloom, so this section speaks to that alone.
 *
 * The handloom panel below is KEPT, commented out, rather than deleted — the shop may
 * stock handloom pieces later and this is the section that would carry them. Restoring it
 * is uncommenting the object: the grid is `auto-fit` (CraftSection.css) so it goes back to
 * two columns on its own, and the "Perfect Balance" medallion in the markup below comes
 * back with it.
 */
const CRAFT_PANELS = [
  // {
  //   title: "Handloom",
  //   text: "Woven by skilled artisans with love and heritage.",
  //   image: getSectionImage(craftSectionImages, "handloom"),
  // },
  {
    title: "Powerloom",
    text: "Woven with precision for an even weave, a consistent finish and honest value.",
    image: getSectionImage(craftSectionImages, "powerloom"),
  },
];

// True only while the handloom panel above is commented out. Drives the heading and the
// medallion, so the section reads correctly in either state without a second edit.
const IS_SINGLE_CRAFT = CRAFT_PANELS.length === 1;

const CraftSection = () => (
  <section className="bk-craft-section" aria-labelledby="craft-title">
    <div className="bk-craft-shell">
      <div className="bk-craft-copy">
        <span>Preserving Tradition. Crafting Beauty.</span>
        {IS_SINGLE_CRAFT ? (
          <>
            <h2 id="craft-title">
              Powerloom Banarasi
              <em>Precision &amp; Value</em>
            </h2>
            <p>
              Every saree we sell is woven on a powerloom in Varanasi — the same
              designs and the same zari, made to an even weave and a consistent
              finish. It is what lets us keep the craft honest and the price fair.
            </p>
          </>
        ) : (
          <>
            <h2 id="craft-title">
              Handloom &amp; Powerloom
              <em>Perfectly Balanced</em>
            </h2>
            <p>
              We bring you the finest of both worlds - the heritage of handloom and
              the perfection of powerloom. Blending tradition with innovation to
              deliver sarees that are beautiful, durable and affordable.
            </p>
          </>
        )}
        <Link to="/collection" className="bk-craft-cta">
          Explore Collection
        </Link>
      </div>

      <div className="bk-craft-panels">
        {CRAFT_PANELS.map((panel) => (
          <article className="bk-craft-panel" key={panel.title}>
            <div className="bk-craft-panel-head">
              <span className="bk-craft-loom-icon" aria-hidden="true">
                <svg viewBox="0 0 64 64" fill="none">
                  <path d="M12 16h40M16 12v40M48 12v40M12 48h40M20 22h24M20 30h24M20 38h24" />
                  <path d="M23 12l-7 7M41 12l7 7M23 52l-7-7M41 52l7-7" />
                </svg>
              </span>
              <div>
                <h3>{panel.title}</h3>
                <p>{panel.text}</p>
              </div>
            </div>
            <div className="bk-craft-image-wrap">
              {panel.image && <img src={panel.image} alt={`${panel.title} saree`} />}
            </div>
          </article>
        ))}
        {/* The medallion sits between the two panels and is about the balance BETWEEN
            them, so it only appears when both are there. */}
        {!IS_SINGLE_CRAFT && (
          <div className="bk-craft-balance" aria-hidden="true">
            <span>Perfect</span>
            <strong>Balance</strong>
          </div>
        )}
      </div>
    </div>
  </section>
);

export default CraftSection;
