import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nothing: {
          black: '#0A0A0A',
          surface: '#111111',
          muted: '#171717',
          text: '#FFFFFF',
          dim: '#9C9CA1',
          critical: '#FF4D4D',
          warning: '#FF9F43',
          active: '#2BD576',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Segoe UI', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
      },
      boxShadow: {
        none: 'none',
      },
    },
  },
};

export default config;
