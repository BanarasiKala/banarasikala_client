import PolicyPage from "./PolicyPage";

/**
 * Written against the implementation:
 *   server/src/controllers/OrderController.js — cancelOrder (all five guards), CANCELLABLE_STATUSES,
 *                                               computeCancellationNonRefundable, restock + coupon release
 *   client/src/pages/OrderConfirmation/OrderConfirmation.jsx — canCancelOrder, CANCEL_REASONS
 * The 24-hour window and the whole-order-only rule are enforced on both sides; both are easy
 * to get wrong from intuition, so neither should be softened here without changing the code.
 */
const sections = [
  {
    heading: "The Cancellation Window",
    body: [
      "You can cancel within 24 hours of placing your order, provided it has not yet been dispatched. The Cancel option appears on the order itself while both of those hold, and disappears once either stops being true.",
      "Twenty-four hours is not an arbitrary limit. We begin preparing an order almost immediately, and once a courier has been assigned the parcel is committed. Cancelling early costs nobody anything; cancelling late means work and freight already spent.",
      "If your order came back to us undelivered and you paid to have it re-dispatched, a fresh 24-hour window opens from the moment of that re-dispatch — not from when you originally ordered. Otherwise a re-dispatch days later would arrive with no cancellation right at all.",
    ],
  },
  {
    heading: "Cancellation Is Whole-Order Only",
    body: [
      "Cancelling cancels the entire order. You cannot cancel individual sarees from a multi-item order or reduce a quantity.",
      "If you want to keep part of an order and let the rest go, you have two options: cancel the whole thing and reorder what you want, or wait for delivery and return the items you do not want. Returns are per item and per quantity.",
    ],
  },
  {
    heading: "How to Cancel",
    body: [
      "Open My Orders, select the order, and choose Cancel. You will be asked for a reason — incorrect item or size selected, ordered by mistake or duplicate, delivery time too long, decided to buy something else, wrong coupon applied, a payment or billing issue, or anything else you want to tell us.",
      "The reason is for our benefit, not a test you have to pass. No cancellation is refused because of the reason given.",
      "Cancellation takes effect immediately. Your sarees go back into stock, any coupon you used is released back for future use, and the refund is raised in the same moment.",
    ],
  },
  {
    heading: "When You Can No Longer Cancel",
    body: [
      "Cancellation closes when any of the following is true:",
      [
        "More than 24 hours have passed since you ordered, or since a re-dispatch",
        "The order has moved past preparation — a courier has been assigned, or it has shipped",
        "The parcel is physically with the courier, in transit or delivered",
        "A return or exchange has already been raised on the order",
        "The order is already cancelled or delivered",
      ],
      "The rule about returns and exchanges matters more than it looks. A return or exchange is already settling money and moving those goods; allowing a cancellation on top would refund the whole order and restock every line a second time. It matters most for an exchange, where shipping your replacement briefly puts the order back into preparation — without this rule you could cancel that shipment and be refunded for sarees you kept.",
      "If the window has closed but the order has not yet been delivered, wait for it to arrive and use the return route instead. Every delivered order carries 7 days for returns and exchanges.",
    ],
  },
  {
    heading: "What You Get Back",
    body: [
      "A cancellation refunds everything you paid. Nothing is retained — not the platform fee, not the gift charge, not delivery. Nothing has been wrapped, dispatched or spent, so there is nothing to hold back.",
      "There is one exception. If the order had already gone out, come back undelivered, and been re-dispatched at your request, then cancelling after that retains the logistics actually spent on those journeys, together with the platform fee and any gift charge. That money left our hands moving a real parcel and cannot be recovered.",
      "Cash on Delivery orders have nothing to refund, because nothing was collected. Cancelling simply closes the order.",
      "Wallet credit spent on the order returns to your wallet; money paid online returns to the payment method you used. The figure shown to you in the cancel dialog is produced by the same calculation that pays it out, so what you are quoted is what you receive. Timelines are in our Refund Policy.",
    ],
  },
  {
    heading: "Cancellations by Us",
    body: [
      "Occasionally we cancel an order ourselves — a saree turns out to be unavailable, a listing carried a pricing error, the delivery address is outside the pin codes our couriers serve, or we suspect fraud.",
      "In every such case you are told, and refunded in full to your original payment method with no deduction of any kind, regardless of how much time has passed.",
    ],
  },
  {
    heading: "Related Policies",
    body: [
      "Orders that have shipped are covered by the Return & Exchange Policy. Orders that could not be delivered are covered by the Shipping Policy, which explains the re-dispatch choice. How and when refund money reaches you is in the Refund Policy.",
    ],
  },
];

const CancellationPolicy = () => (
  <PolicyPage
    title="Cancellation Policy"
    subtitle="Cancel within 24 hours of ordering, before dispatch, and you are refunded in full."
    sections={sections}
    downloadable
  />
);

export default CancellationPolicy;
