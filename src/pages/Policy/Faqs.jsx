import { Link } from "react-router-dom";
import DownloadPdfButton from "../../components/DownloadPdfButton";
import { FAQ_GROUPS } from "../../data/faqs";
import "./PolicyPage.css";
import "./Faqs.css";

const slugify = (text) => String(text)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");

/**
 * The full FAQ list, laid out as a policy page rather than an accordion: every question with
 * its answer already visible, on the same cream page and in the same type as Shipping,
 * Refunds and the rest. Someone who opened the FAQs came to read them.
 *
 * The home page keeps its own accordion on the maroon band — there it is a teaser among many
 * sections, and twenty open answers would swamp it.
 */
const Faqs = () => (
  <main className="bk-policy-page">
    <header className="bk-policy-hero">
      <div className="bk-policy-hero-inner">
        <p className="bk-policy-eyebrow">Banarasi Kala</p>
        <h1>Frequently Asked Questions</h1>
        <p className="bk-policy-subtitle">
          Orders, delivery, returns, products and payments — answered.
        </p>
      </div>
    </header>

    <div className="bk-policy-shell">
      {FAQ_GROUPS.map((group) => (
        <section
          key={group.category}
          id={slugify(group.category)}
          className="bk-policy-section"
        >
          <h2>{group.category}</h2>
          <div className="bk-faq-qa-list">
            {group.items.map((item) => (
              <article key={item.question} className="bk-faq-qa">
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>
      ))}

      <div className="bk-policy-contact">
        <p>
          Still need help? Write to{" "}
          <a href="mailto:support@banarasikala.com">support@banarasikala.com</a>{" "}
          or read our <Link to="/shipping-policy">Shipping</Link>,{" "}
          <Link to="/return-exchange">Return &amp; Exchange</Link> and{" "}
          <Link to="/refund-policy">Refund</Link> policies.
        </p>
      </div>

      <DownloadPdfButton label="Download FAQs (PDF)" />
    </div>
  </main>
);

export default Faqs;
