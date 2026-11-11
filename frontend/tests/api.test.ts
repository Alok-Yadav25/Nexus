import { afterEach, describe, expect, it, vi } from "vitest";
import { api, label } from "../lib/api";
afterEach(() => vi.unstubAllGlobals());
describe("API contract", () => {
  it("fetches CSRF before a mutation and preserves the session", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "token-1" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true })));
    vi.stubGlobal("fetch", fetch);
    await expect(api("/articles/id/save", { method: "POST" })).resolves.toEqual(
      { saved: true },
    );
    const options = fetch.mock.calls[1][1];
    expect(options.headers.get("X-CSRF-TOKEN")).toBe("token-1");
    expect(options.credentials).toBe("include");
  });
  it("preserves backend errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Sign in to continue" }), {
          status: 401,
        }),
      ),
    );
    await expect(api("/dashboard")).rejects.toThrow("Sign in to continue");
  });
  it("never sends a mutation after CSRF initialization fails", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    await expect(api("/research", { method: "POST" })).rejects.toThrow(
      "secure session",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("normalizes labels without inventing statuses", () => {
    expect(label("REVIEW_REQUIRED")).toBe("Review required");
  });
  it("forwards cancellation to an in-flight request", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          ),
      ),
    );
    const result = api("/encyclopedia/search?q=granite", {
      signal: controller.signal,
    });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
  it("ends requests that exceed their deadline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          ),
      ),
    );
    await expect(
      api("/encyclopedia/search?q=granite", { timeoutMs: 10 }),
    ).rejects.toMatchObject({ status: 408 });
  });
});
