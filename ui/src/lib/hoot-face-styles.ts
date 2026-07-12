import {
  GRAND_FACE_ROWS,
  GRAND_TICK_MS,
  GRAND_WIDTH,
  HOOT_FACE_ROWS,
  WIDTH,
  healthFromContext,
  minimalMoodContext,
  peekCognitiveFace,
  renderCompactLines,
  renderGrandLines,
  resolveHootEmotion,
  type HootMood,
  type HootMoodContext,
  type PupilOffset,
} from "./hoot-ascii";

export type HootFaceStyle =
  | "grand"
  | "compact"
  | "tufted"
  | "round"
  | "barn"
  | "dusk"
  | "neon"
  | "arcade"
  | "sentinel"
  | "prism";

export const HOOT_FACE_STYLES: readonly HootFaceStyle[] = [
  "grand",
  "compact",
  "tufted",
  "round",
  "barn",
  "dusk",
  "neon",
  "arcade",
  "sentinel",
  "prism",
] as const;

export const HOOT_FACE_STYLE_STORAGE = "hoot-face-style";
export const HOOT_FACE_VARIANT_EVENT = "hoot-face-variant-change";

export type HootFaceStyleMeta = {
  label: string;
  tagline: string;
  width: number;
  faceRows: number;
  tickMs: number;
  motionClass: string;
  minSize: number;
  hasCaption: boolean;
};

export const NEON_WIDTH = 13;
export const NEON_FACE_ROWS = 5;
export const NEON_TICK_MS = 240;
export const NEON_EYE_L_COL = 4;
export const NEON_EYE_R_COL = 8;
export const NEON_BEAK_COL = 6;
export const NEON_THIRD_COL = 4;

export const ARCADE_FACE_ROWS = 5;
export const ARCADE_TICK_MS = 320;
export const ARCADE_EYE_L_COL = 2;
export const ARCADE_EYE_R_COL = 6;
export const ARCADE_BEAK_COL = 5;

export const SENTINEL_WIDTH = 15;
export const SENTINEL_FACE_ROWS = 6;
export const SENTINEL_TICK_MS = GRAND_TICK_MS;
export const SENTINEL_EYE_L_COL = 5;
export const SENTINEL_EYE_R_COL = 9;
export const SENTINEL_BEAK_COL = 7;

export const PRISM_FACE_ROWS = 4;
export const PRISM_TICK_MS = 260;
export const PRISM_EYE_L_COL = 4;
export const PRISM_EYE_R_COL = 6;
export const PRISM_BEAK_COL = 5;
export const PRISM_THIRD_COL = 5;

export const TUFTED_FACE_ROWS = 4;
export const TUFTED_TICK_MS = 300;
export const TUFTED_EYE_L_COL = 3;
export const TUFTED_EYE_R_COL = 7;
export const TUFTED_BEAK_COL = 5;
export const TUFTED_THIRD_COL = 5;

export const ROUND_FACE_ROWS = 4;
export const ROUND_TICK_MS = 320;
export const ROUND_EYE_L_COL = 3;
export const ROUND_EYE_R_COL = 7;
export const ROUND_BEAK_COL = 5;

export const BARN_FACE_ROWS = 4;
export const BARN_TICK_MS = 340;
export const BARN_EYE_L_COL = 3;
export const BARN_EYE_R_COL = 7;
export const BARN_BEAK_COL = 5;

export const DUSK_FACE_ROWS = 4;
export const DUSK_TICK_MS = 360;
export const DUSK_EYE_L_COL = 3;
export const DUSK_EYE_R_COL = 7;
export const DUSK_BEAK_COL = 5;

