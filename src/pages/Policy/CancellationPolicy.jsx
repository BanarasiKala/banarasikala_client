import PolicyPage from "./PolicyPage";

/**
 * The 24-hour window and the whole-order-only rule are enforced in OrderController.cancelOrder
 * on the server and mirrored in canCancelOrder on the client. Neither should be softened here
 * without changing the code.
 */
const sections = [
  {
    heading: "The Window",
    body: [
      "You can cancel within 24 hours of placing your order, provided it has not been dispatched. The Cancel option appears on the order while both hold, and disappears once either stops being true.",
      "If your order came back undelivered and you paid to have it re-dispatched, a fresh 24-hour window opens from that re-dispatch.",
      "Cancellation is whole-order only — you cannot cancel individual sarees or reduce a quantity. To keep part of an order, either cancel and reorder, or wait for delivery and return what you do not want.",
    ],
  },
  {
    heading: "How to Cancel",
    body: [
      "Open My Orders, select the order, choose Cancel and pick a reason. No cancellation is refused because of the reason given.",
      "It takes effect immediately: your sarees go back into stock, any coupon is released for reuse, and the refund is raised at the same moment.",
    ],
  },
  {
    heading: "When You Can No Longer Cancel",
    body: [
      "Cancellation closes once any of these is true:",
      [
        "More than 24 hours have passed since ordering, or since a re-dispatch",
        "A courier has been assigned, or the order has shipped",
        "The parcel is with the courier, in transit or delivered",
        "A return or exchange has been raised on the order",
        "The order is already cancelled or delivered",
      ],
      "A return or exchange closes cancellation because it is already settling that money and moving those goods; allowing both would refund and restock twice.",
      "If the window has closed but the order has not arrived, wait for delivery and use the return route — every delivered order carries 7 days.",
    ],
  },
  {
    heading: "What You Get Back",
    body: [
      "Everything you paid. Nothing is retained — not the platform fee, not the gift charge, not delivery — because nothing has been wrapped, dispatched or spent.",
      "One exception: if the order had already gone out, come back undelivered and been re-dispatched at your request, cancelling after that retains the logistics spent on those journeys plus the platform fee and any gift charge.",
      "Cash on Delivery orders have nothing to refund. Wallet credit returns to your wallet; money paid online returns to the method used. The figure shown in the cancel dialog is produced by the same calculation that pays it out.",
    ],
  },
  {
    heading: "Cancellations by Us",
    body: [
      "We may cancel an order ourselves if a saree is unavailable, a listing carried a pricing error, the address is not serviceable, or we suspect fraud. You are told, and refunded in full with no deduction, however much time has passed.",
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
