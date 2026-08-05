import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { GoalRatingColor } from "@prisma/client";

import { PrintMonthlyUpdateButton } from "@/components/mentorship/print-monthly-update-button";
import { ShareProgressUpdateControls } from "@/components/mentorship/workspace/share-progress-update";
import { getSessionUser } from "@/lib/auth-supabase";
import {
  loadMonthlyProgressUpdate,
  ratingLabel,
  type MonthlyProgressUpdateDoc,
} from "@/lib/mentorship/monthly-progress-update";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monthly Progress Update" };

function ratingColor(rating: GoalRatingColor | null | undefined): string {
  switch (rating) {
    case "BEHIND_SCHEDULE":
      return "#b91c1c";
    case "GETTING_STARTED":
      return "#c2410c";
    case "ACHIEVED":
      return "#047857";
    case "ABOVE_AND_BEYOND":
      return "#6b21c8";
    default:
      return "#717189";
  }
}

function DocBody({ doc }: { doc: MonthlyProgressUpdateDoc }) {
  return (
    <article className="sheet">
      <header className="sheet-top">
        <p className="brand">Youth Passion Project</p>
        <h1>Monthly Progress Update</h1>
        <p className="who">
          {doc.leaderName}
          <span>·</span>
          {doc.thisMonthLabel}
        </p>
      </header>

      <dl className="facts">
        <div>
          <dt>Role</dt>
          <dd>{doc.position}</dd>
        </div>
        <div>
          <dt>Mentor</dt>
          <dd>{doc.mentorName}</dd>
        </div>
        <div>
          <dt>Class of</dt>
          <dd>{doc.classOf ?? "—"}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>{doc.startMonthLabel}</dd>
        </div>
      </dl>

      <section className="section">
        <h2>Assessment</h2>

        <div className="row">
          <div>
            <p className="label">Overall rating</p>
            <p
              className="rating"
              style={{ color: ratingColor(doc.overallRating) }}
            >
              {doc.overallRating ? ratingLabel(doc.overallRating) : "Not rated"}
            </p>
          </div>
        </div>

        {doc.overallComments ? (
          <div className="field">
            <p className="label">Comments</p>
            <p className="prose whitespace-pre-wrap">{doc.overallComments}</p>
          </div>
        ) : null}

        {(doc.strengths || doc.areasForDevelopment) && (
          <div className="pair">
            {doc.strengths ? (
              <div className="field">
                <p className="label">Strengths</p>
                <p className="prose whitespace-pre-wrap">{doc.strengths}</p>
              </div>
            ) : null}
            {doc.areasForDevelopment ? (
              <div className="field">
                <p className="label">Areas for development</p>
                <p className="prose whitespace-pre-wrap">
                  {doc.areasForDevelopment}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="section">
        <h2>Goals for next month</h2>

        {doc.goals.length === 0 ? (
          <p className="empty">No goals captured yet.</p>
        ) : (
          <ol className="goals">
            {doc.goals.map((goal, index) => (
              <li key={`${goal.title}-${index}`}>
                <div className="goal-head">
                  <h3>
                    <span>{index + 1}</span>
                    {goal.title}
                  </h3>
                  {goal.rating ? (
                    <p
                      className="goal-rating"
                      style={{ color: ratingColor(goal.rating) }}
                    >
                      {ratingLabel(goal.rating)}
                    </p>
                  ) : null}
                </div>

                {goal.collaborateWith ? (
                  <div className="field">
                    <p className="label">Collaborate with</p>
                    <p className="prose">{goal.collaborateWith}</p>
                  </div>
                ) : null}

                {goal.objective ? (
                  <div className="field">
                    <p className="label">Objective</p>
                    <p className="prose whitespace-pre-wrap">{goal.objective}</p>
                  </div>
                ) : null}

                {goal.actionItems.length > 0 ? (
                  <div className="field">
                    <p className="label">Action items</p>
                    <ul>
                      {goal.actionItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
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

  if (!viewer) {
    redirect(`/login?next=/mentorship/people/${id}/monthly-update/print`);
  }

  const doc = await loadMonthlyProgressUpdate({
    personId: id,
    viewerId: viewer.id,
    viewerRoles: viewer.roles ?? [],
    reviewId: sp.reviewId ?? null,
    monthKey: sp.month ?? null,
  });

  if (!doc) notFound();

  return (
    <div className="frame">
      <div className="bar no-print">
        <Link href={`/mentorship/people/${id}?section=progress`}>
          ← Back to Review
        </Link>
        <div className="bar-actions">
          <PrintMonthlyUpdateButton />
          {doc.reviewId ? (
            <ShareProgressUpdateControls
              personId={id}
              reviewId={doc.reviewId}
              monthKey={doc.monthKey}
              canNotifyMentee={viewer.id !== id}
              menteeFirstName={doc.leaderName.split(/\s+/)[0] || "them"}
              compact
              hideDownload
            />
          ) : null}
        </div>
      </div>

      <DocBody doc={doc} />

      <style>{`
        .frame {
          min-height: 100vh;
          padding: 28px 20px 72px;
          background: #f3f1f7;
          color: #1a1625;
          font-family: var(--font-dm-sans-real), var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .bar {
          max-width: 720px;
          margin: 0 auto 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .bar a {
          color: #6b21c8;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }
        .bar a:hover { opacity: 0.8; }
        .bar-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .sheet {
          max-width: 720px;
          margin: 0 auto;
          background: #fff;
          border-radius: 20px;
          padding: 48px 52px 56px;
          box-shadow: 0 18px 50px rgba(40, 20, 80, 0.07);
        }

        .sheet-top { margin-bottom: 36px; }
        .brand {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #6b21c8;
        }
        .sheet-top h1 {
          margin: 14px 0 0;
          font-family: var(--font-playfair), var(--font-lora), Georgia, serif;
          font-size: 34px;
          font-weight: 600;
          letter-spacing: -0.03em;
          line-height: 1.12;
          color: #1a1625;
        }
        .who {
          margin: 14px 0 0;
          font-size: 15px;
          color: #6f6a7c;
          font-weight: 500;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .who span { color: #cfc8db; }

        .facts {
          margin: 0 0 40px;
          padding: 22px 0;
          border-top: 1px solid #ece8f3;
          border-bottom: 1px solid #ece8f3;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px 20px;
        }
        .facts dt {
          margin: 0;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #9a94a8;
        }
        .facts dd {
          margin: 7px 0 0;
          font-size: 14px;
          font-weight: 600;
          color: #1a1625;
          line-height: 1.35;
        }

        .section + .section { margin-top: 40px; }
        .section h2 {
          margin: 0 0 20px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #9a94a8;
        }

        .row {
          display: flex;
          flex-wrap: wrap;
          gap: 28px 48px;
          margin-bottom: 8px;
        }
        .label {
          margin: 0 0 6px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #9a94a8;
        }
        .rating {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .field { margin-top: 22px; }
        .prose {
          margin: 0;
          font-size: 15px;
          line-height: 1.65;
          color: #3d3950;
        }
        .pair {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          margin-top: 22px;
        }

        .empty {
          margin: 0;
          font-size: 14px;
          color: #9a94a8;
        }

        .goals {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .goals > li {
          padding: 22px 0;
          border-top: 1px solid #ece8f3;
        }
        .goals > li:first-child {
          border-top: none;
          padding-top: 0;
        }
        .goal-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 4px;
        }
        .goal-head h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #1a1625;
          line-height: 1.35;
          display: flex;
          gap: 10px;
        }
        .goal-head h3 span {
          color: #b7b0c6;
          font-weight: 600;
          min-width: 1ch;
        }
        .goal-rating {
          margin: 2px 0 0;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }
        .goals ul {
          margin: 0;
          padding-left: 1.1em;
          font-size: 14.5px;
          line-height: 1.55;
          color: #3d3950;
        }
        .goals ul li + li { margin-top: 4px; }

        .whitespace-pre-wrap { white-space: pre-wrap; }

        @media print {
          .no-print { display: none !important; }
          .frame {
            background: #fff;
            padding: 0;
            min-height: 0;
          }
          .sheet {
            max-width: none;
            margin: 0;
            border-radius: 0;
            box-shadow: none;
            padding: 0;
          }
          .goals > li { break-inside: avoid; }
          a { color: inherit; text-decoration: none; }
        }

        @media (max-width: 700px) {
          .sheet { padding: 32px 22px 40px; border-radius: 16px; }
          .sheet-top h1 { font-size: 28px; }
          .facts { grid-template-columns: 1fr 1fr; }
          .pair { grid-template-columns: 1fr; gap: 18px; }
        }

        @media (max-width: 420px) {
          .facts { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
