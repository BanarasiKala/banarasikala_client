import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import "./ImageLightbox.css";

/**
 * Full-screen image viewer.
 *
 * Photos used to open in a new tab, which handed the customer off to a raw Cloudinary URL
 * and left them to find their way back to the conversation. This keeps them on the page.
 *
 * @param {Array<{url: string}>} images  The set the clicked photo belongs to, so a message
 *                                       with several can be paged through without closing.
 * @param {number} startIndex            Which one was clicked.
 * @param {Function} onClose
 */
export default function ImageLightbox({ images = [], startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const count = images.length;

  const go = useCallback((step) => {
    // Wraps, so the arrows never dead-end on the first or last photo.
    setIndex((current) => (current + step + count) % count);
  }, [count]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
      if (event.key === "ArrowRight" && count > 1) go(1);
      if (event.key === "ArrowLeft" && count > 1) go(-1);
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll under the viewer.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, go, count]);

  if (!count) return null;
  const current = images[Math.min(index, count - 1)];

  return (
    <div className="lightbox-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Photo viewer">
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close photo">
        <Icon icon="lucide:x" />
      </button>

      {count > 1 && (
        <>
          {/* stopPropagation: the overlay closes on click, and paging must not also dismiss. */}
          <button
            type="button"
            className="lightbox-nav is-prev"
            onClick={(event) => { event.stopPropagation(); go(-1); }}
            aria-label="Previous photo"
          >
            <Icon icon="lucide:chevron-left" />
          </button>
          <button
            type="button"
            className="lightbox-nav is-next"
            onClick={(event) => { event.stopPropagation(); go(1); }}
            aria-label="Next photo"
          >
            <Icon icon="lucide:chevron-right" />
          </button>
        </>
      )}

      <img
        className="lightbox-image"
        src={current.url}
        alt={count > 1 ? `Photo ${index + 1} of ${count}` : "Photo"}
        onClick={(event) => event.stopPropagation()}
      />

      {count > 1 && (
        <span className="lightbox-count">{index + 1} / {count}</span>
      )}
    </div>
  );
}
