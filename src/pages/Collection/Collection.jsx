import { Icon } from "@iconify/react";
import { useState, useEffect, useRef } from "react";
import { imgUrl } from "../../utils/cloudinary";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { useNotification } from "../../context/NotificationContext";
import { API_ENDPOINTS } from "../../config/api";
import { getProductCoverImage, getProductImages, getDefaultColorId } from "../../utils/productMedia";
import { varietyLabel, materialLabel } from "../../utils/productAttributes";
import { getProductStockInfo } from "../../utils/stockStatus";
import useStockNotify from "../../hooks/useStockNotify";
import ProductRating from "../../components/ProductRating";
import DeliveryBadge from "../../components/DeliveryBadge";
import "./Collection.css";

const PAGE_SIZE = 20;
// Only used when /price-range cannot be reached; the real ceiling comes from the catalogue.
const FALLBACK_PRICE_CEILING = 200000;
// Keep the slider usable for both a ₹5k and a ₹2L catalogue.
const priceStep = (ceiling) => (ceiling > 20000 ? 1000 : 100);

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const calcDiscount = (mrp, sell) => {
  if (!mrp || !sell || Number(mrp) <= Number(sell)) return 0;
  return Math.round(((Number(mrp) - Number(sell)) / Number(mrp)) * 100);
};

const getIdListParam = (params, key) =>
  (params.get(key) || "")
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

const getSortParam = (params) => {
  const sort = params.get("sort");
  if (sort === "special" || sort === "price_asc" || sort === "price_desc") return sort;
  if (sort === "popular") return "special";
  if (sort === "newest") return "newest";
  return "";
};

