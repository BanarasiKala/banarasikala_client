import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { imgUrl } from "../../../utils/cloudinary";
import { API_ENDPOINTS } from "../../../config/api";
import "./BrowseCircles.css";

const normalizeItems = (varieties = []) =>
  varieties.map((item) => ({
    id: `variety-${item.id}`,
    name: item.name,
    image: item.image,
    href: `/collection?variety=${item.id}`,
  }));

const BrowseCircles = () => {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const suppressClickRef = useRef(false);
  const dragRef = useRef({ active: false, startX: 0 });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(API_ENDPOINTS.varieties, { signal: controller.signal })
      .then((r) => r.json())
      .then((varieties) => setItems(normalizeItems(Array.isArray(varieties) ? varieties : [])))
      .catch((e) => { if (e.name !== "AbortError") setItems([]); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const marqueeItems = useMemo(() => [...items, ...items], [items]);

  const openItem = (href) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    navigate(href);
  };

  const onPointerDown = (e) => {
    dragRef.current = { active: true, startX: e.clientX };
    wrapRef.current?.classList.add("is-paused");
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    if (Math.abs(e.clientX - dragRef.current.startX) > 5) {
      suppressClickRef.current = true;
    }
  };

  const onPointerEnd = () => {
    dragRef.current.active = false;
    wrapRef.current?.classList.remove("is-paused");
    window.setTimeout(() => { suppressClickRef.current = false; }, 80);
  };

  return (
    <section className="bk-browse-section">
      <div className="bk-browse-shell">
        <div className="bk-browse-header">
          <span>Variety of Authentic Banarasi Sarees</span>
          <h2>Premium Variety</h2>
        </div>
      </div>

      {loading ? (
        <div className="bk-browse-track-wrap">
          <div className="bk-browse-track bk-browse-track--static">
            {[...Array(12)].map((_, i) => (
              <div className="bk-browse-card bk-browse-skeleton" key={i}>
                <span className="bk-browse-circle" />
                <span className="bk-browse-line" />
              </div>
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="bk-browse-shell">
          <div className="bk-browse-empty" role="status">Varieties will appear here soon.</div>
        </div>
      ) : (
        <div
          ref={wrapRef}
          className="bk-browse-track-wrap"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={onPointerEnd}
          onMouseEnter={() => wrapRef.current?.classList.add("is-paused")}
          onMouseLeave={() => wrapRef.current?.classList.remove("is-paused")}
        >
          <div className="bk-browse-track">
            {marqueeItems.map((item, i) => (
              <button
                type="button"
                key={`${item.id}-${i}`}
                className="bk-browse-card"
                onClick={() => openItem(item.href)}
              >
                <span className="bk-browse-circle">
                  {item.image
                    ? <img src={imgUrl(item.image, 200)} alt={item.name} decoding="async" />
                    : <span>{item.name.slice(0, 1)}</span>}
                </span>
                <span className="bk-browse-name">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default BrowseCircles;
