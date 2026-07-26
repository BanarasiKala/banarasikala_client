import { Icon } from "@iconify/react";
import { useMemo } from "react";
import useBottomSheet from "../hooks/useBottomSheet";
import { buildOrderTimeline } from "../utils/tracking";
import "./OrderTrackModal.css";

/**
 * "Track Your Order" bottom sheet, shared by the order detail page and My Orders.
 *
 * The timeline follows the order's STATUS — the same Order placed → Processing → Pickup
 * scheduled → Picked up → Shipped → Out for delivery → Delivered hierarchy the Order
 * Confirmation page shows — never the courier's raw scan feed. The sheet does NOT fetch
 * tracking; an optional `tracking` prop (which the order detail page already holds) is used
 * only to surface the courier's phone number when it happens to be available.
 */
export default function OrderTrackModal({ order, statusLabel, tracking, onClose }) {
  // Drag-to-dismiss, Escape, and the body scroll lock — shared with the order details sheet.
  const { sheetRef, grabHandlers, sheetStyle } = useBottomSheet(onClose);

  const shipmentTrack = tracking?.tracking?.tracking_data?.shipment_track?.[0];
  const trackUrl = tracking?.tracking?.tracking_data?.track_url
    || (order?.shiprocket_awb ? `https://shiprocket.co/tracking/${order.shiprocket_awb}` : "");
  const courierName = order?.courier_name || shipmentTrack?.courier_name || "";
  const courierPhone = shipmentTrack?.courier_agent_details?.phone
    || shipmentTrack?.courier_agent_phone
    || "";
  const awb = order?.shiprocket_awb || shipmentTrack?.awb_code || "";

  // The timeline is the order's status hierarchy — identical to the Order Confirmation page.
  const steps = useMemo(
    () => buildOrderTimeline(order).map((step) => ({
      key: step.title,
      title: step.title,
      note: step.detail,
      state: step.state,
    })),
    [order],
  );

  // Which step carries which detail card. Resolved by index so each renders once: the AWB sits
  // with the dispatch step, the courier with the delivery run. Falls back to the first/last
  // step when a status flow (RTO, cancelled) has no such step.
  const { awbIndex, courierIndex, isDelivered } = useMemo(() => {
    const shipIdx = steps.findIndex((s) => /shipped|picked up|replacement dispatched/i.test(s.title));
    const outIdx = steps.findIndex((s) => /out for delivery/i.test(s.title));
    return {
      awbIndex: shipIdx >= 0 ? shipIdx : (steps.length ? 0 : -1),
      courierIndex: outIdx >= 0 ? outIdx : steps.length - 1,
      isDelivered: steps.some((s) => /delivered/i.test(s.title)),
    };
  }, [steps]);

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

        <div className="track-modal-timeline">
          {steps.length ? (
            steps.map((step, index) => (
              <div className="track-step" key={step.key}>
                <span className={`track-step-dot is-${step.state || "pending"}`}>
                  <Icon icon={step.state === "pending" ? "lucide:circle" : "lucide:check"} />
                </span>
                {index < steps.length - 1 && <span className="track-step-line" />}

                <div className="track-step-body">
                  <strong>{step.title}</strong>
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