export const HOOT_FACE_STYLE_META: Record<HootFaceStyle, HootFaceStyleMeta> = {
  grand: {
    label: "Grand",
    tagline: "instrument panel",
    width: GRAND_WIDTH,
    faceRows: GRAND_FACE_ROWS,
    tickMs: GRAND_TICK_MS,
    motionClass: "hoot-ascii--cognitive",
    minSize: 56,
    hasCaption: true,
  },
  compact: {
    label: "Compact",
    tagline: "cognitive cascade",
    width: WIDTH,
    faceRows: HOOT_FACE_ROWS,
    tickMs: 0,
    motionClass: "hoot-ascii--cognitive",
    minSize: 44,
    hasCaption: true,
  },
  tufted: {
    label: "Tufted",
    tagline: "horned owl",
    width: WIDTH,
    faceRows: TUFTED_FACE_ROWS,
    tickMs: TUFTED_TICK_MS,
    motionClass: "hoot-ascii--tufted",
    minSize: 52,
    hasCaption: true,
  },
  round: {
    label: "Round",
    tagline: "snowy owl",
    width: WIDTH,
    faceRows: ROUND_FACE_ROWS,
    tickMs: ROUND_TICK_MS,
    motionClass: "hoot-ascii--round",
    minSize: 48,
    hasCaption: true,
  },
  barn: {
    label: "Barn",
    tagline: "heart-faced owl",
    width: WIDTH,
    faceRows: BARN_FACE_ROWS,
    tickMs: BARN_TICK_MS,
    motionClass: "hoot-ascii--barn",
    minSize: 52,
    hasCaption: true,
  },
  dusk: {
    label: "Dusk",
    tagline: "night hunter",
    width: WIDTH,
    faceRows: DUSK_FACE_ROWS,
    tickMs: DUSK_TICK_MS,
    motionClass: "hoot-ascii--dusk",
    minSize: 48,
    hasCaption: true,
  },
  neon: {
    label: "Neon",
    tagline: "HUD bracket glow",
    width: NEON_WIDTH,
    faceRows: NEON_FACE_ROWS,
    tickMs: NEON_TICK_MS,
    motionClass: "hoot-ascii--neon",
    minSize: 64,
    hasCaption: true,
  },
  arcade: {
    label: "Arcade",
    tagline: "retro pixel owl",
    width: WIDTH,
    faceRows: ARCADE_FACE_ROWS,
    tickMs: ARCADE_TICK_MS,
    motionClass: "hoot-ascii--arcade",
    minSize: 56,
    hasCaption: true,
  },
  sentinel: {
    label: "Sentinel",
    tagline: "tactical hawk",
    width: SENTINEL_WIDTH,
    faceRows: SENTINEL_FACE_ROWS,
    tickMs: SENTINEL_TICK_MS,
    motionClass: "hoot-ascii--sentinel",
    minSize: 72,
    hasCaption: true,
  },
  prism: {
    label: "Prism",
    tagline: "crystalline gem",
    width: WIDTH,
    faceRows: PRISM_FACE_ROWS,
    tickMs: PRISM_TICK_MS,
    motionClass: "hoot-ascii--prism",
    minSize: 52,
    hasCaption: true,
  },
};

function styleRow(slots: Record<number, string>, width: number): string {
  const row = Array(width).fill(" ");
  for (const [col, ch] of Object.entries(slots)) {
    const idx = Number(col);
    if (idx >= 0 && idx < width) row[idx] = ch.slice(0, 1);
  }
  return row.join("");
}

function fitCaption(text: string, width: number): string {
  const t = text.trim().slice(0, width);
  if (t.length >= width) return t;
  const pad = width - t.length;
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + t + " ".repeat(width - t.length - left);
}

function resolveCaption(
  ctx: HootMoodContext,
  frame: number,
  width: number,
  statusOverride?: string | null,
  fallback?: string,
): string {
  if (statusOverride) return fitCaption(statusOverride, width);
  const emotion = resolveHootEmotion(ctx);
  const text = emotion.caption || fallback || peekCognitiveFace(ctx, frame).caption;
  return fitCaption(text || "HOOT", width);
}

