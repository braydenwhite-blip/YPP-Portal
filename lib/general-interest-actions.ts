"use server";

import { z } from "zod";

import { GRADE_LEVEL_OPTIONS } from "@/lib/general-interest";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { uploadFile } from "@/lib/storage";

export type GeneralInterestState = {
  status: "idle" | "error" | "success";
  message: string;
};

const Schema = z.object({
  email: z.string().trim().email("Enter a valid email.").max(320),
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  phone: z.string().trim().min(1, "Phone number is required.").max(40),
  gradeLevel: z.enum(GRADE_LEVEL_OPTIONS),
  gradeOther: z.string().trim().max(100).optional().or(z.literal("")),
  age: z.string().trim().min(1, "Age is required.").max(20),
  collaborationExperience: z
    .string()
    .trim()
    .min(20, "Please describe your collaborative experience (at least 20 characters).")
    .max(8000),
  additionalInfo: z.string().trim().max(8000).optional().or(z.literal("")),
});

const ALLOWED_RESUME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

const MAX_RESUME_BYTES = 10 * 1024 * 1024;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return value ? String(value).trim() : "";
}

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function submitGeneralInterest(
  _prev: GeneralInterestState,
  formData: FormData
): Promise<GeneralInterestState> {
  try {
    const email = getString(formData, "email").toLowerCase();
    const rate = checkRateLimit(`general-interest:${email || "anon"}`, 5, 60 * 60 * 1000);
    if (!rate.success) {
      return {
        status: "error",
        message: "Too many submissions from this email. Please try again later.",
      };
    }

    const parsed = Schema.safeParse({
      email,
      firstName: getString(formData, "firstName"),
      lastName: getString(formData, "lastName"),
      phone: getString(formData, "phone"),
      gradeLevel: getString(formData, "gradeLevel"),
      gradeOther: getString(formData, "gradeOther"),
      age: getString(formData, "age"),
      collaborationExperience: getString(formData, "collaborationExperience"),
      additionalInfo: getString(formData, "additionalInfo"),
    });

    if (!parsed.success) {
      return {
        status: "error",
        message: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
      };
    }

    const data = parsed.data;
    if (data.gradeLevel === "Other" && !data.gradeOther) {
      return { status: "error", message: "Please specify your grade level." };
    }

    const gradeLevel =
      data.gradeLevel === "Other" ? `Other: ${data.gradeOther}` : data.gradeLevel;

    let resumeUrl: string | null = null;
    let resumeFileName: string | null = null;
    const resume = formData.get("resume");
    if (resume instanceof File && resume.size > 0) {
      if (!ALLOWED_RESUME_TYPES.has(resume.type)) {
        return {
          status: "error",
          message: "Resume must be a PDF, DOC, DOCX, JPG, or PNG.",
        };
      }
      if (resume.size > MAX_RESUME_BYTES) {
        return { status: "error", message: "Resume file is too large (max 10MB)." };
      }
      const buffer = Buffer.from(await resume.arrayBuffer());
      const upload = await uploadFile({
        file: buffer,
        filename: resume.name.replace(/[^a-zA-Z0-9._-]/g, "_"),
        contentType: resume.type,
      });
      if (!upload.success || !upload.url) {
        return {
          status: "error",
          message: upload.error || "Could not upload resume. Please try again.",
        };
      }
      resumeUrl = upload.url;
      resumeFileName = resume.name;
    }

    await prisma.generalInterestSubmission.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        gradeLevel,
        age: data.age,
        collaborationExperience: data.collaborationExperience,
        resumeUrl,
        resumeFileName,
        additionalInfo: data.additionalInfo || null,
      },
    });

    const notifyTo =
      process.env.GENERAL_INTEREST_NOTIFY_EMAIL?.trim() ||
      process.env.EMAIL_REPLY_TO?.trim();
    if (notifyTo) {
      void sendEmail({
        to: notifyTo,
        subject: `General YPP Interest: ${data.firstName} ${data.lastName}`,
        html: `
          <p><strong>${escape(data.firstName)} ${escape(data.lastName)}</strong> (${escape(data.email)}) submitted the General YPP Interest Form.</p>
          <p><strong>Phone:</strong> ${escape(data.phone)}</p>
          <p><strong>Grade Level (2026-27):</strong> ${escape(gradeLevel)}</p>
          <p><strong>Age:</strong> ${escape(data.age)}</p>
          <p><strong>Collaborative experience:</strong></p>
          <p>${escape(data.collaborationExperience).replace(/\n/g, "<br/>")}</p>
          ${
            resumeUrl
              ? `<p><strong>Resume:</strong> <a href="${escape(resumeUrl)}">${escape(resumeFileName || "Download")}</a></p>`
              : "<p><strong>Resume:</strong> Not attached</p>"
          }
          ${
            data.additionalInfo
              ? `<p><strong>Additional information:</strong></p><p>${escape(data.additionalInfo).replace(/\n/g, "<br/>")}</p>`
              : ""
          }
        `,
      }).catch(() => {
        /* notify is best-effort */
      });
    }

    return {
      status: "success",
      message: "Thanks — we received your interest and will follow up soon.",
    };
  } catch (err) {
    console.error("[submitGeneralInterest]", err);
    return {
      status: "error",
      message: "Something went wrong. Please try again.",
    };
  }
}
