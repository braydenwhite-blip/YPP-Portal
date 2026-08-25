"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, ModalFooterV2, ModalV2 } from "@/components/ui-v2";
import { inviteChapterMemberByEmail } from "@/lib/chapter-invite-actions";

type Props = {
  /** Visual style for the trigger button. */
  variant?: "primary" | "secondary";
  /** Optional className on the trigger. */
  className?: string;
  label?: string;
};

export function InviteMemberButton({
  variant = "primary",
  className,
  label = "Invite Members",
}: Props) {
  const titleId = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [sentTo, setSentTo] = useState("");

  function resetFeedback() {
    setError("");
    setWarning("");
    setInviteUrl("");
    setSentTo("");
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
    resetFeedback();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    resetFeedback();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    startTransition(async () => {
      try {
        const result = await inviteChapterMemberByEmail({ name, email });
        setSentTo(email);
        if (!result.emailed) {
          setWarning(result.warning);
          setInviteUrl(result.inviteUrl);
        } else {
          form.reset();
          setOpen(false);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send invite");
      }
    });
  }

  async function copyInviteUrl() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      window.prompt("Copy this invite link:", inviteUrl);
    }
  }

  return (
    <div className={["shrink-0", className].filter(Boolean).join(" ")}>
      <Button
        type="button"
        variant={variant}
        size="md"
        onClick={() => {
          resetFeedback();
          setOpen(true);
        }}
      >
        {label}
      </Button>

      <ModalV2 open={open} onClose={handleClose} labelledBy={titleId} size="md" locked={pending}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <h2 id={titleId} className="m-0 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Invite a member
            </h2>
            <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
              Enter their name and email — we’ll send them a link to join your chapter.
            </p>
          </div>

          {error ? (
            <p
              className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {warning ? (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900"
              role="status"
            >
              <p className="m-0">{warning}</p>
              {inviteUrl ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="break-all text-[12px]">{inviteUrl}</code>
                  <Button type="button" variant="secondary" size="sm" onClick={copyInviteUrl}>
                    Copy link
                  </Button>
                </div>
              ) : null}
              {sentTo ? (
                <p className="m-0 mt-2 text-[12px] text-amber-800">
                  Invite ready for {sentTo}. You can still share the link above.
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">Name</span>
            <input
              required
              name="name"
              autoComplete="name"
              placeholder="Jordan Lee"
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            />
          </label>

          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">Email</span>
            <input
              required
              type="email"
              name="email"
              autoComplete="email"
              placeholder="jordan@email.com"
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            />
          </label>

          <ModalFooterV2>
            <Button type="button" variant="secondary" size="md" onClick={handleClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={pending}>
              {pending ? "Sending…" : "Send invite"}
            </Button>
          </ModalFooterV2>
        </form>
      </ModalV2>
    </div>
  );
}
