import { useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";
import "./ProductReelPreview.css";

// If a published reel features this product, show a muted, floating mini-player
// bottom-right. Tapping it opens the reel full screen with sound.
const ProductReelPreview = ({ productId }) => {
  const [reel, setReel] = useState(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const fsVideoRef = useRef(null);

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

  if (!reel || dismissed) return null;

  return (
    <>
      {!open && (
        <div className="bk-preel-float" onClick={openFullscreen}>
          <video
            className="bk-preel-float-video"
            src={reel.video_url}
            poster={reel.thumbnail_url || undefined}
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
          />
          <span className="bk-preel-float-play"><Play size={16} fill="#fff" /></span>
          <button
            type="button"
            className="bk-preel-float-close"
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
