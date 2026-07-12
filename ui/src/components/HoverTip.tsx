import { type ReactElement, type ReactNode, cloneElement, isValidElement } from "react";
import HelpTooltip, { type HelpTooltipProps } from "./HelpTooltip";
import { getTooltip, tooltipTitle, type TooltipId } from "@/lib/tooltips";

type HoverTipProps = {
  id: TooltipId;
  children: ReactElement;
  width?: number;
  /** Spread tooltip above (default) or below the trigger. */
  placement?: "above" | "below";
};

/** Wraps a control with an expanded rich tooltip on hover/focus. */
export default function HoverTip({ id, children, width, placement }: HoverTipProps) {
  const tip = getTooltip(id);
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ title?: string }>, { title: tooltipTitle(id) })
    : children;

  return (
    <HelpTooltip {...tip} width={width} placement={placement}>
      {child}
    </HelpTooltip>
  );
}

/** Inline help icon next to a label — same registry, no child wrapper. */
export function TipIcon({ id, size = 12 }: { id: TooltipId; size?: number }) {
  return <HelpTooltip {...getTooltip(id)} size={size} />;
}