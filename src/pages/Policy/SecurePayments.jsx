import PolicyPage from "./PolicyPage";

/**
 * Claims are limited to what the code does — HMAC-SHA256 signature verification in
 * RazorpayController, and the methods CheckoutFlow actually offers. Razorpay's own
 * certifications are their published position, not something this codebase demonstrates.
 */
const sections = [
  {
    heading: "Who Handles Your Payment",
    body: [
      "Every online payment is processed by Razorpay and completes on their infrastructure, not ours. We never see or store your card number, CVV, UPI PIN or net banking password — only a payment reference and its status.",
      "Card data we never receive is card data that cannot leak from us.",
    ],
  },
  {
    heading: "How We Know a Payment Is Genuine",
    body: [
      "Razorpay returns a cryptographic signature with every completed payment. Our server recomputes it independently using a secret only we and Razorpay hold, and accepts the payment only on an exact match.",
      "That is what stops a forged success response: anyone can claim a payment succeeded, but nobody without the secret can produce a signature that verifies. Refund notifications are checked the same way, against a separate secret.",
    ],
  },
  {
    heading: "Ways to Pay",
    body: [
      [
        "UPI — Google Pay, PhonePe, or any other UPI app",
        "Credit or debit card",
        "Net banking",
        "EMI, where your bank offers it",
        "Wallets supported by Razorpay",
        "Your Banarasi Kala wallet balance, alone or with another method",
        "Cash on Delivery, where your order value and pin code allow it",
      ],
      "Choosing Google Pay or PhonePe opens that app directly. Paying online earns a prepaid discount and avoids the Cash on Delivery handling fee.",
      "Cash on Delivery is capped at a maximum order value, and is switched off for accounts whose previous Cash on Delivery order came back undelivered.",
    ],
  },
  {
    heading: "Encryption",
    body: [
      "The site is served over HTTPS, so everything between your browser and our servers is encrypted in transit. Sessions use signed tokens rather than resending your password, and passwords are stored only as a cryptographic hash.",
    ],
  },
  {
    heading: "Failed and Pending Payments",
    body: [
      "If money left your account but the order did not confirm, check My Orders first — if the order is there, it went through. Otherwise the gateway auto-refunds, typically within 5–7 business days.",
      "If it has not returned after that, email support@banarasikala.com with the date, amount and any reference your bank shows and we will trace it. Never reorder to force it through.",
    ],
  },
  {
    heading: "Protecting Yourself",
    body: [
      "We will never ask for your CVV, UPI PIN, OTP, card PIN or password — not by phone, email, WhatsApp or SMS. A request for any of them is fraud, whoever it appears to come from.",
      "We do not operate payment links outside the checkout on banarasikala.com. Treat any request to pay into a personal account, or a link from an unofficial number, as fraudulent.",
      "Approving a UPI request never receives money. If someone tells you to approve one to collect a refund, they are taking money from you.",
    ],
  },
];

const SecurePayments = () => (
  <PolicyPage
    title="Secure Payments"
    subtitle="Processed by Razorpay and verified cryptographically. Your card details never reach us."
    sections={sections}
    downloadable
  />
);

export default SecurePayments;
