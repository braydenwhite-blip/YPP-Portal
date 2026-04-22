"use client";

import ChairQueueBoard from "@/components/instructor-applicants/ChairQueueBoard";

type QueueItem = {
  id: string;
  motivation: string | null;
  teachingExperience: string | null;
  availability: string | null;
  subjectsOfInterest: string | null;
  courseIdea: string | null;
  textbook: string | null;
  courseOutline: string | null;
  firstClassPlan: string | null;
  materialsReadyAt: Date | null;
  chairQueuedAt: Date | null;
  preferredFirstName: string | null;
  legalName: string | null;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapterId: string | null;
    chapter: { id: string; name: string } | null;
  };
  reviewer: { id: string; name: string | null } | null;
  applicationReviews: Array<{
    summary: string | null;
    nextStep: string | null;
    notes: string | null;
    overallRating: string | null;
    categories: Array<{ category: string; rating: string | null; notes: string | null }>;
  }>;
  interviewReviews: Array<{
    id: string;
    reviewerId: string;
    recommendation: string | null;
    overallRating: string | null;
    summary: string | null;
    reviewer: { id: string; name: string | null };
    categories: Array<{ category: string; rating: string | null; notes: string | null }>;
  }>;
  interviewerAssignments: Array<{
    id: string;
    role: string;
    interviewer: { id: string; name: string | null };
  }>;
  documents: Array<{
    kind: string;
    fileUrl: string;
    originalName: string | null;
  }>;
};

export default function ChairQueueClientWrapper({
  initialApplications,
}: {
  initialApplications: QueueItem[];
}) {
  function handleRefresh() {
    // In a full implementation, re-fetch; for now just reload the page
    window.location.reload();
  }

  return <ChairQueueBoard applications={initialApplications} onRefresh={handleRefresh} />;
}
