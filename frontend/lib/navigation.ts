/** Only same-site absolute paths can be used as authentication return destinations. */
export function safeReturnPath(
  value: string | null | undefined,
  fallback = "/dashboard",
) {
  if (!value || value.length > 2000) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      /[\\\\\u0000-\u001f]/.test(decoded)
    )
      return fallback;
    const url = new URL(value, "https://nexus.invalid");
    if (
      url.origin !== "https://nexus.invalid" ||
      /^\/auth(?:\/|$)/.test(url.pathname)
    )
      return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
