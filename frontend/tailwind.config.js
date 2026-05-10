/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bridge: {
          50: "#f5f7fb",
          100: "#e8ecf5",
          500: "#3b5fb6",
          600: "#2f4e9b",
          700: "#26407f",
          900: "#142a59",
        },
        warn: { 500: "#f5a623" },
        danger: { 500: "#dc2626", 600: "#b91c1c" },
        good: { 500: "#16a34a" },
      },
      animation: {
        "alert-pulse": "alert-pulse 1.4s ease-in-out infinite",
        "slide-in": "slide-in 0.4s ease-out",
      },
      keyframes: {
        "alert-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(220,38,38,0.7)" },
          "50%": { boxShadow: "0 0 0 18px rgba(220,38,38,0)" },
        },
        "slide-in": {
          "0%": { transform: "translateY(-30px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
