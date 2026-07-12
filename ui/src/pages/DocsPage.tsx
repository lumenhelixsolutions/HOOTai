import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, ExternalLink, FileText, Search } from "lucide-react";
import DocMarkdown from "@/components/DocMarkdown";
import HelpTooltip from "@/components/HelpTooltip";
import { getTooltip } from "@/lib/tooltips";
import { Panel } from "@/components/dashboard/primitives";

type DocEntry = {
  id: string;
  path: string;
  title: string;
  category: string;
  description: string;
  bytes: number;
  updated_at: string;
};

type DocsManifest = {
  generated_at: string;
  version: string;
  docs: DocEntry[];
};

const CATEGORIES = ["Guides", "Plans"] as const;

export default function DocsPage() {
  const [params, setParams] = useSearchParams();
  const [manifest, setManifest] = useState<DocsManifest | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const selectedPath = params.get("doc") || "/docs/README.md";

  useEffect(() => {
    fetch("/docs/manifest.json")
      .then((r) => {
        if (!r.ok) throw new Error("Documentation manifest not found — rebuild the UI.");
        return r.json();
      })
      .then(setManifest)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load docs manifest"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPath) return;
    setLoading(true);
    setError(null);
    fetch(selectedPath)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load ${selectedPath}`);
        return r.text();
      })
      .then(setContent)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load document"))
      .finally(() => setLoading(false));
  }, [selectedPath]);

  const filtered = useMemo(() => {
    if (!manifest) return [];
    const q = query.trim().toLowerCase();
    if (!q) return manifest.docs;
    return manifest.docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
    );
  }, [manifest, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, DocEntry[]>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const doc of filtered) {
      const list = map.get(doc.category) || map.get("Plans")!;
      list.push(doc);
    }
    return map;
  }, [filtered]);

  const current = manifest?.docs.find((d) => d.path === selectedPath);

  const openDoc = (path: string) => {
    setParams({ doc: path });
  };

  const docsTip = getTooltip("nav.docs");

  return (
    <div className="grid gap-[18px] xl:grid-cols-[280px_1fr]">
      <Panel title="Documentation" subtitle="Bundled with every HOOT build" icon={BookOpen}>
        <div className="mb-3 flex items-center gap-2">
          <Search size={14} className="shrink-0 opacity-45" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides and plans…"
            className="w-full rounded-lg border border-border bg-transparent px-2.5 py-2 text-sm outline-none placeholder:opacity-45"
          />
          <HelpTooltip {...docsTip} size={12} />
        </div>

        {manifest && (
          <div className="mb-3 font-mono text-[10px] opacity-40">
            {manifest.docs.length} docs · built {new Date(manifest.generated_at).toLocaleString()}
          </div>
        )}

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {CATEGORIES.map((cat) => {
            const items = grouped.get(cat) || [];
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div className="mb-2 text-[10px] uppercase tracking-[0.16em] opacity-45">{cat}</div>
                <div className="space-y-1">
                  {items.map((doc) => {
                    const active = doc.path === selectedPath;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => openDoc(doc.path)}
                        className={`flex w-full flex-col rounded-xl border px-3 py-2.5 text-left transition ${
                          active ? "hoot-gold-chip" : "border-border hover:bg-foreground/[0.03]"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <FileText size={13} className={active ? "hoot-gold-text" : "opacity-50"} />
                          {doc.title}
                        </div>
                        {doc.description && (
                          <div className="mt-1 text-[11px] leading-snug opacity-55">{doc.description}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        title={current?.title || "Document"}
        subtitle={current ? `${current.category} · ${(current.bytes / 1024).toFixed(1)} KB` : "Select a document"}
        icon={FileText}
      >
        {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        {loading && !content && <div className="text-sm opacity-55">Loading…</div>}
        {!loading && content && <DocMarkdown content={content} />}
        {current && (
          <div className="mt-6 flex items-center gap-3 border-t border-border pt-4 text-xs opacity-50">
            <a href={current.path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#ffb042] hover:underline">
              Open raw markdown <ExternalLink size={12} />
            </a>
            <span>Updated {new Date(current.updated_at).toLocaleDateString()}</span>
          </div>
        )}
      </Panel>
    </div>
  );
}