import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../config/api";
import { imgUrl } from "../../utils/cloudinary";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useNotification } from "../../context/NotificationContext";
import { getProductCoverImage, getProductImages, getDefaultColorId } from "../../utils/productMedia";
import { varietyLabel, materialLabel } from "../../utils/productAttributes";
import { getProductStockInfo } from "../../utils/stockStatus";
import useStockNotify from "../../hooks/useStockNotify";
import ProductRating from "../../components/ProductRating";
import DeliveryBadge from "../../components/DeliveryBadge";
import MarketplaceBadges from "../../components/MarketplaceBadges/MarketplaceBadges";
import brandBanner from "../../assets/story/banaras-weave.webp";
// The card here is the home page's New Arrivals card, markup and all, so the two read
// identically. Its stylesheet is imported rather than copied: those rules land across
// two cascading blocks and four media queries, and a transcription of them under new
// class names would drift from the original the first time either was touched.
import "../Home/NewArrivals/NewArrivals.css";
import "./Marketplace.css";

/**
 * Our marketplace listings — every saree we sell on another channel, on one page.
 *
 * There used to be a page per marketplace (/store/amazon, /store/flipkart …). One page
 * instead, because a product listed on two channels was otherwise a card on two separate
 * pages; here it appears once, carrying a badge per marketplace it is on.
 *
 * Everything is data: the products and the badges under each of them come from the
 * marketplaces table, so adding a channel is still just an admin row.
 */

// Two decimals, matching the home card exactly — "₹2,999.00", not "₹2,999".
const formatMoney = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const calcDiscount = (mrp, sell) => {
  if (!mrp || !sell || Number(mrp) <= Number(sell)) return 0;
  return Math.round(((Number(mrp) - Number(sell)) / Number(mrp)) * 100);
};

const PAGE_SIZE = 60;

