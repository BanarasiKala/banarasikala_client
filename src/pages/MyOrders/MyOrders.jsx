import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { imgUrl } from "../../utils/cloudinary";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import api from "../../utils/api";
import { formatEstimatedDeliveryDate, getEstimatedDeliveryDate } from "../../utils/deliveryDate";
import { getOrderDisplayNumber } from "../../utils/itemCode";
import { numberEnv } from "../../utils/env";
import { MAX_REVIEW_IMAGES, uploadReviewImages } from "../../utils/reviewUploads";
import EmptyStateIcon from "../../components/EmptyStateIcon";
import OrderTrackModal from "../../components/OrderTrackModal";
import QuerySheet from "../../components/QuerySheet";
import ReviewImagePicker from "../../components/ReviewImagePicker";
import "./MyOrders.css";

const STATUS_CONFIG = {
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
  // The old saree is back with the seller; the REPLACEMENT has not been delivered (often not
  // even shipped). Deliberately not green/"completed" — the customer is still waiting.
  "Exchange Received": { color: "#9a6200", bg: "#fff6dc", icon: "lucide:package-open", label: "Replacement being prepared" },
  "Exchange Completed": { color: "#087a55", bg: "#edfdf5", icon: "lucide:badge-check", label: "Exchange completed" },
};

const getStatus = (status) => {
  if (!status) return STATUS_CONFIG.Pending;
  const normalized = String(status).toLowerCase();
  if (normalized === "order placed" || normalized === "order_placed") return STATUS_CONFIG["Order Placed"];
  if (normalized === "pending") return STATUS_CONFIG.Pending;
  if (normalized === "processing") return STATUS_CONFIG["Order Placed"];
  // RTO / undelivered before the generic Shipped check — "rto in transit"
  // contains "in transit" and must never read as Shipped.
  if (normalized === "undelivered") return STATUS_CONFIG.Undelivered;
  if (normalized === "rto initiated" || normalized === "rto_initiated") return STATUS_CONFIG["RTO Initiated"];
  if (normalized === "rto in transit" || normalized === "rto_in_transit") return STATUS_CONFIG["RTO In Transit"];
  if (normalized === "rto delivered" || normalized === "rto_delivered" || normalized === "rto") return STATUS_CONFIG["RTO Delivered"];
  if (normalized === "pickup scheduled" || normalized === "pickup_scheduled" || normalized === "awb assigned" || normalized === "awb_assigned") return STATUS_CONFIG["Pickup Scheduled"];
  if (normalized === "out for pickup" || normalized === "out_for_pickup") return STATUS_CONFIG["Out For Pickup"];
  if (normalized === "picked up" || normalized === "picked_up") return STATUS_CONFIG["Picked Up"];
  if (normalized === "shipped" || normalized.includes("in transit") || normalized.includes("manifest")) return STATUS_CONFIG.Shipped;
  if (normalized === "delivered") return STATUS_CONFIG.Delivered;
  if (normalized.includes("partial") && normalized.includes("cancel")) return STATUS_CONFIG["Partially Cancelled"];
  if (normalized === "cancelled") return STATUS_CONFIG.Cancelled;
  if (normalized.includes("cancel")) return STATUS_CONFIG.Cancelled;
  if (normalized === "out for delivery" || normalized === "out_for_delivery") return STATUS_CONFIG["Out For Delivery"];
  if (normalized === "seller cancelled" || normalized === "seller_cancelled") return STATUS_CONFIG["Seller Cancelled"];
  if (normalized.includes("return requested")) return STATUS_CONFIG["Return Requested"];
  if (normalized.includes("return initiated")) return STATUS_CONFIG["Return Initiated"];
  if (normalized.includes("out for return pickup")) return STATUS_CONFIG["Out For Return Pickup"];
  if (normalized.includes("return picked up")) return STATUS_CONFIG["Return Picked Up"];
  if (normalized.includes("return completed") || normalized.includes("return delivered")) return STATUS_CONFIG["Return Completed"];
  if (normalized.includes("exchange requested")) return STATUS_CONFIG["Exchange Requested"];
  if (normalized.includes("exchange initiated")) return STATUS_CONFIG["Exchange Initiated"];
  if (normalized.includes("exchange pickup scheduled")) return STATUS_CONFIG["Exchange Pickup Scheduled"];
  if (normalized.includes("exchange picked up")) return STATUS_CONFIG["Exchange Picked Up"];
  // Must be checked BEFORE "exchange completed" — both are substring matches, and an
  // exchange sits in Received (replacement pending) far longer than it sits in Completed.
  if (normalized.includes("exchange received")) return STATUS_CONFIG["Exchange Received"];
  if (normalized.includes("exchange completed") || normalized.includes("exchange delivered")) return STATUS_CONFIG["Exchange Completed"];
  
  return STATUS_CONFIG[status] || STATUS_CONFIG.Pending;
};

