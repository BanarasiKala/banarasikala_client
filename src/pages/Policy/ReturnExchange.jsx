import PolicyPage from "./PolicyPage";

const sections = [
  {
    heading: "Return Window",
    body: [
      "We accept returns within 7 days of delivery. To be eligible, items must be unused, unworn, unwashed, and in their original packaging with all tags intact.",
      "Returns initiated after 7 days of the delivery date will not be accepted.",
    ],
  },
  {
    heading: "Non-Returnable Items",
    body: [
      "The following items cannot be returned or exchanged:",
      [
        "Items purchased during sale or at a discounted price",
        "Custom-made or personalised orders",
        "Items that have been worn, washed, or altered",
        "Items without original tags or packaging",
      ],
    ],
  },
  {
    heading: "How to Initiate a Return",
    body: [
      "To start a return, please email us at support@banarasikala.com with your order number, reason for return, and clear photos of the item. Our team will review and respond within 2 business days.",
      "Once approved, we will arrange a reverse pickup from your delivery address at no extra cost.",
    ],
  },
  {
    heading: "Exchange Policy",
    body: [
      "Exchanges are available for a different size or colour of the same product, subject to availability. If the desired variant is unavailable, a store credit or refund will be offered.",
      "Each order is eligible for one exchange only.",
    ],
  },
  {
    heading: "Damaged or Incorrect Items",
    body: [
      "If you receive a damaged, defective, or incorrect item, please contact us within 48 hours of delivery with photographs. We will arrange a replacement or full refund at no additional cost.",
    ],
  },
];

const ReturnExchange = () => (
  <PolicyPage
    title="Return & Exchange"
    subtitle="Your satisfaction is our priority. We make returns simple and hassle-free."
    sections={sections}
  />
);

export default ReturnExchange;
