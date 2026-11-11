"use client";
import { useEffect, useRef, type ReactNode } from "react";
let count = 0;
let priorOverflow = "";
export function Dialog({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    if (count++ === 0) {
      priorOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialog.showModal();
    (dialog.querySelector('[role="combobox"]') as HTMLElement | null)?.focus();
    return () => {
      dialog.close();
      if (--count === 0) document.body.style.overflow = priorOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`native-dialog ${drawer ? "evidence-drawer native-drawer" : "command-dialog"}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            close.current();
        }
      }}
    >
      {children}
    </dialog>
  );
}
