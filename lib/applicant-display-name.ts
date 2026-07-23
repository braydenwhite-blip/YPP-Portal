type ApplicantNameSource = {
  preferredFirstName?: string | null;
  lastName?: string | null;
  legalName?: string | null;
  applicant?: {
    name?: string | null;
    email?: string | null;
  } | null;
  fallback?: string;
};

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function formatApplicantDisplayName(
  source: ApplicantNameSource | null | undefined
): string {
  if (!source) return "Applicant";
  const preferredFirstName = clean(source.preferredFirstName);
  const lastName = clean(source.lastName);
  const legalName = clean(source.legalName);
  const accountName = clean(source.applicant?.name);
  const email = clean(source.applicant?.email);
  const fallback = clean(source.fallback) || "Applicant";

  if (preferredFirstName && lastName) return `${preferredFirstName} ${lastName}`;
  if (legalName) return legalName;
  if (accountName) return accountName;
  if (preferredFirstName) return preferredFirstName;
  if (lastName) return lastName;
  return email || fallback;
}

export function isApplicantLastNameMissing(
  source: Pick<ApplicantNameSource, "lastName"> | null | undefined
): boolean {
  if (!source) return true;
  return clean(source.lastName) === "";
}
