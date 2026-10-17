import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// DBI brand: green #03C14B (growth) + blue #0B7BE8 (knowledge), sampled from the official logo.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf3', 100: '#d1fadf', 200: '#a6f4c5', 300: '#6ce9a6', 400: '#2fd77a',
          500: '#03c14b', 600: '#02a13f', 700: '#047f35', 800: '#08642e', 900: '#0a5228', 950: '#022e15',
        },
        sky: {
          50: '#eef6ff', 100: '#d9eaff', 200: '#bcdbff', 300: '#8ec4ff', 400: '#58a3fd',
          500: '#3283f9', 600: '#0b7be8', 700: '#0d62c4', 800: '#11519f', 900: '#14467d', 950: '#112c4d',
        },
        ink: {
          50: '#f6f7f9', 100: '#eceef2', 200: '#d5dae2', 300: '#b0b9c8', 400: '#8592a8', 500: '#66748d',
          600: '#515d74', 700: '#424c5f', 800: '#3a4250', 900: '#1f242d', 950: '#12151b',
        },
        gold: { 300: '#f3dc9b', 400: '#e9c46a', 500: '#d4a72c', 600: '#b8891d', 700: '#8f6a16' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        script: ['"Great Vibes"', 'cursive'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
        lift: '0 12px 32px -12px rgba(16,24,40,.18)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { 'fade-up': 'fade-up .35s ease-out both' },
    },
  },
  plugins: [typography],
} satisfies Config;
