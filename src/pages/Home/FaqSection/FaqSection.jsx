import { useState } from "react";
import { Link } from "react-router-dom";
import { FAQ_ITEMS, HOME_FAQ_COUNT } from "../../../data/faqs";
import "./FaqSection.css";

/**
 * The home page's FAQ accordion — a taster of the first few questions on the maroon band,
 * linking onward to /faqs for the rest.
 *
 * /faqs is deliberately NOT this component: there the questions are laid out as a policy
 * page, every answer already visible. Here the section is one band among many, and a stack
 * of open answers would swamp the page — so one opens at a time.
 */
const FaqSection = ({
  items = FAQ_ITEMS.slice(0, HOME_FAQ_COUNT),
  showViewAll = true,
  headingId = "faq-title",
}) => {
  const [openIndices, setOpenIndices] = useState(() => new Set());

  const toggleItem = (index) => {
    setOpenIndices((current) => (current.has(index) ? new Set() : new Set([index])));
  };

  return (
    <section className="bk-faq-section" aria-labelledby={headingId}>
      <div className="bk-faq-shell">
        <h2 id={headingId}>Frequently Asked Questions</h2>
        <div className="bk-faq-grid">
          {items.map(({ question, answer }, index) => {
            const isOpen = openIndices.has(index);

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
