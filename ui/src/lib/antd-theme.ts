import { theme } from "antd";
import type { ThemeConfig } from "antd";

/**
 * Ant Design 6 theme for HOOT.
 * Dark OLED aesthetic with amber/gold primary accents.
 * Derived from the existing HOOT brand tokens and the UI/UX Pro Max
 * generated design system (Dark Mode OLED, Inter typography).
 */
export const hootTheme: ThemeConfig = {
  algorithm: [theme.darkAlgorithm],
  token: {
    colorPrimary: "#ffb042",
    colorPrimaryHover: "#ffca7a",
    colorPrimaryActive: "#e69c2f",
    colorPrimaryText: "#ffb042",
    colorPrimaryTextHover: "#ffca7a",
    colorPrimaryTextActive: "#e69c2f",
    colorBgBase: "#0a0a0a",
    colorBgContainer: "#141414",
    colorBgElevated: "#1a1a1a",
    colorBgLayout: "#0a0a0a",
    colorTextBase: "#f5f5f5",
    colorText: "rgba(245,245,245,0.88)",
    colorTextSecondary: "rgba(245,245,245,0.65)",
    colorTextTertiary: "rgba(245,245,245,0.45)",
    colorBorder: "rgba(255,255,255,0.08)",
    colorBorderSecondary: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderRadiusLG: 14,
    borderRadiusSM: 8,
    borderRadiusXS: 4,
    fontFamily:
      "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontFamilyCode:
      "'Fira Code', 'Cascadia Mono', 'Consolas', monospace",
    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 28,
  },
  components: {
    Menu: {
      colorItemText: "rgba(245,245,245,0.65)",
      colorItemTextHover: "#ffb042",
      colorItemTextSelected: "#ffb042",
      colorItemBg: "transparent",
      colorItemBgHover: "rgba(255,176,66,0.08)",
      colorItemBgSelected: "rgba(255,176,66,0.12)",
      colorItemBgSelectedHover: "rgba(255,176,66,0.16)",
      colorSubItemBg: "transparent",
      colorGroupTitle: "rgba(245,245,245,0.45)",
      itemMarginInline: 8,
      itemBorderRadius: 10,
      iconMarginInlineEnd: 12,
      iconSize: 18,
      collapsedIconSize: 20,
    },
    Tooltip: {
      colorBgSpotlight: "#1a1a1a",
      colorTextLightSolid: "#f5f5f5",
      borderRadius: 10,
      borderRadiusSM: 10,
      boxShadowSecondary:
        "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset",
    },
    Button: {
      colorPrimary: "#ffb042",
      colorPrimaryHover: "#ffca7a",
      colorPrimaryActive: "#e69c2f",
      colorTextLightSolid: "#0a0a0a",
      borderRadius: 10,
      borderRadiusSM: 8,
      borderRadiusLG: 12,
    },
    Card: {
      colorBgContainer: "#141414",
      colorBorderSecondary: "rgba(255,255,255,0.08)",
      borderRadiusLG: 16,
      boxShadowTertiary:
        "0 4px 24px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.04) inset",
    },
    Skeleton: {
      color: "rgba(255,255,255,0.06)",
      colorGradientEnd: "rgba(255,255,255,0.09)",
      borderRadius: 10,
    },
    Empty: {
      colorText: "rgba(245,245,245,0.45)",
      colorTextDescription: "rgba(245,245,245,0.35)",
    },
  },
};
