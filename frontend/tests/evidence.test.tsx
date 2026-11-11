import { afterEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Evidence } from "../components/workspaces";
import React from "react";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("renders real response excerpts and an honest empty contradictory state", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "claim-1",
          text: "A claim from the API.",
          status: "UNVERIFIED",
          rationale: "Independent verification is not established.",
          sources: [
            {
              id: "source-1",
              url: "https://arxiv.org/abs/2201.11123",
              title: "Primary source",
              publisher: "arXiv",
              source_type: "PREPRINT",
              retrieved_at: "2026-11-10T00:00:00Z",
              published_at: null,
              license: "See original",
              excerpt: "Exact source excerpt.",
              stance: "SUPPORTS",
            },
          ],
        }),
      ),
    ),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Evidence claimId="claim-1" />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("A claim from the API.")).toBeTruthy();
  expect(screen.getByText("Exact source excerpt.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Filter evidence"), {
    target: { value: "CONTRADICTS" },
  });
  expect(screen.getByText(/does not establish that none exists/)).toBeTruthy();
  expect(screen.queryByText("Exact source excerpt.")).toBeNull();
});
