"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  migrateMissingUsers,
  type AdminUserMigrationResult,
} from "@/lib/admin-actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Migrating..." : "Migrate Missing Users"}
    </button>
  );
}

export function MigrateMissingUsersForm() {
  const [result, setResult] = useState<AdminUserMigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setResult(null);

    try {
      const migrationResult = await migrateMissingUsers();
      setResult(migrationResult);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not run the user migration."
      );
    }
  }

  return (
    <form action={handleSubmit} className="form-grid">
      {error && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#fee2e2",
            border: "1px solid #ef4444",
            borderRadius: "6px",
            color: "#991b1b",
            fontSize: "14px",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div
          style={{
            padding: "12px",
            backgroundColor: result.failed === 0 ? "#d1fae5" : "#fef3c7",
            border: `1px solid ${result.failed === 0 ? "#10b981" : "#f59e0b"}`,
            borderRadius: "6px",
            color: result.failed === 0 ? "#065f46" : "#92400e",
            fontSize: "14px",
            lineHeight: 1.6,
          }}
        >
          <strong>Finished.</strong> Found {result.found} missing users. Migrated {result.migrated}, linked {result.linked}, skipped {result.skipped}, failed {result.failed}.
          {result.highlights.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {result.highlights.map((highlight) => (
                <div key={`${highlight.email}-${highlight.status}`}>
                  - {highlight.email}: {highlight.detail}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
        This imports Prisma users that are still missing `supabaseAuthId` into Supabase Auth, then links them back to the portal table.
      </p>

      <SubmitButton />
    </form>
  );
}
