import { Icon } from "@iconify/react";
import { useDeliveryLocation } from "../context/LocationContext";
import { getEstimatedDeliveryDate } from "../utils/deliveryDate";

// Shown only when the user has granted GPS location access.
// Uses local date math (no API call) so it's safe to render inside any product card.
export default function DeliveryBadge({ processingDays }) {
  const { pincode, courierEtd } = useDeliveryLocation();

  if (!pincode) return null;

  // Same formula as the product detail page: courier ETA + this product's
  // processing days. courierEtd is a shared, cached value for the pincode.
  const date = getEstimatedDeliveryDate(courierEtd, processingDays);
  const formatted = date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="card-delivery-badge">
      <Icon icon="lucide:package-check" />
      <span>FREE delivery <strong>{formatted}</strong></span>
    </div>
  );
}
