import { useEffect, useRef } from "react";

/**
 * Stops playing media the moment the site is no longer on screen, everywhere in the app.
 *
 * On a phone, leaving the browser — switching apps, opening a link, taking a call, locking
 * the screen — does not reliably stop an HTML5 video. Android Chrome in particular keeps a
 * playing <video> going, so a reel's audio carries on over whatever the person opened next,
 * with no visible player to stop it. iOS is better behaved but not consistent across
 * versions. This makes the behaviour the same everywhere, and it also stops the site
 * decoding video in the background on someone's data and battery.
 *
 * Two signals, because they cover different exits:
 *   visibilitychange → hidden   app switch, tab switch, screen lock, minimise
 *   pagehide                    navigating away, closing, going into the bfcache
 *
 * Deliberately NOT `blur`: that also fires for a file picker, an autofill dropdown or a
 * devtools click, none of which mean the viewer has left.
 *
 * Covers everything with a <video> — the reels feed, the product gallery's Plyr player
 * (Plyr wraps a real element, and it follows the element's own pause event, so its
 * controls stay in step), the Banaras Royale viewer and every ambient loop.
 *
 * ── What resumes, and what does not ──
 * Only ambient loops restart: a video that is BOTH `autoplay` and `muted` is decoration
 * the page started on its own — the Box Section fill, the occasion cards, the home reel
 * rail — and leaving those frozen would look like a broken image. Anything the reader
 * pressed play on stays paused, because a reel that quietly resumes talking on return is
 * the same intrusion one screen later. The reel's play badge reflects it: ReelItem mirrors
 * the element's own pause/play events.
 */
const MediaAutoPause = () => {
  // Only elements THIS paused are candidates to resume, so media the reader had already
  // paused before leaving is never started for them.
  const pausedByUs = useRef(new Set());

  useEffect(() => {
    const pauseAll = () => {
      // Queried live rather than tracked in a registry: media mounts and unmounts all over
      // the app, and a registry would have to be threaded through every one of them.
      for (const el of document.querySelectorAll("video, audio")) {
        if (el.paused) continue;
        pausedByUs.current.add(el);
        el.pause();
      }
    };

    const resumeAmbient = () => {
      for (const el of pausedByUs.current) {
        // isConnected: the element may have unmounted while the app was in the background.
        if (el.isConnected && el.autoplay && el.muted) el.play().catch(() => {});
      }
      pausedByUs.current.clear();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") pauseAll();
      else resumeAmbient();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", pauseAll);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", pauseAll);
    };
  }, []);

  return null;
};

export default MediaAutoPause;
