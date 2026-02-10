"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ============================================
// HELPERS
// ============================================

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

// ============================================
// PORTFOLIO TEMPLATES
// ============================================

export async function getPortfolioTemplates(passionArea?: string) {
  const templates = await prisma.portfolioTemplate.findMany({
    where: {
      isActive: true,
      ...(passionArea ? { OR: [{ passionArea }, { passionArea: null }] } : {}),
    },
    orderBy: { order: "asc" },
  });
  return templates;
}

export async function applyPortfolioTemplate(templateId: string) {
  const session = await requireAuth();

  const template = await prisma.portfolioTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) throw new Error("Template not found");

  // Update public portfolio with template settings
  await prisma.publicPortfolio.upsert({
    where: { studentId: session.user.id },
    create: {
      studentId: session.user.id,
      title: `My ${template.passionArea || "Creative"} Portfolio`,
      theme: template.colorScheme,
      sections: template.sections,
      isPublic: false,
    },
    update: {
      theme: template.colorScheme,
      sections: template.sections,
    },
  });

  // Increment usage count
  await prisma.portfolioTemplate.update({
    where: { id: templateId },
    data: { usageCount: { increment: 1 } },
  });

  revalidatePath("/portfolio");
  return template;
}

// ============================================
// INTERNSHIP BOARD
// ============================================

