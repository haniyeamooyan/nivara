// Nivara Design Tokens and Style Helpers
// Adheres strictly to:
// - Electric Cobalt (#3B49DF) primary + Radiant Amber (#D97706) accent
// - Distinct semantic statuses (Success Emerald, Danger Rose, Amber Pending, Slate Neutral)
// - WCAG AA contrast, no AI slop clichés, mathematically consistent radii and padding

export const TOKENS = {
  colors: {
    brand: {
      light: "#3B49DF",
      lightHover: "#2F3AB2",
      lightSurface: "#EEF2FF",
      dark: "#6366F1",
      darkHover: "#4F46E5",
      darkSurface: "#1E1B4B",
    },
    accent: {
      light: "#D97706",
      lightBg: "#FEF3C7",
      dark: "#F59E0B",
      darkBg: "#78350F",
    },
    semantic: {
      success: { lightText: "#065F46", lightBg: "#ECFDF5", lightBorder: "#A7F3D0", darkText: "#34D399", darkBg: "#064E3B", darkBorder: "#047857" },
      pending: { lightText: "#92400E", lightBg: "#FFFBEB", lightBorder: "#FDE68A", darkText: "#FBBF24", darkBg: "#78350F", darkBorder: "#B45309" },
      danger: { lightText: "#991B1B", lightBg: "#FEF2F2", lightBorder: "#FECACA", darkText: "#F87171", darkBg: "#7F1D1D", darkBorder: "#B91C1C" },
      neutral: { lightText: "#334155", lightBg: "#F1F5F9", lightBorder: "#CBD5E1", darkText: "#94A3B8", darkBg: "#1E293B", darkBorder: "#334155" },
    },
    canvas: {
      light: "#F8FAFC",
      dark: "#0B0F17",
    },
    card: {
      light: "#FFFFFF",
      dark: "#131B2A",
    },
    border: {
      light: "#E2E8F0",
      dark: "#1E293B",
    },
    text: {
      primaryLight: "#0F172A",
      mutedLight: "#64748B",
      primaryDark: "#F8FAFC",
      mutedDark: "#94A3B8",
    },
  },
  radii: {
    sm: "6px",
    md: "10px",
    lg: "14px",
    pill: "9999px",
  },
};