export function renderNeonLines(ctx: HootMoodContext, frame: number, statusOverride?: string | null): string[] {
  const face = peekCognitiveFace(ctx, frame);
  const bar = Array(9).fill("═");
  bar[frame % bar.length] = "█";
  if ((frame + 3) % bar.length !== frame % bar.length) bar[(frame + 3) % bar.length] = "▓";

  const lines = [
    styleRow(
      {
        2: "+",
        3: "─",
        4: "·",
        5: "─",
        6: face.thirdEye,
        7: "─",
        8: "·",
        9: "─",
        10: "+",
      },
      NEON_WIDTH,
    ),
    styleRow({ 2: "|", 10: "|" }, NEON_WIDTH),
    styleRow({ 2: "(", [NEON_EYE_L_COL]: face.eyeL, [NEON_EYE_R_COL]: face.eyeR, 10: ")" }, NEON_WIDTH),
    styleRow(
      { 2: "|", 3: "_", 4: "_", [NEON_BEAK_COL]: face.beak, 7: "_", 8: "_", 10: "|" },
      NEON_WIDTH,
    ),
    styleRow({ 1: "~", ...Object.fromEntries(bar.map((ch, i) => [i + 2, ch])), 11: "~" }, NEON_WIDTH),
  ];
  lines.push(resolveCaption(ctx, frame, NEON_WIDTH, statusOverride, face.caption));
  return lines;
}

export function renderArcadeLines(ctx: HootMoodContext, frame: number, statusOverride?: string | null): string[] {
  const face = peekCognitiveFace(ctx, frame);
  const blocks = ["█", "▓", "▒"] as const;
  const crown = blocks[frame % blocks.length]!;

  const lines = [
    styleRow({ 2: "/", 3: crown, 4: crown, 5: crown, 6: crown, 7: crown, 8: "\\" }, WIDTH),
    styleRow(
      { 1: "|", [ARCADE_EYE_L_COL]: face.eyeL, 3: "|", 5: "|", [ARCADE_EYE_R_COL]: face.eyeR, 7: "|" },
      WIDTH,
    ),
    styleRow({ 3: "\\", [ARCADE_BEAK_COL]: face.beak, 7: "/" }, WIDTH),
    styleRow({ 2: "|", 3: "_", 4: "_", 5: "_", 6: "_", 7: "_", 8: "|" }, WIDTH),
  ];
  lines.push(resolveCaption(ctx, frame, WIDTH, statusOverride, face.caption));
  return lines;
}

export function renderSentinelLines(ctx: HootMoodContext, frame: number, statusOverride?: string | null): string[] {
  const face = peekCognitiveFace(ctx, frame);
  const health = healthFromContext(ctx);
  const filled = Math.round((health / 100) * 7);
  const sweepL = frame % 6 < 3 ? ">" : "<";
  const sweepR = sweepL;

  const barSlots: Record<number, string> = { 4: "|", 12: "|" };
  for (let i = 0; i < 7; i++) {
    barSlots[5 + i] = i < filled ? "■" : "□";
  }

  const lines = [
    styleRow({ 5: sweepL, 6: "─", 7: "─", 8: "─", 9: sweepR }, SENTINEL_WIDTH),
    styleRow({ 3: "/", 11: "\\" }, SENTINEL_WIDTH),
    styleRow(
      { 3: "[", [SENTINEL_EYE_L_COL]: face.eyeL, [SENTINEL_EYE_R_COL]: face.eyeR, 11: "]" },
      SENTINEL_WIDTH,
    ),
    styleRow({ 5: "\\", 6: "─", [SENTINEL_BEAK_COL]: face.beak, 8: "─", 9: "/" }, SENTINEL_WIDTH),
    styleRow(barSlots, SENTINEL_WIDTH),
    styleRow({ 3: "_", 4: "_", 5: "_", 6: "_", 7: "_", 8: "_", 9: "_", 10: "_", 11: "_" }, SENTINEL_WIDTH),
  ];
  lines.push(resolveCaption(ctx, frame, SENTINEL_WIDTH, statusOverride, face.caption));
  return lines;
}

