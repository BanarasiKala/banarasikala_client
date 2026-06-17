import { useEffect, useRef, useState } from "react";
import { API_ENDPOINTS } from "../config/api";
import { Icon } from "@iconify/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ChevronUp,
  Mail,
  MapPin,
  Send,
  Phone,
} from "lucide-react";
import logo from "../assets/vertical_logo.png";
import footerBackground from "../assets/header_backgroung.png";
import "./Footer.css";

const quickLinks = [
  ["Home", "/"],
  ["Sarees", "/collection"],
  ["New Arrivals", "/#new-arrivals"],
  ["Special Collections", "/collection?sort=special"],
  ["About Us", "/about"],
  ["Contact Us", "/contact"],
  ["Feedback", "/feedback"],
];

const supportLinks = [
  ["FAQs", "/contact"],
  ["Track Order", "/my-orders"],
  ["Shipping Policy", "/shipping-policy"],
  ["Return & Exchange", "/return-exchange"],
  ["Cancellation Policy", "/refund-policy"],
  ["Size Guide", "/collection"],
  ["Care Instructions", "/about"],
];

const policyLinks = [
  ["Terms & Conditions", "/terms-conditions"],
  ["Privacy Policy", "/privacy-policy"],
  ["Refund Policy", "/refund-policy"],
  ["Secure Payments", "/terms-conditions"],
  ["Disclaimer", "/privacy-policy"],
];

const payments = [
  { icon: "logos:visa",           label: "Visa" },
  { icon: "logos:mastercard",     label: "Mastercard" },
  { text: "RuPay",                label: "RuPay",     color: "#1a9ad7" },
  { text: "UPI",                  label: "UPI",       color: "#097939" },
  { icon: "logos:google-pay",     label: "Google Pay" },
  { icon: "simple-icons:phonepe", label: "PhonePe",   color: "#5f259f" },
  { icon: "simple-icons:paytm",   label: "Paytm",     color: "#002970" },
];

