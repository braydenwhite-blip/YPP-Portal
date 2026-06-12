import {
  addPartnerAgreement,
  addPartnerAgreementCondition,
  addPartnerContact,
  addPartnerRequest,
  removePartnerContact,
  setPrimaryPartnerContact,
  updatePartnerAgreementStatus,
  updatePartnerConditionStatus,
  updatePartnerRequestStatus,
} from "@/lib/partner-relations-actions";
import {
  PARTNER_AGREEMENT_KIND_LABELS,
  PARTNER_AGREEMENT_KINDS,
  PARTNER_AGREEMENT_STATUS_LABELS,
  PARTNER_AGREEMENT_STATUSES,
  PARTNER_CONDITION_STATUS_LABELS,
  PARTNER_CONDITION_STATUSES,
  PARTNER_CONTACT_ROLE_LABELS,
  PARTNER_CONTACT_ROLES,
  PARTNER_REQUEST_OPEN_STATUSES,
  PARTNER_REQUEST_STATUS_LABELS,
  PARTNER_REQUEST_STATUSES,
} from "@/lib/partners-constants";
import type { PartnerRelations } from "@/lib/partners-queries";

/**
 * Partner relationship operations panel — the management UI for the
 * Knowledge OS V2 models (contacts, requests, agreements & conditions) on
 * the partner profile. Server component: plain forms posting to the
 * lib/partner-relations-actions server actions; Tailwind-only styling inside
 * its own subtree (hybrid rule: new features on legacy pages may use
 * utilities, never globals.css additions).
 */

type LeadOption = { id: string; name: string | null; email: string };

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const inputClass =
  "w-full rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-muted/60 focus:border-brand-500 focus:outline-none";
const labelClass = "text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted";
const smallButtonClass =
  "inline-flex cursor-pointer items-center justify-center rounded-[8px] border border-line bg-surface px-2.5 py-1 text-[12px] font-semibold text-brand-800 transition-colors hover:border-brand-400 hover:bg-brand-50";
const primaryButtonClass =
  "inline-flex cursor-pointer items-center justify-center rounded-[8px] border border-transparent bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700";
const chipClass =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em]";

function RequestStatusChip({ status }: { status: string }) {
  const open = (PARTNER_REQUEST_OPEN_STATUSES as readonly string[]).includes(status);
  return (
    <span
      className={`${chipClass} ${open ? "bg-warning-100 text-warning-700" : "bg-brand-50 text-brand-800"}`}
    >
      {PARTNER_REQUEST_STATUS_LABELS[status as keyof typeof PARTNER_REQUEST_STATUS_LABELS] ??
        status}
    </span>
  );
}

