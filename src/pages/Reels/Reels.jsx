import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, ShoppingBag, ExternalLink, X, Send, Play, ChevronLeft, Eye } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useNotification } from "../../context/NotificationContext";
import { API_ENDPOINTS } from "../../config/api";
import { getProductCoverImage, getDefaultColorId, getProductImages } from "../../utils/productMedia";
import { getProductStockInfo } from "../../utils/stockStatus";
import "./Reels.css";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const authToken = () => localStorage.getItem("accessToken");

let keySeq = 0;
const asInstance = (reel) => ({ ...reel, _key: `${reel.id}-${keySeq++}` });
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─── One product chip (View Product + Add to Cart) ───────────────────────────
// `full` renders a single-product bar spanning the full width of the reel.
const ProductChip = ({ product, onView, onAdd, full = false }) => {
  const colorId = product.default_color_id ?? getDefaultColorId(product);
  const out = getProductStockInfo(product, colorId).isOutOfStock;
  const mrp = Number(product.mrp_price || 0);
  const sell = Number(product.selling_price || 0);
  const hasDiscount = mrp > sell;
  const discount = Number(product.discount_percent) || (hasDiscount ? Math.round(((mrp - sell) / mrp) * 100) : 0);
  return (
    <div className={`bk-reel-product ${full ? "bk-reel-product--full" : ""}`}>
      <img src={getProductCoverImage(product)} alt={product.name} className="bk-reel-product-img" />
      <div className="bk-reel-product-info">
        <p className="bk-reel-product-name">{product.name}</p>
        <div className="bk-reel-product-pricing">
          {hasDiscount && discount > 0 && <span className="bk-reel-discount">-{discount}%</span>}
          <span className="bk-reel-sell">{money(sell)}</span>
          {hasDiscount && (
            <span className="bk-reel-mrp">MRP <span className="bk-reel-mrp-val">{money(mrp)}</span></span>
          )}
        </div>
      </div>
      <div className="bk-reel-product-actions">
        <button type="button" className="bk-reel-view-btn" onClick={() => onView(product)}>
          <ExternalLink size={14} /> View Detail
        </button>
        <button type="button" className="bk-reel-add-btn" disabled={out} onClick={() => onAdd(product)}>
          <ShoppingBag size={14} /> {out ? "Sold out" : "Add to Bag"}
        </button>
      </div>
    </div>
  );
};

