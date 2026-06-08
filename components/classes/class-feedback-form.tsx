"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitClassFeedback } from "@/lib/class-feedback-actions";
import { StarRating } from "@/components/classes/star-rating";

type Recommend = "yes" | "no" | "";

/**
 * Student-facing post-class feedback form. Shared by the My Classes feedback
 * prompt and the class detail page so the question set stays identical wherever
 * a learner is asked "how was this class?".
 */
export function ClassFeedbackForm({
  offeringId,
  defaultRating = 0,
  defaultLiked = "",
  defaultImprove = "",
  defaultRecommend = "",
  submittedAt,
  onDone,
}: {
  offeringId: string;
  defaultRating?: number;
  defaultLiked?: string;
  defaultImprove?: string;
  defaultRecommend?: Recommend;
  submittedAt?: Date | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState(defaultRating);
  const [liked, setLiked] = useState(defaultLiked);
  const [improve, setImprove] = useState(defaultImprove);
  const [recommend, setRecommend] = useState<Recommend>(defaultRecommend);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit() {
    if (rating < 1) {
      setError("Please choose a star rating.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("offeringId", offeringId);
        fd.set("rating", String(rating));
        fd.set("liked", liked);
        fd.set("improve", improve);
        fd.set("wouldRecommend", recommend);
        await submitClassFeedback(fd);
        setDone(true);
        router.refresh();
        onDone?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your feedback.");
      }
    });
  }

  if (done) {
    return (
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          background: "#f0fdf4",
          color: "#166534",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Thanks for the feedback — it helps us make classes better. ✓
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {submittedAt ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
          You shared feedback on{" "}
          {new Date(submittedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
          . You can update it below.
        </p>
      ) : null}

      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Overall, how was this class?
        </label>
        <StarRating value={rating} onChange={setRating} label="Your rating" />
      </div>

      <label style={{ fontSize: 13, fontWeight: 600 }}>
        What did you like?
        <textarea
          className="input"
          rows={2}
          value={liked}
          onChange={(e) => setLiked(e.target.value)}
          placeholder="What worked well for you?"
          style={{ fontSize: 14, resize: "vertical", marginTop: 4, fontWeight: 400 }}
        />
      </label>

      <label style={{ fontSize: 13, fontWeight: 600 }}>
        What would you improve?
        <textarea
          className="input"
          rows={2}
          value={improve}
          onChange={(e) => setImprove(e.target.value)}
          placeholder="Anything that would have made it better?"
          style={{ fontSize: 14, resize: "vertical", marginTop: 4, fontWeight: 400 }}
        />
      </label>

      <div>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Would you recommend this class to a friend?
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["yes", "no"] as const).map((option) => {
            const selected = recommend === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setRecommend(selected ? "" : option)}
                className={`button ${selected ? "primary" : "secondary"}`}
                style={{ fontSize: 13, textTransform: "capitalize" }}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{error}</p>}

      <button
        className="button primary"
        onClick={handleSubmit}
        disabled={isPending}
        style={{ fontSize: 14, alignSelf: "flex-start" }}
      >
        {isPending ? "Saving…" : submittedAt ? "Update feedback" : "Submit feedback"}
      </button>
    </div>
  );
}
