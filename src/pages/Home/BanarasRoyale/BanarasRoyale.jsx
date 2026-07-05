import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { API_ENDPOINTS } from "../../../config/api";
import { imgUrl } from "../../../utils/cloudinary";
import "./BanarasRoyale.css";

// One showcase stage: the entry's video plays as the cinematic backdrop while
// its images float in over it one by one (polaroid-style, cycling). The
// polaroid is draggable — the shopper can move it anywhere inside the video.
const RoyaleStage = ({ entry }) => {
  const images = Array.isArray(entry.images) ? entry.images.filter(Boolean) : [];
  const [imageIndex, setImageIndex] = useState(0);
  // null → the CSS default spot (with the bob animation); {x,y} once dragged.
  const [floatPos, setFloatPos] = useState(null);
  const stageRef = useRef(null);
  const floatRef = useRef(null);
  const dragRef = useRef(null); // pointer offset inside the polaroid while dragging

  useEffect(() => {
    if (images.length <= 1) return undefined;
    const timer = setInterval(() => setImageIndex((index) => index + 1), 3400);
    return () => clearInterval(timer);
  }, [images.length]);

  const startDrag = (event) => {
    const stage = stageRef.current;
    const float = floatRef.current;
    if (!stage || !float) return;
    event.preventDefault();
    const stageBox = stage.getBoundingClientRect();
    const floatBox = float.getBoundingClientRect();
    dragRef.current = { dx: event.clientX - floatBox.left, dy: event.clientY - floatBox.top };
    float.setPointerCapture?.(event.pointerId);
    setFloatPos({ x: floatBox.left - stageBox.left, y: floatBox.top - stageBox.top });
  };

  const moveDrag = (event) => {
    if (!dragRef.current) return;
    const stage = stageRef.current;
    const float = floatRef.current;
    if (!stage || !float) return;
    const stageBox = stage.getBoundingClientRect();
    const x = Math.min(Math.max(0, event.clientX - stageBox.left - dragRef.current.dx), stageBox.width - float.offsetWidth);
    const y = Math.min(Math.max(0, event.clientY - stageBox.top - dragRef.current.dy), stageBox.height - float.offsetHeight);
    setFloatPos({ x, y });
  };

  const endDrag = (event) => {
    dragRef.current = null;
    floatRef.current?.releasePointerCapture?.(event.pointerId);
  };

  const product = entry.Product || null;
  const currentImage = images.length ? images[imageIndex % images.length] : null;

  return (
    <div className="bk-royale-stage" ref={stageRef}>
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

      {/* Floating polaroid — draggable anywhere inside the stage. The image
          swap animates on the inner <img> (keyed) so a cycle mid-drag never
          remounts the container or breaks pointer capture. */}
      {entry.video && currentImage && (
        <div
          ref={floatRef}
          className={`bk-royale-float${floatPos ? " is-free" : ""}`}
          style={floatPos ? { left: floatPos.x, top: floatPos.y, right: "auto", bottom: "auto" } : undefined}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="Drag to move"
        >
          <img key={imageIndex % images.length} src={imgUrl(currentImage, 560)} alt="" draggable={false} />
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
