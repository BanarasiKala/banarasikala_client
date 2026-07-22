import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import api from "../../utils/api";
import { useSupportEvents } from "../../context/SupportRealtimeContext";
import SupportChat, { statusMeta } from "../../components/SupportChat/SupportChat";
import "./Support.css";

const formatDay = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

// The general strand is addressed by absence — it is the one topic with no order — so the
// list needs a stable key for it that cannot collide with an order id.
const GENERAL = "general";
const keyOf = (topic) => (topic?.order_id ? String(topic.order_id) : GENERAL);

/**
 * /support — the customer's chats, one per order.
 *
 * The page is a list of strands, not a single scroll. Everything a customer has ever said to
 * us is still one conversation underneath, but they read it the way they think about it: this
 * saree, that parcel, a general question. Opening a strand shows only that strand, so a reply
 * is never ambiguous about which order it answers.
 *
 * The list is also the only route to the general strand, which by definition has no order to
 * reach it through.
 */
const Support = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();

  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection lives in the URL so the browser back button steps out of a strand rather than
  // off the page, and so support can deep-link someone to the right one.
  const selectedKey = searchParams.get("chat");

  const fetchTopics = useCallback(async () => {
    try {
      const { data } = await api.get("/api/support/conversation");
      setTopics(Array.isArray(data?.topics) ? data.topics : []);
    } catch {
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchTopics();
  }, [user, navigate, fetchTopics]);

  /**
   * Keep the list live.
   *
   * Without this the header badge would tick up to "Support ②" while the list underneath it
   * showed nothing new — half-visible, which is worse than either extreme, because the
   * customer looks exactly where the badge sent them and finds no change.
   *
   * A refetch rather than a local patch: the row carries a status and an ordering the server
   * owns, and reconstructing those from an event would be a second implementation of rules
   * that already exist. The payload is a handful of topics, and support replying is not a
   * high-frequency event.
   */
  useSupportEvents((event) => {
    if (event.type === "message" && event.message?.sender !== "customer") fetchTopics();
    if (event.type === "status") fetchTopics();
  });

  const selected = useMemo(
    () => topics.find((t) => keyOf(t) === selectedKey) || null,
    [topics, selectedKey],
  );

  // A strand the customer has never opened has no topic row yet. Selecting "general" before
  // they have written is legitimate — the chat renders empty and the first message creates it.
  const selectionIsGeneral = selectedKey === GENERAL;
  const showChat = Boolean(selected) || selectionIsGeneral;

  const openStrand = (key) => setSearchParams({ chat: key });
  const backToList = () => setSearchParams({});

  const renderList = () => {
    if (loading) {
      return (
        <div className="support-empty">
          <Icon icon="lucide:loader-2" className="support-spin" />
          <p>Loading your chats…</p>
        </div>
      );
    }

    return (
      <div className="support-list">
        {/* Always offered, even with no history: a question that is not about an order needs
            somewhere to go, and it is the one strand no order card can lead to. */}
        <button
          type="button"
          className={`support-row${selectedKey === GENERAL ? " is-active" : ""}`}
          onClick={() => openStrand(GENERAL)}
        >
          <span className="support-row-icon"><Icon icon="lucide:message-circle-question" /></span>
          <span className="support-row-body">
            <span className="support-row-top">
              <strong>General question</strong>
              {topics.some((t) => !t.order_id) && (
                <small>{formatDay(topics.find((t) => !t.order_id)?.last_message_at)}</small>
              )}
            </span>
            <span className="support-row-sub">Anything not about a specific order</span>
          </span>
          <Icon icon="lucide:chevron-right" className="support-row-chevron" />
        </button>

        {topics.filter((t) => t.order_id).map((topic) => {
          const meta = statusMeta(topic.status);
          return (
            <button
              key={topic.id}
              type="button"
              className={`support-row${keyOf(topic) === selectedKey ? " is-active" : ""}`}
              onClick={() => openStrand(keyOf(topic))}
            >
              {topic.order?.productImage ? (
                <img className="support-row-img" src={topic.order.productImage} alt="" loading="lazy" />
              ) : (
                <span className="support-row-icon"><Icon icon="lucide:package" /></span>
              )}
              <span className="support-row-body">
                <span className="support-row-top">
                  <strong>{topic.order?.productName || `Order #${topic.order?.number || topic.order_id}`}</strong>
                  <small>{formatDay(topic.last_message_at)}</small>
                </span>
                <span className="support-row-sub">Order #{topic.order?.number || topic.order_id}</span>
                <span className={`support-row-status ${meta.tone}`}>
                  <Icon icon={meta.icon} />
                  {topic.status}
                </span>
              </span>
              <Icon icon="lucide:chevron-right" className="support-row-chevron" />
            </button>
          );
        })}

        {!loading && !topics.length && (
          <p className="support-hint">
            No chats yet. Start one above, or open any order in{" "}
            <button type="button" onClick={() => navigate("/my-orders")}>My Orders</button>.
          </p>
        )}
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className={`support-page${showChat ? " has-selection" : ""}`}>
      <section className="support-hero">
        <h1>Support</h1>
        <span>One chat per order, so nothing gets crossed over.</span>
      </section>

      <section className="support-shell">
        <div className="support-col support-col--list">{renderList()}</div>
        <div className="support-col support-col--chat">
          {showChat ? (
            <SupportChat
              // Remounts per strand: no scroll position, composer draft or pending photo can
              // survive from the conversation being left.
              key={selectedKey}
              // The order card comes from the topic we already hold, so opening a strand
              // costs no extra request to learn what it is about.
              order={selected?.order ? { id: selected.order_id, ...selected.order } : null}
              topicId={selected?.id || null}
              customerName={user?.name || ""}
              onActivity={fetchTopics}
              onBack={backToList}
              onNotify={showNotification}
            />
          ) : (
            <div className="support-empty support-empty--panel">
              <span className="support-empty-icon"><Icon icon="lucide:messages-square" /></span>
              <h2>Pick a chat</h2>
              <p>Choose an order on the left to read that conversation and reply to our team.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Support;
