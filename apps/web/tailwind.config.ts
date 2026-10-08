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
        ink: "#0a0b0d",
        panel: "#111317",
        raised: "#181b21",
        line: "#242830",
        // Text
        fg: "#e7e9ee",
        mute: "#8a92a0",
        faint: "#5b6270",
        // One accent for actions and selection
        accent: { DEFAULT: "#5cc8ff", dim: "#17384a", ink: "#04121c" },
        // Verdicts
        fail: "#ff6464",
        pass: "#3ddc97",
        warn: "#f5b83d",
      },
    },
  },
  plugins: [],
};

export default config;
