import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary.jsx";

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

createRoot(document.getElementById("root")).render(
  // <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  // </StrictMode>,
);
