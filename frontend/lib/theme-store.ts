import { create } from "zustand";
type Theme = "dark" | "light";
function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `nexus-theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  try {
    localStorage.setItem("nexus-theme", theme);
  } catch {}
}
export const useThemeStore = create<{
  theme: Theme;
  hydrate: () => void;
  toggle: () => void;
}>((set, get) => ({
  theme: "dark",
  hydrate() {
    const theme: Theme =
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
    set({ theme });
  },
  toggle() {
    const theme = get().theme === "light" ? "dark" : "light";
    set({ theme });
    apply(theme);
  },
}));
