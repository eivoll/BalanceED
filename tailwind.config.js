/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'rgb(var(--c-page) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--c-accent-hover) / <alpha-value>)',
        accent2: 'rgb(var(--c-accent2) / <alpha-value>)',
        onaccent: 'rgb(var(--c-onaccent) / <alpha-value>)',
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        free: 'rgb(var(--c-free) / <alpha-value>)',
        busy: 'rgb(var(--c-busy) / <alpha-value>)',
      },
      boxShadow: {
        card: '0 1px 2px rgb(2 6 23 / 0.05), 0 8px 24px -12px rgb(2 6 23 / 0.14)',
        lift: '0 4px 6px -2px rgb(2 6 23 / 0.08), 0 16px 32px -12px rgb(2 6 23 / 0.22)',
        glow: '0 0 0 4px rgb(var(--c-ok) / 0.15)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
