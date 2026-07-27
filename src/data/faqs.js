/**
 * One source for both the home page's short list and the full /faqs page. Kept here rather
 * than inside either component so an answer is never corrected in one place and left stale
 * in the other.
 *
 * Answers are written against the implementation and must stay in step with the policy pages
 * in src/pages/Policy, which cite the specific services they were derived from. Anything
 * driven by environment config (COD cap, prepaid discount, platform fee, reward amounts) is
 * described rather than printed, so a config change cannot silently make this page lie.
 *
 * Order matters: the home section shows the first HOME_FAQ_COUNT of the flattened list, so
 * the broadest questions are deliberately first.
 */
export const FAQ_GROUPS = [
  {
    category: "Orders & Delivery",
    items: [
      {
        question: "How can I track my order?",
        answer:
          "Once your order is handed to the courier you receive a tracking number, and your order moves through pickup scheduled, picked up, shipped, out for delivery and delivered. You can follow all of it from My Orders at any time.",
      },
      {
        question: "How many days does delivery take?",
        answer:
          "Rather than quote a range, we show a specific delivery date on every product page once we know your pin code. It is the courier's own estimated arrival for that pin code plus the time we need to prepare that particular saree. Dates are estimates, not guarantees — weather, festivals and courier backlogs move them.",
      },
      {
        question: "What are the delivery charges?",
        answer:
          "There are none. Delivery is free on every order across India — no minimum order value, no flat fee, and no surcharge for remote pin codes. The only delivery-related charge you may see is the Cash on Delivery handling fee, and only if you choose to pay that way.",
      },
      {
        question: "Do you offer Cash on Delivery (COD)?",
        answer:
          "Yes, up to a maximum order value shown at checkout; larger orders are prepaid only. A handling fee applies — it is the courier's own charge for collecting cash. Paying online avoids it and earns a prepaid discount. If a previous COD order of yours came back undelivered, COD is switched off for your account.",
      },
      {
        question: "Can I cancel my order?",
        answer:
          "Yes, within 24 hours of placing it and before it is dispatched, from My Orders. Cancellation is whole-order only — you cannot remove individual sarees. Cancelling before dispatch refunds everything, including the platform fee and gift charge. After that window, wait for delivery and use the return route instead.",
      },
      {
        question: "What if my parcel cannot be delivered?",
        answer:
          "If all delivery attempts fail the parcel comes back to us and you are told. From then you have 7 days to either pay the re-dispatch charge and have it sent again, or take a refund. After 7 days only a refund is available, and one re-dispatch is offered per order.",
      },
      {
        question: "Do you ship internationally?",
        answer:
          "Not at present. We deliver across India, to any pin code our courier partners serve.",
      },
      {
        question: "Do you accept bulk or wholesale orders?",
        answer:
          "Yes, we accept bulk and wedding collection orders. Please contact us for special pricing.",
      },
    ],
  },
  {
    category: "Returns, Exchange & Refunds",
    items: [
      {
        question: "Can I return or exchange my saree?",
        answer:
          "Yes. Delivered orders carry a 7-day window, and each order allows one return and one exchange — independently, so raising an exchange does not use up your return. The saree must come back unused, unwashed and unaltered with its original tags and packaging.",
      },
      {
        question: "Does the return pickup cost anything?",
        answer:
          "We book the reverse pickup for you, so you do not arrange a courier or pay at the door. The pickup charge is deducted from your refund — quoted live for your pin code and parcel weight, shown to you before you confirm, and locked in at that moment. It can never exceed the refund, so a return cannot leave you owing money.",
      },
      {
        question: "How does an exchange work?",
        answer:
          "An exchange is an even swap for any saree at exactly the same price with stock available, plus the same saree in another colour. No money moves in either direction and the replacement ships free. Exchanging several units does not tie you to one replacement — the quantities just have to add up.",
      },
      {
        question: "When and how will I get my refund?",
        answer:
          "The refund is recorded when you raise the request and settled once the parcel is back with us. Prepaid orders go back to the original payment method, Cash on Delivery orders by bank transfer (so we will ask for your account details), and any wallet credit returns to your wallet immediately. Once the gateway confirms it, the time to reach your account is set by your bank.",
      },
      {
        question: "What if my saree arrives damaged or incorrect?",
        answer:
          "Received damaged or defective and wrong product delivered are both listed reasons on the return and exchange flows — raise it the same way and choose that reason. Do so as soon as you notice and keep the packaging; photographs of the fault help us settle it quickly.",
      },
    ],
  },
  {
    category: "Products & Care",
    items: [
      {
        question: "Will the product colour exactly match the images?",
        answer:
          "Very closely, but slight variation is expected — colour depends on photography lighting and your screen's settings. A substantial mismatch is not normal, so tell us if you see one.",
      },
      {
        question: "Are your sarees genuine Banarasi?",
        answer:
          "Yes. Every piece is handwoven in Varanasi by weavers we buy from directly. Small irregularities in the weave and motif placement are inherent to handloom work and are marks of authenticity, not defects.",
      },
      {
        question: "What size is a saree, and is a blouse piece included?",
        answer:
          "Sarees are one size — they are draped, not fitted, so there is no size to choose. Each listing publishes that saree's own length and weight, and states whether a blouse piece is included; most of ours include one, as unstitched fabric cut from the same weave. See the Size Guide.",
      },
      {
        question: "How should I care for my saree?",
        answer:
          "Dry clean only, iron on the reverse over a thin cotton cloth, and store wrapped in muslin rather than plastic. Each listing also carries care written for that specific saree — where it differs from general advice, follow the listing.",
      },
      {
        question: "Can I review a product?",
        answer:
          "Yes, once it has been delivered to your account — reviews are tied to the order they came from, which is what keeps our ratings honest. Reviews are moderated before they appear, but we never remove a genuine review for being unfavourable.",
      },
    ],
  },
  {
    category: "Payments & Account",
    items: [
      {
        question: "Are online payments secure?",
        answer:
          "Yes. Payments are processed by Razorpay and complete on their infrastructure, so your card number, CVV and UPI PIN never reach us. Every payment is verified with a cryptographic signature that only we and the gateway can produce, which is what makes a forged payment confirmation impossible.",
      },
      {
        question: "My payment failed but money was deducted. What should I do?",
        answer:
          "Check My Orders first — if the order is there, it went through. Otherwise the payment is auto-reversed by the gateway, typically within 5–7 business days. If it has not returned after that, send us the date, amount and any reference your bank shows and we will trace it. Never reorder to force it through.",
      },
      {
        question: "How does the Banarasi Kala wallet work?",
        answer:
          "It holds store credit — a welcome bonus on signup, referral rewards, and refunds of wallet money — which you can apply against any order. Some credit is available immediately and some is held until a stated release date. It cannot be withdrawn to a bank account.",
      },
      {
        question: "How do referrals work?",
        answer:
          "Every account has a referral code. Whoever signs up with your code gets their bonus straight away. You are rewarded on a milestone rather than per signup: once enough of the people you referred have each had an order delivered, your bonus is created and released after a short holding period.",
      },
      {
        question: "How can I contact customer support?",
        answer:
          "Email support@banarasikala.com or use the chat on any page. We reply within one business day — please quote your order number for anything about an existing order.",
      },
    ],
  },
];

// Flattened in author order. The home section takes the first few from here.
export const FAQ_ITEMS = FAQ_GROUPS.flatMap((group) => group.items);

export const HOME_FAQ_COUNT = 4;
