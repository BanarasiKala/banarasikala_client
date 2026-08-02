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
import MarketplaceBadges from "../../components/MarketplaceBadges/MarketplaceBadges";
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

/**
 * The star row for a rating bound — five stars with `stars` of them filled.
 *
 * Module level, and used by BOTH the Customer Rating filter and its applied-filter chip, so
 * the chip is the same markup rather than a text imitation of it that drifts. It has to be
 * declared out here because the chip list is built during render, before the component's own
 * helpers exist.
 */
const RatingStarRow = ({ stars }) => (
  <span className="filter-stars">
    {[1, 2, 3, 4, 5].map((position) => (
      <Icon
        key={position}
        icon={position <= stars ? "mdi:star" : "mdi:star-outline"}
        className={position <= stars ? "is-on" : "is-off"}
      />
    ))}
    <em>&amp; up</em>
  </span>
);

const getIdListParam = (params, key) =>
  (params.get(key) || "")
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

// A positive number from the URL, or `fallback` when the key is absent or junk. maxPrice
// passes null so "no cap" stays distinguishable from "capped at 0".
const getNumberParam = (params, key, fallback = 0) => {
  const raw = params.get(key);
  if (raw === null || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

// Where the sidebar-only filters are parked across a trip to a product page. See the effect
// that writes it for why this is storage and not the URL.
const FILTER_PARK_KEY = "bk_collection_filters";

const readParkedFilters = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(FILTER_PARK_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

// Everything the URL can encode, normalised to the shape the filter state uses. All values are
// primitives so the effect below can diff them with ===.
//
// `sortBy` now holds ORDERINGS only. `sort=newest` / `sort=special` were the weak sorts that
// merely floated the two curated sets to the top of the whole catalogue; the dropdown offers
// the real filters instead, so those legacy values — and old bookmarks carrying them — resolve
// onto the matching filter rather than a sort that no longer exists.
const readUrlFilters = (params) => {
  const sort = params.get("sort");
  return {
    search: params.get("search") || "",
    variety: params.get("variety") || "",
    occasion: params.get("occasion") || "",
    sortBy: sort === "price_asc" || sort === "price_desc" ? sort : "",
    newArrival: params.get("newArrival") === "true" || sort === "newest",
    specialCollection:
      params.get("specialCollection") === "true" || sort === "special" || sort === "popular",
  };
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
  // Seeded from the URL so back/forward returns to the page you were actually on. Held in the
  // URL rather than in state alone because state does not survive the unmount that navigating
  // to a product causes — coming back always rebuilt at page 1, showing a different twenty
  // sarees than the one you had clicked.
  const [currentPage, setCurrentPage] = useState(() => {
    const raw = Number(searchParams.get("page"));
    return Number.isInteger(raw) && raw > 0 ? raw : 1;
  });
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
  const swipeRef = useRef({});
  const swipeBlockRef = useRef(new Set());

  const [filters, setFilters] = useState(() => {
    // Seeded from the URL, including `sortBy` — the sync effect below deliberately no-ops on
    // the first run, so anything not read here would be ignored until the next URL change.
    const url = readUrlFilters(searchParams);
    const parked = readParkedFilters();
    return {
      variety: getIdListParam(searchParams, "variety"),
      occasion: getIdListParam(searchParams, "occasion"),
      // Restored from the parked copy, then overridden by anything the URL states outright —
      // a hand-written or shared link wins over whatever the last visit left behind. These
      // used to start empty, which is why opening a saree and pressing Back returned a grid
      // with the colour, price, rating and discount picks silently dropped.
      material: getIdListParam(searchParams, "material").length
        ? getIdListParam(searchParams, "material")
        : parked?.material || [],
      color: getIdListParam(searchParams, "color").length
        ? getIdListParam(searchParams, "color")
        : parked?.color || [],
      minPrice: getNumberParam(searchParams, "minPrice") || parked?.minPrice || 0,
      // null = no cap; the slider shows the catalogue ceiling until the shopper drags it down.
      maxPrice: getNumberParam(searchParams, "maxPrice", null) ?? parked?.maxPrice ?? null,
      sortBy: url.sortBy,
      search: url.search,
      // Arrive from the home page's New Arrivals "View Collection" / Exclusive Picks "View All".
      newArrival: url.newArrival,
      specialCollection: url.specialCollection,
      // Rating and discount lower bounds. 0 = no bound.
      minRating: getNumberParam(searchParams, "minRating") || parked?.minRating || 0,
      minDiscount: getNumberParam(searchParams, "minDiscount") || parked?.minDiscount || 0,
    };
  });

  // The URL-backed filters, as raw strings, so the effect below can tell which ones actually
  // moved. Seeded from the first render so the initial state above is not re-applied.
  const lastUrlFiltersRef = useRef(readUrlFilters(searchParams));

  // Only the URL keys that CHANGED are pushed into state. Copying every key on each run would
  // mean any rewrite — removing an occasion chip, say — also stamped `variety` and `sort` back
  // to whatever the URL held, wiping sidebar picks and the sort the shopper chose from the
  // dropdown, neither of which is in the URL. Diffing keeps back/forward navigation working
  // (the key genuinely changes there) without that collateral damage.
  useEffect(() => {
    const current = readUrlFilters(searchParams);
    const previous = lastUrlFiltersRef.current;
    const changed = Object.keys(current).filter((key) => current[key] !== previous[key]);
    lastUrlFiltersRef.current = current;
    if (!changed.length) return;

    setFilters((prev) => {
      const next = { ...prev };
      let dirty = false;
      const applyValue = (key, value) => {
        if (prev[key] === value) return;
        next[key] = value;
        dirty = true;
      };
      const applyIdList = (key, list) => {
        const held = prev[key];
        if (held.length === list.length && held.every((id, index) => id === list[index])) return;
        next[key] = list;
        dirty = true;
      };

      if (changed.includes("search")) applyValue("search", current.search);
      if (changed.includes("variety")) applyIdList("variety", getIdListParam(searchParams, "variety"));
      if (changed.includes("occasion")) applyIdList("occasion", getIdListParam(searchParams, "occasion"));
      if (changed.includes("sortBy")) applyValue("sortBy", current.sortBy);
      if (changed.includes("newArrival")) applyValue("newArrival", current.newArrival);
      if (changed.includes("specialCollection")) applyValue("specialCollection", current.specialCollection);

      // Handing back `prev` untouched preserves object identity, so the products effect —
      // which is keyed on `filters` — does not fire a second, identical request every time we
      // write the URL to match a change the handlers already applied to state.
      return dirty ? next : prev;
    });
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
      // Match the home rails' own queries, so each grid lists the same sarees the section did.
      // `newArrival` also carries the merchandiser's manual new_arrival_order arrangement.
      if (filters.newArrival) params.append("newArrival", "true");
      if (filters.specialCollection) params.append("specialCollection", "true");
      if (Number(filters.minRating) > 0) params.append("minRating", filters.minRating);
      if (Number(filters.minDiscount) > 0) params.append("minDiscount", filters.minDiscount);

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


  // Not on mount. Every effect runs once when the component mounts, so this was scrolling the
  // grid to the top on arrival — including arrival via BACK from a product page. ScrollToTop
  // restores the saved offset in a LAYOUT effect, which React runs before any passive effect
  // in the tree, so this one ran a moment later and threw the restore away every single time.
  // That is why returning from a product opened here at the top while the home page did not:
  // the home page has no such call.
  //
  // Changing a filter or turning a page still belongs at the top — that is a new set of
  // results, and staying halfway down someone else's scroll position would be meaningless.
  const gridScrollArmed = useRef(false);
  useEffect(() => {
    fetchProducts(currentPage);
    if (!gridScrollArmed.current) {
      gridScrollArmed.current = true;
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [filters, currentPage]);

  // Mirror the page number into the URL. `replace`, so turning pages does not stack a history
  // entry per page — the entry for this grid simply carries the page it is showing, which is
  // what makes BACK from a product land on it. `page` is not one of the keys readUrlFilters
  // looks at, so writing it here cannot feed back into the filter-sync effect above.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (currentPage > 1) next.set("page", String(currentPage));
    else next.delete("page");
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [currentPage, searchParams, setSearchParams]);

  /**
   * Park the sidebar-only filters so leaving for a saree and coming back returns the grid
   * you were looking at. Colour, price, rating and discount live only in this component's
   * state, and navigating to a product unmounts it.
   *
   * sessionStorage rather than the URL, which would be the obvious home for them: Layout
   * renders `<Outlet key={pathname|search|hash} />`, so ANY query-string write remounts this
   * page from scratch. Mirroring filters into the URL therefore threw away every bit of local
   * state on each click — most visibly the mobile filter drawer, which closed the instant a
   * filter was ticked. Storage keeps the round trip working without touching the URL.
   */
  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_PARK_KEY, JSON.stringify({
        material: filters.material,
        color: filters.color,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        minRating: filters.minRating,
        minDiscount: filters.minDiscount,
      }));
    } catch {
      // A full or blocked storage costs the restore, nothing else.
    }
  }, [
    filters.material,
    filters.color,
    filters.minPrice,
    filters.maxPrice,
    filters.minRating,
    filters.minDiscount,
  ]);

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

  // The dropdown is one control over three URL keys, so it always writes all three together —
  // leaving a stale one behind would resurrect the previous choice on reload or on a shared link.
  const syncUrlSelection = ({ newArrival, specialCollection, sortBy }) => {
    const next = new URLSearchParams(searchParams);
    next.delete("sort");
    next.delete("newArrival");
    next.delete("specialCollection");
    if (newArrival) next.set("newArrival", "true");
    if (specialCollection) next.set("specialCollection", "true");
    if (sortBy) next.set("sort", sortBy);
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  };

  // Two of the entries pick a curated collection (a real filter) and two pick a price ordering.
  // They are mutually exclusive because one <select> can only show one of them.
  const handleSortChange = (e) => {
    const value = e.target.value;
    const selection = {
      newArrival: value === "newArrival",
      specialCollection: value === "specialCollection",
      sortBy: value === "newArrival" || value === "specialCollection" ? "" : value,
    };
    setCurrentPage(1);
    setFilters((prev) => ({ ...prev, ...selection }));
    syncUrlSelection(selection);
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
    if (type === "search") {
      setFilters((prev) => ({ ...prev, search: "" }));
      dropUrlKeys(["search"]);
      return;
    }
    // Single-value bounds: clearing means back to 0, not removing an id from a list — the
    // taxonomy branch at the end would call .filter() on a number and throw.
    if (type === "minRating" || type === "minDiscount") {
      setFilters((prev) => ({ ...prev, [type]: 0 }));
      return;
    }
    // The three the dropdown owns. Each clears only itself, but the URL is rewritten as a whole
    // so a legacy `sort=newest` cannot leave the filter it maps to switched back on.
    if (type === "sortBy" || type === "newArrival" || type === "specialCollection") {
      const selection = {
        newArrival: type === "newArrival" ? false : filters.newArrival,
        specialCollection: type === "specialCollection" ? false : filters.specialCollection,
        sortBy: type === "sortBy" ? "" : filters.sortBy,
      };
      setFilters((prev) => ({ ...prev, ...selection }));
      syncUrlSelection(selection);
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
      newArrival: false,
      specialCollection: false,
      // Rating and discount lower bounds. 0 = no bound.
      minRating: 0,
      minDiscount: 0,
    }));
    // `search` is deliberately kept, so its URL key is left alone too.
    dropUrlKeys(["variety", "occasion", "sort", "newArrival", "specialCollection"]);
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
      newArrival: false,
      specialCollection: false,
      // Rating and discount lower bounds. 0 = no bound.
      minRating: 0,
      minDiscount: 0,
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
    if (result?.success) showNotification("Added to cart!", "success");
    else showNotification(result?.message || "Could not add to cart.", "error");
  };

  // Stands in for renderProductCard below, line for line: the 3/4 media box, a two-line
  // name, description, rating, price over MRP, delivery estimate and the add-to-cart
  // button. Built on the real .product-card / .card-details so the grid tracks are
  // already the right height and nothing jumps when the products arrive.
  const renderProductCardSkeleton = (key) => (
    <div key={key} className="product-card product-card-skeleton" aria-hidden="true">
      <div className="card-img-container bk-sk skeleton-img" />
      <div className="card-details">
        <span className="bk-sk skeleton-line skeleton-title" />
        <span className="bk-sk skeleton-line skeleton-title short" />
        <span className="bk-sk skeleton-line skeleton-description" />
        <span className="bk-sk skeleton-line skeleton-rating" />
        <span className="bk-sk skeleton-line skeleton-price" />
        <span className="bk-sk skeleton-line skeleton-mrp" />
        <span className="bk-sk skeleton-line skeleton-delivery" />
        <span className="bk-sk skeleton-atc" />
      </div>
    </div>
  );

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
            <MarketplaceBadges productId={product.id} />
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
    filters.sortBy !== "" ||
    filters.newArrival ||
    filters.specialCollection ||
    Number(filters.minRating) > 0 ||
    Number(filters.minDiscount) > 0;

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

  // Orderings only. "New Arrivals" / "Exclusive Picks" are filters now and label their own
  // chips — listing them here too is what produced two identical chips for one selection.
  const SORT_LABELS = {
    price_asc: "Price: Low to High",
    price_desc: "Price: High to Low",
  };

  // What the dropdown displays. A curated collection wins over an ordering, since only a
  // hand-written URL can carry both at once.
  const sortSelectValue = filters.newArrival
    ? "newArrival"
    : filters.specialCollection
      ? "specialCollection"
      : filters.sortBy;

  const appliedFilters = [
    ...taxonomyChips("color", colors),
    ...taxonomyChips("variety", varieties),
    ...taxonomyChips("material", materials),
    ...taxonomyChips("occasion", occasions),
  ];

  if (filters.newArrival) {
    appliedFilters.push({ key: "newArrival", type: "newArrival", label: "New Arrivals" });
  }
  if (filters.specialCollection) {
    appliedFilters.push({ key: "specialCollection", type: "specialCollection", label: "Exclusive Picks" });
  }

  const priceLabel = priceChipLabel();
  if (priceLabel) appliedFilters.push({ key: "price", type: "price", label: priceLabel });
  // Both are single-value bounds, so one chip each rather than one per option.
  if (Number(filters.minRating) > 0) {
    appliedFilters.push({
      key: "minRating",
      type: "minRating",
      label: <RatingStarRow stars={filters.minRating} />,
      // The label is markup, so aria-label/title need a spoken form of their own.
      text: `${filters.minRating} stars & up`,
    });
  }
  if (Number(filters.minDiscount) > 0) {
    appliedFilters.push({
      key: "minDiscount",
      type: "minDiscount",
      label: `${filters.minDiscount}% off or more`,
    });
  }
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

  /**
   * "4★ & up" / "40% off & up" — radio-style lower bounds, not checkboxes, because the
   * options are nested: everything matching 4★ also matches 3★, so allowing several at
   * once would only ever resolve to the loosest one. Clicking the active option clears it.
   *
   * Ratings follow the same rule the cards do: a product with no customer reviews is judged
   * on its seed reviews, and one with neither is excluded from any rating bound at all.
   */
  const renderBoundFilter = (filterKey, title, options) => {
    const active = Number(filters[filterKey]) || 0;
    return (
      <div className="filter-section">
        <h3 className="filter-title">{title}</h3>
        <div className="filter-list">
          {options.map((option) => (
            <label key={option.value} className="filter-item">
              <input
                type="checkbox"
                checked={active === option.value}
                onChange={() => {
                  setCurrentPage(1);
                  setFilters((prev) => ({
                    ...prev,
                    [filterKey]: prev[filterKey] === option.value ? 0 : option.value,
                  }));
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    );
  };

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
          {/* The rating is drawn as the row of stars it represents rather than written as
              "4★" — five stars with that many filled is what the shopper is picking, and
              it matches the chips on the product cards below. */}
          {renderBoundFilter("minRating", "Customer Rating", [4, 3, 2].map((stars) => ({
            value: stars,
            label: <RatingStarRow stars={stars} />,
          })))}
          {renderBoundFilter("minDiscount", "Discount", [
            { value: 50, label: "50% off or more" },
            { value: 40, label: "40% off or more" },
            { value: 30, label: "30% off or more" },
            { value: 20, label: "20% off or more" },
            { value: 10, label: "10% off or more" },
          ])}
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
              <select value={sortSelectValue} onChange={handleSortChange}>
                <option value="">{sortSelectValue ? "Clear" : "Sort by"}</option>
                <option value="newArrival">New Arrivals</option>
                <option value="specialCollection">Exclusive Picks</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
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
                  aria-label={`Remove filter ${chip.text || chip.label}`}
                  title={`Remove ${chip.text || chip.label}`}
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

          {/* PAGE_SIZE skeletons, not 8. A full page holds twenty cards, so eight left the
              document less than half its real height while loading — and a scroll restore
              clamps to the height that exists at the time, so returning to a card low in the
              grid landed part-way up it even once the offset was applied correctly. */}
          <div className="product-grid" aria-busy={loading || undefined}>
            {loading ? (
              Array(PAGE_SIZE).fill(0).map((_, i) => renderProductCardSkeleton(i))
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
              <div className="product-grid collection-more-grid" aria-busy={fallbackLoading || undefined}>
                {fallbackLoading ? (
                  Array(8).fill(0).map((_, i) => renderProductCardSkeleton(i))
                ) : (
                  fallbackProducts.map(renderProductCard)
                )}
              </div>
              {!fallbackLoading && fallbackProducts.length > 0 && (
                <div className="collection-more-footer">
                  <button type="button" className="collection-more-link" onClick={showAllProducts}>
                    View All
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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


