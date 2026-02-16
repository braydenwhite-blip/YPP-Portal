function envTrue(value: string | undefined): boolean {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

export function isUnifiedAllToolsDashboardEnabled(): boolean {
  const raw = process.env.ENABLE_UNIFIED_ALL_TOOLS_DASHBOARD;
  if (!raw) return true;
  return envTrue(raw);
}
