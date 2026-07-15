export function pretty(value?: string | null) {
  if (!value) return "Not set";
  return value.toString().replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
export function shortDate(value?: Date | string | null) {
  if (!value) return "Date pending";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
export function dateTime(value?: Date | string | null, time?: string | null) {
  if (!value) return "Time pending";
  return `${shortDate(value)}${time ? ` · ${time}` : ""}`;
}
