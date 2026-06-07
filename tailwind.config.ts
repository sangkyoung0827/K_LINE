import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        paper: "#F4EBDD",
        hanji: "#EFE3D0",
        wood: "#6f4a2f",
        navy: "#1F2A44",
        brass: "#D6A85A",
        pine: "#6B8F71",
        muted: "#4B5563"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"]
      },
      boxShadow: {
        soft: "0 20px 55px rgba(31, 42, 68, 0.12)",
        lift: "0 18px 40px rgba(31, 42, 68, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
