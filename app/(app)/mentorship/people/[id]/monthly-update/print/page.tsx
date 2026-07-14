import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { GoalRatingColor } from "@prisma/client";

import { PrintMonthlyUpdateButton } from "@/components/mentorship/print-monthly-update-button";
import { ShareProgressUpdateControls } from "@/components/mentorship/workspace/share-progress-update";
import { getSessionUser } from "@/lib/auth-supabase";
import {
  loadMonthlyProgressUpdate,
  MONTHLY_UPDATE_RATINGS,
  ratingLabel,
  type MonthlyProgressUpdateDoc,
} from "@/lib/mentorship/monthly-progress-update";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monthly Progress Update" };

function RatingBoxes({ selected }: { selected: GoalRatingColor | null }) {
  return (
    <div className="mpu-ratings">
      {MONTHLY_UPDATE_RATINGS.map((value) => {
        const on = selected === value;
        return (
          <span key={value} className={`mpu-rating ${on ? "is-on" : ""}`}>
            <span className="mpu-box" aria-hidden>
              {on ? "☑" : "☐"}
            </span>
            {ratingLabel(value)}
          </span>
        );
      })}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="mpu-fact">
      <div className="mpu-fact-label">{label}</div>
      <div className="mpu-fact-value">{value}</div>
    </div>
  );
}

