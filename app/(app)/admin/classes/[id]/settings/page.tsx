import Link from "next/link";

import {
  adminReassignInstructor,
  adminUpdateCapacity,
  adminUpdateLogistics,
} from "@/lib/admin-class-operations";
import { listPartnerOptions } from "@/lib/partners-queries";
import { setClassPartner } from "@/lib/partners-actions";
import { Button, RecordSection } from "@/components/ui-v2";
import { inputClass } from "../_components/publish-controls";
import { loadClassAdminDetail } from "../_components/loaders";

export const dynamic = "force-dynamic";

export default async function AdminClassSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, partnerOptions] = await Promise.all([
    loadClassAdminDetail(id),
    listPartnerOptions(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <RecordSection
        title="Capacity"
        description={`${detail.confirmedCount} confirmed · ${detail.waitlistedCount} waitlisted`}
      >
        <form action={adminUpdateCapacity} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="offeringId" value={detail.id} />
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-muted">
            Max seats
            <input
              type="number"
              name="capacity"
              min={1}
              defaultValue={detail.capacity}
              className={`${inputClass} w-28`}
            />
          </label>
          <Button type="submit" variant="secondary" size="sm">
            Save
          </Button>
        </form>
      </RecordSection>

      <RecordSection
        title="Logistics"
        description="Room, arrival instructions, and materials families see."
      >
        <form action={adminUpdateLogistics} className="flex flex-col gap-3">
          <input type="hidden" name="offeringId" value={detail.id} />
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-muted">
            Room
            <input
              name="room"
              defaultValue={detail.room ?? ""}
              placeholder="Studio B"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-muted">
            Arrival instructions
            <textarea
              name="arrivalInstructions"
              rows={3}
              defaultValue={detail.arrivalInstructions ?? ""}
              placeholder="Enter through the side gate and sign in at the desk."
              className={`${inputClass} min-h-[80px] py-2`}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-muted">
            Materials (one per line)
            <textarea
              name="materialsList"
              rows={3}
              defaultValue={(detail.materialsList ?? []).join("\n")}
              placeholder={"Sketchbook\nPencils"}
              className={`${inputClass} min-h-[80px] py-2`}
            />
          </label>
          <Button type="submit" variant="secondary" size="sm" className="self-start">
            Save logistics
          </Button>
        </form>
      </RecordSection>

      <RecordSection title="Instructor" description={detail.instructor.email}>
        <p className="m-0 text-[14px] font-semibold text-ink">
          {detail.instructor.name}
        </p>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          {detail.chapter?.name ?? "No chapter assigned"}
        </p>
        <details className="mt-4 rounded-[10px] border border-line-soft bg-surface-soft/60 px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-ink">
            Reassign instructor (advanced)
          </summary>
          <form action={adminReassignInstructor} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="offeringId" value={detail.id} />
            <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[12px] font-medium text-ink-muted">
              New instructor user ID
              <input
                name="instructorId"
                placeholder="user_..."
                className={`${inputClass} font-mono text-[12px]`}
              />
            </label>
            <Button type="submit" variant="ghost" size="sm">
              Reassign
            </Button>
          </form>
          <p className="mb-0 mt-2 text-[12px] text-ink-muted">
            Only use when the original instructor is unreachable. The new user must
            have the Instructor role.
          </p>
        </details>
      </RecordSection>

      <RecordSection title="Partner">
        {detail.partner ? (
          <p className="m-0 text-[14px] font-semibold text-ink">{detail.partner.name}</p>
        ) : (
          <p className="m-0 text-[13px] text-ink-muted">No partner assigned.</p>
        )}
        <form action={setClassPartner} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="offeringId" value={detail.id} />
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[12px] font-medium text-ink-muted">
            Partner
            <select
              name="partnerId"
              defaultValue={detail.partner?.id ?? ""}
              className={inputClass}
            >
              <option value="">No partner</option>
              {partnerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary" size="sm">
            Save
          </Button>
        </form>
        <p className="mb-0 mt-2 text-[12px] text-ink-muted">
          Manage partners in{" "}
          <Link href="/admin/partners" className="font-semibold text-brand-700">
            Admin · Partners
          </Link>
          .
        </p>
      </RecordSection>
    </div>
  );
}
