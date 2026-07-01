import { useEffect, useState } from "react";
import { API_ENDPOINTS } from "../../config/api";
import "./ProductSocialProof.css";

// Per-tab id used to count a viewer once (not per open tab reload).
const getSessionId = () => {
  let id = sessionStorage.getItem("bk_sid");
  if (!id) {
    id = (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    sessionStorage.setItem("bk_sid", id);
  }
  return id;
};

// Social proof for the product page. The two lines — live viewers and orders
// this hour — take turns in the same spot every 2 seconds with a slide-in.
const ProductSocialProof = ({ productId }) => {
  const [viewers, setViewers] = useState(0);
  const [ordersRecent, setOrdersRecent] = useState(0);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!productId) return undefined;
    let ignore = false;
    const sessionId = getSessionId();
    const ping = async () => {
      try {
        const res = await fetch(`${API_ENDPOINTS.stats}/products/${productId}/viewers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (ignore) return;
        setViewers(Number(data.viewers) || 0);
        setOrdersRecent(Number(data.ordersRecent) || 0);
      } catch {
        /* non-critical */
      }
    };
    ping();
    const timer = window.setInterval(ping, 12000);
    return () => { ignore = true; window.clearInterval(timer); };
  }, [productId]);

  const messages = [];
  if (viewers >= 2) {
    messages.push({
      key: "live",
      cls: "is-live",
      dot: true,
      value: viewers,
      label: "people viewing this right now",
    });
  }
  if (ordersRecent > 0) {
    messages.push({
      key: "orders",
      cls: "is-orders",
      emoji: "🔥",
      value: ordersRecent,
      label: "orders placed this hour",
    });
  }
  const count = messages.length;

  // Rotate lines every 3.5 seconds.
  useEffect(() => {
    if (count <= 1) return undefined;
    const timer = window.setInterval(() => setIdx((i) => i + 1), 3500);
    return () => window.clearInterval(timer);
  }, [count]);

  if (count === 0) return null;
  const current = messages[idx % count];

  return (
    <div className="bk-social-proof">
      <div key={`${current.key}-${idx}`} className={`bk-sp-line ${current.cls}`}>
        <span className="bk-sp-badge">
          {current.dot ? <span className="bk-sp-dot" aria-hidden="true" /> : <span className="bk-sp-emoji">{current.emoji}</span>}
        </span>
        <span className="bk-sp-text">
          <strong>{current.value}</strong> {current.label}
        </span>
      </div>
    </div>
  );
};

export default ProductSocialProof;
