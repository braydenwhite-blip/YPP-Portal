import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCSV(row[h])).join(",")
  );
  return [headerLine, ...dataLines].join("\n");
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!userId || !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 exports per admin per 5 minutes
  const rl = checkRateLimit(`export:${userId}`, 10, 5 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many export requests. Please try again later." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const table = searchParams.get("table");
  const format = searchParams.get("format") || "csv";

  if (!table) {
    return NextResponse.json({ error: "Missing table parameter" }, { status: 400 });
  }

  let headers: string[] = [];
  let rows: Record<string, unknown>[] = [];

  switch (table) {
    case "users": {
      const chapterId = searchParams.get("chapterId");
      const role = searchParams.get("role");
      const where: Record<string, unknown> = {};
      if (chapterId) where.chapterId = chapterId;
      if (role) where.roles = { some: { role } };

      const users = await prisma.user.findMany({
        where,
        include: {
          roles: true,
          chapter: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      });
      headers = ["name", "email", "phone", "primaryRole", "roles", "chapter", "xp", "level", "createdAt"];
      rows = users.map((u) => ({
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        primaryRole: u.primaryRole,
        roles: u.roles.map((r) => r.role).join("; "),
        chapter: u.chapter?.name || "",
        xp: u.xp,
        level: u.level,
        createdAt: u.createdAt.toISOString(),
      }));
      break;
    }

    case "courses": {
      const courses = await prisma.course.findMany({
        include: {
          chapter: { select: { name: true } },
          leadInstructor: { select: { name: true } },
          _count: { select: { enrollments: true, waitlistEntries: true } },
        },
        orderBy: { title: "asc" },
      });
      headers = ["title", "format", "level", "interestArea", "isVirtual", "maxEnrollment", "enrollments", "waitlisted", "chapter", "leadInstructor", "createdAt"];
      rows = courses.map((c) => ({
        title: c.title,
        format: c.format,
        level: c.level || "",
        interestArea: c.interestArea,
        isVirtual: c.isVirtual ? "Yes" : "No",
        maxEnrollment: c.maxEnrollment ?? "Unlimited",
        enrollments: c._count.enrollments,
        waitlisted: c._count.waitlistEntries,
        chapter: c.chapter?.name || "",
        leadInstructor: c.leadInstructor?.name || "",
        createdAt: c.createdAt.toISOString(),
      }));
      break;
    }

    case "enrollments": {
      const courseId = searchParams.get("courseId");
      const status = searchParams.get("status");
      const where: Record<string, unknown> = {};
      if (courseId) where.courseId = courseId;
      if (status) where.status = status;

      const enrollments = await prisma.enrollment.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          course: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      headers = ["studentName", "studentEmail", "course", "status", "enrolledAt"];
      rows = enrollments.map((e) => ({
        studentName: e.user.name,
        studentEmail: e.user.email,
        course: e.course.title,
        status: e.status,
        enrolledAt: e.createdAt.toISOString(),
      }));
      break;
    }

    case "certificates": {
      const certificates = await prisma.certificate.findMany({
        include: {
          recipient: { select: { name: true, email: true } },
          template: { select: { type: true } },
          course: { select: { title: true } },
          pathway: { select: { name: true } },
        },
        orderBy: { issuedAt: "desc" },
      });
      headers = ["recipientName", "recipientEmail", "title", "type", "course", "pathway", "certificateNumber", "issuedAt"];
      rows = certificates.map((c) => ({
        recipientName: c.recipient.name,
        recipientEmail: c.recipient.email,
        title: c.title,
        type: c.template.type,
        course: c.course?.title || "",
        pathway: c.pathway?.name || "",
        certificateNumber: c.certificateNumber,
        issuedAt: c.issuedAt.toISOString(),
      }));
      break;
    }

    case "attendance": {
      const records = await prisma.attendanceRecord.findMany({
        include: {
          user: { select: { name: true, email: true } },
          session: {
            select: { title: true, date: true },
          },
        },
        orderBy: { checkedInAt: "desc" },
      });
      headers = ["studentName", "studentEmail", "session", "sessionDate", "status", "notes", "checkedInAt"];
      rows = records.map((r) => ({
        studentName: r.user.name,
        studentEmail: r.user.email,
        session: r.session.title,
        sessionDate: r.session.date.toISOString(),
        status: r.status,
        notes: r.notes || "",
        checkedInAt: r.checkedInAt.toISOString(),
      }));
      break;
    }

    case "audit-logs": {
      let logs: Array<{
        action: string;
        actor: { name: string; email: string };
        targetType: string | null;
        targetId: string | null;
        description: string;
        createdAt: Date;
      }> = [];

      try {
        logs = await prisma.auditLog.findMany({
          include: {
            actor: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5000,
        });
      } catch (err: any) {
        const missingAuditLogTable =
          err?.code === "P2021" && err?.meta?.table === "public.AuditLog";
        if (!missingAuditLogTable) throw err;
        logs = [];
      }

      headers = ["action", "actorName", "actorEmail", "targetType", "targetId", "description", "createdAt"];
      rows = logs.map((l) => ({
        action: l.action,
        actorName: l.actor.name,
        actorEmail: l.actor.email,
        targetType: l.targetType || "",
        targetId: l.targetId || "",
        description: l.description,
        createdAt: l.createdAt.toISOString(),
      }));
      break;
    }

    case "events": {
      const events = await prisma.event.findMany({
        include: {
          chapter: { select: { name: true } },
          _count: { select: { rsvps: true } },
        },
        orderBy: { startDate: "desc" },
      });
      headers = ["title", "eventType", "startDate", "endDate", "chapter", "location", "rsvpCount", "isAlumniOnly"];
      rows = events.map((e) => ({
        title: e.title,
        eventType: e.eventType,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        chapter: e.chapter?.name || "Global",
        location: e.location || "",
        rsvpCount: e._count.rsvps,
        isAlumniOnly: e.isAlumniOnly ? "Yes" : "No",
      }));
      break;
    }

    case "feedback": {
      const feedback = await prisma.feedback.findMany({
        include: {
          author: { select: { name: true } },
          course: { select: { title: true } },
          instructor: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      headers = ["source", "authorName", "course", "instructor", "rating", "comments", "createdAt"];
      rows = feedback.map((f) => ({
        source: f.source,
        authorName: f.author?.name || "",
        course: f.course?.title || "",
        instructor: f.instructor?.name || "",
        rating: f.rating ?? "",
        comments: f.comments,
        createdAt: f.createdAt.toISOString(),
      }));
      break;
    }

    default:
      return NextResponse.json({ error: `Unknown table: ${table}` }, { status: 400 });
  }

  if (format === "json") {
    return NextResponse.json(rows, {
      headers: {
        "Content-Disposition": `attachment; filename="${table}-export.json"`,
      },
    });
  }

  // Default: CSV
  const csv = toCSV(headers, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${table}-export.csv"`,
    },
  });
}
