// Shared helpers for turning ShipRocket courier scans into customer-facing tracking steps.
//
// The scan feed is written for the courier's own rulebook — "ReadyForReceive", "UD-Consignee
// unavailable" — with "NA" wherever a scan has no location. Left raw it reads like a log file,
// so both the "Track Your Order" sheet and the Order Confirmation timeline run their scans
// through here to get clean titles, drop meaningless locations, and collapse the duplicate
// scans ShipRocket often emits.

// ShipRocket sends scan timestamps as "YYYY-MM-DD HH:mm:ss" (no timezone) — swap the space for
// "T" so Safari parses it too, not just Chrome.
export const parseScanDate = (value) => {
  if (!value) return null;
  const date = new Date(String(value).includes("T") ? value : String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatTrackDate = (value) => {
  const date = parseScanDate(value);
  if (!date) return value ? String(value) : "";
  const datePart = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const timePart = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase();
  return `${datePart}, ${timePart}`;
};

// ShipRocket writes "NA" (sometimes "N/A", "-", "null") when a scan carries no location. Those
// tokens mean nothing to a customer, so treat them as empty.
export const cleanScanLocation = (value) => {
  const text = String(value ?? "").trim();
  return /^(na|n\/a|-|--|null|undefined)$/i.test(text) ? "" : text;
};

// Raw scan text → friendly title + note. First match wins, so the specific "pickup scheduled"
// family (which includes the raw "ReadyForReceive") MUST be tested before the generic
// pickup/picked rule, or a scheduled pickup would read as "Picked Up". Anything unrecognised
// falls through verbatim rather than being dropped.
const STEP_COPY = [
  { test: /order\s*placed|new\s*order/i, title: "Order Placed", note: "Your order has been placed successfully." },
  { test: /delivered/i, title: "Delivered", note: "Your order has been delivered." },
  { test: /out\s*for\s*delivery/i, title: "Out for Delivery", note: "Your order is out for delivery." },
  { test: /undeliver|consignee\s*unavailable|\bud\b|ud-/i, title: "Delivery Attempted", note: "A delivery was attempted." },
  { test: /rto/i, title: "Returning to Seller", note: "The shipment is on its way back to us." },
  {
    // "ReadyForReceive" / "Ready to ship" / "Manifest generated" / "AWB assigned" all mean the
    // shipment is booked and a pickup is pending — not yet collected.
    test: /ready\s*for\s*receive|ready\s*to\s*ship|manifest|awb\s*assigned|pickup\s*(scheduled|generated|queued|assigned|rescheduled)/i,
    title: "Pickup Scheduled",
    note: "A courier pickup has been scheduled.",
  },
  { test: /out\s*for\s*pickup/i, title: "Out for Pickup", note: "The courier is on the way to collect your parcel." },
  { test: /picked|pickup/i, title: "Picked Up", note: "The courier has collected your parcel." },
  { test: /ship|dispatch|in\s*transit/i, title: "Shipped", note: "Your order has been shipped." },
];

export const describeStep = (raw) => {
  const match = STEP_COPY.find((entry) => entry.test.test(raw || ""));
  return match
    ? { title: match.title, note: match.note }
    : { title: raw || "Shipment update", note: "" };
};

/**
 * Normalise a ShipRocket `shipment_track_activities` array into clean scan objects, collapsing
 * consecutive scans that map to the same friendly title. Order is preserved, so the caller can
 * treat index 0 as whatever end its source used (ShipRocket returns newest-first).
 *
 * Each returned scan: { raw, title, note, location, date }. `location` is already cleaned of
 * "NA"-style tokens.
 */
export const normalizeScans = (activities = []) => {
  const mapped = (Array.isArray(activities) ? activities : []).map((activity) => {
    const raw = activity.activity || activity["sr-status-label"] || "";
    const { title, note } = describeStep(raw);
    return { raw, title, note, location: cleanScanLocation(activity.location), date: activity.date };
  });
  // Drop a scan whose friendly title repeats the one right before it.
  return mapped.filter((scan, index) => index === 0 || scan.title !== mapped[index - 1].title);
};

// ── Status-driven timeline ────────────────────────────────────────────────────────────────
// The customer-facing shipment timeline follows the order's own STATUS, not the courier scan
// feed — a fixed Order placed → Processing → Pickup scheduled → Picked up → Shipped → Out for
// delivery → Delivered hierarchy, with the RTO / cancelled / partial-cancel / replacement
// variants an order can take instead. Shared so every timeline (Order Confirmation page and the
// "Track Your Order" sheet) reads identically and can never drift apart.

export const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const stepState = (status, currentIndex, steps) => {
  // Last matching step wins — a broad early match must not shadow a specific later one (e.g.
  // "rto in transit" contains "in transit", which the Shipped step also matches; the RTO step
  // further down is the real position).
  const matchedIndex = steps.reduce(
    (found, step, index) => (step.matches.some((match) => status.includes(match)) ? index : found),
    -1,
  );
  if (matchedIndex === -1) return currentIndex === 0 ? "current" : "pending";
  if (currentIndex < matchedIndex) return "done";
  if (currentIndex === matchedIndex) return "current";
  return "pending";
};

export const buildSteps = (status, steps) => steps.map((step, index) => ({
  ...step,
  state: stepState(status, index, steps),
}));

/**
 * @param {object} order
 * @param {object} [options]
 * @param {string} [options.edd]  The courier's estimated delivery date, straight from the
 *   tracking payload (shipment_track[0].edd). Nothing on the order records one — it only
 *   exists once a shipment is booked — so the caller passes it in when it has it.
 */
export const buildOrderTimeline = (order, { edd, courierName } = {}) => {
  const status = String(order?.status || "Pending").toLowerCase();
  /**
   * The Delivered step's detail line.
   *
   *   delivered      -> the date it actually arrived
   *   still coming   -> the date it is expected
   *   neither known  -> a plain sentence, never a courier's internal wording
   *
   * It used to read "Final delivery scan pending", which describes OUR view of the courier's
   * feed rather than anything the customer wanted to know. They opened this to find out when
   * the saree arrives; the estimate is that answer, and it is available the whole time the
   * parcel is in transit.
   */
  const deliveredDetail = (() => {
    if (order?.delivered_at) return formatDate(order.delivered_at);
    const estimate = formatDate(parseScanDate(edd) || edd);
    return estimate ? `Expected by ${estimate}` : "Arriving soon";
  })();

  const forwardSteps = [
    { title: "Order placed", detail: formatDate(order?.createdAt), icon: "lucide:check-circle-2", matches: ["pending", "order placed"] },
    { title: "Processing", detail: "Seller is preparing your order", icon: "lucide:package-2", matches: ["processing"] },
    { title: "Pickup scheduled", detail: "Courier pickup has been arranged", icon: "lucide:calendar-clock", matches: ["pickup scheduled", "pickup_scheduled", "awb assigned", "awb_assigned", "out for pickup", "out_for_pickup"] },
    { title: "Picked up", detail: "Courier has collected your order", icon: "lucide:package-check", matches: ["picked up", "picked_up"] },
    // `sub` is the courier, printed on its own line beneath the tracking number. It only
    // appears once there is an AWB to sit under — naming a courier while the detail line
    // still reads "Tracking appears after dispatch" would be announcing a booking that
    // has not happened yet.
    {
      title: "Shipped",
      detail: order?.shiprocket_awb ? `Tracking ID (AWB): ${order.shiprocket_awb}` : "Tracking appears after dispatch",
      sub: order?.shiprocket_awb && courierName ? courierName : null,
      icon: "lucide:truck",
      matches: ["shipped", "in transit"],
    },
    { title: "Out for delivery", detail: "Courier will attempt delivery at your address", icon: "lucide:navigation", matches: ["out for delivery"] },
    { title: "Delivered", detail: deliveredDetail, icon: "lucide:badge-check", matches: ["delivered"] },
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

  // Return/exchange progress lives in its own "Return / Exchange tracking" panel — the shipment
  // timeline keeps showing the completed forward journey (reverse flows only exist after delivery).
  if (status.includes("exchange") || status.includes("return")) {
    return buildSteps("delivered", forwardSteps);
  }
  if (status === "cancelled" || status === "seller cancelled") return buildSteps(status, cancelledSteps);
  if (status.includes("rto") || status === "undelivered") {
    // The bare "RTO" status (prepaid parcel back with the seller, awaiting the customer's
    // re-dispatch / refund choice) is the terminal RTO step — the short string matches no step
    // keyword, which used to fall back to step 0.
    return buildSteps(status === "rto" ? "rto delivered" : status, rtoSteps);
  }
  if (status.includes("partial") && status.includes("cancel")) {
    return [
      { title: "Order placed", detail: formatDate(order?.createdAt), icon: "lucide:check-circle-2", state: "done" },
      { title: "Order modified", detail: `Some items removed${order?.modified_at ? ` · ${formatDate(order.modified_at)}` : ""}`, icon: "lucide:file-edit", state: "current" },
      { title: "Remaining items in transit", detail: "The rest of your order will be shipped as scheduled", icon: "lucide:truck", state: "pending" },
    ];
  }

  // order.delivered_at survives from the FIRST delivery even after a second forward shipment
  // (an exchange replacement, or a paid RTO redispatch) cycles the order back through early
  // statuses. Left as plain forwardSteps, step 1 would replay "Order placed" with the original
  // date — reading as if the whole order restarted, instead of a new shipment going out.
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
