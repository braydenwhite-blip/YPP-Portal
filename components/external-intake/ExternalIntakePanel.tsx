import type { ApplicationSource } from "@prisma/client";
import {
  describeApplicationSource,
  isExternalApplicationSource,
} from "@/lib/application-source-config";

interface ExternalIntakePanelProps {
  source: ApplicationSource;
  externalSubmittedAt: string | null;
  externalImportedAt: string | null;
  externalResponseUrl: string | null;
  externalAnswersCopy: string | null;
  internalNotes: string | null;
  importedBy: { id: string; name: string | null } | null;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

/**
 * Cockpit-section that surfaces the "external intake" metadata for an
 * application. Hidden for portal-native applications (rendering it for
 * source = PORTAL would just be noise) unless internal notes are present.
 *
 * The framing is intentional: "External intake, internal review."
 * Admins should never feel the external applicant is second-class.
 */
export default function ExternalIntakePanel({
  source,
  externalSubmittedAt,
  externalImportedAt,
  externalResponseUrl,
  externalAnswersCopy,
  internalNotes,
  importedBy,
}: ExternalIntakePanelProps) {
  const descriptor = describeApplicationSource(source);
  const external = isExternalApplicationSource(source);

  // Skip rendering entirely for portal-native applications with no internal
  // notes — there's nothing useful to show.
  if (!external && !internalNotes) return null;

  return (
    <section
      id="section-external-intake"
      className="cockpit-panel cockpit-panel-accent"
      aria-label="External application intake details"
    >
      <div className="cockpit-section-heading">
        <span className="cockpit-section-kicker">Application source</span>
        <h2>{descriptor.longLabel}</h2>
      </div>

      <p className="cockpit-prose" style={{ marginTop: 0 }}>
        {descriptor.description}
      </p>

      <dl className="cockpit-detail-grid" style={{ marginTop: 12 }}>
        {externalSubmittedAt && (
          <>
            <dt>Submitted externally</dt>
            <dd>{formatDate(externalSubmittedAt)}</dd>
          </>
        )}
        {externalImportedAt && (
          <>
            <dt>Imported into portal</dt>
            <dd>{formatDate(externalImportedAt)}</dd>
          </>
        )}
        {importedBy?.name && (
          <>
            <dt>Imported by</dt>
            <dd>{importedBy.name}</dd>
          </>
        )}
        {externalResponseUrl && (
          <>
            <dt>External response</dt>
            <dd>
              <a
                href={externalResponseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                Open original response
              </a>
            </dd>
          </>
        )}
      </dl>

      {externalAnswersCopy && (
        <details
          className="cockpit-prose"
          style={{
            marginTop: 16,
            background: "var(--surface-1, #fafafa)",
            border: "1px solid var(--border-muted, #e5e7eb)",
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          <summary
            style={{
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              color: "var(--muted)",
            }}
          >
            External form answers (copied at intake)
          </summary>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: 13,
              lineHeight: 1.55,
              margin: "10px 0 0",
              color: "var(--text-strong, #111827)",
            }}
          >
            {externalAnswersCopy}
          </pre>
        </details>
      )}

      {internalNotes && (
        <div
          style={{
            marginTop: 16,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#92400e" }}>
            Internal notes (admin-only)
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#78350f", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {internalNotes}
          </p>
        </div>
      )}
    </section>
  );
}
