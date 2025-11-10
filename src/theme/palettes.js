// Tema único: claro/escuro
const BASE = {
  danger: "#EF4444",
  success: "#10B981",
  warning: "#FBBF24",
  active: "#a37f5e",
  inactive: "#9CA3AF",
};

const LIGHT = {
  ...BASE,
  primary: "#a37f5e",
  primaryDark: "#8b684d",
  bg: "#fbfaf8",
  card: "#ffffff",
  border: "#efe6dc",
  text: "#533b29",
  muted: "#8b684d",
};

const DARK = {
  ...BASE,
  primary: "#c3a382",
  primaryDark: "#a37f5e",
  bg: "#111827",
  card: "#1f2937",
  border: "#374151",
  text: "#f3f4f6",
  muted: "#d6c0a6",
  active: "#c3a382",
};

export function getPalette(mode = "dark") {
  return mode === "light" ? LIGHT : DARK;
}


