import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { API_ENDPOINTS } from "../../config/api";
import "./ReelsFab.css";

/**
 * Floating shortcut to the shoppable reels feed — a miniature reel, shaped like one.
 *
 * A 2:3 portrait card playing the newest reel muted on a loop, behind a rotating gold ring.
 * The button is a window onto the feed it opens, so what moves inside it is the thing being
 * advertised rather than an icon standing in for it.
 *
 * Everything degrades: no reel, a failed request, or a browser that refuses to autoplay
 * leaves the drawn film mark in place. That mark is also what shows while the video is
 * still loading, so the card is never blank.
 */

// Spaced 4 units apart, with one row above and one below the 24-unit box so no gap scrolls
// into view at either edge. The CSS travels the strip by that same 4 units — the two have to
// stay in step or the loop will visibly jump.
const SPROCKET_ROWS = [-4, 0, 4, 8, 12, 16, 20, 24];

const FilmMark = () => (
  <svg className="bk-reels-fab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id="bk-reels-fab-body">
        <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="4.2" />
      </clipPath>
    </defs>

    <g clipPath="url(#bk-reels-fab-body)">
      <g className="bk-reels-fab-strip">
        {SPROCKET_ROWS.map((y) => (
          <g key={y}>
            <rect x="3.9" y={y + 1.2} width="1.9" height="1.9" rx="0.55" />
            <rect x="18.2" y={y + 1.2} width="1.9" height="1.9" rx="0.55" />
          </g>
        ))}
      </g>
    </g>

    <rect
      className="bk-reels-fab-body"
      x="2.6"
      y="2.6"
      width="18.8"
      height="18.8"
      rx="4.2"
      fill="none"
      strokeWidth="1.7"
    />
    <path className="bk-reels-fab-mark" d="M10.1 9.1 L15.4 12 L10.1 14.9 Z" />
  </svg>
);

const ReelsFab = () => {
  const [reel, setReel] = useState(null);
  // Only true once the video is genuinely rolling. Until then the film mark stays up, so a
  // browser that blocks autoplay leaves a drawn icon rather than a frozen black frame.
  const [rolling, setRolling] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_ENDPOINTS.reels}?limit=1`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const first = Array.isArray(data?.reels) ? data.reels[0] : null;
        if (first?.video_url) setReel(first);
      })
      .catch(() => {
        /* the film mark is the fallback */
      });
    return () => controller.abort();
  }, []);

  // Muted autoplay is the one kind every browser permits, so this generally succeeds. If it
  // does not, `rolling` stays false and the card keeps the drawn mark.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Set as a property, not left to the JSX attribute: React does not reliably apply
    // `muted` to the DOM node, and a video the browser considers unmuted has its autoplay
    // refused outright.
    video.muted = true;
    video.play().catch(() => setRolling(false));
  }, [reel]);

  return (
    <Link to="/reels" className="bk-reels-fab" aria-label="Watch shoppable reels">
      <span className="bk-reels-fab-card">
        {reel && (
          <video
            ref={videoRef}
            className={`bk-reels-fab-video${rolling ? " is-rolling" : ""}`}
            src={reel.video_url}
            poster={reel.thumbnail_url || undefined}
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            onPlaying={() => setRolling(true)}
            onPause={() => setRolling(false)}
          />
        )}

        {/* Shows through until the video covers it. */}
        {!rolling && <FilmMark />}

        {rolling && (
          <>
            <span className="bk-reels-fab-scrim" aria-hidden="true" />
            <span className="bk-reels-fab-play" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor" focusable="false">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="bk-reels-fab-live" aria-hidden="true">
              <i />
              Reels
            </span>
          </>
        )}
      </span>
    </Link>
  );
};

export default ReelsFab;
