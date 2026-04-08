import { z } from "zod";

export const STUDENT_GRADE_MIN = 1;
export const STUDENT_GRADE_MAX = 12;
export const STUDENT_GRADE_OPTIONS = Array.from(
  { length: STUDENT_GRADE_MAX - STUDENT_GRADE_MIN + 1 },
  (_, index) => index + STUDENT_GRADE_MIN
);

export const STUDENT_INTEREST_OPTIONS = [
  {
    value: "Science & Health",
    label: "Science & Health",
    description: "Experiments, discovery, wellness, and how the world works.",
  },
  {
    value: "Technology & Engineering",
    label: "Technology & Engineering",
    description: "Coding, building, problem-solving, and designing new tools.",
  },
  {
    value: "Arts & Creativity",
    label: "Arts & Creativity",
    description: "Design, storytelling, music, media, and creative expression.",
  },
  {
    value: "Social Sciences & People",
    label: "Social Sciences & People",
    description: "Psychology, leadership, history, communication, and community.",
  },
] as const;

export const STUDENT_LEARNING_STYLE_OPTIONS = [
  {
    value: "Hands-on projects",
    label: "Hands-on projects",
    description: "Learn best by making, trying, and building things yourself.",
  },
  {
    value: "Research & reading",
    label: "Research & reading",
    description: "Like learning through articles, books, notes, and deep dives.",
  },
  {
    value: "Group collaboration",
    label: "Group collaboration",
    description: "Grow fastest by talking ideas through and working with others.",
  },
  {
    value: "Independent exploration",
    label: "Independent exploration",
    description: "Prefer time to explore, test ideas, and move at your own pace.",
  },
] as const;

export const STUDENT_PRIMARY_GOAL_OPTIONS = [
  {
    value: "College preparation",
    label: "College preparation",
    description: "Build confidence, skills, and experiences that help with college.",
  },
  {
    value: "Career exploration",
    label: "Career exploration",
    description: "Try real areas of interest and see what future paths feel exciting.",
  },
  {
    value: "Building skills for fun",
    label: "Building skills for fun",
    description: "Learn something meaningful because it sounds exciting right now.",
  },
  {
    value: "Helping my community",
    label: "Helping my community",
    description: "Use interests and projects to make a difference for other people.",
  },
] as const;

type StudentOptionWithValue = { value: string; label: string };

const PLACEHOLDER_NAME_VALUES = new Set([
  "n/a",
  "na",
  "none",
  "unknown",
  "test",
  "testing",
  "student",
  "parent",
  "guardian",
  "user",
]);

const emailSchema = z.string().trim().email("Please enter a valid email address.");

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function countLetterLikeCharacters(value: string) {
  return Array.from(value).filter((char) => /\p{L}/u.test(char)).length;
}

function validateLikelyHumanName(value: string, label: string) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    throw new Error(`Please enter ${label.toLowerCase()}.`);
  }

  if (normalized.length < 2) {
    throw new Error(`${label} is too short.`);
  }

  if (normalized.length > 80) {
    throw new Error(`${label} is too long.`);
  }

  if (normalized.includes("@") || /\d/.test(normalized)) {
    throw new Error(`${label} should look like a real name.`);
  }

  if (!/^[\p{L}\p{M}'’. -]+$/u.test(normalized)) {
    throw new Error(`${label} contains characters we cannot accept.`);
  }

  if (countLetterLikeCharacters(normalized) < 2) {
    throw new Error(`${label} should look like a real name.`);
  }

  if (PLACEHOLDER_NAME_VALUES.has(normalized.toLowerCase())) {
    throw new Error(`${label} should look like a real name.`);
  }

  return normalized;
}

function validatePhone(value: string, label: string) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    throw new Error(`Please enter ${label.toLowerCase()}.`);
  }

  const digitsOnly = normalized.replace(/\D/g, "");
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    throw new Error(`Please enter a valid ${label.toLowerCase()}.`);
  }

  if (!/^[\d\s()+\-./]+$/.test(normalized)) {
    throw new Error(`Please enter a valid ${label.toLowerCase()}.`);
  }

  return normalized;
}

function validateSchoolName(value: string, required: boolean) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    if (required) {
      throw new Error("Please enter the student's school.");
    }
    return null;
  }

  if (normalized.length < 2) {
    throw new Error("Student school is too short.");
  }

  if (PLACEHOLDER_NAME_VALUES.has(normalized.toLowerCase())) {
    throw new Error("Please enter the student's school.");
  }

  return normalized;
}

function validateAcademicGrade(value: string, required: boolean) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    if (required) {
      throw new Error("Please choose the student's grade for the current academic year.");
    }
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || `${parsed}` !== normalized) {
    throw new Error("Please choose a valid grade.");
  }

  if (parsed < STUDENT_GRADE_MIN || parsed > STUDENT_GRADE_MAX) {
    throw new Error(`Please choose a grade between ${STUDENT_GRADE_MIN} and ${STUDENT_GRADE_MAX}.`);
  }

  return parsed;
}

