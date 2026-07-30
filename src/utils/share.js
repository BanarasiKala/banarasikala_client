/**
 * Native sharing, with a clipboard fallback.
 *
 * ── The rule that matters ────────────────────────────────────────────────────────────────
 * `navigator.share()` requires TRANSIENT USER ACTIVATION. The browser grants it on a tap and
 * withdraws it a few seconds later, and awaiting anything — a fetch especially — between the
 * tap and the call can spend it. When that happens the share is rejected with
 * `NotAllowedError` and the sheet never opens.
 *
 * So: do not `await` between the gesture and calling this. Anything that needs fetching
 * (verifying rendered OG meta, for instance) belongs in a warm-up that ran earlier.
 *
 * ── Dismissal is not failure ─────────────────────────────────────────────────────────────
 * Closing the share sheet rejects the promise with `AbortError`. That is the person deciding
 * not to share, and it must be silent: a "Share cancelled" toast tells them something they
 * just did themselves. Every call site used to classify this by hand, and each one got it
 * slightly differently — hence this module.
 *
 * @param {{title?: string, url: string}} payload
 *   No `text` field is sent: iOS only renders a rich link preview when the payload is a bare
 *   URL, and `text` + `url` together are delivered as plain text.
 * @returns {Promise<"shared"|"copied"|"dismissed"|"unsupported">}
 *   Never throws for the ordinary outcomes — the caller switches on the result and decides
 *   what, if anything, to say.
 */
export const shareOrCopy = async ({ title, url }) => {
  if (navigator.share) {
    try {
      await navigator.share(title ? { title, url } : { url });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "dismissed";
      // The sheet never opened, so there is still something useful to do. Fall through to the
      // clipboard rather than reporting a dead end.
      if (error?.name !== "NotAllowedError") throw error;
    }
  }

  // Not `navigator.clipboard` unconditionally: it is undefined on an insecure origin, and
  // reading `.writeText` off undefined throws a TypeError that reads like a share failure
  // rather than an unsupported browser.
  if (!navigator.clipboard?.writeText) return "unsupported";

  await navigator.clipboard.writeText(url);
  return "copied";
};
