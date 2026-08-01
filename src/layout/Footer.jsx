import { useCallback, useEffect, useRef, useState } from "react";
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

// A null path marks the expandable Patterns group rather than a plain link, so the column's
// order stays declared in one place.
const PATTERNS_GROUP = null;

const quickLinks = [
  ["Home", "/"],
  ["Patterns", PATTERNS_GROUP],
  // Both point at the collection with the matching filter applied, so they land on the same
  // grid the home page's rails link into.
  ["New Arrivals", "/collection?newArrival=true"],
  ["Special Collections", "/collection?specialCollection=true"],
  ["About Us", "/about"],
  ["Contact Us", "/contact"],
  ["Feedback", "/feedback"],
];

const supportLinks = [
  ["FAQs", "/faqs"],
  ["Track Order", "/my-orders"],
  ["Return & Exchange", "/return-exchange"],
  ["Size Guide", "/size-guide"],
  ["Care Instructions", "/care-instructions"],
];

const policyLinks = [
  ["Shipping Policy", "/shipping-policy"],
  ["Terms & Conditions", "/terms-conditions"],
  ["Privacy Policy", "/privacy-policy"],
  ["Refund Policy", "/refund-policy"],
  // Sits next to Refund Policy — cancelling before dispatch is what triggers most refunds.
  ["Cancellation Policy", "/cancellation-policy"],
  ["Secure Payments", "/secure-payments"],
  ["Disclaimer", "/disclaimer"],
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

/**
 * Shown until the real list arrives, and kept as the fallback if that request fails —
 * the footer should never lose a whole section because one fetch did not come back.
 * The live list comes from /api/marketplaces, so adding a channel in the admin puts it
 * here without a deploy, and this array cannot drift out of step with the pages.
 */
const FALLBACK_MARKETPLACES = [
  { slug: "amazon",   name: "Amazon",   icon: "simple-icons:amazon",   accent_color: "#FF9900", status: "live" },
  { slug: "flipkart", name: "Flipkart", icon: "simple-icons:flipkart", accent_color: "#2874F0", status: "live" },
  { slug: "myntra",   name: "Myntra",   icon: "/image.png",            accent_color: "#FF3F6C", status: "coming_soon" },
];

// The mark is either an Iconify id ("simple-icons:amazon") or an image path ("/image.png"):
// Amazon and Flipkart have Iconify marks and Myntra does not. A slash or dot without a
// colon means it is a file.
const isImageMark = (icon) => Boolean(icon) && /[/.]/.test(icon) && !icon.includes(":");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Footer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const footerRef = useRef(null);
  const [showTop, setShowTop] = useState(false);
  const [marketplaces, setMarketplaces] = useState(FALLBACK_MARKETPLACES);

  // Live channel list. A failure leaves the fallback in place rather than emptying the
  // section — the footer is on every page and must not depend on this request.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(API_ENDPOINTS.marketplaces, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.marketplaces) && data.marketplaces.length > 0) {
          setMarketplaces(data.marketplaces);
        }
      } catch {
        /* keep the fallback */
      }
    })();
    return () => controller.abort();
  }, []);

  const [subEmail, setSubEmail] = useState("");
  const [subError, setSubError] = useState("");
  const [subSuccess, setSubSuccess] = useState("");
  const [subLoading, setSubLoading] = useState(false);

  const [patternsOpen, setPatternsOpen] = useState(false);
  const [patterns, setPatterns] = useState([]);
  const [patternsStatus, setPatternsStatus] = useState("idle");
  const patternsAbortRef = useRef(null);
  const patternsRef = useRef(null);

  const fetchPatterns = useCallback(async () => {
    patternsAbortRef.current?.abort();
    const controller = new AbortController();
    patternsAbortRef.current = controller;

    setPatternsStatus("loading");
    try {
      const response = await fetch(API_ENDPOINTS.varieties, { signal: controller.signal });
      if (!response.ok) throw new Error("Unable to load patterns");
      const data = await response.json();
      setPatterns(
        Array.isArray(data)
          ? data.filter((item) => item?.id && item?.name).map((item) => ({ id: item.id, name: item.name }))
          : [],
      );
      setPatternsStatus("success");
    } catch (error) {
      if (error.name !== "AbortError") {
        setPatterns([]);
        setPatternsStatus("error");
      }
    }
  }, []);

  useEffect(() => () => patternsAbortRef.current?.abort(), []);

  // Loaded on first open, not on mount: the footer renders on every page and most visitors
  // never expand this list.
  const togglePatterns = () => {
    const next = !patternsOpen;
    setPatternsOpen(next);
    if (next && patternsStatus === "idle") fetchPatterns();
  };

  // A disclosure left hanging open in a footer is just noise, so anything that reads as
  // "done with it" puts it away: a click outside the group, Escape, or the pointer leaving
  // the footer (handled on the element itself).
  useEffect(() => {
    if (!patternsOpen) return undefined;

    const closeOnOutside = (event) => {
      if (!patternsRef.current?.contains(event.target)) setPatternsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setPatternsOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [patternsOpen]);

  // Navigating anywhere closes it too — the footer survives route changes, so without this the
  // list would still be sitting open on the page you land on.
  useEffect(() => {
    setPatternsOpen(false);
  }, [location.pathname, location.search]);

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
      ([entry]) => {
        setShowTop(entry.isIntersecting);
        document.body.classList.toggle("btt-visible", entry.isIntersecting);
      },
      { threshold: 0.05 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.body.classList.remove("btt-visible");
    };
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
      onMouseLeave={() => setPatternsOpen(false)}
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
            {quickLinks.map(([label, path]) =>
              path === PATTERNS_GROUP ? (
                <li key={label} className="bk-footer-patterns" ref={patternsRef}>
                  <button
                    type="button"
                    className="bk-footer-patterns-toggle"
                    aria-expanded={patternsOpen}
                    onClick={togglePatterns}
                  >
                    {label}
                    <ChevronRight size={12} aria-hidden="true" />
                  </button>

                  {patternsOpen && (
                    <ul className="bk-footer-patterns-list">
                      {patternsStatus === "loading" && (
                        <li className="bk-footer-patterns-status">Loading patterns…</li>
                      )}
                      {patternsStatus === "error" && (
                        <li className="bk-footer-patterns-status">
                          Unable to load patterns
                          <button type="button" onClick={fetchPatterns}>Retry</button>
                        </li>
                      )}
                      {patternsStatus === "success" && patterns.length === 0 && (
                        <li className="bk-footer-patterns-status">No patterns found</li>
                      )}
                      {patterns.map((pattern) => {
                        const to = `/collection?variety=${pattern.id}`;
                        return (
                          <li key={pattern.id}>
                            {/* Closed explicitly rather than relying on the navigation effect:
                                re-picking the pattern you are already viewing does not change
                                the location, so that effect would never fire. */}
                            <Link
                              to={to}
                              onClick={(event) => {
                                setPatternsOpen(false);
                                refreshFooterLink(to)(event);
                              }}
                            >
                              {pattern.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ) : (
                <li key={label}>
                  <Link to={path} onClick={refreshFooterLink(path)}>{label}</Link>
                </li>
              ),
            )}
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
            <MapPin size={15} className="bk-map-icon" />
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
            {/* Points at our own /store/<slug> page, not straight out to the marketplace.
                That page is what carries the storefront link, the product list and the
                case for buying direct — sending people off-site from here would skip
                all of it. */}
            {marketplaces.map((market) => (
              <Link
                key={market.slug}
                to={`/marketplace#${market.slug}`}
                className="bk-footer-market-badge"
                aria-label={`Banarasi Kala on ${market.name}`}
                title={`Banarasi Kala on ${market.name}`}
              >
                {isImageMark(market.icon)
                  ? <img src={market.icon} alt="" className="bk-footer-myntra-img" />
                  : <Icon icon={market.icon || "lucide:store"} style={{ color: market.accent_color }} />
                }
                <span>{market.name}</span>
                {market.status === "coming_soon" && <em className="bk-footer-market-soon">Soon</em>}
              </Link>
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

