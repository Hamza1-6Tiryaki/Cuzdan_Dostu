/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef9f4",
          100: "#d6f1e5",
          200: "#a8e2c8",
          300: "#6dcca5",
          400: "#34b07e",
          500: "#1a9464",
          600: "#0f7550",
          700: "#0c5e40",
          800: "#0b4a34",
          900: "#093c2b",
        },
        dark: {
          900: "#060b12",
          800: "#0d1520",
          700: "#101e2e",
          600: "#162438",
          500: "#1c2e46",
          400: "#243a58",
          300: "#2e4a6e",
        },
        accent: {
          gold:  "#f5c842",
          coral: "#ff6b6b",
          sky:   "#4fc3f7",
          purple:"#9c66ff",
        },
      },
      fontFamily: {
        sans: ["'Inter'", "'Outfit'", "sans-serif"],
        display: ["'Outfit'", "sans-serif"],
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(135deg, #060b12 0%, #0d1520 40%, #101e2e 70%, #0a1f14 100%)",
        "card-gradient": "linear-gradient(145deg, rgba(22,36,56,0.8) 0%, rgba(13,21,32,0.9) 100%)",
        "brand-gradient":"linear-gradient(135deg, #1a9464 0%, #0f7550 100%)",
        "gold-gradient": "linear-gradient(135deg, #f5c842 0%, #e0a800 100%)",
      },
      animation: {
        "float":       "float 6s ease-in-out infinite",
        "pulse-slow":  "pulse 4s cubic-bezier(0.4,0,0.6,1) infinite",
        "slide-up":    "slideUp 0.5s ease-out",
        "fade-in":     "fadeIn 0.4s ease-out",
        "shimmer":     "shimmer 2s linear infinite",
      },
      keyframes: {
        float:    { "0%,100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-20px)" } },
        slideUp:  { from: { opacity: 0, transform: "translateY(20px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        shimmer:  { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      backdropBlur: { xs: "2px" },
      boxShadow: {
        "glass":  "0 8px 32px 0 rgba(0,0,0,0.37)",
        "brand":  "0 0 30px rgba(26,148,100,0.3)",
        "gold":   "0 0 20px rgba(245,200,66,0.3)",
        "glow":   "0 0 40px rgba(26,148,100,0.2), 0 0 80px rgba(26,148,100,0.1)",
      },
    },
  },
  plugins: [],
};
