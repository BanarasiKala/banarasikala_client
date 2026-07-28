import { useState } from "react";
import { imgUrl } from "../utils/cloudinary";
import "./UserAvatar.css";

/**
 * A customer's profile photo, falling back to the first letter of their name.
 *
 * Most customers never upload one, so the initial is the common case, not the error case —
 * which is why the fallback is a coloured disc with their letter rather than a stock
 * silhouette. A room full of identical grey heads tells the reader nothing; a room of
 * different letters at least distinguishes one reviewer from the next.
 *
 * The photo is dropped for the initial whenever it fails to load, not only when it is
 * absent: avatars come from uploads that can be deleted and from Google URLs that expire,
 * and a broken-image icon is worse than no photo at all.
 *
 * @param {string} name  Whose avatar this is; supplies the initial.
 * @param {string} src   Their avatar_url, if any.
 * @param {number} size  Rendered diameter in px (default 34).
 * @param {string} className  Extra class for page-specific sizing/spacing.
 */
export default function UserAvatar({ name, src, size = 34, className = "" }) {
  const [failed, setFailed] = useState(false);
  const photo = !failed && src ? src : null;
  const initial = String(name || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      className={`bk-avatar ${className}`.trim()}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {photo ? (
        <img
          // Asking for 2× the rendered size keeps it sharp on a retina screen. imgUrl only
          // rewrites Cloudinary URLs and passes anything else (Google, S3) through as-is.
          src={imgUrl(photo, size * 2)}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}
