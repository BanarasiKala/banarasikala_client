import PolicyPage from "./PolicyPage";

const sections = [
  {
    heading: "Information We Collect",
    body: [
      "When you use Banarasi Kala, we may collect the following types of information:",
      [
        "Personal details: name, email address, phone number, and delivery address",
        "Payment information (processed securely by Razorpay — we do not store card details)",
        "Order history and preferences",
        "Device and browser data for analytics and security",
        "Cookies and usage data when you browse our website",
      ],
    ],
  },
  {
    heading: "How We Use Your Information",
    body: [
      "We use the information we collect to:",
      [
        "Process and fulfil your orders",
        "Send order confirmations, shipping updates, and invoices",
        "Respond to your queries and provide customer support",
        "Improve our website, products, and services",
        "Send promotional offers and updates (you may opt out at any time)",
        "Detect and prevent fraud or security issues",
      ],
    ],
  },
  {
    heading: "Sharing of Information",
    body: [
      "We do not sell or rent your personal information to third parties. We may share your data with trusted service providers who assist in operating our business:",
      [
        "Shiprocket — for order delivery and tracking",
        "Razorpay — for secure payment processing",
        "Cloudinary — for image hosting",
        "Email and SMS providers for communication",
      ],
      "These partners are contractually obligated to keep your information confidential and use it only for the specified purposes.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "We use cookies to enhance your browsing experience, remember your preferences, and analyse website traffic. You can control cookies through your browser settings.",
      "Disabling cookies may affect the functionality of certain features on our website.",
    ],
  },
  {
    heading: "Data Security",
    body: [
      "We implement industry-standard security measures to protect your personal information from unauthorised access, disclosure, or misuse.",
      "However, no method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.",
    ],
  },
  {
    heading: "Your Rights",
    body: [
      "You have the right to:",
      [
        "Access the personal information we hold about you",
        "Request correction of inaccurate data",
        "Request deletion of your account and associated data",
        "Opt out of marketing communications at any time",
      ],
      "To exercise any of these rights, contact us at support@banarasikala.com.",
    ],
  },
  {
    heading: "Changes to This Policy",
    body: [
      "We may update this Privacy Policy from time to time. The latest version will always be available on this page. We encourage you to review it periodically.",
    ],
  },
];

const PrivacyPolicy = () => (
  <PolicyPage
    title="Privacy Policy"
    subtitle="We respect your privacy and are committed to protecting your personal information."
    sections={sections}
  />
);

export default PrivacyPolicy;
