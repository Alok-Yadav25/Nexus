"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, CornerDownLeft, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
export function SearchBox({
  large = false,
  onNavigate,
  initialQuery = "",
}: {
  large?: boolean;
  onNavigate?: () => void;
  initialQuery?: string;
}) {
  const router = useRouter();
  const listId = "suggestions-" + useId().replace(/:/g, "");
  const [q, setQ] = useState(initialQuery);
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLFormElement>(null);
  useEffect(() => {
    setQ(initialQuery);
    setActive(-1);
    setOpen(false);
  }, [initialQuery]);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 180);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    const hide = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", hide);
    return () => document.removeEventListener("mousedown", hide);
  }, []);
  const suggestions = useQuery<{ id: string; name: string; slug: string }[]>({
    queryKey: ["suggestions", debounced],
    queryFn: ({ signal }) =>
      api("/search/suggestions?q=" + encodeURIComponent(debounced), { signal }),
    enabled: debounced.length > 0,
  });
  function go(slug?: string) {
    setOpen(false);
    onNavigate?.();
    router.push(
      slug ? "/article/" + slug : "/search?q=" + encodeURIComponent(q.trim()),
    );
  }
  return (
    <form
      className={"search-box " + (large ? "large" : "")}
      ref={root}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim().length >= 1)
          go(
            open && debounced === q && active >= 0
              ? suggestions.data?.[active]?.slug
              : undefined,
          );
      }}
    >
      <Search size={large ? 23 : 17} />
      <input
        aria-label="Search all knowledge"
        placeholder={
          large ? "What would you like to understand?" : "Search knowledge…"
        }
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape" || e.key === "Tab") {
            setOpen(false);
            setActive(-1);
          }
          if (e.key === "ArrowDown") {
            setOpen(true);
            e.preventDefault();
            setActive((n) =>
              Math.min(n + 1, (suggestions.data?.length || 0) - 1),
            );
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((n) => Math.max(-1, n - 1));
          }
        }}
        maxLength={240}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && q.length > 0}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={
          open && debounced === q && active >= 0 && suggestions.data?.[active]
            ? `${listId}-${suggestions.data[active].id}`
            : undefined
        }
      />
      {q && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => {
            setQ("");
            setActive(-1);
            setOpen(false);
            root.current?.querySelector("input")?.focus();
          }}
        >
          <X size={15} />
        </button>
      )}
      {large ? (
        <button aria-label="Run search" disabled={q.trim().length < 1}>
          <ArrowRight size={20} />
        </button>
      ) : (
        <CornerDownLeft size={14} />
      )}{" "}
      {open && q.length > 0 && (
        <div className="suggestions" id={listId} role="listbox">
          {(debounced === q ? suggestions.data : [])?.map((s, i) => (
            <button
              role="option"
              id={`${listId}-${s.id}`}
              tabIndex={-1}
              aria-selected={active === i}
              type="button"
              className={active === i ? "active" : ""}
              key={s.id}
              onClick={() => go(s.slug)}
            >
              <Search size={14} />
              {s.name}
              <ArrowRight size={14} />
            </button>
          ))}
          {suggestions.isFetching && <p>Looking up entities…</p>}
          {suggestions.isError && (
            <p>Suggestions unavailable. Press Enter to search.</p>
          )}
          {suggestions.data?.length === 0 && (
            <p>Press Enter to search all Wikipedia subjects.</p>
          )}
        </div>
      )}
    </form>
  );
}
