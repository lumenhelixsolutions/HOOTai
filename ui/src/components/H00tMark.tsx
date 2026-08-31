import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useCoach } from "@/context/CoachContext";
import HootLogo from '@/lib/h00t-logo';
import { moodFrameInterval, resolveHootMoodFromContext } from '@/lib/h00t-ascii';
import {
  HOOT_FACE_STYLE_META,
  HOOT_FACE_VARIANT_EVENT,
  readStoredHootFaceStyle,
  type HootFaceStyle,
} from '@/lib/h00t-face-styles';

type HootMarkProps = {
  size?: number;
};

/** Sidebar ASCII owl mark — same cognitive face as the floating mascot */
export default function HootMark({ size = 44 }: HootMarkProps) {
  const location = useLocation();
  const { hootError, coachOpen, chatLoading, pageContext, topHint } = useCoach();
  const [frame, setFrame] = useState(0);
  const [faceStyle, setFaceStyle] = useState<HootFaceStyle>(() => readStoredHootFaceStyle("grand"));

  const moodContext = useMemo(
    () => ({
      pathname: location.pathname,
      pageContext,
      hasError: Boolean(hootError),
      coachOpen,
      chatLoading,
      topHintTone: topHint?.tone || null,
      hasTopHint: Boolean(topHint),
    }),
    [location.pathname, pageContext, hootError, coachOpen, chatLoading, topHint],
  );

  const mood = resolveHootMoodFromContext(moodContext);
  const styleMeta = HOOT_FACE_STYLE_META[faceStyle];

  useEffect(() => {
    const onStyle = (e: Event) => setFaceStyle((e as CustomEvent<HootFaceStyle>).detail);
    window.addEventListener(HOOT_FACE_VARIANT_EVENT, onStyle);
    return () => window.removeEventListener(HOOT_FACE_VARIANT_EVENT, onStyle);
  }, []);

  const effectiveSize = Math.max(size, styleMeta.minSize);

  useEffect(() => {
    const ms =
      faceStyle === 'compact' ? moodFrameInterval(mood, true) : styleMeta.tickMs || moodFrameInterval(mood, true);
    const id = setInterval(() => setFrame((f) => f + 1), ms);
    return () => clearInterval(id);
  }, [mood, faceStyle, styleMeta.tickMs]);

  return (
    <HootLogo
      mood={mood}
      moodContext={moodContext}
      size={effectiveSize}
      frame={frame}
      trackMouse={false}
      faceStyle={faceStyle}
    />
  );
}
