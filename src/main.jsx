import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary.jsx";

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

// ── Stale lazy-chunk recovery ────────────────────────────────────────────────
// After a new deploy the hashed chunk filenames change, so a browser still
// running the previous index.html will 404 when it tries to lazy-load a chunk
// (e.g. "Failed to fetch dynamically imported module"). Force a single reload to
// pick up the fresh index.html + asset names. A short time guard prevents loops.
const recoverFromStaleChunk = () => {
  const KEY = "bk_chunk_reload_at";
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 10000) return; // already reloaded recently — don't loop
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // sessionStorage may be unavailable (private mode); reload anyway.
  }
  window.location.reload();
};

const isChunkLoadError = (message = "") =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \S+ failed/i.test(
    String(message),
  );

// Vite fires this when its module-preload helper can't fetch a chunk.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  recoverFromStaleChunk();
});

// Fallbacks for dynamic imports that bypass the preload helper.
window.addEventListener("error", (event) => {
  if (isChunkLoadError(event?.message)) recoverFromStaleChunk();
});
window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event?.reason?.message || event?.reason)) recoverFromStaleChunk();
});

createRoot(document.getElementById("root")).render(
  // <StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
        <App />
      </GoogleOAuthProvider>
    </ErrorBoundary>
  // </StrictMode>,
);
