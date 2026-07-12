import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../utils/api";
import { imgUrl } from "../../utils/cloudinary";
import { getOrderDisplayNumber } from "../../utils/itemCode";
import sareeDrape from "../../assets/orderconfirmationbg.jpeg";
import "./ThankYou.css";

const toNumber = (value) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const formatPrice = (value) => `Rs. ${toNumber(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const getItemImage = (item) => item.image_url || item.product_image_url || "";

/**
 * Post-purchase splash shown right after an order is placed
 * (/order-placed?orderId=…). "View your order" leads to the full
 * order-confirmation page with the shipment timeline.
 */
export default function ThankYou() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("orderId");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadOrder = async () => {
      if (!orderId) {
        navigate("/my-orders", { replace: true });
        return;
      }
      try {
        const response = await api.get(`/api/orders/${orderId}`);
        if (!cancelled) setOrder(response.data);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || "Unable to load your order right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [orderId, navigate]);

  if (loading) {
    return (
      <main className="thank-you-page">
        <div className="ty-loading">
          <span className="ty-spinner" />
          <p>Preparing your order details…</p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="thank-you-page">
        <div className="ty-loading">
          <Icon icon="lucide:alert-circle" className="ty-error-icon" />
          <p>{error || "Order details are unavailable."}</p>
          <Link className="ty-btn ty-btn-primary" to="/my-orders">Go to My Orders</Link>
        </div>
      </main>
    );
  }

  const items = order.OrderItems || [];
  const itemSubtotal = items.reduce((sum, item) => sum + toNumber(item.price) * Math.max(1, toNumber(item.quantity) || 1), 0);
  const subtotal = toNumber(order.subtotal_amount) || itemSubtotal;
  const couponDiscount = toNumber(order.discount_amount);
  const paymentDiscount = toNumber(order.payment_discount);
  const walletAmount = toNumber(order.wallet_amount);
  const fees = toNumber(order.payment_fee);
  const shippingCharge = toNumber(order.shipping_charge);
  const shippingDiscount = toNumber(order.shipping_discount);
  const netShipping = Math.max(0, shippingCharge - shippingDiscount);
  // COD charge is billed separately (folded into "Fees"), so the delivery charge is
  // shown net of it; the full charge stays persisted on the order.
  const isCod = String(order.payment_method || "").toUpperCase() === "COD";
  const codFee = toNumber(order.cod_fee) || (isCod ? Math.max(0, fees - toNumber(order.platform_fee)) : 0);
  const shippingChargeShown = Math.max(0, shippingCharge - codFee);
  const total = toNumber(order.payable_amount) || toNumber(order.total_amount)
    || Math.max(0, subtotal + netShipping + fees - couponDiscount - paymentDiscount - walletAmount);
  const totalSaved = couponDiscount + paymentDiscount + shippingDiscount;

  return (
    <main className="thank-you-page">
      <div className="ty-card">
        <div className="ty-hero">
          <div className="ty-drape-box" aria-hidden="true">
            <img className="ty-drape" src={sareeDrape} alt="" />
          </div>
          <h1 className="ty-script">Thank you</h1>
          <p className="ty-sub">for your purchase!</p>
          <p className="ty-copy">
            We&rsquo;re getting your order ready to be shipped.
            <br />
            We will notify you once it has been dispatched.
          </p>

          <div className="ty-actions">
            <Link className="ty-btn ty-btn-primary" to={`/order-confirmation?orderId=${order.id}`}>
              View your order
            </Link>
            <Link className="ty-btn ty-btn-ghost" to="/collection">
              Visit our store
            </Link>
          </div>
        </div>

        <div className="ty-meta">
          <div className="ty-meta-cell">
            <span className="ty-meta-icon"><Icon icon="lucide:clipboard-check" /></span>
            <span>
              <small>Order Number</small>
              <strong>#{getOrderDisplayNumber(order)}</strong>
            </span>
          </div>
          <div className="ty-meta-cell">
            <span className="ty-meta-icon"><Icon icon="lucide:calendar-days" /></span>
            <span>
              <small>Order Date</small>
              <strong>{formatDate(order.createdAt || order.created_at)}</strong>
            </span>
          </div>
        </div>

        <h2 className="ty-section-title">Order Summary</h2>
        <div className="ty-summary">
          {items.map((item, index) => (
            <div className="ty-item" key={item.id || `${item.product_id}-${index}`}>
              <div className="ty-item-media">
                {getItemImage(item)
                  ? <img src={imgUrl(getItemImage(item), 200)} alt={item.product_name} />
                  : <Icon icon="lucide:image-off" />}
              </div>
              <div className="ty-item-copy">
                <strong>{item.product_name}</strong>
                <small>Qty: {item.quantity}</small>
                {(item.color_name || item.Color?.name) && (
                  <span className="ty-item-color">
                    <i style={item.Color?.hex_code ? { background: item.Color.hex_code } : {}} />
                    {item.color_name || item.Color?.name}
                  </span>
                )}
              </div>
              <strong className="ty-item-price">{formatPrice(toNumber(item.price) * Math.max(1, toNumber(item.quantity) || 1))}</strong>
            </div>
          ))}

          <div className="ty-rows">
            <div className="ty-row">
              <span>Subtotal</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>
            {couponDiscount > 0 && (
              <div className="ty-row ty-row-discount">
                <span>
                  Order Discount
                  {order.coupon_code && <em>{order.coupon_code} ( -{formatPrice(couponDiscount)} )</em>}
                </span>
                <strong>- {formatPrice(couponDiscount)}</strong>
              </div>
            )}
            {paymentDiscount > 0 && (
              <div className="ty-row ty-row-discount">
                <span>Online Payment Discount</span>
                <strong>- {formatPrice(paymentDiscount)}</strong>
              </div>
            )}
            {walletAmount > 0 && (
              <div className="ty-row ty-row-discount">
                <span>Wallet Used</span>
                <strong>- {formatPrice(walletAmount)}</strong>
              </div>
            )}
            {fees > 0 && (
              <div className="ty-row">
                <span>Fees</span>
                <strong>{formatPrice(fees)}</strong>
              </div>
            )}
            <div className="ty-row">
              <span>Shipping</span>
              <strong>
                {netShipping > 0
                  ? formatPrice(netShipping)
                  : shippingChargeShown > 0
                    ? <><s>{formatPrice(shippingChargeShown)}</s> Free</>
                    : formatPrice(0)}
              </strong>
            </div>
            <div className="ty-row">
              <span>Taxes</span>
              <strong>Included</strong>
            </div>
          </div>

          <div className="ty-total">
            <span>Total</span>
            <span className="ty-total-right">
              <strong>{formatPrice(total)}</strong>
              {totalSaved > 0 && <small>You saved {formatPrice(totalSaved)}</small>}
            </span>
          </div>
        </div>

        <h2 className="ty-section-title">Customer Information</h2>
        <div className="ty-address">
          <strong className="ty-address-head">Shipping Address</strong>
          <p>
            <strong>{order.customer_name}</strong>
            <br />
            {order.address}
            <br />
            {order.pincode} {order.city}{order.state ? ` ${order.state}` : ""}
            <br />
            India
          </p>
        </div>

        <div className="ty-badges">
          <div>
            <Icon icon="lucide:shopping-bag" />
            <span>100% Authentic<br />Banarasi Sarees</span>
          </div>
          <div>
            <Icon icon="lucide:heart-handshake" />
            <span>Handpicked<br />Premium Quality</span>
          </div>
          <div>
            <Icon icon="lucide:lock" />
            <span>Secure<br />Payments</span>
          </div>
        </div>

        <p className="ty-footer">
          We truly appreciate your trust in Banarasi Kala.
          <em>— Weaving Tradition, Delivering Elegance —</em>
        </p>
      </div>
    </main>
  );
}
