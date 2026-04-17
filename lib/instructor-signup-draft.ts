export const INSTRUCTOR_SIGNUP_DRAFT_KEY = "ypp-instructor-signup-draft-v1";

export type InstructorSignupDraftV1 = {
  v: 1;
  savedAt: string;
  fields: Record<string, string>;
  motivationVideoUrl: string;
};

export function buildDraftFromForm(
  form: HTMLFormElement,
  motivationVideoUrl: string
): InstructorSignupDraftV1 {
  const fd = new FormData(form);
  const fields: Record<string, string> = {};
  fd.forEach((val, key) => {
    if (key === "password" || key === "accountType") return;
    if (typeof val === "string") fields[key] = val;
  });
  return {
    v: 1,
    savedAt: new Date().toISOString(),
    fields,
    motivationVideoUrl: motivationVideoUrl || "",
  };
}

export function saveInstructorSignupDraft(
  form: HTMLFormElement | null,
  motivationVideoUrl: string
): void {
  if (!form || typeof localStorage === "undefined") return;
  try {
    const draft = buildDraftFromForm(form, motivationVideoUrl);
    localStorage.setItem(INSTRUCTOR_SIGNUP_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or disabled
  }
}

export function loadInstructorSignupDraft(): InstructorSignupDraftV1 | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(INSTRUCTOR_SIGNUP_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InstructorSignupDraftV1;
    if (parsed?.v !== 1 || typeof parsed.fields !== "object") return null;
    return {
      ...parsed,
      motivationVideoUrl: typeof parsed.motivationVideoUrl === "string" ? parsed.motivationVideoUrl : "",
    };
  } catch {
    return null;
  }
}

export function clearInstructorSignupDraft(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(INSTRUCTOR_SIGNUP_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
