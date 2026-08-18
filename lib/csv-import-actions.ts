"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import {
  ApplicationSource,
  ApplicationStatus,
  ApplicationTrack,
  InstructorApplicationStatus,
  InstructorSubtype,
  RoleType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { findDefaultInitialReviewerForChapter } from "@/lib/instructor-application-defaults";
import { requireSessionUser } from "@/lib/authorization";
import { hasAnyRole } from "@/lib/authorization-roles";
import { ensureSocialMediaManagerPosition } from "@/lib/application-actions";
import { mergeStaffLocationIntoMaterials } from "@/lib/staff-applicant-location";
import { getChapterViewerContext, requireChapterManager } from "@/lib/chapters/access";
import { takeSeatRaceSafe } from "@/lib/class-seat-allocation";

export async function parseCSV(text: string): Promise<{
  headers: string[];
  rows: string[][];
}> {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim()));

  return { headers, rows };
}

export async function importApplicationsFromCSV(formData: FormData): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!session || !roles.includes("ADMIN")) {
    throw new Error("Unauthorized: Admin access required");
  }

  const csvDataRaw = formData.get("csvData") as string;
  const roleType = formData.get("roleType") as string;
  const cohortId = formData.get("cohortId") as string | null;
  const fieldMappingRaw = formData.get("fieldMapping") as string;

  const rows: string[][] = JSON.parse(csvDataRaw);
  const fieldMapping: Record<string, number> = JSON.parse(fieldMappingRaw);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const importedById = session.user.id;
  const externalImportedAt = new Date();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const name =
        fieldMapping.name !== undefined ? row[fieldMapping.name] : undefined;
      const lastName =
        fieldMapping.lastName !== undefined ? row[fieldMapping.lastName]?.trim() : undefined;
      const email =
        fieldMapping.email !== undefined ? row[fieldMapping.email] : undefined;

      if (!email) {
        skipped++;
        errors.push(`Row ${i + 1}: Missing email`);
        continue;
      }
      if (!lastName) {
        skipped++;
        errors.push(`Row ${i + 1}: Missing last name`);
        continue;
      }
      if (lastName.length > 100) {
        skipped++;
        errors.push(`Row ${i + 1}: Last name should be under 100 characters`);
        continue;
      }

      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            name: name || email.split("@")[0],
            email,
            passwordHash: "IMPORTED",
            primaryRole: "APPLICANT",
          },
        });
      }

      if (roleType === "INSTRUCTOR") {
        const defaultInitialReviewer = await findDefaultInitialReviewerForChapter(user.chapterId);
        const defaultReviewerAssignedAt = defaultInitialReviewer ? new Date() : null;
        const motivation =
          fieldMapping.motivation !== undefined
            ? row[fieldMapping.motivation]
            : "";
        const teachingExperience =
          fieldMapping.teachingExperience !== undefined
            ? row[fieldMapping.teachingExperience]
            : "";
        const availability =
          fieldMapping.availability !== undefined
            ? row[fieldMapping.availability]
            : "";

        await prisma.instructorApplication.create({
          data: {
            applicantId: user.id,
            // CSV intake is an external channel — mark the source so admin
            // dashboards can surface "Imported from CSV" alongside the
            // applicant's record.
            source: ApplicationSource.CSV_IMPORT,
            importedById,
            externalImportedAt,
            status: defaultInitialReviewer
              ? InstructorApplicationStatus.UNDER_REVIEW
              : InstructorApplicationStatus.SUBMITTED,
            reviewerId: defaultInitialReviewer?.id,
            reviewerAssignedAt: defaultReviewerAssignedAt,
            motivation: motivation || "",
            teachingExperience: teachingExperience || "",
            availability: availability || "",
            lastName,
            ...(cohortId ? { cohortId } : {}),
            timeline: defaultInitialReviewer
              ? {
                  create: {
                    kind: "REVIEWER_ASSIGNED",
                    actorId: null,
                    payload: {
                      reviewerId: defaultInitialReviewer.id,
                      previousReviewerId: null,
                      defaultAssignment: true,
                      reason: "chapter_president_default",
                    },
                  },
                }
              : undefined,
          },
        });
      } else {
        const leadershipExperience =
          fieldMapping.leadershipExperience !== undefined
            ? row[fieldMapping.leadershipExperience]
            : "";
        const chapterVision =
          fieldMapping.chapterVision !== undefined
            ? row[fieldMapping.chapterVision]
            : "";
        const availability =
          fieldMapping.availability !== undefined
            ? row[fieldMapping.availability]
            : "";

        await prisma.chapterPresidentApplication.create({
          data: {
            applicantId: user.id,
            source: ApplicationSource.CSV_IMPORT,
            importedById,
            externalImportedAt,
            leadershipExperience: leadershipExperience || "",
            chapterVision: chapterVision || "",
            availability: availability || "",
            lastName,
            ...(cohortId ? { cohortId } : {}),
          },
        });
      }

      imported++;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(`Row ${i + 1}: ${message}`);
      skipped++;
    }
  }

  revalidatePath("/admin/application-cohorts");
  revalidatePath("/admin/import-applications");
  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/admin/applicants");

  return { imported, skipped, errors };
}