export async function getInternshipListings(filters?: {
  passionArea?: string;
  type?: string;
  status?: string;
}) {
  const session = await requireAuth();

  const listings = await prisma.internshipListing.findMany({
    where: {
      status: (filters?.status as any) || "OPEN",
      ...(filters?.passionArea ? { passionArea: filters.passionArea } : {}),
      ...(filters?.type ? { type: filters.type as any } : {}),
    },
    include: {
      postedBy: { select: { id: true, name: true } },
      _count: { select: { applications: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Check which ones user has applied to
  const myApps = await prisma.internshipApplication.findMany({
    where: { studentId: session.user.id },
    select: { listingId: true, status: true },
  });
  const myAppMap = Object.fromEntries(myApps.map((a) => [a.listingId, a.status]));

  return { listings, myAppMap };
}

export async function createInternshipListing(formData: FormData) {
  const session = await requireAuth();

  const data = {
    title: formData.get("title") as string,
    organization: formData.get("organization") as string,
    description: formData.get("description") as string,
    passionArea: formData.get("passionArea") as string || null,
    type: (formData.get("type") as "IN_PERSON" | "REMOTE" | "HYBRID") || "IN_PERSON",
    location: formData.get("location") as string || null,
    duration: formData.get("duration") as string || null,
    hoursPerWeek: parseInt(formData.get("hoursPerWeek") as string) || null,
    isPaid: formData.get("isPaid") === "true",
    compensation: formData.get("compensation") as string || null,
    ageRange: formData.get("ageRange") as string || null,
    contactName: formData.get("contactName") as string || null,
    contactEmail: formData.get("contactEmail") as string || null,
    applicationUrl: formData.get("applicationUrl") as string || null,
    deadline: formData.get("deadline") ? new Date(formData.get("deadline") as string) : null,
    requirements: JSON.parse(formData.get("requirements") as string || "[]"),
    postedById: session.user.id,
  };

  if (!data.title || !data.organization || !data.description) {
    throw new Error("Title, organization, and description are required");
  }

  const listing = await prisma.internshipListing.create({ data });
  revalidatePath("/internships");
  return listing;
}

export async function applyToInternship(formData: FormData) {
  const session = await requireAuth();
  const listingId = formData.get("listingId") as string;
  const coverLetter = formData.get("coverLetter") as string || null;
  const portfolioUrl = formData.get("portfolioUrl") as string || null;
  const resumeUrl = formData.get("resumeUrl") as string || null;

  const listing = await prisma.internshipListing.findUnique({
    where: { id: listingId },
  });
  if (!listing || listing.status !== "OPEN") {
    throw new Error("This opportunity is no longer accepting applications");
  }

  await prisma.internshipApplication.create({
    data: {
      listingId,
      studentId: session.user.id,
      coverLetter,
      portfolioUrl,
      resumeUrl,
    },
  });

  revalidatePath("/internships");
}

export async function getInternshipDetail(listingId: string) {
  const session = await requireAuth();

  const listing = await prisma.internshipListing.findUnique({
    where: { id: listingId },
    include: {
      postedBy: { select: { id: true, name: true } },
      applications: {
        where: { studentId: session.user.id },
        take: 1,
      },
      _count: { select: { applications: true } },
    },
  });

  return listing;
}

// ============================================
// CHAPTER EVENTS MAP
// ============================================

export async function getChapterEventsForMap() {
  const chapters = await prisma.chapter.findMany({
    include: {
      events: {
        where: { startDate: { gte: new Date() } },
        orderBy: { startDate: "asc" },
        take: 5,
      },
      _count: { select: { users: true, events: true } },
    },
  });

  return chapters;
}

// ============================================
// SERVICE PROJECTS
// ============================================

export async function getServiceProjects(status?: string) {
  const session = await requireAuth();

  const projects = await prisma.serviceProject.findMany({
    where: status ? { status: status as any } : { status: { not: "CANCELLED" } },
    include: {
      createdBy: { select: { id: true, name: true } },
      volunteers: {
        include: { student: { select: { id: true, name: true } } },
      },
      _count: { select: { volunteers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const myVolunteering = await prisma.serviceVolunteer.findMany({
    where: { studentId: session.user.id },
    select: { projectId: true },
  });
  const myProjectIds = new Set(myVolunteering.map((v) => v.projectId));

  return { projects, myProjectIds: Array.from(myProjectIds) };
}

export async function createServiceProject(formData: FormData) {
  const session = await requireAuth();

  const project = await prisma.serviceProject.create({
    data: {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      passionArea: formData.get("passionArea") as string || null,
      partnerOrg: formData.get("partnerOrg") as string || null,
      location: formData.get("location") as string || null,
      startDate: formData.get("startDate") ? new Date(formData.get("startDate") as string) : null,
      endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string) : null,
      totalHoursGoal: parseInt(formData.get("totalHoursGoal") as string) || null,
      volunteersNeeded: parseInt(formData.get("volunteersNeeded") as string) || 5,
      xpReward: parseInt(formData.get("xpReward") as string) || 50,
      createdById: session.user.id,
    },
  });

  revalidatePath("/service-projects");
  return project;
}

export async function joinServiceProject(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.serviceProject.findUnique({
    where: { id: projectId },
    include: { _count: { select: { volunteers: true } } },
  });
  if (!project || project.status !== "RECRUITING") {
    throw new Error("Project is not recruiting");
  }
  if (project._count.volunteers >= project.volunteersNeeded) {
    throw new Error("Project is full");
  }

  await prisma.serviceVolunteer.create({
    data: { projectId, studentId: session.user.id },
  });

  revalidatePath("/service-projects");
}

export async function logServiceHours(formData: FormData) {
  const session = await requireAuth();
  const projectId = formData.get("projectId") as string;
  const hours = parseInt(formData.get("hours") as string);
  const reflection = formData.get("reflection") as string || null;

  if (!hours || hours < 1) throw new Error("Hours must be at least 1");

  const volunteer = await prisma.serviceVolunteer.findUnique({
    where: { projectId_studentId: { projectId, studentId: session.user.id } },
  });
  if (!volunteer) throw new Error("Not a volunteer for this project");

  await prisma.serviceVolunteer.update({
    where: { id: volunteer.id },
    data: {
      hoursLogged: { increment: hours },
      reflection,
    },
  });

  // Update project total hours
  await prisma.serviceProject.update({
    where: { id: projectId },
    data: { currentHours: { increment: hours } },
  });

  // Award XP for service hours
  const xpAmount = hours * 5;
  await prisma.xpTransaction.create({
    data: {
      userId: session.user.id,
      amount: xpAmount,
      reason: `Logged ${hours} service hours`,
    },
  });
  await prisma.user.update({
    where: { id: session.user.id },
    data: { xp: { increment: xpAmount } },
  });

  revalidatePath("/service-projects");
  return { hoursLogged: volunteer.hoursLogged + hours, xpEarned: xpAmount };
}

export async function getServiceProjectDetail(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.serviceProject.findUnique({
    where: { id: projectId },
    include: {
      createdBy: { select: { id: true, name: true } },
      volunteers: {
        include: { student: { select: { id: true, name: true, level: true } } },
        orderBy: { hoursLogged: "desc" },
      },
    },
  });

  return project;
}

// ============================================
// INSTRUCTOR CERTIFICATIONS
// ============================================

export async function getInstructorCertifications() {
  const session = await requireAuth();

  const certs = await prisma.instructorCertification.findMany({
    where: { instructorId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return certs;
}

export async function startCertification(formData: FormData) {
  const session = await requireAuth();

  const certType = formData.get("certType") as string;
  const passionArea = formData.get("passionArea") as string || null;

  if (!certType) throw new Error("Certification type is required");

  // Define requirements based on cert type
  const requirementSets: Record<string, { name: string; completed: boolean; evidence: string }[]> = {
    Foundational: [
      { name: "Complete YPP Instructor Training", completed: false, evidence: "" },
      { name: "Shadow 3 experienced instructors", completed: false, evidence: "" },
      { name: "Deliver 1 practice lesson", completed: false, evidence: "" },
      { name: "Pass safety & conduct quiz", completed: false, evidence: "" },
      { name: "Receive positive mentor review", completed: false, evidence: "" },
    ],
    Advanced: [
      { name: "Hold Foundational certification", completed: false, evidence: "" },
      { name: "Teach 10+ classes with positive feedback", completed: false, evidence: "" },
      { name: "Create 2 original curriculum templates", completed: false, evidence: "" },
      { name: "Mentor 1 new instructor", completed: false, evidence: "" },
      { name: "Complete advanced pedagogy module", completed: false, evidence: "" },
      { name: "Receive 4.0+ average enjoyment rating", completed: false, evidence: "" },
    ],
    Specialist: [
      { name: "Hold Advanced certification", completed: false, evidence: "" },
      { name: "Demonstrate expertise in passion area", completed: false, evidence: "" },
      { name: "Publish curriculum used by 3+ chapters", completed: false, evidence: "" },
      { name: "Present at a YPP showcase or event", completed: false, evidence: "" },
      { name: "Complete specialist portfolio review", completed: false, evidence: "" },
    ],
  };

  const requirements = requirementSets[certType] || requirementSets.Foundational;

  const cert = await prisma.instructorCertification.create({
    data: {
      instructorId: session.user.id,
      certType,
      passionArea,
      requirements: requirements as any,
      totalRequired: requirements.length,
    },
  });

  revalidatePath("/instructor/certifications");
  return cert;
}

export async function updateCertificationRequirement(
  certId: string,
  requirementIndex: number,
  evidence: string
) {
  const session = await requireAuth();

  const cert = await prisma.instructorCertification.findFirst({
    where: { id: certId, instructorId: session.user.id },
  });
  if (!cert) throw new Error("Certification not found");

  const reqs = cert.requirements as any[];
  if (requirementIndex < 0 || requirementIndex >= reqs.length) {
    throw new Error("Invalid requirement index");
  }

  reqs[requirementIndex].completed = true;
  reqs[requirementIndex].evidence = evidence;

  const totalCompleted = reqs.filter((r: any) => r.completed).length;
  const progressPct = (totalCompleted / cert.totalRequired) * 100;

  await prisma.instructorCertification.update({
    where: { id: certId },
    data: {
      requirements: reqs as any,
      totalCompleted,
      progressPct,
    },
  });

  revalidatePath("/instructor/certifications");
  return { totalCompleted, progressPct };
}

export async function submitCertification(certId: string) {
  const session = await requireAuth();

  const cert = await prisma.instructorCertification.findFirst({
    where: { id: certId, instructorId: session.user.id },
  });
  if (!cert) throw new Error("Certification not found");
  if (cert.totalCompleted < cert.totalRequired) {
    throw new Error("Not all requirements are completed");
  }

  await prisma.instructorCertification.update({
    where: { id: certId },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  revalidatePath("/instructor/certifications");
}

// ============================================
// RESOURCE EXCHANGE
// ============================================

export async function getResourceExchangeListings(filters?: {
  type?: string;
  category?: string;
  passionArea?: string;
}) {
  const session = await requireAuth();

  const listings = await prisma.resourceExchangeListing.findMany({
    where: {
      status: "AVAILABLE",
      ...(filters?.type ? { type: filters.type as any } : {}),
      ...(filters?.category ? { category: filters.category } : {}),
      ...(filters?.passionArea ? { passionArea: filters.passionArea } : {}),
    },
    include: {
      user: { select: { id: true, name: true, chapterId: true } },
      _count: { select: { requests: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return { listings, userId: session.user.id };
}

export async function createExchangeListing(formData: FormData) {
  const session = await requireAuth();

  const listing = await prisma.resourceExchangeListing.create({
    data: {
      userId: session.user.id,
      title: formData.get("title") as string,
      description: formData.get("description") as string || null,
      type: (formData.get("type") as "OFFER" | "REQUEST") || "OFFER",
      category: formData.get("category") as string,
      passionArea: formData.get("passionArea") as string || null,
      imageUrl: formData.get("imageUrl") as string || null,
      condition: formData.get("condition") as string || null,
      estimatedValue: parseFloat(formData.get("estimatedValue") as string) || null,
    },
  });

  revalidatePath("/resource-exchange");
  return listing;
}

export async function requestExchangeItem(listingId: string, message?: string) {
  const session = await requireAuth();

  const listing = await prisma.resourceExchangeListing.findUnique({
    where: { id: listingId },
  });
  if (!listing || listing.status !== "AVAILABLE") {
    throw new Error("Listing is not available");
  }
  if (listing.userId === session.user.id) {
    throw new Error("Cannot request your own listing");
  }

  await prisma.resourceExchangeRequest.create({
    data: {
      listingId,
      requesterId: session.user.id,
      message,
    },
  });

  revalidatePath("/resource-exchange");
}

export async function respondToExchangeRequest(
  requestId: string,
  action: "ACCEPTED" | "DECLINED"
) {
  const session = await requireAuth();

  const request = await prisma.resourceExchangeRequest.findUnique({
    where: { id: requestId },
    include: { listing: true },
  });
  if (!request || request.listing.userId !== session.user.id) {
    throw new Error("Not authorized");
  }

  await prisma.resourceExchangeRequest.update({
    where: { id: requestId },
    data: { status: action },
  });

  if (action === "ACCEPTED") {
    await prisma.resourceExchangeListing.update({
      where: { id: request.listingId },
      data: { status: "CLAIMED" },
    });
    // Decline other requests
    await prisma.resourceExchangeRequest.updateMany({
      where: { listingId: request.listingId, id: { not: requestId }, status: "PENDING" },
      data: { status: "DECLINED" },
    });
  }

  revalidatePath("/resource-exchange");
}

export async function getMyExchangeListings() {
  const session = await requireAuth();

  const listings = await prisma.resourceExchangeListing.findMany({
    where: { userId: session.user.id },
    include: {
      requests: {
        include: { requester: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return listings;
}
