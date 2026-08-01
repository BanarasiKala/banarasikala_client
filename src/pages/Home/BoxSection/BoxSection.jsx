import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../../config/api";
import { imgUrl } from "../../../utils/cloudinary";
import "./BoxSection.css";

const IMAGE_DURATION = 4500; // ms an image holds before auto-advancing
const VIDEO_MAX = 12000; // ms cap so a long video never stalls the story

// Hardcoded, on-brand copy (the admin title/description are intentionally
// ignored here — this section always tells the same premium packaging story).
const SECTION_LABEL = "Unboxing Luxury";
// Names the media for screen readers only. The caption below no longer prints a title of its
// own — the pill already says what this is, and a serif headline above it said it twice.
const STORY_TITLE = "Premium gift packaging";
// One flowing paragraph — the two sentences wrap wherever the width happens to put them
// rather than being forced onto a line each.
const STORY_TEXT =
  "Orders above ₹5,000 come in our premium luxury box. A keepsake box made to hold more than just your saree.";
const STORY_CLOSER = "Feel the premium. Feel the luxury.";

/**
 * The story itself — segmented bar, media, tap zones, auto-advance.
 *
 * Rendered twice over a story's life: once inline in the section, and once inside the
 * fullscreen overlay. Both go through this so the two can never drift — the bar, the
 * timings and the tap behaviour are defined once, and `fullscreen` only changes the frame
 * around them.
 *
 * `frozen` stands the whole thing down: timers stop and the video pauses. The inline copy is
 * frozen while the overlay is open, so two elements are never decoding the same video and
 * the story does not advance twice per tick behind the viewer's back.
 */
