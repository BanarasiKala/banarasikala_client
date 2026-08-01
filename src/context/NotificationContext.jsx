import { createContext, useCallback, useContext } from "react";
import toast from "react-hot-toast";

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

const BASE_TOAST_STYLE = {
  background: "#fffaf2",
  color: "#35170f",
  border: "1px solid rgba(128, 0, 32, 0.14)",
  borderLeft: "4px solid #800020",
  borderRadius: "12px",
  boxShadow: "0 16px 36px rgba(88, 39, 13, 0.16)",
  fontFamily: '"Poppins", sans-serif',
  fontSize: "13px",
  fontWeight: 500,
  lineHeight: 1.45,
  maxWidth: "min(92vw, 420px)",
  padding: "12px 15px",
};

const TOAST_TYPE_OPTIONS = {
  success: {
    iconTheme: { primary: "#047857", secondary: "#fffaf2" },
    style: { borderLeftColor: "#047857" },
  },
  error: {
    iconTheme: { primary: "#b42318", secondary: "#fffaf2" },
    style: { borderLeftColor: "#b42318" },
  },
  warning: {
    icon: "!",
    style: { borderLeftColor: "#d97706" },
  },
  info: {
    icon: "i",
    style: { borderLeftColor: "#2563eb" },
  },
};

export const NOTIFICATION_TOASTER_OPTIONS = {
  position: "top-center",
  gutter: 10,
  toastOptions: {
    duration: 3200,
    style: BASE_TOAST_STYLE,
    success: TOAST_TYPE_OPTIONS.success,
    error: TOAST_TYPE_OPTIONS.error,
  },
};

const getToastPayload = (message, fallbackType) => {
  if (typeof message !== "object" || message === null) {
    return { text: message, type: fallbackType, options: {} };
  }
  return {
    text: message.message,
    type: message.type || fallbackType,
    options: message.options || {},
  };
};

const getToastOptions = (type, options = {}) => {
  const typeOptions = TOAST_TYPE_OPTIONS[type] || TOAST_TYPE_OPTIONS.info;
  return {
    ...typeOptions,
    ...options,
    style: {
      ...BASE_TOAST_STYLE,
      ...(typeOptions.style || {}),
      ...(options.style || {}),
    },
  };
};

/**
 * Identity for a toast, so the same message cannot stack.
 *
 * react-hot-toast treats `id` as identity: firing one whose id is already on screen
 * updates that toast instead of adding a second. Tapping "Add to cart" five times, or a
 * component re-rendering into the same error, therefore shows one toast rather than a
 * column of identical ones.
 *
 * Keyed on type as well as text so a success and an error that happen to read the same
 * are still two different things, and never collapse into each other.
 *
 * Deliberately NOT a timed suppression window. That would keep swallowing the message
 * after the toast had faded, so a deliberate second action — add to cart, look away, add
 * again — would give no feedback at all and read as a broken button. This only collapses
 * duplicates while one is actually visible, which is the case worth fixing.
 */
const toastIdFor = (type, text) => `bk:${type}:${text}`;

export const NotificationProvider = ({ children }) => {
  const showNotification = useCallback((message, type = "success") => {
    const { text, type: resolvedType, options } = getToastPayload(message, type);
    if (!text) return;

    // A caller that passes its own id keeps it — that is how a long-running action
    // updates one toast in place ("Uploading…" → "Uploaded"), which this must not break.
    const toastOptions = {
      id: toastIdFor(resolvedType, text),
      ...getToastOptions(resolvedType, options),
    };
    if (resolvedType === "success") {
      toast.success(text, toastOptions);
    } else if (resolvedType === "error") {
      toast.error(text, toastOptions);
    } else {
      toast(text, toastOptions);
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};
