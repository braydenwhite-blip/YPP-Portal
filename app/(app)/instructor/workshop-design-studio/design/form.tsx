"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  type CustomWorkshopPayload,
  EMPTY_CUSTOM_WORKSHOP,
  MAX_WORKSHOP_CAPACITY,
  MIN_WORKSHOP_CAPACITY,
  WORKSHOP_FORMATS,
  workshopFormatLabel,
} from "@/lib/workshop-proposal-constants";
import { customWorkshopIssues } from "@/lib/workshop-proposal-validation";
import { saveCustomWorkshopDraft } from "@/lib/workshop-proposal-actions";

type CustomWorkshopFormProps = {
  initial: CustomWorkshopPayload;
  editable: boolean;
};

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function CustomWorkshopForm({
  initial,
  editable,
}: CustomWorkshopFormProps) {
  const [payload, setPayload] = useState<CustomWorkshopPayload>(() =>
    initial.title || initial.targetAgeGroup ? initial : { ...EMPTY_CUSTOM_WORKSHOP }
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const lastSavedSig = useRef<string>(JSON.stringify(initial));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const issues = useMemo(() => customWorkshopIssues(payload), [payload]);

  // Autosave on debounce when the payload changes.
  useEffect(() => {
    if (!editable) return;
    const sig = JSON.stringify(payload);
    if (sig === lastSavedSig.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("title", payload.title);
      fd.set("targetAgeGroup", payload.targetAgeGroup);
      fd.set("lengthMinutes", String(payload.lengthMinutes || ""));
      fd.set("category", payload.category);
      fd.set("learningObjective", payload.learningObjective);
      fd.set("materials", payload.materials.join("\n"));
      fd.set("openingHook", payload.openingHook);
      fd.set("mainActivity", payload.mainActivity);
      fd.set("participationPlan", payload.participationPlan);
      fd.set("wrapUp", payload.wrapUp);
      fd.set("backupPlan", payload.backupPlan);
      fd.set("format", payload.format);
      fd.set("locationNotes", payload.locationNotes);
      fd.set("capacity", String(payload.capacity || ""));
      fd.set("availability", payload.availability);
      fd.set("safetyNotes", payload.safetyNotes);
      startTransition(async () => {
        try {
          await saveCustomWorkshopDraft(fd);
          lastSavedSig.current = sig;
          setSavedAt(new Date());
          setSaveError(null);
        } catch (err) {
          setSaveError(err instanceof Error ? err.message : "Save failed.");
        }
      });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [payload, editable]);

  function patch<K extends keyof CustomWorkshopPayload>(
    key: K,
    value: CustomWorkshopPayload[K]
  ) {
    setPayload((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 24 }}>
      <div className="card" style={{ display: "grid", gap: 16 }}>
        <Field label="Workshop title" hint="One sentence — what's it called?">
          <input
            type="text"
            className="input"
            value={payload.title}
            disabled={!editable}
            onChange={(e) => patch("title", e.target.value)}
            placeholder="e.g. Build a Paper-Bridge"
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Target age group" hint="e.g. Grades 4–6, Ages 10–12">
            <input
              type="text"
              className="input"
              value={payload.targetAgeGroup}
              disabled={!editable}
              onChange={(e) => patch("targetAgeGroup", e.target.value)}
            />
          </Field>
          <Field label="Length (minutes)">
            <input
              type="number"
              min={15}
              max={240}
              className="input"
              value={payload.lengthMinutes || ""}
              disabled={!editable}
              onChange={(e) => patch("lengthMinutes", Number(e.target.value) || 0)}
              placeholder="e.g. 60"
            />
          </Field>
        </div>

        <Field label="Topic / category" hint="e.g. STEM, Writing, Computer Science, Music">
          <input
            type="text"
            className="input"
            value={payload.category}
            disabled={!editable}
            onChange={(e) => patch("category", e.target.value)}
          />
        </Field>

        <Field
          label="Learning objective"
          hint="Finish this sentence: 'By the end of the workshop, students will be able to…'. Be concrete."
        >
          <textarea
            className="input"
            rows={3}
            value={payload.learningObjective}
            disabled={!editable}
            onChange={(e) => patch("learningObjective", e.target.value)}
          />
        </Field>

        <Field
          label="Materials needed"
          hint="One item per line. Quantities help."
        >
          <textarea
            className="input"
            rows={4}
            value={payload.materials.join("\n")}
            disabled={!editable}
            onChange={(e) =>
              patch(
                "materials",
                e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
            placeholder={"Cardstock paper (10 sheets per pair)\nTape\nScissors"}
          />
        </Field>

        <Field
          label="Opening hook"
          hint="The first 5 minutes — how do you grab attention?"
        >
          <textarea
            className="input"
            rows={3}
            value={payload.openingHook}
            disabled={!editable}
            onChange={(e) => patch("openingHook", e.target.value)}
          />
        </Field>

        <Field
          label="Main activity"
          hint="Step-by-step — what students actually do. Specifics beat generality."
        >
          <textarea
            className="input"
            rows={6}
            value={payload.mainActivity}
            disabled={!editable}
            onChange={(e) => patch("mainActivity", e.target.value)}
          />
        </Field>

        <Field
          label="Student participation plan"
          hint="How everyone in the room participates — pairs, small groups, calls on names?"
        >
          <textarea
            className="input"
            rows={3}
            value={payload.participationPlan}
            disabled={!editable}
            onChange={(e) => patch("participationPlan", e.target.value)}
          />
        </Field>

        <Field
          label="Wrap-up / takeaway"
          hint="The last few minutes — what should students leave with?"
        >
          <textarea
            className="input"
            rows={3}
            value={payload.wrapUp}
            disabled={!editable}
            onChange={(e) => patch("wrapUp", e.target.value)}
          />
        </Field>

        <Field
          label="Backup plan"
          hint="What do you do if the room is quiet, confused, or moving too fast?"
        >
          <textarea
            className="input"
            rows={3}
            value={payload.backupPlan}
            disabled={!editable}
            onChange={(e) => patch("backupPlan", e.target.value)}
          />
        </Field>

        <div
          style={{
            marginTop: 8,
            paddingTop: 16,
            borderTop: "1px dashed var(--border)",
            display: "grid",
            gap: 16,
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Logistics</h3>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--muted)",
                lineHeight: 1.5,
              }}
            >
              Where this would actually happen. Most Summer Workshops are
              in person, so reviewers want to see you&rsquo;ve thought through
              the room, the group size, and safety.
            </p>
          </div>

          <Field
            label="Workshop format"
            hint="Pick one. Most Summer Workshops are in person."
          >
            <select
              className="input"
              value={payload.format}
              disabled={!editable}
              onChange={(e) =>
                patch(
                  "format",
                  (e.target.value as CustomWorkshopPayload["format"]) || ""
                )
              }
            >
              <option value="">Choose a format…</option>
              {WORKSHOP_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {workshopFormatLabel(f)}
                </option>
              ))}
            </select>
          </Field>

          {payload.format === "VIRTUAL" ? null : (
            <Field
              label="Location"
              hint="Where would you run this? Be specific — venue, room, indoor/outdoor."
            >
              <textarea
                className="input"
                rows={2}
                value={payload.locationNotes}
                disabled={!editable}
                onChange={(e) => patch("locationNotes", e.target.value)}
                placeholder="e.g. Roosevelt Middle School cafeteria, Brooklyn — or your nearest YPP chapter space"
              />
            </Field>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field
              label="Capacity"
              hint={`Max students per session (${MIN_WORKSHOP_CAPACITY}–${MAX_WORKSHOP_CAPACITY}).`}
            >
              <input
                type="number"
                min={MIN_WORKSHOP_CAPACITY}
                max={MAX_WORKSHOP_CAPACITY}
                className="input"
                value={payload.capacity || ""}
                disabled={!editable}
                onChange={(e) =>
                  patch("capacity", Number(e.target.value) || 0)
                }
                placeholder="e.g. 12"
              />
            </Field>
            <Field
              label="Availability"
              hint="Dates or windows you can run it (e.g. 'Saturdays in July')."
            >
              <input
                type="text"
                className="input"
                value={payload.availability}
                disabled={!editable}
                onChange={(e) => patch("availability", e.target.value)}
                placeholder="Saturdays in July 2026"
              />
            </Field>
          </div>

          {payload.format === "VIRTUAL" ? null : (
            <Field
              label="Safety & supervision notes"
              hint="Anything sharp, hot, allergenic, or messy? Adult supervision plan? Emergency exit?"
            >
              <textarea
                className="input"
                rows={3}
                value={payload.safetyNotes}
                disabled={!editable}
                onChange={(e) => patch("safetyNotes", e.target.value)}
                placeholder="Scissors used in pairs, supervised. Snack break is nut-free. One adult chaperone in the room at all times."
              />
            </Field>
          )}
        </div>
      </div>

      <aside style={{ position: "sticky", top: 16, alignSelf: "start" }}>
        <div className="card" style={{ marginBottom: 12 }}>
          <h4 style={{ marginTop: 0 }}>
            {issues.length === 0 ? "Looks ready" : `${issues.length} item${issues.length === 1 ? "" : "s"} to finish`}
          </h4>
          {issues.length === 0 ? (
            <p style={{ fontSize: 13, color: "#16a34a", margin: 0 }}>
              Every required field looks good. Head to the review &amp; submit
              page when you&rsquo;re ready.
            </p>
          ) : (
            <ul style={{ paddingLeft: 18, fontSize: 13, color: "#b45309", lineHeight: 1.6 }}>
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          <Link
            href="/instructor/workshop-design-studio/review"
            className="button small"
            style={{ marginTop: 12, textDecoration: "none", display: "inline-block" }}
          >
            Open review &amp; submit
          </Link>
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0, fontSize: 13 }}>Save status</h4>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            {!editable
              ? "Locked — submission in review."
              : isPending
                ? "Saving…"
                : savedAt
                  ? `Last saved ${savedAt.toLocaleTimeString()}`
                  : "Autosaves while you type."}
          </p>
          {saveError ? (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626" }}>
              {saveError}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {hint ? (
        <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
          {hint}
        </span>
      ) : null}
      {children}
    </label>
  );
}
