import PolicyPage from "./PolicyPage";

/**
 * Written against the implementation:
 *   server/src/utils/orderTransactions.js       — refund types, statuses, payout routes
 *   server/src/services/OrderReturnService.js   — return refund maths
 *   server/src/controllers/OrderController.js   — computeCancellationNonRefundable
 *   server/src/services/orderLedgerService.js   — computeRtoAbandonRefund
 *   server/src/services/RefundSyncService.js    — gateway settlement, Pending/Processing/Completed
 * Amounts set by environment config are described, not printed.
 */
const sections = [
  {
    heading: "The Four Ways a Refund Arises",
    body: [
      "Every refund on your order belongs to one of four situations, and each is calculated differently:",
      [
        "Cancellation — you cancelled before dispatch",
        "Return — you sent a delivered order, or part of it, back to us",
        "Undelivered (RTO) — the parcel could not be delivered and came back to us",
        "Exchange — no refund arises, because an exchange is an even swap",
      ],
      "Whichever applies, the refund record is created at the moment the request is raised rather than decided afterwards, and it is visible on your order with its own status.",
    ],
  },
  {
    heading: "Cancellation Refunds",
    body: [
      "Cancel before dispatch and you are refunded in full. Nothing is retained — not the platform fee, not the gift charge, not delivery.",
      "There is one exception. If your order had already gone out, come back undelivered, and been re-dispatched at your request, then cancelling after that retains the logistics already spent on those journeys, together with the platform fee and any gift charge. Money genuinely spent moving a parcel cannot be recovered.",
      "Cash on Delivery orders cancelled before dispatch have nothing to refund, because nothing was collected.",
      "Once an order has shipped it can no longer be cancelled — the return route applies instead.",
    ],
  },
  {
    heading: "Return Refunds",
    body: [
      "A return refunds what you paid for the sarees going back, less the return pickup charge and, where one applies, a coupon adjustment.",
      "The pickup charge is quoted live for your pin code and parcel weight, shown to you before you confirm, and locked in at that moment. It can never exceed the refund, so a return cannot leave you owing money.",
      "The coupon adjustment applies only when you keep part of the order and the discount you received no longer holds against what you kept. Where the original coupon stops qualifying we automatically re-rate the remaining items against the best coupon they do qualify for and deduct only the difference.",
      "Returning an entire order works differently: the platform fee, any Cash on Delivery fee and any gift charge are retained, because all three were spent at the time of the order. We do not retain any payment gateway charge — that cost is ours.",
      "The full mechanics, including how wallet credit is treated, are in our Return & Exchange Policy.",
    ],
  },
  {
    heading: "Undelivered Orders",
    body: [
      "If a parcel cannot be delivered and returns to us, you have 7 days to pay the re-dispatch charge and have it sent again, or to take a refund.",
      "Choosing the refund returns what you paid for the goods, less the forward and return legs the courier actually ran, the platform fee, any gift charge, and any re-dispatch charges already paid on an earlier attempt.",
      "The figure you are shown before you decide is produced by the same calculation that pays it out, so the estimate and the payout cannot differ.",
      "After 7 days the re-dispatch option closes and only a refund remains available.",
    ],
  },
  {
    heading: "Exchanges",
    body: [
      "An exchange is an even swap for a saree at exactly the same price, so no money moves in either direction and no refund arises. The replacement also ships free.",
      "If you want money back rather than a different saree, raise a return instead. Each order allows one return and one exchange, independently.",
    ],
  },
  {
    heading: "Where the Money Goes",
    body: [
      "A refund is routed by how you paid, not by preference:",
      [
        "Paid online — refunded to the original payment method, through the same gateway",
        "Cash on Delivery — refunded by bank transfer, so we will ask for your account details",
        "Wallet credit spent on the order — returned to your Banarasi Kala wallet",
      ],
      "An order paid partly from your wallet and partly by card is refunded to both, in those proportions.",
      "Wallet refunds are credited immediately and are available to spend at once. They are store credit and cannot be withdrawn to a bank account.",
    ],
  },
  {
    heading: "Refund Status and Timing",
    body: [
      "Your order page shows the refund's own status, so you are never guessing:",
      [
        "Pending — recorded and awaiting the trigger to pay out, such as the returned parcel reaching us",
        "Processing — sent to the payment gateway and awaiting its confirmation",
        "Completed — confirmed by the gateway, or credited to your wallet",
        "Not required — an exchange, where no money moves",
        "Failed — the gateway rejected it; we will contact you to resolve it",
      ],
      "Gateway refunds are asynchronous. We initiate the refund, the gateway confirms it separately, and we update your order automatically when that confirmation arrives. Opening the order also re-checks a refund still in Processing.",
      "Once confirmed by the gateway, the time for money to appear in your account is set by your bank, not by us — typically a few working days, and longer for credit cards than for UPI.",
      "A wallet-only refund completes immediately, with no gateway step at all.",
    ],
  },
  {
    heading: "What Is Not Refunded",
    body: [
      "Across all routes, the following are not returned:",
      [
        "The return pickup charge on a return you initiated",
        "The platform fee, on a full return or an undelivered order",
        "The Cash on Delivery handling fee, on a full return",
        "The gift wrap charge, once the order has been wrapped and dispatched",
        "Delivery and return legs actually run by the courier on an undelivered order",
        "Re-dispatch charges already paid on a previous delivery attempt",
      ],
      "Cancelling before dispatch avoids all of these, because none of them have been incurred yet.",
      "We may also decline a returned item on inspection where it comes back used, washed, altered, or without its original tags and packaging.",
    ],
  },
  {
    heading: "If Something Goes Wrong",
    body: [
      "If a refund shows as Failed, or as Completed but has not reached you after your bank's normal window, write to support@banarasikala.com with your order number.",
      "For a Cash on Delivery refund we cannot pay out until we have your bank details, so a refund sitting at Pending on a COD order usually means we are still waiting for them.",
    ],
  },
];

const RefundPolicy = () => (
  <PolicyPage
    title="Refund Policy"
    subtitle="How each kind of refund is calculated, where the money goes, and how long it takes."
    sections={sections}
    downloadable
  />
);

export default RefundPolicy;
