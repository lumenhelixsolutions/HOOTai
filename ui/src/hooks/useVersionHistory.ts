import { useEffect, useState } from "react";

const STORAGE_KEY = "hoot_version_history";

export interface VersionEntry {
  display: string;
  headline?: string | null;
  seenAt: string;
}

/**
 * Track HOOT version upgrades client-side.
 * Returns the list of previously seen versions plus a function to record the
 * current version. The newest entry is at the front.
 */
export function useVersionHistory(current?: { display: string; changelog_headline?: string | null } | null): {
  history: VersionEntry[];
  record: () => void;
  isNew: boolean;
} {
  const [history, setHistory] = useState<VersionEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as VersionEntry[];
        setHistory(Array.isArray(parsed) ? parsed.slice(0, 20) : []);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const record = () => {
    if (!current?.display) return;
    setHistory((prev) => {
      const next: VersionEntry = {
        display: current.display,
        headline: current.changelog_headline,
        seenAt: new Date().toISOString(),
      };
      const filtered = prev.filter((e) => e.display !== current.display);
      const updated = [next, ...filtered].slice(0, 20);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        /* storage unavailable */
      }
      return updated;
    });
  };

  const isNew = Boolean(current?.display && history.length > 0 && history[0].display !== current.display);

  return { history, record, isNew };
}