const CsvRowSchema = z.object({
  email: z.string().trim(),
  name: z.string().trim().max(120).optional().default(""),
  lastName: z.string().trim().max(100).optional().default(""),
  chapter: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  state: z.string().trim().max(120).optional().default(""),
  country: z.string().trim().max(120).optional().default(""),
  track: z.string().trim().max(80).optional().default(""),
});

const ImportSchema = z.object({
  role: z.enum(["instructor", "cp", "staff"]),
  rows: z.array(CsvRowSchema).min(1).max(200),
});

export type ApplicantCsvImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

function splitDisplayName(name: string, lastName: string): { name: string; lastName: string } {
  const last = lastName.trim();
  const full = name.trim();
  if (full && last) return { name: full, lastName: last };
  if (full) {
    const parts = full.split(/\s+/);
    return { name: full, lastName: parts[parts.length - 1] || full };
  }
  return { name: last, lastName: last };
}

function instructorTrack(raw: string): ApplicationTrack {
  const value = raw.trim().toLowerCase();
  if (value.includes("summer") || value.includes("workshop")) {
    return ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR;
  }
  return ApplicationTrack.STANDARD_INSTRUCTOR;
}

async function findChapterId(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const chapter = await prisma.chapter.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" }, archivedAt: null },
    select: { id: true },
  });
  return chapter?.id ?? null;
}

