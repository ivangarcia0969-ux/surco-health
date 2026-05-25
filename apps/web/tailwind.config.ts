import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#dceaff',
          200: '#bbd6ff',
          500: '#3b6bff',
          600: '#2c52ea',
          700: '#2542c2',
          900: '#0e1f70',
        },
        clinical: {
          healthy: '#10b981',
          caries: '#ef4444',
          filling: '#3b82f6',
          crown: '#f59e0b',
          implant: '#8b5cf6',
          absent: '#9ca3af',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
