import { Icon } from "@iconify/react";
import { Link, useNavigate } from "react-router-dom";
import { imgUrl } from "../../utils/cloudinary";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useNotification } from "../../context/NotificationContext";
import { useWishlist } from "../../context/WishlistContext";
import { useDeliveryLocation } from "../../context/LocationContext";
import EmptyStateIcon from "../../components/EmptyStateIcon";
import { getProductStockInfo } from "../../utils/stockStatus";
import { getEstimatedDeliveryDate } from "../../utils/deliveryDate";
import api from "../../utils/api";
import { API_ENDPOINTS } from "../../config/api";
import { unwrapApiData } from "../../utils/error";
import "./Cart.css";

// Add up to this many sarees to unlock the extra-off nudge shown in the cart.
const EXTRA_OFF_MIN_ITEMS = 4;

const calcDiscount = (mrp, sell) => {
  if (!mrp || !sell || Number(mrp) <= Number(sell)) return 0;
  return Math.round(((Number(mrp) - Number(sell)) / Number(mrp)) * 100);
};

const formatMoney = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatMoneyShort = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const itemKey = (item) => `${item.id}-${item.colorId ?? ""}`;

const Cart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    cart,
    removeFromCart,
    updateQuantity,
    getSubtotal,
    refreshCart,
    loading,
  } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showNotification } = useNotification();
  const { courierEtd } = useDeliveryLocation();

  const [stockAlerts, setStockAlerts] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [giftWrap, setGiftWrap] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const checkingRef = useRef(false);
  const knownKeysRef = useRef(new Set());
  const topProceedRef = useRef(null);

  const checkCartStock = useRef(async () => {});

  // Keep the checker pointed at the latest closures. Assigned inside an effect
  // (not during render) so it always sees current context methods/state.
  useEffect(() => {
    checkCartStock.current = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        await refreshCart();
        const res = await api.get(API_ENDPOINTS.cartValidate);
        const issues = unwrapApiData(res.data) || [];
        const alerts = [];
        for (const issue of issues) {
          alerts.push(issue);
          if (issue.issue === "quantity_exceeded" && issue.availableStock > 0) {
            updateQuantity(issue.productId, issue.availableStock, issue.colorId);
          }
        }
        setStockAlerts(alerts);
      } catch {
        setStockAlerts([]);
      } finally {
        checkingRef.current = false;
      }
    };
  });

  useEffect(() => {
    checkCartStock.current();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkCartStock.current();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []); // runs on mount only; uses ref so always calls latest version

  // Keep the selection in sync with the cart: new items default to selected,
  // de-selected ones stay de-selected, removed ones drop out.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set();
      cart.forEach((item) => {
        const key = itemKey(item);
        const isNew = !knownKeysRef.current.has(key);
        if (isNew || prev.has(key)) next.add(key);
      });
      knownKeysRef.current = new Set(cart.map(itemKey));
      return next;
    });
  }, [cart]);

  // Show the fixed bottom checkout bar only when the in-card proceed button
  // has scrolled out of view.
  useEffect(() => {
    const el = topProceedRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, cart.length]);

  const toggleSelect = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allSelected = cart.length > 0 && cart.every((item) => selected.has(itemKey(item)));
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(cart.map(itemKey)));
  };

  const selectedItems = cart.filter((item) => selected.has(itemKey(item)));
  const selectedUnits = selectedItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const totalUnits = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const selectedSubtotal = selectedItems.reduce(
    (sum, item) => sum + Number(item.price || item.selling_price || 0) * Number(item.quantity || 1),
    0,
  );
  const selectedSavings = selectedItems.reduce((sum, item) => {
    const sell = Number(item.price || item.selling_price || 0);
    const mrp = Number(item.mrp_price || item.mrp || 0);
    return sum + (mrp > sell ? (mrp - sell) * Number(item.quantity || 1) : 0);
  }, 0);

  const extraOffRemaining = Math.max(0, EXTRA_OFF_MIN_ITEMS - totalUnits);
  const extraOffProgress = Math.min(100, (totalUnits / EXTRA_OFF_MIN_ITEMS) * 100);

  const handleCartQuantityChange = async (item, nextQuantity) => {
    if (nextQuantity < 1) return;
    const stockInfo = getProductStockInfo(item, item.colorId);
    if (nextQuantity > stockInfo.quantity) return;
    showNotification(`Quantity updated to ${nextQuantity}`, "success");
    const result = await updateQuantity(item.id, nextQuantity, item.colorId);
    if (result && !result.success) {
      showNotification(result.message, "error");
    }
  };

  const handleRemove = (item) => {
    removeFromCart(item.id, item.colorId);
    showNotification(`${item.name} removed from bag`, "success");
  };

  const handleProceed = () => {
    if (selectedItems.length === 0) {
      showNotification("Select at least one item to proceed.", "warning");
      return;
    }
    // Carry the chosen items (and gift preference) through to checkout.
    sessionStorage.setItem("bk_cart_selected", JSON.stringify(selectedItems.map(itemKey)));
    sessionStorage.setItem("bk_cart_gift", giftWrap ? "1" : "0");
    navigate("/checkout");
  };

  if (!user) {
    return (
      <div className="cart-page min-h-screen">
        <div className="cart-empty-wrap">
          <EmptyStateIcon variant="cart" className="cart-empty-icon" />
          <h3 className="cart-empty-title">Login to view your bag</h3>
          <p className="cart-empty-sub">Sign in to add items and place your order.</p>
          <Link to="/login" state={{ from: { pathname: "/cart" } }} className="cart-empty-btn">
            Login / Sign up
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cart-page min-h-screen">
        <div className="cart-body">
          <div className="cart-sk-btn" />
          <div className="cart-items">
            {[1, 2].map((i) => (
              <div key={i} className="cart-sk-card">
                <div className="cart-sk-image" />
                <div className="cart-sk-body">
                  <div className="cart-sk-line cart-sk-line--name" />
                  <div className="cart-sk-line cart-sk-line--meta" />
                  <div className="cart-sk-line cart-sk-line--meta" />
                  <div className="cart-sk-footer">
                    <div className="cart-sk-line cart-sk-line--price" />
                    <div className="cart-sk-line cart-sk-line--qty" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="cart-page min-h-screen">
        <div className="cart-empty-wrap">
          <EmptyStateIcon variant="cart" className="cart-empty-icon" />
          <h3 className="cart-empty-title">Your bag is currently empty</h3>
          <p className="cart-empty-sub">Explore our heritage collection to add items.</p>
          <Link to="/collection" className="cart-empty-btn">Shop Collections</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page min-h-screen">
      <div className="cart-body">

        {/* ── Summary card ── */}
        <div className="cart-summary">
          <div className="cart-summary-top">
            <div className="cart-summary-bag">
              <Icon icon="lucide:shopping-bag" />
            </div>
            <div className="cart-summary-info">
              <strong>{totalUnits} Item{totalUnits === 1 ? "" : "s"} in your bag</strong>
              <span className="cart-summary-freedelivery">
                <Icon icon="lucide:badge-check" />
                FREE Delivery on this order
              </span>
            </div>
            <div className="cart-summary-amount">
              <span className="cart-summary-amount-label">SUBTOTAL</span>
              <strong>{formatMoney(selectedSubtotal || getSubtotal())}</strong>
            </div>
          </div>

          <button ref={topProceedRef} type="button" className="cart-proceed-btn" onClick={handleProceed} disabled={selectedItems.length === 0}>
            PROCEED TO BUY ({selectedUnits} ITEM{selectedUnits === 1 ? "" : "S"})
            <Icon icon="lucide:arrow-right" />
          </button>

          <label className="cart-gift">
            <input type="checkbox" checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} />
            <span className="cart-gift-box"><Icon icon="lucide:check" /></span>
            Send as a gift. Include custom message
          </label>
        </div>

        {/* ── Extra-off progress ── */}
        <div className="cart-progress">
          <div className="cart-progress-row">
            <strong>
              {extraOffRemaining > 0
                ? `Add ${extraOffRemaining} More Saree${extraOffRemaining === 1 ? "" : "s"} & Get 5% Extra Off`
                : "Yay! You unlocked 5% Extra Off"}
            </strong>
            <span className="cart-progress-pill">
              {extraOffRemaining > 0 ? `${extraOffRemaining} more item${extraOffRemaining === 1 ? "" : "s"} to go` : "Unlocked"}
            </span>
          </div>
          <div className="cart-progress-bar">
            <div className="cart-progress-fill" style={{ width: `${extraOffProgress}%` }} />
          </div>
        </div>

        {/* ── Coupon row ── */}
        <Link to="/checkout" className="cart-coupon">
          <span className="cart-coupon-left">
            <Icon icon="lucide:tag" />
            Collect Coupon &amp; Save More
          </span>
          <Icon icon="lucide:chevron-right" className="cart-coupon-chevron" />
        </Link>

        {/* ── Stock alerts ── */}
        {stockAlerts.length > 0 && (
          <div className="cart-stock-alerts">
            <Icon icon="lucide:alert-triangle" className="cart-stock-alerts-icon" />
            <div className="cart-stock-alerts-body">
              <strong>Stock update</strong>
              <ul>
                {stockAlerts.map((alert) => (
                  <li key={`${alert.productId}-${alert.colorId}`}>
                    {alert.issue === "out_of_stock"
                      ? <><em>{alert.name}</em> is now out of stock.</>
                      : <><em>{alert.name}</em> — only {alert.availableStock} left. Quantity updated automatically.</>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── Select all ── */}
        <div className="cart-selectall">
          <button type="button" className="cart-selectall-left" onClick={toggleSelectAll}>
            <span className={`cart-check ${allSelected ? "is-on" : ""}`}><Icon icon="lucide:check" /></span>
            Select All ({cart.length})
          </button>
          <button type="button" className="cart-selectall-clear" onClick={() => setSelected(new Set())}>
            Deselect
          </button>
        </div>

        {/* ── Items ── */}
        <div className="cart-items">
          {cart.map((item) => {
            const key = itemKey(item);
            const isSelected = selected.has(key);
            const stockInfo = getProductStockInfo(item, item.colorId);
            const wishlisted = isInWishlist(item.id, item.colorId || null);
            const sell = Number(item.price || item.selling_price || 0);
            const mrp = Number(item.mrp_price || item.mrp || 0);
            const disc = calcDiscount(mrp, sell);
            const deliveryDateObj = getEstimatedDeliveryDate(courierEtd, item.processing_days);
            const deliveryLabel = deliveryDateObj.toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });

            return (
              <div key={key} className={`cart-card ${isSelected ? "is-selected" : ""}`}>
                <button
                  type="button"
                  className={`cart-check cart-card-check ${isSelected ? "is-on" : ""}`}
                  onClick={() => toggleSelect(key)}
                  aria-label={isSelected ? "Deselect item" : "Select item"}
                >
                  <Icon icon="lucide:check" />
                </button>

                <Link to={`/product/${item.slug}`} className="cart-card-image" aria-label={item.name}>
                  <img src={imgUrl(item.image_url, 200)} alt={item.name} />
                </Link>

                <div className="cart-card-body">
                  <button
                    type="button"
                    className={`cart-card-wish${wishlisted ? " is-active" : ""}`}
                    onClick={() => toggleWishlist(item, item.colorId || null)}
                    aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
                  >
                    <Icon icon={wishlisted ? "mdi:heart" : "lucide:heart"} />
                  </button>

                  <Link to={`/product/${item.slug}`} className="cart-card-name">{item.name}</Link>

                  {item.selectedColorName && (
                    <span className="cart-card-color">
                      <span
                        className="cart-card-color-dot"
                        style={item.selectedColorHex ? { background: item.selectedColorHex } : {}}
                      />
                      {item.selectedColorName}
                    </span>
                  )}

                  {(stockInfo.isOutOfStock || stockInfo.isLowStock) && (
                    <p className={`cart-stock-note ${stockInfo.isOutOfStock ? "out" : "low"}`}>
                      {stockInfo.colorMessage || stockInfo.badge}
                    </p>
                  )}

                  <div className="cart-card-price-row">
                    {stockInfo.isOutOfStock ? (
                      <span className="cart-card-price">{formatMoney(mrp > 0 ? mrp : sell)}</span>
                    ) : (
                      <div className="cart-price-main-row">
                        {disc > 0 && <em className="cart-card-off">-{disc}%</em>}
                        <span className="cart-card-price">{formatMoney(sell)}</span>
                        {mrp > sell && <span className="cart-card-mrp"><span className="cart-card-mrp-val">{formatMoney(mrp)}</span></span>}
                      </div>
                    )}
                  </div>

                  <div className="cart-card-delivery">
                    <Icon icon="lucide:truck" className="cart-card-delivery-truck" />
                    <span>FREE Delivery <strong>by {deliveryLabel}</strong></span>
                    <span className="cart-card-dot" />
                    <span className={`cart-card-stockstate ${stockInfo.isOutOfStock ? "out" : "in"}`}>
                      {stockInfo.isOutOfStock ? "Out of Stock" : "In Stock"}
                    </span>
                  </div>

                  <div className="cart-card-controls">
                    <div className="cart-qty">
                      <button onClick={() => handleCartQuantityChange(item, item.quantity - 1)} aria-label="Decrease">
                        <Icon icon="lucide:minus" />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => handleCartQuantityChange(item, item.quantity + 1)}
                        disabled={stockInfo.isOutOfStock || item.quantity >= stockInfo.quantity}
                        aria-label="Increase"
                      >
                        <Icon icon="lucide:plus" />
                      </button>
                    </div>
                    <button className="cart-card-delete" onClick={() => handleRemove(item)} aria-label="Remove item">
                      <Icon icon="lucide:trash-2" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* ── Sticky checkout bar (only when the top button is off-screen) ── */}
      <div className={`cart-stickybar ${showSticky ? "is-visible" : ""}`}>
        <div className="cart-stickybar-inner">
          <div className="cart-stickybar-left">
            <span className="cart-stickybar-label">SUBTOTAL ({selectedUnits} Item{selectedUnits === 1 ? "" : "s"})</span>
            <strong className="cart-stickybar-amount">{formatMoney(selectedSubtotal || getSubtotal())}</strong>
            {selectedSavings > 0 && (
              <span className="cart-stickybar-save">You save {formatMoneyShort(selectedSavings)} on this order!</span>
            )}
          </div>
          <button type="button" className="cart-stickybar-btn" onClick={handleProceed} disabled={selectedItems.length === 0}>
            PROCEED TO BUY ({selectedUnits} ITEM{selectedUnits === 1 ? "" : "S"})
            <Icon icon="lucide:arrow-right" />
          </button>
        </div>
        <div className="cart-stickybar-assurance">
          <span><Icon icon="lucide:lock" /> Secure Payments</span>
          <i />
          <span><Icon icon="lucide:rotate-ccw" /> Easy Returns</span>
          <i />
          <span><Icon icon="lucide:shield-check" /> 100% Authentic</span>
        </div>
      </div>
    </div>
  );
};

export default Cart;
