function normalizeUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") || "";
}

function isLoopbackHost(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function getPublicAppUrl() {
  const publicAppUrl = normalizeUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (publicAppUrl) return publicAppUrl;

  const publicSiteUrl = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (publicSiteUrl) return publicSiteUrl;

  const siteUrl = normalizeUrl(process.env.SITE_URL);
  if (siteUrl) return siteUrl;

  const nextAuthUrl = normalizeUrl(process.env.NEXTAUTH_URL);
  if (nextAuthUrl && !isLoopbackHost(nextAuthUrl)) return nextAuthUrl;

  const vercelProductionUrl = normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelProductionUrl) {
    return /^https?:\/\//i.test(vercelProductionUrl)
      ? vercelProductionUrl
      : `https://${vercelProductionUrl}`;
  }

  const vercelUrl = normalizeUrl(process.env.VERCEL_URL);
  if (vercelUrl) {
    return /^https?:\/\//i.test(vercelUrl) ? vercelUrl : `https://${vercelUrl}`;
  }

  if (nextAuthUrl) return nextAuthUrl;

  return "http://localhost:3000";
}

export function toAbsoluteAppUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl = getPublicAppUrl();
  return new URL(path.startsWith("/") ? path : `/${path}`, `${baseUrl}/`).toString();
}