const Marketplace = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { notify } = useStockNotify();
  const { showNotification } = useNotification();
  const gridRef = useRef(null);
  const swipeRef = useRef({});
  const swipeBlockRef = useRef(new Set());
  const [activeSlides, setActiveSlides] = useState({});
  const [data, setData] = useState(null);
  // Products are held apart from `data` because paging appends to them while the
  // channel list stays whatever the first response returned.
  const [products, setProducts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_ENDPOINTS.marketplaces}/showcase?limit=${PAGE_SIZE}`, { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      setData(json);
      setProducts(json.products || []);
      setHasMore(Boolean(json.hasMore));
    } catch (err) {
      if (err?.name === "AbortError") return;
      setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Appends the next page. The offset is the number of cards already held rather than a
  // page counter, so a failed-and-retried request cannot skip or duplicate a row.
  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `${API_ENDPOINTS.marketplaces}/showcase?limit=${PAGE_SIZE}&offset=${products.length}`
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      setProducts((prev) => [...prev, ...(json.products || [])]);
      setHasMore(Boolean(json.hasMore));
    } catch {
      // hasMore is left alone so the button stays and the reader can try again.
    } finally {
      setLoadingMore(false);
    }
  };

  // The card starts at opacity 0 and is revealed on scroll — same as the home section it
  // is borrowed from, which is where that rule lives. Without this the grid stays blank.
  useEffect(() => {
    if (loading || products.length === 0 || !gridRef.current) return undefined;
    const cards = gridRef.current.querySelectorAll(".bk-arrival-card");
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
    if (result?.success) showNotification("Added to cart!", "success");
    else showNotification(result?.message || "Could not add to cart.", "error");
  };

  const goToSlide = (event, productId, slideIndex) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveSlides((current) => ({ ...current, [productId]: slideIndex }));
  };

  // A swipe must not also register as a tap through to the product page.
  const blockSwipeClick = (productId) => {
    swipeBlockRef.current.add(productId);
    window.setTimeout(() => swipeBlockRef.current.delete(productId), 450);
  };

  const handleTouchStart = (event, productId) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    swipeRef.current[productId] = { startX: touch.clientX, startY: touch.clientY, didMove: false };
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
      const next = dx < 0 ? (idx + 1) % imageCount : (idx - 1 + imageCount) % imageCount;
      return { ...current, [productId]: next };
    });
  };

  const marketplaces = data?.marketplaces || [];
  const liveChannels = marketplaces.filter((m) => m.status === "live");
  const total = data?.total || 0;
  // "Amazon & Flipkart" in the heading, built from whatever is live.
  const channelNames = liveChannels.map((m) => m.name);
  const heading =
    channelNames.length > 1
      ? `${channelNames.slice(0, -1).join(", ")} & ${channelNames[channelNames.length - 1]}`
      : channelNames[0] || "Marketplaces";

  return (
    <main className="bk-mkt-page">
      {error ? (
        <section className="bk-mkt-empty">
          <Icon icon="lucide:wifi-off" />
          <h1>Could not load this page</h1>
          <p>Check your connection and try again.</p>
          <button type="button" className="bk-mkt-btn" onClick={() => load()}>
            <Icon icon="lucide:rotate-cw" /> Try again
          </button>
        </section>
      ) : (
        <>
          {/* ── Every listing, each badged with the channels it is on ── */}
          <section className="bk-mkt-best">
            {/* The page's h1 now that the hero is gone — it must keep one. */}
            <h1>All Our Marketplace Listings</h1>
            <div className="bk-mkt-divider" aria-hidden="true"><i /><span>◆</span><i /></div>
            {!loading && total > 0 && (
              <p className="bk-mkt-count">Sarees listed on {heading}</p>
            )}

            {loading ? (
              <div className="bk-arrivals-rail bk-arrivals-skeleton-rail" aria-hidden="true">
                {[...Array(8)].map((_, index) => (
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
              <div className="bk-mkt-empty">
                <Icon icon="lucide:package-search" />
                <h3>Nothing listed yet</h3>
                <p>We are still adding our sarees to these marketplaces. Everything is available on our own store today.</p>
                <Link to="/collection" className="bk-mkt-btn">Shop the collection</Link>
              </div>
            ) : (
              <>
                <div className="bk-arrivals-rail" ref={gridRef}>
                  {products.map((product, index) => {
                    const sell = Number(product.selling_price || product.price);
                    const mrp = Number(product.mrp_price || product.mrp || 0);
                    const disc = calcDiscount(mrp, sell);
                    const isOutOfStock = getProductStockInfo(product).isOutOfStock;
                    const cover = getProductCoverImage(product);
                    const cardImages = getProductImages(product);
                    const sliderImages = cardImages.length > 0 ? cardImages : [{ url: cover }];
                    const activeIndex = Math.min(activeSlides[product.id] || 0, sliderImages.length - 1);
                    const currentColorId = sliderImages[activeIndex]?.color_id || getDefaultColorId(product);
                    const discountPercent = Number(product.discount_percent || disc);
                    const productDescription =
                      product.short_description ||
                      product.description ||
                      [varietyLabel(product), materialLabel(product)].filter(Boolean).join(" ");

                    return (
                      <article
                        key={product.id}
                        className={`bk-arrival-card ${isOutOfStock ? "is-out-of-stock" : ""}`}
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
                            {isOutOfStock && <span className="bk-arrival-stock-badge">Out of stock</span>}
                            <div className="bk-arrival-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
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
                              {isOutOfStock ? (
                                <div className="bk-arrival-price-main">
                                  <span className="bk-arrival-mrp-tag">MRP</span>
                                  <strong className="bk-arrival-price">{formatMoney(mrp > 0 ? mrp : sell)}</strong>
                                </div>
                              ) : (
                                <>
                                  <div className="bk-arrival-price-main">
                                    {discountPercent > 0 && <em className="bk-arrival-discount">-{discountPercent}%</em>}
                                    <strong className="bk-arrival-price">{formatMoney(sell)}</strong>
                                  </div>
                                  {mrp > sell && <span className="bk-arrival-mrp"><span className="bk-arrival-mrp-val">{formatMoney(mrp)}</span></span>}
                                </>
                              )}
                            </div>
                            {!isOutOfStock && <DeliveryBadge processingDays={product.processing_days} />}
                            {isOutOfStock ? (
                              <button type="button" className="bk-arrival-atc-btn bk-notify-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); notify(product, currentColorId); }}>
                                <Icon icon="lucide:bell" /> Notify Me
                              </button>
                            ) : (
                              <button type="button" className="bk-arrival-atc-btn" onClick={(e) => handleAddToCart(e, product, currentColorId)}>
                                Add to Cart
                              </button>
                            )}
                            {/* The shared strip, not a local copy — this page should not be the
                                one card on the site whose "Also on" drifts from the rest. */}
                            <MarketplaceBadges productId={product.id} />
                          </div>
                        </Link>
                      </article>
                    );
                  })}
                </div>

                {hasMore && (
                  <button
                    type="button"
                    className="bk-mkt-btn bk-mkt-more"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Icon icon="lucide:loader-2" className="bk-mkt-spin" /> Loading…
                      </>
                    ) : (
                      <>
                        Show more listings <Icon icon="lucide:chevron-down" />
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}

      {/* ── Brand banner ──
          Deliberately worded away from the home page's copy of this banner, and without
          its button: the reader is already on the page that button leads to. */}
      <section className="bk-mkt-banner" style={{ "--mkt-banner": `url(${brandBanner})` }}>
        <div className="bk-mkt-banner-copy">
          <span className="bk-mkt-banner-kicker">
            <Icon icon="lucide:sparkle" /> Woven in Banaras. Sold everywhere.
          </span>
          <h2>Banarasi Kala</h2>
          <p>Every listing here comes off our own looms — the same weave, whichever channel you shop from.</p>
        </div>
      </section>
    </main>
  );
};

export default Marketplace;
