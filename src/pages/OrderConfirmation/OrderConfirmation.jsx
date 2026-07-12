import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { imgUrl } from "../../utils/cloudinary";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../utils/api";
import { API_ENDPOINTS } from "../../config/api";
import { getOrderDisplayNumber } from "../../utils/itemCode";
import { numberEnv, requiredEnv } from "../../utils/env";
import { buildRazorpayPrefill } from "../../utils/razorpay";
import { MAX_REVIEW_IMAGES, uploadReviewImages } from "../../utils/reviewUploads";
import { useNotification } from "../../context/NotificationContext";
import { useCart } from "../../context/CartContext";
import OrderTrackModal from "../../components/OrderTrackModal";
import "./OrderConfirmation.css";

const PLATFORM_FEE_AMOUNT = numberEnv("VITE_PLATFORM_FEE_AMOUNT");

const toNumber = (value) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const formatPrice = (value) => `₹${toNumber(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const datePart = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${datePart}, ${timePart}`;
};

// Mirror of TICKET_CATEGORIES in the server's SupportController — it rejects
// anything not on this list. Same "Need Help with this order?" box as My Orders.
const TICKET_CATEGORIES = [
  "Delivery or shipping issue",
  "Payment or refund issue",
  "Damaged or defective product",
  "Wrong or missing item",
  "Return or exchange help",
  "Other",
];

const TICKET_STATUS_TONE = {
  Open: "is-open",
  "In Progress": "is-progress",
  Resolved: "is-resolved",
  Closed: "is-closed",
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const formatRefundType = (type) => {
  const t = String(type || "").toLowerCase();
  if (t.includes("rto")) return "RTO refund";
  if (t.includes("cancel")) return "Cancellation refund";
  if (t.includes("return")) return "Return refund";
  if (t.includes("exchange")) return "Exchange adjustment";
  return "Refund";
};

const formatRefundStatus = (status) => {
  const s = String(status || "").toLowerCase();
  if (s.includes("complete") || s.includes("processed") || s.includes("success") || s === "refunded") return "Completed";
  if (s.includes("not_required") || s.includes("not required")) return "Not required";
  if (s.includes("fail") || s.includes("reject")) return "Failed";
  if (s.includes("pending") || s.includes("initiat") || s.includes("process")) return "Processing";
  return status || "Pending";
};

const isRefundSettled = (status) => /complete|processed|success|refunded/i.test(String(status || ""));

const getItemImage = (item) => item.image_url || item.product_image_url || "";
const getItemColor = (item) => item.color_name || item.Color?.name || "Selected color";

const RatingStars = ({ rating = 0 }) => (
  <span className="confirmation-item-stars" aria-label={`${rating || 0} star rating`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Icon key={star} icon="mdi:star" className={Number(rating) >= star ? "filled" : "empty"} />
    ))}
  </span>
);

const getBreakdown = (order = {}) => {
  const items = order.OrderItems || [];
  const itemSubtotal = items.reduce((sum, item) => sum + toNumber(item.price) * Math.max(1, toNumber(item.quantity) || 1), 0);
  const subtotal = toNumber(order.subtotal_amount) || itemSubtotal;
  // Per-item MRP vs. what was actually charged, mirroring CheckoutFlow's mrpSavings —
  // same live product MRP lookup (OrderItem never snapshots one), only counted where
  // the MRP is actually higher than the price paid.
  const mrpTotal = items.reduce((sum, item) => {
    const qty = Math.max(1, toNumber(item.quantity) || 1);
    const mrp = toNumber(item.mrp_price);
    const sell = toNumber(item.price);
    return sum + (mrp > sell ? mrp : sell) * qty;
  }, 0);
  const mrpSavings = Math.max(0, mrpTotal - itemSubtotal);
  const shippingCharge = toNumber(order.shipping_charge);
  const shippingDiscount = toNumber(order.shipping_discount);
  // Delivery is always fully discounted at order placement (see
  // OrderController.actualShippingDiscount), so the ledger-derived
  // shipping_charge/shipping_discount above are always 0. The real
  // pre-discount rate only survives per item in shipping_meta — sum it back
  // up so the strike-through "Free" display matches the checkout flow.
  const originalShippingCharge = items.reduce(
    (sum, item) => sum + toNumber(item.shipping_meta?.delivery_charge),
    0,
  ) || shippingCharge;
  const paymentFee = toNumber(order.payment_fee);
  const isCod = String(order.payment_method || "").toUpperCase() === "COD";
  const storedPlatformFee = toNumber(order.platform_fee);
  const storedCodFee = toNumber(order.cod_fee);
  const platformFee = storedPlatformFee || (paymentFee > 0 ? Math.min(PLATFORM_FEE_AMOUNT, paymentFee) : 0);
  const codFee = storedCodFee || (isCod ? Math.max(0, paymentFee - platformFee) : 0);
  const paymentDiscount = toNumber(order.payment_discount);
  const couponDiscount = toNumber(order.discount_amount);
  const walletAmount = toNumber(order.wallet_amount);
  const giftCharge = toNumber(order.gift_charge);
  const payable = toNumber(order.payable_amount) || toNumber(order.total_amount) || Math.max(
    0,
    subtotal + shippingCharge + paymentFee + giftCharge - shippingDiscount - paymentDiscount - couponDiscount - walletAmount,
  );

  // Delivery is shown net of the COD charge (billed separately on its own row); the
  // full delivery charge is what was persisted to the order.
  const deliveryChargeShown = Math.max(0, originalShippingCharge - codFee);

  return { subtotal, mrpTotal, mrpSavings, shippingCharge, shippingDiscount, originalShippingCharge, deliveryChargeShown, paymentFee, platformFee, codFee, giftCharge, paymentDiscount, couponDiscount, walletAmount, payable };
};

// An order can be cancelled (whole order only — no item-level changes) only while it
// is still being prepared (pending / processing) and within 24 hours of the window
// start. The window normally starts at order placement, but a re-dispatched order
// (after an RTO round trip) restarts it at the re-dispatch moment — see
// cancel_window_started_at on the order (OrderController.hydrateV2Fields).
// Once the status moves on (AWB assigned, shipped, …) the cancel button disappears.
// Mirror of CANCELLABLE_STATUSES in OrderController on the backend.
const CANCELLABLE_STATUSES = ["pending", "processing"];
const canCancelOrder = (order) => {
  const rawDate = order?.cancel_window_started_at || order?.createdAt || order?.created_at;
  const status = String(order?.status || "").toLowerCase();
  if (!rawDate || !CANCELLABLE_STATUSES.includes(status)) return false;
  // Once a return or exchange is raised, cancellation is closed — cancelling refunds the
  // whole order and restocks every line, which would double-count against a reverse flow
  // that is already settling that money and moving those goods. This matters most for an
  // exchange REPLACEMENT: shipping it puts the order back into 'Processing' (a cancellable
  // status), and without this the customer could cancel it and be refunded for goods they
  // kept. Mirrors the guard in OrderController.cancelOrder.
  if (hasAnyReverseAction(order)) return false;
  const windowStart = new Date(rawDate).getTime();
  return Number.isFinite(windowStart) && Date.now() - windowStart <= 24 * 60 * 60 * 1000;
};

// True only when the order would otherwise qualify for cancellation (still
// pending/processing, no return/exchange raised) but the 24h clock has simply run
// out — i.e. the ONE reason canCancelOrder said no was the time check. An order
// that has moved on to shipped/delivered/etc. isn't "closed", it's just not
// applicable, so this stays false there (mirrors canCancelOrder's other guards).
const cancelWindowClosed = (order) => {
  const rawDate = order?.cancel_window_started_at || order?.createdAt || order?.created_at;
  const status = String(order?.status || "").toLowerCase();
  if (!rawDate || !CANCELLABLE_STATUSES.includes(status)) return false;
  if (hasAnyReverseAction(order)) return false;
  const windowStart = new Date(rawDate).getTime();
  return Number.isFinite(windowStart) && Date.now() - windowStart > 24 * 60 * 60 * 1000;
};

// A current, dispatched AWB — present only once the order has moved past preparation.
// A re-dispatched order sits in Processing (sometimes still holding the PREVIOUS
// shipment's AWB) until a new AWB is assigned, so pending / processing count as
// "no live AWB yet" and the tracking block stays hidden until then.
const hasCurrentAwb = (order) => {
  if (!order?.shiprocket_awb) return false;
  const status = String(order?.status || "").toLowerCase();
  return status !== "pending" && status !== "processing";
};

// The "Track on Courier" button appears once the shipment has a current AWB and stays
// until the journey ends — hidden once delivered, cancelled or returned (RTO delivered).
const isTrackable = (order) => {
  if (!hasCurrentAwb(order)) return false;
  const status = String(order?.status || "").toLowerCase();
  if (status === "delivered") return false;
  if (status.includes("cancel")) return false;
  if (status === "rto delivered" || status === "rto") return false;
  return true;
};

const getCustomerOrderStatusLabel = (status) => {
  const normalized = String(status || "Pending").toLowerCase();
  if (normalized === "seller cancelled") return "Cancelled by seller";
  if (normalized.includes("partial") && normalized.includes("cancel")) return "Modified";
  if (normalized === "cancel requested") return "Cancellation pending";
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized === "rto delivered" || normalized === "rto") return "Order returned to seller";
  if (normalized === "rto initiated" || normalized === "rto in transit") return "Returning to seller";
  if (normalized.includes("return completed")) return "Return completed";
  if (normalized.includes("return picked up")) return "Return picked up";
  if (normalized.includes("out for return pickup")) return "Out for return pickup";
  if (normalized.includes("return initiated") || normalized.includes("return requested")) return "Return initiated";
  // The parcel is back with us but the replacement has NOT shipped — an exchange is only
  // half done at this point. Mirrors RECEIVED_STATUS in ShipRocketController.
  if (normalized.includes("exchange received")) return "Replacement being prepared";
  if (normalized.includes("exchange completed")) return "Exchange completed";
  if (normalized.includes("exchange picked up")) return "Exchange picked up";
  if (normalized.includes("exchange pickup scheduled")) return "Exchange pickup scheduled";
  if (normalized.includes("exchange initiated") || normalized.includes("exchange requested")) return "Exchange initiated";
  if (normalized === "undelivered") return "Delivery attempt failed";
  if (normalized === "delivered") return "Delivered";
  if (normalized === "out for delivery" || normalized === "out_for_delivery") return "Out for delivery";
  if (normalized === "shipped" || normalized.includes("in transit") || normalized.includes("manifest")) return "Shipped";
  if (normalized === "pickup scheduled" || normalized === "pickup_scheduled" || normalized === "awb assigned" || normalized === "awb_assigned") return "Pickup scheduled";
  if (normalized === "out for pickup" || normalized === "out_for_pickup") return "Courier out for pickup";
  if (normalized === "picked up" || normalized === "picked_up" || normalized.includes("pickup")) return "Picked up";
  if (normalized === "pending" || normalized === "processing" || normalized === "order placed" || normalized === "order_placed") return "Order placed";
  return status || "Pending";
};

const normalizeStatus = (value) => String(value || "Pending").toLowerCase();

const PRE_DELIVERY_STATUSES = new Set([
  "pending",
  "order placed",
  "order_placed",
  "processing",
  "pickup scheduled",
  "pickup_scheduled",
  "out for pickup",
  "out_for_pickup",
  "picked up",
  "picked_up",
  "awb assigned",
  "awb_assigned",
  "shipped",
  "out for delivery",
  "out_for_delivery",
  "undelivered",
  "rto initiated",
  "rto_initiated",
  "rto in transit",
  "rto_in_transit",
]);

const wasDelivered = (order) => {
  const status = normalizeStatus(order?.status);
  if (PRE_DELIVERY_STATUSES.has(status)) return false;
  return status === "delivered" || Boolean(order?.delivered_at);
};

const canReviewOrderItem = (order, item) => {
  const itemStatus = normalizeStatus(item?.status);
  return wasDelivered(order) && !itemStatus.includes("cancel");
};

const getActionableQty = (item) => Math.max(0, toNumber(item.actionable_quantity ?? (
  toNumber(item.quantity)
  - toNumber(item.cancelled_quantity)
  - toNumber(item.returned_quantity)
  - toNumber(item.exchanged_quantity)
  - toNumber(item.pending_action_quantity)
)));

const hasUsableAction = (item, actionType = null) => (item.actions || []).some((action) => {
  const type = String(action.action_type || action.actionType || "").toLowerCase();
  const status = String(action.status || "").toLowerCase();
  return (!actionType || type === actionType) && status !== "rejected";
});

const hasOrderExchangeHistory = (order) => Boolean(order?.exchange_requested_at)
  || (order?.OrderItems || []).some((item) => hasUsableAction(item, "exchange"));

const hasOrderReturnHistory = (order) => (order?.OrderItems || []).some((item) => hasUsableAction(item, "return"));

// Any return or exchange raised on this order that hasn't been rejected. Used to close
// cancellation — see canCancelOrder. Mirrors the OrderItemAction count in
// OrderController.cancelOrder.
const hasAnyReverseAction = (order) => Boolean(order?.exchange_requested_at)
  || (order?.OrderItems || []).some((item) => (
    hasUsableAction(item, "return") || hasUsableAction(item, "exchange")
  ));

// Keep in sync with OrderReturnService.RETURN_WINDOW_DAYS on the backend.
const RETURN_WINDOW_DAYS = 7;
const withinReturnWindow = (order) => {
  if (!order?.delivered_at) return false;
  const lastDate = new Date(order.delivered_at);
  lastDate.setDate(lastDate.getDate() + RETURN_WINDOW_DAYS);
  return Date.now() <= lastDate.getTime();
};

// Per-item "Return/Exchange closes on…" line shown on every product card. Gated by
// the EXACT same conditions as the Return/Exchange buttons below (getEligibleActionItems):
// delivered, item not cancelled/already-actioned/out of actionable qty, and each of
// return/exchange usable only once per order. The one difference: where that
// eligibility check would just silently exclude an item once the 7-day window has
// passed, this shows "closed" instead of hiding — everything else that makes an
// item ineligible (already returned/exchanged, cancelled, nothing left to action)
// still hides the line entirely, same as the button never offering it.
const getItemReturnWindowInfo = (order, item) => {
  const itemStatus = normalizeStatus(item?.status);
  if (itemStatus === "cancelled") return null;
  if (getActionableQty(item) < 1) return null;
  if (itemStatus.includes("requested") || itemStatus.includes("initiated")) return null;
  if (hasUsableAction(item)) return null;
  if (!wasDelivered(order)) return null;

  // Return and exchange are each usable once per ORDER — if both have already been
  // raised (on this or another item), there is nothing left to action here.
  const returnUsed = hasOrderReturnHistory(order);
  const exchangeUsed = hasOrderExchangeHistory(order);
  if (returnUsed && exchangeUsed) return null;

  return { closed: !withinReturnWindow(order), deadline: (() => {
    const d = new Date(order.delivered_at);
    d.setDate(d.getDate() + RETURN_WINDOW_DAYS);
    return d;
  })() };
};

const getEligibleActionItems = (order, actionType) => {
  const delivered = wasDelivered(order);
  const exchangeUsed = hasOrderExchangeHistory(order);
  const returnUsed = hasOrderReturnHistory(order);
  const inReturnWindow = withinReturnWindow(order);
  return (order?.OrderItems || []).filter((item) => {
    const itemStatus = normalizeStatus(item.status);
    if (getActionableQty(item) < 1) return false;
    if (itemStatus.includes("requested") || itemStatus.includes("initiated")) return false;
    if (hasUsableAction(item)) return false;
    if (itemStatus === "cancelled") return false;
    if (["return", "exchange"].includes(actionType)) {
      // Mirror the backend: delivered, inside the 7-day window, and each reverse
      // type usable once per order — one return AND one exchange, independently.
      if (!delivered || !inReturnWindow) return false;
      if (actionType === "exchange") return !exchangeUsed;
      if (actionType === "return") return !returnUsed;
    }
    return false;
  });
};

