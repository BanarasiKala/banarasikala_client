import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import ImageLightbox from "../ImageLightbox";
import useBottomSheet from "../../hooks/useBottomSheet";
import { imgUrl } from "../../utils/cloudinary";
import "./ProductReviews.css";

// How many reviews the product page shows before "View all" takes over. Four is enough to read
// the room without the reviews pushing the rest of the page below a second screenful.
const INLINE_LIMIT = 4;
// Thumbnails per card. Any beyond this are reached through the "+N" badge on the last one.
const THUMB_LIMIT = 2;

/**
 * "2 days ago" rather than a date.
 *
 * A shopper reading reviews is asking "is this recent", not "which Tuesday was this". The
 * units get coarser as they get older because the precision stops meaning anything: whether a
 * review is 63 or 68 days old changes nothing about how much to trust it.
 */
const relativeDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return months <= 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.floor(days / 365.25);
  return years === 1 ? "1 year ago" : `${years} years ago`;
};

const Stars = ({ rating, className = "" }) => (
  <span className={`pr-stars ${className}`} role="img" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Icon
        key={star}
        icon={rating >= star ? "mdi:star" : rating >= star - 0.5 ? "mdi:star-half-full" : "mdi:star-outline"}
      />
    ))}
  </span>
);

/**
 * One review.
 *
 * No name and no avatar. The reviewer's identity is not what a shopper is here for, and half
 * of these are seed reviews where the name is something the admin typed — showing it invited a
 * trust judgement the name cannot actually support. What replaces it is the thing that IS
 * checkable: whether this came from a verified buyer.
 */
