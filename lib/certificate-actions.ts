"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { CertificateType } from "@prisma/client";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireAdmin() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
  }
  return session;
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

// ============================================
// CERTIFICATE TEMPLATE MANAGEMENT (Admin)
// ============================================

export async function createCertificateTemplate(formData: FormData) {
  await requireAdmin();

  const name = getString(formData, "name");
  const description = getString(formData, "description", false);
  const type = getString(formData, "type") as CertificateType;
  const templateHtml = getString(formData, "templateHtml", false);

  await prisma.certificateTemplate.create({
    data: {
      name,
      description: description || null,
      type,
      templateHtml: templateHtml || getDefaultTemplate(type),
      isActive: true
    }
  });

  revalidatePath("/admin/certificates");
}

export async function updateCertificateTemplate(formData: FormData) {
  await requireAdmin();

  const templateId = getString(formData, "templateId");
  const name = getString(formData, "name");
  const description = getString(formData, "description", false);
  const templateHtml = getString(formData, "templateHtml", false);
  const isActive = formData.get("isActive") === "on";

  await prisma.certificateTemplate.update({
    where: { id: templateId },
    data: {
      name,
      description: description || null,
      templateHtml: templateHtml || undefined,
      isActive
    }
  });

  revalidatePath("/admin/certificates");
}

// ============================================
// CERTIFICATE ISSUANCE
// ============================================

export async function issueCertificate(formData: FormData) {
  await requireAdmin();

  const templateId = getString(formData, "templateId");
  const recipientId = getString(formData, "recipientId");
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const courseId = getString(formData, "courseId", false);
  const pathwayId = getString(formData, "pathwayId", false);

  const certificate = await prisma.certificate.create({
    data: {
      templateId,
      recipientId,
      title,
      description: description || null,
      courseId: courseId || null,
      pathwayId: pathwayId || null
    }
  });

  revalidatePath("/certificates");
  revalidatePath(`/profile/${recipientId}`);

  return certificate;
}