export async function importApplicantCsvRows(input: unknown): Promise<ApplicantCsvImportResult> {
  const parsed = ImportSchema.safeParse(input);
  if (!parsed.success) {
    return { imported: 0, skipped: 0, errors: ["Check the file and try again. Email and last name are required."] };
  }

  const user = await requireSessionUser();
  if (!hasAnyRole(user.roles, ["ADMIN", "HIRING_CHAIR"], user.primaryRole)) {
    throw new Error("Unauthorized");
  }

  const { role, rows } = parsed.data;
  const importedById = user.id;
  const externalImportedAt = new Date();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const staffPosition =
    role === "staff" ? await ensureSocialMediaManagerPosition() : null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `Row ${i + 2}`;
    try {
      const email = row.email.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        skipped++;
        errors.push(`${label}: Missing a valid email`);
        continue;
      }
      const { name, lastName } = splitDisplayName(row.name, row.lastName);
      if (!lastName) {
        skipped++;
        errors.push(`${label}: Missing last name`);
        continue;
      }
      const chapterId = await findChapterId(row.chapter);

      let applicant = await prisma.user.findUnique({ where: { email } });
      if (!applicant) {
        applicant = await prisma.user.create({
          data: {
            name,
            email,
            phone: row.phone || null,
            passwordHash: "IMPORTED",
            primaryRole: RoleType.APPLICANT,
            chapterId,
          },
        });
      } else if (chapterId && !applicant.chapterId) {
        applicant = await prisma.user.update({
          where: { id: applicant.id },
          data: { chapterId },
        });
      }

      if (role === "instructor") {
        const open = await prisma.instructorApplication.findFirst({
          where: {
            applicantId: applicant.id,
            archivedAt: null,
            status: { notIn: ["APPROVED", "REJECTED"] },
          },
          select: { id: true },
        });
        if (open) {
          skipped++;
          errors.push(`${label}: ${email} already has an open instructor application`);
          continue;
        }
        const defaultInitialReviewer = await findDefaultInitialReviewerForChapter(
          applicant.chapterId
        );
        const track = instructorTrack(row.track);
        await prisma.instructorApplication.create({
          data: {
            applicantId: applicant.id,
            source: ApplicationSource.CSV_IMPORT,
            importedById,
            externalImportedAt,
            status: defaultInitialReviewer
              ? InstructorApplicationStatus.UNDER_REVIEW
              : InstructorApplicationStatus.SUBMITTED,
            reviewerId: defaultInitialReviewer?.id,
            reviewerAssignedAt: defaultInitialReviewer ? new Date() : null,
            motivation: "",
            teachingExperience: "",
            availability: "",
            lastName,
            legalName: name,
            preferredFirstName: name.split(/\s+/)[0] || null,
            phoneNumber: row.phone || null,
            city: row.city || null,
            stateProvince: row.state || null,
            country: row.country || null,
            applicationTrack: track,
            instructorSubtype:
              track === ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR
                ? InstructorSubtype.SUMMER_WORKSHOP
                : InstructorSubtype.STANDARD,
            timeline: defaultInitialReviewer
              ? {
                  create: {
                    kind: "REVIEWER_ASSIGNED",
                    actorId: null,
                    payload: {
                      reviewerId: defaultInitialReviewer.id,
                      previousReviewerId: null,
                      defaultAssignment: true,
                      reason: "csv_import",
                    },
                  },
                }
              : undefined,
          },
        });
      } else if (role === "cp") {
        const existing = await prisma.chapterPresidentApplication.findUnique({
          where: { applicantId: applicant.id },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          errors.push(`${label}: ${email} already has a chapter president application`);
          continue;
        }
        await prisma.chapterPresidentApplication.create({
          data: {
            applicantId: applicant.id,
            source: ApplicationSource.CSV_IMPORT,
            importedById,
            externalImportedAt,
            leadershipExperience: "",
            chapterVision: "",
            availability: "",
            lastName,
            chapterId,
          },
        });
      } else {
        if (!staffPosition) {
          skipped++;
          errors.push(`${label}: Social Media Manager opening is missing`);
          continue;
        }
        const open = await prisma.application.findFirst({
          where: {
            applicantId: applicant.id,
            positionId: staffPosition.id,
            archivedAt: null,
            status: { notIn: ["ACCEPTED", "REJECTED", "WITHDRAWN"] as ApplicationStatus[] },
          },
          select: { id: true },
        });
        if (open) {
          skipped++;
          errors.push(`${label}: ${email} already has an open staff application`);
          continue;
        }
        await prisma.application.create({
          data: {
            positionId: staffPosition.id,
            applicantId: applicant.id,
            source: ApplicationSource.CSV_IMPORT,
            importedById,
            externalImportedAt,
            status: "SUBMITTED",
            coverLetter: "",
            additionalMaterials: mergeStaffLocationIntoMaterials(null, row.chapter || null),
          },
        });
      }

      imported++;
    } catch (error) {
      skipped++;
      errors.push(
        `${label}: ${error instanceof Error ? error.message : "Could not import this row"}`
      );
    }
  }

  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/admin/applicants");
  return { imported, skipped, errors: errors.slice(0, 25) };
}

