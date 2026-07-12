import { createContext, useContext } from "react";

export type TooltipPortalValue = {
  /** Document body that receives portaled overlays (usually the main app window). */
  root: HTMLElement;
  mapPosition: (anchor: HTMLElement, placement: "above" | "below") => { left: number; top: number };
  /** Map PiP/popup client coordinates to main-window fixed coordinates. */
  mapPoint: (x: number, y: number) => { left: number; top: number };
};

const TooltipPortalContext = createContext<TooltipPortalValue | null>(null);

export function TooltipPortalProvider({
  value,
  children,
}: {
  value: TooltipPortalValue | null;
  children: React.ReactNode;
}) {
  return <TooltipPortalContext.Provider value={value}>{children}</TooltipPortalContext.Provider>;
}

export function useTooltipPortal() {
  return useContext(TooltipPortalContext);
}

/** Map PiP/popup anchor rects to fixed coordinates on the main window. */
export function pipOverlayPortal(pipWindow: Window): TooltipPortalValue {
  return {
    root: document.body,
    mapPosition: (anchor, placement) => {
      const rect = anchor.getBoundingClientRect();
      const left = pipWindow.screenX + rect.left + rect.width / 2;
      const top =
        placement === "below"
          ? pipWindow.screenY + rect.bottom + 10
          : pipWindow.screenY + rect.top - 10;
      return { left, top };
    },
    mapPoint: (x, y) => ({
      left: pipWindow.screenX + x,
      top: pipWindow.screenY + y,
    }),
  };
}