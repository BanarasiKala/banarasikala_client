import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../../config/api";
import { imgUrl } from "../../../utils/cloudinary";
import "./BoxSection.css";

const IMAGE_DURATION = 4500; // ms an image holds before auto-advancing
const VIDEO_MAX = 12000; // ms cap so a long video never stalls the story

// Hardcoded, on-brand copy (the admin title/description are intentionally
// ignored here — this section always tells the same premium packaging story).
const SECTION_LABEL = "Unboxing Luxury";
const STORY_TITLE = "Wrapped in Tradition";
const STORY_TEXT =
  "Every weave leaves Banaras in a handcrafted keepsake box — tissue-folded, wax-sealed, and tied with a note, so the moment it arrives feels like a celebration.";

// One admin entry → a full WhatsApp-style story: media auto-advances with a
// segmented progress bar, and the shopper can tap/click the left or right side
// to step back or forward. Hardcoded copy is overlaid; nothing is cropped.
const BoxStory = ({ entry }) => {
  const media = useMemo(() => [
    ...(Array.isArray(entry.videos) ? entry.videos.filter(Boolean).map((url) => ({ type: "video", url })) : []),
    ...(Array.isArray(entry.images) ? entry.images.filter(Boolean).map((url) => ({ type: "image", url })) : []),
  ], [entry]);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const single = media.length <= 1;
  const videoElRef = useRef(null);

  const step = useCallback((dir) => {
    setProgress(0);
    setActive((index) => (index + dir + media.length) % media.length);
  }, [media.length]);

  const next = useCallback(() => { if (!single) step(1); }, [single, step]);
  const prev = useCallback(() => { if (!single) step(-1); }, [single, step]);

  // Images self-advance on a fixed timer; videos advance from their own
  // playback. The segment fill for images is a pure CSS animation (see
  // .bk-box-segment-fill) — driving it from `progress` state on every
  // animation frame previously fought with the bar's CSS transition and
  // never looked like it was filling.
  useEffect(() => {
    const item = media[active];
    if (!item || item.type !== "image") return undefined;
    const timer = setTimeout(next, IMAGE_DURATION);
    return () => clearTimeout(timer);
  }, [active, media, next]);

  // Safety-net cap for the current video only: advances the story if playback
  // stalls and `onEnded` never fires. Rescheduled on every timeupdate so a
  // healthy, playing video is never cut short, and always cleared when the
  // slide changes/unmounts — an inline ref callback here previously left the
  // OLD slide's timer running after advancing, which fired late and skipped
  // the NEW slide before it finished.
  useEffect(() => {
    const item = media[active];
    if (!item || item.type !== "video" || single) return undefined;
    const el = videoElRef.current;
    let capTimer = setTimeout(next, VIDEO_MAX);
    const resetCap = () => {
      clearTimeout(capTimer);
      capTimer = setTimeout(next, VIDEO_MAX);
    };
    el?.addEventListener("timeupdate", resetCap);
    return () => {
      clearTimeout(capTimer);
      el?.removeEventListener("timeupdate", resetCap);
    };
  }, [active, media, single, next]);

  if (!media.length) return null;
  const current = media[active];

  return (
    <div className="bk-box-item">
      <div className="bk-box-story">
      {/* Story-style segmented progress across the top. */}
      <div className="bk-box-segments" aria-hidden="true">
        {media.map((item, index) => {
          const isPast = index < active;
          const isCurrent = index === active;
          const isImageFill = isCurrent && item.type === "image";
          return (
            <span key={index} className="bk-box-segment">
              <i
                className={isImageFill ? "bk-box-segment-fill" : undefined}
                style={
                  isImageFill
                    ? { animationDuration: `${IMAGE_DURATION}ms` }
                    : { width: isPast ? "100%" : isCurrent ? `${progress * 100}%` : "0%" }
                }
              />
            </span>
          );
        })}
      </div>

      {/* Blurred fill so portrait/landscape media is never cropped. */}
      {current.type === "video" ? (
        <>
          <video className="bk-box-fill" src={current.url} autoPlay muted loop={single} playsInline preload="metadata" aria-hidden="true" />
          <video
            key={`${entry.id}-${active}`}
            ref={videoElRef}
            className="bk-box-front"
            src={current.url}
            autoPlay
            muted
            loop={single}
            playsInline
            preload="metadata"
            aria-label={STORY_TITLE}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(Math.min(1, v.currentTime / v.duration));
            }}
            onEnded={next}
          />
        </>
      ) : (
        <>
          <img className="bk-box-fill" src={imgUrl(current.url, 900)} alt="" aria-hidden="true" />
          <img key={`${entry.id}-${active}`} className="bk-box-front bk-box-kenburns" src={imgUrl(current.url, 1200)} alt={STORY_TITLE} />
        </>
      )}

      <span className="bk-box-scrim" aria-hidden="true" />

      {/* Brand chip */}
      <span className="bk-box-brand" aria-hidden="true">
        <i><Icon icon="lucide:crown" /></i>
        Banarasi Kala
      </span>

      {/* WhatsApp-style tap zones: left = previous, right = next. */}
      {!single && (
        <>
          <button type="button" className="bk-box-tap bk-box-tap--prev" onClick={prev} aria-label="Previous" />
          <button type="button" className="bk-box-tap bk-box-tap--next" onClick={next} aria-label="Next" />
        </>
      )}
      </div>

      {/* Copy sits below the story card, out of the media view. */}
      <div className="bk-box-caption">
        <span className="bk-box-eyebrow"><Icon icon="lucide:gift" /> Premium Packaging</span>
        <h3>{STORY_TITLE}</h3>
        <p>{STORY_TEXT}</p>
      </div>
    </div>
  );
};

// "Box Section" — admin-curated premium-packaging story on the home page
// (multiple images + multiple videos per entry; copy is hardcoded above).
const BoxSection = () => {
  const [entries, setEntries] = useState([]);

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
    <section className="bk-box-section">
      <span className="bk-box-sparkles" aria-hidden="true">
        {[
          { top: "12%", left: "9%", d: "0s", s: 13 },
          { top: "26%", left: "90%", d: "1.2s", s: 10 },
          { top: "72%", left: "6%", d: "0.6s", s: 11 },
          { top: "82%", left: "88%", d: "1.8s", s: 14 },
          { top: "48%", left: "94%", d: "2.4s", s: 9 },
        ].map((sp, i) => (
          <i key={i} style={{ top: sp.top, left: sp.left, animationDelay: sp.d, "--s": `${sp.s}px` }} />
        ))}
      </span>
      <div className="bk-box-shell">
        <div className="bk-box-head">
          <span className="bk-box-flourish" aria-hidden="true" />
          <span className="bk-box-head-label">{SECTION_LABEL}</span>
          <span className="bk-box-flourish bk-box-flourish--r" aria-hidden="true" />
        </div>
        <div className="bk-box-stories">
          {entries.map((entry) => (
            <BoxStory key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default BoxSection;
