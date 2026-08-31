import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import HootContextMenu, { type HootMenuState } from "@/components/h00t/H00tContextMenu";
import {
  asciiMotionClass,
  computePupilOffset,
  eyeGlowColor,
  isEyeGlowChar,
  moodColor,
  moodFrameInterval,
  renderBrandLines,
  BEAK_GLYPH_COL,
  BROW_L_COL,
  BROW_R_COL,
  EYE_L_COL,
  EYE_R_COL,
  GRAND_CENTER_COL,
  GRAND_EYE_L_COL,
  GRAND_EYE_R_COL,
  THIRD_EYE_COL,
  type HootMood,
  type HootMoodContext,
  type PupilOffset,
} from "./h00t-ascii";
import {
  ARCADE_BEAK_COL,
  ARCADE_EYE_L_COL,
  ARCADE_EYE_R_COL,
  HOOT_FACE_STYLE_META,
  NEON_BEAK_COL,
  NEON_EYE_L_COL,
  NEON_EYE_R_COL,
  NEON_THIRD_COL,
  PRISM_BEAK_COL,
  PRISM_EYE_L_COL,
  PRISM_EYE_R_COL,
  PRISM_THIRD_COL,
  SENTINEL_BEAK_COL,
  SENTINEL_EYE_L_COL,
  SENTINEL_EYE_R_COL,
  TUFTED_BEAK_COL,
  TUFTED_EYE_L_COL,
  TUFTED_EYE_R_COL,
  TUFTED_THIRD_COL,
  ROUND_BEAK_COL,
  ROUND_EYE_L_COL,
  ROUND_EYE_R_COL,
  BARN_BEAK_COL,
  BARN_EYE_L_COL,
  BARN_EYE_R_COL,
  DUSK_BEAK_COL,
  DUSK_EYE_L_COL,
  DUSK_EYE_R_COL,
  faceContext,
  nextFaceStyle,
  persistHootFaceStyle,
  readStoredHootFaceStyle,
  renderFaceLines,
  type HootFaceStyle,
} from "./h00t-face-styles";

const LINE_COLOR = "#E8D5A3";
const DIM_COLOR = "rgba(232,213,163,0.55)";

export type HootLogoProps = {
  mood: HootMood;
  moodContext?: HootMoodContext;
  size?: number;
  showWordmark?: boolean;
  showSubtitle?: boolean;
  frame?: number;
  statusLine?: string | null;
  onClick?: () => void;
  className?: string;
  trackMouse?: boolean;
  /** @deprecated Use faceStyle */
  variant?: HootFaceStyle;
  faceStyle?: HootFaceStyle;
};

const ZERO_OFFSET: PupilOffset = { lx: 0, ly: 0, rx: 0, ry: 0 };

type GlowLayout = {
  eyeRow: number;
  eyeCols: number[];
  beakRow: number;
  beakCol: number;
  cascadeRow?: number;
  cascadeCols?: number[];
  spineRows?: number[];
  spineCol?: number;
};

