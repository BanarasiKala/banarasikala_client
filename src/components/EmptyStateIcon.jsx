import { Icon } from "@iconify/react";
import "./EmptyStateIcon.css";

const variantIcon = {
  cart: "lucide:shopping-bag",
  wishlist: "lucide:heart",
  contact: "lucide:phone-call",
  // A star, not a heart — this is what "review" actually means on the Feedback page itself
  // (a 5-star rating), where message-square-heart read as "love this" rather than "rate this".
  feedback: "lucide:star",
  orders: "lucide:package-check",
  default: "lucide:sparkles",
};

const EmptyStateIcon = ({ variant = "default", className = "" }) => {
  const icon = variantIcon[variant] || variantIcon.default;

  return (
    <span className={`bk-empty-illustration bk-empty-illustration-${variant} ${className}`} aria-hidden="true">
      <span className="bk-empty-motion-lines" />
      <span className="bk-empty-shadow" />
      <span className="bk-empty-bag">
        <span className="bk-empty-handle" />
        <Icon icon={icon} />
      </span>
    </span>
  );
};

export default EmptyStateIcon;