const Collection = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { notify } = useStockNotify();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [colors, setColors] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedFilters, setExpandedFilters] = useState({});
  const [loadedImages, setLoadedImages] = useState({});
  const [hoveredProductId, setHoveredProductId] = useState(null);
  const [activeSlides, setActiveSlides] = useState({});
  const [fallbackProducts, setFallbackProducts] = useState([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [priceCeiling, setPriceCeiling] = useState(FALLBACK_PRICE_CEILING);
  const productsRequestId = useRef(0);
  const fallbackRequestId = useRef(0);
  const isFirstSearchParamsRun = useRef(true);
  const swipeRef = useRef({});
  const swipeBlockRef = useRef(new Set());

  const [filters, setFilters] = useState(() => ({
    variety: getIdListParam(searchParams, "variety"),
    occasion: getIdListParam(searchParams, "occasion"),
    material: [],
    color: [],
    minPrice: 0,
    // null = no cap; the slider shows the catalogue ceiling until the shopper drags it down.
    maxPrice: null,
    sortBy: "",
    search: searchParams.get("search") || "",
  }));

  useEffect(() => {
    if (isFirstSearchParamsRun.current) {
      isFirstSearchParamsRun.current = false;
      return;
    }
    const urlSearch = searchParams.get("search") || "";
    const urlVarieties = getIdListParam(searchParams, "variety");
    const urlOccasions = getIdListParam(searchParams, "occasion");
    setFilters((prev) => ({
      ...prev,
      search: urlSearch,
      variety: urlVarieties,
      occasion: urlOccasions.length ? urlOccasions : prev.occasion,
      sortBy: getSortParam(searchParams),
    }));
    setCurrentPage(1);
  }, [searchParams]);

  const totalPaginationPages = Math.ceil(totalItems / PAGE_SIZE);


  // Fetch lean metadata for filters.
  useEffect(() => {
    const fetchMetadata = async () => {
      setFiltersLoading(true);
      try {
        const leanFields = "fields=id,name,slug";
        // The price ceiling is fetched alongside the taxonomy but failure-isolated: if it
        // cannot be read the slider keeps the fallback ceiling rather than blanking every filter.
        const priceRangePromise = fetch(API_ENDPOINTS.productPriceRange)
          .then((res) => res.json())
          .catch(() => null);
        const [occRes, matRes, colRes, varRes] = await Promise.all([
          fetch(`${API_ENDPOINTS.occasions}?${leanFields}`),
          fetch(`${API_ENDPOINTS.materials}?${leanFields}`),
          fetch(API_ENDPOINTS.colors),
          fetch(`${API_ENDPOINTS.varieties}?${leanFields}`),
        ]);
        const [occData, matData, colData, varData, priceData] = await Promise.all([
          occRes.json(),
          matRes.json(),
          colRes.json(),
          varRes.json(),
          priceRangePromise,
        ]);
        setOccasions(occData);
        setMaterials(matData);
        setColors(colData);
        setVarieties(varData);
        const catalogueMax = Number(priceData?.maxPrice);
        if (Number.isFinite(catalogueMax) && catalogueMax > 0) setPriceCeiling(catalogueMax);
      } catch (error) {
        console.error("Error fetching metadata:", error);
      } finally {
        setFiltersLoading(false);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch Products
  const fetchProducts = async (page) => {
    const requestId = productsRequestId.current + 1;
    productsRequestId.current = requestId;
    setLoading(true);
    setFallbackProducts([]);
    setFallbackLoading(false);
    try {
      const params = new URLSearchParams();
      params.append("paginated", "true");
      params.append("page", page);
      params.append("pageSize", PAGE_SIZE);
      params.append("status", "active");
      params.append("view", "collection");
      
      if (filters.variety.length) params.append("variety", filters.variety.join(","));
      if (filters.occasion.length) params.append("occasion", filters.occasion.join(","));
      if (filters.material.length) params.append("material", filters.material.join(","));
      if (filters.color.length) params.append("color", filters.color.join(","));
      if (Number(filters.minPrice) > 0) params.append("minPrice", filters.minPrice);
      if (filters.maxPrice !== null && Number(filters.maxPrice) < priceCeiling) {
        params.append("maxPrice", filters.maxPrice);
      }
      if (filters.sortBy) params.append("sortBy", filters.sortBy);
      if (filters.search && filters.search.trim()) params.append("search", filters.search.trim());

      const res = await fetch(`${API_ENDPOINTS.products}?${params.toString()}`);
      const data = await res.json();

      if (requestId !== productsRequestId.current) return;

      setProducts(data.items || []);
      setLoadedImages({});
      setActiveSlides({});
      setHoveredProductId(null);
      setTotalItems(data.meta?.totalItems ?? 0);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      if (requestId === productsRequestId.current) setLoading(false);
    }
  };

  // Reveal Observer for Fade-in Animation
  useEffect(() => {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: "0px 0px 220px 0px" }
    );

    const cards = document.querySelectorAll(".reveal-card:not(.visible)");
    cards.forEach((card) => revealObserver.observe(card));

    return () => revealObserver.disconnect();
  }, [products, fallbackProducts, loading, fallbackLoading]);


  useEffect(() => {
    fetchProducts(currentPage);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [filters, currentPage]);

  useEffect(() => {
    if (!mobileFiltersOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileFiltersOpen]);



  const handleCheckboxChange = (type, id) => {
    setCurrentPage(1);
    setFilters((prev) => {
      const current = prev[type];
      const updated = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      return { ...prev, [type]: updated };
    });
  };

  const handlePriceChange = (e) => {
    setCurrentPage(1);
    setFilters((prev) => ({ ...prev, maxPrice: Number(e.target.value) }));
  };

  const handleSortChange = (e) => {
    setCurrentPage(1);
    setFilters((prev) => ({ ...prev, sortBy: e.target.value }));
  };

  const toggleFilterExpand = (key) => {
    setExpandedFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!hoveredProductId) return undefined;

    const product = [...products, ...fallbackProducts].find((item) => item.id === hoveredProductId);
    const imageCount = getProductImages(product || {}).length;
    if (imageCount <= 1) return undefined;

    const advanceSlide = () => {
      setActiveSlides((current) => ({
        ...current,
        [hoveredProductId]: ((current[hoveredProductId] || 0) + 1) % imageCount,
      }));
    };

    const startTimer = window.setTimeout(advanceSlide, 650);
    const timer = window.setInterval(advanceSlide, 2200);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(timer);
    };
  }, [hoveredProductId, products, fallbackProducts]);

  const handleCardEnter = (productId) => {
    setHoveredProductId(productId);
  };

  const handleCardLeave = (productId) => {
    setHoveredProductId((current) => (current === productId ? null : current));
  };

  const goToSlide = (event, productId, slideIndex) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveSlides((current) => ({ ...current, [productId]: slideIndex }));
    setHoveredProductId(productId);
  };

  const blockSwipeClick = (productId) => {
    swipeBlockRef.current.add(productId);
    window.setTimeout(() => swipeBlockRef.current.delete(productId), 450);
  };

  const handleTouchStart = (event, productId) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    swipeRef.current[productId] = { startX: touch.clientX, startY: touch.clientY };
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

  const markImageLoaded = (productId) => {
    setLoadedImages((current) => ({ ...current, [productId]: true }));
  };

  const calculateDiscount = (mrp, selling) => {
    const m = Number(mrp);
    const s = Number(selling);
    if (!m || !s || m <= s) return 0;
    return Math.round(((m - s) / m) * 100);
  };

  // variety/occasion/sort/search can arrive in the URL, and the searchParams effect above
  // re-applies whatever is there. Removing such a filter from state alone would let the URL
  // put it straight back, so the URL is rewritten to match the new state — but only when the
  // key is actually present, otherwise a rewrite would trigger that effect and clobber
  // selections the shopper made in the sidebar.
  const syncUrlList = (key, values) => {
    if (!searchParams.get(key)) return;
    const next = new URLSearchParams(searchParams);
    if (values.length) next.set(key, values.join(","));
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const dropUrlKeys = (keys) => {
    const present = keys.filter((key) => searchParams.get(key));
    if (!present.length) return;
    const next = new URLSearchParams(searchParams);
    present.forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  };

  // Removes a single applied filter — the chip's ✕ above the product grid.
  const removeFilter = (type, id) => {
    setCurrentPage(1);

    if (type === "price") {
      setFilters((prev) => ({ ...prev, minPrice: 0, maxPrice: null }));
      return;
    }
    if (type === "sortBy") {
      setFilters((prev) => ({ ...prev, sortBy: "" }));
      dropUrlKeys(["sort"]);
      return;
    }
    if (type === "search") {
      setFilters((prev) => ({ ...prev, search: "" }));
      dropUrlKeys(["search"]);
      return;
    }

    const remaining = filters[type].filter((value) => value !== id);
    setFilters((prev) => ({ ...prev, [type]: prev[type].filter((value) => value !== id) }));
    if (type === "variety" || type === "occasion") syncUrlList(type, remaining);
  };

  const clearAllFilters = () => {
    setCurrentPage(1);
    setFilters((prev) => ({
      variety: [],
      occasion: [],
      material: [],
      color: [],
      minPrice: 0,
      maxPrice: null,
      sortBy: "",
      search: prev.search,
    }));
    // `search` is deliberately kept, so its URL key is left alone too.
    dropUrlKeys(["variety", "occasion", "sort"]);
  };

  const showAllProducts = () => {
    setCurrentPage(1);
    setFilters({
      variety: [],
      occasion: [],
      material: [],
      color: [],
      minPrice: 0,
      maxPrice: null,
      sortBy: "",
      search: "",
    });
    navigate("/collection");
  };

  const handleWishlist = async (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      showNotification("Please login first", "info");
      navigate("/wishlist");
      return;
    }
    await toggleWishlist(product);
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

  const renderProductCard = (product) => {
    const cover = getProductCoverImage(product, "https://via.placeholder.com/400x600?text=VNS+Saree");
    const productImages = getProductImages(product);
    const sliderImages = productImages.length > 0 ? productImages : [{ url: cover }];
    const activeSlide = Math.min(activeSlides[product.id] || 0, sliderImages.length - 1);
    const currentColorId = sliderImages[activeSlide]?.color_id || getDefaultColorId(product);
    const imageReady = Boolean(loadedImages[product.id]);
    const stockInfo = getProductStockInfo(product);
    const isOutOfStock = stockInfo.isOutOfStock;
    const sell = Number(product.selling_price || 0);
    const mrp = Number(product.mrp_price || product.mrp || 0);
    const discountPercent = Number(product.discount_percent || calcDiscount(mrp, sell));
    const productDescription =
      product.short_description ||
      product.description ||
      [varietyLabel(product), materialLabel(product)].filter(Boolean).join(" ");

    return (
      <div
        key={product.id}
        className={`product-card reveal-card ${isOutOfStock ? "out-of-stock" : ""}`}
        onPointerEnter={() => handleCardEnter(product.id)}
        onPointerLeave={() => handleCardLeave(product.id)}
      >
        <Link
          to={`/product/${product.slug}`}
          className="card-link"
          onClick={(event) => {
            if (swipeBlockRef.current.has(product.id)) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <div
            className="card-img-container"
            onTouchStart={(event) => handleTouchStart(event, product.id)}
            onTouchMove={(event) => handleTouchMove(event, product.id)}
            onTouchEnd={(event) => handleTouchEnd(event, product.id, sliderImages.length)}
          >
            {!imageReady && <span className="card-image-shimmer" aria-hidden="true" />}
            {isOutOfStock && <span className="collection-stock-badge">Out of stock</span>}
            <div
              className={`card-img-track ${imageReady ? "is-loaded" : ""}`}
              style={{ transform: `translateX(-${activeSlide * 100}%)` }}
            >
              {sliderImages.map((image, imageIndex) => (
                <img
                  key={`${product.id}-${image.url}-${imageIndex}`}
                  src={imgUrl(image.url, 600)}
                  alt={imageIndex === 0 ? product.name : ""}
                  className="card-img"
                  loading="lazy"
                  onLoad={() => {
                    if (imageIndex === 0) markImageLoaded(product.id);
                  }}
                />
              ))}
            </div>
            {sliderImages.length > 1 && (
              <div className="collection-card-dots" aria-hidden="true">
                {sliderImages.map((image, imageIndex) => (
                  <button
                    type="button"
                    key={`${image.url}-${imageIndex}`}
                    className={imageIndex === activeSlide ? "active" : ""}
                    onClick={(event) => goToSlide(event, product.id, imageIndex)}
                    aria-label={`Show ${product.name} image ${imageIndex + 1}`}
                    tabIndex={-1}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="card-details">
            <h3>{product.name || "Handcrafted Banarasi Saree"}</h3>
            {productDescription && <p className="collection-desc">{productDescription}</p>}
            <ProductRating product={product} className="collection-product-rating" />
            <div className="price-container">
              {isOutOfStock ? (
                <div className="price-main-row">
                  <span className="collection-mrp-tag">MRP</span>
                  <strong className="selling-price">{formatMoney(mrp > 0 ? mrp : sell)}</strong>
                </div>
              ) : (
                <>
                  <div className="price-main-row">
                    {discountPercent > 0 && <em className="collection-discount">-{discountPercent}%</em>}
                    <strong className="selling-price">{formatMoney(sell)}</strong>
                  </div>
                  {mrp > sell && <span className="mrp-price"><span className="mrp-price-val">{formatMoney(mrp)}</span></span>}
                </>
              )}
            </div>
            {!isOutOfStock && <DeliveryBadge processingDays={product.processing_days} />}
            {isOutOfStock ? (
              <button
                type="button"
                className="collection-atc-btn collection-notify-btn"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); notify(product, currentColorId); }}
              >
                <Icon icon="lucide:bell" /> Notify Me
              </button>
            ) : (
              <button
                type="button"
                className="collection-atc-btn"
                onClick={(e) => handleAddToCart(e, product, currentColorId)}
              >
                Add to Cart
              </button>
            )}
          </div>
        </Link>
      </div>
    );
  };

  const renderFilterGroup = (key, title, items, filterKey, renderExtra = null) => {
    const isExpanded = Boolean(expandedFilters[key]);
    const visibleItems = isExpanded ? items : items.slice(0, 5);
    const hiddenCount = Math.max(0, items.length - visibleItems.length);

    return (
      <div className="filter-section">
        <h3 className="filter-title">{title}</h3>
        <div className="filter-list">
          {visibleItems.map((item) => (
            <label key={item.id} className="filter-item">
              <input
                type="checkbox"
                checked={filters[filterKey].includes(item.id)}
                onChange={() => handleCheckboxChange(filterKey, item.id)}
              />
              {renderExtra?.(item)}
              {item.name}
            </label>
          ))}
        </div>
        {hiddenCount > 0 && (
          <button
            type="button"
            className="filter-more-btn"
            onClick={() => toggleFilterExpand(key)}
          >
            +{hiddenCount} more
          </button>
        )}
        {isExpanded && items.length > 5 && (
          <button
            type="button"
            className="filter-more-btn filter-less-btn"
            onClick={() => toggleFilterExpand(key)}
          >
            Show less
          </button>
        )}
      </div>
    );
  };

  const renderPriceFilter = () => {
    // Unset maxPrice means "everything", so the handle sits at the catalogue ceiling.
    const sliderValue = filters.maxPrice === null ? priceCeiling : filters.maxPrice;
    return (
      <div className="filter-section collection-price-section">
        <h3 className="filter-title">Price</h3>
        <div className="collection-price-filter">
          <input
            type="range"
            min="0"
            max={priceCeiling}
            step={priceStep(priceCeiling)}
            value={sliderValue}
            onChange={handlePriceChange}
          />
          <div className="collection-price-range">
            <span>₹0</span>
            <span>{formatMoney(sliderValue)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderFilterSkeleton = (priceFirst = false) => (
    <div className="filter-skeleton-wrap" aria-label="Loading filters">
      {priceFirst && (
        <div className="filter-section filter-price-skeleton">
          <span className="filter-skeleton-title" />
          <span className="filter-skeleton-price-track" />
          <span className="filter-skeleton-price-values" />
        </div>
      )}
      {Array.from({ length: 4 }).map((_, sectionIndex) => (
        <div className="filter-section" key={sectionIndex}>
          <span className="filter-skeleton-title" />
          {Array.from({ length: 5 }).map((__, itemIndex) => (
            <span className="filter-skeleton-row" key={itemIndex} />
          ))}
        </div>
      ))}
      {!priceFirst && (
        <div className="filter-section filter-price-skeleton">
          <span className="filter-skeleton-title" />
          <span className="filter-skeleton-price-track" />
          <span className="filter-skeleton-price-values" />
        </div>
      )}
    </div>
  );

  const hasActiveFilters =
    filters.variety.length > 0 ||
    filters.occasion.length > 0 ||
    filters.material.length > 0 ||
    filters.color.length > 0 ||
    Number(filters.minPrice) > 0 ||
    (filters.maxPrice !== null && Number(filters.maxPrice) < priceCeiling) ||
    filters.sortBy !== "";

  const hasResultCriteria = hasActiveFilters || Boolean(filters.search.trim());

  // One removable chip per applied filter, shown above the grid. Ids are resolved to names
  // against the loaded taxonomy; an id with no match yet (metadata still in flight) is skipped
  // rather than rendered as a nameless chip.
  const taxonomyChips = (type, list) =>
    filters[type]
      .map((id) => {
        const item = list.find((entry) => Number(entry.id) === Number(id));
        if (!item) return null;
        return { key: `${type}-${id}`, type, id, label: item.name, hex: item.hex_code || null };
      })
      .filter(Boolean);

  const priceChipLabel = () => {
    const min = Number(filters.minPrice) > 0 ? Number(filters.minPrice) : null;
    const max = filters.maxPrice !== null && Number(filters.maxPrice) < priceCeiling
      ? Number(filters.maxPrice)
      : null;
    const short = (value) => `₹${value.toLocaleString("en-IN")}`;
    if (min && max) return `${short(min)} - ${short(max)}`;
    if (max) return `Under ${short(max)}`;
    if (min) return `Above ${short(min)}`;
    return null;
  };

  const SORT_LABELS = {
    newest: "New Arrivals",
    price_asc: "Price: Low to High",
    price_desc: "Price: High to Low",
    special: "Exclusive Picks",
  };

  const appliedFilters = [
    ...taxonomyChips("color", colors),
    ...taxonomyChips("variety", varieties),
    ...taxonomyChips("material", materials),
    ...taxonomyChips("occasion", occasions),
  ];

  const priceLabel = priceChipLabel();
  if (priceLabel) appliedFilters.push({ key: "price", type: "price", label: priceLabel });
  if (filters.sortBy && SORT_LABELS[filters.sortBy]) {
    appliedFilters.push({ key: "sort", type: "sortBy", label: SORT_LABELS[filters.sortBy] });
  }
  if (filters.search.trim()) {
    appliedFilters.push({ key: "search", type: "search", label: `“${filters.search.trim()}”` });
  }

  useEffect(() => {
    if (loading || products.length > 0 || !hasResultCriteria) {
      if (!loading && products.length > 0) setFallbackProducts([]);
      return undefined;
    }

    const requestId = fallbackRequestId.current + 1;
    fallbackRequestId.current = requestId;
    const controller = new AbortController();

    const fetchFallbackProducts = async () => {
      setFallbackLoading(true);
      try {
        const params = new URLSearchParams({
          paginated: "true",
          page: "1",
          pageSize: "12",
          status: "active",
          view: "collection",
          sortBy: "special",
        });
        // This section relaxes the narrow filters (colour, pattern, fabric, search) to recover
        // from a zero-result page, but the shopper's budget is not one of them — suggesting a
        // ₹7,399 saree under a ₹739 cap reads as the price filter leaking.
        if (Number(filters.minPrice) > 0) params.append("minPrice", filters.minPrice);
        if (filters.maxPrice !== null && Number(filters.maxPrice) < priceCeiling) {
          params.append("maxPrice", filters.maxPrice);
        }

        const res = await fetch(`${API_ENDPOINTS.products}?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (requestId !== fallbackRequestId.current) return;
        setFallbackProducts(Array.isArray(data.items) ? data.items : []);
      } catch (error) {
        if (error.name !== "AbortError" && requestId === fallbackRequestId.current) {
          setFallbackProducts([]);
        }
      } finally {
        if (requestId === fallbackRequestId.current) setFallbackLoading(false);
      }
    };

    fetchFallbackProducts();

    return () => controller.abort();
  }, [loading, products.length, hasResultCriteria, filters.minPrice, filters.maxPrice, priceCeiling]);

  const renderFiltersBody = ({ priceFirst = false } = {}) => (
    <>
      {filtersLoading ? (
        renderFilterSkeleton(priceFirst)
      ) : (
        <>
          {priceFirst && renderPriceFilter()}
          {!priceFirst && renderPriceFilter()}
          {renderFilterGroup("color", "Color", colors, "color", (col) => (
            <svg className="color-swatch" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="7.5" fill={col.hex_code || "#cccccc"} />
            </svg>
          ))}
          {renderFilterGroup("variety", "Pattern", varieties, "variety")}
          {renderFilterGroup("material", "Fabric", materials, "material")}
          {renderFilterGroup("occasion", "Occasions", occasions, "occasion")}
          
          
        </>
      )}
    </>
  );

  return (
    <div className="collection-container">
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span className="mx-2">/</span>
        <span className="font-bold">Collection</span>
      </nav>

      <div className="main-content">
        <aside className="filters-sidebar">
          <div className="sidebar-header">
            <h2>FILTERS</h2>
          </div>

          {renderFiltersBody()}
        </aside>

        <section className="product-listing">
          <div className="listing-controls">
            <button
              type="button"
              className="mobile-filter-trigger"
              onClick={() => setMobileFiltersOpen(true)}
            >
              <Icon icon="lucide:sliders-horizontal" />
              Filters
            </button>
            <div className="sort-container">
              <select value={filters.sortBy} onChange={handleSortChange}>
                <option value="">{filters.sortBy ? "Clear sort" : "Sort by"}</option>
                <option value="newest">New Arrivals</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="special">Exclusive Picks</option>
              </select>
            </div>
          </div>

          {appliedFilters.length > 0 && (
            <div className="applied-filters" aria-label="Applied filters">
              {appliedFilters.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="applied-filter-chip"
                  onClick={() => removeFilter(chip.type, chip.id)}
                  aria-label={`Remove filter ${chip.label}`}
                  title={`Remove ${chip.label}`}
                >
                  {chip.hex && (
                    <span
                      className="applied-filter-swatch"
                      style={{ background: chip.hex }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="applied-filter-text">{chip.label}</span>
                  <span className="applied-filter-x" aria-hidden="true">
                    <Icon icon="lucide:x" />
                  </span>
                </button>
              ))}
              {appliedFilters.length > 1 && (
                <button type="button" className="applied-filter-clear" onClick={clearAllFilters}>
                  Clear all
                </button>
              )}
            </div>
          )}

          <div className="product-grid">
            {loading ? (
              Array(8).fill(0).map((_, i) => (
                <div key={i} className="product-card">
                  <div className="card-img-container skeleton"></div>
                  <div className="card-details">
                    <div className="skeleton skeleton-title"></div>
                    <div className="skeleton skeleton-description"></div>
                    <div className="skeleton skeleton-price"></div>
                  </div>
                </div>
              ))
            ) : products.length === 0 ? (
              <div className="col-span-full text-center py-20 text-gray-500">
                No products found matching your filters.
              </div>
            ) : (
              products.map(renderProductCard)
            )}
          </div>

          {!loading && products.length === 0 && hasResultCriteria && (fallbackLoading || fallbackProducts.length > 0) && (
            <section className="collection-more-section">
              <div className="collection-more-head">
                <h2>More Products</h2>
              </div>
              <div className="product-grid collection-more-grid">
                {fallbackLoading ? (
                  Array(8).fill(0).map((_, i) => (
                    <div key={i} className="product-card">
                      <div className="card-img-container skeleton"></div>
                      <div className="card-details">
                        <div className="skeleton skeleton-title"></div>
                        <div className="skeleton skeleton-description"></div>
                        <div className="skeleton skeleton-price"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  fallbackProducts.map(renderProductCard)
                )}
              </div>
              {!fallbackLoading && fallbackProducts.length > 0 && (
                <div className="collection-more-footer">
                  <button type="button" className="collection-more-link" onClick={showAllProducts}>
                    View All
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Pagination */}
          {totalPaginationPages > 1 && (
            <div className="pagination">

              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="page-btn"
              >
                <Icon icon="lucide:chevron-left" className="mr-1"></Icon>
                Prev
              </button>
              {[...Array(totalPaginationPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`page-btn ${currentPage === i + 1 ? "active" : ""}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={currentPage === totalPaginationPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="page-btn"
              >
                Next
                <Icon icon="lucide:chevron-right" className="ml-1"></Icon>
              </button>
            </div>
          )}
          {/* End of product listing */}
        </section>
      </div>

      {mobileFiltersOpen && (
        <div
          className="mobile-filter-backdrop"
          role="presentation"
          onClick={() => setMobileFiltersOpen(false)}
        >
          <aside
            className="mobile-filter-drawer"
            aria-label="Collection filters"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-filter-header">
              <div>
                <span>Refine Sarees</span>
                <h2>Filters</h2>
              </div>
              <button
                type="button"
                className="mobile-filter-close"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
              >
                <Icon icon="lucide:x" />
              </button>
            </div>

            <div className="mobile-filter-body">
              <div className="sidebar-header mobile-filter-actions">
                <h2>FILTERS</h2>
                {hasActiveFilters && (
                  <button className="clear-btn" onClick={clearAllFilters}>
                    Clear All
                  </button>
                )}
              </div>
              {renderFiltersBody({ priceFirst: true })}
            </div>

            <div className="mobile-filter-footer">
              <button type="button" onClick={() => setMobileFiltersOpen(false)}>
                View Sarees
              </button>
            </div>
          </aside>
        </div>
      )}

    </div>
  );
};

export default Collection;


