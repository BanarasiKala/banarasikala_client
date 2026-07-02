import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";
import ReelsFab from "../ReelsFab/ReelsFab";
import "./ReelBags.css";

// Home-page replacement for the ReelsFab: three shopping bags hang from a
// shared pin at the bottom-left, swinging like pendulums, each playing a live
// reel inside. Tapping a bag opens that exact reel in the feed. Falls back to
// the classic ReelsFab when there are no published reels to show.
const ReelBags = () => {
  const navigate = useNavigate();
  const [reels, setReels] = useState(null); // null = loading

  useEffect(() => {
    let ignore = false;
    fetch(`${API_ENDPOINTS.reels}?limit=3`)
      .then((res) => (res.ok ? res.json() : { reels: [] }))
      .then((data) => {
        if (!ignore) setReels((Array.isArray(data.reels) ? data.reels : []).slice(0, 3));
      })
      .catch(() => {
        if (!ignore) setReels([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (reels === null) return null;
  if (!reels.length) return <ReelsFab />;

  return (
    <div className="bk-reel-bags" aria-label="Shoppable reels">
      <span className="bk-reel-bags-pin" aria-hidden="true" />
      {reels.map((reel, index) => (
        <button
          key={reel.id}
          type="button"
          className={`bk-reel-bag bk-reel-bag-${index + 1}`}
          onClick={() => navigate(`/reels?reel=${reel.id}`)}
          aria-label={`Watch reel${reel.title ? `: ${reel.title}` : ""}`}
        >
          <span className="bk-reel-bag-string" aria-hidden="true" />
          <span className="bk-reel-bag-knot" aria-hidden="true" />
          <span className="bk-reel-bag-handle" aria-hidden="true" />
          {/* Gold shell clipped to a shopping-bag silhouette; the media layer
              inside repeats the clip slightly inset, leaving a gold rim. */}
          <span className="bk-reel-bag-body">
            <span className="bk-reel-bag-media">
              {reel.thumbnail_url && (
                <img className="bk-reel-bag-poster" src={reel.thumbnail_url} alt="" loading="lazy" />
              )}
              <video
                className="bk-reel-bag-video"
                src={reel.video_url}
                poster={reel.thumbnail_url || undefined}
                muted
                loop
                autoPlay
                playsInline
                preload="metadata"
                disablePictureInPicture
                tabIndex={-1}
                aria-hidden="true"
                onError={(e) => {
                  // Broken video → let the poster <img> underneath show through
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="bk-reel-bag-play">
                <Play size={11} fill="currentColor" strokeWidth={0} />
              </span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
};

export default ReelBags;
