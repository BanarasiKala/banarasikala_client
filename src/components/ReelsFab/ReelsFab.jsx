import { Link } from "react-router-dom";
import "./ReelsFab.css";

/**
 * Floating shortcut to the shoppable reels feed. Sits bottom-right, in the slot the chat
 * bubble used to hold.
 *
 * The mark is drawn here rather than taken from an icon set because it animates: the
 * sprocket holes travel down the film body on a loop, so the button reads as a reel that is
 * PLAYING rather than a film icon sitting still. An icon set gives one static path, and
 * scrolling perforations is the whole point.
 *
 * Two columns of holes are laid out past both ends of the visible body and the strip is
 * translated by exactly one hole's spacing, which is what makes the loop seamless — at the
 * end of a cycle every hole has moved into the position of the one before it.
 */
// Spaced 4 units apart, with one row above and one below the 24-unit box so no gap scrolls
// into view at either edge. The CSS travels the strip by that same 4 units — the two have to
// stay in step or the loop will visibly jump.
const SPROCKET_ROWS = [-4, 0, 4, 8, 12, 16, 20, 24];

const ReelsFab = () => (
  <Link to="/reels" className="bk-reels-fab" aria-label="Watch shoppable reels">
    <span className="bk-reels-fab-pulse" aria-hidden="true" />

    <svg className="bk-reels-fab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="bk-reels-fab-body">
          <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="4.2" />
        </clipPath>
      </defs>

      <g clipPath="url(#bk-reels-fab-body)">
        <g className="bk-reels-fab-strip">
          {SPROCKET_ROWS.map((y) => (
            <g key={y}>
              <rect x="3.9" y={y + 1.2} width="1.9" height="1.9" rx="0.55" />
              <rect x="18.2" y={y + 1.2} width="1.9" height="1.9" rx="0.55" />
            </g>
          ))}
        </g>
      </g>

      <rect
        className="bk-reels-fab-body"
        x="2.6"
        y="2.6"
        width="18.8"
        height="18.8"
        rx="4.2"
        fill="none"
        strokeWidth="1.7"
      />
      <path className="bk-reels-fab-play" d="M10.1 9.1 L15.4 12 L10.1 14.9 Z" />
    </svg>
  </Link>
);

export default ReelsFab;
