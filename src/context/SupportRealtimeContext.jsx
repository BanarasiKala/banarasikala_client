import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import api from "../utils/api";
import API_ENDPOINTS from "../config/api";
import { useAuth } from "./AuthContext";
import useSupportStream from "../hooks/useSupportStream";

const STREAM_URL = `${API_ENDPOINTS.base}/api/support/stream`;

const SupportRealtimeContext = createContext(null);

/**
 * One support stream per tab, fanned out to everyone who needs it.
 *
 * Three separate things want live support events: the header badge (on every page), the
 * strand list on /support, and the open chat. Each opening its own EventSource meant three
 * sockets per customer for one person reading one screen — and three presence registrations
 * on the server, so "is the customer connected" counted the same person three times.
 *
 * The stream lives here instead. Subscribers are plain callbacks in a ref rather than state:
 * a Set that changed identity on every subscribe would re-render every consumer each time a
 * component mounted.
 *
 * ── Why the stream is gated on `conversationId` ─────────────────────────────────────────
 * The endpoint 404s until the customer has actually written to us, and most never do. Opening
 * it for them would be a reconnect loop on every page of the site. The unread endpoint hands
 * back the id, so `refresh()` after a first message is what brings the stream up.
 */
export function SupportRealtimeProvider({ children }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [conversationId, setConversationId] = useState(null);
  const subscribers = useRef(new Set());

  const enabled = Boolean(user);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnread(0);
      setConversationId(null);
      return;
    }
    try {
      const { data } = await api.get("/api/support/conversation/unread");
      setUnread(Number(data?.unread_count) || 0);
      setConversationId(data?.conversation_id || null);
    } catch {
      // A badge is not worth a toast. Keep the last known count and try again next tick.
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
    if (!enabled) return undefined;
    // Slow, because the stream carries anything urgent. This is the backstop for a tab that
    // was asleep, or a stream that dropped and has not reconnected yet.
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  useSupportStream(enabled && conversationId ? STREAM_URL : null, (event) => {
    // Consumers first: they are what the customer is looking at, and the badge can lag a
    // round trip without anyone noticing.
    for (const notify of subscribers.current) {
      try {
        notify(event);
      } catch {
        // One bad subscriber must not starve the others.
      }
    }
    // Refresh rather than increment: the count is the server's to decide, and the customer
    // may have the chat open in another tab already marking these read.
    if (event.type === "message" && event.message?.sender === "admin") refresh();
    if (event.type === "read" && event.side === "customer") refresh();
  });

  const subscribe = useCallback((handler) => {
    subscribers.current.add(handler);
    return () => subscribers.current.delete(handler);
  }, []);

  const value = useMemo(
    () => ({ unread, conversationId, subscribe, refresh }),
    [unread, conversationId, subscribe, refresh],
  );

  return (
    <SupportRealtimeContext.Provider value={value}>
      {children}
    </SupportRealtimeContext.Provider>
  );
}

/**
 * Live support events.
 *
 * The handler is held in a ref and the subscription is mount-only: callers pass an inline
 * arrow, so depending on it directly would unsubscribe and resubscribe on every render.
 */
export function useSupportEvents(handler) {
  const context = useContext(SupportRealtimeContext);
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; }, [handler]);

  const subscribe = context?.subscribe;
  useEffect(() => {
    if (!subscribe) return undefined;
    return subscribe((event) => handlerRef.current?.(event));
  }, [subscribe]);
}

/** `{ unread, conversationId, refresh }` — the badge, and whether a chat exists yet. */
export function useSupport() {
  return useContext(SupportRealtimeContext) || {
    unread: 0, conversationId: null, refresh: () => {}, subscribe: () => () => {},
  };
}

export default SupportRealtimeContext;
