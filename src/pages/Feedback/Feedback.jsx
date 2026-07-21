import { useState } from "react";
import "./Feedback.css";
import { MessageSquare, Send, ShieldCheck, Sparkles, Star } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import { API_ENDPOINTS } from "../../config/api";
import api from "../../utils/api";
import EmptyStateIcon from "../../components/EmptyStateIcon";
import { Icon } from "@iconify/react";

const Feedback = () => {
  const { user, loading: authLoading } = useAuth();

  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleCommentChange = (e) => {
    const nextComment = e.target.value;
    setComment(nextComment);
    if (reviewError && nextComment.trim().length >= 8) setReviewError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      setReviewError("Please write your review.");
      setMessage({ type: "", text: "" });
      return;
    }

    if (trimmedComment.length < 8) {
      setReviewError("Please write at least 8 characters in your review.");
      setMessage({ type: "", text: "" });
      return;
    }

    setSubmitting(true);
    setReviewError("");
    setMessage({ type: "", text: "" });

    try {
      // Via `api`, not raw fetch: attaching the token by hand skips the response
      // interceptor, so an expired access token would fail here with no refresh attempt —
      // the user sees "invalid token" on this page while others silently recover.
      const response = await api.post(API_ENDPOINTS.feedbackGeneral, {
        rating,
        comment: trimmedComment,
      });

      const data = response.data;

      if (data.success) {
        setMessage({ type: "success", text: "Thank you! Your feedback has been submitted." });
        setComment("");
        setRating(5);
      } else {
        setMessage({ type: "error", text: data.message || "Something went wrong." });
      }
    } catch (error) {
      console.error("Feedback submission error:", error);
      setMessage({ type: "error", text: "Failed to connect to the server." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="feedback-page">
      <section className="feedback-shell">
        <div className="feedback-info-panel">
          <div className="feedback-kicker">Customer Feedback</div>
          <h1>Share Your Experience</h1>
          <p className="feedback-intro">
            Your opinion helps us improve every Banarasi Kala order, from
            product quality to delivery care.
          </p>

          <span className="feedback-divider" aria-hidden="true" />

          <div className="feedback-info-list">
            <article>
              <span><Sparkles size={20} /></span>
              <div>
                <h2>Quality Check</h2>
                <p>Tell us what felt premium and what can be refined.</p>
              </div>
            </article>
            <article>
              <span><MessageSquare size={20} /></span>
              <div>
                <h2>Inspire Others</h2>
                <p>Your review helps fellow shoppers find their perfect Banarasi saree.</p>
              </div>
            </article>
            <article>
              <span><ShieldCheck size={20} /></span>
              <div>
                <h2>Trusted Review</h2>
                <p>{user ? `Logged in as ${user.name}.` : "Login to share your experience."}</p>
              </div>
            </article>
          </div>
        </div>

        <div className="feedback-form-panel">
          <div className="feedback-kicker">Send Us a Review</div>

          {authLoading ? (
            <div className="feedback-loading">Loading...</div>
          ) : user ? (
            <>
              <form onSubmit={handleSubmit} className="feedback-form">
                <div className="feedback-rating">
                  <label>Rate your experience</label>
                  <div className="feedback-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={(hover || rating) >= star ? "is-active" : ""}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        onClick={() => setRating(star)}
                        aria-label={`${star} star rating`}
                      >
                        <Star />
                      </button>
                    ))}
                  </div>
                  <p>
                    {rating === 5 ? "Exceptional!" : rating === 4 ? "Very Good" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Needs Improvement"}
                  </p>
                </div>

                <label className="feedback-review-field">
                  <span><MessageSquare size={14} /> Your Review</span>
                  <textarea
                    value={comment}
                    onChange={handleCommentChange}
                    placeholder="Tell us what you loved about our sarees or how we can improve..."
                    className={reviewError ? "has-error" : ""}
                    aria-invalid={Boolean(reviewError)}
                    aria-describedby={reviewError ? "feedback-review-error" : undefined}
                  />
                  {reviewError ? (
                    <small id="feedback-review-error" className="feedback-field-error">
                      {reviewError}
                    </small>
                  ) : comment.length > 0 && comment.trim().length < 8 && (
                    <small className="feedback-char-hint">
                      {8 - comment.trim().length} more character{8 - comment.trim().length === 1 ? "" : "s"} needed
                    </small>
                  )}
                </label>

                {message.text && (
                  <div className={`feedback-message ${message.type}`}>
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="feedback-submit"
                >
                  <span>{submitting ? "Submitting..." : "Post Review"}</span>
                  <Send size={17} />
                </button>
              </form>
              <div className="feedback-note">
                Your review will be published after a quick quality check by our team.
              </div>
            </>
          ) : (
            <section className="feedback-login-prompt">
              <EmptyStateIcon variant="feedback" />
              <h2>Login to Share Your Experience</h2>
              <p>Sign in to leave a review and help others discover the best of Banarasi Kala.</p>
              <Link to="/login?redirect=/feedback" className="feedback-login-link">
                Login to Continue <Icon icon="lucide:arrow-right" />
              </Link>
            </section>
          )}
        </div>
      </section>
    </main>
  );
};

export default Feedback;
