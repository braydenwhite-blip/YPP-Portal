function stripTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function isLoopbackHostname(value: string) {
  return (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "0.0.0.0" ||
    value.startsWith("127.")
  );
}

function getHostnameCandidate(value: string) {
  return value.replace(/^\/+/, "").split("/")[0]?.split(":")[0] || "";
}

function normalizeUrl(value: string | undefined) {
  const trimmed = value?.trim() || "";
  if (!trimmed) return "";

  const protocol = isLoopbackHostname(getHostnameCandidate(trimmed)) ? "http" : "https";
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${protocol}://${trimmed.replace(/^\/+/, "")}`;

  try {
    return stripTrailingSlashes(new URL(withProtocol).toString());
  } catch {
    return "";
  }
}

function isLoopbackHost(value: string) {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;

  try {
    return isLoopbackHostname(new URL(normalized).hostname);
  } catch {
    return false;
  }
}

function pickPublicBaseUrl(value: string | undefined) {
  const normalized = normalizeUrl(value);
  if (!normalized || isLoopbackHost(normalized)) return "";
  return normalized;
}

export function getPublicAppUrl() {
  const publicAppUrl = pickPublicBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (publicAppUrl) return publicAppUrl;

  const publicSiteUrl = pickPublicBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (publicSiteUrl) return publicSiteUrl;

  const siteUrl = pickPublicBaseUrl(process.env.SITE_URL);
  if (siteUrl) return siteUrl;

  const nextAuthUrl = normalizeUrl(process.env.NEXTAUTH_URL);
  if (nextAuthUrl && !isLoopbackHost(nextAuthUrl)) return nextAuthUrl;

  const vercelProductionUrl = normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelProductionUrl) return vercelProductionUrl;

  const vercelUrl = normalizeUrl(process.env.VERCEL_URL);
  if (vercelUrl) return vercelUrl;

  if (nextAuthUrl) return nextAuthUrl;

  return "http://localhost:3000";
}

export function toAbsoluteAppUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl = getPublicAppUrl();
  return new URL(path.startsWith("/") ? path : `/${path}`, `${baseUrl}/`).toString();
}
