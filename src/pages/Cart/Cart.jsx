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
import { numberEnv } from "../../utils/env";
import { selectBestCourier } from "../../utils/courierSelection";
import api from "../../utils/api";
import { API_ENDPOINTS } from "../../config/api";
import { unwrapApiData } from "../../utils/error";
import "./Cart.css";

// Flat charge for gift wrapping + custom message. Mirrors the server's
// GIFT_CHARGE_AMOUNT (default 159); the backend is authoritative.
const GIFT_CHARGE = Number(import.meta.env.VITE_GIFT_CHARGE_AMOUNT) || 159;

// Flat platform fee shown in the cart price summary. Mirrors the checkout /
// server value; the backend remains authoritative at order time.
const PLATFORM_FEE = numberEnv("VITE_PLATFORM_FEE_AMOUNT");

// Payment-method offers/charges, mirrored from the checkout. Online gets a flat
// prepaid discount; COD adds a flat fee and is only offered up to COD_MAX
// (VITE_COD_MAX_AMOUNT, e.g. 4999) — larger orders are prepaid only.
const PREPAID_DISCOUNT = numberEnv("VITE_PREPAID_DISCOUNT_AMOUNT");
const COD_FEE = numberEnv("VITE_COD_FEE_AMOUNT");
const COD_MAX = numberEnv("VITE_COD_MAX_AMOUNT");

// Per-parcel packaging weight added to each item when asking the courier for a
// shipping rate (mirrors the checkout's calculation).
const PACKAGING_WEIGHT_KG = numberEnv("VITE_PACKAGING_WEIGHT_KG");

