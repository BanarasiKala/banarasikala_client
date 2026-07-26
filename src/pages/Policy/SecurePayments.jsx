import PolicyPage from "./PolicyPage";

/**
 * Written against the implementation:
 *   server/src/controllers/RazorpayController.js — HMAC-SHA256 signature verification,
 *                                                  signed webhook for refund events
 *   server/src/services/RefundSyncService.js     — gateway refund settlement
 *   client/src/components/CheckoutFlow.jsx       — the methods actually offered, COD rules
 * Claims here are limited to what the code does. Anything about Razorpay's own certifications
 * is their published position, not something this codebase can demonstrate.
 */
const sections = [
  {
    heading: "Who Handles Your Payment",
    body: [
      "Every online payment on banarasikala.com is processed by Razorpay. The payment itself completes on Razorpay's infrastructure, not on ours.",
      "Banarasi Kala never sees, handles or stores your card number, CVV, UPI PIN or net banking password. What reaches our servers is a payment reference and a status — enough to know your order is paid, and nothing more.",
      "That is a deliberate design choice rather than a formality. Card data we never receive is card data that cannot leak from us.",
    ],
  },
  {
    heading: "How We Know a Payment Is Genuine",
    body: [
      "When a payment completes, Razorpay returns a cryptographic signature alongside the order and payment identifiers. Our server recomputes that signature independently using a secret key that only we and Razorpay hold, and accepts the payment only if the two match exactly.",
      "This is what stops a forged success response. Anyone can send our server a message claiming a payment succeeded; nobody without the secret key can produce a signature that verifies.",
      "Refund notifications arriving from Razorpay are verified the same way, against a separate signing secret, so a refund cannot be faked into your order either.",
    ],
  },
  {
    heading: "Ways You Can Pay",
    body: [
      "At checkout you can pay by:",
      [
        "UPI — Google Pay, PhonePe, or any other UPI app",
        "Credit or debit card",
        "Net banking",
        "EMI, where your bank offers it",
        "Wallets supported by Razorpay",
        "Your Banarasi Kala wallet balance, alone or alongside another method",
        "Cash on Delivery, where your order value and pin code allow it",
      ],
      "Choosing Google Pay or PhonePe opens the payment directly in that app rather than making you pick again.",
      "Paying online earns a prepaid discount, and avoids the Cash on Delivery handling fee. Both are shown at checkout before you pay.",
    ],
  },
  {
    heading: "Encryption in Transit",
    body: [
      "The whole site is served over HTTPS with TLS encryption, so anything moving between your browser and our servers is encrypted and cannot be read in transit.",
      "Your session is held with signed tokens rather than by transmitting your password on each request, and passwords are stored only as a cryptographic hash — even we cannot read them.",
    ],
  },
  {
    heading: "Cash on Delivery",
    body: [
      "Cash on Delivery is available up to a maximum order value, shown at checkout. Larger orders are prepaid only.",
      "A handling fee applies. It is the courier's own charge for collecting cash, subject to a minimum, and it is billed as its own line rather than folded into the delivery cost.",
      "If a previous Cash on Delivery order of yours was refused or came back undelivered, Cash on Delivery is switched off for your account and future orders must be prepaid. Undelivered parcels cost real money to send out and bring back.",
    ],
  },
  {
    heading: "Failed and Pending Payments",
    body: [
      "If money leaves your account but the order does not confirm, the payment either did not complete or has already been reversed. The gateway auto-refunds such amounts, typically within 5–7 business days.",
      "If a debited amount has not returned after that, email support@banarasikala.com with the date, the amount and any reference your bank shows, and we will trace it with the gateway on your behalf.",
      "Never place the order a second time to force it through. Check My Orders first — if the order is there, it went through.",
    ],
  },
  {
    heading: "Refunds",
    body: [
      "Refunds on prepaid orders are sent back through the same gateway to the method you originally paid with. We initiate the refund and the gateway confirms it separately; your order updates automatically when that confirmation arrives.",
      "Cash on Delivery orders are refunded by bank transfer, so we will ask for your account details.",
      "Wallet credit is returned to your wallet immediately. Full details are in our Refund Policy.",
    ],
  },
  {
    heading: "Protecting Yourself",
    body: [
      "Banarasi Kala will never ask you for your CVV, UPI PIN, OTP, card PIN or account password — not by phone, email, WhatsApp, SMS or any other channel. No one on our team has any reason to ask, and a request for any of them is fraud regardless of who it appears to come from.",
      "We do not operate payment links outside the checkout on banarasikala.com. Treat any request to pay into a personal account, or through a link sent from an unofficial number, as fraudulent.",
      "Approving a UPI request never receives money. If someone tells you to approve a request in order to collect a refund, they are taking money from you.",
      "Check the address bar reads banarasikala.com before entering payment details, and report anything suspicious to support@banarasikala.com.",
    ],
  },
];

const SecurePayments = () => (
  <PolicyPage
    title="Secure Payments"
    subtitle="Payments are processed by Razorpay and verified cryptographically. Your card details never reach us."
    sections={sections}
    downloadable
  />
);

export default SecurePayments;
