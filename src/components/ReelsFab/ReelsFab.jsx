import { Link } from "react-router-dom";
import { Film } from "lucide-react";
import "./ReelsFab.css";

// Floating shortcut to the shoppable reels feed. Sits bottom-left so it never
// collides with the bottom-right chat bubble.
const ReelsFab = () => (
  <Link to="/reels" className="bk-reels-fab" aria-label="Watch shoppable reels">
    <span className="bk-reels-fab-pulse" aria-hidden="true" />
    <Film className="bk-reels-fab-icon" size={24} strokeWidth={2.2} />
  </Link>
);

export default ReelsFab;