const GLOW_LAYOUT: Record<HootFaceStyle, GlowLayout> = {
  compact: {
    eyeRow: 1,
    eyeCols: [EYE_L_COL, EYE_R_COL],
    beakRow: 2,
    beakCol: BEAK_GLYPH_COL,
    cascadeRow: 0,
    cascadeCols: [BROW_L_COL, THIRD_EYE_COL, BROW_R_COL],
  },
  tufted: {
    eyeRow: 1,
    eyeCols: [TUFTED_EYE_L_COL, TUFTED_EYE_R_COL],
    beakRow: 2,
    beakCol: TUFTED_BEAK_COL,
    cascadeRow: 0,
    cascadeCols: [TUFTED_THIRD_COL, 2, 8],
  },
  round: {
    eyeRow: 1,
    eyeCols: [ROUND_EYE_L_COL, ROUND_EYE_R_COL],
    beakRow: 2,
    beakCol: ROUND_BEAK_COL,
    cascadeRow: 0,
    cascadeCols: [4, 5, 6],
  },
  barn: {
    eyeRow: 1,
    eyeCols: [BARN_EYE_L_COL, BARN_EYE_R_COL],
    beakRow: 2,
    beakCol: BARN_BEAK_COL,
    cascadeRow: 0,
    cascadeCols: [2, 3, 4, 5, 6, 7, 8],
  },
  dusk: {
    eyeRow: 1,
    eyeCols: [DUSK_EYE_L_COL, DUSK_EYE_R_COL],
    beakRow: 2,
    beakCol: DUSK_BEAK_COL,
    cascadeRow: 0,
    cascadeCols: [4, 5, 6],
  },
  grand: {
    eyeRow: 2,
    eyeCols: [GRAND_EYE_L_COL, GRAND_EYE_R_COL],
    beakRow: 3,
    beakCol: GRAND_CENTER_COL,
    spineRows: [1, 2, 6, 7],
    spineCol: GRAND_CENTER_COL,
  },
  neon: {
    eyeRow: 2,
    eyeCols: [NEON_EYE_L_COL, NEON_EYE_R_COL],
    beakRow: 3,
    beakCol: NEON_BEAK_COL,
    cascadeRow: 0,
    cascadeCols: [NEON_THIRD_COL],
  },
  arcade: {
    eyeRow: 1,
    eyeCols: [ARCADE_EYE_L_COL, ARCADE_EYE_R_COL],
    beakRow: 2,
    beakCol: ARCADE_BEAK_COL,
    cascadeRow: 0,
    cascadeCols: [3, 4, 5, 6, 7],
  },
  sentinel: {
    eyeRow: 2,
    eyeCols: [SENTINEL_EYE_L_COL, SENTINEL_EYE_R_COL],
    beakRow: 3,
    beakCol: SENTINEL_BEAK_COL,
    cascadeRow: 0,
    cascadeCols: [5, 6, 7, 8, 9],
  },
  prism: {
    eyeRow: 1,
    eyeCols: [PRISM_EYE_L_COL, PRISM_EYE_R_COL],
    beakRow: 2,
    beakCol: PRISM_BEAK_COL,
    cascadeRow: 0,
    cascadeCols: [PRISM_THIRD_COL, 4, 6],
  },
};

function colorizeLine(
  line: string,
  mood: HootMood,
  frame: number,
  row: number,
  isWordmarkLine: boolean,
  fixedCells: boolean,
  faceStyle: HootFaceStyle,
): ReactNode[] {
  const glow = eyeGlowColor(mood);
  const pulse = 0.75 + Math.sin(frame * 0.4) * 0.25;
  const layout = GLOW_LAYOUT[faceStyle];
  let inEyes = false;

  return line.split("").map((ch, i) => {
    if (ch === "(" || ch === "[") inEyes = true;
    const isEye = inEyes && isEyeGlowChar(ch);
    if (ch === ")" || ch === "]") inEyes = false;

    let color = LINE_COLOR;
    let shadow: string | undefined;
    let weight: number | undefined;

    if (isEye) {
      color = glow;
      shadow = `0 0 ${6 + pulse * 6}px ${glow}, 0 0 2px #FFF176`;
      weight = 600;
    } else if (
      ch === "@" ||
      ch === "?" ||
      ch === ">" ||
      ch === "~" ||
      ch === "=" ||
      ch === "ΓùÄ" ||
      ch === "Γùå" ||
      ch === "Γùç" ||
      ch === "Γÿà"
    ) {
      const phaseHue =
        ch === "@"
          ? "#FFF176"
          : ch === "?"
            ? "#c4b5fd"
            : ch === ">"
              ? "#4ade80"
              : ch === "~"
                ? "#93c5fd"
                : ch === "Γùå" || ch === "Γùç"
                  ? "#c084fc"
                  : ch === "Γÿà"
                    ? "#fcd34d"
                    : "#f59e0b";
      color = phaseHue;
      shadow = `0 0 ${6 + pulse * 6}px ${phaseHue}, 0 0 2px ${phaseHue}`;
      weight = 700;
    } else if (ch === "Γûê" || ch === "Γûô" || ch === "ΓûÆ") {
      color = "#ffb042";
      shadow = `0 0 ${4 + pulse * 4}px rgba(255,176,66,0.55)`;
      weight = 700;
    } else if (ch === "Γûá" || ch === "Γûí") {
      color = ch === "Γûá" ? "#4ade80" : DIM_COLOR;
      weight = 600;
    } else if (faceStyle === "neon" && (ch === "+" || ch === "Γöé" || ch === "|")) {
      color = "#67e8f9";
      shadow = `0 0 ${4 + pulse * 4}px rgba(103,232,249,0.45)`;
    } else if (isWordmarkLine) {
      color = LINE_COLOR;
      weight = 700;
    } else if (ch === "Γû╜" || ch === "v") {
      color = "#ffb042";
      weight = 600;
    } else if (ch === " ") {
      color = "transparent";
    } else if (/[|_\\/\\^ΓöÇΓÇ╛]/.test(ch)) {
      color = DIM_COLOR;
    }

    const isEyeGlyph = row === layout.eyeRow && layout.eyeCols.includes(i) && isEyeGlowChar(ch);
    const isCascadeFlank =
      layout.cascadeRow === row &&
      layout.cascadeCols?.includes(i) &&
      ch !== "_" &&
      ch !== "┬╖" &&
      ch !== " " &&
      ch !== "Γûê" &&
      ch !== "Γûô" &&
      ch !== "ΓûÆ" &&
      ch !== "Γùå" &&
      ch !== "Γùç" &&
      ch !== "ΓöÇ" &&
      ch !== "Γûá" &&
      ch !== "Γûí";
    const isBeakEmit =
      row === layout.beakRow &&
      i === layout.beakCol &&
      ch !== "Γû╜" &&
      ch !== "┬╖" &&
      ch !== "Γùç" &&
      ch !== " ";
    const isSpineEmit =
      layout.spineRows?.includes(row) &&
      i === layout.spineCol &&
      ch !== " " &&
      ch !== "_" &&
      ch !== "=" &&
      ch !== "v" &&
      ch !== "V";

    return (
      <span
        key={`${row}-${i}`}
        className={[
          fixedCells ? "hoot-ascii-cell" : undefined,
          isEyeGlyph ? "hoot-ascii-eye-glyph" : undefined,
          isCascadeFlank ? "hoot-ascii-emit-glyph" : undefined,
          isBeakEmit || isSpineEmit ? "hoot-ascii-beak-emit hoot-ascii-emit-glyph" : undefined,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          color: ch === " " ? "transparent" : color,
          textShadow: shadow,
          fontWeight: weight ?? (fixedCells ? 500 : undefined),
        }}
      >
        {ch === " " ? "\u00a0" : ch}
      </span>
    );
  });
}

