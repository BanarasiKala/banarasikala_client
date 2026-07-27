import PolicyPage from "./PolicyPage";

/**
 * Reflects what the code actually collects and where it goes: Customer/OrderAddress models,
 * AuthService (Google sign-in), AiChatService (chat to Anthropic) and ChatToolHandlers (order
 * data reachable from chat), ShipRocketService, Razorpay, Cloudinary/S3, LocationContext
 * (GPS → Google Geocoding). Retention periods and rights are not code-derived and should be
 * reviewed against the DPDP Act by a lawyer.
 */
const sections = [
  {
    heading: "What We Collect",
    body: [
      "From you: your name, email, phone and password — or a Google account if you sign in that way. Passwords are stored only as a cryptographic hash. Per order, the delivery address, recipient name and phone, and any gift message. Reviews and ratings including photographs, and messages to support or the chat assistant. Your email if you subscribe to the newsletter or ask to be told when something is back in stock.",
      "Automatically: your location only if you allow it — coordinates are converted to a six-digit pin code so we can show a real delivery date, and only the pin code is kept. Refusing is fine; you simply see no date until you enter an address. Also your IP address and session tokens, needed to serve the site securely.",
      "In your browser: your pin code, cart selections, wallet preference and scroll position are stored on your own device and can be cleared from your browser settings.",
    ],
  },
  {
    heading: "Why We Use It",
    body: [
      "To process, deliver and invoice your orders and handle cancellations, returns, exchanges and refunds; to run your account and verify your email; to operate the wallet, referral and coupon programmes; to answer your questions; to send order updates, which are not marketing; to send newsletters if you subscribed; and to prevent fraud and promotion abuse.",
    ],
  },
  {
    heading: "Who We Share It With",
    body: [
      "Only what each service needs:",
      [
        "Shiprocket and courier partners — recipient name, address and phone, to deliver and track",
        "Razorpay — your payment completes on their infrastructure; we get a reference and status, never your card number, CVV or UPI PIN",
        "Anthropic — provides the Claude model behind our chat assistant (see below)",
        "Google — sign-in if you choose it, and converting coordinates to a pin code if you allow location",
        "Email and SMS providers — order updates, verification links and one-time passwords",
        "Cloudinary and Amazon S3 — hosting product media and review photographs",
      ],
      "We also disclose where the law requires it or to establish or defend legal claims. We do not sell personal information and do not share it with advertisers.",
    ],
  },
  {
    heading: "The Chat Assistant",
    body: [
      "Our assistant is powered by Claude, provided by Anthropic, and what you type is sent to Anthropic to generate a reply.",
      "If you are signed in it can look up your own orders — status, contents, return eligibility — and that information is sent with your message. It can only ever reach your own orders: the lookup is bound to your signed-in account and cannot be redirected by anything typed into the chat. If you would rather not, email support instead.",
    ],
  },
  {
    heading: "Cookies, Retention and Security",
    body: [
      "We use only cookies and browser storage necessary for the site to work — sign-in, cart, pin code, preferences. No advertising or cross-site tracking cookies. Blocking essential cookies stops sign-in and checkout working.",
      "Order records are kept as long as tax, accounting and dispute obligations require. Account information is kept while your account is open; close it and we delete or anonymise what we need not retain. Newsletter subscriptions are kept until you unsubscribe.",
      "The site is served over HTTPS, passwords are hashed, and payment credentials never reach our servers. Access within our team is limited to those who need it. No system is perfectly secure — please use a strong, unique password and tell us at once if you suspect someone else has accessed your account.",
    ],
  },
  {
    heading: "Your Choices",
    body: [
      "You can update your name, phone and saved addresses from your profile; unsubscribe using the link in any newsletter; revoke location permission in your browser; and clear stored site data at any time.",
      "You can ask for a copy of the information we hold, ask us to correct it, or ask us to delete your account — write to support@banarasikala.com. Some records must be retained where the law requires it, order and tax records in particular.",
      "This site is for adults; accounts require you to be at least 18. We do not knowingly collect information from children — tell us if you believe we have and we will remove it.",
    ],
  },
  {
    heading: "Changes",
    body: [
      "We may update this policy as the site changes. The current version always lives here, and continued use after an update means you accept it. For any privacy question, write to support@banarasikala.com.",
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
