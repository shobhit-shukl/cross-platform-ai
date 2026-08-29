import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        // --font-jakarta is injected by next/font in layout.tsx. The default stack is
        // kept as fallback so text still renders correctly if the font fails to load.
        sans: ['var(--font-jakarta)', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        'surface-hover': 'var(--surface-hover)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        ink: {
          DEFAULT: 'var(--ink)',
          soft: 'var(--ink-soft)',
          faint: 'var(--ink-faint)',
        },
        brand: {
          violet: '#8b5cf6',
          cyan: '#22d3ee',
          pink: '#ec4899',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 35%, #22d3ee 70%, #ec4899 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, rgba(139,92,246,.18) 0%, rgba(34,211,238,.14) 100%)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '400ms',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(4%, -6%) scale(1.08)' },
        },
        'float-medium': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-6%, 5%) scale(0.94)' },
        },
        'float-reverse': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-3%, -4%) scale(1.05)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Halo around the "Live" status dot. Separate from Tailwind's built-in
        // animate-pulse (which fades the whole element) — this expands a ring outward
        // so the dot itself stays fully opaque and legible.
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '70%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        // Slow hue drift for gradient text, so headings feel alive without moving.
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'float-slow': 'float-slow 22s ease-in-out infinite',
        'float-medium': 'float-medium 26s ease-in-out infinite',
        'float-reverse': 'float-reverse 30s ease-in-out infinite',
        marquee: 'marquee 28s linear infinite',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.4, 0, 0.2, 1) both',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient-shift': 'gradient-shift 6s ease infinite',
      },
    },
  },
  plugins: [],
};

export default config;
