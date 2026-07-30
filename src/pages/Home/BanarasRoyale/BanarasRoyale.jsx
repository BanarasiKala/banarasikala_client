import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../../config/api";
import { imgUrl } from "../../../utils/cloudinary";
import "./BanarasRoyale.css";

// Press-and-hold on the polaroid to blow it up full screen; let go and it drops back.
// The same pointer can also DRAG the polaroid, so the two gestures have to be told apart:
// a press that moves more than a few pixels before the timer fires is a drag and cancels
// the hold. Any further movement once zoomed is ignored rather than dragging underneath.
const LONG_PRESS_MS = 400;
const DRAG_TOLERANCE_PX = 8;

// One showcase stage: the entry's video plays as the cinematic backdrop while
// its images float in over it one by one (polaroid-style, cycling). The
// polaroid is draggable — the shopper can move it anywhere inside the video.
const RoyaleStage = ({ entry }) => {
  const images = Array.isArray(entry.images) ? entry.images.filter(Boolean) : [];
  const [imageIndex, setImageIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsMuted, setFsMuted] = useState(false);
  // The full-screen video's own readiness. Same rule as the backdrop: a loader while it has no
  // data, and nothing else — no play button, because it is never paused.
  const [fsReady, setFsReady] = useState(false);
  const fsVideoRef = useRef(null);
  // null → the CSS default spot (with the bob animation); {x,y} once dragged.
  const [floatPos, setFloatPos] = useState(null);
  // While dragging: lift effect + tilt that leans into the movement direction.
  const [dragFx, setDragFx] = useState(null); // { tilt } | null
  // Held full-screen preview of the polaroid, while the finger stays down.
  const [zoomed, setZoomed] = useState(false);
  // Has the backdrop got enough data to show a frame? False until the media says otherwise, and
  // again whenever it runs dry mid-playback. Until then the stage is just its own near-black
  // background, which reads as broken rather than loading.
  const [mediaReady, setMediaReady] = useState(false);
  const stageRef = useRef(null);
  const floatRef = useRef(null);
  const dragRef = useRef(null); // pointer offset inside the polaroid while dragging
  const lastXRef = useRef(0);
  const tiltSettleRef = useRef(null);
  const videoRef = useRef(null);
  const holdTimerRef = useRef(null);
  // Where the press started, and whether it has since travelled far enough to be a drag.
  const pressRef = useRef(null); // { x, y, moved }

  useEffect(() => {
    if (images.length <= 1) return undefined;
    const timer = setInterval(() => setImageIndex((index) => index + 1), 3400);
    return () => clearInterval(timer);
  }, [images.length]);

  // Keep the cinematic backdrop playing forever. `autoPlay` only fires once, on mount — but
  // mobile browsers pause a muted video when the tab is backgrounded (switching apps, another
  // tab) and frequently do NOT resume it on return, leaving a frozen frame that reads as the
  // video "closing". We re-issue play() whenever the page becomes visible again, whenever the
  // page is restored from the back/forward cache (pageshow), and whenever the element reports it
  // was paused while still on-screen. A muted video is always allowed to autoplay, so play() is
  // safe to call repeatedly (a no-op when already playing; the rejection is swallowed if blocked).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !entry.video) return undefined;

    const play = () => { const p = video.play(); if (p && typeof p.catch === "function") p.catch(() => {}); };
    play();

    const onVisible = () => { if (!document.hidden) play(); };
    const onPageShow = () => play();
    // The browser pausing it for any reason (backgrounding, low-power mode) — resume if we're
    // actually on-screen. `loop` videos don't fire `pause` when they wrap, so this never fights
    // the loop.
    const onPause = () => { if (!document.hidden) play(); };

    // HAVE_FUTURE_DATA or better means it can already paint — a cached video never fires
    // `canplay` again, so reading readyState is what stops the loader hanging over a video that
    // is in fact ready to go.
    setMediaReady(video.readyState >= 3);
    const rolling = () => setMediaReady(true);
    const stalled = () => setMediaReady(false);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    video.addEventListener("pause", onPause);
    video.addEventListener("canplay", rolling);
    video.addEventListener("playing", rolling);
    video.addEventListener("waiting", stalled);
    video.addEventListener("stalled", stalled);
    // A dead URL clears the loader too. Leaving it spinning forever over a video that is never
    // going to arrive is the one outcome worse than showing the bare stage.
    video.addEventListener("error", rolling);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("canplay", rolling);
      video.removeEventListener("playing", rolling);
      video.removeEventListener("waiting", stalled);
      video.removeEventListener("stalled", stalled);
      video.removeEventListener("error", rolling);
    };
  }, [entry.video]);

  /**
   * The full-screen viewer: lock the page behind it, Escape closes it, and keep the video
   * playing.
   *
   * There is no pause here, by design — no play button, and tapping the video does nothing.
   * The only states it can be in are "playing" and "still loading", and the loader covers the
   * second. So a `pause` from any source (a browser backgrounding the tab, low-power mode, an
   * autoplay refusal that resolves later) is answered by playing again rather than by showing a
   * button and waiting to be asked.
   */
  useEffect(() => {
    if (!fullscreen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => { if (event.key === "Escape") setFullscreen(false); };
    document.addEventListener("keydown", onKey);

    const video = fsVideoRef.current;
    if (!video) {
      return () => {
        document.body.style.overflow = prevOverflow;
        document.removeEventListener("keydown", onKey);
      };
    }

    setFsMuted(video.muted);
    setFsReady(video.readyState >= 3);
    const play = () => { const p = video.play(); if (p && typeof p.catch === "function") p.catch(() => {}); };
    play();

    const rolling = () => { setFsReady(true); };
    const stalled = () => setFsReady(false);
    const onPause = () => play();

    video.addEventListener("canplay", rolling);
    video.addEventListener("playing", rolling);
    video.addEventListener("waiting", stalled);
    video.addEventListener("stalled", stalled);
    // A dead URL must not leave the loader spinning over nothing forever.
    video.addEventListener("error", rolling);
    video.addEventListener("pause", onPause);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      video.removeEventListener("canplay", rolling);
      video.removeEventListener("playing", rolling);
      video.removeEventListener("waiting", stalled);
      video.removeEventListener("stalled", stalled);
      video.removeEventListener("error", rolling);
      video.removeEventListener("pause", onPause);
    };
  }, [fullscreen]);

  const toggleFsMute = () => {
    const video = fsVideoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setFsMuted(video.muted);
  };

  const startDrag = (event) => {
    const stage = stageRef.current;
    const float = floatRef.current;
    if (!stage || !float) return;
    event.preventDefault();
    const stageBox = stage.getBoundingClientRect();
    const floatBox = float.getBoundingClientRect();
    dragRef.current = { dx: event.clientX - floatBox.left, dy: event.clientY - floatBox.top };
    float.setPointerCapture?.(event.pointerId);
    lastXRef.current = event.clientX;
    const startX = floatBox.left - stageBox.left;
    const startY = floatBox.top - stageBox.top;
    setDragFx({ tilt: 0, cx: startX + floatBox.width / 2, cy: startY + floatBox.height / 2 });
    setFloatPos({ x: startX, y: startY });

    // Arm the hold. Cancelled below the moment the pointer travels like a drag.
    pressRef.current = { x: event.clientX, y: event.clientY, moved: false };
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => setZoomed(true), LONG_PRESS_MS);
  };

  const moveDrag = (event) => {
    if (!dragRef.current) return;
    // Zoomed: the gesture has become "hold to look", so movement no longer drags. Without
    // this the polaroid would be slid around behind the overlay and reappear somewhere else.
    if (zoomed) return;

    const press = pressRef.current;
    if (press && !press.moved) {
      const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      if (travelled > DRAG_TOLERANCE_PX) {
        press.moved = true;
        clearTimeout(holdTimerRef.current);
      }
    }

    const stage = stageRef.current;
    const float = floatRef.current;
    if (!stage || !float) return;
    const stageBox = stage.getBoundingClientRect();
    const x = Math.min(Math.max(0, event.clientX - stageBox.left - dragRef.current.dx), stageBox.width - float.offsetWidth);
    const y = Math.min(Math.max(0, event.clientY - stageBox.top - dragRef.current.dy), stageBox.height - float.offsetHeight);
    setFloatPos({ x, y });

    // Lean into the horizontal movement, then settle upright when the hand pauses.
    const deltaX = event.clientX - lastXRef.current;
    lastXRef.current = event.clientX;
    setDragFx({
      tilt: Math.max(-11, Math.min(11, deltaX * 1.1)),
      cx: x + float.offsetWidth / 2,
      cy: y + float.offsetHeight / 2,
    });
    clearTimeout(tiltSettleRef.current);
    tiltSettleRef.current = setTimeout(() => setDragFx((fx) => (fx ? { ...fx, tilt: 0 } : fx)), 110);
  };

  const endDrag = (event) => {
    dragRef.current = null;
    clearTimeout(tiltSettleRef.current);
    clearTimeout(holdTimerRef.current);
    setDragFx(null);
    // Letting go drops the polaroid back out of full screen — the zoom is held, not toggled.
    setZoomed(false);
    // A press that never travelled was not a drag, so hand the polaroid back to its CSS home
    // and let the bob resume. startDrag pins left/top on pointerdown (it has to, to convert
    // from the default anchoring), which would otherwise leave a tapped polaroid frozen in
    // place for good.
    if (pressRef.current && !pressRef.current.moved) setFloatPos(null);
    pressRef.current = null;
    floatRef.current?.releasePointerCapture?.(event.pointerId);
  };

  useEffect(() => () => {
    clearTimeout(tiltSettleRef.current);
    clearTimeout(holdTimerRef.current);
  }, []);

  // The page must not scroll behind the held preview — on a phone the hold and a scroll start
  // the same way, and one that slips through leaves the overlay pinned over a moved page.
  useEffect(() => {
    if (!zoomed) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [zoomed]);

  const product = entry.Product || null;
  const currentImage = images.length ? images[imageIndex % images.length] : null;

  return (
    <div className={`bk-royale-stage${dragFx ? " is-drag-live" : ""}`} ref={stageRef}>
      {entry.video ? (
        <video
          ref={videoRef}
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
        <img
          className="bk-royale-media"
          src={imgUrl(currentImage, 1400)}
          alt={entry.title || "Banaras Royale"}
          // An entry with no video uses a photo as the backdrop; it reports its own readiness.
          // onError releases the loader for the same reason the video's does.
          onLoad={() => setMediaReady(true)}
          onError={() => setMediaReady(true)}
        />
      ) : null}
      <span className="bk-royale-scrim" aria-hidden="true" />

      {/* Centred over the stage while the backdrop is still downloading or has stalled. Above
          the scrim so it stays legible on any frame, below the polaroid and the copy so neither
          is blocked by it. */}
      {!mediaReady && (
        <span className="bk-royale-loader" aria-label="Loading">
          <i />
        </span>
      )}
      {/* Warm spotlight that follows the polaroid while it is being dragged. */}
      <span
        className="bk-royale-spot"
        aria-hidden="true"
        style={dragFx ? { "--spot-x": `${dragFx.cx}px`, "--spot-y": `${dragFx.cy}px` } : undefined}
      />

      {/* Floating polaroid — draggable anywhere inside the stage. The image
          swap animates on the inner <img> (keyed) so a cycle mid-drag never
          remounts the container or breaks pointer capture. */}
      {entry.video && currentImage && (
        <div
          ref={floatRef}
          className={`bk-royale-float${floatPos ? " is-free" : ""}${dragFx ? " is-dragging" : ""}`}
          style={{
            ...(floatPos ? { left: floatPos.x, top: floatPos.y, right: "auto", bottom: "auto" } : {}),
            ...(dragFx ? { rotate: `${4 + dragFx.tilt}deg` } : {}),
          }}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          // A long press on an image is iOS/Android's own "save image" gesture; without this the
          // OS menu opens over the preview and swallows the pointerup that closes it.
          onContextMenu={(event) => event.preventDefault()}
          title="Drag to move · press and hold to enlarge"
        >
          <img key={imageIndex % images.length} src={imgUrl(currentImage, 560)} alt="" draggable={false} />
        </div>
      )}

      {/* Held full-screen preview. Portaled to <body> because the stage clips its children
          (overflow: hidden for the rounded corners), so an overlay rendered inside it would be
          cropped to the stage rather than filling the viewport.
          pointer-events: none in CSS — the polaroid has pointer capture for this gesture, and
          the overlay must not intercept the pointerup that ends it. */}
      {zoomed && currentImage && createPortal(
        <div className="bk-royale-zoom" aria-hidden="true">
          <img src={imgUrl(currentImage, 1400)} alt="" draggable={false} />
          <span className="bk-royale-zoom-hint">Release to close</span>
        </div>,
        document.body,
      )}

      <div className="bk-royale-copy">
        {entry.title && <h3>{entry.title}</h3>}
        {entry.description && <p>{entry.description}</p>}
        {product?.slug && (
          <Link className="bk-royale-cta" to={`/product/${product.slug}`}>
            Shop this look
          </Link>
        )}
      </div>

      {/* Full-screen toggle, bottom-right of the stage. Opens a viewer with just the video. */}
      {entry.video && (
        <button
          type="button"
          className="bk-royale-fs-btn"
          onClick={() => setFullscreen(true)}
          aria-label="Play video in full screen"
          title="Full screen"
        >
          <Icon icon="lucide:maximize-2" />
        </button>
      )}

      {fullscreen && entry.video && (
        <div className="bk-royale-fs-overlay" role="dialog" aria-modal="true" aria-label={entry.title || "Banaras Royale video"}>
          <button
            type="button"
            className="bk-royale-fs-close"
            onClick={() => setFullscreen(false)}
            aria-label="Close full screen"
          >
            <Icon icon="lucide:x" />
          </button>

          {/* No native `controls` on purpose — that bar is the only thing that shows a fullscreen
              icon / three-dots / download, and `controlsList` isn't honoured on every browser.
              No tap-to-pause either: the video is always playing, so the only thing that can
              ever appear over it is the loader below. Mute and close are the whole control set. */}
          <video
            ref={fsVideoRef}
            className="bk-royale-fs-video"
            src={entry.video}
            autoPlay
            loop
            playsInline
          />

          {!fsReady && (
            <span className="bk-royale-loader bk-royale-loader--fs" aria-label="Loading">
              <i />
            </span>
          )}

          <button
            type="button"
            className="bk-royale-fs-mute"
            onClick={toggleFsMute}
            aria-label={fsMuted ? "Unmute" : "Mute"}
          >
            <Icon icon={fsMuted ? "lucide:volume-x" : "lucide:volume-2"} />
          </button>
        </div>
      )}
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
