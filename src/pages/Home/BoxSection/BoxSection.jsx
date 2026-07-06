import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../../config/api";
import { imgUrl } from "../../../utils/cloudinary";
import "./BoxSection.css";

const IMAGE_DURATION = 4500; // ms an image holds before auto-advancing
const VIDEO_MAX = 12000; // ms cap so a long video never stalls the story

// One admin entry → an editorial spotlight: a big cinematic stage that
// auto-plays through the entry's media (videos first, then images) with a
// story-style segmented progress bar, an elegant copy column, and a clickable
// thumbnail rail. Nothing is cropped — a blurred copy fills behind each frame.
const BoxShowcase = ({ entry }) => {
  // Stable across renders so the auto-advance effect isn't restarted every frame.
  const media = useMemo(() => [
    ...(Array.isArray(entry.videos) ? entry.videos.filter(Boolean).map((url) => ({ type: "video", url })) : []),
    ...(Array.isArray(entry.images) ? entry.images.filter(Boolean).map((url) => ({ type: "image", url })) : []),
  ], [entry]);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const single = media.length <= 1;

  const goTo = useCallback((index) => {
    setProgress(0);
    setActive(((index % media.length) + media.length) % media.length);
  }, [media.length]);

  const next = useCallback(() => {
    if (single) return;
    setProgress(0);
    setActive((index) => (index + 1) % media.length);
  }, [single, media.length]);

  // Images self-advance on a timed progress ramp; videos drive progress from
  // their own playback (handled in the <video> events below).
  useEffect(() => {
    const item = media[active];
    if (!item || item.type !== "image") return undefined;
    const start = performance.now();
    let raf;
    const tick = (time) => {
      const p = Math.min(1, (time - start) / IMAGE_DURATION);
      setProgress(p);
      if (p >= 1) next();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, media, next]);

  if (!media.length) return null;
  const current = media[active];

  return (
    <div className="bk-box-block">
      <div className="bk-box-stage-col">
        <div className="bk-box-stage">
          {/* Story-style segmented progress across the top. */}
          <div className="bk-box-segments" aria-hidden="true">
            {media.map((item, index) => (
              <span key={index} className="bk-box-segment">
                <i style={{ width: index < active ? "100%" : index === active ? `${progress * 100}%` : "0%" }} />
              </span>
            ))}
          </div>

          {/* Blurred fill so portrait/landscape media is never cropped. */}
          {current.type === "video" ? (
            <>
              <video className="bk-box-fill" src={current.url} autoPlay muted loop={single} playsInline preload="metadata" aria-hidden="true" />
              <video
                key={`${entry.id}-${active}`}
                className="bk-box-front"
                src={current.url}
                autoPlay
                muted
                loop={single}
                playsInline
                preload="metadata"
                aria-label={entry.title || "Premium packaging"}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration) setProgress(Math.min(1, v.currentTime / v.duration));
                }}
                onEnded={next}
                ref={(el) => {
                  if (!el) return;
                  // Safety net: cap absurdly long clips so the story keeps moving.
                  clearTimeout(el._cap);
                  if (!single) el._cap = setTimeout(next, VIDEO_MAX);
                }}
              />
            </>
          ) : (
            <>
              <img className="bk-box-fill" src={imgUrl(current.url, 900)} alt="" aria-hidden="true" />
              <img key={`${entry.id}-${active}`} className="bk-box-front bk-box-kenburns" src={imgUrl(current.url, 1200)} alt={entry.title || "Premium packaging"} />
            </>
          )}

          <span className="bk-box-stage-scrim" aria-hidden="true" />
          <span className="bk-box-corners" aria-hidden="true" />
          <span className="bk-box-count">{String(active + 1).padStart(2, "0")}<i>/{String(media.length).padStart(2, "0")}</i></span>
        </div>
      </div>

      <div className="bk-box-copy">
        <span className="bk-box-eyebrow">
          <Icon icon="lucide:gift" /> Premium Packaging
        </span>
        {entry.title && <h3>{entry.title}</h3>}
        {entry.description && <p>{entry.description}</p>}

        {media.length > 1 && (
          <div className="bk-box-thumbs">
            {media.map((item, index) => (
              <button
                key={`${item.url}-${index}`}
                type="button"
                className={`bk-box-thumb${index === active ? " is-active" : ""}`}
                onClick={() => goTo(index)}
                aria-label={`Show item ${index + 1}`}
              >
                {item.type === "video" ? (
                  <>
                    <video src={item.url} muted playsInline preload="metadata" />
                    <span className="bk-box-thumb-play" aria-hidden="true"><Icon icon="lucide:play" /></span>
                  </>
                ) : (
                  <img src={imgUrl(item.url, 200)} alt="" loading="lazy" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// "Box Section" — admin-curated premium-packaging showcase on the home page
// (title + multiple images + multiple videos per entry).
const BoxSection = () => {
  const [entries, setEntries] = useState([]);
  const rootRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(API_ENDPOINTS.boxSections, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setEntries(
        Array.isArray(data)
          ? data.filter((entry) => (entry.videos || []).length || (entry.images || []).length)
          : [],
      ))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!entries.length) return null;

  return (
    <section className="bk-box-section" ref={rootRef}>
      <span className="bk-box-sparkles" aria-hidden="true">
        {[
          { top: "10%", left: "8%", d: "0s", s: 13 },
          { top: "24%", left: "92%", d: "1.2s", s: 10 },
          { top: "76%", left: "5%", d: "0.6s", s: 11 },
          { top: "84%", left: "78%", d: "1.8s", s: 14 },
          { top: "50%", left: "48%", d: "2.4s", s: 9 },
        ].map((sp, i) => (
          <i key={i} style={{ top: sp.top, left: sp.left, animationDelay: sp.d, "--s": `${sp.s}px` }} />
        ))}
      </span>
      <div className="bk-box-shell">
        <div className="bk-box-head">
          <span className="bk-box-flourish" aria-hidden="true" />
          <span className="bk-box-head-label">Unboxing Luxury</span>
          <span className="bk-box-flourish bk-box-flourish--r" aria-hidden="true" />
        </div>
        {entries.map((entry) => (
          <BoxShowcase key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
};

export default BoxSection;
