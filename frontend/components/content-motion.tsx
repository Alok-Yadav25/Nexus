"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// A streamed page must finish hydration before observers add motion attributes.
export function ContentMotionBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <div data-content-ready={ready}>{children}</div>;
}

// Only content regions opt in. The landing hero is outside every region below.
const region = ".landing-content, .page, .article-page";
const entrances =
  ".page-heading, .article-title-row, .section-heading, .article-card, .stat, .domain-card, .how-grid > div, .discovery-banner, .learning-entries > a";
const surfaces =
  ".article-card, .domain-card, .how-grid > div, .learning-entries > a";

export function useContentMotion(route: string) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const container = root.current;
    if (!container || !("IntersectionObserver" in window)) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const registered = new Set<HTMLElement>();
    const animations = new Set<Animation>();
    let pointerCard: HTMLElement | null = null;
    let pointerBounds: DOMRect | null = null;
    let pointerFrame = 0;
    let pendingPointer: { target: Element; x: number; y: number } | null = null;
    let lastPointer: { x: number; y: number } | null = null;
    let scanFrame = 0;
    const pendingScopes = new Set<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          if (element.hasAttribute("data-ambient-motion")) {
            element.dataset.inView = String(entry.isIntersecting);
          }
          if (
            !entry.isIntersecting ||
            element.dataset.revealed ||
            !element.matches(entrances)
          )
            continue;
          element.dataset.revealed = "true";
          if (!element.hasAttribute("data-ambient-motion"))
            observer.unobserve(element);
          if (preference.matches || typeof element.animate !== "function")
            continue;
          const siblings = [...(element.parentElement?.children || [])].filter(
            (child) => child.matches(entrances),
          );
          const delay =
            Math.min(Math.max(siblings.indexOf(element), 0), 3) * 28;
          const animation = element.animate(
            [
              {
                opacity: 0,
                translate: "0 16px",
              },
              {
                opacity: 1,
                translate: "0 0",
              },
            ],
            {
              duration: 420,
              delay,
              easing: "cubic-bezier(.22, 1, .36, 1)",
              fill: "both",
            },
          );
          animations.add(animation);
          animation.onfinish = () => {
            animation.cancel();
            animations.delete(animation);
          };
        }
      },
      { threshold: 0.02, rootMargin: "0px 0px 72px 0px" },
    );

    function scan(scope: Element = container!) {
      const selector = `${entrances}, [data-ambient-motion]`;
      const elements = [...scope.querySelectorAll<HTMLElement>(selector)];
      if (scope instanceof HTMLElement && scope.matches(selector))
        elements.unshift(scope);
      elements.forEach((element) => {
        if (
          !element.closest(region) ||
          !element.closest('[data-content-ready="true"]') ||
          registered.has(element)
        )
          return;
        registered.add(element);
        if (element.matches(surfaces)) element.dataset.motionCard = "";
        observer.observe(element);
      });
      // Release removed API results rather than retaining an ever-growing set.
      for (const element of registered)
        if (!container!.contains(element)) {
          observer.unobserve(element);
          registered.delete(element);
        }
    }
    function resetPointer() {
      pendingPointer = null;
      cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      if (!pointerCard) return;
      for (const name of ["--tilt-x", "--tilt-y", "--pointer-x", "--pointer-y"])
        pointerCard.style.removeProperty(name);
      pointerCard = null;
      pointerBounds = null;
    }
    function move(event: PointerEvent) {
      if (preference.matches || !finePointer.matches) return;
      lastPointer = { x: event.clientX, y: event.clientY };
      pendingPointer = {
        target: event.target as Element,
        x: event.clientX,
        y: event.clientY,
      };
      if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointer);
    }
    function updatePointerBounds() {
      pointerBounds = null;
      if (!lastPointer || preference.matches || !finePointer.matches) return;
      const target = document.elementFromPoint(lastPointer.x, lastPointer.y);
      if (!target || !container!.contains(target)) {
        resetPointer();
        return;
      }
      pendingPointer = { target, ...lastPointer };
      if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointer);
    }
    function leave() {
      lastPointer = null;
      resetPointer();
    }
    function applyPointer() {
      pointerFrame = 0;
      if (!pendingPointer || preference.matches) return;
      const { target, x: clientX, y: clientY } = pendingPointer;
      pendingPointer = null;
      const card = target.closest<HTMLElement>("[data-motion-card]");
      if (!card || !container!.contains(card)) {
        resetPointer();
        return;
      }
      if (pointerCard !== card) {
        resetPointer();
        pointerCard = card;
      }
      const bounds =
        pointerBounds || (pointerBounds = card.getBoundingClientRect());
      const x = Math.max(
        0,
        Math.min(1, (clientX - bounds.left) / bounds.width),
      );
      const y = Math.max(
        0,
        Math.min(1, (clientY - bounds.top) / bounds.height),
      );
      card.style.setProperty("--tilt-x", `${(0.5 - y) * 3}deg`);
      card.style.setProperty("--tilt-y", `${(x - 0.5) * 3}deg`);
      card.style.setProperty("--pointer-x", `${x * 100}%`);
      card.style.setProperty("--pointer-y", `${y * 100}%`);
    }
    function updatePreference() {
      container!.dataset.contentMotion = preference.matches
        ? "reduced"
        : "full";
      if (preference.matches) {
        animations.forEach((animation) => animation.cancel());
        animations.clear();
        resetPointer();
      }
    }
    updatePreference();
    scan();
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes")
          pendingScopes.add(record.target as Element);
        else
          record.addedNodes.forEach((node) => {
            if (node instanceof Element) pendingScopes.add(node);
          });
      }
      if (!scanFrame)
        scanFrame = requestAnimationFrame(() => {
          scanFrame = 0;
          for (const scope of pendingScopes)
            if (container.contains(scope)) scan(scope);
          pendingScopes.clear();
          for (const element of registered)
            if (!container.contains(element)) {
              observer.unobserve(element);
              registered.delete(element);
            }
        });
    });
    mutations.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-content-ready"],
    });
    preference.addEventListener("change", updatePreference);
    container.addEventListener("pointermove", move, { passive: true });
    container.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", updatePointerBounds, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", updatePointerBounds);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(pointerFrame);
      cancelAnimationFrame(scanFrame);
      resetPointer();
      animations.forEach((animation) => animation.cancel());
      preference.removeEventListener("change", updatePreference);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", updatePointerBounds, true);
      window.removeEventListener("resize", updatePointerBounds);
      registered.forEach((element) => {
        delete element.dataset.motionCard;
        delete element.dataset.revealed;
        delete element.dataset.inView;
      });
    };
  }, [route]);
  return root;
}
