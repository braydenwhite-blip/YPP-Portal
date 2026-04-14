import Link from "next/link";

export const metadata = { title: "Help" };

const FAQ = [
  {
    q: "How often do I submit a self-reflection?",
    a: "Once per calendar month, ideally before day 21. There is a short grace period past the soft deadline before it is flagged as overdue.",
  },
  {
    q: "What is the kickoff, and who marks it complete?",
    a: "The kickoff is the first meeting between mentor and mentee. The assigned mentor marks it complete from the mentee workspace; that unlocks the first reflection cycle and notifies the mentee.",
  },
  {
    q: "How do achievement points work?",
    a: "Points are automatically calculated when the chair approves your monthly review. The amount depends on your mentor's overall rating and your role (instructor, chapter president, or global leadership). A Character & Culture bonus can add up to 25 more points.",
  },
  {
    q: "What is chair approval?",
    a: "After a mentor writes a review, a committee chair for your role lane reviews and approves it before points are awarded and the review is released to you. The chair can also request changes.",
  },
  {
    q: "Who do I contact if something is broken or my pairing is wrong?",
    a: "Use the Anonymous Feedback link in the Start Here group, or send a direct message to your chapter admin.",
  },
  {
    q: "Why don't I see a reflection to fill out?",
    a: "You'll only see a reflection if you have an active mentorship in a program-participant role and the kickoff has been completed. If you believe this is wrong, contact your chapter admin.",
  },
  {
    q: "Where can I see my review history?",
    a: "Your released monthly reviews appear on /my-program. Each cycle's review, rating, points, and tier progress is shown there.",
  },
];

export default function HelpPage() {
  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Support</p>
          <h1 className="page-title">Need help?</h1>
          <p className="page-subtitle">
            Common questions about the mentorship program, reflections, reviews, and points.
          </p>
        </div>
      </div>

      <section className="card" style={{ padding: "1rem 1.25rem", marginBottom: 16 }}>
        <strong>Still stuck?</strong>
        <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
          Drop anonymous feedback on{" "}
          <Link href="/feedback/anonymous">/feedback/anonymous</Link>, or message your chapter admin directly.
        </p>
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {FAQ.map((item) => (
          <details key={item.q} className="card" style={{ padding: "0.75rem 1rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>{item.q}</summary>
            <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
