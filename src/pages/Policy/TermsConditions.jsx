import PolicyPage from "./PolicyPage";

/**
 * The commercial sections are written against the implementation:
 *   server/src/services/AuthService.js          — signup, email verification, welcome bonus
 *   server/src/services/WalletService.js        — immediate vs held credit, cancellation
 *   server/src/controllers/ReferralController.js and OrderController.js — referral rules
 *   server/src/models/Coupon.js                 — coupon limits and validity
 *   server/src/controllers/FeedbackController.js — who may review, moderation
 * Reward and coupon amounts are environment config, so they are described rather than printed.
 * The legal sections (IP, liability, governing law) are not code-derived and should be
 * reviewed by a lawyer.
 */
const sections = [
  {
    heading: "Acceptance of Terms",
    body: [
      "By accessing or using banarasikala.com, you agree to be bound by these Terms & Conditions together with our Privacy Policy, Shipping Policy, Return & Exchange Policy, Cancellation Policy and Disclaimer. If you do not agree, please do not use the site.",
      "We may update these terms at any time. Continued use of the site after a change means you accept the revised terms.",
    ],
  },
  {
    heading: "Your Account",
    body: [
      "You can register with an email address and password, or sign in with Google. If you register with an email address, you must verify it before you can log in — an unverified account cannot sign in. Signing in with Google verifies your email automatically, and a Google sign-in can be linked to an existing account using the same address.",
      "You are responsible for keeping your credentials confidential and for everything done under your account. Tell us at support@banarasikala.com immediately if you suspect unauthorised use.",
      [
        "You must be at least 18 years old to hold an account",
        "The information you give us must be accurate and kept up to date",
        "One person may not operate multiple accounts to obtain rewards more than once",
        "Accounts used fraudulently may be suspended, and rewards on them reversed",
      ],
    ],
  },
  {
    heading: "Products, Pricing and Availability",
    body: [
      "Prices are in Indian Rupees and include applicable taxes unless stated otherwise. We may change prices at any time, but the price shown when you place your order is the price honoured for that order.",
      "Availability is tracked per colour, so a saree can be in stock in one colour and sold out in another. Listings are subject to availability and may be withdrawn at any time.",
      "Our sarees are handwoven, so variation in weave, motif placement and finish between individual pieces is expected. What that means in practice is set out in our Disclaimer.",
    ],
  },
  {
    heading: "Orders and Payment",
    body: [
      "Placing an order is an offer to buy, which we accept by confirming it. We may decline or cancel an order where a listing carried a pricing error, where stock is unavailable, where the delivery address is not serviceable, or where we suspect fraud. In every such case you are refunded in full.",
      "Online payments are processed by Razorpay. We never receive or store your card number, CVV or UPI PIN — see Secure Payments.",
      "Cash on Delivery is offered up to a maximum order value shown at checkout, and is withdrawn from accounts whose previous Cash on Delivery order was returned to us undelivered.",
      "A platform fee applies to every order. Cash on Delivery adds a handling fee, gift wrapping adds a charge if you choose it, and paying online earns a prepaid discount. All of these are itemised before you pay.",
    ],
  },
  {
    heading: "Wallet Credit",
    body: [
      "Your Banarasi Kala wallet holds store credit. It can be applied against orders on this site and is not redeemable for cash, transferable between accounts, or withdrawable to a bank account.",
      "Credit reaches your wallet in one of two ways. Some is available immediately; some is held and becomes spendable on a stated release date. Your wallet shows which is which.",
      "Held credit is not guaranteed. If the order that earned it is cancelled or returned before the release date, the credit is withdrawn, because the purchase that justified it did not stand.",
      "Wallet credit spent on an order is returned to your wallet if that order is later cancelled or returned. Refunds of wallet credit always go back to the wallet, not to a bank account.",
      "We may adjust or reverse credit that was issued in error or obtained by abuse of a promotion.",
    ],
  },
  {
    heading: "Signup Bonus and Referrals",
    body: [
      "Every first-time signup receives a welcome bonus in wallet credit. It is granted once per account.",
      "Each account has its own referral code. A new customer may apply one referral code, once, and only before any code has been applied to that account. You cannot apply your own code, and an invalid code is rejected.",
      "The customer who applies a valid code receives their referral bonus in wallet credit straight away.",
      "The referrer is rewarded on a milestone rather than per signup. Once a set number of distinct customers they referred have each had at least one order delivered, a milestone bonus is created for the referrer and released after a holding period measured from that delivery. The milestone bonus is paid once per referrer.",
      "The holding period exists so rewards settle only on completed business. If the qualifying order is returned or cancelled during it, the pending bonus is cancelled.",
      "Referral rewards are for genuine referrals of different people. Self-referral, duplicate accounts, and coordinated signups created to trigger a milestone are not, and we may reverse rewards and close the accounts involved.",
    ],
  },
  {
    heading: "Coupons and Discounts",
    body: [
      "Coupons may be a percentage of your basket or a fixed amount. A percentage coupon can carry a maximum discount cap, and any coupon can carry a minimum purchase value below which it does not apply.",
      "Coupons may be limited in total number of uses, limited per customer — normally one use each — and restricted to a validity period. A coupon that is inactive, outside its dates, or already used to its limit will not apply.",
      "If you return part of an order that used a coupon, the discount is recalculated against the items you keep, and where the original coupon no longer qualifies we automatically apply the best coupon those items do qualify for. The mechanics are set out in our Return & Exchange Policy.",
      "Coupons have no cash value and cannot be combined unless a promotion says so explicitly.",
    ],
  },
  {
    heading: "Delivery, Returns and Cancellation",
    body: [
      "Delivery is free on every order across India. Delivery dates shown on product pages are estimates based on the courier's own timeline for your pin code plus that product's processing time, and are not guarantees. Full details are in our Shipping Policy.",
      "Delivered orders may be returned or exchanged within 7 days, one return and one exchange per order. Orders may be cancelled free of charge before dispatch. See the Return & Exchange Policy and Cancellation Policy for eligibility, deductions and refund routes.",
      "If a parcel cannot be delivered and comes back to us, you have 7 days to pay the re-dispatch charge or take a refund, as set out in the Shipping Policy.",
    ],
  },
  {
    heading: "Reviews and Content You Submit",
    body: [
      "You may review a product only after that product has been delivered to your account, and a review is tied to the order it came from. This is what keeps our ratings honest.",
      "Reviews are moderated and are not published until approved. We may decline content that is abusive, misleading, unlawful, infringes someone else's rights, or is unrelated to the product.",
      "The same applies to comments and other contributions anywhere on the site. By submitting content you confirm it is yours to submit, and you grant us a non-exclusive licence to display it on the site in connection with the product or page it relates to.",
      "We do not pay for reviews and we do not remove genuine reviews because they are unfavourable.",
    ],
  },
  {
    heading: "Support and the Chat Assistant",
    body: [
      "Our chat assistant answers questions using live catalogue and order data. It can still be wrong or incomplete.",
      "Where the assistant conflicts with a product page, an order record, or these policies, those prevail. Nothing the assistant says varies these terms or creates a commitment we have not made elsewhere.",
    ],
  },
  {
    heading: "Acceptable Use",
    body: [
      "You may not use this site to break the law, interfere with its operation or security, scrape or copy the catalogue in bulk, place orders you do not intend to accept, or abuse promotions, coupons, referrals or the returns process.",
      "We may suspend or close accounts, cancel orders and withdraw rewards where we reasonably believe any of this is happening.",
    ],
  },
  {
    heading: "Intellectual Property",
    body: [
      "All content on this site — photographs, text, logos, designs and the arrangement of the site itself — belongs to Banarasi Kala or is used with permission, and is protected by intellectual property law.",
      "You may not reproduce, distribute, or use it commercially without our prior written consent. Personal, non-commercial use of the site as a shopper is of course fine.",
    ],
  },
  {
    heading: "Limitation of Liability",
    body: [
      "We are not liable for indirect, incidental or consequential loss arising from your use of the site or our products.",
      "Our total liability for any claim will not exceed what you paid for the product or service the claim concerns.",
      "Nothing here limits liability that cannot be limited under Indian law, including for death or personal injury caused by negligence, or for fraud.",
    ],
  },
  {
    heading: "Governing Law",
    body: [
      "These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts of Varanasi, Uttar Pradesh.",
    ],
  },
];

const TermsConditions = () => (
  <PolicyPage
    title="Terms & Conditions"
    subtitle="Please read these carefully before using the site or placing an order."
    sections={sections}
    downloadable
  />
);

export default TermsConditions;
