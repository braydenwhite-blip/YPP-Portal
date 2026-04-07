import "dotenv/config";
import { sendEmail } from "@/lib/email";

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
}

function extractAddress(raw: string) {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw).trim().toLowerCase();
}

async function main() {
  const provider = (process.env.EMAIL_PROVIDER || "auto").trim().toLowerCase();
  const emailFrom = process.env.EMAIL_FROM?.trim() || "";
  const resendConfigured = !!process.env.RESEND_API_KEY?.trim();
  const smtpConfigured = !!(
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_PORT?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim()
  );
  const sendTo = getArgValue("--send-to").trim().toLowerCase();
  const fromAddress = extractAddress(emailFrom);

  console.log("Step 1: Looking at your email settings.");
  console.log(`- EMAIL_PROVIDER: ${provider || "auto"}`);
  console.log(`- EMAIL_FROM: ${emailFrom || "(not set)"}`);
  console.log(`- Resend key present: ${resendConfigured ? "yes" : "no"}`);
  console.log(`- SMTP fully configured: ${smtpConfigured ? "yes" : "no"}`);

  console.log("\nStep 2: Checking for common problems.");
  if (!resendConfigured && !smtpConfigured) {
    console.log("- Problem: neither Resend nor SMTP is configured.");
  } else {
    console.log("- Good: at least one email provider is configured.");
  }

  if (!emailFrom) {
    console.log("- Problem: EMAIL_FROM is missing.");
  } else if (fromAddress.includes("yourdomain.com")) {
    console.log("- Problem: EMAIL_FROM still uses the placeholder yourdomain.com address.");
  } else if (fromAddress.endsWith("@resend.dev")) {
    console.log("- Note: onboarding@resend.dev is only for testing.");
  } else {
    console.log("- Sender address looks real. Resend still requires that domain to be verified.");
  }

  console.log("\nStep 3: Extra reminder.");
  console.log("- Password reset emails now use this app's email service.");
  console.log("- Real recipient delivery in Resend still needs a verified sender domain or SMTP.");

  if (!sendTo) {
    console.log("\nStep 4: No live email test was sent.");
    console.log("- Run: npm run email:check -- --send-to you@example.com");
    return;
  }

  console.log(`\nStep 4: Sending a live test email to ${sendTo}.`);
  const result = await sendEmail({
    to: sendTo,
    subject: "YPP email diagnostic",
    html: "<p>This is a diagnostic email from the YPP portal.</p>",
  });

  if (result.success) {
    console.log("- Success: the email provider accepted the message.");
    console.log(`- Message ID: ${result.messageId || "(not returned)"}`);
    return;
  }

  console.log("- Failure: the provider rejected or failed the message.");
  console.log(`- Error: ${result.error || "Unknown error"}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("Email diagnostic crashed:", error);
  process.exit(1);
});
