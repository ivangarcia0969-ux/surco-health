import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tema healthcare: teal médico como color de marca (antes azul #3b6bff).
        // Remapear aquí re-tematiza TODA la app interior (botones, links,
        // estados activos, acentos) de azul a teal, a juego con el landing.
        brand: {
          50: '#f0fdfa',
          100: '#cdfaf2',
          200: '#9bf0e4',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          900: '#134e4a',
        },
        clinical: {
          healthy: '#10b981',
          caries: '#ef4444',
          filling: '#3b82f6',
          crown: '#f59e0b',
          implant: '#8b5cf6',
          absent: '#9ca3af',
        },
        // Tema healthcare (landing): teal calmado + menta
        care: {
          50: '#f0fdfa',
          100: '#cdfaf2',
          200: '#9bf0e4',
          300: '#5fe0d2',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          900: '#134e4a',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