// Ported verbatim from My Orders (STATUS_CONFIG / getStatus) so the item status
// pill here is pixel-identical — same colours, same icon, same label per status.
const ITEM_STATUS_CONFIG = {
  "Order Placed": { color: "#1a7f3c", bg: "#ecf8ef", icon: "lucide:package-check", label: "Order placed" },
  Pending: { color: "#1a7f3c", bg: "#ecf8ef", icon: "lucide:package-check", label: "Order placed" },
  "Pickup Scheduled": { color: "#6840aa", bg: "#f5f0ff", icon: "lucide:calendar-clock", label: "Pickup scheduled" },
  "Out For Pickup": { color: "#6840aa", bg: "#f5f0ff", icon: "lucide:navigation", label: "Courier out for pickup" },
  "Picked Up": { color: "#6840aa", bg: "#f5f0ff", icon: "lucide:package-check", label: "Picked up" },
  Shipped: { color: "#6840aa", bg: "#f5f0ff", icon: "lucide:truck", label: "Shipped" },
  Delivered: { color: "#087a55", bg: "#edfdf5", icon: "lucide:check-circle", label: "Delivered" },
  Cancelled: { color: "#b42318", bg: "#fff0ee", icon: "lucide:x-circle", label: "Cancelled" },
  "Partially Cancelled": { color: "#2454a6", bg: "#eff5ff", icon: "lucide:file-edit", label: "Modified" },
  "Out For Delivery": { color: "#9a6200", bg: "#fff6dc", icon: "lucide:navigation", label: "Out for delivery" },
  Undelivered: { color: "#9a6200", bg: "#fff6dc", icon: "lucide:triangle-alert", label: "Delivery attempt failed" },
  "RTO Initiated": { color: "#9a6200", bg: "#fff6dc", icon: "lucide:undo-2", label: "Returning to seller" },
  "RTO In Transit": { color: "#9a6200", bg: "#fff6dc", icon: "lucide:truck", label: "Returning to seller" },
  "RTO Delivered": { color: "#7a3d00", bg: "#fff4e8", icon: "lucide:warehouse", label: "Order returned to seller" },
  "Seller Cancelled": { color: "#b42318", bg: "#fff0ee", icon: "lucide:x-circle", label: "Cancelled by seller" },
  "Re-dispatch Requested": { color: "#2454a6", bg: "#eff5ff", icon: "lucide:repeat-2", label: "Re-dispatch requested" },
  "Re-dispatch Payment Pending": { color: "#8a5a00", bg: "#fff6dc", icon: "lucide:credit-card", label: "Re-dispatch payment pending" },
  "Re-dispatch Paid": { color: "#087a55", bg: "#edfdf5", icon: "lucide:badge-check", label: "Re-dispatch paid" },
  "Re-dispatched": { color: "#6840aa", bg: "#f5f0ff", icon: "lucide:truck", label: "Re-dispatched" },
  "Return Requested": { color: "#9a6200", bg: "#fff6dc", icon: "lucide:rotate-ccw", label: "Return requested" },
  "Return Initiated": { color: "#9a6200", bg: "#fff6dc", icon: "lucide:rotate-ccw", label: "Return initiated" },
  "Out For Return Pickup": { color: "#9a6200", bg: "#fff6dc", icon: "lucide:navigation", label: "Return pickup" },
  "Return Picked Up": { color: "#6840aa", bg: "#f5f0ff", icon: "lucide:package-check", label: "Return picked up" },
  "Return Completed": { color: "#087a55", bg: "#edfdf5", icon: "lucide:badge-check", label: "Return completed" },
  "Exchange Requested": { color: "#2454a6", bg: "#eff5ff", icon: "lucide:repeat-2", label: "Exchange requested" },
  "Exchange Initiated": { color: "#2454a6", bg: "#eff5ff", icon: "lucide:repeat-2", label: "Exchange initiated" },
  "Exchange Pickup Scheduled": { color: "#9a6200", bg: "#fff6dc", icon: "lucide:calendar-clock", label: "Exchange pickup scheduled" },
  "Exchange Picked Up": { color: "#6840aa", bg: "#f5f0ff", icon: "lucide:package-check", label: "Exchange picked up" },
  "Exchange Received": { color: "#9a6200", bg: "#fff6dc", icon: "lucide:package-open", label: "Replacement being prepared" },
  "Exchange Completed": { color: "#087a55", bg: "#edfdf5", icon: "lucide:badge-check", label: "Exchange completed" },
};

const getItemStatusVisual = (status) => {
  if (!status) return ITEM_STATUS_CONFIG.Pending;
  const normalized = String(status).toLowerCase();
  if (normalized === "order placed" || normalized === "order_placed") return ITEM_STATUS_CONFIG["Order Placed"];
  if (normalized === "pending") return ITEM_STATUS_CONFIG.Pending;
  if (normalized === "processing") return ITEM_STATUS_CONFIG["Order Placed"];
  if (normalized === "undelivered") return ITEM_STATUS_CONFIG.Undelivered;
  if (normalized === "rto initiated" || normalized === "rto_initiated") return ITEM_STATUS_CONFIG["RTO Initiated"];
  if (normalized === "rto in transit" || normalized === "rto_in_transit") return ITEM_STATUS_CONFIG["RTO In Transit"];
  if (normalized === "rto delivered" || normalized === "rto_delivered" || normalized === "rto") return ITEM_STATUS_CONFIG["RTO Delivered"];
  if (normalized === "pickup scheduled" || normalized === "pickup_scheduled" || normalized === "awb assigned" || normalized === "awb_assigned") return ITEM_STATUS_CONFIG["Pickup Scheduled"];
  if (normalized === "out for pickup" || normalized === "out_for_pickup") return ITEM_STATUS_CONFIG["Out For Pickup"];
  if (normalized === "picked up" || normalized === "picked_up") return ITEM_STATUS_CONFIG["Picked Up"];
  if (normalized === "shipped" || normalized.includes("in transit") || normalized.includes("manifest")) return ITEM_STATUS_CONFIG.Shipped;
  if (normalized === "delivered") return ITEM_STATUS_CONFIG.Delivered;
  if (normalized.includes("partial") && normalized.includes("cancel")) return ITEM_STATUS_CONFIG["Partially Cancelled"];
  if (normalized === "cancelled") return ITEM_STATUS_CONFIG.Cancelled;
  if (normalized.includes("cancel")) return ITEM_STATUS_CONFIG.Cancelled;
  if (normalized === "out for delivery" || normalized === "out_for_delivery") return ITEM_STATUS_CONFIG["Out For Delivery"];
  if (normalized === "seller cancelled" || normalized === "seller_cancelled") return ITEM_STATUS_CONFIG["Seller Cancelled"];
  if (normalized.includes("return requested")) return ITEM_STATUS_CONFIG["Return Requested"];
  if (normalized.includes("return initiated")) return ITEM_STATUS_CONFIG["Return Initiated"];
  if (normalized.includes("out for return pickup")) return ITEM_STATUS_CONFIG["Out For Return Pickup"];
  if (normalized.includes("return picked up")) return ITEM_STATUS_CONFIG["Return Picked Up"];
  if (normalized.includes("return completed") || normalized.includes("return delivered")) return ITEM_STATUS_CONFIG["Return Completed"];
  if (normalized.includes("exchange requested")) return ITEM_STATUS_CONFIG["Exchange Requested"];
  if (normalized.includes("exchange initiated")) return ITEM_STATUS_CONFIG["Exchange Initiated"];
  if (normalized.includes("exchange pickup scheduled")) return ITEM_STATUS_CONFIG["Exchange Pickup Scheduled"];
  if (normalized.includes("exchange picked up")) return ITEM_STATUS_CONFIG["Exchange Picked Up"];
  if (normalized.includes("exchange received")) return ITEM_STATUS_CONFIG["Exchange Received"];
  if (normalized.includes("exchange completed") || normalized.includes("exchange delivered")) return ITEM_STATUS_CONFIG["Exchange Completed"];
  return ITEM_STATUS_CONFIG[status] || ITEM_STATUS_CONFIG.Pending;
};

// The pill each item carries — mirrors My Orders' getItemStatusMeta: an item with
// its own status (cancelled, returned…) shows that; otherwise it inherits the
// order's, except an untouched item on a return/exchange order stays "Delivered".
const getItemStatusMeta = (order, item) => {
  const itemStatus = String(item?.status || "").trim();
  if (itemStatus && itemStatus.toLowerCase() !== "active") return getItemStatusVisual(itemStatus);
  const orderStatus = String(order?.status || "").toLowerCase();
  if (orderStatus.includes("return") || orderStatus.includes("exchange")) return ITEM_STATUS_CONFIG.Delivered;
  return getItemStatusVisual(order?.status);
};

const getActionLabel = (action) => {
  const type = String(action?.action_type || "").toLowerCase();
  if (type === "return") return "Return";
  if (type === "exchange") return "Exchange";
  if (type === "cancel") return "Cancellation";
  return "Request";
};

// An exchange ACTION is marked Completed the moment the old saree is back with the seller —
// which is not what "Completed" means to a customer still waiting for their replacement.
// Show it as "Item received" until the item itself reaches Exchange Completed (replacement
// delivered).
const getActionStatusLabel = (action, item) => {
  const status = String(action?.status || "Initiated");
  const isExchange = String(action?.action_type || "").toLowerCase() === "exchange";
  if (isExchange && status === "Completed" && normalizeStatus(item?.status) !== "exchange completed") {
    return "Item received";
  }
  return status;
};

const getOrderActions = (order) => ({
  canCancel: canCancelOrder(order),
  canReturnExchange: getEligibleActionItems(order, "return").length > 0 || getEligibleActionItems(order, "exchange").length > 0,
});

const stepState = (status, currentIndex, steps) => {
  // Last matching step wins — a broad early match must not shadow a specific
  // later one (e.g. "rto in transit" contains "in transit", which the Shipped
  // step also matches; the RTO step further down is the real position).
  const matchedIndex = steps.reduce(
    (found, step, index) => (step.matches.some((match) => status.includes(match)) ? index : found),
    -1,
  );
  if (matchedIndex === -1) return currentIndex === 0 ? "current" : "pending";
  if (currentIndex < matchedIndex) return "done";
  if (currentIndex === matchedIndex) return "current";
  return "pending";
};

const buildSteps = (status, steps) => steps.map((step, index) => ({
  ...step,
  state: stepState(status, index, steps),
}));

const buildTimeline = (order, tracking) => {
  const status = String(order?.status || "Pending").toLowerCase();
  const activities = tracking?.tracking?.tracking_data?.shipment_track_activities || [];
  if (activities.length) {
    return activities.map((activity, index) => ({
      title: activity.activity || "Shipment update",
      detail: [activity.location, activity.date].filter(Boolean).join(" • "),
      active: index === 0,
      icon: index === 0 ? "lucide:radio" : "lucide:circle",
    }));
  }

  return [
    {
      title: "Order placed",
      detail: `${formatDate(order?.createdAt)} • Confirmation email sent`,
      active: true,
      icon: "lucide:check-circle-2",
    },
    {
      title: "Picked up",
      detail: "Courier pickup scheduled or completed",
      active: ["processing", "awb assigned", "shipped", "out for delivery", "delivered", "undelivered", "rto initiated", "rto in transit", "rto delivered", "seller cancelled"].includes(status),
      icon: "lucide:package",
    },
    {
      title: "Shipped",
      detail: order?.shiprocket_awb ? `AWB ${order.shiprocket_awb}` : "Tracking appears after dispatch",
      active: ["awb assigned", "shipped", "out for delivery", "delivered", "undelivered", "rto initiated", "rto in transit", "rto delivered", "seller cancelled"].includes(status),
      icon: "lucide:truck",
    },
    {
      title: "Out for delivery",
      detail: "Courier will attempt delivery at your address",
      active: ["out for delivery", "delivered", "undelivered", "rto initiated", "rto in transit", "rto delivered", "seller cancelled"].includes(status),
      icon: "lucide:navigation",
    },
    ...(status.includes("rto") || status === "undelivered" || status === "seller cancelled" ? [{
      title: status === "rto delivered" || status === "seller cancelled" ? "Order returned to seller" : "Returning to seller",
      detail: order?.refund_note || "The courier could not complete delivery.",
      active: ["rto initiated", "rto in transit", "rto delivered", "seller cancelled"].includes(status),
      icon: "lucide:warehouse",
    }] : []),
    {
      title: "Delivered",
      detail: order?.delivered_at ? formatDate(order.delivered_at) : "Final delivery scan pending",
      active: status === "delivered",
      icon: "lucide:badge-check",
    },
  ];
};

// Steps for the Return / Exchange panel, driven by the REVERSE shipment's OWN lifecycle
// (shipment_status: CREATED -> PICKUP_SCHEDULED -> PICKED_UP -> IN_TRANSIT -> RECEIVED),
// which the courier webhook maintains.
//
// This used to key off order.status instead, which breaks in two ways: order.status is a
// single field describing the whole ORDER, so it moves on the moment anything else happens
// — most sharply when an exchange replacement ships and it becomes "Processing". At that
// point it no longer contains "return"/"exchange", this returned [], and a pickup that had
// already been received back fell through to the hardcoded "your pickup is being arranged"
// copy. The shipment's own status never gets clobbered that way.
const buildReverseStatusTimeline = (shipment) => {
  const status = String(shipment?.shipment_status || "").toUpperCase();
  if (!status) return [];

  const isExchange = shipment?.type === "exchange";
  const noun = isExchange ? "Exchange" : "Return";

  const steps = [
    { title: `${noun} initiated`, detail: `${noun} request created`, icon: isExchange ? "lucide:repeat-2" : "lucide:rotate-ccw", matches: ["CREATED"] },
    { title: "Pickup scheduled", detail: "Courier pickup has been arranged", icon: "lucide:calendar-clock", matches: ["PICKUP_SCHEDULED"] },
    { title: "Picked up", detail: shipment?.picked_up_at ? formatDate(shipment.picked_up_at) : "Parcel collected by courier", icon: "lucide:package-check", matches: ["PICKED_UP"] },
    { title: "In transit to seller", detail: "Parcel is on its way back", icon: "lucide:truck", matches: ["IN_TRANSIT"] },
    { title: "Received by seller", detail: shipment?.received_at ? formatDate(shipment.received_at) : `${noun} item received back`, icon: "lucide:badge-check", matches: ["RECEIVED"] },
  ];

  if (status === "CANCELLED") {
    return [
      { ...steps[0], state: "done" },
      { title: "Pickup cancelled", detail: `This ${noun.toLowerCase()} pickup was cancelled`, icon: "lucide:x-circle", state: "current" },
    ];
  }

  return buildSteps(status, steps);
};

// Locate the "current" step: the explicitly-current one, else the last done.
const currentStepIndex = (steps) => {
  const explicit = steps.findIndex((s) => s.state === "current");
  if (explicit !== -1) return explicit;
  let last = 0;
  steps.forEach((s, i) => { if (s.state === "done") last = i; });
  return last;
};

const TimelineStep = ({ step, showLine, currentLabel }) => {
  const statusLabel = step.state === "done"
    ? "Completed"
    : step.state === "current"
      ? (currentLabel || "In progress")
      : null;
  return (
  <div className={`confirmation-step is-${step.state || "pending"}`}>
    <div className="confirmation-step-track">
      <span className="confirmation-step-icon">
        {step.state === "done" ? <Icon icon="lucide:check" /> : <Icon icon={step.icon} />}
      </span>
      {showLine && <div className="confirmation-step-line" />}
    </div>
    <div className="confirmation-step-body">
      <strong>{step.title}</strong>
      <p>{step.detail}</p>
    </div>
    {statusLabel && <span className={`confirmation-step-status is-${step.state}`}>{statusLabel}</span>}
  </div>
  );
};

