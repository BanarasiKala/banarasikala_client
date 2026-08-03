import { useState } from "react";
import chiffonImg from "../../../assets/fabric/chiffon.webp";
import cottonSilkImg from "../../../assets/fabric/cotton_silk.webp";
import georgetteImg from "../../../assets/fabric/georgette.webp";
import katanSilkImg from "../../../assets/fabric/katan_silk.webp";
import khaddiImg from "../../../assets/fabric/khaddi.webp";
import organzaImg from "../../../assets/fabric/organza.webp";
import satinSilkImg from "../../../assets/fabric/satan_silk.webp";
import tissueImg from "../../../assets/fabric/tissue.webp";
import "./FabricStrip.css";

const FABRICS = [
  { name: "Katan Silk", image: katanSilkImg },
  { name: "Organza", image: organzaImg },
  { name: "Tissue", image: tissueImg },
  { name: "Chiffon", image: chiffonImg },
  { name: "Georgette", image: georgetteImg },
  { name: "Khaddi", image: khaddiImg },
  { name: "Cotton Silk", image: cottonSilkImg },
  { name: "Satin Silk", image: satinSilkImg },
];

const FabricImage = ({ fabric }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <span className={`bk-fabric-swatch ${loaded ? "is-loaded" : ""}`}>
      <img
        src={fabric.image}
        alt={fabric.name}
        onLoad={() => setLoaded(true)}
        loading="eager"
      />
    </span>
  );
};

const FabricStrip = () => {
  const marqueeFabrics = [...FABRICS, ...FABRICS];

  // Display only — the swatches no longer navigate anywhere on click.
  return (
  <div className="bk-fabric-strip">
    <div className="bk-fabric-grid bk-fabric-grid-desktop">
      {FABRICS.map((fabric) => (
        <div key={fabric.name} className="bk-fabric-item">
          <FabricImage fabric={fabric} />
          <span className="bk-fabric-label">{fabric.name}</span>
        </div>
      ))}
    </div>
    <div className="bk-fabric-grid bk-fabric-grid-mobile">
      {marqueeFabrics.map((fabric, index) => (
        <div key={`${fabric.name}-${index}`} className="bk-fabric-item">
          <FabricImage fabric={fabric} />
          <span className="bk-fabric-label">{fabric.name}</span>
        </div>
      ))}
    </div>
  </div>
  );
};

export default FabricStrip;