const marketplaces = [
  { icon: "simple-icons:amazon",  label: "Amazon",   color: "#FF9900", href: "https://www.amazon.in" },
  { icon: "simple-icons:flipkart",label: "Flipkart", color: "#2874F0", href: "https://www.flipkart.com" },
  { icon: "myntra",               label: "Myntra",   color: "#FF3F6C", href: "https://www.myntra.com" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Footer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const footerRef = useRef(null);
  const [showTop, setShowTop] = useState(false);

  const [subEmail, setSubEmail] = useState("");
  const [subError, setSubError] = useState("");
  const [subSuccess, setSubSuccess] = useState("");
  const [subLoading, setSubLoading] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    const email = subEmail.trim().toLowerCase();
    if (!email) { setSubError("Please enter your email address."); return; }
    if (!EMAIL_RE.test(email)) { setSubError("Please enter a valid email address."); return; }
    setSubError(""); setSubSuccess(""); setSubLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.newsletterSubscribe, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.alreadySubscribed) {
          setSubError("This email is already subscribed. Thank you!");
        } else {
          setSubError(data.message || "Something went wrong. Please try again.");
        }
      } else {
        setSubSuccess(data.message || "You're subscribed!");
        setSubEmail("");
      }
    } catch {
      setSubError("Could not subscribe right now. Please try again.");
    } finally {
      setSubLoading(false);
    }
  };

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setShowTop(entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const refreshFooterLink = (to) => (event) => {
    const target = new URL(to, window.location.origin);
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    const targetPath = `${target.pathname}${target.search}${target.hash}`;

    if (currentPath === targetPath) {
      event.preventDefault();
      navigate(to, {
        replace: true,
        state: { refreshKey: Date.now() },
      });
      window.setTimeout(() => {
        if (target.hash) {
          document.querySelector(target.hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        }
      }, 40);
    }
  };

  return (
    <footer
      ref={footerRef}
      className="bk-footer"
      style={{ "--bk-footer-bg": `url(${footerBackground})` }}
    >
      <div className="bk-footer-main">
        <div className="bk-footer-brand">
          <Link to="/" onClick={refreshFooterLink("/")} className="bk-footer-logo" aria-label="Banarasi Kala home">
            <img src={logo} alt="Banarasi Kala" />
          </Link>
          <p>
            Timeless weaves. Unmatched quality.
            <span>Pure Banarasi.</span>
          </p>
          <div className="bk-footer-socials" aria-label="Social links">
            <a
              href="https://www.instagram.com/banarasikala_?igsh=Z3dmdGxncDliaDQy&utm_source=qr"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
            >
              <Icon icon="mdi:instagram"></Icon>
            </a>
            <a
              href="https://www.facebook.com/share/1KX26mnhfz/?mibextid=wwXIfr"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
            >
              <Icon icon="mdi:facebook"></Icon>
            </a>
            <a
              href="https://youtube.com/@banarasi_kala?si=avjJ1hM8SESwwAn7"
              target="_blank"
              rel="noreferrer"
              aria-label="YouTube"
            >
              <Icon icon="mdi:youtube"></Icon>
            </a>
          </div>
        </div>

        <nav className="bk-footer-column" aria-label="Quick links">
          <h3>Quick Links</h3>
          <span className="bk-footer-rule" aria-hidden="true" />
          <ul>
            {quickLinks.map(([label, path]) => (
              <li key={label}>
                <Link to={path} onClick={refreshFooterLink(path)}>
                  {label}
                  {label === "Sarees" && <ChevronRight size={12} />}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="bk-footer-column" aria-label="Help and support">
          <h3>Help &amp; Support</h3>
          <span className="bk-footer-rule" aria-hidden="true" />
          <ul>
            {supportLinks.map(([label, path]) => (
              <li key={label}>
                <Link to={path} onClick={refreshFooterLink(path)}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="bk-footer-column" aria-label="Policies">
          <h3>Policies</h3>
          <span className="bk-footer-rule" aria-hidden="true" />
          <ul>
            {policyLinks.map(([label, path]) => (
              <li key={label}>
                <Link to={path} onClick={refreshFooterLink(path)}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="bk-footer-updates">
          <h3>Stay Updated</h3>
          <span className="bk-footer-rule" aria-hidden="true" />
          <p className="bk-footer-updates-tagline">
            Be the first to discover new arrivals, exclusive offers &amp; timeless Banarasi stories — straight to your inbox.
          </p>
          <form className="bk-footer-subscribe" onSubmit={handleSubscribe} noValidate>
            <input
              type="email"
              placeholder="Enter your email"
              aria-label="Email address"
              value={subEmail}
              onChange={(e) => { setSubEmail(e.target.value); setSubError(""); setSubSuccess(""); }}
              disabled={subLoading}
            />
            <button type="submit" aria-label="Subscribe" disabled={subLoading}>
              {subLoading ? <span className="bk-footer-sub-spinner" /> : <Send size={16} />}
            </button>
          </form>
          {subError && <p className="bk-footer-sub-msg bk-footer-sub-error">{subError}</p>}
          {subSuccess && <p className="bk-footer-sub-msg bk-footer-sub-success">{subSuccess}</p>}
        </div>
      </div>

      <div className="bk-footer-info">
        <div className="bk-footer-contact">
          <h3>Contact Us</h3>
          <span className="bk-footer-rule" aria-hidden="true" />
          {/* <p>
            <Phone size={15} />
            +91 98765 43210
          </p> */}
          <p>
            <Mail size={15} />
            support@banarasikala.com
          </p>
          <p>
            <MapPin size={15} />
           Varanasi, Uttar Pradesh, India
          </p>
        </div>

        <div className="bk-footer-payments">
          <h3>We Accept</h3>
          <span className="bk-footer-rule" aria-hidden="true" />
          <div className="bk-footer-payment-row" aria-label="Accepted payments">
            {payments.map(({ icon, text, label, color }) => (
              <span key={label} className="bk-footer-pay-badge" title={label}>
                {icon
                  ? <Icon icon={icon} style={color ? { color } : undefined} />
                  : <span className="bk-footer-pay-text" style={{ color }}>{text}</span>
                }
              </span>
            ))}
          </div>
          <div className="bk-footer-razorpay">
            <Icon icon="simple-icons:razorpay" className="bk-footer-razorpay-icon" />
            <span>Secured by Razorpay</span>
          </div>
        </div>

        <div className="bk-footer-marketplaces">
          <h3>Also Available On</h3>
          <span className="bk-footer-rule" aria-hidden="true" />
          <div className="bk-footer-market-row">
            {marketplaces.map(({ icon, label, color, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="bk-footer-market-badge"
                aria-label={label}
                title={label}
              >
                {icon === "myntra"
                  ? <img src="/image.png" alt="Myntra" className="bk-footer-myntra-img" />
                  : <Icon icon={icon} style={{ color }} />
                }
                <span>{label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="bk-footer-bottom">
        <p>© 2026 Banarasi Kala. All Rights Reserved.</p>
        <span aria-hidden="true" />
      </div>

      <button
        type="button"
        className={`bk-back-to-top${showTop ? " is-visible" : ""}`}
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ChevronUp size={22} strokeWidth={2.5} />
      </button>
    </footer>
  );
};

export default Footer;

