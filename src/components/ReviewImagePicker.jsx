import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { MAX_REVIEW_IMAGES } from "../utils/reviewUploads";
import "./ReviewImagePicker.css";

/**
 * Photo picker for the review form — thumbnail tiles.
 *
 * Both feedback forms used a bare <input type="file"> that rendered the browser's default
 * "Choose files / 3 files selected" control and, on My Orders, a list of raw filenames.
 * A customer picking photos of a saree has no way to tell from `IMG_20260721_154430.jpg`
 * whether they chose the right one.
 *
 * These files are NOT uploaded on pick, unlike the support chat composer: the review form
 * uploads on submit (uploadReviewImages), so previews come from object URLs held only while
 *
 * @param {File[]}   files    Currently selected files (owned by the parent form).
 * @param {Function} onChange (files: File[]) => void
 * @param {boolean}  disabled
 */
export default function ReviewImagePicker({ files = [], onChange, disabled = false }) {
  const inputRef = useRef(null);
  const [previews, setPreviews] = useState([]);

  // Object URLs are a document-lifetime allocation — the browser holds the whole file in
  // memory until they are revoked, so they are rebuilt and released as the selection
  // changes rather than leaked for as long as the page is open.
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const remaining = MAX_REVIEW_IMAGES - files.length;

  const handlePick = (event) => {
    const picked = Array.from(event.target.files || []);
    // Cleared so re-picking the same file still fires a change event.
    event.target.value = "";
    if (!picked.length) return;
    onChange?.([...files, ...picked].slice(0, MAX_REVIEW_IMAGES));
  };

  const removeAt = (index) => {
    onChange?.(files.filter((_, i) => i !== index));
  };

  return (
    <div className="review-picker">
      {files.map((file, index) => (
        <div className="review-thumb" key={`${file.name}-${file.size}-${index}`}>
          {previews[index] && <img src={previews[index]} alt={file.name} />}
          <button
            type="button"
            onClick={() => removeAt(index)}
            disabled={disabled}
            aria-label={`Remove ${file.name}`}
          >
            <Icon icon="lucide:x" />
          </button>
        </div>
      ))}

      {remaining > 0 && (
        <button
          type="button"
          className="review-thumb review-thumb-add"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Icon icon="lucide:image-plus" />
          <small>Add</small>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handlePick}
      />
    </div>
  );
}
