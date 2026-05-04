"use client";

/**
 * Sticky 72-px header carrying applicant identity, the compact readiness
 * meter (or audit banner if already decided), and the queue navigator.
 * §6.2 of the redesign plan.
 */

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
      className="applicant-snapshot-bar"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role="region"
      aria-label="Applicant snapshot"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "var(--cockpit-surface, #fff)",
        borderBottom: "1px solid var(--cockpit-line, rgba(71,85,105,0.16))",
        padding: "12px 24px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto auto",
        alignItems: "center",
        gap: 16,
      }}
    >
      <ApplicantIdentity
        applicant={application.applicant}
        preferredFirstName={application.preferredFirstName}
        legalName={application.legalName}
        status={application.status}
        chapterName={application.chapterName}
        subjectsOfInterest={application.subjectsOfInterest}
        daysInQueue={application.daysInQueue}
        size="md"
      />
      <div className="snapshot-meter-or-status">
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
      <QueueNavigator
        currentId={application.id}
        prevId={queue.prevId}
        nextId={queue.nextId}
        position={queue.position}
        total={queue.total}
        siblings={queue.siblings}
        routeBuilder={routeBuilder}
      />
    </motion.header>
  );
}
