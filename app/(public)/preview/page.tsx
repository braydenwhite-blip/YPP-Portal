import Link from "next/link";
import { cookies } from "next/headers";
import {
  PREVIEW_COOKIE_NAME,
  PREVIEW_FLASH_COOKIE_NAME,
  isPreviewPasscodeConfigured,
  isPublicGateEnabled,
  verifyPreviewToken,
} from "@/lib/public-gate";
import { enterPreviewModeAction, exitPreviewModeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PreviewModePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  const showErrorParam = params.error === "1";

  const cookieStore = await cookies();
  const flash = cookieStore.get(PREVIEW_FLASH_COOKIE_NAME)?.value;
  const showError = showErrorParam || flash === "invalid";

  const existingToken = cookieStore.get(PREVIEW_COOKIE_NAME)?.value ?? null;
  const previewActive = await verifyPreviewToken(existingToken);
  const passcodeConfigured = isPreviewPasscodeConfigured();
  const gateEnabled = isPublicGateEnabled();

  return (
    <div style={{ maxWidth: 480, margin: "72px auto", padding: "0 24px" }}>
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: "#f5f3ff",
          border: "1px solid #ddd6fe",
          fontSize: 12,
          color: "#5b21b6",
          marginBottom: 24,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Internal preview
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 12px" }}>
        Internal Preview Mode
      </h1>
      <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 24px" }}>
        Most of the portal is still being tested. Enter the team passcode to
        unlock it on this device. Your access is saved in a cookie here only.
      </p>

      {!gateEnabled && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            fontSize: 13,
            color: "#065f46",
            marginBottom: 16,
          }}
        >
          The public portal gate is currently disabled (PORTAL_PUBLIC_GATE=off).
          Every user already sees the full portal — no passcode is required.
        </div>
      )}

      {previewActive && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "#ecfeff",
            border: "1px solid #a5f3fc",
            fontSize: 13,
            color: "#155e75",
            marginBottom: 16,
          }}
        >
          Preview mode is <strong>active</strong> on this device. You can
          browse the full portal, or exit below to go back to the public view.
        </div>
      )}

      {showError && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            fontSize: 13,
            color: "#991b1b",
            marginBottom: 16,
          }}
        >
          That passcode didn&apos;t match. Double-check with the team and try again.
        </div>
      )}

      {!passcodeConfigured && gateEnabled && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            fontSize: 13,
            color: "#9a3412",
            marginBottom: 16,
          }}
        >
          No preview passcode is configured for this environment. Set
          <code style={{ marginInline: 4 }}>PORTAL_PREVIEW_PASSCODE</code>
          in the deployment environment variables to enable passcode-based
          unlock. Admins still bypass the gate automatically.
        </div>
      )}

      <form action={enterPreviewModeAction}>
        <input type="hidden" name="next" value={next} />
        <label
          htmlFor="passcode"
          style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
        >
          Preview passcode
        </label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="off"
          autoFocus
          required
          disabled={!passcodeConfigured || !gateEnabled}
          placeholder="Enter the team passcode"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--border, #d4d4d8)",
            fontSize: 14,
            marginBottom: 16,
          }}
        />
        <button
          type="submit"
          className="button"
          disabled={!passcodeConfigured || !gateEnabled}
          style={{
            width: "100%",
            padding: "11px 16px",
            fontSize: 14,
            fontWeight: 600,
            opacity: passcodeConfigured && gateEnabled ? 1 : 0.6,
          }}
        >
          Unlock preview mode
        </button>
      </form>

      {previewActive && (
        <form action={exitPreviewModeAction} style={{ marginTop: 16 }}>
          <input type="hidden" name="next" value="/" />
          <button
            type="submit"
            className="button outline"
            style={{ width: "100%", padding: "10px 14px", fontSize: 13 }}
          >
            Exit preview mode
          </button>
        </form>
      )}

      <p style={{ marginTop: 24, fontSize: 13, color: "var(--muted)" }}>
        Just looking to apply for a Summer Workshop?{" "}
        <Link href="/applications/summer-workshop" style={{ color: "#6b21c8" }}>
          Go to the application
        </Link>
        .
      </p>
    </div>
  );
}
