export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = 65000, ...request } = options || {};
  const controller = new AbortController();
  const abort = () => controller.abort(request.signal?.reason);
  if (request.signal?.aborted) abort();
  else request.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(request.headers);
    if (request.method && !["GET", "HEAD"].includes(request.method)) {
      const tokenResponse = await fetch("/api/v1/auth/csrf", {
        credentials: "include",
        signal: controller.signal,
      });
      if (!tokenResponse.ok)
        throw new ApiError(
          "Unable to establish a secure session",
          tokenResponse.status,
        );
      const token = (await tokenResponse.json()) as { token: string };
      headers.set("X-CSRF-TOKEN", token.token);
      headers.set("Content-Type", "application/json");
    }
    controller.signal.throwIfAborted();
    const response = await fetch("/api/v1" + path, {
      ...request,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const body = await response.json();
        if (typeof body.error === "string") message = body.error;
      } catch {}
      throw new ApiError(message, response.status);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (controller.signal.aborted && !request.signal?.aborted)
      throw new ApiError("The request took too long. Please try again.", 408);
    throw error;
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", abort);
  }
}
export function date(value: string | undefined | null) {
  return value
    ? new Date(value).toLocaleDateString("en", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Date not recorded";
}
export function label(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}
export const ONTOLOGIES = [
  "UNCLASSIFIED",
  "Planet",
  "ChemicalCompound",
  "CelestialObject",
  "Food",
  "BiologicalEntity",
  "ChemicalElement",
  "Material",
  "Technology",
  "ScientificTheory",
  "MathematicalConcept",
  "Person",
  "Organization",
  "Place",
  "Event",
  "Publication",
  "HistoricalConcept",
  "FictionalEntity",
  "FictionalLocation",
  "HypotheticalTechnology",
];
