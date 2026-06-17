import PolicyPage from "./PolicyPage";

const sections = [
  {
    heading: "Processing Time",
    body: [
      "All orders are processed within 2–3 business days after payment confirmation. Orders placed on weekends or public holidays are processed on the next working day.",
      "You will receive an email with your order confirmation and tracking details once your order is dispatched.",
    ],
  },
  {
    heading: "Delivery Timeline",
    body: [
      "We deliver across India. Estimated delivery times are:",
      [
        "Metro cities (Delhi, Mumbai, Bangalore, etc.): 3–5 business days",
        "Tier 2 & Tier 3 cities: 5–7 business days",
        "Remote / hilly areas: 7–10 business days",
      ],
      "These are estimates and may vary due to courier delays, festivals, or unforeseen circumstances.",
    ],
  },
  {
    heading: "Shipping Charges",
    body: [
      "Free shipping on all orders above ₹1,499.",
      "A flat shipping fee of ₹99 applies to orders below ₹1,499.",
      "Express delivery (1–3 business days) is available at ₹199 for select pin codes.",
    ],
  },
  {
    heading: "Order Tracking",
    body: [
      "Once your order is shipped, you will receive an SMS and email with a tracking link powered by Shiprocket. You can also track your order from the My Orders section after logging in.",
    ],
  },
  {
    heading: "Undelivered Orders",
    body: [
      "If a delivery attempt fails and the package is returned to us, we will contact you to rearrange delivery. Re-delivery charges may apply.",
      "Please ensure your delivery address and phone number are accurate at the time of placing the order.",
    ],
  },
];

const ShippingPolicy = () => (
  <PolicyPage
    title="Shipping Policy"
    subtitle="We ensure your saree reaches you safely and on time."
    sections={sections}
  />
);

export default ShippingPolicy;
