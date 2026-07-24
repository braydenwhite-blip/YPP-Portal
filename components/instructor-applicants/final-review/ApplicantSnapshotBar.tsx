"use client";

/**
 * Sticky 72-px header carrying applicant identity, the compact readiness
 * meter (or audit banner if already decided), and the queue navigator.
 * §6.2 of the redesign plan.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import type { InstructorApplicationStatus, ChairDecisionAction } from "@prisma/client";
import type { QueueNeighbors } from "@/lib/final-review-queries";
import type { ReadinessSignals } from "@/lib/readiness-signals";
import ApplicantIdentity from "./ApplicantIdentity";
import DecisionReadinessMeter from "./DecisionReadinessMeter";
import QueueNavigator from "./QueueNavigator";
import ApplicantStatusBanner from "./ApplicantStatusBanner";

export interface ApplicantSnapshotBarProps {
  application: {
    id: string;
    status: InstructorApplicationStatus;
    preferredFirstName: string | null;
    lastName: string | null;
    legalName: string | null;
    applicant: { id: string; name: string | null };
    chapterName: string | null;
    subjectsOfInterest: string | null;
    daysInQueue: number | null;
  };
  readiness: ReadinessSignals;
  queue: QueueNeighbors;
  latestDecision: { action: ChairDecisionAction; decidedAt: string } | null;
  canRescind?: boolean;
  onRescindClick?: () => void;
  routeBuilder: (id: string) => string;
}

export default function ApplicantSnapshotBar({
  application,
  readiness,
  queue,
  latestDecision,
  canRescind,
  onRescindClick,
  routeBuilder,
}: ApplicantSnapshotBarProps) {
  const isDecided = application.status !== "CHAIR_REVIEW";

  return (
    <motion.header
      className="sticky top-0 z-10 grid grid-cols-1 items-center gap-2.5 border-b border-line bg-surface px-6 py-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-4"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role="region"
      aria-label="Applicant snapshot"
    >
      <ApplicantIdentity
        applicant={application.applicant}
        preferredFirstName={application.preferredFirstName}
        lastName={application.lastName}
        legalName={application.legalName}
        status={application.status}
        chapterName={application.chapterName}
        subjectsOfInterest={application.subjectsOfInterest}
        daysInQueue={application.daysInQueue}
        size="md"
      />
      <div>
        {isDecided ? (
          <ApplicantStatusBanner
            status={application.status}
            latestDecision={latestDecision}
            canRescind={canRescind}
            onRescindClick={onRescindClick}
          />
        ) : (
          <DecisionReadinessMeter signals={readiness} compact />
        )}
      </div>
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/instructor-applicants/${application.id}`}
          className="whitespace-nowrap text-[12.5px] font-semibold text-brand-700 hover:underline"
        >
          Application record →
        </Link>
        <QueueNavigator
          currentId={application.id}
          prevId={queue.prevId}
          nextId={queue.nextId}
          position={queue.position}
          total={queue.total}
          siblings={queue.siblings}
          routeBuilder={routeBuilder}
        />
      </div>
    </motion.header>
  );
}
