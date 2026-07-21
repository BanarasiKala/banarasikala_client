import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import api from "../../utils/api";
import API_ENDPOINTS from "../../config/api";
import useSupportStream, { useTypingPing } from "../../hooks/useSupportStream";
import "./Tickets.css";

// EventSource needs an absolute URL — it does not inherit the axios baseURL.
const API_BASE = API_ENDPOINTS.base;

/**
 * WhatsApp-style delivery state for one of OUR messages.
 *
 *   ✓        sent      — saved on the server
 *   ✓✓ grey  delivered — reached the other side's browser
 *   ✓✓ blue  read      — they opened the thread past this message
 *
 * Read is derived from the other side's watermark rather than stored per message: one
 * timestamp answers it for the whole thread, and it can only ever move forward.
 */
const MessageTicks = ({ message, readAt }) => {
  const read = readAt && new Date(readAt) >= new Date(message.createdAt);
  const delivered = Boolean(message.delivered_at);
  const state = read ? "is-read" : delivered ? "is-delivered" : "is-sent";
  const label = read ? "Read" : delivered ? "Delivered" : "Sent";

  return (
    <span className={`ticket-ticks ${state}`} role="img" aria-label={label} title={label}>
      <Icon icon={delivered || read ? "lucide:check-check" : "lucide:check"} />
    </span>
  );
};

const STATUS_META = {
  Open: { tone: "is-open", icon: "lucide:circle-dot", note: "Our team has your request." },
  "In Progress": { tone: "is-progress", icon: "lucide:loader", note: "Support is working on it." },
  Resolved: { tone: "is-resolved", icon: "lucide:check-circle-2", note: "Marked resolved by support." },
  Closed: { tone: "is-closed", icon: "lucide:lock", note: "This conversation is closed." },
};

const statusMeta = (status) => STATUS_META[status] || STATUS_META.Open;

const formatStamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDay = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const Tickets = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  // Live state. `supportTyping` is ephemeral (server-side TTL, never persisted);
  // `adminReadAt` is the watermark that renders "Seen" under our own last message.
  const [supportTyping, setSupportTyping] = useState(false);
  const [adminReadAt, setAdminReadAt] = useState(null);
  const threadEndRef = useRef(null);

  const selectedId = searchParams.get("id");

  const fetchTickets = useCallback(async () => {
    try {
      const response = await api.get("/api/support/tickets/my");
      setTickets(Array.isArray(response.data) ? response.data : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchThread = useCallback(async (id) => {
    if (!id) {
      setActiveTicket(null);
      return;
    }
    setThreadLoading(true);
    try {
      const response = await api.get(`/api/support/tickets/${id}`);
      setActiveTicket(response.data || null);
      // Seed the read watermark here rather than in an effect reacting to activeTicket —
      // stream `read` events keep it current from this point on.
      setAdminReadAt(response.data?.admin_read_at || null);
    } catch (error) {
      showNotification(
        error?.response?.data?.message || "Unable to open this query.",
        "error",
      );
      setActiveTicket(null);
    } finally {
      setThreadLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchTickets();
  }, [user, navigate, fetchTickets]);

  useEffect(() => {
    fetchThread(selectedId);
    setReply("");
    setSupportTyping(false);
  }, [selectedId, fetchThread]);

  /**
   * Append a message once, whichever path delivers it first.
   *
   * A sent message arrives TWICE: from the POST response, and from our own SSE stream
   * (the server broadcasts to everyone on the thread, including the sender). The stream
   * usually wins, because the server emits synchronously inside the request handler —
   * before the HTTP response has travelled back over the network.
   *
   * So both paths go through here and the id check lives in one place. When the append was
   * split across two call sites with the guard on only one of them, every message the
   * customer sent appeared twice.
   */
  const appendMessage = useCallback((incoming) => {
    if (!incoming) return;
    setActiveTicket((current) => {
      if (!current) return current;
      const messages = current.messages || [];
      if (messages.some((m) => String(m.id) === String(incoming.id))) return current;
      return { ...current, messages: [...messages, incoming] };
    });
  }, []);

  // ── Realtime ────────────────────────────────────────────────────────────────────────
  useSupportStream(
    selectedId ? `${API_BASE}/api/support/tickets/${selectedId}/stream` : null,
    (event) => {
      switch (event.type) {
        case "message":
          // Same appender as the POST path — the stream echoes to everyone including the
          // sender, so this is frequently a message we already hold.
          appendMessage(event.message);
          break;
        case "typing":
          // Only the OTHER side's typing is interesting; ours would be a mirror.
          if (event.side === "admin") setSupportTyping(Boolean(event.typing));
          break;
        case "read":
          if (event.side === "admin") setAdminReadAt(event.read_at);
          break;
        case "delivered":
          // ✓ -> ✓✓ on the messages that just reached support's browser.
          setActiveTicket((current) => {
            if (!current) return current;
            const ids = new Set((event.ids || []).map(String));
            return {
              ...current,
              messages: (current.messages || []).map((m) => (
                ids.has(String(m.id)) ? { ...m, delivered_at: event.delivered_at } : m
              )),
            };
          });
          break;
        case "status":
          // Support closing the thread must disable our composer immediately — otherwise
          // the customer types a reply into a box the server will reject.
          setActiveTicket((current) => (current
            ? { ...current, status: event.status, can_reply: event.can_reply }
            : current));
          break;
        default:
          break;
      }
    },
  );

  const pingTyping = useTypingPing(selectedId);

  // Opening a thread marks it read, and tells support their reply landed.
  useEffect(() => {
    if (!selectedId) return;
    api.post(`/api/support/tickets/${selectedId}/read`).catch(() => {});
  }, [selectedId, activeTicket?.messages?.length]);


  // Land on the newest message whenever the thread grows — and when the typing bubble
  // appears, since it adds height below the last message and would otherwise be clipped.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeTicket?.messages?.length, supportTyping]);

  const openTicket = (id) => setSearchParams({ id: String(id) });
  const backToList = () => setSearchParams({});

  const sendReply = async (event) => {
    event.preventDefault();
    const text = reply.trim();
    if (!text || !activeTicket || sending) return;

    setSending(true);
    try {
      const response = await api.post(`/api/support/tickets/${activeTicket.id}/messages`, {
        message: text,
      });
      setReply("");
      // May already be here via our own stream — appendMessage is idempotent on id.
      appendMessage(response.data?.message);
      // The list orders by last activity, so it is stale the moment a reply lands.
      fetchTickets();
    } catch (error) {
      showNotification(
        error?.response?.data?.message || "Unable to send your message right now.",
        "error",
      );
    } finally {
      setSending(false);
    }
  };

  const openCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === "Open" || ticket.status === "In Progress").length,
    [tickets],
  );

  const renderList = () => {
    if (loading) {
      return (
        <div className="tickets-empty">
          <Icon icon="lucide:loader-2" className="tickets-spin" />
          <p>Loading your queries…</p>
        </div>
      );
    }

    if (!tickets.length) {
      return (
        <div className="tickets-empty">
          <span className="tickets-empty-icon"><Icon icon="lucide:message-circle-question" /></span>
          <h2>No queries yet</h2>
          <p>Raise a query from any order in My Orders and the conversation will show up here.</p>
          <button type="button" className="tickets-primary-btn" onClick={() => navigate("/my-orders")}>
            Go to My Orders
          </button>
        </div>
      );
    }

    return (
      <div className="tickets-list">
        {tickets.map((ticket) => {
          const meta = statusMeta(ticket.status);
          return (
            <button
              key={ticket.id}
              type="button"
              className={`ticket-card${String(ticket.id) === String(selectedId) ? " is-active" : ""}`}
              onClick={() => openTicket(ticket.id)}
            >
              <div className="ticket-card-top">
                <span className="ticket-number">{ticket.ticket_number}</span>
                <span className={`ticket-status ${meta.tone}`}>
                  <Icon icon={meta.icon} />
                  {ticket.status}
                </span>
              </div>
              <p className="ticket-card-category">{ticket.category}</p>
              <p className="ticket-card-message">{ticket.message}</p>
              <div className="ticket-card-foot">
                <span>Order #{ticket.order_number || ticket.order_id}</span>
                <span>{formatDay(ticket.createdAt)}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderThread = () => {
    if (threadLoading) {
      return (
        <div className="tickets-empty">
          <Icon icon="lucide:loader-2" className="tickets-spin" />
          <p>Opening conversation…</p>
        </div>
      );
    }

    if (!activeTicket) {
      return (
        <div className="tickets-empty tickets-empty--panel">
          <span className="tickets-empty-icon"><Icon icon="lucide:messages-square" /></span>
          <h2>Select a query</h2>
          <p>Pick a query on the left to read the conversation and reply to our support team.</p>
        </div>
      );
    }

    const meta = statusMeta(activeTicket.status);
    const messages = activeTicket.messages || [];

    return (
      <div className="ticket-thread">
        <div className="ticket-thread-head">
          <button type="button" className="ticket-back" onClick={backToList} aria-label="Back to queries">
            <Icon icon="lucide:arrow-left" />
          </button>
          <div className="ticket-thread-title">
            <div className="ticket-thread-title-row">
              <span className="ticket-number">{activeTicket.ticket_number}</span>
              <span className={`ticket-status ${meta.tone}`}>
                <Icon icon={meta.icon} />
                {activeTicket.status}
              </span>
            </div>
            <span className="ticket-thread-sub">
              {activeTicket.category} · Order #{activeTicket.order_number || activeTicket.order_id}
            </span>
          </div>
        </div>

        <div className="ticket-thread-body">
          <p className="ticket-thread-note">
            <Icon icon={meta.icon} />
            {meta.note}
          </p>

          {messages.map((message) => {
            // Ticks go on every message WE sent, like a chat app — not just the last one.
            // The opening message is synthesised from the ticket row and has no delivery
            // record of its own, so it is excluded.
            const isOwn = message.sender === "customer" && !String(message.id).startsWith("ticket-");
            return (
              <div
                key={message.id}
                className={`ticket-bubble-row ${message.sender === "admin" ? "is-admin" : "is-customer"}`}
              >
                <div className="ticket-bubble">
                  <span className="ticket-bubble-sender">
                    {message.sender === "admin" ? "Banarasi Kala Support" : (message.sender_name || "You")}
                  </span>
                  <p>{message.message}</p>
                  <span className="ticket-bubble-time">
                    {formatStamp(message.createdAt)}
                    {isOwn && <MessageTicks message={message} readAt={adminReadAt} />}
                  </span>
                </div>
              </div>
            );
          })}

          {supportTyping && (
            <div className="ticket-bubble-row is-admin">
              <div className="ticket-bubble ticket-bubble-typing" aria-live="polite">
                <span className="ticket-bubble-sender">Banarasi Kala Support</span>
                <span className="ticket-typing-dots"><i /><i /><i /></span>
              </div>
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {activeTicket.can_reply ? (
          <form className="ticket-reply" onSubmit={sendReply}>
            <textarea
              rows={2}
              value={reply}
              maxLength={2000}
              placeholder="Write a message to our support team…"
              onChange={(event) => { setReply(event.target.value); pingTyping(); }}
            />
            <button type="submit" disabled={sending || !reply.trim()}>
              {sending ? <Icon icon="lucide:loader-2" className="tickets-spin" /> : <Icon icon="lucide:send" />}
              <span>{sending ? "Sending" : "Send"}</span>
            </button>
          </form>
        ) : (
          <div className="ticket-reply-closed">
            <Icon icon="lucide:lock" />
            <span>This query is closed. Raise a new one from the order if you still need help.</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`tickets-page${selectedId ? " has-selection" : ""}`}>
      <section className="tickets-hero">
        <h1>My Queries</h1>
        <span>
          {openCount > 0
            ? `${openCount} active ${openCount === 1 ? "conversation" : "conversations"} with our support team`
            : "Your conversations with our support team"}
        </span>
      </section>

      <section className="tickets-shell">
        <div className="tickets-col tickets-col--list">{renderList()}</div>
        <div className="tickets-col tickets-col--thread">{renderThread()}</div>
      </section>
    </div>
  );
};

export default Tickets;
