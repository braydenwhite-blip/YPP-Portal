import Link from "next/link";
import type { ReactNode } from "react";

import {
  KeyFactsGrid,
  RecordSection,
  StatusBadge,
  cn,
  type KeyFact,
  type StatusTone,
} from "@/components/ui-v2";

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-surface-soft px-3.5 py-3">
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">
        {title}
      </p>
      <div className="mt-1.5 text-[14px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

function ContactTile({
  label,
  value,
  href,
  empty,
}: {
  label: string;
  value: string;
  href?: string;
  empty?: boolean;
}) {
  return (
    <div className="rounded-[11px] border border-line-soft bg-surface-soft px-3.5 py-3">
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </p>
      <div className="mt-1">
        {href && !empty ? (
          <a
            href={href}
            className="font-semibold text-brand-700 no-underline hover:underline"
          >
            {value}
          </a>
        ) : (
          <span
            className={cn(
              "text-[14px] font-semibold",
              empty ? "text-ink-muted" : "text-ink"
            )}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

export function HiringApplicationRecordSimple({
  backHref,
  backLabel = "Application board",
  eyebrow,
  displayName,
  identityLine,
  status,
  badges = [],
  nextStep,
  facts,
  contact,
  locationEditor,
  applicationFields,
  applicationEditor,
  documents = [],
  interviewSection,
  notesSection,
  decisionSection,
  actionsSection,
}: {
  backHref: string;
  backLabel?: string;
  eyebrow: string;
  displayName: string;
  identityLine: string;
  status: { label: string; tone: StatusTone };
  badges?: Array<{ label: string; tone: StatusTone }>;
  nextStep: { title: string; detail: string } | null;
  facts: KeyFact[];
  contact: { email: string; phone: string | null };
  locationEditor?: ReactNode;
  applicationFields: Array<{ title: string; body: string }>;
  applicationEditor?: ReactNode;
  documents?: Array<{ label: string; href: string }>;
  interviewSection?: ReactNode;
  notesSection?: ReactNode;
  decisionSection?: ReactNode;
  actionsSection?: ReactNode;
}) {
  const phone = contact.phone?.trim() || "";

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-muted no-underline hover:text-brand-700"
      >
        ← {backLabel}
      </Link>

      <div className="min-w-0 rounded-[14px] border border-line-soft bg-surface p-4 shadow-card sm:p-5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-[12rem]">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              {eyebrow}
            </p>
            <h1 className="m-0 mt-0.5 break-words text-[22px] font-extrabold tracking-[-0.3px] text-ink sm:text-[24px]">
              {displayName}
            </h1>
            <p className="m-0 mt-1 break-words text-[13px] text-ink-muted">
              {identityLine}
            </p>
          </div>
          <div className="flex max-w-full flex-wrap gap-1.5">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {badges.map((badge) => (
              <StatusBadge key={badge.label} tone={badge.tone}>
                {badge.label}
              </StatusBadge>
            ))}
          </div>
        </div>

        {nextStep ? (
          <p className="m-0 mt-4 break-words rounded-[10px] bg-brand-50 px-3 py-2.5 text-[13px] leading-relaxed text-ink-muted">
            <span className="font-semibold text-ink">{nextStep.title}.</span>{" "}
            {nextStep.detail}
          </p>
        ) : null}
      </div>

      <KeyFactsGrid facts={facts} />

      <RecordSection title="Contact">
        <div className="grid gap-3 sm:grid-cols-2">
          <ContactTile
            label="Email"
            value={contact.email}
            href={`mailto:${contact.email}`}
          />
          <ContactTile
            label="Phone"
            value={phone || "Not provided"}
            href={phone ? `tel:${phone.replace(/\s/g, "")}` : undefined}
            empty={!phone}
          />
        </div>
        {locationEditor ? <div className="mt-4">{locationEditor}</div> : null}
      </RecordSection>

      <RecordSection id="application" title="Application" className="scroll-mt-24">
        {applicationFields.length > 0 ? (
          <div className="flex flex-col gap-2">
            {applicationFields.map((field) => (
              <DetailBlock key={field.title} title={field.title}>
                <p className="m-0 whitespace-pre-wrap">{field.body}</p>
              </DetailBlock>
            ))}
          </div>
        ) : (
          <p className="m-0 text-[13px] text-ink-muted">No written responses on file.</p>
        )}

        {documents.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {documents.map((doc) => (
              <a
                key={doc.href}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-soft px-3 py-1.5 text-[12.5px] font-semibold text-brand-800 no-underline hover:border-brand-300 hover:bg-brand-50"
              >
                📎 {doc.label}
              </a>
            ))}
          </div>
        ) : null}

        {applicationEditor}
      </RecordSection>

      {interviewSection}

      {notesSection}

      {decisionSection}

      {actionsSection}
    </div>
  );
}
