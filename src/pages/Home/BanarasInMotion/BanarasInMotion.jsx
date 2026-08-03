import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../../config/api";
import { useLazyVideoSrc } from "../../../hooks/useLazyVideoSrc";
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

  // Downloads follow visibility. Playback is governed separately, further down: a card can be
  // on screen and paused (decoder budget, backgrounded tab) without that undoing the fetch.
  useLazyVideoSrc(railRef, [reels]);

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

  /**
   * Keep the rail running.
   *
   * `autoplay muted loop` starts these once and then stops being a guarantee. Browsers stop
   * autoplaying video that is not on screen — Chrome on Android pauses an off-screen muted
   * loop and never brings it back — and a rail of eight decoders also runs past the limit
   * mobile Safari and Chrome put on simultaneous video, which leaves the later cards frozen
   * on their poster. The `loadeddata` nudge on each element only ever fired once, so
   * anything stopped afterwards stayed stopped.
   *
   * So playback follows visibility: what is on screen runs, what is not is paused. That
   * keeps the rail alive and spends the decode budget on the cards someone is looking at.
   * IntersectionObserver against the viewport covers both axes at once — a card scrolled
   * out sideways is clipped by the rail's own overflow, which counts as not intersecting.
   */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !reels?.length) return undefined;

    const onScreen = new Set();
    // A video that cannot play at all (codec, 404, decoder exhausted) fires `pause` right
    // back at us, and restarting it on that would spin. Three strikes, cleared by a real
    // `playing`, keeps a genuinely broken card quiet without giving up on a recoverable one.
    const strikes = new Map();
    const retryTimers = new Set();

    const revive = (video) => {
      if (document.visibilityState !== "visible" || !onScreen.has(video)) return;
      if ((strikes.get(video) || 0) >= 3) return;
      strikes.set(video, (strikes.get(video) || 0) + 1);
      forcePlay(video);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target;
          if (entry.isIntersecting) {
            onScreen.add(video);
            strikes.delete(video);
            forcePlay(video);
          } else {
            onScreen.delete(video);
            if (!video.paused) video.pause();
          }
        }
      },
      { threshold: 0.1 }
    );

    const videos = rail.querySelectorAll("video");
    videos.forEach((video) => io.observe(video));

    // `pause` and `playing` do not bubble, so they are caught on the way down instead.
    const onPause = (event) => {
      // Delayed a beat: a pause during a seek or a source switch is transient, and jumping
      // on it immediately fights the element instead of letting it settle.
      const timer = window.setTimeout(() => {
        retryTimers.delete(timer);
        revive(event.target);
      }, 400);
      retryTimers.add(timer);
    };
    const onPlaying = (event) => strikes.delete(event.target);
    rail.addEventListener("pause", onPause, true);
    rail.addEventListener("playing", onPlaying, true);

    // Coming back from another app: MediaAutoPause stopped these on the way out and resumes
    // muted autoplay loops on return, but a card the browser had already dropped on its own
    // is not in its set. Sweeping what is on screen here picks up the rest.
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      strikes.clear();
      onScreen.forEach(forcePlay);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      io.disconnect();
      rail.removeEventListener("pause", onPause, true);
      rail.removeEventListener("playing", onPlaying, true);
      document.removeEventListener("visibilitychange", onVisibility);
      retryTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [reels]);

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
            ? /* Keeps the card's gold zari frame and puts the shimmer on the inner
                 panel, where the reel itself will be — the placeholder used to paint
                 over the frame, so the rail lost its edging until the reels landed. */
              [1, 2, 3, 4, 5].map((placeholder) => (
                <div key={placeholder} className="bk-motion-card bk-motion-skeleton" aria-hidden="true">
                  <span className="bk-motion-card-inner" />
                </div>
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
                        /* Attached by useLazyVideoSrc once the card nears the viewport —
                           see the hook for why `preload` cannot do this job here. */
                        data-src={reel.video_url}
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
