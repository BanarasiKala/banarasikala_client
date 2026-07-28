import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../config/api";
import "./EmailPreferences.css";

/**
 * The page every unsubscribe link lands on.
 *
 * An address can be on several lists at once — the newsletter, plus one back-in-stock alert
 * per saree it is waiting on — so this shows all of them ticked and lets the customer switch
 * off whichever they mean. A link that silently killed only the newsletter would leave them
 * still receiving mail they believed they had stopped.
 *
 * Authorised entirely by the signed token in the URL, because this is opened from an email
 * client where nobody is logged in.
 */
const EmailPreferences = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState("loading"); // loading | ready | invalid | error
  const [newsletter, setNewsletter] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [keptAlertIds, setKeptAlertIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (!email || !token) {
      setStatus("invalid");
      return undefined;
    }
    const controller = new AbortController();

    (async () => {
      try {
        const params = new URLSearchParams({ email, token });
        const res = await fetch(`${API_ENDPOINTS.emailPreferences}?${params}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) {
          setStatus(res.status === 403 ? "invalid" : "error");
          return;
        }
        setNewsletter(Boolean(data.newsletter));
        setAlerts(Array.isArray(data.stockAlerts) ? data.stockAlerts : []);
        setKeptAlertIds((data.stockAlerts || []).map((row) => row.id));
        setStatus("ready");
      } catch (err) {
        if (err.name !== "AbortError") setStatus("error");
      }
    })();

    return () => controller.abort();
  }, [email, token]);

  const save = useCallback(async (payload, message) => {
    setSaving(true);
    setSavedMessage("");
    try {
      const res = await fetch(API_ENDPOINTS.emailPreferences, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSavedMessage(data.message || "Could not save your preferences. Please try again.");
        return;
      }
      setSavedMessage(message || data.message);
    } catch {
      setSavedMessage("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [email, token]);

  const toggleAlert = (id) => {
    setSavedMessage("");
    setKeptAlertIds((current) => (
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    ));
  };

  const unsubscribeAll = async () => {
    await save({ unsubscribeAll: true }, "You have been unsubscribed from everything. We are sorry to see you go.");
    setNewsletter(false);
    setAlerts([]);
    setKeptAlertIds([]);
  };

  const nothingLeft = status === "ready" && !newsletter && alerts.length === 0;

  return (
    <main className="bk-prefs-page">
      <div className="bk-prefs-card">
        <p className="bk-prefs-eyebrow">Banarasi Kala</p>
        <h1>Email Preferences</h1>

        {status === "loading" && (
          /* The ready state is an address line, a short instruction, the ticked list and
             the two buttons. A single line of "Loading…" left the card a third of its
             height and then the whole thing unfolded. Two list rows is the floor —
             newsletter plus at least one alert is what brings most people here. */
          <div aria-label="Loading your preferences" aria-busy="true">
            <span className="bk-sk bk-prefs-sk-line bk-prefs-sk-email" aria-hidden="true" />
            <span className="bk-sk bk-prefs-sk-line bk-prefs-sk-note" aria-hidden="true" />
            <span className="bk-sk bk-prefs-sk-line bk-prefs-sk-note short" aria-hidden="true" />

            <ul className="bk-prefs-list" aria-hidden="true">
              {[1, 2].map((row) => (
                <li key={row}>
                  <span className="bk-prefs-sk-label">
                    <span className="bk-sk bk-prefs-sk-box" />
                    <span className="bk-prefs-sk-copy">
                      <span className="bk-sk bk-prefs-sk-strong" />
                      <span className="bk-sk bk-prefs-sk-small" />
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="bk-prefs-actions" aria-hidden="true">
              <span className="bk-sk bk-prefs-sk-btn" />
              <span className="bk-sk bk-prefs-sk-btn wide" />
            </div>
          </div>
        )}

        {status === "invalid" && (
          <>
            <p className="bk-prefs-note">
              This unsubscribe link is not valid. It may have been altered, or only part of it
              was copied across from your email.
            </p>
            <p className="bk-prefs-note">
              Open the link directly from the email, or write to{" "}
              <a href="mailto:support@banarasikala.com">support@banarasikala.com</a> and we will
              take you off our lists ourselves.
            </p>
          </>
        )}

        {status === "error" && (
          <p className="bk-prefs-note">
            We could not load your preferences just now. Please try the link again in a moment.
          </p>
        )}

        {status === "ready" && (
          <>
            <p className="bk-prefs-email">
              Managing email for <strong>{email}</strong>
            </p>

            {nothingLeft ? (
              <p className="bk-prefs-note">
                This address is not subscribed to anything. You will not receive marketing email
                from us — order updates for any live order still apply.
              </p>
            ) : (
              <>
                <p className="bk-prefs-note">
                  Everything ticked below is currently sending you email. Untick anything you no
                  longer want and save.
                </p>

                <ul className="bk-prefs-list">
                  <li>
                    <label>
                      <input
                        type="checkbox"
                        checked={newsletter}
                        onChange={() => { setNewsletter((on) => !on); setSavedMessage(""); }}
                      />
                      <span>
                        <strong>Newsletter &amp; offers</strong>
                        <small>New arrivals, exclusive pieces and occasional offers.</small>
                      </span>
                    </label>
                  </li>

                  {alerts.map((alert) => (
                    <li key={alert.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={keptAlertIds.includes(alert.id)}
                          onChange={() => toggleAlert(alert.id)}
                        />
                        <span>
                          <strong>Back-in-stock alert</strong>
                          <small>
                            {alert.slug
                              ? <Link to={`/product/${alert.slug}`}>{alert.productName}</Link>
                              : alert.productName}
                            {" "}— one email when it is available again.
                          </small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>

                <div className="bk-prefs-actions">
                  <button
                    type="button"
                    className="bk-prefs-save"
                    disabled={saving}
                    onClick={() => save({ newsletter, stockAlertIds: keptAlertIds })}
                  >
                    {saving ? "Saving…" : "Save preferences"}
                  </button>
                  <button
                    type="button"
                    className="bk-prefs-all"
                    disabled={saving}
                    onClick={unsubscribeAll}
                  >
                    Unsubscribe from everything
                  </button>
                </div>
              </>
            )}

            {savedMessage && (
              <p className="bk-prefs-saved" role="status">
                <Icon icon="lucide:check-circle" aria-hidden="true" />
                {savedMessage}
              </p>
            )}
          </>
        )}

        <p className="bk-prefs-foot">
          Order confirmations, delivery updates and other messages about a live order are not
          marketing and are not affected by these settings. See our{" "}
          <Link to="/privacy-policy">Privacy Policy</Link>.
        </p>

        <Link to="/" className="bk-prefs-home">Back to Banarasi Kala</Link>
      </div>
    </main>
  );
};

export default EmailPreferences;
