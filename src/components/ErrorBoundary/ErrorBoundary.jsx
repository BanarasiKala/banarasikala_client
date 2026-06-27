import { Icon } from "@iconify/react";
import { Component } from 'react';
import "./ErrorBoundary.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // A failed lazy-chunk import (stale assets after a deploy) surfaces here as
    // a render error. Auto-reload once to fetch the fresh index.html + chunks
    // instead of showing the error page. Shares the loop guard with main.jsx.
    const message = error?.message || String(error || '');
    const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \S+ failed/i.test(message);
    if (isChunkError) {
      try {
        const KEY = 'bk_chunk_reload_at';
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last > 10000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="bk-error-page">
          <section className="bk-error-card" role="alert">
            <div className="bk-error-icon" aria-hidden="true">
              <Icon icon="lucide:alert-triangle" />
            </div>
            <h1>Something Went Wrong</h1>
            <p>We apologize for the inconvenience. Please reload the page or return home.</p>
            
            {this.state.error && (
              <div className="bk-error-details">
                {this.state.error.message || this.state.error.toString()}
              </div>
            )}

            <div className="bk-error-actions">
              <button
                onClick={this.handleReload}
                type="button"
                className="primary"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                type="button"
              >
                Go Home
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