const StudentRowSchema = z.object({
  email: z.string().trim(),
  name: z.string().trim().max(120).optional().default(""),
  lastName: z.string().trim().max(100).optional().default(""),
  chapter: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  grade: z.string().trim().max(20).optional().default(""),
  school: z.string().trim().max(120).optional().default(""),
  parentEmail: z.string().trim().max(120).optional().default(""),
});

const StudentImportSchema = z.object({
  rows: z.array(StudentRowSchema).min(1).max(200),
});

function parseGrade(raw: string): number | null {
  const match = raw.match(/(\d{1,2})/);
  if (!match) return null;
  const grade = Number(match[1]);
  if (!Number.isFinite(grade) || grade < 1 || grade > 12) return null;
  return grade;
}

export async function importStudentCsvRows(input: unknown): Promise<ApplicantCsvImportResult> {
  const parsed = StudentImportSchema.safeParse(input);
  if (!parsed.success) {
    return { imported: 0, skipped: 0, errors: ["Check the file and try again. Email is required."] };
  }

  const actor = await requireSessionUser();
  if (!hasAnyRole(actor.roles, ["ADMIN", "HIRING_CHAIR"], actor.primaryRole)) {
    throw new Error("Unauthorized");
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < parsed.data.rows.length; i++) {
    const row = parsed.data.rows[i];
    const label = `Row ${i + 2}`;
    try {
      const email = row.email.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        skipped++;
        errors.push(`${label}: Missing a valid email`);
        continue;
      }
      const { name, lastName } = splitDisplayName(row.name, row.lastName);
      if (!name) {
        skipped++;
        errors.push(`${label}: Missing name`);
        continue;
      }
      const chapterId = await findChapterId(row.chapter);
      const grade = parseGrade(row.grade);
      const school = row.school || null;
      const parentEmail = row.parentEmail.includes("@") ? row.parentEmail.toLowerCase() : null;
      const phone = row.phone || null;
      if (row.chapter.trim() && !chapterId) {
        errors.push(`${label}: Chapter "${row.chapter}" was not found — imported without a chapter`);
      }

      const existing = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          chapterId: true,
          primaryRole: true,
          roles: { select: { role: true } },
          profile: { select: { id: true } },
        },
      });

      if (existing) {
        if (existing.roles.some((r) => r.role === RoleType.STUDENT)) {
          skipped++;
          errors.push(`${label}: ${email} is already a student`);
          continue;
        }
        await prisma.userRole.create({
          data: { userId: existing.id, role: RoleType.STUDENT },
        });
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            ...(existing.primaryRole === RoleType.APPLICANT
              ? { primaryRole: RoleType.STUDENT }
              : {}),
            ...(chapterId && !existing.chapterId ? { chapterId } : {}),
            ...(phone ? { phone } : {}),
          },
        });
        if (existing.profile) {
          await prisma.userProfile.update({
            where: { userId: existing.id },
            data: {
              ...(grade != null ? { grade } : {}),
              ...(school ? { school } : {}),
              ...(parentEmail ? { parentEmail } : {}),
            },
          });
        } else if (grade != null || school || parentEmail) {
          await prisma.userProfile.create({
            data: {
              userId: existing.id,
              grade,
              school,
              parentEmail,
            },
          });
        }
        imported++;
        continue;
      }

      await prisma.user.create({
        data: {
          name: lastName && !name.toLowerCase().endsWith(lastName.toLowerCase())
            ? `${name} ${lastName}`.trim()
            : name,
          email,
          phone,
          passwordHash: "IMPORTED",
          primaryRole: RoleType.STUDENT,
          chapterId,
          roles: { create: [{ role: RoleType.STUDENT }] },
          ...(grade != null || school || parentEmail
            ? { profile: { create: { grade, school, parentEmail } } }
            : {}),
        },
      });
      imported++;
    } catch (error) {
      skipped++;
      errors.push(
        `${label}: ${error instanceof Error ? error.message : "Could not import this row"}`
      );
    }
  }

  revalidatePath("/admin/students");
  revalidatePath("/people");
  revalidatePath("/admin/instructor-applicants");
  return { imported, skipped, errors: errors.slice(0, 25) };
}

