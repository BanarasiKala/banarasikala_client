import { Icon } from "@iconify/react";
import "./DownloadPdfButton.css";

/**
 * "Download PDF" for a content page.
 *
 * Routed through the browser's own print pipeline, where "Save as PDF" (desktop) and
 * "Print → Save to Files" (mobile) are the destinations — the same approach InvoiceViewer
 * already takes, and for the same reason: a one-click .pdf with no dialog needs a generator
 * (html2canvas + jsPDF) bundled into the client, which is a large dependency to add for a
 * policy page the browser can already render to PDF faithfully.
 *
 * The accompanying print stylesheet strips the site chrome, so what lands in the PDF is the
 * document rather than a screenshot of the website.
 *
 * @param {() => void} [onBeforePrint] Runs instead of print() when the page needs to change
 *   shape first (the FAQ expands every answer). That caller owns calling window.print().
 */
const DownloadPdfButton = ({ label = "Download PDF", onBeforePrint = null }) => (
  <div className="bk-pdf-action">
    <button
      type="button"
      className="bk-pdf-button"
      onClick={() => (onBeforePrint ? onBeforePrint() : window.print())}
      title="Save this page as a PDF"
    >
      <Icon icon="lucide:download" aria-hidden="true" />
      <span>{label}</span>
    </button>
  </div>
);

export default DownloadPdfButton;
