import PolicyPage from "./PolicyPage";

/**
 * Derived from CheckoutFlow.jsx (charge + its discount, COD rules), deliveryDate.js,
 * courierSelection.js, LocationContext.jsx and orderModelV2.js (RTO window). Env-driven
 * amounts are described, not printed, so a config change cannot make this page lie.
 */
const sections = [
  {
    heading: "Delivery Is Free",
    body: [
      "We do not charge for delivery. No minimum order value, no flat fee, no surcharge for remote pin codes. The only delivery-related charge is the Cash on Delivery handling fee, and only if you choose to pay that way.",
    ],
  },
  {
    heading: "Delivery Dates",
    body: [
      "Once we know your pin code, each product page shows a specific delivery date — the courier's estimated arrival for that pin code plus that saree's own processing time. If a pin code is not serviceable, no date is shown rather than a guess.",
      "Dates are estimates. Weather, festivals, strikes and courier backlogs move them.",
    ],
  },
  {
    heading: "Courier and Tracking",
    body: [
      "We ship through Shiprocket's partner network. The courier is chosen automatically on delivery performance, re-attempt reliability, pickup speed, timeline adherence, tracking quality, transit days and rate — not on price alone.",
      "You receive a tracking number once the parcel is collected, and can follow it from My Orders through pickup, transit, out for delivery and delivered.",
    ],
  },
  {
    heading: "Cash on Delivery",
    body: [
      "Available up to a maximum order value shown at checkout; larger orders are prepaid only. There is no per-product restriction.",
      "A handling fee applies — the courier's own charge for collecting cash, billed as its own line. Paying online avoids it and earns a prepaid discount.",
      "If a previous Cash on Delivery order of yours came back undelivered, Cash on Delivery is switched off for your account.",
    ],
  },
  {
    heading: "If Delivery Fails",
    body: [
      "Couriers re-attempt before giving up, so please keep your phone reachable. If all attempts fail the parcel returns to us and you are told.",
      "You then have 7 days to pay the re-dispatch charge — the forward and return legs we actually incurred — or take a refund. After 7 days only a refund remains. One re-dispatch is offered per order.",
      "Please check your address and phone number before ordering. It is the most common cause of a failed delivery and the one entirely in your hands.",
    ],
  },
  {
    heading: "Delivery Area and Other Charges",
    body: [
      "We deliver across India to any pin code our couriers serve, checked live rather than against a fixed list. We do not ship internationally.",
      "Besides free delivery, your order may show a platform fee (always), a Cash on Delivery fee (only if you pay on delivery) and a gift wrap charge (only if you add it). All are itemised before you pay. What is returned on a cancellation or return is set out in those policies.",
    ],
  },
];

const ShippingPolicy = () => (
  <PolicyPage
    title="Shipping Policy"
    subtitle="Free delivery across India, with a real date on every product page."
    sections={sections}
    downloadable
  />
);

export default ShippingPolicy;
