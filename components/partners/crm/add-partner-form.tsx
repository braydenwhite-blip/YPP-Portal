"use client";

/**
 * Add-partner form (Partner Automation, Phase 1). Manual single-partner add with
 * live duplicate detection against the chapter's existing partners.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, ButtonLink, CardV2, BannerV2, ToastV2, cn } from "@/components/ui-v2";
import { PARTNER_TYPES, PARTNER_TYPE_LABELS } from "@/lib/partners-constants";
import { findLikelyDuplicates, type PartnerIdentity } from "@/lib/partners/duplicate-detection";
import { createChapterPartner } from "@/lib/partners/crm-actions";

const inputCls =
  "w-full rounded-[8px] border border-line-soft bg-surface px-3 py-2 text-[13px] text-ink focus:border-brand-500 focus:outline-none";

export function AddPartnerForm({
  chapterId,
  existing,
}: {
  chapterId: string | null;
  existing: PartnerIdentity[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ tone: "success" | "danger"; msg: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    partnerType: "",
    location: "",
    website: "",
    contactName: "",
    contactTitle: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const duplicates = useMemo(() => {
    if (form.name.trim().length < 3) return [];
    return findLikelyDuplicates(
      { name: form.name, website: form.website, contactEmail: form.contactEmail, location: form.location },
      existing
    );
  }, [form.name, form.website, form.contactEmail, form.location, existing]);

  function submit() {
    if (!form.name.trim()) {
      setToast({ tone: "danger", msg: "Name is required." });
      return;
    }
    startTransition(async () => {
      try {
        const res = await createChapterPartner({
          name: form.name,
          partnerType: form.partnerType || undefined,
          location: form.location || undefined,
          website: form.website || undefined,
          contactName: form.contactName || undefined,
          contactTitle: form.contactTitle || undefined,
          contactEmail: form.contactEmail || undefined,
          contactPhone: form.contactPhone || undefined,
          notes: form.notes || undefined,
          chapterId,
        });
        if (!res.ok) {
          setToast({ tone: "danger", msg: res.error });
          return;
        }
        router.push(res.id ? `/partners/${res.id}` : "/partners");
      } catch {
        setToast({ tone: "danger", msg: "Could not add the partner." });
      }
    });
  }

  return (
    <CardV2 padding="lg" className="flex flex-col gap-4">
      {duplicates.length > 0 && (
        <BannerV2 open tone="warning" title="Possible duplicate">
          This looks like it may already exist: {duplicates.slice(0, 3).map((d) => d.name).join(", ")}.{" "}
          <ButtonLink href={`/partners/${duplicates[0].id}`} variant="ghost" size="sm">Open existing</ButtonLink>
        </BannerV2>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name *" className="sm:col-span-2">
          <input className={inputCls} value={form.name} onChange={set("name")} placeholder="Scarsdale Public Library" maxLength={200} />
        </Field>
        <Field label="Type">
          <select className={inputCls} value={form.partnerType} onChange={set("partnerType")}>
            <option value="">— Select type —</option>
            {PARTNER_TYPES.map((t) => <option key={t} value={t}>{PARTNER_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <Field label="Address / location">
          <input className={inputCls} value={form.location} onChange={set("location")} placeholder="54 Olmsted Rd, Scarsdale, NY" />
        </Field>
        <Field label="Website" className="sm:col-span-2">
          <input className={inputCls} value={form.website} onChange={set("website")} placeholder="https://scarsdalelibrary.org" />
        </Field>
        <Field label="Main contact name">
          <input className={inputCls} value={form.contactName} onChange={set("contactName")} placeholder="Jane Miller" />
        </Field>
        <Field label="Contact title">
          <input className={inputCls} value={form.contactTitle} onChange={set("contactTitle")} placeholder="Youth Services Director" />
        </Field>
        <Field label="Contact email">
          <input className={inputCls} value={form.contactEmail} onChange={set("contactEmail")} placeholder="jmiller@scarsdalelibrary.org" />
        </Field>
        <Field label="Contact phone">
          <input className={inputCls} value={form.contactPhone} onChange={set("contactPhone")} placeholder="(914) 722-1300" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className={`${inputCls} min-h-[70px]`} value={form.notes} onChange={set("notes")} placeholder="Anything useful for outreach…" />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="md" loading={pending} onClick={submit}>Add partner</Button>
        <ButtonLink href="/partners" variant="ghost" size="md">Cancel</ButtonLink>
      </div>
      {toast && <ToastV2 open tone={toast.tone}>{toast.msg}</ToastV2>}
    </CardV2>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[12px] font-semibold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
