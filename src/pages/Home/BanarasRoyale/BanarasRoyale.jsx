import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_ENDPOINTS } from "../../../config/api";
import { imgUrl } from "../../../utils/cloudinary";
import "./BanarasRoyale.css";

// One showcase stage: the entry's video plays as the cinematic backdrop while
// its images float in over it one by one (polaroid-style, cycling).
const RoyaleStage = ({ entry }) => {
  const images = Array.isArray(entry.images) ? entry.images.filter(Boolean) : [];
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return undefined;
    const timer = setInterval(() => setImageIndex((index) => index + 1), 3400);
    return () => clearInterval(timer);
  }, [images.length]);

  const product = entry.Product || null;
  const currentImage = images.length ? images[imageIndex % images.length] : null;

  return (
    <div className="bk-royale-stage">
      {entry.video ? (
        <video
          className="bk-royale-media"
          src={entry.video}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={entry.title || "Banaras Royale"}
        />
      ) : currentImage ? (
        <img className="bk-royale-media" src={imgUrl(currentImage, 1400)} alt={entry.title || "Banaras Royale"} />
      ) : null}
      <span className="bk-royale-scrim" aria-hidden="true" />

      {/* Floating image — only when the video is the backdrop; keyed by index
          so each image re-runs the float-in animation as it takes its turn. */}
      {entry.video && currentImage && (
        <div className="bk-royale-float" key={imageIndex % images.length} aria-hidden="true">
          <img src={imgUrl(currentImage, 560)} alt="" />
        </div>
      )}

      <div className="bk-royale-copy">
        {entry.title && <h3>{entry.title}</h3>}
        {entry.description && <p>{entry.description}</p>}
        {product?.slug && (
          <Link className="bk-royale-cta" to={`/product/${product.slug}`}>
            Shop this look
            {Number(product.selling_price) > 0 && (
              <span>₹{Number(product.selling_price).toLocaleString("en-IN")}</span>
            )}
          </Link>
        )}
      </div>
    </div>
  );
};

// "Banaras Royale" — curated cinematic showcase below Why Choose Us,
// managed from the admin panel (images + one video + one linked product).
const BanarasRoyale = () => {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(API_ENDPOINTS.royale, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setEntries(Array.isArray(data) ? data.filter((entry) => entry.video || (entry.images || []).length) : []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!entries.length) return null;

  return (
    <section className="bk-royale-section">
      <div className="bk-royale-shell">
        <div className="bk-royale-heading">
          <span>Banarasi Kala Presents</span>
          <h2>Banaras Royale</h2>
        </div>
        {entries.map((entry) => (
          <RoyaleStage key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
};

export default BanarasRoyale;
