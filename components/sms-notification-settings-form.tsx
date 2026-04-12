"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  updateNotificationPreferencesAction,
  type NotificationPreferencesFormState,
} from "@/lib/notification-actions";

const INITIAL_STATE: NotificationPreferencesFormState = {
  status: "idle",
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Saving..." : "Save Text Settings"}
    </button>
  );
}

function formatOptOutDate(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function SmsNotificationSettingsForm({
  smsEnabled,
  smsPhoneE164,
  smsOptOutAt,
}: {
  smsEnabled: boolean;
  smsPhoneE164: string | null;
  smsOptOutAt: string | null;
}) {
  const [state, action] = useFormState(updateNotificationPreferencesAction, INITIAL_STATE);
  const formattedOptOutAt = formatOptOutDate(smsOptOutAt);

  return (
    <form action={action} className="form-grid" style={{ gap: 14 }}>
      <input type="hidden" name="formScope" value="sms" />

      {state.status !== "idle" ? (
        <div className={state.status === "error" ? "form-error" : "form-success"}>
          {state.message}
        </div>
      ) : null}

      <div className="form-row">
        <label>Mobile Number</label>
        <input
          type="tel"
          name="smsPhone"
          className="input"
          defaultValue={smsPhoneE164 || ""}
          placeholder="+1 555 123 4567"
        />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          We store the texting number separately from your general profile phone number.
        </span>
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <input
          type="checkbox"
          name="smsEnabled"
          defaultChecked={smsEnabled}
          style={{ marginTop: 3 }}
        />
        <span style={{ display: "grid", gap: 4 }}>
          <span style={{ fontWeight: 700 }}>Turn on text message alerts</span>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            By turning this on, you agree to receive one-way transactional texts for urgent portal updates.
            Message and data rates may apply. Reply STOP in your messaging app to opt out.
          </span>
        </span>
      </label>

      {formattedOptOutAt ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          This number was previously opted out on {formattedOptOutAt}. Turn the toggle back on here
          if you want to opt in again.
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
