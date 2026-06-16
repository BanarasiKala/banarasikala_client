import { Icon } from "@iconify/react";
import { GoogleLogin } from "@react-oauth/google";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import headerBackground from "../../assets/header_backgroung.png";
import mobileBackground from "../../assets/img.jpg";
import flatSaree from "../../assets/image.png";
import verticalLogo from "../../assets/vertical_logo.png";
import { API_ENDPOINTS } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { getApiErrorMessage } from "../../utils/error";
import { numberEnv } from "../../utils/env";
import "./Auth.css";

const SUPPORT_MESSAGE = "Something went wrong. Please contact support or try again later.";
const OTP_SEND_LIMIT = 3;
const EMAIL_OTP_DIGIT_COUNT = numberEnv("VITE_EMAIL_OTP_LENGTH");

const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits.replace(/^0+/, "");
};

const getFriendlyError = (error, fallback = SUPPORT_MESSAGE) => {
  const message = getApiErrorMessage(error, fallback);
  const lower = message.toLowerCase();
  if (lower.includes("already registered")) return message;
  if (lower.includes("invalid email or password")) return "Email/phone or password is incorrect.";
  if (lower.includes("no account found")) return message;
  if (lower.includes("valid 10 digit")) return "Please enter a valid 10 digit mobile number.";
  if (lower.includes("exceeded") || lower.includes("blocked") || lower.includes("throttle")) {
    return "OTP attempts exceeded. Please try again after 24 hours or contact support.";
  }
  if (lower.includes("password must")) return message;
  if (lower.includes("verify your email") || lower.includes("email not verified")) return message;
  if (lower.includes("phone number already")) return message;
  return fallback;
};

const AuthField = ({
  icon,
  label,
  name,
  type = "text",
  value,
  placeholder,
  onChange,
  rightAction,
  leftAddon,
  maxLength,
  inputMode,
  error,
}) => (
  <div className="auth-field">
    <span className="auth-label">{label}</span>
    <span className={`auth-input-wrap${leftAddon ? " has-left-addon" : ""}${error ? " has-error" : ""}`}>
      {leftAddon || <Icon icon={icon} />}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={name}
      />
      {rightAction}
    </span>
    {error && <span className="auth-field-error">{error}</span>}
  </div>
);

const OtpBoxes = ({ value, length, onChange, disabled }) => {
  const inputRefs = useRef([]);
  const digits = Array.from({ length }, (_, index) => value[index] || "");

  const updateDigit = (index, rawValue) => {
    const nextDigit = rawValue.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[index] = nextDigit;
    onChange(next.join(""));
    if (nextDigit && index < length - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted);
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="auth-otp-boxes" style={{ "--otp-digits": length }} onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={`otp-${index}`}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          value={digit}
          disabled={disabled}
          maxLength={1}
          onChange={(e) => updateDigit(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  );
};

const GoogleBtn = ({ onSuccess, onError, text }) => {
  const ref = useRef(null);
  const [width, setWidth] = useState(400);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.offsetWidth || 400);
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="auth-google-wrap">
      <GoogleLogin onSuccess={onSuccess} onError={onError} width={width} text={text} shape="rectangular" />
    </div>
  );
};

