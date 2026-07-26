import PolicyPage from "./PolicyPage";

/**
 * Written against the actual implementation, not a generic template. The behaviour described
 * here lives in:
 *   server/src/services/OrderReturnService.js      — eligibility, refund maths, pickup booking
 *   server/src/utils/orderItemActions.js           — action/item statuses, actionable quantity
 *   server/src/controllers/OrderItemActionController.js — request validation, exchange options
 *   server/src/services/ExchangeReplacementService.js   — the outbound replacement shipment
 *   client/src/pages/OrderConfirmation/OrderConfirmation.jsx — the 4-step request wizard
 * If any of those change, this page has to change with them.
 */
const sections = [
  {
    heading: "When You Can Raise a Request",
    body: [
      "Returns and exchanges open once your order is marked delivered, and stay open for 7 days from the delivery date. The exact closing date is printed on every eligible item on your order page, so you never have to count.",
      "Each order allows one return request and one exchange request. The two are independent — raising an exchange does not use up your return, and vice versa. Within a request you may include as many items, and as many units of an item, as you like.",
      "An item already inside an open request cannot be added to another one until the first is settled. Cancelled items, and items whose full quantity has already been returned or exchanged, are not eligible.",
    ],
  },
  {
    heading: "How to Raise It",
    body: [
      "Open My Orders, select the delivered order, and choose Return or Exchange. The request runs as a four-step flow — select items, give a reason, review, confirm — and nothing is submitted until the final step.",
      "Select items: tick the products you are sending back and set the quantity for each. You can return part of an order and keep the rest.",
      "Reason: pick from the listed reasons and add a comment if you want to explain further. Returns offer size or fit issue, colour or design differs from images, damaged or defective, quality not as expected, wrong product delivered, or other. Exchanges offer need a different colour or design, size or fit issue, damaged or defective, or other.",
      "Review and confirm: before you submit, the screen shows exactly which items are going back and — for a return — the refund you will receive, itemised. Nothing is estimated after the fact.",
      "The request is logged immediately and the order moves to Return Initiated or Exchange Initiated. You do not need to email anyone or wait for a reply to get the process started.",
    ],
  },
  {
    heading: "Reverse Pickup",
    body: [
      "Once your request is submitted we book a reverse pickup with our courier partner automatically. You do not arrange the shipment and you do not pay the courier at the door.",
      "You will receive a return AWB and tracking once a courier has been assigned to the pickup, and your order page tracks the parcel through out for return pickup, return picked up, and return completed.",
      "Please keep the saree unused, unwashed and unaltered, with its original tags and packaging, and hand it over as received. The pickup is booked against the declared value of the goods, so the parcel is insured for what it is worth while it travels back to us.",
    ],
  },
  {
    heading: "What a Return Refunds",
    body: [
      "Your refund is the price you actually paid for the returned items, less two things — the return pickup charge, and a coupon adjustment where one applies. Nothing else is deducted from a partial return.",
      "Return pickup charge: when you raise the request we get a live rate for the cheapest courier able to collect from your pin code, for the real weight of the parcel going back (product weight plus packaging — the same basis your delivery charge was quoted on). That figure is shown to you before you confirm, is locked in at that moment, and is never revised afterwards. If the courier ends up costing us more than quoted, that is our cost, not yours. The charge can never exceed the refund, so a return never leaves you owing money.",
      "Coupon adjustment: if you used a coupon and are keeping part of the order, the discount is recalculated against what you keep. If your original coupon still qualifies on the remaining items, its own rules apply — a fixed-amount coupon keeps its full value, a percentage coupon scales with the smaller subtotal and honours its cap. If the original coupon no longer qualifies, we automatically re-rate the items you keep against the best active coupon they do qualify for, and deduct only the difference. Only if nothing qualifies is the full benefit recovered. The recalculated discount can never exceed what you originally received, and sequential partial returns never claw back the same rupee twice.",
      "Wallet credit you spent at checkout is treated as money paid and comes back to your wallet.",
    ],
  },
  {
    heading: "Returning an Entire Order",
    body: [
      "When nothing is kept there is no remaining basket to re-rate a coupon against, so the coupon machinery does not apply. Instead the money goes back to the two places it came from.",
      "Wallet credit spent on the order is returned to your wallet in full. Service fees and the pickup charge are never taken out of store credit.",
      "What you actually paid us is refunded less the return pickup charge and less the fees already charged on the order — the platform fee, the Cash on Delivery fee where one applied, and any gift packaging charge. Those are paid out at the time of the order and are not recoverable.",
      "We do not retain any payment gateway charge on a return. The gateway's fee on your original payment is a cost we absorb.",
      "Only if what you paid cannot cover those deductions does the shortfall come out of the wallet return — we never refund more than was actually paid.",
    ],
  },
  {
    heading: "How Refunds Reach You",
    body: [
      "A refund record is created the moment your request is submitted, so the amount is committed up front rather than decided later. It is settled once the returned parcel is back with us and checked.",
      "Prepaid orders are refunded to the original payment method used at checkout.",
      "Cash on Delivery orders are refunded by bank transfer, so we will ask for your account details before the payout can be made.",
      "Any wallet portion is credited straight back to your Banarasi Kala wallet and is available immediately.",
      "Timelines by payment method are set out in our Refund Policy.",
    ],
  },
  {
    heading: "How Exchanges Work",
    body: [
      "An exchange is an even swap and never moves money in either direction — there is no refund and nothing more to pay, including delivery.",
      "You can exchange for any active product priced at exactly what you paid for that line and holding stock in at least one colour, plus the same saree in a different colour. The price match is exact by design, which is precisely what makes the swap even.",
      "Exchanging more than one unit does not tie you to a single replacement. Three units can come back as two of one saree and one of another, provided the quantities add up to what you are returning. Every unit going back has a named replacement coming out.",
      "The replacement ships free of charge on a fresh shipment against the same order, with its own AWB and tracking.",
      "Your order reads Exchange Initiated while the original is on its way back, Replacement being prepared once it reaches us, and Exchange Completed only when the replacement is actually delivered to you — not before.",
    ],
  },
  {
    heading: "Gift-Wrapped Orders",
    body: [
      "Gift wrap and a personal message are an optional extra at checkout, charged once per order regardless of how many sarees it contains.",
      "The gift charge is not refunded when you return the order. The wrapping and the message card are made up for that specific order and cannot be recovered once the parcel has gone out, so the charge is retained in the same way as the platform fee. It is shown as a separate non-refundable line on your refund breakdown rather than being folded silently into the total.",
      "This applies whether you return the whole order or part of it. On a partial return the charge simply never enters the calculation, because your refund is based on the price of the sarees going back; on a full return it is deducted explicitly.",
      "Cancellation is different. Cancel before dispatch and the gift charge comes back with everything else — nothing has been wrapped yet. The only exception is an order that already went out, came back to us undelivered, and was re-dispatched at your request; cancelling after that retains the gift charge along with the platform fee and the logistics already spent.",
      "An exchange never touches the gift charge, since no money moves in either direction. The replacement, however, ships as an ordinary parcel — it is not re-wrapped, and you are not charged again.",
    ],
  },
  {
    heading: "Damaged, Defective or Wrong Items",
    body: [
      "Received damaged or defective and wrong product delivered are both listed reasons on the return and exchange flows, so raise the request the same way and choose that reason.",
      "Please do so as soon as you notice, and keep the packaging. Photographs of the fault and the parcel help us settle it quickly and take it up with the courier where relevant.",
      "If a saree reaches you damaged or is not what you ordered, you are not out of pocket — write to us and we will put it right.",
    ],
  },
  {
    heading: "Requests We Cannot Accept",
    body: [
      "A request will not go through if:",
      [
        "The order has not been delivered yet — returns and exchanges open only after delivery",
        "More than 7 days have passed since delivery",
        "A return already exists on the order and you are raising another return, or an exchange already exists and you are raising another exchange",
        "The item is already inside an open return or exchange request",
        "The item was cancelled, or its full quantity has already been actioned",
      ],
      "Separately, we may decline a returned item on inspection if it comes back used, washed, altered, or without its original tags and packaging.",
    ],
  },
  {
    heading: "Cancellation, Referrals and Other Effects",
    body: [
      "Raising a return or exchange closes cancellation on that order. The two settle money differently, so an order follows one route or the other, not both. Cancelling before dispatch remains free — see our Cancellation Policy.",
      "If your order earned referral credit that is still within its hold period, that pending credit is cancelled when a return is raised, since the purchase it rewarded is being undone.",
      "Returned stock is put back into inventory once the parcel is received and checked.",
    ],
  },
];

const ReturnExchange = () => (
  <PolicyPage
    title="Return & Exchange"
    subtitle="Seven days from delivery, one return and one exchange per order, reverse pickup arranged by us."
    sections={sections}
  />
);

export default ReturnExchange;
