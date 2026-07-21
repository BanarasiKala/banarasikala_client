import { useEffect, useRef } from "react";
import api from "../utils/api";

/**
 * Live support events over SSE.
 *
 * Two things make this less trivial than `new EventSource(url)`:
 *
 * 1. EventSource cannot send an Authorization header, and our auth is a Bearer token in
 *    localStorage. So we first POST /support/stream-ticket (a normal authenticated request)
 *    to trade the JWT for a 60-second single-use token, and put THAT in the stream URL.
 *    The real credential never lands in a URL, an access log, or browser history.
 *
 * 2. Because the token is single-use, EventSource's built-in auto-reconnect is useless — it
 *    would retry the same spent URL forever and every attempt would 401. So reconnect is
 *    handled here: mint a fresh token, then reopen, with backoff.
 *
 * @param {string|null} path   `/api/support/tickets/12/stream` or `/api/support/stream/admin`.
 *                             Pass null to stay disconnected (modal closed, logged out).
 * @param {function}    onEvent Called with each parsed payload. Kept in a ref so a caller
 *                             that defines it inline doesn't tear down the stream on every
 *                             render.
 */
export default function useSupportStream(path, onEvent) {
  // Latest-handler ref, assigned in an effect rather than during render: the caller
  // typically passes an inline arrow, and reading it directly in the effect below would
  // tear down and rebuild the stream on every render.
  const handlerRef = useRef(onEvent);
  useEffect(() => { handlerRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!path) return undefined;

    let source = null;
    let retryTimer = null;
    let attempts = 0;
    let cancelled = false;

    const connect = async () => {
      if (cancelled) return;
      try {
        const { data } = await api.post("/api/support/stream-ticket");
        if (cancelled || !data?.token) return;

        source = new EventSource(
          `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(data.token)}`,
        );

        source.onopen = () => { attempts = 0; };

        source.onmessage = (event) => {
          try {
            handlerRef.current?.(JSON.parse(event.data));
          } catch {
            // A malformed frame must not kill the stream.
          }
        };

        source.onerror = () => {
          // Close before retrying: EventSource would otherwise reconnect on its own to the
          // now-spent token URL and 401 in a loop.
          source?.close();
          source = null;
          if (cancelled) return;
          // Backoff to 30s. A support thread does not need a tight reconnect, and a tab left
          // open overnight against a downed server shouldn't hammer it.
          const delay = Math.min(30000, 1000 * 2 ** attempts++);
          retryTimer = setTimeout(connect, delay);
        };
      } catch {
        if (cancelled) return;
        const delay = Math.min(30000, 1000 * 2 ** attempts++);
        retryTimer = setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [path]);
}

/**
 * Throttled "I am typing" ping.
 *
 * The server re-arms a 6s TTL on each call, so pinging once every 3s while the user types
 * keeps the indicator alive without a request per keystroke.
 */
export function useTypingPing(ticketId) {
  const lastSent = useRef(0);
  return () => {
    if (!ticketId) return;
    const now = Date.now();
    if (now - lastSent.current < 3000) return;
    lastSent.current = now;
    api.post(`/api/support/tickets/${ticketId}/typing`).catch(() => {});
  };
}
