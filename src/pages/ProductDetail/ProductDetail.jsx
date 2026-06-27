import { Icon } from "@iconify/react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { imgUrl } from "../../utils/cloudinary";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useNotification } from "../../context/NotificationContext";
import { useWishlist } from "../../context/WishlistContext";
import { API_ENDPOINTS } from "../../config/api";
import api from "../../utils/api";
import { getProductCoverImage, getProductImages } from "../../utils/productMedia";
import { getProductStockInfo } from "../../utils/stockStatus";
import { LocationPickerModal } from "../Profile/Profile";
import CheckoutReviewSummary from "../../components/CheckoutReviewSummary";
import CheckoutOrderPanel from "../../components/CheckoutOrderPanel";
import CheckoutFlow from "../../components/CheckoutFlow";
import "../Checkout/Checkout.css";
import ProductRating from "../../components/ProductRating";
import DeliveryBadge from "../../components/DeliveryBadge";
import { formatEstimatedDeliveryDate, getEstimatedDeliveryDate } from "../../utils/deliveryDate";
import { useDeliveryLocation } from "../../context/LocationContext";
import { getVariantSku } from "../../utils/itemCode";
import { selectBestCourier } from "../../utils/courierSelection";
import { numberEnv, requiredEnv } from "../../utils/env";
import { buildRazorpayPrefill } from "../../utils/razorpay";
import { Plyr } from "plyr-react";
import "plyr/dist/plyr.css";
import "./ProductDetail.css";

const PACKAGING_WEIGHT_KG = numberEnv("VITE_PACKAGING_WEIGHT_KG");
const COD_MAX_AMOUNT = numberEnv("VITE_COD_MAX_AMOUNT");
const PREPAID_DISCOUNT_AMOUNT = numberEnv("VITE_PREPAID_DISCOUNT_AMOUNT");
const COD_FEE_AMOUNT = numberEnv("VITE_COD_FEE_AMOUNT");
const PLATFORM_FEE_AMOUNT = numberEnv("VITE_PLATFORM_FEE_AMOUNT");
const EMPTY_BUY_NOW_ADDRESS = {
  label: "Home",
  name: "",
  phone: "",
  alternate_phone: "",
  country: "India",
  house_building: "",
  area_street: "",
  city: "",
  state: "",
  pincode: "",
  landmark: "",
  delivery_instructions: "",
  map_address: "",
  map_lat: "",
  map_lng: "",
  is_default: true,
};

const getEmptyBuyNowAddress = (user) => ({
  ...EMPTY_BUY_NOW_ADDRESS,
  name: user?.name || "",
  phone: user?.phone || "",
});

const ReviewRatingBadge = ({ summary, onClick }) => {
  const average = Number(summary?.average || 0);
  const count = Number(summary?.count || 0);
  if (!count) return null;
  return (
    <button type="button" className="product-rating-row" onClick={onClick} aria-label={`${average.toFixed(1)} rating from ${count} reviews`}>
      <span className="product-rating-main">
        <strong>{average.toFixed(1)}</strong>
        <span className="product-rating-stars">
          {[1, 2, 3, 4, 5].map((star) => (
            <Icon key={star} icon={average >= star ? "mdi:star" : average >= star - 0.5 ? "mdi:star-half-full" : "mdi:star-outline"} />
          ))}
        </span>
      </span>
      <small>{count} {count === 1 ? "review" : "reviews"}</small>
    </button>
  );
};

const cleanAddress = (address = {}) => ({
  ...EMPTY_BUY_NOW_ADDRESS,
  ...address,
  phone: String(address.phone || "").replace(/[^\d+]/g, ""),
  pincode: String(address.pincode || "").replace(/\D/g, "").slice(0, 6),
});

const getAddressLine = (address = {}) =>
  [address.house_building, address.area_street, address.landmark, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(", ");

const getSortedImages = (targetProduct) => {
  const unique = Array.from(
    new Map(
      getProductImages(targetProduct || {})
        .map((image) => (typeof image === "string" ? { url: image } : image))
        .filter((image) => image?.url)
        .map((image) => [image.url, image]),
    ).values(),
  );
  return unique.sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
};

const getOrderCutoff = () => {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(23, 59, 0, 0);
  const diffMs = cutoff - now;
  if (diffMs <= 0) return null;
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return { hours, mins };
};

const PLYR_OPTIONS = {
  controls: ["play", "progress", "current-time", "duration", "mute", "volume", "fullscreen", "settings"],
  settings: ["speed"],
  speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
  muted: true,
  resetOnEnd: true,
  // We handle click-to-toggle ourselves (see resolveSwipe) so it works
  // reliably through the carousel's swipe/drag layer.
  clickToPlay: false,
  keyboard: { focused: false, global: false },
  tooltips: { controls: false, seek: true },
  // iosNative: true → iOS uses the real native video fullscreen. The CSS
  // fallback fullscreen (iosNative:false) renders against the carousel's
  // transform ancestor and shows a black screen on mobile.
  fullscreen: { enabled: true, fallback: true, iosNative: true },
};

const SHIPPING_RETURN_HIGHLIGHTS = [
  { icon: "lucide:truck", title: "Free Delivery", text: "on all orders" },
  { icon: "lucide:rotate-ccw", title: "Easy 7 Days Return" },
  { icon: "lucide:refresh-cw", title: "Exchange", text: "available on all products" },
  { icon: "lucide:package-check", title: "Secure Packaging" },
];

const ImageSlide = memo(({ url, alt }) => {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    // Cached images fire onLoad before React attaches the handler; catch them here
    if (imgRef.current?.complete) setLoaded(true);
  }, [url]);

  return (
    <div className="product-main-image-slot">
      {!loaded && <div className="bk-carousel-loader bk-carousel-loader--image" aria-hidden="true" />}
      <img
        ref={imgRef}
        src={url}
        alt={alt}
        className="product-main-image"
        draggable={false}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
});
ImageSlide.displayName = "ImageSlide";

