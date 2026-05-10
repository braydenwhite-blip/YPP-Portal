import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  isRegularInstructorEnabled,
  isSummerWorkshopInstructorEnabled,
} from "@/lib/feature-flags";
import ReapplyForm from "./reapply-form";

export const dynamic = "force-dynamic";

/**
 * Entry point for **signed-in** users who want to start a (new) instructor
 * application. New (signed-out) applicants still go through `/signup/instructor`.
 *
 * If the user has a non-terminal application, send them to `/application-status`
 * — they cannot have two open applications at once.
 *
 * If they have a closed prior application, render the re-application form
 * pre-filled with the prior answers.
 */
export default async function NewInstructorApplicationPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/signup/instructor");
  }

  if (!isSummerWorkshopInstructorEnabled() && !isRegularInstructorEnabled()) {
    redirect("/applications/summer-workshop");
  }

  const TERMINAL_STATUSES = ["APPROVED", "REJECTED", "WITHDRAWN"] as const;

  const latest = await prisma.instructorApplication.findFirst({
    where: { applicantId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      legalName: true,
      preferredFirstName: true,
      phoneNumber: true,
      dateOfBirth: true,
      hearAboutYPP: true,
      city: true,
      stateProvince: true,
      zipCode: true,
      country: true,
      schoolName: true,
      graduationYear: true,
      subjectsOfInterest: true,
      teachingExperience: true,
      availability: true,
      hoursPerWeek: true,
      preferredStartDate: true,
      motivation: true,
      referralEmails: true,
      courseIdea: true,
      courseOutline: true,
      firstClassPlan: true,
      workshopOutline: true,
      applicationTrack: true,
    },
  });

  if (
    latest &&
    !TERMINAL_STATUSES.includes(latest.status as typeof TERMINAL_STATUSES[number])
  ) {
    redirect("/application-status");
  }

  const isSummerWorkshop = !isRegularInstructorEnabled();

  // Flatten the prior workshopOutline JSON into the form-field shape the
  // ReapplyForm expects so re-applications start from the user's last
  // submitted outline rather than blank.
  let workshopFields: Record<string, string | number | null | undefined> = {};
  if (latest?.workshopOutline && typeof latest.workshopOutline === "object") {
    const o = latest.workshopOutline as {
      title?: string;
      ageRange?: string;
      durationMinutes?: number;
      learningGoals?: unknown;
      activityFlow?: string;
      materialsNeeded?: unknown;
      engagementHook?: string;
      adaptationNotes?: string;
    };
    workshopFields = {
      workshopTitle: o.title,
      workshopAgeRange: o.ageRange,
      workshopDurationMinutes: o.durationMinutes,
      workshopLearningGoals: Array.isArray(o.learningGoals)
        ? (o.learningGoals as string[]).join("\n")
        : "",
      workshopActivityFlow: o.activityFlow,
      workshopMaterialsNeeded: Array.isArray(o.materialsNeeded)
        ? (o.materialsNeeded as string[]).join("\n")
        : "",
      workshopEngagementHook: o.engagementHook,
      workshopAdaptationNotes: o.adaptationNotes,
    };
  }

  // Parse hearAboutYPP "Source: detail" back into option/detail.
  let hearAboutYPPOption = "";
  let hearAboutYPPDetail = "";
  if (latest?.hearAboutYPP) {
    const idx = latest.hearAboutYPP.indexOf(":");
    if (idx > 0) {
      hearAboutYPPOption = latest.hearAboutYPP.slice(0, idx).trim();
      hearAboutYPPDetail = latest.hearAboutYPP.slice(idx + 1).trim();
    } else {
      hearAboutYPPOption = latest.hearAboutYPP;
    }
  }

  const prefill: Record<string, string | number | null | undefined> = latest
    ? {
        legalName: latest.legalName,
        preferredFirstName: latest.preferredFirstName,
        phoneNumber: latest.phoneNumber,
        dateOfBirth: latest.dateOfBirth,
        hearAboutYPPOption,
        hearAboutYPPDetail,
        city: latest.city,
        stateProvince: latest.stateProvince,
        zipCode: latest.zipCode,
        country: latest.country,
        schoolName: latest.schoolName,
        graduationYear: latest.graduationYear,
        subjectsOfInterest: latest.subjectsOfInterest,
        teachingExperience: latest.teachingExperience,
        availability: latest.availability,
        hoursPerWeek: latest.hoursPerWeek,
        preferredStartDate: latest.preferredStartDate,
        motivation: latest.motivation,
        referralEmails: latest.referralEmails,
        courseIdea: latest.courseIdea,
        courseOutline: latest.courseOutline,
        firstClassPlan: latest.firstClassPlan,
        ...workshopFields,
      }
    : {};

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px 80px" }}>
      <p className="badge">Instructor Application</p>
      <h1 className="page-title">
        {latest
          ? "Start a new application"
          : isSummerWorkshop
            ? "Apply to be a Summer Workshop Instructor"
            : "Apply to become an instructor"}
      </h1>
      {latest ? (
        <div
          role="status"
          style={{
            marginTop: 12,
            marginBottom: 24,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#fef3c7",
            border: "1px solid #fde68a",
            fontSize: 13,
            color: "#78350f",
            lineHeight: 1.55,
          }}
        >
          We&apos;ve pre-filled this form with your previous application so you
          can update what changed and submit again. The new application will
          be flagged as a re-application so reviewers see the prior context.
          Your previous application stays in the record.
        </div>
      ) : (
        <p className="page-subtitle" style={{ marginBottom: 24 }}>
          Already signed in. Complete the form below to submit your
          {isSummerWorkshop ? " Summer Workshop " : " "}Instructor application.
        </p>
      )}

      <ReapplyForm isSummerWorkshop={isSummerWorkshop} prefill={prefill} />

      <div style={{ marginTop: 24, fontSize: 13 }}>
        <Link href="/application-status" className="link">
          Back to your application status
        </Link>
      </div>
    </div>
  );
}
