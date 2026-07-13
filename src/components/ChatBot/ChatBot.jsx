import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { API_ENDPOINTS } from "../../config/api";
import "./ChatBot.css";

const BOT_NAME = "Kala";
const WELCOME = {
  from: "bot",
  text: "Namaste! I'm Kala, your Banarasi Kala assistant.\n\nAsk me about our sarees — a colour, a budget, an occasion — and I'll find them for you.",
};

const QUICK_REPLIES = [
  "Sarees under ₹5,000",
  "Something for a wedding",
  "Lightweight for summer",
  "Track my order",
  "Return policy",
];

const formatPrice = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * Product cards are rendered from the TOOL RESULT the server streams down — never parsed out
 * of the assistant's prose. The model describes the sarees; React renders them from real rows.
 * That is what makes it impossible for a hallucinated price to reach the screen.
 */
const ProductCards = ({ products, onNavigate }) => (
  <div className="bk-chat-products">
    {products.map((p) => (
      <Link
        key={p.product_id}
        to={`/product/${p.slug}`}
        className="bk-chat-product"
        onClick={onNavigate}
      >
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} loading="lazy" />
        ) : (
          <span className="bk-chat-product-noimg" aria-hidden="true" />
        )}
        <span className="bk-chat-product-body">
          <span className="bk-chat-product-name">{p.name}</span>
          <span className="bk-chat-product-price">
            {formatPrice(p.price)}
            {p.mrp > p.price && <s>{formatPrice(p.mrp)}</s>}
          </span>
          {!p.in_stock && <span className="bk-chat-product-oos">Sold out</span>}
        </span>
      </Link>
    ))}
  </div>
);

const ChatBot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  // The server owns the transcript; this is just the handle to it.
  const [chatId, setChatId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const hasOpened = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      hasOpened.current = true;
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const addBotMessage = (text) => {
    setMessages((prev) => [...prev, { from: "bot", text }]);
    if (!open) setUnread((n) => n + 1);
  };

  /**
   * Streams the reply over SSE.
   *
   * EventSource cannot POST (and cannot send an Authorization header), so we read the response
   * body stream ourselves. Events arrive as `event: <name>\ndata: <json>\n\n`.
   */
  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { from: "user", text: trimmed }]);
    setInput("");
    setLoading(true);

    // The bot's bubble grows in place as deltas arrive.
    let botIndex = -1;
    const appendDelta = (delta) => {
      setMessages((prev) => {
        const next = [...prev];
        if (botIndex === -1) {
          botIndex = next.length;
          next.push({ from: "bot", text: delta });
        } else {
          next[botIndex] = { ...next[botIndex], text: (next[botIndex].text || "") + delta };
        }
        return next;
      });
    };

    const attachProducts = (products) => {
      setMessages((prev) => {
        const next = [...prev];
        if (botIndex === -1) {
          botIndex = next.length;
          next.push({ from: "bot", text: "", products });
        } else {
          const existing = next[botIndex].products || [];
          next[botIndex] = { ...next[botIndex], products: [...existing, ...products] };
        }
        return next;
      });
    };

    try {
      const token =
        localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken");

      const res = await fetch(API_ENDPOINTS.chatbotMessage, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // chat_id ties this turn to the stored conversation. The server holds the history —
        // we never send it back, so a crafted request can't forge what the bot "already said".
        body: JSON.stringify({ message: trimmed, chat_id: chatId }),
      });

      if (!res.ok || !res.body) throw new Error("stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line. Keep the trailing partial in the buffer.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";

        for (const frame of frames) {
          const evLine = frame.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!evLine || !dataLine) continue;

          const event = evLine.slice(7).trim();
          let data = {};
          try {
            data = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }

          if (event === "text" && data.delta) appendDelta(data.delta);
          else if (event === "products" && data.products?.length) attachProducts(data.products);
          else if (event === "cart_updated") window.dispatchEvent(new Event("cart:refresh"));
          else if (event === "done") {
            if (data.chat_id) setChatId(data.chat_id);
          }
        }
      }

      if (botIndex === -1) {
        addBotMessage("I didn't quite catch that. Could you rephrase?");
      } else if (!open) {
        setUnread((n) => n + 1);
      }
    } catch {
      addBotMessage("Sorry, I'm having trouble connecting. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const handleQuickReply = (text) => {
    send(text);
  };

  const showQuickReplies = messages.length === 1;

  return (
    <div ref={containerRef}>
      {/* Floating toggle button */}
      <button
        type="button"
        className="bk-chat-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open chat assistant"}
        aria-expanded={open}
      >
        <span className={`bk-chat-fab-icon ${open ? "bk-chat-fab-icon--close" : ""}`}>
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
        </span>
        {!open && unread > 0 && (
          <span className="bk-chat-fab-badge">{unread}</span>
        )}
      </button>

      {/* Chat window */}
      <div className={`bk-chat-window ${open ? "bk-chat-window--open" : ""}`} role="dialog" aria-modal="true" aria-label="Chat with Kala">
        {/* Header */}
        <div className="bk-chat-header">
          <div className="bk-chat-header-avatar" aria-hidden="true">K</div>
          <div className="bk-chat-header-info">
            <span className="bk-chat-header-name">{BOT_NAME}</span>
            <span className="bk-chat-header-status">
              <span className="bk-chat-status-dot" />
              Online
            </span>
          </div>
          <button
            type="button"
            className="bk-chat-header-close"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="bk-chat-messages" aria-live="polite" aria-label="Chat messages">
          {messages.map((msg, i) => (
            <div key={i} className={`bk-chat-msg bk-chat-msg--${msg.from}`}>
              {msg.from === "bot" && (
                <span className="bk-chat-msg-avatar" aria-hidden="true">K</span>
              )}
              <div className="bk-chat-msg-col">
                {msg.text ? (
                  <div className="bk-chat-msg-bubble">
                    {msg.text.split("\n").map((line, j) =>
                      line ? <p key={j}>{line}</p> : <br key={j} />
                    )}
                  </div>
                ) : null}
                {msg.products?.length ? (
                  <ProductCards products={msg.products} onNavigate={() => setOpen(false)} />
                ) : null}
              </div>
            </div>
          ))}

          {/* Only show the dots until the first delta lands — once text is streaming, the
              growing bubble is its own progress indicator. */}
          {loading && messages[messages.length - 1]?.from !== "bot" && (
            <div className="bk-chat-msg bk-chat-msg--bot">
              <span className="bk-chat-msg-avatar" aria-hidden="true">K</span>
              <div className="bk-chat-msg-bubble bk-chat-typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          {showQuickReplies && !loading && (
            <div className="bk-chat-quick-replies">
              {QUICK_REPLIES.map((qr) => (
                <button key={qr} type="button" className="bk-chat-quick-btn" onClick={() => handleQuickReply(qr)}>
                  {qr}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form className="bk-chat-input-row" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="bk-chat-input"
            placeholder="Type your message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            aria-label="Chat message"
            maxLength={500}
          />
          <button
            type="submit"
            className="bk-chat-send-btn"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>

        <div className="bk-chat-footer-brand">
          Powered by <strong>Banarasi Kala</strong>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
