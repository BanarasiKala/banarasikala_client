import { Icon } from "@iconify/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { API_ENDPOINTS } from "../../config/api";
import "./ResetPassword.css";

const RESEND_SECONDS = 45;
const OTP_LENGTH = 6;

const normalizeIndianPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits.replace(/^0+/, "");
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const isValidPhone = (value) => /^[6-9]\d{9}$/.test(normalizeIndianPhone(value));

const postAuth = async (path, body) => {
  const res = await fetch(`${API_ENDPOINTS.auth}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
};

// Password strength rules shown as a live checklist on the create-password step.
const PASSWORD_RULES = [
  { key: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { key: "case", label: "Includes uppercase and lowercase letters", test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { key: "number", label: "Includes a number", test: (v) => /\d/.test(v) },
  { key: "special", label: "Includes a special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const { showNotification } = useNotification();

  const prefill = location.state || {};
  const accountPhone = normalizeIndianPhone(prefill.phone || user?.phone || "");
  const accountEmail = String(prefill.email || user?.email || "").trim();

  const [method, setMethod] = useState(() => (accountPhone ? "phone" : "email")); // "phone" | "email"
  const [step, setStep] = useState("request"); // request | verify | reset | success
  const [phone, setPhone] = useState(accountPhone);
  const [email, setEmail] = useState(accountEmail);

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const otpRefs = useRef([]);

  // Phone path tokens
  const [verificationId, setVerificationId] = useState("");
  const [resetToken, setResetToken] = useState("");
  // Email path token (session token reused at reset time)
  const [otpToken, setOtpToken] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  useEffect(() => {
    if (step !== "request") return;
    if (!phone && accountPhone) setPhone(accountPhone);
    if (!email && accountEmail) setEmail(accountEmail);
  }, [accountEmail, accountPhone, email, phone, step]);

  const startResendTimer = () => {
    clearInterval(timerRef.current);
    setSeconds(RESEND_SECONDS);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const switchMethod = (next) => {
    if (next === method) return;
    setMethod(next);
    setError("");
  };

  const sentToLabel = method === "phone" ? `+91 ${phone}` : email;

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(newPassword) })),
    [newPassword],
  );
  const allPasswordRulesPass = passwordChecks.every((rule) => rule.passed);

  // ── Step 1: send the OTP ────────────────────────────────────────────────
  const sendOtp = async () => {
    setError("");
    if (method === "phone") {
      if (!isValidPhone(phone)) {
        setError("Mobile number is missing from your account. Please update it from your account page.");
        return;
      }
      setLoading(true);
      try {
        const cleanPhone = normalizeIndianPhone(phone);
        const data = await postAuth("/send-password-reset-phone-otp", { phone: cleanPhone });
        setPhone(cleanPhone);
        setVerificationId(data.verificationId);
        setOtp(Array(OTP_LENGTH).fill(""));
        setStep("verify");
        startResendTimer();
      } catch (err) {
        setError(err.message || "Failed to send OTP. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Email path
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError("Email address is missing from your account. Please update it from your account page.");
      return;
    }
    setLoading(true);
    try {
      // Confirm an account exists for this email before sending the code.
      await postAuth("/forgot-password", { email: cleanEmail });
      const data = await postAuth("/send-email-otp", { email: cleanEmail, purpose: "forgot_password", name: "" });
      setEmail(cleanEmail);
      setOtpToken(data.token);
      setOtp(Array(OTP_LENGTH).fill(""));
      setStep("verify");
      startResendTimer();
    } catch (err) {
      setError(err.message || "Unable to start password reset. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (seconds > 0 || loading) return;
    setError("");
    setLoading(true);
    try {
      if (method === "phone") {
        const data = await postAuth("/send-password-reset-phone-otp", { phone });
        setVerificationId(data.verificationId);
      } else {
        const data = await postAuth("/send-email-otp", { email, purpose: "forgot_password", name: "" });
        setOtpToken(data.token);
      }
      setOtp(Array(OTP_LENGTH).fill(""));
      startResendTimer();
      showNotification("A new verification code has been sent.", "success");
    } catch (err) {
      setError(err.message || "Failed to resend the code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify the OTP ──────────────────────────────────────────────
  const verifyOtp = async () => {
    const code = otp.join("");
    setError("");
    if (code.length !== OTP_LENGTH) {
      setError("Please enter the complete verification code.");
      return;
    }
    setLoading(true);
    try {
      if (method === "phone") {
        const data = await postAuth("/verify-password-reset-phone-otp", { phone, verificationId, otp: code });
        setResetToken(data.resetToken);
      } else {
        await postAuth("/verify-email-otp", { token: otpToken, otp: code, purpose: "forgot_password" });
      }
      clearInterval(timerRef.current);
      setStep("reset");
    } catch (err) {
      setError(err.message || "The code is incorrect or expired. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: set the new password ────────────────────────────────────────
  const submitNewPassword = async () => {
    setError("");
    if (!allPasswordRulesPass) {
      setError("Please meet all the password requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      if (method === "phone") {
        await postAuth("/reset-password-by-phone", { resetToken, newPassword });
      } else {
        await postAuth("/reset-password", { email, email_otp_token: otpToken, newPassword });
      }
      setStep("success");
    } catch (err) {
      setError(err.message || "Unable to reset your password right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP box input handling ──────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((d, i) => { next[i] = d; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const goToAccount = () => {
    setError("");
    navigate("/profile");
  };

  const goToLogin = () => {
    logout();
    navigate("/login");
  };

  const STEP_SUBTITLE = {
    request: "Enter your phone number or email\nto reset your password.",
    verify: "We will send you a verification code\nto reset your password.",
    reset: "Create a new password\nfor your account.",
  };

  return (
    <main className="rp-page">
      <button type="button" className="rp-back" onClick={goToAccount} aria-label="Back to account">
        <Icon icon="lucide:arrow-left" />
      </button>
      <section className="rp-shell">
        {step !== "success" ? (
          <>
            <header className="rp-head">
              <h1 className="rp-title">Reset Password</h1>
            </header>
            <p className="rp-subtitle">{STEP_SUBTITLE[step]}</p>

            {(step === "request" || step === "verify") && (
              <div className="rp-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={method === "phone"}
                  className={`rp-tab ${method === "phone" ? "is-active" : ""}`}
                  onClick={() => step === "request" && switchMethod("phone")}
                  disabled={step !== "request"}
                >
                  Phone Number
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={method === "email"}
                  className={`rp-tab ${method === "email" ? "is-active" : ""}`}
                  onClick={() => step === "request" && switchMethod("email")}
                  disabled={step !== "request"}
                >
                  Email Address
                </button>
              </div>
            )}

            {error && <p className="rp-error">{error}</p>}

            {/* ── Step 1: request ── */}
            {step === "request" && (
              <form className="rp-form" onSubmit={(e) => { e.preventDefault(); sendOtp(); }}>
                {method === "phone" ? (
                  <label className="rp-account-field">
                    <span className="rp-account-input has-left-addon is-readonly">
                      <span className="rp-country-code">
                        <span className="rp-flag-india" aria-hidden="true" />
                        +91
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        readOnly
                        aria-readonly="true"
                        placeholder="Mobile number not available"
                      />
                      <Icon icon="lucide:lock-keyhole" className="rp-readonly-icon" />
                    </span>
                  </label>
                ) : (
                  <label className="rp-account-field">
                    <span className="rp-account-input is-readonly">
                      <Icon icon="lucide:mail" />
                      <input
                        type="email"
                        value={email}
                        readOnly
                        aria-readonly="true"
                        placeholder="Email address not available"
                      />
                      <Icon icon="lucide:lock-keyhole" className="rp-readonly-icon" />
                    </span>
                  </label>
                )}
                <button type="submit" className="rp-btn" disabled={loading}>
                  {loading ? "SENDING…" : "NEXT"}
                </button>
              </form>
            )}

            {/* ── Step 2: verify ── */}
            {step === "verify" && (
              <form className="rp-form" onSubmit={(e) => { e.preventDefault(); verifyOtp(); }}>
                <div className="rp-sent">
                  <span className="rp-sent-icon">
                    <Icon icon={method === "phone" ? "lucide:message-square-text" : "lucide:mail"} />
                  </span>
                  <span className="rp-sent-text">
                    A verification code has been sent to
                    <strong>{sentToLabel}</strong>
                  </span>
                </div>

                <span className="rp-field-label">Enter Verification Code</span>
                <div className="rp-otp" onPaste={handleOtpPaste}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      autoFocus={index === 0}
                      className={`rp-otp-box ${digit ? "is-filled" : ""}`}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    />
                  ))}
                </div>

                <p className="rp-resend">
                  Didn't receive the code?{" "}
                  {seconds > 0 ? (
                    <span className="rp-resend-wait">Resend in {seconds}s</span>
                  ) : (
                    <button type="button" className="rp-resend-btn" onClick={resendOtp} disabled={loading}>
                      Resend Code
                    </button>
                  )}
                </p>

                <button type="submit" className="rp-btn" disabled={loading}>
                  {loading ? "VERIFYING…" : "VERIFY"}
                </button>
              </form>
            )}

            {/* ── Step 3: new password ── */}
            {step === "reset" && (
              <form className="rp-form" onSubmit={(e) => { e.preventDefault(); submitNewPassword(); }}>
                <span className="rp-field-label">New Password</span>
                <div className="rp-input">
                  <Icon icon="lucide:lock" className="rp-input-icon" />
                  <input
                    type={showNew ? "text" : "password"}
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <button type="button" className="rp-eye" onClick={() => setShowNew((v) => !v)} aria-label="Toggle password visibility">
                    <Icon icon={showNew ? "lucide:eye-off" : "lucide:eye"} />
                  </button>
                </div>

                <ul className="rp-checklist">
                  {passwordChecks.map((rule) => (
                    <li key={rule.key} className={rule.passed ? "is-passed" : ""}>
                      <Icon icon={rule.passed ? "lucide:check-circle-2" : "lucide:circle"} />
                      {rule.label}
                    </li>
                  ))}
                </ul>

                <span className="rp-field-label">Confirm Password</span>
                <div className="rp-input">
                  <Icon icon="lucide:lock-keyhole" className="rp-input-icon" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                  <button type="button" className="rp-eye" onClick={() => setShowConfirm((v) => !v)} aria-label="Toggle password visibility">
                    <Icon icon={showConfirm ? "lucide:eye-off" : "lucide:eye"} />
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <span className="rp-mismatch">Passwords do not match.</span>
                )}

                <button type="submit" className="rp-btn" disabled={loading || !allPasswordRulesPass}>
                  {loading ? "RESETTING…" : "RESET PASSWORD"}
                </button>
              </form>
            )}

            <button type="button" className="rp-back-login" onClick={() => navigate("/")}>
              &lt; Home
            </button>
          </>
        ) : (
          <div className="rp-success">
            <span className="rp-success-icon"><Icon icon="lucide:check" /></span>
            <h1 className="rp-success-title">Password Reset Successful!</h1>
            <p className="rp-success-sub">Your password has been reset successfully.</p>
            <button type="button" className="rp-btn" onClick={goToLogin}>
              GO TO LOGIN
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
