"use client";

import { useFormStatus } from "react-dom";
import { useId, useState } from "react";
import { RoleType } from "@prisma/client";
import { useRouter } from "next/navigation";

import { createUser } from "@/lib/admin-actions";
import {
  ADMIN_SUBTYPE_LABELS,
  ADMIN_SUBTYPE_VALUES,
} from "@/lib/admin-subtypes";
import { formatAccessLabel } from "@/lib/admin-user-access";
import { INSTRUCTION_TITLES, LEADERSHIP_TITLES } from "@/lib/org/levels";
import { Button, ModalFooterV2, ModalV2 } from "@/components/ui-v2";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="md" disabled={pending}>
      {pending ? "Creating…" : "Create user"}
    </Button>
  );
}

const inputClass =
  "mt-1 w-full rounded-[9px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";

export function AdminCreateUser({
  chapters,
}: {
  chapters: Array<{ id: string; name: string }>;
  compact?: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    try {
      await createUser(formData);
      setSuccess(true);
      const form = document.getElementById(
        "admin-create-user-form"
      ) as HTMLFormElement | null;
      form?.reset();
      router.refresh();
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
        setShowAdvanced(false);
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create user.");
    }
  }

  function close() {
    setOpen(false);
    setError(null);
    setShowAdvanced(false);
  }

  return (
    <>
      <Button type="button" variant="primary" size="md" onClick={() => setOpen(true)}>
        + New user
      </Button>

      <ModalV2 open={open} onClose={close} labelledBy={titleId} size="lg">
        <div>
          <h2 id={titleId} className="m-0 text-[20px] font-bold tracking-[-0.01em] text-ink">
            New user
          </h2>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            They get a login and can sign in right away.
          </p>
        </div>

        {error ? (
          <p
            className="m-0 rounded-[8px] border border-danger-200 bg-danger-50 px-3 py-2 text-[13px] text-danger-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <p
            className="m-0 rounded-[8px] border border-complete-200 bg-complete-50 px-3 py-2 text-[13px] text-complete-800"
            role="status"
          >
            User created.
          </p>
        ) : null}

        <form id="admin-create-user-form" action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[13px] font-medium text-ink">
            Name
            <input className={inputClass} name="name" required autoComplete="off" />
          </label>
          <label className="block text-[13px] font-medium text-ink">
            Email
            <input className={inputClass} name="email" type="email" required autoComplete="off" />
          </label>
          <label className="block text-[13px] font-medium text-ink">
            Password
            <input
              className={inputClass}
              name="password"
              type="password"
              required
              autoComplete="new-password"
            />
          </label>
          <label className="block text-[13px] font-medium text-ink">
            Phone <span className="font-normal text-ink-muted">(optional)</span>
            <input className={inputClass} name="phone" autoComplete="off" />
          </label>
          <label className="block text-[13px] font-medium text-ink">
            Role
            <select className={inputClass} name="primaryRole" defaultValue={RoleType.STUDENT}>
              {Object.values(RoleType).map((role) => (
                <option key={role} value={role}>
                  {formatAccessLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-medium text-ink">
            Chapter
            <select className={inputClass} name="chapterId" defaultValue="">
              <option value="">No chapter</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-medium text-ink sm:col-span-2">
            Grade <span className="font-normal text-ink-muted">(optional)</span>
            <select className={inputClass} name="canonicalTitle" defaultValue="">
              <option value="">Set from role</option>
              <optgroup label="Instruction">
                {INSTRUCTION_TITLES.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Leadership">
                {LEADERSHIP_TITLES.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <div className="sm:col-span-2">
            <button
              type="button"
              className="text-[13px] font-medium text-brand-700 hover:underline"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Hide extra options" : "More options"}
            </button>
          </div>

          {showAdvanced ? (
            <>
              <fieldset className="sm:col-span-2">
                <legend className="text-[13px] font-medium text-ink">Extra roles</legend>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  {Object.values(RoleType).map((role) => (
                    <label
                      key={role}
                      className="inline-flex items-center gap-2 text-[13px] text-ink"
                    >
                      <input type="checkbox" name="roles" value={role} className="h-4 w-4" />
                      {formatAccessLabel(role)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="sm:col-span-2">
                <legend className="text-[13px] font-medium text-ink">Admin access</legend>
                <p className="m-0 mt-1 text-[12px] text-ink-muted">
                  Picking any of these also gives the Admin role.
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  {ADMIN_SUBTYPE_VALUES.map((subtype) => (
                    <label
                      key={subtype}
                      className="inline-flex items-center gap-2 text-[13px] text-ink"
                    >
                      <input
                        type="checkbox"
                        name="adminSubtypes"
                        value={subtype}
                        className="h-4 w-4"
                      />
                      {ADMIN_SUBTYPE_LABELS[subtype] ?? subtype}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}

          <ModalFooterV2 className="sm:col-span-2 !mt-1 !border-0 !px-0 !pb-0">
            <Button type="button" variant="ghost" size="md" onClick={close}>
              Cancel
            </Button>
            <SubmitButton />
          </ModalFooterV2>
        </form>
      </ModalV2>
    </>
  );
}
