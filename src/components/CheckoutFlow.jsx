import { Icon } from "@iconify/react";
import { Fragment, useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { imgUrl } from "../utils/cloudinary";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { API_ENDPOINTS } from "../config/api";
import api from "../utils/api";
import { validateCheckoutForm } from "../utils/validation";
import { unwrapApiData } from "../utils/error";
import { LocationPickerModal } from "../pages/Profile/Profile";
import { getProductStockInfo } from "../utils/stockStatus";
import { formatEstimatedDeliveryDate, getEstimatedDeliveryDate } from "../utils/deliveryDate";
import { selectBestCourier, computeCourierShippingCharge, computeCourierCodCharge } from "../utils/courierSelection";
import { numberEnv, requiredEnv } from "../utils/env";
import { buildRazorpayPrefill } from "../utils/razorpay";
import "../pages/Checkout/Checkout.css";
import "./CheckoutWizard.css";
import logoGpay from "../assets/logos/Gpay.png";
import logoUpi from "../assets/logos/upi.png";
import logoCards from "../assets/logos/cards.png";
import logoNetBanking from "../assets/logos/netBanking.png";
import logoEmi from "../assets/logos/emi.png";
import logoWallets from "../assets/logos/wallets.png";
import logoCod from "../assets/logos/cod.png";

const PACKAGING_WEIGHT_KG = numberEnv("VITE_PACKAGING_WEIGHT_KG");
const COD_MAX_AMOUNT = numberEnv("VITE_COD_MAX_AMOUNT");
const PREPAID_DISCOUNT_AMOUNT = numberEnv("VITE_PREPAID_DISCOUNT_AMOUNT");
const COD_FEE_AMOUNT = numberEnv("VITE_COD_FEE_AMOUNT");
const PLATFORM_FEE_AMOUNT = numberEnv("VITE_PLATFORM_FEE_AMOUNT");
const GIFT_CHARGE_AMOUNT = Number(import.meta.env.VITE_GIFT_CHARGE_AMOUNT) || 159;

// Display labels/icons for the chosen online Razorpay method on the confirm step.
const METHOD_LABELS = { gpay: "Google Pay", phonepe: "PhonePe", upi: "Other UPI Apps", card: "Credit / Debit Card", netbanking: "Net Banking", emi: "EMI", wallet: "Wallet" };
const METHOD_ICONS = { gpay: "logos:google-pay", phonepe: "simple-icons:phonepe", upi: "lucide:smartphone", card: "lucide:credit-card", netbanking: "lucide:landmark", emi: "lucide:calculator", wallet: "lucide:wallet" };
// UPI sub-methods all map to Razorpay's "upi" method
const UPI_METHODS = new Set(["gpay", "phonepe", "upi"]);
// Maps our GPay/PhonePe choices to Razorpay's UPI intent app codes. When one of
// these is picked we restrict the checkout to that single app; "upi" and the
// other methods fall through and show Razorpay's full default selection.
const UPI_APP_CODES = { gpay: "google_pay", phonepe: "phonepe" };

// Title shown in the header for each wizard step.
const STEP_TITLES = { address: "Select a Delivery Address", payment: "Select a Payment Method", confirm: "Review Your Order" };
const EMPTY_CHECKOUT_ADDRESS = {
  label: "Home",
  name: "",
  phone: "",
  alternate_phone: "",
  country: "India",
  state: "Uttar Pradesh",
  city: "",
  pincode: "",
  house_building: "",
  area_street: "",
  landmark: "",
  delivery_instructions: "",
  map_address: "",
  map_lat: "",
  map_lng: "",
  is_default: false,
};

const getEmptyCheckoutAddress = (user) => ({
  ...EMPTY_CHECKOUT_ADDRESS,
  name: user?.name || "",
  phone: user?.phone || "",
});

const cleanCheckoutAddress = (address = {}) => ({
  ...EMPTY_CHECKOUT_ADDRESS,
  ...address,
  phone: String(address.phone || "").replace(/[^\d+]/g, ""),
  pincode: String(address.pincode || "").replace(/\D/g, "").slice(0, 6),
});

const getCheckoutAddressLine = (address = {}) =>
  [address.house_building, address.area_street, address.landmark, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(", ");

const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

// Matches the cart page's coupon label (fixed amount or percentage off).
const couponDiscountText = (coupon) => {
  if (!coupon) return "";
  if (coupon.discount_type === "fixed_amount" && Number(coupon.discount_amount) > 0) {
    return `₹${Number(coupon.discount_amount).toLocaleString("en-IN")} OFF`;
  }
  if (Number(coupon.discount_percent) > 0) return `${coupon.discount_percent}% OFF`;
  return "Extra Off";
};

/**
 * The full one-page checkout experience (delivery address, payment method,
 * coupons & offers, gift option, wallet, price breakdown and order placement).
 * It is rendered on the standalone /checkout page (cart flow) and inside the
 * Buy Now overlay.
 *
 * Props:
 *  - selectedItems: when provided the flow runs in "controlled" mode and uses
 *    these live values (Buy Now). When omitted it falls back to the cart
 *    selection stored in sessionStorage by the cart page (/checkout behaviour).
 *  - redirectOnEmpty: navigate to /cart when the cart empties (standalone only).
 *  - couponOverride: Buy Now's own coupon state/handlers. When omitted the flow
 *    fetches the coupon list itself and applies through the cart context.
 */
const CheckoutFlow = ({ selectedItems, redirectOnEmpty = false, onExit, couponOverride }) => {
  const { cart, clearCart, updateQuantity, removeFromCart, appliedCoupon, discountAmount, applyCoupon: cartApplyCoupon, removeCoupon: cartRemoveCoupon } = useCart();
  // Coupons normally come from the cart context. The Buy Now flow has no cart, so
  // it passes `couponOverride` with its own validated-coupon state + handlers.
  const activeAppliedCoupon = couponOverride ? couponOverride.appliedCoupon : appliedCoupon;
  const activeDiscountAmount = couponOverride ? Number(couponOverride.discountAmount || 0) : Number(discountAmount || 0);
  const [couponInput, setCouponInput] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  // Coupon list for the cart flow; Buy Now brings its own via couponOverride.
  const [cartCoupons, setCartCoupons] = useState([]);
  const hasCouponOverride = Boolean(couponOverride);
  // Gift toggle/message owned by the wizard (confirm step, both flows).
  const [giftEnabled, setGiftEnabled] = useState(false);
  const [giftMsg, setGiftMsg] = useState("");
  const [showGiftTip, setShowGiftTip] = useState(false);
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  const controlled = selectedItems !== undefined;

  // Honour the items the shopper selected on the cart page (stored as
  // `${id}-${colorId}` keys). Falls back to the whole cart if nothing was chosen.
  const [selectedKeys] = useState(() => {
    try {
      const raw = sessionStorage.getItem("bk_cart_selected");
      const arr = raw ? JSON.parse(raw) : null;
      return Array.isArray(arr) && arr.length ? new Set(arr) : null;
    } catch {
      return null;
    }
  });
  const selectedCart = controlled
    ? (selectedItems || [])
    : (() => {
        if (!selectedKeys) return cart;
        const filtered = cart.filter((item) => selectedKeys.has(`${item.id}-${item.colorId ?? ""}`));
        return filtered.length ? filtered : cart;
      })();
  const isGift = giftEnabled;
  const giftMessage = giftMsg;

  const checkoutCart = selectedCart.map((item) => {
    const stockInfo = getProductStockInfo(item, item.colorId);
    const isUnavailable = stockInfo.isOutOfStock || Number(item.quantity || 1) > stockInfo.quantity;
    return { ...item, checkoutUnavailable: isUnavailable, checkoutStockInfo: stockInfo };
  });
  const payableCart = checkoutCart.filter((item) => !item.checkoutUnavailable);
  const subtotal = payableCart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
  const selectedUnits = payableCart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  // Slowest item determines the order's processing time. -1 means no item has a
  // per-product value, so the delivery estimate falls back to the env default.
  const maxProcessingDays = payableCart.reduce((max, item) => {
    const days = Number(item.processing_days);
    return Number.isFinite(days) && days > max ? days : max;
  }, -1);
  const [activePayment, setActivePayment] = useState(null);
  // When paying online, which Razorpay method to open to (upi | card | netbanking | emi | wallet).
  const [onlineMethod, setOnlineMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(true);
  const ctaRef = useRef(null);
  const [paymentVerifying, setPaymentVerifying] = useState(false);
  const [shippingCharge, setShippingCharge] = useState(0);
  const [shippingDeliveryDate, setShippingDeliveryDate] = useState(null);
  const [selectedShippingCourier, setSelectedShippingCourier] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  // Upfront COD-charge estimate for the pincode (fetched with is_cod=1) so the Cash on
  // Delivery option can preview the real courier COD charge before it is selected.
  const [codCourierCharge, setCodCourierCharge] = useState(0);
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  // COD is blocked for accounts that previously had a COD order returned to
  // seller (RTO). Such customers can only reorder prepaid.
  const [codBlocked, setCodBlocked] = useState(false);
  // Per-product COD is ignored — every product is COD/prepaid eligible. COD is
  // offered only up to the COD cap (VITE_COD_MAX_AMOUNT); larger orders and
  // COD-blocked accounts are prepaid only.
  const isCodAllowed = payableCart.length > 0 && subtotal <= COD_MAX_AMOUNT && !codBlocked;
  const [useWallet, setUseWallet] = useState(() => {
    try { return localStorage.getItem("bk_use_wallet") === "1"; } catch { return false; }
  });
  // Wizard step shown one at a time: "address" → "payment" → "confirm".
  const [wizardStep, setWizardStep] = useState("address");
  const [showInstructions, setShowInstructions] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [addressForm, setAddressForm] = useState(getEmptyCheckoutAddress(user));
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState(null);
  const [defaultingAddressId, setDefaultingAddressId] = useState(null);
  const [addrFormErrors, setAddrFormErrors] = useState({});
  const rootRef = useRef(null);
  const orderingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const [formData, setFormData] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    address: "",
    city: "",
    pincode: "",
    phone: user?.phone || "",
  });

  const shippingDiscountReason = shippingCharge > 0 ? (isFirstOrder ? "first_order" : "free_delivery") : null;
  const shippingDiscount = shippingDiscountReason ? shippingCharge : 0;
  const finalShippingCharge = Math.max(0, shippingCharge - shippingDiscount);
  // COD fee = the chosen courier's own COD handling charge (cod_charges + subtotal ×
  // cod_multiplier), floored at the configured minimum. Falls back to the env value
  // when no courier is selected yet. Prepaid keeps the flat env discount unchanged.
  // When COD is the active method, charge from the exact courier the order will use
  // (keeps the client total in step with the server, which recomputes from
  // selected_courier_data). Otherwise fall back to the upfront estimate so the option
  // previews the real charge before it's picked.
  const codCourierChargeNow = activePayment === "cod"
    ? computeCourierCodCharge(selectedShippingCourier, subtotal)
    : codCourierCharge;
  const codChargeAmount = Math.max(COD_FEE_AMOUNT, codCourierChargeNow);
  const paymentFee = payableCart.length > 0 && activePayment === "cod" ? codChargeAmount : 0;
  // Delivery is displayed net of the COD charge (billed separately on its own line);
  // the full delivery charge is still what we persist to the order (shipping_charge).
  const shippingChargeShown = Math.max(0, shippingCharge - paymentFee);
  const platformFee = payableCart.length > 0 ? PLATFORM_FEE_AMOUNT : 0;
  const giftCharge = payableCart.length > 0 && isGift ? GIFT_CHARGE_AMOUNT : 0;
  const paymentDiscount = payableCart.length > 0 && activePayment === "online" ? Math.min(PREPAID_DISCOUNT_AMOUNT, subtotal + finalShippingCharge) : 0;
  const orderGrossTotal = Math.max(0, subtotal + finalShippingCharge + paymentFee + platformFee + giftCharge - paymentDiscount);
  const effectiveCouponDiscount = Math.min(activeDiscountAmount, orderGrossTotal);
  const grossAfterCoupon = Math.max(0, orderGrossTotal - effectiveCouponDiscount);
  // COD already lets the shopper pay cash on arrival — wallet credit is prepaid-only.
  const walletEligible = activePayment !== "cod";
  const walletUsableAmount = (useWallet && walletEligible) ? Math.min(Number(walletBalance || 0), grossAfterCoupon) : 0;
  const total = Math.max(0, grossAfterCoupon - walletUsableAmount);
  // Per-item MRP savings, mirroring the cart page's calculation.
  const mrpSavings = payableCart.reduce((sum, item) => {
    const sell = Number(item.price || item.selling_price || 0);
    const mrp = Number(item.mrp_price || item.mrp || 0);
    return sum + (mrp > sell ? (mrp - sell) * Number(item.quantity || 1) : 0);
  }, 0);
  // Everything the shopper genuinely saves: MRP discount + waived delivery +
  // prepaid discount (only when paying online) + coupon. Wallet is excluded —
  // spending your own balance isn't a saving.
  const totalSavings = mrpSavings + shippingChargeShown + paymentDiscount + effectiveCouponDiscount;
  // Payment-step preview stays anchored to the cart subtotal. Confirm-step-only
  // choices such as platform fee, coupon, wallet and gift wrap are shown in the
  // review bill instead of leaking back into "Cart Total".
  const paymentPreviewTotal = Math.max(0, subtotal + paymentFee - paymentDiscount);
  const totalWeightKg = payableCart.reduce((sum, item) => {
    const qty = Math.max(1, Number(item.quantity || 1));
    const raw = Number(item.weight || 0);
    const productWeightKg = raw > 5 ? raw / 1000 : raw;
    return sum + ((productWeightKg + PACKAGING_WEIGHT_KG) * qty);
  }, 0);

  useEffect(() => {
    let cancelled = false;
    const loadOrderState = async () => {
      if (!user?.id) {
        setAddressLoading(false);
        return;
      }
      try {
        const [ordersRes, addressRes, walletRes, meRes] = await Promise.all([
          api.get("/api/orders/my"),
          api.get("/api/addresses").catch(() => ({ data: [] })),
          api.get("/api/wallet").catch(() => ({ data: { wallet_balance: 0 } })),
          api.get("/api/customers/me").catch(() => ({ data: {} })),
        ]);
        if (cancelled) return;
        setCodBlocked(Boolean(meRes.data?.is_cod_blocked));
        const ordersData = unwrapApiData(ordersRes.data);
        const ordersList = Array.isArray(ordersData) ? ordersData : [];
        setIsFirstOrder(ordersList.length === 0);
        const nextAddresses = Array.isArray(addressRes.data) ? addressRes.data.map(cleanCheckoutAddress) : [];
        setAddresses(nextAddresses);
        const defaultAddress = nextAddresses.find((address) => address.is_default) || nextAddresses[0];
        if (defaultAddress) {
          setSelectedAddressId(String(defaultAddress.id));
          setDeliveryInstructions(defaultAddress.delivery_instructions || "");
          setFormData((current) => ({
            ...current,
            fullName: defaultAddress.name || user?.name || current.fullName,
            email: user?.email || current.email,
            address: getCheckoutAddressLine(defaultAddress),
            city: defaultAddress.city || current.city,
            pincode: String(defaultAddress.pincode || current.pincode || ""),
            phone: defaultAddress.phone || user?.phone || current.phone,
          }));
        }
        setWalletBalance(Number(walletRes.data?.wallet_balance || walletRes.data?.balance || 0));
      } catch {
        if (!cancelled) setIsFirstOrder(false);
      } finally {
        if (!cancelled) setAddressLoading(false);
      }
    };
    loadOrderState();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    try { localStorage.setItem("bk_use_wallet", useWallet ? "1" : "0"); } catch {}
  }, [useWallet]);

  // Cart flow only: load active, in-date coupons. Exhausted ones (per-user or
  // global limit reached) stay visible but disabled, mirroring Buy Now's list.
  useEffect(() => {
    if (hasCouponOverride) return undefined;
    let cancelled = false;
    api.get(API_ENDPOINTS.coupons)
      .then((res) => {
        if (cancelled) return;
        const now = Date.now();
        const rows = (Array.isArray(res.data) ? res.data : [])
          .filter((c) => c.is_active !== false)
          .filter((c) => !c.valid_from || new Date(c.valid_from).getTime() <= now)
          .filter((c) => !c.valid_until || new Date(c.valid_until).getTime() >= now)
          .map((c) => ({ ...c, exhausted: c.user_eligible === false }));
        setCartCoupons(rows);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [hasCouponOverride]);

  // Apply a typed/tapped coupon code through the cart context (cart flow).
  const applyCartCouponByCode = (code) => {
    const clean = String(code || "").trim().toUpperCase();
    if (!clean) return;
    const match = cartCoupons.find((c) => !c.exhausted && String(c.code).toUpperCase() === clean);
    if (!match) {
      const used = cartCoupons.some((c) => c.exhausted && String(c.code).toUpperCase() === clean);
      showNotification(used ? "You have already used this coupon." : "Coupon not found or not eligible for your bag.", "warning");
      return;
    }
    if (cartApplyCoupon(match)) setCouponInput("");
  };

  // One shape for the coupon UI: Buy Now's override or the cart-context version.
  const couponCtl = couponOverride || {
    appliedCoupon,
    discountAmount,
    applyCoupon: applyCartCouponByCode,
    removeCoupon: cartRemoveCoupon,
    coupons: cartCoupons,
    loading: false,
  };

  useEffect(() => {
    if (wizardStep !== "confirm") return;
    const el = ctaRef.current;
    if (!el) return;
    const root = document.querySelector(".checkout-page");
    const obs = new IntersectionObserver(
      ([entry]) => setCtaVisible(entry.isIntersecting),
      { root, threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [wizardStep]);

  useEffect(() => {
    if (activePayment === "cod" && !isCodAllowed) {
      setActivePayment("online");
    }
  }, [activePayment, isCodAllowed]);

  const selectAddress = (address) => {
    setSelectedAddressId(String(address.id));
    setDeliveryInstructions(address.delivery_instructions || "");
    setFormData((current) => ({
      ...current,
      fullName: address.name || user?.name || current.fullName,
      email: user?.email || current.email,
      address: getCheckoutAddressLine(address),
      city: address.city || current.city,
      pincode: String(address.pincode || current.pincode || ""),
      phone: address.phone || user?.phone || current.phone,
    }));
  };

  const selectDefaultAddress = (addressList = addresses) => {
    const defaultAddress = addressList.find((address) => address.is_default) || addressList[0];
    if (defaultAddress) selectAddress(defaultAddress);
  };

  const goToAddressStep = () => {
    const currentSelection = addresses.find((address) => String(address.id) === String(selectedAddressId));
    if (currentSelection) {
      selectAddress(currentSelection);
    } else {
      selectDefaultAddress();
    }
    setWizardStep("address");
    document.querySelector('.checkout-page')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectAddressFromCard = (event, address) => {
    if (event.target.closest?.("button, textarea, input, select, a")) return;
    if (String(selectedAddressId) !== String(address.id)) selectAddress(address);
  };

  // Address step → Payment step: lock in the chosen address and advance. If the
  // shopper edited the inline delivery instructions for the address they're
  // delivering to, persist them (best-effort) before moving on.
  const deliverToAddress = async (address) => {
    const isCurrent = String(selectedAddressId) === String(address.id);
    const trimmed = deliveryInstructions.trim();
    let nextAddress = address;
    if (isCurrent && trimmed !== String(address.delivery_instructions || "").trim()) {
      try {
        await api.put(`/api/addresses/${address.id}`, { delivery_instructions: trimmed });
        nextAddress = { ...address, delivery_instructions: trimmed };
        setAddresses((prev) => prev.map((a) => (
          String(a.id) === String(address.id) ? { ...a, delivery_instructions: trimmed } : a
        )));
      } catch {
        // Non-blocking — instructions are a best-effort convenience here.
      }
    }
    selectAddress(nextAddress);
    setWizardStep("payment");
    document.querySelector('.checkout-page')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close the flow: return to the embedding context (Buy Now overlay) when
  // provided, otherwise fall back to the cart page.
  const exitFlow = () => {
    if (onExit) onExit();
    else navigate("/cart");
  };

  // Header back button: step back through the wizard, or out to the cart.
  const handleWizardBack = () => {
    if (wizardStep === "confirm") setWizardStep("payment");
    else if (wizardStep === "payment") {
      goToAddressStep();
      return;
    }
    else exitFlow();
    document.querySelector('.checkout-page')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setAddressForm(getEmptyCheckoutAddress(user));
    setAddrFormErrors({});
  };

  const openAddressModal = (address = null) => {
    if (!address && !editingAddressId && addresses.length >= 3) {
      showNotification("You can save up to 3 addresses only.", "warning");
      return;
    }
    if (address) {
      setEditingAddressId(address.id);
      setAddressForm(cleanCheckoutAddress(address));
    } else {
      resetAddressForm();
    }
    setShowAddressForm(true);
    setAddressModalOpen(true);
  };

  const closeAddressModal = () => {
    setAddressModalOpen(false);
    setShowAddressForm(false);
    setMapOpen(false);
    resetAddressForm();
  };

  const handleAddressFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (addrFormErrors[name]) setAddrFormErrors((prev) => ({ ...prev, [name]: undefined }));
    setAddressForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked
        : name === "pincode" ? value.replace(/\D/g, "").slice(0, 6)
        : name === "phone" ? value.replace(/\D/g, "").slice(0, 10)
        : value,
    }));
  };

  const confirmMapLocation = (location) => {
    setAddressForm((current) => ({
      ...current,
      country: location.country || current.country || "India",
      house_building: location.house_building || current.house_building,
      area_street: location.area_street || current.area_street,
      city: location.city || current.city,
      state: location.state || current.state,
      pincode: location.pincode || current.pincode,
      map_address: location.displayName || current.map_address,
      map_lat: location.center?.[1] || current.map_lat,
      map_lng: location.center?.[0] || current.map_lng,
    }));
    setMapOpen(false);
  };

  const deleteCheckoutAddress = async (address) => {
    try {
      setDeletingAddressId(String(address.id));
      await api.delete(`/api/addresses/${address.id}`);
      const nextAddresses = addresses.filter((a) => String(a.id) !== String(address.id));
      setAddresses(nextAddresses);
      if (String(selectedAddressId) === String(address.id)) {
        const next = nextAddresses.find((a) => a.is_default) || nextAddresses[0];
        if (next) {
          selectAddress(next);
        } else {
          setSelectedAddressId("");
        }
      }
      showNotification("Address deleted.", "success");
    } catch (error) {
      showNotification(error?.response?.data?.message || "Unable to delete address.", "warning");
    } finally {
      setDeletingAddressId(null);
    }
  };

  const makeCheckoutAddressDefault = async (address) => {
    if (!address?.id || address.is_default) return;
    try {
      setDefaultingAddressId(String(address.id));
      await api.put(`/api/addresses/${address.id}`, { is_default: true });
      setAddresses((prev) => prev.map((a) => ({
        ...a,
        is_default: String(a.id) === String(address.id),
      })));
      selectAddress({ ...address, is_default: true });
      showNotification("Default address updated.", "success");
    } catch (error) {
      showNotification(error?.response?.data?.message || "Unable to update default address.", "warning");
    } finally {
      setDefaultingAddressId(null);
    }
  };

  const saveCheckoutAddress = async () => {
    const form = cleanCheckoutAddress(addressForm);
    const phone = normalizePhone(form.phone);
    const errors = {};
    if (!form.name.trim()) errors.name = "Receiver name is required.";
    if (!form.house_building.trim()) errors.house_building = "Address is required.";
    if (!form.city.trim()) errors.city = "City is required.";
    if (!form.state.trim()) errors.state = "State is required.";
    if (!form.pincode || !/^\d{6}$/.test(form.pincode)) errors.pincode = "Enter a valid 6-digit pincode.";
    if (!phone) errors.phone = "Receiver phone number is required.";
    else if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = "Enter a valid 10-digit mobile number.";
    if (Object.keys(errors).length > 0) {
      setAddrFormErrors(errors);
      return;
    }
    setAddrFormErrors({});

    try {
      setAddressSaving(true);
      const payload = {
        ...form,
        name: form.name.trim(),
        phone,
      };
      const response = editingAddressId
        ? await api.put(`/api/addresses/${editingAddressId}`, payload)
        : await api.post("/api/addresses", payload);
      const saved = cleanCheckoutAddress(response.data);
      const addressRes = await api.get("/api/addresses");
      const nextAddresses = Array.isArray(addressRes.data) ? addressRes.data.map(cleanCheckoutAddress) : [saved];
      setAddresses(nextAddresses);
      setSelectedAddressId(String(saved.id));
      selectAddress(saved);
      closeAddressModal();
      showNotification("Address saved.", "success");
    } catch (error) {
      showNotification(error?.response?.data?.message || "Unable to save address.", "warning");
    } finally {
      setAddressSaving(false);
    }
  };

  useEffect(() => {
    if (redirectOnEmpty && cart.length === 0 && !orderingRef.current) {
      navigate("/cart");
    }
    if (rootRef.current) {
      const sections = rootRef.current.querySelectorAll("section");
      sections.forEach((section, index) => {
        setTimeout(() => {
          section.classList.add("reveal");
        }, index * 100);
      });
    }
  }, [cart, navigate, redirectOnEmpty, wizardStep]);

  useEffect(() => {
    const cleanPincode = formData.pincode.trim();
    if (!/^\d{6}$/.test(cleanPincode) || payableCart.length === 0) {
      setShippingCharge(0);
      setShippingDeliveryDate(null);
      setSelectedShippingCourier(null);
      setShippingLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setShippingLoading(true);
        const effectiveWeight = Math.max(0.1, Number(totalWeightKg.toFixed(3)));
        const response = await fetch(
          `${API_ENDPOINTS.shiprocket}/serviceability?pincode=${encodeURIComponent(cleanPincode)}&weight=${effectiveWeight}&is_cod=${activePayment === "cod" ? 1 : 0}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch shipping rates");
        }

        const data = await response.json();
        const couriers = data?.data?.available_courier_companies || [];
        const selectedCourier = selectBestCourier(couriers, {
          weightKg: effectiveWeight,
          requireCod: activePayment === "cod" && subtotal <= COD_MAX_AMOUNT,
        });

        if (!cancelled) {
          setShippingCharge(computeCourierShippingCharge(selectedCourier, {
            isCod: activePayment === "cod",
            orderValue: subtotal,
          }));
          setShippingDeliveryDate(selectedCourier?.etd ? formatEstimatedDeliveryDate(getEstimatedDeliveryDate(selectedCourier.etd, maxProcessingDays >= 0 ? maxProcessingDays : undefined)) : null);
          setSelectedShippingCourier(selectedCourier || null);
        }
      } catch {
        if (!cancelled) {
          setShippingCharge(0);
          setShippingDeliveryDate(null);
          setSelectedShippingCourier(null);
        }
      } finally {
        if (!cancelled) {
          setShippingLoading(false);
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.pincode, payableCart.length, totalWeightKg, activePayment, subtotal, maxProcessingDays]);

  // Preview the COD charge on the payment step before COD is selected. The main fetch
  // above uses is_cod based on the chosen method, so a prepaid/unselected shopper never
  // gets COD pricing — this dedicated is_cod=1 lookup fills that gap without changing the
  // courier picked for prepaid. Skipped once COD is active (the main fetch covers it).
  useEffect(() => {
    const cleanPincode = formData.pincode.trim();
    if (!/^\d{6}$/.test(cleanPincode) || payableCart.length === 0 || !isCodAllowed || activePayment === "cod") {
      setCodCourierCharge(0);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const effectiveWeight = Math.max(0.1, Number(totalWeightKg.toFixed(3)));
        const response = await fetch(
          `${API_ENDPOINTS.shiprocket}/serviceability?pincode=${encodeURIComponent(cleanPincode)}&weight=${effectiveWeight}&is_cod=1`
        );
        if (!response.ok) throw new Error("Failed to fetch COD rates");
        const data = await response.json();
        const codCourier = selectBestCourier(data?.data?.available_courier_companies || [], {
          weightKg: effectiveWeight,
          requireCod: true,
        });
        if (!cancelled) setCodCourierCharge(computeCourierCodCharge(codCourier, subtotal));
      } catch {
        if (!cancelled) setCodCourierCharge(0);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.pincode, payableCart.length, totalWeightKg, subtotal, isCodAllowed, activePayment]);

  const handlePlaceOrder = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const { isValid, errors } = validateCheckoutForm(formData);
    if (!isValid) {
      showNotification(`Please fix: ${Object.values(errors).join(" | ")}`, "warning");
      return;
    }

    setLoading(true);
    try {
      if (payableCart.length === 0) {
        showNotification("All items in your cart are unavailable right now.", "warning");
        setLoading(false);
        return;
      }
      if (activePayment === "cod" && !isCodAllowed) {
        showNotification(`COD is available only up to ${money(COD_MAX_AMOUNT)}.`, "warning");
        setLoading(false);
        return;
      }
      const finalOrderData = {
        customer_name: formData.fullName,
        customer_email: formData.email,
        address: formData.address,
        city: formData.city,
        pincode: formData.pincode,
        phone: formData.phone,
        subtotal_amount: subtotal,
        shipping_charge: shippingCharge,
        shipping_discount: shippingDiscount,
        shipping_discount_reason: shippingDiscountReason,
        selected_courier_data: selectedShippingCourier?.raw || null,
        total_amount: orderGrossTotal,
        coupon_code: activeAppliedCoupon?.code || null,
        discount_amount: effectiveCouponDiscount,
        wallet_amount: walletUsableAmount,
        payment_fee: paymentFee + platformFee,
        payment_discount: paymentDiscount,
        is_gift: isGift,
        gift_message: isGift ? giftMessage : null,
        payment_method: activePayment === 'cod' ? 'COD' : 'Prepaid',
        payment_status: activePayment === 'cod' ? 'Pending' : 'Paid',
        items: payableCart.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          colorId: item.colorId,
        })),
      };

      if (activePayment === "cod" || total <= 0) {
        const dbRes = await api.post("/api/orders", finalOrderData);
        orderingRef.current = true;
        payableCart.forEach((item) => removeFromCart(item.id, item.colorId));
        if (walletUsableAmount > 0) window.dispatchEvent(new CustomEvent("bk:wallet-used", { detail: { deducted: walletUsableAmount } }));
        navigate(`/order-placed?orderId=${dbRes.data.orderId}`);
        return;
      }

      if (!window.Razorpay) {
        throw new Error("Payment gateway is still loading. Please try again.");
      }

      const orderResponse = await api.post(API_ENDPOINTS.razorpay.createOrder, {
        subtotal_amount: subtotal,
        discount_amount: effectiveCouponDiscount,
        wallet_amount: walletUsableAmount,
        is_gift: isGift,
      });
      const razorpayOrder = orderResponse.data;
      if (!orderResponse.status || orderResponse.status >= 400) throw new Error(razorpayOrder.message || "Unable to start payment.");

      const upiAppCode = UPI_APP_CODES[onlineMethod];
      const razorpayOptions = {
        key: requiredEnv("VITE_RAZORPAY_KEY_ID"),
        amount: razorpayOrder.amount,
        currency: "INR",
        name: "Banarasi Kala",
        description: "Banarasi Kala order",
        order_id: razorpayOrder.id,
        prefill: {
          ...buildRazorpayPrefill({
            name: formData.fullName,
            email: formData.email,
            phone: formData.phone,
          }),
          // Open Razorpay straight to the method the shopper picked on the
          // payment step (upi | card | netbanking | emi | wallet).
          method: UPI_METHODS.has(onlineMethod) ? "upi" : onlineMethod,
        },
        theme: { color: "#800020" },
        handler: async (response) => {
          setPaymentVerifying(true);

          const onBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = "";
          };
          window.addEventListener("beforeunload", onBeforeUnload);

          try {
            const verifyRes = await api.post(API_ENDPOINTS.razorpay.verifyPayment, response);
            const verifyData = verifyRes.data;
            if (!verifyData.success) throw new Error(verifyData.message || "Payment verification failed.");

            const dbRes = await api.post("/api/orders", {
              ...finalOrderData,
              payment_gateway: "razorpay",
              gateway_order_id: response.razorpay_order_id,
              gateway_payment_id: response.razorpay_payment_id,
              gateway_signature: response.razorpay_signature,
              gateway_amount_paise: razorpayOrder.amount,
              gateway_currency: razorpayOrder.currency || "INR",
              payment_gateway_response: {
                provider: "razorpay",
                order: razorpayOrder,
                payment: response,
                verification: verifyData,
              },
            });
            orderingRef.current = true;
            payableCart.forEach((item) => removeFromCart(item.id, item.colorId));
            if (walletUsableAmount > 0) window.dispatchEvent(new CustomEvent("bk:wallet-used", { detail: { deducted: walletUsableAmount } }));
            navigate(`/order-placed?orderId=${dbRes.data.orderId}`);
          } catch (error) {
            if (isMountedRef.current) {
              setPaymentVerifying(false);
              showNotification(error.message || "Unable to save paid order.", "error");
            }
          } finally {
            window.removeEventListener("beforeunload", onBeforeUnload);
            if (isMountedRef.current) setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      // GPay / PhonePe: lock the Razorpay checkout to that single UPI app only.
      // Any other choice leaves Razorpay's full default selection visible.
      if (upiAppCode) {
        razorpayOptions.config = {
          display: {
            blocks: {
              [onlineMethod]: {
                name: onlineMethod === "gpay" ? "Pay using Google Pay" : "Pay using PhonePe",
                instruments: [{ method: "upi", apps: [upiAppCode] }],
              },
            },
            sequence: [`block.${onlineMethod}`],
            preferences: { show_default_blocks: false },
          },
        };
      }

      const razorpay = new window.Razorpay(razorpayOptions);
      razorpay.open();
    } catch (err) {
      console.error(err);
      showNotification(err?.response?.data?.message || "We could not place your order. Please try again.", "error");
      setLoading(false);
    } finally {
      if (activePayment === "cod" || total <= 0) setLoading(false);
    }
  };

  const steps = [
    { key: "address", label: "Address", icon: "lucide:map-pin" },
    { key: "payment", label: "Payment", icon: "lucide:credit-card" },
    { key: "confirm", label: "Confirm Order", icon: "lucide:check-circle" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === wizardStep);
  const selectedAddress = addresses.find((a) => String(a.id) === String(selectedAddressId)) || null;
  const selectOnline = (method) => { setActivePayment("online"); setOnlineMethod(method); };
  const isOnline = (method) => activePayment === "online" && onlineMethod === method;

  const payMethodLabel = activePayment === "cod" ? "Cash on Delivery" : (METHOD_LABELS[onlineMethod] || "Online Payment");
  const payMethodIcon = activePayment === "cod" ? "lucide:banknote" : (METHOD_ICONS[onlineMethod] || "lucide:shield-check");
  const payCtaContent = loading ? "PROCESSING…" : (
    <>
      {activePayment === "cod"
        ? <img src={logoCod} alt="" className="ckw-pay-cta-logo" />
        : onlineMethod === "gpay"
          ? <img src={logoGpay} alt="" className="ckw-pay-cta-logo" />
          : onlineMethod === "phonepe"
            ? <Icon icon="simple-icons:phonepe" className="ckw-pay-cta-icon-phonepe" />
            : onlineMethod === "upi"
              ? <img src={logoUpi} alt="" className="ckw-pay-cta-logo" />
              : onlineMethod === "card"
                ? <img src={logoCards} alt="" className="ckw-pay-cta-logo" />
                : onlineMethod === "netbanking"
                  ? <img src={logoNetBanking} alt="" className="ckw-pay-cta-logo" />
                  : onlineMethod === "emi"
                    ? <img src={logoEmi} alt="" className="ckw-pay-cta-logo" />
                    : onlineMethod === "wallet"
                      ? <img src={logoWallets} alt="" className="ckw-pay-cta-logo" />
                      : <Icon icon="lucide:shield-check" className="ckw-pay-cta-icon-brand" />
      }
      <span className="ckw-pay-cta-body">
        <span className="ckw-pay-cta-amount">
          {activePayment === "cod" ? "PLACE ORDER" : "PAY"} with {payMethodLabel}
        </span>
      </span>
    </>
  );
  const confirmAddressLine = selectedAddress ? getCheckoutAddressLine(selectedAddress) : formData.address;

  const payInlineSummary = (
    <div className="ckw-pay-inline-summary">
      <div className="ckw-pay-footer-row">
        <span>Cart Total ({selectedUnits} {selectedUnits === 1 ? "item" : "items"})</span>
        <span>{money(subtotal)}</span>
      </div>
      {activePayment === "online" && paymentDiscount > 0 && (
        <div className="ckw-pay-footer-row ckw-pay-footer-saving">
          <span>Online discount</span>
          <span>-{money(paymentDiscount)}</span>
        </div>
      )}
      {activePayment === "cod" && paymentFee > 0 && (
        <div className="ckw-pay-footer-row ckw-pay-footer-cod">
          <span>COD charge</span>
          <span>+{money(paymentFee)}</span>
        </div>
      )}
      <div className="ckw-pay-footer-row ckw-pay-footer-total">
        <span>Order Total</span>
        <span>{money(paymentPreviewTotal)}</span>
      </div>
      <button
        type="button"
        className="ckw-continue"
        disabled={shippingLoading || payableCart.length === 0}
        onClick={() => { setWizardStep("confirm"); document.querySelector('.checkout-page')?.scrollTo({ top: 0, behavior: 'smooth' }); }}
      >
        {shippingLoading ? "…" : "CONTINUE"}
      </button>
    </div>
  );

  return (
    <div className={`ckw${(wizardStep === "payment" || wizardStep === "confirm") ? " ckw--payment" : ""}`}>
      <div className="ckw-header">
        <button type="button" className="ckw-back" onClick={handleWizardBack} aria-label="Go back">
          <Icon icon="lucide:arrow-left" />
        </button>
        <h1 className="ckw-header-title">{STEP_TITLES[wizardStep]}</h1>
      </div>

      <div className="ckw-stepper">
        {steps.map((s, i) => (
          <Fragment key={s.key}>
            {i > 0 && <span className={`ckw-step-line ${i <= stepIndex ? "is-done" : ""}`} />}
            <div className={`ckw-step ${wizardStep === s.key ? "is-active" : ""} ${i < stepIndex ? "is-done" : ""}`}>
              <span className="ckw-step-dot">
                {i < stepIndex ? <Icon icon="lucide:check" /> : <Icon icon={s.icon} />}
              </span>
              <span className="ckw-step-label">{s.label}</span>
            </div>
          </Fragment>
        ))}
      </div>

      <div className="ckw-body" ref={rootRef}>
        {wizardStep === "address" ? (
          <>
            {addressLoading && !addresses.length ? (
              <div className="ckw-addr-card ckw-addr-skeleton" aria-label="Loading addresses">
                <div className="ckw-addr-main">
                  <span className="ckw-skeleton-line ckw-skeleton-title" />
                  <span className="ckw-skeleton-line ckw-skeleton-text" />
                  <span className="ckw-skeleton-line ckw-skeleton-text short" />
                  <span className="ckw-skeleton-button" />
                </div>
              </div>
            ) : addresses.length > 0 ? (
              <>
                <div className="ckw-addr-head">
                  <span className="ckw-addr-head-title">All Addresses ({addresses.length})</span>
                  <button
                    type="button"
                    className="ckw-add-link"
                    onClick={() => {
                      if (addresses.length >= 3) {
                        showNotification("You can save up to 3 addresses only.", "warning");
                        return;
                      }
                      openAddressModal();
                    }}
                    disabled={addresses.length >= 3}
                  >
                    <Icon icon="lucide:plus" /> {addresses.length >= 3 ? "Address Limit Reached" : "Add New Address"}
                  </button>
                </div>

                {addresses.map((address) => {
                  const isSel = String(selectedAddressId) === String(address.id);
                  return (
                    <div
                      key={address.id}
                      className={`ckw-addr-card ${isSel ? "is-selected" : ""}`}
                      onClick={(event) => selectAddressFromCard(event, address)}
                    >
                      <div className="ckw-addr-main">
                        <div className="ckw-addr-name-row">
                          <span className="ckw-addr-name">{address.name || user?.name}</span>
                          {address.is_default && <span className="ckw-default-badge">Default</span>}
                          <button
                            type="button"
                            className="ckw-addr-menu"
                            onClick={() => deleteCheckoutAddress(address)}
                            disabled={String(deletingAddressId) === String(address.id)}
                            aria-label="Delete address"
                          >
                            <Icon icon="lucide:trash-2" />
                          </button>
                        </div>
                        <p className="ckw-addr-text">{getCheckoutAddressLine(address)}</p>
                        <span className="ckw-addr-phone">Phone: {address.phone || user?.phone}</span>

                        <button
                          type="button"
                          className={`ckw-deliver-btn ${isSel ? "is-active" : ""}`}
                          onClick={() => isSel && deliverToAddress(address)}
                          disabled={!isSel}
                        >
                          <Icon icon="lucide:map-pin" /> DELIVER TO THIS ADDRESS
                        </button>
                        <button type="button" className="ckw-edit-btn" onClick={() => openAddressModal(address)}>
                          <Icon icon="lucide:pencil" /> EDIT ADDRESS
                        </button>
                        {!address.is_default && (
                          <button
                            type="button"
                            className="ckw-default-btn"
                            onClick={() => makeCheckoutAddressDefault(address)}
                            disabled={String(defaultingAddressId) === String(address.id)}
                          >
                            <Icon icon="lucide:star" />
                            {String(defaultingAddressId) === String(address.id) ? "UPDATING..." : "MAKE THIS DEFAULT ADDRESS"}
                          </button>
                        )}

                        {isSel && (
                          <div className="ckw-instructions">
                            <button
                              type="button"
                              className={`ckw-instructions-toggle ${showInstructions ? "is-open" : ""}`}
                              onClick={() => setShowInstructions((v) => !v)}
                            >
                              <Icon icon="lucide:clipboard-list" /> Add delivery instructions (optional)
                              <Icon icon="lucide:chevron-down" className="ckw-instructions-chevron" />
                            </button>
                            {showInstructions && (
                              <textarea
                                className="ckw-instructions-input"
                                rows={3}
                                value={deliveryInstructions}
                                onChange={(e) => setDeliveryInstructions(e.target.value)}
                                placeholder="E.g. Leave at the door, call on arrival…"
                                maxLength={250}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="ckw-empty">
                <span className="ckw-empty-icon"><Icon icon="lucide:map-pin" /></span>
                <strong className="ckw-empty-title">No delivery address</strong>
                <span className="ckw-empty-sub">Add your delivery address to continue with your order.</span>
                <button
                  type="button"
                  className="ckw-empty-btn"
                  onClick={() => {
                    if (addresses.length >= 3) {
                      showNotification("You can save up to 3 addresses only.", "warning");
                      return;
                    }
                    openAddressModal();
                  }}
                  disabled={addresses.length >= 3}
                >
                  <Icon icon="lucide:plus" /> {addresses.length >= 3 ? "ADDRESS LIMIT REACHED" : "ADD NEW ADDRESS"}
                </button>
              </div>
            )}

            <button type="button" className="ckw-back-cart" onClick={exitFlow}>
              <Icon icon="lucide:arrow-left" /> Back to cart
            </button>
          </>
        ) : wizardStep === "payment" ? (
          <>
            <button type="button" className="ckw-deliver-summary" onClick={goToAddressStep}>
              <span className="ckw-deliver-summary-pin"><Icon icon="lucide:map-pin" /></span>
              <span className="ckw-deliver-summary-text">
                <strong>
                  Delivering to {formData.fullName || user?.name}
                  {selectedAddress?.city ? `, ${String(selectedAddress.city).toUpperCase()}` : ""}
                </strong>
                <small>{selectedAddress ? getCheckoutAddressLine(selectedAddress) : formData.address}</small>
                <em>Change delivery address</em>
              </span>
              <Icon icon="lucide:chevron-right" className="ckw-deliver-summary-chev" />
            </button>


            {PREPAID_DISCOUNT_AMOUNT > 0 && (
              <div className="ckw-pay-offer-banner">
                <Icon icon="lucide:badge-percent" />
                <span>Pay online &amp; save <strong>{money(PREPAID_DISCOUNT_AMOUNT)}</strong> on this order</span>
              </div>
            )}

            <div className="ckw-pay-group">
              <button
                type="button"
                className={`ckw-pay-row ${isOnline("gpay") ? "is-selected" : ""}`}
                onClick={() => selectOnline("gpay")}
              >
                <span className={`ckw-pay-radio ${isOnline("gpay") ? "is-on" : ""}`} />
                <span className="ckw-pay-body">
                  <span className="ckw-pay-title">Google Pay</span>
                  <span className="ckw-pay-sub">Pay instantly via GPay</span>
                </span>
                <img src={logoGpay} alt="Google Pay" className="ckw-pay-logo-img" />
              </button>
              {isOnline("gpay") && payInlineSummary}
              <button
                type="button"
                className={`ckw-pay-row ${isOnline("phonepe") ? "is-selected" : ""}`}
                onClick={() => selectOnline("phonepe")}
              >
                <span className={`ckw-pay-radio ${isOnline("phonepe") ? "is-on" : ""}`} />
                <span className="ckw-pay-body">
                  <span className="ckw-pay-title">PhonePe</span>
                  <span className="ckw-pay-sub">Pay via PhonePe UPI</span>
                </span>
                <Icon icon="simple-icons:phonepe" className="ckw-pay-icon-phonepe" />
              </button>
              {isOnline("phonepe") && payInlineSummary}
              <button
                type="button"
                className={`ckw-pay-row ${isOnline("upi") ? "is-selected" : ""}`}
                onClick={() => selectOnline("upi")}
              >
                <span className={`ckw-pay-radio ${isOnline("upi") ? "is-on" : ""}`} />
                <span className="ckw-pay-body">
                  <span className="ckw-pay-title">Other UPI Apps</span>
                  <span className="ckw-pay-sub">Paytm, BHIM &amp; more</span>
                </span>
                <img src={logoUpi} alt="UPI" className="ckw-pay-logo-img" />
              </button>
              {isOnline("upi") && payInlineSummary}
            </div>

            <h4 className="ckw-pay-group-label">Credit &amp; Debit Cards</h4>
            <div className="ckw-pay-group">
              <button
                type="button"
                className={`ckw-pay-row ${isOnline("card") ? "is-selected" : ""}`}
                onClick={() => selectOnline("card")}
              >
                <span className={`ckw-pay-radio ${isOnline("card") ? "is-on" : ""}`} />
                <span className="ckw-pay-body">
                  <span className="ckw-pay-title">Credit or Debit Card</span>
                  <span className="ckw-pay-sub">Visa, Mastercard, RuPay &amp; Amex</span>
                </span>
                <img src={logoCards} alt="Cards" className="ckw-pay-logo-img" />
              </button>
              {isOnline("card") && payInlineSummary}
            </div>

            <h4 className="ckw-pay-group-label">More Ways to Pay</h4>
            <div className="ckw-pay-group">
              <button
                type="button"
                className={`ckw-pay-row ${isOnline("netbanking") ? "is-selected" : ""}`}
                onClick={() => selectOnline("netbanking")}
              >
                <span className={`ckw-pay-radio ${isOnline("netbanking") ? "is-on" : ""}`} />
                <span className="ckw-pay-body">
                  <span className="ckw-pay-title">Net Banking</span>
                  <span className="ckw-pay-sub">All major banks supported</span>
                </span>
                <img src={logoNetBanking} alt="Net Banking" className="ckw-pay-logo-img" />
              </button>
              {isOnline("netbanking") && payInlineSummary}
              <button
                type="button"
                className={`ckw-pay-row ${isOnline("emi") ? "is-selected" : ""}`}
                onClick={() => selectOnline("emi")}
              >
                <span className={`ckw-pay-radio ${isOnline("emi") ? "is-on" : ""}`} />
                <span className="ckw-pay-body">
                  <span className="ckw-pay-title">EMI</span>
                  <span className="ckw-pay-sub">Easy installments on cards</span>
                </span>
                <img src={logoEmi} alt="EMI" className="ckw-pay-logo-img" />
              </button>
              {isOnline("emi") && payInlineSummary}
              <button
                type="button"
                className={`ckw-pay-row ${isOnline("wallet") ? "is-selected" : ""}`}
                onClick={() => selectOnline("wallet")}
              >
                <span className={`ckw-pay-radio ${isOnline("wallet") ? "is-on" : ""}`} />
                <span className="ckw-pay-body">
                  <span className="ckw-pay-title">Wallets</span>
                  <span className="ckw-pay-sub">Paytm, Mobikwik, Freecharge &amp; more</span>
                </span>
                <img src={logoWallets} alt="Wallets" className="ckw-pay-logo-img" />
              </button>
              {isOnline("wallet") && payInlineSummary}
              <button
                type="button"
                className={`ckw-pay-row ${activePayment === "cod" ? "is-selected" : ""} ${isCodAllowed ? "" : "is-disabled"}`}
                disabled={!isCodAllowed}
                onClick={() => { if (isCodAllowed) setActivePayment("cod"); }}
              >
                <span className={`ckw-pay-radio ${activePayment === "cod" ? "is-on" : ""}`} />
                <span className="ckw-pay-body">
                  <span className="ckw-pay-title-row">
                    <span className="ckw-pay-title">Cash on Delivery</span>
                    {isCodAllowed
                      ? <span className="ckw-pay-fee">+{money(codChargeAmount)}</span>
                      : <span className="ckw-pay-fee is-muted">{codBlocked ? "Not available on your account" : `Above ${money(COD_MAX_AMOUNT)} not allowed`}</span>}
                  </span>
                  <span className="ckw-pay-sub">
                    {isCodAllowed
                      ? "Pay with cash when your order arrives"
                      : codBlocked
                        ? "A previous COD order was returned undelivered — please pay online."
                        : "This order is prepaid only"}
                  </span>
                </span>
                <img src={logoCod} alt="Cash on Delivery" className="ckw-pay-logo-img" />
              </button>
              {activePayment === "cod" && payInlineSummary}
            </div>

          </>
        ) : (
          <>
            <div className="ckw-agree">
              <span className="ckw-agree-ico"><Icon icon="lucide:shield-check" /></span>
              <p>
                By placing your order, you agree to Banarasi Kala's{" "}
                <Link to="/privacy-policy">Privacy Policy</Link> and{" "}
                <Link to="/terms-conditions">Terms &amp; Conditions</Link>.
              </p>
            </div>

            <button
              ref={ctaRef}
              type="button"
              className="ckw-pay-cta"
              onClick={handlePlaceOrder}
              disabled={loading || shippingLoading || payableCart.length === 0}
            >
              {payCtaContent}
            </button>

            <div className={`ckw-bill${shippingChargeShown > 0 ? " ckw-bill--attached" : ""}`}>
              <div className="ckw-bill-row">
                <span>Subtotal ({selectedUnits} {selectedUnits === 1 ? "item" : "items"})</span>
                <span>{money(subtotal)}</span>
              </div>
              {platformFee > 0 && (
                <div className="ckw-bill-row">
                  <span>Platform fee</span>
                  <span>{money(platformFee)}</span>
                </div>
              )}
              <div className="ckw-bill-row">
                <span>Delivery</span>
                {shippingLoading ? (
                  <span>Calculating…</span>
                ) : shippingChargeShown > 0 && finalShippingCharge === 0 ? (
                  <span className="ckw-bill-free"><s>{money(shippingChargeShown)}</s> Free</span>
                ) : finalShippingCharge > 0 ? (
                  <span>{money(finalShippingCharge)}</span>
                ) : (
                  <span className="ckw-bill-free">Free</span>
                )}
              </div>
              {giftCharge > 0 && (
                <div className="ckw-bill-row">
                  <span>Gift wrap &amp; message</span>
                  <span>{money(giftCharge)}</span>
                </div>
              )}
              {activePayment === "online" && paymentDiscount > 0 && (
                <div className="ckw-bill-row ckw-bill-save">
                  <span>Prepaid discount</span>
                  <span>-{money(paymentDiscount)}</span>
                </div>
              )}
              {activePayment === "cod" && paymentFee > 0 && (
                <div className="ckw-bill-row ckw-bill-cod">
                  <span>COD charge</span>
                  <span>+{money(paymentFee)}</span>
                </div>
              )}
              {effectiveCouponDiscount > 0 && (
                <div className="ckw-bill-row ckw-bill-save">
                  <span>Coupon ({activeAppliedCoupon?.code})</span>
                  <span>-{money(effectiveCouponDiscount)}</span>
                </div>
              )}
              {walletUsableAmount > 0 && (
                <div className="ckw-bill-row ckw-bill-save">
                  <span>Wallet balance</span>
                  <span>-{money(walletUsableAmount)}</span>
                </div>
              )}
              <div className="ckw-bill-row ckw-bill-order-total">
                <span>Total Payable</span>
                <span>{money(total)}</span>
              </div>
              {totalSavings > 0 && (
                <div className="ckw-bill-savings-banner">
                  You save {money(totalSavings)} on this order
                </div>
              )}
            </div>

            {shippingChargeShown > 0 && (
              <div className="ckw-prime">
                <strong>FREE DELIVERY UNLOCKED</strong>
                <span>You saved {money(shippingChargeShown)} on delivery for this order</span>
              </div>
            )}

            <div className="ckw-confirm-card">
              <button type="button" className="ckw-confirm-row" onClick={() => setWizardStep("payment")}>
                <span className={`ckw-confirm-ico${isOnline("phonepe") ? " ckw-confirm-ico--phonepe" : ""}${isOnline("gpay") ? " ckw-confirm-ico--gpay" : ""}`}>
                  {isOnline("gpay")
                    ? <img src={logoGpay} alt="Google Pay" className="ckw-confirm-ico-img" />
                    : <Icon icon={payMethodIcon} />}
                </span>
                <span className="ckw-confirm-text">
                  <small>PAYING WITH</small>
                  <strong>{payMethodLabel}</strong>
                </span>
                <em className="ckw-confirm-change">Change</em>
              </button>
            </div>

            <div className="ckw-coupon">
              <button
                type="button"
                className={`ckw-coupon-toggle ${couponOpen ? "is-open" : ""}`}
                onClick={() => setCouponOpen((v) => !v)}
              >
                <Icon icon="lucide:badge-percent" />
                <span>{activeAppliedCoupon ? `Coupon ${activeAppliedCoupon.code} applied` : "Apply coupon or offer"}</span>
                <Icon icon="lucide:chevron-down" className="ckw-coupon-chev" />
              </button>
              {couponOpen && (
                <div className="ckw-coupon-panel">
                  {activeAppliedCoupon ? (
                    <div className="ckw-coupon-applied">
                      <span><Icon icon="lucide:ticket" /> {activeAppliedCoupon.code} — you saved {money(effectiveCouponDiscount)}</span>
                      <button type="button" onClick={() => { couponCtl.removeCoupon?.(); setCouponInput(""); }}>Remove</button>
                    </div>
                  ) : (
                    <>
                      <div className="ckw-coupon-entry">
                        <input
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          placeholder="Enter coupon code"
                        />
                        <button type="button" onClick={() => couponCtl.applyCoupon?.(couponInput.trim())}>Apply</button>
                      </div>
                      {(couponCtl.coupons || []).length > 0 ? (
                        <div className="ckw-coupon-list">
                          {couponCtl.coupons.map((c) => {
                            const minPurchase = Number(c.min_purchase_amount || c.minPurchase || 0);
                            const used = Boolean(c.exhausted);
                            const locked = !used && minPurchase > subtotal;
                            return (
                              <button
                                key={c.id || c.code}
                                type="button"
                                className={`ckw-coupon-card${used ? " is-used" : ""}`}
                                onClick={() => couponCtl.applyCoupon?.(c.code)}
                                disabled={used || locked || couponCtl.loading}
                              >
                                <span className="ckw-coupon-tag">{c.code}</span>
                                <span className="ckw-coupon-text">
                                  <strong>{couponDiscountText(c)}</strong>
                                  {used
                                    ? <small>You've already used this coupon</small>
                                    : locked
                                    ? <small>Add {moneyShort(minPurchase - subtotal)} more to apply</small>
                                    : <small>{c.description || "Tap to apply this offer"}</small>}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="ckw-coupon-none">No coupons available right now.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {walletBalance > 0 && (
              <label className={`ckw-confirm-card ckw-wallet-row${walletEligible ? "" : " is-disabled"}`}>
                <span className="ckw-confirm-ico"><Icon icon="lucide:wallet" /></span>
                <span className="ckw-confirm-text">
                  <strong>Use wallet balance</strong>
                  <small>{walletEligible ? `Available ${money(walletBalance)}` : "Not available with Cash on Delivery"}</small>
                </span>
                <input
                  type="checkbox"
                  checked={useWallet && walletEligible}
                  disabled={!walletEligible}
                  onChange={(e) => setUseWallet(e.target.checked)}
                />
              </label>
            )}

            <div className="ckw-confirm-card ckw-gift">
              <label className="ckw-gift-row">
                <span className="ckw-confirm-ico"><Icon icon="lucide:gift" /></span>
                <span className="ckw-confirm-text">
                  <strong>
                    Send as a gift
                    <span
                      className={`ckw-gift-info ${showGiftTip ? "is-open" : ""}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowGiftTip((v) => !v); }}
                    >
                      <Icon icon="lucide:info" />
                      <span className="ckw-gift-tip">Printed on the gift card — keep it personal. No phone numbers, links, or vulgar content.</span>
                    </span>
                  </strong>
                  <small>Include a custom message · +{money(GIFT_CHARGE_AMOUNT)}</small>
                </span>
                <input
                  type="checkbox"
                  checked={giftEnabled}
                  onChange={(e) => { setGiftEnabled(e.target.checked); if (!e.target.checked) setGiftMsg(""); }}
                />
              </label>
              {giftEnabled && (
                <div className="ckw-gift-msg">
                  <textarea
                    value={giftMsg}
                    onChange={(e) => setGiftMsg(e.target.value)}
                    placeholder="Write your gift message…"
                    rows={3}
                    maxLength={250}
                  />
                  <span className="ckw-gift-count">{giftMsg.length}/250</span>
                </div>
              )}
            </div>

            <div className="ckw-confirm-card">
              <button type="button" className="ckw-confirm-row" onClick={goToAddressStep}>
                <span className="ckw-confirm-ico ckw-confirm-pin"><Icon icon="lucide:map-pin" /></span>
                <span className="ckw-confirm-text">
                  <small>DELIVERING TO</small>
                  <strong>{formData.fullName || user?.name}</strong>
                  <span className="ckw-confirm-addr">{confirmAddressLine}</span>
                </span>
                <em className="ckw-confirm-change">Change</em>
              </button>
              <button type="button" className="ckw-confirm-subrow" onClick={goToAddressStep}>
                <Icon icon="lucide:clipboard-list" />
                <span>{deliveryInstructions ? deliveryInstructions : "Add delivery instructions (optional)"}</span>
                <Icon icon="lucide:chevron-right" />
              </button>
            </div>

            {shippingDeliveryDate && (
              <>
                <h4 className="ckw-pay-group-label">Arriving {shippingDeliveryDate}</h4>
                <div className="ckw-arrive">
                  <span className="ckw-arrive-ico"><Icon icon="lucide:calendar-check" /></span>
                  <span className="ckw-arrive-text">
                    <strong>{shippingDeliveryDate}</strong>
                    <small>FREE Standard Delivery</small>
                  </span>
                </div>
              </>
            )}

            <div className="ckw-confirm-items">
              {payableCart.map((item) => {
                const mrp = Number(item.mrp || 0);
                const sell = Number(item.price || 0);
                const disc = mrp > sell ? Math.round((1 - sell / mrp) * 100) : 0;
                return (
                  <div className="ckw-confirm-item" key={`${item.id}-${item.colorId}`}>
                    <Link to={`/product/${item.slug}`} className="ckw-confirm-item-img">
                      <img src={imgUrl(item.image_url, 200)} alt={item.name} />
                    </Link>
                    <div className="ckw-confirm-item-body">
                      <Link to={`/product/${item.slug}`} className="ckw-confirm-item-name">{item.name}</Link>
                      {item.selectedColorName && (
                        <span className="ckw-confirm-item-color">
                          <span className="ckw-confirm-item-color-dot" style={item.selectedColorHex ? { background: item.selectedColorHex } : {}} />
                          {item.selectedColorName}
                        </span>
                      )}
                      <div className="ckw-confirm-price-main-row">
                        {disc > 0 && <em className="ckw-confirm-item-off">-{disc}%</em>}
                        <span className="ckw-confirm-item-price">{money(sell)}</span>
                        {mrp > sell && <span className="ckw-confirm-item-mrp"><span className="ckw-confirm-item-mrp-val">{money(mrp)}</span></span>}
                      </div>
                      <span className="ckw-confirm-item-qty-label">Qty: {item.quantity}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="ckw-legal">
              <Icon icon="lucide:lock" className="ckw-legal-ico" />
              <p>
                When you place your order, we'll email you acknowledging receipt. If you pay using an electronic
                method (card, net banking or UPI), you'll complete payment securely via Razorpay. Your contract is
                complete once we receive payment and dispatch your item. For Pay on Delivery (POD), you can pay by
                cash / UPI / card when you receive your item. See our{" "}
                <Link to="/return-exchange">Return Policy</Link>.
              </p>
            </div>

            <button type="button" className="ckw-back-cart" onClick={exitFlow}>
              <Icon icon="lucide:arrow-left" /> Back to cart
            </button>

            {!ctaVisible && (
              <button
                type="button"
                className="ckw-pay-cta ckw-pay-cta--sticky"
                onClick={handlePlaceOrder}
                disabled={loading || shippingLoading || payableCart.length === 0}
              >
                {payCtaContent}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Footer (shared across all steps) ── */}
      <div className="ckw-footer">
        <div className="ckw-secure-note">
          <Icon icon="lucide:lock" />
          <span>Your payment details are secure and encrypted. We never store your card details.</span>
        </div>
        <div className="ckw-help">
          <Icon icon="lucide:message-circle" />
          <span>Need help? <Link to="/contact">Contact Us</Link></span>
        </div>
      </div>

      {addressModalOpen && (
        <div className="buy-now-address-modal" role="dialog" aria-modal="true" aria-label={editingAddressId ? "Edit address" : "Add new address"}>
          <div className="buy-now-address-modal-card">
            <button type="button" className="buy-now-address-modal-close" onClick={closeAddressModal} aria-label="Close address form">
              <Icon icon="lucide:x" />
            </button>
            <div className="buy-now-section-title buy-now-address-modal-title">
              <h3>{editingAddressId ? "Edit address" : "Add new address"}</h3>
            </div>

            <div className="buy-now-location-card">
              <div>
                <span>Map address</span>
                {addressForm.map_address ? (
                  <>
                    <strong>{addressForm.map_address}</strong>
                    <small>Saved separately from the address you type below.</small>
                  </>
                ) : (
                  <small>Add live location for better delivery accuracy.</small>
                )}
              </div>
              <div className="buy-now-location-actions">
                <button type="button" onClick={() => setMapOpen(true)}>
                  <Icon icon="lucide:map-pin" />
                  {addressForm.map_address ? "Change location" : "Add new location"}
                </button>
                {addressForm.map_address ? (
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => setAddressForm((current) => ({ ...current, map_address: "", map_lat: "", map_lng: "" }))}
                  >
                    <Icon icon="lucide:x" />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            {showAddressForm && (
              <div className="buy-now-address-form">
                <label>
                  <span>Label</span>
                  <select name="label" value={addressForm.label} onChange={handleAddressFormChange}>
                    <option>Home</option>
                    <option>Work</option>
                    <option>Other</option>
                  </select>
                </label>
                <label>
                  <span>Receiver name *</span>
                  <input name="name" value={addressForm.name} onChange={handleAddressFormChange} placeholder="Enter receiver name" />
                  {addrFormErrors.name && <em className="buy-now-field-error">{addrFormErrors.name}</em>}
                </label>
                <label>
                  <span>Receiver phone number *</span>
                  <div className="buy-now-phone-input">
                    <span className="buy-now-country-code"><span className="buy-now-flag-india" aria-hidden="true" />+91</span>
                    <input name="phone" inputMode="tel" maxLength={10} placeholder="10-digit mobile number" value={addressForm.phone} onChange={handleAddressFormChange} />
                  </div>
                  {addrFormErrors.phone && <em className="buy-now-field-error">{addrFormErrors.phone}</em>}
                </label>
                <label>
                  <span>Flat, House no., Building *</span>
                  <input name="house_building" value={addressForm.house_building} onChange={handleAddressFormChange} placeholder="Flat, house no. or building" />
                  {addrFormErrors.house_building && <em className="buy-now-field-error">{addrFormErrors.house_building}</em>}
                </label>
                <label>
                  <span>Area, Street, Sector</span>
                  <input name="area_street" value={addressForm.area_street} onChange={handleAddressFormChange} placeholder="Area, street or sector" />
                </label>
                <div className="buy-now-form-row">
                  <label>
                    <span>City *</span>
                    <input name="city" value={addressForm.city} onChange={handleAddressFormChange} placeholder="Enter city" />
                    {addrFormErrors.city && <em className="buy-now-field-error">{addrFormErrors.city}</em>}
                  </label>
                  <label>
                    <span>State *</span>
                    <input name="state" value={addressForm.state} onChange={handleAddressFormChange} placeholder="Enter state" />
                    {addrFormErrors.state && <em className="buy-now-field-error">{addrFormErrors.state}</em>}
                  </label>
                </div>
                <label>
                  <span>Pincode *</span>
                  <input name="pincode" inputMode="numeric" value={addressForm.pincode} onChange={handleAddressFormChange} placeholder="6-digit pincode" />
                  {addrFormErrors.pincode && <em className="buy-now-field-error">{addrFormErrors.pincode}</em>}
                </label>
                <label>
                  <span>Landmark (optional)</span>
                  <input name="landmark" value={addressForm.landmark} onChange={handleAddressFormChange} placeholder="e.g. near city mall" />
                </label>
                <label>
                  <span>Delivery instructions (optional)</span>
                  <textarea
                    name="delivery_instructions"
                    rows={2}
                    maxLength={250}
                    value={addressForm.delivery_instructions}
                    onChange={handleAddressFormChange}
                    placeholder="e.g. leave at the door, call on arrival..."
                  />
                </label>
                <label className="buy-now-checkbox">
                  <input type="checkbox" name="is_default" checked={addressForm.is_default} onChange={handleAddressFormChange} />
                  <span>Set as default address</span>
                </label>
                <div className="buy-now-form-actions">
                  <button type="button" onClick={closeAddressModal} disabled={addressSaving}>
                    Cancel
                  </button>
                  <button type="button" onClick={saveCheckoutAddress} disabled={addressSaving}>
                    {addressSaving ? "Saving..." : "Save address"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <LocationPickerModal
        open={mapOpen}
        initialQuery={[addressForm.house_building, addressForm.city, addressForm.state].filter(Boolean).join(", ")}
        onClose={() => setMapOpen(false)}
        onConfirm={confirmMapLocation}
      />

      {paymentVerifying && (
        <div className="checkout-processing-overlay">
          <div className="checkout-processing-card">
            <span className="checkout-processing-spinner" />
            <strong>Processing your payment…</strong>
            <p>Please wait, do not close this page.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutFlow;
