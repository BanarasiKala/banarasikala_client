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
  const trackWrapRef = useRef(null);
  const dragStateRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  const pauseAutoScrollUntilRef = useRef(0);
  const suppressClickRef = useRef(false);
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

  const pauseScroll = (ms = 2600) => {
    pauseAutoScrollUntilRef.current = Date.now() + ms;
  };

  const onPointerDown = (e) => {
    const el = trackWrapRef.current;
    if (!el) return;
    dragStateRef.current = { active: true, startX: e.clientX, startScrollLeft: el.scrollLeft };
    pauseScroll();
  };

  const onPointerMove = (e) => {
    const el = trackWrapRef.current;
    const ds = dragStateRef.current;
    if (!el || !ds.active) return;
    const dx = e.clientX - ds.startX;
    if (Math.abs(dx) > 4) {
      suppressClickRef.current = true;
      el.scrollLeft = ds.startScrollLeft - dx;
      pauseScroll();
    }
  };

  const onPointerEnd = () => {
    dragStateRef.current.active = false;
    pauseScroll();
    window.setTimeout(() => { suppressClickRef.current = false; }, 80);
  };

  useEffect(() => {
    const el = trackWrapRef.current;
    if (!el || items.length === 0) return undefined;

    let frameId;
    let lastTime = performance.now();
    const speed = 28;
    let tabHidden = document.hidden;
    let sectionHidden = false;

    const scroll = (time) => {
      const delta = Math.min(time - lastTime, 64);
      lastTime = time;
      if (!tabHidden && !sectionHidden && Date.now() > pauseAutoScrollUntilRef.current && el.scrollWidth > el.clientWidth) {
        el.scrollLeft += (speed * delta) / 1000;
        const half = el.scrollWidth / 2;
        if (half > 0 && el.scrollLeft >= half) el.scrollLeft -= half;
        else if (el.scrollLeft <= 0) el.scrollLeft += half;
      }
      frameId = window.requestAnimationFrame(scroll);
    };

    const onVisibility = () => { tabHidden = document.hidden; if (!tabHidden) lastTime = performance.now(); };
    const observer = new IntersectionObserver(
      ([entry]) => { sectionHidden = !entry.isIntersecting; if (!sectionHidden) lastTime = performance.now(); },
      { rootMargin: "200px 0px" },
    );

    document.addEventListener("visibilitychange", onVisibility);
    observer.observe(el);
    frameId = window.requestAnimationFrame(scroll);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
    };
  }, [items.length]);

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
          <div className="bk-browse-track">
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
          ref={trackWrapRef}
          className="bk-browse-track-wrap"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={onPointerEnd}
          onMouseEnter={() => pauseScroll()}
          onMouseLeave={() => { pauseAutoScrollUntilRef.current = 0; }}
          onWheel={() => pauseScroll()}
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