const ChapterStudentRowSchema = z.object({
  email: z.string().trim(),
  name: z.string().trim().max(120).optional().default(""),
  lastName: z.string().trim().max(100).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  grade: z.string().trim().max(20).optional().default(""),
  school: z.string().trim().max(120).optional().default(""),
  parentEmail: z.string().trim().max(120).optional().default(""),
  className: z.string().trim().max(160).optional().default(""),
});

const ChapterStudentImportSchema = z.object({
  offeringId: z.string().trim().max(40).optional().default(""),
  rows: z.array(ChapterStudentRowSchema).min(1).max(200),
});

function studentDisplayName(name: string, lastName: string): string {
  if (lastName && !name.toLowerCase().endsWith(lastName.toLowerCase())) {
    return `${name} ${lastName}`.trim();
  }
  return name;
}

function normalizeClassLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function resolveImportChapterId(): Promise<string | null> {
  const ctx = await getChapterViewerContext();
  if (ctx.ledChapterId) {
    await requireChapterManager(ctx.ledChapterId);
    return ctx.ledChapterId;
  }
  if (!ctx.isLeadership) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: ctx.user.id },
    select: { chapterId: true },
  });
  if (!dbUser?.chapterId) return null;
  await requireChapterManager(dbUser.chapterId);
  return dbUser.chapterId;
}

