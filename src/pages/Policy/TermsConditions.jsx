import PolicyPage from "./PolicyPage";

const sections = [
  {
    heading: "Acceptance of Terms",
    body: [
      "By accessing or using the Banarasi Kala website (banarasikala.com), you agree to be bound by these Terms & Conditions. If you do not agree, please refrain from using our services.",
      "We reserve the right to update these terms at any time. Continued use of the website after changes implies acceptance.",
    ],
  },
  {
    heading: "Products & Pricing",
    body: [
      "All products listed on our website are subject to availability. We reserve the right to discontinue any product at any time without prior notice.",
      "Prices are listed in Indian Rupees (INR) and are inclusive of applicable taxes unless stated otherwise. We reserve the right to change prices at any time. However, the price at the time of placing an order will be honoured.",
    ],
  },
  {
    heading: "Account Responsibilities",
    body: [
      "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.",
      "Please notify us immediately at support@banarasikala.com if you suspect any unauthorised use of your account.",
      [
        "You must be at least 18 years old to create an account",
        "Providing false or misleading information is prohibited",
        "Creating multiple accounts for fraudulent purposes is not allowed",
      ],
    ],
  },
  {
    heading: "Orders & Payments",
    body: [
      "Placing an order constitutes an offer to purchase. We reserve the right to cancel any order in case of pricing errors, stock unavailability, or suspected fraud.",
      "All payments are processed securely through Razorpay. By completing a purchase, you confirm that the payment information provided is accurate and belongs to you.",
    ],
  },
  {
    heading: "Intellectual Property",
    body: [
      "All content on this website — including images, text, logos, and designs — is the property of Banarasi Kala and is protected under applicable intellectual property laws.",
      "You may not reproduce, distribute, or use any content from this website without our prior written consent.",
    ],
  },
  {
    heading: "Limitation of Liability",
    body: [
      "Banarasi Kala shall not be liable for any indirect, incidental, or consequential damages arising from the use of our products or services.",
      "Our total liability to you for any claim shall not exceed the amount paid by you for the specific product or service in question.",
    ],
  },
  {
    heading: "Governing Law",
    body: [
      "These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Varanasi, Uttar Pradesh.",
    ],
  },
];

const TermsConditions = () => (
  <PolicyPage
    title="Terms & Conditions"
    subtitle="Please read these terms carefully before using our website or placing an order."
    sections={sections}
  />
);

export default TermsConditions;
