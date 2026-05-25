/**
 * Shared opportunity create/edit form. Submits to a server action passed in
 * by the parent page so the same UI can power /new and /[id]/edit later.
 */

type Chapter = { id: string; name: string; region: string | null };

type Opportunity = {
  id?: string;
  title?: string;
  partnerName?: string | null;
  type?: string;
  status?: string;
  urgency?: string;
  deliveryMode?: string;
  description?: string | null;
  locationName?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  locationCountry?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  fillByDate?: Date | null;
  slotsNeeded?: number;
  ageGroup?: string | null;
  topicTags?: string[];
  chapterId?: string | null;
  ownerId?: string | null;
  partnerContactName?: string | null;
  partnerContactEmail?: string | null;
  partnerContactPhone?: string | null;
  internalNotes?: string | null;
};

function toDateInput(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default function OpportunityForm({
  action,
  chapters,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void> | void;
  chapters: Chapter[];
  initial?: Opportunity;
  submitLabel: string;
}) {
  const op: Opportunity = initial ?? {};

  return (
    <form action={action} className="card" style={{ padding: 24 }}>
      {op.id && <input type="hidden" name="opportunityId" value={op.id} />}

      <h2 style={sectionStyle}>Program basics</h2>
      <div className="grid two">
        <Field label="Title *">
          <input
            name="title"
            required
            defaultValue={op.title ?? ""}
            placeholder="Summer of Physics — Cohort A"
            style={inputStyle}
          />
        </Field>
        <Field label="Partner / camp">
          <input
            name="partnerName"
            defaultValue={op.partnerName ?? ""}
            placeholder="Lincoln Summer Academy"
            style={inputStyle}
          />
        </Field>

        <Field label="Type">
          <select name="type" defaultValue={op.type ?? "PARTNER_PROGRAM"} style={inputStyle}>
            <option value="PARTNER_PROGRAM">Partner program</option>
            <option value="SUMMER_CAMP">Summer camp</option>
            <option value="ONE_TIME_WORKSHOP">One-time workshop</option>
            <option value="MULTI_DAY_CAMP">Multi-day camp</option>
            <option value="CHAPTER_CLASS_SERIES">Chapter class series</option>
            <option value="ONLINE_WORKSHOP">Online workshop</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Delivery mode">
          <select name="deliveryMode" defaultValue={op.deliveryMode ?? "IN_PERSON"} style={inputStyle}>
            <option value="IN_PERSON">In-person</option>
            <option value="VIRTUAL">Virtual</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </Field>

        <Field label="Status">
          <select name="status" defaultValue={op.status ?? "OPEN"} style={inputStyle}>
            <option value="DRAFT">Draft</option>
            <option value="OPEN">Open</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </Field>
        <Field label="Urgency">
          <select name="urgency" defaultValue={op.urgency ?? "NORMAL"} style={inputStyle}>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </Field>
      </div>

      <Field label="Description / what this is">
        <textarea
          name="description"
          rows={3}
          defaultValue={op.description ?? ""}
          placeholder="One-paragraph summary for the admin team."
          style={{ ...inputStyle, fontFamily: "inherit" }}
        />
      </Field>

      <h2 style={sectionStyle}>Location & dates</h2>
      <div className="grid two">
        <Field label="Location name">
          <input name="locationName" defaultValue={op.locationName ?? ""} style={inputStyle} />
        </Field>
        <Field label="City">
          <input name="locationCity" defaultValue={op.locationCity ?? ""} style={inputStyle} />
        </Field>
        <Field label="State / region">
          <input name="locationState" defaultValue={op.locationState ?? ""} style={inputStyle} />
        </Field>
        <Field label="Country">
          <input name="locationCountry" defaultValue={op.locationCountry ?? ""} style={inputStyle} />
        </Field>
        <Field label="Start date">
          <input type="date" name="startDate" defaultValue={toDateInput(op.startDate)} style={inputStyle} />
        </Field>
        <Field label="End date">
          <input type="date" name="endDate" defaultValue={toDateInput(op.endDate)} style={inputStyle} />
        </Field>
        <Field label="Fill by (deadline)">
          <input type="date" name="fillByDate" defaultValue={toDateInput(op.fillByDate)} style={inputStyle} />
        </Field>
        <Field label="Instructors needed">
          <input
            type="number"
            min={1}
            name="slotsNeeded"
            defaultValue={op.slotsNeeded ?? 1}
            style={inputStyle}
          />
        </Field>
      </div>

      <h2 style={sectionStyle}>Targeting</h2>
      <div className="grid two">
        <Field label="Age group">
          <input
            name="ageGroup"
            defaultValue={op.ageGroup ?? ""}
            placeholder="Grades 6-8"
            style={inputStyle}
          />
        </Field>
        <Field label="Topic tags (comma-separated)">
          <input
            name="topicTags"
            defaultValue={(op.topicTags ?? []).join(", ")}
            placeholder="physics, coding"
            style={inputStyle}
          />
        </Field>
        <Field label="Chapter (optional)">
          <select name="chapterId" defaultValue={op.chapterId ?? ""} style={inputStyle}>
            <option value="">— No chapter —</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.region ? `· ${c.region}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Required teaching level">
          <select name="requiredCourseLevel" defaultValue="" style={inputStyle}>
            <option value="">— Any level —</option>
            <option value="LEVEL_101">Level 101</option>
            <option value="LEVEL_201">Level 201</option>
            <option value="LEVEL_301">Level 301</option>
            <option value="LEVEL_401">Level 401</option>
          </select>
        </Field>
      </div>

      <h2 style={sectionStyle}>Partner contact (admin-private)</h2>
      <div className="grid two">
        <Field label="Contact name">
          <input
            name="partnerContactName"
            defaultValue={op.partnerContactName ?? ""}
            style={inputStyle}
          />
        </Field>
        <Field label="Contact email">
          <input
            type="email"
            name="partnerContactEmail"
            defaultValue={op.partnerContactEmail ?? ""}
            style={inputStyle}
          />
        </Field>
        <Field label="Contact phone">
          <input
            name="partnerContactPhone"
            defaultValue={op.partnerContactPhone ?? ""}
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Internal notes (admin-only)">
        <textarea
          name="internalNotes"
          rows={3}
          defaultValue={op.internalNotes ?? ""}
          placeholder="Why is this urgent? Who's the warm contact?"
          style={{ ...inputStyle, fontFamily: "inherit" }}
        />
      </Field>

      <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
        <button type="submit" className="button">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const sectionStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-secondary)",
  marginTop: 16,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 13,
  background: "white",
  width: "100%",
};
