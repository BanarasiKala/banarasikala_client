import PolicyPage from "./PolicyPage";

/**
 * Derived from OrderReturnService (eligibility, refund maths, pickup booking),
 * orderItemActions (statuses, actionable quantity), OrderItemActionController (validation,
 * exchange options), ExchangeReplacementService (the outbound replacement) and the request
 * wizard in OrderConfirmation.jsx. If any of those change, this page changes with them.
 */
const sections = [
  {
    heading: "Eligibility",
    body: [
      "Returns and exchanges open when your order is marked delivered and stay open for 7 days. The closing date is printed on every eligible item on your order page.",
      "Each order allows one return and one exchange, independently — raising an exchange does not use up your return. Within a request you may include as many items and units as you like.",
      "An item already inside an open request cannot be added to another until the first settles. Cancelled items, and items already fully returned or exchanged, are not eligible.",
    ],
  },
  {
    heading: "How to Raise a Request",
    body: [
      "Open My Orders, choose the delivered order, and select Return or Exchange. The request runs as four steps — select items, give a reason, review, confirm — and nothing is submitted until the last one.",
      "Pick the items and quantities you are sending back; you can return part of an order and keep the rest. Choose a reason (size or fit, colour or design differs from images, damaged or defective, quality not as expected, wrong product delivered, or other) and add a comment if you wish. For a return, the review step shows the refund itemised before you confirm.",
      "The request is logged immediately and the order moves to Return Initiated or Exchange Initiated. You do not need to email anyone first.",
    ],
  },
  {
    heading: "Reverse Pickup",
    body: [
      "We book the pickup with our courier automatically — you do not arrange a shipment or pay at the door. You get a return tracking number once a courier is assigned, and the order tracks through out for return pickup, picked up and return completed.",
      "Please send the saree back unused, unwashed and unaltered, with its original tags and packaging.",
    ],
  },
  {
    heading: "What a Return Refunds",
    body: [
      "You get back what you paid for the returned items, less the return pickup charge and, where one applies, a coupon adjustment. Nothing else is deducted from a partial return.",
      "The pickup charge is quoted live for your pin code and the real weight going back, shown before you confirm, and locked in then — if the courier costs us more, that is our cost. It can never exceed the refund, so a return cannot leave you owing money.",
      "The coupon adjustment applies only when you keep part of the order and the discount no longer holds against what you kept. If your original coupon still qualifies, its own rules apply; if it does not, we re-rate the remaining items against the best coupon they do qualify for and deduct only the difference. The recalculated discount never exceeds what you originally received, and sequential returns never claw back the same rupee twice.",
      "Wallet credit you spent counts as money paid and comes back to your wallet.",
    ],
  },
  {
    heading: "Returning a Whole Order",
    body: [
      "Wallet credit spent is returned in full — service fees and the pickup charge never come out of store credit.",
      "What you paid is refunded less the pickup charge and the fees already spent on the order: the platform fee, any Cash on Delivery fee and any gift wrap charge. Gift wrapping is retained on partial returns too, simply by never entering the calculation. We retain no payment gateway charge; that cost is ours.",
      "Only if what you paid cannot cover those deductions does the shortfall come out of the wallet return — we never refund more than was paid.",
    ],
  },
  {
    heading: "How Refunds Reach You",
    body: [
      "The refund is recorded when you raise the request and settled once the parcel is back with us and checked. Prepaid orders go to the original payment method, Cash on Delivery orders by bank transfer (so we will ask for your account details), and any wallet portion to your wallet immediately. Timelines are in our Refund Policy.",
    ],
  },
  {
    heading: "How Exchanges Work",
    body: [
      "An exchange is an even swap: no refund, nothing more to pay, and the replacement ships free.",
      "You can exchange for any active saree priced at exactly what you paid for that line and holding stock, plus the same saree in another colour. Exchanging several units does not tie you to one replacement — three units can come back as two of one saree and one of another, provided the quantities add up.",
      "Your order reads Exchange Initiated while the original travels back, Replacement being prepared once it reaches us, and Exchange Completed only when the replacement is actually delivered to you.",
    ],
  },
  {
    heading: "Damaged, Defective or Wrong Items",
    body: [
      "Both are listed reasons on the return and exchange flows — raise the request the same way and choose that reason. Do so as soon as you notice and keep the packaging; photographs of the fault help us settle it and take it up with the courier. If a saree reaches you damaged or is not what you ordered, you are not out of pocket.",
    ],
  },
  {
    heading: "Requests We Cannot Accept",
    body: [
      [
        "The order has not been delivered yet",
        "More than 7 days have passed since delivery",
        "A return already exists and you are raising another return, or the same for an exchange",
        "The item is already inside an open request",
        "The item was cancelled, or its full quantity has already been actioned",
      ],
      "We may also decline a returned item on inspection if it comes back used, washed, altered, or without its original tags and packaging.",
    ],
  },
  {
    heading: "Other Effects",
    body: [
      "Raising a return or exchange closes cancellation on that order — the two settle money differently, so an order follows one route or the other. Cancelling before dispatch remains free; see our Cancellation Policy.",
      "If your order earned referral credit still within its holding period, that pending credit is cancelled when a return is raised. Returned stock goes back into inventory once the parcel is received and checked.",
    ],
  },
];

const ReturnExchange = () => (
  <PolicyPage
    title="Return & Exchange"
    subtitle="Seven days from delivery, one return and one exchange per order, pickup arranged by us."
    sections={sections}
    downloadable
  />
);

export default ReturnExchange;
