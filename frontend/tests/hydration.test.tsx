import React, { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { useApi } from "../components/ui";

it("hydrates streamed API consumers even if the shell has already filled their cache", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  function Consumer() {
    const query = useApi<{ title: string }>("/hydration-regression");
    return <p>{query.isPending ? "Loading" : query.data?.title}</p>;
  }
  const tree = (
    <QueryClientProvider client={client}>
      <Consumer />
    </QueryClientProvider>
  );
  const container = document.createElement("div");
  container.innerHTML = renderToString(tree);
  expect(container.textContent).toBe("Loading");
  // Another hydrated component can resolve this same query while the page streams.
  client.setQueryData(["/hydration-regression"], { title: "Cached article" });
  document.body.append(container);
  const errors: unknown[] = [];
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, tree, {
      onRecoverableError: (error) => errors.push(error),
    });
  });
  expect(errors).toEqual([]);
  expect(container.textContent).toBe("Cached article");
  await act(async () => root.unmount());
  container.remove();
  client.clear();
});
