import { useEffect, useState } from "react";
import flatOfferBackground from "../../../assets/flat/image.png";
import { API_ENDPOINTS } from "../../../config/api";
import "./OfferBand.css";

const ROTATION_DELAY = 3600;

const OfferBand = () => {
  const [coupons, setCoupons] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_ENDPOINTS.coupons}/homepage`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setCoupons(Array.isArray(data) ? data : []))
      .catch((error) => {
        if (error.name !== "AbortError") setCoupons([]);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (coupons.length <= 1) return undefined;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % coupons.length);
    }, ROTATION_DELAY);

    return () => window.clearInterval(interval);
  }, [coupons.length]);

  if (isLoading) {
    return (
      <div
        className="bk-offer-band bk-offer-band-loading"
        style={{ "--bk-offer-bg": `url(${flatOfferBackground})` }}
        aria-busy="true"
        aria-label="Loading offer"
      >
        <div className="bk-offer-main bk-offer-skeleton">
          <span className="bk-offer-title bk-offer-skeleton-title" />
          <span className="bk-offer-divider" aria-hidden="true" />
          <span className="bk-offer-code-wrap bk-offer-skeleton-code-wrap">
            <span className="bk-offer-code-label bk-offer-skeleton-label" />
            <span className="bk-offer-code bk-offer-skeleton-code" />
          </span>
        </div>
      </div>
    );
  }

  if (coupons.length === 0) {
    return (
      <div
        className="bk-offer-band bk-offer-band-empty"
        style={{ "--bk-offer-bg": `url(${flatOfferBackground})` }}
        aria-hidden="true"
      />
    );
  }

  const coupon = coupons[activeIndex] || coupons[0];
  const bannerText = coupon.banner_text || `${coupon.discount_percent || ""}% OFF`;

  return (
    <div
      className="bk-offer-band"
      style={{ "--bk-offer-bg": `url(${flatOfferBackground})` }}
    >
      <div
        className={`bk-offer-main ${coupons.length > 1 ? "is-rotating" : ""}`}
        key={`${coupon.code}-${activeIndex}`}
      >
        <span className="bk-offer-title">{bannerText}</span>
        <span className="bk-offer-divider" aria-hidden="true" />
        <span className="bk-offer-code-wrap">
          <span className="bk-offer-code-label">USE CODE:</span>
          <span className="bk-offer-code">{coupon.code}</span>
        </span>
      </div>
    </div>
  );
};

export default OfferBand;
