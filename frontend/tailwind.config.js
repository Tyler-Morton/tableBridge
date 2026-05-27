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
      transitionTimingFunction: {
        // Strong ease-out for UI interactions — punchy, responsive
        "out-expo": "cubic-bezier(0.23, 1, 0.32, 1)",
      },
      animation: {
        // Continuous pulse on the order alert ring
        "alert-pulse": "alert-pulse 1.4s ease-in-out infinite",
        // Alert banner entrance — scale from 0.95, not from nothing
        "slide-in": "slide-in 0.28s cubic-bezier(0.23, 1, 0.32, 1) both",
        // List item stagger — used with inline animation-delay
        "enter": "enter 0.22s cubic-bezier(0.23, 1, 0.32, 1) both",
        // Modal backdrop
        "fade-in": "fade-in 0.15s ease-out both",
        // Modal card entrance — scales in from center
        "modal-enter": "modal-enter 0.2s cubic-bezier(0.23, 1, 0.32, 1) both",
      },
      keyframes: {
        "alert-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(220,38,38,0.7)" },
          "50%": { boxShadow: "0 0 0 18px rgba(220,38,38,0)" },
        },
        // Nothing in the real world appears from thin air
        "slide-in": {
          "0%": { transform: "translateY(-10px) scale(0.95)", opacity: "0" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "enter": {
          "0%": { transform: "translateY(6px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "modal-enter": {
          "0%": { transform: "scale(0.95) translateY(4px)", opacity: "0" },
          "100%": { transform: "scale(1) translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
