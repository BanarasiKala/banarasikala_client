import FaqSection from "../Home/FaqSection/FaqSection";
import DownloadPdfButton from "../../components/DownloadPdfButton";
import { FAQ_ITEMS } from "../../data/faqs";
import "./Faqs.css";

/**
 * The full FAQ list, rendered by the very same accordion the home page uses — same maroon
 * band, same two-column grid, same rows. The only differences are that every question is
 * present and there is no "View All" to link onward to.
 */
const Faqs = () => (
  <main className="bk-faqs-page">
    <FaqSection
      items={FAQ_ITEMS}
      showViewAll={false}
      headingId="faqs-page-title"
      footer={<DownloadPdfButton label="Download FAQs (PDF)" />}
    />
  </main>
);

export default Faqs;