function AsciiBlock({
  lines,
  mood,
  frame,
  wordmarkStart,
  fixedCells,
  faceStyle,
}: {
  lines: string[];
  mood: HootMood;
  frame: number;
  wordmarkStart: number;
  fixedCells: boolean;
  faceStyle: HootFaceStyle;
}) {
  return (
    <>
      {lines.map((line, row) => (
        <div key={row} className="hoot-ascii-line" aria-hidden={row >= wordmarkStart}>
          {colorizeLine(line, mood, frame, row, row >= wordmarkStart, fixedCells, faceStyle)}
        </div>
      ))}
    </>
  );
}

/** ASCII HOOT logo ΓÇö frame sprites, per-char eye glow, optional mouse tracking */
export default function HootLogo({
  mood,
  moodContext,
  size = 72,
  showWordmark = false,
  frame: frameProp,
  statusLine,
  onClick,
  className,
  trackMouse = true,
  variant,
  faceStyle: faceStyleProp = "grand",
}: HootLogoProps) {
  const ref = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const [frameInternal, setFrameInternal] = useState(0);
  const [offset, setOffset] = useState<PupilOffset>(ZERO_OFFSET);
  const [menu, setMenu] = useState<HootMenuState | null>(null);
  const [paused, setPaused] = useState(false);
  const [stylePref, setStylePref] = useState<HootFaceStyle | null>(() => readStoredHootFaceStyle());
  const frozenFrame = useRef(0);

  const liveFrame = frameProp ?? frameInternal;
  if (!paused) frozenFrame.current = liveFrame;
  const frame = paused ? frozenFrame.current : liveFrame;
  const effectiveStyle = stylePref ?? variant ?? faceStyleProp;
  const styleMeta = HOOT_FACE_STYLE_META[effectiveStyle];
  const ctx = faceContext(mood, moodContext);

  const allLines = showWordmark
    ? renderBrandLines(mood, offset, frame)
    : renderFaceLines(effectiveStyle, mood, ctx, offset, frame, statusLine);

  const faceRowCount = showWordmark ? allLines.length : styleMeta.faceRows;
  const faceLines = showWordmark ? allLines : allLines.slice(0, faceRowCount);
  const captionLine =
    !showWordmark && styleMeta.hasCaption && allLines.length > faceRowCount ? allLines[faceRowCount] : null;
  const lines = showWordmark ? allLines : faceLines;

  const lineCount = showWordmark ? allLines.length : faceRowCount;
  const fontSize = showWordmark ? size / (lineCount + 1) : size / (lineCount - 0.05);
  const wordmarkStart = showWordmark ? allLines.length - 2 : faceRowCount;
  const gridWidth = styleMeta.width;
  const layout = GLOW_LAYOUT[effectiveStyle];

  useEffect(() => {
    if (frameProp !== undefined || paused) return;
    const ms =
      effectiveStyle === "compact"
        ? moodFrameInterval(mood, true)
        : styleMeta.tickMs || moodFrameInterval(mood, false);
    const id = setInterval(() => setFrameInternal((f) => f + 1), ms);
    return () => clearInterval(id);
  }, [frameProp, mood, showWordmark, effectiveStyle, styleMeta.tickMs, paused]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!trackMouse || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setOffset(
        computePupilOffset(e.clientX, e.clientY, rect.left + rect.width / 2, rect.top + rect.height * 0.35),
      );
    },
    [trackMouse],
  );

  const onMouseLeave = useCallback(() => setOffset(ZERO_OFFSET), []);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (showWordmark) return;
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY });
    },
    [showWordmark],
  );

  const cycleFaceStyle = useCallback(() => {
    const next = nextFaceStyle(effectiveStyle);
    setStylePref(next);
    persistHootFaceStyle(next);
  }, [effectiveStyle]);

  const copySnapshot = useCallback(() => {
    navigator.clipboard?.writeText(allLines.join("\n")).catch(() => {});
  }, [allLines]);

  const copyStatus = useCallback(() => {
    const report =
      `HOOT ${styleMeta.label} face ┬╖ mood: ${mood}` + (statusLine ? ` ┬╖ ${statusLine}` : "");
    navigator.clipboard?.writeText(report).catch(() => {});
  }, [styleMeta.label, mood, statusLine]);

  const style: CSSProperties = {
    margin: 0,
    padding: showWordmark ? "10px 12px" : "2px 4px",
    border: "none",
    background: showWordmark ? "rgba(18,18,18,0.92)" : "transparent",
    borderRadius: showWordmark ? 12 : 8,
    cursor: onClick ? "pointer" : "default",
    fontFamily: "'Fira Code', 'Cascadia Mono', 'Consolas', monospace",
    fontSize,
    lineHeight: 1,
    letterSpacing: 0,
    color: moodColor(mood),
    textAlign: "center",
    position: "relative",
    overflow:
      className?.includes("hoot-deck-owl") || className?.includes("hoot-float-owl") ? "visible" : "hidden",
    boxShadow: showWordmark ? "inset 0 0 0 1px rgba(232,213,163,0.08)" : undefined,
  };

  const motionClass = showWordmark ? asciiMotionClass(mood) : styleMeta.motionClass;
  const beakRow = faceLines[layout.beakRow] ?? "";
  const beakGlyph = beakRow[layout.beakCol] ?? "";
  const hasEmit = Boolean(!showWordmark && beakGlyph && beakGlyph !== "Γû╜" && beakGlyph !== "┬╖" && beakGlyph !== "Γùç");
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      ref={ref as never}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onContextMenu={onContextMenu}
      className={[className, "hoot-ascii", motionClass, hasEmit ? "hoot-ascii--emit" : ""].filter(Boolean).join(" ")}
      style={style}
      aria-label="HOOT"
    >
      {(mood === "scanning" || mood === "syncing" || mood === "monitoring" || mood === "watchful" || mood === "logging") &&
        !showWordmark && <span className="hoot-ascii-scan" aria-hidden />}
      <div
        className="hoot-ascii-face-grid"
        style={{ width: `${gridWidth}ch`, minWidth: `${gridWidth}ch`, fontSize, lineHeight: 1 }}
      >
        <AsciiBlock
          lines={lines}
          mood={mood}
          frame={frame}
          wordmarkStart={wordmarkStart}
          fixedCells={!showWordmark}
          faceStyle={effectiveStyle}
        />
      </div>
      {menu && (
        <HootContextMenu
          menu={menu}
          paused={paused}
          faceStyle={effectiveStyle}
          onClose={() => setMenu(null)}
          onTogglePause={() => setPaused((v) => !v)}
          onCycleFaceStyle={cycleFaceStyle}
          onCopySnapshot={copySnapshot}
          onCopyStatus={copyStatus}
        />
      )}
      {captionLine && (
        <div
          className="hoot-ascii-caption"
          style={{ fontSize: Math.max(7, fontSize * 0.58), lineHeight: 1.1, marginTop: 2, opacity: 0.5 }}
          aria-hidden
        >
          {captionLine.trim()}
        </div>
      )}
    </Tag>
  );
}