const toNumber = (value) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};
const formatPrice = (value) => `₹${toNumber(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Header summary money — paise only when the amount actually has them.
const formatAmount = (value) => {
  const amount = toNumber(value);
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};
const getItemImage = (item) => item.image_url || item.product_image_url || "";
const getItemColorLabel = (item) => item.color_name || item.Color?.name || null;
const isCancelled = (order) => ["cancelled", "seller cancelled"].includes(String(order.status || "").toLowerCase());
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
const isDelivered = (order) => {
  const status = String(order?.status || "").toLowerCase();
  if (PRE_DELIVERY_STATUSES.has(status)) return false;
  return status === "delivered" || Boolean(order?.delivered_at);
};

// A current, dispatched AWB — a re-dispatched order sits in Processing while still
// holding the PREVIOUS shipment's AWB, so those statuses count as "not shipped yet".
// Mirror of hasCurrentAwb on the order detail page.
const hasCurrentAwb = (order) => {
  if (!order?.shiprocket_awb) return false;
  const status = String(order?.status || "").toLowerCase();
  return status !== "pending" && status !== "processing";
};
// Unlike the order detail page, tracking stays on the card AFTER delivery — the scan
// history is still worth reading, and it lets Track Order sit beside Download Invoice.
// Only a cancelled order (no journey to show) loses the button.
const isTrackable = (order) => {
  if (!hasCurrentAwb(order)) return false;
  return !String(order?.status || "").toLowerCase().includes("cancel");
};
const canReviewOrderItem = (order, item) => {
  const itemStatus = String(item?.status || "").toLowerCase();
  return isDelivered(order) && !itemStatus.includes("cancel");
};
// The pill each item carries. An item that has its own status (cancelled,
// returned…) shows that; otherwise it inherits the order's.
const getItemStatusMeta = (order, item) => {
  const itemStatus = String(item?.status || "").trim();
  if (itemStatus && itemStatus.toLowerCase() !== "active") return getStatus(itemStatus);
  // Return/exchange flows are item-scoped: an untouched (Active) item must not
  // inherit the order's reverse status — it simply stays delivered.
  const orderStatus = String(order?.status || "").toLowerCase();
  if (orderStatus.includes("return") || orderStatus.includes("exchange")) return STATUS_CONFIG.Delivered;
  return getStatus(order?.status);
};

// Statuses the backend parks an order in while it prepares a shipment. They are the same
// ones a brand-new order sits in, and shipping an exchange REPLACEMENT puts the order back
// into Processing — so a months-old exchanged order would group under "Ordered" while its
// items correctly read "Exchange completed". When the items say a reverse flow has happened,
// they are the truthful source; the filter reads off them instead.
const PREP_STATUSES = new Set(["pending", "processing", "order placed", "order_placed"]);

const getEffectiveOrderStatus = (order) => {
  const status = String(order?.status || "");
  if (!PREP_STATUSES.has(status.toLowerCase())) return status;

  // The old saree is already back with the seller and this "Processing" is the replacement
  // being prepared — treat it as an exchange so the Exchange filter still finds it.
  const items = order?.OrderItems || [];
  const hasExchange = items.some((item) => String(item?.status || "").toLowerCase().includes("exchange"));
  return hasExchange ? "Exchange Received" : status;
};

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "ordered", label: "Ordered" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
  { id: "exchange", label: "Exchange" },
  { id: "return", label: "Return" },
];

// Keyed off the SAME effective status as the badge, so an order the card shows as an
// exchange is also the one the Exchange filter finds.
const getOrderFilterGroup = (order) => {
  const normalized = getEffectiveOrderStatus(order).toLowerCase();
  if (normalized.includes("exchange")) return "exchange";
  if (normalized.includes("return")) return "return";
  // A partially-cancelled (modified) order is still active — keep it with the
  // ordered group, not under Cancelled.
  if (normalized.includes("partial") && normalized.includes("cancel")) return "ordered";
  if (normalized.includes("cancel")) return "cancelled";
  // RTO before delivered — "rto delivered" contains "delivered" but the
  // customer never received it; keep it with the in-transit group.
  if (normalized.includes("rto") || normalized === "undelivered") return "shipped";
  if (normalized.includes("delivered")) return "delivered";
  // "awb assigned" reads as "Pickup scheduled" (courier booked, not yet shipped), so
  // it stays with the Ordered group — only actual shipping states go under Shipped.
  if (normalized.includes("ship") || normalized.includes("out for delivery")) return "shipped";
  return "ordered";
};

const getOrderBreakdown = (order) => {
  const items = order.OrderItems || [];
  const activeItems = items.filter(item => String(item.status || "").toLowerCase() !== "cancelled");
  const itemSubtotal = activeItems.reduce(
    (sum, item) => sum + toNumber(item.price) * Math.max(1, toNumber(item.quantity) || 1),
    0,
  );
  const subtotal = toNumber(order.subtotal_amount) || itemSubtotal;
  const shippingCharge = toNumber(order.shipping_charge);
  const shippingDiscount = toNumber(order.shipping_discount);
  const paymentFee = toNumber(order.payment_fee);
  const platformFeeAmount = numberEnv("VITE_PLATFORM_FEE_AMOUNT");
  const hasCod = String(order.payment_method).toUpperCase() === "COD";

  let codCharge = 0;
  let platformFee = 0;

  if (paymentFee > 0) {
    if (hasCod) {
      codCharge = Math.max(0, paymentFee - platformFeeAmount);
      platformFee = platformFeeAmount;
    } else {
      codCharge = 0;
      platformFee = paymentFee;
    }
  }

  const paymentDiscount = toNumber(order.payment_discount);
  const couponDiscount = toNumber(order.discount_amount);
  const walletAmount = toNumber(order.wallet_amount);
  const payable = toNumber(order.payable_amount) || toNumber(order.total_amount) || Math.max(
    0,
    subtotal + shippingCharge + paymentFee - shippingDiscount - paymentDiscount - couponDiscount - walletAmount,
  );

  return {
    subtotal,
    shippingCharge,
    shippingDiscount,
    paymentFee,
    codCharge,
    platformFee,
    paymentDiscount,
    couponDiscount,
    walletAmount,
    payable,
    paymentMethod: order.payment_method || "Prepaid",
    paymentStatus: order.payment_status || (String(order.payment_method).toUpperCase() === "COD" ? "Pending" : "Paid"),
  };
};

// Whole-order cancellation only, while the order is still being prepared
// (pending / processing) and within 24 hours. Mirror of CANCELLABLE_STATUSES in
// OrderController — once the status moves on (AWB assigned, shipped…) cancel is gone.
const CANCELLABLE_STATUSES = ["pending", "processing"];
const canCancelOrder = (order) => {
  const rawDate = order?.createdAt || order?.created_at;
  if (!rawDate) return false;
  const status = String(order.status || "").toLowerCase();
  if (!CANCELLABLE_STATUSES.includes(status)) return false;
  const createdAt = new Date(rawDate).getTime();
  if (!Number.isFinite(createdAt)) return false;
  return Date.now() - createdAt <= 24 * 60 * 60 * 1000;
};

const TrackingTimeline = ({ activities = [] }) => {
  if (!activities.length) {
    return (
      <div className="tracking-empty">
        <Icon icon="lucide:map-pin-off" />
        <p>Tracking updates will appear once shipment is dispatched.</p>
      </div>
    );
  }

  return (
    <div className="tracking-timeline">
      {activities.map((activity, index) => (
        <div key={`${activity.activity || "step"}-${index}`} className={`timeline-item ${index === 0 ? "active" : ""}`}>
          <span className="timeline-dot" />
          {index < activities.length - 1 && <span className="timeline-line" />}
          <div className="timeline-content">
            <p className="timeline-status">{activity.activity}</p>
            <p className="timeline-location">{activity.location}</p>
            <p className="timeline-date">{activity.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
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
  "Size fits differently than expected / Size issue",
  "Product color/design is different from images",
  "Received damaged or defective product",
  "Quality of material is not as expected",
  "Wrong product delivered",
  "Changed mind / No longer needed",
  "Other reason"
];

const EXCHANGE_REASONS = [
  "Need a different color/design"
];

const CANCEL_RETURN_REASONS = [
  "Decided to keep the product / Changed mind",
  "Resolved the issue myself",
  "Product size/fit is fine now",
  "Other reason"
];

const CANCEL_EXCHANGE_REASONS = [
  "Decided to keep the product / Changed mind",
  "Resolved the issue myself",
  "Product color/design is fine now",
  "Other reason"
];

// "21 Jul 2026" — how a query row is labelled in the ⋮ menu. The customer raised it, so
// the date is the thing that tells two of them apart; the TKT number means nothing to them
// until support quotes it back.
const formatQueryDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

// Shared frozen default for OrderCard's `orderTickets`. A literal [] in the parameter
// default would be a new array on every render, so every card would re-render whenever any
// sibling did.
const EMPTY_TICKETS = [];

const RATING_LABELS = ["Very Bad", "Bad", "Ok-Ok", "Good", "Very Good"];

const ReviewStars = ({ rating = 0, onSelect, disabled = false }) => (
  <div className="order-review-stars">
    {[1, 2, 3, 4, 5].map((star, index) => (
      <button
        key={star}
        type="button"
        className={Number(rating) >= star ? "active" : ""}
        onClick={() => onSelect?.(star)}
        disabled={disabled}
        aria-label={`${star} star`}
      >
        <Icon icon="mdi:star" />
        <small>{RATING_LABELS[index]}</small>
      </button>
    ))}
  </div>
);

// `ticket` is the LIVE thread (continue it); `orderTickets` is every query ever raised on
// this order, newest first, which the ⋮ menu lists so closed threads stay reachable.
const OrderCard = ({ order, ticket, orderTickets = EMPTY_TICKETS, onFeedback, onContact, onNotify, onViewTicket }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const orderNumber = getOrderDisplayNumber(order);
  const items = order.OrderItems || [];
  const activeItems = useMemo(() => items.filter(item => String(item.status || "").toLowerCase() !== "cancelled"), [items]);
  const placedAt = new Date(order.createdAt);
  const hasPlacedAt = !Number.isNaN(placedAt.getTime());
  const orderDate = hasPlacedAt
    ? placedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const orderTime = hasPlacedAt
    ? placedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    : "";

  const summary = useMemo(() => {
    const breakdown = getOrderBreakdown(order);
    const isCod = String(breakdown.paymentMethod).toUpperCase() === "COD";
    // amount_paid is what actually reached us (gateway payment or COD collection);
    // until then show what the order is worth, not a misleading "paid".
    const amountPaid = toNumber(order.amount_paid);
    return {
      isCod,
      amount: amountPaid > 0 ? amountPaid : breakdown.payable,
      amountLabel: amountPaid > 0 ? "Total Paid" : isCod ? "Amount Due" : "Order Total",
    };
  }, [order]);

  const openOrderDetail = () => {
    navigate(`/order-confirmation?orderId=${order.id}`);
  };

  // Escape or a click anywhere outside closes the menu. Both listeners are registered only
  // while it is open, so twenty order cards don't each keep a pair on the document for a
  // menu nobody has opened.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    // pointerdown rather than click: click fires on release, so a drag begun inside the
    // menu and released outside would close it, and a scroll on touch would leave the menu
    // hanging open for a frame. The trigger button lives inside menuRef, so its own toggle
    // still works instead of this closing and the toggle immediately reopening.
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const copyOrderNumber = async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (insecure origin / denied) — nothing to show.
    }
  };

  // The invoice is an authenticated endpoint, so it can't be a plain link — fetch
  // it with the auth header and hand the HTML to a tab the browser can print. The
  // tab is opened synchronously inside the click so the pop-up blocker allows it.
  const downloadInvoice = async () => {
    if (invoiceLoading) return;
    const tab = window.open("", "_blank");
    setInvoiceLoading(true);
    try {
      const response = await api.get(`/api/orders/${order.id}/invoice`);
      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: "text/html" }));
      if (tab) {
        tab.location.href = blobUrl;
      } else {
        onNotify?.("Allow pop-ups for this site to open your invoice.", "warning");
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      tab?.close();
      onNotify?.(err?.response?.data?.message || "Could not open your invoice right now.", "error");
    } finally {
      setInvoiceLoading(false);
    }
  };

  const canDownloadInvoice = isDelivered(order);
  const canTrackOrder = isTrackable(order);

  return (
    <article className={`order-card ${isCancelled(order) ? "is-cancelled" : ""}`}>
      <div className="order-card-header">
        <div className="order-head-main">
          <div className="order-meta">
            <span className="order-id-label">Order ID</span>
            <span className="order-id-line">
              <span className="order-number">#{orderNumber}</span>
              <button
                type="button"
                className={`order-copy-btn ${copied ? "is-copied" : ""}`}
                onClick={copyOrderNumber}
                aria-label={`Copy order ID ${orderNumber}`}
              >
                <Icon icon={copied ? "lucide:check" : "lucide:copy"} />
              </button>
            </span>
            {hasPlacedAt && (
              <span className="order-date">
                {orderDate}
                <span className="order-date-dot">•</span>
                Placed on {orderTime}
              </span>
            )}
          </div>
          <div className="order-menu-wrap" ref={menuRef}>
            <button
              className={`order-detail-menu ${menuOpen ? "is-open" : ""}`}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={`Actions for order ${orderNumber}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <Icon icon="lucide:more-vertical" />
            </button>

            {menuOpen && (
              <div className="order-menu-pop" role="menu" aria-label={`Actions for order ${orderNumber}`}>
                <button
                  type="button"
                  className="order-menu-item"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); openOrderDetail(); }}
                >
                  <Icon icon="lucide:receipt-text" />
                  <span>View Order Detail</span>
                </button>

                {canTrackOrder && (
                  <button
                    type="button"
                    className="order-menu-item"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setTrackOpen(true); }}
                  >
                    <Icon icon="lucide:truck" />
                    <span>Track Order</span>
                  </button>
                )}

                {canDownloadInvoice && (
                  // The menu stays open while the PDF is being prepared: closing it would
                  // drop the "Preparing…" state and leave the customer with no sign that
                  // anything is happening. It closes itself once the tab opens.
                  <button
                    type="button"
                    className="order-menu-item"
                    role="menuitem"
                    onClick={async () => { await downloadInvoice(); setMenuOpen(false); }}
                    disabled={invoiceLoading}
                  >
                    <Icon
                      icon={invoiceLoading ? "lucide:loader" : "lucide:download"}
                      className={invoiceLoading ? "is-spinning" : ""}
                    />
                    <span>{invoiceLoading ? "Preparing…" : "Download Invoice"}</span>
                  </button>
                )}

                {/* Every query raised on this order, newest first — active and closed
                    alike. A closed thread can't be replied to but stays readable, and this
                    is the only route back to it.
                    Tagged Active / Closed rather than the raw status: Open, In Progress and
                    Resolved are all still repliable, and the only thing that changes what
                    the customer can DO here is whether the thread is closed. */}
                {orderTickets.map((entry) => {
                  const isClosed = entry.status === "Closed";
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className="order-menu-item"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); onViewTicket(entry); }}
                    >
                      <Icon icon={isClosed ? "lucide:archive" : "lucide:messages-square"} />
                      <span>Query {entry.ticket_number}</span>
                      <em className={`order-menu-tag ${isClosed ? "is-closed" : "is-active"}`}>
                        {isClosed ? "Closed" : "Active"}
                      </em>
                    </button>
                  );
                })}

                {/* Only when nothing is live. With an active query this used to render a
                    "View Query" row that went to the same thread already listed above it —
                    the same conversation twice in a four-item menu. The server rejects a
                    second open query with a 409 anyway, so there is nothing to offer here
                    until the current one is closed. */}
                {!ticket && (
                  <button
                    type="button"
                    className="order-menu-item"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onContact(order); }}
                  >
                    <Icon icon="lucide:message-circle-question" />
                    <span>Query Us</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="order-head-stats">
          <div className="order-stat">
            <span className="order-stat-icon"><Icon icon="lucide:package" /></span>
            <span className="order-stat-copy">
              <strong>{activeItems.length}</strong>
              <small>{activeItems.length === 1 ? "Item" : "Items"}</small>
            </span>
          </div>
          <div className="order-stat">
            <span className="order-stat-icon"><Icon icon="lucide:indian-rupee" /></span>
            <span className="order-stat-copy">
              <strong>{formatAmount(summary.amount)}</strong>
              <small>{summary.amountLabel}</small>
            </span>
          </div>
          <div className="order-stat">
            <span className="order-stat-icon"><Icon icon={summary.isCod ? "lucide:banknote" : "lucide:credit-card"} /></span>
            <span className="order-stat-copy">
              <strong>{summary.isCod ? "COD" : "Online"}</strong>
              <small>Payment</small>
            </span>
          </div>
        </div>
      </div>

      <div className="order-products">
        <h4 className="order-products-title">Items in this order</h4>

        <div className="order-items-box">
          {items.map((item, index) => {
            const imageUrl = getItemImage(item);
            const colorHex = item.color_hex || null;
            const colorLabel = getItemColorLabel(item);
            const productName = item.product_name || `Product #${item.product_id}`;
            const isItemCancelled = String(item.status || "").toLowerCase() === "cancelled";
            const itemRating = Number(item.feedback?.rating || 0);
            const itemStatusMeta = getItemStatusMeta(order, item);
            const productUrl = item.product_slug
              ? `/product/${item.product_slug}${item.colorId ? `?color=${item.colorId}` : ""}`
              : null;

            return (
              <div
                key={`${item.product_id}-${item.colorId || index}`}
                className={`order-product-item ${isItemCancelled ? "item-cancelled" : ""}${productUrl ? " is-clickable" : ""}`}
                onClick={productUrl ? () => navigate(productUrl) : undefined}
                role={productUrl ? "button" : undefined}
                tabIndex={productUrl ? 0 : undefined}
                onKeyDown={productUrl ? (e) => e.key === "Enter" && navigate(productUrl) : undefined}
              >
                <div className="order-product-media">
                  {imageUrl ? (
                    <img src={imgUrl(imageUrl, 200)} alt={productName} loading="lazy" />
                  ) : (
                    <div className="order-product-placeholder">
                      <Icon icon="lucide:image-off" />
                    </div>
                  )}
                </div>

                <div className="order-product-details">
                  <div className="order-product-headline">
                    <h3>{productName}</h3>
                    <span
                      className="order-item-status"
                      style={{ backgroundColor: itemStatusMeta.bg, color: itemStatusMeta.color }}
                    >
                      <Icon icon={itemStatusMeta.icon} />
                      {itemStatusMeta.label}
                    </span>
                  </div>

                  {(colorHex || colorLabel) && (
                    <div className="order-product-attr">
                      <span className="order-attr-label">Color:</span>
                      {colorHex && <span className="order-color-swatch" style={{ backgroundColor: colorHex }} />}
                      {colorLabel && <span className="order-attr-value">{colorLabel}</span>}
                    </div>
                  )}

                  <div className="order-product-attr">
                    <span className="order-attr-label">Total Qty:</span>
                    <span className="order-attr-value">{item.quantity}</span>
                  </div>
                </div>

                {canReviewOrderItem(order, item) && (
                  <div className="order-feedback-row">
                    <ReviewStars rating={itemRating} disabled />
                    <button type="button" onClick={(e) => { e.stopPropagation(); onFeedback(order, item); }}>
                      {item.feedback ? "Edit feedback" : "Add feedback"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {order.rto_action?.awaiting && String(order.rto_action?.payment_method || "").toUpperCase() !== "COD" && (
        <div className="order-rto-nudge">
          <Icon icon="lucide:package-x" />
          <div className="order-rto-nudge-copy">
            <strong>Action needed — your order came back to us</strong>
            <span>Choose to re-dispatch (pay {formatPrice(order.rto_action.redispatch_fee)}) or get a refund.</span>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); openOrderDetail(); }}>
            Choose
          </button>
        </div>
      )}

      {order.rto_action?.resolution === "PRODUCT_RETURNED_COD_BLOCKED" && (
        <div className="order-rto-nudge order-rto-nudge-cod">
          <Icon icon="lucide:info" />
          <div className="order-rto-nudge-copy">
            <strong>Order returned — Cash on Delivery disabled</strong>
            <span>This COD parcel couldn&rsquo;t be delivered. You can reorder any time by paying online.</span>
          </div>
        </div>
      )}

      {(() => {
        const isPrepaid = String(order.payment_method || '').toUpperCase() !== 'COD';
        const hasCompletedReturn = String(order.status || '').toLowerCase().includes('return completed') ||
          items.some(item => String(item.status || '').toLowerCase().includes('return completed'));
        if (isPrepaid && hasCompletedReturn) {
          let totalItemAmount = 0;
          let totalForwardDeduction = 0;
          let totalReverseDeduction = 0;
          let returnActionsFound = false;

          items.forEach(item => {
            const itemActions = Array.isArray(item.actions) ? item.actions : [];
            itemActions.forEach(action => {
              const actionType = String(action.action_type || '').toLowerCase();
              if (actionType === 'return') {
                totalItemAmount += Number(action.item_amount || 0);
                totalForwardDeduction += Number(action.forward_shipping_deduction || 0);
                totalReverseDeduction += Number(action.reverse_shipping_deduction || 0);
                returnActionsFound = true;
              }
            });
          });

          // Fallbacks for legacy/older order formats
          if (!returnActionsFound || totalItemAmount === 0) {
            totalItemAmount = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
            totalForwardDeduction = Number(order.shipping_charge || 0);
            totalReverseDeduction = 0;
          }

          const calculatedRefund = Math.max(0, totalItemAmount - totalForwardDeduction - totalReverseDeduction);
          const finalRefund = Number(order.refund_amount || calculatedRefund);

          return (
            <div className="order-card-refund-box">
              <div className="refund-box-header">
                <Icon icon="lucide:badge-indian-rupee" />
                <h4>Refund Breakdown</h4>
              </div>

              <div className="refund-breakdown-details">
                <div className="refund-detail-row">
                  <span>Returned Items Value:</span>
                  <span>{formatPrice(totalItemAmount)}</span>
                </div>
                {totalForwardDeduction > 0 && (
                  <div className="refund-detail-row deduction">
                    <span>Delivery Charges Deduction:</span>
                    <span>-{formatPrice(totalForwardDeduction)}</span>
                  </div>
                )}
                {totalReverseDeduction > 0 && (
                  <div className="refund-detail-row deduction">
                    <span>RTO / Reverse Shipping Charges:</span>
                    <span>-{formatPrice(totalReverseDeduction)}</span>
                  </div>
                )}
                <div className="refund-detail-row final-refund">
                  <span>Total Refund Processed:</span>
                  <strong>{formatPrice(finalRefund)}</strong>
                </div>
              </div>

              <p className="refund-box-note">
                <Icon icon="lucide:info" />
                Refund has been processed after successful quality check. Forward delivery charges and RTO/reverse shipping charges have been deducted from the original paid amount.
              </p>
            </div>
          );
        }
        return null;
      })()}

      {/* The invoice / track button row that used to sit alongside this has moved into the
          ⋮ menu. The help box stays on the card: it is not just a button — it also shows
          whether a query is already open on this order, which is worth seeing without
          opening a menu. Both routes call the same handler. */}
      <div className="order-card-footer">
        <div className="order-help-box">
          <span className="order-help-icon"><Icon icon="lucide:message-circle-question" /></span>
          <div className="order-help-copy">
            <strong>Need Help with this order?</strong>
            {/* Only a LIVE query appears here. A closed thread is history, not the state of
                this order, and showing it made a settled order look like it still had
                something outstanding; closed ones stay reachable from the ⋮ menu.
                Labelled by the date it was raised, not the TKT number — the customer raised
                it, so the date is what identifies it to them. */}
            {ticket ? (
              <span className="order-help-ticket">
                {/* Number first — it is what support quotes back in email, so it is the
                    thing a customer needs to be able to find and read out. The date sits
                    after it, dimmed, as the human-readable half. */}
                <b>{ticket.ticket_number}</b>
                <i>Raised {formatQueryDate(ticket.createdAt)}</i>
                <em className="order-menu-tag is-active">Active</em>
              </span>
            ) : (
              <span>Raise a query with our support team</span>
            )}
          </div>
          <button type="button" className="order-help-btn" onClick={() => onContact(order)}>
            {ticket ? "View Query" : "Query Us"}
          </button>
        </div>
      </div>

      {trackOpen && (
        <OrderTrackModal
          order={order}
          statusLabel={getStatus(getEffectiveOrderStatus(order)).label}
          onClose={() => setTrackOpen(false)}
        />
      )}

    </article>
  );
};

export default function MyOrders() {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [draftFilter, setDraftFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: "cancel_order", // "cancel_order" (whole order only), "return", "exchange"
    orderId: null,
    itemId: null,
    itemName: ""
  });
  const [actionForm, setActionForm] = useState({
    reason: "Incorrect item/size selected",
    comments: ""
  });
  const [modalSubmitLoading, setModalSubmitLoading] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    order: null,
    item: null,
    productName: "",
  });
  const [feedbackForm, setFeedbackForm] = useState({
    rating: 5,
    title: "",
    comment: "",
    images: [],
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitLabel, setFeedbackSubmitLabel] = useState("");

  const [tickets, setTickets] = useState([]);
  const [supportModal, setSupportModal] = useState({ isOpen: false, order: null });
  // The form's own fields live in QuerySheet — it is unmounted between opens, so it resets
  // itself and this page keeps only what it needs to post.
  const [supportSubmitting, setSupportSubmitting] = useState(false);

  /**
   * Per order: the LIVE query, plus every query ever raised on that order.
   *
   * The rule is one *open* query per order, not one ever — a closed thread cannot be
   * replied to, so blocking a new one behind it would leave the customer with no route at
   * all when a fresh problem appears weeks later. (This mirrors the server: see the status
   * filter in SupportController.createTicket.)
   *
   *   live query -> "View Query" (continue it)
   *   otherwise  -> "Query Us"   (raise a new one; the old ones stay readable in the menu)
   *
   * The full list feeds the ⋮ menu, which lists every query on the order regardless of
   * status. `tickets` arrives newest-first, so both the live lookup and the list order
   * fall out of a single pass.
   */
  const { liveTicketByOrder, ticketsByOrder } = useMemo(() => {
    const live = new Map();
    const all = new Map();
    tickets.forEach((ticket) => {
      const key = String(ticket.order_id);
      if (!all.has(key)) all.set(key, []);
      all.get(key).push(ticket);
      if (ticket.status !== "Closed" && !live.has(key)) live.set(key, ticket);
    });
    return { liveTicketByOrder: live, ticketsByOrder: all };
  }, [tickets]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) =>
      selectedFilter === "all" || getOrderFilterGroup(order) === selectedFilter
    );
  }, [orders, selectedFilter]);

  const visibleOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return filteredOrders;
    return filteredOrders.filter((order) => {
      const orderNumber = getOrderDisplayNumber(order).toLowerCase();
      const productNames = (order.OrderItems || []).map((item) => item.product_name || "").join(" ").toLowerCase();
      return orderNumber.includes(query) || productNames.includes(query) || String(order.status || "").toLowerCase().includes(query);
    });
  }, [filteredOrders, searchQuery]);

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/api/orders/my");
      const payload = response.data;
      const data = Array.isArray(payload) ? payload : (payload?.data || []);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchTickets = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await api.get("/api/support/tickets/my");
      setTickets(Array.isArray(response.data) ? response.data : []);
    } catch {
      // Non-blocking: the cards still offer "Query Us", just without a status.
    }
  }, [user]);

  // A LIVE ticket makes this a way back INTO that conversation. A closed one does not —
  // it can't be replied to, so the customer needs a fresh thread, not a dead end.
  const openSupportModal = (order) => {
    const live = liveTicketByOrder.get(String(order?.id));
    if (live) {
      navigate(`/tickets?id=${live.id}`);
      return;
    }
    setSupportModal({ isOpen: true, order });
  };

  const closeSupportModal = () => {
    if (supportSubmitting) return;
    setSupportModal({ isOpen: false, order: null });
  };

  // Called by QuerySheet, which owns the form and has already validated it and uploaded any
  // photos — `attachments` arrives as [{ url, public_id }]. No category: the form no longer
  // asks for one and the server defaults it.
  const submitSupportTicket = async ({ message, phone, attachments }) => {
    const order = supportModal.order;
    if (!order?.id) return;

    setSupportSubmitting(true);
    try {
      const response = await api.post("/api/support/tickets", {
        orderId: order.id,
        message,
        phone,
        attachments,
      });
      showNotification(response.data?.message || "Your query has been raised.", "success");
      setSupportModal({ isOpen: false, order: null });
      fetchTickets();
      if (response.data?.ticket?.id) navigate(`/tickets?id=${response.data.ticket.id}`);
    } catch (err) {
      // 409 = a query already exists for this order (raised on another tab/device). Take the
      // customer to that conversation rather than leaving them staring at an error.
      const existing = err?.response?.status === 409 ? err.response.data?.ticket : null;
      showNotification(
        err?.response?.data?.message || "Unable to raise your query right now.",
        existing ? "warning" : "error",
      );
      if (existing?.id) {
        setSupportModal({ isOpen: false, order: null });
        fetchTickets();
        navigate(`/tickets?id=${existing.id}`);
      }
    } finally {
      setSupportSubmitting(false);
    }
  };

  const handleActionTrigger = ({ type, orderId, itemId = null, itemName }) => {
    let defaultReason = "";
    if (type === "cancel_return") defaultReason = CANCEL_RETURN_REASONS[0];
    else if (type === "cancel_exchange") defaultReason = CANCEL_EXCHANGE_REASONS[0];
    else if (type.startsWith("cancel")) defaultReason = CANCEL_REASONS[0];
    else if (type === "return") defaultReason = RETURN_REASONS[0];
    else if (type === "exchange") defaultReason = EXCHANGE_REASONS[0];

    setActionModal({
      isOpen: true,
      type,
      orderId,
      itemId,
      itemName
    });
    setActionForm({
      reason: defaultReason,
      comments: ""
    });
  };

  const handleFeedbackTrigger = (order, item) => {
    if (!canReviewOrderItem(order, item)) {
      showNotification("Product review is available after delivery.", "warning");
      return;
    }
    const productName = item.product_name || `Product #${item.product_id}`;
    setFeedbackModal({ isOpen: true, order, item, productName });
    setFeedbackForm({
      rating: Number(item.feedback?.rating || 5),
      title: item.feedback?.title || "",
      comment: item.feedback?.comment || "",
      images: [],
    });
  };

  const closeFeedbackModal = () => {
    if (feedbackSubmitting) return;
    setFeedbackModal({ isOpen: false, order: null, item: null, productName: "" });
    setFeedbackForm({ rating: 5, title: "", comment: "", images: [] });
    setFeedbackSubmitLabel("");
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    const { order, item } = feedbackModal;
    if (!order?.id || !item?.id) return;
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
      fetchOrders();
    } catch (err) {
      showNotification(err?.response?.data?.message || "Could not submit review right now.", "error");
    } finally {
      setFeedbackSubmitting(false);
      setFeedbackSubmitLabel("");
    }
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setModalSubmitLoading(true);
    const { type, orderId } = actionModal;
    const finalReason = actionForm.comments.trim() 
      ? `${actionForm.reason} - ${actionForm.comments.trim()}`
      : actionForm.reason;

    try {
      if (type === "cancel_order") {
        // Whole-order cancellation — the backend restocks, reverses the ledger
        // and refunds (gateway + wallet) for prepaid; COD is simply cancelled.
        const response = await api.post(`/api/orders/${orderId}/cancel`, { reason: finalReason });
        showNotification(response.data?.refund_message || response.data?.message || "Order cancelled successfully.", "success");
      } else if (type === "return") {
        const response = await api.post("/api/shiprocket/create-return", { orderId, reason: finalReason });
        showNotification(response.data?.refund_message || "Return request submitted successfully.", "success");
      } else if (type === "exchange") {
        const response = await api.post("/api/shiprocket/create-exchange", { orderId, reason: finalReason });
        showNotification(response.data?.exchange_message || "Exchange request submitted successfully.", "success");
      } else if (type === "cancel_return") {
        await api.post("/api/shiprocket/cancel-return", { orderId, reason: finalReason });
        showNotification("Return request cancelled successfully.", "success");
      } else if (type === "cancel_exchange") {
        await api.post("/api/shiprocket/cancel-exchange", { orderId, reason: finalReason });
        showNotification("Exchange request cancelled successfully.", "success");
      }
      setActionModal({ isOpen: false, type: "cancel_order", orderId: null, itemId: null, itemName: "" });
      fetchOrders();
    } catch (err) {
      showNotification(err?.response?.data?.message || err.message || "Unable to process request.", "error");
    } finally {
      setModalSubmitLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      navigate("/login?refresh=my-orders");
      return;
    }
    fetchOrders();
    fetchTickets();
  }, [user, navigate, fetchOrders, fetchTickets]);

  const openFilterModal = () => {
    setDraftFilter(selectedFilter);
    setFilterOpen(true);
  };

  const applyFilter = () => {
    setSelectedFilter(draftFilter);
    setFilterOpen(false);
  };

  const clearFilter = () => {
    setDraftFilter("all");
    setSelectedFilter("all");
    setFilterOpen(false);
  };

  return (
    <div className="my-orders-page">
      <section className="orders-hero orders-hero--compact">
        <div className="orders-hero-content">
          <h1>My Orders</h1>
          <span>Track, manage and view all your orders</span>
        </div>
      </section>

      <main className="orders-container">
        {!loading && !error && orders.length > 0 && (
          <div className="orders-search-row">
            <label>
              <Icon icon="lucide:search" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by product name or order number"
              />
              {searchQuery && (
                <button type="button" className="orders-search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">
                  <Icon icon="lucide:x" />
                </button>
              )}
            </label>
            <button type="button" onClick={openFilterModal}>
              <Icon icon="lucide:list-filter" />
              {/* "all" is the absence of a filter, so the button says what it DOES rather
                  than echoing a selection — "All" read like a state that had been chosen.
                  Once a real filter is on, its name replaces this so the list never looks
                  short for no visible reason. "All" stays a choice inside the sheet. */}
              {selectedFilter === "all"
                ? "Filters"
                : FILTER_OPTIONS.find((item) => item.id === selectedFilter)?.label || "Filters"}
            </button>
          </div>
        )}

        {loading && (
          <div className="orders-loading">
            {[1, 2, 3].map((item) => (
              <div key={item} className="order-skeleton">
                <div className="skel skel-header" />
                <div className="skel skel-product" />
                <div className="skel skel-footer" />
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="orders-error">
            <Icon icon="lucide:wifi-off" />
            <h3>Could not load orders</h3>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} type="button">Try Again</button>
          </div>
        )}
        {!loading && !error && orders.length === 0 && (
          <div className="orders-empty">
            <EmptyStateIcon variant="orders" />
            <h3>No Orders Yet</h3>
            <p>Your orders will appear here once you place your first order.</p>
            <Link to="/collection" className="shop-now-btn"><Icon icon="lucide:sparkles" />Explore Collection</Link>
          </div>
        )}
        {!loading && !error && orders.length > 0 && (
          <div className="orders-list">
            {visibleOrders.length === 0 && searchQuery.trim() ? (
              <>
                <div className="orders-search-no-match">
                  <Icon icon="lucide:search-x" />
                  <p>No orders found for <strong>"{searchQuery.trim()}"</strong></p>
                  <button type="button" onClick={() => setSearchQuery("")}>Clear search</button>
                </div>
                {filteredOrders.length > 0 && (
                  <>
                    <p className="orders-search-showing-all">Showing all {selectedFilter !== "all" ? `${FILTER_OPTIONS.find(f => f.id === selectedFilter)?.label} ` : ""}orders:</p>
                    {filteredOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        ticket={liveTicketByOrder.get(String(order.id))}
                        orderTickets={ticketsByOrder.get(String(order.id))}
                        onViewTicket={(t) => navigate(`/tickets?id=${t.id}`)}
                        onFeedback={handleFeedbackTrigger}
                        onContact={openSupportModal}
                        onNotify={showNotification}
                      />
                    ))}
                  </>
                )}
              </>
            ) : visibleOrders.length === 0 && selectedFilter !== "all" ? (
              <>
                <div className="orders-search-no-match">
                  <Icon icon="lucide:filter-x" />
                  <p>No <strong>{FILTER_OPTIONS.find(f => f.id === selectedFilter)?.label}</strong> orders found</p>
                  <button type="button" onClick={clearFilter}>Clear filter</button>
                </div>
                {orders.length > 0 && (
                  <>
                    <p className="orders-search-showing-all">Showing all orders:</p>
                    {orders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        ticket={liveTicketByOrder.get(String(order.id))}
                        orderTickets={ticketsByOrder.get(String(order.id))}
                        onViewTicket={(t) => navigate(`/tickets?id=${t.id}`)}
                        onFeedback={handleFeedbackTrigger}
                        onContact={openSupportModal}
                        onNotify={showNotification}
                      />
                    ))}
                  </>
                )}
              </>
            ) : (
              visibleOrders.map((order) => (
                <OrderCard
                        key={order.id}
                        order={order}
                        ticket={liveTicketByOrder.get(String(order.id))}
                        orderTickets={ticketsByOrder.get(String(order.id))}
                        onViewTicket={(t) => navigate(`/tickets?id=${t.id}`)}
                        onFeedback={handleFeedbackTrigger}
                        onContact={openSupportModal}
                        onNotify={showNotification}
                      />
              ))
            )}
          </div>
        )}
      </main>

      {filterOpen && (
        <div className="orders-filter-overlay" role="dialog" aria-modal="true" onClick={() => setFilterOpen(false)}>
          <div className="orders-filter-sheet" onClick={(event) => event.stopPropagation()}>
            <span className="orders-filter-handle" />
            <div className="orders-filter-head">
              <h2>Filter orders</h2>
              <button type="button" onClick={() => setFilterOpen(false)} aria-label="Close filters">
                <Icon icon="lucide:x" />
              </button>
            </div>
            <div className="orders-filter-options">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={draftFilter === option.id ? "active" : ""}
                  onClick={() => setDraftFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="orders-filter-actions">
              <button type="button" onClick={clearFilter}>Clear</button>
              <button type="button" onClick={applyFilter}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {supportModal.isOpen && (
        <QuerySheet
          orderNumber={getOrderDisplayNumber(supportModal.order)}
          defaultPhone={user?.phone || ""}
          submitting={supportSubmitting}
          onClose={closeSupportModal}
          onNotify={showNotification}
          onSubmit={submitSupportTicket}
        />
      )}

      {feedbackModal.isOpen && (
        // Bottom sheet: rating a delivered saree is a thumb action from a list of orders,
        // so it belongs under the thumb like every other sheet on this page.
        <div className="cancel-modal-overlay mo-sheet-overlay" onClick={closeFeedbackModal}>
          <div
            className="cancel-modal-container feedback-modal-container mo-sheet-container"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="mo-sheet-handle" aria-hidden="true" />
            <button type="button" className="cancel-modal-close" onClick={closeFeedbackModal} disabled={feedbackSubmitting}>
              <Icon icon="lucide:x" />
            </button>
            <div className="cancel-modal-header">
              <h3>Complete your Feedback</h3>
              <p>Rate <strong>{feedbackModal.productName}</strong> from your delivered order.</p>
            </div>

            <form className="cancel-modal-form" onSubmit={submitFeedback}>
              <div className="form-group">
                <label>Product Rating</label>
                <ReviewStars
                  rating={feedbackForm.rating}
                  onSelect={(rating) => setFeedbackForm((current) => ({ ...current, rating }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="feedback-title">Short title (optional)</label>
                <input
                  id="feedback-title"
                  type="text"
                  value={feedbackForm.title}
                  maxLength={120}
                  onChange={(event) => setFeedbackForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Beautiful saree, loved the fabric"
                />
              </div>

              <div className="form-group">
                <label htmlFor="feedback-comment">Product Review</label>
                <textarea
                  id="feedback-comment"
                  required
                  rows={4}
                  value={feedbackForm.comment}
                  onChange={(event) => setFeedbackForm((current) => ({ ...current, comment: event.target.value }))}
                  placeholder="Share what you liked about this product..."
                />
              </div>

              <div className="form-group">
                <label>Upload product photos <small>(optional, up to {MAX_REVIEW_IMAGES})</small></label>
                <ReviewImagePicker
                  files={feedbackForm.images}
                  disabled={feedbackSubmitting}
                  onChange={(images) => setFeedbackForm((current) => ({ ...current, images }))}
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

      {actionModal.isOpen && (() => {
        const type = actionModal.type;
        const isReturn = type === "return";
        const isExchange = type === "exchange";
        const isCancelReturn = type === "cancel_return";
        const isCancelExchange = type === "cancel_exchange";

        const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

        const currentOrder = orders.find((o) => String(o.id) === String(actionModal.orderId));
        const bd = currentOrder ? getOrderBreakdown(currentOrder) : null;
        const isCod = bd && String(bd.paymentMethod).toUpperCase() === "COD";

        let refundInfo = null;
        if (bd && type === "cancel_order") {
          // Whole-order cancel: prepaid refunds everything paid (gateway) plus
          // wallet money back to the wallet; COD has nothing to refund.
          refundInfo = {
            rows: [
              ...(bd.payable > 0 ? [{ label: "Paid via payment", value: fmt(bd.payable) }] : []),
              ...(bd.walletAmount > 0 ? [{ label: "Wallet used", value: fmt(bd.walletAmount) }] : []),
            ],
            total: isCod ? 0 : bd.payable + bd.walletAmount,
            walletRefund: isCod ? 0 : bd.walletAmount,
            gatewayRefund: isCod ? 0 : bd.payable,
            isCod,
          };
        }

        let modalTitle = "Confirm Cancellation";
        let subTextPrefix = "Please specify reason for cancelling";
        let btnText = "Confirm Cancellation";
        let btnClass = "modal-action-btn danger";
        let dropdownOptions = CANCEL_REASONS;

        if (isReturn) {
          modalTitle = "Request Return";
          subTextPrefix = "Please specify reason for returning";
          btnText = "Submit Return Request";
          btnClass = "modal-action-btn primary";
          dropdownOptions = RETURN_REASONS;
        } else if (isExchange) {
          modalTitle = "Request Exchange";
          subTextPrefix = "Please specify reason for exchanging";
          btnText = "Submit Exchange Request";
          btnClass = "modal-action-btn primary";
          dropdownOptions = EXCHANGE_REASONS;
        } else if (isCancelReturn) {
          modalTitle = "Cancel Return Request";
          subTextPrefix = "Please specify reason for cancelling return";
          btnText = "Cancel Return Request";
          btnClass = "modal-action-btn danger";
          dropdownOptions = CANCEL_RETURN_REASONS;
        } else if (isCancelExchange) {
          modalTitle = "Cancel Exchange Request";
          subTextPrefix = "Please specify reason for cancelling exchange";
          btnText = "Cancel Exchange Request";
          btnClass = "modal-action-btn danger";
          dropdownOptions = CANCEL_EXCHANGE_REASONS;
        }

        return (
          <div className="cancel-modal-overlay">
            <div className="cancel-modal-container">
              <button 
                type="button"
                className="cancel-modal-close" 
                onClick={() => setActionModal({ isOpen: false, type: "cancel_order", orderId: null, itemId: null, itemName: "" })}
              >
                <Icon icon="lucide:x" />
              </button>
              <div className="cancel-modal-header">
                <h3>{modalTitle}</h3>
                <p>{subTextPrefix} <strong>{actionModal.itemName}</strong></p>
              </div>
              
              {refundInfo && (
                <div className="cancel-refund-box">
                  <p className="cancel-refund-title">Refund summary</p>
                  {refundInfo.isCod ? (
                    <p className="cancel-refund-note">This is a Cash on Delivery order — no online refund applicable.</p>
                  ) : (
                    <>
                      {refundInfo.rows.map((row, i) => (
                        <div key={i} className="cancel-refund-row">
                          <span>{row.label}</span>
                          <span>{row.value}</span>
                        </div>
                      ))}
                      <div className="cancel-refund-total">
                        <span>{refundInfo.isEstimate ? "Estimated refund" : "Total refund"}</span>
                        <strong>{fmt(refundInfo.total)}</strong>
                      </div>
                      <div className="cancel-refund-mode">
                        {refundInfo.walletRefund > 0 && refundInfo.gatewayRefund > 0
                          ? `${fmt(refundInfo.gatewayRefund)} to original payment · ${fmt(refundInfo.walletRefund)} to wallet`
                          : refundInfo.walletRefund > 0
                          ? "Credited back to your wallet"
                          : "Refunded to original payment method"}
                        {refundInfo.isEstimate && <span className="cancel-refund-approx"> · Exact amount may vary</span>}
                      </div>
                    </>
                  )}
                </div>
              )}

              <form onSubmit={handleModalSubmit} className="cancel-modal-form">
                <div className="form-group">
                  <label htmlFor="action-reason">Select Reason</label>
                  <select 
                    id="action-reason" 
                    value={actionForm.reason} 
                    onChange={(e) => setActionForm(prev => ({ ...prev, reason: e.target.value }))}
                    required
                  >
                    {dropdownOptions.map((r, i) => (
                      <option key={i} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="action-comments">Additional Comments (Optional)</label>
                  <textarea
                    id="action-comments"
                    placeholder="You can provide additional details here to help us process your request better."
                    value={actionForm.comments}
                    onChange={(e) => setActionForm(prev => ({ ...prev, comments: e.target.value }))}
                    rows={4}
                  />
                </div>

                <div className="modal-actions">
                  <button 
                    type="button" 
                    className="modal-action-btn secondary"
                    onClick={() => setActionModal({ isOpen: false, type: "cancel_order", orderId: null, itemId: null, itemName: "" })}
                    disabled={modalSubmitLoading}
                  >
                    Go Back
                  </button>
                  <button 
                    type="submit" 
                    className={btnClass}
                    disabled={modalSubmitLoading}
                  >
                    {modalSubmitLoading ? "Processing..." : btnText}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