// Shared timeline renderer used by every timeline on the page (main shipment,
// return, exchange — status steps or live courier scans). By default it is
// COLLAPSED to: first step · "… N more" · current step · next step. Tapping the
// "…" row expands the whole timeline (and a "Show less" row collapses it again).
// Only collapses when it would hide at least two steps, so short timelines and
// near-complete ones just render in full.
const CollapsibleTimeline = ({ steps, currentLabel }) => {
  const [expanded, setExpanded] = useState(false);
  if (!Array.isArray(steps) || !steps.length) return null;

  const current = currentStepIndex(steps);
  const keep = [0, current, current + 1].filter((i) => i >= 0 && i < steps.length);
  const visible = Array.from(new Set(keep)).sort((a, b) => a - b);
  const hiddenCount = steps.length - visible.length;
  const collapse = !expanded && hiddenCount >= 2;

  // Ordered render rows: steps + "…" markers wherever a run of steps is hidden.
  const rows = [];
  if (collapse) {
    let prev = -1;
    visible.forEach((idx) => {
      if (idx - prev > 1) rows.push({ type: "more", count: idx - prev - 1, key: `more-${prev}-${idx}` });
      rows.push({ type: "step", step: steps[idx], key: `step-${idx}` });
      prev = idx;
    });
    if (prev < steps.length - 1) rows.push({ type: "more", count: steps.length - 1 - prev, key: "more-tail" });
  } else {
    steps.forEach((step, idx) => rows.push({ type: "step", step, key: `step-${idx}` }));
  }

  return (
    <div className="confirmation-timeline">
      {rows.map((row, i) => {
        const showLine = i < rows.length - 1;
        if (row.type === "more") {
          return (
            <button
              type="button"
              key={row.key}
              className="confirmation-step confirmation-step-more"
              onClick={() => setExpanded(true)}
              aria-label={`Show ${row.count} more ${row.count === 1 ? "update" : "updates"}`}
            >
              <div className="confirmation-step-track">
                <span className="confirmation-step-icon"><Icon icon="lucide:more-vertical" /></span>
                {showLine && <div className="confirmation-step-line" />}
              </div>
              <div className="confirmation-step-body">
                <strong>Show {row.count} more {row.count === 1 ? "update" : "updates"}</strong>
                <p>Tap to expand the full timeline</p>
              </div>
            </button>
          );
        }
        return <TimelineStep key={row.key} step={row.step} showLine={showLine} currentLabel={currentLabel} />;
      })}
      {expanded && hiddenCount >= 2 && (
        <button type="button" className="confirmation-timeline-less" onClick={() => setExpanded(false)}>
          Show less
        </button>
      )}
    </div>
  );
};

// Shared renderer for the Return / Exchange panel timelines (status steps or
// live courier scans) — same collapsible behaviour as the main timeline.
const ReverseStepsTimeline = ({ steps }) => <CollapsibleTimeline steps={steps} />;

// Map a reverse (return/exchange) shipment's ShipRocket scan activities to timeline steps.
const buildReverseActivities = (shipment) => {
  const activities = shipment?.tracking?.tracking_data?.shipment_track_activities || [];
  return activities.map((activity, index) => ({
    title: activity.activity || "Pickup update",
    detail: [activity.location, activity.date].filter(Boolean).join(" • "),
    state: index === 0 ? "current" : "done",
    icon: index === 0 ? "lucide:radio" : "lucide:circle",
  }));
};

const buildOrderTimeline = (order) => {
  const status = String(order?.status || "Pending").toLowerCase();

  const forwardSteps = [
    { title: "Order placed", detail: formatDate(order?.createdAt), icon: "lucide:check-circle-2", matches: ["pending", "order placed"] },
    { title: "Processing", detail: "Seller is preparing your order", icon: "lucide:package-2", matches: ["processing"] },
    { title: "Pickup scheduled", detail: "Courier pickup has been arranged", icon: "lucide:calendar-clock", matches: ["pickup scheduled", "pickup_scheduled", "awb assigned", "awb_assigned", "out for pickup", "out_for_pickup"] },
    { title: "Picked up", detail: "Courier has collected your order", icon: "lucide:package-check", matches: ["picked up", "picked_up"] },
    { title: "Shipped", detail: order?.shiprocket_awb ? `AWB ${order.shiprocket_awb}` : "Tracking appears after dispatch", icon: "lucide:truck", matches: ["shipped", "in transit"] },
    { title: "Out for delivery", detail: "Courier will attempt delivery at your address", icon: "lucide:navigation", matches: ["out for delivery"] },
    { title: "Delivered", detail: order?.delivered_at ? formatDate(order.delivered_at) : "Final delivery scan pending", icon: "lucide:badge-check", matches: ["delivered"] },
  ];

  const rtoSteps = [
    ...forwardSteps.slice(0, 6),
    { title: "Delivery attempt failed", detail: "Courier could not complete delivery", icon: "lucide:triangle-alert", matches: ["undelivered"] },
    { title: "RTO initiated", detail: "Shipment is returning to seller", icon: "lucide:undo-2", matches: ["rto initiated"] },
    { title: "RTO in transit", detail: "Shipment is on the way back", icon: "lucide:truck", matches: ["rto in transit"] },
    { title: "Order returned to seller", detail: order?.refund_note || "Order returned to seller", icon: "lucide:warehouse", matches: ["rto delivered", "seller cancelled"] },
  ];

  const cancelledSteps = [
    { title: "Order placed", detail: formatDate(order?.createdAt), icon: "lucide:check-circle-2", matches: ["order placed", "pending", "cancelled", "seller cancelled"] },
    { title: status === "seller cancelled" ? "Cancelled by seller" : "Cancelled", detail: "This order has been cancelled", icon: "lucide:x-circle", matches: ["cancelled", "seller cancelled"] },
  ];

  // Return/exchange progress lives in its own "Return / Exchange tracking"
  // panel below — the shipment timeline keeps showing the completed forward
  // journey undisturbed (reverse flows only exist after delivery).
  if (status.includes("exchange") || status.includes("return")) {
    return buildSteps("delivered", forwardSteps);
  }
  if (status === "cancelled" || status === "seller cancelled") return buildSteps(status, cancelledSteps);
  if (status.includes("rto") || status === "undelivered") {
    // The bare "RTO" status (prepaid parcel back with the seller, awaiting the
    // customer's re-dispatch / refund choice) is the terminal RTO step — the
    // short string matches no step keyword, which used to fall back to step 0.
    return buildSteps(status === "rto" ? "rto delivered" : status, rtoSteps);
  }
  if (status.includes("partial") && status.includes("cancel")) {
    return [
      { title: "Order placed", detail: formatDate(order?.createdAt), icon: "lucide:check-circle-2", state: "done" },
      { title: "Order modified", detail: `Some items removed${order?.modified_at ? ` · ${formatDate(order.modified_at)}` : ""}`, icon: "lucide:file-edit", state: "current" },
      { title: "Remaining items in transit", detail: "The rest of your order will be shipped as scheduled", icon: "lucide:truck", state: "pending" },
    ];
  }

  // order.delivered_at survives from the FIRST delivery even after a second forward
  // shipment starts (an exchange replacement, or a paid RTO redispatch) cycles the
  // order back through early statuses (Processing, AWB Assigned, Shipped…). Left as
  // plain forwardSteps, step 1 would replay "Order placed" with the original order's
  // date — reading as if the whole order restarted, instead of a new shipment going
  // out after the first one already finished.
  if (order?.delivered_at && status !== "delivered") {
    const redispatchSteps = forwardSteps.map((step, index) => (
      index === 0
        ? { ...step, title: "Replacement dispatched", detail: "A new shipment was arranged after your return/exchange", icon: "lucide:repeat-2" }
        : step
    ));
    return buildSteps(status, redispatchSteps);
  }

  return buildSteps(status, forwardSteps);
};

const CANCEL_REASONS = [
  "Incorrect item/size selected",
  "Ordered by mistake / Duplicate order",
  "Delivery time is too long",
  "Decided to buy another product",
  "Applied wrong coupon code / Forgot discount",
  "Payment or billing issue",
  "Other reason"
];

const RETURN_REASONS = [
  "Size or fit issue",
  "Product color/design is different from images",
  "Received damaged or defective product",
  "Quality of material is not as expected",
  "Wrong product delivered",
  "Other reason",
];

const EXCHANGE_REASONS = [
  "Need a different color/design",
  "Size or fit issue",
  "Received damaged or defective product",
  "Other reason",
];

const getActionConfig = (type) => {
  if (type === "return") return { title: "Request Return", label: "Return reason", reasons: RETURN_REASONS, button: "Submit Return Request", tone: "primary" };
  if (type === "exchange") return { title: "Request Exchange", label: "Exchange reason", reasons: EXCHANGE_REASONS, button: "Submit Exchange Request", tone: "primary" };
  return { title: "Cancel Order", label: "Reason for cancellation", reasons: CANCEL_REASONS, button: "Cancel Entire Order", tone: "danger" };
};

const SkLine = ({ w, h = 12, mb = 0 }) => (
  <div className="oc-sk" style={{ width: w, height: h, borderRadius: 5, marginBottom: mb || undefined }} />
);

