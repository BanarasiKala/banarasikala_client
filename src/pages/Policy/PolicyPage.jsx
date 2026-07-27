import DownloadPdfButton from "../../components/DownloadPdfButton";
import "./PolicyPage.css";

// Stable per heading, so a link to a section survives edits elsewhere on the page.
const slugify = (text) => String(text)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");

// `downloadable` is opt-in rather than on by default: the pages a customer actually keeps a
// copy of are the ones that govern a transaction they are in the middle of.
const PolicyPage = ({ title, subtitle, sections, downloadable = false }) => (
  <main className="bk-policy-page">
    <header className="bk-policy-hero">
      <div className="bk-policy-hero-inner">
        <p className="bk-policy-eyebrow">Banarasi Kala</p>
        <h1>{title}</h1>
        {subtitle && <p className="bk-policy-subtitle">{subtitle}</p>}
      </div>
    </header>

    <div className="bk-policy-shell">
      {/* A policy is read to answer one question, not front to back. Anything past a few
          sections gets a jump list so the reader can go straight to the part they came for. */}
      {sections.length > 3 && (
        <nav className="bk-policy-toc" aria-label="On this page">
          <p className="bk-policy-toc-title">On this page</p>
          <ol>
            {sections.map((section) => (
              <li key={section.heading}>
                <a href={`#${slugify(section.heading)}`}>{section.heading}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {sections.map((section, sectionIndex) => (
        <section
          key={section.heading}
          id={slugify(section.heading)}
          className="bk-policy-section"
        >
          <h2>
            <span className="bk-policy-num" aria-hidden="true">
              {String(sectionIndex + 1).padStart(2, "0")}
            </span>
            {section.heading}
          </h2>
          {section.body.map((block, i) =>
            Array.isArray(block) ? (
              <ul key={i}>
                {block.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p key={i}>{block}</p>
            )
          )}
        </section>
      ))}

      <div className="bk-policy-contact">
        <p>
          Any questions? Write to{" "}
          <a href="mailto:support@banarasikala.com">support@banarasikala.com</a>{" "}
          and we will come back to you within one business day.
        </p>
      </div>

      {downloadable && <DownloadPdfButton />}
    </div>
  </main>
);

export default PolicyPage;
