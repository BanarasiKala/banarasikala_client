/**
 * One source for both the home page's short list and the full /faqs page. Kept here rather
 * than inside either component so an answer is never corrected in one place and left stale
 * in the other.
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
          "Once your order is shipped you will receive a tracking link by SMS and email, powered by Shiprocket. You can also track it any time from the My Orders section after logging in.",
      },
      {
        question: "How many days does delivery take?",
        answer:
          "Orders are processed within 2–3 business days, then typically delivered in 3–5 business days to metro cities, 5–7 to tier 2 and 3 cities, and 7–10 to remote areas.",
      },
      {
        question: "Do you offer Cash on Delivery (COD)?",
        answer:
          "Yes, Cash on Delivery is available on selected pin codes. If your pin code is eligible, the option appears at checkout.",
      },
      {
        question: "Do sarees include blouse pieces?",
        answer:
          "Yes. Most sarees come with an unstitched 0.8 metre blouse piece cut from the same weave, unless the listing says otherwise.",
      },
      {
        question: "What are the shipping charges?",
        answer:
          "Shipping is free on all orders above ₹1,499. A flat fee of ₹99 applies below that, and express delivery is available at ₹199 for select pin codes.",
      },
      {
        question: "Can I cancel or change my order?",
        answer:
          "You can cancel free of charge any time before dispatch, from My Orders. Addresses can be corrected before dispatch too — contact us quickly. Items cannot be swapped after checkout.",
      },
      {
        question: "Do you ship internationally?",
        answer:
          "Not at present. We currently deliver across India only.",
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
          "Yes. Returns are accepted within 7 days of delivery, provided the saree is unused, unwashed, and carries its original tags and packaging. Exchanges are available for a different colour of the same product, subject to availability.",
      },
      {
        question: "Is return pickup free?",
        answer:
          "Yes. Once a return is approved we arrange a reverse pickup from your delivery address at no extra cost.",
      },
      {
        question: "When will I get my refund?",
        answer:
          "Approved refunds are processed within 5–7 business days of us receiving and inspecting the item, then credited by your bank in a further 1–7 days depending on the payment method.",
      },
      {
        question: "What if my saree arrives damaged or incorrect?",
        answer:
          "Contact us within 48 hours of delivery with photographs. We will arrange a replacement or a full refund at no cost to you.",
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
          "Yes. Every piece is handwoven in Varanasi by weavers we buy from directly.",
      },
      {
        question: "How should I care for my saree?",
        answer:
          "Dry clean only, iron on the reverse over a thin cotton cloth, and store wrapped in muslin rather than plastic. Our Care Instructions page covers this in full.",
      },
      {
        question: "What size is a saree?",
        answer:
          "Sarees are one size — they are draped, not fitted. Ours are 5.5 metres long and 44–47 inches wide, plus a 0.8 metre blouse piece. See the Size Guide for details.",
      },
    ],
  },
  {
    category: "Payments & Account",
    items: [
      {
        question: "Are online payments secure?",
        answer:
          "Yes. All transactions are encrypted and processed through Razorpay, a PCI DSS certified gateway. We never see or store your card number, CVV, or UPI PIN.",
      },
      {
        question: "My payment failed but money was deducted. What should I do?",
        answer:
          "Such payments are reversed automatically, usually within 5–7 business days. If the amount has not returned after that, send us the date, amount and payment reference and we will trace it with the gateway.",
      },
      {
        question: "How does the Banarasi Kala wallet work?",
        answer:
          "Signup bonuses, referral rewards and any store credit sit in your wallet and can be applied at checkout against a future order.",
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
