import { useEffect } from "react";

/**
 * Hold a video's download until it is close to being seen.
 *
 * `preload="metadata"` does not do this on an autoplaying element. The autoplay flag makes the
 * browser fetch the whole file the moment the element has a src, wherever that element happens
 * to sit on the page — measured on the home page, four autoplay loops pulled 54.7 MB before the
 * visitor had scrolled a single pixel, three of them for cards below the fold.
 *
 * So the src is withheld until the element nears the viewport. The `poster` carries the tile in
 * the meantime, which is why reel posters had to exist before this was worth doing: without one,
 * a video that has not started loading is just a blank rectangle.
 *
 * Usage: render `data-src={url}` instead of `src={url}` and call this with a ref to any element
 * containing the videos. Attaching is one-way and one-time per element — once a video has its
 * src it keeps it, so scrolling back and forth does not restart the download.
 */
export const useLazyVideoSrc = (rootRef, deps = []) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const attach = (video) => {
      const wanted = video.dataset.src;
      // Re-attaching would call load() again and restart playback from zero.
      if (!wanted || video.getAttribute("src") === wanted) return;
      video.setAttribute("src", wanted);
      video.load();
    };

    const videos = [...root.querySelectorAll("video[data-src]")];
    if (!videos.length) return undefined;

    // No IntersectionObserver (very old browser): load everything rather than show nothing.
    if (typeof IntersectionObserver !== "function") {
      videos.forEach(attach);
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          attach(entry.target);
          io.unobserve(entry.target);
        }
      },
      // Start a screen early, so the video is ready by the time it is actually looked at.
      { rootMargin: "300px" },
    );
    videos.forEach((video) => io.observe(video));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

export default useLazyVideoSrc;