export function renderTuftedLines(ctx: HootMoodContext, frame: number, statusOverride?: string | null): string[] {
  const face = peekCognitiveFace(ctx, frame);
  const tuft = frame % 2 === 0 ? "\\" : "/";

  const lines = [
    styleRow({ 2: tuft, 3: "_", [TUFTED_THIRD_COL]: face.thirdEye, 7: "_", 8: tuft }, WIDTH),
    styleRow({ 1: "/", 2: "_", [TUFTED_EYE_L_COL]: face.eyeL, 5: " ", [TUFTED_EYE_R_COL]: face.eyeR, 8: "_", 9: "\\" }, WIDTH),
    styleRow({ 3: "\\", 4: " ", [TUFTED_BEAK_COL]: face.beak, 6: " ", 7: "/" }, WIDTH),
    styleRow({ 4: "|", 5: "_", 6: "_", 7: "|" }, WIDTH),
  ];
  lines.push(resolveCaption(ctx, frame, WIDTH, statusOverride, face.caption));
  return lines;
}

export function renderRoundLines(ctx: HootMoodContext, frame: number, statusOverride?: string | null): string[] {
  const face = peekCognitiveFace(ctx, frame);
  const brow = frame % 3 === 0 ? "-" : "─";

  const lines = [
    styleRow({ 3: ".", 4: brow, 5: brow, 6: brow, 7: "." }, WIDTH),
    styleRow({ 2: "(", [ROUND_EYE_L_COL]: face.eyeL, 5: " ", [ROUND_EYE_R_COL]: face.eyeR, 8: ")" }, WIDTH),
    styleRow({ 3: "\\", 4: " ", [ROUND_BEAK_COL]: face.beak, 6: " ", 7: "/" }, WIDTH),
    styleRow({ 4: "'", 5: "─", 6: "'" }, WIDTH),
  ];
  lines.push(resolveCaption(ctx, frame, WIDTH, statusOverride, face.caption));
  return lines;
}

export function renderBarnLines(ctx: HootMoodContext, frame: number, statusOverride?: string | null): string[] {
  const face = peekCognitiveFace(ctx, frame);

  const lines = [
    styleRow({ 2: "/", 3: "\\", 4: "/", 5: "\\", 6: "/", 7: "\\", 8: "/" }, WIDTH),
    styleRow({ 1: "|", [BARN_EYE_L_COL]: face.eyeL, 5: " ", [BARN_EYE_R_COL]: face.eyeR, 9: "|" }, WIDTH),
    styleRow({ 3: "\\", 4: " ", [BARN_BEAK_COL]: face.beak, 6: " ", 7: "/" }, WIDTH),
    styleRow({ 4: "\\", 5: "_", 6: "/" }, WIDTH),
  ];
  lines.push(resolveCaption(ctx, frame, WIDTH, statusOverride, face.caption));
  return lines;
}

export function renderDuskLines(ctx: HootMoodContext, frame: number, statusOverride?: string | null): string[] {
  const face = peekCognitiveFace(ctx, frame);
  const ear = frame % 2 === 0 ? "_" : "‾";

  const lines = [
    styleRow({ 3: ear, 4: "/", 5: "\\", 6: ear }, WIDTH),
    styleRow({ 2: "(", [DUSK_EYE_L_COL]: face.eyeL, 5: " ", [DUSK_EYE_R_COL]: face.eyeR, 8: ")" }, WIDTH),
    styleRow({ 4: ">", [DUSK_BEAK_COL]: face.beak, 6: "<" }, WIDTH),
    styleRow({ 3: "~", 4: "~", [DUSK_BEAK_COL]: "▽", 6: "~", 7: "~" }, WIDTH),
  ];
  lines.push(resolveCaption(ctx, frame, WIDTH, statusOverride, face.caption));
  return lines;
}

