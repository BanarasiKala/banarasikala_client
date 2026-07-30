import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { API_ENDPOINTS } from "../config/api";
import api from "../utils/api";
import { getProductCoverImage } from "../utils/productMedia";
import { useSupport } from "../context/SupportRealtimeContext";
import verticalLogo from "../assets/vertical_logo.png";
import headerBackground from "../assets/header_backgroung.png";
import "./Header.css";

const SIGNUP_BONUS_AMOUNT = Number(import.meta.env.VITE_SIGNUP_BONUS_AMOUNT) || 50;

const formatHeaderMoney = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "₹0";
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const calcDiscount = (mrp, sell) => {
  if (!mrp || !sell || Number(mrp) <= Number(sell)) return 0;
  return Math.round(((Number(mrp) - Number(sell)) / Number(mrp)) * 100);
};

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { showNotification } = useNotification();
  const { getCartCount } = useCart();
  const { getWishlistCount } = useWishlist();
  // Support replies are the one thing that arrives without the customer asking for it. The
  // count comes from the shared support stream rather than a connection of its own — see
  // SupportRealtimeContext.
  const { unread: supportUnread } = useSupport();

  const [sareeOpen, setSareeOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  // Channels we also sell on. Empty until loaded, which hides the menu rather than
  // flashing an empty one.
  const [marketplaces, setMarketplaces] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const [sareeVarieties, setSareeVarieties] = useState([]);
  const [sareeVarietiesStatus, setSareeVarietiesStatus] = useState("idle");
  const [walletBalance, setWalletBalance] = useState(null);
  const [referralCode, setReferralCode] = useState(user?.referral_code || "");
  const [referModalOpen, setReferModalOpen] = useState(false);
  const [referCopied, setReferCopied] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const sareeMenuRef = useRef(null);
  const marketMenuRef = useRef(null);
  const profileMenuRef = useRef(null);
  const mobilePanelRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const varietiesAbortRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const suggestionAbortRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const toplineTrackRef = useRef(null);

  const isAuthPage = location.pathname === "/login";
  const hideHeaderSearch = location.pathname === "/my-orders";
  const userName = user?.name || "User";
  const firstName = userName.split(" ")[0];
  const userPhone = user?.phone || "Welcome to Banarasi Kala";
  const displayedWalletBalance = walletBalance ?? user?.wallet_balance ?? user?.walletBalance ?? 0;
  const walletLabel = formatHeaderMoney(displayedWalletBalance);
  const referralLink = useMemo(() => {
    if (!referralCode) return "";
    const url = new URL("/login", window.location.origin);
    url.searchParams.set("mode", "signup");
    url.searchParams.set("ref", referralCode);
    return url.toString();
  }, [referralCode]);

  useEffect(() => {
    if (!user) {
      setWalletBalance(null);
      setReferralCode("");
      return undefined;
    }

    let active = true;
    const fallbackBalance = user?.wallet_balance ?? user?.walletBalance ?? 0;

    const loadAccountExtras = async () => {
      try {
        const [walletResponse, profileResponse] = await Promise.allSettled([
          api.get("/api/wallet"),
          api.get("/api/customers/me"),
        ]);
        if (!active) return;

        if (walletResponse.status === "fulfilled") {
          setWalletBalance(
            walletResponse.value.data?.wallet_balance ??
              walletResponse.value.data?.balance ??
              fallbackBalance,
          );
        } else {
          setWalletBalance(fallbackBalance);
        }

        if (profileResponse.status === "fulfilled") {
          setReferralCode(profileResponse.value.data?.referral_code || user?.referral_code || "");
        } else {
          setReferralCode(user?.referral_code || "");
        }
      } catch {
        if (!active) return;
        setWalletBalance(fallbackBalance);
        setReferralCode(user?.referral_code || "");
      }
    };

    loadAccountExtras();

    const onWalletUsed = (e) => {
      const deducted = Number(e?.detail?.deducted || 0);
      if (deducted > 0) {
        setWalletBalance((prev) => Math.max(0, (prev ?? fallbackBalance) - deducted));
      }
      api.get("/api/wallet").then((res) => {
        if (!active) return;
        setWalletBalance(
          res.data?.wallet_balance ?? res.data?.balance ?? fallbackBalance
        );
      }).catch(() => {});
    };
    window.addEventListener("bk:wallet-used", onWalletUsed);

    return () => {
      active = false;
      window.removeEventListener("bk:wallet-used", onWalletUsed);
    };
  }, [user?.id, user?.wallet_balance, user?.walletBalance, user?.referral_code]);

  useEffect(() => {
    if (location.pathname !== "/collection") return;
    const query = new URLSearchParams(location.search).get("search") || "";
    setHeaderSearch(query);
  }, [location.pathname, location.search]);

  const fetchSareeVarieties = useCallback(async () => {
    varietiesAbortRef.current?.abort();
    const controller = new AbortController();
    varietiesAbortRef.current = controller;

    setSareeVarietiesStatus("loading");
    try {
      const response = await fetch(API_ENDPOINTS.varieties, { signal: controller.signal });
      if (!response.ok) throw new Error("Unable to load saree varieties");
      const data = await response.json();
      const varieties = Array.isArray(data)
        ? data.filter((item) => item?.id && item?.name).map((item) => ({ id: item.id, name: item.name }))
        : [];
      setSareeVarieties(varieties);
      setSareeVarietiesStatus("success");
    } catch (error) {
      if (error.name !== "AbortError") {
        setSareeVarieties([]);
        setSareeVarietiesStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    fetchSareeVarieties();
    return () => varietiesAbortRef.current?.abort();
  }, [fetchSareeVarieties]);

  // A failure leaves the list empty, which hides the menu — the header must not show a
  // dead dropdown because one request did not come back.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(API_ENDPOINTS.marketplaces, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.marketplaces)) setMarketplaces(data.marketplaces);
      } catch {
        /* menu stays hidden */
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnOutsideTap = (event) => {
      const target = event.target;
      if (
        mobilePanelRef.current?.contains(target) ||
        mobileMenuButtonRef.current?.contains(target)
      ) {
        return;
      }

      setMobileMenuOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideTap);
    document.addEventListener("touchstart", closeOnOutsideTap, { passive: true });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("mousedown", closeOnOutsideTap);
      document.removeEventListener("touchstart", closeOnOutsideTap);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const closeFloatingMenus = (event) => {
      if (
        sareeMenuRef.current &&
        !sareeMenuRef.current.contains(event.target)
      ) {
        setSareeOpen(false);
      }

      if (
        marketMenuRef.current &&
        !marketMenuRef.current.contains(event.target)
      ) {
        setMarketOpen(false);
      }

      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }

      const inDesktop = desktopSearchRef.current?.contains(event.target);
      const inMobile = mobileSearchRef.current?.contains(event.target);
      if (!inDesktop && !inMobile) {
        setSuggestionsOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setProfileOpen(false);
        setSareeOpen(false);
        setSuggestionsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeFloatingMenus);
    document.addEventListener("touchstart", closeFloatingMenus);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeFloatingMenus);
      document.removeEventListener("touchstart", closeFloatingMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const closeMenuWhenFocusLeaves = (event, closeMenu) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      closeMenu(false);
    }
  };

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setProfileOpen(false);
    setSareeOpen(false);
    setSuggestionsOpen(false);
  };

  const handleHeaderSearch = (e) => {
    e.preventDefault();
    const q = headerSearch.trim();
    const targetPath = q ? `/collection?search=${encodeURIComponent(q)}` : "/collection";
    const currentPath = `${location.pathname}${location.search}`;
    navigate(targetPath, {
      replace: currentPath === targetPath,
      state: currentPath === targetPath ? { refreshKey: Date.now() } : undefined,
    });
    closeMenus();
  };

  const handleLogout = () => {
    logout();
    showNotification("Logout successfully", "success");
    closeMenus();
    navigate("/", { state: { refreshKey: Date.now() } });
  };

  const goProtected = (path) => {
    closeMenus();
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    navigate(path, {
      replace: currentPath === path,
      state: currentPath === path ? { refreshKey: Date.now() } : undefined,
    });
  };

  const openReferModal = () => {
    closeMenus();
    setReferCopied(false);
    setReferModalOpen(true);
  };

  const copyReferralLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setReferCopied(true);
      window.setTimeout(() => setReferCopied(false), 1300);
    } catch {
      setReferCopied(false);
    }
  };

  const shareReferralLink = async () => {
    if (!referralLink) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Refer & Earn",
          text: "Sign up using my referral link and get wallet rewards.",
          url: referralLink,
        });
        return;
      }
    } catch (error) {
      // Closing the share sheet meant "not now". Falling through to the copy path put the link
      // on their clipboard and flashed "copied" at them anyway, for an action they cancelled.
      if (error?.name === "AbortError") return;
      // Anything else — no activation left, no share support — still has a useful fallback.
    }
    await copyReferralLink();
  };

  const openLogin = (event) => {
    event.preventDefault();
    closeMenus();
    window.dispatchEvent(new Event("auth:refresh"));
    const targetPath = "/login?refresh=login";
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    navigate(targetPath, {
      replace: currentPath === targetPath,
      state: currentPath === targetPath ? { refreshKey: Date.now() } : undefined,
    });
  };

  const getHeaderOffset = () => {
    const header = document.querySelector(".bk-header");
    const headerHeight = header?.getBoundingClientRect().height || 0;
    return headerHeight + 58;
  };

  const getScrollTarget = (hash) => {
    if (hash === "#new-arrivals") {
      return document.getElementById("new-arrivals-heading") || document.getElementById("new-arrivals");
    }

    try {
      return document.querySelector(hash);
    } catch {
      return null;
    }
  };

  const scrollForTarget = (target) => {
    if (target.hash) {
      const section = getScrollTarget(target.hash);
      if (section) {
        const top = section.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        return true;
      }

      return false;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    return true;
  };

  const refreshNavClick = (to) => (event) => {
    closeMenus();

    const target = new URL(to, window.location.origin);
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    const targetPath = `${target.pathname}${target.search}${target.hash}`;

    if (currentPath === targetPath) {
      event.preventDefault();
      navigate(to, {
        replace: true,
        state: { refreshKey: Date.now() },
      });

      const runScroll = (attempt = 0) => {
        const foundTarget = scrollForTarget(target);
        const needsHeading = target.hash === "#new-arrivals" && !document.getElementById("new-arrivals-heading");
        if ((!foundTarget || needsHeading) && attempt < 8) {
          window.setTimeout(() => runScroll(attempt + 1), 180);
        }
      };

      window.setTimeout(runScroll, 40);
    }
  };

  const fetchSuggestions = useCallback(async (q) => {
    suggestionAbortRef.current?.abort();
    const controller = new AbortController();
    suggestionAbortRef.current = controller;
    try {
      const params = new URLSearchParams({ search: q, limit: "50", view: "collection" });
      const res = await fetch(`${API_ENDPOINTS.products}?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const rows = Array.isArray(data) ? data : (data.items || data.rows || []);
      setSuggestions(rows.slice(0, 20));
      setSuggestionsOpen(rows.length > 0);
    } catch (err) {
      if (err.name !== "AbortError") {
        setSuggestions([]);
        setSuggestionsOpen(false);
      }
    }
  }, []);

  const handleSuggestionClick = (slug) => {
    setSuggestionsOpen(false);
    setSuggestions([]);
    clearTimeout(debounceTimerRef.current);
    suggestionAbortRef.current?.abort();
    navigate(`/product/${slug}`);
  };

  /**
   * Seamless topline ticker — rAF rather than a CSS keyframe, which flashes on reset.
   *
   * Three things used to make it stall or jitter:
   *
   *   1. requestAnimationFrame does not run while the tab is hidden, so the first frame back
   *      reported the entire absence as one delta. Thirty seconds away moved it 1200px in a
   *      single step, and the old wrap added back exactly ONE loop width — which cannot
   *      recover from an overshoot of several, leaving the strip parked off-screen looking
   *      stopped. The delta is now capped and the wrap is a modulo.
   *   2. loopWidth was measured once, on the frame after mount. Web fonts land after that and
   *      change the text width, so the wrap point was computed from fallback metrics and the
   *      seam showed as a jump. It is re-measured whenever the track's width actually changes.
   *   3. A long task (a route change, an image decode) produced the same oversized delta as a
   *      backgrounded tab, on a smaller scale — visible as a lurch.
   */
  useEffect(() => {
    const track = toplineTrackRef.current;
    if (!track) return undefined;

    const COPIES = 4;
    const SPEED = 40; // px per second
    // A gap longer than this is not elapsed animation — it is a backgrounded tab, a long task,
    // or a device waking. Advancing by the true delta teleports the strip; capping it keeps the
    // motion continuous and simply skips the missing time.
    const MAX_FRAME_MS = 50;

    let x = 0;
    let lastTime = null;
    let loopWidth = 0;
    let raf = 0;

    // Keeps an offset inside (-loop, 0] however far it has overshot.
    const wrap = (value, loop) => -((((-value) % loop) + loop) % loop);

    const measure = () => {
      // One copy's width: scrollWidth spans all four, and the strip wraps after exactly one.
      const next = track.scrollWidth / COPIES;
      if (!next || Math.abs(next - loopWidth) < 0.5) return;
      // Re-anchor into the NEW loop, or a re-measure leaves x outside it and the strip jumps.
      if (loopWidth > 0) x = wrap(x, next);
      loopWidth = next;
    };

    const step = (time) => {
      // loopWidth 0 would make the wrap a no-op and let the strip scroll away for good.
      if (lastTime !== null && loopWidth > 0) {
        x -= (SPEED * Math.min(time - lastTime, MAX_FRAME_MS)) / 1000;
        if (x <= -loopWidth) x = wrap(x, loopWidth);
        track.style.transform = `translateX(${x}px)`;
      }
      lastTime = time;
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(() => {
      measure();
      raf = requestAnimationFrame(step);
    });

    // Fonts swap in after first paint and change the width the wrap depends on.
    document.fonts?.ready?.then(measure).catch(() => {});
    const observer = new ResizeObserver(measure);
    observer.observe(track);

    // Dropping lastTime makes the first frame back a no-op instead of a teleport. The cap above
    // would already contain it; this keeps the strip exactly where it was left.
    const onVisible = () => { if (!document.hidden) lastTime = null; };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setHeaderSearch(value);
    clearTimeout(debounceTimerRef.current);
    const q = value.trim();
    if (!q) {
      setSuggestionsOpen(false);
      setSuggestions([]);
      suggestionAbortRef.current?.abort();
      if (location.pathname === "/collection") {
        navigate("/collection", { replace: true });
      }
      return;
    }
    debounceTimerRef.current = window.setTimeout(() => {
      fetchSuggestions(q);
    }, 300);
  };

  return (
    <header
      className={`bk-header${hideHeaderSearch ? " bk-header--no-search" : ""}`}
      style={{ "--bk-header-bg": `url(${headerBackground})` }}
    >
      <div className="bk-topline" aria-hidden="true">
        <div ref={toplineTrackRef} className="bk-topline-track">
          {[...Array(4)].map((_, index) => (
            <p key={index}>
              <span>Free Delivery on All Orders!</span>
              <span className="bk-topline-separator" aria-hidden="true" />
              <span>Grab ₹{SIGNUP_BONUS_AMOUNT} Signup Bonus</span>
            </p>
          ))}
        </div>
      </div>

      {!isAuthPage && <div className="bk-header-shell">
        <button
          ref={mobileMenuButtonRef}
          type="button"
          className="bk-mobile-menu"
          aria-label="Open menu"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className="bk-nav" aria-label="Primary navigation">
          <Link to="/" onClick={refreshNavClick("/")}>Home</Link>
          <div
            ref={sareeMenuRef}
            className="bk-saree-menu"
            onMouseEnter={() => setSareeOpen(true)}
            onMouseLeave={() => setSareeOpen(false)}
            onFocus={() => setSareeOpen(true)}
            onBlur={(event) => closeMenuWhenFocusLeaves(event, setSareeOpen)}
          >
            <button type="button" aria-expanded={sareeOpen}>
              Patterns
              <svg
                width="10"
                height="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {sareeOpen && (
              <div className="bk-dropdown" role="menu">
                {/* Same head/rows as the profile panel, so the header's two menus read as one
                    component. Rows stay text-only to match it. */}
                <div className="bk-dropdown-head">
                  <span className="bk-dropdown-badge" aria-hidden="true">
                    <Icon icon="lucide:layers" />
                  </span>
                  <span className="bk-dropdown-head-copy">
                    <p>Patterns</p>
                    <span>Browse by weave</span>
                  </span>
                </div>

                <div className="bk-dropdown-links">
                  {sareeVarietiesStatus === "loading" && (
                    <span className="bk-dropdown-status">Loading patterns...</span>
                  )}
                  {sareeVarietiesStatus === "error" && (
                    <span className="bk-dropdown-status bk-dropdown-status--error">
                      Unable to load patterns
                      <button type="button" className="bk-dropdown-retry" onClick={fetchSareeVarieties}>
                        Retry
                      </button>
                    </span>
                  )}
                  {sareeVarietiesStatus === "success" &&
                    sareeVarieties.map((variety) => (
                      <Link
                        key={variety.id}
                        role="menuitem"
                        to={`/collection?variety=${variety.id}`}
                        onClick={refreshNavClick(`/collection?variety=${variety.id}`)}
                      >
                        {variety.name}
                      </Link>
                    ))}
                  {sareeVarietiesStatus === "success" &&
                    sareeVarieties.length === 0 && (
                      <span className="bk-dropdown-status">No patterns found</span>
                    )}
                </div>
              </div>
            )}
          </div>
          <Link to="/#new-arrivals" onClick={refreshNavClick("/#new-arrivals")}>New Arrivals</Link>
          <Link to="/collection" onClick={refreshNavClick("/collection")}>Collections</Link>
          <Link to="/reels" onClick={refreshNavClick("/reels")}>Reels</Link>

          {/* Where else we sell. Built like Patterns above so the header's menus behave
              alike, and hidden entirely when there are no channels — an empty dropdown is
              worse than no dropdown. Each row goes to our own /store page, not out to the
              marketplace: that page carries the storefront link and the products. */}
          {marketplaces.length > 0 && (
            <div
              ref={marketMenuRef}
              className="bk-saree-menu"
              onMouseEnter={() => setMarketOpen(true)}
              onMouseLeave={() => setMarketOpen(false)}
              onFocus={() => setMarketOpen(true)}
              onBlur={(event) => closeMenuWhenFocusLeaves(event, setMarketOpen)}
            >
              <button type="button" aria-expanded={marketOpen}>
                Marketplaces
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {marketOpen && (
                <div className="bk-dropdown" role="menu">
                  <div className="bk-dropdown-head">
                    <span className="bk-dropdown-badge" aria-hidden="true">
                      <Icon icon="lucide:store" />
                    </span>
                    <span className="bk-dropdown-head-copy">
                      <p>Marketplaces</p>
                      <span>Also find us here</span>
                    </span>
                  </div>

                  <div className="bk-dropdown-links">
                    {marketplaces.map((market) => (
                      <Link
                        key={market.slug}
                        role="menuitem"
                        to={`/marketplace#${market.slug}`}
                        onClick={() => setMarketOpen(false)}
                        className="bk-market-link"
                      >
                        {market.name}
                        {/* A channel we are not on yet is still worth listing — it is an
                            announcement — but it must not look like a live shop. */}
                        {market.status === "coming_soon" && <em>Soon</em>}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <Link to="/about" onClick={refreshNavClick("/about")}>About Us</Link>
          {/* Contact Us is not in the desktop bar: it made this column wide enough to push the
              logo off centre. Still reachable from the footer and the mobile menu, and "Need
              help?" on the account page opens support chat directly, which is what most people
              were using it for. */}
          {/* The support chat belongs to an account — there is nothing to show a guest.
              Points at My Orders rather than a support page of its own: the chat is opened
              from an order now, so that is where a reply is read. The badge stays because it
              is the only sitewide signal that support has answered — without it a customer
              browsing the shop has no idea, and the count is what makes it worth a trip. */}
          {user && (
            <Link to="/my-orders" onClick={refreshNavClick("/my-orders")} className="bk-support-link">
              Support
              {supportUnread > 0 && (
                <i className="bk-support-dot">{supportUnread > 9 ? "9+" : supportUnread}</i>
              )}
            </Link>
          )}
        </nav>

        <Link
          to="/"
          className="bk-logo-link"
          aria-label="Banarasi Kala home"
          onClick={refreshNavClick("/")}
        >
          <img src={verticalLogo} alt="Banarasi Kala" className="bk-logo" />
        </Link>

        <div className="bk-actions">
          {!hideHeaderSearch && (
            <form
              ref={desktopSearchRef}
              className="bk-search bk-search-desktop"
              onSubmit={handleHeaderSearch}
            >
              <input
                type="search"
                value={headerSearch}
                onChange={handleSearchChange}
                placeholder="Search for Banarasi Sarees"
                autoComplete="off"
              />
              <button type="submit" aria-label="Search">
                <svg
                  width="19"
                  height="19"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </button>
              {suggestionsOpen && suggestions.length > 0 && (
                <div className="bk-suggestions">
                  {suggestions.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="bk-suggestion-item"
                      onClick={() => handleSuggestionClick(product.slug)}
                    >
                      {(() => {
                        const cover = getProductCoverImage(product);
                        return cover
                          ? <img src={cover} alt="" className="bk-suggestion-img" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          : <div className="bk-suggestion-img" />;
                      })()}
                      <div className="bk-suggestion-info">
                        <span className="bk-suggestion-name">{product.name}</span>
                        {product.selling_price && (() => {
                          const sell = Number(product.selling_price);
                          const mrp = Number(product.mrp_price || 0);
                          const disc = calcDiscount(mrp, sell);
                          return (
                            <div className="bk-suggestion-price-row">
                              <span className="bk-suggestion-sell">₹{sell.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              {mrp > sell && <span className="bk-suggestion-mrp">₹{mrp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                              {disc > 0 && <span className="bk-suggestion-disc">({disc}% OFF)</span>}
                            </div>
                          );
                        })()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>
          )}

          {!isAuthPage && (
            <div
              ref={profileMenuRef}
              className="bk-profile-menu"
              onMouseEnter={() => setProfileOpen(true)}
              onMouseLeave={() => setProfileOpen(false)}
              onFocus={() => setProfileOpen(true)}
              onBlur={(event) => closeMenuWhenFocusLeaves(event, setProfileOpen)}
            >
              {user ? (
                <button
                  type="button"
                  className="bk-icon-link bk-profile-trigger"
                  aria-expanded={profileOpen}
                  aria-label="Profile menu"
                >
                  <span className="bk-icon-wrap">
                    <svg
                      width="29"
                      height="29"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span>Profile</span>
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={openLogin}
                  className="bk-icon-link"
                  aria-label="Login"
                >
                  <span className="bk-icon-wrap">
                    <svg
                      width="29"
                      height="29"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      viewBox="0 0 24 24"
                    >
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <path d="M10 17l5-5-5-5" />
                      <path d="M15 12H3" />
                    </svg>
                  </span>
                  <span>Login</span>
                </Link>
              )}

              {profileOpen && user && (
                <div className="bk-profile-panel" role="menu">
                  <div className="bk-profile-head">
                    <span className="bk-profile-avatar" aria-hidden="true">
                      {firstName?.trim()?.[0]?.toUpperCase() || "U"}
                    </span>
                    <span className="bk-profile-head-copy">
                      <p>Hello {firstName}</p>
                      <span>{userPhone}</span>
                    </span>
                  </div>

                  <div className="bk-profile-links">
                    {/* The support badge rides on Orders rather than an entry of its own:
                        the chat opens from an order, so a second row pointing at the same
                        page would be two names for one destination. */}
                    <button type="button" role="menuitem" onClick={() => goProtected("/my-orders")}>
                      <span>Orders</span>
                      {supportUnread > 0 && (
                        <i className="bk-support-dot">{supportUnread > 9 ? "9+" : supportUnread}</i>
                      )}
                    </button>
                    <button type="button" role="menuitem" onClick={() => goProtected("/profile")}>
                      <span>Account</span>
                    </button>
                    <button type="button" role="menuitem" onClick={() => goProtected("/wishlist")}>
                      <span>Wishlist</span>
                    </button>
                    <button type="button" role="menuitem" onClick={() => goProtected("/feedback")}>
                      <span>Feedback</span>
                    </button>
                    {/* Moved here from the desktop nav bar, where it was making that column wide
                        enough to push the logo off centre. This is the right home for it anyway:
                        /contact is a protected route, and this panel only ever renders for a
                        signed-in customer. Sits beside Feedback — both are ways of writing to us. */}
                    <button type="button" role="menuitem" onClick={() => goProtected("/contact")}>
                      <span>Contact Us</span>
                    </button>
                    {/* The one that earns the customer something sits apart and highlighted,
                        so it does not read as just another navigation row. */}
                    <button type="button" role="menuitem" className="bk-profile-refer" onClick={openReferModal}>
                      <span>Refer &amp; Earn</span>
                      <em>Get ₹{SIGNUP_BONUS_AMOUNT}</em>
                    </button>
                  </div>

                  <button type="button" role="menuitem" className="bk-profile-logout" onClick={handleLogout}>
                    <Icon icon="lucide:log-out" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {user && (
            <button
              type="button"
              onClick={() => goProtected("/profile")}
              className="bk-icon-link bk-wallet-action"
              aria-label={`Wallet balance ${walletLabel}`}
            >
              <span className="bk-icon-wrap">
                <svg
                  width="29"
                  height="29"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
                  <path d="M3 7h18v10H3z" />
                  <path d="M16 12h.01" />
                </svg>
              </span>
              <span>Wallet</span>
              <small>{walletLabel}</small>
            </button>
          )}

          {user && (
            <button
              type="button"
              onClick={() => goProtected("/wishlist")}
              className="bk-icon-link bk-wishlist-action"
              aria-label="Wishlist"
            >
              <span className="bk-icon-wrap">
                <svg
                  width="29"
                  height="29"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78a5.5 5.5 0 0 0 1.06-8.84z" />
                </svg>
                {getWishlistCount() > 0 && (
                  <span className="bk-count">{getWishlistCount()}</span>
                )}
              </span>
              <span>Wishlist</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => goProtected("/cart")}
            className="bk-icon-link"
            aria-label="Cart"
          >
            <span className="bk-icon-wrap">
              <svg
                width="29"
                height="29"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                viewBox="0 0 24 24"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {getCartCount() > 0 && (
                <span className="bk-count">{getCartCount()}</span>
              )}
            </span>
            <span>Cart</span>
          </button>
        </div>

        {!hideHeaderSearch && (
          <form ref={mobileSearchRef} className="bk-search bk-search-mobile" onSubmit={handleHeaderSearch}>
            <button type="submit" aria-label="Search">
              <svg
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
            <input
              type="search"
              value={headerSearch}
              onChange={handleSearchChange}
              placeholder="Search for Banarasi Sarees"
              autoComplete="off"
            />
            {suggestionsOpen && suggestions.length > 0 && (
              <div className="bk-suggestions">
                {suggestions.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="bk-suggestion-item"
                    onClick={() => handleSuggestionClick(product.slug)}
                  >
                    <img
                      src={getProductCoverImage(product)}
                      alt=""
                      className="bk-suggestion-img"
                      loading="lazy"
                    />
                    <div className="bk-suggestion-info">
                      <span className="bk-suggestion-name">{product.name}</span>
                      {product.selling_price && (
                        <span className="bk-suggestion-price">
                          ₹{Number(product.selling_price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </form>
        )}
      </div>}

      {!isAuthPage && (
        <div
          className={`bk-mobile-overlay${mobileMenuOpen ? " bk-mobile-overlay--open" : ""}`}
          aria-hidden="true"
        />
      )}

      {!isAuthPage && (
        <nav
          ref={mobilePanelRef}
          className={`bk-mobile-panel${mobileMenuOpen ? " bk-mobile-panel--open" : ""}`}
          aria-label="Mobile navigation"
          aria-hidden={!mobileMenuOpen}
        >
          <div className="bk-mobile-panel-head">
            <span>{user ? `Hello ${firstName}` : "Welcome"}</span>
            <p>{user ? userPhone : "Sign in for orders, wishlist and cart"}</p>
            {user ? (
              <button type="button" className="bk-mobile-wallet" onClick={() => goProtected("/profile")}>
                <span>Wallet</span>
                <strong>{walletLabel}</strong>
              </button>
            ) : null}
          </div>

          <div className="bk-mobile-panel-section bk-mobile-panel-main">
            <Link to="/" onClick={refreshNavClick("/")}>
              Home
            </Link>
            <Link to="/#new-arrivals" onClick={refreshNavClick("/#new-arrivals")}>
              New Arrivals
            </Link>
            <Link to="/collection" onClick={refreshNavClick("/collection")}>
              Collections
            </Link>
            <Link to="/reels" onClick={refreshNavClick("/reels")}>
              Reels
            </Link>
            <span className="bk-mobile-nav-heading">Pattern</span>
            {sareeVarietiesStatus === "loading" && (
              <span className="bk-mobile-panel-muted">Loading varieties...</span>
            )}
            {sareeVarietiesStatus === "success" &&
              sareeVarieties.map((variety) => (
                <Link
                  key={variety.id}
                  className="bk-mobile-variety-link"
                  to={`/collection?variety=${variety.id}`}
                  onClick={refreshNavClick(`/collection?variety=${variety.id}`)}
                >
                  {variety.name}
                </Link>
              ))}
            {sareeVarietiesStatus === "success" && sareeVarieties.length === 0 && (
              <span className="bk-mobile-panel-muted">No varieties found</span>
            )}
            {sareeVarietiesStatus === "error" && (
              <span className="bk-mobile-panel-muted bk-mobile-panel-muted--error">
                Unable to load varieties
                <button type="button" className="bk-mobile-retry" onClick={fetchSareeVarieties}>
                  Retry
                </button>
              </span>
            )}

            {/* Same rows as the desktop dropdown. A heading rather than a nested menu:
                the panel already scrolls, and a second level inside it would hide these
                behind another tap for no gain. */}
            {marketplaces.length > 0 && (
              <>
                <span className="bk-mobile-nav-heading">Marketplaces</span>
                {marketplaces.map((market) => (
                  <Link
                    key={market.slug}
                    className="bk-mobile-variety-link bk-market-link"
                    to={`/marketplace#${market.slug}`}
                    onClick={refreshNavClick(`/marketplace#${market.slug}`)}
                  >
                    {market.name}
                    {market.status === "coming_soon" && <em>Soon</em>}
                  </Link>
                ))}
              </>
            )}

            <button type="button" onClick={() => goProtected("/wishlist")}>
              Wishlist
            </button>
            <Link to="/about" onClick={refreshNavClick("/about")}>
              About Us
            </Link>
            {user ? (
              <>
                {/* Badge on Orders — see the profile menu above. */}
                <button type="button" onClick={() => goProtected("/my-orders")}>
                  Orders
                  {supportUnread > 0 && (
                    <i className="bk-support-dot">{supportUnread > 9 ? "9+" : supportUnread}</i>
                  )}
                </button>
                <button type="button" onClick={() => goProtected("/profile")}>
                  Account
                </button>
                <button type="button" className="bk-mobile-logout" onClick={handleLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login?mode=signup" onClick={refreshNavClick("/login?mode=signup")}>
                  Sign Up
                </Link>
                <Link to="/login" onClick={openLogin}>
                  Login
                </Link>
              </>
            )}
          </div>

          <div className="bk-mobile-panel-section bk-mobile-help-section">
            <span className="bk-mobile-panel-title">Help</span>
            <Link to="/contact" onClick={refreshNavClick("/contact")}>
              Contact Us
            </Link>
            <Link to="/feedback" onClick={refreshNavClick("/feedback")}>
              Feedback
            </Link>
          </div>
        </nav>
      )}

      {!isAuthPage && referModalOpen && user && (
        <div className="bk-refer-modal" role="dialog" aria-modal="true" aria-labelledby="bk-refer-title">
          <div className="bk-refer-card">
            <button
              type="button"
              className="bk-refer-close"
              onClick={() => setReferModalOpen(false)}
              aria-label="Close refer and earn"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            <span className="bk-refer-kicker">Refer & Earn</span>
            <h2 id="bk-refer-title">Invite friends, earn wallet rewards</h2>
            <p>Share your referral link. Your friend can sign up from this link and rewards will be added as per the active offer.</p>

            <div className="bk-refer-code">
              <span>Your code</span>
              <strong>{referralCode || "Not available"}</strong>
            </div>

            <label className="bk-refer-link">
              <span>Referral link</span>
              <input value={referralLink || "Referral link not available"} readOnly />
            </label>

            <div className="bk-refer-actions">
              <button type="button" onClick={copyReferralLink} disabled={!referralLink}>
                {referCopied ? "Copied" : "Copy Link"}
              </button>
              <button type="button" className="primary" onClick={shareReferralLink} disabled={!referralLink}>
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

