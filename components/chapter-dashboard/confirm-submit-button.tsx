"use client";

import { useFormStatus } from "react-dom";

type ButtonProps = React.ComponentProps<"button">;

/**
 * Submit button for server-action forms that asks for confirmation before
 * submitting and reflects the pending state. Use inside a `<form action={...}>`.
 *
 * `formAction`, `name`, and `value` are forwarded so it can drive multi-action
 * forms (e.g. Approve / Reject buttons that share one form).
 */
export function ConfirmSubmitButton({
  confirm,
  children,
  pendingText,
  className = "button",
  formAction,
  name,
  value,
}: {
  confirm: string;
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  formAction?: ButtonProps["formAction"];
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      formAction={formAction}
      name={name}
      value={value}
      onClick={(event) => {
        if (!window.confirm(confirm)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingText ?? "Working…" : children}
    </button>
  );
}
