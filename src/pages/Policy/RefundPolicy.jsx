import PolicyPage from "./PolicyPage";

/**
 * Four refund routes, each with its own calculation in the code: settleCancellation and
 * computeCancellationNonRefundable (cancel), computeReturnRefund (return),
 * computeRtoAbandonRefund (undelivered), and none at all for an exchange.
 */
const sections = [
  {
    heading: "Four Kinds of Refund",
    body: [
      "Every refund belongs to one of four situations, each calculated differently: a cancellation before dispatch, a return of a delivered order, an undelivered parcel that came back to us, or an exchange — which refunds nothing, because it is an even swap.",
      "The refund record is created when the request is raised, not decided afterwards, and shows on your order with its own status.",
    ],
  },
  {
    heading: "Cancellation",
    body: [
      "Cancel before dispatch and you are refunded in full — platform fee, gift charge and delivery included.",
      "The one exception is an order that had already gone out, come back undelivered and been re-dispatched at your request: cancelling after that retains the logistics spent, the platform fee and any gift charge. Cash on Delivery orders have nothing to refund.",
    ],
  },
  {
    heading: "Returns",
    body: [
      "You get back what you paid for the sarees going back, less the return pickup charge and, where one applies, a coupon adjustment.",
      "The pickup charge is quoted live for your pin code and parcel weight, shown before you confirm, and locked in then. It can never exceed the refund, so a return cannot leave you owing money.",
      "The coupon adjustment applies only if you keep part of the order and the discount no longer holds against what you kept. Where the original coupon stops qualifying, we re-rate the remaining items against the best coupon they do qualify for and deduct only the difference.",
      "Returning an entire order retains the platform fee, any Cash on Delivery fee and any gift charge — all spent at the time of the order. We retain no payment gateway charge; that cost is ours.",
    ],
  },
  {
    heading: "Undelivered Orders",
    body: [
      "If a parcel cannot be delivered you have 7 days to pay the re-dispatch charge or take a refund.",
      "The refund returns what you paid for the goods, less the forward and return legs the courier ran, the platform fee, any gift charge, and any re-dispatch charges already paid. The figure shown before you decide is produced by the same calculation that pays it out.",
    ],
  },
  {
    heading: "Where the Money Goes",
    body: [
      "Refunds follow how you paid:",
      [
        "Paid online — back to the original payment method, through the same gateway",
        "Cash on Delivery — by bank transfer, so we will ask for your account details",
        "Wallet credit spent on the order — back to your wallet, available immediately",
      ],
      "An order paid partly by wallet and partly by card is refunded to both, in proportion. Wallet credit is store credit and cannot be withdrawn to a bank account.",
    ],
  },
  {
    heading: "Status and Timing",
    body: [
      "Your order shows the refund's own status: Pending (recorded, awaiting the trigger — usually the parcel reaching us), Processing (sent to the gateway), Completed, Not required (an exchange), or Failed.",
      "Gateway refunds are asynchronous: we initiate, the gateway confirms separately, and your order updates automatically. Once confirmed, the time to reach your account is set by your bank — typically a few working days, longer for credit cards than UPI. A wallet-only refund completes immediately.",
      "A refund sitting at Pending on a Cash on Delivery order usually means we are still waiting for your bank details.",
    ],
  },
  {
    heading: "What Is Not Refunded",
    body: [
      [
        "The return pickup charge on a return you initiated",
        "The platform fee, on a full return or an undelivered order",
        "The Cash on Delivery handling fee, on a full return",
        "The gift wrap charge, once the order has been wrapped and dispatched",
        "Delivery and return legs actually run by the courier on an undelivered order",
        "Re-dispatch charges already paid on a previous attempt",
      ],
      "Cancelling before dispatch avoids all of these. We may also decline a returned item on inspection if it comes back used, washed, altered, or without its original tags and packaging.",
    ],
  },
];

const RefundPolicy = () => (
  <PolicyPage
    title="Refund Policy"
    subtitle="How each refund is calculated, where the money goes, and how long it takes."
    sections={sections}
    downloadable
  />
);

export default RefundPolicy;
