import { useState } from "react";
import { Icon } from "@iconify/react";
import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";
import { useNotification } from "../../context/NotificationContext";
import "./Contact.css";

const WHATSAPP_NUMBER = "919555098884";
const WHATSAPP_TEXT = encodeURIComponent("Hi Banarasi Kala, I need quick help.");
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_TEXT}`;

const EMPTY_FORM = { name: "", email: "", phone: "", subject: "", message: "" };
const EMPTY_ERRORS = { name: "", email: "", phone: "", subject: "", message: "" };

const Contact = () => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [submitting, setSubmitting] = useState(false);
  const { showNotification } = useNotification();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    if (name === "phone") {
      const digits = value.replace(/\D/g, "").slice(0, 10);
      if (digits.length > 0 && !/^[6-9]/.test(digits)) return;
      setForm((prev) => ({ ...prev, phone: digits }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Please enter your full name.";
    if (!form.email.trim()) {
      errs.email = "Please enter your email address.";
    } else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      errs.email = "Please enter a valid email address.";
    }
    if (!form.phone) {
      errs.phone = "Please enter your mobile number.";
    } else if (!/^[6-9]\d{9}$/.test(form.phone)) {
      errs.phone = "Please enter a valid 10-digit mobile number starting with 6–9.";
    }
    if (!form.subject.trim()) errs.subject = "Please enter a subject.";
    if (!form.message.trim()) errs.message = "Please enter your message.";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors((prev) => ({ ...prev, ...errs }));
      return;
    }

    const { name, email, phone, subject, message } = form;
    setSubmitting(true);
    try {
      const res = await fetch(API_ENDPOINTS.contactSubmit, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone, subject: subject.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification("Message sent! We will get back to you soon.", "success");
        setForm(EMPTY_FORM);
        setErrors(EMPTY_ERRORS);
      } else {
        showNotification(data.message || "Could not send message. Please try again.", "error");
      }
    } catch {
      showNotification("Network error. Please check your connection and try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="contact-page">
      <section className="contact-shell">
        <div className="contact-info-panel">
          <div className="contact-kicker">Get In Touch</div>
          <h1>We're Here to Help You</h1>
          <p className="contact-intro">
            Have a question, need styling advice, or looking for something
            special? We'd love to hear from you.
          </p>

          <span className="contact-divider" aria-hidden="true" />

          <div className="contact-info-list">
            <article>
              <span><Phone size={20} /></span>
              <div>
                <h2>Call Us</h2>
                <p>+91 98765 43210</p>
                <small>Mon - Sat, 10:00 AM - 7:00 PM</small>
              </div>
            </article>
            <article>
              <span><Mail size={20} /></span>
              <div>
                <h2>Email Us</h2>
                <p>hello@banarasikala.com</p>
                <small>We reply within 24 hours</small>
              </div>
            </article>
            <article>
              <span><MapPin size={20} /></span>
              <div>
                <h2>Visit Us</h2>
                <p>B-15/42, Assi Ghat Road, Varanasi, Uttar Pradesh - 221005</p>
              </div>
            </article>
            <article>
              <span><Clock size={20} /></span>
              <div>
                <h2>Store Hours</h2>
                <p>Monday to Saturday: 10:00 AM - 7:00 PM</p>
                <small>Sunday: Closed</small>
              </div>
            </article>
          </div>
        </div>

        <div className="contact-form-panel">
          <div className="contact-kicker">Send Us a Message</div>

          <form onSubmit={handleSubmit} className="contact-form" noValidate>
            <div className="contact-form-grid">
              <div className="contact-field">
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Full Name *"
                  className={errors.name ? "has-error" : ""}
                />
                {errors.name && <span className="contact-field-error">{errors.name}</span>}
              </div>
              <div className="contact-field">
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Email Address *"
                  className={errors.email ? "has-error" : ""}
                />
                {errors.email && <span className="contact-field-error">{errors.email}</span>}
              </div>
            </div>

            <div className="contact-form-grid">
              <div className="contact-field">
                <div className={`contact-phone-wrap${errors.phone ? " has-error" : ""}`}>
                  <span className="contact-phone-prefix">
                    <span className="contact-flag-india" aria-hidden="true" />+91
                  </span>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="10-digit mobile number *"
                    inputMode="numeric"
                    maxLength={10}
                  />
                </div>
                {errors.phone && <span className="contact-field-error">{errors.phone}</span>}
              </div>
              <div className="contact-field">
                <input
                  type="text"
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  placeholder="Subject *"
                  className={errors.subject ? "has-error" : ""}
                />
                {errors.subject && <span className="contact-field-error">{errors.subject}</span>}
              </div>
            </div>

            <div className="contact-field">
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                rows="5"
                placeholder="Your Message *"
                className={errors.message ? "has-error" : ""}
              />
              {errors.message && <span className="contact-field-error">{errors.message}</span>}
            </div>

            <button type="submit" className="contact-submit" disabled={submitting}>
              <span>{submitting ? "Sending..." : "Send Message"}</span>
              <Send size={17} />
            </button>
          </form>

          <div className="contact-help-card">
            <span>
              <Icon icon="logos:whatsapp-icon" />
            </span>
            <div>
              <h2>Looking for quick help?</h2>
              <p>Chat with our support team on WhatsApp.</p>
            </div>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Chat with Banarasi Kala support on WhatsApp"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Contact;
