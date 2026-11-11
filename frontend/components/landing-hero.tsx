"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Menu,
  Moon,
  Network,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import type { ArticleCard, GraphData, User } from "@/lib/types";
import { useThemeStore } from "@/lib/theme-store";
import { SearchBox } from "./search";
import { GraphSketch } from "./knowledge-graph";
import { useApi } from "./ui";
import styles from "./landing-hero.module.css";
import { NexusWordmark } from "./nexus-wordmark";

function ChromeFallback() {
  return (
    <svg
      viewBox="0 0 400 400"
      className={styles.chromeFallback}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="nexus-chrome-face" x1="0" y1="0" x2=".85" y2="1">
          <stop stopColor="#fafaff" />
          <stop offset=".25" stopColor="#a29cb7" />
          <stop offset=".48" stopColor="#f1f0f7" />
          <stop offset=".57" stopColor="#5a526d" />
          <stop offset=".82" stopColor="#24202f" />
          <stop offset="1" stopColor="#b7afce" />
        </linearGradient>
        <linearGradient id="nexus-chrome-edge" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f5f1ff" />
          <stop offset=".32" stopColor="#17111f" />
          <stop offset=".72" stopColor="#4b3e69" />
          <stop offset="1" stopColor="#dfdaf0" />
        </linearGradient>
      </defs>
      <g transform="translate(200 200) rotate(-16) translate(-200 -200)">
        <path
          d="M200 34C224 140 260 176 366 200C260 224 224 260 200 366C176 260 140 224 34 200C140 176 176 140 200 34Z"
          transform="translate(8 15)"
          fill="#160e27"
          opacity=".65"
        />
        <path
          d="M200 34C224 140 260 176 366 200C260 224 224 260 200 366C176 260 140 224 34 200C140 176 176 140 200 34Z"
          fill="url(#nexus-chrome-face)"
          stroke="url(#nexus-chrome-edge)"
          strokeWidth="5"
        />
        <path
          d="M200 39C222 141 259 179 357 201"
          fill="none"
          stroke="#fff"
          strokeOpacity=".78"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
const Sculpture = dynamic(() => import("./hero-sculpture"), {
  ssr: false,
  loading: () => <ChromeFallback />,
});
const cardNames = ["NEXUS core", "Featured article", "Knowledge universe"];

export function LandingHero({
  articles,
  graph,
  loading,
  error,
  retry,
}: {
  articles: ArticleCard[];
  graph?: GraphData;
  loading: boolean;
  error: boolean;
  retry: () => unknown;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [visible, setVisible] = useState(true);
  const [menu, setMenu] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const me = useApi<User>("/auth/me");
  const light = useThemeStore((s) => s.theme) === "light";
  const toggleTheme = useThemeStore((s) => s.toggle);
  const featured = articles.find((a) => a.slug === "lithium") || articles[0];
  const animate =
    ready &&
    !reduceMotion &&
    !paused &&
    !hovering &&
    visible &&
    documentVisible;

  useEffect(() => {
    setReady(true);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.12 },
    );
    if (stage.current) observer.observe(stage.current);
    const update = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    if (!animate) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % 3),
      4800,
    );
    return () => window.clearInterval(timer);
  }, [animate]);

  function focusSearch() {
    setMenu(false);
    search.current?.scrollIntoView({
      behavior: reduceMotion ? "instant" : "smooth",
      block: "center",
    });
    search.current?.querySelector("input")?.focus({ preventScroll: true });
  }
  function selectCard(index: number) {
    setActive(index);
    setPaused(true);
  }
  function slot(index: number) {
    const position = (index - active + 3) % 3;
    return position === 0 ? "center" : position === 1 ? "right" : "left";
  }
  return (
    <section
      className={styles.hero}
      aria-label="Explore the NEXUS knowledge universe"
    >
      <header className={styles.header}>
        <nav className={styles.navigation} aria-label="Landing navigation">
          <Link href="/" className={styles.brand} aria-label="NEXUS home">
            <NexusWordmark />
          </Link>
          <div className={`${styles.links} ${menu ? styles.menuOpen : ""}`}>
            <Link href="/explore">Explore</Link>
            <Link href="/discover">Discover</Link>
            <Link href="/graph">Knowledge graph</Link>
            <Link href="/research">Research Lab</Link>
            <button onClick={focusSearch}>
              <Search size={12} />
              Search
            </button>
          </div>
          <button
            className={styles.theme}
            onClick={toggleTheme}
            aria-label="Toggle color theme"
          >
            {light ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <Link
            className={styles.getStarted}
            href={me.data?.authenticated ? "/dashboard" : "/auth"}
          >
            {me.data?.authenticated ? "Your workspace" : "Get started"}
            <ArrowUpRight size={13} />
          </Link>
          <button
            className={styles.menuToggle}
            onClick={() => setMenu(!menu)}
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
          >
            {menu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>
      </header>

      <div className={styles.heroMain}>
        <div className={styles.heroEditorial}>
          <div className={styles.intro}>
            <span className={styles.introDot} /> AN OPEN UNIVERSE OF IDEAS
          </div>
          <h1 className={styles.headline}>
            Explore
            <br />
            everything<span>.</span>
          </h1>
          <div className={styles.copy}>
            <p>
              From a single atom to the ideas that changed the world.
              <br className={styles.desktopBreak} /> A place for every kind of
              curiosity.
            </p>
          </div>
          <div ref={search} id="nexus-search" className={styles.search}>
            <SearchBox large />
          </div>
          <div className={styles.topics}>
            <span>Follow a curiosity</span>
            {[
              { title: "Minerals", query: "quartz" },
              { title: "Culture", query: "Breaking Bad" },
              { title: "The universe", query: "Universe" },
            ].map((topic) => (
              <Link
                key={topic.title}
                href={"/search?q=" + encodeURIComponent(topic.query)}
              >
                {topic.title}
                <ArrowUpRight size={12} />
              </Link>
            ))}
          </div>
          <div className={styles.editorialNote}>
            <span>01 / ENDLESS DISCOVERY</span>
            <span>Original sources. Connected ideas.</span>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div
            className={styles.stage}
            ref={stage}
            onPointerEnter={() => setHovering(true)}
            onPointerLeave={() => setHovering(false)}
            onFocusCapture={() => setHovering(true)}
            onBlurCapture={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setHovering(false);
            }}
          >
            <div className={styles.stageGlow} aria-hidden="true" />
            <div className={styles.orbit} data-paused={!animate}>
              <article
                className={`${styles.card} ${styles.coreCard}`}
                data-slot={slot(0)}
                aria-label="NEXUS core card"
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardPill}>
                    <span />
                    Nexus Core
                  </span>
                  <span className={styles.cardEdition}>
                    CONNECTED KNOWLEDGE
                  </span>
                </div>
                <div className={styles.sculpture}>
                  <Sculpture
                    animate={animate && active === 0}
                    fallback={<ChromeFallback />}
                  />
                </div>
                <div className={styles.coreCopy}>
                  <span className={styles.cardEyebrow}>
                    CURIOSITY IS ONLY THE BEGINNING.
                  </span>
                  <h2>
                    Knowledge,
                    <br />
                    in a new light.
                  </h2>
                  <Link href="/explore" className={styles.coreLink}>
                    Enter the encyclopedia
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
                <span className={styles.cardSerial}>NX / 01</span>
              </article>
              <article
                className={`${styles.card} ${styles.articleCard}`}
                data-slot={slot(1)}
                aria-label="Featured article card"
              >
                <div className={styles.cardTop}>
                  <span className={styles.articleKicker}>
                    <BookOpen size={12} />
                    THE ENCYCLOPEDIA
                  </span>
                  <ArrowUpRight size={15} />
                </div>
                <div className={styles.elementArtwork} aria-hidden="true">
                  <div className={styles.elementOrbit} />
                  <div className={styles.elementOrbit} />
                  <div className={styles.elementOrbit} />
                  <span className={styles.elementNucleus} />
                  <i />
                  <i />
                  <i />
                </div>
                {featured ? (
                  <div className={styles.articleCopy}>
                    <span className={styles.cardEyebrow}>
                      {featured.domain} ·{" "}
                      {featured.ontology.replace(/([a-z])([A-Z])/g, "$1 $2")}
                    </span>
                    <h2>{featured.title}</h2>
                    <p>{featured.summary}</p>
                    <Link
                      href={`/article/${featured.slug}`}
                      className={styles.articleLink}
                    >
                      Follow the idea
                      <ArrowUpRight size={15} />
                    </Link>
                  </div>
                ) : (
                  <div className={styles.articleCopy}>
                    <span className={styles.cardEyebrow}>
                      SOURCE-BACKED ARTICLES
                    </span>
                    <h2>
                      {loading
                        ? "Connecting\nthe library."
                        : "A place for\nyour next idea."}
                    </h2>
                    <p>
                      {error
                        ? "The library is temporarily unavailable."
                        : "Discover published knowledge and inspect its original sources."}
                    </p>
                    {error ? (
                      <button
                        onClick={() => retry()}
                        className={styles.articleLink}
                      >
                        Retry connection
                        <ArrowRight size={15} />
                      </button>
                    ) : (
                      <Link href="/explore" className={styles.articleLink}>
                        Explore the library
                        <ArrowUpRight size={15} />
                      </Link>
                    )}
                  </div>
                )}
                <span className={styles.articleSerial}>NX / 02</span>
              </article>
              <article
                className={`${styles.card} ${styles.graphCard}`}
                data-slot={slot(2)}
                aria-label="Knowledge universe card"
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardPill}>Knowledge Universe</span>
                  <Network size={16} />
                </div>
                <div className={styles.miniGraph}>
                  {graph ? (
                    <GraphSketch data={graph} />
                  ) : (
                    <div className={styles.graphPlaceholder}>
                      <Network size={54} />
                      <span>Connections begin with evidence.</span>
                    </div>
                  )}
                </div>
                <div className={styles.graphCopy}>
                  <span className={styles.cardEyebrow}>
                    FOLLOW THE CONNECTION.
                  </span>
                  <h2>
                    One idea.
                    <br />A whole universe.
                  </h2>
                  <Link href="/graph" className={styles.graphLink}>
                    Open the knowledge graph
                    <ArrowUpRight size={15} />
                  </Link>
                </div>
                <span className={styles.cardSerial}>NX / 03</span>
              </article>
            </div>
            <div className={styles.stageCaption}>
              <span>IDEAS DON'T EXIST IN ISOLATION.</span>
              <span>NEITHER SHOULD YOUR CURIOSITY.</span>
            </div>
          </div>

          <div
            className={styles.controls}
            aria-label="Featured knowledge cards"
          >
            <div className={styles.cardSelectors}>
              {cardNames.map((name, index) => (
                <button
                  key={name}
                  onClick={() => selectCard(index)}
                  className={active === index ? styles.activeSelector : ""}
                  aria-label={`Show ${name} card`}
                  aria-pressed={active === index}
                >
                  <span />
                </button>
              ))}
            </div>
            <button
              className={styles.playback}
              onClick={() => setPaused(!paused)}
              aria-label={
                paused ? "Play hero animation" : "Pause hero animation"
              }
            >
              {paused ? <Play size={11} /> : <Pause size={11} />}
            </button>
          </div>
        </div>
      </div>
      <div className={styles.heroFoot}>
        <Link href="/methodology">
          <ShieldCheck size={13} />
          Curiosity, with evidence.
          <ArrowUpRight size={12} />
        </Link>
        <a href="#knowledge-library" className={styles.scrollCue}>
          KEEP EXPLORING
          <ArrowDown size={13} />
        </a>
        <span>
          AN OPEN UNIVERSE OF IDEAS <span className={styles.footStar}>✦</span>
        </span>
      </div>
    </section>
  );
}