const StoryStage = ({
  entry,
  media,
  fullscreen = false,
  frozen = false,
  startIndex = 0,
  onIndexChange,
  onExpand,
  onClose,
}) => {
  const [active, setActive] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  // Has the current slide loaded enough to be worth showing? False on every change and
  // until the media says otherwise, which is what holds the story in place.
  const [ready, setReady] = useState(false);
  // A video that stalled mid-playback. Separate from `ready` because the first is "has it
  // started" and this is "has it stopped again" — both freeze the story, for different
  // reasons, and only the second can happen repeatedly on one slide.
  const [buffering, setBuffering] = useState(false);
  const single = media.length <= 1;
  const videoElRef = useRef(null);

  // Nothing advances while the slide is still loading or has stalled. Without this the
  // timers below ran on wall-clock time, so a slow video was replaced by the next slide
  // before a single frame of it had been seen. `frozen` joins it: a backgrounded copy must
  // not tick along on its own.
  const stillLoading = !ready || buffering;
  // The spinner tracks `stillLoading` alone. `holding` also covers being frozen, which stops
  // the timers without claiming to the viewer that anything is downloading.
  const holding = stillLoading || frozen;

  // Reported up so the other copy can open on the slide this one was showing — tapping
  // expand on slide 3 and landing back on slide 1 would lose the viewer's place.
  useEffect(() => { onIndexChange?.(active); }, [active, onIndexChange]);

  // Seeding useState above only covers the first render, so the inline copy — which stays
  // mounted the whole time the overlay is up — would ignore where full view got to and carry
  // on from wherever it was frozen. Remounting it instead would re-download the slide.
  useEffect(() => {
    setActive(startIndex);
    setProgress(0);
  }, [startIndex]);

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
    // Waits for the image too: its hold is meant to be four and a half seconds of the
    // photo, not of a blank frame while it downloads.
    if (holding) return undefined;
    const timer = setTimeout(next, IMAGE_DURATION);
    return () => clearTimeout(timer);
  }, [active, media, next, holding]);

  /**
   * The current slide's readiness, and keeping video playing.
   *
   * Every slide starts unready — `active` is in the deps, so switching resets it — and a
   * video reports its own state from here on: `canplay`/`playing` mean it is running,
   * `waiting`/`stalled` mean it has run out of data. `error` clears the hold too, because
   * a dead URL would otherwise freeze the story on a spinner forever.
   *
   * play() is called explicitly rather than relying on the autoPlay attribute alone. The
   * attribute only acts on the initial mount, and these elements are keyed by slide, so
   * this is what makes a video start when the shopper taps across to it — and what
   * recovers if a browser refused the autoplay the first time.
   */
  useEffect(() => {
    const item = media[active];
    setBuffering(false);

    if (!item) return undefined;
    if (item.type !== "video") {
      // Images report through onLoad on the element itself.
      setReady(false);
      return undefined;
    }

    const el = videoElRef.current;
    if (!el) return undefined;

    // HAVE_FUTURE_DATA or better means it can already play — a cached video never fires
    // `canplay` again, so reading readyState is what stops it hanging on a spinner.
    setReady(el.readyState >= 3);

    const stalled = () => setBuffering(true);
    const rolling = () => { setReady(true); setBuffering(false); };
    el.addEventListener("waiting", stalled);
    el.addEventListener("stalled", stalled);
    el.addEventListener("canplay", rolling);
    el.addEventListener("playing", rolling);
    el.addEventListener("error", rolling);
    // The inline copy is frozen while the overlay is up: leaving it playing would decode the
    // same video twice and, on a phone, play its audio track a second time.
    if (frozen) el.pause();
    else el.play().catch(() => {});

    return () => {
      el.removeEventListener("waiting", stalled);
      el.removeEventListener("stalled", stalled);
      el.removeEventListener("canplay", rolling);
      el.removeEventListener("playing", rolling);
      el.removeEventListener("error", rolling);
    };
  }, [active, media, frozen]);

  // Safety-net cap for the current video only: advances the story if playback
  // stalls and `onEnded` never fires. Rescheduled on every timeupdate so a
  // healthy, playing video is never cut short, and always cleared when the
  // slide changes/unmounts — an inline ref callback here previously left the
  // OLD slide's timer running after advancing, which fired late and skipped
  // the NEW slide before it finished.
  useEffect(() => {
    const item = media[active];
    if (!item || item.type !== "video" || single) return undefined;
    // The cap now measures PLAYING time, not wall time: it is not armed while the slide
    // is loading or stalled, so a twelve-second buffer can no longer count as a
    // twelve-second video and skip it unseen.
    if (holding) return undefined;
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
  }, [active, media, single, next, holding]);

  if (!media.length) return null;
  const current = media[active];

  return (
    <div className={`bk-box-story${fullscreen ? " bk-box-story--fs" : ""}`}>
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
          <img
            key={`${entry.id}-${active}`}
            className="bk-box-front bk-box-kenburns"
            src={imgUrl(current.url, 1200)}
            alt={STORY_TITLE}
            // The image's own hold does not start until it is on screen — and onError
            // releases it too, so a broken URL cannot park the story on a spinner.
            onLoad={() => setReady(true)}
            onError={() => setReady(true)}
          />
        </>
      )}

      <span className="bk-box-scrim" aria-hidden="true" />

      {/* Centred over the story while the slide is loading or has stalled. Above the
          scrim so it stays legible, below the tap zones so a shopper can still skip a
          slide that is taking too long. */}
      {stillLoading && (
        <span className="bk-box-loader" aria-label="Loading">
          <i />
        </span>
      )}

      {/* Brand chip */}
      <span className="bk-box-brand" aria-hidden="true">
        <i><Icon icon="lucide:crown" /></i>
        Banarasi Kala
      </span>

      {/* Above the tap zones in the stacking order, so the corner they sit in belongs to
          them — the zones cover the whole card and would otherwise swallow the tap. */}
      <button
        type="button"
        className={`bk-box-corner bk-box-corner--${fullscreen ? "close" : "expand"}`}
        onClick={fullscreen ? onClose : onExpand}
        aria-label={fullscreen ? "Close full view" : "Open full view"}
      >
        <Icon icon={fullscreen ? "lucide:x" : "lucide:maximize-2"} />
      </button>

      {/* WhatsApp-style tap zones: left = previous, right = next. */}
      {!single && (
        <>
          <button type="button" className="bk-box-tap bk-box-tap--prev" onClick={prev} aria-label="Previous" />
          <button type="button" className="bk-box-tap bk-box-tap--next" onClick={next} aria-label="Next" />
        </>
      )}
    </div>
  );
};

