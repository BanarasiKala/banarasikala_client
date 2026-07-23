import { createPortal } from "react-dom";
import useBottomSheet from "../../hooks/useBottomSheet";
import SupportChat from "./SupportChat";

/**
 * The support chat as a sheet that comes up from below.
 *
 * My Orders and the order confirmation open this straight off "Chat with us". The customer
 * stays where they are — the conversation comes to the order rather than sending them to
 * another route and back, which is what the old raise-a-query form did.
 *
 * useBottomSheet is used only for what it does at the edges: Escape closes, and the page
 * behind is frozen. Its drag-to-dismiss handlers are deliberately NOT spread onto anything
 * here — a chat is a scrolling surface with a text box in it, and a downward drag means
 * "read what came before", not "throw this away".
 *
 * ── Why a portal ────────────────────────────────────────────────────────────────────────
 * Rendered into <body>, not into whatever page opened it. A full-screen overlay has no
 * business living inside a page's DOM subtree: from there, any ancestor can silently break
 * it. The order confirmation page did exactly that — `.order-confirmation-page > *` sets
 * `position: relative` on every direct child, which beat this overlay's `position: fixed` on
 * source order and left the sheet laid out inline at the bottom of the page, invisible. The
 * button worked; the sheet simply had nowhere to appear.
 *
 * That page's own modals dodge it by being declared later in the same stylesheet. A shared
 * component cannot rely on winning that race against every host page it might ever be opened
 * from, so it steps out of the subtree entirely. This also immunises it against the other
 * two classic traps — an ancestor `transform` (which would make `fixed` resolve against that
 * element instead of the viewport) and `overflow: hidden` clipping.
 *
 * Every other prop goes straight through to SupportChat.
 */
export default function SupportChatSheet({ onClose, ...chat }) {
  const { sheetRef } = useBottomSheet(onClose);

  return createPortal(
    <div className="sc-sheet-overlay" role="presentation" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sc-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Support chat"
        onClick={(event) => event.stopPropagation()}
      >
        <SupportChat {...chat} onBack={onClose} dismissible />
      </div>
    </div>,
    document.body,
  );
}
