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

const CRAFT_PANELS = [
  {
    title: "Handloom",
    text: "Woven by skilled artisans with love and heritage.",
    image: getSectionImage(craftSectionImages, "handloom"),
  },
  {
    title: "Powerloom",
    text: "Crafted with precision for elegance and value.",
    image: getSectionImage(craftSectionImages, "powerloom"),
  },
];

const CraftSection = () => (
  <section className="bk-craft-section" aria-labelledby="craft-title">
    <div className="bk-craft-shell">
      <div className="bk-craft-copy">
        <span>Preserving Tradition. Crafting Beauty.</span>
        <h2 id="craft-title">
          Handloom &amp; Powerloom
          <em>Perfectly Balanced</em>
        </h2>
        <p>
          We bring you the finest of both worlds - the heritage of handloom and
          the perfection of powerloom. Blending tradition with innovation to
          deliver sarees that are beautiful, durable and affordable.
        </p>
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
        <div className="bk-craft-balance" aria-hidden="true">
          <span>Perfect</span>
          <strong>Balance</strong>
        </div>
      </div>
    </div>
  </section>
);

export default CraftSection;
