"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Atom,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Compass,
  FlaskConical,
  GitCompareArrows,
  Github,
  House,
  LayoutDashboard,
  Library,
  Menu,
  Moon,
  Network,
  PanelLeftClose,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { SearchBox } from "./search";
import { Dialog } from "./dialog";
import { useContentMotion } from "./content-motion";
import motionStyles from "./content-motion.module.css";
import { useThemeStore } from "@/lib/theme-store";
import { useApi } from "./ui";
import type { User } from "@/lib/types";
import { NexusWordmark } from "./nexus-wordmark";
const nav = [
  { label: "Overview", href: "/", icon: House },
  { label: "Interactive labs", href: "/labs", icon: Atom },
  { label: "Knowledge Journey", href: "/journeys", icon: Compass },
  { label: "Explore knowledge", href: "/explore", icon: Compass },
  { label: "Discover connections", href: "/discover", icon: Atom },
  { label: "Knowledge graph", href: "/graph", icon: Network },
  { label: "Research Lab", href: "/research", icon: FlaskConical },
  { label: "Compare concepts", href: "/compare", icon: GitCompareArrows },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const content = useContentMotion(path);
  const [mobile, setMobile] = useState(false);
  const [command, setCommand] = useState(false);
  const [compact, setCompact] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const light = useThemeStore((s) => s.theme) === "light";
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const theme = useThemeStore((s) => s.toggle);
  const me = useApi<User>("/auth/me");
  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);
  useEffect(() => {
    setMobile(false);
  }, [path]);
  useEffect(() => {
    const query = matchMedia("(max-width: 760px)");
    const update = () => {
      setCompact(query.matches);
      if (!query.matches) setMobile(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!compact || !mobile) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled)",
        ) || [],
      ).filter((element) => element.getClientRects().length);
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", trap);
      mobileTrigger.current?.focus({ preventScroll: true });
    };
  }, [compact, mobile]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommand((v) => !v);
        setMobile(false);
      }
      if (e.key === "Escape") {
        setCommand(false);
        setMobile(false);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <div className={`app-shell ${path === "/" ? "landing-shell" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobile && (
        <div className="mobile-scrim" onClick={() => setMobile(false)} />
      )}
      <aside
        ref={sidebar}
        id="workspace-navigation"
        onClick={(event) => {
          if ((event.target as Element).closest("a[href]")) setMobile(false);
        }}
        className={"sidebar " + (mobile ? "open" : "")}
        inert={compact && !mobile}
        aria-hidden={compact && !mobile ? true : undefined}
      >
        <Link className="brand" href="/" aria-label="NEXUS home">
          <NexusWordmark />
        </Link>
        <div className="sidebar-caption">A UNIVERSE OF KNOWLEDGE</div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <Link
              className={
                "nav-link " +
                (path === n.href || (n.href !== "/" && path.startsWith(n.href))
                  ? "selected"
                  : "")
              }
              href={n.href}
              key={n.href}
            >
              <n.icon size={18} />
              {n.label}
              {n.href === "/research" && (
                <span className="small-pill">LAB</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="nav-label library-label">YOUR LIBRARY</div>
        <nav>
          <Link
            className={
              "nav-link " + (path === "/reading-list" ? "selected" : "")
            }
            href="/reading-list"
          >
            <Bookmark size={18} />
            Reading list
          </Link>
          <Link
            className={
              "nav-link " + (path === "/collections" ? "selected" : "")
            }
            href="/collections"
          >
            <Library size={18} />
            Collections
          </Link>
          <Link
            className={"nav-link " + (path === "/dashboard" ? "selected" : "")}
            href="/dashboard"
          >
            <LayoutDashboard size={18} />
            Your dashboard
          </Link>
          {["ADMIN", "REVIEWER"].includes(me.data?.role || "") && (
            <Link className="nav-link" href="/admin">
              <ShieldCheck size={18} />
              Administration
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="trust-note">
            <ShieldCheck size={18} />
            <strong>Curiosity, with evidence.</strong>
            <p>Follow every idea back to its source.</p>
            <Link href="/methodology">
              Our methodology <ArrowUpRight size={12} />
            </Link>
          </div>
          <Link className="nav-link" href="/documentation">
            <BookOpen size={17} />
            Documentation
            <ArrowUpRight size={13} />
          </Link>
          <div className="sidebar-foot">
            <span className="mono">NEXUS / KNOWLEDGE ENGINE</span>
            <button onClick={() => setMobile(false)} aria-label="Close sidebar">
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={compact && mobile}>
        <header className="topbar">
          <button
            ref={mobileTrigger}
            className="mobile-menu icon-button"
            onClick={() => setMobile(!mobile)}
            aria-label="Open navigation"
            aria-controls="workspace-navigation"
            aria-expanded={mobile}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>
              {path === "/"
                ? "Overview"
                : path
                    .split("/")[1]
                    .replaceAll("-", " ")
                    .replace(/^./, (c) => c.toUpperCase())}
            </strong>
          </div>
          <div className="topbar-actions">
            <button
              className="command-button"
              aria-label="Search anything"
              onClick={() => setCommand(true)}
            >
              <Search size={15} />
              <span>Search anything</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button"
              onClick={theme}
              aria-label="Toggle color theme"
            >
              {light ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <Link
              className="avatar"
              href={me.data?.authenticated ? "/dashboard" : "/auth"}
              aria-label={me.data?.authenticated ? "Your profile" : "Sign in"}
            >
              {me.data?.email?.[0]?.toUpperCase() || <UserRound size={17} />}
            </Link>
          </div>
        </header>
        <main
          ref={content}
          id="main-content"
          tabIndex={-1}
          className={motionStyles.content}
        >
          {children}
        </main>
        <footer className="footer">
          <span>Explore everything. Understand how it connects.</span>
          <div>
            <Link href="/about">About NEXUS</Link>
            <Link href="/methodology">Evidence & trust</Link>
            <a
              className="footer-credit"
              href="https://github.com/Alok-Yadav25"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Alok Yadav on GitHub"
            >
              <Github size={16} aria-hidden="true" />
              <span>Alok Yadav</span>
            </a>
            <span className="mono">OPEN KNOWLEDGE, CONNECTED.</span>
          </div>
        </footer>
      </div>
      {command && (
        <Dialog title="Global search" onClose={() => setCommand(false)}>
          <div className="dialog-title">
            <strong>Search the knowledge universe</strong>
            <button
              className="icon-button"
              aria-label="Close search"
              onClick={() => setCommand(false)}
            >
              <X size={18} />
            </button>
          </div>
          <SearchBox large onNavigate={() => setCommand(false)} />
          <p className="muted">Search by concept, name, or entity alias.</p>
        </Dialog>
      )}
    </div>
  );
}