// One admin entry → a full WhatsApp-style story with hardcoded copy beneath it, plus the
// Instagram-style full view the card expands into.
const BoxStory = ({ entry }) => {
  const media = useMemo(() => [
    ...(Array.isArray(entry.videos) ? entry.videos.filter(Boolean).map((url) => ({ type: "video", url })) : []),
    ...(Array.isArray(entry.images) ? entry.images.filter(Boolean).map((url) => ({ type: "image", url })) : []),
  ], [entry]);

  const [expanded, setExpanded] = useState(false);
  // Where each copy had got to, so opening and closing resumes on the same slide instead of
  // snapping back to the first one.
  const inlineIndex = useRef(0);
  const fsIndex = useRef(0);
  const [resumeAt, setResumeAt] = useState(0);
  // State, not the ref, because it is read during render to seed the overlay — and it is
  // only ever written from the click that opens it, so there is nothing to keep in sync.
  const [fsStart, setFsStart] = useState(0);

  const openFull = useCallback(() => {
    fsIndex.current = inlineIndex.current;
    setFsStart(inlineIndex.current);
    setExpanded(true);
  }, []);

  const closeFull = useCallback(() => {
    setResumeAt(fsIndex.current);
    setExpanded(false);
  }, []);

  // Memoised: StoryStage reports its slide from an effect that depends on this, so an inline
  // arrow would re-fire it on every render of this component.
  const trackInline = useCallback((index) => { inlineIndex.current = index; }, []);
  const trackFullscreen = useCallback((index) => { fsIndex.current = index; }, []);

  /**
   * While the overlay is up: Escape closes it, and the page behind does not scroll.
   *
   * `overflow: hidden` on <body> is the lock every other panel on this site uses — the
   * lightbox, the invoice viewer, the bottom sheets. Pinning the body with `position: fixed`
   * holds iOS more firmly, but it also has to restore the scroll offset on release, and
   * ScrollToTop is written around the overflow pattern specifically (it re-asserts its scroll
   * over the following frames because a releasing lock hands back an offset). A second kind
   * of lock it does not know about would fight it.
   */
  useEffect(() => {
    if (!expanded) return undefined;

    const onKey = (event) => { if (event.key === "Escape") closeFull(); };
    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded, closeFull]);

  if (!media.length) return null;

  return (
    <div className="bk-box-item">
      <StoryStage
        entry={entry}
        media={media}
        frozen={expanded}
        startIndex={resumeAt}
        onIndexChange={trackInline}
        onExpand={openFull}
      />

      {/* Copy sits below the story card, out of the media view. */}
      <div className="bk-box-caption">
        <span className="bk-box-eyebrow"><Icon icon="lucide:gift" /> Premium Gift Packaging</span>
        <p>{STORY_TEXT}</p>
        <strong className="bk-box-closer">{STORY_CLOSER}</strong>
      </div>

      {/* Portalled to <body>: nested inside the section it would inherit the page's stacking
          context and sit under the sticky header, and the section's own transforms would
          make `position: fixed` resolve against the section instead of the viewport. */}
      {expanded && createPortal(
        <div className="bk-box-fs" role="dialog" aria-modal="true" aria-label={STORY_TITLE}>
          <StoryStage
            entry={entry}
            media={media}
            fullscreen
            startIndex={fsStart}
            onIndexChange={trackFullscreen}
            onClose={closeFull}
          />
        </div>,
        document.body,
      )}
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
