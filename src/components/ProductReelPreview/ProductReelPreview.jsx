import { useCallback, useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";
import "./ProductReelPreview.css";

// Movement past this many pixels turns a press into a drag, so the player can be moved without
// every move also opening it full screen.
const DRAG_TOLERANCE_PX = 6;
// Keeps the card clear of the screen edges when dropped or after a resize.
const EDGE_GAP_PX = 8;

// If a published reel features this product, show a muted, floating mini-player
// bottom-right. Tapping it opens the reel full screen with sound; dragging moves it.
const ProductReelPreview = ({ productId }) => {
  const [reel, setReel] = useState(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Whether the mini-player is actually paused. The play badge used to render unconditionally,
  // so a looping, playing video permanently wore a "press play" button.
  const [paused, setPaused] = useState(false);
  // null = the CSS corner it starts in; {x,y} once dragged. Viewport coordinates, since the
  // card is position: fixed.
  const [pos, setPos] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fsVideoRef = useRef(null);
  const floatRef = useRef(null);
  const floatVideoRef = useRef(null);
  const dragRef = useRef(null); // { dx, dy, moved }

  useEffect(() => {
    if (!productId) return undefined;
    let ignore = false;
    const run = async () => {
      try {
        const res = await fetch(`${API_ENDPOINTS.reels}/product/${productId}`);
        const data = await res.json();
        if (!ignore) setReel(Array.isArray(data.reels) && data.reels.length ? data.reels[0] : null);
      } catch {
        if (!ignore) setReel(null);
      }
    };
    run();
    return () => { ignore = true; };
  }, [productId]);

  // When opened via a user tap, play full screen with sound.
  useEffect(() => {
    if (open && fsVideoRef.current) {
      fsVideoRef.current.muted = false;
      fsVideoRef.current.play().catch(() => {});
    }
  }, [open]);

  const openFullscreen = () => {
    setOpen(true);
    if (reel) fetch(`${API_ENDPOINTS.reels}/${reel.id}/view`, { method: "POST" }).catch(() => {});
  };

  // Keeps the card fully on screen — used when dropping it and again if the viewport changes
  // (rotation, the mobile keyboard, a resized window), which would otherwise strand it outside.
  const clamp = useCallback((x, y) => {
    const el = floatRef.current;
    const w = el?.offsetWidth || 124;
    const h = el?.offsetHeight || 216;
    return {
      x: Math.min(Math.max(EDGE_GAP_PX, x), window.innerWidth - w - EDGE_GAP_PX),
      y: Math.min(Math.max(EDGE_GAP_PX, y), window.innerHeight - h - EDGE_GAP_PX),
    };
  }, []);

  useEffect(() => {
    if (!pos) return undefined;
    const onResize = () => setPos((current) => (current ? clamp(current.x, current.y) : current));
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [pos, clamp]);

  const startDrag = (event) => {
    const el = floatRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    dragRef.current = {
      dx: event.clientX - box.left,
      dy: event.clientY - box.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    el.setPointerCapture?.(event.pointerId);
    // Convert from the CSS corner anchoring to explicit coordinates before the first move, or
    // the card would jump to the pointer.
    setPos({ x: box.left, y: box.top });
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved) {
      // Measured from where the press started. Below the tolerance this is still a tap —
      // treating it as a drag would make the player impossible to open with an unsteady thumb.
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_TOLERANCE_PX) return;
      drag.moved = true;
      setDragging(true);
    }
    event.preventDefault();
    setPos(clamp(event.clientX - drag.dx, event.clientY - drag.dy));
  };

  const endDrag = (event) => {
    const drag = dragRef.current;
    dragRef.current = null;
    floatRef.current?.releasePointerCapture?.(event.pointerId);
    setDragging(false);
    // A press that never travelled is a tap — open the reel. Anything else was a move, and
    // opening full screen at the end of it would be the opposite of what the hand asked for.
    if (drag && !drag.moved) openFullscreen();
  };

  if (!reel || dismissed) return null;

  return (
    <>
      {!open && (
        <div
          ref={floatRef}
          className={`bk-preel-float${pos ? " is-free" : ""}${dragging ? " is-dragging" : ""}`}
          // Position comes from state once dragged; `right`/`bottom` are cleared so the CSS
          // corner anchoring stops fighting the coordinates.
          style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <video
            ref={floatVideoRef}
            className="bk-preel-float-video"
            src={reel.video_url}
            poster={reel.thumbnail_url || undefined}
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            // The badge below follows these rather than being permanently on.
            onPlay={() => setPaused(false)}
            onPlaying={() => setPaused(false)}
            onPause={() => setPaused(true)}
          />
          {/* Only when the video is genuinely stopped — an autoplay a browser refused, or a
              phone in low-power mode. A looping video that is playing does not need a button
              telling the viewer to start it. */}
          {paused && <span className="bk-preel-float-play"><Play size={16} fill="#fff" /></span>}
          <button
            type="button"
            className="bk-preel-float-close"
            /*
             * The dismissal happens on click, deliberately, and the two pointer handlers exist
             * only to keep it reachable.
             *
             * Dismissing on pointerdown instead unmounted the card mid-gesture: the browser had
             * not yet chosen a click target, so the click that followed landed on whatever the
             * card had been covering — a colour swatch, Add to Cart — and fired it. Stopping
             * propagation here means the card's own onPointerDown never runs, so it never calls
             * setPointerCapture, which is what used to swallow this button's click and forced
             * the pointerdown workaround in the first place. By the time onClick runs the event
             * has already been delivered here, so nothing behind the card can receive it.
             */
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
            aria-label="Hide reel"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {open && (
        <div className="bk-preel-fs" onClick={() => setOpen(false)}>
          <button type="button" className="bk-preel-fs-close" onClick={() => setOpen(false)} aria-label="Close">
            <X size={26} />
          </button>
          <video
            ref={fsVideoRef}
            className="bk-preel-fs-video"
            src={reel.video_url}
            autoPlay
            loop
            playsInline
            controls
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default ProductReelPreview;
