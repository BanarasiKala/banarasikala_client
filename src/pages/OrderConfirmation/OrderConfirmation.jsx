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
import "./OrderConfirmation.css";

const PLATFORM_FEE_AMOUNT = numberEnv("VITE_PLATFORM_FEE_AMOUNT");

const toNumber = (value) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const formatPrice = (value) => `₹${toNumber(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const shippingCharge = toNumber(order.shipping_charge);
  const shippingDiscount = toNumber(order.shipping_discount);
  const paymentFee = toNumber(order.payment_fee);
  const isCod = String(order.payment_method || "").toUpperCase() === "COD";
  const storedPlatformFee = toNumber(order.platform_fee);
  const storedCodFee = toNumber(order.cod_fee);
  const platformFee = storedPlatformFee || (paymentFee > 0 ? Math.min(PLATFORM_FEE_AMOUNT, paymentFee) : 0);
  const codFee = storedCodFee || (isCod ? Math.max(0, paymentFee - platformFee) : 0);
  const paymentDiscount = toNumber(order.payment_discount);
  const couponDiscount = toNumber(order.discount_amount);
  const walletAmount = toNumber(order.wallet_amount);
  const payable = toNumber(order.payable_amount) || toNumber(order.total_amount) || Math.max(
    0,
    subtotal + shippingCharge + paymentFee - shippingDiscount - paymentDiscount - couponDiscount - walletAmount,
  );

  return { subtotal, shippingCharge, shippingDiscount, paymentFee, platformFee, codFee, paymentDiscount, couponDiscount, walletAmount, payable };
};

// An order can be cancelled (whole order only — no item-level changes) while it
// is still pre-dispatch — pending / processing / AWB assigned — and within 24
// hours of placement. Mirror of CANCELLABLE_STATUSES in OrderController on the
// backend.
const CANCELLABLE_STATUSES = ["pending", "processing", "order placed", "order_placed", "awb assigned", "awb_assigned"];
const canCancelOrder = (order) => {
  const rawDate = order?.createdAt || order?.created_at;
  const status = String(order?.status || "").toLowerCase();
  if (!rawDate || !CANCELLABLE_STATUSES.includes(status)) return false;
  const createdAt = new Date(rawDate).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt <= 24 * 60 * 60 * 1000;
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
  if (normalized.includes("exchange completed")) return "Exchange completed";
  if (normalized.includes("exchange picked up")) return "Exchange picked up";
  if (normalized.includes("exchange pickup scheduled")) return "Exchange pickup scheduled";
  if (normalized.includes("exchange initiated") || normalized.includes("exchange requested")) return "Exchange initiated";
  if (normalized === "undelivered") return "Delivery attempt failed";
  if (normalized === "delivered") return "Delivered";
  if (normalized === "out for delivery" || normalized === "out_for_delivery") return "Out for delivery";
  if (normalized === "shipped" || normalized.includes("in transit") || normalized.includes("manifest")) return "Shipped";
  if (normalized === "pickup scheduled" || normalized === "pickup_scheduled") return "Pickup scheduled";
  if (normalized === "out for pickup" || normalized === "out_for_pickup") return "Courier out for pickup";
  if (normalized === "picked up" || normalized === "picked_up" || normalized.includes("pickup") || normalized === "awb assigned" || normalized === "awb_assigned") return "Picked up";
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

// Keep in sync with OrderReturnService.RETURN_WINDOW_DAYS on the backend.
const RETURN_WINDOW_DAYS = 7;
const withinReturnWindow = (order) => {
  if (!order?.delivered_at) return false;
  const lastDate = new Date(order.delivered_at);
  lastDate.setDate(lastDate.getDate() + RETURN_WINDOW_DAYS);
  return Date.now() <= lastDate.getTime();
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

const getItemDisplayStatus = (order, item) => {
  const status = normalizeStatus(item?.status);
  if (status && status !== "active") return getCustomerOrderStatusLabel(item.status);
  // Return/exchange flows are item-scoped: an untouched (Active) item must not
  // inherit the order's reverse status — it simply stays delivered.
  const orderStatus = normalizeStatus(order?.status);
  if (orderStatus.includes("return") || orderStatus.includes("exchange")) return "Delivered";
  return getCustomerOrderStatusLabel(order?.status);
};

const getActionLabel = (action) => {
  const type = String(action?.action_type || "").toLowerCase();
  if (type === "return") return "Return";
  if (type === "exchange") return "Exchange";
  if (type === "cancel") return "Cancellation";
  return "Request";
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

// Status-driven steps for the Return / Exchange panel — shown from the moment
// a request exists until live pickup scans take over.
const buildReverseStatusTimeline = (order) => {
  const status = String(order?.status || "").toLowerCase();

  const returnSteps = [
    { title: "Return initiated", detail: "Return request created", icon: "lucide:rotate-ccw", matches: ["return requested", "return initiated"] },
    { title: "Out for return pickup", detail: "Courier will collect the parcel", icon: "lucide:navigation", matches: ["out for return pickup", "return pickup scheduled"] },
    { title: "Return picked up", detail: "Parcel collected by courier", icon: "lucide:package-check", matches: ["return picked up", "return shipped"] },
    { title: "Return completed", detail: order?.refund_note || "Return completed", icon: "lucide:badge-check", matches: ["return completed", "return delivered"] },
  ];

  const exchangeSteps = [
    { title: "Exchange initiated", detail: "Exchange request created", icon: "lucide:repeat-2", matches: ["exchange requested", "exchange initiated"] },
    { title: "Exchange pickup scheduled", detail: "Courier pickup is being arranged", icon: "lucide:calendar-clock", matches: ["exchange pickup scheduled", "out for exchange pickup"] },
    { title: "Exchange picked up", detail: "Exchange parcel collected", icon: "lucide:package-check", matches: ["exchange picked up", "exchange shipped"] },
    { title: "Exchange completed", detail: order?.refund_note || "Exchange completed", icon: "lucide:badge-check", matches: ["exchange completed", "exchange delivered"] },
  ];

  if (status.includes("exchange")) return buildSteps(status, exchangeSteps);
  if (status.includes("return")) return buildSteps(status, returnSteps);
  return [];
};

// Shared renderer for the Return / Exchange panel timelines (status steps or
// live courier scans).
const ReverseStepsTimeline = ({ steps }) => (
  <div className="confirmation-timeline">
    {steps.map((step, index) => (
      <div key={`${step.title}-${index}`} className={`confirmation-step is-${step.state || "pending"}`}>
        <div className="confirmation-step-track">
          <span className="confirmation-step-icon">
            {step.state === "done" ? <Icon icon="lucide:check" /> : <Icon icon={step.icon} />}
          </span>
          {index < steps.length - 1 && <div className="confirmation-step-line" />}
        </div>
        <div className="confirmation-step-body">
          <strong>{step.title}</strong>
          <p>{step.detail}</p>
        </div>
      </div>
    ))}
  </div>
);

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
    { title: "Pickup scheduled", detail: "Courier pickup has been arranged", icon: "lucide:calendar-clock", matches: ["pickup scheduled", "pickup_scheduled", "out for pickup", "out_for_pickup"] },
    { title: "Picked up", detail: "Courier has collected your order", icon: "lucide:package-check", matches: ["picked up", "picked_up", "awb assigned", "awb_assigned"] },
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
    <section className="order-success-hero">
      <div className="oc-sk oc-sk-hero-icon" />
      <div style={{ display: "grid", gap: 6 }}>
        <SkLine w={70} h={10} />
        <SkLine w={200} h={22} />
        <SkLine w={300} h={11} />
      </div>
    </section>

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

  const breakdown = useMemo(() => getBreakdown(order || {}), [order]);
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
  const trackUrl = tracking?.tracking?.tracking_data?.track_url
    || (order?.shiprocket_awb ? `https://shiprocket.co/tracking/${order.shiprocket_awb}` : "");
  const reverseShipments = Array.isArray(tracking?.reverse) ? tracking.reverse : [];
  // Status-driven return/exchange steps for the panel below the shipment
  // timeline (used until live pickup scans arrive).
  const reverseStatusSteps = useMemo(() => buildReverseStatusTimeline(order), [order]);
  const refunds = Array.isArray(order?.refunds) ? order.refunds : [];
  const totalRefunded = refunds
    .filter((r) => isRefundSettled(r.status))
    .reduce((sum, r) => sum + toNumber(r.amount), 0);
  const orderActions = useMemo(() => getOrderActions(order), [order]);
  // RTO (order returned to seller). Prepaid parcels wait for the customer to
  // choose "pay to re-dispatch" or "refund"; COD parcels are terminal (the
  // account is COD-blocked and can only reorder prepaid).
  const rtoAction = order?.rto_action || null;
  const rtoAwaiting = Boolean(rtoAction?.awaiting)
    && String(rtoAction?.payment_method || "").toUpperCase() !== "COD";
  const rtoCodBlocked = rtoAction?.resolution === "PRODUCT_RETURNED_COD_BLOCKED";
  // The refund covers the customer's whole contribution — gateway money paid
  // plus any wallet credit spent — minus the forward + RTO charges kept. The
  // wallet-paid share is returned to the wallet, the remainder to the gateway.
  const rtoWalletPaid = toNumber(order?.wallet_amount);
  const rtoContribution = toNumber(order?.amount_paid) + rtoWalletPaid;
  const rtoRefundEstimate = Math.max(0, rtoContribution - toNumber(rtoAction?.redispatch_fee));
  const canSelectReturnItems = useMemo(() => getEligibleActionItems(order, "return").length > 0, [order]);
  const canSelectExchangeItems = useMemo(() => getEligibleActionItems(order, "exchange").length > 0, [order]);
  const orderNumber = getOrderDisplayNumber(order);
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
    .map(([id, value]) => ({ orderItemId: Number(id), quantity: value.quantity || null })), [cancelModal.selected]);

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
      <section className="order-success-hero">
        <span className="order-success-icon"><Icon icon="lucide:check" /></span>
        <div>
          <p>Order confirmed</p>
          <h1>Order {orderNumber}</h1>
          <span>Placed on {formatDate(order.createdAt)}</span>
        </div>
      </section>

      <section className="order-confirmation-grid">
        <div className="order-confirmation-main">
          <section className="order-panel">
            <div className="order-panel-head">
              <h2>{hasLiveTracking ? "Live tracking" : "Shipment timeline"}</h2>
              <div className="order-track-head-right">
                <span>{getCustomerOrderStatusLabel(order.status)}</span>
                {(order.shiprocket_awb || order.shiprocket_order_id) && (
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

            {!order.shiprocket_awb && (
              <div className="order-track-pending">
                <Icon icon="lucide:package-search" />
                <span>
                  {hasLiveTracking
                    ? "Live tracking is now available."
                    : "Your order is being prepared. Live tracking will appear here once the courier picks it up and an AWB is generated."}
                </span>
              </div>
            )}

            <div className="confirmation-timeline">
              {timeline.map((step, index) => (
                <div key={`${step.title}-${index}`} className={`confirmation-step is-${step.state || "pending"}`}>
                  <div className="confirmation-step-track">
                    <span className="confirmation-step-icon">
                      {step.state === "done" ? <Icon icon="lucide:check" /> : <Icon icon={step.icon} />}
                    </span>
                    {index < timeline.length - 1 && <div className="confirmation-step-line" />}
                  </div>
                  <div className="confirmation-step-body">
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {order.shiprocket_awb && (
              <div className="awb-strip">
                <span className="awb-strip-info">
                  <small>AWB{courierName ? ` · ${courierName}` : ""}</small>
                  <strong>{order.shiprocket_awb}</strong>
                </span>
                {trackUrl && (
                  <a className="awb-track-link" href={trackUrl} target="_blank" rel="noopener noreferrer">
                    Track on courier <Icon icon="lucide:external-link" />
                  </a>
                )}
              </div>
            )}
          </section>

          {rtoAwaiting && (
            <section className="order-panel rto-panel">
              <div className="rto-panel-head">
                <span className="rto-panel-icon"><Icon icon="lucide:package-x" /></span>
                <div>
                  <h2>Your order came back to us</h2>
                  <p>The courier couldn&rsquo;t deliver this parcel and it has returned to our warehouse. Choose what you&rsquo;d like to do next.</p>
                </div>
              </div>

              <div className="rto-options">
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
                  <button
                    type="button"
                    className="rto-btn rto-btn-primary"
                    onClick={handleRtoRedispatch}
                    disabled={Boolean(rtoLoading)}
                  >
                    {rtoLoading === "redispatch" ? "Opening payment…" : `Pay ${formatPrice(rtoAction.redispatch_fee)} & re-dispatch`}
                  </button>
                </div>

                <div className="rto-option">
                  <div className="rto-option-head">
                    <Icon icon="lucide:rotate-ccw" />
                    <strong>Refund me instead</strong>
                  </div>
                  <p>We&rsquo;ll refund what you paid, after deducting the forward &amp; return shipping already spent on this parcel.</p>
                  <ul className="rto-fee-lines">
                    <li><span>Amount paid</span><strong>{formatPrice(order.amount_paid)}</strong></li>
                    {rtoWalletPaid > 0 && (
                      <li><span>Wallet used</span><strong>{formatPrice(rtoWalletPaid)}</strong></li>
                    )}
                    <li><span>Less forward + RTO charges</span><strong>-{formatPrice(rtoAction.redispatch_fee)}</strong></li>
                    <li className="rto-fee-total"><span>Estimated refund</span><strong>{formatPrice(rtoRefundEstimate)}</strong></li>
                  </ul>
                  {rtoWalletPaid > 0 && (
                    <p className="rto-wallet-hint">
                      <Icon icon="lucide:wallet" /> Your wallet-paid share is returned to your wallet; the rest to your original payment method.
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

          {(reverseShipments.length > 0 || reverseStatusSteps.length > 0) && (
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
                  const steps = buildReverseActivities(shipment);
                  const label = shipment.type === "exchange" ? "Exchange pickup" : "Return pickup";
                  return (
                    <div key={`${shipment.awb || shipment.type}-${shipmentIndex}`} className="reverse-shipment">
                      <div className="reverse-shipment-head">
                        <strong>{label}</strong>
                        {shipment.awb && <small>AWB · {shipment.awb}</small>}
                      </div>
                      {steps.length > 0 ? (
                        <ReverseStepsTimeline steps={steps} />
                      ) : reverseStatusSteps.length > 0 ? (
                        <ReverseStepsTimeline steps={reverseStatusSteps} />
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
                <div className="reverse-shipment">
                  <ReverseStepsTimeline steps={reverseStatusSteps} />
                </div>
              )}
            </section>
          )}

          <section className="order-panel">
            <div className="order-panel-head">
              <h2>Items</h2>
              <span>{(order.OrderItems || []).length} item(s)</span>
            </div>
            <div className="confirmation-items">
              {(order.OrderItems || []).map((item, index) => {
                const productUrl = item.product_slug ? `/product/${item.product_slug}` : null;
                const itemRating = Number(item.feedback?.rating || 0);
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
                      {productUrl ? <Link to={productUrl} className="confirmation-product-link"><h3>{item.product_name}</h3></Link> : <h3>{item.product_name}</h3>}
                      <p>{getItemColor(item)}</p>
                      {(() => {
                        const cancelledQty = toNumber(item.cancelled_quantity);
                        const activeQty = Math.max(0, toNumber(item.quantity) - cancelledQty);
                        return (
                          <p>
                            Qty {activeQty}
                            {cancelledQty > 0 ? ` · ${cancelledQty} cancelled` : ""}
                            {item.sku ? ` - SKU: ${item.sku}` : ""}
                          </p>
                        );
                      })()}
                      <span className="confirmation-item-status">{getItemDisplayStatus(order, item)}</span>
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
                          <strong>{action.status || "Initiated"}</strong>
                          <small>
                            Qty {action.quantity || 1}
                            {action.completed_at
                              ? ` · Completed ${formatDate(action.completed_at)}`
                              : action.created_at ? ` · ${formatDate(action.created_at)}` : ""}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                  <strong>{formatPrice(toNumber(item.price) * Math.max(0, toNumber(item.quantity) - toNumber(item.cancelled_quantity)))}</strong>
                </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="order-confirmation-side">
          <section className="order-panel">
            <h2>Payment summary</h2>
            <div className="summary-row"><span>Product total</span><strong>{formatPrice(breakdown.subtotal)}</strong></div>
            <div className="summary-row">
              <span>Delivery charge</span>
              <strong>
                {breakdown.shippingDiscount >= breakdown.shippingCharge && breakdown.shippingCharge > 0 ? (
                  <><span className="summary-strike">{formatPrice(breakdown.shippingCharge)}</span> Free</>
                ) : formatPrice(Math.max(0, breakdown.shippingCharge - breakdown.shippingDiscount))}
              </strong>
            </div>
            {breakdown.paymentDiscount > 0 && <div className="summary-row is-saving"><span>Payment discount</span><strong>-{formatPrice(breakdown.paymentDiscount)}</strong></div>}
            {breakdown.codFee > 0 && <div className="summary-row"><span>COD charge</span><strong>{formatPrice(breakdown.codFee)}</strong></div>}
            {breakdown.platformFee > 0 && <div className="summary-row"><span>Platform fee</span><strong>{formatPrice(breakdown.platformFee)}</strong></div>}
            {breakdown.couponDiscount > 0 && <div className="summary-row is-saving"><span>Coupon{order.coupon_code ? ` (${order.coupon_code})` : ""}</span><strong>-{formatPrice(breakdown.couponDiscount)}</strong></div>}
            {breakdown.walletAmount > 0 && <div className="summary-row is-saving"><span>Wallet used</span><strong>-{formatPrice(breakdown.walletAmount)}</strong></div>}
            <div className="summary-row is-final"><span>Final amount</span><strong>{formatPrice(breakdown.payable)}</strong></div>
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
                        <strong>{formatPrice(r.amount)}</strong>
                      </div>
                      {bd && (
                        <div className="refund-ledger-breakdown">
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
                        </div>
                      )}
                    </div>
                  );
                })}
                {totalRefunded > 0 && (
                  <div className="refund-ledger-row refund-ledger-total">
                    <span>Total refunded</span>
                    <strong>{formatPrice(totalRefunded)}</strong>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="order-panel">
            <div className="order-panel-head-row">
              <h2>Delivery address</h2>
            </div>
            <p className="address-copy">{order.customer_name}<br />{order.address}<br />{order.city}, {order.state} - {order.pincode}<br />Phone: {order.phone}</p>
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

          {Object.values(orderActions).some(Boolean) && (
            <div className="order-action-list order-action-list-standalone">
              {orderActions.canCancel && (
                <>
                  <button className="cancel-order-btn" type="button" onClick={() => openActionModal("cancel")}>
                    Cancel order
                  </button>
                  {(() => {
                    const rawDate = order.createdAt || order.created_at;
                    if (!rawDate) return null;
                    const remaining = 24 * 60 * 60 * 1000 - (Date.now() - new Date(rawDate).getTime());
                    if (remaining <= 0) return null;
                    const hrs = Math.floor(remaining / (1000 * 60 * 60));
                    const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                    const label = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                    return <p className="cancel-window-info"><Icon icon="lucide:clock" /> {label} left to cancel</p>;
                  })()}
                </>
              )}
              {orderActions.canReturnExchange && (
                <button
                  className="order-secondary-btn"
                  type="button"
                  onClick={() => openActionModal(canSelectReturnItems ? "return" : "exchange")}
                >
                  {canSelectReturnItems && canSelectExchangeItems
                    ? "Return / exchange products"
                    : canSelectReturnItems ? "Return products" : "Exchange products"}
                </button>
              )}
            </div>
          )}

          <Link className="continue-shopping-link" to="/collection">
            <Icon icon="lucide:shopping-bag" />
            Continue shopping
          </Link>
        </aside>
      </section>

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
                This closes your order. We&rsquo;ll refund the amount below
                {rtoWalletPaid > 0
                  ? " — your wallet-paid share to your wallet and the rest to your original payment method."
                  : " to your original payment method."}
              </p>
            </div>
            <ul className="rto-fee-lines rto-confirm-lines">
              <li><span>Amount paid</span><strong>{formatPrice(order.amount_paid)}</strong></li>
              {rtoWalletPaid > 0 && (
                <li><span>Wallet used</span><strong>{formatPrice(rtoWalletPaid)}</strong></li>
              )}
              <li><span>Forward + RTO charges</span><strong>-{formatPrice(rtoAction?.redispatch_fee)}</strong></li>
              <li className="rto-fee-total"><span>You&rsquo;ll receive</span><strong>{formatPrice(rtoRefundEstimate)}</strong></li>
            </ul>
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
                      setCancelModal((current) => ({
                        ...current,
                        selected: {
                          ...current.selected,
                          [item.id]: { ...sel, quantity },
                        },
                      }));
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
                // Whole-order cancel: the refund is simply everything paid.
                // Prepaid → paid amount back to the original payment method and
                // any wallet money back to the wallet. COD → nothing was paid.
                const isCod = String(order?.payment_method || "").toUpperCase() === "COD";
                const paidAmount = toNumber(order.amount_paid) || (isCod ? 0 : breakdown.payable);
                const walletUsed = toNumber(order.wallet_amount);
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
                        <div className="action-estimate-total">
                          <span>Refund to original payment method</span><strong>{formatPrice(paidAmount)}</strong>
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
                return (
                  <div className="action-estimate-box">
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
                    <div className="action-estimate-total">
                      <span>{cancelModal.type === "exchange" ? "Refund" : "Estimated refund"}</span>
                      <strong>{formatPrice(actionEstimate.totals.estimated_refund_amount)}</strong>
                    </div>
                    {cancelModal.type === "return" && (
                      <>
                        {couponInfo && adjustment > 0 && (
                          <p className="action-estimate-note">
                            <Icon icon="lucide:badge-percent" />
                            {couponInfo.original_eligible
                              ? `Your coupon ${couponInfo.original_code} is re-calculated on the items you keep, so only the difference is deducted.`
                              : couponInfo.applied_code
                                ? `The items you keep no longer qualify for ${couponInfo.original_code}, so we applied the best available coupon ${couponInfo.applied_code} to them and deducted only the difference.`
                                : `The items you keep no longer qualify for ${couponInfo.original_code} and no other coupon applies, so the coupon amount is deducted from the refund.`}
                          </p>
                        )}
                        {couponInfo && adjustment <= 0 && (
                          <p className="action-estimate-note">
                            <Icon icon="lucide:badge-percent" />
                            Your coupon {couponInfo.original_code} still applies in full to the items you keep — nothing is deducted.
                          </p>
                        )}
                        {breakdown.walletAmount > 0 && (
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
    </main>
  );
}