// Gift-card message length cap (keeps it card-sized; backend also caps it).
const GIFT_MESSAGE_MAX = 250;

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
    getSubtotal,
    refreshCart,
    loading,
    appliedCoupon,
    discountAmount,
    applyCoupon,
    removeCoupon,
  } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showNotification } = useNotification();
  const { pincode, courierEtd, setPincode } = useDeliveryLocation();

  const [stockAlerts, setStockAlerts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [giftWrap, setGiftWrap] = useState(false);
  const [activePayment, setActivePayment] = useState("online");
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [shippingCharge, setShippingCharge] = useState(0);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [editingPin, setEditingPin] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const [showGiftTip, setShowGiftTip] = useState(false);
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

  // Load coupons and keep only active, in-date ones with a real minimum (> ₹1),
  // sorted by ascending min purchase — these drive the extra-off progress nudge.
  useEffect(() => {
    let cancelled = false;
    api.get(API_ENDPOINTS.coupons)
      .then((res) => {
        if (cancelled) return;
        const now = Date.now();
        const list = (Array.isArray(res.data) ? res.data : [])
          .filter((c) => c.is_active !== false)
          // Drop coupons this shopper has already exhausted (per-user/global limit).
          // user_eligible is only present for logged-in shoppers; undefined ⇒ keep.
          .filter((c) => c.user_eligible !== false)
          .filter((c) => !c.valid_from || new Date(c.valid_from).getTime() <= now)
          .filter((c) => !c.valid_until || new Date(c.valid_until).getTime() >= now)
          .map((c) => ({ ...c, minPurchase: Number(c.min_purchase_amount || 0) }))
          // Keep coupons that carry any real minimum (> 0). Coupons with a tiny
          // ₹1 minimum (e.g. welcome offers) qualify; only truly no-minimum (0)
          // coupons are skipped so the progress bar never divides by zero.
          .filter((c) => c.minPurchase > 0)
          .sort((a, b) => a.minPurchase - b.minPurchase);
        setCoupons(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Load the shopper's wallet balance so they can optionally redeem it here.
  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    api.get("/api/wallet")
      .then((res) => {
        if (cancelled) return;
        setWalletBalance(Number(res.data?.wallet_balance || res.data?.balance || 0));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

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
  // Billable weight (product + packaging per unit) used to ask the courier for
  // the real shipping rate that we then show struck-through against "Free".
  const totalWeightKg = selectedItems.reduce((sum, item) => {
    const qty = Math.max(1, Number(item.quantity || 1));
    const raw = Number(item.weight || 0);
    const productWeightKg = raw > 5 ? raw / 1000 : raw;
    return sum + ((productWeightKg + PACKAGING_WEIGHT_KG) * qty);
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

  // Per-product COD availability is ignored for now — every product is treated as
  // COD/prepaid eligible. COD is offered only up to the COD cap
  // (VITE_COD_MAX_AMOUNT); orders above it are prepaid only.
  // const isProductCodAllowed = selectedItems.length > 0
  //   && selectedItems.every((item) => Array.isArray(item.payment_options) && item.payment_options.includes("cod"));
  const isCodAllowed = selectedItems.length > 0 && selectedSubtotal <= COD_MAX;

  // Price summary for the selected items. Delivery is free in the cart; the real
  // shipping is settled in the checkout flow. Coupon discount is capped at the
  // subtotal. Payment-method offers (prepaid discount / COD fee) follow the
  // selected method, mirroring the checkout.
  const cartGiftCharge = giftWrap ? GIFT_CHARGE : 0;
  const cartPlatformFee = selectedItems.length > 0 ? PLATFORM_FEE : 0;
  const cartPaymentFee = selectedItems.length > 0 && activePayment === "cod" ? COD_FEE : 0;
  const cartPaymentDiscount = selectedItems.length > 0 && activePayment === "online"
    ? Math.min(PREPAID_DISCOUNT, selectedSubtotal)
    : 0;
  const cartCouponDiscount = appliedCoupon ? Math.min(Number(discountAmount || 0), selectedSubtotal) : 0;
  const cartGrossTotal = Math.max(
    0,
    (selectedSubtotal || getSubtotal()) + cartPlatformFee + cartGiftCharge + cartPaymentFee - cartPaymentDiscount - cartCouponDiscount,
  );
  // Wallet is redeemed last, capped at the remaining payable amount.
  const cartWalletUsable = useWallet ? Math.min(Number(walletBalance || 0), cartGrossTotal) : 0;
  const cartTotal = Math.max(0, cartGrossTotal - cartWalletUsable);

  // Fall back to online payment if COD stops being available (cap exceeded or a
  // non-COD item is in the selection).
  useEffect(() => {
    if (activePayment === "cod" && !isCodAllowed) setActivePayment("online");
  }, [activePayment, isCodAllowed]);

  // Fetch the real courier rate for the cart's pincode so the delivery row can
  // show the actual charge struck-through against "Free". Debounced; mirrors the
  // checkout's serviceability lookup.
  useEffect(() => {
    const cleanPincode = String(pincode || "").trim();
    if (!/^\d{6}$/.test(cleanPincode) || selectedItems.length === 0) {
      setShippingCharge(0);
      setShippingLoading(false);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setShippingLoading(true);
        const effectiveWeight = Math.max(0.1, Number(totalWeightKg.toFixed(3)));
        const response = await fetch(
          `${API_ENDPOINTS.shiprocket}/serviceability?pincode=${encodeURIComponent(cleanPincode)}&weight=${effectiveWeight}&is_cod=${activePayment === "cod" ? 1 : 0}`,
        );
        if (!response.ok) throw new Error("Failed to fetch shipping rates");
        const data = await response.json();
        const couriers = data?.data?.available_courier_companies || [];
        const best = selectBestCourier(couriers, {
          weightKg: effectiveWeight,
          requireCod: activePayment === "cod" && selectedSubtotal <= COD_MAX,
        });
        if (!cancelled) setShippingCharge(best?.rate || 0);
      } catch {
        if (!cancelled) setShippingCharge(0);
      } finally {
        if (!cancelled) setShippingLoading(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pincode, selectedItems.length, totalWeightKg, activePayment, selectedSubtotal]);

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
    // Carry the chosen items (and gift preference) through to checkout.
    sessionStorage.setItem("bk_cart_selected", JSON.stringify(selectedItems.map(itemKey)));
    sessionStorage.setItem("bk_cart_gift", giftWrap ? "1" : "0");
    sessionStorage.setItem("bk_cart_gift_message", giftWrap ? giftMessage.trim() : "");
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
                    · {pincode} <span className="cart-pin-change-label">Change</span>
                  </button>
                </span>
              )}
            </div>
            <div className="cart-summary-amount">
              <span className="cart-summary-amount-label">TOTAL</span>
              <strong>{formatMoney(cartTotal)}</strong>
            </div>
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

          <div className="cart-gift-block">
            <label className="cart-gift">
              <input
                type="checkbox"
                checked={giftWrap}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setGiftWrap(checked);
                  if (!checked) setGiftMessage("");
                }}
              />
              <span className="cart-gift-box"><Icon icon="lucide:check" /></span>
              <span className="cart-gift-text">
                Send as a gift. Include custom message
                <span
                  className={`cart-gift-info ${showGiftTip ? "is-open" : ""}`}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowGiftTip((v) => !v); }}
                >
                  <Icon icon="lucide:info" />
                  <span className="cart-gift-tip">Printed on the gift card — keep it personal. No phone numbers, links, or vulgar content.</span>
                </span>
              </span>
              <span className="cart-gift-charge">+{formatMoneyShort(GIFT_CHARGE)}</span>
            </label>
            {giftWrap && (
              <div className="cart-gift-msg-wrap">
                <textarea
                  className="cart-gift-input"
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  placeholder="Write your gift message…"
                  rows={3}
                  maxLength={GIFT_MESSAGE_MAX}
                />
                <span className="cart-gift-count">{giftMessage.length}/{GIFT_MESSAGE_MAX}</span>
              </div>
            )}
          </div>
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

                  {/* "Only X left in this color" badge — hidden for now
                  {(stockInfo.isOutOfStock || stockInfo.isLowStock) && (
                    <p className={`cart-stock-note ${stockInfo.isOutOfStock ? "out" : "low"}`}>
                      {stockInfo.colorMessage || stockInfo.badge}
                    </p>
                  )}
                  */}

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

        {/* ── Payment method ── */}
        <div className="cart-pricecard">
          <div className="cart-pricecard-head">
            <Icon icon="lucide:wallet" />
            <strong>Payment method</strong>
          </div>
          <div className="cart-pay-grid">
            <button
              type="button"
              className={`cart-pay-option ${activePayment === "online" ? "is-active" : ""}`}
              onClick={() => setActivePayment("online")}
            >
              <Icon icon="lucide:shield-check" className="cart-pay-icon" />
              <span className="cart-pay-name">Online Payment</span>
              <small className="cart-pay-offer">
                {PREPAID_DISCOUNT > 0 ? `${formatMoneyShort(PREPAID_DISCOUNT)} extra off` : "Pay securely online"}
              </small>
            </button>
            <button
              type="button"
              disabled={!isCodAllowed}
              className={`cart-pay-option ${activePayment === "cod" ? "is-active" : ""}`}
              onClick={() => {
                if (isCodAllowed) {
                  setActivePayment("cod");
                } else {
                  showNotification(`Orders above ${formatMoneyShort(COD_MAX)} are prepaid only.`, "warning");
                }
              }}
            >
              <Icon icon="lucide:banknote" className="cart-pay-icon" />
              <span className="cart-pay-name">Cash on Delivery</span>
              <small className="cart-pay-offer">
                {isCodAllowed
                  ? `${formatMoneyShort(COD_FEE)} COD charge`
                  : `Not available above ${formatMoneyShort(COD_MAX)}`}
              </small>
            </button>
          </div>
        </div>

        {/* ── Coupons & offers ── */}
        <div className="cart-pricecard">
          <div className="cart-pricecard-head">
            <Icon icon="lucide:badge-percent" />
            <strong>Coupons &amp; offers</strong>
          </div>
          {appliedCoupon ? (
            <div className="cart-coupon-applied">
              <span className="cart-coupon-applied-info">
                <Icon icon="lucide:ticket" />
                <span>
                  <strong>{appliedCoupon.code} applied</strong>
                  <small>You saved {formatMoney(cartCouponDiscount)}</small>
                </span>
              </span>
              <button type="button" className="cart-coupon-remove" onClick={removeCoupon}>
                Remove
              </button>
            </div>
          ) : coupons.length > 0 ? (
            <div className="cart-coupon-options">
              {coupons.map((c) => {
                const locked = c.minPurchase > selectedSubtotal;
                return (
                  <button
                    key={c.id || c.code}
                    type="button"
                    className="cart-coupon-option"
                    onClick={() => applyCoupon(c)}
                    disabled={locked}
                  >
                    <span className="cart-coupon-tag">{c.code}</span>
                    <span className="cart-coupon-option-text">
                      <strong>{couponDiscountText(c)}</strong>
                      {locked
                        ? <small>Add {formatMoneyShort(c.minPurchase - selectedSubtotal)} more to apply</small>
                        : <small>{c.description || "Tap to apply this offer"}</small>}
                    </span>
                    <Icon icon="lucide:chevron-right" />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="cart-coupon-none">No coupons available right now.</p>
          )}
        </div>

        {/* ── Wallet balance ── */}
        {walletBalance > 0 && (
          <div className="cart-pricecard">
            <label className="cart-wallet">
              <span className="cart-wallet-info">
                <Icon icon="lucide:wallet" />
                <span>
                  <strong>Use wallet balance</strong>
                  <small>Available {formatMoney(walletBalance)}</small>
                </span>
              </span>
              <span className="cart-wallet-switch">
                <input
                  type="checkbox"
                  checked={useWallet}
                  onChange={(e) => setUseWallet(e.target.checked)}
                />
                <span className="cart-wallet-slider" />
              </span>
            </label>
          </div>
        )}

        {/* ── Price details ── */}
        <div className="cart-pricecard">
          <div className="cart-pricecard-head">
            <Icon icon="lucide:receipt-text" />
            <strong>Price details</strong>
          </div>
          <div className="cart-price-rows">
            <div className="cart-price-row">
              <span>Subtotal ({selectedUnits} item{selectedUnits === 1 ? "" : "s"})</span>
              <span>{formatMoney(selectedSubtotal)}</span>
            </div>
            <div className="cart-price-row">
              <span>Platform fee</span>
              <span>{formatMoney(cartPlatformFee)}</span>
            </div>
            {cartPaymentFee > 0 && (
              <div className="cart-price-row">
                <span>COD charge</span>
                <span>{formatMoney(cartPaymentFee)}</span>
              </div>
            )}
            {cartGiftCharge > 0 && (
              <div className="cart-price-row">
                <span>Gift wrap &amp; message</span>
                <span>{formatMoney(cartGiftCharge)}</span>
              </div>
            )}
            <div className="cart-price-row">
              <span>Delivery</span>
              {shippingLoading ? (
                <span>Calculating…</span>
              ) : shippingCharge > 0 ? (
                <span className="cart-price-free"><s>{formatMoney(shippingCharge)}</s> Free</span>
              ) : (
                <span className="cart-price-free">Free</span>
              )}
            </div>
            {cartPaymentDiscount > 0 && (
              <div className="cart-price-row cart-price-row--save">
                <span>Prepaid discount</span>
                <span>-{formatMoney(cartPaymentDiscount)}</span>
              </div>
            )}
            {cartCouponDiscount > 0 && (
              <div className="cart-price-row cart-price-row--save">
                <span>Coupon ({appliedCoupon.code})</span>
                <span>-{formatMoney(cartCouponDiscount)}</span>
              </div>
            )}
            {cartWalletUsable > 0 && (
              <div className="cart-price-row cart-price-row--save">
                <span>Wallet used</span>
                <span>-{formatMoney(cartWalletUsable)}</span>
              </div>
            )}
          </div>
          <div className="cart-price-total">
            <span>Total Payable</span>
            <strong>{formatMoney(cartTotal)}</strong>
          </div>
          {selectedSavings + cartCouponDiscount > 0 && (
            <div className="cart-price-savings">
              You save {formatMoney(selectedSavings + cartCouponDiscount)} on this order
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
        </div>

      </div>

      {/* ── Sticky checkout bar (only when the top button is off-screen) ── */}
      <div className={`cart-stickybar ${showSticky ? "is-visible" : ""}`}>
        <div className="cart-stickybar-inner">
          <div className="cart-stickybar-left">
            <span className="cart-stickybar-label">TOTAL ({selectedUnits} Item{selectedUnits === 1 ? "" : "s"})</span>
            <strong className="cart-stickybar-amount">{formatMoney(cartTotal)}</strong>
            {selectedSavings > 0 && (
              <span className="cart-stickybar-save">You save {formatMoneyShort(selectedSavings)} on this order!</span>
            )}
          </div>
          <button type="button" className="cart-stickybar-btn" onClick={handleProceed} disabled={selectedItems.length === 0 || !pincode}>
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
