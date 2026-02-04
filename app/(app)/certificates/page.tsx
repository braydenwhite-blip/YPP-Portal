import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function CertificatesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const certificates = await prisma.certificate.findMany({
    where: { recipientId: session.user.id },
    include: {
      template: true,
      course: true,
      pathway: true
    },
    orderBy: { issuedAt: "desc" }
  });

  const groupedCertificates = certificates.reduce((acc, cert) => {
    const type = cert.template.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(cert);
    return acc;
  }, {} as Record<string, typeof certificates>);

  const typeLabels: Record<string, string> = {
    COURSE_COMPLETION: "Course Completions",
    PATHWAY_COMPLETION: "Pathway Completions",
    TRAINING_COMPLETION: "Training Completions",
    ACHIEVEMENT: "Achievements",
    INSTRUCTOR_CERTIFICATION: "Instructor Certifications"
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Certificates</p>
          <h1 className="page-title">My Certificates</h1>
        </div>
        <div className="badge" style={{ background: "#dcfce7", color: "#166534" }}>
          {certificates.length} certificate{certificates.length !== 1 ? "s" : ""} earned
        </div>
      </div>

      {certificates.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>
              You haven&apos;t earned any certificates yet. Complete courses, pathways, or training
              to earn certificates!
            </p>
            <Link href="/curriculum" className="button" style={{ textDecoration: "none" }}>
              Browse Courses
            </Link>
          </div>
        </div>
      ) : (
        Object.entries(groupedCertificates).map(([type, certs]) => (
          <div key={type} style={{ marginBottom: 32 }}>
            <div className="section-title">{typeLabels[type] || type}</div>
            <div className="grid three">
              {certs.map(cert => (
                <div key={cert.id} className="card">
                  <div
                    style={{
                      height: 120,
                      background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 16,
                      color: "white"
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 32 }}>🏆</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>{cert.template.name}</div>
                    </div>
                  </div>
                  <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{cert.title}</h3>
                  {cert.description && (
                    <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)" }}>
                      {cert.description}
                    </p>
                  )}
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                    Issued: {new Date(cert.issuedAt).toLocaleDateString()}
                  </div>
                  <Link
                    href={`/certificates/${cert.id}`}
                    className="button small"
                    style={{ textDecoration: "none", display: "block", textAlign: "center" }}
                  >
                    View Certificate
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
