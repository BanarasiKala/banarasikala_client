import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import api from "../../utils/api";
import { useTypingPing } from "../../hooks/useSupportStream";
import { useSupport, useSupportEvents } from "../../context/SupportRealtimeContext";
import { MAX_SUPPORT_IMAGES, uploadSupportImages } from "../../utils/supportUploads";
import ImageLightbox from "../ImageLightbox";
import "./SupportChat.css";

export const STATUS_META = {
  Open: { tone: "is-open", icon: "lucide:circle-dot", label: "Open" },
  "In Progress": { tone: "is-progress", icon: "lucide:loader", label: "Support is on it" },
  Resolved: { tone: "is-resolved", icon: "lucide:check-circle-2", label: "Resolved" },
  Closed: { tone: "is-closed", icon: "lucide:lock", label: "Closed" },
};

export const statusMeta = (status) => STATUS_META[status] || STATUS_META.Open;

/**
 * Opening prompts, split on whether the parcel has landed.
 *
 * Offering "Item arrived damaged" on an order still in transit — or "Where is my order?" on
 * one delivered a week ago — invites a message support cannot act on, so the two sets never
 * overlap. Each carries a first-person sentence rather than its own label: the label is a
 * category, and a message that says only "Wrong item received" tells support no more than the
 * category did.
 *
 * Tapping PREFILLS the composer, it does not send. The customer finishes the sentence, which
 * is what turns a chosen category into something workable — and a mis-tap costs a keystroke.
 */
const QUICK_REPLIES = {
  transit: [
    { label: "Where is my order?", text: "I'd like an update on where my order has reached. " },
    { label: "Delivery is delayed", text: "My order hasn't arrived by the date I was expecting. " },
    { label: "Change my delivery address", text: "I need to change the delivery address on this order. " },
    { label: "Something else", text: "" },
  ],
  delivered: [
    { label: "Item arrived damaged", text: "The item arrived damaged. " },
    { label: "Wrong item received", text: "I received the wrong item. " },
    { label: "Return or exchange help", text: "I'd like help with a return or exchange for this order. " },
    { label: "Something else", text: "" },
  ],
  general: [
    { label: "Question about a product", text: "I have a question about one of your sarees. " },
    { label: "Payment or refund", text: "I have a question about a payment or refund. " },
    { label: "Something else", text: "" },
  ],
};

/**
 * WhatsApp-style delivery state for one of OUR messages.
 *
 *   ✓        sent      — saved on the server
 *   ✓✓ grey  delivered — reached support's browser
 *   ✓✓ blue  read      — they opened the chat past this message
 *
 * Read is derived from support's watermark rather than stored per message: one timestamp
 * answers it for the whole conversation, and it can only ever move forward.
 */
const MessageTicks = ({ message, readAt }) => {
  const read = readAt && new Date(readAt) >= new Date(message.createdAt);
  const delivered = Boolean(message.delivered_at);
  const state = read ? "is-read" : delivered ? "is-delivered" : "is-sent";
  const label = read ? "Read" : delivered ? "Delivered" : "Sent";

  return (
    <span className={`sc-ticks ${state}`} role="img" aria-label={label} title={label}>
      <Icon icon={delivered || read ? "lucide:check-check" : "lucide:check"} />
    </span>
  );
};

/**
 * The order this strand is about.
 *
 * Pinned at the top of the chat rather than sent as a message. It is a property of the whole
 * strand, so repeating it in the scroll would be restating the one thing that cannot change
 * while you are reading — and the customer would have to scroll up to check what they are
 * even talking about.
 */
export const OrderCard = ({ order }) => (
  <div className="sc-order-card">
    {order?.productImage
      ? <img src={order.productImage} alt="" loading="lazy" />
      : <span className="sc-order-fallback"><Icon icon={order ? "lucide:package" : "lucide:message-circle-question"} /></span>}
    <span className="sc-order-copy">
      <strong>{order ? (order.productName || "Your order") : "General question"}</strong>
      <small>
        {order ? `Order #${order.number}` : "Not about a specific order"}
        {order?.extraItems > 0 && ` · +${order.extraItems} more`}
      </small>
      {order?.statusLabel && <em>{order.statusLabel}</em>}
    </span>
  </div>
);

