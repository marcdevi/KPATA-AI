import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0B63F3',
        'primary-light': '#EEF4FF',
      },
    },
  },
  plugins: [],
};

export default config;
