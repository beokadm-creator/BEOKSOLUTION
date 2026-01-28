/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // eRegi Standard Palette
        eregi: {
          50: '#f0f5fa',
          100: '#e1ecf6',
          200: '#c3daee',
          300: '#a5c8e6',
          400: '#69a4d6',
          500: '#2d80c6',
          600: '#24669e',
          700: '#1b4d77',
          800: '#003366', // Primary Source
          900: '#002244',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        eregi: "0.75rem", // 12px
      },
      fontSize: {
        'heading-1': ['36px', { fontWeight: '700' }],
        'heading-2': ['30px', { fontWeight: '600' }],
        'heading-3': ['24px', { fontWeight: '600' }],
        'body': ['16px', { fontWeight: '400' }],
        'body-sm': ['14px', { fontWeight: '400' }],
      }
    },
  },
  plugins: [],
}
