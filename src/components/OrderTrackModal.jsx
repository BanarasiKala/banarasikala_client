import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import api from "../utils/api";
import "./OrderTrackModal.css";

// ShipRocket sends scan timestamps as "YYYY-MM-DD HH:mm:ss" (no timezone) —
// swap the space for "T" so Safari parses it too, not just Chrome.
export const formatTrackDate = (value) => {
  if (!value) return "";
  const date = new Date(String(value).includes("T") ? value : String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  const datePart = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const timePart = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase();
  return `${datePart}, ${timePart}`;
};

/**
 * "Track your Order" bottom sheet, shared by the order detail page and My Orders.
 *
 * Pass `tracking` (and `loading`) when the host has already fetched them — the
 * order detail page keeps that data for its timeline. Omit them and the modal
 * pulls its own on open, which is what a My Orders card does.
 */
export default function OrderTrackModal({ order, statusLabel, tracking, loading, onClose }) {
  const selfFetch = tracking === undefined;
  const [fetched, setFetched] = useState(null);
  const [fetching, setFetching] = useState(selfFetch);

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

  const trackingData = selfFetch ? fetched : tracking;
  const isLoading = selfFetch ? fetching : Boolean(loading);
  const activities = trackingData?.tracking?.tracking_data?.shipment_track_activities || [];
  const trackUrl = trackingData?.tracking?.tracking_data?.track_url
    || (order?.shiprocket_awb ? `https://shiprocket.co/tracking/${order.shiprocket_awb}` : "");
  const courierName = order?.courier_name
    || trackingData?.tracking?.tracking_data?.shipment_track?.[0]?.courier_name
    || "Shiprocket";

  return (
    <div className="track-modal-overlay" onClick={onClose}>
      <div className="track-modal-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="track-modal-head">
          <h3>Track your Order</h3>
          <button type="button" className="track-modal-close" onClick={onClose} aria-label="Close tracking">
            <Icon icon="lucide:x" />
          </button>
        </div>

        <div className="track-modal-info">
          <div className="track-modal-info-row">
            <span>Status:</span>
            <strong>{statusLabel}</strong>
          </div>
          <div className="track-modal-info-row">
            <span>Courier Partner:</span>
            <strong>{courierName}</strong>
          </div>
          <div className="track-modal-info-row">
            <span>AWB/Tracking ID:</span>
            <strong>{order?.shiprocket_awb}</strong>
          </div>
        </div>

        <div className="track-modal-timeline">
          {isLoading && !activities.length ? (
            <div className="track-modal-empty">
              <Icon icon="lucide:loader" className="is-spinning" />
              <span>Fetching live tracking…</span>
            </div>
          ) : activities.length ? (
            activities.map((activity, index) => (
              <div className="track-modal-item" key={`${activity.date || "scan"}-${index}`}>
                <span className="track-modal-dot"><Icon icon="lucide:check" /></span>
                {index < activities.length - 1 && <span className="track-modal-line" />}
                <div className="track-modal-item-copy">
                  <strong>{activity.activity || activity["sr-status-label"] || "Shipment update"}</strong>
                  {activity.location && <p>&gt;Location: {activity.location}</p>}
                </div>
                <span className="track-modal-item-date">{formatTrackDate(activity.date)}</span>
              </div>
            ))
          ) : (
            <div className="track-modal-empty">
              <Icon icon="lucide:map-pin-off" />
              <span>Tracking updates will appear here once the courier scans the parcel.</span>
            </div>
          )}
        </div>

        {trackUrl && (
          <a className="track-modal-external" href={trackUrl} target="_blank" rel="noopener noreferrer">
            View on courier site <Icon icon="lucide:external-link" />
          </a>
        )}
      </div>
    </div>
  );
}