/**
 * Read watermarks only ever move forward.
 *
 * The strand is refetched on reconnect and after the first send, and such a fetch can resolve
 * after a `read` event it never saw — assigning its payload would hand back the older value
 * and drop the tick from blue to grey with nothing left to raise it again.
 */
const laterRead = (current, incoming) => {
  if (!incoming) return current || null;
  if (!current) return incoming;
  return new Date(incoming) > new Date(current) ? incoming : current;
};

const formatStamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const dayKey = (value) => new Date(value).toDateString();

const dayLabel = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return "Today";
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * One strand of the customer's support chat — the messages about one order.
 *
 * The customer never sees two orders mixed. Opening support from an order shows that order's
 * strand and nothing else, which is what makes a reply unambiguous: there is only one thing
 * it could be about. The whole relationship still exists underneath (see SupportTopic) and is
 * what support reads; the customer just gets the slice they came for.
 *
 * There is no thread id in this component's URLs. A customer has exactly one conversation, the
 * server resolves it from their token, and the strand is named by the ORDER — which is both
 * simpler and the reason there is no id here for anyone to tamper with.
 *
 * ── The pending strand ──────────────────────────────────────────────────────────────────
 * Opening an order the customer has never written about shows the order card and an empty
 * chat, but writes nothing. The strand is created by the first message. So opening support to
 * look, then closing it, leaves no trace, and support never sees an empty strand.
 *
 * @param {object|null} order       `{ id, number, productName, productImage, statusLabel,
 *                                  extraItems, delivered }`. Null = the general strand.
 * @param {number|null} topicId     Existing strand to load, when the caller already knows it.
 * @param {string}      customerName Used in the greeting.
 * @param {Function}    onActivity  Called after a successful send (hosts refresh their lists).
 * @param {Function}    onBack      Renders the leading button when provided.
 * @param {boolean}     dismissible Marks onBack as "close" (✕) rather than "back" (←).
 * @param {Function}    onNotify    (message, tone)
 */
