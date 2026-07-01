import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Layout from "./layout/Layout";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { WishlistProvider } from "./context/WishlistContext";
import { NOTIFICATION_TOASTER_OPTIONS, NotificationProvider } from "./context/NotificationContext";
import { LocationProvider } from "./context/LocationContext";
import PreLoader from "./components/PreLoader/PreLoader";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import headerBackground from "./assets/header_backgroung.png";
import "./App.css";

const Home = lazy(() => import("./pages/Home/Home"));
const Reels = lazy(() => import("./pages/Reels/Reels"));
const Collection = lazy(() => import("./pages/Collection/Collection"));
const ProductDetail = lazy(() => import("./pages/ProductDetail/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart/Cart"));
const Checkout = lazy(() => import("./pages/Checkout/Checkout"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation/OrderConfirmation"));
const Auth = lazy(() => import("./pages/Auth/Auth"));
const About = lazy(() => import("./pages/About/About"));
const Testimonials = lazy(() => import("./pages/Testimonials/Testimonials"));
const Wishlist = lazy(() => import("./pages/Wishlist/Wishlist"));
const MyOrders = lazy(() => import("./pages/MyOrders/MyOrders"));
const Contact = lazy(() => import("./pages/Contact/Contact"));
const Feedback = lazy(() => import("./pages/Feedback/Feedback"));
const Profile = lazy(() => import("./pages/Profile/Profile"));
const NotFound = lazy(() => import("./pages/NotFound/NotFound"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail/VerifyEmail"));
const ResetPassword = lazy(() => import("./pages/ResetPassword/ResetPassword"));
const ShippingPolicy = lazy(() => import("./pages/Policy/ShippingPolicy"));
const ReturnExchange = lazy(() => import("./pages/Policy/ReturnExchange"));
const RefundPolicy = lazy(() => import("./pages/Policy/RefundPolicy"));
const TermsConditions = lazy(() => import("./pages/Policy/TermsConditions"));
const PrivacyPolicy = lazy(() => import("./pages/Policy/PrivacyPolicy"));



function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <LocationProvider>
        <WishlistProvider>
          <CartProvider>
            <Router>
              <ScrollToTop />
              <div
                className="App"
                style={{
                  "--bk-section-bg": `url(${headerBackground})`,
                  "--bk-header-bg": `url(${headerBackground})`,
                }}
              >
                <ErrorBoundary>
                <Suspense fallback={<PreLoader />}>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route path="/" element={<Home />} />
                      <Route path="/reels" element={<Reels />} />
                      <Route path="/collection" element={<Collection />} />
                      <Route path="/product/:slug" element={<ProductDetail />} />
                      <Route
                        path="/cart"
                        element={
                          <ProtectedRoute>
                            <Cart />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/checkout"
                        element={
                          <ProtectedRoute>
                            <Checkout />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/wishlist"
                        element={
                          <ProtectedRoute>
                            <Wishlist />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/my-orders"
                        element={
                          <ProtectedRoute>
                            <MyOrders />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/profile"
                        element={
                          <ProtectedRoute>
                            <Profile />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/order-confirmation"
                        element={
                          <ProtectedRoute>
                            <OrderConfirmation />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/about" element={<About />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/feedback" element={<Feedback />} />
                      <Route path="/testimonials" element={<Testimonials />} />
                      <Route path="/shipping-policy" element={<ShippingPolicy />} />
                      <Route path="/return-exchange" element={<ReturnExchange />} />
                      <Route path="/refund-policy" element={<RefundPolicy />} />
                      <Route path="/terms-conditions" element={<TermsConditions />} />
                      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    </Route>
                    <Route path="/login" element={<Auth />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                </ErrorBoundary>
              </div>
              <Toaster {...NOTIFICATION_TOASTER_OPTIONS} />
            </Router>
          </CartProvider>
        </WishlistProvider>
        </LocationProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
