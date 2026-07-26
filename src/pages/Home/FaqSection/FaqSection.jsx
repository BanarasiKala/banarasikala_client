import { useState } from "react";
import { Link } from "react-router-dom";
import { FAQ_ITEMS, HOME_FAQ_COUNT } from "../../../data/faqs";
import "./FaqSection.css";

/**
 * The FAQ accordion. Shared by the home page, which shows a taster and links onward, and
 * /faqs, which passes the full list with no link — so the two are the same component rather
 * than one styled to imitate the other.
 */
const FaqSection = ({
  items = FAQ_ITEMS.slice(0, HOME_FAQ_COUNT),
  showViewAll = true,
  headingId = "faq-title",
  // Rendered under the grid in place of the "View All" link — /faqs puts its PDF button here.
  footer = null,
}) => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleItem = (index) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <section className="bk-faq-section" aria-labelledby={headingId}>
      <div className="bk-faq-shell">
        <h2 id={headingId}>Frequently Asked Questions</h2>
        <div className="bk-faq-grid">
          {items.map(({ question, answer }, index) => {
            const isOpen = openIndex === index;

            return (
              <div className={`bk-faq-item ${isOpen ? "is-open" : ""}`} key={question}>
                <button
                  type="button"
                  className="bk-faq-question"
                  aria-expanded={isOpen}
                  onClick={() => toggleItem(index)}
                >
                  <span>{question}</span>
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {/* Always in the DOM, hidden by CSS when collapsed. Conditional rendering
                    would leave nothing for the print stylesheet to reveal, so a saved PDF
                    would be a list of questions with no answers. */}
                <p className="bk-faq-answer">{answer}</p>
              </div>
            );
          })}
        </div>

        {footer}

        {showViewAll && (
          <div className="bk-faq-footer">
            <Link to="/faqs" className="bk-faq-view-all">
              View All
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default FaqSection;
