import { StudentInterestForm } from "@/components/interest/student-interest-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Get Started — Youth Passion Project",
  description: "Tell us about your student and we'll follow up about Youth Passion Project classes.",
};

// Public, no-login lead form for families who don't have a portal account
// yet. On submit this creates a StudentLeadSubmission for staff follow-up.
export default function StudentInterestPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6">
      <header>
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-brand-700">Youth Passion Project</p>
        <h1 className="m-0 mt-1 text-[26px] font-bold text-ink">Get started</h1>
        <p className="m-0 mt-1 text-[14px] text-ink-muted">
          Tell us a bit about your student and we&rsquo;ll follow up by email.
        </p>
      </header>
      <div className="mt-6">
        <StudentInterestForm />
      </div>
    </div>
  );
}