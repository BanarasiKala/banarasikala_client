import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";
import useBottomSheet from "../hooks/useBottomSheet";
import api from "../utils/api";
import { buildOrderTimeline, cleanScanLocation, describeStep, formatTrackDate } from "../utils/tracking";
import "./OrderTrackModal.css";

/**
 * "Track Your Order" bottom sheet, shared by the order detail page and My Orders.
 *
 * ── What it shows ───────────────────────────────────────────────────────────────────────
 * Once the parcel is with the courier this is the COURIER'S OWN SCAN FEED — every scan, with
 * the place it happened and the time — which is what a customer means by "where is my order".
 * It used to show our seven-step order-status hierarchy instead, which answers a different
 * question: a parcel that has moved through four hubs still reads as one unchanging "Shipped".
 *
 * That hierarchy is still the fallback, and is the right thing to show before dispatch: an
 * order placed an hour ago has no scans at all, and an empty feed would say nothing.
 *
 * ── Where the data comes from ───────────────────────────────────────────────────────────
 * The order detail page already holds a tracking payload, so it passes one in. My Orders does
 * not — it lists orders and never fetched tracking for any of them — so the sheet fetches its
 * own when none is supplied. That is why "Track your order" from the list now shows the same
 * feed as the one from the order page, rather than a thinner version of it.
 */
