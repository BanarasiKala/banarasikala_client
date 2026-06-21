import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { imgUrl } from "../../../utils/cloudinary";
import { useAuth } from "../../../context/AuthContext";
import { useCart } from "../../../context/CartContext";
import { useWishlist } from "../../../context/WishlistContext";
import { useNotification } from "../../../context/NotificationContext";
import { API_ENDPOINTS } from "../../../config/api";
import { getProductCoverImage, getProductImages } from "../../../utils/productMedia";
import ProductRating from "../../../components/ProductRating";
import "./NewArrivals.css";

const calcDiscount = (mrp, sell) => {
  if (!mrp || !sell || Number(mrp) <= Number(sell)) return 0;
  return Math.round(((Number(mrp) - Number(sell)) / Number(mrp)) * 100);
};

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const NewArrivals = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showNotification } = useNotification();
  const sectionRef = useRef(null);
  const swipeRef = useRef({});
  const swipeBlockRef = useRef(new Set());
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSlides, setActiveSlides] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      status: "active",
      storeFrontVisibility: "true",
      newArrival: "true",
      limit: "10",
      view: "home",
    });
    fetch(`${API_ENDPOINTS.products}?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        const homeProducts = (data.items || data).slice(0, 10);
        console.log("[Home][New Arrivals] products:", homeProducts);
        console.log("[Home][New Arrivals] raw response:", data);
        setProducts(homeProducts);
      })
      .catch((err) => { if (err.name !== "AbortError") setProducts([]); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (loading || products.length === 0 || !sectionRef.current) return undefined;
    const cards = sectionRef.current.querySelectorAll(".bk-arrival-card");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: "0px 0px 220px 0px" }
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [loading, products]);

  const handleWishlistClick = (e, product, colorId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate("/wishlist"); return; }
    toggleWishlist(product, colorId || null);
  };

  const handleAddToCart = async (e, product, colorId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { showNotification("Please login to add items to bag", "info"); navigate("/login"); return; }
    const result = await addToCart(product, 1, colorId || null);
    if (result?.success) showNotification("Added to bag!", "success");
    else showNotification(result?.message || "Could not add to bag.", "error");
  };

  const goToSlide = (event, productId, slideIndex) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveSlides((current) => ({ ...current, [productId]: slideIndex }));
  };

  const blockSwipeClick = (productId) => {
    swipeBlockRef.current.add(productId);
    window.setTimeout(() => swipeBlockRef.current.delete(productId), 450);
  };

  const handleTouchStart = (event, productId) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    swipeRef.current[productId] = {
      startX: touch.clientX,
      startY: touch.clientY,
      didMove: false,
    };
  };

  const handleTouchMove = (event, productId) => {
    const touch = event.touches?.[0];
    const swipe = swipeRef.current[productId];
    if (!touch || !swipe) return;
    if (Math.abs(touch.clientX - swipe.startX) > 8) swipe.didMove = true;
  };

  const handleTouchEnd = (event, productId, imageCount) => {
    const touch = event.changedTouches?.[0];
    const swipe = swipeRef.current[productId];
    delete swipeRef.current[productId];
    if (!touch || !swipe || imageCount <= 1) return;

    const dx = touch.clientX - swipe.startX;
    const dy = touch.clientY - swipe.startY;
    const absDx = Math.abs(dx);
    if (absDx <= 40 || absDx <= Math.abs(dy)) return;

    event.preventDefault();
    event.stopPropagation();
    blockSwipeClick(productId);
    setActiveSlides((current) => {
      const idx = current[productId] || 0;
      const next = dx < 0
        ? (idx + 1) % imageCount
        : (idx - 1 + imageCount) % imageCount;
      return { ...current, [productId]: next };
    });
  };

  return (
    <section className="bk-arrivals-section" ref={sectionRef}>
      <div className="bk-arrivals-shell">
        <div className="bk-arrivals-copy">
          <span className="bk-arrivals-kicker">Fresh Drapes</span>
          <h2 id="new-arrivals-heading">New Arrivals</h2>
          <p>Freshly added sarees, ready for the first glance and the next celebration.</p>
        </div>

        <div className="bk-arrivals-products">
          {loading ? (
            <div className="bk-arrivals-rail bk-arrivals-skeleton-rail">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="bk-arrival-card bk-arrival-skeleton">
                  <div className="bk-arrival-skeleton-image" />
                  <div className="bk-arrival-info">
                    <div className="bk-arrival-skeleton-line wide" />
                    <div className="bk-arrival-skeleton-line" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bk-arrivals-empty" role="status">
              <h3>New Arrivals Coming Soon</h3>
              <p>Once fresh active stock is marked as new arrival, it will appear here.</p>
            </div>
          ) : (
            <div className="bk-arrivals-rail">
              {products.map((product, index) => {
                const sell = Number(product.selling_price || product.price);
                const mrp = Number(product.mrp_price || product.mrp || 0);
                const disc = calcDiscount(mrp, sell);
                const cover = getProductCoverImage(product);
                const cardImages = getProductImages(product);
                const sliderImages = cardImages.length > 0 ? cardImages : [{ url: cover }];
                const activeIndex = Math.min(activeSlides[product.id] || 0, sliderImages.length - 1);
                const currentColorId = sliderImages[activeIndex]?.color_id || null;
                const liked = isInWishlist(product.id, currentColorId);
                const discountPercent = Number(product.discount_percent || disc);
                const productDescription =
                  product.short_description ||
                  product.description ||
                  [product.Variety?.name, product.Material?.name].filter(Boolean).join(" ");

                return (
                  <article
                    key={product.id}
                    className="bk-arrival-card"
                    style={{ transitionDelay: `${Math.min(index * 35, 200)}ms` }}
                  >
                    <Link
                      to={`/product/${product.slug}`}
                      className="bk-arrival-link"
                      onClick={(event) => {
                        if (swipeBlockRef.current.has(product.id)) {
                          event.preventDefault();
                          event.stopPropagation();
                        }
                      }}
                    >
                      <div
                        className="bk-arrival-media"
                        onTouchStart={(event) => handleTouchStart(event, product.id)}
                        onTouchMove={(event) => handleTouchMove(event, product.id)}
                        onTouchEnd={(event) => handleTouchEnd(event, product.id, sliderImages.length)}
                      >
                        <div
                          className="bk-arrival-track"
                          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
                        >
                          {sliderImages.map((image, imageIndex) => (
                            <span className="bk-arrival-slide" key={`${product.id}-${image.url}-${imageIndex}`}>
                              <img src={imgUrl(image.url, 600)} alt={imageIndex === 0 ? product.name : ""} className="bk-arrival-image" loading={imageIndex > 0 ? "lazy" : undefined} decoding="async" />
                            </span>
                          ))}
                        </div>
                        {sliderImages.length > 1 && (
                          <div className="bk-arrival-dots">
                            {sliderImages.map((image, dotIndex) => (
                              <button
                                type="button"
                                key={`${image.url}-dot-${dotIndex}`}
                                className={dotIndex === activeIndex ? "active" : ""}
                                onClick={(event) => goToSlide(event, product.id, dotIndex)}
                                aria-label={`Show ${product.name} image ${dotIndex + 1}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bk-arrival-info">
                        <h3>{product.name}</h3>
                        {productDescription && <p className="bk-arrival-desc">{productDescription}</p>}
                        <ProductRating product={product} className="bk-arrival-rating" />
                        <div className="bk-arrival-price-row">
                          <div className="bk-arrival-price-main">
                            {discountPercent > 0 && <em className="bk-arrival-discount">-{discountPercent}%</em>}
                            <strong className="bk-arrival-price">{formatMoney(sell)}</strong>
                          </div>
                          {mrp > sell && <span className="bk-arrival-mrp"><span className="bk-arrival-mrp-val">{formatMoney(mrp)}</span></span>}
                        </div>
                        <button type="button" className="bk-arrival-atc-btn" onClick={(e) => handleAddToCart(e, product, currentColorId)}>
                          Add to Cart
                        </button>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          )}

          <div className="bk-arrivals-footer">
            <Link to="/collection" className="bk-arrivals-link">
              View Collection
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewArrivals;