export function renderPrismLines(ctx: HootMoodContext, frame: number, statusOverride?: string | null): string[] {
  const face = peekCognitiveFace(ctx, frame);
  const gem = frame % 2 === 0 ? "◆" : "◇";
  const beak = face.beak === "▽" ? "◇" : face.beak;

  const lines = [
    styleRow({ 2: "/", 3: "\\", 4: gem, [PRISM_THIRD_COL]: face.thirdEye, 6: gem, 7: "/", 8: "\\" }, WIDTH),
    styleRow({ 2: "<", [PRISM_EYE_L_COL]: face.eyeL, [PRISM_EYE_R_COL]: face.eyeR, 8: ">" }, WIDTH),
    styleRow({ 3: "\\", [PRISM_BEAK_COL]: beak, 7: "/" }, WIDTH),
    styleRow({ 2: "‾", 3: "‾", 4: "‾", 5: "‾", 6: "‾", 7: "‾", 8: "‾" }, WIDTH),
  ];
  lines.push(resolveCaption(ctx, frame, WIDTH, statusOverride, face.caption));
  return lines;
}

export function renderFaceLines(
  style: HootFaceStyle,
  mood: HootMood,
  ctx: HootMoodContext,
  offset: PupilOffset,
  frame: number,
  statusOverride?: string | null,
): string[] {
  switch (style) {
    case "grand":
      return renderGrandLines(ctx, frame, statusOverride);
    case "compact":
      return renderCompactLines(mood, offset, frame, statusOverride, ctx);
    case "tufted":
      return renderTuftedLines(ctx, frame, statusOverride);
    case "round":
      return renderRoundLines(ctx, frame, statusOverride);
    case "barn":
      return renderBarnLines(ctx, frame, statusOverride);
    case "dusk":
      return renderDuskLines(ctx, frame, statusOverride);
    case "neon":
      return renderNeonLines(ctx, frame, statusOverride);
    case "arcade":
      return renderArcadeLines(ctx, frame, statusOverride);
    case "sentinel":
      return renderSentinelLines(ctx, frame, statusOverride);
    case "prism":
      return renderPrismLines(ctx, frame, statusOverride);
    default:
      return renderGrandLines(ctx, frame, statusOverride);
  }
}

export function isHootFaceStyle(value: string): value is HootFaceStyle {
  return (HOOT_FACE_STYLES as readonly string[]).includes(value);
}

export function readStoredHootFaceStyle(fallback: HootFaceStyle = "grand"): HootFaceStyle {
  try {
    const style = localStorage.getItem(HOOT_FACE_STYLE_STORAGE);
    if (style && isHootFaceStyle(style)) return style;
    const legacy = localStorage.getItem("hoot-face-variant");
    if (legacy === "compact" || legacy === "grand") return legacy;
  } catch {
    /* storage unavailable */
  }
  return fallback;
}

export function persistHootFaceStyle(style: HootFaceStyle): void {
  try {
    localStorage.setItem(HOOT_FACE_STYLE_STORAGE, style);
    localStorage.setItem("hoot-face-variant", style === "compact" || style === "grand" ? style : "grand");
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent(HOOT_FACE_VARIANT_EVENT, { detail: style }));
}

export function nextFaceStyle(current: HootFaceStyle): HootFaceStyle {
  const idx = HOOT_FACE_STYLES.indexOf(current);
  return HOOT_FACE_STYLES[(idx + 1) % HOOT_FACE_STYLES.length]!;
}

export function faceContext(mood: HootMood, moodContext?: HootMoodContext): HootMoodContext {
  return moodContext ?? minimalMoodContext(mood);
}

/** @deprecated Use readStoredHootFaceStyle */
export function readStoredHootFaceVariant(fallback: "compact" | "grand" = "grand"): "compact" | "grand" {
  const style = readStoredHootFaceStyle(fallback);
  return style === "compact" ? "compact" : "grand";
}