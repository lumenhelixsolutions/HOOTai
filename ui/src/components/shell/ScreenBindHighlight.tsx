/**
 * Season C2 — pulse highlight on data-hoot-bind targets when coach proposes actions.
 */

import { useEffect } from "react";
import { useExecutiveControlOptional } from "@/context/ExecutiveControlContext";

export default function ScreenBindHighlight() {
  const executive = useExecutiveControlOptional();
  const bind = executive?.highlightBind || null;

  useEffect(() => {
    if (!bind) return;
    const selector = `[data-hoot-bind="${CSS.escape(bind)}"]`;
    const nodes = document.querySelectorAll(selector);
    nodes.forEach((el) => {
      el.classList.add("hoot-bind-pulse");
      el.setAttribute("data-hoot-bound-active", "1");
    });
    // Also try nav path without prefix variations
    if (bind.startsWith("nav:")) {
      const path = bind.slice(4);
      document.querySelectorAll(`[data-hoot-bind="nav:${path}"]`).forEach((el) => {
        el.classList.add("hoot-bind-pulse");
      });
    }
    return () => {
      document.querySelectorAll(".hoot-bind-pulse").forEach((el) => {
        el.classList.remove("hoot-bind-pulse");
        el.removeAttribute("data-hoot-bound-active");
      });
    };
  }, [bind]);

  return null;
}
