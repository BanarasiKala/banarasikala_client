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

const calcDiscount = (mrp, sell) => {
  if (!mrp || !sell || Number(mrp) <= Number(sell)) return 0;
  return Math.round(((Number(mrp) - Number(sell)) / Number(mrp)) * 100);
};

const formatMoney = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatMoneyShort = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const itemKey = (item) => `${item.id}-${item.colorId ?? ""}`;

// Short label for what a coupon gives off (fixed amount or percentage).
const couponDiscountText = (coupon) => {
  if (!coupon) return "";
  if (coupon.discount_type === "fixed_amount" && Number(coupon.discount_amount) > 0) {
    return `₹${Number(coupon.discount_amount).toLocaleString("en-IN")} OFF`;
  }
  if (Number(coupon.discount_percent) > 0) return `${coupon.discount_percent}% OFF`;
  return "Extra Off";
};

const Cart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    cart,
    removeFromCart,
    updateQuantity,
    refreshCart,
    loading,
  } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showNotification } = useNotification();
  const { pincode, courierEtd, setPincode } = useDeliveryLocation();

  const [stockAlerts, setStockAlerts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [pinInput, setPinInput] = useState("");
  const [editingPin, setEditingPin] = useState(false);
  const [showDeliveryTip, setShowDeliveryTip] = useState(false);
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
        const outOfStockKeys = new Set();
        for (const issue of issues) {
          alerts.push(issue);
          if (issue.issue === "quantity_exceeded" && issue.availableStock > 0) {
            updateQuantity(issue.productId, issue.availableStock, issue.colorId);
          }
          if (issue.issue === "out_of_stock" || issue.availableStock === 0) {
            outOfStockKeys.add(`${issue.productId}-${issue.colorId ?? ""}`);
          }
        }
        setStockAlerts(alerts);
        if (outOfStockKeys.size > 0) {
          setSelected((prev) => {
            const next = new Set(prev);
            outOfStockKeys.forEach((key) => next.delete(key));
            return next;
          });
        }
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

  // Load coupons for the extra-off progress nudge: active, in-date, eligible
  // ones with a real minimum (> 0, so the progress bar never divides by zero),
  // sorted by ascending min purchase. Applying coupons happens at checkout.
  useEffect(() => {
    let cancelled = false;
    api.get(API_ENDPOINTS.coupons)
      .then((res) => {
        if (cancelled) return;
        const now = Date.now();
        // user_eligible === false means this shopper has exhausted the coupon
        // (per-user or global limit). The flag only exists for logged-in
        // shoppers; undefined ⇒ treat as eligible.
        const list = (Array.isArray(res.data) ? res.data : [])
          .filter((c) => c.is_active !== false)
          .filter((c) => !c.valid_from || new Date(c.valid_from).getTime() <= now)
          .filter((c) => !c.valid_until || new Date(c.valid_until).getTime() >= now)
          .filter((c) => c.user_eligible !== false)
          .map((c) => ({ ...c, minPurchase: Number(c.min_purchase_amount || 0) }))
          .filter((c) => c.minPurchase > 0)
          .sort((a, b) => a.minPurchase - b.minPurchase);
        setCoupons(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Keep the selection in sync with the cart: new in-stock items default to
  // selected, out-of-stock items are never auto-selected, de-selected ones
  // stay de-selected, and removed ones drop out.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set();
      cart.forEach((item) => {
        const key = itemKey(item);
        const isNew = !knownKeysRef.current.has(key);
        const inStock = !getProductStockInfo(item, item.colorId).isOutOfStock;
        if ((isNew && inStock) || prev.has(key)) next.add(key);
      });
      knownKeysRef.current = new Set(cart.map(itemKey));
      return next;
    });
  }, [cart]);

  // Show the fixed bottom checkout bar as soon as the in-card proceed button
  // slips behind the sticky header (not just when it leaves the raw viewport).
  useEffect(() => {
    const el = topProceedRef.current;
    if (!el) return undefined;

    let observer;
    const attach = () => {
      observer?.disconnect();
      // Offset the observer's top edge by the sticky header height so the bar
      // appears the instant the button hides under the header, with no delay.
      const headerHeight = document.querySelector(".bk-header")?.getBoundingClientRect().height || 0;
      observer = new IntersectionObserver(
        ([entry]) => setShowSticky(!entry.isIntersecting),
        { threshold: 0, rootMargin: `-${Math.round(headerHeight)}px 0px 0px 0px` },
      );
      observer.observe(el);
    };

    attach();
    window.addEventListener("resize", attach);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", attach);
    };
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

  // Extra-off progress, driven by real coupons (sorted by ascending min purchase):
  // find the nearest coupon the cart hasn't reached yet, and the best one already
  // unlocked. The progress fills toward the next coupon's minimum.
  const nextCoupon = coupons.find((c) => c.minPurchase > selectedSubtotal) || null;
  const unlockedCoupon = coupons.filter((c) => c.minPurchase <= selectedSubtotal).pop() || null;
  const progressCoupon = nextCoupon || unlockedCoupon;
  const extraOffRemaining = nextCoupon ? Math.max(0, nextCoupon.minPurchase - selectedSubtotal) : 0;
  const extraOffProgress = progressCoupon
    ? Math.min(100, (selectedSubtotal / progressCoupon.minPurchase) * 100)
    : 0;

  // The whole order ships together, so show one consolidated "arrives by" date:
  // the farthest estimate across the items being bought. This is only meaningful
  // once we know the courier transit time for the customer's location
  // (courierEtd); otherwise we prompt for an address instead of guessing.
  const deliveryItems = selectedItems.length ? selectedItems : cart;
  const farthestDelivery = courierEtd
    ? deliveryItems.reduce((latest, item) => {
        // getEstimatedDeliveryDate = courier ETA (service availability) + processing days.
        const date = getEstimatedDeliveryDate(courierEtd, item.processing_days);
        return !latest || date > latest ? date : latest;
      }, null)
    : null;
  const farthestDeliveryLabel = farthestDelivery
    ? farthestDelivery.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
    : null;

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

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pinInput)) {
      showNotification("Enter a valid 6-digit pincode.", "warning");
      return;
    }
    // Saves the pincode in the shared location context, which fetches the
    // courier ETA and reveals the delivery date across the app.
    setPincode(pinInput, "manual");
    setEditingPin(false);
  };

  const handleProceed = () => {
    if (selectedItems.length === 0) {
      showNotification("Select at least one item to proceed.", "warning");
      return;
    }
    if (!pincode) {
      showNotification("Please add your delivery pincode to continue.", "warning");
      return;
    }
    const blockedKeys = new Set(
      stockAlerts
        .filter((a) => a.issue === "out_of_stock" || a.availableStock === 0)
        .map((a) => `${a.productId}-${a.colorId ?? ""}`)
    );
    const hasUnavailable = selectedItems.some((item) => blockedKeys.has(itemKey(item)));
    if (hasUnavailable) {
      showNotification("Some selected items are out of stock. Please remove them before proceeding.", "error");
      return;
    }
    // Carry the chosen items through to checkout. Gift wrap, coupons and wallet
    // are all chosen inside the checkout flow now.
    sessionStorage.setItem("bk_cart_selected", JSON.stringify(selectedItems.map(itemKey)));
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
              <svg className="cart-summary-bag-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7.25 8.35h9.5c.86 0 1.59.65 1.69 1.51l.92 8.2A2.15 2.15 0 0 1 17.22 20.45H6.78a2.15 2.15 0 0 1-2.14-2.39l.92-8.2c.1-.86.83-1.51 1.69-1.51Z" />
                <path d="M8.9 8.35V6.9a3.1 3.1 0 0 1 6.2 0v1.45" />
                <path d="M9.45 11.35h.01" />
                <path d="M14.55 11.35h.01" />
              </svg>
            </div>
            <div className="cart-summary-info">
              <strong>{totalUnits} Item{totalUnits === 1 ? "" : "s"} in your bag</strong>
              {pincode && !editingPin && (
                <span className="cart-summary-freedelivery">
                  <Icon icon="lucide:truck" />
                  {farthestDeliveryLabel
                    ? <>FREE Delivery by <strong>{farthestDeliveryLabel}</strong></>
                    : "Checking delivery date…"}
                  <button
                    type="button"
                    className="cart-pin-change"
                    onClick={() => { setPinInput(pincode); setEditingPin(true); }}
                  >
                    {pincode} <span className="cart-pin-change-label">Change</span>
                  </button>
                </span>
              )}
            </div>
            {selectedItems.length > 0 && (
              <div className="cart-summary-amount">
                <span className="cart-summary-amount-label">SUBTOTAL</span>
                <strong>{formatMoney(selectedSubtotal)}</strong>
              </div>
            )}
          </div>

          {(!pincode || editingPin) && (
            <div className="cart-pin-block">
              <form className="cart-pin-row" onSubmit={handlePinSubmit}>
                <Icon icon="lucide:map-pin" className="cart-pin-icon" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Add pincode to see delivery date"
                  className="cart-pin-input"
                  aria-label="Delivery pincode"
                  autoFocus={editingPin}
                />
                {editingPin && pincode && (
                  <button type="button" className="cart-pin-cancel" onClick={() => { setEditingPin(false); setPinInput(""); }}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="cart-pin-btn">Check</button>
              </form>
              <span className="cart-pin-note">You can change the full address in the next step.</span>
            </div>
          )}

          <button ref={topProceedRef} type="button" className="cart-proceed-btn" onClick={handleProceed} disabled={selectedItems.length === 0 || !pincode}>
            PROCEED TO BUY ({selectedUnits} ITEM{selectedUnits === 1 ? "" : "S"})
            <Icon icon="lucide:arrow-right" />
          </button>
        </div>

        {/* ── Extra-off progress (driven by the nearest applicable coupon) ── */}
        {progressCoupon && (
          <div className="cart-progress">
            <div className="cart-progress-row">
              <strong>
                {nextCoupon
                  ? `Add ${formatMoneyShort(extraOffRemaining)} More & Get ${couponDiscountText(nextCoupon)}`
                  : `Yay! You unlocked ${couponDiscountText(unlockedCoupon)}`}
              </strong>
              <span className="cart-progress-pill">
                {nextCoupon ? nextCoupon.code : "Unlocked"}
              </span>
            </div>
            <div className="cart-progress-bar">
              <div className="cart-progress-fill" style={{ width: `${extraOffProgress}%` }} />
            </div>
          </div>
        )}

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

                  {stockInfo.isOutOfStock && (
                    <span className="cart-card-oos-badge">Out of Stock</span>
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

        {/* ── Price details (subtotal only — everything else is decided at checkout) ── */}
        {selectedItems.length > 0 && <div className="cart-pricecard">
          <div className="cart-pricecard-head">
            <Icon icon="lucide:receipt-text" />
            <strong>Price details</strong>
          </div>
          <div className="cart-price-total">
            <span>Subtotal ({selectedUnits} item{selectedUnits === 1 ? "" : "s"})</span>
            <strong>{formatMoney(selectedSubtotal)}</strong>
          </div>
          <p className="cart-price-note">Delivery, coupons, gift wrap and wallet are applied at checkout.</p>
          {selectedSavings > 0 && (
            <div className="cart-price-savings">
              You save {formatMoney(selectedSavings)} on this order
            </div>
          )}
          {farthestDeliveryLabel && (
            <div className="cart-delivery-note">
              <Icon icon="lucide:truck" className="cart-delivery-truck" />
              <span>Estimated delivery by <strong>{farthestDeliveryLabel}</strong></span>
              <span
                className={`cart-delivery-info ${showDeliveryTip ? "is-open" : ""}`}
                onClick={() => setShowDeliveryTip((v) => !v)}
              >
                <Icon icon="lucide:info" />
                <span className="cart-delivery-tip">
                  This is an estimated delivery date. It may change based on courier availability and your location.
                </span>
              </span>
            </div>
          )}
        </div>}

      </div>

      {/* ── Sticky checkout bar (only when the top button is off-screen) ── */}
      <div className={`cart-stickybar ${showSticky ? "is-visible" : ""}`}>
        <div className="cart-stickybar-inner">
          {selectedItems.length > 0 && (
            <div className="cart-stickybar-left">
              <span className="cart-stickybar-label">SUBTOTAL ({selectedUnits} Item{selectedUnits === 1 ? "" : "s"})</span>
              <strong className="cart-stickybar-amount">{formatMoney(selectedSubtotal)}</strong>
            </div>
          )}
          <button type="button" className="cart-stickybar-btn" onClick={handleProceed} disabled={selectedItems.length === 0 || !pincode}>
            PROCEED TO BUY ({selectedUnits} ITEM{selectedUnits === 1 ? "" : "S"})
            <Icon icon="lucide:arrow-right" />
          </button>
        </div>
        {selectedSavings > 0 && (
          <span className="cart-stickybar-save">You save {formatMoney(selectedSavings)} on this order</span>
        )}
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