export default function OrderTrackModal({ order, statusLabel, tracking: suppliedTracking, loading, onClose }) {
  // Drag-to-dismiss, Escape, and the body scroll lock — shared with the order details sheet.
  const { sheetRef, grabHandlers, sheetStyle } = useBottomSheet(onClose);

  const [fetched, setFetched] = useState(null);
  const [fetching, setFetching] = useState(false);

  const orderId = order?.id;
  // No shipment booked yet means there is nothing for ShipRocket to know — asking would spend
  // a round trip to be told so.
  const hasShipment = Boolean(order?.shiprocket_awb || order?.shiprocket_order_id);

  useEffect(() => {
    if (suppliedTracking || !orderId || !hasShipment) return undefined;
    // `live` rather than an AbortController: an aborted axios request rejects, and the catch
    // here would read that as "tracking failed" for a sheet that is already gone.
    let live = true;
    setFetching(true);
    api.get(`/api/orders/track/${orderId}`)
      .then(({ data }) => { if (live) setFetched(data); })
      // Silent: the status timeline below is a complete answer on its own, so a failed
      // courier lookup degrades to it rather than showing an error over it.
      .catch(() => {})
      .finally(() => { if (live) setFetching(false); });
    return () => { live = false; };
  }, [suppliedTracking, orderId, hasShipment]);

  const payload = suppliedTracking || fetched;
  const shipmentTrack = payload?.tracking?.tracking_data?.shipment_track?.[0];
  const activities = payload?.tracking?.tracking_data?.shipment_track_activities;
  const trackUrl = payload?.tracking?.tracking_data?.track_url
    || (order?.shiprocket_awb ? `https://shiprocket.co/tracking/${order.shiprocket_awb}` : "");
  const courierName = order?.courier_name || shipmentTrack?.courier_name || "";
  const courierPhone = shipmentTrack?.courier_agent_details?.phone
    || shipmentTrack?.courier_agent_phone
    || "";
  const awb = order?.shiprocket_awb || shipmentTrack?.awb_code || "";
  const currentStatus = shipmentTrack?.current_status || statusLabel || "";

  /**
   * The courier's scans, newest first (which is the order ShipRocket returns them in).
   *
   * Nothing is collapsed here. `normalizeScans` merges consecutive scans that share a friendly
   * title, which is right for a step list and wrong for this: three "In Transit" scans are
   * three different cities, and merging them erases most of the journey.
   */
  const scans = useMemo(() => (Array.isArray(activities) ? activities : [])
    .map((activity, index) => {
      // ShipRocket's `activity` is already a human sentence — "Reached at destination hub".
      // Only the sr-status-label fallback is code-like ("PICKED_UP", "DLVD"), so that is the
      // one that gets translated into words a customer can read.
      const raw = String(activity.activity || "").trim();
      return {
        key: `${index}-${activity.date || ""}`,
        title: raw || describeStep(activity["sr-status-label"] || "").title,
        location: cleanScanLocation(activity.location),
        stamp: formatTrackDate(activity.date),
      };
    })
    .filter((scan) => scan.title), [activities]);

  // The pre-dispatch fallback: the order's own status hierarchy.
  const steps = useMemo(
    () => buildOrderTimeline(order).map((step) => ({
      key: step.title,
      title: step.title,
      note: step.detail,
      state: step.state,
    })),
    [order],
  );

  const isDelivered = useMemo(
    () => scans.some((s) => /delivered/i.test(s.title)) || steps.some((s) => /delivered/i.test(s.title)),
    [scans, steps],
  );

  const busy = Boolean(loading) || fetching;

  return (
    <div className="track-modal-overlay" onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        className="track-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Track your order"
        onClick={(event) => event.stopPropagation()}
        style={sheetStyle}
      >
        {/* Grab area — the whole strip drags, not just the visible pill, which is what a
            thumb actually lands on. */}
        <div className="track-modal-grab" {...grabHandlers}>
          <span className="track-modal-grabber" />
        </div>

        <button type="button" className="track-modal-close" onClick={onClose} aria-label="Close tracking">
          <Icon icon="lucide:x" />
        </button>

        <div className="track-modal-head">
          <h3>Track Your Order</h3>
          {order?.order_number && <p>Order #{order.order_number}</p>}
        </div>

        {/* Shipment header. These three facts belong to the whole shipment rather than to any
            one scan, so they are pinned above the feed instead of being attached to whichever
            step happened to be nearest — which is where the AWB and courier used to live. */}
        {scans.length > 0 && (
          <dl className="track-sr-summary">
            {currentStatus && (
              <div>
                <dt>Status:</dt>
                <dd>{currentStatus}</dd>
              </div>
            )}
            {courierName && (
              <div>
                <dt>Courier Partner:</dt>
                <dd>{courierName}</dd>
              </div>
            )}
            {awb && (
              <div>
                <dt>AWB/Tracking ID:</dt>
                <dd className="is-code">{awb}</dd>
              </div>
            )}
            {courierPhone && (
              <div>
                <dt>Partner Contact:</dt>
                <dd>
                  <a href={`tel:${String(courierPhone).replace(/\s/g, "")}`}>{courierPhone}</a>
                </dd>
              </div>
            )}
          </dl>
        )}

        <div className="track-modal-timeline">
          {scans.length > 0 ? (
            <ol className="track-sr-feed">
              {scans.map((scan, index) => (
                <li className="track-sr-scan" key={scan.key}>
                  <span className="track-sr-dot"><Icon icon="lucide:check" /></span>
                  {index < scans.length - 1 && <span className="track-sr-line" />}
                  <div className="track-sr-body">
                    <div className="track-sr-row">
                      <strong>{scan.title}</strong>
                      {scan.stamp && <time className="track-sr-time">{scan.stamp}</time>}
                    </div>
                    {scan.location && (
                      <span className="track-sr-loc">&gt;Location: {scan.location}</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : steps.length ? (
            steps.map((step, index) => (
              <div className="track-step" key={step.key}>
                <span className={`track-step-dot is-${step.state || "pending"}`}>
                  <Icon icon={step.state === "pending" ? "lucide:circle" : "lucide:check"} />
                </span>
                {index < steps.length - 1 && <span className="track-step-line" />}

                <div className="track-step-body">
                  <strong>{step.title}</strong>
                  {step.note && <p>{step.note}</p>}
                </div>
              </div>
            ))
          ) : (
            <div className="track-modal-empty">
              <Icon icon={busy ? "lucide:loader-2" : "lucide:map-pin-off"} className={busy ? "is-spinning" : ""} />
              <span>
                {busy
                  ? "Fetching the latest courier scans…"
                  : statusLabel
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
