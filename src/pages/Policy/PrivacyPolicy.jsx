import PolicyPage from "./PolicyPage";

/**
 * Written against what the code actually collects and where it sends it:
 *   server/src/models/Customer.js, OrderAddress.js — the fields we store
 *   server/src/services/AuthService.js             — email/password and Google sign-in
 *   server/src/services/AiChatService.js           — chat goes to Anthropic (Claude)
 *   server/src/services/ChatToolHandlers.js        — order data reachable from chat
 *   server/src/services/ShipRocketService.js       — address/phone to the courier
 *   client/src/context/LocationContext.jsx         — GPS → Google Geocoding for a pincode
 *   Razorpay (payments), Cloudinary/S3 (media), SMTP + SMS provider (notifications)
 * Legal framing (rights, retention periods, grievance officer) is not code-derived and should
 * be reviewed against the DPDP Act by a lawyer before publication.
 */
const sections = [
  {
    heading: "What This Covers",
    body: [
      "This policy explains what personal information banarasikala.com collects, why, who it is shared with, and what control you have over it. It applies to the website and to the order, support and account services reached through it.",
      "We collect what an order genuinely needs and the things you choose to give us. We do not sell your personal information to anyone.",
    ],
  },
  {
    heading: "Information You Give Us",
    body: [
      "Account: your name, email address, phone number and a password, or a Google account if you sign in that way. Passwords are stored only as a cryptographic hash, never in readable form.",
      "Orders: the delivery address, recipient name and phone number for each order, and any gift message you write. Address details are versioned per order, so correcting an address does not overwrite the one a past parcel actually went to.",
      "Content: reviews and ratings, including any photographs you attach, and messages you send to support or to the chat assistant.",
      "Other: your email address if you subscribe to the newsletter, and a product plus contact details if you ask to be notified when something is back in stock.",
    ],
  },
  {
    heading: "Information Collected Automatically",
    body: [
      "Location, only if you allow it. If you grant location permission, your coordinates are converted into a six-digit pin code so we can show a real delivery date instead of a vague range. We keep the pin code, not your coordinates. Refusing is fine — the site works, you simply see no delivery date until you enter an address.",
      "Local storage in your browser. Your active pin code, cart selections carried into checkout, wallet preference, scroll position and similar conveniences are stored on your own device so the site behaves sensibly between visits. That data stays in your browser and you can clear it from your browser settings at any time.",
      "Technical data needed to serve the site securely, including your IP address and session tokens.",
    ],
  },
  {
    heading: "Why We Use It",
    body: [
      "To take, process, deliver and invoice your orders, and to handle cancellations, returns, exchanges and refunds.",
      "To operate your account, verify your email address, and keep you signed in.",
      "To run the wallet, referral and coupon programmes, which means linking rewards to accounts and to the orders that earned them.",
      "To answer your questions through support and the chat assistant.",
      "To send transactional messages about your orders. These are not marketing, and they continue while an order is active.",
      "To send newsletters, only if you subscribed, and only until you unsubscribe.",
      "To detect and prevent fraud and abuse of promotions.",
    ],
  },
  {
    heading: "Who We Share It With",
    body: [
      "We share only what each service needs to do its job:",
      [
        "Courier partners, through Shiprocket — recipient name, delivery address and phone number, so your parcel can be delivered and tracked",
        "Razorpay, our payment gateway — your payment completes on their infrastructure; we receive a reference and a status, never your card number, CVV or UPI PIN",
        "Anthropic, which provides the Claude model behind our chat assistant — see the section below",
        "Google — for sign-in if you choose it, and to convert location coordinates into a pin code if you grant permission",
        "Our email and SMS providers — to send order updates, verification links and one-time passwords",
        "Cloudinary and Amazon S3 — where product media and any photographs you attach to a review are hosted",
      ],
      "We also disclose information where the law requires it, or to establish or defend legal claims.",
      "We do not sell personal information and we do not share it with advertisers.",
    ],
  },
  {
    heading: "The Chat Assistant",
    body: [
      "Our assistant is powered by Claude, provided by Anthropic. What you type into the chat is sent to Anthropic in order to generate a reply.",
      "If you are signed in, the assistant can look up your own orders — their status, contents and return eligibility — so it can answer questions about them, and that information is sent with your message. It can only ever reach your own orders: the lookup is bound to your signed-in account and cannot be redirected by anything typed into the chat.",
      "If you would rather your order details were not processed this way, email support instead.",
    ],
  },
  {
    heading: "Cookies and Similar Technology",
    body: [
      "We use cookies and browser storage that are necessary for the site to work — keeping you signed in, holding your cart, remembering your delivery pin code and your preferences.",
      "We do not use advertising or cross-site tracking cookies.",
      "Blocking essential cookies will stop sign-in and checkout from working.",
    ],
  },
  {
    heading: "How Long We Keep It",
    body: [
      "Order records — including the address a parcel was sent to and the money movements on it — are kept for as long as tax, accounting and dispute obligations require.",
      "Account information is kept while your account is open. Close it and we delete or anonymise whatever we are not required to retain.",
      "Newsletter subscriptions are kept until you unsubscribe.",
    ],
  },
  {
    heading: "Security",
    body: [
      "The site is served over HTTPS, so information is encrypted in transit. Passwords are stored hashed. Payment credentials never reach our servers.",
      "Access to customer data inside our team is limited to the people who need it to fulfil orders and provide support.",
      "No system is perfectly secure and we cannot guarantee absolute security. Please use a strong, unique password, and tell us immediately if you believe someone else has accessed your account.",
    ],
  },
  {
    heading: "Your Choices and Rights",
    body: [
      "You can view and update your name, phone number and saved addresses from your profile at any time.",
      "You can unsubscribe from the newsletter using the link in any newsletter email.",
      "You can revoke location permission in your browser, and clear stored site data from your browser settings.",
      "You can ask us for a copy of the personal information we hold about you, ask us to correct it, or ask us to delete your account. Write to support@banarasikala.com and we will respond within a reasonable period. Some records must be retained where the law requires it — order and tax records in particular.",
    ],
  },
  {
    heading: "Children",
    body: [
      "This site is intended for adults, and accounts require you to be at least 18. We do not knowingly collect information from children. If you believe a child has given us personal information, contact us and we will remove it.",
    ],
  },
  {
    heading: "Changes and Contact",
    body: [
      "We may update this policy as the site changes. The current version always lives on this page, and continued use of the site after an update means you accept the revised policy.",
      "For any privacy question or request, write to support@banarasikala.com.",
    ],
  },
];

const PrivacyPolicy = () => (
  <PolicyPage
    title="Privacy Policy"
    subtitle="What we collect, why, who it goes to, and what you can do about it."
    sections={sections}
    downloadable
  />
);

export default PrivacyPolicy;