// ─── A single full-screen reel ───────────────────────────────────────────────
const ReelItem = ({ reel, muted, isActive, inter, onActivate, onToggleMute, onLike, onComments, onShare, onViewProduct, onAddToCart }) => {
  const videoRef = useRef(null);
  const rootRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [descOpen, setDescOpen] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.6) onActivate(reel._key, reel.id);
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reel._key, reel.id, onActivate]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      // Try to autoplay with sound; if the browser blocks it, show the play
      // overlay so a tap starts playback (with audio) rather than a stuck frame.
      v.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().then(() => setPaused(false)).catch(() => {}); }
    else { v.pause(); setPaused(true); }
  };

  const products = reel.products || [];

  return (
    <section className="bk-reel" ref={rootRef}>
      <div className="bk-reel-stage">
        <div className="bk-reel-video-wrap" onClick={togglePlay}>
          <video
            ref={videoRef}
            className="bk-reel-video"
            src={reel.video_url}
            poster={reel.thumbnail_url || undefined}
            loop
            muted={muted}
            playsInline
            preload="metadata"
          />
          {paused && (
            <div className="bk-reel-play-overlay"><Play size={54} fill="#fff" /></div>
          )}

          <button type="button" className="bk-reel-mute" onClick={(e) => { e.stopPropagation(); onToggleMute(); }}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Right action rail */}
          <div className="bk-reel-rail">
            <button type="button" className={`bk-reel-action ${inter.liked ? "is-liked" : ""}`} onClick={() => onLike(reel)}>
              <Heart size={26} fill={inter.liked ? "#ff2d55" : "none"} />
              <span>{inter.like_count}</span>
            </button>
            <button type="button" className="bk-reel-action" onClick={() => onComments(reel)}>
              <MessageCircle size={26} />
              <span>{inter.comment_count}</span>
            </button>
            <button type="button" className="bk-reel-action" onClick={() => onShare(reel)}>
              <Share2 size={25} />
              <span>Share</span>
            </button>
            <div className="bk-reel-action bk-reel-views">
              <Eye size={24} />
              <span>{reel.view_count ?? 0}</span>
            </div>
          </div>

          {/* Caption + products */}
          <div className="bk-reel-bottom" onClick={(e) => e.stopPropagation()}>
            {(reel.title || reel.description) && (
              <h3 className="bk-reel-title">
                {reel.title}
                {reel.description && (
                  <button type="button" className="bk-reel-more" onClick={() => setDescOpen((v) => !v)}>
                    {descOpen ? "less" : "more"}
                  </button>
                )}
              </h3>
            )}
            {descOpen && reel.description && <p className="bk-reel-desc">{reel.description}</p>}
            {products.length === 1 ? (
              <ProductChip product={products[0]} full onView={onViewProduct} onAdd={onAddToCart} />
            ) : products.length > 1 ? (
              <div className="bk-reel-products">
                {products.map((p) => (
                  <ProductChip key={p.id} product={p} onView={onViewProduct} onAdd={onAddToCart} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export default function Reels() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { showNotification } = useNotification();

  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false); // audio on by default
  const [activeKey, setActiveKey] = useState(null);
  const [interactions, setInteractions] = useState({}); // { [id]: { liked, like_count, comment_count } }

  const [openReel, setOpenReel] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);

  const baseReels = useRef([]);
  const viewed = useRef(new Set());

  // Initial load
  useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        const headers = authToken() ? { Authorization: `Bearer ${authToken()}` } : {};
        const res = await fetch(`${API_ENDPOINTS.reels}?limit=30`, { headers });
        const data = await res.json();
        const reels = Array.isArray(data.reels) ? data.reels : [];
        if (ignore) return;
        baseReels.current = reels;
        const inter = {};
        reels.forEach((r) => {
          inter[r.id] = { liked: !!r.is_liked, like_count: r.like_count || 0, comment_count: r.comment_count || 0 };
        });
        // Optional deep link (?reel=<id>) surfaces that reel first.
        const focusId = Number(searchParams.get("reel"));
        const ordered = focusId
          ? [...reels].sort((a, b) => (a.id === focusId ? -1 : b.id === focusId ? 1 : 0))
          : reels;
        setInteractions(inter);
        setFeed(ordered.map(asInstance));
      } catch {
        if (!ignore) setFeed([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    run();
    return () => { ignore = true; };
  }, [searchParams]);

  const interOf = (reel) =>
    interactions[reel.id] || {
      liked: !!reel.is_liked,
      like_count: reel.like_count || 0,
      comment_count: reel.comment_count || 0,
    };

  const handleActivate = useCallback((key, id) => {
    setActiveKey(key);

    // Count a view once per reel per session.
    if (!viewed.current.has(id)) {
      viewed.current.add(id);
      fetch(`${API_ENDPOINTS.reels}/${id}/view`, { method: "POST" }).catch(() => {});
    }

    // Infinite feed: when near the end, append a reshuffled copy so it never runs out.
    setFeed((prev) => {
      const idx = prev.findIndex((r) => r._key === key);
      if (idx >= prev.length - 2 && baseReels.current.length > 0) {
        return [...prev, ...shuffle(baseReels.current).map(asInstance)];
      }
      return prev;
    });
  }, []);

  const requireLogin = (verb) => {
    if (user) return true;
    showNotification(`Please log in to ${verb}.`, "info");
    navigate("/login");
    return false;
  };

  const handleLike = async (reel) => {
    if (!requireLogin("like reels")) return;
    const current = interOf(reel);
    // optimistic
    setInteractions((s) => ({
      ...s,
      [reel.id]: {
        ...current,
        liked: !current.liked,
        like_count: current.like_count + (current.liked ? -1 : 1),
      },
    }));
    try {
      const res = await fetch(`${API_ENDPOINTS.reels}/${reel.id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken()}` },
      });
      const data = await res.json();
      if (res.ok) {
        setInteractions((s) => ({
          ...s,
          [reel.id]: { ...s[reel.id], liked: data.liked, like_count: data.like_count },
        }));
      } else {
        throw new Error();
      }
    } catch {
      setInteractions((s) => ({ ...s, [reel.id]: current })); // rollback
      showNotification("Could not update like.", "error");
    }
  };

  const openComments = async (reel) => {
    setOpenReel(reel);
    setComments([]);
    setCommentsLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.reels}/${reel.id}/comments`);
      const data = await res.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async () => {
    if (!openReel) return;
    if (!requireLogin("comment")) return;
    const text = commentText.trim();
    if (!text) return;
    setPosting(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.reels}/${openReel.id}/comments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: text }),
      });
      if (!res.ok) throw new Error();
      setCommentText("");
      showNotification("Comment submitted — it will appear once approved.", "success");
    } catch {
      showNotification("Could not submit comment.", "error");
    } finally {
      setPosting(false);
    }
  };

  const handleShare = async (reel) => {
    const url = `${window.location.origin}/reels?reel=${reel.id}`;
    const shareData = { title: reel.title || "Banarasi Kala Reel", text: reel.description || "Watch this reel", url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(url);
        showNotification("Link copied to clipboard.", "success");
      }
    } catch {
      /* user dismissed share sheet */
    }
  };

  const handleViewProduct = (product) => {
    if (product.slug) navigate(`/product/${product.slug}`);
  };

  const handleAddToCart = async (product) => {
    const colorId = product.default_color_id ?? getDefaultColorId(product);
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
          images: getProductImages(product), colors: product.colors || [],
        },
        quantity: 1,
        colorId: colorId || null,
      }));
      showNotification("Please log in to add items to your bag.", "info");
      navigate("/login");
      return;
    }
    const result = await addToCart(product, 1, colorId);
    if (result?.success) showNotification("Added to bag!", "success");
    else showNotification(result?.message || "Could not add to bag.", "error");
  };

  if (loading) {
    return (
      <div className="bk-reels-page bk-reels-loading">
        <div className="bk-reels-spinner" />
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="bk-reels-page bk-reels-empty">
        <button type="button" className="bk-reels-back" onClick={() => navigate("/")} aria-label="Back to home">
          <ChevronLeft size={26} />
        </button>
        <h2>No reels yet</h2>
        <p>Check back soon for shoppable videos.</p>
      </div>
    );
  }

  return (
    <div className="bk-reels-page">
      <button type="button" className="bk-reels-back" onClick={() => navigate("/")} aria-label="Back to home">
        <ChevronLeft size={26} />
      </button>
      <div className="bk-reels-feed">
        {feed.map((reel) => (
          <ReelItem
            key={reel._key}
            reel={reel}
            muted={muted}
            isActive={activeKey === reel._key}
            inter={interOf(reel)}
            onActivate={handleActivate}
            onToggleMute={() => setMuted((m) => !m)}
            onLike={handleLike}
            onComments={openComments}
            onShare={handleShare}
            onViewProduct={handleViewProduct}
            onAddToCart={handleAddToCart}
          />
        ))}
      </div>

      {openReel && (
        <div className="bk-reel-comments-backdrop" onClick={() => setOpenReel(null)}>
          <div className="bk-reel-comments" onClick={(e) => e.stopPropagation()}>
            <div className="bk-reel-comments-head">
              <h4>Comments</h4>
              <button type="button" onClick={() => setOpenReel(null)}><X size={20} /></button>
            </div>
            <div className="bk-reel-comments-list">
              {commentsLoading ? (
                <p className="bk-reel-comments-empty">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="bk-reel-comments-empty">No comments yet. Be the first!</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="bk-reel-comment">
                    <div className="bk-reel-comment-avatar">{(c.author || "?").charAt(0).toUpperCase()}</div>
                    <div>
                      <p className="bk-reel-comment-author">{c.author}</p>
                      <p className="bk-reel-comment-text">{c.comment}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="bk-reel-comments-input">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitComment()}
                placeholder={user ? "Add a comment…" : "Log in to comment"}
                maxLength={1000}
              />
              <button type="button" onClick={submitComment} disabled={posting || !commentText.trim()}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
