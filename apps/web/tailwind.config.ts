import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // Surfaces, darkest to lightest
        ink: "#0b0d11",
        panel: "#12151b",
        raised: "#191d25",
        line: "#222834",
        // Text
        fg: "#eceef2",
        mute: "#9aa3b2",
        faint: "#636c7c",
        // One accent for actions and selection
        accent: { DEFAULT: "#4c8dff", dim: "#16233d", ink: "#ffffff" },
        // Status. Always shown with a label, never colour alone.
        fail: "#f2555a",
        pass: "#2fbf8f",
        warn: "#f0b429",
      },
    },
  },
  plugins: [],
};

export default config;
