import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import crypto from "crypto";

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";

  if (!token) {
    return <MagicLinkError message="Invalid magic link. Please request a new one." />;
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!record) {
    return <MagicLinkError message="This magic link is invalid or has already been used." />;
  }

  if (record.usedAt) {
    return <MagicLinkError message="This magic link has already been used. Please request a new one." />;
  }

  if (record.expiresAt < new Date()) {
    return <MagicLinkError message="This magic link has expired. Please request a new one." />;
  }

  // Consume original token + create a short-lived (2 min) relay token for the login page
  const relayToken = crypto.randomBytes(32).toString("hex");
  const relayExpiry = new Date(Date.now() + 2 * 60 * 1000);

  await prisma.$transaction([
    // Mark original token as used
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Also mark email as verified
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    // Create a 2-minute relay token for auto sign-in on the login page
    prisma.emailVerificationToken.create({
      data: {
        token: relayToken,
        userId: record.userId,
        expiresAt: relayExpiry,
      },
    }),
  ]);

  redirect(`/login?mt=${encodeURIComponent(relayToken)}`);
}

function MagicLinkError({ message }: { message: string }) {
  return (
    <div className="login-shell">
      <div className="login-card" style={{ justifySelf: "center" }}>
        <div className="login-card-header">
          <Image src="/logo-icon.svg" alt="YPP" width={44} height={44} />
          <div>
            <h2 className="page-title" style={{ fontSize: 20 }}>Magic Link Failed</h2>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
          {message}
        </p>
        <Link href="/login" className="button" style={{ display: "inline-block", textDecoration: "none" }}>
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