async function upsertStudentInChapter(args: {
  email: string;
  name: string;
  lastName: string;
  phone: string | null;
  grade: number | null;
  school: string | null;
  parentEmail: string | null;
  chapterId: string;
}): Promise<{ id: string; created: boolean } | { skip: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: args.email },
    select: {
      id: true,
      chapterId: true,
      primaryRole: true,
      roles: { select: { role: true } },
      profile: { select: { id: true } },
    },
  });

  if (existing?.chapterId && existing.chapterId !== args.chapterId) {
    return { skip: `${args.email} belongs to another chapter` };
  }

  if (existing) {
    const isStudent = existing.roles.some((r) => r.role === RoleType.STUDENT);
    if (!isStudent) {
      await prisma.userRole.create({
        data: { userId: existing.id, role: RoleType.STUDENT },
      });
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...(existing.primaryRole === RoleType.APPLICANT ? { primaryRole: RoleType.STUDENT } : {}),
        ...(!existing.chapterId ? { chapterId: args.chapterId } : {}),
        ...(args.phone ? { phone: args.phone } : {}),
      },
    });
    if (existing.profile) {
      if (args.grade != null || args.school || args.parentEmail) {
        await prisma.userProfile.update({
          where: { userId: existing.id },
          data: {
            ...(args.grade != null ? { grade: args.grade } : {}),
            ...(args.school ? { school: args.school } : {}),
            ...(args.parentEmail ? { parentEmail: args.parentEmail } : {}),
          },
        });
      }
    } else if (args.grade != null || args.school || args.parentEmail) {
      await prisma.userProfile.create({
        data: {
          userId: existing.id,
          grade: args.grade,
          school: args.school,
          parentEmail: args.parentEmail,
        },
      });
    }
    return { id: existing.id, created: false };
  }

  const created = await prisma.user.create({
    data: {
      name: studentDisplayName(args.name, args.lastName),
      email: args.email,
      phone: args.phone,
      passwordHash: "IMPORTED",
      primaryRole: RoleType.STUDENT,
      chapterId: args.chapterId,
      roles: { create: [{ role: RoleType.STUDENT }] },
      ...(args.grade != null || args.school || args.parentEmail
        ? { profile: { create: { grade: args.grade, school: args.school, parentEmail: args.parentEmail } } }
        : {}),
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

export async function importChapterStudentCsvRows(
  input: unknown
): Promise<ApplicantCsvImportResult> {
  const parsed = ChapterStudentImportSchema.safeParse(input);
  if (!parsed.success) {
    return { imported: 0, skipped: 0, errors: ["Check the file and try again. Email is required."] };
  }

  const actor = await requireSessionUser();
  if (!hasAnyRole(actor.roles, ["ADMIN", "CHAPTER_PRESIDENT"], actor.primaryRole)) {
    throw new Error("Unauthorized");
  }

  const chapterId = await resolveImportChapterId();
  if (!chapterId) {
    return { imported: 0, skipped: 0, errors: ["You need a chapter assigned before importing students."] };
  }

  const defaultOfferingId = parsed.data.offeringId || null;
  if (defaultOfferingId) {
    const offering = await prisma.classOffering.findFirst({
      where: { id: defaultOfferingId, chapterId },
      select: { id: true },
    });
    if (!offering) {
      return { imported: 0, skipped: 0, errors: ["That class is not in your chapter."] };
    }
  }

  const offerings = await prisma.classOffering.findMany({
    where: {
      chapterId,
      status: { in: ["DRAFT", "PUBLISHED", "IN_PROGRESS"] },
    },
    select: { id: true, title: true, template: { select: { title: true } } },
  });

  function findOfferingId(className: string): string | null {
    const label = normalizeClassLabel(className);
    if (!label) return defaultOfferingId;
    const exact = offerings.find((o) => normalizeClassLabel(o.title) === label);
    if (exact) return exact.id;
    const template = offerings.find((o) => normalizeClassLabel(o.template.title) === label);
    return template?.id ?? null;
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const touchedOfferings = new Set<string>();

  for (let i = 0; i < parsed.data.rows.length; i++) {
    const row = parsed.data.rows[i];
    const label = `Row ${i + 2}`;
    try {
      const email = row.email.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        skipped++;
        errors.push(`${label}: Missing a valid email`);
        continue;
      }
      const { name, lastName } = splitDisplayName(row.name, row.lastName);
      if (!name) {
        skipped++;
        errors.push(`${label}: Missing name`);
        continue;
      }

      const offeringId = findOfferingId(row.className);
      if (row.className.trim() && !offeringId) {
        skipped++;
        errors.push(`${label}: Class "${row.className}" was not found in this chapter`);
        continue;
      }

      const upserted = await upsertStudentInChapter({
        email,
        name,
        lastName,
        phone: row.phone || null,
        grade: parseGrade(row.grade),
        school: row.school || null,
        parentEmail: row.parentEmail.includes("@") ? row.parentEmail.toLowerCase() : null,
        chapterId,
      });
      if ("skip" in upserted) {
        skipped++;
        errors.push(`${label}: ${upserted.skip}`);
        continue;
      }

      if (!offeringId) {
        if (upserted.created) {
          imported++;
        } else {
          skipped++;
          errors.push(`${label}: ${email} is already a student in this chapter`);
        }
        continue;
      }

      const seat = await takeSeatRaceSafe({ offeringId, studentId: upserted.id });
      touchedOfferings.add(offeringId);
      if (seat.alreadyActive) {
        if (upserted.created) {
          imported++;
          errors.push(`${label}: ${email} was added, and is already in that class`);
        } else {
          skipped++;
          errors.push(`${label}: ${email} is already in that class`);
        }
        continue;
      }
      imported++;
      if (seat.waitlisted) {
        errors.push(`${label}: ${email} was waitlisted — that class is full`);
      }
    } catch (error) {
      skipped++;
      errors.push(
        `${label}: ${error instanceof Error ? error.message : "Could not import this row"}`
      );
    }
  }

  revalidatePath("/chapter/students");
  revalidatePath("/chapter/classes");
  revalidatePath("/people");
  for (const offeringId of touchedOfferings) {
    revalidatePath(`/chapter/classes/${offeringId}`);
  }
  return { imported, skipped, errors: errors.slice(0, 25) };
}