const ReviewCard = ({ review, onOpenImage }) => {
  const images = Array.isArray(review.images) ? review.images.filter((image) => image?.url) : [];
  const thumbs = images.slice(0, THUMB_LIMIT);
  const extra = images.length - thumbs.length;
  const stamp = relativeDate(review.created_at || review.createdAt);

  return (
    <article className="pr-card">
      <div className="pr-card-main">
        <Stars rating={Number(review.rating || 0)} />
        <p>{review.comment}</p>
      </div>

      {thumbs.length > 0 && (
        <div className="pr-card-shots">
          {thumbs.map((image, index) => {
            // The badge rides the LAST thumbnail rather than replacing it — the photo behind it
            // is still one of the review's photos, so covering it with a plain "+3" tile would
            // spend a slot saying nothing.
            const isLast = index === thumbs.length - 1;
            const showMore = isLast && extra > 0;
            return (
              <button
                type="button"
                key={`${image.url}-${index}`}
                className="pr-shot"
                onClick={() => onOpenImage(images, index)}
                aria-label={showMore ? `View all ${images.length} photos` : "View photo"}
              >
                <img src={imgUrl(image.url, 240)} alt="" loading="lazy" />
                {showMore && <span className="pr-shot-more">+{extra}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Footer. The divider only exists between two things, so it is tied to the badge — an
          unverified review shows the date alone rather than a rule with nothing to its left. */}
      <div className="pr-card-foot">
        {review.is_verified && (
          <>
            <span className="pr-verified">
              <Icon icon="mdi:check-decagram" /> Verified Buyer
            </span>
            <span className="pr-foot-rule" aria-hidden="true" />
          </>
        )}
        {stamp && (
          <span className="pr-when">
            <Icon icon="lucide:calendar" /> {stamp}
          </span>
        )}
      </div>
    </article>
  );
};

/** 5★ → 1★ with a bar each, so the shape of the ratings is readable at a glance. */
const RatingBars = ({ reviews }) => {
  const buckets = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // index 0 = 1 star
    reviews.forEach((review) => {
      const star = Math.round(Number(review.rating || 0));
      if (star >= 1 && star <= 5) counts[star - 1] += 1;
    });
    return counts;
  }, [reviews]);

  // Scaled against the biggest bucket, not the total: with 24 of 24 reviews at five stars, a
  // percentage-of-total scale draws every other row as an invisible sliver anyway, and this
  // way the winning row always reaches the end of the track.
  const peak = Math.max(1, ...buckets);

  return (
    <div className="pr-bars">
      {[5, 4, 3, 2, 1].map((star) => {
        const value = buckets[star - 1];
        return (
          <div className="pr-bar-row" key={star}>
            <span className="pr-bar-star">{star}</span>
            <span className="pr-bar-track">
              <span className="pr-bar-fill" style={{ width: `${(value / peak) * 100}%` }} />
            </span>
            <span className="pr-bar-count">{value}</span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * "All Reviews" — a sheet from the bottom, portaled to <body>.
 *
 * Portaled for the same reason the support sheet is: a full-screen overlay declared inside a
 * page's DOM can be broken by any ancestor's `transform`, `overflow`, or a `position: relative`
 * that wins on source order. The product page is a deep tree with plenty of all three.
 */
const AllReviewsSheet = ({ reviews, summary, onOpenImage, onClose }) => {
  const { sheetRef, grabHandlers, sheetStyle } = useBottomSheet(onClose);
  const count = Number(summary?.count || reviews.length || 0);

  return createPortal(
    <div className="pr-sheet-overlay" role="presentation" onClick={onClose}>
      <div
        ref={sheetRef}
        className="pr-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="All reviews"
        style={sheetStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pr-sheet-head" {...grabHandlers}>
          <button type="button" onClick={onClose} aria-label="Close reviews">
            <Icon icon="lucide:chevron-left" />
          </button>
          <h2>All Reviews</h2>
        </div>

        <div className="pr-sheet-body">
          <div className="pr-sheet-summary">
            <div className="pr-sheet-score">
              <strong>{Number(summary?.average || 0).toFixed(1)}</strong>
              <Stars rating={Number(summary?.average || 0)} />
              <small>Based on {count} {count === 1 ? "review" : "reviews"}</small>
            </div>
            <RatingBars reviews={reviews} />
          </div>

          <div className="pr-sheet-list">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} onOpenImage={onOpenImage} />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/**
 * The product page's reviews section: score header, the first few reviews, and the sheet
 * holding the rest.
 *
 * One component rather than markup inlined into ProductDetail, because the card was previously
 * written out twice — once for the page and once for the modal — and the two had already begun
 * to drift.
 */
export default function ProductReviews({ reviews = [], summary }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  // Escape closes the viewer before the sheet, so a photo opened from inside the sheet does not
  // take the whole sheet down with it.
  useEffect(() => {
    if (!sheetOpen && !lightbox) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [sheetOpen, lightbox]);

  if (!reviews.length) return null;

  const count = Number(summary?.count || reviews.length);
  const average = Number(summary?.average || 0);
  // Photos page within the review they belong to. Paging across every photo on the product
  // would silently walk the shopper out of the review they were reading and into someone
  // else's, with nothing on screen to say it had happened.
  const openImage = (images, index) => setLightbox({ images, index });

  return (
    <section className="pr-section" id="product-reviews">
      <div className="pr-head">
        <div className="pr-head-titles">
          <span>Customer Feedback</span>
          <h2>Reviews</h2>
        </div>

        <div className="pr-head-score">
          <div className="pr-head-score-top">
            <strong>{average.toFixed(1)}</strong>
            <Stars rating={average} />
          </div>
          <small>({count} {count === 1 ? "review" : "reviews"})</small>
          <button type="button" className="pr-view-all" onClick={() => setSheetOpen(true)}>
            View all <Icon icon="lucide:chevron-right" />
          </button>
        </div>
      </div>

      <div className="pr-list">
        {reviews.slice(0, INLINE_LIMIT).map((review) => (
          <ReviewCard key={review.id} review={review} onOpenImage={openImage} />
        ))}
      </div>

      {sheetOpen && (
        <AllReviewsSheet
          reviews={reviews}
          summary={{ average, count }}
          onOpenImage={openImage}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {/* Portaled as well: opened from inside the sheet it would otherwise be a child of it,
          and the sheet's own stacking context would trap it behind the sheet. */}
      {lightbox && createPortal(
        <ImageLightbox
          images={lightbox.images}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />,
        document.body,
      )}
    </section>
  );
}