const Auth = () => {
  const [activeTab, setActiveTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSendAttempts, setOtpSendAttempts] = useState({});
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState("");
  const [animationKey, setAnimationKey] = useState(0);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetOtpToken, setResetOtpToken] = useState("");
  const [emailOtpSessionToken, setEmailOtpSessionToken] = useState("");
  const [signupStep, setSignupStep] = useState("form");
  const [registrationToken, setRegistrationToken] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Per-field validation errors
  const [loginErrors, setLoginErrors] = useState({});
  const [signupErrors, setSignupErrors] = useState({});
  const [forgotErrors, setForgotErrors] = useState({});
  const [resetErrors, setResetErrors] = useState({});

  const [pendingGoogleToken, setPendingGoogleToken] = useState("");
  const [phoneVerifPhone, setPhoneVerifPhone] = useState("");
  const [phoneVerifId, setPhoneVerifId] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneResendSeconds, setPhoneResendSeconds] = useState(0);
  const phoneTimerRef = useRef(null);
  const [phoneSuccess, setPhoneSuccess] = useState(false);

  const [phoneResetPhone, setPhoneResetPhone] = useState("");
  const [phoneResetVerifId, setPhoneResetVerifId] = useState("");
  const [phoneResetOtp, setPhoneResetOtp] = useState("");
  const [phoneResetSeconds, setPhoneResetSeconds] = useState(0);
  const [phoneResetToken, setPhoneResetToken] = useState("");
  const phoneResetTimerRef = useRef(null);

  const [otpLoginMode, setOtpLoginMode] = useState(false);
  const [otpLoginKeepLoggedIn, setOtpLoginKeepLoggedIn] = useState(false);
  const [otpLoginType, setOtpLoginType] = useState(null);
  const [otpLoginToken, setOtpLoginToken] = useState("");
  const [otpLoginVerifId, setOtpLoginVerifId] = useState("");
  const [otpLoginOtp, setOtpLoginOtp] = useState("");
  const [otpLoginPhone, setOtpLoginPhone] = useState("");
  const [otpLoginSeconds, setOtpLoginSeconds] = useState(0);
  const [otpLoginError, setOtpLoginError] = useState("");
  const otpLoginTimerRef = useRef(null);

  const { login, googleLogin, verifyPhoneOtp, user, initiateRegistration, loginWithOtpResponse } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const [loginData, setLoginData] = useState({ identifier: "", password: "", keepLoggedIn: false });
  const [signupData, setSignupData] = useState({ name: "", phone: "", email: "", password: "", referral_code: "" });
  const [forgotPasswordData, setForgotPasswordData] = useState({ email: "", newPassword: "", confirmPassword: "" });

  const alertRef = useRef(null);
  const activeOtpDigitCount = EMAIL_OTP_DIGIT_COUNT;

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab]);

  useEffect(() => {
    if (!apiError) return;
    window.requestAnimationFrame(() => alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [apiError]);

  useEffect(() => {
    if (user) {
      const mode = new URLSearchParams(location.search).get("mode");
      if (mode === "forgot" || activeTab === "forgotPassword" || activeTab === "resetPassword" || activeTab === "phoneVerification") return;
      navigate(location.state?.from?.pathname || "/", { replace: true });
    }
  }, [user, navigate, location, activeTab]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("mode") === "signup") { switchMode("signup"); return; }
    if (params.get("mode") === "forgot") {
      switchMode("forgotPassword");
      const email = params.get("email");
      if (email) setForgotPasswordData((prev) => ({ ...prev, email }));
      return;
    }
    if (params.has("refresh")) switchMode("login");
  }, [location.search]);

  useEffect(() => {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref) setSignupData((prev) => ({ ...prev, referral_code: ref }));
  }, [location.search]);

  useEffect(() => {
    const handler = () => switchMode("login");
    window.addEventListener("auth:refresh", handler);
    return () => window.removeEventListener("auth:refresh", handler);
  }, []);

  useEffect(() => () => { clearInterval(phoneTimerRef.current); clearInterval(phoneResetTimerRef.current); clearInterval(otpLoginTimerRef.current); }, []);

  const authCopy = useMemo(() => {
    if (activeTab === "signup" && signupStep === "emailSent") return { title: "Check Your Inbox", subtitle: "A verification link has been sent to your email." };
    if (activeTab === "signup") return { title: "Create Account", subtitle: "Fill in your details to create your account." };
    if (activeTab === "forgotPassword") return { title: "Reset Password", subtitle: "Enter your registered email to verify ownership." };
    if (activeTab === "resetPassword") return { title: "Create New Password", subtitle: "Choose a strong password to keep your account secure." };
    if (activeTab === "phoneVerification") return { title: "One Last Step", subtitle: "Add your mobile number to complete your account." };
    if (activeTab === "phoneReset") return { title: "Verify OTP", subtitle: "Enter the 6-digit OTP sent to your mobile." };
    if (activeTab === "loginOtp") return { title: "Login with OTP", subtitle: `Enter the OTP sent to your ${otpLoginType === "phone" ? "mobile" : "email"}.` };
    return { title: "Welcome Back", subtitle: "Sign in to continue shopping your favourite Banarasi Sarees" };
  }, [activeTab, signupStep]);

  function switchMode(mode) {
    setActiveTab(mode);
    setApiError("");
    setSuccess("");
    setOtpStep(null);
    setOtpCode("");
    setOtpError("");
    setOtpLoading(false);
    setEmailOtpSessionToken("");
    setSignupStep("form");
    setRegistrationToken("");
    setResendLoading(false);
    setLoginErrors({});
    setSignupErrors({});
    setForgotErrors({});
    setResetErrors({});
    setForgotMode(false);
    setOtpLoginMode(false);
    setLoginData({ identifier: "", password: "", keepLoggedIn: false });
    setSignupData({ name: "", phone: "", email: "", password: "", referral_code: "" });
    setForgotPasswordData({ email: "", newPassword: "", confirmPassword: "" });
    setConsentChecked(false);
    if (mode !== "loginOtp") {
      setOtpLoginKeepLoggedIn(false);
      setOtpLoginType(null);
      setOtpLoginToken("");
      setOtpLoginVerifId("");
      setOtpLoginOtp("");
      setOtpLoginPhone("");
      setOtpLoginError("");
      clearInterval(otpLoginTimerRef.current);
      setOtpLoginSeconds(0);
    }
    if (mode !== "phoneVerification") {
      setPendingGoogleToken("");
      setPhoneVerifPhone("");
      setPhoneVerifId("");
      setPhoneOtpSent(false);
      setPhoneOtp("");
      setPhoneError("");
      setPhoneSuccess(false);
      clearInterval(phoneTimerRef.current);
      setPhoneResendSeconds(0);
    }
    if (mode !== "phoneReset") {
      setPhoneResetPhone("");
      setPhoneResetVerifId("");
      setPhoneResetOtp("");
      setPhoneResetToken("");
      clearInterval(phoneResetTimerRef.current);
      setPhoneResetSeconds(0);
    }
    setAnimationKey((k) => k + 1);
  }

  const handleLoginChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (loginErrors[name]) setLoginErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    let nextValue;
    if (name === "phone") {
      const digits = value.replace(/\D/g, "").slice(0, 10);
      // Block first digit 0–5: keep the previous value so nothing appears in the field
      if (digits.length > 0 && !/^[6-9]/.test(digits)) {
        nextValue = signupData.phone;
      } else {
        nextValue = digits;
      }
    } else if (name === "referral_code") {
      nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
    } else {
      nextValue = value;
    }
    setSignupData((prev) => ({ ...prev, [name]: nextValue }));
    if (signupErrors[name]) setSignupErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ── Validation helpers ──────────────────────────────────────
  const validateLogin = () => {
    const errors = {};
    if (!loginData.identifier.trim()) errors.identifier = "Please enter your email or mobile number.";
    if (!loginData.password) errors.password = "Please enter your password.";
    return errors;
  };

  const validateSignupFields = () => {
    const errors = {};
    if (!signupData.name.trim()) errors.name = "Please enter your full name.";
    if (!signupData.email.trim()) {
      errors.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupData.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    const phone = normalizePhone(signupData.phone);
    if (!phone) {
      errors.phone = "Please enter your mobile number.";
    } else if (!/^[6-9]\d{9}$/.test(phone)) {
      errors.phone = "Please enter a valid 10-digit mobile number (starting with 6–9).";
    }
    if (!signupData.password) {
      errors.password = "Please enter a password.";
    } else if (signupData.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    } else if (!/[A-Z]/.test(signupData.password)) {
      errors.password = "Password must contain at least one uppercase letter.";
    } else if (!/[0-9]/.test(signupData.password)) {
      errors.password = "Password must contain at least one number.";
    } else if (!/[^A-Za-z0-9]/.test(signupData.password)) {
      errors.password = "Password must contain at least one special character.";
    }
    if (signupData.referral_code) {
      if (!/^VNS[A-Z0-9]{8}$/.test(signupData.referral_code)) {
        errors.referral_code = "Invalid referral code. It should look like VNS followed by 8 characters (e.g. VNSA1B2C3D4).";
      }
    }
    if (!consentChecked) {
      errors.consent = "Please accept the Terms & Conditions to continue.";
    }
    return errors;
  };

  const validateForgot = () => {
    const errors = {};
    const email = String(forgotPasswordData.email || "").trim();
    if (!email) errors.email = "Please enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Please enter a valid email address.";
    return errors;
  };

  const validateReset = () => {
    const errors = {};
    if (!forgotPasswordData.newPassword) {
      errors.newPassword = "Please enter a new password.";
    } else if (forgotPasswordData.newPassword.length < 8) {
      errors.newPassword = "Password must be at least 8 characters.";
    } else if (!/[A-Z]/.test(forgotPasswordData.newPassword)) {
      errors.newPassword = "Password must contain at least one uppercase letter.";
    } else if (!/[0-9]/.test(forgotPasswordData.newPassword)) {
      errors.newPassword = "Password must contain at least one number.";
    } else if (!/[^A-Za-z0-9]/.test(forgotPasswordData.newPassword)) {
      errors.newPassword = "Password must contain at least one special character.";
    }
    if (!forgotPasswordData.confirmPassword) errors.confirmPassword = "Please confirm your password.";
    else if (forgotPasswordData.newPassword !== forgotPasswordData.confirmPassword) errors.confirmPassword = "Passwords do not match.";
    return errors;
  };

  // ── OTP ────────────────────────────────────────────────────
  const getOtpAttemptKey = (action, email) => `${action}:${String(email || "").trim().toLowerCase()}`;
  const getOtpAttemptsLeft = (action, email) => Math.max(OTP_SEND_LIMIT - (otpSendAttempts[getOtpAttemptKey(action, email)] || 0), 0);

  const startEmailOtp = async (action, email, name = "") => {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const attemptKey = getOtpAttemptKey(action, cleanEmail);
    setApiError(""); setSuccess(""); setOtpError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { setApiError("Please enter a valid email."); return; }
    if (getOtpAttemptsLeft(action, cleanEmail) <= 0) { setApiError("OTP attempts exceeded. Please try again after 24 hours or contact support."); return; }
    setOtpLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.auth}/send-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, purpose: action === "signup" ? "signup" : "forgot_password", name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP");
      setEmailOtpSessionToken(data.token);
      setOtpSendAttempts((prev) => ({ ...prev, [attemptKey]: (prev[attemptKey] || 0) + 1 }));
      setOtpStep({ action, email: cleanEmail });
      setSuccess("OTP sent to your email.");
    } catch (err) {
      const message = getFriendlyError(err, "We could not send the OTP right now. Please try again.");
      if (otpStep) setOtpError(message); else setApiError(message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtpCode = async (e) => {
    e.preventDefault();
    const code = String(otpCode || "").replace(/\D/g, "");
    setApiError(""); setSuccess(""); setOtpError("");
    if (!otpStep) return;
    if (code.length !== activeOtpDigitCount) { setOtpError("Please enter the complete OTP."); return; }
    try {
      setOtpLoading(true);
      const res = await fetch(`${API_ENDPOINTS.auth}/verify-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: emailOtpSessionToken, otp: code, purpose: "forgot_password" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "OTP verify failed");
      setResetOtpToken(emailOtpSessionToken);
      switchMode("resetPassword");
      setOtpStep(null); setOtpCode("");
    } catch (err) {
      setOtpError(getFriendlyError(err, "The OTP is incorrect or expired. Please try again."));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = () => {
    if (!otpStep || otpLoading) return;
    setOtpCode(""); setOtpError("");
    startEmailOtp(otpStep.action, otpStep.email, signupData.name);
  };

  // ── Phone-based password reset ─────────────────────────────
  const handleResendPhoneResetOtp = async () => {
    if (!phoneResetPhone || otpLoading) return;
    setPhoneResetOtp(""); setPhoneError("");
    setOtpLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.auth}/send-password-reset-phone-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneResetPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to resend OTP.");
      setPhoneResetVerifId(data.verificationId);
      clearInterval(phoneResetTimerRef.current);
      setPhoneResetSeconds(45);
      phoneResetTimerRef.current = setInterval(() => {
        setPhoneResetSeconds((s) => {
          if (s <= 1) { clearInterval(phoneResetTimerRef.current); return 0; }
          return s - 1;
        });
      }, 1000);
    } catch (err) {
      setPhoneError(err.message || "Failed to resend OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyPhoneResetOtp = async (e) => {
    e.preventDefault();
    const code = phoneResetOtp.replace(/\D/g, "");
    if (code.length !== 6) { setPhoneError("Please enter the complete 6-digit OTP."); return; }
    setPhoneError(""); setLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.auth}/verify-password-reset-phone-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneResetPhone, verificationId: phoneResetVerifId, otp: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "OTP verification failed.");
      clearInterval(phoneResetTimerRef.current);
      switchMode("resetPassword");
      setPhoneResetToken(data.resetToken);
    } catch (err) {
      setPhoneError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ───────────────────────────────────────────
  const handleGoogleSuccess = async (credentialResponse) => {
    setApiError(""); setLoading(true);
    try {
      const result = await googleLogin(credentialResponse.credential);
      if (result.requiresPhoneVerification) {
        setPendingGoogleToken(result.pendingToken);
        switchMode("phoneVerification");
      } else {
        showNotification("Signed in with Google successfully!", "success");
      }
    } catch (err) {
      setApiError(err.message || "Google Sign-In failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    const phone = normalizePhone(phoneVerifPhone);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setPhoneError("Please enter a valid 10-digit mobile number (starting with 6–9).");
      return;
    }
    setPhoneError(""); setSuccess(""); setOtpLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.auth}/send-phone-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken: pendingGoogleToken, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP");
      setPhoneVerifId(data.verificationId);
      setPhoneOtpSent(true);
      clearInterval(phoneTimerRef.current);
      setPhoneResendSeconds(45);
      phoneTimerRef.current = setInterval(() => {
        setPhoneResendSeconds((s) => {
          if (s <= 1) { clearInterval(phoneTimerRef.current); return 0; }
          return s - 1;
        });
      }, 1000);
    } catch (err) {
      setPhoneError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e) => {
    e.preventDefault();
    const phone = normalizePhone(phoneVerifPhone);
    const code = phoneOtp.replace(/\D/g, "");
    if (code.length !== 6) { setPhoneError("Please enter the complete 6-digit OTP."); return; }
    setPhoneError(""); setLoading(true);
    try {
      await verifyPhoneOtp(pendingGoogleToken, phone, code, phoneVerifId);
      clearInterval(phoneTimerRef.current);
      setPhoneSuccess(true);
    } catch (err) {
      setPhoneError(err.message || "OTP verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot-password inline flow ────────────────────────────
  const handleForgotClick = () => {
    setForgotMode(true);
    setOtpLoginMode(false);
    setLoginErrors({});
    setApiError("");
    setSuccess("");
  };

  const handleOtpLoginClick = () => {
    setOtpLoginMode(true);
    setForgotMode(false);
    setLoginErrors({});
    setApiError("");
    setSuccess("");
  };

  const handleOtpLoginProceed = async () => {
    const val = String(loginData.identifier || "").trim();
    if (!val) {
      setLoginErrors({ identifier: "Please enter your email or mobile number to receive a login OTP." });
      return;
    }
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    const digits = val.replace(/\D/g, "");
    const normalizedPhone = digits.length > 10 ? digits.slice(-10) : digits.replace(/^0+/, "");
    const isPhone = /^[6-9]\d{9}$/.test(normalizedPhone);
    if (!isEmail && !isPhone) {
      setLoginErrors({ identifier: "Enter a valid email address or 10-digit mobile number." });
      return;
    }
    setLoading(true);
    try {
      const identifier = isPhone ? normalizedPhone : val.toLowerCase();
      const res = await fetch(`${API_ENDPOINTS.auth}/send-login-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to send OTP.");
      setOtpLoginType(data.type);
      setOtpLoginToken(data.token || "");
      setOtpLoginVerifId(data.verificationId || "");
      setOtpLoginPhone(identifier);
      setOtpLoginOtp("");
      setOtpLoginError("");
      clearInterval(otpLoginTimerRef.current);
      setOtpLoginSeconds(45);
      otpLoginTimerRef.current = setInterval(() => {
        setOtpLoginSeconds((s) => { if (s <= 1) { clearInterval(otpLoginTimerRef.current); return 0; } return s - 1; });
      }, 1000);
      switchMode("loginOtp");
    } catch (err) {
      setApiError(getFriendlyError(err, "Failed to send OTP. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleResendLoginOtp = async () => {
    if (!otpLoginPhone || otpLoading) return;
    setOtpLoginOtp(""); setOtpLoginError("");
    setOtpLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.auth}/send-login-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: otpLoginPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to resend OTP.");
      if (data.token) setOtpLoginToken(data.token);
      if (data.verificationId) setOtpLoginVerifId(data.verificationId);
      clearInterval(otpLoginTimerRef.current);
      setOtpLoginSeconds(45);
      otpLoginTimerRef.current = setInterval(() => {
        setOtpLoginSeconds((s) => { if (s <= 1) { clearInterval(otpLoginTimerRef.current); return 0; } return s - 1; });
      }, 1000);
    } catch (err) {
      setOtpLoginError(err.message || "Failed to resend OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyLoginOtp = async (e) => {
    e.preventDefault();
    const code = otpLoginOtp.replace(/\D/g, "");
    const expectedLen = otpLoginType === "phone" ? 6 : activeOtpDigitCount;
    if (code.length !== expectedLen) { setOtpLoginError(`Please enter the complete ${expectedLen}-digit OTP.`); return; }
    setOtpLoginError(""); setLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.auth}/verify-login-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: otpLoginPhone, otp: code, token: otpLoginToken, verificationId: otpLoginVerifId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "OTP verification failed.");
      clearInterval(otpLoginTimerRef.current);
      loginWithOtpResponse({ customer: data.customer || data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, keepLoggedIn: otpLoginKeepLoggedIn });
      showNotification("Logged in successfully!", "success");
    } catch (err) {
      setOtpLoginError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotProceed = async () => {
    const val = String(loginData.identifier || "").trim();
    if (!val) {
      setLoginErrors({ identifier: "Please enter your email or mobile number to reset your password." });
      return;
    }
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    const digits = val.replace(/\D/g, "");
    const normalizedPhone = digits.length > 10 ? digits.slice(-10) : digits.replace(/^0+/, "");
    const isPhone = /^[6-9]\d{9}$/.test(normalizedPhone);

    if (!isEmail && !isPhone) {
      setLoginErrors({ identifier: "Enter a valid email address or 10-digit mobile number." });
      return;
    }
    if (isPhone) {
      setLoading(true);
      try {
        const res = await fetch(`${API_ENDPOINTS.auth}/send-password-reset-phone-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalizedPhone }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to send OTP.");
        setPhoneResetPhone(normalizedPhone);
        setPhoneResetVerifId(data.verificationId);
        setForgotMode(false);
        clearInterval(phoneResetTimerRef.current);
        setPhoneResetSeconds(45);
        phoneResetTimerRef.current = setInterval(() => {
          setPhoneResetSeconds((s) => {
            if (s <= 1) { clearInterval(phoneResetTimerRef.current); return 0; }
            return s - 1;
          });
        }, 1000);
        switchMode("phoneReset");
      } catch (err) {
        setApiError(getFriendlyError(err, "Failed to send OTP. Please try again."));
      } finally {
        setLoading(false);
      }
      return;
    }

    const email = val.toLowerCase();
    setForgotPasswordData((prev) => ({ ...prev, email }));
    setApiError(""); setLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.auth}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Request failed");
      await startEmailOtp("reset", email);
    } catch (err) {
      setApiError(getFriendlyError(err, "Unable to start password reset. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────
  const onLogin = async (e) => {
    e.preventDefault();
    if (forgotMode) { await handleForgotProceed(); return; }
    if (otpLoginMode) { await handleOtpLoginProceed(); return; }
    const errors = validateLogin();
    if (Object.keys(errors).length) { setLoginErrors(errors); return; }
    setApiError(""); setLoading(true);
    try {
      await login(loginData.identifier, loginData.password, loginData.keepLoggedIn);
      showNotification("Login successfully", "success");
    } catch (err) {
      console.error("[Auth:onLogin]", err); 
      setApiError(getFriendlyError(err, err.message || "Unable to login right now. Please contact support or try again later."));
    } finally {
      setLoading(false);
    }
  };

  const onSignup = async (e) => {
    e.preventDefault();
    const errors = validateSignupFields();
    if (Object.keys(errors).length) { setSignupErrors(errors); return; }
    setApiError(""); setLoading(true);
    try {
      const result = await initiateRegistration({
        name: signupData.name.trim(),
        email: signupData.email.trim().toLowerCase(),
        phone: normalizePhone(signupData.phone),
        password: signupData.password,
        referral_code: signupData.referral_code || undefined,
      });
      if (result.step === "phoneVerification") {
        navigate(`/verify-email?vt=${encodeURIComponent(result.verifiedToken)}`);
        return;
      }
      setRegistrationToken(result.registrationToken);
      setSignupStep("emailSent");
    } catch (err) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("referral")) {
        setSignupErrors((prev) => ({ ...prev, referral_code: msg }));
      } else {
        setApiError(getFriendlyError(err, "Unable to start registration right now. Please contact support or try again later."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (resendLoading || !registrationToken) return;
    setResendLoading(true);
    setApiError(""); setSuccess("");
    try {
      const res = await fetch(`${API_ENDPOINTS.auth}/resend-verification-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to resend");
      if (data.registrationToken) setRegistrationToken(data.registrationToken);
      setSuccess("Verification email resent. Please check your inbox.");
    } catch (err) {
      setApiError(err.message || "Could not resend email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const errors = validateForgot();
    if (Object.keys(errors).length) { setForgotErrors(errors); return; }
    const email = String(forgotPasswordData.email || "").trim().toLowerCase();
    setApiError(""); setLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.auth}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Request failed");
      setSuccess(data.message || "Account found. Verify email OTP to continue.");
      await startEmailOtp("reset", email);
    } catch (err) {
      setApiError(getFriendlyError(err, "Unable to start password reset. Please contact support or try again later."));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const errors = validateReset();
    if (Object.keys(errors).length) { setResetErrors(errors); return; }
    setApiError(""); setLoading(true);
    try {
      const isPhoneReset = !!phoneResetToken;
      const url = isPhoneReset
        ? `${API_ENDPOINTS.auth}/reset-password-by-phone`
        : `${API_ENDPOINTS.auth}/reset-password`;
      const body = isPhoneReset
        ? { resetToken: phoneResetToken, newPassword: forgotPasswordData.newPassword }
        : { email: String(forgotPasswordData.email || "").trim().toLowerCase(), email_otp_token: resetOtpToken, newPassword: forgotPasswordData.newPassword };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Reset failed");
      setForgotPasswordData({ email: "", newPassword: "", confirmPassword: "" });
      setResetOtpToken("");
      switchMode("login");
      setSuccess("Password reset successfully. You can login now.");
    } catch (err) {
      setApiError(getFriendlyError(err, "Unable to reset password right now. Please contact support or try again later."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page" style={{ "--auth-bg": `url(${headerBackground})`, "--auth-bg-mobile": `url(${mobileBackground})` }}>
      <Link to="/" className="auth-back-btn" aria-label="Go to home page">
        <Icon icon="lucide:arrow-left" />
      </Link>
      {(activeTab === "login" || activeTab === "resetPassword" || activeTab === "phoneReset" || activeTab === "loginOtp" || (activeTab === "signup" && (signupStep === "form" || signupStep === "emailSent")) || activeTab === "phoneVerification") && (
        <div className="auth-signup-brand">
          <img src={verticalLogo} className="auth-signup-logo-img" alt="Banarasi Kala" />
        </div>
      )}
      <section className="auth-panel" key={animationKey}>
        {activeTab !== "phoneVerification" && activeTab !== "phoneReset" && activeTab !== "loginOtp" && !(activeTab === "signup" && signupStep === "emailSent") && (
          <header className={`auth-heading${activeTab === "signup" && signupStep === "form" ? " auth-heading-signup" : ""}`}>
            {(activeTab === "login" || activeTab === "resetPassword") && (
              <div className="auth-lotus-divider" aria-hidden="true">
                <span /><Icon icon="ph:flower-lotus" /><span />
              </div>
            )}
            {(activeTab === "login" || activeTab === "resetPassword") ? (
              <div className="auth-heading-spark-row">
                <span className="auth-login-sparkle">✦</span>
                <h1>{authCopy.title}</h1>
                <span className="auth-login-sparkle">✦</span>
              </div>
            ) : (
              <h1>{authCopy.title}</h1>
            )}
            {activeTab === "signup" && signupStep === "form" && (
              <div className="auth-lotus-divider" aria-hidden="true">
                <span /><Icon icon="ph:flower-lotus" /><span />
              </div>
            )}
            <p>{authCopy.subtitle}</p>
          </header>
        )}

        {activeTab !== "phoneVerification" && activeTab !== "phoneReset" && activeTab !== "loginOtp" && !(activeTab === "signup" && signupStep === "emailSent") && apiError && <div ref={alertRef} className="auth-alert auth-alert-error">{apiError}</div>}
        {activeTab !== "phoneVerification" && activeTab !== "phoneReset" && activeTab !== "loginOtp" && !(activeTab === "signup" && signupStep === "emailSent") && !apiError && success && <div className="auth-alert auth-alert-success">{success}</div>}

        {/* ── Login ── */}
        {activeTab === "login" && (
          <form className="auth-form" onSubmit={onLogin} noValidate>
            <AuthField
              icon="lucide:user-round"
              label="Email or mobile number"
              name="identifier"
              value={loginData.identifier}
              placeholder="Enter email or mobile number"
              onChange={handleLoginChange}
              error={loginErrors.identifier}
            />
            {forgotMode && !loginErrors.identifier && (
              <div className="auth-forgot-hint">
                <Icon icon="lucide:info" />
                Enter your email or mobile number above to reset your password.
              </div>
            )}
            {otpLoginMode && !loginErrors.identifier && (
              <div className="auth-forgot-hint">
                <Icon icon="lucide:info" />
                Enter your email or mobile number above to receive a login OTP.
              </div>
            )}
            {!forgotMode && !otpLoginMode && (
              <AuthField
                icon="lucide:lock"
                label="Password"
                name="password"
                type={showLoginPassword ? "text" : "password"}
                value={loginData.password}
                placeholder="Enter your password"
                onChange={handleLoginChange}
                error={loginErrors.password}
                rightAction={
                  <button type="button" className="auth-eye" onClick={() => setShowLoginPassword((v) => !v)}>
                    <Icon icon={showLoginPassword ? "lucide:eye-off" : "lucide:eye"} />
                  </button>
                }
              />
            )}
            <div className="auth-row">
              {!forgotMode && !otpLoginMode && (
                <label className="auth-remember auth-remember-pill">
                  <input type="checkbox" name="keepLoggedIn" checked={loginData.keepLoggedIn} onChange={handleLoginChange} />
                  <span><Icon icon="lucide:check" /> Keep me logged in</span>
                </label>
              )}
              <div className={`auth-row-links${(forgotMode || otpLoginMode) ? " auth-row-links-end" : ""}`}>
                {forgotMode || otpLoginMode ? (
                  <button
                    type="button"
                    className="auth-cancel-btn"
                    onClick={() => { setForgotMode(false); setOtpLoginMode(false); setLoginErrors({}); setApiError(""); }}
                  >
                    ← Cancel
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={handleForgotClick}>Forgot Password?</button>
                    <button type="button" onClick={handleOtpLoginClick}>Login with OTP</button>
                  </>
                )}
              </div>
            </div>
            <button type="submit" disabled={loading || otpLoading} className="auth-primary auth-login-btn">
              {loading || otpLoading
                ? "Please wait..."
                : forgotMode
                ? <><span>Proceed</span><Icon icon="lucide:arrow-right" /></>
                : otpLoginMode
                ? <><span>Send OTP</span><Icon icon="lucide:arrow-right" /></>
                : "Login"}
            </button>
            {!forgotMode && !otpLoginMode && (
              <>
                <div className="auth-divider auth-divider-or"><span /><em>OR</em><span /></div>
                <GoogleBtn
                  onSuccess={handleGoogleSuccess}
                  onError={() => setApiError("Google Sign-In failed. Please try again.")}
                  text="continue_with"
                />
                <button type="button" className="auth-no-account-card" onClick={() => switchMode("signup")}>
                  <div className="auth-no-account-text">
                    <span>Don't have an account?</span>
                    <strong>CREATE NEW ACCOUNT →</strong>
                  </div>
                  <div className="auth-no-account-deco" aria-hidden="true">
                    <span className="auth-no-account-deco-main">✦</span>
                    <img src={flatSaree} alt="" className="auth-no-account-saree" />
                    <span className="auth-no-account-deco-sub">✦</span>
                  </div>
                </button>
              </>
            )}
          </form>
        )}

        {/* ── Sign Up — Form ── */}
        {activeTab === "signup" && signupStep === "form" && (
          <form className="auth-form auth-form-compact" onSubmit={onSignup} noValidate>
            <AuthField
              icon="lucide:user"
              label="Full Name"
              name="name"
              value={signupData.name}
              placeholder="Enter your full name"
              onChange={handleSignupChange}
              error={signupErrors.name}
            />
            <AuthField
              icon="lucide:mail"
              label="Email Address"
              name="email"
              type="email"
              value={signupData.email}
              placeholder="Enter your email"
              onChange={handleSignupChange}
              error={signupErrors.email}
            />
            <div className="auth-phone-verify">
              <AuthField
                icon="lucide:phone"
                label="Phone Number"
                name="phone"
                value={signupData.phone}
                placeholder="Enter 10 digit mobile number"
                onChange={handleSignupChange}
                inputMode="tel"
                maxLength={10}
                leftAddon={<span className="auth-country-code"><span className="auth-flag-india" aria-hidden="true" />+91</span>}
                error={signupErrors.phone}
              />
            </div>
            <div className="auth-referral-field">
              <AuthField
                icon="lucide:gift"
                label="Referral Code (optional)"
                name="referral_code"
                value={signupData.referral_code}
                placeholder="e.g. VNSA1B2C3D4"
                onChange={handleSignupChange}
                maxLength={11}
                error={signupErrors.referral_code}
              />
            </div>
            <AuthField
              icon="lucide:lock"
              label="Password"
              name="password"
              type={showSignupPassword ? "text" : "password"}
              value={signupData.password}
              placeholder="Create a password"
              onChange={handleSignupChange}
              error={signupErrors.password}
              rightAction={
                <button type="button" className="auth-eye" onClick={() => setShowSignupPassword((v) => !v)}>
                  <Icon icon={showSignupPassword ? "lucide:eye-off" : "lucide:eye"} />
                </button>
              }
            />
            <div className="auth-pw-reqs" aria-label="Password requirements">
              {[
                { label: "8+ characters", met: signupData.password.length >= 8 },
                { label: "1 uppercase", met: /[A-Z]/.test(signupData.password) },
                { label: "1 number", met: /[0-9]/.test(signupData.password) },
                { label: "1 special character", met: /[^A-Za-z0-9]/.test(signupData.password) },
              ].map(({ label, met }) => (
                <div key={label} className={`auth-pw-req${met ? " is-met" : ""}`}>
                  <Icon icon="lucide:check-circle-2" />
                  {label}
                </div>
              ))}
            </div>
            <div className="auth-consent-wrap">
              <label className="auth-consent">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => {
                    setConsentChecked(e.target.checked);
                    if (signupErrors.consent) setSignupErrors((prev) => ({ ...prev, consent: "" }));
                  }}
                />
                <span className="auth-consent-box">
                  <Icon icon="lucide:check" />
                  <span className="auth-consent-text">
                    I agree to the <Link to="/terms-conditions">Terms &amp; Conditions</Link> and <Link to="/privacy-policy">Privacy Policy</Link>
                  </span>
                </span>
              </label>
              {signupErrors.consent && <span className="auth-field-error">{signupErrors.consent}</span>}
            </div>
            <button type="submit" disabled={loading} className="auth-primary auth-primary-signup">
              {loading ? "Please wait…" : <><span>Verify &amp; Continue</span><Icon icon="lucide:arrow-right" /></>}
            </button>
            <div className="auth-divider"><span /><em>or sign up with</em><span /></div>
            <GoogleBtn
              onSuccess={handleGoogleSuccess}
              onError={() => setApiError("Google Sign-In failed. Please try again.")}
              text="signup_with"
            />
            <button type="button" className="auth-no-account-card" onClick={() => switchMode("login")}>
              <div className="auth-no-account-text">
                <span>Already have an account?</span>
                <strong>BACK TO LOGIN →</strong>
              </div>
              <div className="auth-no-account-deco" aria-hidden="true">
                <span className="auth-no-account-deco-main">✦</span>
                <img src={flatSaree} alt="" className="auth-no-account-saree" />
                <span className="auth-no-account-deco-sub">✦</span>
              </div>
            </button>
          </form>
        )}

        {/* ── Sign Up — Email Sent ── */}
        {activeTab === "signup" && signupStep === "emailSent" && (
          <div className="auth-es-screen">
            <div className="auth-es-envelope-wrap">
              <Icon icon="ph:envelope-open" className="auth-es-envelope-icon" />
              <div className="auth-es-check-badge">
                <Icon icon="lucide:check" />
              </div>
            </div>
            <div className="auth-es-title-row">
              <span className="auth-es-sparkle">✦</span>
              <h1 className="auth-es-title">Verify Your Email</h1>
              <span className="auth-es-sparkle">✦</span>
            </div>
            {apiError && <div className="auth-alert auth-alert-error" style={{ margin: "0 0 10px" }}>{apiError}</div>}
            {!apiError && success && <div className="auth-alert auth-alert-success" style={{ margin: "0 0 10px" }}>{success}</div>}
            <p className="auth-es-desc">We've sent a verification link to</p>
            <p className="auth-es-email">{signupData.email.trim().toLowerCase()}</p>
            <p className="auth-es-desc">Please check your email inbox and click on the verification link to continue.</p>
            <div className="auth-es-hint">
              <div className="auth-es-hint-icon">
                <Icon icon="ph:envelope-simple" />
              </div>
              <div className="auth-es-hint-text">
                <strong>Didn't receive the email?</strong>
                <span>Check your spam or junk folder.</span>
              </div>
            </div>
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="auth-es-gmail-btn"
            >
              <Icon icon="logos:google-gmail" className="auth-es-gmail-icon" />
              Open Gmail
            </a>
            <button
              type="button"
              className="auth-es-change-btn"
              onClick={() => { setSignupStep("form"); setApiError(""); setSuccess(""); }}
            >
              Change Email
            </button>
            <p className="auth-es-resend">
              Didn't receive email?{" "}
              <button
                type="button"
                className="auth-es-resend-link"
                onClick={handleResendVerificationEmail}
                disabled={resendLoading}
              >
                {resendLoading ? "Sending…" : "Resend Link"}
              </button>
            </p>
          </div>
        )}

        {/* ── Phone Verification (Google new users) ── */}
        {activeTab === "phoneVerification" && !phoneOtpSent && (
          <div className="auth-pv-screen">
            <div className="auth-pv-icon-row">
              <span className="auth-pv-sparkle">✦</span>
              <div className="auth-pv-circle">
                <Icon icon="lucide:smartphone" className="auth-pv-main-icon" />
                <div className="auth-pv-shield-badge">
                  <Icon icon="lucide:check" />
                </div>
              </div>
              <span className="auth-pv-sparkle">✦</span>
            </div>
            <h1 className="auth-pv-title">Verify Mobile Number</h1>
            <div className="auth-lotus-divider" aria-hidden="true">
              <span /><Icon icon="ph:flower-lotus" /><span />
            </div>
            <p className="auth-pv-subtitle">
              We will send you a One Time Password (OTP)<br />to verify your mobile number.
            </p>
            <p className="auth-label" style={{ margin: "0 0 8px" }}>Mobile Number</p>
            <div className={`auth-pv-phone-field${phoneError ? " has-error" : ""}`}>
              <span className="auth-country-code">
                <span className="auth-flag-india" aria-hidden="true" />
                +91
                <Icon icon="lucide:chevron-down" className="auth-country-chevron" />
              </span>
              <span className="auth-pv-sep" />
              <input
                type="tel"
                className="auth-pv-phone-input"
                inputMode="tel"
                maxLength={10}
                value={phoneVerifPhone}
                placeholder="Enter 10 digit mobile number"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  if (digits.length > 0 && !/^[6-9]/.test(digits)) return;
                  setPhoneVerifPhone(digits);
                  setPhoneError("");
                }}
              />
            </div>
            {phoneError && <span className="auth-field-error">{phoneError}</span>}
            <p className="auth-pv-secure">
              <Icon icon="lucide:lock" className="auth-pv-secure-icon" />
              Your number is safe and secure with us.
            </p>
            <button type="button" className="auth-pv-btn" onClick={handleSendPhoneOtp} disabled={otpLoading}>
              {otpLoading ? "Sending…" : <><span>Send OTP</span><Icon icon="lucide:arrow-right" /></>}
            </button>
          </div>
        )}

        {activeTab === "phoneVerification" && phoneOtpSent && !phoneSuccess && (
          <form className="auth-pv-screen" onSubmit={handleVerifyPhoneOtp} noValidate>
            <div className="auth-pv-icon-row">
              <div className="auth-pv-circle">
                <Icon icon="ph:chat-dots" className="auth-pv-main-icon" />
                <div className="auth-pv-shield-badge">
                  <Icon icon="lucide:check" />
                </div>
              </div>
            </div>
            <h1 className="auth-pv-title">Verify OTP</h1>
            <div className="auth-lotus-divider" aria-hidden="true">
              <span /><Icon icon="ph:flower-lotus" /><span />
            </div>
            <p className="auth-pv-subtitle">
              Enter the 6-digit code sent to your mobile number
            </p>
            <p className="auth-pv-phone-display">
              +91 {phoneVerifPhone.replace(/(\d{5})(\d{5})/, "$1 $2")}
              <button
                type="button"
                className="auth-pv-edit-btn"
                onClick={() => { setPhoneOtpSent(false); setPhoneOtp(""); setPhoneError(""); clearInterval(phoneTimerRef.current); setPhoneResendSeconds(0); }}
              >
                Edit
              </button>
            </p>
            <div className="auth-pv-otp-wrap">
              <OtpBoxes
                value={phoneOtp}
                length={6}
                disabled={loading}
                onChange={(v) => { setPhoneOtp(v.replace(/\D/g, "").slice(0, 6)); setPhoneError(""); }}
              />
            </div>
            <div className="auth-pv-success-banner">
              <Icon icon="lucide:shield-check" />
              OTP sent successfully!
            </div>
            {phoneError && <span className="auth-field-error" style={{ textAlign: "center" }}>{phoneError}</span>}
            <div className="auth-pv-resend">
              <p className="auth-pv-resend-label">Didn't receive OTP?</p>
              {phoneResendSeconds > 0 ? (
                <p className="auth-pv-resend-timer">
                  Resend OTP in <strong>{`${String(Math.floor(phoneResendSeconds / 60)).padStart(2, "0")}:${String(phoneResendSeconds % 60).padStart(2, "0")}`}</strong>
                </p>
              ) : (
                <button
                  type="button"
                  className="auth-pv-resend-btn"
                  onClick={handleSendPhoneOtp}
                  disabled={otpLoading}
                >
                  {otpLoading ? "Sending…" : "Resend OTP"}
                </button>
              )}
            </div>
            <button type="submit" disabled={loading} className="auth-pv-btn">
              {loading ? "Verifying…" : <><span>Verify &amp; Complete Signup</span><Icon icon="lucide:arrow-right" /></>}
            </button>
            <p className="auth-pv-bottom-note">
              <Icon icon="lucide:lock" />
              Your information is secure with us.
            </p>
          </form>
        )}

        {/* ── Phone Verification — Success ── */}
        {activeTab === "phoneVerification" && phoneSuccess && (
          <div className="auth-pv-screen">
            <div className="auth-pv-success-icon-wrap">
              <span className="auth-pv-success-sparkle auth-pv-sp-tl">✦</span>
              <span className="auth-pv-success-sparkle auth-pv-sp-tr">✦</span>
              <div className="auth-pv-success-circle">
                <Icon icon="lucide:check" />
              </div>
              <span className="auth-pv-success-sparkle auth-pv-sp-bl">✦</span>
              <span className="auth-pv-success-sparkle auth-pv-sp-br">✦</span>
            </div>
            <h1 className="auth-pv-success-title">Welcome to<br />Banarasi Kala!</h1>
            <div className="auth-lotus-divider" aria-hidden="true">
              <span /><Icon icon="ph:flower-lotus" /><span />
            </div>
            <p className="auth-pv-success-subtitle">Your account has been created successfully.</p>
            <div className="auth-pv-benefits">
              <div className="auth-pv-benefit">
                <div className="auth-pv-benefit-icon">
                  <Icon icon="lucide:gift" />
                </div>
                <div className="auth-pv-benefit-text">
                  <strong>₹100 Welcome Wallet Credit</strong>
                  <span>Use it on your first purchase</span>
                </div>
              </div>
              <div className="auth-pv-benefit">
                <div className="auth-pv-benefit-icon">
                  <Icon icon="lucide:package" />
                </div>
                <div className="auth-pv-benefit-text">
                  <strong>Premium Packaging</strong>
                  <span>Every order is packed with care</span>
                </div>
              </div>
              <div className="auth-pv-benefit">
                <div className="auth-pv-benefit-icon">
                  <Icon icon="lucide:truck" />
                </div>
                <div className="auth-pv-benefit-text">
                  <strong>Free Delivery</strong>
                  <span>Enjoy free delivery on all orders</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="auth-pv-btn"
              onClick={() => {
                showNotification("Welcome to Banarasi Kala! Account created successfully.", "success");
                navigate("/");
              }}
            >
              <span>Start Shopping</span><Icon icon="lucide:arrow-right" />
            </button>
            <p className="auth-pv-bottom-note">
              <Icon icon="lucide:shield" />
              Your information is secure with us.
            </p>
          </div>
        )}

        {/* ── Phone Reset OTP ── */}
        {activeTab === "phoneReset" && (
          <form className="auth-pv-screen" onSubmit={handleVerifyPhoneResetOtp} noValidate>
            <div className="auth-pv-icon-row">
              <div className="auth-pv-circle">
                <Icon icon="ph:chat-dots" className="auth-pv-main-icon" />
                <div className="auth-pv-shield-badge">
                  <Icon icon="lucide:check" />
                </div>
              </div>
            </div>
            <h1 className="auth-pv-title">Verify OTP</h1>
            <div className="auth-lotus-divider" aria-hidden="true">
              <span /><Icon icon="ph:flower-lotus" /><span />
            </div>
            <p className="auth-pv-subtitle">Enter the 6-digit code sent to your mobile</p>
            <p className="auth-pv-phone-display">
              +91 {phoneResetPhone.replace(/(\d{5})(\d{5})/, "$1 $2")}
              <button
                type="button"
                className="auth-pv-edit-btn"
                onClick={() => {
                  clearInterval(phoneResetTimerRef.current);
                  switchMode("login");
                  setForgotMode(true);
                }}
              >
                Edit
              </button>
            </p>
            <div className="auth-pv-otp-wrap">
              <OtpBoxes
                value={phoneResetOtp}
                length={6}
                disabled={loading}
                onChange={(v) => { setPhoneResetOtp(v.replace(/\D/g, "").slice(0, 6)); setPhoneError(""); }}
              />
            </div>
            <div className="auth-pv-success-banner">
              <Icon icon="lucide:shield-check" />
              OTP sent successfully!
            </div>
            {phoneError && <span className="auth-field-error" style={{ textAlign: "center" }}>{phoneError}</span>}
            <div className="auth-pv-resend">
              <p className="auth-pv-resend-label">Didn't receive OTP?</p>
              {phoneResetSeconds > 0 ? (
                <p className="auth-pv-resend-timer">
                  Resend OTP in <strong>{`${String(Math.floor(phoneResetSeconds / 60)).padStart(2, "0")}:${String(phoneResetSeconds % 60).padStart(2, "0")}`}</strong>
                </p>
              ) : (
                <button type="button" className="auth-pv-resend-btn" onClick={handleResendPhoneResetOtp} disabled={otpLoading}>
                  {otpLoading ? "Sending…" : "Resend OTP"}
                </button>
              )}
            </div>
            <button type="submit" disabled={loading} className="auth-pv-btn">
              {loading ? "Verifying…" : <><span>Verify &amp; Proceed</span><Icon icon="lucide:arrow-right" /></>}
            </button>
            <p className="auth-pv-bottom-note">
              <Icon icon="lucide:lock" />
              Your information is secure with us.
            </p>
          </form>
        )}

        {/* ── Login OTP ── */}
        {activeTab === "loginOtp" && (
          <form className="auth-pv-screen" onSubmit={handleVerifyLoginOtp} noValidate>
            <div className="auth-pv-icon-row">
              <div className="auth-pv-circle">
                <Icon icon={otpLoginType === "phone" ? "ph:chat-dots" : "ph:envelope-open"} className="auth-pv-main-icon" />
                <div className="auth-pv-shield-badge">
                  <Icon icon="lucide:check" />
                </div>
              </div>
            </div>
            <h1 className="auth-pv-title">Login with OTP</h1>
            <div className="auth-lotus-divider" aria-hidden="true">
              <span /><Icon icon="ph:flower-lotus" /><span />
            </div>
            <p className="auth-pv-subtitle">
              Enter the {otpLoginType === "phone" ? "6" : activeOtpDigitCount}-digit OTP sent to your {otpLoginType === "phone" ? "mobile number" : "email"}
            </p>
            <p className="auth-pv-phone-display">
              {otpLoginType === "phone"
                ? `+91 ${otpLoginPhone.replace(/(\d{5})(\d{5})/, "$1 $2")}`
                : otpLoginPhone}
              <button
                type="button"
                className="auth-pv-edit-btn"
                onClick={() => {
                  clearInterval(otpLoginTimerRef.current);
                  switchMode("login");
                  setOtpLoginMode(true);
                }}
              >
                Edit
              </button>
            </p>
            <div className="auth-pv-otp-wrap">
              <OtpBoxes
                value={otpLoginOtp}
                length={otpLoginType === "phone" ? 6 : activeOtpDigitCount}
                disabled={loading}
                onChange={(v) => { setOtpLoginOtp(v.replace(/\D/g, "").slice(0, otpLoginType === "phone" ? 6 : activeOtpDigitCount)); setOtpLoginError(""); }}
              />
            </div>
            <div className="auth-pv-success-banner">
              <Icon icon="lucide:shield-check" />
              OTP sent successfully!
            </div>
            {otpLoginError && <span className="auth-field-error" style={{ textAlign: "center" }}>{otpLoginError}</span>}
            <div className="auth-pv-resend">
              <p className="auth-pv-resend-label">Didn't receive OTP?</p>
              {otpLoginSeconds > 0 ? (
                <p className="auth-pv-resend-timer">
                  Resend OTP in <strong>{`${String(Math.floor(otpLoginSeconds / 60)).padStart(2, "0")}:${String(otpLoginSeconds % 60).padStart(2, "0")}`}</strong>
                </p>
              ) : (
                <button type="button" className="auth-pv-resend-btn" onClick={handleResendLoginOtp} disabled={otpLoading}>
                  {otpLoading ? "Sending…" : "Resend OTP"}
                </button>
              )}
            </div>
            <label className="auth-remember auth-remember-pill auth-otp-keep">
              <input
                type="checkbox"
                checked={otpLoginKeepLoggedIn}
                onChange={(e) => setOtpLoginKeepLoggedIn(e.target.checked)}
              />
              <span><Icon icon="lucide:check" /> Keep me logged in</span>
            </label>
            <button type="submit" disabled={loading} className="auth-pv-btn">
              {loading ? "Verifying…" : <><span>Login with OTP</span><Icon icon="lucide:arrow-right" /></>}
            </button>
            <p className="auth-pv-bottom-note">
              <Icon icon="lucide:lock" />
              Your information is secure with us.
            </p>
          </form>
        )}

        {/* ── Forgot Password ── */}
        {activeTab === "forgotPassword" && (
          <form className="auth-form" onSubmit={handleForgotPassword} noValidate>
            <AuthField
              icon="lucide:mail"
              label="Registered Email"
              name="email"
              value={forgotPasswordData.email}
              placeholder="Enter your registered email"
              onChange={(e) => {
                setForgotPasswordData((prev) => ({ ...prev, email: e.target.value }));
                if (forgotErrors.email) setForgotErrors((prev) => ({ ...prev, email: "" }));
              }}
              error={forgotErrors.email}
            />
            <button type="submit" disabled={loading || otpLoading} className="auth-primary">
              {loading || otpLoading ? "Verifying..." : "Verify Email OTP"}
            </button>
            <button type="button" className="auth-text-button" onClick={() => switchMode("login")}>Back to Login</button>
          </form>
        )}

        {/* ── Reset Password ── */}
        {activeTab === "resetPassword" && (
          <form className="auth-form auth-form-compact" onSubmit={handleResetPassword} noValidate>
            <AuthField
              icon="lucide:lock"
              label="New Password"
              name="newPassword"
              type={showResetPassword ? "text" : "password"}
              value={forgotPasswordData.newPassword}
              placeholder="Enter new password"
              onChange={(e) => {
                setForgotPasswordData((prev) => ({ ...prev, newPassword: e.target.value }));
                if (resetErrors.newPassword) setResetErrors((prev) => ({ ...prev, newPassword: "" }));
              }}
              error={resetErrors.newPassword}
              rightAction={
                <button type="button" className="auth-eye" onClick={() => setShowResetPassword((v) => !v)}>
                  <Icon icon={showResetPassword ? "lucide:eye-off" : "lucide:eye"} />
                </button>
              }
            />
            <div className="auth-pw-reqs" aria-label="Password requirements">
              {[
                { label: "8+ characters", met: forgotPasswordData.newPassword.length >= 8 },
                { label: "1 uppercase",   met: /[A-Z]/.test(forgotPasswordData.newPassword) },
                { label: "1 number",      met: /[0-9]/.test(forgotPasswordData.newPassword) },
                { label: "1 special char",met: /[^A-Za-z0-9]/.test(forgotPasswordData.newPassword) },
              ].map(({ label, met }) => (
                <div key={label} className={`auth-pw-req${met ? " is-met" : ""}`}>
                  <Icon icon="lucide:check-circle-2" />
                  {label}
                </div>
              ))}
            </div>
            <AuthField
              icon="lucide:lock-keyhole"
              label="Confirm Password"
              name="confirmPassword"
              type={showResetPassword ? "text" : "password"}
              value={forgotPasswordData.confirmPassword}
              placeholder="Confirm new password"
              onChange={(e) => {
                setForgotPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }));
                if (resetErrors.confirmPassword) setResetErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }}
              error={resetErrors.confirmPassword}
            />
            <button type="submit" disabled={loading} className="auth-primary auth-login-btn">
              {loading
                ? "Resetting..."
                : <><span>Reset Password</span><Icon icon="lucide:arrow-right" /></>}
            </button>
            <button type="button" className="auth-no-account-card" onClick={() => switchMode("login")}>
              <div className="auth-no-account-text">
                <span>Remember your password?</span>
                <strong>BACK TO LOGIN →</strong>
              </div>
              <div className="auth-no-account-deco" aria-hidden="true">
                <span className="auth-no-account-deco-main">✦</span>
                <span className="auth-no-account-deco-sub">✦</span>
              </div>
            </button>
          </form>
        )}

        {/* ── OTP Modal ── */}
        {otpStep && (
          <div className="auth-otp-modal" role="dialog" aria-modal="true" aria-label="Verify OTP">
            <form className="auth-otp-sheet" onSubmit={handleVerifyOtpCode}>
              <button
                type="button"
                className="auth-otp-close"
                onClick={() => { setOtpStep(null); setOtpCode(""); setOtpError(""); setOtpLoading(false); }}
                aria-label="Close OTP"
              >
                <Icon icon="lucide:x" />
              </button>
              <div className="auth-otp-card">
                <strong>Verify Email OTP</strong>
                <span className="auth-otp-phone">{otpStep.email}</span>
                <OtpBoxes
                  value={otpCode}
                  length={activeOtpDigitCount}
                  disabled={loading || otpLoading}
                  onChange={(v) => setOtpCode(v.replace(/\D/g, "").slice(0, activeOtpDigitCount))}
                />
                <p>{getOtpAttemptsLeft(otpStep.action, otpStep.email)} resend attempt(s) left. OTP expires in 15 minutes.</p>
                {otpError && <div className="auth-alert auth-alert-error auth-otp-alert">{otpError}</div>}
              </div>
              <button type="submit" disabled={loading || otpLoading} className="auth-primary">
                {loading || otpLoading ? "Verifying..." : "Verify OTP"}
              </button>
              <div className="auth-otp-actions">
                <button type="button" onClick={handleResendOtp} disabled={otpLoading || getOtpAttemptsLeft(otpStep.action, otpStep.email) <= 0}>
                  Resend OTP
                </button>
                <button type="button" onClick={() => { setOtpStep(null); setOtpCode(""); setOtpError(""); }}>
                  Change email
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
      {(activeTab === "login" || activeTab === "signup") && (
        <div className="auth-trust-card">
          <div className="auth-trust-badge">
            <div className="auth-trust-icon"><Icon icon="lucide:shield-check" /></div>
            <div className="auth-trust-text">
              <strong>Secure Checkout</strong>
              <span>100% Protected</span>
            </div>
          </div>
          <div className="auth-trust-sep" aria-hidden="true" />
          <div className="auth-trust-badge">
            <div className="auth-trust-icon"><Icon icon="lucide:truck" /></div>
            <div className="auth-trust-text">
              <strong>Pan India Delivery</strong>
              <span>Fast &amp; Reliable</span>
            </div>
          </div>
          <div className="auth-trust-sep" aria-hidden="true" />
          <div className="auth-trust-badge">
            <div className="auth-trust-icon"><Icon icon="lucide:gift" /></div>
            <div className="auth-trust-text">
              <strong>Premium Packaging</strong>
              <span>Handcrafted with Love</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Auth;
