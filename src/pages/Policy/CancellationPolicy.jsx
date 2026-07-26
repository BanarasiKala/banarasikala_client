import PolicyPage from "./PolicyPage";

const sections = [
  {
    heading: "Cancelling Before Dispatch",
    body: [
      "Orders can be cancelled free of charge at any time before they are dispatched. Go to My Orders, open the order, and select Cancel — no reason is required and no fee is charged.",
      "Because we begin preparing orders within 2–3 business days of payment, the window to cancel is usually short. Cancelling as soon as you change your mind gives the best chance of catching the order in time.",
    ],
  },
  {
    heading: "Cancelling Individual Items",
    body: [
      "If your order contains more than one saree, you may cancel individual items rather than the whole order. The remaining items ship as normal and only the cancelled items are refunded.",
      "Any discount that depended on the order value may be recalculated across the items you keep.",
    ],
  },
  {
    heading: "Once an Order Has Shipped",
    body: [
      "After dispatch an order can no longer be cancelled, because the parcel is already with the courier. You can instead refuse delivery, or accept it and raise a return within 7 days under our Return & Exchange Policy.",
      "If a shipped order is refused or undelivered and comes back to us, the forward and return shipping costs actually incurred may be deducted from the refund.",
    ],
  },
  {
    heading: "Cancellations by Banarasi Kala",
    body: [
      "Occasionally we may need to cancel an order ourselves — for example if a saree turns out to be unavailable, if a listing carried a pricing error, or if the delivery address falls outside our serviceable pin codes.",
      "In every such case you are informed by email and refunded in full, to your original payment method, with no deduction of any kind.",
    ],
  },
  {
    heading: "Refunds on Cancellation",
    body: [
      "Cancellations made before dispatch are refunded in full, including any shipping charge paid.",
      "Prepaid refunds are initiated within 24 hours of the cancellation and reach your original payment method within 3–7 business days depending on your bank. Cash on Delivery orders have nothing to refund unless a charge was already collected.",
      "Full timelines by payment method are set out in our Refund Policy.",
    ],
  },
];

const CancellationPolicy = () => (
  <PolicyPage
    title="Cancellation Policy"
    subtitle="Changed your mind? Cancelling before dispatch is free and takes a moment."
    sections={sections}
  />
);

export default CancellationPolicy;
