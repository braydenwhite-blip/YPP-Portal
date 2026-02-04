import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { renderCertificateHtml } from "@/lib/certificate-actions";

export default async function CertificateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];

  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: {
      template: true,
      recipient: { select: { id: true, name: true, email: true } },
      course: true,
      pathway: true
    }
  });

  if (!certificate) {
    notFound();
  }

  // Check access - owner or admin
  if (certificate.recipientId !== session?.user?.id && !roles.includes("ADMIN")) {
    notFound();
  }

  const certificateHtml = await renderCertificateHtml(id);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/certificates" style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back to Certificates
          </Link>
          <h1 className="page-title">{certificate.title}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => window.print()}
            className="button small"
          >
            Print Certificate
          </button>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="section-title">Certificate Details</div>
          <table className="table">
            <tbody>
              <tr>
                <td><strong>Certificate Number</strong></td>
                <td style={{ fontFamily: "monospace" }}>{certificate.certificateNumber}</td>
              </tr>
              <tr>
                <td><strong>Recipient</strong></td>
                <td>{certificate.recipient.name}</td>
              </tr>
              <tr>
                <td><strong>Type</strong></td>
                <td>{certificate.template.type.replace(/_/g, " ")}</td>
              </tr>
              {certificate.course && (
                <tr>
                  <td><strong>Course</strong></td>
                  <td>{certificate.course.title}</td>
                </tr>
              )}
              {certificate.pathway && (
                <tr>
                  <td><strong>Pathway</strong></td>
                  <td>{certificate.pathway.name}</td>
                </tr>
              )}
              <tr>
                <td><strong>Issued Date</strong></td>
                <td>{new Date(certificate.issuedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 24 }}>
            <div className="section-title">Verification</div>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              This certificate can be verified using the certificate number above at:
            </p>
            <code style={{
              display: "block",
              padding: 12,
              background: "var(--surface-alt)",
              borderRadius: "var(--radius-sm)",
              marginTop: 8,
              fontSize: 13
            }}>
              portal.youthpassionproject.org/verify/{certificate.certificateNumber}
            </code>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            dangerouslySetInnerHTML={{ __html: certificateHtml }}
            style={{ transform: "scale(0.6)", transformOrigin: "top left", width: "166.67%", height: "auto" }}
          />
        </div>
      </div>

    </div>
  );
}