export function PartnerRelationsPanel({
  partnerId,
  relations,
  leads,
  ownerNames,
}: {
  partnerId: string;
  relations: PartnerRelations;
  leads: LeadOption[];
  /** Resolved display names for FK-less request ownerIds. */
  ownerNames: Map<string, string>;
}) {
  const { contacts, requests, agreements } = relations;
  const openRequests = requests.filter((r) =>
    (PARTNER_REQUEST_OPEN_STATUSES as readonly string[]).includes(r.status)
  );
  const closedRequests = requests.filter(
    (r) => !(PARTNER_REQUEST_OPEN_STATUSES as readonly string[]).includes(r.status)
  );

  return (
    <section id="relationship-ops" className="card">
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Relationship operations
      </h2>
      <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
        Structured contacts, requests, and agreements — what this partner asked for and
        where each commitment stands.
      </p>

      {/* ---- Contacts ---- */}
      <div className="mt-4">
        <h3 className="m-0 text-[14px] font-bold text-ink">
          Contacts {contacts.length > 0 ? `(${contacts.length})` : ""}
        </h3>
        {contacts.length === 0 ? (
          <p className="m-0 mt-1.5 text-[12.5px] text-ink-muted">
            No structured contacts yet — add the people you actually talk to. The first
            primary contact replaces the free-text contact fields everywhere.
          </p>
        ) : (
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line-soft px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="m-0 flex items-center gap-2 text-[13px] font-semibold text-ink">
                    {contact.name}
                    {contact.isPrimary ? (
                      <span className={`${chipClass} bg-brand-100 text-brand-700`}>Primary</span>
                    ) : null}
                    {contact.role ? (
                      <span className="text-[11.5px] font-medium normal-case text-ink-muted">
                        {PARTNER_CONTACT_ROLE_LABELS[
                          contact.role as keyof typeof PARTNER_CONTACT_ROLE_LABELS
                        ] ?? contact.role}
                      </span>
                    ) : null}
                  </p>
                  <p className="m-0 text-[12px] text-ink-muted">
                    {[contact.title, contact.email, contact.phone].filter(Boolean).join(" · ") ||
                      "No details"}
                  </p>
                </div>
                {!contact.isPrimary ? (
                  <form action={setPrimaryPartnerContact}>
                    <input type="hidden" name="contactId" value={contact.id} />
                    <button type="submit" className={smallButtonClass}>
                      Make primary
                    </button>
                  </form>
                ) : null}
                <form action={removePartnerContact}>
                  <input type="hidden" name="contactId" value={contact.id} />
                  <button
                    type="submit"
                    className={`${smallButtonClass} border-danger-100 text-danger-700 hover:border-danger-700/40 hover:bg-danger-100/40`}
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <details className="mt-2">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-brand-700">
            + Add contact
          </summary>
          <form action={addPartnerContact} className="mt-2 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="partnerId" value={partnerId} />
            <div>
              <label className={labelClass}>Name *</label>
              <input type="text" name="name" required maxLength={120} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Title</label>
              <input type="text" name="title" maxLength={120} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" name="email" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input type="tel" name="phone" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select name="role" defaultValue="" className={inputClass}>
                <option value="">— Role —</option>
                {PARTNER_CONTACT_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {PARTNER_CONTACT_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-end gap-2 pb-1.5 text-[12.5px] font-medium text-ink">
              <input type="checkbox" name="isPrimary" /> Primary contact
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className={primaryButtonClass}>
                Add contact
              </button>
            </div>
          </form>
        </details>
      </div>

      {/* ---- Requests ---- */}
      <div className="mt-5 border-t border-line-soft pt-4">
        <h3 className="m-0 text-[14px] font-bold text-ink">
          Requests {openRequests.length > 0 ? `(${openRequests.length} open)` : ""}
        </h3>
        {requests.length === 0 ? (
          <p className="m-0 mt-1.5 text-[12.5px] text-ink-muted">
            No requests logged. When this partner asks for something — instructors, a
            program, dates — log it here so the ask has an owner and a status.
          </p>
        ) : (
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {[...openRequests, ...closedRequests].map((request) => (
              <li
                key={request.id}
                className="rounded-[10px] border border-line-soft px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="m-0 min-w-0 flex-1 text-[13px] font-semibold text-ink">
                    {request.title}
                  </p>
                  <RequestStatusChip status={request.status} />
                </div>
                <p className="m-0 mt-0.5 text-[12px] text-ink-muted">
                  {[
                    request.ownerId
                      ? `Owner: ${ownerNames.get(request.ownerId) ?? "Unknown"}`
                      : "No owner",
                    request.dueAt ? `Due ${fmtDate(request.dueAt)}` : null,
                    request.resolvedAt ? `Resolved ${fmtDate(request.resolvedAt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {request.details ? (
                  <p className="m-0 mt-1 whitespace-pre-wrap text-[12.5px] text-ink">
                    {request.details}
                  </p>
                ) : null}
                <form
                  action={updatePartnerRequestStatus}
                  className="mt-1.5 flex items-center gap-2"
                >
                  <input type="hidden" name="requestId" value={request.id} />
                  <select name="status" defaultValue={request.status} className={`${inputClass} w-auto`}>
                    {PARTNER_REQUEST_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {PARTNER_REQUEST_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={smallButtonClass}>
                    Update
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <details className="mt-2">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-brand-700">
            + Log request
          </summary>
          <form action={addPartnerRequest} className="mt-2 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="partnerId" value={partnerId} />
            <div className="sm:col-span-2">
              <label className={labelClass}>What are they asking for? *</label>
              <input
                type="text"
                name="title"
                required
                maxLength={160}
                placeholder="3 instructors for summer camp"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Details</label>
              <textarea name="details" rows={2} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Due date</label>
              <input type="date" name="dueAt" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Owner</label>
              <select name="ownerId" defaultValue="" className={inputClass}>
                <option value="">— No owner yet —</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name || lead.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className={primaryButtonClass}>
                Log request
              </button>
            </div>
          </form>
        </details>
      </div>

      {/* ---- Agreements ---- */}
      <div className="mt-5 border-t border-line-soft pt-4">
        <h3 className="m-0 text-[14px] font-bold text-ink">
          Agreements {agreements.length > 0 ? `(${agreements.length})` : ""}
        </h3>
        {agreements.length === 0 ? (
          <p className="m-0 mt-1.5 text-[12.5px] text-ink-muted">
            No MOUs, contracts, or informal agreements tracked yet.
          </p>
        ) : (
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {agreements.map((agreement) => {
              const pending = agreement.conditions.filter((c) => c.status === "PENDING").length;
              return (
                <li
                  key={agreement.id}
                  className="rounded-[10px] border border-line-soft px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="m-0 min-w-0 flex-1 text-[13px] font-semibold text-ink">
                      {agreement.title}
                    </p>
                    <span className={`${chipClass} bg-brand-50 text-brand-800`}>
                      {PARTNER_AGREEMENT_KIND_LABELS[
                        agreement.kind as keyof typeof PARTNER_AGREEMENT_KIND_LABELS
                      ] ?? agreement.kind}
                    </span>
                    <span
                      className={`${chipClass} ${
                        agreement.status === "SIGNED"
                          ? "bg-success-100 text-success-700"
                          : "bg-brand-50 text-brand-800"
                      }`}
                    >
                      {PARTNER_AGREEMENT_STATUS_LABELS[
                        agreement.status as keyof typeof PARTNER_AGREEMENT_STATUS_LABELS
                      ] ?? agreement.status}
                    </span>
                  </div>
                  <p className="m-0 mt-0.5 text-[12px] text-ink-muted">
                    {[
                      agreement.effectiveAt ? `Effective ${fmtDate(agreement.effectiveAt)}` : null,
                      agreement.expiresAt ? `Expires ${fmtDate(agreement.expiresAt)}` : null,
                      pending > 0
                        ? `${pending} condition${pending === 1 ? "" : "s"} pending`
                        : agreement.conditions.length > 0
                          ? "All conditions resolved"
                          : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No dates set"}
                  </p>

                  {agreement.conditions.length > 0 ? (
                    <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                      {agreement.conditions.map((condition) => (
                        <li
                          key={condition.id}
                          className="flex flex-wrap items-center gap-2 rounded-[8px] bg-surface-soft px-2.5 py-1.5"
                        >
                          <p className="m-0 min-w-0 flex-1 text-[12.5px] text-ink">
                            {condition.description}
                            {condition.dueAt ? (
                              <span className="text-ink-muted"> · due {fmtDate(condition.dueAt)}</span>
                            ) : null}
                          </p>
                          <form
                            action={updatePartnerConditionStatus}
                            className="flex items-center gap-1.5"
                          >
                            <input type="hidden" name="conditionId" value={condition.id} />
                            <select
                              name="status"
                              defaultValue={condition.status}
                              className={`${inputClass} w-auto py-1 text-[12px]`}
                            >
                              {PARTNER_CONDITION_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {PARTNER_CONDITION_STATUS_LABELS[status]}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className={smallButtonClass}>
                              Set
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <form action={updatePartnerAgreementStatus} className="flex items-center gap-1.5">
                      <input type="hidden" name="agreementId" value={agreement.id} />
                      <select
                        name="status"
                        defaultValue={agreement.status}
                        className={`${inputClass} w-auto py-1 text-[12px]`}
                      >
                        {PARTNER_AGREEMENT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {PARTNER_AGREEMENT_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={smallButtonClass}>
                        Update status
                      </button>
                    </form>
                    <details>
                      <summary className="cursor-pointer text-[12px] font-semibold text-brand-700">
                        + Add condition
                      </summary>
                      <form
                        action={addPartnerAgreementCondition}
                        className="mt-1.5 flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="agreementId" value={agreement.id} />
                        <div className="min-w-52 flex-1">
                          <label className={labelClass}>Condition *</label>
                          <input
                            type="text"
                            name="description"
                            required
                            maxLength={300}
                            placeholder="Background checks for all instructors"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Due</label>
                          <input type="date" name="dueAt" className={inputClass} />
                        </div>
                        <button type="submit" className={smallButtonClass}>
                          Add
                        </button>
                      </form>
                    </details>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <details className="mt-2">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-brand-700">
            + Add agreement
          </summary>
          <form action={addPartnerAgreement} className="mt-2 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="partnerId" value={partnerId} />
            <div className="sm:col-span-2">
              <label className={labelClass}>Title *</label>
              <input
                type="text"
                name="title"
                required
                maxLength={160}
                placeholder="Summer 2026 program MOU"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Kind</label>
              <select name="kind" defaultValue="MOU" className={inputClass}>
                {PARTNER_AGREEMENT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {PARTNER_AGREEMENT_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" defaultValue="DRAFT" className={inputClass}>
                {PARTNER_AGREEMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PARTNER_AGREEMENT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Effective</label>
              <input type="date" name="effectiveAt" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Expires</label>
              <input type="date" name="expiresAt" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Terms (summary)</label>
              <textarea name="terms" rows={2} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className={primaryButtonClass}>
                Add agreement
              </button>
            </div>
          </form>
        </details>
      </div>
    </section>
  );
}
