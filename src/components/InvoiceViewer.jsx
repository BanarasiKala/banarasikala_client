import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import "./InvoiceViewer.css";

/**
 * The order invoice, rendered inside the site.
 *
 * It used to be `window.open()` on a blob URL, which dropped the customer onto a bare
 * document in a new tab with no way back — and was blocked outright whenever the fetch took
 * long enough that the popup no longer counted as user-initiated, which is why there was a
 * "allow pop-ups" warning to explain the failure.
 *
 * The invoice comes back as HTML, so it renders in an <iframe> from a blob URL rather than
 * srcDoc: a blob inherits this origin, which is what lets Print reach into the frame and
 * call print() on it. Download re-uses the same blob.
 *
 * @param {string} html        The invoice document.
 * @param {string} orderNumber Used for the title and the saved filename.
 * @param {Function} onClose
 */
export default function InvoiceViewer({ html, orderNumber, onClose }) {
  const [url, setUrl] = useState(null);
  // The invoice's own layout width/height, read from the document once it loads.
  const [docSize, setDocSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const frameRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!html) return undefined;
    const objectUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    setUrl(objectUrl);
    // Revoked on close: a blob URL pins the whole document in memory until it is released.
    return () => URL.revokeObjectURL(objectUrl);
  }, [html]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  /**
   * An invoice is laid out for paper — a fixed page width, typically ~800px. In a phone-
   * width frame that just overflows and the customer sees the left third of their bill.
   *
   * So the document is measured once it loads and scaled down to fit. The frame keeps its
   * natural width (the layout is never reflowed, so nothing wraps or breaks) and a CSS
   * transform shrinks the whole page — the same thing a desktop PDF viewer's "fit width"
   * does. Readable via the blob's same-origin document.
   */
  const handleFrameLoad = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const w = Math.max(doc.documentElement?.scrollWidth || 0, doc.body?.scrollWidth || 0);
    const h = Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0);
    if (w && h) setDocSize({ w, h });
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!docSize.w || !wrap) return undefined;
    // Never scale UP — a narrow invoice blown up to fill a desktop screen looks broken.
    const fit = () => setScale(Math.min(1, wrap.clientWidth / docSize.w));
    fit();
    // Re-fits on rotation and on the viewport resizing, not just at first paint.
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [docSize.w]);


  /**
   * Save as PDF.
   *
   * Routed through the browser's own print pipeline, where "Save as PDF" (desktop) and
   * "Print → Save to Files" (iOS/Android) are the destinations. That is a real PDF, of the
   * document as laid out, with no dependency added.
   *
   * A one-click .pdf with no dialog would need a generator — html2canvas+jsPDF on the
   * client (~1 MB, and it rasterises, so the text stops being selectable) or headless
   * Chrome on the server. Neither is installed; see the note to the user.
   */
  const savePdf = () => {
    const frame = frameRef.current?.contentWindow;
    if (!frame) return;
    frame.focus();
    frame.print();
  };

  return (
    <div className="invoice-overlay" role="dialog" aria-modal="true" aria-label="Invoice">
      <div className="invoice-shell">
        <div className="invoice-bar">
          <strong>Invoice{orderNumber ? ` · #${orderNumber}` : ""}</strong>
          <div className="invoice-bar-actions">
            {/* One button, not two. Print and "Save as PDF" are the same browser dialog —
                PDF is a destination inside it — so shipping both meant two controls that
                did exactly the same thing. */}
            <button type="button" onClick={savePdf} title="Download as PDF">
              <Icon icon="lucide:download" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              className="invoice-close"
              onClick={onClose}
              aria-label="Close invoice"
            >
              <Icon icon="lucide:x" />
            </button>
          </div>
        </div>

        {url ? (
          <div className="invoice-frame-wrap" ref={wrapRef}>
            <iframe
              ref={frameRef}
              className="invoice-frame"
              src={url}
              title={`Invoice ${orderNumber || ""}`}
              onLoad={handleFrameLoad}
              style={docSize.w ? {
                width: `${docSize.w}px`,
                height: `${docSize.h}px`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              } : undefined}
            />
            {/* A transform does not change layout size, so the scaled frame would still
                reserve its FULL height and leave a long blank gap below the invoice. This
                spacer reserves the scaled height instead, and is what the wrapper scrolls. */}
            {docSize.h > 0 && (
              <div style={{ height: `${docSize.h * scale}px` }} aria-hidden="true" />
            )}
          </div>
        ) : (
          <div className="invoice-loading">
            <Icon icon="lucide:loader-2" className="invoice-spin" />
            <span>Preparing your invoice…</span>
          </div>
        )}
      </div>
    </div>
  );
}