const VideoSlide = memo(({ src, isActive, activePlayerRef }) => {
  const plyrRef = useRef(null);
  const containerRef = useRef(null);
  const isActiveRef = useRef(isActive);
  const [isBuffering, setIsBuffering] = useState(true);

  useEffect(() => {
    isActiveRef.current = isActive;
    const player = plyrRef.current?.plyr;
    // typeof check: the proxy returns h (a function) for .ready; real Plyr returns boolean
    if (!player || typeof player.ready !== "boolean") return;
    if (isActive) {
      if (activePlayerRef) activePlayerRef.current = player;
      player.play().catch(() => {});
    } else {
      if (activePlayerRef && activePlayerRef.current === player) activePlayerRef.current = null;
      try { player.pause(); player.currentTime = 0; } catch {}
    }
  }, [isActive, activePlayerRef]);

  // Pause when the carousel scrolls off-screen so the browser doesn't activate PiP.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) {
        const player = plyrRef.current?.plyr;
        if (player?.playing) { try { player.pause(); } catch {} }
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // e.currentTarget.plyr is set by Plyr's constructor on the DOM element itself —
  // available as soon as Plyr inits, before react-aptor's setState re-render updates the ref.
  const handleCanPlay = useCallback((e) => {
    setIsBuffering(false);
    if (!isActiveRef.current) return;
    const player = e.currentTarget.plyr ?? plyrRef.current?.plyr;
    if (player) {
      if (activePlayerRef) activePlayerRef.current = player;
      player.play().catch(() => {});
    }
  }, [activePlayerRef]);

  return (
    <div className="product-main-video-slot" ref={containerRef}>
      {isBuffering && <div className="bk-carousel-loader bk-carousel-loader--video" aria-hidden="true" />}
      <Plyr
        ref={plyrRef}
        source={{ type: "video", sources: [{ src, type: "video/mp4" }] }}
        options={PLYR_OPTIONS}
        onCanPlay={handleCanPlay}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        playsInline
      />
    </div>
  );
});
VideoSlide.displayName = "VideoSlide";

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showNotification } = useNotification();
  const { pincode: locationPincode, locationSource, locationLoading: locationDetecting, setPincode: saveLocationPin } = useDeliveryLocation();

  const [product, setProduct] = useState(null);
  const [allColors, setAllColors] = useState([]);
  const [products, setProducts] = useState([]);
  const [productReviews, setProductReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({ average: 0, count: 0 });
  const [reviewGalleryIndex, setReviewGalleryIndex] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [productError, setProductError] = useState(null);
  const [mainImage, setMainImage] = useState("");
  const [selectedColorId, setSelectedColorId] = useState(null);
  const [colorImagesById, setColorImagesById] = useState({});
  const [loadingColorId, setLoadingColorId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeAccordion, setActiveAccordion] = useState("description");
  const [isGalleryHovering, setIsGalleryHovering] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const swipeRef = useRef({ startX: 0, startY: 0, didSwipe: false, dragging: false });
  const touchActiveRef = useRef(false);
  // Points to the currently-active carousel video's Plyr instance, so a tap
  // on the video can toggle play/pause (set by VideoSlide when it is active).
  const activeVideoPlayerRef = useRef(null);
  // Distinguishes a single tap (play/pause) from a double tap (fullscreen) on video.
  const videoTapRef = useRef(null);

  const resolveSwipe = (dx, dy, didSwipe) => {
    if (carouselZoomPanRef.current.zoom > 1) return;
    const absDx = Math.abs(dx);
    if (absDx > 50 && absDx > Math.abs(dy)) {
      if (dx < 0 && activeImageIndex < visibleMedia.length - 1) {
        const n = activeImageIndex + 1;
        setActiveImageIndex(n);
        if (visibleMedia[n]?.type === "image") setMainImage(visibleMedia[n].url);
      } else if (dx > 0 && activeImageIndex > 0) {
        const n = activeImageIndex - 1;
        setActiveImageIndex(n);
        if (visibleMedia[n]?.type === "image") setMainImage(visibleMedia[n].url);
      }
    } else if (!didSwipe) {
      // Ignore taps that landed on the Plyr control bar — let Plyr handle them.
      if (swipeRef.current.onControls) return;
      if (visibleMedia[activeImageIndex]?.type === "video") {
        const player = activeVideoPlayerRef.current;
        // Single click toggles play/pause immediately (no delay).
        if (player) {
          if (player.playing) { try { player.pause(); } catch {} }
          else player.play().catch(() => {});
        }
        // A second click within the window → double click → fullscreen.
        // (The two toggles cancel out, so play state is unchanged.)
        if (videoTapRef.current) {
          clearTimeout(videoTapRef.current);
          videoTapRef.current = null;
          if (player?.fullscreen) {
            try { player.fullscreen.enter(); } catch { /* ignore */ }
          } else {
            // Fallback: fullscreen the raw <video> element directly.
            const v = player?.media;
            if (v?.requestFullscreen) v.requestFullscreen().catch(() => {});
            else if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iOS
          }
        } else {
          videoTapRef.current = setTimeout(() => { videoTapRef.current = null; }, 400);
        }
      } else {
        openFullscreen(activeImageIndex);
      }
    }
  };

  // ── Mouse (desktop only — blocked on touch devices) ──
  const handleFrameMouseDown = (e) => {
    if (touchActiveRef.current) return;
    const onControls = !!e.target.closest?.(".plyr__controls");
    swipeRef.current = { startX: e.clientX, startY: e.clientY, didSwipe: false, dragging: true, onControls };
    if (carouselZoomPanRef.current.zoom > 1) {
      carouselDragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, panX: carouselZoomPanRef.current.pan.x, panY: carouselZoomPanRef.current.pan.y };
    }
  };
  const handleFrameMouseMove = (e) => {
    if (touchActiveRef.current) return;
    if (carouselDragRef.current.dragging) {
      const { zoom } = carouselZoomPanRef.current;
      const el = frameRef.current;
      const raw = { x: carouselDragRef.current.panX + e.clientX - carouselDragRef.current.startX, y: carouselDragRef.current.panY + e.clientY - carouselDragRef.current.startY };
      const maxX = el ? el.clientWidth * (zoom - 1) / 2 : 9999;
      const maxY = el ? el.clientHeight * (zoom - 1) / 2 : 9999;
      const newPan = { x: Math.max(-maxX, Math.min(maxX, raw.x)), y: Math.max(-maxY, Math.min(maxY, raw.y)) };
      carouselZoomPanRef.current = { zoom, pan: newPan };
      applyCarouselTransform();
      return;
    }
    if (!swipeRef.current.dragging) return;
    if (Math.abs(e.clientX - swipeRef.current.startX) > 8) swipeRef.current.didSwipe = true;
  };
  const handleFrameMouseUp = (e) => {
    if (touchActiveRef.current) return;
    carouselDragRef.current.dragging = false;
    if (!swipeRef.current.dragging) return;
    swipeRef.current.dragging = false;
    resolveSwipe(
      e.clientX - swipeRef.current.startX,
      e.clientY - swipeRef.current.startY,
      swipeRef.current.didSwipe,
    );
  };

  // ── Touch (mobile) ──
  const handleFrameTouchStart = (e) => {
    touchActiveRef.current = true;
    if (e.touches.length === 2) {
      const t0 = e.touches[0]; const t1 = e.touches[1];
      carouselPinchRef.current = {
        active: true,
        startDist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        startZoom: carouselZoomPanRef.current.zoom,
        startPan: { ...carouselZoomPanRef.current.pan },
        midX: (t0.clientX + t1.clientX) / 2,
        midY: (t0.clientY + t1.clientY) / 2,
      };
      swipeRef.current.dragging = false;
      carouselDragRef.current.dragging = false;
      return;
    }
    const t = e.touches[0];
    const onControls = !!e.target.closest?.(".plyr__controls");
    swipeRef.current = { startX: t.clientX, startY: t.clientY, didSwipe: false, dragging: true, onControls };
    if (carouselZoomPanRef.current.zoom > 1) {
      carouselDragRef.current = { dragging: true, startX: t.clientX, startY: t.clientY, panX: carouselZoomPanRef.current.pan.x, panY: carouselZoomPanRef.current.pan.y };
    }
  };
  const handleFrameTouchMove = (e) => {
    if (e.touches.length === 2 && carouselPinchRef.current.active) {
      e.preventDefault();
      const t0 = e.touches[0]; const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const newZoom = Math.max(1, Math.min(5, carouselPinchRef.current.startZoom * (dist / carouselPinchRef.current.startDist)));
      const el = frameRef.current;
      const wasZoomed = carouselZoomPanRef.current.zoom > 1;
      if (newZoom <= 1) {
        carouselZoomPanRef.current = { zoom: 1, pan: { x: 0, y: 0 } };
        if (carouselWrapperRef.current) carouselWrapperRef.current.style.transform = "";
        if (wasZoomed) setCarouselIsZoomed(false);
        return;
      }
      if (el) {
        const rect = el.getBoundingClientRect();
        const zf = newZoom / carouselPinchRef.current.startZoom;
        const ex = carouselPinchRef.current.midX - (rect.left + rect.width / 2);
        const ey = carouselPinchRef.current.midY - (rect.top + rect.height / 2);
        const maxX = el.clientWidth * (newZoom - 1) / 2;
        const maxY = el.clientHeight * (newZoom - 1) / 2;
        const newPan = {
          x: Math.max(-maxX, Math.min(maxX, ex * (1 - zf) + carouselPinchRef.current.startPan.x * zf)),
          y: Math.max(-maxY, Math.min(maxY, ey * (1 - zf) + carouselPinchRef.current.startPan.y * zf)),
        };
        carouselZoomPanRef.current = { zoom: newZoom, pan: newPan };
        applyCarouselTransform();
        if (!wasZoomed) setCarouselIsZoomed(true);
      }
      return;
    }
    if (carouselZoomPanRef.current.zoom > 1 && carouselDragRef.current.dragging) {
      e.preventDefault();
      const t = e.touches[0];
      const { zoom } = carouselZoomPanRef.current;
      const el = frameRef.current;
      const raw = { x: carouselDragRef.current.panX + t.clientX - carouselDragRef.current.startX, y: carouselDragRef.current.panY + t.clientY - carouselDragRef.current.startY };
      const maxX = el ? el.clientWidth * (zoom - 1) / 2 : 9999;
      const maxY = el ? el.clientHeight * (zoom - 1) / 2 : 9999;
      const newPan = { x: Math.max(-maxX, Math.min(maxX, raw.x)), y: Math.max(-maxY, Math.min(maxY, raw.y)) };
      carouselZoomPanRef.current = { zoom, pan: newPan };
      applyCarouselTransform();
      return;
    }
    if (!swipeRef.current.dragging) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - swipeRef.current.startX) > 8) swipeRef.current.didSwipe = true;
  };
  const handleFrameTouchEnd = (e) => {
    carouselPinchRef.current.active = false;
    carouselDragRef.current.dragging = false;
    if (!swipeRef.current.dragging) return;
    swipeRef.current.dragging = false;
    if (carouselZoomPanRef.current.zoom > 1) {
      if (visibleMedia[activeImageIndex]?.type !== "video") e.preventDefault();
      setTimeout(() => { touchActiveRef.current = false; }, 600);
      return;
    }
    const t = e.changedTouches[0];
    resolveSwipe(
      t.clientX - swipeRef.current.startX,
      t.clientY - swipeRef.current.startY,
      swipeRef.current.didSwipe,
    );
    // On image slides, prevent the browser from firing synthetic click/mousedown after touch
    if (visibleMedia[activeImageIndex]?.type !== "video") e.preventDefault();
    setTimeout(() => { touchActiveRef.current = false; }, 600);
  };

  // ── Fullscreen overlay (images: zoom/pan; videos: auto-play in fullscreen) ──
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenIdx, setFullscreenIdx] = useState(0);
  const [fsImageLoaded, setFsImageLoaded] = useState(false);
  const [fsIsZoomed, setFsIsZoomed] = useState(false);
  // Holds the fullscreen video's Plyr instance (same player as the carousel).
  const fsPlayerRef = useRef(null);
  const fsImageRef = useRef(null);
  const fsMainRef = useRef(null);
  const fsZoomPanRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const fsDragRef = useRef({ dragging: false, startX: 0, startY: 0, panX: 0, panY: 0 });
  const fsPinchRef = useRef({ active: false, startDist: 0, startZoom: 1, startPan: { x: 0, y: 0 }, midX: 0, midY: 0 });
  const fsIsVideoRef = useRef(false);

  // ── Carousel inline zoom ──
  const [carouselIsZoomed, setCarouselIsZoomed] = useState(false);
  const carouselZoomPanRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const carouselWrapperRef = useRef(null);
  const carouselDragRef = useRef({ dragging: false, startX: 0, startY: 0, panX: 0, panY: 0 });
  const carouselPinchRef = useRef({ active: false });
  const carouselWheelHandlerRef = useRef(null);

  // Apply zoom/pan directly to DOM — bypasses React re-renders so zooming is always silky.
  const applyFsTransform = () => {
    if (!fsImageRef.current) return;
    const { zoom, pan } = fsZoomPanRef.current;
    fsImageRef.current.style.transform = zoom <= 1 ? "" : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  };
  const applyCarouselTransform = () => {
    if (!carouselWrapperRef.current) return;
    const { zoom, pan } = carouselZoomPanRef.current;
    carouselWrapperRef.current.style.transform = zoom <= 1 ? "" : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  };

  const openFullscreen = useCallback((idx) => { setFullscreenIdx(idx); setFullscreenOpen(true); }, []);
  const closeFullscreen = () => {
    if (fsPlayerRef.current) { try { fsPlayerRef.current.pause(); } catch {} }
    setFullscreenOpen(false);
  };

  useEffect(() => {
    if (!fullscreenOpen) return undefined;
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.classList.add("bk-fullscreen-open");
    const onKey = (e) => {
      if (e.key === "Escape") { closeFullscreen(); return; }
      if (e.key === "ArrowLeft") fsHandlersRef.current.prev?.();
      if (e.key === "ArrowRight") fsHandlersRef.current.next?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overscrollBehavior = "";
      document.documentElement.style.overscrollBehavior = "";
      document.body.classList.remove("bk-fullscreen-open");
      window.scrollTo(0, scrollY);
    };
  }, [fullscreenOpen]);

  // Reset loader + zoom when fullscreen opens or the shown image changes.
  useEffect(() => {
    if (!fullscreenOpen) return;
    fsZoomPanRef.current = { zoom: 1, pan: { x: 0, y: 0 } };
    setFsIsZoomed(false);
    if (fsImageRef.current) fsImageRef.current.style.transform = "";
    fsDragRef.current.dragging = false;
    fsPinchRef.current.active = false;
    if (fsImageRef.current?.complete) setFsImageLoaded(true);
    else setFsImageLoaded(false);
  }, [fullscreenOpen, fullscreenIdx]);

  const [relatedHoverId, setRelatedHoverId] = useState(null);
  const [relatedActiveSlides, setRelatedActiveSlides] = useState({});
  const relatedGridRef = useRef(null);

  useEffect(() => {
    if (loading || products.length === 0 || !relatedGridRef.current) return undefined;
    const cards = relatedGridRef.current.querySelectorAll(".product-related-card");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: "0px 0px 200px 0px" }
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [loading, products]);
  const [deliveryPincode, setDeliveryPincode] = useState("");
  const [deliveryCheckLoading, setDeliveryCheckLoading] = useState(false);
  const [deliveryQuote, setDeliveryQuote] = useState(null);
  const [showPincodeInput, setShowPincodeInput] = useState(false);
  const [orderCountdown, setOrderCountdown] = useState(() => getOrderCutoff());
  const autoCheckedRef = useRef("");
  const [addingToBag, setAddingToBag] = useState(false);
  const [buyNowOpen, setBuyNowOpen] = useState(false);
  const [buyNowStep, setBuyNowStep] = useState("details");
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const [buyNowPlacing, setBuyNowPlacing] = useState(false);
  const [buyNowProcessing, setBuyNowProcessing] = useState(false);
  const [buyNowDeletingAddressId, setBuyNowDeletingAddressId] = useState(null);
  const [buyNowAddrFormErrors, setBuyNowAddrFormErrors] = useState({});
  const [buyNowPayment, setBuyNowPayment] = useState("prepaid");
  const [buyNowAddresses, setBuyNowAddresses] = useState([]);
  const [selectedBuyNowAddressId, setSelectedBuyNowAddressId] = useState("");
  const [buyNowAddressForm, setBuyNowAddressForm] = useState(getEmptyBuyNowAddress(user));
  const [editingBuyNowAddressId, setEditingBuyNowAddressId] = useState(null);
  const [showBuyNowAddressForm, setShowBuyNowAddressForm] = useState(false);
  const [buyNowAddressModalOpen, setBuyNowAddressModalOpen] = useState(false);
  const [buyNowMapOpen, setBuyNowMapOpen] = useState(false);
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const [buyNowShipping, setBuyNowShipping] = useState(null);
  const [buyNowShippingLoading, setBuyNowShippingLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [pageCoupons, setPageCoupons] = useState([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedBuyNowCoupon, setAppliedBuyNowCoupon] = useState(null);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [buyNowCouponPanelOpen, setBuyNowCouponPanelOpen] = useState(false);
  const [buyNowShowAllCoupons, setBuyNowShowAllCoupons] = useState(false);
  const [buyNowCouponModalOpen, setBuyNowCouponModalOpen] = useState(false);
  const [couponCelebration, setCouponCelebration] = useState(null);

  const frameRef = useRef(null);
  const perspectiveRef = useRef(null);
  const isMountedRef = useRef(true);
  const rootRef = useRef(null);
  const removingFromBagRef = useRef(false);
  const relatedSwipeRef = useRef({});
  const relatedSwipeBlockRef = useRef(new Set());
  const fsSwipeRef = useRef({ startX: 0, startY: 0, dragging: false });
  const fsHandlersRef = useRef({});

  const getCoverColorId = (targetProduct = product) => {
    const images = getSortedImages(targetProduct);
    return images.find((image) => image.is_cover)?.color_id || images[0]?.color_id || null;
  };

  const getFirstImageForColor = (targetProduct, colorId) => {
    const images = getSortedImages(targetProduct);
    const colorImages = images.filter((image) => String(image.color_id) === String(colorId));
    return colorImages[0] || images.find((image) => image.is_cover) || images[0] || null;
  };

  const updateColorInUrl = (colorId, replace = false) => {
    const nextParams = new URLSearchParams(window.location.search);
    if (colorId) nextParams.set("color", String(colorId));
    else nextParams.delete("color");
    const nextUrl = `${window.location.pathname}?${nextParams.toString()}`;
    if (replace) window.history.replaceState(null, "", nextUrl);
    else window.history.pushState(null, "", nextUrl);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const initialColor = searchParams.get("color");
        const [prodRes, relatedRes] = await Promise.all([
          fetch(`${API_ENDPOINTS.products}/${slug}/detail${initialColor ? `?color=${encodeURIComponent(initialColor)}` : ""}`),
          fetch(`${API_ENDPOINTS.products}/${slug}/related?limit=20`),
        ]);

        if (prodRes.status === 404) { setProductError("not_found"); return; }
        if (!prodRes.ok) { setProductError("error"); return; }

        const prodData = await prodRes.json();
        const relatedData = relatedRes.ok ? await relatedRes.json() : [];

        const sortedImages = getSortedImages(prodData);
        const initialColorId = prodData.selected_color_id || getCoverColorId(prodData);
        const initialImage = sortedImages[0] || getFirstImageForColor(prodData, initialColorId);

        setProduct(prodData);
        setAllColors(Array.isArray(prodData.colors) ? prodData.colors : []);
        setSelectedColorId(initialColorId);
        setColorImagesById(initialColorId ? { [String(initialColorId)]: sortedImages } : {});
        setMainImage(initialImage?.url || prodData.image_url || "");
        const relatedItems = Array.isArray(relatedData) ? relatedData : relatedData.items || relatedData.rows || [];
        setProducts(relatedItems.filter((item) => item.slug !== slug));
        if (initialColorId && String(searchParams.get("color")) !== String(initialColorId)) updateColorInUrl(initialColorId, true);
      } catch (error) {
        console.error("Error fetching product:", error);
        setProductError("error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  useEffect(() => {
    api.get(API_ENDPOINTS.coupons)
      .then((res) => setPageCoupons(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!product?.id) {
      setProductReviews([]);
      setReviewSummary({ average: 0, count: 0 });
      return undefined;
    }

    const controller = new AbortController();
    fetch(`${API_ENDPOINTS.feedback}/product/${product.id}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Failed to load reviews"))))
      .then((payload) => {
        const data = payload?.data || {};
         setReviewSummary(data.summary || { average: 0, count: 0 });
        setProductReviews(Array.isArray(data.reviews) ? data.reviews : []);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setProductReviews([]);
          setReviewSummary({ average: 0, count: 0 });
        }
      });

    return () => controller.abort();
  }, [product?.id]);

  useEffect(() => {
    const frame = frameRef.current;
    const perspective = perspectiveRef.current;

    const handleMouseMove = (event) => {
      if (!perspective || !frame) return;
      const rect = perspective.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -6;
      const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 6;
      frame.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const handleMouseLeave = () => {
      if (frame) frame.style.transform = "rotateX(0deg) rotateY(0deg)";
    };

    if (perspective) {
      perspective.addEventListener("mousemove", handleMouseMove);
      perspective.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      if (perspective) {
        perspective.removeEventListener("mousemove", handleMouseMove);
        perspective.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [loading]);

  const visibleImages = useMemo(() => {
    if (!selectedColorId) return getSortedImages(product);
    return colorImagesById[String(selectedColorId)] || [];
  }, [product, selectedColorId, colorImagesById]);

  const visibleMedia = useMemo(() => {
    const imgs = visibleImages.map((img) => ({ ...img, type: "image" }));
    const allVideos = Array.isArray(product?.videos) ? product.videos : [];
    const vids = (selectedColorId
      ? allVideos.filter((v) => String(v.color_id) === String(selectedColorId))
      : allVideos
    ).sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
      .map((v) => ({ ...v, type: "video" }));
    return [...imgs, ...vids];
  }, [visibleImages, product, selectedColorId]);

  const distinctColors = useMemo(() => {
    return allColors;
  }, [allColors]);

  const selectedColor = distinctColors.find((color) => String(color.id) === String(selectedColorId));
  const selectedSku = getVariantSku(product, selectedColorId, selectedColor?.slug || selectedColor?.name);
  const productStockInfo = getProductStockInfo(product);
  const isProductOutOfStock = productStockInfo.isOutOfStock;
  const selectedStockInfo = getProductStockInfo({
    ...product,
    stock_quantity: isProductOutOfStock ? product?.stock_quantity : selectedColor?.stock_quantity ?? product?.stock_quantity,
  });
  const isSelectedOutOfStock = isProductOutOfStock || selectedStockInfo.isOutOfStock;
  const isSelectedLowStock = selectedStockInfo.isLowStock;
  const isChangingColor = Boolean(loadingColorId);
  const showThumbSkeletons = isChangingColor && visibleImages.length === 0;

  const existingBagQuantity = useMemo(() => {
    if (!product || !cart) return 0;
    return cart
      .filter((item) => Number(item.id) === Number(product.id) && String(item.colorId || "") === String(selectedColorId || ""))
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }, [cart, product, selectedColorId]);

  const canAddToBag = !isSelectedOutOfStock && !isChangingColor;
  const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDeliveryDate = (value) => {
    if (!value) return "";
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return value;
    return parsedDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };
  const getCouponSavingsText = (coupon) => {
    if (!coupon) return "Coupons & offers";
    const code = String(coupon.code || "").toUpperCase();
    if (coupon.discount_type === "percentage") return `Save ${Number(coupon.discount_percent || 0)}% with ${code}`;
    return `Save ${formatMoney(coupon.discount_amount)} with ${code}`;
  };
  const getCouponSubtext = (coupon) => {
    if (!coupon) return "Choose an offer for this order.";
    const minAmount = Number(coupon.min_purchase_amount || 0);
    if (minAmount > buyNowSubtotal) {
      return `Shop for ${formatMoney(minAmount - buyNowSubtotal)} more to apply`;
    }
    return coupon.description || "Tap to apply this offer at checkout.";
  };
  const productName = product?.name || "";
  const approvedReviewImages = productReviews.flatMap((review) => Array.isArray(review.images) ? review.images : []).filter((image) => image?.url);
  const hasApprovedReviews = Number(reviewSummary.count || 0) > 0;
  const scrollToReviews = () => {
    const section = document.getElementById("product-reviews");
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const buyNowSubtotal = Number(product?.selling_price || 0) * Math.max(1, Number(quantity || 1));

  // Single-item payload (cart-item shape) handed to the shared checkout wizard
  // so Buy Now renders the exact same address → payment → confirm flow.
  const buyNowItems = useMemo(() => {
    if (!product) return [];
    return [{
      ...product,
      quantity,
      colorId: selectedColorId || null,
      selectedColorName: selectedColor?.name || "",
      selectedColorSlug: selectedColor?.slug || "",
      selectedColorHex: selectedColor?.hex_code || "",
      price: Number(product.selling_price || product.mrp_price || 0),
      mrp: Number(product.mrp_price || 0),
      image_url: mainImage || product.image_url || "",
    }];
  }, [product, quantity, selectedColorId, selectedColor, mainImage]);
  const selectedBuyNowAddress = buyNowAddresses.find((address) => String(address.id) === String(selectedBuyNowAddressId));
  const canUsePrepaid = true;
  const isProductCodAllowed = !Array.isArray(product?.payment_options) || product.payment_options.includes("cod");
  const canUseCod = isProductCodAllowed && buyNowSubtotal <= COD_MAX_AMOUNT;
  const buyNowShippingRate = Number(buyNowShipping?.rate || 0);
  const qualifiesForFreeShipping = buyNowShippingRate > 0;
  const shippingDiscountReasonCode = buyNowShippingRate > 0 ? (isFirstOrder ? "first_order" : "free_delivery") : null;
  const freeShippingReason = isFirstOrder
    ? "First order free delivery"
    : "Free delivery charge";
  const buyNowShippingDiscount = qualifiesForFreeShipping ? buyNowShippingRate : 0;
  const buyNowFinalShipping = Math.max(0, buyNowShippingRate - buyNowShippingDiscount);
  const buyNowReturnDeliveryDeduction = shippingDiscountReasonCode === "first_order" ? 0 : buyNowShippingRate;
  const buyNowPaymentFee = buyNowPayment === "cod" ? COD_FEE_AMOUNT : 0;
  const buyNowPlatformFee = PLATFORM_FEE_AMOUNT;
  const buyNowPaymentDiscount = buyNowPayment === "prepaid" ? Math.min(PREPAID_DISCOUNT_AMOUNT, buyNowSubtotal + buyNowFinalShipping) : 0;
  const buyNowGrossTotal = Math.max(0, buyNowSubtotal + buyNowFinalShipping + buyNowPaymentFee + buyNowPlatformFee - buyNowPaymentDiscount);
  const buyNowCouponDiscount = Math.min(Number(appliedBuyNowCoupon?.discount || 0), buyNowGrossTotal);
  const walletUsableAmount = useWallet ? Math.min(Number(walletBalance || 0), Math.max(0, buyNowGrossTotal - buyNowCouponDiscount)) : 0;
  const buyNowTotal = Math.max(0, buyNowGrossTotal - buyNowCouponDiscount - walletUsableAmount);
  const formatNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "";
  };

  const handleColorChange = async (colorId) => {
    const cachedImages = colorImagesById[String(colorId)];
      setSelectedColorId(colorId);
      updateColorInUrl(colorId);
      setActiveImageIndex(0);
    if (cachedImages?.length) {
      setMainImage(cachedImages[0].url);
      return;
    }

    setLoadingColorId(colorId);
    try {
      const response = await fetch(`${API_ENDPOINTS.products}/${slug}/colors/${colorId}/images`);
      const data = await response.json();
      const images = getSortedImages({ images: data.images || [] });
      setColorImagesById((current) => ({ ...current, [String(colorId)]: images }));
      setAllColors((current) =>
        current.map((color) =>
          String(color.id) === String(colorId)
            ? { ...color, stock_quantity: data.stock_quantity, stock_status: data.stock_status }
            : color,
        ),
      );
      setMainImage(images[0]?.url || "");
    } catch (error) {
      console.error("Error loading color images:", error);
      showNotification("Could not load this color. Please try again.", "warning");
    } finally {
      setLoadingColorId(null);
    }
  };

  useEffect(() => {
    if (!isGalleryHovering || visibleMedia.length <= 1) return undefined;
    // When a video is active, let its onEnded handle the advance
    if (visibleMedia[activeImageIndex]?.type === "video") return undefined;

    const timer = window.setInterval(() => {
      setActiveImageIndex((current) => {
        const next = (current + 1) % visibleMedia.length;
        const nextItem = visibleMedia[next];
        if (nextItem?.type === "image") setMainImage(nextItem.url);
        return next;
      });
    }, 1450);

    return () => window.clearInterval(timer);
  }, [isGalleryHovering, visibleMedia, activeImageIndex]);

  // Preload only adjacent fullscreen images (prev + current + next) to avoid bulk bandwidth
  useEffect(() => {
    if (!fullscreenOpen) return;
    const images = visibleMedia.filter((m) => m.type === "image");
    const n = images.length;
    if (n === 0) return;
    const toLoad = new Set([
      fullscreenIdx % n,
      (fullscreenIdx + 1) % n,
      (fullscreenIdx - 1 + n) % n,
    ]);
    toLoad.forEach((i) => { new Image().src = imgUrl(images[i]?.url, 1200); });
  }, [fullscreenOpen, fullscreenIdx, visibleMedia]);

  // Keep quantity in sync with cart (so cart-page changes reflect here instantly)
  useEffect(() => {
    removingFromBagRef.current = false;
    setQuantity(existingBagQuantity > 0 ? existingBagQuantity : 1);
  }, [existingBagQuantity]);

  // Clamp to available stock
  useEffect(() => {
    if (!isSelectedOutOfStock && selectedStockInfo.quantity > 0 && quantity > selectedStockInfo.quantity) {
      setQuantity(selectedStockInfo.quantity);
    }
  }, [isSelectedOutOfStock, quantity, selectedStockInfo.quantity]);

  const incrementQty = async () => {
    if (isSelectedOutOfStock) return;
    const next = quantity + 1;
    if (next > selectedStockInfo.quantity) return;
    setQuantity(next);
    if (existingBagQuantity > 0) {
      const result = await updateQuantity(product.id, next, selectedColorId);
      if (result && !result.success) showNotification(result.message, "error");
    }
  };

  const decrementQty = async () => {
    if (quantity <= 1) return;
    const next = quantity - 1;
    setQuantity(next);
    if (existingBagQuantity > 0) {
      const result = await updateQuantity(product.id, next, selectedColorId);
      if (result && !result.success) showNotification(result.message, "error");
    }
  };

  useEffect(() => {
    if (!buyNowOpen || !selectedBuyNowAddress?.pincode || isSelectedOutOfStock) {
      setBuyNowShipping(null);
      setBuyNowShippingLoading(false);
      return undefined;
    }

    const cleanPincode = String(selectedBuyNowAddress.pincode || "").trim();
    if (!/^\d{6}$/.test(cleanPincode)) {
      setBuyNowShipping(null);
      setBuyNowShippingLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setBuyNowShippingLoading(true);
        const rawWeight = Number(product?.weight);
        const productWeightKg = Number.isFinite(rawWeight) && rawWeight > 0 ? (rawWeight > 5 ? rawWeight / 1000 : rawWeight) : 0.5;
        const totalQty = Math.max(1, Number(quantity || 1));
        const totalWeightKg = (productWeightKg * totalQty) + (PACKAGING_WEIGHT_KG * totalQty);
        const response = await fetch(
          `${API_ENDPOINTS.shiprocket}/serviceability?pincode=${encodeURIComponent(cleanPincode)}&weight=${Math.max(0.1, Number(totalWeightKg.toFixed(3)))}&is_cod=${buyNowPayment === "cod" ? 1 : 0}`,
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || "Unable to check delivery");

        const selected = selectBestCourier(data?.data?.available_courier_companies || [], {
          weightKg: Math.max(0.1, Number(totalWeightKg.toFixed(3))),
          requireCod: buyNowPayment === "cod" && canUseCod,
        });

        if (!cancelled) {
          setBuyNowShipping(selected ? {
            ...selected,
            deliveryDate: formatEstimatedDeliveryDate(getEstimatedDeliveryDate(selected.etd, product?.processing_days)),
          } : { unavailable: true, message: "Delivery is not possible at this location right now." });
        }
      } catch (error) {
        if (!cancelled) {
          setBuyNowShipping({ unavailable: true, message: error.message || "Delivery unavailable" });
        }
      } finally {
        if (!cancelled) setBuyNowShippingLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [buyNowOpen, selectedBuyNowAddress?.pincode, buyNowPayment, canUseCod, quantity, product?.weight, isSelectedOutOfStock]);

  useEffect(() => {
    if (!couponCelebration) return undefined;
    const timer = window.setTimeout(() => setCouponCelebration(null), 2400);
    return () => window.clearTimeout(timer);
  }, [couponCelebration]);

  useEffect(() => {
    if (!reviewModalOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setReviewModalOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [reviewModalOpen]);

  useEffect(() => {
    if (!buyNowOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [buyNowOpen]);

  const handleAddToCart = async () => {
    if (!user) {
      localStorage.setItem("bk_pending_cart", JSON.stringify({
        product: {
          id: product.id, slug: product.slug, name: product.name,
          selling_price: product.selling_price, mrp_price: product.mrp_price,
          discount_percent: product.discount_percent,
          Images: product.Images || [], colors: product.colors || [],
          image_url: product.image_url || "",
        },
        quantity: 1,
        colorId: selectedColorId || null,
      }));
      navigate("/cart");
      return;
    }
    if (isSelectedOutOfStock) {
      showNotification("This product is out of stock.", "warning");
      return;
    }
    setAddingToBag(true);
    const result = await addToCart(product, quantity, selectedColorId);
    setAddingToBag(false);
    if (result?.success) {
      showNotification(`Added to bag! Qty: ${quantity}`, "success");
    } else {
      showNotification(result?.message || "Could not add to bag. Try again.", "error");
    }
  };

  const handleRemoveFromBag = () => {
    if (removingFromBagRef.current) return;
    removingFromBagRef.current = true;
    removeFromCart(product.id, selectedColorId);
    showNotification(`${product.name} removed from bag`, "success");
  };

  const resetBuyNowForm = () => {
    setEditingBuyNowAddressId(null);
    setBuyNowAddressForm(getEmptyBuyNowAddress(user));
    setBuyNowAddrFormErrors({});
  };

  const openBuyNowAddressModal = (address = null) => {
    if (address) {
      setEditingBuyNowAddressId(address.id);
      setBuyNowAddressForm(cleanAddress(address));
    } else {
      resetBuyNowForm();
    }
    setBuyNowAddrFormErrors({});
    setShowBuyNowAddressForm(true);
    setBuyNowAddressModalOpen(true);
  };

  const closeBuyNowAddressModal = () => {
    setBuyNowAddressModalOpen(false);
    setShowBuyNowAddressForm(false);
    setBuyNowMapOpen(false);
    resetBuyNowForm();
  };

  const loadBuyNowData = async () => {
    setBuyNowLoading(true);
    try {
      const [addressRes, orderRes, walletRes, couponRes] = await Promise.all([
        api.get("/api/addresses"),
        user ? api.get("/api/orders/my").then((res) => res.data).catch(() => []) : Promise.resolve([]),
        api.get("/api/wallet").catch(() => ({ data: { wallet_balance: 0 } })),
        api.get(API_ENDPOINTS.coupons).then((res) => (Array.isArray(res.data) ? res.data : [])).catch(() => []),
      ]);
      const addresses = Array.isArray(addressRes.data) ? addressRes.data.map(cleanAddress) : [];
      const defaultAddress = addresses.find((address) => address.is_default) || addresses[0];
      setBuyNowAddresses(addresses);
      setSelectedBuyNowAddressId(defaultAddress?.id ? String(defaultAddress.id) : "");
      setShowBuyNowAddressForm(false);
      setBuyNowAddressForm(defaultAddress ? cleanAddress(defaultAddress) : getEmptyBuyNowAddress(user));
      setIsFirstOrder(!Array.isArray(orderRes) || orderRes.length === 0);
      setWalletBalance(Number(walletRes?.data?.wallet_balance || 0));
      setAvailableCoupons(Array.isArray(couponRes) ? couponRes.filter((coupon) => coupon?.is_active !== false) : []);
    } catch (error) {
      showNotification(error?.response?.data?.message || "Unable to load saved addresses.", "warning");
      setBuyNowAddresses([]);
      setSelectedBuyNowAddressId("");
      setShowBuyNowAddressForm(false);
      setIsFirstOrder(false);
      setWalletBalance(0);
      setAvailableCoupons([]);
    } finally {
      setBuyNowLoading(false);
    }
  };

  const openBuyNowModal = async () => {
    if (!user) {
      showNotification("Please login first", "info");
      navigate("/cart");
      return;
    }

    if (isSelectedOutOfStock || quantity > selectedStockInfo.quantity) {
      showNotification(isSelectedOutOfStock ? "This product is out of stock." : "Selected quantity is not available.", "warning");
      return;
    }

    setBuyNowPayment("prepaid");
    setBuyNowStep("details");
    setAppliedBuyNowCoupon(null);
    setCouponCode("");
    setBuyNowCouponPanelOpen(false);
    setBuyNowShowAllCoupons(false);
    setBuyNowCouponModalOpen(false);
    setCouponCelebration(null);
    setUseWallet(false);
    setBuyNowOpen(true);
    await loadBuyNowData();
  };

  const closeBuyNowModal = () => {
    if (buyNowPlacing) return;
    setBuyNowOpen(false);
    setBuyNowStep("details");
    setBuyNowShipping(null);
    setShowBuyNowAddressForm(false);
    setBuyNowAddressModalOpen(false);
    setBuyNowMapOpen(false);
    setAppliedBuyNowCoupon(null);
    setCouponCode("");
    setBuyNowCouponPanelOpen(false);
    setBuyNowShowAllCoupons(false);
    setBuyNowCouponModalOpen(false);
    setCouponCelebration(null);
    setUseWallet(false);
    resetBuyNowForm();
  };

  const applyBuyNowCoupon = async (nextCode = couponCode) => {
    const code = String(nextCode || "").trim().toUpperCase();
    if (!code) {
      showNotification("Please enter coupon code.", "warning");
      return;
    }

    try {
      setCouponLoading(true);
      const response = await fetch(`${API_ENDPOINTS.coupons}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, amount: buyNowGrossTotal, email: user?.email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Invalid coupon code.");
      setAppliedBuyNowCoupon(data);
      setCouponCode(code);
      setBuyNowCouponPanelOpen(false);
      setBuyNowShowAllCoupons(false);
      setBuyNowCouponModalOpen(false);
      setCouponCelebration({
        code,
        discount: Number(data.discount || data.discount_amount || 0),
      });
      showNotification(`Coupon ${code} applied.`, "success");
    } catch (error) {
      setAppliedBuyNowCoupon(null);
      showNotification(error.message || "Unable to apply coupon.", "warning");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeBuyNowCoupon = () => {
    setAppliedBuyNowCoupon(null);
    setCouponCode("");
    setBuyNowCouponPanelOpen(false);
    setBuyNowShowAllCoupons(false);
    setBuyNowCouponModalOpen(false);
    setCouponCelebration(null);
    showNotification("Coupon removed.", "info");
  };

  const proceedToFinalPayment = () => {
    if (!selectedBuyNowAddress) {
      showNotification("Please select or save a delivery address.", "warning");
      return;
    }
    if (!/^\d{6}$/.test(String(selectedBuyNowAddress.pincode || ""))) {
      showNotification("Please add a valid delivery pincode.", "warning");
      return;
    }
    if (!buyNowShipping || buyNowShipping.unavailable) {
      showNotification("Delivery is unavailable for this address right now.", "warning");
      return;
    }
    if (buyNowPayment === "cod" && !canUseCod) {
      showNotification(`COD is available only up to ${formatMoney(COD_MAX_AMOUNT)}.`, "warning");
      return;
    }
    setBuyNowStep("payment");
  };

  const handleBuyNowAddressChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (buyNowAddrFormErrors[name]) setBuyNowAddrFormErrors((prev) => ({ ...prev, [name]: undefined }));
    setBuyNowAddressForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked
        : name === "pincode" ? value.replace(/\D/g, "").slice(0, 6)
        : name === "phone" ? value.replace(/\D/g, "").slice(0, 10)
        : value,
    }));
  };

  const editBuyNowAddress = (address) => {
    openBuyNowAddressModal(address);
  };

  const deleteBuyNowAddress = async (address) => {
    try {
      setBuyNowDeletingAddressId(String(address.id));
      await api.delete(`/api/addresses/${address.id}`);
      const next = buyNowAddresses.filter((a) => String(a.id) !== String(address.id));
      setBuyNowAddresses(next);
      if (String(selectedBuyNowAddressId) === String(address.id)) {
        const fallback = next.find((a) => a.is_default) || next[0];
        setSelectedBuyNowAddressId(fallback ? String(fallback.id) : "");
      }
      showNotification("Address deleted.", "success");
    } catch (error) {
      showNotification(error?.response?.data?.message || "Unable to delete address.", "warning");
    } finally {
      setBuyNowDeletingAddressId(null);
    }
  };

  const confirmBuyNowLocation = (location) => {
    setBuyNowAddressForm((current) => ({
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
    setBuyNowMapOpen(false);
  };

  const saveBuyNowAddress = async () => {
    const form = cleanAddress(buyNowAddressForm);
    const phone = String(form.phone || "").replace(/\D/g, "");
    const errors = {};
    if (!form.house_building?.trim()) errors.house_building = "Address is required.";
    if (!form.city?.trim()) errors.city = "City is required.";
    if (!form.state?.trim()) errors.state = "State is required.";
    if (!form.pincode || !/^\d{6}$/.test(form.pincode)) errors.pincode = "Enter a valid 6-digit pincode.";
    if (!phone) errors.phone = "Phone is required.";
    else if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = "Enter a valid 10-digit mobile number.";
    if (Object.keys(errors).length > 0) {
      setBuyNowAddrFormErrors(errors);
      return;
    }
    setBuyNowAddrFormErrors({});

    try {
      setBuyNowLoading(true);
      const payload = {
        ...form,
        name: form.name || user?.name || "",
        phone: phone || user?.phone || "",
      };
      const response = editingBuyNowAddressId
        ? await api.put(`/api/addresses/${editingBuyNowAddressId}`, payload)
        : await api.post("/api/addresses", payload);
      const saved = cleanAddress(response.data);
      const addressRes = await api.get("/api/addresses");
      const addresses = Array.isArray(addressRes.data) ? addressRes.data.map(cleanAddress) : [saved];
      setBuyNowAddresses(addresses);
      setSelectedBuyNowAddressId(String(saved.id));
      setBuyNowAddressForm(saved);
      setEditingBuyNowAddressId(null);
      setShowBuyNowAddressForm(false);
      setBuyNowAddressModalOpen(false);
      showNotification("Address saved.", "success");
    } catch (error) {
      showNotification(error?.response?.data?.message || "Unable to save address.", "warning");
    } finally {
      setBuyNowLoading(false);
    }
  };

  const buildBuyNowOrder = () => ({
    customer_name: selectedBuyNowAddress?.name || user?.name || "Customer",
    customer_email: user?.email,
    address: getAddressLine(selectedBuyNowAddress),
    city: selectedBuyNowAddress?.city,
    state: selectedBuyNowAddress?.state || "Uttar Pradesh",
    pincode: selectedBuyNowAddress?.pincode,
    phone: selectedBuyNowAddress?.phone || user?.phone,
    subtotal_amount: buyNowSubtotal,
    shipping_charge: buyNowShippingRate,
    shipping_discount: buyNowShippingDiscount,
    shipping_discount_reason: shippingDiscountReasonCode,
    selected_courier_data: buyNowShipping?.raw || null,
    total_amount: buyNowGrossTotal,
    coupon_code: appliedBuyNowCoupon?.code || null,
    wallet_amount: walletUsableAmount,
    payment_fee: buyNowPaymentFee + buyNowPlatformFee,
    payment_discount: buyNowPaymentDiscount,
    payment_method: buyNowPayment === "cod" ? "COD" : "Prepaid",
    payment_status: buyNowPayment === "cod" ? "Pending" : "Paid",
    items: [{
      id: product.id,
      name: product.name,
      quantity,
      price: Number(product.selling_price || 0),
      colorId: selectedColorId,
      sku: selectedSku,
    }],
  });

  const createBuyNowOrder = async (orderData) => {
    try {
      const response = await api.post("/api/orders", orderData);
      return response.data;
    } catch (error) {
      throw new Error(error?.response?.data?.message || "Unable to place order.");
    }
  };

  const placeBuyNowOrder = async () => {
    if (!selectedBuyNowAddress) {
      showNotification("Please select or save a delivery address.", "warning");
      return;
    }
    if (!/^\d{6}$/.test(String(selectedBuyNowAddress.pincode || ""))) {
      showNotification("Please add a valid delivery pincode.", "warning");
      return;
    }
    if (!buyNowShipping || buyNowShipping.unavailable) {
      showNotification("Delivery is unavailable for this address right now.", "warning");
      return;
    }
    if (buyNowPayment === "cod" && !canUseCod) {
      showNotification(`COD is available only up to ${formatMoney(COD_MAX_AMOUNT)}.`, "warning");
      return;
    }
    if (buyNowPayment === "prepaid" && !canUsePrepaid) {
      showNotification("Online payment is not available for this product.", "warning");
      return;
    }

    const orderData = buildBuyNowOrder();
    setBuyNowPlacing(true);
    try {
      if (buyNowPayment === "cod" || buyNowTotal <= 0) {
        const created = await createBuyNowOrder(orderData);
        showNotification("Order placed successfully.", "success");
        navigate(`/order-confirmation?orderId=${created.orderId}`);
        return;
      }

      if (!window.Razorpay) {
        throw new Error("Payment gateway is still loading. Please try again.");
      }

      const orderResponse = await api.post(API_ENDPOINTS.razorpay.createOrder, { amount: buyNowTotal });
      const razorpayOrder = orderResponse.data;
      if (!orderResponse.status || orderResponse.status >= 400) throw new Error(razorpayOrder.message || "Unable to start payment.");

      const razorpay = new window.Razorpay({
        key: requiredEnv("VITE_RAZORPAY_KEY_ID"),
        amount: razorpayOrder.amount,
        currency: "INR",
        name: "Banarasi Kala",
        description: `${product.name} purchase`,
        order_id: razorpayOrder.id,
        prefill: buildRazorpayPrefill({
          name: orderData.customer_name,
          email: orderData.customer_email,
          phone: orderData.phone,
        }),
        theme: { color: "#800020" },
        handler: async (response) => {
          setBuyNowProcessing(true);
          const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
          window.addEventListener("beforeunload", onBeforeUnload);
          try {
            const verifyRes = await api.post(API_ENDPOINTS.razorpay.verifyPayment, response);
            const verifyData = verifyRes.data;
            if (!verifyData.success) throw new Error(verifyData.message || "Payment verification failed.");
            const created = await createBuyNowOrder({
              ...orderData,
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
            navigate(`/order-confirmation?orderId=${created.orderId}`);
          } catch (error) {
            if (isMountedRef.current) {
              setBuyNowProcessing(false);
              showNotification(error.message || "Unable to place paid order.", "error");
            }
          } finally {
            window.removeEventListener("beforeunload", onBeforeUnload);
            if (isMountedRef.current) setBuyNowPlacing(false);
          }
        },
        modal: {
          ondismiss: () => {
            if (isMountedRef.current) setBuyNowPlacing(false);
          },
        },
      });
      razorpay.open();
    } catch (error) {
      showNotification(error.message || "Unable to place order.", "error");
      setBuyNowPlacing(false);
    }
  };

  const handleWishlist = async (targetProduct = product, colorId = selectedColorId) => {
    if (!targetProduct) return;
    if (!user) {
      localStorage.setItem("bk_pending_wishlist", JSON.stringify({
        product: {
          id: targetProduct.id,
          slug: targetProduct.slug,
          name: targetProduct.name,
          selling_price: targetProduct.selling_price,
          mrp_price: targetProduct.mrp_price,
          discount_percent: targetProduct.discount_percent,
          Images: targetProduct.Images || [],
          image_url: targetProduct.image_url || "",
        },
        colorId: colorId || null,
      }));
      navigate("/wishlist");
      return;
    }
    await toggleWishlist(targetProduct, colorId || null);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: productName, text: productName, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showNotification("Product link copied with selected color!");
      }
    } catch {
      showNotification("Share cancelled", "info");
    }
  };

  const goToRelatedSlide = (event, productId, slideIndex) => {
    event.preventDefault();
    event.stopPropagation();
    setRelatedActiveSlides((current) => ({ ...current, [productId]: slideIndex }));
  };

  const blockRelatedSwipeClick = (productId) => {
    relatedSwipeBlockRef.current.add(productId);
    window.setTimeout(() => relatedSwipeBlockRef.current.delete(productId), 450);
  };

  const handleRelatedSwipeStart = (event, productId) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    relatedSwipeRef.current[productId] = {
      startX: touch.clientX,
      startY: touch.clientY,
      didMove: false,
    };
  };

  const handleRelatedSwipeMove = (event, productId) => {
    const touch = event.touches?.[0];
    const swipe = relatedSwipeRef.current[productId];
    if (!touch || !swipe) return;
    if (Math.abs(touch.clientX - swipe.startX) > 8) swipe.didMove = true;
  };

  const handleRelatedSwipeEnd = (event, productId, imageCount) => {
    const touch = event.changedTouches?.[0];
    const swipe = relatedSwipeRef.current[productId];
    delete relatedSwipeRef.current[productId];
    if (!touch || !swipe || imageCount <= 1) return;

    const dx = touch.clientX - swipe.startX;
    const dy = touch.clientY - swipe.startY;
    const absDx = Math.abs(dx);
    if (absDx <= 40 || absDx <= Math.abs(dy)) return;

    event.preventDefault();
    event.stopPropagation();
    blockRelatedSwipeClick(productId);
    setRelatedActiveSlides((current) => {
      const currentIndex = current[productId] || 0;
      const nextIndex = dx < 0
        ? (currentIndex + 1) % imageCount
        : (currentIndex - 1 + imageCount) % imageCount;
      return { ...current, [productId]: nextIndex };
    });
  };

  const handleRelatedAddToCart = async (e, relatedItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      localStorage.setItem("bk_pending_cart", JSON.stringify({
        product: {
          id: relatedItem.id, slug: relatedItem.slug, name: relatedItem.name,
          selling_price: relatedItem.selling_price, mrp_price: relatedItem.mrp_price,
          discount_percent: relatedItem.discount_percent,
          Images: relatedItem.Images || [], colors: relatedItem.colors || [],
          image_url: relatedItem.image_url || "",
        },
        quantity: 1,
        colorId: relatedItem.selected_color_id || null,
      }));
      navigate("/cart");
      return;
    }
    const result = await addToCart(relatedItem, 1, relatedItem.selected_color_id || null);
    if (result?.success) {
      showNotification("Added to bag!", "success");
    } else {
      showNotification(result?.message || "Could not add to bag.", "error");
    }
  };

  const copyCouponCode = async (code) => {
    const couponCodeValue = String(code || "").trim();
    if (!couponCodeValue) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(couponCodeValue);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = couponCodeValue;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      showNotification(`${couponCodeValue} copied`, "success");
    } catch {
      showNotification("Could not copy coupon code", "warning");
    }
  };

  const checkDelivery = async (pinOverride) => {
    if (isSelectedOutOfStock) {
      showNotification("Delivery charges are available when this color is in stock.", "warning");
      return;
    }
    const clean = (pinOverride || deliveryPincode).trim();
    if (!/^\d{6}$/.test(clean)) {
      showNotification("Enter valid 6 digit pincode", "warning");
      return;
    }
    try {
      setDeliveryCheckLoading(true);
      setDeliveryQuote(null);
      const rawWeight = Number(product?.weight);
      const productWeightKg = Number.isFinite(rawWeight) && rawWeight > 0 ? (rawWeight > 5 ? rawWeight / 1000 : rawWeight) : 0.5;
      const totalQty = Math.max(1, Number(quantity || 1));
      const totalWeightKg = (productWeightKg * totalQty) + (PACKAGING_WEIGHT_KG * totalQty);
      const response = await fetch(
        `${API_ENDPOINTS.shiprocket}/serviceability?pincode=${encodeURIComponent(clean)}&weight=${Math.max(0.1, Number(totalWeightKg.toFixed(3)))}&is_cod=${canUseCod ? 1 : 0}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to check delivery");

      const selectedOption = selectBestCourier(data?.data?.available_courier_companies || [], {
        weightKg: Math.max(0.1, Number(totalWeightKg.toFixed(3))),
        requireCod: canUseCod,
      });

      if (!selectedOption) {
        setDeliveryQuote({ unavailable: true });
        return;
      }
      const estimatedDate = getEstimatedDeliveryDate(selectedOption.etd, product?.processing_days);
      setDeliveryQuote({
        option: selectedOption,
        deliveryDate: formatEstimatedDeliveryDate(estimatedDate),
        deliveryDateObj: estimatedDate,
      });
      // Persist the pincode so other pages auto-populate; keep "gps" source if already set
      if (!pinOverride) saveLocationPin(clean, locationSource === "gps" ? "gps" : "manual");
    } catch (error) {
      showNotification(error.message || "Unable to check delivery", "warning");
      setDeliveryQuote({ unavailable: true });
    } finally {
      setDeliveryCheckLoading(false);
    }
  };

  // Auto-check delivery when a pincode is available from location context
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!locationPincode || !product || isSelectedOutOfStock) return undefined;
    const key = `${locationPincode}_${String(product?.id || "")}`;
    if (autoCheckedRef.current === key) return undefined;
    autoCheckedRef.current = key;
    setDeliveryPincode(locationPincode);
    if (locationSource === "gps") setShowPincodeInput(false);
    setDeliveryQuote(null);
    const timer = setTimeout(() => { checkDelivery(locationPincode); }, 200);
    return () => clearTimeout(timer);
  // checkDelivery is intentionally omitted — it's recreated each render and adding it
  // would cause an infinite loop; we pass locationPincode explicitly so no stale closure.
  }, [locationPincode, locationSource, product?.id, isSelectedOutOfStock]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick the "Order within X hrs Y mins" countdown every minute
  useEffect(() => {
    if (!deliveryQuote?.deliveryDate) return undefined;
    const interval = setInterval(() => setOrderCountdown(getOrderCutoff()), 60000);
    return () => clearInterval(interval);
  }, [deliveryQuote?.deliveryDate]);

  // Reset carousel zoom when the active slide changes
  useEffect(() => {
    carouselZoomPanRef.current = { zoom: 1, pan: { x: 0, y: 0 } };
    setCarouselIsZoomed(false);
    if (carouselWrapperRef.current) carouselWrapperRef.current.style.transform = "";
    carouselDragRef.current.dragging = false;
    carouselPinchRef.current.active = false;
  }, [activeImageIndex]);

  // Non-passive wheel zoom for carousel — direct DOM so no React re-render per wheel tick
  carouselWheelHandlerRef.current = (e) => {
    if (visibleMedia[activeImageIndex]?.type !== "image") return;
    e.preventDefault();
    const { zoom, pan } = carouselZoomPanRef.current;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(1, Math.min(5, zoom * factor));
    const el = frameRef.current;
    if (newZoom <= 1) {
      carouselZoomPanRef.current = { zoom: 1, pan: { x: 0, y: 0 } };
      if (carouselWrapperRef.current) carouselWrapperRef.current.style.transform = "";
      if (zoom > 1) setCarouselIsZoomed(false);
      return;
    }
    if (!el) { carouselZoomPanRef.current = { zoom: newZoom, pan }; applyCarouselTransform(); return; }
    const rect = el.getBoundingClientRect();
    const ex = e.clientX - (rect.left + rect.width / 2);
    const ey = e.clientY - (rect.top + rect.height / 2);
    const zf = newZoom / zoom;
    const maxX = el.clientWidth * (newZoom - 1) / 2;
    const maxY = el.clientHeight * (newZoom - 1) / 2;
    const newPan = {
      x: Math.max(-maxX, Math.min(maxX, ex * (1 - zf) + pan.x * zf)),
      y: Math.max(-maxY, Math.min(maxY, ey * (1 - zf) + pan.y * zf)),
    };
    carouselZoomPanRef.current = { zoom: newZoom, pan: newPan };
    applyCarouselTransform();
    if (zoom <= 1) setCarouselIsZoomed(true);
  };
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const handler = (e) => carouselWheelHandlerRef.current?.(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [product]);

  // Non-passive wheel listener for fullscreen — direct DOM transform, no React re-render per tick.
  useLayoutEffect(() => {
    const el = fsMainRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (fsIsVideoRef.current) return;
      e.preventDefault();
      const { zoom, pan } = fsZoomPanRef.current;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(1, Math.min(5, zoom * factor));
      const wasZoomed = zoom > 1;
      if (newZoom <= 1) {
        fsZoomPanRef.current = { zoom: 1, pan: { x: 0, y: 0 } };
        if (fsImageRef.current) fsImageRef.current.style.transform = "";
        if (wasZoomed) setFsIsZoomed(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      const ex = e.clientX - (rect.left + rect.width / 2);
      const ey = e.clientY - (rect.top + rect.height / 2);
      const zf = newZoom / zoom;
      const maxX = el.clientWidth * (newZoom - 1) / 2;
      const maxY = el.clientHeight * (newZoom - 1) / 2;
      const newPan = {
        x: Math.max(-maxX, Math.min(maxX, ex * (1 - zf) + pan.x * zf)),
        y: Math.max(-maxY, Math.min(maxY, ey * (1 - zf) + pan.y * zf)),
      };
      fsZoomPanRef.current = { zoom: newZoom, pan: newPan };
      if (fsImageRef.current) {
        fsImageRef.current.style.transform = `translate(${newPan.x}px, ${newPan.y}px) scale(${newZoom})`;
      }
      if (!wasZoomed) setFsIsZoomed(true);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fullscreenOpen]);

  const specificationRows = product
    ? [
        ["SKU", selectedSku],
        ["Selected Color", selectedColor?.name],
        ["Variety", product.Variety?.name],
        ["Fabric", product.Material?.name],
        ["Occasion", product.Occasion?.name],
        ["Saree Length", product.length ? `${formatNumber(product.length)} Meter` : ""],
        ["Saree Width", product.width ? `${formatNumber(product.width)} Meter` : ""],
        ["Height", product.height ? `${formatNumber(product.height)} cm` : ""],
        ["Weight", product.weight ? `${formatNumber(product.weight)} kg` : ""],
        ["Blouse", product.blouse_piece ? "Included" : "Not Included"],
        ["Care", product.care_instructions],
      ].filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    : [];

  if (loading) {
    return (
      <div className="product-detail-page">
        <main className="product-detail-shell">
          <div className="product-skeleton-mobile-header" aria-hidden="true">
            <span className="product-skeleton-line title" />
            <span className="product-skeleton-line medium" />
          </div>
          <div className="product-detail-skeleton" aria-label="Loading product">
            <div className="product-skeleton-gallery">
              <div className="product-skeleton-thumb-strip" aria-hidden="true">
                <span className="product-skeleton-thumb" />
                <span className="product-skeleton-thumb" />
                <span className="product-skeleton-thumb" />
                <span className="product-skeleton-thumb" />
              </div>
              <div className="product-skeleton-main">
                <span className="product-skeleton-image" />
                <div className="product-skeleton-media-bar" aria-hidden="true">
                  <span className="product-skeleton-shape product-skeleton-media-spacer" />
                  <span className="product-skeleton-media-dots">
                    <span className="product-skeleton-shape product-skeleton-dot wide" />
                    <span className="product-skeleton-shape product-skeleton-dot" />
                    <span className="product-skeleton-shape product-skeleton-dot" />
                  </span>
                  <span className="product-skeleton-media-actions">
                    <span className="product-skeleton-shape product-skeleton-circle" />
                    <span className="product-skeleton-shape product-skeleton-circle" />
                  </span>
                </div>
              </div>
              <div className="product-skeleton-mobile-thumbs" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="product-skeleton-info">
              {/* breadcrumb */}
              <span className="product-skeleton-line short product-skeleton-breadcrumb" />
              {/* product name + rating */}
              <div className="product-skeleton-name-row">
                <span className="product-skeleton-line title" />
                <span className="product-skeleton-shape product-skeleton-rating" />
              </div>
              {/* price card */}
              <div className="product-skeleton-price-card">
                <span className="product-skeleton-line price" />
                <span className="product-skeleton-line tiny" />
              </div>
              {/* feature icons row */}
              <div className="product-skeleton-feature-grid" aria-hidden="true">
                {[...Array(6)].map((_, index) => (
                  <span key={index} className="product-skeleton-feature">
                    <span className="product-skeleton-shape product-skeleton-feature-icon" />
                    <span className="product-skeleton-shape product-skeleton-feature-text" />
                  </span>
                ))}
              </div>
              {/* delivery check */}
              <span className="product-skeleton-box delivery" />
              {/* color selector */}
              <div className="product-skeleton-color-card">
                <span className="product-skeleton-line short" />
                <div className="product-skeleton-color-pills" aria-hidden="true">
                  <span className="product-skeleton-shape product-skeleton-color-pill" />
                  <span className="product-skeleton-shape product-skeleton-color-pill" />
                  <span className="product-skeleton-shape product-skeleton-color-pill" />
                </div>
              </div>
              {/* action panel: qty · add · buy */}
              <div className="product-skeleton-action-panel" aria-hidden="true">
                <span className="product-skeleton-shape product-skeleton-qty" />
                <span className="product-skeleton-shape product-skeleton-add" />
                <span className="product-skeleton-shape product-skeleton-buy" />
              </div>
              {/* special offers */}
              <span className="product-skeleton-box offers" />
            </div>
          </div>
          <div className="product-skeleton-section-grid" aria-hidden="true">
            {[...Array(4)].map((_, index) => (
              <span key={index} className="product-skeleton-section-card">
                <span className="product-skeleton-line short" />
                <span className="product-skeleton-line medium" />
                <span className="product-skeleton-line medium" />
                <span className="product-skeleton-line tiny" />
              </span>
            ))}
          </div>
          <section className="product-skeleton-related" aria-hidden="true">
            <div className="product-skeleton-related-head">
              <span className="product-skeleton-line medium" />
              <span className="product-skeleton-line tiny" />
            </div>
            <div className="product-skeleton-related-grid">
              {[...Array(4)].map((_, index) => (
                <span key={index} className="product-skeleton-related-card">
                  <span className="product-skeleton-related-image" />
                  <span className="product-skeleton-line medium" />
                  <span className="product-skeleton-line tiny" />
                </span>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (productError) {
    return (
      <div className="product-detail-page product-detail-loading">
        <div className="text-center">
          <p className="serif-text italic text-2xl text-[#800020] mb-4">
            {productError === "not_found" ? "This product is no longer available." : "Something went wrong. Please try again."}
          </p>
          <Link to="/collection" className="text-[#800020] font-bold uppercase tracking-widest border-b border-[#800020]">
            Return to Collection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="product-detail-page" ref={rootRef}>
      <main className="product-detail-shell">
        <div className="product-mobile-header">
          <div className="product-name-rating-row">
            <h1 className="product-detail-title">{productName}</h1>
            <ReviewRatingBadge summary={reviewSummary} onClick={scrollToReviews} />
          </div>
          {(product.short_description || product.Variety?.name || product.Material?.name) && (
            <p className="product-mobile-header-desc">
              {product.short_description || [product.Variety?.name, product.Material?.name].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <div className="product-detail-grid">
          <section className="product-gallery">
            {visibleMedia.length > 1 && (
              <div className="product-thumb-strip">
                {visibleMedia.map((item, index) => (
                  <button
                    key={item.url}
                    type="button"
                    className={`product-thumb-item${index === activeImageIndex ? " active" : ""}`}
                    onClick={() => { setActiveImageIndex(index); if (item.type === "image") setMainImage(item.url); }}
                    aria-label={item.type === "video" ? "View video" : `View image ${index + 1}`}
                  >
                    {item.type === "video" ? (
                      <span className="product-thumb-video">
                        <video src={`${item.url}#t=0.1`} muted playsInline preload="metadata" tabIndex={-1} />
                        <span className="product-thumb-play"><Icon icon="lucide:play" /></span>
                      </span>
                    ) : (
                      <img src={imgUrl(item.url, 200)} alt="" draggable={false} />
                    )}
                  </button>
                ))}
              </div>
            )}
            <div
              className="product-main-media product-3d-perspective"
              ref={perspectiveRef}
              onMouseEnter={() => setIsGalleryHovering(true)}
              onMouseLeave={() => setIsGalleryHovering(false)}
            >
              <div
                className="product-3d-frame product-image-frame"
                ref={frameRef}
                onMouseDown={handleFrameMouseDown}
                onMouseMove={handleFrameMouseMove}
                onMouseUp={handleFrameMouseUp}
                onMouseLeave={() => { if (!touchActiveRef.current) { swipeRef.current.dragging = false; carouselDragRef.current.dragging = false; } }}
                onTouchStart={handleFrameTouchStart}
                onTouchMove={handleFrameTouchMove}
                onTouchEnd={handleFrameTouchEnd}
                style={{ cursor: visibleMedia[activeImageIndex]?.type === "video" ? "default" : carouselIsZoomed ? "grab" : "zoom-in", touchAction: carouselIsZoomed ? "none" : "pan-y" }}
              >
                {loadingColorId ? <span className="product-image-loader" aria-hidden="true" /> : null}
                <div
                  className="product-carousel-zoom-wrapper"
                  ref={carouselWrapperRef}
                >
                  {visibleMedia.length > 0 ? (
                    <div
                      className="product-main-image-track"
                      style={{ transform: `translateX(-${activeImageIndex * 100}%)` }}
                    >
                      {visibleMedia.map((item, index) => (
                        item.type === "video" ? (
                          <VideoSlide key={item.url} src={item.url} isActive={index === activeImageIndex} activePlayerRef={activeVideoPlayerRef} />
                        ) : (
                          <ImageSlide key={item.url} url={imgUrl(item.url, 1200)} alt={index === activeImageIndex ? productName : ""} />
                        )
                      ))}
                    </div>
                  ) : mainImage ? (
                    <ImageSlide url={imgUrl(mainImage, 1200)} alt={productName} />
                  ) : null}
                </div>
                {isSelectedOutOfStock && (
                  <span className="product-image-stock-badge out">Out of stock</span>
                )}
              </div>

              {/* ── Media bar: dots · wishlist · share ── */}
              <div className="product-media-bar">
                <div className="product-media-bar-left" />
                <div className="product-media-bar-dots" aria-hidden="true">
                  {visibleMedia.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`product-media-dot${index === activeImageIndex ? " active" : ""}`}
                      onClick={() => { setActiveImageIndex(index); if (visibleMedia[index]?.type === "image") setMainImage(visibleMedia[index].url); }}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
                <div className="product-media-bar-right">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleWishlist(product, selectedColorId);
                    }}
                    className={`product-media-action-btn product-media-wishlist-btn${isInWishlist(product.id, selectedColorId) ? " active" : ""}`}
                    aria-label={isInWishlist(product.id, selectedColorId) ? "Remove from wishlist" : "Add to wishlist"}
                  >
                    <svg width="20" height="20" fill={isInWishlist(product.id, selectedColorId) ? "#800020" : "none"} stroke="#800020" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleShare(); }} className="product-media-action-btn" aria-label="Share">
                    <Icon icon="lucide:share-2" />
                  </button>
                </div>
              </div>

            </div>
          </section>

          <section className="product-info-panel">

            <nav className="product-breadcrumb product-breadcrumb--panel" aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <Icon icon="lucide:chevron-right" />
              <Link to="/collection">Sarees</Link>
              <Icon icon="lucide:chevron-right" />
              <span>{productName}</span>
            </nav>

            <div className="product-name-rating-row">
              <h1 className="product-detail-title">{productName}</h1>
              <ReviewRatingBadge summary={reviewSummary} onClick={scrollToReviews} />
            </div>

            <div className="product-price-card">
              {isSelectedOutOfStock ? (
                <div className="product-price-row">
                  <strong><sup className="product-price-currency">₹</sup>{Number(product.mrp_price || product.selling_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
              ) : (
                <>
                  <div className="product-price-row">
                    {Number(product.mrp_price || 0) > Number(product.selling_price || 0) && (
                      <em>-{product.discount_percent}%</em>
                    )}
                    <strong><sup className="product-price-currency">₹</sup>{Number(product.selling_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  {Number(product.mrp_price || 0) > Number(product.selling_price || 0) && (
                    <div className="product-price-mrp-line">
                      <span className="product-price-mrp"><span className="product-price-mrp-val">{formatMoney(product.mrp_price)}</span></span>
                    </div>
                  )}
                </>
              )}
              {!isSelectedOutOfStock && <p>Inclusive of all taxes</p>}
            </div>

            <div className="product-feature-icons">
              {[
                { icon: "lucide:banknote", label: "COD", sub: "Available" },
                { icon: "lucide:shield-check", label: "Secure", sub: "Prepaid" },
                { icon: "lucide:truck", label: "Free", sub: "Shipping" },
                { icon: "lucide:refresh-ccw", label: "7 Days", sub: "Return" },
                { icon: "lucide:repeat-2", label: "Exchange", sub: "Available" },
                { icon: "lucide:headphones", label: "24x7", sub: "Support" },
              ].map(({ icon, label, sub }) => (
                <div key={label} className="product-feature-item">
                  <Icon icon={icon} />
                  <span>{label}<br />{sub}</span>
                </div>
              ))}
            </div>

            {!isSelectedOutOfStock && (
              <div className="product-delivery-check product-delivery-check-top">
                <p className="product-delivery-helper">
                  <Icon icon="lucide:map-pin" />
                  {locationDetecting ? "Detecting your location…" : "Delivery Availability"}
                </p>

                {locationDetecting ? (
                  <div className="product-delivery-detecting">
                    <Icon icon="lucide:loader" className="product-delivery-spinner" />
                    <span>Finding your pincode for delivery estimate…</span>
                  </div>
                ) : !showPincodeInput && locationSource === "gps" && locationPincode ? (
                  <div className="product-delivery-detected">
                    <Icon icon="lucide:map-pin" />
                    <span>Delivering to <strong>{locationPincode}</strong></span>
                    <button
                      type="button"
                      className="product-delivery-change-btn"
                      onClick={() => {
                        setShowPincodeInput(true);
                        setDeliveryPincode(locationPincode);
                        setDeliveryQuote(null);
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="product-delivery-input-row">
                    <input
                      type="text"
                      maxLength={6}
                      inputMode="numeric"
                      placeholder="Enter Pincode"
                      value={deliveryPincode}
                      onChange={(e) => {
                        setDeliveryPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setDeliveryQuote(null);
                      }}
                      onKeyDown={(event) => { if (event.key === "Enter") checkDelivery(); }}
                    />
                    <button type="button" onClick={() => checkDelivery()} disabled={deliveryCheckLoading}>
                      {deliveryCheckLoading ? "Checking…" : "CHECK"}
                    </button>
                  </div>
                )}

                {deliveryCheckLoading && (
                  <p className="product-delivery-note">Checking delivery…</p>
                )}
                {!deliveryCheckLoading && (
                  deliveryQuote?.unavailable ? (
                    <p className="product-delivery-note">Delivery not available for this pincode.</p>
                  ) : deliveryQuote?.deliveryDateObj ? (
                    <div className="product-delivery-date">
                      <div className="product-delivery-free-line">
                        <Icon icon="lucide:package-check" />
                        <span>
                          FREE delivery{" "}
                          <strong>
                            {deliveryQuote.deliveryDateObj.toLocaleDateString("en-IN", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}
                          </strong>
                        </span>
                      </div>
                      {orderCountdown && (
                        <p className="product-delivery-urgency-line">
                         {" "}Order within{" "}
                          <strong>
                            {orderCountdown.hours > 0 ? `${orderCountdown.hours} hr${orderCountdown.hours !== 1 ? "s" : ""} ` : ""}
                            {orderCountdown.mins} min{orderCountdown.mins !== 1 ? "s" : ""}
                          </strong>
                        </p>
                      )}
                    </div>
                  ) : null
                )}
              </div>
            )}

            {distinctColors.length > 0 && (
              <div className="product-color-section">
                <p>SELECTED COLOR: <span>{selectedColor?.name || "Choose color"}</span></p>
                <div className="product-color-list">
                  {distinctColors.map((color) => {
                    const colorStock = getProductStockInfo({ ...product, stock_quantity: color.stock_quantity });
                    const isOut = colorStock.isOutOfStock;
                    const isLow = colorStock.isLowStock;
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => handleColorChange(color.id)}
                        className={`product-color-btn ${String(selectedColorId) === String(color.id) ? "active" : ""} ${isOut ? "out" : ""} ${isLow ? "low" : ""}`}
                        aria-disabled={isOut}
                        title={color.name}
                      >
                        <span style={{ backgroundColor: color.hex_code || "#ccc" }} />
                        <strong>{color.name}</strong>
                        {/* {isLow && <small>Few left</small>} */}
                        {isOut && <small>Out</small>}
                      </button>
                    );
                  })}
                </div>
                {/*
                {isSelectedLowStock && (
                  <div className="product-stock-note low">
                    {selectedStockInfo.colorMessage}
                  </div>
                )}
                */}
                {isSelectedOutOfStock && (
                  <div className={`product-stock-note ${isSelectedOutOfStock ? "out" : "low"}`}>
                    {selectedStockInfo.colorMessage}
                  </div>
                )}
              </div>
            )}

            <div className="product-action-panel">
              <div className="product-qty-row">
                <p className="product-qty-label">Quantity</p>
                <div className="product-qty">
                  <div className="product-qty-stepper">
                    <button
                      type="button"
                      onClick={existingBagQuantity > 0 && quantity <= 1 ? handleRemoveFromBag : decrementQty}
                      disabled={existingBagQuantity === 0 && quantity <= 1}
                      aria-label={existingBagQuantity > 0 && quantity <= 1 ? "Remove from bag" : "Decrease quantity"}
                      className={existingBagQuantity > 0 && quantity <= 1 ? "is-trash" : ""}
                    >
                      <Icon icon={existingBagQuantity > 0 && quantity <= 1 ? "lucide:trash-2" : "lucide:minus"} />
                    </button>
                    <span>{isSelectedOutOfStock ? 0 : quantity}</span>
                    <button
                      type="button"
                      onClick={incrementQty}
                      disabled={isSelectedOutOfStock || quantity >= selectedStockInfo.quantity}
                      aria-label="Increase quantity"
                    >
                      <Icon icon="lucide:plus" />
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                className={`product-add-btn${existingBagQuantity > 0 ? " in-bag" : ""}`}
                disabled={existingBagQuantity > 0 || !canAddToBag || addingToBag}
              >
                {existingBagQuantity > 0 ? (
                  <><Icon icon="lucide:check" /> In Bag</>
                ) : addingToBag ? (
                  <>Adding...</>
                ) : isSelectedOutOfStock ? (
                  <>Out of Stock</>
                ) : isChangingColor ? (
                  <>Loading...</>
                ) : (
                  <><Icon icon="lucide:shopping-bag" /> ADD TO BAG</>
                )}
              </button>
              <button type="button" onClick={openBuyNowModal} className="product-buy-btn" disabled={!canAddToBag}>
                <Icon icon="lucide:zap" /> BUY NOW
              </button>
            </div>

            {pageCoupons.length > 0 && (
              <div className="product-special-offers">
                <h4 className="product-special-offers-title">
                  <Icon icon="lucide:tag" /> SPECIAL OFFERS FOR YOU 🔥
                </h4>
                <div className="product-offers-list">
                  {pageCoupons.map((coupon) => (
                    <div key={coupon.id || coupon.code} className="product-offer-card">
                      <Icon icon={coupon.discount_type === "free_shipping" ? "lucide:truck" : coupon.discount_type === "wallet" ? "lucide:wallet" : "lucide:percent"} />
                      <div className="product-offer-card-body">
                        <strong>{coupon.description || coupon.name || coupon.title}</strong>
                        {coupon.code && <span>Code: <em>{coupon.code}</em></span>}
                      </div>
                      {coupon.code && (
                        <button
                          type="button"
                          className="product-offer-copy"
                          onClick={() => copyCouponCode(coupon.code)}
                          aria-label={`Copy coupon code ${coupon.code}`}
                          title="Copy code"
                        >
                          <Icon icon="lucide:copy" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </section>
        </div>

        <div className="product-sections-grid">
          <div className="product-section-card">
            <h3 className="product-section-title">KEY HIGHLIGHTS</h3>
            <ul className="product-highlights-list">
              {Array.isArray(product.key_highlights) && product.key_highlights.length > 0
                ? product.key_highlights.map((text) => (
                    <li key={text}><Icon icon="lucide:check-circle" /><span>{text}</span></li>
                  ))
                : [
                    product.Variety?.name ? { icon: "lucide:sparkles", text: `Rich ${product.Variety.name} Weaving` } : null,
                    product.Material?.name ? { icon: "lucide:layers", text: `Premium ${product.Material.name} Fabric` } : null,
                    product.Occasion?.name ? { icon: "lucide:calendar-check", text: `Perfect for ${product.Occasion.name}` } : null,
                    product.blouse_piece ? { icon: "lucide:shirt", text: "Blouse Piece Included" } : null,
                    { icon: "lucide:gift", text: "Premium Gift Packaging" },
                    { icon: "lucide:map-pin", text: "Made in Banaras" },
                  ].filter(Boolean).map(({ icon, text }) => (
                    <li key={text}><Icon icon={icon} /><span>{text}</span></li>
                  ))
              }
            </ul>
          </div>

          <div className="product-section-card">
            <h3 className="product-section-title">PRODUCT DESCRIPTION</h3>
            <p className="product-section-text">
              {product.description || product.short_description || "Product description will be updated soon."}
            </p>
          </div>

          <div className="product-section-card">
            <h3 className="product-section-title">MATERIAL &amp; SPECIFICATIONS</h3>
            <div className="product-spec-grid">
              {specificationRows.map(([label, value]) => (
                <div className="product-spec-row" key={label}>
                  <span>{label}</span>
                  <strong className={label === "Care" ? "product-spec-care" : ""}>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="product-section-card product-shipping-card">
            <h3 className="product-section-title">SHIPPING &amp; RETURNS</h3>
            <div className="product-shipping-summary">
              {SHIPPING_RETURN_HIGHLIGHTS.map(({ icon, title, text }) => (
                <div className="product-shipping-item" key={title}>
                  <Icon icon={icon} />
                  <p>
                    <strong>{title}</strong>
                    {text && <span>{text}</span>}
                  </p>
                </div>
              ))}
            </div>
            <Link to="/shipping-policy" className="product-shipping-link">
              Know more about <span>Shipping &amp; Returns</span>
              <Icon icon="lucide:chevron-right" />
            </Link>
          </div>
        </div>

        {productReviews.length > 0 && (
          <section className="product-reviews-section" id="product-reviews">
            <div className="product-reviews-head">
              <div>
                <span>customer feedback</span>
                <h2>reviews</h2>
              </div>
              {Number(reviewSummary.count || 0) > 0 && (
                <div className="product-review-score">
                  <strong>{Number(reviewSummary.average || 0).toFixed(1)}</strong>
                  <span className="product-review-score-stars" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const average = Number(reviewSummary.average || 0);
                      return (
                        <Icon key={star} icon={average >= star ? "mdi:star" : average >= star - 0.5 ? "mdi:star-half-full" : "mdi:star-outline"} />
                      );
                    })}
                  </span>
                  <small>{reviewSummary.count} {Number(reviewSummary.count) === 1 ? "review" : "reviews"}</small>
                </div>
              )}
            </div>

            <div className="product-review-list">
              {productReviews.slice(0, 3).map((review) => {
                const rating = Number(review.rating || 0);
                return (
                  <article className="product-review-card" key={review.id}>
                    <div className="product-review-card-head">
                      <div className="product-review-stars">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Icon key={star} icon={rating >= star ? "mdi:star" : "mdi:star-outline"} />
                        ))}
                      </div>
                      <div className="product-review-buyer">
                        <span>{review.Customer?.name || "verified customer"}</span>
                        <small><Icon icon="lucide:badge-check" /> verified buyer</small>
                      </div>
                    </div>
                    {review.title && <h3>{review.title}</h3>}
                    <p>{review.comment}</p>
                    {Array.isArray(review.images) && review.images.length > 0 && (
                      <div className="product-review-images">
                        {review.images.slice(0, 4).map((image, index) => {
                          const remaining = review.images.length - 4;
                          const showMore = index === 3 && remaining > 0;
                          return (
                            <button
                              type="button"
                              key={`${image.url}-${index}`}
                              aria-label={showMore ? `view ${remaining} more review images` : "view review image"}
                              onClick={() => {
                                const galleryIndex = approvedReviewImages.findIndex((g) => g.url === image.url);
                                setReviewGalleryIndex(galleryIndex >= 0 ? galleryIndex : 0);
                              }}
                            >
                              <img src={imgUrl(image.url, 160)} alt="" loading="lazy" />
                              {showMore && <span className="product-review-image-more">+{remaining}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {productReviews.length > 3 && (
              <div className="product-reviews-more-wrap">
                <button
                  type="button"
                  className="product-reviews-more-btn"
                  onClick={() => setReviewModalOpen(true)}
                >
                  more reviews
                </button>
              </div>
            )}
          </section>
        )}

        {products.length > 0 && (
          <section className="product-related">
            <div className="product-related-head">
              <h2>More Products</h2>
            </div>
            <div className="product-related-grid" ref={relatedGridRef}>
              {products.slice(0, 20).map((item, index) => {
                const images = getSortedImages(item);
                const fallbackImage = getProductCoverImage(item, "https://via.placeholder.com/500x650?text=Banarasi+Kala");
                const slideImages = images.length ? images : [{ url: fallbackImage }];
                const activeSlide = Math.min(relatedActiveSlides[item.id] || 0, slideImages.length - 1);
                const hasDiscount = Number(item.mrp_price || 0) > Number(item.selling_price || 0);
                const relatedProductName = item.name;
                const relatedDescription =
                  item.short_description ||
                  item.description ||
                  [item.Variety?.name, item.Material?.name].filter(Boolean).join(" ");
                const relatedDiscountPercent = Number(item.discount_percent || (
                  hasDiscount
                    ? Math.round(((Number(item.mrp_price) - Number(item.selling_price)) / Number(item.mrp_price)) * 100)
                    : 0
                ));
                const relatedColorId = slideImages[activeSlide]?.color_id || item.selected_color_id || null;
                const relatedLiked = isInWishlist(item.id, relatedColorId);

                return (
                  <Link
                    key={item.id}
                    to={`/product/${item.slug}`}
                    className="product-related-card"
                    style={{ transitionDelay: `${Math.min(index * 40, 200)}ms` }}
                    onMouseEnter={() => setRelatedHoverId(item.id)}
                    onMouseLeave={() => {
                      setRelatedHoverId((current) => (current === item.id ? null : current));
                    }}
                    onTouchStart={() => setRelatedHoverId(item.id)}
                    onClick={(event) => {
                      if (relatedSwipeBlockRef.current.has(item.id)) {
                        event.preventDefault();
                        event.stopPropagation();
                      }
                    }}
                  >
                    <div
                      className="product-related-media"
                      onTouchStart={(event) => handleRelatedSwipeStart(event, item.id)}
                      onTouchMove={(event) => handleRelatedSwipeMove(event, item.id)}
                      onTouchEnd={(event) => handleRelatedSwipeEnd(event, item.id, slideImages.length)}
                    >
                      <div
                        className="product-related-track"
                        style={{ transform: `translateX(-${activeSlide * 100}%)` }}
                      >
                        {slideImages.map((image, index) => (
                          <img key={`${item.id}-${image.url}-${index}`} src={imgUrl(image.url, 600)} alt={index === 0 ? relatedProductName : ""} />
                        ))}
                      </div>
                      {slideImages.length > 1 && (
                        <div className="product-related-dots">
                          {slideImages.map((image, index) => (
                            <button
                              type="button"
                              key={`${image.url}-dot-${index}`}
                              className={index === activeSlide ? "active" : ""}
                              onClick={(event) => goToRelatedSlide(event, item.id, index)}
                              aria-label={`Show ${relatedProductName} image ${index + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="product-related-body">
                      <h3>{relatedProductName}</h3>
                      {relatedDescription && (
                        <p className="product-related-desc">{relatedDescription}</p>
                      )}
                      <ProductRating product={item} className="product-related-rating" />
                      <div className="product-related-price">
                        <div className="product-related-price-main">
                          {hasDiscount && relatedDiscountPercent > 0 && (
                            <em>-{relatedDiscountPercent}%</em>
                          )}
                          <strong>{formatMoney(item.selling_price)}</strong>
                        </div>
                        {hasDiscount && <span className="product-related-mrp"><span className="product-related-mrp-val">{formatMoney(item.mrp_price)}</span></span>}
                      </div>
                      <DeliveryBadge processingDays={item.processing_days} />
                      <button
                        type="button"
                        className="product-related-atc-btn"
                        onClick={(e) => handleRelatedAddToCart(e, item)}
                      >
                        Add to Cart
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="product-related-view-all-wrap">
              <Link to="/collection" className="product-related-view-all" aria-label="View all products">
                <span>View All</span>
                <Icon icon="lucide:arrow-right" />
              </Link>
            </div>
          </section>
        )}
      </main>

      {reviewGalleryIndex !== null && approvedReviewImages[reviewGalleryIndex] && (
        <div className="product-review-lightbox" role="dialog" aria-modal="true" onClick={() => setReviewGalleryIndex(null)}>
          <button type="button" className="review-lightbox-close" onClick={() => setReviewGalleryIndex(null)} aria-label="Close review image">
            <Icon icon="lucide:x" />
          </button>
          <img
            src={imgUrl(approvedReviewImages[reviewGalleryIndex].url, 1200)}
            alt="Uploaded product photo"
            onClick={(event) => event.stopPropagation()}
          />
          {approvedReviewImages.length > 1 && (
            <button
              type="button"
              className="review-lightbox-nav prev"
              onClick={(event) => {
                event.stopPropagation();
                setReviewGalleryIndex((current) => (current <= 0 ? approvedReviewImages.length - 1 : current - 1));
              }}
              aria-label="Previous review image"
            >
              <Icon icon="lucide:chevron-left" />
            </button>
          )}
          {approvedReviewImages.length > 1 && (
            <button
              type="button"
              className="review-lightbox-nav next"
              onClick={(event) => {
                event.stopPropagation();
                setReviewGalleryIndex((current) => (current >= approvedReviewImages.length - 1 ? 0 : current + 1));
              }}
              aria-label="Next review image"
            >
              <Icon icon="lucide:chevron-right" />
            </button>
          )}
          <span className="review-lightbox-count">{reviewGalleryIndex + 1} / {approvedReviewImages.length}</span>
        </div>
      )}

      {reviewModalOpen && (
        <div className="product-reviews-modal-overlay" role="dialog" aria-modal="true" onClick={() => setReviewModalOpen(false)}>
          <div className="product-reviews-modal" onClick={(e) => e.stopPropagation()}>
            <div className="product-reviews-modal-head">
              <h2>all reviews <small>({productReviews.length})</small></h2>
              <button type="button" className="product-reviews-modal-close" onClick={() => setReviewModalOpen(false)} aria-label="Close reviews">
                <Icon icon="lucide:x" />
              </button>
            </div>
            <div className="product-reviews-modal-body">
              {productReviews.map((review) => {
                const rating = Number(review.rating || 0);
                return (
                  <article className="product-review-card" key={review.id}>
                    <div className="product-review-card-head">
                      <div className="product-review-stars">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Icon key={star} icon={rating >= star ? "mdi:star" : "mdi:star-outline"} />
                        ))}
                      </div>
                      <div className="product-review-buyer">
                        <span>{review.Customer?.name || "verified customer"}</span>
                        <small><Icon icon="lucide:badge-check" /> verified buyer</small>
                      </div>
                    </div>
                    {review.title && <h3>{review.title}</h3>}
                    <p>{review.comment}</p>
                    {Array.isArray(review.images) && review.images.length > 0 && (
                      <div className="product-review-images">
                        {review.images.slice(0, 4).map((image, index) => {
                          const remaining = review.images.length - 4;
                          const showMore = index === 3 && remaining > 0;
                          return (
                            <button
                              type="button"
                              key={`${image.url}-${index}`}
                              aria-label={showMore ? `view ${remaining} more review images` : "view review image"}
                              onClick={() => {
                                const galleryIndex = approvedReviewImages.findIndex((g) => g.url === image.url);
                                setReviewModalOpen(false);
                                setReviewGalleryIndex(galleryIndex >= 0 ? galleryIndex : 0);
                              }}
                            >
                              <img src={imgUrl(image.url, 160)} alt="" loading="lazy" />
                              {showMore && <span className="product-review-image-more">+{remaining}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {buyNowOpen && (
        <>
        <div className="checkout-page relative min-h-screen flex flex-col bg-[#F5F1E8]">
          <main className="flex-grow">
            <div className="checkout-page-shell w-full">
              <CheckoutFlow
                selectedItems={buyNowItems}
                onExit={closeBuyNowModal}
                couponOverride={{
                  appliedCoupon: appliedBuyNowCoupon,
                  discountAmount: buyNowCouponDiscount,
                  applyCoupon: (code) => applyBuyNowCoupon(code),
                  removeCoupon: removeBuyNowCoupon,
                  coupons: availableCoupons,
                  loading: couponLoading,
                }}
              />
            </div>
          </main>
        </div>
        {false && (
        <div className="buy-now-modal" role="dialog" aria-modal="true" aria-label="Buy now checkout">
          <div className={`buy-now-card ${buyNowStep === "payment" ? "is-payment" : "is-details"}`}>
            <div className="buy-now-header">
              <div>
                <span>Buy Now</span>
                <h2>Complete your order</h2>
              </div>
              <button type="button" onClick={closeBuyNowModal} aria-label="Close buy now" disabled={buyNowPlacing}>
                <Icon icon="lucide:x" />
              </button>
            </div>

            <div className="buy-now-content">
              <CheckoutOrderPanel
                step={buyNowStep === "payment" ? "review" : "details"}
                addresses={buyNowAddresses}
                selectedAddressId={selectedBuyNowAddressId}
                onSelectAddress={(address) => setSelectedBuyNowAddressId(String(address.id))}
                onAddAddress={() => openBuyNowAddressModal()}
                onEditAddress={editBuyNowAddress}
                onDeleteAddress={deleteBuyNowAddress}
                deletingAddressId={buyNowDeletingAddressId}
                getAddressLine={getAddressLine}
                user={user}
                addressLoading={buyNowLoading}
                emptyAddressIcon="lucide:map-pin-off"
                emptyAddressText="Add a delivery address to continue checkout."
                paymentOptions={[
                  {
                    id: "prepaid",
                    icon: "lucide:shield-check",
                    title: "Online Payment",
                    description: `${formatMoney(PREPAID_DISCOUNT_AMOUNT)} extra off`,
                    active: buyNowPayment === "prepaid",
                    disabled: !canUsePrepaid,
                    onSelect: () => setBuyNowPayment("prepaid"),
                  },
                  {
                    id: "cod",
                    icon: "lucide:banknote",
                    title: "Cash on Delivery",
                    description: canUseCod ? `${formatMoney(COD_FEE_AMOUNT)} COD charge` : `Not available above ${formatMoney(COD_MAX_AMOUNT)}`,
                    active: buyNowPayment === "cod",
                    disabled: !canUseCod,
                    onSelect: () => setBuyNowPayment("cod"),
                  },
                ]}
                deliveryError={buyNowShipping?.unavailable ? (buyNowShipping.message || "Delivery is not possible at this location right now.") : null}
                reviewTitle="Review details"
                reviewItems={[{
                  key: product.id,
                  image: mainImage,
                  name: productName,
                  meta: `Qty ${quantity} × ${formatMoney(Number(product.selling_price || 0))}`,
                  total: formatMoney(buyNowSubtotal),
                }]}
                reviewAddress={{
                  name: selectedBuyNowAddress?.name || user?.name,
                  line: getAddressLine(selectedBuyNowAddress),
                  phone: selectedBuyNowAddress?.phone || user?.phone,
                }}
                reviewPayment={{
                  title: buyNowPayment === "cod" ? "Cash on Delivery" : "Online Payment",
                  description: buyNowPayment === "cod" ? "Pay when your order is delivered." : "Pay securely using Razorpay.",
                }}
                onEditDetails={() => setBuyNowStep("details")}
                showSummary
                summaryProps={{
                  title: "Order Summary",
                  items: [{
                    key: product.id,
                    image: mainImage,
                    name: productName,
                    meta: `${selectedColor?.name ? `${selectedColor.name} · ` : ""}${quantity} × ${formatMoney(Number(product.selling_price || 0))}`,
                    total: formatMoney(buyNowSubtotal),
                  }],
                  coupons: availableCoupons,
                  appliedCoupon: appliedBuyNowCoupon,
                  couponDiscount: buyNowCouponDiscount,
                  couponCode,
                  setCouponCode,
                  couponLoading,
                  onApplyCoupon: (couponOrCode) => applyBuyNowCoupon(typeof couponOrCode === "object" ? couponOrCode?.code : couponOrCode),
                  onRemoveCoupon: removeBuyNowCoupon,
                  walletBalance,
                  useWallet,
                  setUseWallet,
                  rows: [
                    { label: "Product total", value: formatMoney(buyNowSubtotal) },
                    { label: "Free delivery charge", value: buyNowShippingLoading ? "Checking..." : buyNowShipping?.unavailable ? "Unavailable" : <><s>{formatMoney(buyNowShippingRate)}</s> Free</>, tone: "success" },
                    ...(buyNowPaymentDiscount > 0 ? [{ label: "Prepaid payment discount", value: `-${formatMoney(buyNowPaymentDiscount)}`, tone: "success" }] : []),
                    ...(buyNowPaymentFee > 0 ? [{ label: "COD charge", value: formatMoney(buyNowPaymentFee), tone: "accent" }] : []),
                    { label: "Platform fee", value: formatMoney(buyNowPlatformFee) },
                    ...(buyNowCouponDiscount > 0 ? [{ label: "Coupon discount", value: `-${formatMoney(buyNowCouponDiscount)}`, tone: "success" }] : []),
                    ...(walletUsableAmount > 0 ? [{ label: "Wallet used", value: `-${formatMoney(walletUsableAmount)}`, tone: "success" }] : []),
                  ],
                  deliveryPromise: buyNowShipping?.deliveryDate ? {
                    title: `Arriving ${formatDeliveryDate(buyNowShipping.deliveryDate)}`,
                    subtitle: "Free standard delivery",
                    tooltip: "This is an estimated delivery date. It may change based on courier availability and your location.",
                  } : null,
                  logistics: buyNowShipping && !buyNowShipping.unavailable ? {
                    label: "Returns & exchange available",
                    tooltip: shippingDiscountReasonCode === "first_order"
                      ? "Return and exchange are available. For your first order, delivery charge will not be deducted."
                      : `Return and exchange are available. On return, refund may deduct ${formatMoney(buyNowReturnDeliveryDeduction)} delivery charge.`,
                  } : null,
                  totalLabel: "Final amount",
                  total: buyNowTotal,
                  formatMoney,
                  action: {
                    label: buyNowStep === "details"
                      ? (buyNowShippingLoading ? "Checking delivery..." : "Continue")
                      : (buyNowPlacing ? "Processing..." : buyNowPayment === "cod" ? "Place COD Order" : "Pay & Place Order"),
                    onClick: buyNowStep === "details" ? proceedToFinalPayment : placeBuyNowOrder,
                    disabled: buyNowStep === "details"
                      ? (buyNowLoading || buyNowShippingLoading || !selectedBuyNowAddress || !buyNowShipping || buyNowShipping?.unavailable)
                      : (buyNowLoading || buyNowShippingLoading || buyNowPlacing || !selectedBuyNowAddress || !buyNowShipping || buyNowShipping?.unavailable),
                  },
                  couponModalOpen: buyNowCouponModalOpen,
                  setCouponModalOpen: setBuyNowCouponModalOpen,
                  couponCodeOpen: buyNowCouponPanelOpen,
                  setCouponCodeOpen: setBuyNowCouponPanelOpen,
                  couponCelebration,
                }}
              />
              {false && (
              <>
              {buyNowStep === "details" ? (
                <>
              <section className="buy-now-section">
                <div className="buy-now-section-title">
                  <h3>Delivery address</h3>
                  <button type="button" onClick={() => openBuyNowAddressModal()}>
                    <Icon icon="lucide:plus" />
                    Add new
                  </button>
                </div>

                {buyNowLoading && !buyNowAddresses.length ? (
                  <p className="buy-now-muted">Loading saved addresses...</p>
                ) : buyNowAddresses.length === 0 ? (
                  <div className="buy-now-no-address">
                    <Icon icon="lucide:map-pin-off" />
                    <strong>No saved address</strong>
                    <p>Add a delivery address to continue checkout.</p>
                    <button type="button" onClick={() => openBuyNowAddressModal()}>
                      <Icon icon="lucide:plus" />
                      Add new address
                    </button>
                  </div>
                ) : (
                  <div className="buy-now-address-list">
                    {buyNowAddresses.map((address) => (
                      <label key={address.id} className={`buy-now-address ${String(selectedBuyNowAddressId) === String(address.id) ? "active" : ""}`}>
                        <input
                          type="radio"
                          name="buy_now_address"
                          checked={String(selectedBuyNowAddressId) === String(address.id)}
                          onChange={() => setSelectedBuyNowAddressId(String(address.id))}
                        />
                        <span>
                          <strong>{address.label || "Address"} {address.is_default ? <em>Default</em> : null}</strong>
                          <small>{getAddressLine(address)}</small>
                          <small>{address.name || user?.name} • {address.phone || user?.phone}</small>
                        </span>
                        <button type="button" onClick={(event) => {
                          event.preventDefault();
                          editBuyNowAddress(address);
                        }}>
                          Edit
                        </button>
                      </label>
                    ))}
                  </div>
                )}
              </section>

              <section className="buy-now-section">
                <div className="buy-now-section-title">
                  <h3>Payment</h3>
                </div>
                <div className="buy-now-payment-grid">
                  <button
                    type="button"
                    className={buyNowPayment === "prepaid" ? "active" : ""}
                    onClick={() => setBuyNowPayment("prepaid")}
                    disabled={!canUsePrepaid}
                  >
                    <Icon icon="lucide:credit-card" />
                    <span>Prepaid Razorpay</span>
                    <small>{formatMoney(PREPAID_DISCOUNT_AMOUNT)} extra off</small>
                  </button>
                  <button
                    type="button"
                    className={buyNowPayment === "cod" ? "active" : ""}
                    onClick={() => setBuyNowPayment("cod")}
                    disabled={!canUseCod}
                  >
                    <Icon icon="lucide:banknote" />
                    <span>Cash on Delivery</span>
                    <small>{canUseCod ? `${formatMoney(COD_FEE_AMOUNT)} COD charge` : `Not available above ${formatMoney(COD_MAX_AMOUNT)}`}</small>
                  </button>
                </div>
              </section>

              {buyNowShipping?.unavailable && (
                <div className="buy-now-delivery-error" role="status">
                  <Icon icon="lucide:map-pin-off" />
                  <span>{buyNowShipping.message || "Delivery is not possible at this location right now."}</span>
                </div>
              )}

              <button
                type="button"
                className="buy-now-proceed"
                onClick={proceedToFinalPayment}
                disabled={buyNowLoading || buyNowShippingLoading || !selectedBuyNowAddress || !buyNowShipping || buyNowShipping?.unavailable}
              >
                {buyNowShippingLoading ? "Checking delivery..." : "Proceed"}
              </button>
                </>
              ) : (
                <>
              <section className="buy-now-section">
                <div className="buy-now-section-title">
                  <h3>Review details</h3>
                  <button type="button" onClick={() => setBuyNowStep("details")}>
                    <Icon icon="lucide:arrow-left" />
                    Back
                  </button>
                </div>
                <div className="buy-now-review-card">
                  <span>Deliver to</span>
                  <strong>{selectedBuyNowAddress?.name || user?.name}</strong>
                  <p>{getAddressLine(selectedBuyNowAddress)}</p>
                  <small>{selectedBuyNowAddress?.phone || user?.phone}</small>
                </div>
                <div className="buy-now-review-card">
                  <span>Payment method</span>
                  <strong>{buyNowPayment === "cod" ? "Cash on Delivery" : "Prepaid Razorpay"}</strong>
                  <p>{buyNowPayment === "cod" ? "Pay when your order is delivered." : "Pay securely online."}</p>
                </div>
              </section>

              <section className="buy-now-section buy-now-final-section">
                <CheckoutReviewSummary
                  title=""
                  items={[{
                    key: product.id,
                    image: mainImage,
                    name: productName,
                    meta: `${selectedColor?.name ? `${selectedColor.name} - ` : ""}Qty ${quantity}${selectedSku ? ` - SKU: ${selectedSku}` : ""}`,
                    total: formatMoney(buyNowSubtotal),
                  }]}
                  coupons={availableCoupons}
                  appliedCoupon={appliedBuyNowCoupon}
                  couponDiscount={buyNowCouponDiscount}
                  couponCode={couponCode}
                  setCouponCode={setCouponCode}
                  couponLoading={couponLoading}
                  onApplyCoupon={(couponOrCode) => applyBuyNowCoupon(typeof couponOrCode === "object" ? couponOrCode?.code : couponOrCode)}
                  onRemoveCoupon={removeBuyNowCoupon}
                  walletBalance={walletBalance}
                  useWallet={useWallet}
                  setUseWallet={setUseWallet}
                  rows={[
                    { label: "Product total", value: formatMoney(buyNowSubtotal) },
                    { label: "Free delivery charge", value: buyNowShippingLoading ? "Checking..." : buyNowShipping?.unavailable ? "Unavailable" : <><s>{formatMoney(buyNowShippingRate)}</s> Free</>, tone: "success" },
                    ...(buyNowPaymentDiscount > 0 ? [{ label: "Prepaid payment discount", value: `-${formatMoney(buyNowPaymentDiscount)}`, tone: "success" }] : []),
                    ...(buyNowPaymentFee > 0 ? [{ label: "COD charge", value: formatMoney(buyNowPaymentFee), tone: "accent" }] : []),
                    { label: "Platform fee", value: formatMoney(buyNowPlatformFee) },
                    ...(buyNowCouponDiscount > 0 ? [{ label: "Coupon discount", value: `-${formatMoney(buyNowCouponDiscount)}`, tone: "success" }] : []),
                    ...(walletUsableAmount > 0 ? [{ label: "Wallet used", value: `-${formatMoney(walletUsableAmount)}`, tone: "success" }] : []),
                  ]}
                  deliveryPromise={buyNowShipping?.deliveryDate ? {
                    title: `Arriving ${formatDeliveryDate(buyNowShipping.deliveryDate)}`,
                    subtitle: "Free standard delivery",
                    tooltip: "This is an estimated delivery date. It may change based on courier availability and your location.",
                  } : null}
                  logistics={buyNowShipping && !buyNowShipping.unavailable ? {
                    label: "Returns & exchange available",
                    tooltip: shippingDiscountReasonCode === "first_order"
                      ? "Return and exchange are available. For your first order, delivery charge will not be deducted."
                      : `Return and exchange are available. On return, refund may deduct ${formatMoney(buyNowReturnDeliveryDeduction)} delivery charge.`,
                  } : null}
                  totalLabel="Final amount"
                  total={buyNowTotal}
                  formatMoney={formatMoney}
                  action={{
                    label: buyNowPlacing ? "Processing..." : "Place Order",
                    onClick: placeBuyNowOrder,
                    disabled: buyNowLoading || buyNowShippingLoading || buyNowPlacing || !selectedBuyNowAddress || !buyNowShipping || buyNowShipping?.unavailable,
                  }}
                  couponModalOpen={buyNowCouponModalOpen}
                  setCouponModalOpen={setBuyNowCouponModalOpen}
                  couponCodeOpen={buyNowCouponPanelOpen}
                  setCouponCodeOpen={setBuyNowCouponPanelOpen}
                  couponCelebration={couponCelebration}
                />
              </section>
                </>
              )}
              </>
              )}
            </div>
            {buyNowProcessing && (
              <div className="buy-now-processing-overlay">
                <div className="buy-now-processing-card">
                  <span className="buy-now-processing-spinner" />
                  <strong>Processing your payment…</strong>
                  <p>Please wait, do not close this page.</p>
                </div>
              </div>
            )}
          </div>
          {buyNowAddressModalOpen && (
            <div className="buy-now-address-modal" role="dialog" aria-modal="true" aria-label={editingBuyNowAddressId ? "Edit address" : "Add new address"}>
              <div className="buy-now-address-modal-card">
                <button type="button" className="buy-now-address-modal-close" onClick={closeBuyNowAddressModal} aria-label="Close address form">
                  <Icon icon="lucide:x" />
                </button>
                <div className="buy-now-section-title buy-now-address-modal-title">
                  <h3>{editingBuyNowAddressId ? "Edit address" : "Add new address"}</h3>
                  <span>Required fields are marked with *.</span>
                </div>

                <div className="buy-now-location-card">
                  <div>
                    <span>Map address</span>
                    {buyNowAddressForm.map_address ? (
                      <>
                        <strong>{buyNowAddressForm.map_address}</strong>
                        <p>Saved separately from the address you type below.</p>
                      </>
                    ) : (
                      <p>No map location selected.</p>
                    )}
                  </div>
                  <div className="buy-now-location-actions">
                    <button type="button" onClick={() => setBuyNowMapOpen(true)}>
                      <Icon icon="lucide:map-pinned" />
                      {buyNowAddressForm.map_address ? "Change map location" : "Add map location"}
                    </button>
                    {buyNowAddressForm.map_address ? (
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => setBuyNowAddressForm((current) => ({ ...current, map_address: "", map_lat: "", map_lng: "" }))}
                      >
                        <Icon icon="lucide:x" />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>

                {showBuyNowAddressForm && (
                  <div className="buy-now-address-form">
                    <div className="buy-now-form-row">
                      <label>
                        <span>Label</span>
                        <select name="label" value={buyNowAddressForm.label} onChange={handleBuyNowAddressChange}>
                          <option>Home</option>
                          <option>Work</option>
                          <option>Other</option>
                        </select>
                      </label>
                      <label>
                        <span>Receiver name</span>
                        <input name="name" value={buyNowAddressForm.name} onChange={handleBuyNowAddressChange} />
                      </label>
                    </div>
                    <label>
                      <span>Flat, House no., Building *</span>
                      <input name="house_building" value={buyNowAddressForm.house_building} onChange={handleBuyNowAddressChange} />
                      {buyNowAddrFormErrors.house_building && <em className="buy-now-field-error">{buyNowAddrFormErrors.house_building}</em>}
                    </label>
                    <label>
                      <span>Area, Street, Sector</span>
                      <input name="area_street" value={buyNowAddressForm.area_street} onChange={handleBuyNowAddressChange} />
                    </label>
                    <div className="buy-now-form-row">
                      <label>
                        <span>City *</span>
                        <input name="city" value={buyNowAddressForm.city} onChange={handleBuyNowAddressChange} />
                        {buyNowAddrFormErrors.city && <em className="buy-now-field-error">{buyNowAddrFormErrors.city}</em>}
                      </label>
                      <label>
                        <span>State *</span>
                        <input name="state" value={buyNowAddressForm.state} onChange={handleBuyNowAddressChange} />
                        {buyNowAddrFormErrors.state && <em className="buy-now-field-error">{buyNowAddrFormErrors.state}</em>}
                      </label>
                    </div>
                    <div className="buy-now-form-row">
                      <label>
                        <span>Pincode *</span>
                        <input name="pincode" inputMode="numeric" value={buyNowAddressForm.pincode} onChange={handleBuyNowAddressChange} />
                        {buyNowAddrFormErrors.pincode && <em className="buy-now-field-error">{buyNowAddrFormErrors.pincode}</em>}
                      </label>
                      <label>
                        <span>Phone *</span>
                        <div className="buy-now-phone-input">
                          <span className="buy-now-country-code"><span className="buy-now-flag-india" aria-hidden="true" />+91</span>
                          <input name="phone" inputMode="tel" maxLength={10} placeholder="10-digit mobile number" value={buyNowAddressForm.phone} onChange={handleBuyNowAddressChange} />
                        </div>
                        {buyNowAddrFormErrors.phone && <em className="buy-now-field-error">{buyNowAddrFormErrors.phone}</em>}
                      </label>
                    </div>
                    <label>
                      <span>Landmark</span>
                      <input name="landmark" value={buyNowAddressForm.landmark} onChange={handleBuyNowAddressChange} />
                    </label>
                    <label className="buy-now-checkbox">
                      <input type="checkbox" name="is_default" checked={buyNowAddressForm.is_default} onChange={handleBuyNowAddressChange} />
                      <span>Set as default address</span>
                    </label>
                    <div className="buy-now-form-actions">
                      <button type="button" onClick={closeBuyNowAddressModal} disabled={buyNowLoading}>
                        Cancel
                      </button>
                      <button type="button" onClick={saveBuyNowAddress} disabled={buyNowLoading}>
                        {buyNowLoading ? "Saving..." : "Save address"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        )}
        </>
      )}
      <LocationPickerModal
        open={buyNowMapOpen}
        initialQuery={[buyNowAddressForm.house_building, buyNowAddressForm.city, buyNowAddressForm.state].filter(Boolean).join(", ")}
        onClose={() => setBuyNowMapOpen(false)}
        onConfirm={confirmBuyNowLocation}
      />

      {/* ── Fullscreen overlay ── */}
      {fullscreenOpen && (() => {
        const fsMedia = visibleMedia[fullscreenIdx];
        fsIsVideoRef.current = fsMedia?.type === "video";
        const isZoomed = fsIsZoomed;

        const resetZoom = () => {
          fsZoomPanRef.current = { zoom: 1, pan: { x: 0, y: 0 } };
          if (fsImageRef.current) fsImageRef.current.style.transform = "";
          setFsIsZoomed(false);
        };

        const clampPan = (pan, zoom) => {
          const el = fsMainRef.current;
          if (!el || zoom <= 1) return { x: 0, y: 0 };
          const maxX = el.clientWidth * (zoom - 1) / 2;
          const maxY = el.clientHeight * (zoom - 1) / 2;
          return {
            x: Math.max(-maxX, Math.min(maxX, pan.x)),
            y: Math.max(-maxY, Math.min(maxY, pan.y)),
          };
        };

        const pauseFsVideo = () => {
          if (fsPlayerRef.current) { try { fsPlayerRef.current.pause(); } catch {} }
        };
        const navigateFsPrev = () => {
          if (visibleMedia.length <= 1) return;
          pauseFsVideo();
          resetZoom();
          setFullscreenIdx((fullscreenIdx - 1 + visibleMedia.length) % visibleMedia.length);
        };
        const navigateFsNext = () => {
          if (visibleMedia.length <= 1) return;
          pauseFsVideo();
          resetZoom();
          setFullscreenIdx((fullscreenIdx + 1) % visibleMedia.length);
        };
        fsHandlersRef.current = { prev: navigateFsPrev, next: navigateFsNext };

        // ── Zoom: double-click (anchor to container center, not image center) ──
        const handleFsDoubleClick = (e) => {
          e.stopPropagation();
          if (isZoomed) { resetZoom(); return; }
          const ZOOM = 2.5;
          const rect = fsMainRef.current?.getBoundingClientRect();
          if (!rect) { fsZoomPanRef.current = { zoom: ZOOM, pan: { x: 0, y: 0 } }; applyFsTransform(); setFsIsZoomed(true); return; }
          const ex = e.clientX - (rect.left + rect.width / 2);
          const ey = e.clientY - (rect.top + rect.height / 2);
          const newPan = clampPan({ x: -ex * (ZOOM - 1), y: -ey * (ZOOM - 1) }, ZOOM);
          fsZoomPanRef.current = { zoom: ZOOM, pan: newPan };
          applyFsTransform();
          setFsIsZoomed(true);
        };

        // ── Drag to pan (mouse) ──
        const handleFsMouseDown = (e) => {
          if (!isZoomed) return;
          e.preventDefault();
          const { pan } = fsZoomPanRef.current;
          fsDragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
        };
        const handleFsMouseMove = (e) => {
          if (!fsDragRef.current.dragging) return;
          const { zoom } = fsZoomPanRef.current;
          const raw = {
            x: fsDragRef.current.panX + e.clientX - fsDragRef.current.startX,
            y: fsDragRef.current.panY + e.clientY - fsDragRef.current.startY,
          };
          const clamped = clampPan(raw, zoom);
          fsZoomPanRef.current = { zoom, pan: clamped };
          applyFsTransform();
        };
        const handleFsMouseUp = () => { fsDragRef.current.dragging = false; };

        // ── Touch: swipe (not zoomed) + pan (zoomed) + pinch ──
        const handleFsTouchStart = (e) => {
          if (e.touches.length === 2) {
            const { zoom, pan } = fsZoomPanRef.current;
            fsPinchRef.current = {
              active: true,
              startDist: Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY),
              startZoom: zoom,
              startPan: { ...pan },
              midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
              midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            };
            fsSwipeRef.current.dragging = false;
            fsDragRef.current.dragging = false;
            return;
          }
          const t = e.touches[0];
          // Don't treat interactions with the video's Plyr controls as swipes.
          const onControls = !!e.target.closest?.(".plyr__controls");
          fsSwipeRef.current = { startX: t.clientX, startY: t.clientY, dragging: true, onControls };
          if (isZoomed) {
            const { pan } = fsZoomPanRef.current;
            fsDragRef.current = { dragging: true, startX: t.clientX, startY: t.clientY, panX: pan.x, panY: pan.y };
          }
        };
        const handleFsTouchMove = (e) => {
          if (e.touches.length === 2 && fsPinchRef.current.active) {
            e.preventDefault();
            const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
            const newZoom = Math.max(1, Math.min(5, fsPinchRef.current.startZoom * (dist / fsPinchRef.current.startDist)));
            const wasZoomed = fsZoomPanRef.current.zoom > 1;
            if (newZoom <= 1) { resetZoom(); return; }
            const rect = fsMainRef.current?.getBoundingClientRect();
            const zf = newZoom / fsPinchRef.current.startZoom;
            if (rect) {
              const ex = fsPinchRef.current.midX - (rect.left + rect.width / 2);
              const ey = fsPinchRef.current.midY - (rect.top + rect.height / 2);
              const raw = { x: ex * (1 - zf) + fsPinchRef.current.startPan.x * zf, y: ey * (1 - zf) + fsPinchRef.current.startPan.y * zf };
              const clamped = clampPan(raw, newZoom);
              fsZoomPanRef.current = { zoom: newZoom, pan: clamped };
              applyFsTransform();
              if (!wasZoomed) setFsIsZoomed(true);
            }
            return;
          }
          if (isZoomed && fsDragRef.current.dragging) {
            e.preventDefault();
            const t = e.touches[0];
            const { zoom } = fsZoomPanRef.current;
            const raw = {
              x: fsDragRef.current.panX + t.clientX - fsDragRef.current.startX,
              y: fsDragRef.current.panY + t.clientY - fsDragRef.current.startY,
            };
            const clamped = clampPan(raw, zoom);
            fsZoomPanRef.current = { zoom, pan: clamped };
            applyFsTransform();
          }
        };
        const handleFsTouchEnd = (e) => {
          fsPinchRef.current.active = false;
          fsDragRef.current.dragging = false;
          if (isZoomed) { fsSwipeRef.current.dragging = false; return; }
          if (!fsSwipeRef.current.dragging) return;
          fsSwipeRef.current.dragging = false;
          if (fsSwipeRef.current.onControls) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - fsSwipeRef.current.startX;
          const dy = t.clientY - fsSwipeRef.current.startY;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) navigateFsNext(); else navigateFsPrev();
          }
        };

        return (
          <div className="bk-fs-overlay" onClick={!isZoomed ? closeFullscreen : undefined}>
            <button type="button" className="bk-fs-close" onClick={closeFullscreen} aria-label="Close">
              <Icon icon="lucide:x" />
            </button>
            <div
              ref={fsMainRef}
              className={`bk-fs-main${isZoomed ? " bk-fs-zoomed" : ""}${fsMedia?.type === "video" ? " bk-fs-video-mode" : ""}`}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={fsMedia?.type !== "video" ? handleFsDoubleClick : undefined}
              onMouseDown={fsMedia?.type !== "video" ? handleFsMouseDown : undefined}
              onMouseMove={fsMedia?.type !== "video" ? handleFsMouseMove : undefined}
              onMouseUp={fsMedia?.type !== "video" ? handleFsMouseUp : undefined}
              onMouseLeave={fsMedia?.type !== "video" ? handleFsMouseUp : undefined}
              onTouchStart={handleFsTouchStart}
              onTouchMove={handleFsTouchMove}
              onTouchEnd={handleFsTouchEnd}
              style={{ touchAction: "none" }}
            >
              {fsMedia?.type === "video" ? (
                <div
                  className="bk-fs-video-wrap"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Let Plyr's own control bar handle its clicks.
                    if (e.target.closest?.(".plyr__controls")) return;
                    const player = fsPlayerRef.current;
                    if (!player) return;
                    if (player.playing) { try { player.pause(); } catch {} }
                    else player.play().catch(() => {});
                  }}
                >
                  <VideoSlide
                    key={fsMedia.url}
                    src={fsMedia.url}
                    isActive
                    activePlayerRef={fsPlayerRef}
                  />
                </div>
              ) : (
                <>
                  {!fsImageLoaded && <div className="bk-carousel-loader" aria-hidden="true" />}
                  <img
                    ref={fsImageRef}
                    src={imgUrl(fsMedia?.url, 1400)}
                    alt={productName}
                    className="bk-fs-image"
                    draggable={false}
                    onLoad={() => setFsImageLoaded(true)}
                  />
                  {isZoomed && (
                    <button type="button" className="bk-fs-zoom-reset" onClick={(e) => { e.stopPropagation(); resetZoom(); }} aria-label="Reset zoom" title="Reset zoom">
                      <Icon icon="lucide:zoom-out" />
                    </button>
                  )}
                </>
              )}
            </div>
            {/* Thumbnail strip: images + videos */}
            {visibleMedia.length > 1 && (
              <div className="bk-fs-strip" onClick={(e) => e.stopPropagation()}>
                {visibleMedia.map((item, globalIdx) => (
                  <button
                    key={item.url}
                    type="button"
                    className={`bk-fs-thumb${globalIdx === fullscreenIdx ? " active" : ""}${item.type === "video" ? " bk-fs-thumb-video" : ""}`}
                    onClick={() => { pauseFsVideo(); resetZoom(); setFullscreenIdx(globalIdx); }}
                    aria-label={item.type === "video" ? "Play video" : `Image ${globalIdx + 1}`}
                  >
                    {item.type === "video" ? (
                      <>
                        <video src={`${item.url}#t=0.1`} muted playsInline preload="metadata" tabIndex={-1} />
                        <span className="bk-fs-thumb-play-icon"><Icon icon="lucide:play" /></span>
                      </>
                    ) : (
                      <img src={imgUrl(item.url, 200)} alt="" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default ProductDetail;
