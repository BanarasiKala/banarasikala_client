import PolicyPage from "./PolicyPage";

const sections = [
  {
    heading: "Orders",
    body: [
      "How do I place an order? Choose your saree and colour, add it to the bag, and check out. You can pay online or, where your pin code supports it, choose Cash on Delivery.",
      "Do I need an account? You can browse freely, but an account is needed to check out so your order, wallet and returns stay tied to you.",
      "Can I change my order after placing it? The address can be corrected before dispatch — contact us quickly. Items cannot be swapped after checkout; cancel and reorder instead.",
      "Can I cancel? Yes, free of charge any time before dispatch, from My Orders. See our Cancellation Policy for what happens after that.",
    ],
  },
  {
    heading: "Shipping & Delivery",
    body: [
      "When will my order ship? Orders are processed within 2–3 business days of payment confirmation.",
      "How long does delivery take? Typically 3–5 business days to metro cities, 5–7 to tier 2 and 3 cities, and 7–10 to remote areas.",
      "What does shipping cost? Free above ₹1,499. A flat ₹99 applies below that, and express delivery is ₹199 for select pin codes.",
      "How do I track my order? You receive an SMS and email with a tracking link once dispatched, and can track from My Orders at any time.",
      "Do you ship internationally? Not at present. We deliver across India only.",
    ],
  },
  {
    heading: "Returns & Refunds",
    body: [
      "What is the return window? 7 days from delivery, provided the saree is unused, unwashed and carries its original tags and packaging.",
      "Is return pickup free? Yes. Once a return is approved we arrange a reverse pickup from your address at no cost.",
      "Can I exchange instead? Yes, for a different colour of the same product, subject to availability. One exchange per order.",
      "When do I get my money back? Approved refunds are processed within 5–7 business days of us receiving and inspecting the item, then credited by your bank in a further 1–7 days depending on the payment method.",
      "What if my saree arrives damaged? Contact us within 48 hours with photographs and we will replace it or refund you in full, at no cost to you.",
    ],
  },
  {
    heading: "Products",
    body: [
      "Are your sarees genuine Banarasi? Yes. Every piece is handwoven in Varanasi by weavers we buy from directly.",
      "Will the colour match the photograph? Very closely, but screens vary. Small differences are expected; a substantial mismatch is not, so tell us if you see one.",
      "Is a blouse piece included? Yes, an unstitched 0.8 metre piece cut from the same weave, unless a listing says otherwise.",
      "How do I care for the saree? Dry clean only, iron on the reverse over a cotton cloth, and store wrapped in muslin. Our Care Instructions page covers this in full.",
    ],
  },
  {
    heading: "Payments & Account",
    body: [
      "Which payment methods do you accept? Cards, UPI, net banking, wallets, your Banarasi Kala wallet balance, and Cash on Delivery where available.",
      "Are my card details safe? We never see them. Payments are processed by Razorpay on their PCI DSS certified infrastructure — see Secure Payments.",
      "Money left my account but the order failed. Such payments are auto-reversed within 5–7 business days. If it has not returned, send us the amount, date and reference and we will trace it.",
      "How does the wallet work? Referral and signup rewards, plus any store credit, sit in your wallet and can be applied at checkout against a future order.",
    ],
  },
  {
    heading: "Still Need Help?",
    body: [
      "If your question is not answered here, email support@banarasikala.com or use the chat on any page. We reply within one business day.",
      "For anything about an existing order, please quote your order number so we can pull it up straight away.",
    ],
  },
];

const Faqs = () => (
  <PolicyPage
    title="Frequently Asked Questions"
    subtitle="Quick answers on orders, delivery, returns and payments."
    sections={sections}
  />
);

export default Faqs;