function validateIsoDate(value: string, label: string) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    throw new Error(`Please enter ${label.toLowerCase()}.`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`Please enter a valid ${label.toLowerCase()}.`);
  }

  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Please enter a valid ${label.toLowerCase()}.`);
  }

  const age = deriveAgeFromDateOfBirth(normalized);
  if (age === null || age < 4 || age > 25) {
    throw new Error(`Please enter a realistic ${label.toLowerCase()}.`);
  }

  return normalized;
}

function parseAllowedSingleSelect(
  value: string | null | undefined,
  label: string,
  allowedOptions: readonly StudentOptionWithValue[]
) {
  const normalized = value ? normalizeWhitespace(value) : "";
  if (!normalized) {
    return null;
  }

  const allowedValues = allowedOptions.map((option) => option.value);
  if (!allowedValues.includes(normalized)) {
    throw new Error(`Please choose a valid ${label.toLowerCase()}.`);
  }

  return normalized;
}

export function parseRequiredEmail(value: string, label: string) {
  const result = emailSchema.safeParse(normalizeWhitespace(value).toLowerCase());
  if (!result.success) {
    throw new Error(`Please enter a valid ${label.toLowerCase()}.`);
  }
  return result.data;
}

export function parseOptionalEmail(value: string | null | undefined, label: string) {
  const normalized = value ? normalizeWhitespace(value).toLowerCase() : "";
  if (!normalized) {
    return null;
  }

  const result = emailSchema.safeParse(normalized);
  if (!result.success) {
    throw new Error(`Please enter a valid ${label.toLowerCase()}.`);
  }

  return result.data;
}

export function parseRequiredHumanName(value: string, label: string) {
  return validateLikelyHumanName(value, label);
}

export function parseOptionalHumanName(value: string | null | undefined, label: string) {
  const normalized = value ? normalizeWhitespace(value) : "";
  if (!normalized) {
    return null;
  }

  return validateLikelyHumanName(normalized, label);
}

export function parseRequiredPhone(value: string, label: string) {
  return validatePhone(value, label);
}

export function parseOptionalPhone(value: string | null | undefined, label: string) {
  const normalized = value ? normalizeWhitespace(value) : "";
  if (!normalized) {
    return null;
  }

  return validatePhone(normalized, label);
}

export function parseRequiredSchool(value: string) {
  const school = validateSchoolName(value, true);
  if (!school) {
    throw new Error("Please enter the student's school.");
  }

  return school;
}

export function parseOptionalSchool(value: string | null | undefined) {
  return validateSchoolName(value ?? "", false);
}

export function parseRequiredStudentGrade(value: string) {
  const grade = validateAcademicGrade(value, true);
  if (grade === null) {
    throw new Error("Please choose the student's grade for the current academic year.");
  }

  return grade;
}

export function parseOptionalStudentGrade(value: string | null | undefined) {
  return validateAcademicGrade(value ?? "", false);
}

export function parseRequiredDateOfBirth(value: string, label = "date of birth") {
  return validateIsoDate(value, label);
}

export function parseStudentInterests(values: string[]) {
  const normalizedValues = values
    .flatMap((value) => value.split(","))
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean);

  return Array.from(new Set(normalizedValues));
}

export function parseStudentLearningStyle(value: string | null | undefined) {
  return parseAllowedSingleSelect(value, "learning style", STUDENT_LEARNING_STYLE_OPTIONS);
}

export function parseStudentPrimaryGoal(value: string | null | undefined) {
  return parseAllowedSingleSelect(value, "main goal", STUDENT_PRIMARY_GOAL_OPTIONS);
}

export function getMissingStudentSetupFields(profile: {
  school?: string | null;
  grade?: number | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
}) {
  const missingFields: Array<"school" | "grade" | "parentEmail" | "parentPhone"> = [];

  if (!normalizeWhitespace(profile.school ?? "")) {
    missingFields.push("school");
  }

  if (!profile.grade || profile.grade < STUDENT_GRADE_MIN || profile.grade > STUDENT_GRADE_MAX) {
    missingFields.push("grade");
  }

  if (!normalizeWhitespace(profile.parentEmail ?? "")) {
    missingFields.push("parentEmail");
  }

  if (!normalizeWhitespace(profile.parentPhone ?? "")) {
    missingFields.push("parentPhone");
  }

  return missingFields;
}

export function deriveAgeFromDateOfBirth(
  dateOfBirth: string | null | undefined,
  now = new Date()
) {
  if (!dateOfBirth) {
    return null;
  }

  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  let age = now.getFullYear() - birthDate.getFullYear();
  const monthOffset = now.getMonth() - birthDate.getMonth();
  const birthdayHasPassed =
    monthOffset > 0 || (monthOffset === 0 && now.getDate() >= birthDate.getDate());

  if (!birthdayHasPassed) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}
