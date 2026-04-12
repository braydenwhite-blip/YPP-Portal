"use client";

import { useState } from "react";

import { submitInstructorGrowthClaimAction } from "@/lib/instructor-growth-actions";
import styles from "@/components/instructor-growth/instructor-growth.module.css";

type ClaimTemplate = {
  eventKey: string;
  title: string;
  xpAmount: number;
  category: string;
  prompt: string;
  placeholder: string;
  needsCounterparty?: boolean;
  badgeOnly?: boolean;
};

type RelatedUserOption = {
  id: string;
  label: string;
};

type ClaimFormProps = {
  instructorId: string;
  returnTo: string;
  mentorName?: string | null;
  templates: ClaimTemplate[];
  relatedUserOptions: RelatedUserOption[];
};

export function InstructorGrowthClaimForm({
  instructorId,
  returnTo,
  mentorName,
  templates,
  relatedUserOptions,
}: ClaimFormProps) {
  const [selectedKey, setSelectedKey] = useState(templates[0]?.eventKey ?? "");
  const selectedTemplate =
    templates.find((template) => template.eventKey === selectedKey) ?? templates[0];

  if (!selectedTemplate) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className={`${styles.claimShell} ${styles.surfaceCard}`}>
      <div className={styles.claimPanelHeader}>
        <div>
          <p className={styles.eyebrow}>Submit A Claim</p>
          <h3 className={styles.sectionTitle} style={{ marginTop: 0 }}>
            Send work to review
          </h3>
          <p className={styles.claimPrompt}>
            Claims stay private and do not count until they are approved.
            {mentorName
              ? ` Your assigned mentor, ${mentorName}, is the default first reviewer.`
              : " Your assigned mentor is the default first reviewer when available."}
          </p>
        </div>
        <span
          className={styles.xpChip}
          style={{
            background: selectedTemplate.badgeOnly ? "#f2f4f7" : "#ede8ff",
            color: selectedTemplate.badgeOnly ? "#475467" : "#5b44b8",
          }}
        >
          {selectedTemplate.badgeOnly
            ? "Badge review"
            : `+${selectedTemplate.xpAmount} XP`}
        </span>
      </div>

      <form action={submitInstructorGrowthClaimAction} className={styles.claimForm}>
        <input type="hidden" name="instructorId" value={instructorId} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Claim type</span>
          <select
            className={styles.select}
            name="eventKey"
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
          >
            {templates.map((template) => (
              <option key={template.eventKey} value={template.eventKey}>
                {template.title}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Date it happened</span>
          <input
            className={styles.input}
            type="date"
            name="claimDate"
            defaultValue={today}
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Category</span>
          <input
            className={styles.input}
            value={selectedTemplate.category}
            readOnly
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Related instructor {selectedTemplate.needsCounterparty ? "(required)" : "(optional)"}
          </span>
          <select
            className={styles.select}
            name="relatedUserId"
            required={Boolean(selectedTemplate.needsCounterparty)}
            defaultValue=""
          >
            <option value="">Select if needed</option>
            {relatedUserOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={`${styles.field} ${styles.fieldFull}`}>
          <span className={styles.fieldLabel}>What happened</span>
          <textarea
            className={styles.textarea}
            name="claimContext"
            placeholder={selectedTemplate.placeholder}
            required
          />
          <span className={styles.fieldHint}>{selectedTemplate.prompt}</span>
        </label>

        <label className={`${styles.field} ${styles.fieldFull}`}>
          <span className={styles.fieldLabel}>Evidence link (optional)</span>
          <input
            className={styles.input}
            type="url"
            name="evidenceUrl"
            placeholder="https://..."
          />
          <span className={styles.fieldHint}>
            Add a doc, reflection link, resource link, or any portal URL that helps the reviewer verify the claim.
          </span>
        </label>

        <div className={`${styles.fieldFull} ${styles.buttonRow}`}>
          <span className={styles.fieldHint}>
            Approved claims count immediately. Rejected claims stay on record for audit visibility but do not add XP.
          </span>
          <button type="submit" className={styles.primaryButton}>
            Submit for review
          </button>
        </div>
      </form>
    </div>
  );
}
