import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { imgUrl } from "../../utils/cloudinary";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useNotification } from "../../context/NotificationContext";
import { useWishlist } from "../../context/WishlistContext";
import { API_ENDPOINTS } from "../../config/api";
import api from "../../utils/api";
import { getColorStock, getProductImages } from "../../utils/productMedia";
import useStockNotify from "../../hooks/useStockNotify";
import { varietyLabel, materialLabel } from "../../utils/productAttributes";
import EmptyStateIcon from "../../components/EmptyStateIcon";
import { getProductStockInfo } from "../../utils/stockStatus";
import ProductRating from "../../components/ProductRating";
import MarketplaceBadges from "../../components/MarketplaceBadges/MarketplaceBadges";
import DeliveryBadge from "../../components/DeliveryBadge";
import "./Wishlist.css";

const Wishlist = () => {
  const { user } = useAuth();
  const { wishlist, removeFromWishlist, loading } = useWishlist();
  const { addToCart } = useCart();
  const { notify } = useStockNotify();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [colors, setColors] = useState([]);
  const [colorModalProduct, setColorModalProduct] = useState(null);
  const [selectedColorId, setSelectedColorId] = useState(null);
  const [addingToBag, setAddingToBag] = useState(false);
  const [directAddingId, setDirectAddingId] = useState(null);
  const [activeSlides, setActiveSlides] = useState({});
  const swipeRef = useRef({});
  const swipeBlockRef = useRef(new Set());
  const hasItems = wishlist.length > 0;
  const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    const fetchColors = async () => {
      try {
        const res = await api.get(API_ENDPOINTS.colors);
        setColors(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error("Error fetching colors:", error);
      }
    };

    fetchColors();
  }, []);

  const colorMap = useMemo(() => {
    return colors.reduce((map, color) => {
      map[Number(color.id)] = color;
      return map;
    }, {});
  }, [colors]);

  const getAvailableColors = (product) => {
    // Try image-based color IDs first, fall back to color_stocks keys
    const imageColorIds = [
      ...new Set(
        getProductImages(product)
          .map((img) => Number(img.color_id))
          .filter(Boolean),
      ),
    ];
    const stockColorIds = imageColorIds.length === 0 && product.color_stocks
      ? [...new Set(Object.keys(product.color_stocks).map(Number).filter(Boolean))]
      : [];
    const colorIds = imageColorIds.length > 0 ? imageColorIds : stockColorIds;

    return colorIds
      .map((colorId) => ({
        id: colorId,
        stock: Number(getColorStock(product, colorId) || 0),
        ...(colorMap[colorId] || { name: `Color ${colorId}`, hex_code: "#d8b46a" }),
      }))
      .filter((color) => color.id);
  };

  const openColorModal = (product) => {
    const colorOptions = getAvailableColors(product);
    const inStockColors = colorOptions.filter((color) => color.stock > 0);
    if (!inStockColors.length) {
      showNotification("This saree is currently unavailable", "warning");
      return;
    }
    setColorModalProduct(product);
    // Pre-select the saved color if it's in stock, otherwise the first available
    const savedColor = product.colorId
      ? inStockColors.find(c => String(c.id) === String(product.colorId))
      : null;
    setSelectedColorId(savedColor ? savedColor.id : inStockColors[0].id);
  };

  const handleDirectAddToBag = async (item) => {
    setDirectAddingId(item.wishlistItemId);
    const result = await addToCart(item, 1, item.colorId);
    setDirectAddingId(null);
    if (result?.success) {
      showNotification("Added to cart!");
    } else {
      showNotification(result?.message || "Failed to add to cart", "error");
    }
  };

  const closeColorModal = () => {
    if (addingToBag) return;
    setColorModalProduct(null);
    setSelectedColorId(null);
  };

  const handleAddToBag = async () => {
    if (!colorModalProduct || !selectedColorId) {
      showNotification("Please choose a color first", "warning");
      return;
    }

    setAddingToBag(true);
    const result = await addToCart(colorModalProduct, 1, selectedColorId);
    setAddingToBag(false);

    if (result?.success) {
      showNotification("Added to cart!");
      setColorModalProduct(null);
      setSelectedColorId(null);
    } else {
      showNotification(result?.message || "Failed to add to cart", "error");
    }
  };

  const handleBuyNow = async () => {
    if (!colorModalProduct || !selectedColorId) {
      showNotification("Please choose a color first", "warning");
      return;
    }

    setAddingToBag(true);
    const result = await addToCart(colorModalProduct, 1, selectedColorId);
    setAddingToBag(false);

    if (result?.success) {
      setColorModalProduct(null);
      setSelectedColorId(null);
      navigate("/checkout");
    } else {
      showNotification(result?.message || "Failed to add to cart", "error");
    }
  };

  const modalColors = colorModalProduct ? getAvailableColors(colorModalProduct) : [];

  const getWishlistImages = (item) => {
    const images = getProductImages(item)
      .filter((image) => image?.url)
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    const selectedColorImages = item.colorId
      ? images.filter((image) => String(image.color_id) === String(item.colorId))
      : [];
    const ordered = item.colorId ? selectedColorImages : images;
    return ordered.length ? ordered : [{ url: item.image_url }];
  };

  const handleSwipeStart = (event, itemId) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    swipeRef.current[itemId] = { startX: touch.clientX, startY: touch.clientY };
  };

  const handleSwipeMove = (event, itemId) => {
    const touch = event.touches?.[0];
    const swipe = swipeRef.current[itemId];
    if (!touch || !swipe) return;
    if (Math.abs(touch.clientX - swipe.startX) > 8) swipe.didMove = true;
  };

  const handleSwipeEnd = (event, itemId, imageCount) => {
    const touch = event.changedTouches?.[0];
    const swipe = swipeRef.current[itemId];
    delete swipeRef.current[itemId];
    if (!touch || !swipe || imageCount <= 1) return;

    const dx = touch.clientX - swipe.startX;
    const dy = touch.clientY - swipe.startY;
    if (Math.abs(dx) <= 40 || Math.abs(dx) <= Math.abs(dy)) return;

    event.preventDefault();
    event.stopPropagation();
    swipeBlockRef.current.add(itemId);
    window.setTimeout(() => swipeBlockRef.current.delete(itemId), 450);
    setActiveSlides((current) => {
      const cur = current[itemId] || 0;
      const next = dx < 0 ? (cur + 1) % imageCount : (cur - 1 + imageCount) % imageCount;
      return { ...current, [itemId]: next };
    });
  };

  const goToSlide = (event, itemId, index) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveSlides((current) => ({ ...current, [itemId]: index }));
  };

  return (
    <main className="wishlist-page">
      {/* Hidden while the page is empty, matching the cart — which shows nothing but the empty
          block. A "Your Wishlist / Save sarees you love" header above an illustration that
          already says the same thing is the heading for a list that is not there. */}
      {user && hasItems && (
        <section className="wishlist-hero">
          <div>
            <h1>Your Wishlist</h1>
            <p>{wishlist.length} saved {wishlist.length === 1 ? "saree" : "sarees"}</p>
          </div>
        </section>
      )}

      {!user ? (
        <section className="wishlist-empty">
          <EmptyStateIcon variant="wishlist" />
          <h2>Login to view your wishlist</h2>
          <p>Sign in to save sarees you love and access them anytime.</p>
          <Link
            to="/login"
            state={{ from: { pathname: "/wishlist" } }}
            className="wishlist-primary-link wishlist-primary-link--auth"
          >
            <Icon icon="lucide:heart" />
            Login to View Wishlist
          </Link>
        </section>
      ) : loading ? (
        /* Same running order as the loaded card — title, description, rating, price,
           delivery, action — so the grid rows are already the right height and the
           cards do not re-flow underneath the reader when the wishlist arrives. */
        <section className="wishlist-grid" aria-label="Loading wishlist products" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <article key={index} className="wishlist-card wishlist-card-skeleton" aria-hidden="true">
              <div className="bk-sk wishlist-skeleton-image" />
              <div className="wishlist-card-body">
                <span className="bk-sk wishlist-skeleton-line title" />
                <span className="bk-sk wishlist-skeleton-line title short" />
                <span className="bk-sk wishlist-skeleton-line desc" />
                <span className="bk-sk wishlist-skeleton-line rating" />
                <span className="bk-sk wishlist-skeleton-line price" />
                <span className="bk-sk wishlist-skeleton-line mrp" />
                <span className="bk-sk wishlist-skeleton-line delivery" />
                <span className="bk-sk wishlist-skeleton-button" />
              </div>
            </article>
          ))}
        </section>
      ) : !hasItems ? (
        <section className="wishlist-empty">
          <EmptyStateIcon variant="wishlist" />
          <h2>Your wishlist is waiting</h2>
          <p>Save sarees you love and return here whenever you are ready.</p>
          <Link to="/collection" className="wishlist-primary-link">
            Explore Sarees
            <Icon icon="lucide:arrow-right" />
          </Link>
        </section>
      ) : (
        <section className="wishlist-grid" aria-label="Saved wishlist products">
          {wishlist.map((item) => {
            const price = Number(item.price || item.selling_price || 0);
            const mrp = Number(item.mrp_price || item.mrp || 0);
            const hasDiscount = mrp > price && price > 0;
            const discountPercent = Number(item.discount_percent || Math.round(((mrp - price) / mrp) * 100) || 0);

            // Per-color stock — read color_stocks directly (images may be empty)
            const colorStocksMap = item.color_stocks || {};
            const hasColorData = Object.keys(colorStocksMap).length > 0;

            const savedColorStock = item.colorId
              ? (hasColorData
                  ? Number(colorStocksMap[item.colorId] ?? colorStocksMap[String(item.colorId)] ?? 0)
                  : 0)  // no per-color data — can't confirm this color is in stock
              : Number(item.stock_quantity ?? 0);
            const savedColorInStock = savedColorStock > 0;

            const hasOtherInStockColor = hasColorData
              ? Object.entries(colorStocksMap).some(
                  ([cId, qty]) => Number(qty) > 0 && String(cId) !== String(item.colorId ?? "")
                )
              : false;

            const hasAnyInStockColor = hasColorData
              ? Object.values(colorStocksMap).some(v => Number(v) > 0)
              : Number(item.stock_quantity ?? 0) > 0;

            // If no specific color saved, fall back to product-level stock
            const noColorSaved = !item.colorId;
            const stockInfo = getProductStockInfo(item);
            const isLowStock = savedColorInStock && stockInfo.isLowStock;
            const showColorOos = !noColorSaved && !savedColorInStock && hasOtherInStockColor;
            const cardIsOos = noColorSaved ? stockInfo.isOutOfStock : !savedColorInStock && !hasOtherInStockColor;

            // Action button logic
            let actionBtn;
            const isDirect = directAddingId === item.wishlistItemId;
            if (noColorSaved) {
              if (!hasColorData) {
                // No color variants at all — add directly or show unavailable
                actionBtn = hasAnyInStockColor ? (
                  <button type="button" onClick={() => handleDirectAddToBag({ ...item, colorId: null })} disabled={isDirect}>
                    <Icon icon="lucide:shopping-bag" />
                    {isDirect ? "Adding..." : "Add to Cart"}
                  </button>
                ) : (
                  <button type="button" className="wishlist-notify-btn" onClick={() => notify(item, item.colorId || null)}>
                    <Icon icon="lucide:bell" /> Notify Me
                  </button>
                );
              } else {
                // Has color variants — open modal to pick
                actionBtn = hasAnyInStockColor ? (
                  <button type="button" onClick={() => openColorModal(item)}>
                    <Icon icon="lucide:shopping-bag" />
                    Add to Cart
                  </button>
                ) : (
                  <button type="button" className="wishlist-notify-btn" onClick={() => notify(item, item.colorId || null)}>
                    <Icon icon="lucide:bell" /> Notify Me
                  </button>
                );
              }
            } else if (savedColorInStock) {
              // Saved color is in stock — add directly
              actionBtn = (
                <button type="button" onClick={() => handleDirectAddToBag(item)} disabled={isDirect}>
                  <Icon icon="lucide:shopping-bag" />
                  {isDirect ? "Adding..." : "Add to Cart"}
                </button>
              );
            } else if (hasOtherInStockColor) {
              // Saved color OOS but other colors available
              actionBtn = (
                <button type="button" className="wishlist-explore-btn" onClick={() => openColorModal(item)}>
                  <Icon icon="lucide:palette" />
                  Explore other colors
                </button>
              );
            } else {
              // All colors OOS
              actionBtn = (
                <button type="button" disabled>Unavailable</button>
              );
            }

            return (
              <article key={item.wishlistItemId || `${item.id}-${item.colorId}`} className={`wishlist-card ${cardIsOos ? "out-of-stock" : ""}`}>
                {(() => {
                  const sliderImages = getWishlistImages(item);
                  const cardKey = item.wishlistItemId || item.id;
                  const activeSlide = Math.min(activeSlides[cardKey] || 0, sliderImages.length - 1);
                  const description = item.short_description || item.description || [varietyLabel(item), materialLabel(item)].filter(Boolean).join(" ");
                  return (
                    <>
                      <div
                        className="wishlist-card-image"
                        onTouchStart={(event) => handleSwipeStart(event, cardKey)}
                        onTouchMove={(event) => handleSwipeMove(event, cardKey)}
                        onTouchEnd={(event) => handleSwipeEnd(event, cardKey, sliderImages.length)}
                      >
                        <Link
                          to={`/product/${item.slug}${item.colorId ? `?color=${item.colorId}` : ""}`}
                          className="wishlist-card-media-link"
                          aria-label={`Open ${item.name}`}
                          onClick={(event) => {
                            if (swipeBlockRef.current.has(cardKey)) {
                              event.preventDefault();
                              event.stopPropagation();
                            }
                          }}
                        >
                          <div className="wishlist-card-image-track" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
                            {sliderImages.map((image, index) => (
                              <img key={`${item.id}-${image.url}-${index}`} src={imgUrl(image.url, 600)} alt={index === 0 ? item.name : ""} loading="lazy" />
                            ))}
                          </div>
                        </Link>
                        {sliderImages.length > 1 && (
                          <div className="wishlist-card-dots">
                            {sliderImages.map((image, index) => (
                              <button
                                type="button"
                                key={`${image.url}-dot-${index}`}
                                className={index === activeSlide ? "active" : ""}
                                onClick={(event) => goToSlide(event, cardKey, index)}
                                aria-label={`Show ${item.name} image ${index + 1}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="wishlist-remove-icon"
                        onClick={() => removeFromWishlist(item.wishlistItemId)}
                        aria-label={`Remove ${item.name} from wishlist`}
                      >
                        <Icon icon="lucide:x" />
                      </button>

                      <div className="wishlist-card-body">
                        <Link to={`/product/${item.slug}`} className="wishlist-card-title">
                          {item.name}
                        </Link>
                        {description && <p className="wishlist-card-desc">{description}</p>}
                        <ProductRating product={item} className="wishlist-card-rating" />
                        {(showColorOos || (noColorSaved && stockInfo.isOutOfStock) || item.colorName) && (
                          <div className="wishlist-card-status">
                            {showColorOos && <span className="wishlist-status-pill">Color unavailable</span>}
                            {noColorSaved && stockInfo.isOutOfStock && <span className="wishlist-status-pill">Out of stock</span>}
                            {/* {isLowStock && <span className="wishlist-status-pill low">{stockInfo.badge}</span>} */}
                            {item.colorName && (
                              <span className="wishlist-color-badge">
                                {item.colorHex && (
                                  <span className="wishlist-color-dot" style={{ background: item.colorHex }} />
                                )}
                                {item.colorName}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="wishlist-card-price">
                          {cardIsOos ? (
                            <strong>{formatMoney(mrp > 0 ? mrp : price)}</strong>
                          ) : (
                            <>
                              <div className="wishlist-price-main">
                                {hasDiscount && discountPercent > 0 && <em>-{discountPercent}%</em>}
                                <strong>{formatMoney(price)}</strong>
                              </div>
                              {hasDiscount && <span className="wishlist-card-mrp"><span className="wishlist-card-mrp-val">{formatMoney(mrp)}</span></span>}
                            </>
                          )}
                        </div>
                        {!cardIsOos && <DeliveryBadge processingDays={item.processing_days} />}
                        <div className="wishlist-card-actions">
                          {actionBtn}
                        </div>
                        <MarketplaceBadges productId={item.product_id || item.id} />
                      </div>
                    </>
                  );
                })()}
              </article>
            );
          })}
        </section>
      )}

      {hasItems && (
        <section className="wishlist-bottom-cta">
          <div>
            <span>Explore More</span>
            <p>Your next favorite awaits.</p>
          </div>
          <Link to="/collection" className="wishlist-primary-link">
            Continue Shopping
            <Icon icon="lucide:arrow-right" />
          </Link>
        </section>
      )}

      {colorModalProduct && (
        <div className="wishlist-modal-backdrop" role="presentation" onClick={closeColorModal}>
          <section
            className="wishlist-color-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wishlist-color-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="wishlist-modal-close"
              onClick={closeColorModal}
              aria-label="Close color selection"
            >
              <Icon icon="lucide:x" />
            </button>

            <div className="wishlist-modal-product">
              <img src={imgUrl(colorModalProduct.image_url, 600)} alt={colorModalProduct.name} />
              <div>
                <span>Choose Color</span>
                <h2 id="wishlist-color-title">{colorModalProduct.name}</h2>
                <p>Select an available color before adding this saree to your cart.</p>
              </div>
            </div>

            <div className="wishlist-color-options">
              {modalColors.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className={`${selectedColorId === color.id ? "active" : ""} ${color.stock <= 0 ? "disabled" : ""}`}
                  onClick={() => color.stock > 0 && setSelectedColorId(color.id)}
                  disabled={color.stock <= 0}
                >
                  <span style={{ backgroundColor: color.hex_code || "#d8b46a" }} />
                  <strong>{color.name}</strong>
                  <small className={color.stock <= 0 ? "stock-out" : color.stock < Number(colorModalProduct.low_stock_threshold || 5) ? "stock-low" : ""}>
                    {color.stock <= 0
                      ? "This color is out of stock"
                      : color.stock < Number(colorModalProduct.low_stock_threshold || 5)
                        ? `Only ${color.stock} left`
                        : "Available"}
                  </small>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="wishlist-modal-add"
              onClick={handleAddToBag}
              disabled={addingToBag}
            >
              <Icon icon="lucide:shopping-bag" />
              {addingToBag ? "Adding..." : "Add to Cart"}
            </button>
            <button
              type="button"
              className="wishlist-modal-add wishlist-modal-buy"
              onClick={handleBuyNow}
              disabled={addingToBag}
            >
              <Icon icon="lucide:zap" />
              Buy Now
            </button>
          </section>
        </div>
      )}
    </main>
  );
};

export default Wishlist;
