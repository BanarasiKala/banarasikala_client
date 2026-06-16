import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Icon } from "@iconify/react";
import { API_ENDPOINTS } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import verticalLogo from "../../assets/vertical_logo.png";
import headerBackground from "../../assets/header_backgroung.png";
import mobileBackground from "../../assets/img.jpg";
import "./VerifyEmail.css";

const STEPS = {
  VERIFYING: "verifying",
  EMAIL_VERIFIED: "email_verified",
  CONFIRM_PHONE: "confirm_phone",
  PHONE_OTP: "phone_otp",
  SUCCESS: "success",
  ERROR: "error",
};

const formatPhone = (p) => {
  const d = String(p || "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
};

const OtpBoxes = ({ value, onChange, disabled }) => {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  const update = (i, raw) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = digit;
    onChange(next.join(""));
    if (digit && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(p);
    refs.current[Math.min(p.length, 5)]?.focus();
  };

  return (
    <div className="ve-otp-boxes" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => update(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
};

const PhoneIconBlock = () => (
  <div className="ve-confirm-icon-row">
    <span className="ve-sparkle">✦</span>
    <div className="ve-phone-circle">
      <Icon icon="lucide:smartphone" className="ve-phone-icon" />
      <div className="ve-shield-badge">
        <Icon icon="lucide:check" />
      </div>
    </div>
    <span className="ve-sparkle">✦</span>
  </div>
);

const LotusDivider = () => (
  <div className="ve-lotus-divider" aria-hidden="true">
    <span /><Icon icon="ph:flower-lotus" /><span />
  </div>
);

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeRegistration } = useAuth();

  const [step, setStep] = useState(STEPS.VERIFYING);
  const [errorMsg, setErrorMsg] = useState("");
  const [phone, setPhone] = useState("");
  const [editablePhone, setEditablePhone] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendSeconds, setResendSeconds] = useState(30);
  const timerRef = useRef(null);

  const urlToken = searchParams.get("token");
  const preVerifiedToken = searchParams.get("vt");

  const startResendTimer = () => {
    clearInterval(timerRef.current);
    setResendSeconds(30);
    timerRef.current = setInterval(() => {
      setResendSeconds((s) => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const sendOtp = async (regToken, phoneOverride = null, userInitiated = false) => {
    try {
      const payload = { registrationToken: regToken };
      if (phoneOverride) payload.phone = phoneOverride;
      const res = await axios.post(`${API_ENDPOINTS.auth}/send-registration-phone-otp`, payload);
      if (res.data.maskedPhone) setMaskedPhone(res.data.maskedPhone);
      setStep(STEPS.PHONE_OTP);
      startResendTimer();
    } catch (err) {
      const msg = err.response?.data?.message || "Could not send OTP. Please try again.";
      if (userInitiated) {
        setOtpError(msg);
      } else {
        setErrorMsg(msg);
        setStep(STEPS.ERROR);
      }
    }
  };

  useEffect(() => {
    if (preVerifiedToken) {
      setRegistrationToken(preVerifiedToken);
      sendOtp(preVerifiedToken);
      return;
    }

    if (!urlToken) {
      setErrorMsg("No verification token found. Please register again.");
      setStep(STEPS.ERROR);
      return;
    }

    const verify = async () => {
      try {
        const res = await axios.get(`${API_ENDPOINTS.auth}/verify-email-link?token=${encodeURIComponent(urlToken)}`);
        setRegistrationToken(res.data.verifiedToken);
        if (res.data.phone) {
          setPhone(res.data.phone);
          setEditablePhone(String(res.data.phone).replace(/\D/g, "").slice(-10));
        }
        if (res.data.maskedPhone) setMaskedPhone(res.data.maskedPhone);
        setStep(STEPS.EMAIL_VERIFIED);
      } catch (err) {
        const msg = err.response?.data?.message || "Email verification failed. The link may be expired or already used.";
        setErrorMsg(msg);
        setStep(STEPS.ERROR);
      }
    };

    verify();
  }, [urlToken, preVerifiedToken]);

  const handleSendOtp = async () => {
    const normalized = editablePhone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(normalized)) {
      setOtpError("Please enter a valid 10-digit mobile number (starting with 6–9).");
      return;
    }
    setOtpError("");
    setSendingOtp(true);
    await sendOtp(registrationToken, normalized, true);
    setSendingOtp(false);
  };

  const handleResend = async () => {
    if (resendSeconds > 0) return;
    setOtpError("");
    await sendOtp(registrationToken, null, true);
  };

  const handleSubmitOtp = async (e) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) { setOtpError("Please enter the 6-digit OTP."); return; }
    setOtpLoading(true);
    setOtpError("");
    try {
      await completeRegistration(registrationToken, cleanOtp, null, true);
      setStep(STEPS.SUCCESS);
    } catch (err) {
      setOtpError(err.message || "Invalid or expired OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <main className="ve-page" style={{ "--ve-bg": `url(${headerBackground})`, "--ve-bg-mobile": `url(${mobileBackground})` }}>
      <Link to="/login?mode=signup" className="ve-back-btn" aria-label="Back">
        <Icon icon="lucide:arrow-left" />
      </Link>

      <div className="ve-brand">
        <img src={verticalLogo} className="ve-logo" alt="Banarasi Kala" />
      </div>

      <div className="ve-card">

        {step === STEPS.VERIFYING && (
          <div className="ve-center">
            <div className="ve-spinner" />
            <p className="ve-subtitle">Verifying your email…</p>
          </div>
        )}

        {step === STEPS.EMAIL_VERIFIED && (
          <div className="ve-confirm ve-ev">
            <div className="ve-ev-icon-row">
              <span className="ve-sparkle">✦</span>
              <div className="ve-ev-circle">
                <Icon icon="lucide:check" />
              </div>
              <span className="ve-sparkle">✦</span>
            </div>
            <h1 className="ve-title ve-ev-title">
              <span className="ve-sparkle ve-ev-inline-sparkle">✦</span>
              Email Verified
              <span className="ve-sparkle ve-ev-inline-sparkle">✦</span>
            </h1>
            <LotusDivider />
            <p className="ve-subtitle">Your email has been verified successfully.</p>
            <p className="ve-subtitle">
              Let's verify your mobile number<br />to complete your account.
            </p>
            <button
              type="button"
              className="ve-btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => setStep(STEPS.CONFIRM_PHONE)}
            >
              <span>Continue to Mobile Verification</span>
              <Icon icon="lucide:arrow-right" />
            </button>
          </div>
        )}

        {step === STEPS.CONFIRM_PHONE && (
          <div className="ve-confirm">
            <PhoneIconBlock />
            <h1 className="ve-title">Verify Mobile Number</h1>
            <LotusDivider />
            <p className="ve-subtitle">
              We will send you a One Time Password (OTP)<br />to verify your mobile number.
            </p>

            <p className="ve-field-label">Mobile Number</p>
            <div className={`ve-phone-display${otpError ? " ve-phone-error" : ""}`}>
              <span className="ve-phone-country">
                <span className="ve-flag-india" aria-hidden="true" />
                +91
              </span>
              <span className="ve-phone-sep" />
              <input
                type="tel"
                className="ve-phone-input"
                inputMode="numeric"
                maxLength={10}
                value={editablePhone}
                placeholder="Enter 10-digit number"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  if (digits.length > 0 && !/^[6-9]/.test(digits)) return;
                  setEditablePhone(digits);
                  if (otpError) setOtpError("");
                }}
              />
            </div>
            {otpError && <p className="ve-error" style={{ margin: "6px 0 0", textAlign: "left" }}>{otpError}</p>}

            <p className="ve-secure-note">
              <Icon icon="lucide:lock" className="ve-lock-icon" />
              Your number is safe and secure with us.
            </p>

            <button
              type="button"
              className="ve-btn-primary"
              onClick={handleSendOtp}
              disabled={sendingOtp}
            >
              {sendingOtp ? "Sending…" : <><span>Send OTP</span><Icon icon="lucide:arrow-right" /></>}
            </button>
          </div>
        )}

        {step === STEPS.PHONE_OTP && (
          <form onSubmit={handleSubmitOtp} className="ve-otp-form" noValidate>
            <div className="ve-confirm-icon-row" style={{ marginBottom: 22 }}>
              <div className="ve-phone-circle">
                <Icon icon="ph:chat-dots" className="ve-phone-icon" />
                <div className="ve-shield-badge">
                  <Icon icon="lucide:check" />
                </div>
              </div>
            </div>
            <h1 className="ve-title">Verify OTP</h1>
            <LotusDivider />
            <p className="ve-subtitle">
              Enter the 6-digit code sent to your mobile number
            </p>
            <p className="ve-otp-phone-display">
              {editablePhone
                ? `+91 ${editablePhone.replace(/(\d{5})(\d{5})/, "$1 $2")}`
                : maskedPhone}
              {editablePhone && (
                <button
                  type="button"
                  className="ve-otp-edit-btn"
                  onClick={() => { setStep(STEPS.CONFIRM_PHONE); setOtp(""); setOtpError(""); }}
                >
                  Edit
                </button>
              )}
            </p>
            <OtpBoxes
              value={otp}
              onChange={(v) => { setOtp(v.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
              disabled={otpLoading}
            />
            <div className="ve-otp-success-banner">
              <Icon icon="lucide:shield-check" />
              OTP sent successfully!
            </div>
            {otpError && <p className="ve-error">{otpError}</p>}
            <div className="ve-otp-resend">
              <p className="ve-otp-resend-label">Didn't receive OTP?</p>
              {resendSeconds > 0 ? (
                <p className="ve-otp-resend-timer">
                  Resend OTP in <strong>{`${String(Math.floor(resendSeconds / 60)).padStart(2, "0")}:${String(resendSeconds % 60).padStart(2, "0")}`}</strong>
                </p>
              ) : (
                <button type="button" className="ve-resend-btn" onClick={handleResend}>
                  Resend OTP
                </button>
              )}
            </div>
            <button type="submit" className="ve-btn-primary" disabled={otpLoading}>
              {otpLoading ? "Verifying…" : <><span>Create My Account</span><Icon icon="lucide:arrow-right" /></>}
            </button>
            <p className="ve-otp-bottom-note">
              <Icon icon="lucide:lock" />
              Your information is secure with us.
            </p>
          </form>
        )}

        {step === STEPS.SUCCESS && (
          <div className="ve-confirm ve-success-screen">
            <div className="ve-success-icon-wrap">
              <span className="ve-success-sparkle ve-ss-tl">✦</span>
              <span className="ve-success-sparkle ve-ss-tr">✦</span>
              <div className="ve-success-circle">
                <Icon icon="lucide:check" />
              </div>
              <span className="ve-success-sparkle ve-ss-bl">✦</span>
              <span className="ve-success-sparkle ve-ss-br">✦</span>
            </div>
            <h1 className="ve-title ve-success-title">Welcome to<br />Banarasi Kala!</h1>
            <LotusDivider />
            <p className="ve-subtitle">Your account has been created successfully.</p>
            <div className="ve-benefits">
              <div className="ve-benefit">
                <div className="ve-benefit-icon"><Icon icon="lucide:gift" /></div>
                <div className="ve-benefit-text">
                  <strong>₹100 Welcome Wallet Credit</strong>
                  <span>Use it on your first purchase</span>
                </div>
              </div>
              <div className="ve-benefit">
                <div className="ve-benefit-icon"><Icon icon="lucide:package" /></div>
                <div className="ve-benefit-text">
                  <strong>Premium Packaging</strong>
                  <span>Every order is packed with care</span>
                </div>
              </div>
              <div className="ve-benefit">
                <div className="ve-benefit-icon"><Icon icon="lucide:truck" /></div>
                <div className="ve-benefit-text">
                  <strong>Free Delivery</strong>
                  <span>Enjoy free delivery on all orders</span>
                </div>
              </div>
            </div>
            <button type="button" className="ve-btn-primary" onClick={() => navigate("/")}>
              <span>Start Shopping</span><Icon icon="lucide:arrow-right" />
            </button>
            <p className="ve-success-bottom-note">
              <Icon icon="lucide:shield" />
              Your information is secure with us.
            </p>
          </div>
        )}

        {step === STEPS.ERROR && (() => {
          const m = errorMsg.toLowerCase();
          const isLogin   = m.includes("log in") || m.includes("login");
          const isExpired = !isLogin && m.includes("expired");
          const isNotFound = !isLogin && !isExpired && m.includes("not found");

          const icon   = isLogin ? "lucide:user-check" : isExpired ? "lucide:clock" : isNotFound ? "lucide:user-x" : "lucide:link-2-off";
          const circle = isLogin ? "ve-status-info" : "ve-status-error";
          const title  = isLogin ? "Already Registered" : isExpired ? "Link Expired" : isNotFound ? "Account Not Found" : "Invalid Link";
          const cta    = isLogin
            ? { to: "/login",            label: "Go to Login" }
            : { to: "/login?mode=signup", label: "Register Again" };

          return (
            <div className="ve-center">
              <div className={`ve-status-circle ${circle}`}>
                <Icon icon={icon} />
              </div>
              <h1 className="ve-title">{title}</h1>
              <LotusDivider />
              <p className="ve-subtitle">{errorMsg}</p>
              <Link to={cta.to} className="ve-btn-primary ve-btn-link">
                <span>{cta.label}</span><Icon icon="lucide:arrow-right" />
              </Link>
            </div>
          );
        })()}

      </div>
    </main>
  );
}
