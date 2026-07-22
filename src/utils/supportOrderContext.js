import { imgUrl } from "./cloudinary";
import { getOrderDisplayNumber } from "./itemCode";

const itemImage = (item) => item?.image_url || item?.product_image_url || "";

/**
 * An order reduced to the card that opens a support conversation.
 *
 * That card is the chat's second message, on screen before the customer has typed anything
 * — which is the whole reason the old "raise a query" form is gone. Support used to learn
 * which order a query was about from a number the customer had to carry across; now both
 * sides open on the same saree and nobody types an order number.
 *
 * Shared because two pages open the same chat (My Orders and the order confirmation) and
 * the card has to read identically from both. The caller supplies the status, since each
 * page already resolves it its own way — this file has no business owning that ladder.
 *
 * The lead item is the first one still standing: a cancelled line is not what someone is
 * writing in about, and showing it as the face of the order would be actively misleading.
 * If every line is cancelled it is shown anyway — a cancellation is a perfectly good reason
 * to be in this chat.
 *
 * @param {object} order
 * @param {{status?: string, statusLabel?: string}} resolved Status as the host renders it.
 * @returns {object|null} Consumed by SupportChat's `order` prop.
 */
export default function supportOrderContext(order, { status = "", statusLabel = "" } = {}) {
  if (!order?.id) return null;

  const all = order.OrderItems || [];
  const live = all.filter((item) => String(item?.status || "").toLowerCase() !== "cancelled");
  const shown = live.length ? live : all;
  const lead = shown[0] || null;
  const image = itemImage(lead);
  const normalized = String(status || order.status || "").toLowerCase();

  return {
    id: order.id,
    number: getOrderDisplayNumber(order),
    productName: lead?.product_name || "",
    productImage: image ? imgUrl(image, 200) : "",
    statusLabel,
    extraItems: Math.max(0, shown.length - 1),
    // Picks which set of opening prompts to offer. An RTO reads as "rto delivered" but came
    // back to us — the customer never received it, so they need the in-transit prompts, not
    // "item arrived damaged".
    delivered: normalized.includes("delivered") && !normalized.includes("rto"),
  };
}
