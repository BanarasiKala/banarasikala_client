import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import useBottomSheet from "../hooks/useBottomSheet";
import api from "../utils/api";
import { cleanScanLocation, describeStep, formatTrackDate } from "../utils/tracking";
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
 * When there are no scans it says so in a sentence, rather than falling back to that hierarchy.
 * Drawing it as a stand-in meant the sheet opened on one timeline and swapped it for a different
 * one a second later — and the hierarchy was never tracking to begin with, only a restatement of
 * the status already visible on the page behind this sheet.
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
  // Starts true when this sheet has to fetch, so the very first render is already the loader.
  // Setting it in the effect instead left one frame in which nothing was loading and no scans
  // existed — which is the state that renders "no updates", so the sheet opened on that.
  const [fetching, setFetching] = useState(!suppliedTracking && Boolean(order?.id));
  const [failed, setFailed] = useState(false);

  const orderId = order?.id;
  // No shipment booked yet means there is nothing for ShipRocket to know — asking would spend
  // a round trip to be told so.
  const hasShipment = Boolean(order?.shiprocket_awb || order?.shiprocket_order_id);

  const fetchTracking = useCallback(() => {
    if (suppliedTracking || !orderId) return undefined;
    // No shipment booked yet means there is nothing for ShipRocket to know — asking would spend
    // a round trip to be told so. Resolve straight to "nothing yet".
    if (!hasShipment) {
      setFetching(false);
      return undefined;
    }
    // `live` rather than an AbortController: an aborted axios request rejects, and the catch
    // here would read that as "tracking failed" for a sheet that is already gone.
    let live = true;
    setFetching(true);
    setFailed(false);
    api.get(`/api/orders/track/${orderId}`)
      .then(({ data }) => { if (live) setFetched(data); })
      .catch(() => { if (live) setFailed(true); })
      .finally(() => { if (live) setFetching(false); });
    return () => { live = false; };
  }, [suppliedTracking, orderId, hasShipment]);

  useEffect(() => fetchTracking(), [fetchTracking]);

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

  const isDelivered = useMemo(
    () => scans.some((s) => /delivered/i.test(s.title))
      || /delivered/i.test(String(order?.status || "")),
    [scans, order?.status],
  );

  /**
   * What the body should say when there are no courier scans.
   *
   * The order's own status hierarchy used to be drawn here as a stand-in, which is why the sheet
   * opened on a timeline and then replaced it with a different one a moment later: that
   * hierarchy is not tracking, it is a restatement of the status already shown on the page
   * behind. Saying plainly that the courier has nothing yet is both true and less work to read
   * than a timeline that is about to be thrown away.
   */
  const emptyState = useMemo(() => {
    if (failed) {
      return {
        icon: "lucide:wifi-off",
        text: "We couldn't reach the courier just now. Your order is safe — please try again in a moment.",
        retry: true,
      };
    }
    if (!hasShipment) {
      return {
        icon: "lucide:package",
        text: statusLabel
          ? `Your order is ${String(statusLabel).toLowerCase()}. Tracking begins once it is handed to the courier.`
          : "Tracking begins once your order is handed to the courier.",
      };
    }
    return {
      icon: "lucide:map-pin-off",
      text: "The courier has your parcel but hasn't scanned it yet. Updates appear here as soon as they do.",
    };
  }, [failed, hasShipment, statusLabel]);

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
                {/* "Tracking ID" leads, because that is what the number means to the person
                    reading it; "AWB" follows in brackets for anyone who has seen the courier
                    call it that. The old "AWB/Tracking ID" put the jargon first. */}
                <dt>Tracking ID (AWB):</dt>
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
          {/* Loading comes FIRST. Drawing anything else while the lookup is in flight is what
              made the sheet show one timeline and then swap it for another — whatever is chosen
              here is guaranteed to be replaced the moment the answer lands. */}
          {busy && scans.length === 0 ? (
            <div className="track-modal-empty">
              <Icon icon="lucide:loader-2" className="is-spinning" />
              <span>Fetching the latest courier scans…</span>
            </div>
          ) : scans.length > 0 ? (
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
                    {/* No leading ">" — that was Shiprocket's own widget quoting itself, and in
                        our own type it just read as a stray character. */}
                    {scan.location && (
                      <span className="track-sr-loc">Location: {scan.location}</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="track-modal-empty">
              <Icon icon={emptyState.icon} />
              <span>{emptyState.text}</span>
              {emptyState.retry && (
                <button type="button" className="track-modal-retry" onClick={fetchTracking}>
                  <Icon icon="lucide:rotate-cw" /> Try again
                </button>
              )}
            </div>
          )}
        </div>

        {trackUrl && !isDelivered && (
          <a className="track-modal-external" href={trackUrl} target="_blank" rel="noopener noreferrer">
            View on courier site <Icon icon="lucide:external-link" />
          </a>
        )}
      </div>
    </div>
  );
}
