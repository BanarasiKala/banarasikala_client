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
 * Every other prop goes straight through to SupportChat.
 */
export default function SupportChatSheet({ onClose, ...chat }) {
  const { sheetRef } = useBottomSheet(onClose);

  return (
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
    </div>
  );
}
