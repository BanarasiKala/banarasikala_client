import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import EmptyStateIcon from "./EmptyStateIcon";
import "./ProtectedRoute.css";

const protectedCopy = {
  "/wishlist": {
    title: "Your wishlist is waiting",
    message: "Login to save your favourite Banarasi picks in one place.",
    action: "Login to View Wishlist",
    variant: "wishlist",
  },
  "/cart": {
    title: "Your shopping bag is light",
    message: "Login to add selected weaves and continue checkout.",
    action: "Login to View Bag",
    variant: "cart",
  },
  "/contact": {
    title: "Let's know who to reply to",
    message: "Login first so our team can connect your query with your account.",
    action: "Login to Contact Us",
    variant: "contact",
  },
  "/my-orders": {
    title: "Your orders stay private",
    message: "Login to view your purchases, delivery updates, and invoices.",
    action: "Login to View Orders",
    variant: "orders",
  },
  "/order-confirmation": {
    title: "Your order stays private",
    message: "Login to view this order's details, delivery status, and invoice.",
    action: "Login to View Order",
    variant: "orders",
  },
  "/order-placed": {
    title: "Your order stays private",
    message: "Login to view this order's details, delivery status, and invoice.",
    action: "Login to View Order",
    variant: "orders",
  },
  "/feedback": {
    title: "Share your Banarasi experience",
    message: "Login to leave feedback for the sarees you have explored.",
    action: "Login to Continue",
    variant: "feedback",
  },
};

const getPromptCopy = (pathname) =>
  protectedCopy[pathname] || {
    title: "Login to continue",
    message: "Your account keeps your saree journey safe and personal.",
    action: "Login to Continue",
    variant: "default",
  };

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bk-textured-page">
        <p className="text-[#800020] font-bold uppercase tracking-widest">
          Loading...
        </p>
      </div>
    );
  }

  if (!user) {
    const copy = getPromptCopy(location.pathname);

    return (
      <main className="auth-required-page">
        <section
          className={`auth-required-card auth-required-${copy.variant || "shopping"}`}
          aria-labelledby="auth-required-title"
        >
          <EmptyStateIcon variant={copy.variant} />
          <h1 id="auth-required-title">{copy.title}</h1>
          <p>{copy.message}</p>
          <Link
            to={`/login?refresh=${encodeURIComponent(location.pathname)}`}
            state={{ from: location }}
            className="auth-required-action"
          >
            {copy.action}
          </Link>
        </section>
      </main>
    );
  }

  return children;
};

export default ProtectedRoute;
