import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function PortfolioPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId: session.user.id },
    include: {
      items: {
        include: { course: true },
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  const certificates = await prisma.certificate.findMany({
    where: { recipientId: session.user.id },
    include: {
      course: true,
      pathway: true
    }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Account</p>
          <h1 className="page-title">My Portfolio</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {portfolio && (
            <Link href={`/portfolio/public/${session.user.id}`} className="button secondary">
              {portfolio.isPublic ? "View Public" : "Preview"}
            </Link>
          )}
          <Link href="/portfolio/edit" className="button primary">
            {portfolio ? "Edit Portfolio" : "Create Portfolio"}
          </Link>
        </div>
      </div>

      {!portfolio ? (
        <div className="card">
          <h3>Create Your Portfolio</h3>
          <p>
            Build a professional portfolio to showcase your projects, certificates, and achievements.
            Share it with colleges, employers, or on social media!
          </p>
          <Link href="/portfolio/edit" className="button primary" style={{ marginTop: 12 }}>
            Create Portfolio
          </Link>
        </div>
      ) : (
        <div>
          {/* Portfolio header */}
          <div className="card" style={{ marginBottom: 28 }}>
            <h2>{portfolio.title}</h2>
            {portfolio.bio && (
              <p style={{ marginTop: 8, color: "var(--text-secondary)" }}>{portfolio.bio}</p>
            )}
            <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
              <span className="pill">
                {portfolio.isPublic ? "Public" : "Private"}
              </span>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                {portfolio.items.length} items
              </span>
            </div>
          </div>

          {/* Portfolio items */}
          {portfolio.items.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div className="section-title">Projects & Work</div>
              <div className="grid two">
                {portfolio.items.map(item => (
                  <div key={item.id} className="card">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        style={{
                          width: "100%",
                          height: 200,
                          objectFit: "cover",
                          borderRadius: 6,
                          marginBottom: 12
                        }}
                      />
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <h3>{item.title}</h3>
                      <span className="pill">{item.type.replace("_", " ")}</span>
                    </div>
                    {item.description && (
                      <p style={{ marginTop: 8, color: "var(--text-secondary)" }}>
                        {item.description}
                      </p>
                    )}
                    {item.course && (
                      <div style={{ marginTop: 8 }}>
                        <span className="pill">{item.course.title}</span>
                      </div>
                    )}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button secondary small"
                        style={{ marginTop: 12, display: "inline-block" }}
                      >
                        View Project ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certificates */}
          {certificates.length > 0 && (
            <div>
              <div className="section-title">Certificates & Achievements</div>
              <div className="grid three">
                {certificates.map(cert => (
                  <div key={cert.id} className="card">
                    <h4>{cert.title}</h4>
                    {cert.description && (
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                        {cert.description}
                      </p>
                    )}
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                      Issued {new Date(cert.issuedAt).toLocaleDateString()}
                    </div>
                    {cert.pdfUrl && (
                      <a
                        href={cert.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button secondary small"
                        style={{ marginTop: 8, width: "100%" }}
                      >
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {portfolio.items.length === 0 && certificates.length === 0 && (
            <div className="card">
              <h3>Your Portfolio is Empty</h3>
              <p>Add projects, assignments, and showcase your work!</p>
              <Link href="/portfolio/edit" className="button primary" style={{ marginTop: 12 }}>
                Add Items
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
