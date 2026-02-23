import { verifyEmailToken, resendVerificationEmail } from "@/lib/email-verification-actions";
import Link from "next/link";
import Image from "next/image";
import ResendVerificationForm from "./resend-form";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";

  if (!token) {
    return (
      <VerifyEmailLayout
        title="Invalid Link"
        message="This verification link is missing a token. Please request a new one from the sign-in page."
        showResend
        email=""
      />
    );
  }

  const result = await verifyEmailToken(token);

  if (result.status === "success") {
    return (
      <VerifyEmailLayout
        title="Email Verified!"
        message={result.message}
        showSignIn
      />
    );
  }

  return (
    <VerifyEmailLayout
      title="Verification Failed"
      message={result.message}
      showResend
      email=""
    />
  );
}

function VerifyEmailLayout({
  title,
  message,
  showSignIn,
  showResend,
  email,
}: {
  title: string;
  message: string;
  showSignIn?: boolean;
  showResend?: boolean;
  email?: string;
}) {
  return (
    <div className="login-shell">
      <div className="login-card" style={{ justifySelf: "center" }}>
        <div className="login-card-header">
          <Image src="/logo-icon.svg" alt="YPP" width={44} height={44} />
          <div>
            <h2 className="page-title" style={{ fontSize: 20 }}>{title}</h2>
          </div>
        </div>

        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
          {message}
        </p>

        {showSignIn && (
          <Link href="/login" className="button" style={{ display: "inline-block", textDecoration: "none" }}>
            Sign In
          </Link>
        )}

        {showResend && (
          <ResendVerificationForm initialEmail={email ?? ""} />
        )}

        <div style={{ marginTop: 16 }}>
          <Link href="/login" style={{ fontSize: 13, color: "var(--muted)" }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
