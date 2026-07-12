/**
 * Copies HOOT documentation into ui/public/docs for Vite to bundle into dist/docs/.
 * Generates manifest.json for the in-app Documentation browser.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(UI_ROOT, "..");
const OUT_DIR = path.join(UI_ROOT, "public", "docs");

function readRepoVersion() {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, "VERSION"), "utf8").trim().split("\n")[0];
  } catch {
    return "0.0.0";
  }
}

/** @type {Array<{ src: string; dest: string; title: string; category: string; description?: string }>} */
const ENTRIES = [
  { src: "README.md", dest: "README.md", title: "HOOT Operator Guide", category: "Guides", description: "Install, usage, API, architecture, and deployment." },
  { src: "docs/AI_COACH.md", dest: "AI_COACH.md", title: "AI Coach", category: "Guides", description: "Proactive hints, chat runtime, pageContext, and coach actions." },
  { src: "docs/CHATBOT_BUILDER.md", dest: "CHATBOT_BUILDER.md", title: "Chatbot Builder", category: "Guides", description: "assistant-ui stack and HOOT chat integration." },
  { src: "docs/UIUX_EVOLUTION_PLAN.md", dest: "UIUX_EVOLUTION_PLAN.md", title: "UI/UX Evolution", category: "Plans", description: "Design direction for HOOT command center screens." },
  { src: "docs/plans/2026-06-11-cooldown-command-deck-visual-monitor-plan.md", dest: "plans/cooldown-command-deck.md", title: "Command Deck", category: "Plans", description: "Cooldown gauges, popout monitor, context radar, handoffs." },
  { src: "docs/plans/2026-06-11-hybrid-workspace-cooldown-monitor-plan.md", dest: "plans/hybrid-workspace.md", title: "Hybrid Workspace", category: "Plans", description: "Workspace roots, provider matrix, and cooldown settings." },
  { src: "docs/plans/2026-06-10-activity-diary-radar-telemetry-v2-plan.md", dest: "plans/activity-diary.md", title: "Activity Diary", category: "Plans", description: "Session diary, radar history, and telemetry calendar." },
  { src: "docs/plans/2026-06-10-hoot-local-operator.md", dest: "plans/local-operator.md", title: "Local Operator", category: "Plans", description: "Operator loop and local-first workflows." },
  { src: "docs/plans/2026-06-10-prefab-inventory-and-hoot-emotions.md", dest: "plans/prefab-inventory.md", title: "Prefab Inventory", category: "Plans", description: "Module packs, skills catalog, and HOOT emotions." },
  { src: "docs/plans/2026-06-10-hoot-load-performance-plan.md", dest: "plans/load-performance.md", title: "Load Performance", category: "Plans", description: "Coach context slimming and chat performance." },
  { src: "docs/plans/2026-06-11-hoot-cognitive-ascii-animation-plan.md", dest: "plans/ascii-animation.md", title: "ASCII Owl Animation", category: "Plans", description: "Cognitive ASCII owl moods and animations." },
  { src: "docs/plans/2026-06-08-agentdock-ui-architecture-brief.md", dest: "plans/ui-architecture.md", title: "UI Architecture", category: "Plans", description: "React shell, routing, and widget layout." },
  { src: "docs/plans/2026-06-08-agentdock-profile-summary-and-10-milestones.md", dest: "plans/milestones.md", title: "Milestones", category: "Plans", description: "Profile taxonomy and milestone roadmap." },
  { src: "docs/plans/2026-06-10-agentdock-next-milestone-and-graphify-assessment.md", dest: "plans/next-milestone.md", title: "Next Milestone", category: "Plans", description: "Graphify assessment and upcoming work." },
  { src: "docs/plans/2026-06-10-project-brain-schema-all-6-repos.md", dest: "plans/project-brain.md", title: "Project Brain", category: "Plans", description: "Cross-repo brain schema and handoff packets." },
  { src: "docs/plans/ce-dashboard-ui-integration.md", dest: "plans/ce-dashboard.md", title: "CE Dashboard", category: "Plans", description: "Compound Engineering dashboard integration." },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDoc(entry) {
  const srcPath = path.join(REPO_ROOT, entry.src);
  const destPath = path.join(OUT_DIR, entry.dest);
  if (!fs.existsSync(srcPath)) {
    console.warn(`[bundle-docs] skip missing: ${entry.src}`);
    return null;
  }
  ensureDir(path.dirname(destPath));
  fs.copyFileSync(srcPath, destPath);
  const stat = fs.statSync(destPath);
  return {
    id: entry.dest.replace(/\.md$/i, "").replace(/\//g, "-"),
    path: `/docs/${entry.dest}`,
    title: entry.title,
    category: entry.category,
    description: entry.description || "",
    bytes: stat.size,
    updated_at: stat.mtime.toISOString(),
  };
}

export function bundleDocs() {
  ensureDir(OUT_DIR);
  const manifest = {
    generated_at: new Date().toISOString(),
    version: readRepoVersion(),
    docs: ENTRIES.map(copyDoc).filter(Boolean),
  };
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`[bundle-docs] ${manifest.docs.length} docs → ${OUT_DIR}`);
  return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  bundleDocs();
}