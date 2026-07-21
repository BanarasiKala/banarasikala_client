import { Icon } from "@iconify/react";
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../utils/api";
import "./OrderTrackModal.css";

// ShipRocket sends scan timestamps as "YYYY-MM-DD HH:mm:ss" (no timezone) —
// swap the space for "T" so Safari parses it too, not just Chrome.
const parseScanDate = (value) => {
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

// The sheet's own step titles read better than raw courier scan text ("UD-Consignee
// unavailable"), so the common ones are mapped and anything unrecognised falls through
// verbatim rather than being dropped.
const STEP_COPY = [
  { test: /order\s*placed|new\s*order/i, title: "Order Placed", note: "Your order has been placed successfully." },
  { test: /out\s*for\s*delivery/i, title: "Out for Delivery", note: "Your order is out for delivery." },
  { test: /delivered/i, title: "Delivered", note: "Your order has been delivered." },
  { test: /rto/i, title: "Returning to Seller", note: "The shipment is on its way back to us." },
  { test: /pickup|picked/i, title: "Picked Up", note: "The courier has collected your parcel." },
  { test: /ship|manifest|dispatch|in\s*transit/i, title: "Shipped", note: "Your order has been shipped." },
];

const describeStep = (raw) => {
  const match = STEP_COPY.find((entry) => entry.test.test(raw || ""));
  return match
    ? { title: match.title, note: match.note }
    : { title: raw || "Shipment update", note: "" };
};

/**
 * "Track Your Order" bottom sheet, shared by the order detail page and My Orders.
 *
 * Pass `tracking` (and `loading`) when the host has already fetched them — the order
 * detail page keeps that data for its own timeline. Omit them and the sheet pulls its
 * own on open, which is what a My Orders card does.
 */
export default function OrderTrackModal({ order, statusLabel, tracking, loading, onClose }) {
  const selfFetch = tracking === undefined;
  const [fetched, setFetched] = useState(null);
  const [fetching, setFetching] = useState(selfFetch);
  // Drag-to-dismiss offset. The grabber promises the sheet can be pulled down, so it has
  // to actually do it — a handle that doesn't drag is worse than no handle.
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!selfFetch || !order?.id) return undefined;
    let cancelled = false;
    setFetching(true);
    api.get(`/api/orders/track/${order.id}`)
      .then((response) => {
        if (!cancelled) setFetched(response.data);
      })
      .catch(() => {
        // Non-blocking: the sheet still shows the AWB and the courier link.
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selfFetch, order?.id]);

  // Close on Escape, and stop the page behind from scrolling while the sheet is up.
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

  const trackingData = selfFetch ? fetched : tracking;
  const isLoading = selfFetch ? fetching : Boolean(loading);
  const shipmentTrack = trackingData?.tracking?.tracking_data?.shipment_track?.[0];
  const trackUrl = trackingData?.tracking?.tracking_data?.track_url
    || (order?.shiprocket_awb ? `https://shiprocket.co/tracking/${order.shiprocket_awb}` : "");
  const courierName = order?.courier_name || shipmentTrack?.courier_name || "";
  const courierPhone = shipmentTrack?.courier_agent_details?.phone
    || shipmentTrack?.courier_agent_phone
    || "";
  const awb = order?.shiprocket_awb || shipmentTrack?.awb_code || "";

  // Courier scans arrive newest-first; the sheet reads as a journey, so it renders
  // oldest-first. "Order Placed" is ours, not the courier's — synthesised from the order
  // itself so the story starts where the customer's story started.
  const steps = useMemo(() => {
    const activities = trackingData?.tracking?.tracking_data?.shipment_track_activities || [];
    const scans = activities
      .map((activity) => {
        const raw = activity.activity || activity["sr-status-label"] || "";
        const { title, note } = describeStep(raw);
        return {
          key: `${activity.date || "scan"}-${raw}`,
          title,
          note: activity.location ? `${note} ${note ? "·" : ""} ${activity.location}`.trim() : note,
          date: activity.date,
          at: parseScanDate(activity.date)?.getTime() ?? 0,
        };
      })
      .sort((a, b) => a.at - b.at);

    const placedAt = order?.createdAt || order?.created_at;
    const alreadyHasPlaced = scans.some((s) => s.title === "Order Placed");
    if (!placedAt || alreadyHasPlaced) return scans;
    return [{
      key: "order-placed",
      title: "Order Placed",
      note: "Your order has been placed successfully.",
      date: placedAt,
      at: parseScanDate(placedAt)?.getTime() ?? 0,
    }, ...scans];
  }, [trackingData, order?.createdAt, order?.created_at]);

  // Which step carries which detail card. Resolved by index so each card renders exactly
  // once: the AWB sits with the despatch scan, the courier with the delivery run. When
  // neither scan exists yet, they fall back to the first/last step so the customer can
  // still see them rather than losing them to a strict match.
  const { awbIndex, courierIndex, isDelivered } = useMemo(() => {
    const shipIdx = steps.findIndex((s) => /shipped|picked up/i.test(s.title));
    const outIdx = steps.findIndex((s) => /out for delivery/i.test(s.title));
    return {
      awbIndex: shipIdx >= 0 ? shipIdx : (steps.length ? 0 : -1),
      courierIndex: outIdx >= 0 ? outIdx : steps.length - 1,
      isDelivered: steps.some((s) => /delivered/i.test(s.title)),
    };
  }, [steps]);

  // ── Drag to dismiss ───────────────────────────────────────────────────────────────
  const onDragStart = (event) => {
    dragStart.current = event.touches?.[0]?.clientY ?? event.clientY;
  };
  const onDragMove = (event) => {
    if (dragStart.current == null) return;
    const y = event.touches?.[0]?.clientY ?? event.clientY;
    // Downward only — dragging up must not lift the sheet off the bottom edge.
    setDragY(Math.max(0, y - dragStart.current));
  };
  const onDragEnd = () => {
    if (dragStart.current == null) return;
    dragStart.current = null;
    // Past a quarter of the sheet's height reads as intent to dismiss; anything less
    // springs back, so a stray scroll doesn't close a sheet the customer is reading.
    const threshold = (sheetRef.current?.offsetHeight || 400) * 0.25;
    if (dragY > threshold) onClose?.();
    else setDragY(0);
  };

  return (
    <div className="track-modal-overlay" onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        className="track-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Track your order"
        onClick={(event) => event.stopPropagation()}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
      >
        {/* Grab area — the handle and the header both drag, which is what a thumb
            actually lands on. */}
        <div
          className="track-modal-grab"
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
          onMouseDown={onDragStart}
          onMouseMove={onDragMove}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
        >
          <span className="track-modal-grabber" />
        </div>

        <button type="button" className="track-modal-close" onClick={onClose} aria-label="Close tracking">
          <Icon icon="lucide:x" />
        </button>

        <div className="track-modal-head">
          <h3>Track Your Order</h3>
          {order?.order_number && <p>Order #{order.order_number}</p>}
        </div>

        <div className="track-modal-timeline">
          {isLoading && !steps.length ? (
            <div className="track-modal-empty">
              <Icon icon="lucide:loader" className="is-spinning" />
              <span>Fetching live tracking…</span>
            </div>
          ) : steps.length ? (
            steps.map((step, index) => (
              <div className="track-step" key={step.key}>
                <span className="track-step-dot"><Icon icon="lucide:check" /></span>
                {index < steps.length - 1 && <span className="track-step-line" />}

                <div className="track-step-body">
                  <strong>{step.title}</strong>
                  <time>{formatTrackDate(step.date)}</time>
                  {step.note && <p>{step.note}</p>}

                  {index === awbIndex && awb && (
                    <div className="track-card">
                      <div className="track-card-col">
                        <span>AWB Number</span>
                        <strong>{awb}</strong>
                      </div>
                    </div>
                  )}

                  {index === courierIndex && (courierName || courierPhone) && (
                    <div className="track-card">
                      {courierName && (
                        <div className="track-card-col">
                          <span>Courier Partner</span>
                          <strong>{courierName}</strong>
                        </div>
                      )}
                      {courierPhone && (
                        <div className="track-card-col">
                          <span>Partner Contact</span>
                          <strong>{courierPhone}</strong>
                        </div>
                      )}
                      {courierPhone && (
                        <a
                          className="track-card-call"
                          href={`tel:${String(courierPhone).replace(/\s/g, "")}`}
                          aria-label={`Call ${courierName || "the courier"}`}
                        >
                          <Icon icon="lucide:phone-call" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="track-modal-empty">
              <Icon icon="lucide:map-pin-off" />
              <span>
                {statusLabel
                  ? `Your order is ${String(statusLabel).toLowerCase()}. Tracking updates appear here once the courier scans the parcel.`
                  : "Tracking updates will appear here once the courier scans the parcel."}
              </span>
            </div>
          )}
        </div>

        {isDelivered && (
          <div className="track-modal-thanks">
            <span className="track-modal-thanks-icon"><Icon icon="lucide:sparkles" /></span>
            <p>
              Thank you for shopping with Banarasi Kala!
              <br />
              We hope you love your purchase.
            </p>
          </div>
        )}

        {trackUrl && !isDelivered && (
          <a className="track-modal-external" href={trackUrl} target="_blank" rel="noopener noreferrer">
            View on courier site <Icon icon="lucide:external-link" />
          </a>
        )}
      </div>
    </div>
  );
}
