import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { getTheme, onThemeChange, setTheme, type Theme } from "@/lib/theme";
import { tooltipTitle } from "@/lib/tooltips";

/**
 * Dark/light theme toggle. Dark is HOOT's default identity; light is the
 * `.light` class on <html> (token overrides in index.css). Persisted in
 * localStorage, restored pre-paint by main.tsx, synced with the command
 * palette via lib/theme events.
 */
export default function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [theme, setLocal] = useState<Theme>(getTheme);

  useEffect(() => onThemeChange(setLocal), []);

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`${tooltipTitle("shell.theme")} · Switch to ${next}`}
      className={`flex w-full items-center gap-2 border-t border-border bg-transparent px-4 py-3 text-muted-foreground ${collapsed ? "justify-center" : "justify-end"}`}
    >
      {!collapsed && (
        <span className="text-[11px] uppercase tracking-[0.14em] opacity-50">
          {theme === "dark" ? "Dark" : "Light"}
        </span>
      )}
      {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
