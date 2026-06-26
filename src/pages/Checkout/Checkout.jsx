import CheckoutFlow from "../../components/CheckoutFlow";
import "./Checkout.css";

// Standalone checkout page. The full 3-step wizard (address → payment → confirm)
// lives in <CheckoutFlow>, which also owns its own header/footer chrome. Here we
// just provide the page background + the centred mobile column.
const Checkout = () => (
  <div className="checkout-page relative min-h-screen flex flex-col bg-[#F5F1E8]">
    <main className="flex-grow">
      <div className="checkout-page-shell w-full">
        <CheckoutFlow redirectOnEmpty />
      </div>
    </main>
  </div>
);

export default Checkout;
