import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import api from "../../utils/api";
import "./Tickets.css";

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
    } catch (error) {
      showNotification(
        error?.response?.data?.message || "Unable to open this ticket.",
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
  }, [selectedId, fetchThread]);

  // Land on the newest message whenever the thread grows.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeTicket?.messages?.length]);

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
      const posted = response.data?.message;
      setReply("");
      setActiveTicket((current) => (current
        ? { ...current, messages: [...(current.messages || []), posted] }
        : current));
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
          <p>Loading your tickets…</p>
        </div>
      );
    }

    if (!tickets.length) {
      return (
        <div className="tickets-empty">
          <span className="tickets-empty-icon"><Icon icon="lucide:message-circle-question" /></span>
          <h2>No tickets yet</h2>
          <p>Raise a ticket from any order in My Orders and the conversation will show up here.</p>
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
          <h2>Select a ticket</h2>
          <p>Pick a ticket on the left to read the conversation and reply to our support team.</p>
        </div>
      );
    }

    const meta = statusMeta(activeTicket.status);
    const messages = activeTicket.messages || [];

    return (
      <div className="ticket-thread">
        <div className="ticket-thread-head">
          <button type="button" className="ticket-back" onClick={backToList} aria-label="Back to tickets">
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

          {messages.map((message) => (
            <div
              key={message.id}
              className={`ticket-bubble-row ${message.sender === "admin" ? "is-admin" : "is-customer"}`}
            >
              <div className="ticket-bubble">
                <span className="ticket-bubble-sender">
                  {message.sender === "admin" ? "Banarasi Kala Support" : (message.sender_name || "You")}
                </span>
                <p>{message.message}</p>
                <span className="ticket-bubble-time">{formatStamp(message.createdAt)}</span>
              </div>
            </div>
          ))}
          <div ref={threadEndRef} />
        </div>

        {activeTicket.can_reply ? (
          <form className="ticket-reply" onSubmit={sendReply}>
            <textarea
              rows={2}
              value={reply}
              maxLength={2000}
              placeholder="Write a message to our support team…"
              onChange={(event) => setReply(event.target.value)}
            />
            <button type="submit" disabled={sending || !reply.trim()}>
              {sending ? <Icon icon="lucide:loader-2" className="tickets-spin" /> : <Icon icon="lucide:send" />}
              <span>{sending ? "Sending" : "Send"}</span>
            </button>
          </form>
        ) : (
          <div className="ticket-reply-closed">
            <Icon icon="lucide:lock" />
            <span>This ticket is closed. Raise a new one from the order if you still need help.</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`tickets-page${selectedId ? " has-selection" : ""}`}>
      <section className="tickets-hero">
        <h1>Support Tickets</h1>
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
