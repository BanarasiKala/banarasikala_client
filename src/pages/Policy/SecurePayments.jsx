import PolicyPage from "./PolicyPage";

const sections = [
  {
    heading: "How Your Payment Is Handled",
    body: [
      "All online payments on Banarasi Kala are processed by Razorpay, a PCI DSS Level 1 certified payment gateway. Your payment is completed on Razorpay's secure infrastructure, not on our servers.",
      "Banarasi Kala never sees, handles, or stores your full card number, CVV, UPI PIN, or net banking password. We receive only a payment reference and its status.",
    ],
  },
  {
    heading: "Accepted Payment Methods",
    body: [
      "You can pay using any of the following:",
      [
        "Credit and debit cards — Visa, Mastercard, RuPay",
        "UPI — Google Pay, PhonePe, Paytm and any other UPI app",
        "Net banking from all major Indian banks",
        "Wallets supported by Razorpay",
        "Banarasi Kala Wallet credit and referral rewards",
        "Cash on Delivery, where available for your pin code",
      ],
    ],
  },
  {
    heading: "Encryption in Transit",
    body: [
      "Every page on banarasikala.com is served over HTTPS with TLS encryption, so information moving between your browser and our site cannot be read in transit.",
      "Card details are additionally tokenised by the gateway in line with RBI guidelines, which means a stored card is represented by a token rather than the real number.",
    ],
  },
  {
    heading: "Failed and Pending Payments",
    body: [
      "If money leaves your account but the order does not confirm, the payment is either still pending with your bank or has already been reversed. Such amounts are auto-refunded by the gateway, typically within 5–7 business days.",
      "If a debited amount has not returned after 7 business days, write to support@banarasikala.com with the date, amount and payment reference and we will trace it with the gateway on your behalf.",
    ],
  },
  {
    heading: "Protecting Yourself",
    body: [
      "Banarasi Kala will never ask for your CVV, UPI PIN, OTP, or account password — not by phone, email, WhatsApp or any other channel. Nobody from our team has any reason to request them.",
      "We do not operate payment links outside the checkout on banarasikala.com. Treat any request to pay into a personal account or via a link from an unofficial number as fraudulent, and report it to us.",
    ],
  },
];

const SecurePayments = () => (
  <PolicyPage
    title="Secure Payments"
    subtitle="Every transaction is encrypted and processed through a PCI DSS certified gateway."
    sections={sections}
  />
);

export default SecurePayments;
