// Tema único: claro/escuro
const BASE = {
  danger: "#EF4444",
  success: "#10B981",
  warning: "#FBBF24",
  active: "#D92626",
  inactive: "#9CA3AF",
};

const LIGHT = {
  ...BASE,
  primary: "#D92626",
  primaryDark: "#B91C1C",
  bg: "#F3F4F6",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  active: "#D92626",
  inactive: "#9CA3AF",
};

const DARK = {
  ...BASE,
  primary: "#EF4444",
  primaryDark: "#DC2626",
  bg: "#111111",
  card: "#18181B",
  border: "#374151",
  text: "#F9FAFB",
  muted: "#9CA3AF",
  active: "#EF4444",
  inactive: "#4B5563",
};

export function getPalette(mode = "dark") {
  return mode === "light" ? LIGHT : DARK;
}


