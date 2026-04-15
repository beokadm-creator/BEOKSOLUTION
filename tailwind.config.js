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
        // eRegi Academic Palette - HSL based design tokens
        eregi: {
          'primary': 'hsl(var(--eregi-primary))',
          'primary-hover': 'hsl(var(--eregi-primary-hover))',
          'primary-foreground': 'hsl(var(--eregi-primary-foreground))',

          'secondary': 'hsl(var(--eregi-secondary))',
          'secondary-hover': 'hsl(var(--eregi-secondary-hover))',
          'secondary-foreground': 'hsl(var(--eregi-secondary-foreground))',

          'neutral-50': 'hsl(var(--eregi-neutral-50))',
          'neutral-100': 'hsl(var(--eregi-neutral-100))',
          'neutral-200': 'hsl(var(--eregi-neutral-200))',

          'success': 'hsl(var(--eregi-success))',
          'success-foreground': 'hsl(var(--eregi-success-foreground))',

          'warning': 'hsl(var(--eregi-warning))',
          'warning-foreground': 'hsl(var(--eregi-warning-foreground))',

          'error': 'hsl(var(--eregi-error))',
          'error-foreground': 'hsl(var(--eregi-error-foreground))',

          // Legacy palette for backwards compatibility
          50: '#f0f5fa',
          100: '#e1ecf6',
          200: '#c3daee',
          300: '#a5c8e6',
          400: '#69a4d6',
          500: '#2d80c6',
          600: '#24669e',
          700: '#1b4d77',
          800: '#003366',
          900: '#002244',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        eregi: "0.75rem", // 12px
      },
      fontFamily: {
        // Academic Elegance Typography System
        'display': ['Spectral', 'Charter', 'Georgia', 'serif'], // Editorial serif for headings and display
        'body': ['Source Sans 3', 'system-ui', 'sans-serif'], // Clean, readable sans for body text
        'mono': ['Berkeley Mono', 'JetBrains Mono', 'Consolas', 'monospace'], // Academic monospace for code
      },
      fontSize: {
        // Academic Elegance Type Scale - 1.333 Perfect Fourth ratio
        // Display sizes with fluid scaling for headings
        'display-xl': ['clamp(3.5rem, 4vw + 2rem, 5.5rem)', {
          fontWeight: '600',
          lineHeight: '1.1',
          letterSpacing: '-0.02em',
          fontFamily: ['Spectral', 'Charter', 'Georgia', 'serif']
        }],
        'display-lg': ['clamp(2.875rem, 3.5vw + 1.5rem, 4.5rem)', {
          fontWeight: '600',
          lineHeight: '1.15',
          letterSpacing: '-0.015em',
          fontFamily: ['Spectral', 'Charter', 'Georgia', 'serif']
        }],
        'display-md': ['clamp(2.25rem, 3vw + 1rem, 3.5rem)', {
          fontWeight: '500',
          lineHeight: '1.2',
          letterSpacing: '-0.01em',
          fontFamily: ['Spectral', 'Charter', 'Georgia', 'serif']
        }],

        // Heading hierarchy with fixed rem sizing for UI consistency
        'heading-1': ['2.5rem', {
          fontWeight: '600',
          lineHeight: '1.2',
          letterSpacing: '-0.01em',
          fontFamily: ['Spectral', 'Charter', 'Georgia', 'serif']
        }],
        'heading-2': ['2rem', {
          fontWeight: '600',
          lineHeight: '1.25',
          letterSpacing: '-0.005em',
          fontFamily: ['Spectral', 'Charter', 'Georgia', 'serif']
        }],
        'heading-3': ['1.5rem', {
          fontWeight: '600',
          lineHeight: '1.3',
          fontFamily: ['Spectral', 'Charter', 'Georgia', 'serif']
        }],
        'heading-4': ['1.25rem', {
          fontWeight: '600',
          lineHeight: '1.35',
          fontFamily: ['Source Sans 3', 'system-ui', 'sans-serif']
        }],
        'heading-5': ['1.125rem', {
          fontWeight: '600',
          lineHeight: '1.4',
          fontFamily: ['Source Sans 3', 'system-ui', 'sans-serif']
        }],

        // Body text hierarchy
        'body-xl': ['1.125rem', {
          fontWeight: '400',
          lineHeight: '1.6',
          fontFamily: ['Source Sans 3', 'system-ui', 'sans-serif']
        }],
        'body': ['1rem', {
          fontWeight: '400',
          lineHeight: '1.5',
          fontFamily: ['Source Sans 3', 'system-ui', 'sans-serif']
        }],
        'body-sm': ['0.875rem', {
          fontWeight: '400',
          lineHeight: '1.45',
          fontFamily: ['Source Sans 3', 'system-ui', 'sans-serif']
        }],
        'body-xs': ['0.75rem', {
          fontWeight: '400',
          lineHeight: '1.4',
          fontFamily: ['Source Sans 3', 'system-ui', 'sans-serif']
        }],

        // Specialized text roles
        'caption': ['0.875rem', {
          fontWeight: '500',
          lineHeight: '1.35',
          letterSpacing: '0.01em',
          fontFamily: ['Source Sans 3', 'system-ui', 'sans-serif']
        }],
        'label': ['0.875rem', {
          fontWeight: '500',
          lineHeight: '1.25',
          letterSpacing: '0.005em',
          fontFamily: ['Source Sans 3', 'system-ui', 'sans-serif']
        }],
        'overline': ['0.75rem', {
          fontWeight: '600',
          lineHeight: '1.2',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily: ['Source Sans 3', 'system-ui', 'sans-serif']
        }],
      }
    },
  },
  plugins: [],
}