export async function issueCourseCompletionCertificate(
  userId: string,
  courseId: string
) {
  // Find or create course completion template
  let template = await prisma.certificateTemplate.findFirst({
    where: {
      type: "COURSE_COMPLETION",
      isActive: true
    }
  });

  if (!template) {
    template = await prisma.certificateTemplate.create({
      data: {
        name: "Course Completion Certificate",
        type: "COURSE_COMPLETION",
        templateHtml: getDefaultTemplate("COURSE_COMPLETION"),
        isActive: true
      }
    });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId }
  });

  if (!course) {
    throw new Error("Course not found");
  }

  // Check if certificate already exists
  const existing = await prisma.certificate.findFirst({
    where: {
      recipientId: userId,
      courseId,
      templateId: template.id
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.certificate.create({
    data: {
      templateId: template.id,
      recipientId: userId,
      courseId,
      title: `${course.title} - Course Completion`,
      description: `Successfully completed ${course.title}`
    }
  });
}

export async function issuePathwayCompletionCertificate(
  userId: string,
  pathwayId: string
) {
  let template = await prisma.certificateTemplate.findFirst({
    where: {
      type: "PATHWAY_COMPLETION",
      isActive: true
    }
  });

  if (!template) {
    template = await prisma.certificateTemplate.create({
      data: {
        name: "Pathway Completion Certificate",
        type: "PATHWAY_COMPLETION",
        templateHtml: getDefaultTemplate("PATHWAY_COMPLETION"),
        isActive: true
      }
    });
  }

  const pathway = await prisma.pathway.findUnique({
    where: { id: pathwayId }
  });

  if (!pathway) {
    throw new Error("Pathway not found");
  }

  const existing = await prisma.certificate.findFirst({
    where: {
      recipientId: userId,
      pathwayId,
      templateId: template.id
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.certificate.create({
    data: {
      templateId: template.id,
      recipientId: userId,
      pathwayId,
      title: `${pathway.name} - Pathway Completion`,
      description: `Successfully completed the ${pathway.name} pathway`
    }
  });
}

export async function issueTrainingCompletionCertificate(userId: string) {
  let template = await prisma.certificateTemplate.findFirst({
    where: {
      type: "TRAINING_COMPLETION",
      isActive: true
    }
  });

  if (!template) {
    template = await prisma.certificateTemplate.create({
      data: {
        name: "Instructor Training Completion",
        type: "TRAINING_COMPLETION",
        templateHtml: getDefaultTemplate("TRAINING_COMPLETION"),
        isActive: true
      }
    });
  }

  const existing = await prisma.certificate.findFirst({
    where: {
      recipientId: userId,
      templateId: template.id
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.certificate.create({
    data: {
      templateId: template.id,
      recipientId: userId,
      title: "Instructor Training Completion",
      description: "Successfully completed all required instructor training modules"
    }
  });
}

// ============================================
// CERTIFICATE VIEWING
// ============================================

export async function getUserCertificates(userId?: string) {
  const session = await getServerSession(authOptions);
  const targetUserId = userId || session?.user?.id;

  if (!targetUserId) {
    return [];
  }

  return prisma.certificate.findMany({
    where: { recipientId: targetUserId },
    include: {
      template: true,
      course: true,
      pathway: true
    },
    orderBy: { issuedAt: "desc" }
  });
}

export async function getCertificateById(certificateId: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      template: true,
      recipient: { select: { name: true, email: true } },
      course: true,
      pathway: true
    }
  });

  return certificate;
}

export async function verifyCertificate(certificateNumber: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { certificateNumber },
    include: {
      template: true,
      recipient: { select: { name: true } },
      course: { select: { title: true } },
      pathway: { select: { name: true } }
    }
  });

  if (!certificate) {
    return { valid: false, message: "Certificate not found" };
  }

  return {
    valid: true,
    certificate: {
      title: certificate.title,
      recipientName: certificate.recipient.name,
      issuedAt: certificate.issuedAt,
      type: certificate.template.type,
      courseName: certificate.course?.title,
      pathwayName: certificate.pathway?.name
    }
  };
}

// ============================================
// DEFAULT TEMPLATES
// ============================================

function getDefaultTemplate(type: CertificateType): string {
  const baseStyle = `
    <style>
      .certificate {
        font-family: 'Georgia', serif;
        text-align: center;
        padding: 60px;
        border: 3px double #0f766e;
        margin: 20px;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      }
      .certificate h1 {
        color: #0f766e;
        font-size: 36px;
        margin-bottom: 10px;
      }
      .certificate h2 {
        color: #334155;
        font-size: 28px;
        margin: 20px 0;
      }
      .certificate .recipient {
        font-size: 32px;
        font-weight: bold;
        color: #1e293b;
        margin: 30px 0;
        border-bottom: 2px solid #0f766e;
        display: inline-block;
        padding: 0 20px 10px;
      }
      .certificate .description {
        font-size: 18px;
        color: #475569;
        margin: 20px 0;
      }
      .certificate .date {
        font-size: 14px;
        color: #64748b;
        margin-top: 40px;
      }
      .certificate .number {
        font-size: 12px;
        color: #94a3b8;
        margin-top: 10px;
      }
      .logo {
        width: 80px;
        margin-bottom: 20px;
      }
    </style>
  `;

  const templates: Record<CertificateType, string> = {
    COURSE_COMPLETION: `
      ${baseStyle}
      <div class="certificate">
        <h1>Youth Passion Project</h1>
        <h2>Certificate of Completion</h2>
        <p class="description">This certifies that</p>
        <div class="recipient">{{recipientName}}</div>
        <p class="description">has successfully completed</p>
        <h2>{{courseTitle}}</h2>
        <p class="date">Issued on {{issuedDate}}</p>
        <p class="number">Certificate #{{certificateNumber}}</p>
      </div>
    `,
    PATHWAY_COMPLETION: `
      ${baseStyle}
      <div class="certificate">
        <h1>Youth Passion Project</h1>
        <h2>Pathway Completion Certificate</h2>
        <p class="description">This certifies that</p>
        <div class="recipient">{{recipientName}}</div>
        <p class="description">has successfully completed the</p>
        <h2>{{pathwayName}} Pathway</h2>
        <p class="description">demonstrating mastery across all levels</p>
        <p class="date">Issued on {{issuedDate}}</p>
        <p class="number">Certificate #{{certificateNumber}}</p>
      </div>
    `,
    TRAINING_COMPLETION: `
      ${baseStyle}
      <div class="certificate">
        <h1>Youth Passion Project</h1>
        <h2>Instructor Training Certificate</h2>
        <p class="description">This certifies that</p>
        <div class="recipient">{{recipientName}}</div>
        <p class="description">has successfully completed all required</p>
        <h2>Instructor Training Modules</h2>
        <p class="description">and is certified to teach YPP courses</p>
        <p class="date">Issued on {{issuedDate}}</p>
        <p class="number">Certificate #{{certificateNumber}}</p>
      </div>
    `,
    ACHIEVEMENT: `
      ${baseStyle}
      <div class="certificate">
        <h1>Youth Passion Project</h1>
        <h2>Certificate of Achievement</h2>
        <p class="description">This certifies that</p>
        <div class="recipient">{{recipientName}}</div>
        <p class="description">has achieved</p>
        <h2>{{title}}</h2>
        <p class="description">{{description}}</p>
        <p class="date">Issued on {{issuedDate}}</p>
        <p class="number">Certificate #{{certificateNumber}}</p>
      </div>
    `,
    INSTRUCTOR_CERTIFICATION: `
      ${baseStyle}
      <div class="certificate">
        <h1>Youth Passion Project</h1>
        <h2>Instructor Certification</h2>
        <p class="description">This certifies that</p>
        <div class="recipient">{{recipientName}}</div>
        <p class="description">is a certified YPP Instructor</p>
        <h2>{{title}}</h2>
        <p class="description">authorized to teach approved courses</p>
        <p class="date">Issued on {{issuedDate}}</p>
        <p class="number">Certificate #{{certificateNumber}}</p>
      </div>
    `
  };

  return templates[type];
}

// ============================================
// CERTIFICATE RENDERING
// ============================================

export async function renderCertificateHtml(certificateId: string): Promise<string> {
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      template: true,
      recipient: true,
      course: true,
      pathway: true
    }
  });

  if (!certificate) {
    throw new Error("Certificate not found");
  }

  let html = certificate.template.templateHtml || getDefaultTemplate(certificate.template.type);

  // Replace placeholders
  html = html
    .replace(/{{recipientName}}/g, certificate.recipient.name)
    .replace(/{{title}}/g, certificate.title)
    .replace(/{{description}}/g, certificate.description || "")
    .replace(/{{courseTitle}}/g, certificate.course?.title || "")
    .replace(/{{pathwayName}}/g, certificate.pathway?.name || "")
    .replace(/{{issuedDate}}/g, certificate.issuedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }))
    .replace(/{{certificateNumber}}/g, certificate.certificateNumber);

  return html;
}
