import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Heart, MessageCircle, Volume2, VolumeX, ShoppingBag, ExternalLink, X, Send, Play, Pause, ChevronLeft, ChevronDown, Eye } from "lucide-react";
import { Icon } from "@iconify/react";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useNotification } from "../../context/NotificationContext";
import { API_ENDPOINTS } from "../../config/api";
import UserAvatar from "../../components/UserAvatar";
import { getProductCoverImage, getDefaultColorId, getProductImages } from "../../utils/productMedia";
import { getProductStockInfo } from "../../utils/stockStatus";
import "./Reels.css";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
// Token may live in localStorage ("keep me logged in") OR sessionStorage —
// checking both keeps is_liked/likes working for session-only logins.
const authToken = () =>
  localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken");

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

// Comment age, in the compact form every feed uses — "3h", "2d". Exact times don't
// matter in a conversation; "is this recent" does, and that reads at a glance.
const timeAgo = (value) => {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.floor(days / 365) >= 1 ? `${Math.floor(days / 365)}y` : `${Math.floor(days / 30)}mo`}`;
};

// ─── One comment, in a thread or at its root ─────────────────────────────────
// Replies are the same row a notch smaller and indented; nothing else changes, because a
// reply is not a different kind of thing from the comment it answers. Delete only shows
// on your own — moderation beyond that is the admin's, from the admin panel.
const CommentRow = ({ comment, isReply = false, isMine = false, onReply, onDelete }) => (
  <div className={`bk-reel-comment${isReply ? " is-reply" : ""}`}>
    <UserAvatar
      name={comment.author}
      src={comment.author_avatar}
      size={isReply ? 26 : 34}
      className="bk-reel-comment-avatar"
    />
    <div className="bk-reel-comment-body">
      <p className="bk-reel-comment-author">
        {comment.author}
        {isMine && <span className="bk-reel-comment-you">You</span>}
        <span className="bk-reel-comment-time">{timeAgo(comment.created_at)}</span>
      </p>
      <p className="bk-reel-comment-text">{comment.comment}</p>
      <div className="bk-reel-comment-actions">
        <button type="button" className="bk-reel-comment-reply" onClick={onReply}>
          Reply
        </button>
        {isMine && (
          <button type="button" className="bk-reel-comment-reply is-delete" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </div>
  </div>
);

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
const ReelItem = ({ reel, muted, isActive, inter, showProducts, onToggleProducts, onActivate, onToggleMute, onLike, onComments, onShare, onViewProduct, onAddToCart }) => {
  const videoRef = useRef(null);
  const rootRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  // True while the browser has stalled for data. Driven by the video's own waiting/playing
  // events rather than a timer, so the spinner tracks the real buffer instead of guessing.
  const [buffering, setBuffering] = useState(false);
  // The icon that flashes on a tap — "play" or "pause" — then clears itself. Separate from
  // `paused` because it says what just HAPPENED, while `paused` says what the state IS.
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(0);

  // "Hidden" means the whole bottom overlay is stood down, not just the product card.
  // Only reachable on a reel that has products, because the Shop pill is the way back.
  const collapsed = !showProducts && (reel.products || []).length > 0;

  // An expanded description that is hidden and later brought back should return closed —
  // otherwise the Shop pill restores a wall of text the reader had already dealt with.
  useEffect(() => {
    if (collapsed) setDescOpen(false);
  }, [collapsed]);

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

  /**
   * Buffering, from the element itself.
   *
   * `waiting` fires when playback stalls for data and `playing` when it resumes, which is
   * the only honest signal — a reel that is merely slow looks identical to one that has
   * frozen, and without this the viewer is left tapping a still frame wondering which.
   * `canplay`/`error` also clear it so the spinner can never outlive the problem.
   */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const start = () => setBuffering(true);
    const stop = () => setBuffering(false);
    v.addEventListener("waiting", start);
    v.addEventListener("stalled", start);
    v.addEventListener("playing", stop);
    v.addEventListener("canplay", stop);
    v.addEventListener("error", stop);
    return () => {
      v.removeEventListener("waiting", start);
      v.removeEventListener("stalled", start);
      v.removeEventListener("playing", stop);
      v.removeEventListener("canplay", stop);
      v.removeEventListener("error", stop);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  // Shows the action just taken, then fades. The persistent play badge below covers the
  // resting paused state; this covers the moment of the tap, which is what tells the
  // viewer their tap landed at all.
  const flashIcon = (kind) => {
    setFlash(kind);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 500);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setPaused(false)).catch(() => {});
      flashIcon("play");
    } else {
      v.pause();
      setPaused(true);
      flashIcon("pause");
    }
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
          {/* Buffering wins the middle of the screen: while it is spinning the video is
              not paused, it is loading, and offering a play badge would invite a tap that
              does nothing. */}
          {buffering && (
            <div className="bk-reel-loading" aria-label="Loading video">
              <span className="bk-reel-loading-ring" />
            </div>
          )}

          {/* The resting state: paused and waiting for a tap. Hidden during the flash so
              the two never stack on top of each other. */}
          {paused && !buffering && flash !== "pause" && (
            <div className="bk-reel-play-overlay"><Play size={54} fill="#fff" /></div>
          )}

          {/* The tap itself — what just happened, then gone. */}
          {flash && !buffering && (
            <div className="bk-reel-play-overlay bk-reel-flash" key={flash}>
              {flash === "pause" ? <Pause size={54} fill="#fff" /> : <Play size={54} fill="#fff" />}
            </div>
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
              <Send size={25} />
              <span>Share</span>
            </button>
            <div className="bk-reel-action bk-reel-views">
              <Eye size={24} />
              <span>{reel.view_count ?? 0}</span>
            </div>
          </div>

          {/* Caption + products.
              The hide handle clears the whole overlay, caption included — the point of
              pressing it is to see the saree, and a title and description left sitting
              over the video defeat that as much as the card did. Everything comes back
              with the Shop pill, which is all that stays behind.
              Guarded on `products.length`: with no products there is no pill to bring
              them back with, so on those reels the caption always shows. */}
          <div
            className={`bk-reel-bottom${collapsed ? " is-collapsed" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            {!collapsed && (reel.title || reel.description) && (
              <h3 className="bk-reel-title">
                {reel.title}
                {reel.description && (
                  <button type="button" className="bk-reel-more" onClick={() => setDescOpen((v) => !v)}>
                    {descOpen ? "less" : "more"}
                  </button>
                )}
              </h3>
            )}
            {!collapsed && descOpen && reel.description && <p className="bk-reel-desc">{reel.description}</p>}
            {products.length > 0 && (showProducts ? (
              <div className="bk-reel-shop">
                {/* Hide handle, pinned to the card's top-right corner. */}
                <button
                  type="button"
                  className="bk-reel-shop-toggle"
                  onClick={onToggleProducts}
                  aria-label="Hide product card"
                >
                  <ChevronDown size={16} />
                </button>
                {products.length === 1 ? (
                  <ProductChip product={products[0]} full onView={onViewProduct} onAdd={onAddToCart} />
                ) : (
                  <div className="bk-reel-products">
                    {products.map((p) => (
                      <ProductChip key={p.id} product={p} onView={onViewProduct} onAdd={onAddToCart} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Card tucked away — a compact button in its place brings it back.
              <button
                type="button"
                className="bk-reel-shop-show"
                onClick={onToggleProducts}
                aria-label="Show product card"
              >
                <ShoppingBag size={15} /> Shop
              </button>
            ))}
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
  // Separate from "feed is empty": one means the request failed and is worth retrying,
  // the other means the store genuinely has no reels. They must not look the same.
  const [feedError, setFeedError] = useState(false);
  const [muted, setMuted] = useState(false); // audio on by default
  // One shoppable-card preference for the whole feed: hiding on any reel hides it on all of
  // them. It lives here (not per reel and not persisted), so it resets to "shown" whenever the
  // viewer leaves the page and comes back, since that unmounts and remounts this component.
  const [showProducts, setShowProducts] = useState(true);
  const [activeKey, setActiveKey] = useState(null);
  const [interactions, setInteractions] = useState({}); // { [id]: { liked, like_count, comment_count } }

  const [openReel, setOpenReel] = useState(null);
  const [shareReel, setShareReel] = useState(null); // reel currently in the share sheet
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  // The thread the composer is aimed at: { id (thread root), author } — null writes a new
  // top-level comment. Cleared after posting and whenever the sheet closes.
  const [replyTo, setReplyTo] = useState(null);
  // Thread roots whose replies are expanded. Collapsed by default so a long argument
  // under one comment cannot bury every other comment on the reel.
  const [openThreads, setOpenThreads] = useState(() => new Set());
  // The comment awaiting a delete confirmation: { comment, replyCount }. Null = no sheet.
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const commentInputRef = useRef(null);

  const baseReels = useRef([]);
  const viewed = useRef(new Set());

  /**
   * Load the feed.
   *
   * Kept callable so the error state below can retry it without a full page reload —
   * a reel feed that failed on a dropped connection should come back on a tap, not
   * make the reader work out that they need to refresh.
   *
   * `res.ok` is checked, which it was not before: an API returning 500 with a JSON body
   * yielded `data.reels === undefined`, that became an empty array, and the page told
   * the customer "No reels yet. Check back soon" — a server fault reported as an empty
   * catalogue. A failure now says it failed.
   */
  const loadFeed = useCallback(async (signal) => {
    setLoading(true);
    setFeedError(false);
    try {
      const headers = authToken() ? { Authorization: `Bearer ${authToken()}` } : {};
      const res = await fetch(`${API_ENDPOINTS.reels}?limit=30`, { headers, signal });
      if (!res.ok) throw new Error(`Reels request failed (${res.status})`);
      const data = await res.json();
      const reels = Array.isArray(data.reels) ? data.reels : [];
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
    } catch (err) {
      // An abort is this component unmounting or re-running, not a failure to report.
      if (err?.name === "AbortError") return;
      setFeed([]);
      setFeedError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [searchParams]);

  // Initial load. AbortController rather than an `ignore` flag so a feed left behind by
  // a fast re-navigation is actually cancelled instead of merely discarded on arrival.
  useEffect(() => {
    const controller = new AbortController();
    loadFeed(controller.signal);
    return () => controller.abort();
  }, [loadFeed]);

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

  // Same distinction as the feed: a failed fetch used to leave the sheet saying
  // "No comments yet. Be the first!", which invites the reader to re-write a thread
  // that is already there and merely did not load.
  const loadComments = useCallback(async (reelId) => {
    setCommentsLoading(true);
    setCommentsError(false);
    try {
      const res = await fetch(`${API_ENDPOINTS.reels}/${reelId}/comments`);
      if (!res.ok) throw new Error(`Comments request failed (${res.status})`);
      const data = await res.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch {
      setComments([]);
      setCommentsError(true);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const openComments = (reel) => {
    setOpenReel(reel);
    setComments([]);
    setReplyTo(null);
    setOpenThreads(new Set());
    loadComments(reel.id);
  };

  const closeComments = () => {
    setOpenReel(null);
    setReplyTo(null);
    setCommentText("");
    // The dialog renders outside the sheet, so it would outlive it — and confirming
    // then needs a reel that is no longer open.
    setPendingDelete(null);
  };

  const toggleThread = (rootId) => {
    setOpenThreads((current) => {
      const next = new Set(current);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  };

  /**
   * Aim the composer at a thread.
   *
   * `root` is the thread this reply joins; `author` is who is actually being answered —
   * the two differ when replying to a reply, since threads are one level deep. In that
   * case the name is seeded into the box as "@name ", which is how the answer stays
   * legible once it sits flat among its siblings. (Instagram does exactly this.)
   */
  const startReply = (root, author, { mention = false } = {}) => {
    if (!requireLogin("reply")) return;
    setReplyTo({ id: root.id, author });
    setOpenThreads((current) => new Set(current).add(root.id));
    setCommentText(mention ? `@${author} ` : "");
    // Let the chip render before focusing, so the sheet does not scroll to a moving target.
    requestAnimationFrame(() => commentInputRef.current?.focus());
  };

  const cancelReply = () => {
    setReplyTo(null);
    setCommentText("");
  };

  /**
   * Remove one of your own comments.
   *
   * Asking happens in `pendingDelete` / the sheet below rather than window.confirm: the
   * browser dialog is chrome-coloured, drops in at the top of the screen away from the
   * thumb, and cannot say which comment it means. This one sits over the thread it is
   * about and quotes it.
   *
   * Deleting a thread root takes its replies with it, so the question says how many are
   * going — the reader cannot see collapsed replies while deciding, and finding out
   * afterwards is too late.
   */
  const confirmDeleteComment = async () => {
    if (!pendingDelete || deleting) return;
    const { comment } = pendingDelete;
    const isRoot = !comment.parent_id;
    setDeleting(true);

    try {
      const res = await fetch(`${API_ENDPOINTS.reels}/comments/${comment.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "");

      setComments((current) =>
        isRoot
          ? current.filter((root) => root.id !== comment.id)
          : current.map((root) =>
              root.id === comment.parent_id
                ? { ...root, replies: (root.replies || []).filter((r) => r.id !== comment.id) }
                : root
            )
      );

      // Deleting the thread the composer was aimed at would leave it pointing at a row
      // that no longer exists, and the next post would be rejected by the server.
      if (isRoot) setReplyTo((target) => (target?.id === comment.id ? null : target));

      const removed = Number(data.removed) || 1;
      setInteractions((s) => {
        const current = s[openReel.id] || interOf(openReel);
        return {
          ...s,
          [openReel.id]: {
            ...current,
            comment_count: Math.max(0, (current.comment_count || 0) - removed),
          },
        };
      });
    } catch (err) {
      showNotification(err?.message || "Could not delete your comment.", "error");
    } finally {
      // Closed either way: on success there is nothing left to ask about, and on failure
      // the error notification carries the news — leaving the sheet up would read as
      // though the question were still open.
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const submitComment = async () => {
    if (!openReel) return;
    if (!requireLogin("comment")) return;
    const text = commentText.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.reels}/${openReel.id}/comments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: text, parent_id: replyTo?.id ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "");

      // The comment comes back finished and already live, so it goes straight into the
      // open thread — no re-fetch, and nothing to wait for.
      const posted = data.comment;
      if (posted?.parent_id) {
        setComments((current) =>
          current.map((root) =>
            root.id === posted.parent_id
              ? { ...root, replies: [...(root.replies || []), posted] }
              : root
          )
        );
        setOpenThreads((current) => new Set(current).add(posted.parent_id));
      } else if (posted) {
        setComments((current) => [{ ...posted, replies: [] }, ...current]);
      }

      // The rail's count includes replies, so every post bumps it.
      setInteractions((s) => {
        const current = s[openReel.id] || interOf(openReel);
        return { ...s, [openReel.id]: { ...current, comment_count: (current.comment_count || 0) + 1 } };
      });

      setCommentText("");
      setReplyTo(null);
    } catch (err) {
      showNotification(err?.message || "Could not post your comment.", "error");
    } finally {
      setPosting(false);
    }
  };

  // Confirms the share URL already serves fully rendered OG meta tags (the
  // serverless /reels?reel= route) before opening the share sheet, so link
  // scrapers never see a half-ready page. Returns false if meta isn't ready.
  const ensureShareMetaReady = async (url) => {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const html = response.ok ? await response.text() : "";
      if (html.includes('property="og:image"')) return true;
      showNotification("Share preview is still preparing — try again in a moment.", "info");
    } catch {
      showNotification("Could not prepare the share link. Check your connection.", "error");
    }
    return false;
  };

  const shareUrlOf = (reel) => `${window.location.origin}/reels?reel=${reel.id}`;

  // Instagram-style share: the paper-plane button opens a destination sheet.
  // Opening it also warms the serverless OG route in the background, so link
  // previews are rendered by the time the user picks a destination.
  const openShare = (reel) => {
    setShareReel(reel);
    fetch(shareUrlOf(reel), { cache: "no-store" }).catch(() => {});
  };

  const shareToApp = (app) => {
    if (!shareReel) return;
    const url = shareUrlOf(shareReel);
    const title = shareReel.title || "Banarasi Kala Reel";
    const enc = encodeURIComponent;
    const targets = {
      whatsapp: `https://wa.me/?text=${enc(`${title} ${url}`)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`,
      x: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`,
    };
    if (targets[app]) window.open(targets[app], "_blank", "noopener,noreferrer");
    setShareReel(null);
  };

  const copyShareLink = async () => {
    if (!shareReel) return;
    try {
      await navigator.clipboard.writeText(shareUrlOf(shareReel));
      showNotification("Link copied to clipboard.", "success");
    } catch {
      showNotification("Could not copy the link.", "error");
    }
    setShareReel(null);
  };

  // "More" → the OS share sheet (checks the OG meta is ready first).
  const nativeShare = async () => {
    if (!shareReel) return;
    const reel = shareReel;
    setShareReel(null);
    const url = shareUrlOf(reel);
    if (!(await ensureShareMetaReady(url))) return;
    try {
      // No `text` field: iOS only renders a rich link preview when the share
      // payload is a bare URL (text + url is delivered as plain text).
      if (navigator.share) await navigator.share({ title: reel.title || "Banarasi Kala Reel", url });
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
    // The reel frame itself, not a spinner in the void: the stage, the right-hand action
    // rail and the caption block all land where they will be once the feed arrives, so
    // the first reel appears into a shape the reader is already looking at. The back
    // button is real — it works during the wait, which a spinner screen did not allow.
    return (
      <div className="bk-reels-page bk-reels-loading" aria-busy="true" aria-label="Loading reels">
        <button type="button" className="bk-reels-back" onClick={() => navigate("/")} aria-label="Back to home">
          <ChevronLeft size={26} />
        </button>
        <div className="bk-reel" aria-hidden="true">
          <div className="bk-reel-stage">
            <div className="bk-reel-video-wrap bk-sk bk-sk--dark bk-reel-sk-video">
              <span className="bk-reel-sk-mute" />

              <div className="bk-reel-rail">
                {[1, 2, 3, 4].map((action) => (
                  <span className="bk-reel-sk-action" key={action}>
                    <span className="bk-reel-sk-glyph" />
                    <span className="bk-reel-sk-count" />
                  </span>
                ))}
              </div>

              <div className="bk-reel-bottom bk-reel-sk-bottom">
                <span className="bk-reel-sk-title" />
                <span className="bk-reel-sk-shop" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Checked BEFORE the empty state: a request that failed left `feed` empty too, and
  // falling through to "No reels yet" would blame the catalogue for a network fault and
  // leave the reader with nothing to press.
  if (feedError) {
    return (
      <div className="bk-reels-page bk-reels-empty">
        <button type="button" className="bk-reels-back" onClick={() => navigate("/")} aria-label="Back to home">
          <ChevronLeft size={26} />
        </button>
        <Icon icon="lucide:wifi-off" className="bk-reels-error-icon" />
        <h2>Could not load reels</h2>
        <p>Check your connection and try again.</p>
        <button type="button" className="bk-reels-retry" onClick={() => loadFeed()}>
          <Icon icon="lucide:rotate-cw" />
          Try again
        </button>
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
            showProducts={showProducts}
            onToggleProducts={() => setShowProducts((v) => !v)}
            onActivate={handleActivate}
            onToggleMute={() => setMuted((m) => !m)}
            onLike={handleLike}
            onComments={openComments}
            onShare={openShare}
            onViewProduct={handleViewProduct}
            onAddToCart={handleAddToCart}
          />
        ))}
      </div>

      {openReel && (
        <div className="bk-reel-comments-backdrop" onClick={closeComments}>
          <div className="bk-reel-comments" onClick={(e) => e.stopPropagation()}>
            <div className="bk-reel-comments-head">
              <h4>Comments</h4>
              <button type="button" onClick={closeComments}><X size={20} /></button>
            </div>
            <div className="bk-reel-comments-list">
              {commentsLoading ? (
                <p className="bk-reel-comments-empty">Loading…</p>
              ) : commentsError ? (
                <div className="bk-reel-comments-error">
                  <Icon icon="lucide:wifi-off" />
                  <p>Could not load comments.</p>
                  <button type="button" onClick={() => loadComments(openReel.id)}>
                    <Icon icon="lucide:rotate-cw" />
                    Try again
                  </button>
                </div>
              ) : comments.length === 0 ? (
                <p className="bk-reel-comments-empty">No comments yet. Be the first!</p>
              ) : (
                comments.map((root) => {
                  const replies = root.replies || [];
                  const expanded = openThreads.has(root.id);
                  return (
                    <div key={root.id} className="bk-reel-thread">
                      <CommentRow
                        comment={root}
                        isMine={user && String(user.id) === String(root.author_id)}
                        onReply={() => startReply(root, root.author)}
                        onDelete={() => setPendingDelete({ comment: root, replyCount: replies.length })}
                      />

                      {replies.length > 0 && (
                        <button
                          type="button"
                          className="bk-reel-thread-toggle"
                          onClick={() => toggleThread(root.id)}
                          aria-expanded={expanded}
                        >
                          <i aria-hidden="true" />
                          {expanded
                            ? "Hide replies"
                            : `View ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
                        </button>
                      )}

                      {expanded && (
                        <div className="bk-reel-replies">
                          {replies.map((reply) => (
                            <CommentRow
                              key={reply.id}
                              comment={reply}
                              isReply
                              isMine={user && String(user.id) === String(reply.author_id)}
                              // Replying to a reply joins the same thread; the name is
                              // seeded as "@author" so the answer still reads correctly
                              // once it sits flat beside its siblings.
                              onReply={() => startReply(root, reply.author, { mention: true })}
                              onDelete={() => setPendingDelete({ comment: reply, replyCount: 0 })}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="bk-reel-comments-compose">
              {replyTo && (
                <div className="bk-reel-replying">
                  <span>Replying to <strong>{replyTo.author}</strong></span>
                  <button type="button" onClick={cancelReply} aria-label="Cancel reply">
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="bk-reel-comments-input">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitComment();
                    // Backing out of an empty reply box drops the thread, so the next
                    // thing typed is a new comment rather than a silent reply.
                    if (e.key === "Escape" && replyTo) cancelReply();
                  }}
                  placeholder={
                    !user ? "Log in to comment" : replyTo ? `Reply to ${replyTo.author}…` : "Add a comment…"
                  }
                  maxLength={1000}
                />
                <button type="button" onClick={submitComment} disabled={posting || !commentText.trim()}>
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation. Sits above the comment sheet rather than replacing it, so
          the thread stays visible behind the question being asked about it. */}
      {pendingDelete && (
        <div
          className="bk-reel-confirm-backdrop"
          onClick={() => !deleting && setPendingDelete(null)}
          role="presentation"
        >
          <div
            className="bk-reel-confirm"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="bk-reel-confirm-title"
          >
            <h4 id="bk-reel-confirm-title">
              {pendingDelete.comment.parent_id ? "Delete reply?" : "Delete comment?"}
            </h4>

            {/* Quoting it is what makes this a question about a specific comment rather
                than a generic "are you sure" the reader has to take on trust. */}
            <p className="bk-reel-confirm-quote">“{pendingDelete.comment.comment}”</p>

            <p className="bk-reel-confirm-note">
              {pendingDelete.replyCount > 0
                ? `This also deletes ${pendingDelete.replyCount} ${pendingDelete.replyCount === 1 ? "reply" : "replies"} to it. This cannot be undone.`
                : "This cannot be undone."}
            </p>

            <div className="bk-reel-confirm-actions">
              <button type="button" className="bk-reel-confirm-cancel" onClick={() => setPendingDelete(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="bk-reel-confirm-delete" onClick={confirmDeleteComment} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {shareReel && (
        <div className="bk-reel-comments-backdrop" onClick={() => setShareReel(null)}>
          <div className="bk-reel-share" onClick={(e) => e.stopPropagation()}>
            <div className="bk-reel-comments-head">
              <h4>Share to</h4>
              <button type="button" onClick={() => setShareReel(null)} aria-label="Close share sheet">
                <X size={20} />
              </button>
            </div>
            <div className="bk-reel-share-grid">
              <button type="button" className="bk-reel-share-opt" onClick={() => shareToApp("whatsapp")}>
                <span className="bk-reel-share-ic" style={{ background: "#25d366" }}>
                  <Icon icon="mdi:whatsapp" />
                </span>
                WhatsApp
              </button>
              <button type="button" className="bk-reel-share-opt" onClick={() => shareToApp("facebook")}>
                <span className="bk-reel-share-ic" style={{ background: "#1877f2" }}>
                  <Icon icon="mdi:facebook" />
                </span>
                Facebook
              </button>
              <button type="button" className="bk-reel-share-opt" onClick={() => shareToApp("telegram")}>
                <span className="bk-reel-share-ic" style={{ background: "#229ed9" }}>
                  <Icon icon="mdi:telegram" />
                </span>
                Telegram
              </button>
              <button type="button" className="bk-reel-share-opt" onClick={() => shareToApp("x")}>
                <span className="bk-reel-share-ic" style={{ background: "#111" }}>
                  <Icon icon="ri:twitter-x-fill" />
                </span>
                X
              </button>
              <button type="button" className="bk-reel-share-opt" onClick={copyShareLink}>
                <span className="bk-reel-share-ic bk-reel-share-ic-muted">
                  <Icon icon="mdi:link-variant" />
                </span>
                Copy link
              </button>
              <button type="button" className="bk-reel-share-opt" onClick={nativeShare}>
                <span className="bk-reel-share-ic bk-reel-share-ic-muted">
                  <Icon icon="mdi:dots-horizontal" />
                </span>
                More
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
