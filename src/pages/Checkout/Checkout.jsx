import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import CheckoutFlow from "../../components/CheckoutFlow";
import "./Checkout.css";

// Standalone checkout page. All of the order logic/UI lives in <CheckoutFlow>,
// which is shared with the cart's embedded one-page checkout. Here it simply
// runs in standalone mode (reads the cart selection + gift from sessionStorage
// and bounces back to /cart if the cart empties).
const Checkout = () => {
  const navigate = useNavigate();

  return (
    <div className="checkout-page relative min-h-screen flex flex-col bg-[#F5F1E8]">
      <main className="flex-grow py-5 lg:py-8">
        <div className="checkout-page-shell w-full px-4 lg:px-12">
          <div className="checkout-modal-card">
            <div className="checkout-modal-header">
              <div>
                <span>Checkout</span>
                <h2>Complete your order</h2>
              </div>
              <button type="button" onClick={() => navigate("/cart")} aria-label="Close checkout">
                <Icon icon="lucide:x" />
              </button>
            </div>
            <CheckoutFlow redirectOnEmpty />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Checkout;
