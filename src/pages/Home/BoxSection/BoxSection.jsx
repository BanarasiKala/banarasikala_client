import { useEffect, useState } from "react";
import { API_ENDPOINTS } from "../../../config/api";
import { imgUrl } from "../../../utils/cloudinary";
import "./BoxSection.css";

// One admin entry → a titled bento mosaic of its media. Videos lead the grid
// (autoplaying, muted) with the images tiled around them.
const BoxMosaic = ({ entry }) => {
  const media = [
    ...(Array.isArray(entry.videos) ? entry.videos.filter(Boolean).map((url) => ({ type: "video", url })) : []),
    ...(Array.isArray(entry.images) ? entry.images.filter(Boolean).map((url) => ({ type: "image", url })) : []),
  ];
  if (!media.length) return null;

  return (
    <div className="bk-boxsec-block">
      {(entry.title || entry.description) && (
        <div className="bk-boxsec-heading">
          {entry.title && <h3>{entry.title}</h3>}
          {entry.description && <p>{entry.description}</p>}
        </div>
      )}
      <div className="bk-boxsec-grid">
        {media.map((item, index) => (
          <div
            key={`${item.url}-${index}`}
            className="bk-boxsec-tile"
            style={{ "--bk-boxsec-delay": `${Math.min(index * 80, 480)}ms` }}
          >
            {item.type === "video" ? (
              <video
                src={item.url}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={entry.title || "Banarasi Kala"}
              />
            ) : (
              <img src={imgUrl(item.url, 900)} alt={entry.title || "Banarasi Kala"} loading="lazy" decoding="async" />
            )}
            <span className="bk-boxsec-tile-shine" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
};

// "Box Section" — admin-curated media mosaics on the home page
// (title + multiple images + multiple videos per entry).
const BoxSection = () => {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(API_ENDPOINTS.boxSections, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setEntries(
        Array.isArray(data)
          ? data.filter((entry) => (entry.videos || []).length || (entry.images || []).length)
          : [],
      ))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!entries.length) return null;

  return (
    <section className="bk-boxsec-section">
      <div className="bk-boxsec-shell">
        {entries.map((entry) => (
          <BoxMosaic key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
};

export default BoxSection;
