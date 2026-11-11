"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Copy,
  Minus,
  Plus,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { date } from "@/lib/api";
import { readWiki, type WikiArticle } from "@/lib/encyclopedia";
import {
  READING_LIST_EVENT,
  READING_LIST_KEY,
  readReadingList,
  removeReading,
  saveReading,
  updateReadingProgress,
  type SavedReading,
} from "@/lib/reading-list";
import { Empty, Loading, PageHeading } from "./ui";
import styles from "./reading-workspace.module.css";

function useReadingList() {
  const [items, setItems] = useState<SavedReading[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    function load() {
      try {
        setItems(readReadingList());
        setError("");
      } catch {
        setError(
          "Browser storage is unavailable. Saving and reading progress need storage access on this device.",
        );
      }
      setReady(true);
    }
    const storage = (event: StorageEvent) => {
      if (event.key === READING_LIST_KEY || event.key === null) load();
    };
    load();
    window.addEventListener(READING_LIST_EVENT, load);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(READING_LIST_EVENT, load);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return { items, ready, error };
}

export function ReaderTools({
  article,
  onFontSizeChange,
}: {
  article: WikiArticle;
  onFontSizeChange: (size: number) => void;
}) {
  const list = useReadingList();
  const saved = list.items.find((item) => item.id === article.id);
  const [font, setFont] = useState(16);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [copyFallback, setCopyFallback] = useState(false);
  const resume = useSearchParams().get("resume") === "1";
  const restored = useRef(false);
  const latest = useRef({ progress: 0, anchor: "" });
  const citation = `${article.attribution}. “${article.title}.” Wikipedia, revision ${article.revisionId}. ${article.revisionUrl}. Retrieved ${date(article.retrievedAt)}.`;
  useEffect(() => {
    try {
      const value = Number(localStorage.getItem("nexus-reader-font"));
      if (value >= 14 && value <= 22) {
        setFont(value);
        onFontSizeChange(value);
      }
    } catch {}
  }, [onFontSizeChange]);
  useEffect(() => {
    if (!list.ready || restored.current) return;
    restored.current = true;
    if (!resume || !saved || location.hash) return;
    const target = saved.anchor && document.getElementById(saved.anchor);
    if (target) target.scrollIntoView({ behavior: "instant" });
    else if (saved.progress > 0) {
      const content = document.getElementById("wiki-content");
      if (content)
        window.scrollTo({
          top: Math.max(
            0,
            content.getBoundingClientRect().top +
              scrollY +
              (Math.max(0, content.offsetHeight - innerHeight + 100) *
                saved.progress) /
                100 -
              100,
          ),
          behavior: "instant",
        });
    }
  }, [list.ready, resume, saved]);
  useEffect(() => {
    const content = document.getElementById("wiki-content");
    if (!content) return;
    const headings = article.toc
      .map((item) => document.getElementById(item.id))
      .filter((item): item is HTMLElement => !!item);
    let frame = 0;
    let lastWrite = Date.now();
    let storageFailed = false;
    function persist() {
      if (!saved || storageFailed) return;
      try {
        updateReadingProgress(
          article.id,
          latest.current.progress,
          latest.current.anchor,
        );
      } catch {
        storageFailed = true;
        setMessage("Reading progress could not be saved on this device.");
      }
    }
    function measure() {
      frame = 0;
      const rect = content!.getBoundingClientRect();
      const percent = Math.round(
        Math.max(
          0,
          Math.min(
            1,
            (100 - rect.top) / Math.max(1, rect.height - innerHeight + 100),
          ),
        ) * 100,
      );
      let anchor = "";
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= 120) anchor = heading.id;
        else break;
      }
      latest.current = { progress: percent, anchor };
      setProgress(percent);
      if (Date.now() - lastWrite > 1000) {
        lastWrite = Date.now();
        persist();
      }
    }
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const hide = () => {
      if (document.hidden) persist();
    };
    measure();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    document.addEventListener("visibilitychange", hide);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
      document.removeEventListener("visibilitychange", hide);
      persist();
    };
  }, [article.id, article.toc, !!saved]);
  function changeFont(value: number) {
    setFont(value);
    onFontSizeChange(value);
    try {
      localStorage.setItem("nexus-reader-font", String(value));
    } catch {
      setMessage(
        "Text size applies for this visit; browser storage is unavailable.",
      );
    }
  }
  async function copyCitation() {
    try {
      await navigator.clipboard.writeText(citation);
      setMessage("Citation copied.");
      setCopyFallback(false);
    } catch {
      setCopyFallback(true);
      setMessage("Select and copy the citation below.");
    }
  }
  function toggleSave() {
    try {
      if (saved) {
        removeReading(article.id);
        setMessage("Removed from your reading list.");
      } else {
        saveReading(article);
        setMessage(
          "Saved on this device. Reading progress will be kept as you read.",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "This article could not be saved on this device.",
      );
    }
  }
  return (
    <section className={styles.readerTools} aria-label="Reading tools">
      <div className={styles.toolbar}>
        <button
          className="button secondary"
          onClick={toggleSave}
          disabled={!list.ready || !!list.error}
          aria-pressed={!!saved}
        >
          {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}{" "}
          {saved ? "Saved for later" : "Save for later"}
        </button>
        <button className="button secondary" onClick={copyCitation}>
          <Copy size={15} /> Copy citation
        </button>
        <div
          className={styles.textControls}
          role="group"
          aria-label="Article text size"
        >
          <button
            onClick={() => changeFont(Math.max(14, font - 2))}
            disabled={font <= 14}
            aria-label="Smaller article text"
          >
            <Minus size={15} />
          </button>
          <output aria-label="Article text size">{font}px</output>
          <button
            onClick={() => changeFont(Math.min(22, font + 2))}
            disabled={font >= 22}
            aria-label="Larger article text"
          >
            <Plus size={15} />
          </button>
        </div>
        <Link href="/reading-list">
          Reading list <ArrowRight size={14} />
        </Link>
      </div>
      <div className={styles.progress}>
        <progress
          max={100}
          value={progress}
          aria-label="Article reading progress"
        />
        <span>{progress}% read</span>
        <span>Saved items stay in this browser</span>
      </div>
      <p className={styles.message} role="status">
        {list.error || message}
      </p>
      {copyFallback && (
        <label>
          Copy this citation
          <textarea
            readOnly
            value={citation}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
    </section>
  );
}

export function ReadingList() {
  const list = useReadingList();
  const [message, setMessage] = useState("");
  return (
    <div className="page">
      <PageHeading
        eyebrow="YOUR NEXT DISCOVERY"
        title="A little room for later."
        description="Save Wikipedia articles and return to where you stopped. This list is stored only in this browser; an internet connection is needed to reopen articles."
      />
      <p className={styles.message} role="status">
        {message || list.error}
      </p>
      {!list.ready ? (
        <Loading />
      ) : list.items.length ? (
        <div className={styles.savedGrid}>
          {list.items.map((item) => (
            <article className={styles.savedCard} key={item.id}>
              <div className="eyebrow cyan">
                WIKIPEDIA · SAVED {date(item.savedAt)}
              </div>
              <h2>
                <Link href={readWiki(item.title)}>{item.title}</Link>
              </h2>
              <progress
                max={100}
                value={item.progress}
                aria-label={`${item.title} reading progress`}
              />
              <p>
                {item.progress}% read · revision {item.revisionId}
              </p>
              <div className={styles.savedActions}>
                <Link
                  className="button primary"
                  href={readWiki(item.title) + "&resume=1"}
                >
                  {item.progress > 0 ? "Resume reading" : "Start reading"}
                  <ArrowRight size={14} />
                </Link>
                <button
                  className="icon-button"
                  aria-label={`Remove ${item.title} from reading list`}
                  onClick={() => {
                    try {
                      removeReading(item.id);
                      setMessage(`${item.title} removed.`);
                    } catch {
                      setMessage("Could not update this reading list.");
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Keep your next discovery close"
          text="Open a Wikipedia article and choose Save for later. Saved articles will appear here."
          action={
            <Link href="/explore" className="button primary">
              Explore all subjects <ArrowRight size={15} />
            </Link>
          }
        />
      )}
    </div>
  );
}
