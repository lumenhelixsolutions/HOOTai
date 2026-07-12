/** Brand-style mark centered inside cooldown gauge rings. */

const PROVIDER_MARKS: Record<
  string,
  { color: string; paths?: string; label?: string; fill?: boolean }
> = {
  claude: {
    color: "#d97706",
    paths: "M12 2l1.2 4.8L18 8l-4.8 1.2L12 14l-1.2-4.8L6 8l4.8-1.2L12 2z",
    fill: true,
  },
  chatgpt: {
    color: "#10a37f",
    paths:
      "M12 3c-3.5 0-6.5 2.2-6.5 5.2 0 2.1 1.2 3.9 3.1 4.8-.4 1.1-.9 2.1-1.6 3 2.4-.5 4.3-1.8 5.5-3.5 2.8.3 4.9-1.6 4.9-4.3C17 5.2 14.7 3 12 3z",
    fill: true,
  },
  gemini: {
    color: "#60a5fa",
    paths: "M12 4l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.2l5-.7L12 4z",
    fill: true,
  },
  kimi: {
    color: "#f472b6",
    paths: "M7 8c0-2.8 2.2-5 5-5s5 2.2 5 5c0 3.5-5 9-5 9s-5-5.5-5-9z",
    fill: true,
  },
  deepseek: {
    color: "#6366f1",
    paths: "M6 16c2-4 4-8 6-10 2 2 4 6 6 10-2.5-1.5-5-2-6-2s-3.5.5-6 2z",
    fill: true,
  },
  perplexity: {
    color: "#22d3ee",
    paths:
      "M8 6h8v2H8V6zm0 4h8v2H8v-2zm0 4h5v2H8v-2z M17 6h2v12h-2V6z",
    fill: true,
  },
  ollama: {
    color: "#a78bfa",
    paths:
      "M8 10c0-2.2 1.8-4 4-4s4 1.8 4 4v1c1.1.5 2 1.7 2 3v3H6v-3c0-1.3.9-2.5 2-3v-1zm4-2.5a2.5 2.5 0 0 0-2.5 2.5h5A2.5 2.5 0 0 0 12 7.5z",
    fill: true,
  },
  llamacpp: {
    color: "#fb923c",
    label: "L",
  },
};

type Props = {
  provider: string;
  size?: number;
  dimmed?: boolean;
  className?: string;
};

export default function ProviderDialMark({ provider, size = 12, dimmed = false, className = "" }: Props) {
  const id = provider.toLowerCase();
  const mark = PROVIDER_MARKS[id] || { color: "#9ca3af", label: id.slice(0, 1).toUpperCase() };

  if (mark.label) {
    return (
      <span
        className={`font-bold leading-none ${className}`}
        style={{
          fontSize: Math.max(6, Math.round(size * 0.72)),
          color: mark.color,
          opacity: dimmed ? 0.45 : 1,
        }}
        aria-hidden="true"
      >
        {mark.label}
      </span>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ opacity: dimmed ? 0.45 : 1, display: "block" }}
      aria-hidden="true"
    >
      <path d={mark.paths} fill={mark.fill ? mark.color : "none"} stroke={mark.fill ? "none" : mark.color} strokeWidth={mark.fill ? 0 : 2} />
    </svg>
  );
}