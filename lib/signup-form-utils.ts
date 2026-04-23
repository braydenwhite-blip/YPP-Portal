export type SignupFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fields?: Record<string, string>;
};

export function pickFormFields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k === "password" || k === "passwordConfirm") continue;
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
