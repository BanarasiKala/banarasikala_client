import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import useBottomSheet from "../hooks/useBottomSheet";
import { MAX_SUPPORT_IMAGES, uploadSupportImages } from "../utils/supportUploads";
import "./QuerySheet.css";

/**
 * "Query Us" — raise a support query on an order.
 *
 * One component for both My Orders and the order detail page; the form was previously
 * copied into each, which is how the two drifted apart last time. The host owns the API
 * call and the submitting flag, this owns the form.
 *
 * Photos upload as soon as they are picked rather than on submit. Submit then posts URLs
 * and returns immediately, and an upload failure surfaces while the customer is still
 * looking at the form instead of after they commit to sending it.
 *
 * @param {string}   orderNumber Display number, shown in the header.
 * @param {string}   defaultPhone Prefill for the optional callback number.
 * @param {boolean}  submitting  Host-owned: disables the form while the query is posting.
 * @param {Function} onSubmit    ({ message, phone, attachments }) => void
 * @param {Function} onClose
 * @param {Function} onNotify    (message, tone) — surfaced for upload errors.
 */
export default function QuerySheet({
  orderNumber,
  defaultPhone = "",
  submitting = false,
  onSubmit,
  onClose,
  onNotify,
}) {
  const { sheetRef, grabHandlers, sheetStyle } = useBottomSheet(onClose);
  const fileInputRef = useRef(null);

  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState(defaultPhone || "");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const remaining = MAX_SUPPORT_IMAGES - attachments.length;

  const handleFiles = async (event) => {
    const picked = Array.from(event.target.files || []);
    // The input is cleared immediately so picking the SAME file again still fires a change
    // event — otherwise re-adding a photo you just removed silently does nothing.
    event.target.value = "";
    if (!picked.length) return;

    if (picked.length > remaining) {
      setError(`You can attach up to ${MAX_SUPPORT_IMAGES} photos.`);
      return;
    }

    setUploading(true);
    setError("");
    try {
      const uploaded = await uploadSupportImages(picked);
      setAttachments((current) => [...current, ...uploaded].slice(0, MAX_SUPPORT_IMAGES));
    } catch (err) {
      const text = err?.message || "Could not upload that photo.";
      setError(text);
      onNotify?.(text, "error");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (publicId) => {
    setAttachments((current) => current.filter((item) => item.public_id !== publicId));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setError("Please describe your issue in a little more detail.");
      return;
    }
    if (uploading) {
      setError("Please wait for the photos to finish uploading.");
      return;
    }
    setError("");
    onSubmit?.({ message: trimmed, phone: phone.trim(), attachments });
  };

  const busy = submitting || uploading;

  return (
    <div className="query-sheet-overlay" onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        className="query-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Raise a query"
        onClick={(event) => event.stopPropagation()}
        style={sheetStyle}
      >
        <div className="query-sheet-grab" {...grabHandlers}>
          <span className="query-sheet-grabber" />
        </div>

        <button
          type="button"
          className="query-sheet-close"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
        >
          <Icon icon="lucide:x" />
        </button>

        <div className="query-sheet-head">
          <h3>Need help with this order?</h3>
          <p>
            Tell us what went wrong with order <strong>#{orderNumber}</strong> and our
            support team will get back to you.
          </p>
        </div>

        <form className="query-sheet-body" onSubmit={handleSubmit}>
          <label className="query-field">
            <span>Describe your issue</span>
            <textarea
              rows={4}
              maxLength={2000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Share the details so we can resolve this faster."
              disabled={submitting}
              autoFocus
            />
          </label>

          <div className="query-field">
            <span>
              Attach photos <small>(optional, up to {MAX_SUPPORT_IMAGES})</small>
            </span>

            <div className="query-attachments">
              {attachments.map((item) => (
                <div className="query-thumb" key={item.public_id}>
                  <img src={item.url} alt="Attached" loading="lazy" />
                  <button
                    type="button"
                    onClick={() => removeAttachment(item.public_id)}
                    aria-label="Remove photo"
                    disabled={busy}
                  >
                    <Icon icon="lucide:x" />
                  </button>
                </div>
              ))}

              {uploading && (
                <div className="query-thumb is-loading" aria-live="polite">
                  <Icon icon="lucide:loader-2" className="query-spin" />
                </div>
              )}

              {remaining > 0 && !uploading && (
                <button
                  type="button"
                  className="query-thumb query-thumb-add"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  <Icon icon="lucide:image-plus" />
                  <small>Add</small>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleFiles}
            />
          </div>

          <label className="query-field">
            <span>Phone number <small>(optional)</small></span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="10-digit mobile number we can call you on"
              disabled={submitting}
            />
          </label>

          {error && <p className="query-sheet-error">{error}</p>}

          <div className="query-sheet-actions">
            <button type="button" className="query-btn secondary" onClick={onClose} disabled={submitting}>
              Go Back
            </button>
            <button type="submit" className="query-btn primary" disabled={busy}>
              {submitting ? "Raising query…" : uploading ? "Uploading…" : "Raise Query"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
