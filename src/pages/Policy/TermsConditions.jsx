import PolicyPage from "./PolicyPage";

/**
 * Commercial sections derive from AuthService (signup, verification, welcome bonus),
 * WalletService (immediate vs held credit), ReferralController + OrderController (referral
 * milestone), Coupon model (limits) and FeedbackController (review eligibility, moderation).
 * The legal sections are not code-derived and should be reviewed by a lawyer.
 */
const sections = [
  {
    heading: "Acceptance",
    body: [
      "By using banarasikala.com you agree to these terms together with our Privacy, Shipping, Return & Exchange, Cancellation and Refund policies and our Disclaimer. We may update them at any time; continued use means you accept the revision.",
    ],
  },
  {
    heading: "Your Account",
    body: [
      "Register with an email address and password, or sign in with Google. An email address must be verified before you can log in; Google verifies automatically and can link to an existing account on the same address.",
      "You are responsible for your credentials and everything done under your account. Tell us at support@banarasikala.com if you suspect unauthorised use.",
      [
        "You must be at least 18 to hold an account",
        "Your information must be accurate and kept current",
        "One person may not run multiple accounts to claim rewards more than once",
        "Accounts used fraudulently may be suspended and their rewards reversed",
      ],
    ],
  },
  {
    heading: "Products, Pricing and Orders",
    body: [
      "Prices are in Indian Rupees and include applicable taxes unless stated. Prices may change, but the price shown when you order is the price honoured. Availability is tracked per colour, so a saree may be in stock in one colour and not another.",
      "Placing an order is an offer to buy, which we accept by confirming it. We may decline or cancel for a pricing error, unavailable stock, an unserviceable address or suspected fraud — refunding in full in every case.",
      "Online payments are processed by Razorpay; we never receive your card number, CVV or UPI PIN. Cash on Delivery is capped at a value shown at checkout and withdrawn from accounts whose previous Cash on Delivery order came back undelivered. A platform fee applies to every order; Cash on Delivery adds a handling fee, gift wrapping adds a charge, and paying online earns a prepaid discount.",
    ],
  },
  {
    heading: "Wallet Credit",
    body: [
      "Your wallet holds store credit. It can be spent on this site and is not redeemable for cash, transferable, or withdrawable to a bank.",
      "Some credit is available immediately; some is held until a stated release date. Held credit is withdrawn if the order that earned it is cancelled or returned before then. Wallet money spent on an order returns to the wallet if that order is cancelled or returned.",
      "We may reverse credit issued in error or obtained by abusing a promotion.",
    ],
  },
  {
    heading: "Signup Bonus and Referrals",
    body: [
      "Every first-time signup receives a welcome bonus, once per account. Each account has a referral code; a new customer may apply one code, once, and cannot apply their own. The customer who applies a valid code is credited straight away.",
      "The referrer is rewarded on a milestone, not per signup: once a set number of distinct customers they referred have each had an order delivered, a bonus is created and released after a holding period. It is paid once per referrer, and is cancelled if the qualifying order is returned or cancelled during that period.",
      "Self-referral, duplicate accounts and coordinated signups created to trigger a milestone are not genuine referrals. We may reverse the rewards and close the accounts involved.",
    ],
  },
  {
    heading: "Coupons",
    body: [
      "Coupons may be a percentage or a fixed amount, may carry a maximum discount cap and a minimum purchase value, may be limited in total uses and per customer (normally one each), and may be restricted to a validity period.",
      "If you return part of an order that used a coupon, the discount is recalculated against what you keep, applying the best coupon those items qualify for. Coupons have no cash value and cannot be combined unless a promotion says so.",
    ],
  },
  {
    heading: "Delivery, Returns and Cancellation",
    body: [
      "Delivery is free across India. Dates shown are estimates, not guarantees. Delivered orders may be returned or exchanged within 7 days — one return and one exchange per order — and orders may be cancelled within 24 hours of ordering, before dispatch. Full terms are in the Shipping, Return & Exchange, Cancellation and Refund policies.",
    ],
  },
  {
    heading: "Reviews and Content",
    body: [
      "You may review a product only after it has been delivered to your account, and the review is tied to that order. Reviews are moderated and are not published until approved.",
      "We may decline content that is abusive, misleading, unlawful, infringing or unrelated. By submitting content you confirm it is yours to submit and grant us a non-exclusive licence to display it alongside the product it concerns. We do not pay for reviews and do not remove genuine ones for being unfavourable.",
    ],
  },
  {
    heading: "Chat Assistant and Acceptable Use",
    body: [
      "Our assistant answers using live catalogue and order data and can still be wrong. Where it conflicts with a product page, an order record or these policies, those prevail; nothing it says varies these terms.",
      "You may not use this site to break the law, interfere with its operation or security, scrape the catalogue in bulk, place orders you do not intend to accept, or abuse promotions, coupons, referrals or returns. We may suspend accounts, cancel orders and withdraw rewards where we reasonably believe this is happening.",
    ],
  },
  {
    heading: "Intellectual Property and Liability",
    body: [
      "All content on this site belongs to Banarasi Kala or is used with permission. You may not reproduce, distribute or use it commercially without written consent; ordinary personal use as a shopper is fine.",
      "We are not liable for indirect, incidental or consequential loss, and our total liability for any claim will not exceed what you paid for the product or service it concerns. Nothing here limits liability that cannot be limited under Indian law, including for death or personal injury caused by negligence, or for fraud.",
    ],
  },
  {
    heading: "Governing Law",
    body: [
      "These terms are governed by the laws of India, and disputes are subject to the exclusive jurisdiction of the courts of Varanasi, Uttar Pradesh.",
    ],
  },
];

const TermsConditions = () => (
  <PolicyPage
    title="Terms & Conditions"
    subtitle="Please read these before using the site or placing an order."
    sections={sections}
    downloadable
  />
);

export default TermsConditions;
