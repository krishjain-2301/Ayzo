import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        heading: ["var(--font-sans)"],
      },
      colors: {
        background: "#000000",
      },
      animation: {
        "drift-1": "drift-1 12s ease-in-out infinite alternate",
        "drift-2": "drift-2 15s ease-in-out infinite alternate",
        "drift-3": "drift-3 10s ease-in-out infinite alternate",
        "grid-pulse": "grid-pulse 3s ease-in-out infinite",
      },
      keyframes: {
        "drift-1": {
          "0%": { transform: "translate(0px, 0px) scale(1)", opacity: "0.2" },
          "100%": { transform: "translate(150px, -80px) scale(1.2)", opacity: "0.4" },
        },
        "drift-2": {
          "0%": { transform: "translate(0px, 0px) scale(1)", opacity: "0.2" },
          "100%": { transform: "translate(-120px, 100px) scale(1.1)", opacity: "0.3" },
        },
        "drift-3": {
          "0%": { transform: "translate(0px, 0px) scale(1)", opacity: "0.15" },
          "100%": { transform: "translate(80px, 150px) scale(1.2)", opacity: "0.3" },
        },
        "grid-pulse": {
          "0%, 100%": { opacity: "0.2" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
