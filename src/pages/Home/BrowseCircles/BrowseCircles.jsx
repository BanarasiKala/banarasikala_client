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

const SPEED = 80; // px per second

const BrowseCircles = () => {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const trackRef = useRef(null);
  const isPausedRef = useRef(false);
  const xRef = useRef(0);              // shared between rAF and drag
  const loopWidthRef = useRef(0);
  const dragRef = useRef({ active: false, startX: 0, startTrackX: 0 });
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

  const copies = useMemo(
    () => (!items.length ? 2 : Math.max(2, Math.ceil(24 / items.length))),
    [items]
  );
  const marqueeItems = useMemo(
    () => Array.from({ length: copies }, () => items).flat(),
    [items, copies]
  );

  // rAF loop — reads/writes xRef so drag can share the same position
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !marqueeItems.length) return;

    xRef.current = 0;
    let lastTime = null;
    let raf;

    const normalize = (x, lw) => {
      x = x % lw;
      if (x > 0) x -= lw;
      return x;
    };

    const step = (time) => {
      if (!isPausedRef.current) {
        if (lastTime !== null) {
          xRef.current -= (SPEED * (time - lastTime)) / 1000;
          const lw = loopWidthRef.current;
          if (lw > 0 && (xRef.current <= -lw || xRef.current > 0)) {
            xRef.current = normalize(xRef.current, lw);
          }
          track.style.transform = `translateX(${xRef.current}px)`;
        }
        lastTime = time;
      } else {
        lastTime = null;
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(() => {
      loopWidthRef.current = track.scrollWidth / copies;
      raf = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(raf);
  }, [marqueeItems.length, copies]);

  const openItem = (href) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    navigate(href);
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, startX: e.clientX, startTrackX: xRef.current };
    isPausedRef.current = true;
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    const delta = e.clientX - dragRef.current.startX;
    if (Math.abs(delta) > 5) suppressClickRef.current = true;

    const lw = loopWidthRef.current;
    let newX = dragRef.current.startTrackX + delta;
    if (lw > 0) {
      newX = newX % lw;
      if (newX > 0) newX -= lw;
    }
    xRef.current = newX;
    if (trackRef.current) trackRef.current.style.transform = `translateX(${newX}px)`;
  };

  const onPointerEnd = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    isPausedRef.current = false;
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
          onMouseEnter={() => { isPausedRef.current = true; }}
          onMouseLeave={() => { isPausedRef.current = false; }}
        >
          <div ref={trackRef} className="bk-browse-track">
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
