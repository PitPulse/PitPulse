function normalizeSiteUrl(rawUrl: string) {
  const withProtocol = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
    ? rawUrl
    : `https://${rawUrl}`;
  const parsed = new URL(withProtocol);
  const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

  if (!isLocalHost) {
    parsed.protocol = "https:";
  }

  return parsed.origin;
}

export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return normalizeSiteUrl(explicit);
  }

  const vercelProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProdUrl) {
    return normalizeSiteUrl(vercelProdUrl);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return normalizeSiteUrl(vercelUrl);
  }

  const port = process.env.PORT?.trim() || "3000";
  return `http://localhost:${port}`;
}