function DocBody({ doc }: { doc: MonthlyProgressUpdateDoc }) {
  return (
    <article className="mpu-doc">
      <header className="mpu-header">
        <p className="mpu-kicker">Youth Passion Project</p>
        <h1 className="mpu-title">Monthly Progress Update</h1>
      </header>

      <section className="mpu-grid">
        <Fact label="Leader name" value={doc.leaderName} />
        <Fact label="Position" value={doc.position} />
        <Fact label="Class of" value={doc.classOf ?? "—"} />
        <Fact label="Mentor" value={doc.mentorName} />
        <Fact label="Start month" value={doc.startMonthLabel} />
        <Fact label="This month" value={doc.thisMonthLabel} />
      </section>

      <section className="mpu-section">
        <h2>Overall assessment</h2>
        <div className="mpu-block">
          <div className="mpu-label">Overall rating</div>
          <RatingBoxes selected={doc.overallRating} />
        </div>
        {doc.achievementPoints ? (
          <div className="mpu-block">
            <div className="mpu-label">Achievement points</div>
            <p className="mpu-body">
              {doc.achievementPoints.earned}/{doc.achievementPoints.of}
            </p>
          </div>
        ) : null}
        {doc.overallComments ? (
          <div className="mpu-block">
            <div className="mpu-label">Overall comments</div>
            <p className="mpu-body whitespace-pre-wrap">{doc.overallComments}</p>
          </div>
        ) : null}
        {doc.strengths ? (
          <div className="mpu-block">
            <div className="mpu-label">Strengths</div>
            <p className="mpu-body whitespace-pre-wrap">{doc.strengths}</p>
          </div>
        ) : null}
        {doc.areasForDevelopment ? (
          <div className="mpu-block">
            <div className="mpu-label">Areas for development</div>
            <p className="mpu-body whitespace-pre-wrap">{doc.areasForDevelopment}</p>
          </div>
        ) : null}
      </section>

      <section className="mpu-section">
        <h2>Goals for next month</h2>
        {doc.goals.length === 0 ? (
          <p className="mpu-muted">No goals captured for this month yet.</p>
        ) : (
          doc.goals.map((goal, index) => (
            <div key={`${goal.title}-${index}`} className="mpu-goal">
              <h3>
                Goal category {index + 1} — {goal.title}
              </h3>
              {goal.collaborateWith ? (
                <div className="mpu-block">
                  <div className="mpu-label">Collaborate with</div>
                  <p className="mpu-body">{goal.collaborateWith}</p>
                </div>
              ) : null}
              <div className="mpu-block">
                <div className="mpu-label">Current progress</div>
                <RatingBoxes selected={goal.rating} />
              </div>
              {goal.objective ? (
                <div className="mpu-block">
                  <div className="mpu-label">Overall objective</div>
                  <p className="mpu-body whitespace-pre-wrap">{goal.objective}</p>
                </div>
              ) : null}
              {goal.actionItems.length > 0 ? (
                <div className="mpu-block">
                  <div className="mpu-label">Action items</div>
                  <ul className="mpu-list">
                    {goal.actionItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))
        )}
      </section>
    </article>
  );
}

export default async function MonthlyProgressUpdatePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reviewId?: string; month?: string }>;
}) {
  const [{ id }, sp, viewer] = await Promise.all([
    params,
    searchParams,
    getSessionUser(),
  ]);

  if (!viewer) redirect(`/login?next=/mentorship/people/${id}/monthly-update/print`);

  const doc = await loadMonthlyProgressUpdate({
    personId: id,
    viewerId: viewer.id,
    viewerRoles: viewer.roles ?? [],
    reviewId: sp.reviewId ?? null,
    monthKey: sp.month ?? null,
  });

  if (!doc) notFound();

  return (
    <div className="mpu-page">
      <div className="mpu-toolbar no-print">
        <Link href={`/mentorship/people/${id}?section=progress`} className="mpu-back">
          ← Back to Progress update
        </Link>
        <div className="mpu-toolbar-actions">
          <PrintMonthlyUpdateButton />
          {doc.reviewId ? (
            <ShareProgressUpdateControls
              personId={id}
              reviewId={doc.reviewId}
              monthKey={doc.monthKey}
              canNotifyMentee={viewer.id !== id}
              menteeFirstName={doc.leaderName.split(/\s+/)[0] || "them"}
              compact
            />
          ) : null}
        </div>
      </div>
      <DocBody doc={doc} />
      <style>{`
        .mpu-page {
          max-width: 820px;
          margin: 0 auto;
          padding: 24px 20px 64px;
          color: #1c1917;
          font-family: Georgia, "Times New Roman", serif;
          background: #fff;
        }
        .mpu-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 20px;
          font-family: ui-sans-serif, system-ui, sans-serif;
          flex-wrap: wrap;
        }
        .mpu-toolbar-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }
        .mpu-back {
          color: #57534e;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }
        .mpu-doc { display: flex; flex-direction: column; gap: 28px; }
        .mpu-kicker {
          margin: 0;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #78716c;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-weight: 700;
        }
        .mpu-title {
          margin: 6px 0 0;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .mpu-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px 24px;
          padding: 16px 0;
          border-top: 1px solid #e7e5e4;
          border-bottom: 1px solid #e7e5e4;
        }
        .mpu-fact-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #78716c;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-weight: 700;
        }
        .mpu-fact-value {
          margin-top: 4px;
          font-size: 15px;
          font-weight: 600;
        }
        .mpu-section h2 {
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 700;
        }
        .mpu-goal {
          border: 1px solid #e7e5e4;
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 12px;
          break-inside: avoid;
        }
        .mpu-goal h3 {
          margin: 0 0 10px;
          font-size: 15px;
          font-weight: 700;
        }
        .mpu-block { margin-top: 10px; }
        .mpu-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: #78716c;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .mpu-body {
          margin: 0;
          font-size: 14px;
          line-height: 1.55;
        }
        .mpu-muted {
          margin: 0 0 8px;
          font-size: 13px;
          color: #78716c;
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .mpu-list {
          margin: 0;
          padding-left: 1.2em;
          font-size: 14px;
          line-height: 1.5;
        }
        .mpu-ratings {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 16px;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 13px;
        }
        .mpu-rating { display: inline-flex; align-items: center; gap: 6px; color: #57534e; }
        .mpu-rating.is-on { color: #1c1917; font-weight: 700; }
        .mpu-box { font-size: 14px; }
        .whitespace-pre-wrap { white-space: pre-wrap; }
        @media print {
          .no-print { display: none !important; }
          .mpu-page { padding: 0; max-width: none; }
          .mpu-goal { break-inside: avoid; }
          a { color: inherit; text-decoration: none; }
        }
        @media (max-width: 640px) {
          .mpu-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
