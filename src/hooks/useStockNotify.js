import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import api from "../utils/api";

/**
 * "Notify me when it's back in stock", shared by the product page and every product card.
 *
 * Logged in  → registers the request and toasts the result.
 * Logged out → remembers the intent (bk_pending_notify) and routes through login with the
 *              current location as `from`, so the shopper lands back where they were. The pending
 *              request is then completed globally on login (see CartContext), so it works whether
 *              they return to a product page or a listing.
 *
 * `isNotifying(productId)` lets a button show a pending state while its own request is in flight.
 */
export default function useStockNotify() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showNotification } = useNotification();
  const [pendingId, setPendingId] = useState(null);

  const notify = async (product, colorId = null) => {
    if (!product?.id) return;
    if (!user) {
      localStorage.setItem("bk_pending_notify", JSON.stringify({ productId: product.id, colorId: colorId ?? null }));
      showNotification("Please log in first to get notified when it's back in stock.", "info");
      navigate("/login", { state: { from: location } });
      return;
    }
    setPendingId(product.id);
    try {
      const res = await api.post(`/api/stock-notifications/product/${product.id}`, { colorId: colorId ?? null });
      showNotification(res.data?.message || "We'll email you when it's back in stock.", "success");
    } catch (error) {
      showNotification(error?.response?.data?.message || "Could not register you right now. Please try again.", "error");
    } finally {
      setPendingId(null);
    }
  };

  return { notify, isNotifying: (id) => pendingId === id };
}