const OrderConfirmationSkeleton = () => (
  <main className="order-confirmation-page">
    <section className="oc-thanks">
      <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
        <SkLine w={240} h={44} />
        <SkLine w={170} h={18} />
        <SkLine w="min(320px, 80%)" h={11} />
        <SkLine w={150} h={44} />
      </div>
    </section>

    <div className="oc-thanks-meta">
      <div className="oc-thanks-meta-cell" style={{ display: "grid", gap: 6 }}>
        <SkLine w={90} h={11} />
        <SkLine w={140} h={14} />
      </div>
      <div className="oc-thanks-meta-cell" style={{ display: "grid", gap: 6 }}>
        <SkLine w={80} h={11} />
        <SkLine w={110} h={14} />
      </div>
    </div>

    <section className="order-confirmation-grid">
      <div className="order-confirmation-main">
        <div className="order-panel">
          <div className="order-panel-head">
            <SkLine w={140} h={14} />
            <SkLine w={80} h={11} />
          </div>
          <div className="confirmation-timeline">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="confirmation-step">
                <div className="oc-sk oc-sk-step-icon" />
                <div style={{ display: "grid", gap: 6 }}>
                  <SkLine w={130} h={13} />
                  <SkLine w={190} h={11} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="order-panel">
          <div className="order-panel-head">
            <SkLine w={50} h={14} />
            <SkLine w={55} h={11} />
          </div>
          <div className="confirmation-items">
            {[1, 2].map((i) => (
              <div key={i} className="oc-sk-item-row">
                <div className="oc-sk oc-sk-item-img" />
                <div style={{ display: "grid", gap: 7, flex: 1 }}>
                  <SkLine w="70%" h={13} />
                  <SkLine w="45%" h={11} />
                  <SkLine w={90} h={20} />
                </div>
                <SkLine w={65} h={13} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="order-confirmation-side">
        <div className="order-panel">
          <SkLine w={130} h={14} mb={14} />
          {[130, 110, 90, 120, 100, 80].map((w, i) => (
            <div key={i} className="oc-sk-summary-row">
              <SkLine w={w} h={12} />
              <SkLine w={55} h={12} />
            </div>
          ))}
        </div>

        <div className="order-panel">
          <SkLine w={130} h={14} mb={12} />
          <SkLine w="80%" h={12} mb={7} />
          <SkLine w="65%" h={12} mb={7} />
          <SkLine w="55%" h={12} />
        </div>

        <div className="oc-sk oc-sk-btn" />
      </aside>
    </section>
  </main>
);

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { refreshCart } = useCart();
  const orderId = searchParams.get("orderId");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [ticket, setTicket] = useState(null);
  const [supportModal, setSupportModal] = useState(false);
  const [supportForm, setSupportForm] = useState({ category: TICKET_CATEGORIES[0], message: "", phone: "" });
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const [cancelModal, setCancelModal] = useState({
    isOpen: false,
    type: "cancel",
    orderId: null,
    itemName: "",
    selected: {},
  });
  const [cancelForm, setCancelForm] = useState({
    reason: "Incorrect item/size selected",
    comments: ""
  });
  const [modalSubmitLoading, setModalSubmitLoading] = useState(false);
  const [actionEstimate, setActionEstimate] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({ isOpen: false, item: null });
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  // "Track your order" on the thank-you hero opens the full order details
  // (timeline, items, cancel/return/exchange, refund, address) in a modal instead
  // of it sitting inline on the page.
  const [orderDetailsModalOpen, setOrderDetailsModalOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, title: "", comment: "", images: [] });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitLabel, setFeedbackSubmitLabel] = useState("");
  const [bankForm, setBankForm] = useState({
    account_holder_name: "",
    account_number: "",
    ifsc_code: "",
    bank_name: "",
    branch_name: "",
  });
  const [bankSaving, setBankSaving] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  // RTO resolution: "" | "redispatch" | "refund" (in-flight), and the refund
  // confirmation modal toggle.
  const [rtoLoading, setRtoLoading] = useState("");
  const [rtoConfirmOpen, setRtoConfirmOpen] = useState(false);
  // Exchange colour variants keyed by product_id: { loading, colors, error }.
  // Loaded lazily from the product-detail endpoint when the exchange modal is
  // open, so the customer can swap to another colour of the same product.
  const [exchangeVariants, setExchangeVariants] = useState({});

  const breakdown = useMemo(() => getBreakdown(order || {}), [order]);
  // Mirrors CheckoutFlow's totalSavings: MRP markdown + coupon + prepaid discount +
  // waived delivery. Uses deliveryChargeShown (the pre-discount rate recovered from
  // shipping_meta), not shippingDiscount — the ledger's shipping_discount is always 0
  // (delivery is granted as a $0 charge, not a discounted one), so that field alone
  // would silently drop the shipping savings every time. Wallet is excluded, same as
  // checkout: spending your own balance isn't a saving.
  const totalSaved = breakdown.mrpSavings + breakdown.couponDiscount + breakdown.paymentDiscount + breakdown.deliveryChargeShown;
  // Live ShipRocket scan activities (only exist once the parcel is picked up and
  // an AWB is generated). Before that we fall back to the status stepper.
  const liveActivities = tracking?.tracking?.tracking_data?.shipment_track_activities || [];
  const hasLiveTracking = liveActivities.length > 0;
  const timeline = useMemo(
    () => (hasLiveTracking ? buildTimeline(order, tracking) : buildOrderTimeline(order)),
    [order, tracking, hasLiveTracking],
  );
  const courierName = order?.courier_name
    || tracking?.tracking?.tracking_data?.shipment_track?.[0]?.courier_name
    || "";
  const reverseShipments = Array.isArray(tracking?.reverse) ? tracking.reverse : [];
  // A return/exchange was requested but no reverse shipment is booked with the courier yet
  // (trackOrder only returns pickups that have a ShipRocket id/AWB). order.status is the
  // right signal HERE — and only here — because at this point nothing else has happened to
  // the order that could have moved it off the "…Initiated" state.
  const hasPendingReverseRequest = /return|exchange/i.test(String(order?.status || ""));
  // Only actual refunds belong in the ledger below. A prepaid RTO no longer creates a
  // placeholder row (it's written only when a refund is really requested), so this is
  // now a safety net for rows that represent "no money moved": a COD RTO where nothing
  // was collected, and legacy orders still carrying the old "RTO Action Required" /
  // "Not Required" placeholders.
  const refunds = (Array.isArray(order?.refunds) ? order.refunds : []).filter((r) => {
    const s = String(r.status || "").toLowerCase();
    return !s.includes("not required") && !s.includes("action required");
  });
  // Money that goes back to the PAYMENT METHOD for a refund row. `amount` is the ledger
  // total (gateway + wallet), but wallet credit is returned to the wallet — a different
  // destination — so it must not be folded into the figure shown against the card, nor
  // into the column total (it would make the deduction lines fail to add up).
  const refundToPaymentMethod = (r) => {
    const bd = r?.breakdown || null;
    return (bd?.is_full_return && bd?.gateway_refund !== undefined && bd?.gateway_refund !== null)
      ? toNumber(bd.gateway_refund)
      : toNumber(r?.amount);
  };
  const totalRefunded = refunds
    .filter((r) => isRefundSettled(r.status))
    .reduce((sum, r) => sum + refundToPaymentMethod(r), 0);
  const totalWalletReturned = refunds
    .filter((r) => isRefundSettled(r.status))
    .reduce((sum, r) => sum + toNumber(r?.breakdown?.wallet_return), 0);
  const orderActions = useMemo(() => getOrderActions(order), [order]);
  // RTO (order returned to seller). Prepaid parcels wait for the customer to
  // choose "pay to re-dispatch" or "refund"; COD parcels are terminal (the
  // account is COD-blocked and can only reorder prepaid).
  const rtoAction = order?.rto_action || null;
  const rtoAwaiting = Boolean(rtoAction?.awaiting)
    && String(rtoAction?.payment_method || "").toUpperCase() !== "COD";
   
  const rtoCodBlocked = rtoAction?.resolution === "PRODUCT_RETURNED_COD_BLOCKED";
  // Re-dispatch is offered only while the order hasn't already been re-dispatched once
  // AND we're still inside the window that opened when the parcel came back to us.
  // Both conditions are decided by the backend (rto_action) so they can't drift.
  const rtoRedispatchAllowed = rtoAction?.redispatch_allowed !== false;
  const rtoRedispatchBlockedReason = rtoAction?.redispatch_blocked_reason || null;
  // Total forward + RTO charge PAID across every re-dispatch. Survives a later RTO,
  // unlike rto_action (which describes only the latest event).
  const redispatchChargesPaid = toNumber(order?.redispatch_charges_paid);
  // "Refund me instead". These figures come straight from the backend (order.rto_refund),
  // computed by the same helper resolveRto pays out with, so the quote can't drift.
  // The refundable base EXCLUDES re-dispatch fees already paid (that money is spent), and
  // the seller keeps the platform fee + this cycle's forward + RTO charges — all out of
  // the gateway money. Wallet credit is returned to the wallet in full and is called out
  // in a message, never folded into the gateway figure.
  const rtoRefund = order?.rto_refund || null;
  const rtoWalletPaid = toNumber(rtoRefund?.wallet_refund ?? order?.wallet_amount);
  const rtoPlatformFee = toNumber(rtoRefund?.platform_fee ?? order?.platform_fee);
  const rtoGiftCharge = toNumber(rtoRefund?.gift_charge ?? order?.gift_charge);
  const rtoRefundableBase = toNumber(rtoRefund?.refundable_base ?? order?.amount_paid);
  const rtoForwardRtoCharges = toNumber(rtoRefund?.forward_rto_charges ?? rtoAction?.redispatch_fee);
  const rtoGatewayRefund = rtoRefund
    ? toNumber(rtoRefund.gateway_refund)
    : Math.max(0, rtoRefundableBase - rtoPlatformFee - rtoGiftCharge - rtoForwardRtoCharges);
  const canSelectReturnItems = useMemo(() => getEligibleActionItems(order, "return").length > 0, [order]);
  const canSelectExchangeItems = useMemo(() => getEligibleActionItems(order, "exchange").length > 0, [order]);
  const orderNumber = getOrderDisplayNumber(order);
  const customerFullName = String(order?.customer_name || "").trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  const statusLabel = getCustomerOrderStatusLabel(order?.status);
  const statusTone = (() => {
    const s = String(order?.status || "").toLowerCase();
    if (s.includes("cancel") || s.includes("rto") || s === "undelivered") return "alert";
    if (s.includes("delivered") || s.includes("completed")) return "success";
    return "progress";
  })();
  const needsCodBankDetails = String(order?.payment_method || "").toUpperCase() === "COD"
    && String(order?.refund_status || "").toLowerCase().includes("bank");

  useEffect(() => {
    let cancelled = false;
    const loadOrder = async () => {
      if (!orderId) {
        setError("Order details are missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const response = await api.get(`/api/orders/${orderId}`);
        if (cancelled) return;
        setOrder(response.data);

      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || "Unable to load order details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Pull live ShipRocket tracking. Returns scan activities once the parcel has
  // an AWB; before pickup it just reports "not yet dispatched" (handled gracefully).
  const fetchTracking = useCallback(async () => {
    if (!orderId) return;
    setTrackingLoading(true);
    try {
      const res = await api.get(`/api/orders/track/${orderId}`);
      setTracking(res.data);
    } catch {
      // Non-blocking: the status stepper still shows.
    } finally {
      setTrackingLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (order && (order.shiprocket_awb || order.shiprocket_order_id)) {
      fetchTracking();
    }
  }, [order?.id, order?.shiprocket_awb, order?.shiprocket_order_id, fetchTracking]);

  // Newest support ticket already raised on THIS order, so the help box can show
  // its live status instead of always inviting a new one. Same feature as My Orders.
  const fetchTicket = useCallback(async () => {
    if (!orderId) return;
    try {
      const response = await api.get(`/api/support/tickets/my?orderId=${orderId}`);
      const tickets = Array.isArray(response.data) ? response.data : [];
      setTicket(tickets[0] || null);
    } catch {
      // Non-blocking: the help box still offers "Contact Us" without a status.
    }
  }, [orderId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const openSupportModal = () => {
    setSupportForm({ category: TICKET_CATEGORIES[0], message: "", phone: "" });
    setSupportModal(true);
  };

  const closeSupportModal = () => {
    if (supportSubmitting) return;
    setSupportModal(false);
  };

  const submitSupportTicket = async (event) => {
    event.preventDefault();
    if (!order?.id) return;
    if (supportForm.message.trim().length < 10) {
      showNotification("Please describe your issue in a little more detail.", "warning");
      return;
    }

    setSupportSubmitting(true);
    try {
      const response = await api.post("/api/support/tickets", {
        orderId: order.id,
        category: supportForm.category,
        message: supportForm.message.trim(),
        phone: supportForm.phone.trim(),
      });
      showNotification(response.data?.message || "Your ticket has been raised.", "success");
      setSupportModal(false);
      fetchTicket();
    } catch (err) {
      showNotification(err?.response?.data?.message || "Unable to raise your ticket right now.", "error");
    } finally {
      setSupportSubmitting(false);
    }
  };

  // The invoice is an authenticated endpoint, so it can't be a plain link — fetch
  // it with the auth header and hand the HTML to a tab the browser can print. The
  // tab is opened synchronously inside the click so the pop-up blocker allows it.
  const downloadInvoice = async () => {
    if (invoiceLoading || !order?.id) return;
    const tab = window.open("", "_blank");
    setInvoiceLoading(true);
    try {
      const response = await api.get(`/api/orders/${order.id}/invoice`);
      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: "text/html" }));
      if (tab) {
        tab.location.href = blobUrl;
      } else {
        showNotification("Allow pop-ups for this site to open your invoice.", "warning");
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      tab?.close();
      showNotification(err?.response?.data?.message || "Could not open your invoice right now.", "error");
    } finally {
      setInvoiceLoading(false);
    }
  };

  // While the exchange modal is open, lazily pull what each eligible LINE can be swapped
  // for: every active product priced at EXACTLY what was paid for it, with its in-stock
  // colours. Keyed by ORDER ITEM (not product) because the options depend on that line's
  // paid price. Every line always resolves to a terminal state — a failed fetch ends as
  // { loading: false, error: true } rather than spinning on "Loading…".
  useEffect(() => {
    if (!cancelModal.isOpen || cancelModal.type !== "exchange" || !order) return;
    const missing = getEligibleActionItems(order, "exchange")
      .filter((item) => exchangeVariants[item.id] === undefined);
    if (!missing.length) return;

    setExchangeVariants((prev) => {
      const next = { ...prev };
      missing.forEach((item) => { next[item.id] = { loading: true, options: [], error: false }; });
      return next;
    });

    missing.forEach(async (item) => {
      try {
        const res = await api.get(
          `/api/orders/${order.id}/item-actions/exchange-options?orderItemId=${item.id}`,
        );
        const data = res.data || {};
        setExchangeVariants((prev) => ({
          ...prev,
          [item.id]: {
            loading: false,
            options: Array.isArray(data.options) ? data.options : [],
            paidPrice: data.paid_price,
            error: false,
          },
        }));
      } catch {
        setExchangeVariants((prev) => ({
          ...prev,
          [item.id]: { loading: false, options: [], error: true },
        }));
      }
    });
  }, [cancelModal.isOpen, cancelModal.type, order, exchangeVariants]);

  // NOTE: exchange targets are NOT auto-selected. The customer sets the quantity first and
  // then allocates every unit of it explicitly — which saree, which colour, how many. There
  // is no sensible default once the quantity can be split across several products, and a
  // silent default would ship something they never chose.

  const openActionModal = (type = "cancel") => {
    const config = getActionConfig(type);
    // Cancellation is whole-order — no item selection needed.
    const eligibleItems = type === "cancel" ? [] : getEligibleActionItems(order, type);
    const selected = eligibleItems.reduce((map, item, index) => ({
      ...map,
      [item.id]: { checked: index === 0, quantity: getActionableQty(item) },
    }), {});
    setCancelModal({
      isOpen: true,
      type,
      orderId: order.id,
      itemName: `Order ${orderNumber}`,
      selected,
    });
    setCancelForm({
      reason: config.reasons[0],
      comments: ""
    });
    setActionEstimate(null);
    setLoadingEstimate(false);
  };

  const closeActionModal = (force = false) => {
    if (modalSubmitLoading && !force) return;
    setCancelModal({ isOpen: false, type: "cancel", orderId: null, itemName: "", selected: {} });
    setActionEstimate(null);
    setLoadingEstimate(false);
  };

  const openFeedbackModal = (item) => {
    if (!canReviewOrderItem(order, item)) {
      showNotification("Product review is available after delivery.", "warning");
      return;
    }
    setFeedbackModal({ isOpen: true, item });
    setFeedbackForm({
      rating: Number(item.feedback?.rating || 5),
      title: item.feedback?.title || "",
      comment: item.feedback?.comment || "",
      images: [],
    });
  };

  const closeFeedbackModal = () => {
    if (feedbackSubmitting) return;
    setFeedbackModal({ isOpen: false, item: null });
    setFeedbackForm({ rating: 5, title: "", comment: "", images: [] });
    setFeedbackSubmitLabel("");
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    const item = feedbackModal.item;
    if (!item || !order?.id) return;
    if (!canReviewOrderItem(order, item)) {
      showNotification("Product review is available after delivery.", "warning");
      return;
    }
    if (feedbackForm.comment.trim().length < 8) {
      showNotification("Please write a short product review.", "warning");
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackSubmitLabel(feedbackForm.images.length ? "Uploading photos..." : "Submitting...");
    try {
      const uploadedImages = feedbackForm.images.length
        ? await uploadReviewImages(feedbackForm.images)
        : [];
      setFeedbackSubmitLabel("Submitting review...");
      const response = await api.post("/api/feedback/submit", {
        orderId: order.id,
        orderItemId: item.id,
        productId: item.product_id,
        rating: feedbackForm.rating,
        title: feedbackForm.title.trim(),
        comment: feedbackForm.comment.trim(),
        images: uploadedImages,
      });
      const msg = response.data?.message?.toLowerCase().includes("updated") ? "Review updated" : "Review submitted";
      showNotification(msg, "success");
      closeFeedbackModal();
      const updated = await api.get(`/api/orders/${orderId}`);
      setOrder(updated.data);
    } catch (error) {
      showNotification(error?.response?.data?.message || "Could not submit review right now.", "error");
    } finally {
      setFeedbackSubmitting(false);
      setFeedbackSubmitLabel("");
    }
  };

  const selectedActionItems = useMemo(() => Object.entries(cancelModal.selected || {})
    .filter(([, value]) => value.checked)
    .map(([id, value]) => ({
      orderItemId: Number(id),
      quantity: value.quantity || null,
      // Exchange only: the sarees the customer wants instead, as a LIST. They can split the
      // exchanged quantity across several products (2 × A + 1 × B) — the quantities must
      // sum to the quantity being exchanged, which the backend re-checks.
      ...(cancelModal.type === "exchange" && value.exchangeTargets?.length
        ? {
          exchangeTargets: value.exchangeTargets.map((t) => ({
            productId: t.productId,
            colorId: t.colorId,
            quantity: t.quantity,
          })),
        }
        : {}),
    })), [cancelModal.selected, cancelModal.type]);

  // How many units of this line are still unallocated — the customer must place every one.
  const exchangeAllocatedQty = (value) => (value?.exchangeTargets || [])
    .reduce((sum, t) => sum + Number(t.quantity || 0), 0);

  // Add one unit of {product, colour} to the line's target list, capped at the quantity
  // being exchanged. Re-picking the same product+colour just increments it.
  const addExchangeTarget = (itemId, option, color) => {
    setCancelModal((current) => {
      const value = current.selected?.[itemId] || {};
      const wanted = Number(value.quantity || 0);
      const targets = [...(value.exchangeTargets || [])];
      const allocated = targets.reduce((sum, t) => sum + Number(t.quantity || 0), 0);
      if (allocated >= wanted) return current; // fully allocated — ignore the click

      const colorId = color?.color_id ?? null;
      const existing = targets.find(
        (t) => Number(t.productId) === Number(option.product_id)
          && String(t.colorId ?? "") === String(colorId ?? ""),
      );
      // Never allocate more of a colour than is actually in stock.
      const stock = Number(color?.stock ?? Infinity);
      if (existing) {
        if (existing.quantity >= stock) return current;
        existing.quantity += 1;
      } else {
        if (stock < 1) return current;
        targets.push({
          productId: option.product_id,
          productName: option.name,
          colorId,
          colorName: color?.name ?? null,
          image: Array.isArray(option.images) ? (option.images[0]?.url || option.images[0]) : null,
          quantity: 1,
        });
      }
      return {
        ...current,
        selected: { ...current.selected, [itemId]: { ...value, exchangeTargets: targets } },
      };
    });
  };

  // Remove one unit; drop the line entirely when it hits zero.
  const removeExchangeTarget = (itemId, index) => {
    setCancelModal((current) => {
      const value = current.selected?.[itemId] || {};
      const targets = [...(value.exchangeTargets || [])];
      const target = targets[index];
      if (!target) return current;
      if (target.quantity > 1) targets[index] = { ...target, quantity: target.quantity - 1 };
      else targets.splice(index, 1);
      return {
        ...current,
        selected: { ...current.selected, [itemId]: { ...value, exchangeTargets: targets } },
      };
    });
  };

  useEffect(() => {
    let cancelled = false;
    setActionEstimate(null);
    const loadEstimate = async () => {
      // Estimates exist only for return/exchange — a cancel refunds the whole
      // paid amount, which we already know from the order itself.
      if (!cancelModal.isOpen || !cancelModal.orderId || cancelModal.type === "cancel" || !selectedActionItems.length) {
        setLoadingEstimate(false);
        return;
      }
      setLoadingEstimate(true);
      try {
        const response = await api.post(`/api/orders/${cancelModal.orderId}/item-actions/estimate`, {
          actionType: cancelModal.type,
          items: selectedActionItems,
        });
        if (!cancelled) setActionEstimate(response.data);
      } catch {
        if (!cancelled) setActionEstimate(null);
      } finally {
        if (!cancelled) setLoadingEstimate(false);
      }
    };
    loadEstimate();
    return () => {
      cancelled = true;
    };
  }, [cancelModal.isOpen, cancelModal.orderId, cancelModal.type, selectedActionItems]);

  const submitBankDetails = async (event) => {
    event.preventDefault();
    setBankSaving(true);
    try {
      const response = await api.post(`/api/orders/${orderId}/refund-bank-details`, bankForm);
      showNotification(response.data?.message || "Bank details saved.", "success");
      const updated = await api.get(`/api/orders/${orderId}`);
      setOrder(updated.data);
      setBankForm({
        account_holder_name: "",
        account_number: "",
        ifsc_code: "",
        bank_name: "",
        branch_name: "",
      });
    } catch (err) {
      showNotification(err?.response?.data?.message || "Please check bank details and try again.", "error");
    } finally {
      setBankSaving(false);
    }
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setModalSubmitLoading(true);
    const { orderId, type } = cancelModal;
    const finalReason = cancelForm.comments.trim() 
      ? `${cancelForm.reason} - ${cancelForm.comments.trim()}`
      : cancelForm.reason;

    try {
      let response;
      if (type === "cancel") {
        // Whole-order cancellation. Backend restocks, reverses the ledger and
        // refunds (gateway + wallet) for prepaid; COD is simply cancelled.
        response = await api.post(`/api/orders/${orderId}/cancel`, { reason: finalReason });
        showNotification(response.data?.refund_message || response.data?.message || "Order cancelled successfully.", "success");
      } else {
        if (!selectedActionItems.length) {
          showNotification("Please select at least one product.", "warning");
          setModalSubmitLoading(false);
          return;
        }
        // Exchange: don't submit while a selected line's options are still loading — the
        // customer hasn't had the chance to choose what they want instead yet.
        if (type === "exchange") {
          const stillLoading = selectedActionItems.some(
            ({ orderItemId }) => exchangeVariants[orderItemId]?.loading,
          );
          if (stillLoading) {
            showNotification("Please wait for the exchange options to load.", "warning");
            setModalSubmitLoading(false);
            return;
          }
          // Every unit going back must have a saree chosen to replace it. The backend
          // re-checks this, but failing here keeps the customer in the picker with their
          // choices intact rather than bouncing them off a server error.
          const unallocated = selectedActionItems.find(({ orderItemId, quantity, exchangeTargets }) => {
            const item = (order?.OrderItems || []).find((it) => Number(it.id) === Number(orderItemId));
            const wanted = Number(quantity || getActionableQty(item));
            const chosen = (exchangeTargets || []).reduce((sum, t) => sum + Number(t.quantity || 0), 0);
            return chosen !== wanted;
          });
          if (unallocated) {
            const item = (order?.OrderItems || []).find(
              (it) => Number(it.id) === Number(unallocated.orderItemId),
            );
            showNotification(
              `Please choose exactly ${unallocated.quantity || getActionableQty(item)} replacement saree(s) for ${item?.product_name || "this product"}.`,
              "warning",
            );
            setModalSubmitLoading(false);
            return;
          }
        }
        response = await api.post(`/api/orders/${orderId}/item-actions`, {
          actionType: type,
          items: selectedActionItems,
          reason: finalReason,
          comments: cancelForm.comments.trim(),
        });
        showNotification(response.data?.message || "Request submitted.", "success");
      }
      const updated = await api.get(`/api/orders/${orderId}`);
      setOrder(updated.data || response.data.order || order);
      closeActionModal(true);
    } catch (err) {
      showNotification(err?.response?.data?.message || "Unable to process this request.", "error");
    } finally {
      setModalSubmitLoading(false);
    }
  };

  const reloadOrder = useCallback(async () => {
    try {
      const updated = await api.get(`/api/orders/${orderId}`);
      setOrder(updated.data);
    } catch {
      // Non-blocking: the success toast already fired; a manual refresh recovers.
    }
  }, [orderId]);

  // COD RTO → "Shop again with prepaid": drop this order's items back into the
  // bag and send the customer to the cart (their COD is now blocked, so they'll
  // check out prepaid).
  const handleReorderPrepaid = async () => {
    const items = (order?.OrderItems || []).filter(
      (it) => String(it.status || "").toLowerCase() !== "cancelled",
    );
    if (!items.length) {
      navigate("/collection");
      return;
    }
    setRtoLoading("reorder");
    try {
      const results = await Promise.allSettled(
        items.map((it) => api.post(API_ENDPOINTS.cart, {
          productId: it.product_id,
          quantity: Math.max(1, toNumber(it.quantity) || 1),
          colorId: it.colorId ?? null,
        })),
      );
      const added = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - added;
      await refreshCart();
      if (added === 0) {
        showNotification("These items are no longer available to buy.", "error");
        setRtoLoading("");
        return;
      }
      showNotification(
        failed > 0
          ? `${added} item${added > 1 ? "s" : ""} added to your bag. ${failed} could not be added.`
          : "Items added to your bag.",
        failed > 0 ? "warning" : "success",
      );
      navigate("/cart");
    } catch {
      showNotification("Unable to add these items to your bag right now.", "error");
      setRtoLoading("");
    }
  };

  // Prepaid RTO → "Request refund": abandon the parcel. The backend refunds what
  // was paid minus the forward + RTO logistics it already spent.
  const handleRtoRefund = async () => {
    if (!order) return;
    setRtoLoading("refund");
    try {
      const res = await api.post(API_ENDPOINTS.resolveRto, { orderId: order.id, action: "abandon" });
      showNotification(res.data?.message || "Refund initiated.", "success");
      setRtoConfirmOpen(false);
      await reloadOrder();
    } catch (err) {
      showNotification(err?.response?.data?.message || "Unable to process the refund right now.", "error");
    } finally {
      setRtoLoading("");
    }
  };

  // Prepaid RTO → "Re-dispatch": collect the forward + RTO charge via Razorpay,
  // then tell the backend to raise a fresh forward shipment for the same order.
  const handleRtoRedispatch = async () => {
    if (!order || !rtoAction) return;
    const fee = toNumber(rtoAction.redispatch_fee);
    setRtoLoading("redispatch");
    try {
      // Zero-fee guard (shouldn't occur for a prepaid RTO): resolve directly.
      if (fee <= 0) {
        const res = await api.post(API_ENDPOINTS.resolveRto, { orderId: order.id, action: "redispatch" });
        showNotification(res.data?.message || "Order re-dispatched.", "success");
        await reloadOrder();
        setRtoLoading("");
        return;
      }

      if (!window.Razorpay) {
        showNotification("Payment gateway is still loading. Please try again.", "error");
        setRtoLoading("");
        return;
      }

      const orderResponse = await api.post(API_ENDPOINTS.razorpay.createOrder, { amount: fee });
      const razorpayOrder = orderResponse.data;
      if (!razorpayOrder?.id) throw new Error(razorpayOrder?.message || "Unable to start payment.");

      const options = {
        key: requiredEnv("VITE_RAZORPAY_KEY_ID"),
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency || "INR",
        name: "Banarasi Kala",
        description: `Re-dispatch charges · Order ${orderNumber}`,
        order_id: razorpayOrder.id,
        prefill: buildRazorpayPrefill({
          name: order.customer_name,
          email: order.customer_email,
          phone: order.phone,
        }),
        theme: { color: "#800020" },
        handler: async (response) => {
          try {
            const verifyRes = await api.post(API_ENDPOINTS.razorpay.verifyPayment, response);
            if (!verifyRes.data?.success) throw new Error("Payment verification failed.");
            const res = await api.post(API_ENDPOINTS.resolveRto, {
              orderId: order.id,
              action: "redispatch",
              gateway: "razorpay",
              gateway_payment_id: response.razorpay_payment_id,
            });
            showNotification(res.data?.message || "Payment received — your order is being re-dispatched.", "success");
            await reloadOrder();
          } catch (err) {
            showNotification(err?.response?.data?.message || err.message || "Unable to confirm the re-dispatch.", "error");
          } finally {
            setRtoLoading("");
          }
        },
        modal: { ondismiss: () => setRtoLoading("") },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      showNotification(err?.response?.data?.message || err.message || "Unable to start the re-dispatch payment.", "error");
      setRtoLoading("");
    }
  };

  if (loading) return <OrderConfirmationSkeleton />;

  if (error || !order) {
    return (
      <main className="order-confirmation-page">
        <div className="order-confirmation-state">
          <Icon icon="lucide:alert-circle" />
          <h1>Order details unavailable</h1>
          <p>{error || "Please check My Orders for the latest details."}</p>
          <button type="button" onClick={() => navigate("/my-orders")}>Go to My Orders</button>
        </div>
      </main>
    );
  }

  return (
    <main className="order-confirmation-page">
      <section className="oc-thanks">
        <h1 className="oc-thanks-script">Thank you</h1>
        {customerFullName && <p className="oc-thanks-name">{customerFullName}</p>}
        <p className="oc-thanks-sub">for your purchase!</p>
        <p className="oc-thanks-note">
          We&rsquo;re getting your order ready to be shipped.
          <br />
          We will notify you once it has been dispatched.
        </p>

        <div className="oc-thanks-divider" aria-hidden="true">
          <i /><span>◆</span><i />
        </div>

        <div className="oc-thanks-actions">
          <button type="button" className="oc-thanks-btn oc-thanks-btn-primary" onClick={() => setOrderDetailsModalOpen(true)}>
            Track your order <Icon icon="lucide:arrow-right" />
          </button>
          <Link className="oc-thanks-btn oc-thanks-btn-ghost" to="/collection">
            View our collection <Icon icon="lucide:arrow-right" />
          </Link>
        </div>
      </section>

      <div className="oc-thanks-meta">
        <div className="oc-thanks-meta-cell">
          <span className="oc-thanks-meta-icon"><Icon icon="lucide:clipboard-check" /></span>
          <span>
            <small>Order Number</small>
            <strong>#{orderNumber}</strong>
          </span>
        </div>
        <div className="oc-thanks-meta-cell">
          <span className="oc-thanks-meta-icon"><Icon icon="lucide:calendar-days" /></span>
          <span>
            <small>Order Date</small>
            <strong>{formatDate(order.createdAt)}</strong>
          </span>
        </div>
      </div>

      <section className="order-confirmation-grid">
        <div className="order-confirmation-main">
          {rtoAwaiting && (
            <section className="order-panel rto-panel">
              <div className="rto-panel-head">
                <span className="rto-panel-icon"><Icon icon="lucide:package-x" /></span>
                <div>
                  <h2>Your order came back to us</h2>
                  <p>
                    {rtoRedispatchAllowed
                      ? "The courier couldn’t deliver this parcel and it has returned to our warehouse. Choose what you’d like to do next."
                      : rtoRedispatchBlockedReason === "window_expired"
                        ? "The window to re-dispatch this order has closed, so it can now only be refunded."
                        : "This order was re-dispatched once and came back again, so it can now only be refunded."}
                  </p>
                </div>
              </div>

              <div className="rto-options">
                {rtoRedispatchAllowed && (
                  <div className="rto-option">
                    <div className="rto-option-head">
                      <Icon icon="lucide:truck" />
                      <strong>Re-dispatch my order</strong>
                    </div>
                    <p>We&rsquo;ll send the same order out again to your delivery address.</p>
                    <ul className="rto-fee-lines">
                      <li><span>Forward shipping</span><strong>{formatPrice(rtoAction.forward_charge)}</strong></li>
                      <li><span>Return (RTO) charge</span><strong>{formatPrice(rtoAction.rto_charge)}</strong></li>
                      <li className="rto-fee-total"><span>Payable now</span><strong>{formatPrice(rtoAction.redispatch_fee)}</strong></li>
                    </ul>
                    {rtoAction.redispatch_window_ends_at && (
                      <p className="rto-window-info">
                        <Icon icon="lucide:clock" /> Available to re-dispatch until {formatDate(rtoAction.redispatch_window_ends_at)}
                      </p>
                    )}
                    <button
                      type="button"
                      className="rto-btn rto-btn-primary"
                      onClick={handleRtoRedispatch}
                      disabled={Boolean(rtoLoading)}
                    >
                      {rtoLoading === "redispatch" ? "Opening payment…" : `Pay ${formatPrice(rtoAction.redispatch_fee)} & re-dispatch`}
                    </button>
                  </div>
                )}

                <div className="rto-option">
                  <div className="rto-option-head">
                    <Icon icon="lucide:rotate-ccw" />
                    <strong>Refund me instead</strong>
                  </div>
                  <p>We&rsquo;ll refund what you paid for the order, after deducting the platform fee{rtoGiftCharge > 0 ? ", the gift charge" : ""} and the forward &amp; return shipping already spent on this parcel.</p>
                  <ul className="rto-fee-lines">
                    <li><span>Amount paid</span><strong>{formatPrice(rtoRefundableBase)}</strong></li>
                    {rtoPlatformFee > 0 && (
                      <li><span>Less platform fee</span><strong>-{formatPrice(rtoPlatformFee)}</strong></li>
                    )}
                    {rtoGiftCharge > 0 && (
                      <li><span>Less gift charge</span><strong>-{formatPrice(rtoGiftCharge)}</strong></li>
                    )}
                    <li><span>Less forward + RTO charges</span><strong>-{formatPrice(rtoForwardRtoCharges)}</strong></li>
                    <li className="rto-fee-total"><span>Estimated refund</span><strong>{formatPrice(rtoGatewayRefund)}</strong></li>
                  </ul>
                  {redispatchChargesPaid > 0 && (
                    <p className="rto-wallet-hint">
                      <Icon icon="lucide:info" /> The {formatPrice(redispatchChargesPaid)} you paid to re-dispatch was spent on shipping and isn&rsquo;t refundable, so it&rsquo;s not counted above.
                    </p>
                  )}
                  {rtoWalletPaid > 0 && (
                    <p className="rto-wallet-hint">
                      <Icon icon="lucide:wallet" /> Plus {formatPrice(rtoWalletPaid)} returned to your wallet; the amount above goes to your original payment method.
                    </p>
                  )}
                  <button
                    type="button"
                    className="rto-btn rto-btn-ghost"
                    onClick={() => setRtoConfirmOpen(true)}
                    disabled={Boolean(rtoLoading)}
                  >
                    {rtoLoading === "refund" ? "Processing…" : "Request refund"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {rtoCodBlocked && (
            <section className="order-panel rto-panel rto-panel-cod">
              <div className="rto-panel-head">
                <span className="rto-panel-icon"><Icon icon="lucide:package-x" /></span>
                <div>
                  <h2>This order was returned to us</h2>
                  <p>
                    The courier couldn&rsquo;t deliver your Cash on Delivery parcel, so it has come back to our
                    warehouse and this order is now closed.{" "}
                    {rtoWalletPaid > 0
                      ? `The ${formatPrice(rtoWalletPaid)} you paid from your wallet has been returned to your wallet.`
                      : "As nothing was paid, there’s no refund due."}
                  </p>
                  <p className="rto-cod-note">
                    <Icon icon="lucide:info" /> Cash on Delivery is no longer available on your account. You can still
                    order any time by paying online.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rto-btn rto-btn-primary rto-btn-inline"
                onClick={handleReorderPrepaid}
                disabled={Boolean(rtoLoading)}
              >
                {rtoLoading === "reorder" ? "Adding to bag…" : "Shop again with prepaid"}
              </button>
            </section>
          )}

          <section className="order-panel oc-summary-card">
            <div className="order-panel-head oc-summary-head">
              <h2 className="oc-summary-title oc-summary-title--divider">Order Summary</h2>
              <div className="oc-thanks-divider" aria-hidden="true">
                <i /><span>◆</span><i />
              </div>
            </div>
            <div className="confirmation-items">
              {(order.OrderItems || []).map((item, index) => {
                const productUrl = item.product_slug ? `/product/${item.product_slug}` : null;
                const itemRating = Number(item.feedback?.rating || 0);
                const returnWindow = getItemReturnWindowInfo(order, item);
                const itemStatusMeta = getItemStatusMeta(order, item);
                return (
                <article className="confirmation-item" key={`${item.product_id}-${item.colorId || index}`}>
                  <div className="confirmation-item-top">
                    {productUrl ? (
                      <Link to={productUrl} className="confirmation-item-media" aria-label={`Open ${item.product_name}`}>
                        {getItemImage(item) ? <img src={imgUrl(getItemImage(item), 200)} alt={item.product_name} /> : <Icon icon="lucide:image-off" />}
                      </Link>
                    ) : (
                      <div className="confirmation-item-media">
                        {getItemImage(item) ? <img src={imgUrl(getItemImage(item), 200)} alt={item.product_name} /> : <Icon icon="lucide:image-off" />}
                      </div>
                    )}
                    <div className="confirmation-item-copy">
                      <div className="oc-item-headline">
                        {productUrl ? <Link to={productUrl} className="confirmation-product-link"><h3>{item.product_name}</h3></Link> : <h3>{item.product_name}</h3>}
                        <strong className="oc-item-price">
                          {(() => {
                            const billedQty = Math.max(0, toNumber(item.quantity) - toNumber(item.cancelled_quantity));
                            const mrpEach = toNumber(item.mrp_price);
                            const sellEach = toNumber(item.price);
                            const showMrp = mrpEach > sellEach;
                            return showMrp ? (
                              <>
                                <span className="oc-item-mrp-label">MRP: <s>{formatPrice(mrpEach * billedQty)}</s></span>{" "}
                                {formatPrice(sellEach * billedQty)}
                              </>
                            ) : formatPrice(sellEach * billedQty);
                          })()}
                        </strong>
                        <span
                          className="oc-item-status-pill"
                          style={{ backgroundColor: itemStatusMeta.bg, color: itemStatusMeta.color }}
                        >
                          <Icon icon={itemStatusMeta.icon} />
                          {itemStatusMeta.label}
                        </span>
                      </div>

                      {itemStatusMeta.label === "Delivered" && order.delivered_at && (
                        <span className="oc-item-delivered-at">{formatDateTime(order.delivered_at)}</span>
                      )}

                      <div className="oc-item-attr">
                        <span className="oc-item-attr-label">Color:</span>
                        {item.color_hex && <span className="oc-item-color-dot" style={{ backgroundColor: item.color_hex }} />}
                        <span className="oc-item-attr-value">{getItemColor(item)}</span>
                      </div>
                      {(() => {
                        const cancelledQty = toNumber(item.cancelled_quantity);
                        const activeQty = Math.max(0, toNumber(item.quantity) - cancelledQty);
                        return (
                          <div className="oc-item-attr">
                            <span className="oc-item-attr-label">Total Qty:</span>
                            <span className="oc-item-attr-value">
                              {activeQty}
                              {cancelledQty > 0 ? ` · ${cancelledQty} cancelled` : ""}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  {canReviewOrderItem(order, item) && (
                    <div className="confirmation-feedback-area">
                      <RatingStars rating={itemRating} />
                      <button className="confirmation-feedback-btn" type="button" onClick={() => openFeedbackModal(item)}>
                        {item.feedback ? "Edit Feedback" : "Add Feedback"}
                      </button>
                    </div>
                  )}
                  {(item.actions || []).some((action) => String(action.action_type || "").toLowerCase() !== "cancel") && (
                    <div className="confirmation-item-actions">
                      {(item.actions || [])
                        .filter((action) => String(action.action_type || "").toLowerCase() !== "cancel")
                        .map((action) => (
                        <div key={action.id || `${action.action_type}-${action.created_at}`}>
                          <span>{getActionLabel(action)}</span>
                          <strong>{getActionStatusLabel(action, item)}</strong>
                          <small>
                            Qty {action.quantity || 1}
                            {/* The saree(s) swapped in are shown properly below (exchange_swap),
                                with images and links — not squeezed into this status line. */}
                            {action.completed_at
                              ? ` · ${getActionStatusLabel(action, item) === "Item received" ? "Received" : "Completed"} ${formatDate(action.completed_at)}`
                              : action.created_at ? ` · ${formatDate(action.created_at)}` : ""}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* What this line is being exchanged FOR. The line above still names the saree
                      that went back — it is the purchase record and is never rewritten — so
                      without this the customer would see no sign of what is actually coming. */}
                  {item.exchange_swap?.to?.length > 0 && (
                    <div className="exchange-swap-card">
                      <span className="exchange-swap-title">
                        <Icon icon="lucide:repeat" />
                        {/* Keyed off the ITEM, not the action: the action is "Completed" as soon
                            as the old saree is back with the seller, which is well before the
                            replacement reaches the customer. Only the item reaching
                            "Exchange Completed" (replacement delivered) is past tense. */}
                        {normalizeStatus(item.status) === "exchange completed"
                          ? "Exchanged for"
                          : "Being exchanged for"}
                      </span>
                      <ul className="exchange-swap-list">
                        {item.exchange_swap.to.map((target, i) => {
                          const targetUrl = target.product_slug ? `/product/${target.product_slug}` : null;
                          const media = target.image_url ? (
                            <img src={imgUrl(target.image_url, 120)} alt={target.product_name} />
                          ) : (
                            <Icon icon="lucide:image-off" />
                          );
                          return (
                            <li key={`${target.product_id}-${target.color_name || i}`}>
                              {targetUrl ? (
                                <Link to={targetUrl} className="exchange-swap-media" aria-label={`Open ${target.product_name}`}>
                                  {media}
                                </Link>
                              ) : (
                                <span className="exchange-swap-media">{media}</span>
                              )}
                              <span className="exchange-swap-copy">
                                {targetUrl ? (
                                  <Link to={targetUrl} className="confirmation-product-link">
                                    <strong>{target.product_name}</strong>
                                  </Link>
                                ) : (
                                  <strong>{target.product_name}</strong>
                                )}
                                <small>
                                  {target.color_name || "—"} · Qty {target.quantity}
                                </small>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <small className="exchange-swap-foot">
                        Same price — nothing extra to pay, nothing to refund.
                      </small>
                    </div>
                  )}

                  {returnWindow && (
                    <p className={`oc-item-return-window ${returnWindow.closed ? "is-closed" : ""}`}>
                      <Icon icon={returnWindow.closed ? "lucide:calendar-x" : "lucide:calendar-clock"} />
                      {returnWindow.closed
                        ? "Return / Exchange closed"
                        : `Return / Exchange closes on ${formatDate(returnWindow.deadline)}`}
                    </p>
                  )}
                </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="order-confirmation-side">
          <section className="order-panel oc-summary-card">
            <div className="order-panel-head oc-summary-head">
              <h2 className="oc-summary-title oc-summary-title--divider">Payment Summary</h2>
              <div className="oc-thanks-divider" aria-hidden="true">
                <i /><span>◆</span><i />
              </div>
            </div>
            <div className="summary-row">
              <span>Product total</span>
              <strong>
                {breakdown.mrpSavings > 0 && <span className="oc-item-mrp-label">MRP: <s>{formatPrice(breakdown.mrpTotal)}</s></span>} {formatPrice(breakdown.subtotal)}
              </strong>
            </div>
            {breakdown.platformFee > 0 && <div className="summary-row"><span>Platform fee</span><strong>{formatPrice(breakdown.platformFee)}</strong></div>}
            <div className="summary-row">
              <span>Delivery charge</span>
              <strong>
                {breakdown.deliveryChargeShown > 0 ? (
                  <><span className="summary-strike">{formatPrice(breakdown.deliveryChargeShown)}</span> Free</>
                ) : formatPrice(0)}
              </strong>
            </div>
            {breakdown.giftCharge > 0 && <div className="summary-row"><span>Gift wrap &amp; message</span><strong>{formatPrice(breakdown.giftCharge)}</strong></div>}
            {breakdown.paymentDiscount > 0 && <div className="summary-row is-saving"><span>Payment discount</span><strong>-{formatPrice(breakdown.paymentDiscount)}</strong></div>}
            {breakdown.codFee > 0 && <div className="summary-row"><span>COD charge</span><strong>{formatPrice(breakdown.codFee)}</strong></div>}
            {breakdown.couponDiscount > 0 && <div className="summary-row is-saving"><span>Coupon{order.coupon_code ? ` (${order.coupon_code})` : ""}</span><strong>-{formatPrice(breakdown.couponDiscount)}</strong></div>}
            {breakdown.walletAmount > 0 && <div className="summary-row is-saving"><span>Wallet used</span><strong>-{formatPrice(breakdown.walletAmount)}</strong></div>}
            {redispatchChargesPaid > 0 ? (
              // Resolving a re-dispatch posts the forward + RTO charge to the ledger, so
              // payable_amount carries it. Split it back out: the goods total, the extra
              // re-dispatch charge paid, and the combined total paid. Keyed on
              // order.redispatch_charges_paid (the sum actually paid across every
              // re-dispatch) — NOT on rto_action.resolution, which flips back to
              // AWAITING_PAYMENT on a later RTO and would drop the split, leaving the old
              // re-dispatch charge silently baked into "Final amount".
              <>
                <div className="summary-row is-final"><span>Order total</span><strong>{formatPrice(Math.max(0, breakdown.payable - redispatchChargesPaid))}</strong></div>
                <div className="summary-row summary-row-redispatch"><span>Re-dispatch charges paid</span><strong>+{formatPrice(redispatchChargesPaid)}</strong></div>
                <div className="summary-row is-final">
                  <span>Total paid</span>
                  <span className="oc-final-amount-col">
                    <strong>{formatPrice(breakdown.payable)}</strong>
                    {totalSaved > 0 && <small>You saved {formatPrice(totalSaved)}</small>}
                  </span>
                </div>
              </>
            ) : (
              <div className="summary-row is-final">
                <span>Final amount</span>
                <span className="oc-final-amount-col">
                  <strong>{formatPrice(breakdown.payable)}</strong>
                  {totalSaved > 0 && <small>You saved {formatPrice(totalSaved)}</small>}
                </span>
              </div>
            )}
            <div className="payment-tags">
              <span>{order.payment_method || "Prepaid"}</span>
              <span>{order.payment_status || "Paid"}</span>
            </div>
            {(() => {
              const refundStatus = String(order.refund_status || "").toLowerCase();
              const refundAmt = toNumber(order.refund_amount);
              const isPartial = String(order.status || "").toLowerCase().includes("partial");
              if (!refundStatus.includes("pending") && !refundStatus.includes("refund")) return null;
              return (
                <div className="refund-notice">
                  <Icon icon="lucide:refresh-ccw" />
                  <div>
                    <strong>{isPartial ? "Partial refund pending" : "Refund pending"}</strong>
                    <p>
                      {order.refund_note || (
                        refundAmt > 0
                          ? `${formatPrice(refundAmt)} will be refunded to your original payment method.`
                          : "Refund will be processed shortly."
                      )}
                    </p>
                  </div>
                </div>
              );
            })()}

            {refunds.length > 0 && (
              <div className="refund-ledger">
                <div className="refund-ledger-head">
                  <Icon icon="lucide:receipt-text" />
                  <strong>Refunds</strong>
                </div>
                {refunds.map((r, i) => {
                  const bd = r.breakdown || null;
                  return (
                    <div key={r.id || `${r.refund_type}-${i}`} className="refund-ledger-entry">
                      <div className="refund-ledger-row">
                        <span className="refund-ledger-label">
                          {formatRefundType(r.refund_type)}
                          <small className={`refund-ledger-status is-${formatRefundStatus(r.status).toLowerCase().replace(/\s+/g, "-")}`}>
                            {formatRefundStatus(r.status)}{r.createdAt || r.created_at ? ` · ${formatDate(r.createdAt || r.created_at)}` : ""}
                          </small>
                        </span>
                        {/* Headline = money going back to the PAYMENT METHOD. r.amount is the
                            ledger total (gateway + wallet), but the wallet credit goes to the
                            wallet, not the card — adding it here made the figure disagree with
                            the deduction lines below and read as if the card were refunded more
                            than it was. Wallet is called out separately underneath. */}
                        <strong>{formatPrice(refundToPaymentMethod(r))}</strong>
                      </div>
                      {bd && (
                        <div className="refund-ledger-breakdown">
                          {bd.is_full_return ? (
                            <>
                              {/* Full return: what you paid (amount_paid) is refunded
                                  to the gateway minus the non-refundable fees +
                                  pickup charge; the wallet credit is returned to the
                                  wallet in full (called out below, NOT added into the
                                  refund figure — it goes to a different destination). */}
                              <div>
                                <span>Amount paid</span>
                                <strong>{formatPrice(bd.amount_paid)}</strong>
                              </div>
                              {toNumber(bd.platform_fee) > 0 && (
                                <div><span>Platform fee (not refunded)</span><strong>-{formatPrice(bd.platform_fee)}</strong></div>
                              )}
                              {toNumber(bd.cod_fee) > 0 && (
                                <div><span>COD charge (not refunded)</span><strong>-{formatPrice(bd.cod_fee)}</strong></div>
                              )}
                              {toNumber(bd.gift_charge) > 0 && (
                                <div><span>Gift charge (not refunded)</span><strong>-{formatPrice(bd.gift_charge)}</strong></div>
                              )}
                              {toNumber(bd.return_shipping_charge) > 0 && (
                                <div>
                                  <span>
                                    Return pickup charge
                                    {toNumber(bd.return_shipping_weight_kg) > 0 ? ` (${bd.return_shipping_weight_kg} kg)` : ""}
                                  </span>
                                  <strong>-{formatPrice(bd.return_shipping_charge)}</strong>
                                </div>
                              )}
                              {/* LEGACY ONLY. The gateway charge is no longer deducted, so this is
                                  absent from every new refund. It stays for refunds settled while
                                  that policy was live — without the line, the money they were
                                  actually charged would just be missing from the breakdown. */}
                              {toNumber(bd.payment_gateway_charge) > 0 && (
                                <div>
                                  <span>
                                    Payment gateway charge
                                    {toNumber(bd.payment_gateway_fee_percent) > 0
                                      ? ` (${bd.payment_gateway_fee_percent}% + ${bd.payment_gateway_gst_percent}% GST)`
                                      : ""}
                                  </span>
                                  <strong>-{formatPrice(bd.payment_gateway_charge)}</strong>
                                </div>
                              )}
                              {toNumber(bd.wallet_return) > 0 && (
                                <div className="refund-ledger-wallet">
                                  <span>Plus returned to your wallet (in full)</span>
                                  <strong>+{formatPrice(bd.wallet_return)}</strong>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div>
                                <span>Returned product value</span>
                                <strong>{formatPrice(bd.returned_value)}</strong>
                              </div>
                              {bd.coupon && toNumber(bd.coupon.adjustment) > 0 && (
                                <div>
                                  <span>
                                    Coupon difference ({bd.coupon.original_code}
                                    {bd.coupon.applied_code && bd.coupon.applied_code !== bd.coupon.original_code ? ` → ${bd.coupon.applied_code}` : ""})
                                  </span>
                                  <strong>-{formatPrice(bd.coupon.adjustment)}</strong>
                                </div>
                              )}
                              {toNumber(bd.return_shipping_charge) > 0 && (
                                <div>
                                  <span>
                                    Return pickup charge
                                    {toNumber(bd.return_shipping_weight_kg) > 0 ? ` (${bd.return_shipping_weight_kg} kg)` : ""}
                                  </span>
                                  <strong>-{formatPrice(bd.return_shipping_charge)}</strong>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {totalRefunded > 0 && (
                  <div className="refund-ledger-row refund-ledger-total">
                    <span>Total refunded to payment method</span>
                    <strong>{formatPrice(totalRefunded)}</strong>
                  </div>
                )}
                {totalWalletReturned > 0 && (
                  <div className="refund-ledger-row refund-ledger-wallet">
                    <span>Total returned to wallet</span>
                    <strong>{formatPrice(totalWalletReturned)}</strong>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="order-panel oc-summary-card oc-address-card">
            <div className="order-panel-head oc-summary-head">
              <h2 className="oc-summary-title oc-summary-title--divider">Customer Information</h2>
              <div className="oc-thanks-divider" aria-hidden="true">
                <i /><span>◆</span><i />
              </div>
            </div>
            <div className="order-panel-head-row">
              <h2><Icon icon="lucide:map-pin" /> Delivery Address</h2>
            </div>
            <p className="address-copy"><strong>{order.customer_name}</strong><br />{order.address}<br />{order.city}, {order.state} - {order.pincode}<br />Phone: {order.phone}</p>
          </section>

          {needsCodBankDetails && (
            <section className="order-panel">
              <h2>Refund bank details</h2>
              {order.refund_bank_details ? (
                <div className="refund-bank-saved">
                  <strong>{order.refund_bank_details.account_holder_name}</strong>
                  <span>{order.refund_bank_details.bank_name} - {order.refund_bank_details.ifsc_code}</span>
                  <span>Account ending {order.refund_bank_details.account_number_last4}</span>
                </div>
              ) : (
                <form className="refund-bank-form" onSubmit={submitBankDetails}>
                  <input
                    required
                    value={bankForm.account_holder_name}
                    onChange={(event) => setBankForm((current) => ({ ...current, account_holder_name: event.target.value }))}
                    placeholder="Account holder name"
                  />
                  <input
                    required
                    inputMode="numeric"
                    value={bankForm.account_number}
                    onChange={(event) => setBankForm((current) => ({ ...current, account_number: event.target.value }))}
                    placeholder="Account number"
                  />
                  <input
                    required
                    value={bankForm.ifsc_code}
                    onChange={(event) => setBankForm((current) => ({ ...current, ifsc_code: event.target.value.toUpperCase() }))}
                    placeholder="IFSC code"
                  />
                  <input
                    required
                    value={bankForm.bank_name}
                    onChange={(event) => setBankForm((current) => ({ ...current, bank_name: event.target.value }))}
                    placeholder="Bank name"
                  />
                  <input
                    value={bankForm.branch_name}
                    onChange={(event) => setBankForm((current) => ({ ...current, branch_name: event.target.value }))}
                    placeholder="Branch name (optional)"
                  />
                  <button type="submit" disabled={bankSaving}>{bankSaving ? "Saving..." : "Save bank details"}</button>
                </form>
              )}
            </section>
          )}

          {orderActions.canReturnExchange && (
            <button
              type="button"
              className="oc-return-row"
              onClick={() => openActionModal(canSelectReturnItems ? "return" : "exchange")}
            >
              <span className="oc-return-icon"><Icon icon="lucide:package-open" /></span>
              <span className="oc-return-copy">
                <strong>
                  {canSelectReturnItems && canSelectExchangeItems
                    ? "Return / Exchange Products"
                    : canSelectReturnItems ? "Return Products" : "Exchange Products"}
                </strong>
                <span>Hassle-free returns within 7 days</span>
              </span>
              <Icon icon="lucide:chevron-right" className="oc-return-chevron" />
            </button>
          )}

          {orderActions.canCancel ? (
            <div className="oc-cancel-block">
              <div className="oc-cancel-info-card">
                <span className="oc-cancel-info-icon"><Icon icon="lucide:package" /></span>
                <p>You can cancel your order within 24 hours of placing the order.</p>
                {(() => {
                  const rawDate = order.cancel_window_started_at || order.createdAt || order.created_at;
                  if (!rawDate) return null;
                  const remaining = 24 * 60 * 60 * 1000 - (Date.now() - new Date(rawDate).getTime());
                  if (remaining <= 0) return null;
                  const hrs = Math.floor(remaining / (1000 * 60 * 60));
                  const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                  const label = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                  return (
                    <span className="oc-cancel-timer">
                      <Icon icon="lucide:clock" /> {label} left to cancel
                    </span>
                  );
                })()}
              </div>
              <button className="oc-cancel-btn" type="button" onClick={() => openActionModal("cancel")}>
                <Icon icon="lucide:x" /> Cancel Order
              </button>
            </div>
          ) : cancelWindowClosed(order) ? (
            <div className="oc-cancel-closed">
              <strong>Cancellation window is closed.</strong>
              <span>You can&rsquo;t cancel this order now.</span>
            </div>
          ) : null}

          <div className="order-help-box">
            <span className="order-help-icon"><Icon icon="lucide:message-circle-question" /></span>
            <div className="order-help-copy">
              <strong>Need Help with this order?</strong>
              {ticket ? (
                <span className={`order-help-ticket ${TICKET_STATUS_TONE[ticket.status] || "is-open"}`}>
                  {ticket.ticket_number} · {ticket.status}
                </span>
              ) : (
                <span>Contact our support team</span>
              )}
            </div>
            <button type="button" className="order-help-btn" onClick={openSupportModal}>
              Contact Us
            </button>
          </div>

          {wasDelivered(order) && (
            <div className="order-card-actions">
              <button type="button" className="order-action-btn" onClick={downloadInvoice} disabled={invoiceLoading}>
                <Icon icon={invoiceLoading ? "lucide:loader" : "lucide:download"} className={invoiceLoading ? "is-spinning" : ""} />
                {invoiceLoading ? "Preparing…" : "Download Invoice"}
              </button>
            </div>
          )}

          <div className="oc-trust-badges">
            <div>
              <Icon icon="lucide:shopping-bag" />
              <span>100% Authentic<br />Banarasi Sarees</span>
            </div>
            <div>
              <Icon icon="lucide:heart-handshake" />
              <span>Handpicked<br />Premium Quality</span>
            </div>
            <div>
              <Icon icon="lucide:lock" />
              <span>Secure<br />Payments</span>
            </div>
          </div>
        </aside>
      </section>

      {orderDetailsModalOpen && (
        <div className="oc-details-overlay" onClick={() => setOrderDetailsModalOpen(false)}>
          <div className="oc-details-sheet" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="oc-details-close"
              onClick={() => setOrderDetailsModalOpen(false)}
              aria-label="Close tracking"
            >
              <Icon icon="lucide:x" />
            </button>

            <section className="order-panel">
              <div className="order-panel-head">
                <h2>{hasLiveTracking ? "Live Tracking" : "Shipment Timeline"}</h2>
                <div className="order-track-head-right">
                  <span className={`oc-status-pill is-${statusTone}`}>
                    {statusLabel}
                    <Icon icon={statusTone === "success" ? "lucide:check-circle-2" : statusTone === "alert" ? "lucide:alert-circle" : "lucide:loader"} />
                  </span>
                  {hasCurrentAwb(order) && (
                    <button
                      type="button"
                      className="order-track-refresh"
                      onClick={fetchTracking}
                      disabled={trackingLoading}
                      aria-label="Refresh tracking"
                    >
                      <Icon icon="lucide:refresh-cw" className={trackingLoading ? "is-spinning" : ""} />
                      {trackingLoading ? "Refreshing…" : "Refresh"}
                    </button>
                  )}
                </div>
              </div>

              {!hasCurrentAwb(order) && (
                <div className="order-track-pending">
                  <Icon icon="lucide:package-search" />
                  <span>
                    {hasLiveTracking
                      ? "Live tracking is now available."
                      : "Your order is being prepared. Live tracking will appear here once the courier picks it up and an AWB is generated."}
                  </span>
                </div>
              )}

              <CollapsibleTimeline steps={timeline} currentLabel={statusLabel} />

              {hasCurrentAwb(order) && (
                <>
                  {isTrackable(order) && (
                    <button type="button" className="oc-track-btn" onClick={() => setTrackModalOpen(true)}>
                      Track on Courier <Icon icon="lucide:chevron-right" />
                    </button>
                  )}
                  <div className="oc-awb-line">
                    <span>AWB{courierName ? ` · ${courierName}` : ""}</span>
                    <strong>{order.shiprocket_awb}</strong>
                  </div>
                </>
              )}
            </section>

            {(reverseShipments.length > 0 || hasPendingReverseRequest) && (
              <section className="order-panel">
                <div className="order-panel-head">
                  <h2>Return / Exchange tracking</h2>
                  <span>
                    {reverseShipments.length > 0
                      ? `${reverseShipments.length} pickup${reverseShipments.length > 1 ? "s" : ""}`
                      : getCustomerOrderStatusLabel(order.status)}
                  </span>
                </div>
                {reverseShipments.length > 0 ? (
                  reverseShipments.map((shipment, shipmentIndex) => {
                    // Prefer live courier scans; fall back to the shipment's own lifecycle
                    // (which survives order.status moving on after a replacement ships).
                    const liveSteps = buildReverseActivities(shipment);
                    const steps = liveSteps.length > 0 ? liveSteps : buildReverseStatusTimeline(shipment);
                    const label = shipment.type === "exchange" ? "Exchange pickup" : "Return pickup";
                    return (
                      <div key={`${shipment.awb || shipment.type}-${shipmentIndex}`} className="reverse-shipment">
                        <div className="reverse-shipment-head">
                          <strong>{label}</strong>
                          {shipment.awb && <small>AWB · {shipment.awb}</small>}
                        </div>
                        {steps.length > 0 ? (
                          <ReverseStepsTimeline steps={steps} />
                        ) : (
                          <div className="order-track-pending">
                            <Icon icon="lucide:package-search" />
                            <span>
                              {shipment.source === "unavailable"
                                ? "Pickup tracking is temporarily unavailable. Please check back shortly."
                                : "Your pickup is being arranged. Scan updates will appear here once the courier collects the parcel."}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // A request exists but no reverse shipment has been booked with the courier
                  // yet, so there is nothing to track — say so rather than showing a timeline.
                  <div className="reverse-shipment">
                    <div className="order-track-pending">
                      <Icon icon="lucide:package-search" />
                      <span>Your pickup is being arranged. Scan updates will appear here once the courier collects the parcel.</span>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      {rtoConfirmOpen && (
        <div className="cancel-modal-overlay" onClick={() => !rtoLoading && setRtoConfirmOpen(false)}>
          <div className="cancel-modal-container rto-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="cancel-modal-close"
              onClick={() => setRtoConfirmOpen(false)}
              disabled={Boolean(rtoLoading)}
            >
              <Icon icon="lucide:x" />
            </button>
            <div className="cancel-modal-header">
              <h3>Request a refund?</h3>
              <p>
                This closes your order. We&rsquo;ll refund the amount below to your original payment method
                {rtoWalletPaid > 0
                  ? `, plus ${formatPrice(rtoWalletPaid)} back to your wallet.`
                  : "."}
              </p>
            </div>
            <ul className="rto-fee-lines rto-confirm-lines">
              <li><span>Amount paid</span><strong>{formatPrice(rtoRefundableBase)}</strong></li>
              {rtoPlatformFee > 0 && (
                <li><span>Less platform fee</span><strong>-{formatPrice(rtoPlatformFee)}</strong></li>
              )}
              {rtoGiftCharge > 0 && (
                <li><span>Less gift charge</span><strong>-{formatPrice(rtoGiftCharge)}</strong></li>
              )}
              <li><span>Forward + RTO charges</span><strong>-{formatPrice(rtoForwardRtoCharges)}</strong></li>
              <li className="rto-fee-total"><span>You&rsquo;ll receive</span><strong>{formatPrice(rtoGatewayRefund)}</strong></li>
            </ul>
            {redispatchChargesPaid > 0 && (
              <p className="rto-wallet-hint rto-confirm-lines">
                <Icon icon="lucide:info" /> The {formatPrice(redispatchChargesPaid)} re-dispatch charge was spent on shipping and isn&rsquo;t refundable.
              </p>
            )}
            <div className="rto-confirm-actions">
              <button
                type="button"
                className="rto-btn rto-btn-ghost"
                onClick={() => setRtoConfirmOpen(false)}
                disabled={Boolean(rtoLoading)}
              >
                Go back
              </button>
              <button
                type="button"
                className="rto-btn rto-btn-primary"
                onClick={handleRtoRefund}
                disabled={Boolean(rtoLoading)}
              >
                {rtoLoading === "refund" ? "Processing…" : "Confirm refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {feedbackModal.isOpen && (
        <div className="cancel-modal-overlay">
          <div className="cancel-modal-container feedback-detail-modal">
            <button type="button" className="cancel-modal-close" onClick={closeFeedbackModal} disabled={feedbackSubmitting}>
              <Icon icon="lucide:x" />
            </button>
            <div className="cancel-modal-header">
              <h3>Complete your Feedback</h3>
              <p>Share your experience for <strong>{feedbackModal.item?.product_name}</strong>.</p>
            </div>

            <form onSubmit={submitFeedback} className="cancel-modal-form">
              <div className="form-group">
                <label>Rating</label>
                <div className="confirmation-rating-picker">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={feedbackForm.rating >= star ? "active" : ""}
                      onClick={() => setFeedbackForm((current) => ({ ...current, rating: star }))}
                    >
                      <Icon icon="mdi:star" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="feedback-title">Short title (optional)</label>
                <input
                  id="feedback-title"
                  type="text"
                  maxLength={120}
                  value={feedbackForm.title}
                  onChange={(event) => setFeedbackForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Loved the fabric"
                />
              </div>

              <div className="form-group">
                <label htmlFor="feedback-comment">Product review</label>
                <textarea
                  id="feedback-comment"
                  rows={5}
                  required
                  value={feedbackForm.comment}
                  onChange={(event) => setFeedbackForm((current) => ({ ...current, comment: event.target.value }))}
                  placeholder="Write what you liked about this product..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="feedback-images">Upload photos (optional)</label>
                <input
                  id="feedback-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []).slice(0, MAX_REVIEW_IMAGES);
                    setFeedbackForm((current) => ({ ...current, images: files }));
                  }}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="modal-action-btn secondary" onClick={closeFeedbackModal} disabled={feedbackSubmitting}>
                  Go Back
                </button>
                <button type="submit" className="modal-action-btn primary" disabled={feedbackSubmitting}>
                  {feedbackSubmitting ? feedbackSubmitLabel || "Submitting..." : "Submit Feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {supportModal && (
        <div className="cancel-modal-overlay">
          <div className="cancel-modal-container">
            <button type="button" className="cancel-modal-close" onClick={closeSupportModal} disabled={supportSubmitting}>
              <Icon icon="lucide:x" />
            </button>
            <div className="cancel-modal-header">
              <h3>Need help with this order?</h3>
              <p>
                Tell us what went wrong with order <strong>#{orderNumber}</strong> and our support team will get back to you.
              </p>
            </div>

            <form className="cancel-modal-form" onSubmit={submitSupportTicket}>
              <div className="form-group">
                <label htmlFor="oc-support-category">What is your query about?</label>
                <select
                  id="oc-support-category"
                  value={supportForm.category}
                  onChange={(event) => setSupportForm((current) => ({ ...current, category: event.target.value }))}
                  required
                >
                  {TICKET_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="oc-support-message">Describe your issue</label>
                <textarea
                  id="oc-support-message"
                  required
                  rows={4}
                  maxLength={2000}
                  value={supportForm.message}
                  onChange={(event) => setSupportForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder="Share the details so we can resolve this faster."
                />
              </div>

              <div className="form-group">
                <label htmlFor="oc-support-phone">Phone number (optional)</label>
                <input
                  id="oc-support-phone"
                  type="tel"
                  value={supportForm.phone}
                  onChange={(event) => setSupportForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="10-digit mobile number we can call you on"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="modal-action-btn secondary" onClick={closeSupportModal} disabled={supportSubmitting}>
                  Go Back
                </button>
                <button type="submit" className="modal-action-btn primary" disabled={supportSubmitting}>
                  {supportSubmitting ? "Raising ticket..." : "Raise Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cancelModal.isOpen && (
        <div className="cancel-modal-overlay">
          <div className="cancel-modal-container">
            <button 
              type="button"
              className="cancel-modal-close" 
              onClick={closeActionModal}
            >
              <Icon icon="lucide:x" />
            </button>
            <div className="cancel-modal-header">
              <h3>{getActionConfig(cancelModal.type).title}</h3>
              <p>{cancelModal.type === "cancel" ? <>This will cancel <strong>{cancelModal.itemName}</strong> completely — all items below will be cancelled. Individual items cannot be cancelled or changed.</> : <>Select product for <strong>{cancelModal.itemName}</strong>.</>}</p>
            </div>
            
            <form onSubmit={handleModalSubmit} className="cancel-modal-form">
              {cancelModal.type !== "cancel" && (canSelectReturnItems || canSelectExchangeItems) && (
                <div className="action-type-switch">
                  {canSelectReturnItems && (
                    <button
                      type="button"
                      className={cancelModal.type === "return" ? "active" : ""}
                      onClick={() => {
                        const eligible = getEligibleActionItems(order, "return");
                        setCancelModal((current) => ({
                          ...current,
                          type: "return",
                          selected: eligible.reduce((map, item, index) => ({ ...map, [item.id]: { checked: index === 0, quantity: getActionableQty(item) } }), {}),
                        }));
                        setCancelForm({ reason: RETURN_REASONS[0], comments: "" });
                      }}
                    >
                      Return
                    </button>
                  )}
                  {canSelectExchangeItems && (
                    <button
                      type="button"
                      className={cancelModal.type === "exchange" ? "active" : ""}
                      onClick={() => {
                        const eligible = getEligibleActionItems(order, "exchange");
                        setCancelModal((current) => ({
                          ...current,
                          type: "exchange",
                          selected: eligible.reduce((map, item, index) => ({ ...map, [item.id]: { checked: index === 0, quantity: getActionableQty(item) } }), {}),
                        }));
                        setCancelForm({ reason: EXCHANGE_REASONS[0], comments: "" });
                      }}
                    >
                      Exchange
                    </button>
                  )}
                </div>
              )}

              <div className="action-item-picker">
                {cancelModal.type === "cancel" ? (
                  // Whole-order cancel: read-only list of every item being cancelled.
                  (order.OrderItems || [])
                    .filter((item) => normalizeStatus(item.status) !== "cancelled")
                    .map((item) => (
                      <div className="action-item-row is-selected" key={item.id}>
                        <span className="action-item-info">
                          <strong>{item.product_name}</strong>
                          <small>{getItemColor(item)} · Qty {item.quantity}</small>
                        </span>
                      </div>
                    ))
                ) : (
                  getEligibleActionItems(order, cancelModal.type).map((item) => {
                    const sel = cancelModal.selected?.[item.id] || { checked: false, quantity: getActionableQty(item) };
                    const maxQty = getActionableQty(item);
                    const setQuantity = (nextQty) => {
                      const quantity = Math.min(maxQty, Math.max(1, nextQty));
                      setCancelModal((current) => {
                        const value = current.selected?.[item.id] || sel;
                        // Lowering the quantity can leave more allocated than is being
                        // exchanged. Trim from the end so the customer never submits a
                        // request for more sarees than they are sending back.
                        let targets = [...(value.exchangeTargets || [])];
                        let allocated = targets.reduce((sum, t) => sum + Number(t.quantity || 0), 0);
                        while (allocated > quantity && targets.length) {
                          const last = targets[targets.length - 1];
                          if (last.quantity > 1) {
                            targets[targets.length - 1] = { ...last, quantity: last.quantity - 1 };
                          } else {
                            targets = targets.slice(0, -1);
                          }
                          allocated -= 1;
                        }
                        return {
                          ...current,
                          selected: {
                            ...current.selected,
                            [item.id]: { ...value, quantity, exchangeTargets: targets },
                          },
                        };
                      });
                    };
                    return (
                      <div className={`action-item-row${sel.checked ? " is-selected" : ""}`} key={item.id}>
                        <label className="action-item-check-wrap">
                          <input
                            type="checkbox"
                            checked={Boolean(sel.checked)}
                            onChange={(event) => setCancelModal((current) => ({
                              ...current,
                              selected: {
                                ...current.selected,
                                [item.id]: { ...sel, checked: event.target.checked },
                              },
                            }))}
                          />
                          <span className="action-item-info">
                            <strong>{item.product_name}</strong>
                            <small>{getItemColor(item)} · Qty {maxQty}</small>
                          </span>
                        </label>
                        {sel.checked && maxQty > 1 && (
                          <div className="action-qty-stepper" aria-label={`Quantity to ${cancelModal.type}`}>
                            <button type="button" onClick={() => setQuantity((sel.quantity || maxQty) - 1)} disabled={(sel.quantity || maxQty) <= 1} aria-label="Decrease quantity">
                              <Icon icon="lucide:minus" />
                            </button>
                            <span>{sel.quantity || maxQty} of {maxQty}</span>
                            <button type="button" onClick={() => setQuantity((sel.quantity || maxQty) + 1)} disabled={(sel.quantity || maxQty) >= maxQty} aria-label="Increase quantity">
                              <Icon icon="lucide:plus" />
                            </button>
                          </div>
                        )}
                        {cancelModal.type === "exchange" && sel.checked && (() => {
                          const variant = exchangeVariants[item.id];
                          if (!variant || variant.loading) {
                            return <div className="exchange-variant-note">Loading exchange options…</div>;
                          }
                          if (variant.error) {
                            return <div className="exchange-variant-note is-warn">Couldn&rsquo;t load exchange options. Please try again.</div>;
                          }
                          const options = (variant.options || []).filter((o) => (o.colors || []).length > 0);
                          if (!options.length) {
                            return <div className="exchange-variant-note is-warn">Nothing is in stock to exchange this for right now.</div>;
                          }

                          const wanted = Number(sel.quantity || maxQty);
                          const targets = sel.exchangeTargets || [];
                          const allocated = exchangeAllocatedQty(sel);
                          const remaining = Math.max(0, wanted - allocated);
                          const isComplete = remaining === 0;

                          return (
                            <div className="exchange-variant-picker">
                              <span className="exchange-variant-label">
                                Choose {wanted} saree{wanted > 1 ? "s" : ""} at {formatPrice(variant.paidPrice)}
                                <small className="exchange-variant-hint">
                                  {" "}— any saree at the same price. No extra charge, no refund.
                                </small>
                              </span>

                              {/* Running tally. The request can't be submitted until every unit
                                  being sent back has a saree chosen to replace it. */}
                              <div className={`exchange-allocation${isComplete ? " is-complete" : ""}`}>
                                {isComplete
                                  ? `All ${wanted} chosen`
                                  : `${allocated} of ${wanted} chosen — pick ${remaining} more`}
                              </div>

                              {targets.length > 0 && (
                                <ul className="exchange-chosen-list">
                                  {targets.map((t, index) => (
                                    <li key={`${t.productId}-${t.colorId ?? "x"}`} className="exchange-chosen-row">
                                      {t.image && <img src={t.image} alt="" className="exchange-chosen-thumb" />}
                                      <span className="exchange-chosen-info">
                                        <strong>{t.productName}</strong>
                                        <small>{t.colorName || "—"} · {t.quantity} pc</small>
                                      </span>
                                      <button
                                        type="button"
                                        className="exchange-chosen-remove"
                                        onClick={() => removeExchangeTarget(item.id, index)}
                                        aria-label={`Remove one ${t.productName}`}
                                      >
                                        <Icon icon="lucide:minus" />
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}

                              {/* Cards stay visible while there is anything left to allocate, and
                                  go quiet once the customer has chosen enough. */}
                              {!isComplete && (
                                <div className="exchange-product-options">
                                  {options.map((option) => {
                                    const thumb = Array.isArray(option.images)
                                      ? (option.images[0]?.url || option.images[0])
                                      : null;
                                    return (
                                      <div key={option.product_id} className="exchange-product-option">
                                        {thumb && <img src={thumb} alt="" className="exchange-product-thumb" />}
                                        <span className="exchange-product-name">
                                          {option.name}
                                          {option.is_current_product ? " (current)" : ""}
                                        </span>
                                        <div className="exchange-product-colors">
                                          {(option.colors || []).map((c) => {
                                            const taken = targets.find(
                                              (t) => Number(t.productId) === Number(option.product_id)
                                                && String(t.colorId ?? "") === String(c.color_id ?? ""),
                                            )?.quantity || 0;
                                            const soldOut = taken >= Number(c.stock || 0);
                                            return (
                                              <button
                                                key={c.color_id}
                                                type="button"
                                                className={`exchange-color-chip${taken ? " is-chosen" : ""}`}
                                                disabled={soldOut}
                                                onClick={() => addExchangeTarget(item.id, option, c)}
                                                title={soldOut ? `${c.name} — no more available` : `Add ${c.name}`}
                                              >
                                                <span
                                                  className="exchange-variant-dot"
                                                  style={{ backgroundColor: c.hex_code || "#ccc" }}
                                                />
                                                <small>{c.name}{taken ? ` ×${taken}` : ""}</small>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="form-group">
                <label htmlFor="cancel-reason">{getActionConfig(cancelModal.type).label}</label>
                <select 
                  id="cancel-reason" 
                  value={cancelForm.reason} 
                  onChange={(e) => setCancelForm(prev => ({ ...prev, reason: e.target.value }))}
                  required
                >
                  {getActionConfig(cancelModal.type).reasons.map((r, i) => (
                    <option key={i} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="cancel-comments">Additional Comments (Optional)</label>
                <textarea
                  id="cancel-comments"
                  placeholder="You can provide additional details here to help us process your request better."
                  value={cancelForm.comments}
                  onChange={(e) => setCancelForm(prev => ({ ...prev, comments: e.target.value }))}
                  rows={4}
                />
              </div>

              {cancelModal.type === "cancel" && (() => {
                // Whole-order cancel. The refund figure comes straight from the backend
                // (order.cancellation_refund) so it always matches what POST /cancel will
                // actually pay out — notably, a cancel after a paid re-dispatch keeps back
                // the re-dispatch logistics, the platform fee and the gift charge.
                // Prepaid → refund to the original payment method; wallet money always
                // goes back to the wallet in full. COD → nothing was paid.
                const isCod = String(order?.payment_method || "").toUpperCase() === "COD";
                const cr = order?.cancellation_refund || null;
                const paidAmount = toNumber(cr?.amount_paid) || toNumber(order.amount_paid) || (isCod ? 0 : breakdown.payable);
                const walletUsed = toNumber(cr?.wallet_refund) || toNumber(order.wallet_amount);
                const refundAmount = cr ? toNumber(cr.refund_estimate) : paidAmount;
                const showDeductions = Boolean(cr?.was_redispatched) && toNumber(cr?.non_refundable) > 0;
                return (
                  <div className="action-estimate-box">
                    {isCod ? (
                      <>
                        <div className="action-estimate-total">
                          <span>Amount to pay</span><strong>{formatPrice(0)}</strong>
                        </div>
                        <p className="action-estimate-note">
                          <Icon icon="lucide:info" />
                          Cash on Delivery order — nothing has been paid yet, so there is no refund to process.
                        </p>
                        {walletUsed > 0 && (
                          <p className="action-estimate-note">
                            <Icon icon="lucide:wallet" />
                            {formatPrice(walletUsed)} of wallet balance will be credited back to your wallet.
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <div><span>Amount paid</span><strong>{formatPrice(paidAmount)}</strong></div>
                        {showDeductions && toNumber(cr.redispatch_fee) > 0 && (
                          <div><span>Less re-dispatch charges</span><strong>-{formatPrice(cr.redispatch_fee)}</strong></div>
                        )}
                        {showDeductions && toNumber(cr.platform_fee) > 0 && (
                          <div><span>Less platform fee</span><strong>-{formatPrice(cr.platform_fee)}</strong></div>
                        )}
                        {showDeductions && toNumber(cr.gift_charge) > 0 && (
                          <div><span>Less gift charge</span><strong>-{formatPrice(cr.gift_charge)}</strong></div>
                        )}
                        <div className="action-estimate-total">
                          <span>Refund to original payment method</span><strong>{formatPrice(refundAmount)}</strong>
                        </div>
                        {walletUsed > 0 && (
                          <p className="action-estimate-note">
                            <Icon icon="lucide:wallet" />
                            {formatPrice(walletUsed)} of wallet balance will be credited back to your wallet.
                          </p>
                        )}
                        <p className="action-estimate-note">
                          <Icon icon="lucide:info" />
                          The refund is processed to your original payment method within 1-2 business days.
                        </p>
                      </>
                    )}
                  </div>
                );
              })()}

              {cancelModal.type !== "cancel" && loadingEstimate && (
                <div className="action-estimate-loading">
                  <div className="action-estimate-spinner"></div>
                  <span>Fetching details...</span>
                </div>
              )}

              {cancelModal.type !== "cancel" && !loadingEstimate && actionEstimate?.totals && (() => {
                const couponInfo = actionEstimate.coupon || null;
                const adjustment = toNumber(actionEstimate.totals.coupon_adjustment);
                const isFullReturn = cancelModal.type === "return" && Boolean(actionEstimate.totals.is_full_return);
                return (
                  <div className="action-estimate-box">
                    {isFullReturn ? (
                      <>
                        {/* Full return: what you PAID (amount_paid) is refunded to
                            your original payment method minus the non-refundable
                            fees + pickup charge; the wallet credit is returned to
                            the wallet in full and shown as its own line. */}
                        <div><span>Amount paid</span><strong>{formatPrice(actionEstimate.totals.amount_paid)}</strong></div>
                        {toNumber(actionEstimate.totals.platform_fee) > 0 && (
                          <div><span>Platform fee (not refunded)</span><strong>-{formatPrice(actionEstimate.totals.platform_fee)}</strong></div>
                        )}
                        {toNumber(actionEstimate.totals.cod_fee) > 0 && (
                          <div><span>COD charge (not refunded)</span><strong>-{formatPrice(actionEstimate.totals.cod_fee)}</strong></div>
                        )}
                        {toNumber(actionEstimate.totals.gift_charge) > 0 && (
                          <div><span>Gift charge (not refunded)</span><strong>-{formatPrice(actionEstimate.totals.gift_charge)}</strong></div>
                        )}
                        <div>
                          <span>
                            Return pickup charge
                            {toNumber(actionEstimate.totals.return_shipping_weight_kg) > 0
                              ? ` (${actionEstimate.totals.return_shipping_weight_kg} kg)`
                              : ""}
                          </span>
                          <strong>-{formatPrice(actionEstimate.totals.return_shipping_charge)}</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div><span>Selected product value</span><strong>{formatPrice(actionEstimate.totals.item_amount)}</strong></div>
                        {cancelModal.type === "return" && couponInfo && (
                          <>
                            <div>
                              <span>Coupon on order ({couponInfo.original_code})</span>
                              <strong>{formatPrice(couponInfo.original_discount)}</strong>
                            </div>
                            <div>
                              <span>
                                {couponInfo.original_eligible
                                  ? `Coupon re-applied on remaining items (${couponInfo.original_code})`
                                  : couponInfo.applied_code
                                    ? `Best coupon re-applied (${couponInfo.applied_code})`
                                    : "No coupon qualifies for the remaining items"}
                              </span>
                              <strong>{formatPrice(couponInfo.new_discount)}</strong>
                            </div>
                            <div>
                              <span>Coupon difference deducted</span>
                              <strong>-{formatPrice(adjustment)}</strong>
                            </div>
                          </>
                        )}
                        {cancelModal.type === "return" && (
                          <div>
                            <span>
                              Return pickup charge
                              {toNumber(actionEstimate.totals.return_shipping_weight_kg) > 0
                                ? ` (${actionEstimate.totals.return_shipping_weight_kg} kg)`
                                : ""}
                            </span>
                            <strong>-{formatPrice(actionEstimate.totals.return_shipping_charge)}</strong>
                          </div>
                        )}
                      </>
                    )}
                    {isFullReturn && toNumber(actionEstimate.totals.wallet_return) > 0 ? (
                      <>
                        <div className="action-estimate-total">
                          <span>Refund to original payment method</span>
                          <strong>{formatPrice(actionEstimate.totals.gateway_refund)}</strong>
                        </div>
                        <div className="action-estimate-total">
                          <span>Returned to wallet</span>
                          <strong>{formatPrice(actionEstimate.totals.wallet_return)}</strong>
                        </div>
                      </>
                    ) : (
                      <div className="action-estimate-total">
                        <span>{cancelModal.type === "exchange" ? "Refund" : "Estimated refund"}</span>
                        <strong>{formatPrice(actionEstimate.totals.estimated_refund_amount)}</strong>
                      </div>
                    )}
                    {cancelModal.type === "return" && (
                      <>
                        {!isFullReturn && couponInfo && adjustment > 0 && (
                          <p className="action-estimate-note">
                            <Icon icon="lucide:badge-percent" />
                            {couponInfo.original_eligible
                              ? `Your coupon ${couponInfo.original_code} is re-calculated on the items you keep, so only the difference is deducted.`
                              : couponInfo.applied_code
                                ? `The items you keep no longer qualify for ${couponInfo.original_code}, so we applied the best available coupon ${couponInfo.applied_code} to them and deducted only the difference.`
                                : `The items you keep no longer qualify for ${couponInfo.original_code} and no other coupon applies, so the coupon amount is deducted from the refund.`}
                          </p>
                        )}
                        {!isFullReturn && couponInfo && adjustment <= 0 && (
                          <p className="action-estimate-note">
                            <Icon icon="lucide:badge-percent" />
                            Your coupon {couponInfo.original_code} still applies in full to the items you keep — nothing is deducted.
                          </p>
                        )}
                        {isFullReturn && toNumber(actionEstimate.totals.wallet_return) > 0 && (
                          <p className="action-estimate-note">
                            <Icon icon="lucide:wallet" />
                            {formatPrice(actionEstimate.totals.wallet_return)} paid from your wallet is credited back to your wallet in full; the fees and pickup charge come out of the amount you paid.
                          </p>
                        )}
                        {!isFullReturn && breakdown.walletAmount > 0 && (
                          <p className="action-estimate-note">
                            <Icon icon="lucide:wallet" />
                            The part you paid from your wallet is credited back to your wallet; the rest goes to your original payment method.
                          </p>
                        )}
                        <p className="action-estimate-note">
                          <Icon icon="lucide:info" />
                          {String(order?.payment_method || "").toUpperCase() === "COD"
                            ? "You get back the amount paid for the returned items minus the return pickup charge. The refund is transferred to your bank account once we receive the item."
                            : "You get back the amount paid for the returned items minus the return pickup charge — the original delivery charge is never deducted."}
                        </p>
                      </>
                    )}
                  </div>
                );
              })()}

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="modal-action-btn secondary"
                  onClick={closeActionModal}
                  disabled={modalSubmitLoading}
                >
                  Go Back
                </button>
                <button 
                  type="submit" 
                  className={`modal-action-btn ${getActionConfig(cancelModal.type).tone}`}
                  disabled={modalSubmitLoading}
                >
                  {modalSubmitLoading ? "Processing..." : getActionConfig(cancelModal.type).button}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {trackModalOpen && (
        <OrderTrackModal
          order={order}
          statusLabel={statusLabel}
          tracking={tracking}
          loading={trackingLoading}
          onClose={() => setTrackModalOpen(false)}
        />
      )}
    </main>
  );
}

