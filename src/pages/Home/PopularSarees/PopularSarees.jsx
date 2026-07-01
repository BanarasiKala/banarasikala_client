import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { imgUrl } from "../../../utils/cloudinary";
import { useAuth } from "../../../context/AuthContext";
import { useCart } from "../../../context/CartContext";
import { useWishlist } from "../../../context/WishlistContext";
import { useNotification } from "../../../context/NotificationContext";
import { API_ENDPOINTS } from "../../../config/api";
import { getProductCoverImage, getProductImages, getDefaultColorId } from "../../../utils/productMedia";
import { getProductStockInfo } from "../../../utils/stockStatus";
import ProductRating from "../../../components/ProductRating";
import DeliveryBadge from "../../../components/DeliveryBadge";
import "./PopularSarees.css";

const calcDiscount = (mrp, sell) => {
  if (!mrp || !sell || Number(mrp) <= Number(sell)) return 0;
  return Math.round(((Number(mrp) - Number(sell)) / Number(mrp)) * 100);
};

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PopularSarees = () => {
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
      specialCollection: "true",
      limit: "10",
      view: "home",
    });
    fetch(`${API_ENDPOINTS.products}?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        const homeProducts = (data.items || data).slice(0, 10);
        console.log("[Home][Exclusive Picks] products:", homeProducts);
        console.log("[Home][Exclusive Picks] raw response:", data);
        setProducts(homeProducts);
      })
      .catch((err) => { if (err.name !== "AbortError") setProducts([]); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (loading || products.length === 0 || !sectionRef.current) return undefined;
    const cards = sectionRef.current.querySelectorAll(".bk-popular-card");
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

  const handleWishlistClick = (e, product, colorId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate("/wishlist"); return; }
    toggleWishlist(product, colorId || null);
  };

  const handleAddToCart = async (e, product, colorId) => {
    e.preventDefault();
    e.stopPropagation();
    if (getProductStockInfo(product, colorId).isOutOfStock) {
      showNotification("This product is out of stock.", "error");
      return;
    }
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
        colorId: colorId || null,
      }));
      navigate("/cart");
      return;
    }
    const result = await addToCart(product, 1, colorId || null);
    if (result?.success) showNotification("Added to bag!", "success");
    else showNotification(result?.message || "Could not add to bag.", "error");
  };

  return (
    <section className="bk-popular-section" ref={sectionRef}>
      <div className="bk-popular-shell">
        <div className="bk-popular-header">
          <div className="bk-popular-title-wrap">
            <h2>Exclusive Picks</h2>
          </div>
        </div>

        {loading ? (
          <div className="bk-popular-showcase bk-popular-skeleton-grid">
            {[...Array(10)].map((_, i) => (
              <div key={i} className={`bk-popular-card bk-popular-skeleton ${i === 0 ? "bk-popular-feature-card" : ""}`}>
                <div className="bk-popular-skeleton-image" />
                <div className="bk-popular-card-body">
                  <div className="bk-popular-skeleton-line wide" />
                  <div className="bk-popular-skeleton-line" />
                  <div className="bk-popular-skeleton-line short" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bk-popular-empty" role="status">
            <div className="bk-popular-empty-icon" aria-hidden="true" />
            <h3>Curating Exclusive Picks</h3>
            <p>Featured pieces will appear here as soon as the collection is ready.</p>
            <Link to="/collection" className="bk-popular-empty-link">Explore Collection</Link>
          </div>
        ) : (
          <div className="bk-popular-showcase">
            {products.slice(0, 10).map((product, index) => {
              const sell = Number(product.selling_price);
              const mrp = Number(product.mrp_price);
              const disc = calcDiscount(mrp, sell);
              const img = getProductCoverImage(product);
              const cardImages = getProductImages(product);
              const sliderImages = cardImages.length > 0 ? cardImages : [{ url: img }];
              const activeIndex = Math.min(activeSlides[product.id] || 0, sliderImages.length - 1);
              const currentColorId = sliderImages[activeIndex]?.color_id || getDefaultColorId(product);
              const liked = isInWishlist(product.id, currentColorId);
              const discountPercent = Number(product.discount_percent || disc);
              const isOutOfStock = getProductStockInfo(product).isOutOfStock;
              const productDescription =
                product.short_description ||
                product.description ||
                [product.Variety?.name, product.Material?.name].filter(Boolean).join(" ");

              return (
                <article
                  key={product.id}
                  className={`bk-popular-card ${isOutOfStock ? "is-out-of-stock" : ""}`}
                  style={{ transitionDelay: `${Math.min(index * 40, 200)}ms` }}
                >
                  <Link
                    to={`/product/${product.slug}`}
                    className="bk-popular-card-link"
                    onClick={(event) => {
                      if (swipeBlockRef.current.has(product.id)) {
                        event.preventDefault();
                        event.stopPropagation();
                      }
                    }}
                  >
                    <div
                      className="bk-popular-image-wrap"
                      onTouchStart={(event) => handleTouchStart(event, product.id)}
                      onTouchMove={(event) => handleTouchMove(event, product.id)}
                      onTouchEnd={(event) => handleTouchEnd(event, product.id, sliderImages.length)}
                    >
                      {isOutOfStock && <span className="bk-popular-stock-badge">Out of stock</span>}
                      <div
                        className="bk-popular-image-track"
                        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
                      >
                        {sliderImages.map((image, imageIndex) => (
                          <span key={`${product.id}-${image.url}-${imageIndex}`} className="bk-popular-slide">
                            <img src={imgUrl(image.url, 600)} alt={imageIndex === 0 ? product.name : ""} className="bk-popular-image" loading={imageIndex > 0 ? "lazy" : undefined} decoding="async" />
                          </span>
                        ))}
                      </div>
                      {sliderImages.length > 1 && (
                        <div className="bk-popular-dots">
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

                    <div className="bk-popular-card-body">
                      <h3>{product.name}</h3>
                      {productDescription && <p className="bk-popular-desc">{productDescription}</p>}
                      <ProductRating product={product} className="bk-popular-rating" />
                      <div className="bk-popular-price-row">
                        {isOutOfStock ? (
                          <div className="bk-popular-price-main">
                            <span className="bk-popular-mrp-tag">MRP</span>
                            <strong className="bk-popular-price">{formatMoney(mrp > 0 ? mrp : sell)}</strong>
                          </div>
                        ) : (
                          <>
                            <div className="bk-popular-price-main">
                              {discountPercent > 0 && <em className="bk-popular-discount">-{discountPercent}%</em>}
                              <strong className="bk-popular-price">{formatMoney(sell)}</strong>
                            </div>
                            {mrp > sell && <span className="bk-popular-mrp"><span className="bk-popular-mrp-val">{formatMoney(mrp)}</span></span>}
                          </>
                        )}
                      </div>
                      {!isOutOfStock && <DeliveryBadge processingDays={product.processing_days} />}
                      <button type="button" className="bk-popular-atc-btn" onClick={(e) => handleAddToCart(e, product, currentColorId)}>
                        Add to Cart
                      </button>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        {!loading && products.length > 0 && (
          <div className="bk-popular-footer">
            <Link to="/collection" className="bk-popular-view-all">
              View All
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularSarees;
