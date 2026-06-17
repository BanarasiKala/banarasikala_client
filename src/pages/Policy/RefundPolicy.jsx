import PolicyPage from "./PolicyPage";

const sections = [
  {
    heading: "Refund Eligibility",
    body: [
      "Refunds are issued for returned items that meet our return eligibility criteria, or for orders that were cancelled before dispatch.",
      "Refunds are not applicable for items that do not meet the return conditions outlined in our Return & Exchange Policy.",
    ],
  },
  {
    heading: "Refund Timeline",
    body: [
      "Once we receive and inspect the returned item, we will notify you of the refund approval. Approved refunds are processed within 5–7 business days.",
      "The amount will be credited to your original payment method:",
      [
        "Credit / Debit Card: 5–7 business days",
        "UPI / Net Banking: 3–5 business days",
        "Wallets (Paytm, PhonePe, etc.): 1–3 business days",
        "Banarasi Kala Wallet: Instant",
      ],
    ],
  },
  {
    heading: "Cancellation Refunds",
    body: [
      "Orders cancelled before dispatch are eligible for a full refund. Once an order has been shipped, cancellation is not possible — you will need to follow the return process instead.",
      "To cancel an order, visit My Orders and select the Cancel option, or contact our support team promptly.",
    ],
  },
  {
    heading: "Partial Refunds",
    body: [
      "In cases where only part of an order is returned, the refund will be calculated for the returned items only, minus any applicable shipping charges.",
    ],
  },
  {
    heading: "Non-Refundable Situations",
    body: [
      "The following are not eligible for a refund:",
      [
        "Items returned outside the 7-day return window",
        "Items that have been used, washed, or damaged by the customer",
        "Shipping charges on non-defective returns",
        "Sale or discounted items",
      ],
    ],
  },
];

const RefundPolicy = () => (
  <PolicyPage
    title="Refund Policy"
    subtitle="Transparent and timely refunds — because trust matters."
    sections={sections}
  />
);

export default RefundPolicy;
