import DownloadPdfButton from "../../components/DownloadPdfButton";
import "./PolicyPage.css";

// `downloadable` is opt-in rather than on by default: the pages a customer actually keeps a
// copy of are the ones that govern a transaction they are in the middle of.
const PolicyPage = ({ title, subtitle, sections, downloadable = false }) => (
  <main className="bk-policy-page">
    <div className="bk-policy-hero">
      <div className="bk-policy-hero-inner">
        <p className="bk-policy-eyebrow">Banarasi Kala</p>
        <h1>{title}</h1>
        {subtitle && <p className="bk-policy-subtitle">{subtitle}</p>}
      </div>
    </div>

    <div className="bk-policy-shell">
      {sections.map((section) => (
        <section key={section.heading} className="bk-policy-section">
          <h2>{section.heading}</h2>
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

      <p className="bk-policy-contact">
        For any questions, reach us at{" "}
        <a href="mailto:support@banarasikala.com">support@banarasikala.com</a>
      </p>

      {downloadable && <DownloadPdfButton />}
    </div>
  </main>
);

export default PolicyPage;