export default function SupportChat({
  order = null,
  topicId = null,
  customerName = "",
  onActivity,
  onBack,
  dismissible = false,
  onNotify,
}) {
  const [strand, setStrand] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingImages, setPendingImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  // Live state. `supportTyping` is ephemeral (server-side TTL, never persisted);
  // `adminReadAt` is the watermark that turns our own ticks blue.
  const [supportTyping, setSupportTyping] = useState(false);
  const [adminReadAt, setAdminReadAt] = useState(null);

  const fileInputRef = useRef(null);
  const composerRef = useRef(null);
  const threadEndRef = useRef(null);

  // Host callbacks live in refs: every one is typically an inline arrow, so reading them
  // directly would rebuild the fetcher and re-run its effect on each parent render.
  const notifyRef = useRef(onNotify);
  const activityRef = useRef(onActivity);
  useEffect(() => { notifyRef.current = onNotify; }, [onNotify]);
  useEffect(() => { activityRef.current = onActivity; }, [onActivity]);

  // The shared stream only opens once a conversation exists, and for a customer writing in
  // for the first time that is the message they are about to send — so the provider is told
  // to re-check afterwards. Without it their very first exchange would have no stream at all.
  const { refresh: refreshSupport } = useSupport();

  // The strand is addressed by whichever the caller knows: a topic id from the strand list,
  // an order id from the sheet on an order card.
  const scope = useMemo(() => {
    if (topicId) return `topicId=${topicId}`;
    if (order?.id) return `orderId=${order.id}`;
    return null;
  }, [topicId, order?.id]);

  const load = useCallback(async () => {
    try {
      // No scope means the general strand, which has no order to name it by. The server's
      // unscoped response is the whole relationship, so it is asked for by topic only once
      // one exists — until then an empty strand is exactly right.
      const { data } = await api.get(`/api/support/conversation${scope ? `?${scope}` : ""}`);
      setConversationId(data?.id || null);
      setAdminReadAt((current) => laterRead(current, data?.admin_read_at));

      if (scope) {
        setStrand(data?.topic || null);
        setMessages(data?.messages || []);
      } else {
        // General strand: pick it out of the topic list rather than taking the unscoped
        // message dump, which would mix in every order.
        const general = (data?.topics || []).find((t) => !t.order_id) || null;
        setStrand(general);
        setMessages(general
          ? (data?.messages || []).filter((m) => m.topic_id === general.id)
          : []);
      }
    } catch (err) {
      notifyRef.current?.(
        err?.response?.data?.message || "Unable to load your support chat.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  /**
   * Append a message once, whichever path delivers it first.
   *
   * A sent message arrives TWICE: from the POST response, and from our own SSE stream (the
   * server broadcasts to everyone on the conversation, including the sender). The stream
   * usually wins, because the server emits synchronously inside the request handler — before
   * the HTTP response has travelled back over the network.
   */
  const appendMessage = useCallback((incoming) => {
    if (!incoming) return;
    setMessages((current) => (current.some((m) => String(m.id) === String(incoming.id))
      ? current
      : [...current, incoming]));
  }, []);

  // ── Realtime ────────────────────────────────────────────────────────────────────────
  // Rides the one stream the whole tab shares (see SupportRealtimeContext) rather than
  // opening its own — the header badge and the strand list want the same events, and three
  // sockets for one person reading one screen is three presence registrations on the server.
  //
  // Every strand arrives on that one stream, so each event is filtered by topic here.
  useSupportEvents((event) => {
    switch (event.type) {
      case "message":
        // `strand?.id` is null until the first message creates it; the POST response fills it
        // in, so anything arriving before that belongs to a strand we are not showing.
        if (strand?.id && event.message?.topic_id === strand.id) appendMessage(event.message);
        break;
      case "typing":
        // Typing is per person, not per strand — they can only type in one box at a time.
        if (event.side === "admin") setSupportTyping(Boolean(event.typing));
        break;
      case "read":
        if (event.side === "admin") setAdminReadAt((current) => laterRead(current, event.read_at));
        break;
      case "delivered":
        // ✓ -> ✓✓ on the messages that just reached support's browser.
        setMessages((current) => {
          const ids = new Set((event.ids || []).map(String));
          return current.map((m) => (
            ids.has(String(m.id)) ? { ...m, delivered_at: event.delivered_at } : m
          ));
        });
        break;
      case "status":
        if (event.topic_id === strand?.id) {
          setStrand((current) => (current ? { ...current, status: event.status } : current));
        }
        break;
      default:
        break;
    }
  });

  const pingTyping = useTypingPing(Boolean(conversationId));

  // Opening the chat marks it read, and tells support their reply landed.
  useEffect(() => {
    if (loading || !conversationId) return;
    api.post("/api/support/conversation/read").catch(() => {});
  }, [loading, conversationId, messages.length]);

  // Land on the newest message whenever the strand grows — and when the typing bubble
  // appears, since it adds height below the last message and would otherwise be clipped.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, supportTyping, loading]);

  // Photos upload the moment they are picked and sit as pending thumbnails above the
  // composer, so send posts URLs and returns instantly — and an upload failure surfaces while
  // the customer is still typing rather than when they hit send.
  const handlePickImages = async (event) => {
    const picked = Array.from(event.target.files || []);
    // Cleared immediately so re-picking the same file still fires a change event.
    event.target.value = "";
    if (!picked.length) return;

    if (picked.length > MAX_SUPPORT_IMAGES - pendingImages.length) {
      notifyRef.current?.(`You can attach up to ${MAX_SUPPORT_IMAGES} photos per message.`, "warning");
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadSupportImages(picked);
      setPendingImages((current) => [...current, ...uploaded].slice(0, MAX_SUPPORT_IMAGES));
    } catch (err) {
      notifyRef.current?.(err?.message || "Could not upload that photo.", "error");
    } finally {
      setUploading(false);
    }
  };

  // A prompt drops its sentence into the composer and parks the caret at the end, ready for
  // the detail that makes it something support can act on.
  const applyPrompt = (text) => {
    setReply(text);
    const box = composerRef.current;
    if (!box) return;
    box.focus();
    box.setSelectionRange(text.length, text.length);
  };

  const send = async (event) => {
    event.preventDefault();
    const text = reply.trim();
    // A photo on its own is a complete message — "here is what arrived damaged" needs no
    // caption.
    if ((!text && !pendingImages.length) || sending || uploading) return;

    setSending(true);
    try {
      const { data } = await api.post("/api/support/conversation/messages", {
        message: text,
        attachments: pendingImages,
        // Names the strand. The server checks the order is theirs and builds the card itself
        // — the client is never trusted with what an agent reads before authorising a refund.
        ...(order?.id ? { orderId: order.id } : {}),
      });
      setReply("");
      setPendingImages([]);
      setConversationId(data?.conversation_id || conversationId);
      // The strand may have just come into existence, and its status may have moved (a reply
      // into a resolved strand reopens it).
      if (data?.topic) setStrand(data.topic);
      // May already be here via the shared stream — appendMessage is idempotent on id.
      appendMessage(data?.message);
      refreshSupport?.();
      activityRef.current?.();
    } catch (err) {
      notifyRef.current?.(
        err?.response?.data?.message || "Unable to send your message right now.",
        "error",
      );
    } finally {
      setSending(false);
    }
  };

  const meta = statusMeta(strand?.status);
  const canSend = !sending && !uploading && (reply.trim() || pendingImages.length);
  const hasHistory = messages.length > 0;

  const quickReplies = !order
    ? QUICK_REPLIES.general
    : (order.delivered ? QUICK_REPLIES.delivered : QUICK_REPLIES.transit);

  // Messages paired with the date separator that precedes them. Derived rather than tracked
  // with a rolling variable inside the map: a strand can live for months, and a `let` the
  // render mutates makes the output depend on how many times React chooses to run it.
  const timeline = useMemo(() => messages.map((message, index) => {
    const previous = messages[index - 1];
    const sameDay = previous && dayKey(previous.createdAt) === dayKey(message.createdAt);
    return { message, separator: sameDay ? null : dayLabel(message.createdAt) };
  }), [messages]);

  return (
    <div className="sc-chat">
      <div className="sc-head">
        {onBack && (
          <button
            type="button"
            className="sc-head-btn"
            onClick={onBack}
            aria-label={dismissible ? "Close" : "Back"}
          >
            <Icon icon={dismissible ? "lucide:x" : "lucide:arrow-left"} />
          </button>
        )}
        <div className="sc-head-title">
          <strong>Banarasi Kala Support</strong>
          <span>
            {supportTyping
              ? "typing…"
              : strand?.status
                ? meta.label
                : "Usually replies within a few hours"}
          </span>
        </div>
        {strand?.status && (
          <span className={`sc-status ${meta.tone}`}>
            <Icon icon={meta.icon} />
            {strand.status}
          </span>
        )}
      </div>

      {/* What this strand is about, pinned rather than sent. It cannot change while the
          customer is reading, so it does not belong in a scroll they have to walk back up. */}
      <div className="sc-context">
        <OrderCard order={order} />
      </div>

      <div className="sc-body">
        {loading ? (
          <div className="sc-loading" aria-live="polite">
            <Icon icon="lucide:loader-2" className="sc-spin" />
            <span>Loading your chat…</span>
          </div>
        ) : (
          <>
            {/* The greeting is only for an empty strand. Re-greeting someone mid-conversation
                reads as a machine. */}
            {!hasHistory && (
              <div className="sc-row is-admin">
                <div className="sc-bubble">
                  <span className="sc-sender">Banarasi Kala Support</span>
                  <p>
                    {customerName ? `Hi ${customerName} 👋` : "Hi 👋"} — how can we help
                    {order ? " with this order?" : " today?"}
                  </p>
                </div>
              </div>
            )}

            {timeline.map(({ message, separator }) => {
              const isOwn = message.sender === "customer";

              // A status line belongs to neither side, so it sits centred across the strand:
              // it is the conversation changing state, not someone speaking.
              if (message.type === "status") {
                return (
                  <div key={message.id}>
                    {separator && <div className="sc-day"><span>{separator}</span></div>}
                    <div className="sc-system"><span>{message.body}</span></div>
                  </div>
                );
              }

              return (
                <div key={message.id}>
                  {separator && <div className="sc-day"><span>{separator}</span></div>}
                  <div className={`sc-row ${isOwn ? "is-customer" : "is-admin"}`}>
                    <div className="sc-bubble">
                      <span className="sc-sender">
                        {message.sender === "admin"
                          ? "Banarasi Kala Support"
                          : (message.sender_name || "You")}
                      </span>

                      {message.attachments?.length > 0 && (
                        <div className="sc-images">
                          {message.attachments.map((image, index) => (
                            // Opens the in-page viewer rather than the raw Cloudinary URL in a
                            // new tab, which would drop the customer out of the chat.
                            <button
                              type="button"
                              key={image.url}
                              onClick={() => setLightbox({ images: message.attachments, index })}
                              aria-label="View photo"
                            >
                              <img src={image.url} alt="Attachment" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* An image-only message has no text — an empty <p> would leave a stray
                          gap under the photo. */}
                      {message.body && <p>{message.body}</p>}

                      <span className="sc-time">
                        {formatStamp(message.createdAt)}
                        {isOwn && <MessageTicks message={message} readAt={adminReadAt} />}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {!hasHistory && (
              <div className="sc-row is-admin">
                <div className="sc-bubble sc-prompts">
                  <p>What do you need help with?</p>
                  {quickReplies.map((prompt) => (
                    <button key={prompt.label} type="button" onClick={() => applyPrompt(prompt.text)}>
                      <span>{prompt.label}</span>
                      <Icon icon="lucide:chevron-right" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {supportTyping && (
              <div className="sc-row is-admin">
                <div className="sc-bubble sc-typing" aria-live="polite">
                  <span className="sc-sender">Banarasi Kala Support</span>
                  <span className="sc-dots"><i /><i /><i /></span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Always available. Support closing a strand does not lock it — writing again reopens
          that strand, because the customer has nowhere else to take the same problem. */}
      <div className="sc-composer">
        {(pendingImages.length > 0 || uploading) && (
          <div className="sc-pending-images">
            {pendingImages.map((image) => (
              <div className="sc-thumb" key={image.public_id}>
                <img src={image.url} alt="Attached" />
                <button
                  type="button"
                  onClick={() => setPendingImages((c) => c.filter((i) => i.public_id !== image.public_id))}
                  aria-label="Remove photo"
                  disabled={sending}
                >
                  <Icon icon="lucide:x" />
                </button>
              </div>
            ))}
            {uploading && (
              <div className="sc-thumb is-loading" aria-live="polite">
                <Icon icon="lucide:loader-2" className="sc-spin" />
              </div>
            )}
          </div>
        )}

        <form className="sc-form" onSubmit={send}>
          <button
            type="button"
            className="sc-attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading || pendingImages.length >= MAX_SUPPORT_IMAGES}
            aria-label="Attach a photo"
            title="Attach a photo"
          >
            <Icon icon="lucide:paperclip" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handlePickImages}
          />

          <textarea
            ref={composerRef}
            rows={1}
            value={reply}
            maxLength={2000}
            placeholder="Write a message…"
            onChange={(event) => { setReply(event.target.value); pingTyping(); }}
          />
          <button type="submit" className="sc-send" disabled={!canSend} aria-label="Send">
            <Icon icon={sending ? "lucide:loader-2" : "lucide:send"} className={sending ? "sc-spin" : ""} />
          </button>
        </form>
      </div>

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
