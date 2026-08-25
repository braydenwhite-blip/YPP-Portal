"use server";

import { prisma } from "@/lib/prisma";

export type StudentLeadInput = {
  studentName: string;
  age: number;
  grade: string;
  school: string;
  studentEmail: string;
  parentName: string;
  parentEmail: string;
  allergiesNotes?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates and saves a public student/family interest submission. No auth
 * required — this is the front door for families who don't have an account
 * yet. Throws a plain Error with a user-facing message on invalid input. */
export async function submitStudentLead(input: StudentLeadInput) {
  const studentName = input.studentName.trim();
  const grade = input.grade.trim();
  const school = input.school.trim();
  const studentEmail = input.studentEmail.trim();
  const parentName = input.parentName.trim();
  const parentEmail = input.parentEmail.trim();
  const allergiesNotes = input.allergiesNotes?.trim() || undefined;

  if (!studentName) throw new Error("Student name is required.");
  if (!Number.isFinite(input.age) || input.age <= 0 || input.age > 25) {
    throw new Error("Please enter a valid age.");
  }
  if (!grade) throw new Error("Grade is required.");
  if (!school) throw new Error("School is required.");
  if (!studentEmail || !EMAIL_RE.test(studentEmail)) {
    throw new Error("Please enter a valid student email.");
  }
  if (!parentName) throw new Error("Parent/guardian name is required.");
  if (!parentEmail || !EMAIL_RE.test(parentEmail)) {
    throw new Error("Please enter a valid parent/guardian email.");
  }

  const record = await prisma.studentLeadSubmission.create({
    data: {
      studentName,
      age: Math.trunc(input.age),
      grade,
      school,
      studentEmail,
      parentName,
      parentEmail,
      allergiesNotes,
    },
    select: { id: true },
  });

  return { id: record.id };
}