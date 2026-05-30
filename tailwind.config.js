/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Songti SC"', '"Noto Serif SC"', '"Source Han Serif SC"', 'serif'],
        sans: ['"PingFang SC"', '"Microsoft YaHei"', '"Source Han Sans SC"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 18px 45px rgba(53, 63, 72, 0.11)',
        'card-dark': '0 18px 45px rgba(0, 0, 0, 0.35)',
        soft: '0 12px 30px rgba(71, 85, 105, 0.10)',
        'soft-dark': '0 12px 30px rgba(0, 0, 0, 0.30)',
      },
    },
  },
  plugins: [],
};
