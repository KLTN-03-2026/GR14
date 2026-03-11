/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{html,js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "variable-collection-general-300": "var(--variable-collection-general-300)",
        "variable-collection-general-700": "var(--variable-collection-general-700)",
        "variable-collection-general-900": "var(--variable-collection-general-900)",
        "variable-collection-general-white": "var(--variable-collection-general-white)",
        "variable-collection-primary-800": "var(--variable-collection-primary-800)",
      },
      fontFamily: {
        a: "var(--a-font-family)",
        "h-2": "var(--h-2-font-family)",
        "h-4": "var(--h-4-font-family)",
        p: "var(--p-font-family)",
      },
    },
  },
  plugins: [],
};