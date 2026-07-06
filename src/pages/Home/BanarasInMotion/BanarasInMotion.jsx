import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../../config/api";
import "./BanarasInMotion.css";

const MAX_REELS = 8;

const formatCount = (value) => {
  const count = Number(value) || 0;
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(count);
};

// Nudge a paused video back into playback (rejections are fine — e.g. the
// browser blocked it until the tab is visible again).
const forcePlay = (video) => {
  if (video && video.paused) video.play().catch(() => {});
};

// "Banaras in Motion" — a cinematic dark rail of live, looping reels on the
// home page. Every card autoplays muted; tapping one opens the full reels
// player focused on that reel.
const BanarasInMotion = () => {
  const [reels, setReels] = useState(null); // null → loading skeleton
  const railRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(API_ENDPOINTS.reels, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (Array.isArray(data?.reels) ? data.reels : []);
        setReels(list.filter((reel) => reel.video_url).slice(0, MAX_REELS));
      })
      .catch(() => setReels([]));
    return () => controller.abort();
  }, []);

  // When the tab becomes visible again, resume any video the browser paused.
  useEffect(() => {
    const resumeAll = () => {
      if (document.visibilityState !== "visible") return;
      railRef.current?.querySelectorAll("video").forEach(forcePlay);
    };
    document.addEventListener("visibilitychange", resumeAll);
    return () => document.removeEventListener("visibilitychange", resumeAll);
  }, []);

  if (reels && reels.length === 0) return null;

  return (
    <section className="bk-motion-section">
      <div className="bk-motion-shell">
        <div className="bk-motion-head">
          <div className="bk-motion-heading">
            <span>Watch · Love · Shop</span>
            <h2>Banaras in Motion</h2>
          </div>
          <Link to="/reels" className="bk-motion-all">
            View all reels <Icon icon="lucide:arrow-right" />
          </Link>
        </div>

        <div className="bk-motion-rail" ref={railRef}>
          {reels === null
            ? [1, 2, 3, 4, 5].map((placeholder) => (
                <div key={placeholder} className="bk-motion-card bk-motion-skeleton" aria-hidden="true" />
              ))
            : reels.map((reel) => {
                const product = Array.isArray(reel.products) ? reel.products[0] : null;
                return (
                  <Link
                    key={reel.id}
                    to={`/reels?reel=${reel.id}`}
                    className="bk-motion-card"
                    aria-label={`Watch reel${reel.title ? `: ${reel.title}` : ""}`}
                  >
                    <span className="bk-motion-card-inner">
                      {reel.thumbnail_url && (
                        <img className="bk-motion-poster" src={reel.thumbnail_url} alt="" loading="lazy" />
                      )}
                      <video
                        className="bk-motion-video"
                        src={reel.video_url}
                        poster={reel.thumbnail_url || undefined}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        onLoadedData={(e) => {
                          const video = e.currentTarget;
                          if (!document.hidden) setTimeout(() => forcePlay(video), 150);
                        }}
                        onError={(e) => {
                          // Broken video → let the poster underneath show through.
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <span className="bk-motion-scrim" aria-hidden="true" />

                      {/* Reel chrome: brand handle with a spinning gold story
                          ring, views chip, and the vertical action rail. */}
                      <span className="bk-motion-handle" aria-hidden="true">
                        <i className="bk-motion-avatar"><Icon icon="lucide:crown" /></i>
                        banarasikala
                      </span>

                      <span className="bk-motion-actions" aria-hidden="true">
                        <span className={`bk-motion-action${reel.is_liked ? " is-liked" : ""}`}>
                          <Icon icon={reel.is_liked ? "mdi:heart" : "lucide:heart"} />
                          {Number(reel.like_count) > 0 && <b>{formatCount(reel.like_count)}</b>}
                        </span>
                        <span className="bk-motion-action">
                          <Icon icon="lucide:message-circle" />
                          {Number(reel.comment_count) > 0 && <b>{formatCount(reel.comment_count)}</b>}
                        </span>
                        <span className="bk-motion-action">
                          <Icon icon="lucide:send" />
                        </span>
                        <span className="bk-motion-action">
                          <Icon icon="lucide:eye" />
                          {Number(reel.view_count) > 0 && <b>{formatCount(reel.view_count)}</b>}
                        </span>
                      </span>

                      {/* Big play appears on hover, inviting the tap-through. */}
                      <span className="bk-motion-play" aria-hidden="true">
                        <Icon icon="lucide:play" />
                      </span>

                      <span className="bk-motion-meta">
                        {reel.title && <strong>{reel.title}</strong>}
                        {product && (
                          <span className="bk-motion-product">
                            <Icon icon="lucide:shopping-bag" />
                            <em>{product.name}</em>
                            {Number(product.selling_price) > 0 && (
                              <b>₹{Number(product.selling_price).toLocaleString("en-IN")}</b>
                            )}
                          </span>
                        )}
                      </span>

                      {/* Faux playback progress — sells the "live reel" feel. */}
                      <span className="bk-motion-progress" aria-hidden="true"><i /></span>
                    </span>
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
};

export default BanarasInMotion;
