import PolicyPage from "./PolicyPage";

/**
 * Written against the implementation, not a generic template:
 *   client/src/components/CheckoutFlow.jsx      — shipping charge, its discount, COD rules
 *   client/src/utils/deliveryDate.js            — courier ETA + per-product processing days
 *   client/src/utils/courierSelection.js        — how the courier is chosen
 *   client/src/context/LocationContext.jsx      — pincode serviceability
 *   server/src/utils/orderModelV2.js            — RTO re-dispatch window
 *   server/src/controllers/OrderController.js   — re-dispatch pricing and eligibility
 * Amounts driven by environment config (COD cap, prepaid discount, platform fee) are
 * described rather than printed, so this page cannot fall out of step with a config change.
 */
const sections = [
  {
    heading: "Delivery Is Free",
    body: [
      "We do not charge for delivery. There is no minimum order value to qualify, no flat fee below a threshold, and no separate charge for a remote pin code.",
      "We still price the shipment properly behind the scenes — the real courier rate for your parcel and pin code is calculated at checkout and recorded against your order — and then discount it in full. That is why your order summary can show a delivery line at zero rather than omitting it: the cost exists, we absorb it.",
      "The only delivery-related amount you may see charged is the Cash on Delivery handling fee, and only if you choose to pay that way.",
    ],
  },
  {
    heading: "Processing Time",
    body: [
      "Every saree carries its own processing time — the days we need to inspect, pack and hand it to the courier. Where a piece has none set, a site-wide default applies, currently four days.",
      "Processing time is separate from transit time and is already built into the delivery date shown on the product page. You are never asked to add the two together yourself.",
    ],
  },
  {
    heading: "The Delivery Date You Are Shown",
    body: [
      "Once we know your pin code, product pages and listing cards show a specific delivery date rather than a range of days. It is calculated as the courier's own estimated arrival for that pin code plus that product's processing time.",
      "The pin code comes from your location if you allow it, or from the address you enter at checkout. Until we have one, no date is shown — we would rather show nothing than a date we cannot stand behind.",
      "We check with the courier network that your pin code is actually serviceable before promising anything. If no courier covers it, the delivery date is withheld instead of being estimated optimistically.",
      "The date is an estimate. Weather, festivals, strikes and courier backlogs all move it, and none of them are within our control.",
    ],
  },
  {
    heading: "How Your Courier Is Chosen",
    body: [
      "Courier allocation is automatic and is not simply a matter of who is cheapest. Each serviceable courier is scored on its delivery performance, how reliably it re-attempts a failed delivery, pickup speed, adherence to its promised timeline, tracking quality, estimated days in transit and its rate.",
      "Couriers that are blocked, disabled, cannot carry the parcel's weight, or do not support Cash on Delivery when you have chosen it are excluded before scoring begins.",
      "We ship through Shiprocket's partner network, so the specific courier varies by destination.",
    ],
  },
  {
    heading: "Tracking Your Order",
    body: [
      "When your parcel is handed to the courier, a tracking number is generated and sent to you, and your order moves through pickup scheduled, picked up, shipped, out for delivery and delivered.",
      "You can follow all of it from My Orders at any time. Status updates come directly from the courier, so what you see is what the courier has reported to us.",
    ],
  },
  {
    heading: "Cash on Delivery",
    body: [
      "Cash on Delivery is available on orders up to a maximum value, which is shown at checkout. Larger orders are prepaid only.",
      "There is no per-product restriction — if COD is available for your order value and pin code, it is available on everything in the bag.",
      "A COD handling fee applies. It is the courier's own charge for collecting cash, subject to a minimum, and it is billed as its own line rather than hidden inside the delivery cost. Paying online avoids it entirely, and prepaid orders also earn a discount at checkout.",
      "If a previous Cash on Delivery order of yours was refused or returned undelivered, COD is switched off for your account and future orders must be prepaid.",
    ],
  },
  {
    heading: "If Delivery Fails",
    body: [
      "Couriers re-attempt a failed delivery before giving up. Please keep your phone reachable — most failed deliveries are simply an unanswered call.",
      "If all attempts fail, the parcel is returned to us and your order is marked as returned to seller. You are told when this happens; the saree is not silently cancelled.",
      "From the day it reaches us you have 7 days to choose. You can pay the re-dispatch charge — the forward delivery and return legs we actually incurred, shown to you as a single figure — and we will send it out again. Or you can take a refund.",
      "After 7 days the re-dispatch option closes and the order can only be refunded. One re-dispatch is offered per order; if a re-dispatched parcel comes back a second time, only a refund is available.",
      "Please make sure your address and phone number are correct before you place the order. This is the single most common cause of a failed delivery, and it is the one thing entirely in your hands.",
    ],
  },
  {
    heading: "Delivery Area",
    body: [
      "We deliver across India, to any pin code our courier partners serve. We do not ship internationally at present.",
      "Serviceability is checked live rather than against a fixed list, so coverage follows whatever the courier network supports on the day you order.",
    ],
  },
  {
    heading: "Other Charges on an Order",
    body: [
      "Delivery is free, but a few other lines can appear in your order summary, each shown separately at checkout before you pay:",
      [
        "A platform fee, applied to every order",
        "A Cash on Delivery handling fee, only if you choose to pay on delivery",
        "Gift wrap and message, only if you add it",
      ],
      "Paying online instead of Cash on Delivery earns a prepaid discount, shown at checkout.",
      "Which of these are returned to you if you cancel or return an order is set out in our Cancellation Policy and Return & Exchange Policy.",
    ],
  },
];

const ShippingPolicy = () => (
  <PolicyPage
    title="Shipping Policy"
    subtitle="Free delivery across India, with a real date on every product page rather than a vague range."
    sections={sections}
    downloadable
  />
);

export default ShippingPolicy;
