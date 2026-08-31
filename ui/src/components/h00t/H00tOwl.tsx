import { useEffect, useState } from "react";
import HootLogo from "@/lib/h00t-logo";
import { moodColor, moodFrameInterval, moodLabel, type HootMood, type HootMoodContext } from "@/lib/h00t-ascii";
import {
  HOOT_FACE_STYLE_META,
  HOOT_FACE_VARIANT_EVENT,
  readStoredHootFaceStyle,
  type HootFaceStyle,
} from "@/lib/h00t-face-styles";

export default function HootOwl({
  mood,
  moodContext,
  size = "sm",
  onClick,
  statusLine,
  showWordmark = false,
  className,
}: {
  mood: HootMood;
  moodContext?: HootMoodContext;
  size?: "sm" | "lg";
  onClick?: () => void;
  statusLine?: string | null;
  showWordmark?: boolean;
  className?: string;
}) {
  const [frame, setFrame] = useState(0);
  const [faceStyle, setFaceStyle] = useState<HootFaceStyle>(() => readStoredHootFaceStyle("grand"));
  const styleMeta = HOOT_FACE_STYLE_META[faceStyle];
  const showFaceCaption = !showWordmark && styleMeta.hasCaption;
  const px = size === "lg" ? (showWordmark ? 200 : showFaceCaption ? 124 : 108) : showFaceCaption ? 96 : 84;
  const color = moodColor(mood);

  useEffect(() => {
    const onStyle = (e: Event) => setFaceStyle((e as CustomEvent<HootFaceStyle>).detail);
    window.addEventListener(HOOT_FACE_VARIANT_EVENT, onStyle);
    return () => window.removeEventListener(HOOT_FACE_VARIANT_EVENT, onStyle);
  }, []);

  useEffect(() => {
    const ms =
      faceStyle === "compact"
        ? moodFrameInterval(mood, Boolean(moodContext))
        : styleMeta.tickMs || moodFrameInterval(mood, Boolean(moodContext));
    const id = setInterval(() => setFrame((f) => f + 1), ms);
    return () => clearInterval(id);
  }, [mood, moodContext, faceStyle, styleMeta.tickMs]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        overflow: className?.includes("hoot-deck-owl") ? "visible" : undefined,
      }}
    >
      <HootLogo
        mood={mood}
        moodContext={moodContext}
        size={px}
        frame={frame}
        onClick={onClick}
        showWordmark={showWordmark}
        statusLine={statusLine}
        trackMouse={!moodContext}
        faceStyle={faceStyle}
        className={className}
      />
      {!showWordmark && !showFaceCaption && (
        <span
          style={{
            fontSize: 8,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            opacity: 0.45,
            color,
            maxWidth: 120,
            textAlign: "center",
            fontFamily: "'Fira Code', monospace",
          }}
        >
          {statusLine ? statusLine.slice(0, 28) : moodLabel(mood)}
        </span>
      )}
    </div>
  );
}
