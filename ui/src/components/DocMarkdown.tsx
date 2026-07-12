import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => <h1 className="mb-4 font-serif text-2xl font-semibold text-foreground">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-3 mt-8 font-serif text-xl font-semibold text-foreground">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-6 text-base font-semibold text-foreground">{children}</h3>,
  p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-foreground/85">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-foreground/80">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-foreground/80">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} className="text-[#ffb042] underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const inline = !className;
    if (inline) {
      return <code className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[12px] text-emerald-200/90">{children}</code>;
    }
    return <code className={`block overflow-x-auto rounded-xl border border-border bg-black/40 p-4 font-mono text-[12px] leading-relaxed text-emerald-200/90 ${className || ""}`}>{children}</code>;
  },
  pre: ({ children }) => <pre className="mb-4">{children}</pre>,
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-border bg-foreground/5 px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border/60 px-3 py-2 text-foreground/80">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-2 border-[#ffb042]/40 pl-4 text-sm italic text-foreground/70">{children}</blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  strong: ({ children }) => <strong className="font-semibold text-[#ffb042]">{children}</strong>,
};

export default function DocMarkdown({ content }: { content: string }) {
  return (
    <article className="docs-markdown max-w-3xl">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  );
}