import { Icon } from "@iconify/react";
import { Fragment, useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { API_ENDPOINTS } from "../config/api";
import api from "../utils/api";
import { validateCheckoutForm } from "../utils/validation";
import { unwrapApiData } from "../utils/error";
import { LocationPickerModal } from "../pages/Profile/Profile";
import CheckoutOrderPanel from "./CheckoutOrderPanel";
import { getProductStockInfo } from "../utils/stockStatus";
import { formatEstimatedDeliveryDate, getEstimatedDeliveryDate } from "../utils/deliveryDate";
import { getVariantSku } from "../utils/itemCode";
import { selectBestCourier } from "../utils/courierSelection";
import { numberEnv, requiredEnv } from "../utils/env";
import { buildRazorpayPrefill } from "../utils/razorpay";
import brandLogo from "../assets/vertical_logo.png";
import "../pages/Checkout/Checkout.css";
import "./CheckoutWizard.css";

const PACKAGING_WEIGHT_KG = numberEnv("VITE_PACKAGING_WEIGHT_KG");
const COD_MAX_AMOUNT = numberEnv("VITE_COD_MAX_AMOUNT");
const PREPAID_DISCOUNT_AMOUNT = numberEnv("VITE_PREPAID_DISCOUNT_AMOUNT");
const COD_FEE_AMOUNT = numberEnv("VITE_COD_FEE_AMOUNT");
const PLATFORM_FEE_AMOUNT = numberEnv("VITE_PLATFORM_FEE_AMOUNT");
const GIFT_CHARGE_AMOUNT = Number(import.meta.env.VITE_GIFT_CHARGE_AMOUNT) || 159;
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

/**
 * The full one-page checkout experience (delivery address, payment method,
 * coupons & offers, wallet, price breakdown and order placement). It is rendered
 * both on the standalone /checkout page and embedded below the cart items.
 *
 * Props:
 *  - selectedItems / isGift / giftMessage: when provided the flow runs in
 *    "controlled" mode and uses these live values (cart embedding). When omitted
 *    it falls back to the cart selection + gift preference stored in
 *    sessionStorage by the cart page (standalone /checkout behaviour).
 *  - redirectOnEmpty: navigate to /cart when the cart empties (standalone only).
 */
const CheckoutFlow = ({ selectedItems, isGift: isGiftProp, giftMessage: giftMessageProp, redirectOnEmpty = false }) => {
  const { cart, clearCart, appliedCoupon, discountAmount, applyCoupon: cartApplyCoupon, removeCoupon: cartRemoveCoupon } = useCart();
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
  const [sessionIsGift] = useState(() => sessionStorage.getItem("bk_cart_gift") === "1");
  const [sessionGiftMessage] = useState(() => sessionStorage.getItem("bk_cart_gift_message") || "");

  const selectedCart = controlled
    ? (selectedItems || [])
    : (() => {
        if (!selectedKeys) return cart;
        const filtered = cart.filter((item) => selectedKeys.has(`${item.id}-${item.colorId ?? ""}`));
        return filtered.length ? filtered : cart;
      })();
  const isGift = controlled ? Boolean(isGiftProp) : sessionIsGift;
  const giftMessage = controlled ? (giftMessageProp || "") : sessionGiftMessage;

  const checkoutCart = selectedCart.map((item) => {
    const stockInfo = getProductStockInfo(item, item.colorId);
    const isUnavailable = stockInfo.isOutOfStock || Number(item.quantity || 1) > stockInfo.quantity;
    return { ...item, checkoutUnavailable: isUnavailable, checkoutStockInfo: stockInfo };
  });
  const payableCart = checkoutCart.filter((item) => !item.checkoutUnavailable);
  const unavailableCart = checkoutCart.filter((item) => item.checkoutUnavailable);
  const subtotal = payableCart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
  // Slowest item determines the order's processing time. -1 means no item has a
  // per-product value, so the delivery estimate falls back to the env default.
  const maxProcessingDays = payableCart.reduce((max, item) => {
    const days = Number(item.processing_days);
    return Number.isFinite(days) && days > max ? days : max;
  }, -1);
  // Per-product COD is ignored — every product is COD/prepaid eligible. COD is
  // offered only up to the COD cap (VITE_COD_MAX_AMOUNT); larger orders are
  // prepaid only (mirrors the cart rule).
  const isCodAllowed = payableCart.length > 0 && subtotal <= COD_MAX_AMOUNT;
  const [activePayment, setActivePayment] = useState("online");
  // When paying online, which Razorpay method to open to (upi | card | netbanking | emi | wallet).
  const [onlineMethod, setOnlineMethod] = useState("upi");
  const [loading, setLoading] = useState(false);
  const [paymentVerifying, setPaymentVerifying] = useState(false);
  const [shippingCharge, setShippingCharge] = useState(0);
  const [shippingDeliveryDate, setShippingDeliveryDate] = useState(null);
  const [selectedShippingCourier, setSelectedShippingCourier] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [couponCode, setCouponCode] = useState(appliedCoupon?.code || "");
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [couponPanelOpen, setCouponPanelOpen] = useState(false);
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [couponCelebration, setCouponCelebration] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState("details");
  // Wizard step shown one at a time: "address" → "payment" → "confirm".
  const [wizardStep, setWizardStep] = useState("address");
  const [showInstructions, setShowInstructions] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [promoOpen, setPromoOpen] = useState(false);
  const [addressForm, setAddressForm] = useState(getEmptyCheckoutAddress(user));
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState(null);
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
  const paymentFee = payableCart.length > 0 && activePayment === "cod" ? COD_FEE_AMOUNT : 0;
  const platformFee = payableCart.length > 0 ? PLATFORM_FEE_AMOUNT : 0;
  const giftCharge = payableCart.length > 0 && isGift ? GIFT_CHARGE_AMOUNT : 0;
  const paymentDiscount = payableCart.length > 0 && activePayment === "online" ? Math.min(PREPAID_DISCOUNT_AMOUNT, subtotal + finalShippingCharge) : 0;
  const orderGrossTotal = Math.max(0, subtotal + finalShippingCharge + paymentFee + platformFee + giftCharge - paymentDiscount);
  const effectiveCouponDiscount = Math.min(discountAmount, orderGrossTotal);
  const grossAfterCoupon = Math.max(0, orderGrossTotal - effectiveCouponDiscount);
  const walletUsableAmount = useWallet ? Math.min(Number(walletBalance || 0), grossAfterCoupon) : 0;
  const total = Math.max(0, grossAfterCoupon - walletUsableAmount);
  const totalWeightKg = payableCart.reduce((sum, item) => {
    const qty = Math.max(1, Number(item.quantity || 1));
    const raw = Number(item.weight || 0);
    const productWeightKg = raw > 5 ? raw / 1000 : raw;
    return sum + ((productWeightKg + PACKAGING_WEIGHT_KG) * qty);
  }, 0);

  const getCouponSavingsText = (coupon) => {
    if (!coupon) return "Coupons & offers";
    const code = String(coupon.code || "").toUpperCase();
    if (coupon.discount_type === "percentage") return `Save ${Number(coupon.discount_percent || 0)}% with ${code}`;
    return `Save ${money(coupon.discount_amount)} with ${code}`;
  };

  const getCouponSubtext = (coupon) => {
    if (!coupon) return "Choose an offer for this order.";
    const minAmount = Number(coupon.min_purchase_amount || 0);
    if (minAmount > subtotal) return `Shop for ${money(minAmount - subtotal)} more to apply`;
    return coupon.description || "Tap to apply this offer at checkout.";
  };

  useEffect(() => {
    let cancelled = false;
    const loadOrderState = async () => {
      if (!user?.id) {
        setAddressLoading(false);
        return;
      }
      try {
        const [ordersRes, addressRes, walletRes, couponRes] = await Promise.all([
          api.get("/api/orders/my"),
          api.get("/api/addresses").catch(() => ({ data: [] })),
          api.get("/api/wallet").catch(() => ({ data: { wallet_balance: 0 } })),
          api.get(API_ENDPOINTS.coupons).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
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
        setAvailableCoupons(Array.isArray(couponRes.data)
          ? couponRes.data.filter((coupon) => coupon.is_active !== false && coupon.user_eligible !== false)
          : []);
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

  // Address step → Payment step: lock in the chosen address and advance. If the
  // shopper edited the inline delivery instructions for the address they're
  // delivering to, persist them (best-effort) before moving on.
  const deliverToAddress = async (address) => {
    const isCurrent = String(selectedAddressId) === String(address.id);
    const trimmed = deliveryInstructions.trim();
    if (isCurrent && trimmed !== String(address.delivery_instructions || "").trim()) {
      try {
        await api.put(`/api/addresses/${address.id}`, { delivery_instructions: trimmed });
        setAddresses((prev) => prev.map((a) => (
          String(a.id) === String(address.id) ? { ...a, delivery_instructions: trimmed } : a
        )));
      } catch {
        // Non-blocking — instructions are a best-effort convenience here.
      }
    }
    selectAddress(address);
    setWizardStep("payment");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Header back button: step back through the wizard, or out to the cart.
  const handleWizardBack = () => {
    if (wizardStep === "confirm") setWizardStep("payment");
    else if (wizardStep === "payment") setWizardStep("address");
    else navigate("/cart");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setAddressForm(getEmptyCheckoutAddress(user));
    setAddrFormErrors({});
  };

  const openAddressModal = (address = null) => {
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

  const saveCheckoutAddress = async () => {
    const form = cleanCheckoutAddress(addressForm);
    const phone = normalizePhone(form.phone);
    const errors = {};
    if (!form.house_building.trim()) errors.house_building = "Address is required.";
    if (!form.city.trim()) errors.city = "City is required.";
    if (!form.state.trim()) errors.state = "State is required.";
    if (!form.pincode || !/^\d{6}$/.test(form.pincode)) errors.pincode = "Enter a valid 6-digit pincode.";
    if (!phone) errors.phone = "Phone is required.";
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
        name: form.name || user?.name || "",
        phone: phone || user?.phone || "",
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

  const applyCheckoutCoupon = (couponOrCode = couponCode) => {
    const coupon = typeof couponOrCode === "object"
      ? couponOrCode
      : availableCoupons.find((item) => String(item.code).toUpperCase() === String(couponOrCode).trim().toUpperCase());
    if (!coupon) {
      showNotification("Coupon not found.", "warning");
      return;
    }
    const rawDiscount = coupon.discount_type === "percentage"
      ? subtotal * (Number(coupon.discount_percent || 0) / 100)
      : Number(coupon.discount_amount || 0);
    const nextDiscount = Math.min(rawDiscount, Number(coupon.max_discount_amount || rawDiscount), subtotal);
    const applied = cartApplyCoupon(coupon);
    if (applied) {
      setCouponCode(coupon.code);
      setCouponPanelOpen(false);
      setCouponModalOpen(false);
      setCouponCelebration({ code: coupon.code, discount: nextDiscount });
    }
  };

  const removeCheckoutCoupon = () => {
    cartRemoveCoupon();
    setCouponCode("");
    setCouponCelebration(null);
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
    if (!couponCelebration) return undefined;
    const timer = setTimeout(() => setCouponCelebration(null), 2400);
    return () => clearTimeout(timer);
  }, [couponCelebration]);

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
          setShippingCharge(selectedCourier?.rate || 0);
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
        coupon_code: appliedCoupon?.code || null,
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
        clearCart();
        navigate(`/order-confirmation?orderId=${dbRes.data.orderId}`);
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

      const razorpay = new window.Razorpay({
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
          method: onlineMethod,
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
            clearCart();
            navigate(`/order-confirmation?orderId=${dbRes.data.orderId}`);
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
      });
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

  return (
    <div className="ckw">
      <div className="ckw-promo">
        <span className="ckw-promo-item"><Icon icon="lucide:truck" /> Free Delivery on All Orders!</span>
        <span className="ckw-promo-sep" />
        <span className="ckw-promo-item"><Icon icon="lucide:gem" /> Grab ₹50 Signup Bonus</span>
        <span className="ckw-promo-sep" />
        <span className="ckw-promo-item"><Icon icon="lucide:rotate-ccw" /> Easy Returns</span>
      </div>

      <div className="ckw-header">
        <button type="button" className="ckw-back" onClick={handleWizardBack} aria-label="Go back">
          <Icon icon="lucide:arrow-left" />
        </button>
        <div className="ckw-logo"><img src={brandLogo} alt="Banarasi Kala" /></div>
        <div className="ckw-secure"><Icon icon="lucide:lock" /><span>Secure<br />Checkout</span></div>
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
            <h2 className="ckw-title">Select a Delivery Address</h2>
            <div className="ckw-otp">
              <Icon icon="lucide:shield-check" />
              <span>One-time password required at time of delivery.</span>
            </div>

            {addressLoading && !addresses.length ? (
              <div className="ckw-addr-card"><div className="ckw-addr-main">Loading your addresses…</div></div>
            ) : addresses.length > 0 ? (
              <>
                <div className="ckw-addr-head">
                  <span className="ckw-addr-head-title">All Addresses ({addresses.length})</span>
                  <button type="button" className="ckw-add-link" onClick={() => openAddressModal()}>
                    <Icon icon="lucide:plus" /> Add New Address
                  </button>
                </div>

                {addresses.map((address) => {
                  const isSel = String(selectedAddressId) === String(address.id);
                  return (
                    <div key={address.id} className={`ckw-addr-card ${isSel ? "is-selected" : ""}`}>
                      <button
                        type="button"
                        className={`ckw-addr-radio ${isSel ? "is-on" : ""}`}
                        onClick={() => selectAddress(address)}
                        aria-label="Select this address"
                      />
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

                        <button type="button" className="ckw-deliver-btn" onClick={() => deliverToAddress(address)}>
                          <Icon icon="lucide:map-pin" /> DELIVER TO THIS ADDRESS
                        </button>
                        <button type="button" className="ckw-edit-btn" onClick={() => openAddressModal(address)}>
                          <Icon icon="lucide:pencil" /> EDIT ADDRESS
                        </button>

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
                <strong className="ckw-empty-title">No delivery address added yet</strong>
                <span className="ckw-empty-sub">Add your delivery address to continue with your order.</span>
                <button type="button" className="ckw-empty-btn" onClick={() => openAddressModal()}>
                  <Icon icon="lucide:plus" /> ADD NEW ADDRESS
                </button>
              </div>
            )}

            <button type="button" className="ckw-back-cart" onClick={() => navigate("/cart")}>
              <Icon icon="lucide:arrow-left" /> Back to cart
            </button>
          </>
        ) : wizardStep === "payment" ? (
          <>
            <button type="button" className="ckw-deliver-summary" onClick={() => setWizardStep("address")}>
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

            <h3 className="ckw-section-label">Select a Payment Method</h3>
            {PREPAID_DISCOUNT_AMOUNT > 0 && (
              <div className="ckw-pay-offer-banner">
                <Icon icon="lucide:badge-percent" />
                <span>Pay online &amp; save <strong>{money(PREPAID_DISCOUNT_AMOUNT)}</strong> on this order</span>
              </div>
            )}

            <div className="ckw-pay-group">
              <button
                type="button"
                className={`ckw-pay-row ${isOnline("upi") ? "is-selected" : ""}`}
                onClick={() => selectOnline("upi")}
              >
                <span className={`ckw-pay-radio ${isOnline("upi") ? "is-on" : ""}`} />
                <span className="ckw-pay-body">
                  <span className="ckw-pay-title">Pay by any UPI App</span>
                  <span className="ckw-pay-sub">Google Pay, PhonePe, Paytm and more</span>
                </span>
                <span className="ckw-pay-badge">UPI</span>
              </button>
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
                <Icon icon="lucide:credit-card" className="ckw-pay-icon" />
              </button>
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
                <Icon icon="lucide:landmark" className="ckw-pay-icon" />
              </button>
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
                <Icon icon="lucide:calculator" className="ckw-pay-icon" />
              </button>
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
                <Icon icon="lucide:wallet" className="ckw-pay-icon" />
              </button>
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
                      ? <span className="ckw-pay-fee">+{money(COD_FEE_AMOUNT)}</span>
                      : <span className="ckw-pay-fee is-muted">Above {money(COD_MAX_AMOUNT)} not allowed</span>}
                  </span>
                  <span className="ckw-pay-sub">
                    {isCodAllowed ? "Pay with cash when your order arrives" : "This order is prepaid only"}
                  </span>
                </span>
                <Icon icon="lucide:banknote" className="ckw-pay-icon" />
              </button>
            </div>

            <div className="ckw-promo-code">
              <button
                type="button"
                className={`ckw-promo-toggle ${promoOpen ? "is-open" : ""}`}
                onClick={() => setPromoOpen((v) => !v)}
              >
                <Icon icon="lucide:tag" />
                <span>{appliedCoupon ? `Coupon ${appliedCoupon.code} applied` : "Add Gift Card or Promo Code"}</span>
                <Icon icon="lucide:chevron-down" className="ckw-promo-chev" />
              </button>
              {promoOpen && (
                <div className="ckw-promo-panel">
                  {appliedCoupon ? (
                    <div className="ckw-promo-applied">
                      <span><Icon icon="lucide:ticket" /> {appliedCoupon.code} — you saved {money(effectiveCouponDiscount)}</span>
                      <button type="button" onClick={removeCheckoutCoupon}>Remove</button>
                    </div>
                  ) : (
                    <>
                      <div className="ckw-promo-entry">
                        <input
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="Enter gift card / promo code"
                        />
                        <button type="button" onClick={() => applyCheckoutCoupon()}>Apply</button>
                      </div>
                      {availableCoupons.length > 0 && (
                        <div className="ckw-promo-list">
                          {availableCoupons.map((c) => (
                            <button key={c.id || c.code} type="button" className="ckw-promo-item-card" onClick={() => applyCheckoutCoupon(c)}>
                              <span className="ckw-promo-code-tag">{c.code}</span>
                              <span className="ckw-promo-code-text">
                                <strong>{getCouponSavingsText(c)}</strong>
                                <small>{getCouponSubtext(c)}</small>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="ckw-continue"
              disabled={shippingLoading || payableCart.length === 0}
              onClick={() => { setWizardStep("confirm"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              {shippingLoading ? "CHECKING DELIVERY…" : "CONTINUE"}
            </button>
          </>
        ) : (
          <div className="checkout-layout">
            <CheckoutOrderPanel
              step={checkoutStep}
          addresses={addresses}
          selectedAddressId={selectedAddressId}
          onSelectAddress={selectAddress}
          addressLoading={addressLoading}
          onAddAddress={() => openAddressModal()}
          onEditAddress={openAddressModal}
          onDeleteAddress={deleteCheckoutAddress}
          deletingAddressId={deletingAddressId}
          getAddressLine={getCheckoutAddressLine}
          user={user}
          paymentOptions={[
            {
              id: "online",
              icon: "lucide:shield-check",
              title: "Online Payment",
              description: `${money(PREPAID_DISCOUNT_AMOUNT)} extra off`,
              active: activePayment === "online",
              onSelect: () => setActivePayment("online"),
            },
            {
              id: "cod",
              icon: "lucide:banknote",
              title: "Cash on Delivery",
              description: isCodAllowed ? `${money(COD_FEE_AMOUNT)} COD charge` : subtotal > COD_MAX_AMOUNT ? `Not available above ${money(COD_MAX_AMOUNT)}` : "Unavailable for some items",
              active: activePayment === "cod",
              disabled: !isCodAllowed,
              onSelect: () => {
                if (isCodAllowed) {
                  setActivePayment("cod");
                } else if (subtotal > COD_MAX_AMOUNT) {
                  showNotification(`COD is available only up to ${money(COD_MAX_AMOUNT)}.`, "warning");
                } else {
                  showNotification("Some products in your cart do not support Cash on Delivery.", "warning");
                }
              },
            },
          ]}
          reviewItems={checkoutCart.map((item) => ({
            key: `${item.id}-${item.colorId}-review`,
            image: item.image_url,
            name: item.name,
            meta: `Qty ${item.quantity} x ${money(item.price)}${getVariantSku(item, item.colorId, item.selectedColorSlug || item.selectedColorName) ? ` - SKU: ${getVariantSku(item, item.colorId, item.selectedColorSlug || item.selectedColorName)}` : ""}`,
            total: item.checkoutUnavailable ? "Excluded" : money(Number(item.price) * Number(item.quantity || 1)),
            unavailable: item.checkoutUnavailable,
            unavailableLabel: item.checkoutStockInfo?.badge || "Unavailable - excluded from total",
          }))}
          reviewAddress={{
            name: formData.fullName,
            line: [formData.address, formData.city, formData.pincode].filter(Boolean).join(", "),
            phone: formData.phone,
          }}
          reviewPayment={{
            title: activePayment === "cod" ? "Cash on Delivery" : "Online Payment",
            description: activePayment === "cod" ? "Pay when your order is delivered." : "Pay securely using Razorpay.",
          }}
          onEditDetails={() => setCheckoutStep("details")}
          summaryProps={{
            title: "Order Summary",
            items: checkoutCart.map((item) => ({
              key: `${item.id}-${item.colorId}`,
              href: `/product/${item.slug}`,
              image: item.image_url,
              name: item.name,
              meta: `${item.quantity} x ${money(item.price)}`,
              total: item.checkoutUnavailable ? "Excluded" : money(Number(item.price) * Number(item.quantity || 1)),
              unavailable: item.checkoutUnavailable,
              unavailableLabel: item.checkoutStockInfo?.badge || "Unavailable - excluded from total",
            })),
            showOffers: true,
            coupons: availableCoupons,
            appliedCoupon,
            couponDiscount: effectiveCouponDiscount,
            couponCode,
            setCouponCode,
            onApplyCoupon: applyCheckoutCoupon,
            onRemoveCoupon: removeCheckoutCoupon,
            walletBalance,
            useWallet,
            setUseWallet,
            rows: [
              { label: "Subtotal", value: money(subtotal) },
              ...(unavailableCart.length > 0 ? [{ label: "Unavailable items", value: `${unavailableCart.length} excluded`, tone: "accent" }] : []),
              { label: "Platform fee", value: money(platformFee) },
              ...(paymentFee > 0 ? [{ label: "COD charge", value: money(paymentFee), tone: "accent" }] : []),
              ...(giftCharge > 0 ? [{ label: "Gift wrap & message", value: money(giftCharge), tone: "accent" }] : []),
              { label: "Delivery", value: shippingLoading ? "Calculating..." : shippingCharge > 0 ? <><s>{money(shippingCharge)}</s>{" "}Free</> : "Free", tone: shippingLoading ? undefined : "success" },
              ...(paymentDiscount > 0 ? [{ label: "Prepaid discount", value: `-${money(paymentDiscount)}`, tone: "success" }] : []),
              ...(appliedCoupon ? [{ label: `Coupon (${appliedCoupon.code})`, value: `-${money(effectiveCouponDiscount)}`, tone: "success" }] : []),
              ...(walletUsableAmount > 0 ? [{ label: "Wallet used", value: `-${money(walletUsableAmount)}`, tone: "success" }] : []),
            ],
            logistics: null,
            deliveryPromise: shippingDeliveryDate ? {
              title: `Arriving ${shippingDeliveryDate}`,
              subtitle: "Free standard delivery",
              tooltip: "This is an estimated delivery date. It may change based on courier availability and your location.",
            } : null,
            totalLabel: "Total Payable",
            total,
            formatMoney: money,
            action: {
              label: loading ? "Processing..." : activePayment === "cod" ? "Place COD Order" : "Pay & Place Order",
              onClick: handlePlaceOrder,
              disabled: loading || shippingLoading || payableCart.length === 0,
            },
            couponModalOpen,
            setCouponModalOpen,
            couponCodeOpen: couponPanelOpen,
            setCouponCodeOpen: setCouponPanelOpen,
            couponCelebration,
          }}
            />
          </div>
        )}
      </div>

      {/* ── Footer (shared across all steps) ── */}
      <div className="ckw-footer">
        <div className="ckw-trust">
          <div className="ckw-trust-item">
            <Icon icon="lucide:shield-check" />
            <span><strong>Secure Payments</strong><br />You Can Trust</span>
          </div>
          <div className="ckw-trust-item">
            <Icon icon="lucide:rotate-ccw" />
            <span><strong>Easy Returns</strong><br />Hassle Free</span>
          </div>
          <div className="ckw-trust-item">
            <Icon icon="lucide:badge-check" />
            <span><strong>100% Authentic</strong><br />Banarasi Sarees</span>
          </div>
        </div>
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
              <span>Required fields are marked with *.</span>
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
                  {addressForm.map_address ? "Change map location" : "Add map location"}
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
                <div className="buy-now-form-row">
                  <label>
                    <span>Label</span>
                    <select name="label" value={addressForm.label} onChange={handleAddressFormChange}>
                      <option>Home</option>
                      <option>Work</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label>
                    <span>Receiver name</span>
                    <input name="name" value={addressForm.name} onChange={handleAddressFormChange} />
                  </label>
                </div>
                <label>
                  <span>Flat, House no., Building *</span>
                  <input name="house_building" value={addressForm.house_building} onChange={handleAddressFormChange} />
                  {addrFormErrors.house_building && <em className="buy-now-field-error">{addrFormErrors.house_building}</em>}
                </label>
                <label>
                  <span>Area, Street, Sector</span>
                  <input name="area_street" value={addressForm.area_street} onChange={handleAddressFormChange} />
                </label>
                <div className="buy-now-form-row">
                  <label>
                    <span>City *</span>
                    <input name="city" value={addressForm.city} onChange={handleAddressFormChange} />
                    {addrFormErrors.city && <em className="buy-now-field-error">{addrFormErrors.city}</em>}
                  </label>
                  <label>
                    <span>State *</span>
                    <input name="state" value={addressForm.state} onChange={handleAddressFormChange} />
                    {addrFormErrors.state && <em className="buy-now-field-error">{addrFormErrors.state}</em>}
                  </label>
                </div>
                <div className="buy-now-form-row">
                  <label>
                    <span>Pincode *</span>
                    <input name="pincode" inputMode="numeric" value={addressForm.pincode} onChange={handleAddressFormChange} />
                    {addrFormErrors.pincode && <em className="buy-now-field-error">{addrFormErrors.pincode}</em>}
                  </label>
                  <label>
                    <span>Phone *</span>
                    <div className="buy-now-phone-input">
                      <span className="buy-now-country-code"><span className="buy-now-flag-india" aria-hidden="true" />+91</span>
                      <input name="phone" inputMode="tel" maxLength={10} placeholder="10-digit mobile number" value={addressForm.phone} onChange={handleAddressFormChange} />
                    </div>
                    {addrFormErrors.phone && <em className="buy-now-field-error">{addrFormErrors.phone}</em>}
                  </label>
                </div>
                <label>
                  <span>Landmark (optional)</span>
                  <input name="landmark" value={addressForm.landmark} onChange={handleAddressFormChange} placeholder="e.g. Near City Mall" />
                </label>
                <label>
                  <span>Delivery instructions (optional)</span>
                  <textarea
                    name="delivery_instructions"
                    rows={2}
                    maxLength={250}
                    value={addressForm.delivery_instructions}
                    onChange={handleAddressFormChange}
                    placeholder="e.g. Leave at the door, call on arrival…"
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
      {couponModalOpen && (
        <div className="checkout-coupon-modal" role="dialog" aria-modal="true" aria-label="Coupons and offers">
          <div className="checkout-coupon-modal-card">
            <button type="button" className="checkout-coupon-modal-close" onClick={() => setCouponModalOpen(false)} aria-label="Close coupons">
              <Icon icon="lucide:x" />
            </button>
            <div className="checkout-coupon-modal-title">
              <Icon icon="lucide:badge-percent" />
              <div>
                <span>Checkout offers</span>
                <h3>Coupons & offers</h3>
              </div>
            </div>
            <button type="button" className="checkout-manual-coupon" onClick={() => setCouponPanelOpen((open) => !open)}>
              Have a coupon code?
              <Icon icon={couponPanelOpen ? "lucide:chevron-up" : "lucide:chevron-down"} />
            </button>
            {couponPanelOpen && (
              <div className="checkout-coupon-panel">
                <div className="checkout-coupon-entry">
                  <input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    placeholder="Coupon code"
                  />
                  <button type="button" onClick={() => applyCheckoutCoupon()}>Apply</button>
                </div>
              </div>
            )}
            {availableCoupons.length > 0 ? (
              <div className="checkout-coupon-list">
                {availableCoupons.map((coupon) => (
                  <button key={coupon.id || coupon.code} type="button" onClick={() => applyCheckoutCoupon(coupon)}>
                    <span className="checkout-coupon-code">{coupon.code}</span>
                    <span className="checkout-coupon-detail">
                      <strong>{getCouponSavingsText(coupon)}</strong>
                      <small>{getCouponSubtext(coupon)}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="checkout-coupon-empty">No coupons are available right now.</p>
            )}
          </div>
        </div>
      )}
      {couponCelebration && (
        <div className="checkout-coupon-boom" role="status" aria-live="polite">
          <span><Icon icon="lucide:sparkles" /></span>
          <div>
            <strong>Yay! Coupon applied</strong>
            <p>{couponCelebration.discount > 0 ? `${money(couponCelebration.discount)} off with ${couponCelebration.code}` : `${couponCelebration.code} is active on this order`}</p>
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
