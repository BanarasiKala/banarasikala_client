import { useEffect, useRef, useState } from "react";
import { API_ENDPOINTS } from "../../config/api";
import "./ChatBot.css";

const BOT_NAME = "Kala";
const WELCOME = {
  from: "bot",
  text: "Namaste! I'm Kala, your Banarasi Kala assistant. How can I help you today?\n\nYou can ask me about our sarees, pricing, shipping, returns, or anything else!",
};

const QUICK_REPLIES = [
  "Types of sarees",
  "Shipping info",
  "Return policy",
  "Track my order",
  "Contact support",
];

const ChatBot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const hasOpened = useRef(false);

  useEffect(() => {
    if (open) {
      setUnread(0);
      hasOpened.current = true;
      setTimeout(() => inputRef.current?.focus(), 120);
    }
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

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { from: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.chatbotMessage, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      addBotMessage(data.reply || "I didn't quite catch that. Could you rephrase?");
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
    <>
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
              <div className="bk-chat-msg-bubble">
                {msg.text.split("\n").map((line, j) =>
                  line ? <p key={j}>{line}</p> : <br key={j} />
                )}
              </div>
            </div>
          ))}

          {loading && (
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
    </>
  );
};

export default ChatBot;
